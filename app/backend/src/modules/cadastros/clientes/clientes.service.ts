import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { clientes } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { calcularRange, montarPaginado, primeiroOuFalha, type ListarQuery, type Paginado } from '../../../common/crud/paginacao';
import type { CreateClienteDto, UpdateClienteDto } from './dto/cliente.dto';

type Cliente = typeof clientes.$inferSelect;

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

  async listar(query: ListarQuery): Promise<Paginado<Cliente>> {
    const { limit, offset } = calcularRange(query);
    const filtros = [query.incluirRemovidos ? undefined : isNull(clientes.deletedAt)];
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

    const [linhas, totalRow] = await Promise.all([
      this.db.select().from(clientes).where(where).orderBy(desc(clientes.createdAt)).limit(limit).offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(clientes).where(where),
    ]);

    return montarPaginado(linhas, totalRow[0]?.total ?? 0, query);
  }

  async detalhar(id: string): Promise<Cliente> {
    const cliente = await this.buscarAtivo(id);
    if (!cliente) throw new NotFoundException('Cliente não encontrado');
    return cliente;
  }

  async criar(dto: CreateClienteDto, usuarioId: string): Promise<Cliente> {
    return this.db.transaction(async (tx) => {
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
            rotaPadrao: dto.rotaPadrao,
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
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Cliente não encontrado');

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
            rotaPadrao: dto.rotaPadrao ?? anterior.rotaPadrao,
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
      const anterior = await this.buscarAtivo(id, tx);
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
      const anterior = await tx
        .select()
        .from(clientes)
        .where(eq(clientes.id, id))
        .then((r) => r[0] ?? null);
      if (!anterior) throw new NotFoundException('Cliente não encontrado');
      if (!anterior.deletedAt) throw new ConflictException('Cliente não está removido');

      // Ao restaurar, garante que código/documento não colidem com outro registro ativo.
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

  /** Busca um cliente ativo (deleted_at IS NULL). */
  private async buscarAtivo(id: string, tx?: NodePgDatabase<typeof schema>): Promise<Cliente | null> {
    const exec = tx ?? this.db;
    return exec
      .select()
      .from(clientes)
      .where(and(eq(clientes.id, id), isNull(clientes.deletedAt)))
      .then((r) => r[0] ?? null);
  }

  /** Garante unicidade de codigo e documentoFiscal entre registros ativos (exceto o próprio id). */
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
