import { relations, sql } from 'drizzle-orm';
import { check, index, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { produtos } from './produtos.schema';

// ── regras_desdobramento_comercial ────────────────────────────────────────────
// Liga produto origem (compra) → produto destino (venda) com fator de quantidade e vigência.
export const regrasDesdobramentoComercial = pgTable(
  'regras_desdobramento_comercial',
  {
    id:              uuid('id').primaryKey().default(sql`uuidv7()`),
    produtoOrigemId: uuid('produto_origem_id').notNull().references(() => produtos.id),
    produtoDestinoId: uuid('produto_destino_id').notNull().references(() => produtos.id),
    fatorQuantidade: numeric('fator_quantidade', { precision: 10, scale: 3 }).notNull(),
    status:          text('status').notNull().default('ativo'),
    vigenciaInicio:  timestamp('vigencia_inicio', { withTimezone: true }).notNull(),
    vigenciaFim:     timestamp('vigencia_fim', { withTimezone: true }),
    observacoes:     text('observacoes'),
    createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:       timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_regras_desd_status', sql`${t.status} IN ('ativo','inativo')`),
    check('chk_regras_desd_fator_positivo', sql`${t.fatorQuantidade} > 0`),
    check(
      'chk_regras_desd_origem_destino_distintos',
      sql`${t.deletedAt} IS NOT NULL OR ${t.produtoOrigemId} <> ${t.produtoDestinoId}`,
    ),
    index('idx_regras_desd_produto_origem').on(t.produtoOrigemId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_regras_desd_produto_destino').on(t.produtoDestinoId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_regras_desd_par_ativo')
      .on(t.produtoOrigemId, t.produtoDestinoId)
      .where(sql`${t.deletedAt} IS NULL AND ${t.status} = 'ativo'`),
  ],
);

export const regrasDesdobramentoRelations = relations(regrasDesdobramentoComercial, ({ one }) => ({
  produtoOrigem: one(produtos, {
    fields: [regrasDesdobramentoComercial.produtoOrigemId],
    references: [produtos.id],
    relationName: 'regraDesdobramentoOrigem',
  }),
  produtoDestino: one(produtos, {
    fields: [regrasDesdobramentoComercial.produtoDestinoId],
    references: [produtos.id],
    relationName: 'regraDesdobramentoDestino',
  }),
}));
