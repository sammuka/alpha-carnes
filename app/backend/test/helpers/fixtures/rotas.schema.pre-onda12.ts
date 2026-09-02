import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const rotas = pgTable(
  'rotas',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    codigo: text('codigo').notNull(),
    nome: text('nome').notNull(),
    regiao: text('regiao'),
    representantePadrao: text('representante_padrao'),
    caminhaoPadrao: text('caminhao_padrao'),
    motoristaPadrao: text('motorista_padrao'),
    observacoes: text('observacoes'),
    paradas: jsonb('paradas').notNull().default(sql`'[]'::jsonb`),
    diasAtendimento: jsonb('dias_atendimento').notNull().default(sql`'[]'::jsonb`),
    status: text('status').notNull().default('ativo'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_rotas_status', sql`${t.status} IN ('ativo','inativo')`),
    uniqueIndex('uq_rotas_codigo').on(t.codigo).where(sql`${t.deletedAt} IS NULL`),
    index('idx_rotas_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
  ],
);
