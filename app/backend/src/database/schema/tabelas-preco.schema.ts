import { sql } from 'drizzle-orm';
import { check, date, index, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { produtos } from './produtos.schema';
import { usuarios } from './auth.schema';

// ── tabelas_preco ─────────────────────────────────────────────────────────────
// Cabeçalho da tabela de preços do dia (D13).
export const tabelasPreco = pgTable(
  'tabelas_preco',
  {
    id:            uuid('id').primaryKey().default(sql`uuidv7()`),
    data:          date('data').notNull(),
    status:        text('status').notNull().default('rascunho'),
    observacao:    text('observacao'),
    publicadaPor:  uuid('publicada_por').references(() => usuarios.id),
    publicadaEm:   timestamp('publicada_em', { withTimezone: true }),
    createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:     timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_tabelas_preco_status', sql`${t.status} IN ('rascunho','publicada')`),
    uniqueIndex('uq_tabelas_preco_data').on(t.data).where(sql`${t.deletedAt} IS NULL`),
  ],
);

// ── tabelas_preco_itens ───────────────────────────────────────────────────────
// Uma linha por produto, com as 4 faixas de preço nullable (RA-06).
export const tabelasPrecoItens = pgTable(
  'tabelas_preco_itens',
  {
    id:            uuid('id').primaryKey().default(sql`uuidv7()`),
    tabelaPrecoId: uuid('tabela_preco_id').notNull().references(() => tabelasPreco.id),
    produtoId:     uuid('produto_id').notNull().references(() => produtos.id),
    precoA:        numeric('preco_a', { precision: 15, scale: 2 }),
    precoB:        numeric('preco_b', { precision: 15, scale: 2 }),
    precoC:        numeric('preco_c', { precision: 15, scale: 2 }),
    precoD:        numeric('preco_d', { precision: 15, scale: 2 }),
    createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_tabelas_preco_itens_positivos', sql`
      (${t.precoA} IS NULL OR ${t.precoA} > 0) AND (${t.precoB} IS NULL OR ${t.precoB} > 0) AND
      (${t.precoC} IS NULL OR ${t.precoC} > 0) AND (${t.precoD} IS NULL OR ${t.precoD} > 0)
    `),
    uniqueIndex('uq_tabelas_preco_itens_produto').on(t.tabelaPrecoId, t.produtoId),
  ],
);

// ── tabelas_preco_publicacoes ─────────────────────────────────────────────────
// Histórico append-only de publicação/reversão (D13).
export const tabelasPrecoPublicacoes = pgTable(
  'tabelas_preco_publicacoes',
  {
    id:            uuid('id').primaryKey().default(sql`uuidv7()`),
    tabelaPrecoId: uuid('tabela_preco_id').notNull().references(() => tabelasPreco.id),
    acao:          text('acao').notNull(),
    autorId:       uuid('autor_id').notNull().references(() => usuarios.id),
    observacao:    text('observacao'),
    criadoEm:      timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_tabelas_preco_publicacoes_acao', sql`${t.acao} IN ('publicada','revertida_para_rascunho')`),
    index('idx_tabelas_preco_publicacoes_tabela').on(t.tabelaPrecoId),
  ],
);
