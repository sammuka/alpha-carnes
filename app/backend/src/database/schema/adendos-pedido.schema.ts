import { sql } from 'drizzle-orm';
import { check, index, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { pedidosVenda, pedidosVendaItens } from './pedidos.schema';
import { itensComerciais } from './itens-comerciais.schema';
import { produtos } from './produtos.schema';
import { operacoes } from './operacoes.schema';
import { usuarios } from './auth.schema';

// ── adendos_pedido ────────────────────────────────────────────────────────────
// Histórico append-only de aumentos de um item de pedido aberto (D8). Sem
// deletedAt: cada linha é um evento imutável, como pendencias_overbooking_historico.
export const adendosPedido = pgTable(
  'adendos_pedido',
  {
    id:                   uuid('id').primaryKey().default(sql`uuidv7()`),
    pedidoVendaId:        uuid('pedido_venda_id').notNull().references(() => pedidosVenda.id),
    pedidoVendaItemId:    uuid('pedido_venda_item_id').notNull().references(() => pedidosVendaItens.id),
    produtoId:            uuid('produto_id').references(() => produtos.id),
    itemComercialId:      uuid('item_comercial_id').notNull().references(() => itensComerciais.id),
    operacaoId:           uuid('operacao_id').notNull().references(() => operacoes.id),
    quantidadeAnterior:   numeric('quantidade_anterior', { precision: 10, scale: 3 }).notNull(),
    quantidadeAdicionada: numeric('quantidade_adicionada', { precision: 10, scale: 3 }).notNull(),
    quantidadeResultante: numeric('quantidade_resultante', { precision: 10, scale: 3 }).notNull(),
    origemConsumo:        text('origem_consumo').notNull(),
    motivo:               text('motivo').notNull(),
    autorId:              uuid('autor_id').notNull().references(() => usuarios.id),
    criadoEm:             timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_adendos_pedido_quantidade', sql`${t.quantidadeAdicionada} > 0`),
    check('chk_adendos_pedido_origem', sql`${t.origemConsumo} IN ('fisico','virtual','overbooking')`),
    index('idx_adendos_pedido_pedido').on(t.pedidoVendaId),
  ],
);
