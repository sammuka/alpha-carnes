import { relations, sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { comprasProgramadas } from './compras-programadas.schema';
import { recebimentos } from './recebimentos.schema';
import { itensComerciais } from './itens-comerciais.schema';
import { pedidosVenda, pedidosVendaItens } from './pedidos.schema';
import { usuarios } from './auth.schema';

// ── pecas ─────────────────────────────────────────────────────────────────────
// Unidade física rastreada (doc 010 §3.15). Nasce na pesagem com procedência de
// captura explícita (ADR-009). Pode ser associada (por unidade) a um pedido,
// redirecionada enquanto a expedição está aberta, ou destinada a sobra/análise/corte.
// caminhao_id é nullable e sem regra de carga aqui (F5).
export const pecas = pgTable(
  'pecas',
  {
    id:                     uuid('id').primaryKey().default(sql`uuidv7()`),
    compraProgramadaId:     uuid('compra_programada_id').notNull().references(() => comprasProgramadas.id),
    recebimentoId:          uuid('recebimento_id').notNull().references(() => recebimentos.id),
    itemComercialBaseId:    uuid('item_comercial_base_id').notNull().references(() => itensComerciais.id),
    classificacaoOperacional: text('classificacao_operacional'),
    pesoOriginal:           numeric('peso_original', { precision: 10, scale: 3 }).notNull(),
    dataHoraPesagem:        timestamp('data_hora_pesagem', { withTimezone: true }).notNull().defaultNow(),
    modoCapturaPeso:        text('modo_captura_peso').notNull(),
    // Procedência da captura (ADR-009): { leitura_estavel, gateway_status, operador,
    // motivo?, leituras_apoio? } — imutável após a pesagem.
    capturaMeta:            jsonb('captura_meta').notNull().default(sql`'{}'::jsonb`),
    statusPeca:             text('status_peca').notNull().default('pesada'),
    etiquetaAtual:          text('etiqueta_atual'),
    pedidoVendaId:          uuid('pedido_venda_id').references(() => pedidosVenda.id),
    pedidoVendaItemId:      uuid('pedido_venda_item_id').references(() => pedidosVendaItens.id),
    caminhaoId:             uuid('caminhao_id'),
    observacoes:            text('observacoes'),
    createdAt:              timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:              timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:              timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_pecas_modo_captura', sql`${t.modoCapturaPeso} IN ('automatico','manual_assistido')`),
    check('chk_pecas_peso_positivo', sql`${t.pesoOriginal} > 0`),
    check(
      'chk_pecas_status',
      sql`${t.statusPeca} IN ('pesada','associada','em_sobra','em_analise','para_corte','divergente')`,
    ),
    index('idx_pecas_recebimento').on(t.recebimentoId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_pecas_compra').on(t.compraProgramadaId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_pecas_status').on(t.statusPeca).where(sql`${t.deletedAt} IS NULL`),
    index('idx_pecas_pedido_item').on(t.pedidoVendaItemId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_pecas_captura_meta_gin').using('gin', t.capturaMeta),
  ],
);

// ── associacoes_peca_historico ──────────────────────────────────────────────
// Append-only: registra cada DECISÃO de destinação (doc 010 §3.17). A sugestão é
// efêmera; aqui persiste-se o snapshot {score, justificativa sugeridos} vs o pedido
// escolhido. Toda transferência é auditável.
export const associacoesPecaHistorico = pgTable(
  'associacoes_peca_historico',
  {
    id:                        uuid('id').primaryKey().default(sql`uuidv7()`),
    pecaId:                    uuid('peca_id').notNull().references(() => pecas.id),
    pedidoOrigemId:            uuid('pedido_origem_id').references(() => pedidosVenda.id),
    pedidoDestinoId:           uuid('pedido_destino_id').references(() => pedidosVenda.id),
    pedidoItemDestinoId:       uuid('pedido_item_destino_id').references(() => pedidosVendaItens.id),
    acao:                      text('acao').notNull(),
    motivo:                    text('motivo'),
    scoreSugerido:             integer('score_sugerido'),
    justificativaSugerida:     text('justificativa_sugerida'),
    operadorId:                uuid('operador_id').notNull().references(() => usuarios.id),
    statusExpedicaoNoMomento:  text('status_expedicao_no_momento'),
    createdAt:                 timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'chk_assoc_hist_acao',
      sql`${t.acao} IN ('confirmar','redirecionar','sobra','analise','corte','divergencia')`,
    ),
    index('idx_assoc_hist_peca').on(t.pecaId),
    index('idx_assoc_hist_destino').on(t.pedidoDestinoId),
  ],
);

// ── etiquetas_impressoes ────────────────────────────────────────────────────
// Auditoria de impressão/reimpressão (RF-PS-23/24). A etiqueta lógica é o fato de
// negócio (pecas.etiqueta_atual); a impressão física é best-effort observável
// (REFINO 1): status_impressao reflete o resultado real do gateway de impressora.
export const etiquetasImpressoes = pgTable(
  'etiquetas_impressoes',
  {
    id:              uuid('id').primaryKey().default(sql`uuidv7()`),
    pecaId:          uuid('peca_id').notNull().references(() => pecas.id),
    payload:         jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    statusImpressao: text('status_impressao').notNull().default('pendente'),
    reimpressao:     boolean('reimpressao').notNull().default(false),
    operadorId:      uuid('operador_id').notNull().references(() => usuarios.id),
    createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_etiq_status_impressao', sql`${t.statusImpressao} IN ('impressa','falha_impressao','pendente')`),
    index('idx_etiq_peca').on(t.pecaId),
    index('idx_etiq_payload_gin').using('gin', t.payload),
  ],
);

export const pecasRelations = relations(pecas, ({ one, many }) => ({
  compra: one(comprasProgramadas, {
    fields: [pecas.compraProgramadaId],
    references: [comprasProgramadas.id],
  }),
  recebimento: one(recebimentos, {
    fields: [pecas.recebimentoId],
    references: [recebimentos.id],
  }),
  itemComercialBase: one(itensComerciais, {
    fields: [pecas.itemComercialBaseId],
    references: [itensComerciais.id],
  }),
  pedido: one(pedidosVenda, {
    fields: [pecas.pedidoVendaId],
    references: [pedidosVenda.id],
  }),
  pedidoItem: one(pedidosVendaItens, {
    fields: [pecas.pedidoVendaItemId],
    references: [pedidosVendaItens.id],
  }),
  historico: many(associacoesPecaHistorico),
  etiquetas: many(etiquetasImpressoes),
}));

export const associacoesPecaHistoricoRelations = relations(associacoesPecaHistorico, ({ one }) => ({
  peca: one(pecas, {
    fields: [associacoesPecaHistorico.pecaId],
    references: [pecas.id],
  }),
}));

export const etiquetasImpressoesRelations = relations(etiquetasImpressoes, ({ one }) => ({
  peca: one(pecas, {
    fields: [etiquetasImpressoes.pecaId],
    references: [pecas.id],
  }),
}));
