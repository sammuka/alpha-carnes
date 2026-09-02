import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

// ── itens_comerciais ──────────────────────────────────────────────────────────
// Item vendável (ex.: dianteiro, central, traseiro, subitem específico).
export const itensComerciais = pgTable(
  'itens_comerciais',
  {
    id:                      uuid('id').primaryKey().default(sql`uuidv7()`),
    codigo:                  text('codigo').notNull(),
    descricao:               text('descricao').notNull(),
    categoria:               text('categoria'),
    unidadeComercial:        text('unidade_comercial').notNull(),
    permiteCorte:            boolean('permite_corte').notNull().default(false),
    status:                  text('status').notNull().default('ativo'),
    observacoesOperacionais: text('observacoes_operacionais'),
    createdAt:               timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:               timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:               timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_itens_comerciais_status', sql`${t.status} IN ('ativo','inativo')`),
    check('chk_itens_comerciais_unidade', sql`${t.unidadeComercial} IN ('kg','unidade')`),
    uniqueIndex('uq_itens_comerciais_codigo').on(t.codigo).where(sql`${t.deletedAt} IS NULL`),
    index('idx_itens_comerciais_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
  ],
);
