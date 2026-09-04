import { relations, sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { comprasProgramadas } from './compras-programadas.schema';
import { recebimentos } from './recebimentos.schema';
import { itensComerciais } from './itens-comerciais.schema';
import { produtos } from './produtos.schema';
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
    produtoBaseId:          uuid('produto_base_id').references(() => produtos.id),
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
      sql`${t.statusPeca} IN ('pesada','associada','em_sobra','em_analise','para_corte','divergente','em_transformacao','transformada')`,
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
    pecaId:                    uuid('peca_id').references(() => pecas.id),
    subitemId:                 uuid('subitem_id'),
    pedidoOrigemId:            uuid('pedido_origem_id').references(() => pedidosVenda.id),
    pedidoDestinoId:           uuid('pedido_destino_id').references(() => pedidosVenda.id),
    pedidoItemDestinoId:       uuid('pedido_item_destino_id').references(() => pedidosVendaItens.id),
    compraProgramadaOrigemId: uuid('compra_programada_origem_id').notNull().references(() => comprasProgramadas.id),
    recebimentoOrigemId:      uuid('recebimento_origem_id').notNull().references(() => recebimentos.id),
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
      sql`${t.acao} IN ('confirmar','redirecionar','sobra','analise','corte','divergencia','estorno','troca_saida','troca_entrada','destinar_estoque')`,
    ),
    check(
      'chk_assoc_hist_um_alvo',
      sql`(${t.pecaId} IS NOT NULL)::int + (${t.subitemId} IS NOT NULL)::int = 1`,
    ),
    index('idx_assoc_hist_peca').on(t.pecaId),
    index('idx_assoc_hist_destino').on(t.pedidoDestinoId),
    index('idx_assoc_hist_subitem').on(t.subitemId).where(sql`${t.subitemId} IS NOT NULL`),
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
    pecaId:          uuid('peca_id').references(() => pecas.id),
    subitemId:       uuid('subitem_id'),
    payload:         jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    statusImpressao: text('status_impressao').notNull().default('pendente'),
    reimpressao:     boolean('reimpressao').notNull().default(false),
    operadorId:      uuid('operador_id').notNull().references(() => usuarios.id),
    // ── Onda 6 — ciclo de estado da etiqueta (v1.1 §10.4) ──────────────────────
    estado:             text('estado').notNull().default('emitida'),
    motivoCancelamento: text('motivo_cancelamento'),
    invalidadaEm:       timestamp('invalidada_em', { withTimezone: true }),
    invalidadaPorId:    uuid('invalidada_por_id').references(() => usuarios.id),
    createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_etiq_status_impressao', sql`${t.statusImpressao} IN ('impressa','falha_impressao','pendente')`),
    // v1.1 §10.4 — os cinco estados do domínio. Os rótulos do protótipo são derivados na tela (D6.2).
    check(
      'chk_etiq_estado',
      sql`${t.estado} IN ('emitida','ativa','invalidada_por_troca','reimpressa','cancelada')`,
    ),
    // RA-06: estado terminal de cancelamento nunca fica sem motivo registrado.
    check(
      'chk_etiq_cancelada_motivo',
      sql`${t.estado} <> 'cancelada' OR ${t.motivoCancelamento} IS NOT NULL`,
    ),
    check(
      'chk_etiq_um_alvo',
      sql`(${t.pecaId} IS NOT NULL)::int + (${t.subitemId} IS NOT NULL)::int = 1`,
    ),
    index('idx_etiq_peca').on(t.pecaId),
    index('idx_etiq_subitem').on(t.subitemId),
    index('idx_etiq_estado').on(t.estado),
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
  // Nota: a relação `subitem` (→ subitens em transformacoes.schema.ts) não pode ser declarada aqui
  // pois causaria ciclo de import: pesagem → transformacoes → pesagem (transformacoes importa `pecas`
  // de pesagem.schema). Joins com subitens devem ser feitos via joins explícitos no service.
}));

