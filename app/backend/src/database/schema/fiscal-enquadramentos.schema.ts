import { sql } from 'drizzle-orm';
import {
  check, date, foreignKey, index, integer, pgTable, text, timestamp, uniqueIndex, uuid, varchar,
} from 'drizzle-orm/pg-core';
import { usuarios } from './auth.schema';
import { clientes } from './clientes.schema';
import { estabelecimentos } from './fiscal-empresas.schema';
import { operacoes } from './operacoes.schema';
import { produtos } from './produtos.schema';

export const TP_NF = ['0', '1'] as const;
export const FIN_NFE = ['1', '2', '3', '4'] as const;
export const ABRANGENCIAS_FISCAIS = ['INTERNA', 'INTER', 'EXT'] as const;
export const TIPOS_PRODUTO_FISCAL = ['PROPRIA', 'REVENDA', 'SUB'] as const;
export const SITUACOES_ENQUADRAMENTO = ['ATIVA', 'INATIVA'] as const;

const auditCols = {
  versao: integer('versao').notNull().default(1),
  criadoPorId: uuid('criado_por_id').notNull().references(() => usuarios.id),
  atualizadoPorId: uuid('atualizado_por_id').notNull().references(() => usuarios.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};

export const cfops = pgTable('cfops', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  codigo: varchar('codigo', { length: 4 }).notNull(),
  descricao: varchar('descricao', { length: 255 }).notNull(),
  ...auditCols,
}, (t) => [
  check('cfops_codigo_formato_check', sql`${t.codigo} ~ '^[0-9]{4}$'`),
  check('cfops_descricao_preenchida_check', sql`btrim(${t.descricao}) <> ''`),
  check('cfops_versao_positiva_check', sql`${t.versao} >= 1`),
  uniqueIndex('uq_cfops_codigo').on(t.codigo).where(sql`${t.deletedAt} IS NULL`),
  index('idx_cfops_criado_por').on(t.criadoPorId),
  index('idx_cfops_atualizado_por').on(t.atualizadoPorId),
]);

export const ncms = pgTable('ncms', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  codigo: varchar('codigo', { length: 8 }).notNull(),
  descricao: varchar('descricao', { length: 255 }).notNull(),
  ...auditCols,
}, (t) => [
  check('ncms_codigo_formato_check', sql`${t.codigo} ~ '^[0-9]{8}$'`),
  check('ncms_descricao_preenchida_check', sql`btrim(${t.descricao}) <> ''`),
  check('ncms_versao_positiva_check', sql`${t.versao} >= 1`),
  uniqueIndex('uq_ncms_codigo').on(t.codigo).where(sql`${t.deletedAt} IS NULL`),
  index('idx_ncms_criado_por').on(t.criadoPorId),
  index('idx_ncms_atualizado_por').on(t.atualizadoPorId),
]);

export const enquadramentosFiscais = pgTable('enquadramentos_fiscais', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  codigo: varchar('codigo', { length: 20 }).notNull(),
  empresaId: uuid('empresa_id').notNull(),
  estabelecimentoId: uuid('estabelecimento_id').notNull(),
  operacaoId: uuid('operacao_id').notNull().references(() => operacoes.id),
  tpNf: varchar('tp_nf', { length: 1 }).notNull(),
  finNfe: varchar('fin_nfe', { length: 1 }).notNull(),
  cfopId: uuid('cfop_id').notNull().references(() => cfops.id),
  abrangencia: text('abrangencia').notNull(),
  tipoProduto: text('tipo_produto').notNull(),
  produtoId: uuid('produto_id').notNull().references(() => produtos.id),
  ncmId: uuid('ncm_id').notNull().references(() => ncms.id),
  cest: varchar('cest', { length: 7 }).notNull(),
  clienteId: uuid('cliente_id').notNull().references(() => clientes.id),
  vigenciaInicio: date('vigencia_inicio', { mode: 'string' }).notNull(),
  vigenciaFim: date('vigencia_fim', { mode: 'string' }),
  prioridade: integer('prioridade').notNull(),
  situacao: text('situacao').notNull().default('ATIVA'),
  origemEnquadramentoId: uuid('origem_enquadramento_id'),
  justificativaSituacao: text('justificativa_situacao'),
  ...auditCols,
}, (t) => [
  foreignKey({
    columns: [t.estabelecimentoId, t.empresaId],
    foreignColumns: [estabelecimentos.id, estabelecimentos.empresaId],
    name: 'enquadramentos_fiscais_estabelecimento_empresa_fk',
  }),
  foreignKey({
    columns: [t.origemEnquadramentoId],
    foreignColumns: [t.id],
    name: 'enquadramentos_fiscais_origem_fk',
  }),
  check('enquadramentos_codigo_formato_check', sql`${t.codigo} ~ '^[1-9][0-9]{0,17}$'`),
  check('enquadramentos_tp_nf_check', sql`${t.tpNf} IN ('0','1')`),
  check('enquadramentos_fin_nfe_check', sql`${t.finNfe} IN ('1','2','3','4')`),
  check('enquadramentos_abrangencia_check', sql`${t.abrangencia} IN ('INTERNA','INTER','EXT')`),
  check('enquadramentos_tipo_produto_check', sql`${t.tipoProduto} IN ('PROPRIA','REVENDA','SUB')`),
  check('enquadramentos_cest_formato_check', sql`${t.cest} ~ '^[0-9]{7}$'`),
  check('enquadramentos_vigencia_ordem_check', sql`${t.vigenciaFim} IS NULL OR ${t.vigenciaFim} >= ${t.vigenciaInicio}`),
  check('enquadramentos_prioridade_check', sql`${t.prioridade} >= 1`),
  check('enquadramentos_situacao_check', sql`${t.situacao} IN ('ATIVA','INATIVA')`),
  check('enquadramentos_versao_positiva_check', sql`${t.versao} >= 1`),
  check('enquadramentos_inativa_justificativa_check', sql`${t.situacao} <> 'INATIVA' OR ${t.justificativaSituacao} IS NOT NULL`),
  uniqueIndex('uq_enquadramentos_codigo').on(t.codigo).where(sql`${t.deletedAt} IS NULL`),
  index('idx_enquadramentos_empresa').on(t.empresaId),
  index('idx_enquadramentos_estabelecimento').on(t.estabelecimentoId),
  index('idx_enquadramentos_operacao').on(t.operacaoId),
  index('idx_enquadramentos_cfop').on(t.cfopId),
  index('idx_enquadramentos_produto').on(t.produtoId),
  index('idx_enquadramentos_ncm').on(t.ncmId),
  index('idx_enquadramentos_cliente').on(t.clienteId),
  index('idx_enquadramentos_origem').on(t.origemEnquadramentoId),
  index('idx_enquadramentos_vigencia').on(t.estabelecimentoId, t.vigenciaInicio),
  index('idx_enquadramentos_criado_por').on(t.criadoPorId),
  index('idx_enquadramentos_atualizado_por').on(t.atualizadoPorId),
]);
