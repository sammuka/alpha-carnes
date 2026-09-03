import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { itensCompra } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { calcularRange, montarPaginado, primeiroOuFalha, type ListarCadastroQuery, type Paginado } from '../../../common/crud/paginacao';
import type { CreateItemCompraDto, UpdateItemCompraDto } from './dto/item-compra.dto';

type ItemCompra = typeof itensCompra.$inferSelect;

@Injectable()
export class ItensCompraService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarCadastroQuery): Promise<Paginado<ItemCompra>> {
    const { limit, offset } = calcularRange(query);
    const filtros = [query.incluirRemovidos ? undefined : isNull(itensCompra.deletedAt)];
    if (query.status) filtros.push(eq(itensCompra.status, query.status));
    if (query.search) {
      const termo = `%${query.search}%`;
      filtros.push(or(ilike(itensCompra.descricao, termo), ilike(itensCompra.codigo, termo)));
    }
    const where = and(...filtros.filter(Boolean));

    const [linhas, totalRow] = await Promise.all([
      this.db.select().from(itensCompra).where(where).orderBy(desc(itensCompra.createdAt)).limit(limit).offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(itensCompra).where(where),
    ]);

    return montarPaginado(linhas, totalRow[0]?.total ?? 0, query);
  }

  async detalhar(id: string): Promise<ItemCompra> {
    const item = await this.buscarAtivo(id);
    if (!item) throw new NotFoundException('Item de compra não encontrado');
    return item;
  }

  async criar(dto: CreateItemCompraDto, usuarioId: string): Promise<ItemCompra> {
    return this.db.transaction(async (tx) => {
      await this.assertCodigoUnico(tx, dto.codigo, null);

      const criado = primeiroOuFalha(
        await tx
          .insert(itensCompra)
          .values({
            codigo: dto.codigo,
            descricao: dto.descricao,
            categoria: dto.categoria,
            unidadeCompra: dto.unidadeCompra,
            status: dto.status,
          })
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'itens_compra',
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

  async atualizar(id: string, dto: UpdateItemCompraDto, usuarioId: string): Promise<ItemCompra> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Item de compra não encontrado');

      await this.assertCodigoUnico(tx, dto.codigo ?? anterior.codigo, id);

      const atualizado = primeiroOuFalha(
        await tx
          .update(itensCompra)
          .set({
            codigo: dto.codigo ?? anterior.codigo,
            descricao: dto.descricao ?? anterior.descricao,
            categoria: dto.categoria ?? anterior.categoria,
            unidadeCompra: dto.unidadeCompra ?? anterior.unidadeCompra,
            status: dto.status ?? anterior.status,
          })
          .where(eq(itensCompra.id, id))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'itens_compra',
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
      if (!anterior) throw new NotFoundException('Item de compra não encontrado');

      const removido = primeiroOuFalha(
        await tx.update(itensCompra).set({ deletedAt: new Date() }).where(eq(itensCompra.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'itens_compra',
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

  async restaurar(id: string, usuarioId: string): Promise<ItemCompra> {
    return this.db.transaction(async (tx) => {
      const anterior = await tx
        .select()
        .from(itensCompra)
        .where(eq(itensCompra.id, id))
        .then((r) => r[0] ?? null);
      if (!anterior) throw new NotFoundException('Item de compra não encontrado');
      if (!anterior.deletedAt) throw new ConflictException('Item de compra não está removido');

      await this.assertCodigoUnico(tx, anterior.codigo, id);

      const restaurado = primeiroOuFalha(
        await tx.update(itensCompra).set({ deletedAt: null }).where(eq(itensCompra.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'itens_compra',
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

  private async buscarAtivo(id: string, tx?: NodePgDatabase<typeof schema>): Promise<ItemCompra | null> {
    const exec = tx ?? this.db;
    return exec
      .select()
      .from(itensCompra)
      .where(and(eq(itensCompra.id, id), isNull(itensCompra.deletedAt)))
      .then((r) => r[0] ?? null);
  }

  private async assertCodigoUnico(
    tx: NodePgDatabase<typeof schema>,
    codigo: string,
    idAtual: string | null,
  ): Promise<void> {
    const conflitos = await tx
      .select({ id: itensCompra.id })
      .from(itensCompra)
      .where(and(isNull(itensCompra.deletedAt), eq(itensCompra.codigo, codigo)));
    for (const c of conflitos) {
      if (idAtual && c.id === idAtual) continue;
      throw new ConflictException('Já existe item de compra com este código');
    }
  }
}
