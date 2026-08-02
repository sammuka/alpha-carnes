import { relations, sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { produtos } from './produtos.schema';
import { pedidosVenda, pedidosVendaItens } from './pedidos.schema';
import { pecas } from './pesagem.schema';
import { subitens } from './transformacoes.schema';
import { aprovacoesOperacionais } from './aprovacoes-operacionais.schema';
import { usuarios } from './auth.schema';

// ── entradas_itens ────────────────────────────────────────────────────────────
// Caixarias/itens por unidade: não passam por balança nem desossa (v1.1 §4.1).
export const entradasItens = pgTable(
  'entradas_itens',
  {
    id:                  uuid('id').primaryKey().default(sql`uuidv7()`),
    produtoId:           uuid('produto_id').notNull().references(() => produtos.id),
    quantidade:          integer('quantidade').notNull(),
    quantidadeDestinada: integer('quantidade_destinada').notNull().default(0),
    unidade:             text('unidade').notNull().default('caixa'),
    fornecedorNome:      text('fornecedor_nome').notNull(),
    loteNf:              text('lote_nf'),
    local:               text('local'),
    destino:             text('destino').notNull(),
    pedidoId:            uuid('pedido_id').references(() => pedidosVenda.id),
    pedidoVendaItemId:   uuid('pedido_venda_item_id').references(() => pedidosVendaItens.id),
    observacao:          text('observacao'),
    registradoPor:       uuid('registrado_por').notNull().references(() => usuarios.id),
    createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:           timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_entradas_itens_qtd', sql`${t.quantidade} > 0`),
    check('chk_entradas_itens_destinada', sql`${t.quantidadeDestinada} >= 0 AND ${t.quantidadeDestinada} <= ${t.quantidade}`),
    check('chk_entradas_itens_unidade', sql`${t.unidade} IN ('caixa','unidade')`),
    check('chk_entradas_itens_destino', sql`${t.destino} IN ('estoque','pedido')`),
    index('idx_entradas_itens_produto').on(t.produtoId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_entradas_itens_created').on(t.createdAt).where(sql`${t.deletedAt} IS NULL`),
  ],
);

// ── ajustes_estoque ───────────────────────────────────────────────────────────
// Ajuste controlado de saldo físico (doc 04 §5.3). Limiar de aprovação = parâmetro.
export const ajustesEstoque = pgTable(
  'ajustes_estoque',
  {
    id:                      uuid('id').primaryKey().default(sql`uuidv7()`),
    tipoAlvo:                text('tipo_alvo').notNull(),
    pecaId:                  uuid('peca_id').references(() => pecas.id),
    subitemId:               uuid('subitem_id').references(() => subitens.id),
    entradaId:               uuid('entrada_id').references(() => entradasItens.id),
    produtoCodigo:           text('produto_codigo').notNull(),
    quantidadeDelta:         integer('quantidade_delta').notNull(),
    quantidadeAnterior:      integer('quantidade_anterior').notNull(),
    motivo:                  text('motivo').notNull(),
    descricao:               text('descricao'),
    status:                  text('status').notNull().default('aplicado'),
    criadoPor:               uuid('criado_por').notNull().references(() => usuarios.id),
    decididoPor:             uuid('decidido_por').references(() => usuarios.id),
    decididoEm:              timestamp('decidido_em', { withTimezone: true }),
    decisaoMotivo:           text('decisao_motivo'),
    aprovacaoOperacionalId:  uuid('aprovacao_operacional_id').references(() => aprovacoesOperacionais.id),
    createdAt:               timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:               timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:               timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_ajustes_tipo_alvo', sql`${t.tipoAlvo} IN ('peca','subitem','entrada')`),
    check('chk_ajustes_um_alvo', sql`(${t.pecaId} IS NOT NULL)::int + (${t.subitemId} IS NOT NULL)::int + (${t.entradaId} IS NOT NULL)::int = 1`),
    check('chk_ajustes_delta', sql`${t.quantidadeDelta} <> 0`),
    check('chk_ajustes_motivo', sql`${t.motivo} IN ('quebra','perda','erro_contagem','vencimento','outro')`),
    check('chk_ajustes_status', sql`${t.status} IN ('aplicado','aguardando_aprovacao','rejeitado')`),
    index('idx_ajustes_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
    index('idx_ajustes_created').on(t.createdAt).where(sql`${t.deletedAt} IS NULL`),
  ],
);

export const entradasItensRelations = relations(entradasItens, ({ one }) => ({
  produto: one(produtos, { fields: [entradasItens.produtoId], references: [produtos.id] }),
  pedido: one(pedidosVenda, { fields: [entradasItens.pedidoId], references: [pedidosVenda.id] }),
}));
