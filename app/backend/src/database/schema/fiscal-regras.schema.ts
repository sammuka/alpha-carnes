import { sql } from 'drizzle-orm';
import {
  check, date, foreignKey, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid, varchar,
} from 'drizzle-orm/pg-core';
import { usuarios } from './auth.schema';
import { enquadramentosFiscais } from './fiscal-enquadramentos.schema';

export const ICMS_CST = ['00', '20', '40', '41', '51'] as const;
export const IPI_CST = ['51', '53', '99'] as const;
export const PIS_CST = ['01', '06', '08', '99'] as const;
export const IBS_CST = ['000', '200'] as const;
export const SITUACOES_REGRA = ['RASCUNHO', 'SUBMETIDA', 'APROVADA', 'APOSENTADA'] as const;

export const ROTULOS_ICMS_CST: Record<(typeof ICMS_CST)[number], string> = {
  '00': 'Tributação integral',
  '20': 'Redução de base',
  '40': 'Isenção',
  '41': 'Não tributada',
  '51': 'Diferimento',
};
export const ROTULOS_IPI_CST: Record<(typeof IPI_CST)[number], string> = {
  '51': 'Saída tributada à alíquota zero',
  '53': 'Saída não tributada',
  '99': 'Outras saídas',
};
export const ROTULOS_PIS_CST: Record<(typeof PIS_CST)[number], string> = {
  '01': 'Tributação normal',
  '06': 'Alíquota zero',
  '08': 'Sem incidência',
  '99': 'Outras operações',
};
export const ROTULOS_IBS_CST: Record<(typeof IBS_CST)[number], string> = {
  '000': 'Tributação integral',
  '200': 'Alíquota reduzida',
};
export const ROTULOS_SITUACAO_REGRA: Record<(typeof SITUACOES_REGRA)[number], string> = {
  RASCUNHO: 'Rascunho',
  SUBMETIDA: 'Submetida',
  APROVADA: 'Aprovada',
  APOSENTADA: 'Aposentada',
};

const auditCols = {
  versao: integer('versao').notNull().default(1),
  criadoPorId: uuid('criado_por_id').notNull().references(() => usuarios.id),
  atualizadoPorId: uuid('atualizado_por_id').notNull().references(() => usuarios.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};

export const beneficiosFiscais = pgTable('beneficios_fiscais', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  codigo: varchar('codigo', { length: 8 }).notNull(),
  descricao: varchar('descricao', { length: 255 }).notNull(),
  ...auditCols,
}, (t) => [
  check('beneficios_codigo_formato_check', sql`${t.codigo} ~ '^[A-Z]{2}[0-9]{6}$'`),
  check('beneficios_descricao_preenchida_check', sql`btrim(${t.descricao}) <> ''`),
  check('beneficios_versao_positiva_check', sql`${t.versao} >= 1`),
  uniqueIndex('uq_beneficios_codigo').on(t.codigo).where(sql`${t.deletedAt} IS NULL`),
  index('idx_beneficios_criado_por').on(t.criadoPorId),
  index('idx_beneficios_atualizado_por').on(t.atualizadoPorId),
]);

export const classificacoesIbsCbs = pgTable('classificacoes_ibs_cbs', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  codigo: varchar('codigo', { length: 6 }).notNull(),
  descricao: varchar('descricao', { length: 255 }).notNull(),
  ...auditCols,
}, (t) => [
  check('classificacoes_codigo_formato_check', sql`${t.codigo} ~ '^[0-9]{6}$'`),
  check('classificacoes_descricao_preenchida_check', sql`btrim(${t.descricao}) <> ''`),
  check('classificacoes_versao_positiva_check', sql`${t.versao} >= 1`),
  uniqueIndex('uq_classificacoes_codigo').on(t.codigo).where(sql`${t.deletedAt} IS NULL`),
  index('idx_classificacoes_criado_por').on(t.criadoPorId),
  index('idx_classificacoes_atualizado_por').on(t.atualizadoPorId),
]);

