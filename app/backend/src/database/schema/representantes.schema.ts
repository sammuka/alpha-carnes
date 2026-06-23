import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const representantes = pgTable(
  'representantes',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    codigo: text('codigo').notNull(),
    nome: text('nome').notNull(),
    tipoCanal: text('tipo_canal'),
    contato: text('contato'),
    status: text('status').notNull().default('ativo'),
    observacao: text('observacao'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_representantes_status', sql`${t.status} IN ('ativo','inativo')`),
    uniqueIndex('uq_representantes_codigo').on(t.codigo).where(sql`${t.deletedAt} IS NULL`),
    index('idx_representantes_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
  ],
);
