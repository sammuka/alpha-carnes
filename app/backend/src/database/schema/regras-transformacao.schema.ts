import { relations, sql } from 'drizzle-orm';
import { check, index, integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { produtos } from './produtos.schema';

// ── regras_transformacao ──────────────────────────────────────────────────────
// Regras de transformação na desossa (TZ → partes com quantidade fixa por saída).
export const regrasTransformacao = pgTable(
  'regras_transformacao',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    nome: text('nome').notNull(),
    produtoOrigemCodigo: text('produto_origem_codigo').notNull().default('TZ'),
    status: text('status').notNull().default('ativo'),
    prioridade: integer('prioridade').notNull().default(0),
    observacao: text('observacao'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_regras_transf_status', sql`${t.status} IN ('ativo','inativo')`),
    index('idx_regras_transf_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
  ],
);

// ── regras_transformacao_saidas ───────────────────────────────────────────────
export const regrasTransformacaoSaidas = pgTable(
  'regras_transformacao_saidas',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    regraId: uuid('regra_id').notNull().references(() => regrasTransformacao.id),
    produtoId: uuid('produto_id').notNull().references(() => produtos.id),
    quantidadeFixa: numeric('quantidade_fixa', { precision: 10, scale: 3 }).notNull().default('1'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_regras_transf_saidas_qtd_positiva', sql`${t.quantidadeFixa} > 0`),
    index('idx_regras_transf_saidas_regra').on(t.regraId),
    index('idx_regras_transf_saidas_produto').on(t.produtoId),
  ],
);

export const regrasTransformacaoRelations = relations(regrasTransformacao, ({ many }) => ({
  saidas: many(regrasTransformacaoSaidas),
}));

export const regrasTransformacaoSaidasRelations = relations(regrasTransformacaoSaidas, ({ one }) => ({
  regra: one(regrasTransformacao, {
    fields: [regrasTransformacaoSaidas.regraId],
    references: [regrasTransformacao.id],
  }),
  produto: one(produtos, {
    fields: [regrasTransformacaoSaidas.produtoId],
    references: [produtos.id],
  }),
}));
