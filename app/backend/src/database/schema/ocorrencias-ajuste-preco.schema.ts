import { relations, sql } from 'drizzle-orm';
import { check, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { pedidosVenda, pedidosVendaItens } from './pedidos.schema';
import { clientes } from './clientes.schema';
import { produtos } from './produtos.schema';
import { usuarios } from './auth.schema';

export const ocorrenciasAjustePreco = pgTable(
  'ocorrencias_ajuste_preco',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    pedidoVendaId: uuid('pedido_venda_id').notNull().references(() => pedidosVenda.id),
    clienteId: uuid('cliente_id').notNull().references(() => clientes.id),
    status: text('status').notNull().default('aberta'),
    quantidadeItensAjustados: integer('quantidade_itens_ajustados').notNull(),
    diferencaTotal: numeric('diferenca_total', { precision: 15, scale: 2 }).notNull(),
    usuarioFinalizacaoId: uuid('usuario_finalizacao_id').notNull().references(() => usuarios.id),
    dataHoraOcorrencia: timestamp('data_hora_ocorrencia', { withTimezone: true }).notNull().defaultNow(),
    usuarioCienteId: uuid('usuario_ciente_id').references(() => usuarios.id),
    dataHoraCiente: timestamp('data_hora_ciente', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_ocorr_ajuste_preco_status', sql`${t.status} IN ('aberta','ciente')`),
    uniqueIndex('uq_ocorr_ajuste_preco_pedido').on(t.pedidoVendaId),
    index('idx_ocorr_ajuste_preco_status').on(t.status),
    index('idx_ocorr_ajuste_preco_data').on(t.dataHoraOcorrencia),
  ],
);

export const ocorrenciasAjustePrecoItens = pgTable(
  'ocorrencias_ajuste_preco_itens',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    ocorrenciaId: uuid('ocorrencia_id').notNull().references(() => ocorrenciasAjustePreco.id),
    pedidoVendaItemId: uuid('pedido_venda_item_id').notNull().references(() => pedidosVendaItens.id),
    produtoId: uuid('produto_id').notNull().references(() => produtos.id),
    precoTabelaOriginal: numeric('preco_tabela_original', { precision: 15, scale: 2 }),
    precoAplicado: numeric('preco_aplicado', { precision: 15, scale: 2 }).notNull(),
    diferencaAbsoluta: numeric('diferenca_absoluta', { precision: 15, scale: 2 }).notNull(),
    diferencaPercentual: numeric('diferenca_percentual', { precision: 10, scale: 4 }),
    usuarioAjusteId: uuid('usuario_ajuste_id').references(() => usuarios.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
);

export const ocorrenciasAjustePrecoRelations = relations(ocorrenciasAjustePreco, ({ many }) => ({
  itens: many(ocorrenciasAjustePrecoItens),
}));

export const ocorrenciasAjustePrecoItensRelations = relations(ocorrenciasAjustePrecoItens, ({ one }) => ({
  ocorrencia: one(ocorrenciasAjustePreco, {
    fields: [ocorrenciasAjustePrecoItens.ocorrenciaId],
    references: [ocorrenciasAjustePreco.id],
  }),
}));
