import { relations, sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

// ── frota_caminhoes ───────────────────────────────────────────────────────────
// Cadastro da frota (Cadastros & Regras / Caminhões). Não confundir com `caminhoes`,
// que é a carga da expedição (decisão 12 da Onda 3).
export const frotaCaminhoes = pgTable(
  'frota_caminhoes',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    placa: text('placa').notNull(),
    descricao: text('descricao'),
    capacidadeKg: integer('capacidade_kg').notNull().default(0),
    rotaPadraoId: uuid('rota_padrao_id'),
    status: text('status').notNull().default('ativo'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_frota_caminhoes_status', sql`${t.status} IN ('ativo','inativo')`),
    check('chk_frota_caminhoes_capacidade', sql`${t.capacidadeKg} >= 0`),
    uniqueIndex('uq_frota_caminhoes_placa').on(t.placa).where(sql`${t.deletedAt} IS NULL`),
    index('idx_frota_caminhoes_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
  ],
);

// ── frota_motoristas ──────────────────────────────────────────────────────────
export const frotaMotoristas = pgTable(
  'frota_motoristas',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    nome: text('nome').notNull(),
    documento: text('documento').notNull(),
    telefone: text('telefone'),
    caminhaoPadraoId: uuid('caminhao_padrao_id').references(() => frotaCaminhoes.id),
    status: text('status').notNull().default('ativo'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_frota_motoristas_status', sql`${t.status} IN ('ativo','inativo')`),
    uniqueIndex('uq_frota_motoristas_documento').on(t.documento).where(sql`${t.deletedAt} IS NULL`),
    index('idx_frota_motoristas_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
    index('idx_frota_motoristas_caminhao').on(t.caminhaoPadraoId),
  ],
);

export const frotaCaminhoesRelations = relations(frotaCaminhoes, ({ many }) => ({
  motoristas: many(frotaMotoristas),
}));

export const frotaMotoristasRelations = relations(frotaMotoristas, ({ one }) => ({
  caminhaoPadrao: one(frotaCaminhoes, {
    fields: [frotaMotoristas.caminhaoPadraoId],
    references: [frotaCaminhoes.id],
  }),
}));
