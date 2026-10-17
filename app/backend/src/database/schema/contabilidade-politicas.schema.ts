import { sql } from 'drizzle-orm';
import { check, date, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { usuarios } from './auth.schema';
import { centrosCusto, contasContabeis } from './contabilidade-plano.schema';

export const politicasContabilizacao = pgTable(
  'politicas_contabilizacao',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    codigo: text('codigo').notNull(),
    tipoEvento: text('tipo_evento').notNull(),
    competencia: date('competencia').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('uq_politicas_contabilizacao_codigo').on(t.codigo).where(sql`${t.deletedAt} IS NULL`),
    check('chk_politicas_tipo_evento', sql`${t.tipoEvento} IN ('LIQUIDACAO','REGISTRO','CANCELAMENTO','ESTORNO','TARIFA')`),
    check('chk_politicas_competencia_dia', sql`extract(day from ${t.competencia}) = 1`),
  ],
);

export const politicaVersoes = pgTable(
  'politica_versoes',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    politicaId: uuid('politica_id').notNull().references(() => politicasContabilizacao.id),
    numero: integer('numero').notNull(),
    contaDebitoId: uuid('conta_debito_id').notNull().references(() => contasContabeis.id),
    contaCreditoId: uuid('conta_credito_id').notNull().references(() => contasContabeis.id),
    centroCustoId: uuid('centro_custo_id').notNull().references(() => centrosCusto.id),
    vigenciaInicio: date('vigencia_inicio').notNull(),
    situacao: text('situacao').notNull(),
    justificativa: text('justificativa').notNull(),
    responsavelId: uuid('responsavel_id').notNull().references(() => usuarios.id),
    aprovadorId: uuid('aprovador_id').references(() => usuarios.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('uq_politica_versoes_numero').on(t.politicaId, t.numero).where(sql`${t.deletedAt} IS NULL`),
    index('idx_politica_versoes_politica').on(t.politicaId),
    index('idx_politica_versoes_debito').on(t.contaDebitoId),
    index('idx_politica_versoes_credito').on(t.contaCreditoId),
    index('idx_politica_versoes_centro').on(t.centroCustoId),
    index('idx_politica_versoes_responsavel').on(t.responsavelId),
    index('idx_politica_versoes_aprovador').on(t.aprovadorId),
    check('chk_politica_versoes_situacao', sql`${t.situacao} IN ('DRAFT','REVIEW','APPROVED','REJECTED','SUSPENDED')`),
  ],
);

export const politicaSimulacoes = pgTable(
  'politica_simulacoes',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    politicaId: uuid('politica_id').notNull().references(() => politicasContabilizacao.id),
    versaoNumero: integer('versao_numero').notNull(),
    valor: numeric('valor', { precision: 15, scale: 2 }).notNull(),
    debito: numeric('debito', { precision: 15, scale: 2 }).notNull(),
    credito: numeric('credito', { precision: 15, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_politica_simulacoes_politica').on(t.politicaId),
    check('chk_politica_simulacoes_balance', sql`${t.debito} = ${t.credito} AND ${t.valor} = ${t.debito}`),
  ],
);
