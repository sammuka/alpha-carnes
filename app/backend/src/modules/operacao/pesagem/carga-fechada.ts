import { and, eq, inArray, isNull, ne, notInArray, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { caminhoes, cargaItens, pecas } from '../../../database/schema';

type Tx = NodePgDatabase<typeof schema>;

/** chk_caminhoes_status (expedicao.schema.ts:32) — a partir de 'fechado' a carga não muda. */
export const STATUS_CAMINHAO_FECHADO = [
  'fechado',
  'liberado_faturamento',
  'faturado',
  'liberado_saida',
  'expedido',
] as const;

/** chk_pecas_status (pesagem.schema.ts:43) — peça consumida pela transformação. */
export const STATUS_PECA_EM_TRANSFORMACAO = ['em_transformacao', 'transformada'] as const;

export async function pecaEmCargaFechada(tx: Tx, pecaId: string): Promise<boolean> {
  const linha = await tx
    .select({ id: cargaItens.id })
    .from(cargaItens)
    .innerJoin(caminhoes, eq(caminhoes.id, cargaItens.caminhaoId))
    .where(
      and(
        eq(cargaItens.pecaId, pecaId),
        isNull(cargaItens.deletedAt),
        ne(cargaItens.statusCargaItem, 'removido'),
        inArray(caminhoes.statusCaminhao, [...STATUS_CAMINHAO_FECHADO]),
      ),
    )
    .limit(1)
    .then((r) => r[0] ?? null);
  return linha !== null;
}

/**
 * P10 (§16.13, mestre `:261`) — par exato de `pecaEmCargaFechada`, mesmas duas tabelas: a peça
 * já está num caminhão, mas a carga **ainda não fechou**. `null` quando a peça nunca foi
 * carregada (nenhuma linha ativa em `carga_itens`) — nesse caso não existe etiqueta física no
 * caminhão para substituir, então a Troca de Peça não registra pendência nenhuma.
 */
export async function buscarCargaAbertaDaPeca(
  tx: Tx,
  pecaId: string,
): Promise<{ caminhaoId: string; placa: string } | null> {
  return tx
    .select({ caminhaoId: caminhoes.id, placa: caminhoes.placa })
    .from(cargaItens)
    .innerJoin(caminhoes, eq(caminhoes.id, cargaItens.caminhaoId))
    .where(
      and(
        eq(cargaItens.pecaId, pecaId),
        isNull(cargaItens.deletedAt),
        ne(cargaItens.statusCargaItem, 'removido'),
        notInArray(caminhoes.statusCaminhao, [...STATUS_CAMINHAO_FECHADO]),
      ),
    )
    .limit(1)
    .then((r) => r[0] ?? null);
}

/** Predicado SQL correlacionado para uso em SELECT de listagem (D6.18). */
export const etiquetaBloqueadaSql = sql<boolean>`(
  ${pecas.statusPeca} IN ('em_transformacao','transformada')
  OR EXISTS (
    SELECT 1
      FROM ${cargaItens} ci
      JOIN ${caminhoes} c ON c.id = ci.caminhao_id
     WHERE ci.peca_id = ${pecas.id}
       AND ci.deleted_at IS NULL
       AND ci.status_carga_item <> 'removido'
       AND c.status_caminhao IN ('fechado','liberado_faturamento','faturado','liberado_saida','expedido')
  )
)`;
