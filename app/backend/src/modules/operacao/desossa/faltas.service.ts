import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  pedidosVenda,
  pedidosVendaItens,
  pecas,
  produtos,
  regrasTransformacao,
  regrasTransformacaoSaidas,
  subitens,
} from '../../../database/schema';
import { calcularFaltasDesossa, parseQuantidade, type FaltaDesossaItem } from './faltas.calc';

@Injectable()
export class FaltasService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listarFaltas(): Promise<FaltaDesossaItem[]> {
    const produtosSaida = await this.db
      .select({
        id: produtos.id,
        codigo: produtos.codigo,
        nome: produtos.nome,
        legadoItemComercialId: produtos.legadoItemComercialId,
      })
      .from(produtos)
      .where(
        and(
          isNull(produtos.deletedAt),
          eq(produtos.status, 'ativo'),
          eq(produtos.saidaTransformacao, true),
        ),
      );

    if (produtosSaida.length === 0) return [];

    const itemComercialIds = produtosSaida
      .map((p) => p.legadoItemComercialId)
      .filter((id): id is string => id !== null);

    const demandaPorItemComercial = new Map<string, number>();
    if (itemComercialIds.length > 0) {
      const linhasDemanda = await this.db
        .select({
          itemComercialId: pedidosVendaItens.itemComercialId,
          total: sql<string>`coalesce(sum(${pedidosVendaItens.quantidadePendente}), 0)::text`,
        })
        .from(pedidosVendaItens)
        .innerJoin(pedidosVenda, eq(pedidosVendaItens.pedidoVendaId, pedidosVenda.id))
        .where(
          and(
            isNull(pedidosVenda.deletedAt),
            inArray(pedidosVenda.status, ['reservado', 'parcialmente_reservado']),
            inArray(pedidosVendaItens.itemComercialId, itemComercialIds),
            inArray(pedidosVendaItens.status, [
              'totalmente_reservado',
              'parcialmente_reservado',
              'sem_cobertura',
            ]),
          ),
        )
        .groupBy(pedidosVendaItens.itemComercialId);

      for (const linha of linhasDemanda) {
        demandaPorItemComercial.set(linha.itemComercialId, parseQuantidade(linha.total));
      }
    }

    const estoquePorItemComercial = new Map<string, number>();
    if (itemComercialIds.length > 0) {
      const [pecasSobra, subitensSobra] = await Promise.all([
        this.db
          .select({
            itemComercialId: pecas.itemComercialBaseId,
            total: sql<string>`count(*)::text`,
          })
          .from(pecas)
          .where(
            and(
              isNull(pecas.deletedAt),
              eq(pecas.statusPeca, 'em_sobra'),
              inArray(pecas.itemComercialBaseId, itemComercialIds),
            ),
          )
          .groupBy(pecas.itemComercialBaseId),
        this.db
          .select({
            itemComercialId: subitens.itemComercialId,
            total: sql<string>`coalesce(sum(${subitens.quantidade}), 0)::text`,
          })
          .from(subitens)
          .where(
            and(
              isNull(subitens.deletedAt),
              eq(subitens.statusSubitem, 'em_sobra'),
              inArray(subitens.itemComercialId, itemComercialIds),
            ),
          )
          .groupBy(subitens.itemComercialId),
      ]);

      for (const linha of pecasSobra) {
        const atual = estoquePorItemComercial.get(linha.itemComercialId) ?? 0;
        estoquePorItemComercial.set(linha.itemComercialId, atual + parseQuantidade(linha.total));
      }
      for (const linha of subitensSobra) {
        const atual = estoquePorItemComercial.get(linha.itemComercialId) ?? 0;
        estoquePorItemComercial.set(linha.itemComercialId, atual + parseQuantidade(linha.total));
      }
    }

    const origemPorProdutoId = new Map<string, string>();
    const produtoIds = produtosSaida.map((p) => p.id);
    if (produtoIds.length > 0) {
      const origens = await this.db
        .select({
          produtoId: regrasTransformacaoSaidas.produtoId,
          origem: regrasTransformacao.produtoOrigemCodigo,
          prioridade: regrasTransformacao.prioridade,
        })
        .from(regrasTransformacaoSaidas)
        .innerJoin(regrasTransformacao, eq(regrasTransformacaoSaidas.regraId, regrasTransformacao.id))
        .where(
          and(
            inArray(regrasTransformacaoSaidas.produtoId, produtoIds),
            isNull(regrasTransformacao.deletedAt),
            eq(regrasTransformacao.status, 'ativo'),
          ),
        )
        .orderBy(regrasTransformacao.prioridade);

      for (const linha of origens) {
        if (!origemPorProdutoId.has(linha.produtoId)) {
          origemPorProdutoId.set(linha.produtoId, linha.origem);
        }
      }
    }

    return calcularFaltasDesossa(
      produtosSaida,
      demandaPorItemComercial,
      estoquePorItemComercial,
      origemPorProdutoId,
    );
  }
}
