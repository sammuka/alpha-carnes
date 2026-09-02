import { and, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { itensComerciais, itensCompra, regrasDesdobramentoComercial } from './schema';
import { primeiroOuFalha } from '../common/crud/paginacao';

type Db = NodePgDatabase<typeof schema>;

/** AD-01 — 1 boi casado = 6 partes. */
const DESDOBRAMENTO_BOI: ReadonlyArray<{ codigoComercial: string; fator: string }> = [
  { codigoComercial: 'TZ', fator: '2' },
  { codigoComercial: 'DT', fator: '2' },
  { codigoComercial: 'PA', fator: '2' },
];

/**
 * Identidade 1:1 para itens de compra que já existem no cadastro e correspondem
 * a um item comercial (partes compradas como peça, banda de porco). Não cria o
 * item de compra — só liga o que já estiver cadastrado.
 */
const PARES_IDENTIDADE: ReadonlyArray<{ codigoCompra: string; codigoComercial: string }> = [
  { codigoCompra: 'TZ', codigoComercial: 'TZ' },
  { codigoCompra: 'DT', codigoComercial: 'DT' },
  { codigoCompra: 'PA', codigoComercial: 'PA' },
  { codigoCompra: 'BANDA DE PORCO', codigoComercial: 'BPORCO' },
];

const VIGENCIA_ABERTA = new Date('2020-01-01T00:00:00.000Z');

/** Boi e partes são comprados por unidade/peça; peso entra na balança (v1.1 §6.7). */
const UNIDADE_COMPRA_PECA = 'unidade';
const ITENS_COMPRA_POR_UNIDADE = ['BOI', 'TZ', 'DT', 'PA'] as const;

/**
 * Seed idempotente das regras de desdobramento comercial conhecidas:
 * AD-01 (BOI → 2 TZ + 2 DT + 2 PA) e identidade 1:1 das partes/banda quando o
 * item de compra já existe. Exige `seedCatalogoMvp` antes (itens comerciais).
 */
export async function seedRegrasDesdobramentoComercial(db: Db): Promise<void> {
  await reconciliarUnidadeCompraPecas(db);
  const boi = await garantirItemCompraBoi(db);
  const tz = await comercialPorCodigo(db, 'TZ');
  const dt = await comercialPorCodigo(db, 'DT');
  const pa = await comercialPorCodigo(db, 'PA');
  const comerciais = { TZ: tz, DT: dt, PA: pa };

  for (const parte of DESDOBRAMENTO_BOI) {
    await upsertRegra(db, {
      itemCompraId: boi.id,
      itemComercialId: comerciais[parte.codigoComercial as keyof typeof comerciais].id,
      fatorQuantidade: parte.fator,
      observacoes: 'AD-01 — 1 boi casado = 2 TZ + 2 DT + 2 PA',
    });
  }

  for (const par of PARES_IDENTIDADE) {
    const compra = await itemCompraPorCodigo(db, par.codigoCompra);
    if (!compra) continue;
    const comercial = await comercialPorCodigo(db, par.codigoComercial);
    await upsertRegra(db, {
      itemCompraId: compra.id,
      itemComercialId: comercial.id,
      fatorQuantidade: '1',
      observacoes: `Identidade 1:1 ${par.codigoCompra} → ${par.codigoComercial}`,
    });
  }
}

async function garantirItemCompraBoi(db: Db) {
  const [existente] = await db
    .select()
    .from(itensCompra)
    .where(and(eq(itensCompra.codigo, 'BOI'), isNull(itensCompra.deletedAt)))
    .limit(1);
  if (existente) return existente;

  const [inserido] = await db
    .insert(itensCompra)
    .values({
      codigo: 'BOI',
      descricao: 'BOI CASADO',
      categoria: 'BOVINA',
      unidadeCompra: UNIDADE_COMPRA_PECA,
      status: 'ativo',
    })
    .returning();
  return primeiroOuFalha(inserido ? [inserido] : [], 'falha ao criar item de compra BOI');
}

async function reconciliarUnidadeCompraPecas(db: Db): Promise<void> {
  for (const codigo of ITENS_COMPRA_POR_UNIDADE) {
    await db
      .update(itensCompra)
      .set({ unidadeCompra: UNIDADE_COMPRA_PECA, updatedAt: new Date() })
      .where(and(eq(itensCompra.codigo, codigo), isNull(itensCompra.deletedAt)));
  }
}

async function comercialPorCodigo(db: Db, codigo: string) {
  const [item] = await db
    .select()
    .from(itensComerciais)
    .where(and(eq(itensComerciais.codigo, codigo), isNull(itensComerciais.deletedAt)))
    .limit(1);
  if (!item) {
    throw new Error(`Item comercial ${codigo} ausente — rode seed catálogo MVP antes`);
  }
  return item;
}

async function itemCompraPorCodigo(db: Db, codigo: string) {
  const [item] = await db
    .select()
    .from(itensCompra)
    .where(and(eq(itensCompra.codigo, codigo), isNull(itensCompra.deletedAt)))
    .limit(1);
  return item ?? null;
}

async function upsertRegra(
  db: Db,
  valores: {
    itemCompraId: string;
    itemComercialId: string;
    fatorQuantidade: string;
    observacoes: string;
  },
): Promise<void> {
  const [existente] = await db
    .select()
    .from(regrasDesdobramentoComercial)
    .where(
      and(
        eq(regrasDesdobramentoComercial.itemCompraId, valores.itemCompraId),
        eq(regrasDesdobramentoComercial.itemComercialId, valores.itemComercialId),
        isNull(regrasDesdobramentoComercial.deletedAt),
      ),
    )
    .limit(1);

  if (existente) {
    await db
      .update(regrasDesdobramentoComercial)
      .set({
        fatorQuantidade: valores.fatorQuantidade,
        status: 'ativo',
        observacoes: valores.observacoes,
        updatedAt: new Date(),
      })
      .where(eq(regrasDesdobramentoComercial.id, existente.id));
    return;
  }

  await db.insert(regrasDesdobramentoComercial).values({
    itemCompraId: valores.itemCompraId,
    itemComercialId: valores.itemComercialId,
    fatorQuantidade: valores.fatorQuantidade,
    status: 'ativo',
    vigenciaInicio: VIGENCIA_ABERTA,
    observacoes: valores.observacoes,
  });
}
