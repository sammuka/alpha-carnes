import { sql } from 'drizzle-orm';
import {
  check, date, foreignKey, index, integer, pgTable, text, timestamp, unique, uniqueIndex, uuid, varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { usuarios } from './auth.schema';

export const SITUACOES_ESTABELECIMENTO = ['DRAFT', 'REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;
export const SITUACOES_DECISAO = ['DRAFT', 'REVIEW', 'APPROVED', 'REJECTED'] as const; // regime e alteração
export const CODIGOS_CRT = ['1', '2', '3', '4'] as const;
export const TIPOS_CNAE = ['PRINCIPAL', 'SECUNDARIA'] as const;
const UFS_SQL = sql.raw(`'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'`);

const auditCols = {
  versao:          integer('versao').notNull().default(1),
  criadoPorId:     uuid('criado_por_id').notNull().references(() => usuarios.id),
  atualizadoPorId: uuid('atualizado_por_id').notNull().references(() => usuarios.id),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:       timestamp('deleted_at', { withTimezone: true }),
};
const decisaoCols = {
  submetidoPorId: uuid('submetido_por_id').references(() => usuarios.id),
  decididoPorId:  uuid('decidido_por_id').references(() => usuarios.id),
  decididoEm:     timestamp('decidido_em', { withTimezone: true }),
};

export const empresas = pgTable('empresas', {
  id:          uuid('id').primaryKey().default(sql`uuidv7()`),
  razaoSocial: varchar('razao_social', { length: 150 }).notNull(),
  cnpjRaiz:    varchar('cnpj_raiz', { length: 8 }).notNull(),                          // imutável
  ...auditCols,
}, (t) => [
  check('empresas_cnpj_raiz_formato_check', sql`${t.cnpjRaiz} ~ '^[0-9A-Z]{8}$'`),
  check('empresas_razao_social_preenchida_check', sql`btrim(${t.razaoSocial}) <> ''`),
  check('empresas_versao_positiva_check', sql`${t.versao} >= 1`),
  uniqueIndex('uq_empresas_cnpj_raiz').on(t.cnpjRaiz).where(sql`${t.deletedAt} IS NULL`),
  index('idx_empresas_criado_por').on(t.criadoPorId),
  index('idx_empresas_atualizado_por').on(t.atualizadoPorId),
]);

export const estabelecimentos = pgTable('estabelecimentos', {
  id:                    uuid('id').primaryKey().default(sql`uuidv7()`),
  empresaId:             uuid('empresa_id').notNull().references(() => empresas.id),  // imutável
  nome:                  varchar('nome', { length: 120 }).notNull(),
  cnpj:                  varchar('cnpj', { length: 14 }).notNull(),                    // imutável
  inscricaoEstadual:     varchar('inscricao_estadual', { length: 20 }).notNull(),
  inscricaoMunicipal:    varchar('inscricao_municipal', { length: 20 }).notNull(),
  uf:                    varchar('uf', { length: 2 }).notNull(),
  municipioIbgeCodigo:   varchar('municipio_ibge_codigo', { length: 7 }),  // reservado (AD-24 (2)); gravado a partir do E12-T08
  situacao:              text('situacao').notNull().default('DRAFT'),
  justificativaSituacao: text('justificativa_situacao'),
  ...decisaoCols,
  ...auditCols,
}, (t) => [
  unique('uq_estabelecimentos_id_empresa').on(t.id, t.empresaId),                    // D-E01 (não parcial)
  uniqueIndex('uq_estabelecimentos_cnpj').on(t.cnpj).where(sql`${t.deletedAt} IS NULL`),
  check('estabelecimentos_cnpj_formato_check', sql`${t.cnpj} ~ '^[0-9A-Z]{12}[0-9]{2}$'`),
  check('estabelecimentos_ie_formato_check', sql`${t.inscricaoEstadual} ~ '^[0-9A-Z]{1,20}$'`),
  check('estabelecimentos_im_formato_check', sql`${t.inscricaoMunicipal} ~ '^[0-9A-Z]{1,20}$'`),
  check('estabelecimentos_nome_preenchido_check', sql`btrim(${t.nome}) <> ''`),
  check('estabelecimentos_uf_valida_check', sql`${t.uf} IN (${UFS_SQL})`),
  check('estabelecimentos_municipio_formato_check',
    sql`${t.municipioIbgeCodigo} IS NULL OR ${t.municipioIbgeCodigo} ~ '^[0-9]{7}$'`),
  check('estabelecimentos_situacao_valida_check',
    sql`${t.situacao} IN ('DRAFT','REVIEW','APPROVED','REJECTED','SUSPENDED')`),
  check('estabelecimentos_review_submetido_check', sql`${t.situacao} <> 'REVIEW' OR ${t.submetidoPorId} IS NOT NULL`),
  check('estabelecimentos_aprovado_decidido_check',
    sql`${t.situacao} <> 'APPROVED' OR (${t.decididoPorId} IS NOT NULL AND ${t.decididoEm} IS NOT NULL)`),
  check('estabelecimentos_justificativa_situacao_check',
    sql`${t.situacao} NOT IN ('REJECTED','SUSPENDED') OR ${t.justificativaSituacao} IS NOT NULL`),
  index('idx_estabelecimentos_empresa').on(t.empresaId),
  index('idx_estabelecimentos_situacao').on(t.situacao).where(sql`${t.deletedAt} IS NULL`),
  index('idx_estabelecimentos_submetido_por').on(t.submetidoPorId),
  index('idx_estabelecimentos_decidido_por').on(t.decididoPorId),
  index('idx_estabelecimentos_criado_por').on(t.criadoPorId),
  index('idx_estabelecimentos_atualizado_por').on(t.atualizadoPorId),
]);

/** CNAEs vigentes (aprovados ou do rascunho) do estabelecimento — D20/D21. */
export const estabelecimentoCnaes = pgTable('estabelecimento_cnaes', {
  id:                uuid('id').primaryKey().default(sql`uuidv7()`),
  estabelecimentoId: uuid('estabelecimento_id').notNull(),
  empresaId:         uuid('empresa_id').notNull(),            // derivado do estabelecimento
  codigo:            varchar('codigo', { length: 7 }).notNull(),
  descricao:         varchar('descricao', { length: 255 }).notNull(),
  tipo:              text('tipo').notNull(),
  ...auditCols,
}, (t) => [
  foreignKey({ name: 'fk_estab_cnaes_estabelecimento_empresa',
    columns: [t.estabelecimentoId, t.empresaId],
    foreignColumns: [estabelecimentos.id, estabelecimentos.empresaId] }),
  check('estab_cnaes_codigo_formato_check', sql`${t.codigo} ~ '^[0-9]{7}$'`),
  check('estab_cnaes_tipo_valido_check', sql`${t.tipo} IN ('PRINCIPAL','SECUNDARIA')`),
  check('estab_cnaes_descricao_preenchida_check', sql`btrim(${t.descricao}) <> ''`),
  uniqueIndex('uq_estab_cnaes_principal').on(t.estabelecimentoId)
    .where(sql`${t.tipo} = 'PRINCIPAL' AND ${t.deletedAt} IS NULL`),
  uniqueIndex('uq_estab_cnaes_codigo').on(t.estabelecimentoId, t.codigo).where(sql`${t.deletedAt} IS NULL`),
  index('idx_estab_cnaes_estabelecimento').on(t.estabelecimentoId),
  index('idx_estab_cnaes_empresa').on(t.empresaId),
  index('idx_estab_cnaes_criado_por').on(t.criadoPorId),
  index('idx_estab_cnaes_atualizado_por').on(t.atualizadoPorId),
]);

/** Proposta de alteração de estabelecimento APPROVED (B3/D22): valores completos propostos. */
export const estabelecimentoAlteracoes = pgTable('estabelecimento_alteracoes', {
  id:                 uuid('id').primaryKey().default(sql`uuidv7()`),
  estabelecimentoId:  uuid('estabelecimento_id').notNull(),
  empresaId:          uuid('empresa_id').notNull(),
  nome:               varchar('nome', { length: 120 }).notNull(),
  inscricaoEstadual:  varchar('inscricao_estadual', { length: 20 }).notNull(),
  inscricaoMunicipal: varchar('inscricao_municipal', { length: 20 }).notNull(),
  uf:                 varchar('uf', { length: 2 }).notNull(),
  versaoBase:         integer('versao_base').notNull(),       // estabelecimentos.versao na criação
  situacao:           text('situacao').notNull().default('DRAFT'),
  justificativa:      text('justificativa').notNull(),
  motivoRejeicao:     text('motivo_rejeicao'),
  ...decisaoCols,
  ...auditCols,
}, (t) => [
  foreignKey({ name: 'fk_estab_alteracoes_estabelecimento_empresa',
    columns: [t.estabelecimentoId, t.empresaId],
    foreignColumns: [estabelecimentos.id, estabelecimentos.empresaId] }),
  check('estab_alteracoes_ie_formato_check', sql`${t.inscricaoEstadual} ~ '^[0-9A-Z]{1,20}$'`),
  check('estab_alteracoes_im_formato_check', sql`${t.inscricaoMunicipal} ~ '^[0-9A-Z]{1,20}$'`),
  check('estab_alteracoes_nome_preenchido_check', sql`btrim(${t.nome}) <> ''`),
  check('estab_alteracoes_uf_valida_check', sql`${t.uf} IN (${UFS_SQL})`),
  check('estab_alteracoes_situacao_valida_check', sql`${t.situacao} IN ('DRAFT','REVIEW','APPROVED','REJECTED')`),
  check('estab_alteracoes_justificativa_preenchida_check', sql`btrim(${t.justificativa}) <> ''`),
  check('estab_alteracoes_review_submetido_check', sql`${t.situacao} <> 'REVIEW' OR ${t.submetidoPorId} IS NOT NULL`),
  check('estab_alteracoes_decidido_check',
    sql`${t.situacao} NOT IN ('APPROVED','REJECTED') OR (${t.decididoPorId} IS NOT NULL AND ${t.decididoEm} IS NOT NULL)`),
  check('estab_alteracoes_rejeitada_motivo_check', sql`${t.situacao} <> 'REJECTED' OR ${t.motivoRejeicao} IS NOT NULL`),
  uniqueIndex('uq_estab_alteracoes_aberta').on(t.estabelecimentoId)
    .where(sql`${t.situacao} IN ('DRAFT','REVIEW') AND ${t.deletedAt} IS NULL`),
  index('idx_estab_alteracoes_estabelecimento').on(t.estabelecimentoId),
  index('idx_estab_alteracoes_empresa').on(t.empresaId),
  index('idx_estab_alteracoes_situacao').on(t.situacao).where(sql`${t.deletedAt} IS NULL`),
  index('idx_estab_alteracoes_submetido_por').on(t.submetidoPorId),
  index('idx_estab_alteracoes_decidido_por').on(t.decididoPorId),
  index('idx_estab_alteracoes_criado_por').on(t.criadoPorId),
  index('idx_estab_alteracoes_atualizado_por').on(t.atualizadoPorId),
]);

/** CNAEs propostos na alteração — mesmas regras de estabelecimento_cnaes, por alteração. */
export const estabelecimentoAlteracaoCnaes = pgTable('estabelecimento_alteracao_cnaes', {
  id:          uuid('id').primaryKey().default(sql`uuidv7()`),
  alteracaoId: uuid('alteracao_id').notNull().references(() => estabelecimentoAlteracoes.id),
  codigo:      varchar('codigo', { length: 7 }).notNull(),
  descricao:   varchar('descricao', { length: 255 }).notNull(),
  tipo:        text('tipo').notNull(),
  ...auditCols,
}, (t) => [
  check('estab_alt_cnaes_codigo_formato_check', sql`${t.codigo} ~ '^[0-9]{7}$'`),
  check('estab_alt_cnaes_tipo_valido_check', sql`${t.tipo} IN ('PRINCIPAL','SECUNDARIA')`),
  check('estab_alt_cnaes_descricao_preenchida_check', sql`btrim(${t.descricao}) <> ''`),
  uniqueIndex('uq_estab_alt_cnaes_principal').on(t.alteracaoId)
    .where(sql`${t.tipo} = 'PRINCIPAL' AND ${t.deletedAt} IS NULL`),
  uniqueIndex('uq_estab_alt_cnaes_codigo').on(t.alteracaoId, t.codigo).where(sql`${t.deletedAt} IS NULL`),
  index('idx_estab_alt_cnaes_alteracao').on(t.alteracaoId),
  index('idx_estab_alt_cnaes_criado_por').on(t.criadoPorId),
  index('idx_estab_alt_cnaes_atualizado_por').on(t.atualizadoPorId),
]);

export const regimesTributarios = pgTable('regimes_tributarios', {
  id:                uuid('id').primaryKey().default(sql`uuidv7()`),
  estabelecimentoId: uuid('estabelecimento_id').notNull(),
  empresaId:         uuid('empresa_id').notNull(),            // derivado do estabelecimento, nunca do cliente
  crt:               text('crt').notNull(),
  vigenciaInicio:    date('vigencia_inicio', { mode: 'string' }).notNull(),
  vigenciaFim:       date('vigencia_fim', { mode: 'string' }),
  situacao:          text('situacao').notNull().default('DRAFT'),
  justificativa:     text('justificativa').notNull(),
  motivoRejeicao:    text('motivo_rejeicao'),
  substituiRegimeId: uuid('substitui_regime_id'),
  ...decisaoCols,
  ...auditCols,
}, (t) => [
  foreignKey({ name: 'fk_regimes_estabelecimento_empresa',
    columns: [t.estabelecimentoId, t.empresaId],
    foreignColumns: [estabelecimentos.id, estabelecimentos.empresaId] }),
  unique('uq_regimes_id_estabelecimento').on(t.id, t.estabelecimentoId),
  foreignKey({ name: 'fk_regimes_substitui_mesmo_estabelecimento',
    columns: [t.substituiRegimeId, t.estabelecimentoId],
    foreignColumns: [(t.id as AnyPgColumn), (t.estabelecimentoId as AnyPgColumn)] }),
  check('regimes_crt_valido_check', sql`${t.crt} IN ('1','2','3','4')`),
  check('regimes_situacao_valida_check', sql`${t.situacao} IN ('DRAFT','REVIEW','APPROVED','REJECTED')`),
  check('regimes_vigencia_ordenada_check', sql`${t.vigenciaFim} IS NULL OR ${t.vigenciaFim} >= ${t.vigenciaInicio}`),
  check('regimes_justificativa_preenchida_check', sql`btrim(${t.justificativa}) <> ''`),
  check('regimes_review_submetido_check', sql`${t.situacao} <> 'REVIEW' OR ${t.submetidoPorId} IS NOT NULL`),
  check('regimes_aprovado_decidido_check',
    sql`${t.situacao} <> 'APPROVED' OR (${t.decididoPorId} IS NOT NULL AND ${t.decididoEm} IS NOT NULL)`),
  check('regimes_rejeitado_motivo_check', sql`${t.situacao} <> 'REJECTED' OR ${t.motivoRejeicao} IS NOT NULL`),
  index('idx_regimes_estabelecimento').on(t.estabelecimentoId),
  index('idx_regimes_empresa').on(t.empresaId),
  index('idx_regimes_estab_situacao').on(t.estabelecimentoId, t.situacao).where(sql`${t.deletedAt} IS NULL`),
  index('idx_regimes_substitui').on(t.substituiRegimeId),
  index('idx_regimes_submetido_por').on(t.submetidoPorId),
  index('idx_regimes_decidido_por').on(t.decididoPorId),
  index('idx_regimes_criado_por').on(t.criadoPorId),
  index('idx_regimes_atualizado_por').on(t.atualizadoPorId),
]);
