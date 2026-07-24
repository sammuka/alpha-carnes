import { relations, sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { comprasProgramadas } from './compras-programadas.schema';
import { fornecedores } from './fornecedores.schema';
import { divergenciasRecebimento } from './recebimentos.schema';
import { conclusoesConferencia } from './conclusoes-conferencia.schema';
import { notasFiscaisFornecedor } from './notas-fiscais-fornecedor.schema';
import { usuarios } from './auth.schema';

// ── ocorrencias_fornecedor ──────────────────────────────────────────────────
// Tratativa formal de uma divergência com o fornecedor. Encerrar exige desfecho.
export const ocorrenciasFornecedor = pgTable(
  'ocorrencias_fornecedor',
  {
    id:                   uuid('id').primaryKey().default(sql`uuidv7()`),
    fornecedorId:         uuid('fornecedor_id').notNull().references(() => fornecedores.id),
    compraProgramadaId:   uuid('compra_programada_id').references(() => comprasProgramadas.id),
    divergenciaId:        uuid('divergencia_id').references(() => divergenciasRecebimento.id),
    conclusaoConferenciaId: uuid('conclusao_conferencia_id').references(() => conclusoesConferencia.id),
    nfFornecedorId:       uuid('nf_fornecedor_id').references(() => notasFiscaisFornecedor.id),
    status:               text('status').notNull().default('aberta'),
    descricao:            text('descricao').notNull(),
    impacto:              text('impacto'),
    dataHoraAbertura:     timestamp('data_hora_abertura', { withTimezone: true }).notNull().defaultNow(),
    dataHoraEncerramento: timestamp('data_hora_encerramento', { withTimezone: true }),
    desfecho:             text('desfecho'),
    usuarioAberturaId:    uuid('usuario_abertura_id').notNull().references(() => usuarios.id),
    createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'chk_ocorr_forn_status',
      sql`${t.status} IN ('aberta','em_analise','aguardando_fornecedor','resolvida')`,
    ),
    index('idx_ocorr_forn_fornecedor').on(t.fornecedorId),
    index('idx_ocorr_forn_divergencia').on(t.divergenciaId),
    index('idx_ocorr_forn_status').on(t.status),
  ],
);

// ── ocorrencias_fornecedor_historico ────────────────────────────────────────
// Timeline auditável da tratativa: cada ação registra usuário, retorno, próximo
// passo e situação.
export const ocorrenciasFornecedorHistorico = pgTable(
  'ocorrencias_fornecedor_historico',
  {
    id:                uuid('id').primaryKey().default(sql`uuidv7()`),
    ocorrenciaId:      uuid('ocorrencia_id').notNull().references(() => ocorrenciasFornecedor.id),
    usuarioId:         uuid('usuario_id').notNull().references(() => usuarios.id),
    acao:              text('acao').notNull(),
    retornoFornecedor: text('retorno_fornecedor'),
    proximoPasso:      text('proximo_passo'),
    situacao:          text('situacao'),
    createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_ocorr_forn_hist_ocorrencia').on(t.ocorrenciaId),
  ],
);

export const ocorrenciasFornecedorRelations = relations(ocorrenciasFornecedor, ({ one, many }) => ({
  fornecedor: one(fornecedores, {
    fields: [ocorrenciasFornecedor.fornecedorId],
    references: [fornecedores.id],
  }),
  divergencia: one(divergenciasRecebimento, {
    fields: [ocorrenciasFornecedor.divergenciaId],
    references: [divergenciasRecebimento.id],
  }),
  historico: many(ocorrenciasFornecedorHistorico),
}));

export const ocorrenciasFornecedorHistoricoRelations = relations(ocorrenciasFornecedorHistorico, ({ one }) => ({
  ocorrencia: one(ocorrenciasFornecedor, {
    fields: [ocorrenciasFornecedorHistorico.ocorrenciaId],
    references: [ocorrenciasFornecedor.id],
  }),
}));
