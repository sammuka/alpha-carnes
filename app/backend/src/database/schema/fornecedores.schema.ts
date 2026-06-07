import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

// ── fornecedores ──────────────────────────────────────────────────────────────
export const fornecedores = pgTable(
  'fornecedores',
  {
    id:                         uuid('id').primaryKey().default(sql`uuidv7()`),
    codigo:                     text('codigo').notNull(),
    razaoSocial:                text('razao_social').notNull(),
    documentoFiscal:            text('documento_fiscal').notNull(), // CNPJ ou CPF, só dígitos
    status:                     text('status').notNull().default('ativo'),
    contatosJson:               jsonb('contatos_json').notNull().default(sql`'{}'::jsonb`),
    parametrosOperacionaisJson: jsonb('parametros_operacionais_json').notNull().default(sql`'{}'::jsonb`),
    observacoes:                text('observacoes'),
    createdAt:                  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:                  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:                  timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_fornecedores_status', sql`${t.status} IN ('ativo','inativo')`),
    uniqueIndex('uq_fornecedores_codigo').on(t.codigo).where(sql`${t.deletedAt} IS NULL`),
    uniqueIndex('uq_fornecedores_documento_fiscal').on(t.documentoFiscal).where(sql`${t.deletedAt} IS NULL`),
    index('idx_fornecedores_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
    index('idx_fornecedores_parametros_gin').using('gin', t.parametrosOperacionaisJson),
  ],
);
