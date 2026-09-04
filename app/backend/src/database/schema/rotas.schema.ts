import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { representantes } from './representantes.schema';
import { frotaCaminhoes, frotaMotoristas } from './frota.schema';

export const rotas = pgTable(
  'rotas',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    codigo: text('codigo').notNull(),
    nome: text('nome').notNull(),
    regiao: text('regiao'),
    representantePadraoId: uuid('representante_padrao_id').references(() => representantes.id),
    representantePadrao: text('representante_padrao'),
    caminhaoPadraoId: uuid('caminhao_padrao_id').references(() => frotaCaminhoes.id),
    caminhaoPadrao: text('caminhao_padrao'),
    motoristaPadraoId: uuid('motorista_padrao_id').references(() => frotaMotoristas.id),
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
    index('idx_rotas_representante_padrao').on(t.representantePadraoId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_rotas_caminhao_padrao').on(t.caminhaoPadraoId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_rotas_motorista_padrao').on(t.motoristaPadraoId).where(sql`${t.deletedAt} IS NULL`),
  ],
);
