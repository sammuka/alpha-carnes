import { sql } from 'drizzle-orm';
import {
  boolean, check, foreignKey, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid, varchar,
} from 'drizzle-orm/pg-core';
import { usuarios } from './auth.schema';
import { clientes } from './clientes.schema';
import { enquadramentosFiscais, ncms } from './fiscal-enquadramentos.schema';
import { estabelecimentos } from './fiscal-empresas.schema';
import { regrasTributarias } from './fiscal-regras.schema';
import { operacoes } from './operacoes.schema';
import { produtos } from './produtos.schema';

const auditCols = {
  versao: integer('versao').notNull().default(1),
  criadoPorId: uuid('criado_por_id').notNull().references(() => usuarios.id),
  atualizadoPorId: uuid('atualizado_por_id').notNull().references(() => usuarios.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};

export const simulacoesFiscais = pgTable('simulacoes_fiscais', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  codigo: varchar('codigo', { length: 20 }).notNull(),
  numeroVersao: integer('numero_versao').notNull(),
  estabelecimentoId: uuid('estabelecimento_id').notNull().references(() => estabelecimentos.id),
  operacaoId: uuid('operacao_id').notNull().references(() => operacoes.id),
  clienteId: uuid('cliente_id').notNull().references(() => clientes.id),
  produtoId: uuid('produto_id').notNull().references(() => produtos.id),
  ncmId: uuid('ncm_id').notNull().references(() => ncms.id),
  quantidade: numeric('quantidade', { precision: 15, scale: 3 }).notNull(),
  pesoNf: numeric('peso_nf', { precision: 10, scale: 3 }).notNull(),
  valor: numeric('valor', { precision: 15, scale: 2 }).notNull(),
  desconto: numeric('desconto', { precision: 15, scale: 2 }).notNull(),
  competencia: varchar('competencia', { length: 7 }).notNull(),
  enquadramentoId: uuid('enquadramento_id').notNull().references(() => enquadramentosFiscais.id),
  regraId: uuid('regra_id').notNull().references(() => regrasTributarias.id),
  valorLiquido: numeric('valor_liquido', { precision: 15, scale: 2 }).notNull(),
  baseTributavel: numeric('base_tributavel', { precision: 15, scale: 2 }).notNull(),
  icms: numeric('icms', { precision: 15, scale: 2 }).notNull(),
  baseDifereBruto: boolean('base_difere_bruto').notNull(),
  origemVersaoId: uuid('origem_versao_id'),
  situacao: text('situacao').notNull().default('CALCULADA'),
  justificativa: text('justificativa').notNull(),
  ...auditCols,
}, (t) => [
  foreignKey({
    columns: [t.origemVersaoId],
    foreignColumns: [t.id],
    name: 'simulacoes_fiscais_origem_fk',
  }),
  check('simulacoes_codigo_formato_check', sql`${t.codigo} ~ '^[1-9][0-9]{0,17}$'`),
  check('simulacoes_numero_versao_check', sql`${t.numeroVersao} >= 1`),
  check('simulacoes_quantidade_positiva_check', sql`${t.quantidade} > 0`),
  check('simulacoes_peso_positivo_check', sql`${t.pesoNf} > 0`),
  check('simulacoes_valor_positivo_check', sql`${t.valor} > 0`),
  check('simulacoes_desconto_nao_negativo_check', sql`${t.desconto} >= 0`),
  check('simulacoes_desconto_teto_check', sql`${t.desconto} <= ${t.valor}`),
  check('simulacoes_liquido_check', sql`${t.valorLiquido} = ${t.valor} - ${t.desconto}`),
  check('simulacoes_base_flag_check', sql`${t.baseDifereBruto} = (${t.baseTributavel} <> ${t.valor})`),
  check('simulacoes_competencia_check', sql`${t.competencia} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
  check('simulacoes_situacao_check', sql`${t.situacao} = 'CALCULADA'`),
  check('simulacoes_versao_positiva_check', sql`${t.versao} >= 1`),
  uniqueIndex('uq_simulacoes_codigo_versao').on(t.codigo, t.numeroVersao).where(sql`${t.deletedAt} IS NULL`),
  index('idx_simulacoes_estabelecimento').on(t.estabelecimentoId),
  index('idx_simulacoes_operacao').on(t.operacaoId),
  index('idx_simulacoes_cliente').on(t.clienteId),
  index('idx_simulacoes_produto').on(t.produtoId),
  index('idx_simulacoes_ncm').on(t.ncmId),
  index('idx_simulacoes_enquadramento').on(t.enquadramentoId),
  index('idx_simulacoes_regra').on(t.regraId),
  index('idx_simulacoes_origem').on(t.origemVersaoId),
  index('idx_simulacoes_competencia').on(t.competencia).where(sql`${t.deletedAt} IS NULL`),
  index('idx_simulacoes_criado_por').on(t.criadoPorId),
  index('idx_simulacoes_atualizado_por').on(t.atualizadoPorId),
]);
