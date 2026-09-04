import { and, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import {
  clientes,
  disponibilidadesVirtuais,
  pedidosVenda,
  pedidosVendaItens,
  reservasDisponibilidade,
} from '../../../database/schema';
import { subtrairQtd } from '../../../common/crud/decimal';
import { calcularScores, type CandidatoPedido, type SugestaoScored } from './associacao-score';

type Tx = NodePgDatabase<typeof schema>;

/** Extrai slugs de `pecas.captura_meta` (D6.4) — mesmos nomes usados em preferências do cliente. */
export function caracteristicasDeCapturaMeta(meta: unknown): string[] {
  const m = (meta ?? {}) as Record<string, unknown>;
  const out: string[] = [];
  if (m.maisPesada === true) out.push('maisPesada');
  if (m.maisGorda === true) out.push('maisGorda');
  if (m.melhorAcabamento === true) out.push('melhorAcabamento');
  return out;
}

/** Itens de pedidos da MESMA operação (AD-14), abertos, do mesmo item comercial, com saldo. */
export async function calcularCompativeisItem(
  tx: Tx,
  params: {
    operacaoId: string;
    compraProgramadaOrigemId: string;
    produtoId: string;
    peso: string;
    caracteristicas?: string[];
  },
): Promise<SugestaoScored[]> {
  const linhas = await tx
    .select({
      pedidoVendaId: pedidosVenda.id,
      pedidoVendaItemId: pedidosVendaItens.id,
      produtoId: pedidosVendaItens.produtoId,
      clienteId: pedidosVenda.clienteId,
      quantidadePedida: pedidosVendaItens.quantidadePedida,
      quantidadeAtendida: pedidosVendaItens.quantidadeAtendida,
      prioridade: pedidosVenda.prioridade,
      rotaPrevista: pedidosVenda.rotaPrevista,
      preferenciasCliente: clientes.preferenciasJson,
      cobertaPeloLote: sql<boolean>`exists (
        select 1
          from ${reservasDisponibilidade} r
          join ${disponibilidadesVirtuais} dv on dv.id = r.disponibilidade_virtual_id
         where r.pedido_venda_item_id = ${pedidosVendaItens.id}
           and r.status = 'ativa'
           and dv.compra_programada_id = ${params.compraProgramadaOrigemId}
      )`,
    })
    .from(pedidosVendaItens)
    .innerJoin(pedidosVenda, eq(pedidosVendaItens.pedidoVendaId, pedidosVenda.id))
    .innerJoin(clientes, eq(pedidosVenda.clienteId, clientes.id))
    .where(
      and(
        eq(pedidosVenda.operacaoId, params.operacaoId),
        eq(pedidosVendaItens.produtoId, params.produtoId),
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
      produtoId: l.produtoId,
      clienteId: l.clienteId,
      saldoPendente: subtrairQtd(l.quantidadePedida, l.quantidadeAtendida),
      prioridade: l.prioridade,
      rotaPrevista: l.rotaPrevista,
      cobertaPeloLote: Boolean(l.cobertaPeloLote),
      preferencias: {
        faixaPesoMin: typeof pref.faixaPesoMin === 'number' ? pref.faixaPesoMin : undefined,
        faixaPesoMax: typeof pref.faixaPesoMax === 'number' ? pref.faixaPesoMax : undefined,
        perfilGordura: typeof pref.perfilGordura === 'string' ? pref.perfilGordura : undefined,
        caracteristicasPreferidas: Array.isArray(pref.caracteristicasPreferidas)
          ? (pref.caracteristicasPreferidas as string[])
          : undefined,
      },
    };
  });

  return calcularScores(
    {
      produtoBaseId: params.produtoId,
      pesoOriginal: params.peso,
      caracteristicas: params.caracteristicas,
    },
    candidatos,
  );
}
