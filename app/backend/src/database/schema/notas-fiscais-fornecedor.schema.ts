import { sql } from 'drizzle-orm';
import {
  date,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { itensComerciais } from './itens-comerciais.schema';
import { pedidosFornecedor } from './pedidos-fornecedor.schema';
import { recebimentos } from './recebimentos.schema';

export const notasFiscaisFornecedor = pgTable('notas_fiscais_fornecedor', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  pedidoFornecedorId: uuid('pedido_fornecedor_id').notNull().references(() => pedidosFornecedor.id),
  recebimentoId: uuid('recebimento_id').notNull().references(() => recebimentos.id),
  numero: text('numero').notNull(),
  serie: text('serie'),
  chave: text('chave'),
  dataEmissao: date('data_emissao'),
  pesoTotalDeclarado: numeric('peso_total_declarado', { precision: 10, scale: 3 }),
  payloadJson: jsonb('payload_json').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  index('idx_nf_fornecedor_pedido').on(t.pedidoFornecedorId),
  index('idx_nf_fornecedor_recebimento').on(t.recebimentoId),
  uniqueIndex('uq_nf_fornecedor_chave').on(t.chave).where(sql`${t.deletedAt} IS NULL AND ${t.chave} IS NOT NULL`),
]);

export const notasFiscaisFornecedorItens = pgTable('notas_fiscais_fornecedor_itens', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  nfId: uuid('nf_id').notNull().references(() => notasFiscaisFornecedor.id),
  itemComercialId: uuid('item_comercial_id').notNull().references(() => itensComerciais.id),
  quantidadeDeclarada: numeric('quantidade_declarada', { precision: 15, scale: 3 }).notNull(),
  pesoDeclarado: numeric('peso_declarado', { precision: 10, scale: 3 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('uq_nf_fornecedor_item').on(t.nfId, t.itemComercialId).where(sql`${t.deletedAt} IS NULL`),
  index('idx_nf_fornecedor_item_comercial').on(t.itemComercialId),
]);
