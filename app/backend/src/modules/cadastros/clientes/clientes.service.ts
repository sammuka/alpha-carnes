import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { clientes, representantes, rotas } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { escopoRepresentantes } from '../../../common/rbac/escopo-representantes';
import { calcularRange, montarPaginado, primeiroOuFalha, type ListarQuery, type Paginado } from '../../../common/crud/paginacao';
import type { CreateClienteDto, UpdateClienteDto } from './dto/cliente.dto';

type Cliente = typeof clientes.$inferSelect;
type ClienteComVinculos = Cliente & { rotaNome: string | null; representanteNome: string | null };

@Injectable()
export class ClientesService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarQuery, usuarioId: string): Promise<Paginado<Cliente> & { totalAtivos: number }> {
    const { limit, offset } = calcularRange(query);
    const filtros = [
      query.incluirRemovidos ? undefined : isNull(clientes.deletedAt),
      escopoRepresentantes(usuarioId, clientes.representanteId),
    ];
    if (query.search) {
      const termo = `%${query.search}%`;
      filtros.push(
        or(
          ilike(clientes.razaoSocial, termo),
          ilike(clientes.nomeFantasia, termo),
          ilike(clientes.codigo, termo),
          ilike(clientes.documentoFiscal, termo),
        ),
      );
    }
    const where = and(...filtros.filter(Boolean));

    const [linhas, totalRow, totalAtivosRow] = await Promise.all([
      this.db.select().from(clientes).where(where).orderBy(desc(clientes.createdAt)).limit(limit).offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(clientes).where(where),
      this.db.select({ total: sql<number>`count(*)::int` }).from(clientes)
        .where(and(
          eq(clientes.status, 'ativo'),
          isNull(clientes.deletedAt),
          escopoRepresentantes(usuarioId, clientes.representanteId),
        )),
    ]);

