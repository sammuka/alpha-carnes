import { relations, sql } from 'drizzle-orm';
import { boolean, check, date, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, integer } from 'drizzle-orm/pg-core';
import { pecas } from './pesagem.schema';
import { subitens } from './transformacoes.schema';
import { pedidosVenda, pedidosVendaItens } from './pedidos.schema';
import { operacoes } from './operacoes.schema';
import { usuarios } from './auth.schema';

// ── caminhoes ─────────────────────────────────────────────────────────────────
// Representa um caminhão alocado para uma operação de expedição em uma data.
export const caminhoes = pgTable(
  'caminhoes',
  {
    id:                   uuid('id').primaryKey().default(sql`uuidv7()`),
    placa:                text('placa').notNull(),
    motorista:            text('motorista').notNull(),
    rota:                 text('rota'),
    itinerario:           text('itinerario'),
    operacaoId:           uuid('operacao_id').notNull().references(() => operacoes.id),
    statusCaminhao:       text('status_caminhao').notNull().default('planejado'),
    horaAberturaCarga:    timestamp('hora_abertura_carga', { withTimezone: true }),
    horaFechamentoCarga:  timestamp('hora_fechamento_carga', { withTimezone: true }),
    horaLiberacao:        timestamp('hora_liberacao', { withTimezone: true }),
    observacoes:          text('observacoes'),
    createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:            timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check(
      'chk_caminhoes_status',
      sql`${t.statusCaminhao} IN ('planejado','aguardando_carga','em_carga','em_conferencia','fechado','liberado_faturamento','faturado','liberado_saida','expedido')`,
    ),
    index('idx_caminhoes_operacao').on(t.operacaoId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_caminhoes_status').on(t.statusCaminhao).where(sql`${t.deletedAt} IS NULL`),
  ],
);

// ── caminhoes_pedidos ─────────────────────────────────────────────────────────
// Liga pedidos de venda a um caminhão (N:N). Registra a ordem de carga e status
// do pedido dentro da carga.
export const caminhoesPedidos = pgTable(
  'caminhoes_pedidos',
  {
    id:              uuid('id').primaryKey().default(sql`uuidv7()`),
    caminhaoId:      uuid('caminhao_id').notNull().references(() => caminhoes.id),
    pedidoVendaId:   uuid('pedido_venda_id').notNull().references(() => pedidosVenda.id),
    ordemNaCarga:    integer('ordem_na_carga'),
    statusNaCarga:   text('status_na_carga').notNull().default('planejado'),
    observacoes:     text('observacoes'),
    createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:       timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check(
      'chk_caminhoes_pedidos_status',
      sql`${t.statusNaCarga} IN ('planejado','em_carga','completo','parcial')`,
    ),
    uniqueIndex('uq_caminhoes_pedidos_caminhao_pedido')
      .on(t.caminhaoId, t.pedidoVendaId)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);

// ── carga_itens ───────────────────────────────────────────────────────────────
// Rastreia cada peça ou subitem carregado no caminhão. XOR: exatamente um de
// peca_id / subitem_id deve ser não-nulo.
export const cargaItens = pgTable(
  'carga_itens',
  {
    id:                   uuid('id').primaryKey().default(sql`uuidv7()`),
    caminhaoId:           uuid('caminhao_id').notNull().references(() => caminhoes.id),
    tipoOrigem:           text('tipo_origem').notNull(),
    pecaId:               uuid('peca_id').references(() => pecas.id),
    subitemId:            uuid('subitem_id').references(() => subitens.id),
    pedidoVendaId:        uuid('pedido_venda_id').notNull().references(() => pedidosVenda.id),
    pedidoVendaItemId:    uuid('pedido_venda_item_id').notNull().references(() => pedidosVendaItens.id),
    dataHoraEntradaCarga: timestamp('data_hora_entrada_carga', { withTimezone: true }).notNull().defaultNow(),
    statusCargaItem:      text('status_carga_item').notNull().default('em_carga'),
    conferido:            boolean('conferido').notNull().default(false),
    observacoes:          text('observacoes'),
    createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:            timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check(
      'chk_carga_itens_tipo_origem_xor',
      sql`(${t.tipoOrigem} = 'peca'    AND ${t.pecaId}    IS NOT NULL AND ${t.subitemId} IS NULL) OR
          (${t.tipoOrigem} = 'subitem' AND ${t.subitemId} IS NOT NULL AND ${t.pecaId}    IS NULL)`,
    ),
    check(
      'chk_carga_itens_status',
      sql`${t.statusCargaItem} IN ('em_carga','conferido','removido')`,
    ),
    uniqueIndex('uq_carga_itens_peca')
      .on(t.pecaId)
      .where(sql`${t.pecaId} IS NOT NULL AND ${t.statusCargaItem} <> 'removido' AND ${t.deletedAt} IS NULL`),
    uniqueIndex('uq_carga_itens_subitem')
      .on(t.subitemId)
      .where(sql`${t.subitemId} IS NOT NULL AND ${t.statusCargaItem} <> 'removido' AND ${t.deletedAt} IS NULL`),
    index('idx_carga_itens_caminhao').on(t.caminhaoId).where(sql`${t.deletedAt} IS NULL`),
  ],
);

// ── conferencias_carga ────────────────────────────────────────────────────────
// Registro da conferência realizada antes do fechamento do caminhão.
export const conferenciasCarga = pgTable(
  'conferencias_carga',
  {
    id:                      uuid('id').primaryKey().default(sql`uuidv7()`),
    caminhaoId:              uuid('caminhao_id').notNull().references(() => caminhoes.id),
    operadorResponsavelId:   uuid('operador_responsavel_id').notNull().references(() => usuarios.id),
    dataHoraInicio:          timestamp('data_hora_inicio', { withTimezone: true }).notNull().defaultNow(),
    dataHoraFim:             timestamp('data_hora_fim', { withTimezone: true }),
    statusConferencia:       text('status_conferencia').notNull().default('aberta'),
    pendencias:              jsonb('pendencias').notNull().default(sql`'{}'::jsonb`),
    observacoes:             text('observacoes'),
    createdAt:               timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:               timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:               timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check(
      'chk_conferencias_status',
      sql`${t.statusConferencia} IN ('aberta','concluida')`,
    ),
    uniqueIndex('uq_conferencias_carga_caminhao_ativa')
      .on(t.caminhaoId)
      .where(sql`${t.statusConferencia} = 'aberta' AND ${t.deletedAt} IS NULL`),
    index('idx_conferencias_caminhao').on(t.caminhaoId).where(sql`${t.deletedAt} IS NULL`),
  ],
);

// ── Relations ─────────────────────────────────────────────────────────────────

export const caminhoesRelations = relations(caminhoes, ({ many }) => ({
  pedidos: many(caminhoesPedidos),
  cargaItens: many(cargaItens),
  conferencias: many(conferenciasCarga),
}));

export const caminhoesPedidosRelations = relations(caminhoesPedidos, ({ one }) => ({
  caminhao: one(caminhoes, {
    fields: [caminhoesPedidos.caminhaoId],
    references: [caminhoes.id],
  }),
  pedidoVenda: one(pedidosVenda, {
    fields: [caminhoesPedidos.pedidoVendaId],
    references: [pedidosVenda.id],
  }),
}));

export const cargaItensRelations = relations(cargaItens, ({ one }) => ({
  caminhao: one(caminhoes, {
    fields: [cargaItens.caminhaoId],
    references: [caminhoes.id],
  }),
  peca: one(pecas, {
    fields: [cargaItens.pecaId],
    references: [pecas.id],
  }),
  subitem: one(subitens, {
    fields: [cargaItens.subitemId],
    references: [subitens.id],
  }),
  pedidoVenda: one(pedidosVenda, {
    fields: [cargaItens.pedidoVendaId],
    references: [pedidosVenda.id],
  }),
  pedidoVendaItem: one(pedidosVendaItens, {
    fields: [cargaItens.pedidoVendaItemId],
    references: [pedidosVendaItens.id],
  }),
}));

export const conferenciasCargaRelations = relations(conferenciasCarga, ({ one }) => ({
  caminhao: one(caminhoes, {
    fields: [conferenciasCarga.caminhaoId],
    references: [caminhoes.id],
  }),
  operadorResponsavel: one(usuarios, {
    fields: [conferenciasCarga.operadorResponsavelId],
    references: [usuarios.id],
  }),
}));
