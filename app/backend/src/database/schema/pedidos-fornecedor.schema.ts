import { sql } from 'drizzle-orm';
import {
  check,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { comprasProgramadas } from './compras-programadas.schema';
import { fornecedores } from './fornecedores.schema';
import { itensComerciais } from './itens-comerciais.schema';
import { produtos } from './produtos.schema';
import { operacoes } from './operacoes.schema';

export const pedidosFornecedor = pgTable('pedidos_fornecedor', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  numero: text('numero').notNull(),
  fornecedorId: uuid('fornecedor_id').notNull().references(() => fornecedores.id),
  operacaoId: uuid('operacao_id').notNull().references(() => operacoes.id),
  compraProgramadaId: uuid('compra_programada_id').notNull().references(() => comprasProgramadas.id),
  status: text('status').notNull().default('rascunho'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  check('chk_pedidos_fornecedor_status', sql`${t.status} IN ('rascunho','enviado','aguardando_recebimento','recebido','encerrado','cancelado')`),
  uniqueIndex('uq_pedidos_fornecedor_numero').on(t.numero).where(sql`${t.deletedAt} IS NULL`),
  index('idx_pedidos_fornecedor_fornecedor').on(t.fornecedorId),
  index('idx_pedidos_fornecedor_operacao').on(t.operacaoId),
  index('idx_pedidos_fornecedor_compra').on(t.compraProgramadaId),
]);

export const pedidosFornecedorItens = pgTable('pedidos_fornecedor_itens', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  pedidoFornecedorId: uuid('pedido_fornecedor_id').notNull().references(() => pedidosFornecedor.id),
  produtoId: uuid('produto_id').references(() => produtos.id),
  itemComercialId: uuid('item_comercial_id').notNull().references(() => itensComerciais.id),
  quantidadePrevista: numeric('quantidade_prevista', { precision: 15, scale: 3 }).notNull(),
  pesoPrevisto: numeric('peso_previsto', { precision: 10, scale: 3 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('uq_pedido_fornecedor_item').on(t.pedidoFornecedorId, t.itemComercialId)
    .where(sql`${t.deletedAt} IS NULL`),
  uniqueIndex('uq_pedido_fornecedor_produto').on(t.pedidoFornecedorId, t.produtoId)
    .where(sql`${t.deletedAt} IS NULL`),
  index('idx_pedido_fornecedor_item_comercial').on(t.itemComercialId),
  index('idx_pedido_fornecedor_produto').on(t.produtoId),
]);
