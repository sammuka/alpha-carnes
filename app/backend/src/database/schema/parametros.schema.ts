import { sql } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// ── parametros ────────────────────────────────────────────────────────────────
// Parâmetros do sistema como tabela chave-valor (JSONB), só o necessário.
export const parametros = pgTable('parametros', {
  id:        uuid('id').primaryKey().default(sql`uuidv7()`),
  chave:     text('chave').notNull().unique(),
  valorJson: jsonb('valor_json').notNull().default(sql`'{}'::jsonb`),
  descricao: text('descricao'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
