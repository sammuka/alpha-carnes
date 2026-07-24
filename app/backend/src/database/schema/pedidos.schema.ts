import { relations, sql } from 'drizzle-orm';
import { check, date, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { comprasProgramadas } from './compras-programadas.schema';
import { clientes } from './clientes.schema';
import { itensComerciais } from './itens-comerciais.schema';
import { disponibilidadesVirtuais } from './disponibilidades-virtuais.schema';
import { operacoes } from './operacoes.schema';
import { usuarios } from './auth.schema';

// ── pedidos_venda ───────────────────────────────────────────────────────────
// Pedido de venda do dia. Consome saldo virtual de uma única compra programada
// (RN-02). A reserva ocorre na criação.
export const pedidosVenda = pgTable(
  'pedidos_venda',
  {
    id:                  uuid('id').primaryKey().default(sql`uuidv7()`),
    compraProgramadaId:  uuid('compra_programada_id').notNull().references(() => comprasProgramadas.id),
    clienteId:           uuid('cliente_id').notNull().references(() => clientes.id),
    dataOperacao:        date('data_operacao').notNull(),
    operacaoId:          uuid('operacao_id').references(() => operacoes.id),
    dataEntrega:         date('data_entrega'),
    rotaPrevista:        text('rota_prevista'),
    prioridade:          integer('prioridade'),
    status:              text('status').notNull().default('reservado'),
    observacoesGerais:   text('observacoes_gerais'),
    motivoCancelamento:  text('motivo_cancelamento'),
    usuarioCriacaoId:    uuid('usuario_criacao_id').notNull().references(() => usuarios.id),
    usuarioAprovacaoId:  uuid('usuario_aprovacao_id').references(() => usuarios.id),
    createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:           timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    // CHECK legado durante expand (Tasks 1–6); superset transitório no SQL 0012; finais no 0014.
    check('chk_pedidos_venda_status', sql`${t.status} IN ('reservado','parcialmente_reservado','cancelado')`),
    index('idx_pedidos_venda_compra').on(t.compraProgramadaId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_pedidos_venda_cliente').on(t.clienteId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_pedidos_venda_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
    index('idx_pedidos_venda_data_operacao').on(t.dataOperacao).where(sql`${t.deletedAt} IS NULL`),
  ],
);

// ── pedidos_venda_itens ─────────────────────────────────────────────────────
export const pedidosVendaItens = pgTable(
  'pedidos_venda_itens',
  {
    id:                        uuid('id').primaryKey().default(sql`uuidv7()`),
    pedidoVendaId:             uuid('pedido_venda_id').notNull().references(() => pedidosVenda.id),
    itemComercialId:           uuid('item_comercial_id').notNull().references(() => itensComerciais.id),
    quantidadePedida:          numeric('quantidade_pedida', { precision: 15, scale: 3 }).notNull(),
    quantidadeReservada:       numeric('quantidade_reservada', { precision: 15, scale: 3 }).notNull().default('0'),
    quantidadePendente:        numeric('quantidade_pendente', { precision: 15, scale: 3 }).notNull().default('0'),
    // F4b: unidades físicas (peças) já associadas a este item. saldo_pendente de
    // associação = quantidade_pedida − quantidade_atendida (preenchimento por unidade).
    quantidadeAtendida:        numeric('quantidade_atendida', { precision: 15, scale: 3 }).notNull().default('0'),
    quantidadeOverbooking:     numeric('quantidade_overbooking', { precision: 15, scale: 3 }).notNull().default('0'),
    preferenciasAplicadasJson: jsonb('preferencias_aplicadas_json').notNull().default(sql`'{}'::jsonb`),
    status:                    text('status').notNull(),
    observacoes:               text('observacoes'),
    createdAt:                 timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:                 timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:                 timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_pedidos_itens_pedida_positiva', sql`${t.quantidadePedida} > 0`),
    check('chk_pedidos_itens_reservada_nao_negativa', sql`${t.quantidadeReservada} >= 0`),
    check('chk_pedidos_itens_pendente_nao_negativa', sql`${t.quantidadePendente} >= 0`),
    check('chk_pedidos_itens_atendida_nao_negativa', sql`${t.quantidadeAtendida} >= 0`),
    check('chk_pedidos_itens_atendida_ate_pedida', sql`${t.quantidadeAtendida} <= ${t.quantidadePedida}`),
    // CHECK legado durante expand; superset no SQL 0012; finais no 0014.
    check(
      'chk_pedidos_itens_status',
      sql`${t.status} IN ('totalmente_reservado','parcialmente_reservado','sem_cobertura','cancelado')`,
    ),
    uniqueIndex('uq_pedido_venda_item_comercial_ativo')
      .on(t.pedidoVendaId, t.itemComercialId)
      .where(sql`${t.deletedAt} IS NULL`),
    index('idx_pedidos_itens_pedido').on(t.pedidoVendaId),
    index('idx_pedidos_itens_item_comercial').on(t.itemComercialId),
    index('idx_pedidos_itens_preferencias_gin').using('gin', t.preferenciasAplicadasJson),
  ],
);

// ── reservas_disponibilidade ────────────────────────────────────────────────
// Liga um item de pedido ao saldo virtual consumido. A quantidade aqui é o
// reservado EFETIVO (base para liberação/devolução de saldo).
export const reservasDisponibilidade = pgTable(
  'reservas_disponibilidade',
  {
    id:                       uuid('id').primaryKey().default(sql`uuidv7()`),
    disponibilidadeVirtualId: uuid('disponibilidade_virtual_id').references(() => disponibilidadesVirtuais.id),
    pedidoVendaItemId:        uuid('pedido_venda_item_id').notNull().references(() => pedidosVendaItens.id),
    quantidadeReservada:      numeric('quantidade_reservada', { precision: 15, scale: 3 }).notNull(),
    tipoConsumo:              text('tipo_consumo').notNull().default('virtual'),
    status:                   text('status').notNull().default('ativa'),
    createdAt:                timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:                timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_reservas_qtd_positiva', sql`${t.quantidadeReservada} > 0`),
    check('chk_reservas_status', sql`${t.status} IN ('ativa','liberada')`),
    // CHECKs de tipo_consumo entram apenas no contract 0014.
    index('idx_reservas_disponibilidade').on(t.disponibilidadeVirtualId),
    index('idx_reservas_pedido_item').on(t.pedidoVendaItemId),
  ],
);

export const pedidosVendaRelations = relations(pedidosVenda, ({ one, many }) => ({
  compra: one(comprasProgramadas, {
    fields: [pedidosVenda.compraProgramadaId],
    references: [comprasProgramadas.id],
  }),
  cliente: one(clientes, {
    fields: [pedidosVenda.clienteId],
    references: [clientes.id],
  }),
  itens: many(pedidosVendaItens),
}));

export const pedidosVendaItensRelations = relations(pedidosVendaItens, ({ one, many }) => ({
  pedido: one(pedidosVenda, {
    fields: [pedidosVendaItens.pedidoVendaId],
    references: [pedidosVenda.id],
  }),
  itemComercial: one(itensComerciais, {
    fields: [pedidosVendaItens.itemComercialId],
    references: [itensComerciais.id],
  }),
  reservas: many(reservasDisponibilidade),
}));

export const reservasDisponibilidadeRelations = relations(reservasDisponibilidade, ({ one }) => ({
  disponibilidade: one(disponibilidadesVirtuais, {
    fields: [reservasDisponibilidade.disponibilidadeVirtualId],
    references: [disponibilidadesVirtuais.id],
  }),
  pedidoItem: one(pedidosVendaItens, {
    fields: [reservasDisponibilidade.pedidoVendaItemId],
    references: [pedidosVendaItens.id],
  }),
}));
