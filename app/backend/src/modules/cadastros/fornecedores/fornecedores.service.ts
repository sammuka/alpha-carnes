import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { fornecedores } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { calcularRange, montarPaginado, primeiroOuFalha, type ListarQuery, type Paginado } from '../../../common/crud/paginacao';
import type { CreateFornecedorDto, UpdateFornecedorDto } from './dto/fornecedor.dto';

type Fornecedor = typeof fornecedores.$inferSelect;

@Injectable()
export class FornecedoresService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarQuery): Promise<Paginado<Fornecedor>> {
    const { limit, offset } = calcularRange(query);
    const filtros = [query.incluirRemovidos ? undefined : isNull(fornecedores.deletedAt)];
    if (query.search) {
      const termo = `%${query.search}%`;
      filtros.push(
        or(
          ilike(fornecedores.razaoSocial, termo),
          ilike(fornecedores.codigo, termo),
          ilike(fornecedores.documentoFiscal, termo),
        ),
      );
    }
    const where = and(...filtros.filter(Boolean));

    const [linhas, totalRow] = await Promise.all([
      this.db.select().from(fornecedores).where(where).orderBy(desc(fornecedores.createdAt)).limit(limit).offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(fornecedores).where(where),
    ]);

    return montarPaginado(linhas, totalRow[0]?.total ?? 0, query);
  }

  async detalhar(id: string): Promise<Fornecedor> {
    const fornecedor = await this.buscarAtivo(id);
    if (!fornecedor) throw new NotFoundException('Fornecedor não encontrado');
    return fornecedor;
  }

  async criar(dto: CreateFornecedorDto, usuarioId: string): Promise<Fornecedor> {
    return this.db.transaction(async (tx) => {
      await this.assertUnico(tx, dto.codigo, dto.documentoFiscal, null);

      const criado = primeiroOuFalha(
        await tx
          .insert(fornecedores)
          .values({
            codigo: dto.codigo,
            razaoSocial: dto.razaoSocial,
            documentoFiscal: dto.documentoFiscal,
            status: dto.status,
            contatosJson: dto.contatosJson ?? {},
            parametrosOperacionaisJson: dto.parametrosOperacionaisJson ?? {},
            observacoes: dto.observacoes,
          })
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'fornecedores',
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

  async atualizar(id: string, dto: UpdateFornecedorDto, usuarioId: string): Promise<Fornecedor> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Fornecedor não encontrado');

      await this.assertUnico(tx, dto.codigo ?? anterior.codigo, dto.documentoFiscal ?? anterior.documentoFiscal, id);

      const atualizado = primeiroOuFalha(
        await tx
          .update(fornecedores)
          .set({
            codigo: dto.codigo ?? anterior.codigo,
            razaoSocial: dto.razaoSocial ?? anterior.razaoSocial,
            documentoFiscal: dto.documentoFiscal ?? anterior.documentoFiscal,
            status: dto.status ?? anterior.status,
            contatosJson: dto.contatosJson ?? anterior.contatosJson,
            parametrosOperacionaisJson: dto.parametrosOperacionaisJson ?? anterior.parametrosOperacionaisJson,
            observacoes: dto.observacoes ?? anterior.observacoes,
          })
          .where(eq(fornecedores.id, id))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'fornecedores',
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
      if (!anterior) throw new NotFoundException('Fornecedor não encontrado');

      const removido = primeiroOuFalha(
        await tx.update(fornecedores).set({ deletedAt: new Date() }).where(eq(fornecedores.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'fornecedores',
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

  async restaurar(id: string, usuarioId: string): Promise<Fornecedor> {
    return this.db.transaction(async (tx) => {
      const anterior = await tx
        .select()
        .from(fornecedores)
        .where(eq(fornecedores.id, id))
        .then((r) => r[0] ?? null);
      if (!anterior) throw new NotFoundException('Fornecedor não encontrado');
      if (!anterior.deletedAt) throw new ConflictException('Fornecedor não está removido');

      await this.assertUnico(tx, anterior.codigo, anterior.documentoFiscal, id);

      const restaurado = primeiroOuFalha(
        await tx.update(fornecedores).set({ deletedAt: null }).where(eq(fornecedores.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'fornecedores',
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

  private async buscarAtivo(id: string, tx?: NodePgDatabase<typeof schema>): Promise<Fornecedor | null> {
    const exec = tx ?? this.db;
    return exec
      .select()
      .from(fornecedores)
      .where(and(eq(fornecedores.id, id), isNull(fornecedores.deletedAt)))
      .then((r) => r[0] ?? null);
  }

  private async assertUnico(
    tx: NodePgDatabase<typeof schema>,
    codigo: string,
    documentoFiscal: string,
    idAtual: string | null,
  ): Promise<void> {
    const conflitos = await tx
      .select({ id: fornecedores.id, codigo: fornecedores.codigo, documentoFiscal: fornecedores.documentoFiscal })
      .from(fornecedores)
      .where(
        and(
          isNull(fornecedores.deletedAt),
          or(eq(fornecedores.codigo, codigo), eq(fornecedores.documentoFiscal, documentoFiscal)),
        ),
      );

    for (const f of conflitos) {
      if (idAtual && f.id === idAtual) continue;
      if (f.codigo === codigo) throw new ConflictException('Já existe fornecedor com este código');
      if (f.documentoFiscal === documentoFiscal) {
        throw new ConflictException('Já existe fornecedor com este documento fiscal');
      }
    }
  }
}