export const regrasTributarias = pgTable('regras_tributarias', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  codigo: varchar('codigo', { length: 20 }).notNull(),
  numeroVersao: integer('numero_versao').notNull(),
  enquadramentoId: uuid('enquadramento_id').notNull().references(() => enquadramentosFiscais.id),
  icmsCst: varchar('icms_cst', { length: 2 }).notNull(),
  pRedBc: numeric('p_red_bc', { precision: 5, scale: 4 }).notNull(),
  pIcms: numeric('p_icms', { precision: 5, scale: 4 }).notNull(),
  beneficioFiscalId: uuid('beneficio_fiscal_id').notNull().references(() => beneficiosFiscais.id),
  ipiCst: varchar('ipi_cst', { length: 2 }).notNull(),
  pisCst: varchar('pis_cst', { length: 2 }).notNull(),
  ibsCst: varchar('ibs_cst', { length: 3 }).notNull(),
  classificacaoIbsCbsId: uuid('classificacao_ibs_cbs_id').notNull().references(() => classificacoesIbsCbs.id),
  vigenciaInicio: date('vigencia_inicio', { mode: 'string' }).notNull(),
  vigenciaFim: date('vigencia_fim', { mode: 'string' }),
  situacao: text('situacao').notNull().default('RASCUNHO'),
  origemVersaoId: uuid('origem_versao_id'),
  justificativa: text('justificativa').notNull(),
  submetidoPorId: uuid('submetido_por_id').references(() => usuarios.id),
  submetidoEm: timestamp('submetido_em', { withTimezone: true }),
  aprovadoPorId: uuid('aprovado_por_id').references(() => usuarios.id),
  aprovadoEm: timestamp('aprovado_em', { withTimezone: true }),
  aposentadoPorId: uuid('aposentado_por_id').references(() => usuarios.id),
  aposentadoEm: timestamp('aposentado_em', { withTimezone: true }),
  ...auditCols,
}, (t) => [
  foreignKey({
    columns: [t.origemVersaoId],
    foreignColumns: [t.id],
    name: 'regras_tributarias_origem_fk',
  }),
  check('regras_codigo_formato_check', sql`${t.codigo} ~ '^[1-9][0-9]{0,17}$'`),
  check('regras_numero_versao_check', sql`${t.numeroVersao} >= 1`),
  check('regras_icms_cst_check', sql`${t.icmsCst} IN ('00','20','40','41','51')`),
  check('regras_ipi_cst_check', sql`${t.ipiCst} IN ('51','53','99')`),
  check('regras_pis_cst_check', sql`${t.pisCst} IN ('01','06','08','99')`),
  check('regras_ibs_cst_check', sql`${t.ibsCst} IN ('000','200')`),
  check('regras_p_red_bc_faixa_check', sql`${t.pRedBc} >= 0 AND ${t.pRedBc} <= 1`),
  check('regras_p_icms_faixa_check', sql`${t.pIcms} >= 0 AND ${t.pIcms} <= 1`),
  check('regras_vigencia_ordem_check', sql`${t.vigenciaFim} IS NULL OR ${t.vigenciaFim} >= ${t.vigenciaInicio}`),
  check('regras_situacao_check', sql`${t.situacao} IN ('RASCUNHO','SUBMETIDA','APROVADA','APOSENTADA')`),
  check('regras_versao_positiva_check', sql`${t.versao} >= 1`),
  check('regras_submetida_autor_check', sql`${t.situacao} = 'RASCUNHO' OR ${t.submetidoPorId} IS NOT NULL`),
  check('regras_aprovada_check', sql`${t.situacao} NOT IN ('APROVADA','APOSENTADA') OR (${t.aprovadoPorId} IS NOT NULL AND ${t.aprovadoEm} IS NOT NULL)`),
  check('regras_aposentada_check', sql`${t.situacao} <> 'APOSENTADA' OR (${t.aposentadoPorId} IS NOT NULL AND ${t.aposentadoEm} IS NOT NULL)`),
  check('regras_aprovador_diferente_check', sql`${t.aprovadoPorId} IS NULL OR ${t.aprovadoPorId} <> ${t.submetidoPorId}`),
  check('regras_aposentador_diferente_check', sql`${t.aposentadoPorId} IS NULL OR ${t.aposentadoPorId} <> ${t.submetidoPorId}`),
  uniqueIndex('uq_regras_codigo_versao').on(t.codigo, t.numeroVersao).where(sql`${t.deletedAt} IS NULL`),
  uniqueIndex('uq_regras_abertas_codigo').on(t.codigo).where(sql`${t.deletedAt} IS NULL AND ${t.situacao} IN ('RASCUNHO','SUBMETIDA')`),
  index('idx_regras_enquadramento').on(t.enquadramentoId),
  index('idx_regras_beneficio').on(t.beneficioFiscalId),
  index('idx_regras_classificacao').on(t.classificacaoIbsCbsId),
  index('idx_regras_origem').on(t.origemVersaoId),
  index('idx_regras_situacao').on(t.situacao).where(sql`${t.deletedAt} IS NULL`),
  index('idx_regras_criado_por').on(t.criadoPorId),
  index('idx_regras_atualizado_por').on(t.atualizadoPorId),
  index('idx_regras_submetido_por').on(t.submetidoPorId),
  index('idx_regras_aprovado_por').on(t.aprovadoPorId),
  index('idx_regras_aposentado_por').on(t.aposentadoPorId),
]);
