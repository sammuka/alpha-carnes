import { sql } from 'drizzle-orm';
import {
  boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';
import { usuarios } from './auth.schema';
import { operacoes } from './operacoes.schema';

export const relatoriosSif = pgTable(
  'relatorios_sif',
  {
    id:                uuid('id').primaryKey().default(sql`uuidv7()`),
    operacaoId:        uuid('operacao_id').notNull().references(() => operacoes.id),
    tipo:              text('tipo').notNull(),
    codigo:            text('codigo').notNull(),
    nome:              text('nome').notNull(),
    status:            text('status').notNull().default('pendente_dados'),
    perfilResponsavel: text('perfil_responsavel').notNull(),
    pendenciasJson:    jsonb('pendencias_json').notNull().default(sql`'[]'::jsonb`),
    versaoAtual:       integer('versao_atual').notNull().default(0),
    provisorio:        boolean('provisorio').notNull().default(true),
    createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:         timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check(
      'chk_relatorios_sif_tipo',
      sql`${t.tipo} IN ('mapa_recebimento','producao_desossa','controle_expedicao','perdas_destinacao')`,
    ),
    check(
      'chk_relatorios_sif_status',
      sql`${t.status} IN ('pendente_dados','pronto_para_gerar','gerado','retificado')`,
    ),
    check('chk_relatorios_sif_versao', sql`${t.versaoAtual} >= 0`),
    uniqueIndex('uq_relatorios_sif_operacao_tipo')
      .on(t.operacaoId, t.tipo)
      .where(sql`${t.deletedAt} IS NULL`),
    index('idx_relatorios_sif_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
    index('idx_relatorios_sif_pendencias_gin').using('gin', t.pendenciasJson),
  ],
);

export const relatoriosSifVersoes = pgTable(
  'relatorios_sif_versoes',
  {
    id:                 uuid('id').primaryKey().default(sql`uuidv7()`),
    relatorioId:        uuid('relatorio_id').notNull().references(() => relatoriosSif.id),
    versao:             integer('versao').notNull(),
    tipoGeracao:        text('tipo_geracao').notNull(),
    motivoRetificacao:  text('motivo_retificacao'),
    conteudoJson:       jsonb('conteudo_json').notNull(),
    geradoPorId:        uuid('gerado_por_id').notNull().references(() => usuarios.id),
    geradoEm:           timestamp('gerado_em', { withTimezone: true }).notNull().defaultNow(),
    createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_sif_versao_tipo', sql`${t.tipoGeracao} IN ('gerado','retificado')`),
    check('chk_sif_versao_positiva', sql`${t.versao} >= 1`),
    check(
      'chk_sif_versao_motivo',
      sql`(${t.tipoGeracao} = 'gerado' AND ${t.motivoRetificacao} IS NULL)
          OR (${t.tipoGeracao} = 'retificado' AND ${t.motivoRetificacao} IS NOT NULL
              AND length(btrim(${t.motivoRetificacao})) >= 10)`,
    ),
    uniqueIndex('uq_sif_versao').on(t.relatorioId, t.versao),
    index('idx_sif_versao_relatorio').on(t.relatorioId, t.versao),
  ],
);
