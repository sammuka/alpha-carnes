import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  caminhoes,
  comprasProgramadas,
  disponibilidadesVirtuais,
  divergenciasRecebimento,
  pedidosVenda,
  recebimentos,
} from '../../../database/schema';

export interface DashboardDia {
  dataOperacao: string;
  comprasProgramadas: {
    total: number;
    porStatus: Record<string, number>;
    compraAtiva: { id: string; status: string } | null;
  };
  pedidos: {
    total: number;
    porStatus: Record<string, number>;
  };
  divergenciasAbertas: number;
  caminhoesDoDia: number;
  disponibilidade: {
    itens: number;
    itensEsgotados: number;
    quantidadeDisponivelTotal: string;
  };
}

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async resumoDia(dataOperacao: string): Promise<DashboardDia> {
    const [
      comprasRows,
      pedidosRows,
      divergenciasRow,
      caminhoesRow,
      dispRows,
    ] = await Promise.all([
      this.db
        .select({ status: comprasProgramadas.status, id: comprasProgramadas.id })
        .from(comprasProgramadas)
        .where(and(eq(comprasProgramadas.dataOperacao, dataOperacao), isNull(comprasProgramadas.deletedAt))),
      this.db
        .select({ status: pedidosVenda.status, total: sql<number>`count(*)::int` })
        .from(pedidosVenda)
        .where(and(eq(pedidosVenda.dataOperacao, dataOperacao), isNull(pedidosVenda.deletedAt)))
        .groupBy(pedidosVenda.status),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(divergenciasRecebimento)
        .innerJoin(recebimentos, eq(divergenciasRecebimento.recebimentoId, recebimentos.id))
        .where(
          and(
            eq(recebimentos.dataOperacao, dataOperacao),
            isNull(recebimentos.deletedAt),
            ne(divergenciasRecebimento.status, 'resolvida'),
          ),
        ),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(caminhoes)
        .where(and(eq(caminhoes.dataOperacao, dataOperacao), isNull(caminhoes.deletedAt))),
      this.db
        .select({
          id: disponibilidadesVirtuais.id,
          quantidadeDisponivel: disponibilidadesVirtuais.quantidadeDisponivel,
        })
        .from(disponibilidadesVirtuais)
        .where(eq(disponibilidadesVirtuais.dataOperacao, dataOperacao)),
    ]);

    const comprasPorStatus: Record<string, number> = {};
    for (const row of comprasRows) {
      comprasPorStatus[row.status] = (comprasPorStatus[row.status] ?? 0) + 1;
    }

    const compraAtiva =
      comprasRows.find((c) => c.status !== 'cancelada') ?? null;

    const pedidosPorStatus: Record<string, number> = {};
    let pedidosTotal = 0;
    for (const row of pedidosRows) {
      pedidosPorStatus[row.status] = row.total;
      pedidosTotal += row.total;
    }

    let quantidadeDisponivelTotal = 0;
    let itensEsgotados = 0;
    for (const row of dispRows) {
      const disp = Number(row.quantidadeDisponivel);
      quantidadeDisponivelTotal += disp;
      if (disp <= 0) itensEsgotados += 1;
    }

    return {
      dataOperacao,
      comprasProgramadas: {
        total: comprasRows.length,
        porStatus: comprasPorStatus,
        compraAtiva: compraAtiva ? { id: compraAtiva.id, status: compraAtiva.status } : null,
      },
      pedidos: {
        total: pedidosTotal,
        porStatus: pedidosPorStatus,
      },
      divergenciasAbertas: divergenciasRow[0]?.total ?? 0,
      caminhoesDoDia: caminhoesRow[0]?.total ?? 0,
      disponibilidade: {
        itens: dispRows.length,
        itensEsgotados,
        quantidadeDisponivelTotal: quantidadeDisponivelTotal.toFixed(3),
      },
    };
  }
}
