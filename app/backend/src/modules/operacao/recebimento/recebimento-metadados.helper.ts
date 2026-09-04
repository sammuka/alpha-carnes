import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import {
  comprasProgramadasItens,
  disponibilidadesVirtuais,
  produtos,
  regrasDesdobramentoComercial,
} from '../../../database/schema';

type Tx = NodePgDatabase<typeof schema>;

export interface MetadadoItemPrevisto {
  produtoId: string;
  origemDescricao: string;
  unidadeEsperada: string;
  requerBalanca: boolean;
}

export async function resolverMetadadosItensPrevistos(
  tx: Tx,
  compraProgramadaId: string,
  numeroInterno: string | null,
  produtoIds: string[],
): Promise<Map<string, MetadadoItemPrevisto>> {
  const mapa = new Map<string, MetadadoItemPrevisto>();
  if (produtoIds.length === 0) return mapa;

  const pc = numeroInterno ?? 'Compra';

  const encontrados = await tx
    .select({
      id: produtos.id,
      codigo: produtos.codigo,
      nome: produtos.nome,
      unidadePedido: produtos.unidadePedido,
      passaBalanca: produtos.passaBalanca,
    })
    .from(produtos)
    .where(inArray(produtos.id, produtoIds));

  const faltando = produtoIds.filter((id) => !encontrados.some((p) => p.id === id));
  if (faltando.length > 0) {
    throw new Error(
      `Onda 13: produto(s) inexistente(s) ao resolver metadados de recebimento: ${faltando.join(',')}`,
    );
  }

  const origem = alias(produtos, 'produto_origem');
  const destino = alias(produtos, 'produto_destino');
  const regras = await tx
    .select({
      produtoDestinoId: regrasDesdobramentoComercial.produtoDestinoId,
      produtoDestinoCodigo: destino.codigo,
      produtoOrigemNome: origem.nome,
    })
    .from(disponibilidadesVirtuais)
    .innerJoin(
      regrasDesdobramentoComercial,
      and(
        eq(regrasDesdobramentoComercial.produtoDestinoId, disponibilidadesVirtuais.produtoId),
        eq(regrasDesdobramentoComercial.status, 'ativo'),
        isNull(regrasDesdobramentoComercial.deletedAt),
      ),
    )
    .innerJoin(destino, eq(destino.id, regrasDesdobramentoComercial.produtoDestinoId))
    .innerJoin(
      comprasProgramadasItens,
      and(
        eq(comprasProgramadasItens.compraProgramadaId, compraProgramadaId),
        eq(comprasProgramadasItens.produtoId, regrasDesdobramentoComercial.produtoOrigemId),
        isNull(comprasProgramadasItens.deletedAt),
      ),
    )
    .innerJoin(origem, eq(origem.id, regrasDesdobramentoComercial.produtoOrigemId))
    .where(eq(disponibilidadesVirtuais.compraProgramadaId, compraProgramadaId));

  const origemPorItem = new Map<string, string>();
  const regrasPorCompra = new Map<string, Set<string>>();
  for (const r of regras) {
    const chave = r.produtoOrigemNome;
    const set = regrasPorCompra.get(chave) ?? new Set<string>();
    set.add(r.produtoDestinoCodigo);
    regrasPorCompra.set(chave, set);
  }
  for (const r of regras) {
    const codigos = [...(regrasPorCompra.get(r.produtoOrigemNome) ?? [])].sort().join('/');
    origemPorItem.set(
      r.produtoDestinoId,
      `${pc} / Regra ${r.produtoOrigemNome} → ${codigos}`,
    );
  }

  for (const p of encontrados) {
    mapa.set(p.id, {
      produtoId: p.id,
      origemDescricao: origemPorItem.get(p.id) ?? pc,
      unidadeEsperada: p.unidadePedido,
      requerBalanca: p.passaBalanca,
    });
  }

  return mapa;
}

export async function derivarTipoCarga(tx: Tx, compraProgramadaId: string): Promise<string | null> {
  const linha = await tx
    .select({ categoria: produtos.categoria })
    .from(comprasProgramadasItens)
    .innerJoin(produtos, eq(produtos.id, comprasProgramadasItens.produtoId))
    .where(
      and(
        eq(comprasProgramadasItens.compraProgramadaId, compraProgramadaId),
        isNull(comprasProgramadasItens.deletedAt),
      ),
    )
    .limit(1)
    .then((r) => r[0] ?? null);
  return linha?.categoria ?? null;
}

export async function contarPecasPorItem(
  tx: Tx,
  recebimentoId: string,
): Promise<Map<string, { quantidade: number; pesoTotal: string }>> {
  const linhas = await tx.execute<{
    produto_base_id: string;
    quantidade: string;
    peso_total: string;
  }>(sql`
    SELECT
      produto_base_id,
      count(*)::text AS quantidade,
      COALESCE(SUM(peso_original), 0)::text AS peso_total
    FROM pecas
    WHERE recebimento_id = ${recebimentoId}
      AND deleted_at IS NULL
    GROUP BY produto_base_id
  `);
  const mapa = new Map<string, { quantidade: number; pesoTotal: string }>();
  for (const row of linhas.rows) {
    mapa.set(row.produto_base_id, {
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
