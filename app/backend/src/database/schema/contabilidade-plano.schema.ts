import { sql } from 'drizzle-orm';
import { check, date, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { usuarios } from './auth.schema';

export const centrosCusto = pgTable(
  'centros_custo',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    codigo: text('codigo').notNull(),
    nome: text('nome').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('uq_centros_custo_codigo').on(t.codigo).where(sql`${t.deletedAt} IS NULL`),
  ],
);

export const contasContabeis = pgTable(
  'contas_contabeis',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    codigo: text('codigo').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('uq_contas_contabeis_codigo').on(t.codigo).where(sql`${t.deletedAt} IS NULL`),
  ],
);

export const contaVersoes = pgTable(
  'conta_versoes',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    contaId: uuid('conta_id').notNull().references(() => contasContabeis.id),
    numero: integer('numero').notNull(),
    nome: text('nome').notNull(),
    classificacao: text('classificacao').notNull(),
    natureza: text('natureza').notNull(),
    grupo: text('grupo').notNull(),
    contaPaiId: uuid('conta_pai_id').references(() => contasContabeis.id),
    centroCustoId: uuid('centro_custo_id').notNull().references(() => centrosCusto.id),
    vigenciaInicio: date('vigencia_inicio').notNull(),
    vigenciaFim: date('vigencia_fim'),
    situacao: text('situacao').notNull(),
    justificativa: text('justificativa').notNull(),
    responsavelId: uuid('responsavel_id').notNull().references(() => usuarios.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('uq_conta_versoes_numero').on(t.contaId, t.numero).where(sql`${t.deletedAt} IS NULL`),
    index('idx_conta_versoes_conta').on(t.contaId),
    index('idx_conta_versoes_pai').on(t.contaPaiId),
    index('idx_conta_versoes_centro').on(t.centroCustoId),
    index('idx_conta_versoes_responsavel').on(t.responsavelId),
    index('idx_conta_versoes_situacao').on(t.situacao).where(sql`${t.deletedAt} IS NULL`),
    check('chk_conta_versoes_classificacao', sql`${t.classificacao} IN ('sintetica','analitica')`),
    check('chk_conta_versoes_natureza', sql`${t.natureza} IN ('ATIVO','PASSIVO','RECEITA','DESPESA','CUSTO')`),
    check('chk_conta_versoes_situacao', sql`${t.situacao} IN ('DRAFT','REVIEW','APPROVED','REJECTED','SUSPENDED')`),
    check('chk_conta_versoes_vigencia', sql`${t.vigenciaFim} IS NULL OR ${t.vigenciaFim} >= ${t.vigenciaInicio}`),
  ],
);
