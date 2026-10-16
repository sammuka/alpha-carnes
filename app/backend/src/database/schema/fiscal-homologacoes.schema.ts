import { sql } from 'drizzle-orm';
import {
  check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid, varchar,
} from 'drizzle-orm/pg-core';
import { usuarios } from './auth.schema';
import { regrasTributarias } from './fiscal-regras.schema';
import { simulacoesFiscais } from './fiscal-simulacoes.schema';

export const SITUACOES_HOMOLOGACAO = ['EM_REVISAO', 'APROVADA', 'REJEITADA', 'PUBLICADA'] as const;

export const ROTULOS_SITUACAO_HOMOLOGACAO: Record<(typeof SITUACOES_HOMOLOGACAO)[number], string> = {
  EM_REVISAO: 'Em revisão',
  APROVADA: 'Aprovada',
  REJEITADA: 'Rejeitada',
  PUBLICADA: 'Publicada',
};

const auditCols = {
  versao: integer('versao').notNull().default(1),
  criadoPorId: uuid('criado_por_id').notNull().references(() => usuarios.id),
  atualizadoPorId: uuid('atualizado_por_id').notNull().references(() => usuarios.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};

export const homologacoesRegras = pgTable('homologacoes_regras', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  codigo: varchar('codigo', { length: 20 }).notNull(),
  regraId: uuid('regra_id').notNull().references(() => regrasTributarias.id),
  descricao: text('descricao').notNull(),
  situacao: text('situacao').notNull().default('EM_REVISAO'),
  justificativa: text('justificativa').notNull(),
  aprovadoPorId: uuid('aprovado_por_id').references(() => usuarios.id),
  aprovadoEm: timestamp('aprovado_em', { withTimezone: true }),
  rejeitadoPorId: uuid('rejeitado_por_id').references(() => usuarios.id),
  rejeitadoEm: timestamp('rejeitado_em', { withTimezone: true }),
  publicadoPorId: uuid('publicado_por_id').references(() => usuarios.id),
  publicadoEm: timestamp('publicado_em', { withTimezone: true }),
  ...auditCols,
}, (t) => [
  check('homologacoes_codigo_formato_check', sql`${t.codigo} ~ '^[1-9][0-9]{0,17}$'`),
  check('homologacoes_situacao_check', sql`${t.situacao} IN ('EM_REVISAO','APROVADA','REJEITADA','PUBLICADA')`),
  check('homologacoes_versao_positiva_check', sql`${t.versao} >= 1`),
  check('homologacoes_descricao_preenchida_check', sql`btrim(${t.descricao}) <> ''`),
  check('homologacoes_descricao_tamanho_check', sql`char_length(btrim(${t.descricao})) BETWEEN 3 AND 500`),
  check(
    'homologacoes_aprovada_check',
    sql`${t.situacao} <> 'APROVADA' OR (${t.aprovadoPorId} IS NOT NULL AND ${t.aprovadoEm} IS NOT NULL)`,
  ),
  check(
    'homologacoes_rejeitada_check',
    sql`${t.situacao} <> 'REJEITADA' OR (${t.rejeitadoPorId} IS NOT NULL AND ${t.rejeitadoEm} IS NOT NULL)`,
  ),
  check(
    'homologacoes_publicada_check',
    sql`${t.situacao} <> 'PUBLICADA' OR (${t.aprovadoPorId} IS NOT NULL AND ${t.aprovadoEm} IS NOT NULL AND ${t.publicadoPorId} IS NOT NULL AND ${t.publicadoEm} IS NOT NULL)`,
  ),
  check('homologacoes_rejeitada_sem_aprovador_check', sql`${t.situacao} <> 'REJEITADA' OR ${t.aprovadoPorId} IS NULL`),
  uniqueIndex('uq_homologacoes_codigo').on(t.codigo).where(sql`${t.deletedAt} IS NULL`),
  uniqueIndex('uq_homologacoes_regra_aberta').on(t.regraId).where(
    sql`${t.deletedAt} IS NULL AND ${t.situacao} IN ('EM_REVISAO','APROVADA','PUBLICADA')`,
  ),
  index('idx_homologacoes_regra').on(t.regraId),
  index('idx_homologacoes_situacao').on(t.situacao),
  index('idx_homologacoes_criado_por').on(t.criadoPorId),
  index('idx_homologacoes_atualizado_por').on(t.atualizadoPorId),
  index('idx_homologacoes_aprovado_por').on(t.aprovadoPorId),
  index('idx_homologacoes_rejeitado_por').on(t.rejeitadoPorId),
  index('idx_homologacoes_publicado_por').on(t.publicadoPorId),
]);

export const cenariosRegressao = pgTable('cenarios_regressao', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  homologacaoId: uuid('homologacao_id').notNull().references(() => homologacoesRegras.id),
  simulacaoId: uuid('simulacao_id').notNull().references(() => simulacoesFiscais.id),
  ...auditCols,
}, (t) => [
  check('cenarios_versao_positiva_check', sql`${t.versao} >= 1`),
  uniqueIndex('uq_cenarios_homologacao_simulacao').on(t.homologacaoId, t.simulacaoId).where(sql`${t.deletedAt} IS NULL`),
  index('idx_cenarios_homologacao').on(t.homologacaoId),
  index('idx_cenarios_simulacao').on(t.simulacaoId),
  index('idx_cenarios_criado_por').on(t.criadoPorId),
  index('idx_cenarios_atualizado_por').on(t.atualizadoPorId),
]);
