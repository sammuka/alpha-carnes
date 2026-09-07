import { and, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { produtos, regrasDesdobramentoComercial } from './schema';

type Db = NodePgDatabase<typeof schema>;

/** AD-01 — 1 boi casado = 6 partes. */
const DESDOBRAMENTO_BOI: ReadonlyArray<{ codigoDestino: string; fator: string }> = [
  { codigoDestino: 'TZ', fator: '2' },
  { codigoDestino: 'DT', fator: '2' },
  { codigoDestino: 'PA', fator: '2' },
];

const VIGENCIA_ABERTA = new Date('2020-01-01T00:00:00.000Z');

/**
 * Seed idempotente das regras de desdobramento comercial conhecidas:
 * AD-01 (BOI → 2 TZ + 2 DT + 2 PA). Identidade 1:1 implícita (AD-15) — sem regras TZ→TZ.
 * Exige `seedCatalogoMvp` antes (produtos).
 */
export async function seedRegrasDesdobramentoComercial(db: Db): Promise<void> {
  await garantirProdutoBoi(db);
  const boi = await produtoPorCodigo(db, 'BOI');

  for (const parte of DESDOBRAMENTO_BOI) {
    const destino = await produtoPorCodigo(db, parte.codigoDestino);
    await upsertRegra(db, {
      produtoOrigemId: boi.id,
      produtoDestinoId: destino.id,
      fatorQuantidade: parte.fator,
      observacoes: 'AD-01 — 1 boi casado = 2 TZ + 2 DT + 2 PA',
    });
  }

  await db
    .update(regrasDesdobramentoComercial)
    .set({ deletedAt: sql`COALESCE(${regrasDesdobramentoComercial.deletedAt}, now())`, status: 'inativo', updatedAt: new Date() })
    .where(
      and(
        isNull(regrasDesdobramentoComercial.deletedAt),
        eq(regrasDesdobramentoComercial.produtoOrigemId, regrasDesdobramentoComercial.produtoDestinoId),
      ),
    );
}

async function garantirProdutoBoi(db: Db): Promise<void> {
  const [existente] = await db
    .select()
    .from(produtos)
    .where(and(eq(produtos.codigo, 'BOI'), isNull(produtos.deletedAt)))
    .limit(1);
  if (existente) return;

  await db.insert(produtos).values({
    codigo: 'BOI',
    nome: 'BOI CASADO',
    tipoOperacional: 'compra_base',
    unidadePedido: 'unidade',
    unidadePreco: 'kg',
    exigePeso: true,
    ativoVenda: false,
    ativoCompra: true,
    status: 'ativo',
    atributosJson: { origemUnificacao: 'AD-15', legado: 'itens_compra', provisorio: true, pendencia: 'P11' },
  });
}

async function produtoPorCodigo(db: Db, codigo: string) {
  const [item] = await db
    .select()
    .from(produtos)
    .where(and(eq(produtos.codigo, codigo), isNull(produtos.deletedAt)))
    .limit(1);
  if (!item) {
    throw new Error(`Produto ${codigo} ausente — rode seed catálogo MVP antes`);
  }
  return item;
}

async function upsertRegra(
  db: Db,
  valores: {
    produtoOrigemId: string;
    produtoDestinoId: string;
    fatorQuantidade: string;
    observacoes: string;
  },
): Promise<void> {
  const [existente] = await db
    .select()
    .from(regrasDesdobramentoComercial)
    .where(
      and(
        eq(regrasDesdobramentoComercial.produtoOrigemId, valores.produtoOrigemId),
        eq(regrasDesdobramentoComercial.produtoDestinoId, valores.produtoDestinoId),
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
    produtoOrigemId: valores.produtoOrigemId,
    produtoDestinoId: valores.produtoDestinoId,
    fatorQuantidade: valores.fatorQuantidade,
    status: 'ativo',
    vigenciaInicio: VIGENCIA_ABERTA,
    observacoes: valores.observacoes,
  });
}
