import { relations, sql } from 'drizzle-orm';
import { check, index, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { itensCompra } from './itens-compra.schema';
import { itensComerciais } from './itens-comerciais.schema';

// ── regras_desdobramento_comercial ────────────────────────────────────────────
// Liga item de compra → item comercial com fator de quantidade e vigência.
// Base que a F3 consome para gerar disponibilidade virtual.
export const regrasDesdobramentoComercial = pgTable(
  'regras_desdobramento_comercial',
  {
    id:              uuid('id').primaryKey().default(sql`uuidv7()`),
    itemCompraId:    uuid('item_compra_id').notNull().references(() => itensCompra.id),
    itemComercialId: uuid('item_comercial_id').notNull().references(() => itensComerciais.id),
    fatorQuantidade: numeric('fator_quantidade', { precision: 10, scale: 3 }).notNull(),
    status:          text('status').notNull().default('ativo'),
    vigenciaInicio:  timestamp('vigencia_inicio', { withTimezone: true }).notNull(),
    vigenciaFim:     timestamp('vigencia_fim', { withTimezone: true }), // null = vigência aberta
    observacoes:     text('observacoes'),
    createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:       timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_regras_desd_status', sql`${t.status} IN ('ativo','inativo')`),
    // fator_quantidade > 0 (invariante de negócio).
    check('chk_regras_desd_fator_positivo', sql`${t.fatorQuantidade} > 0`),
    index('idx_regras_desd_item_compra').on(t.itemCompraId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_regras_desd_item_comercial').on(t.itemComercialId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_regras_desd_par_ativo')
      .on(t.itemCompraId, t.itemComercialId)
      .where(sql`${t.deletedAt} IS NULL AND ${t.status} = 'ativo'`),
  ],
);

export const regrasDesdobramentoRelations = relations(regrasDesdobramentoComercial, ({ one }) => ({
  itemCompra: one(itensCompra, {
    fields: [regrasDesdobramentoComercial.itemCompraId],
    references: [itensCompra.id],
  }),
  itemComercial: one(itensComerciais, {
    fields: [regrasDesdobramentoComercial.itemComercialId],
    references: [itensComerciais.id],
  }),
}));