    return {
      ...montarPaginado(linhas, totalRow[0]?.total ?? 0, query),
      totalAtivos: totalAtivosRow[0]?.total ?? 0,
    };
  }

  async detalhar(id: string, usuarioId: string): Promise<ClienteComVinculos> {
    const cliente = await this.buscarNoEscopo(id, usuarioId);
    if (!cliente) throw new NotFoundException('Cliente não encontrado');

    const [vinculos] = await this.db
      .select({ rotaNome: rotas.nome, representanteNome: representantes.nome })
      .from(clientes)
      .leftJoin(rotas, eq(rotas.id, clientes.rotaId))
      .leftJoin(representantes, eq(representantes.id, clientes.representanteId))
      .where(eq(clientes.id, id));

    return { ...cliente, rotaNome: vinculos?.rotaNome ?? null, representanteNome: vinculos?.representanteNome ?? null };
  }

  async criar(dto: CreateClienteDto, usuarioId: string): Promise<Cliente> {
    return this.db.transaction(async (tx) => {
      if (dto.representanteId) {
        await this.exigirRepresentanteNoEscopo(tx, dto.representanteId, usuarioId);
      }
      await this.assertUnico(tx, dto.codigo, dto.documentoFiscal, null);

      const criado = primeiroOuFalha(
        await tx
          .insert(clientes)
          .values({
            codigo: dto.codigo,
            razaoSocial: dto.razaoSocial,
            nomeFantasia: dto.nomeFantasia,
            documentoFiscal: dto.documentoFiscal,
            status: dto.status,
            representanteId: dto.representanteId,
            rotaId: dto.rotaId,
            prioridade: dto.prioridade,
            preferenciasJson: dto.preferenciasJson ?? {},
            dadosFiscaisJson: dto.dadosFiscaisJson ?? {},
            dadosContatoJson: dto.dadosContatoJson ?? {},
            observacoesOperacionais: dto.observacoesOperacionais,
          })
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'clientes',
        registroId: criado.id,
        operacao: 'INSERT',
        modulo: 'cadastros',
        usuarioId,
        dadosAnteriores: {},
        dadosNovos: criado,
      });
      return criado;
    });
  }

  async atualizar(id: string, dto: UpdateClienteDto, usuarioId: string): Promise<Cliente> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarNoEscopo(id, usuarioId, tx);
      if (!anterior) throw new NotFoundException('Cliente não encontrado');

      if (dto.representanteId !== undefined) {
        await this.exigirRepresentanteNoEscopo(tx, dto.representanteId, usuarioId);
      }

      await this.assertUnico(tx, dto.codigo ?? anterior.codigo, dto.documentoFiscal ?? anterior.documentoFiscal, id);

      const atualizado = primeiroOuFalha(
        await tx
          .update(clientes)
          .set({
            codigo: dto.codigo ?? anterior.codigo,
            razaoSocial: dto.razaoSocial ?? anterior.razaoSocial,
            nomeFantasia: dto.nomeFantasia ?? anterior.nomeFantasia,
            documentoFiscal: dto.documentoFiscal ?? anterior.documentoFiscal,
            status: dto.status ?? anterior.status,
            representanteId: dto.representanteId ?? anterior.representanteId,
            rotaId: dto.rotaId !== undefined ? dto.rotaId : anterior.rotaId,
            prioridade: dto.prioridade ?? anterior.prioridade,
            preferenciasJson: dto.preferenciasJson ?? anterior.preferenciasJson,
            dadosFiscaisJson: dto.dadosFiscaisJson ?? anterior.dadosFiscaisJson,
            dadosContatoJson: dto.dadosContatoJson ?? anterior.dadosContatoJson,
            observacoesOperacionais: dto.observacoesOperacionais ?? anterior.observacoesOperacionais,
          })
          .where(eq(clientes.id, id))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'clientes',
        registroId: id,
        operacao: 'UPDATE',
        modulo: 'cadastros',
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: atualizado,
      });
      return atualizado;
    });
  }

  async remover(id: string, usuarioId: string): Promise<{ id: string; deletedAt: Date }> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarNoEscopo(id, usuarioId, tx);
      if (!anterior) throw new NotFoundException('Cliente não encontrado');

      const removido = primeiroOuFalha(
        await tx.update(clientes).set({ deletedAt: new Date() }).where(eq(clientes.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'clientes',
        registroId: id,
        operacao: 'DELETE',
        modulo: 'cadastros',
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: removido,
      });
      return { id, deletedAt: removido.deletedAt as Date };
    });
  }

  async restaurar(id: string, usuarioId: string): Promise<Cliente> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarNoEscopo(id, usuarioId, tx, true);
      if (!anterior) throw new NotFoundException('Cliente não encontrado');
      if (!anterior.deletedAt) throw new ConflictException('Cliente não está removido');

      await this.assertUnico(tx, anterior.codigo, anterior.documentoFiscal, id);

      const restaurado = primeiroOuFalha(
        await tx.update(clientes).set({ deletedAt: null }).where(eq(clientes.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'clientes',
        registroId: id,
        operacao: 'UPDATE',
        modulo: 'cadastros',
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: restaurado,
      });
      return restaurado;
    });
  }

  private async buscarNoEscopo(
    id: string,
    usuarioId: string,
    exec: NodePgDatabase<typeof schema> = this.db,
    incluirRemovido = false,
  ): Promise<Cliente | null> {
    return exec
      .select()
      .from(clientes)
      .where(and(
        eq(clientes.id, id),
        incluirRemovido ? undefined : isNull(clientes.deletedAt),
        escopoRepresentantes(usuarioId, clientes.representanteId),
      ))
      .then((linhas) => linhas[0] ?? null);
  }

  private async exigirRepresentanteNoEscopo(
    tx: NodePgDatabase<typeof schema>,
    representanteId: string,
    usuarioId: string,
  ): Promise<void> {
    const permitido = await tx
      .select({ id: representantes.id })
      .from(representantes)
      .where(and(
        eq(representantes.id, representanteId),
        escopoRepresentantes(usuarioId, representantes.id),
      ))
      .limit(1)
      .then((linhas) => linhas[0] ?? null);
    if (!permitido) throw new NotFoundException('Cliente não encontrado');
  }

  private async assertUnico(
    tx: NodePgDatabase<typeof schema>,
    codigo: string,
    documentoFiscal: string,
    idAtual: string | null,
  ): Promise<void> {
    const conflitos = await tx
      .select({ id: clientes.id, codigo: clientes.codigo, documentoFiscal: clientes.documentoFiscal })
      .from(clientes)
      .where(
        and(
          isNull(clientes.deletedAt),
          or(eq(clientes.codigo, codigo), eq(clientes.documentoFiscal, documentoFiscal)),
        ),
      );

    for (const c of conflitos) {
      if (idAtual && c.id === idAtual) continue;
      if (c.codigo === codigo) throw new ConflictException('Já existe cliente com este código');
      if (c.documentoFiscal === documentoFiscal) {
        throw new ConflictException('Já existe cliente com este documento fiscal');
      }
    }
  }
}