export const etiquetasImpressoesRelations = relations(etiquetasImpressoes, ({ one }) => ({
  peca: one(pecas, {
    fields: [etiquetasImpressoes.pecaId],
    references: [pecas.id],
  }),
}));

// ── trocas_peca ───────────────────────────────────────────────────────────────
// Registro atômico da Troca de Peça (v1.1 §6.13). Uma linha por troca executada;
// os pesos das duas peças são copiados aqui como snapshot — peso_original das peças
// NUNCA é alterado pela troca ("Regra confirmada" de §6.13).
export const trocasPeca = pgTable(
  'trocas_peca',
  {
    id:                   uuid('id').primaryKey().default(sql`uuidv7()`),
    recebimentoId:        uuid('recebimento_id').notNull().references(() => recebimentos.id),
    pedidoVendaId:        uuid('pedido_venda_id').notNull().references(() => pedidosVenda.id),
    pedidoVendaItemId:    uuid('pedido_venda_item_id').notNull().references(() => pedidosVendaItens.id),
    pecaRetiradaId:       uuid('peca_retirada_id').notNull().references(() => pecas.id),
    pecaInseridaId:       uuid('peca_inserida_id').notNull().references(() => pecas.id),
    pesoRetirada:         numeric('peso_retirada', { precision: 10, scale: 3 }).notNull(),
    pesoInserida:         numeric('peso_inserida', { precision: 10, scale: 3 }).notNull(),
    destinoRetirada:      text('destino_retirada').notNull(),
    motivo:               text('motivo').notNull(),
    observacoes:          text('observacoes'),
    etiquetaInvalidadaId: uuid('etiqueta_invalidada_id').references(() => etiquetasImpressoes.id),
    etiquetaEmitidaId:    uuid('etiqueta_emitida_id').references(() => etiquetasImpressoes.id),
    operadorId:           uuid('operador_id').notNull().references(() => usuarios.id),
    createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Destinos da peça retirada — TrocaPeca.tsx:11 (`type DestinoRetirada = "Estoque" | "Desossa"`).
    check('chk_trocas_peca_destino', sql`${t.destinoRetirada} IN ('estoque','desossa')`),
    // Motivos — TrocaPeca.tsx:79-86 (const MOTIVOS), em slug.
    check(
      'chk_trocas_peca_motivo',
      sql`${t.motivo} IN ('peca_mais_adequada','peso_fora_preferencia','qualidade','erro_associacao','outro')`,
    ),
    check('chk_trocas_peca_pecas_distintas', sql`${t.pecaRetiradaId} <> ${t.pecaInseridaId}`),
    check('chk_trocas_peca_pesos_positivos', sql`${t.pesoRetirada} > 0 AND ${t.pesoInserida} > 0`),
    index('idx_trocas_peca_recebimento').on(t.recebimentoId),
    index('idx_trocas_peca_pedido').on(t.pedidoVendaId),
    index('idx_trocas_peca_retirada').on(t.pecaRetiradaId),
    index('idx_trocas_peca_inserida').on(t.pecaInseridaId),
  ],
);

export const trocasPecaRelations = relations(trocasPeca, ({ one }) => ({
  recebimento:  one(recebimentos,  { fields: [trocasPeca.recebimentoId],     references: [recebimentos.id] }),
  pedido:       one(pedidosVenda,  { fields: [trocasPeca.pedidoVendaId],     references: [pedidosVenda.id] }),
  pedidoItem:   one(pedidosVendaItens, { fields: [trocasPeca.pedidoVendaItemId], references: [pedidosVendaItens.id] }),
  pecaRetirada: one(pecas,         { fields: [trocasPeca.pecaRetiradaId],    references: [pecas.id], relationName: 'trocaPecaRetirada' }),
  pecaInserida: one(pecas,         { fields: [trocasPeca.pecaInseridaId],    references: [pecas.id], relationName: 'trocaPecaInserida' }),
}));
