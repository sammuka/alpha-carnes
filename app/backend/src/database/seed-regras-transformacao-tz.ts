import { and, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { produtos, regrasTransformacao, regrasTransformacaoSaidas } from './schema';

type Db = NodePgDatabase<typeof schema>;

/** Seed idempotente das Alternativas A/B de TZ (P12 — Badge Provisório). */
export async function seedRegrasTransformacaoTz(db: Db): Promise<void> {
  const byCodigo = async (codigo: string) => {
    const [p] = await db
      .select()
      .from(produtos)
      .where(and(eq(produtos.codigo, codigo), isNull(produtos.deletedAt)))
      .limit(1);
    if (!p) throw new Error(`Produto ${codigo} ausente — rode seed catálogo MVP antes`);
    return p;
  };
  const cb = await byCodigo('CB');
  const jac = await byCodigo('JAC');
  const cba = await byCodigo('CBA');
  const fc = await byCodigo('FC');

  async function upsertRegra(
    codigo: string,
    nome: string,
    saidas: { produtoId: string; qtd: string }[],
  ) {
    const [existente] = await db
      .select()
      .from(regrasTransformacao)
      .where(and(eq(regrasTransformacao.codigo, codigo), isNull(regrasTransformacao.deletedAt)))
      .limit(1);
    let regraId = existente?.id;
    if (!regraId) {
      const [criada] = await db
        .insert(regrasTransformacao)
        .values({
          codigo,
          nome,
          produtoOrigemCodigo: 'TZ',
          status: 'ativo',
          prioridade: codigo === 'TZ_A' ? 1 : 2,
          provisorio: true,
          observacao: 'Regra provisória v1.1 §6.6 / P12 — validar com cliente',
        })
        .returning();
      if (!criada) throw new Error(`Falha ao criar regra ${codigo}`);
      regraId = criada.id;
    } else {
      await db
        .update(regrasTransformacao)
        .set({ provisorio: true, nome, updatedAt: new Date() })
        .where(eq(regrasTransformacao.id, regraId));
    }
    await db.delete(regrasTransformacaoSaidas).where(eq(regrasTransformacaoSaidas.regraId, regraId));
    await db.insert(regrasTransformacaoSaidas).values(
      saidas.map((s) => ({ regraId: regraId!, produtoId: s.produtoId, quantidadeFixa: s.qtd })),
    );
  }

  await upsertRegra('TZ_A', 'Alternativa A — TZ → Coxão-bola + Jacaré', [
    { produtoId: cb.id, qtd: '1' },
    { produtoId: jac.id, qtd: '1' },
  ]);
  await upsertRegra('TZ_B', 'Alternativa B — TZ → Coxão-bola c/ alcatra + Filé curto', [
    { produtoId: cba.id, qtd: '1' },
    { produtoId: fc.id, qtd: '1' },
  ]);

  await db.update(produtos).set({
    origemTransformacao: true,
    passaDesossa: true,
    updatedAt: new Date(),
  }).where(and(eq(produtos.codigo, 'TZ'), isNull(produtos.deletedAt)));

  for (const codigo of ['CB', 'JAC', 'CBA', 'FC'] as const) {
    await db.update(produtos).set({
      saidaTransformacao: true,
      passaDesossa: true,
      tipoOperacional: 'derivado_desossa',
      updatedAt: new Date(),
    }).where(and(eq(produtos.codigo, codigo), isNull(produtos.deletedAt)));
  }
}
