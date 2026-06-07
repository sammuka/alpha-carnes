import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

// ── itens_compra ──────────────────────────────────────────────────────────────
// Item comprado em origem (ex.: boi, lote suíno, caixa de frango).
export const itensCompra = pgTable(
  'itens_compra',
  {
    id:            uuid('id').primaryKey().default(sql`uuidv7()`),
    codigo:        text('codigo').notNull(),
    descricao:     text('descricao').notNull(),
    categoria:     text('categoria'),
    unidadeCompra: text('unidade_compra').notNull(),
    status:        text('status').notNull().default('ativo'),
    createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:     timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_itens_compra_status', sql`${t.status} IN ('ativo','inativo')`),
    uniqueIndex('uq_itens_compra_codigo').on(t.codigo).where(sql`${t.deletedAt} IS NULL`),
    index('idx_itens_compra_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
  ],
);
