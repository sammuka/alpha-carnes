import { and, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { clientes, pedidosVenda, pedidosVendaItens } from '../../../database/schema';
import { subtrairQtd } from '../../../common/crud/decimal';
import { calcularScores, type CandidatoPedido, type SugestaoScored } from './associacao-score';

type Tx = NodePgDatabase<typeof schema>;

/** Itens de pedidos da MESMA compra (RN-02), abertos, do mesmo item comercial, com saldo. */
export async function calcularCompativeisItem(
  tx: Tx,
  params: { compraProgramadaId: string; itemComercialId: string; peso: string },
): Promise<SugestaoScored[]> {
  const linhas = await tx
    .select({
      pedidoVendaId: pedidosVenda.id,
      pedidoVendaItemId: pedidosVendaItens.id,
      itemComercialId: pedidosVendaItens.itemComercialId,
      clienteId: pedidosVenda.clienteId,
      quantidadePedida: pedidosVendaItens.quantidadePedida,
      quantidadeAtendida: pedidosVendaItens.quantidadeAtendida,
      prioridade: pedidosVenda.prioridade,
      rotaPrevista: pedidosVenda.rotaPrevista,
      preferenciasCliente: clientes.preferenciasJson,
    })
    .from(pedidosVendaItens)
    .innerJoin(pedidosVenda, eq(pedidosVendaItens.pedidoVendaId, pedidosVenda.id))
    .innerJoin(clientes, eq(pedidosVenda.clienteId, clientes.id))
    .where(
      and(
        eq(pedidosVenda.compraProgramadaId, params.compraProgramadaId),
        eq(pedidosVendaItens.itemComercialId, params.itemComercialId),
        isNull(pedidosVenda.deletedAt),
        sql`${pedidosVenda.status} <> 'cancelado'`,
        sql`${pedidosVendaItens.status} <> 'cancelado'`,
      ),
    );

  const candidatos: CandidatoPedido[] = linhas.map((l) => {
    const pref = (l.preferenciasCliente ?? {}) as Record<string, unknown>;
    return {
      pedidoVendaId: l.pedidoVendaId,
      pedidoVendaItemId: l.pedidoVendaItemId,
      itemComercialId: l.itemComercialId,
      clienteId: l.clienteId,
      saldoPendente: subtrairQtd(l.quantidadePedida, l.quantidadeAtendida),
      prioridade: l.prioridade,
      rotaPrevista: l.rotaPrevista,
      preferencias: {
        faixaPesoMin: typeof pref.faixaPesoMin === 'number' ? pref.faixaPesoMin : undefined,
        faixaPesoMax: typeof pref.faixaPesoMax === 'number' ? pref.faixaPesoMax : undefined,
        perfilGordura: typeof pref.perfilGordura === 'string' ? pref.perfilGordura : undefined,
      },
    };
  });

  return calcularScores({ itemComercialBaseId: params.itemComercialId, pesoOriginal: params.peso }, candidatos);
}
