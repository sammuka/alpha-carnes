import { relations, sql } from 'drizzle-orm';
import { check, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { fornecedores } from './fornecedores.schema';
import { itensCompra } from './itens-compra.schema';
import { operacoes } from './operacoes.schema';
import { usuarios } from './auth.schema';

// ── compras_programadas ─────────────────────────────────────────────────────
// Lote principal do dia (compra programada). Confirmar gera a disponibilidade
// virtual do dia (F3). Compra confirmada é imutável.
export const comprasProgramadas = pgTable(
  'compras_programadas',
  {
    id:                   uuid('id').primaryKey().default(sql`uuidv7()`),
    operacaoId:           uuid('operacao_id').notNull().references(() => operacoes.id),
    numeroSequencial:     integer('numero_sequencial').notNull(),
    fornecedorId:         uuid('fornecedor_id').notNull().references(() => fornecedores.id),
    numeroInterno:        text('numero_interno'),
    referenciaExterna:    text('referencia_externa'),
    previsaoEntrega:      timestamp('previsao_entrega', { withTimezone: true }),
    status:               text('status').notNull().default('rascunho'),
    observacoes:          text('observacoes'),
    dataConfirmacao:      timestamp('data_confirmacao', { withTimezone: true }),
    usuarioCriacaoId:     uuid('usuario_criacao_id').notNull().references(() => usuarios.id),
    usuarioConfirmacaoId: uuid('usuario_confirmacao_id').references(() => usuarios.id),
    createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:            timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_compras_prog_status', sql`${t.status} IN ('rascunho','em_negociacao','confirmada','cancelada')`),
    uniqueIndex('uq_compras_prog_operacao_sequencial')
      .on(t.operacaoId, t.numeroSequencial)
      .where(sql`${t.deletedAt} IS NULL AND ${t.status} <> 'cancelada'`),
    index('idx_compras_prog_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
    index('idx_compras_prog_fornecedor').on(t.fornecedorId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_compras_prog_operacao').on(t.operacaoId).where(sql`${t.deletedAt} IS NULL`),
  ],
);

// ── compras_programadas_itens ───────────────────────────────────────────────
export const comprasProgramadasItens = pgTable(
  'compras_programadas_itens',
  {
    id:                 uuid('id').primaryKey().default(sql`uuidv7()`),
    compraProgramadaId: uuid('compra_programada_id').notNull().references(() => comprasProgramadas.id),
    itemCompraId:       uuid('item_compra_id').notNull().references(() => itensCompra.id),
    quantidadeComprada: numeric('quantidade_comprada', { precision: 15, scale: 3 }).notNull(),
    observacoes:        text('observacoes'),
    createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:          timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:          timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_compras_prog_itens_qtd_positiva', sql`${t.quantidadeComprada} > 0`),
    index('idx_compras_prog_itens_compra').on(t.compraProgramadaId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_compras_prog_itens_item_compra').on(t.itemCompraId).where(sql`${t.deletedAt} IS NULL`),
  ],
);

export const comprasProgramadasRelations = relations(comprasProgramadas, ({ one, many }) => ({
  fornecedor: one(fornecedores, {
    fields: [comprasProgramadas.fornecedorId],
    references: [fornecedores.id],
  }),
  operacao: one(operacoes, {
    fields: [comprasProgramadas.operacaoId],
    references: [operacoes.id],
  }),
  itens: many(comprasProgramadasItens),
}));

export const comprasProgramadasItensRelations = relations(comprasProgramadasItens, ({ one }) => ({
  compra: one(comprasProgramadas, {
    fields: [comprasProgramadasItens.compraProgramadaId],
    references: [comprasProgramadas.id],
  }),
  itemCompra: one(itensCompra, {
    fields: [comprasProgramadasItens.itemCompraId],
    references: [itensCompra.id],
  }),
}));
