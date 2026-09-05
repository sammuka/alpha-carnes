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

    const produtoIds = produtosSaida.map((p) => p.id);

    const demandaPorProduto = new Map<string, number>();
    if (produtoIds.length > 0) {
      const linhasDemanda = await this.db
        .select({
          produtoId: pedidosVendaItens.produtoId,
          total: sql<string>`coalesce(sum(${pedidosVendaItens.quantidadePedida} - ${pedidosVendaItens.quantidadeAtendida}), 0)::text`,
        })
        .from(pedidosVendaItens)
        .innerJoin(pedidosVenda, eq(pedidosVendaItens.pedidoVendaId, pedidosVenda.id))
        .where(
          and(
            isNull(pedidosVenda.deletedAt),
            inArray(pedidosVenda.status, [
              'em_elaboracao_reserva_ativa',
              'aguardando_confirmacao_overbooking',
              'finalizado',
              'parcialmente_atendido',
            ]),
            inArray(pedidosVendaItens.produtoId, produtoIds),
            sql`${pedidosVendaItens.status} <> 'cancelado'`,
            sql`${pedidosVendaItens.quantidadePedida} - ${pedidosVendaItens.quantidadeAtendida} > 0`,
          ),
        )
        .groupBy(pedidosVendaItens.produtoId);

      for (const linha of linhasDemanda) {
        demandaPorProduto.set(linha.produtoId, parseQuantidade(linha.total));
      }
    }

    const estoquePorProduto = new Map<string, number>();
    if (produtoIds.length > 0) {
      const [pecasSobra, subitensSobra] = await Promise.all([
        this.db
          .select({
            produtoId: pecas.produtoBaseId,
            total: sql<string>`count(*)::text`,
          })
          .from(pecas)
          .where(
            and(
              isNull(pecas.deletedAt),
              eq(pecas.statusPeca, 'em_sobra'),
              inArray(pecas.produtoBaseId, produtoIds),
            ),
          )
          .groupBy(pecas.produtoBaseId),
        this.db
          .select({
            produtoId: subitens.produtoId,
            total: sql<string>`coalesce(sum(${subitens.quantidade}), 0)::text`,
          })
          .from(subitens)
          .where(
            and(
              isNull(subitens.deletedAt),
              eq(subitens.statusSubitem, 'em_sobra'),
              inArray(subitens.produtoId, produtoIds),
            ),
          )
          .groupBy(subitens.produtoId),
      ]);

      for (const linha of pecasSobra) {
        const atual = estoquePorProduto.get(linha.produtoId) ?? 0;
        estoquePorProduto.set(linha.produtoId, atual + parseQuantidade(linha.total));
      }
      for (const linha of subitensSobra) {
        const atual = estoquePorProduto.get(linha.produtoId) ?? 0;
        estoquePorProduto.set(linha.produtoId, atual + parseQuantidade(linha.total));
      }
    }

    const origemPorProdutoId = new Map<string, string>();
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
      demandaPorProduto,
      estoquePorProduto,
      origemPorProdutoId,
    );
  }
}
