import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import {
  comprasProgramadasItens,
  disponibilidadesVirtuais,
  itensComerciais,
  itensCompra,
  produtos,
  regrasDesdobramentoComercial,
} from '../../../database/schema';

type Tx = NodePgDatabase<typeof schema>;

export interface MetadadoItemPrevisto {
  itemComercialId: string;
  origemDescricao: string;
  unidadeEsperada: string;
  requerBalanca: boolean;
}

export async function resolverMetadadosItensPrevistos(
  tx: Tx,
  compraProgramadaId: string,
  numeroInterno: string | null,
  itemComercialIds: string[],
): Promise<Map<string, MetadadoItemPrevisto>> {
  const mapa = new Map<string, MetadadoItemPrevisto>();
  if (itemComercialIds.length === 0) return mapa;

  const pc = numeroInterno ?? 'Compra';

  const comerciais = await tx
    .select({
      id: itensComerciais.id,
      codigo: itensComerciais.codigo,
      unidadeComercial: itensComerciais.unidadeComercial,
    })
    .from(itensComerciais)
    .where(inArray(itensComerciais.id, itemComercialIds));

  const passaBalancaRows = await tx
    .select({
      itemComercialId: produtos.legadoItemComercialId,
      passaBalanca: produtos.passaBalanca,
    })
    .from(produtos)
    .where(and(inArray(produtos.legadoItemComercialId, itemComercialIds), isNull(produtos.deletedAt)));

  const passaMap = new Map(passaBalancaRows.map((r) => [r.itemComercialId!, r.passaBalanca]));

  const regras = await tx
    .select({
      itemComercialId: regrasDesdobramentoComercial.itemComercialId,
      itemComercialCodigo: itensComerciais.codigo,
      itemCompraDescricao: itensCompra.descricao,
    })
    .from(disponibilidadesVirtuais)
    .innerJoin(
      regrasDesdobramentoComercial,
      and(
        eq(regrasDesdobramentoComercial.itemComercialId, disponibilidadesVirtuais.itemComercialId),
        eq(regrasDesdobramentoComercial.status, 'ativo'),
        isNull(regrasDesdobramentoComercial.deletedAt),
      ),
    )
    .innerJoin(itensComerciais, eq(itensComerciais.id, disponibilidadesVirtuais.itemComercialId))
    .innerJoin(
      comprasProgramadasItens,
      and(
        eq(comprasProgramadasItens.compraProgramadaId, compraProgramadaId),
        eq(comprasProgramadasItens.itemCompraId, regrasDesdobramentoComercial.itemCompraId),
        isNull(comprasProgramadasItens.deletedAt),
      ),
    )
    .innerJoin(itensCompra, eq(itensCompra.id, comprasProgramadasItens.itemCompraId))
    .where(eq(disponibilidadesVirtuais.compraProgramadaId, compraProgramadaId));

  const origemPorItem = new Map<string, string>();
  const regrasPorCompra = new Map<string, Set<string>>();
  for (const r of regras) {
    const chave = r.itemCompraDescricao;
    const set = regrasPorCompra.get(chave) ?? new Set<string>();
    set.add(r.itemComercialCodigo);
    regrasPorCompra.set(chave, set);
  }
  for (const r of regras) {
    const codigos = [...(regrasPorCompra.get(r.itemCompraDescricao) ?? [])].sort().join('/');
    origemPorItem.set(
      r.itemComercialId,
      `${pc} / Regra ${r.itemCompraDescricao} → ${codigos}`,
    );
  }

  for (const ic of comerciais) {
    mapa.set(ic.id, {
      itemComercialId: ic.id,
      origemDescricao: origemPorItem.get(ic.id) ?? pc,
      unidadeEsperada: ic.unidadeComercial,
      requerBalanca: passaMap.get(ic.id) ?? true,
    });
  }

  return mapa;
}

export async function derivarTipoCarga(tx: Tx, compraProgramadaId: string): Promise<string | null> {
  const linha = await tx
    .select({ categoria: itensCompra.categoria })
    .from(comprasProgramadasItens)
    .innerJoin(itensCompra, eq(itensCompra.id, comprasProgramadasItens.itemCompraId))
    .where(and(eq(comprasProgramadasItens.compraProgramadaId, compraProgramadaId), isNull(comprasProgramadasItens.deletedAt)))
    .limit(1)
    .then((r) => r[0] ?? null);
  return linha?.categoria ?? null;
}

export async function contarPecasPorItem(
  tx: Tx,
  recebimentoId: string,
): Promise<Map<string, { quantidade: number; pesoTotal: string }>> {
  const linhas = await tx.execute<{
    item_comercial_base_id: string;
    quantidade: string;
    peso_total: string;
  }>(sql`
    SELECT
      item_comercial_base_id,
      count(*)::text AS quantidade,
      COALESCE(SUM(peso_original), 0)::text AS peso_total
    FROM pecas
    WHERE recebimento_id = ${recebimentoId}
      AND deleted_at IS NULL
    GROUP BY item_comercial_base_id
  `);
  const mapa = new Map<string, { quantidade: number; pesoTotal: string }>();
  for (const row of linhas.rows) {
    mapa.set(row.item_comercial_base_id, {
      quantidade: Number(row.quantidade),
      pesoTotal: row.peso_total,
    });
  }
  return mapa;
}

export function calcularProgressoBalanca(
  itens: Array<{ quantidadeEsperada: string; requerBalanca: boolean; quantidadeApurada: number }>,
): number {
  const escala = itens.filter((i) => i.requerBalanca);
  if (escala.length === 0) return 100;
  let esperado = 0;
  let apurado = 0;
  for (const item of escala) {
    esperado += Number(item.quantidadeEsperada);
    apurado += Math.min(item.quantidadeApurada, Number(item.quantidadeEsperada));
  }
  if (esperado <= 0) return 0;
  return Math.round((apurado / esperado) * 100);
}
