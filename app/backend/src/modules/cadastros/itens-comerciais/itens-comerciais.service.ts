import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { itensComerciais } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { calcularRange, montarPaginado, primeiroOuFalha, type ListarQuery, type Paginado } from '../../../common/crud/paginacao';
import type { CreateItemComercialDto, UpdateItemComercialDto } from './dto/item-comercial.dto';

type ItemComercial = typeof itensComerciais.$inferSelect;

@Injectable()
export class ItensComerciaisService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarQuery): Promise<Paginado<ItemComercial>> {
    const { limit, offset } = calcularRange(query);
    const filtros = [query.incluirRemovidos ? undefined : isNull(itensComerciais.deletedAt)];
    if (query.search) {
      const termo = `%${query.search}%`;
      filtros.push(or(ilike(itensComerciais.descricao, termo), ilike(itensComerciais.codigo, termo)));
    }
    const where = and(...filtros.filter(Boolean));

    const [linhas, totalRow] = await Promise.all([
      this.db.select().from(itensComerciais).where(where).orderBy(desc(itensComerciais.createdAt)).limit(limit).offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(itensComerciais).where(where),
    ]);

    return montarPaginado(linhas, totalRow[0]?.total ?? 0, query);
  }

  async detalhar(id: string): Promise<ItemComercial> {
    const item = await this.buscarAtivo(id);
    if (!item) throw new NotFoundException('Item comercial não encontrado');
    return item;
  }

  async criar(dto: CreateItemComercialDto, usuarioId: string): Promise<ItemComercial> {
    return this.db.transaction(async (tx) => {
      await this.assertCodigoUnico(tx, dto.codigo, null);

      const criado = primeiroOuFalha(
        await tx
          .insert(itensComerciais)
          .values({
            codigo: dto.codigo,
            descricao: dto.descricao,
            categoria: dto.categoria,
            unidadeComercial: dto.unidadeComercial,
            permiteCorte: dto.permiteCorte,
            status: dto.status,
            observacoesOperacionais: dto.observacoesOperacionais,
          })
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'itens_comerciais',
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

  async atualizar(id: string, dto: UpdateItemComercialDto, usuarioId: string): Promise<ItemComercial> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Item comercial não encontrado');

      await this.assertCodigoUnico(tx, dto.codigo ?? anterior.codigo, id);

      const atualizado = primeiroOuFalha(
        await tx
          .update(itensComerciais)
          .set({
            codigo: dto.codigo ?? anterior.codigo,
            descricao: dto.descricao ?? anterior.descricao,
            categoria: dto.categoria ?? anterior.categoria,
            unidadeComercial: dto.unidadeComercial ?? anterior.unidadeComercial,
            permiteCorte: dto.permiteCorte ?? anterior.permiteCorte,
            status: dto.status ?? anterior.status,
            observacoesOperacionais: dto.observacoesOperacionais ?? anterior.observacoesOperacionais,
          })
          .where(eq(itensComerciais.id, id))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'itens_comerciais',
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
      if (!anterior) throw new NotFoundException('Item comercial não encontrado');

      const removido = primeiroOuFalha(
        await tx.update(itensComerciais).set({ deletedAt: new Date() }).where(eq(itensComerciais.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'itens_comerciais',
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

  async restaurar(id: string, usuarioId: string): Promise<ItemComercial> {
    return this.db.transaction(async (tx) => {
      const anterior = await tx
        .select()
        .from(itensComerciais)
        .where(eq(itensComerciais.id, id))
        .then((r) => r[0] ?? null);
      if (!anterior) throw new NotFoundException('Item comercial não encontrado');
      if (!anterior.deletedAt) throw new ConflictException('Item comercial não está removido');

      await this.assertCodigoUnico(tx, anterior.codigo, id);

      const restaurado = primeiroOuFalha(
        await tx.update(itensComerciais).set({ deletedAt: null }).where(eq(itensComerciais.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'itens_comerciais',
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

  private async buscarAtivo(id: string, tx?: NodePgDatabase<typeof schema>): Promise<ItemComercial | null> {
    const exec = tx ?? this.db;
    return exec
      .select()
      .from(itensComerciais)
      .where(and(eq(itensComerciais.id, id), isNull(itensComerciais.deletedAt)))
      .then((r) => r[0] ?? null);
  }

  private async assertCodigoUnico(
    tx: NodePgDatabase<typeof schema>,
    codigo: string,
    idAtual: string | null,
  ): Promise<void> {
    const conflitos = await tx
      .select({ id: itensComerciais.id })
      .from(itensComerciais)
      .where(and(isNull(itensComerciais.deletedAt), eq(itensComerciais.codigo, codigo)));
    for (const c of conflitos) {
      if (idAtual && c.id === idAtual) continue;
      throw new ConflictException('Já existe item comercial com este código');
    }
  }
}
