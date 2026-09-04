import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { usuarios } from './auth.schema';
import { clientes } from './clientes.schema';
import { itensComerciais } from './itens-comerciais.schema';
import { produtos } from './produtos.schema';
import { operacoes } from './operacoes.schema';
import { pedidosVenda, pedidosVendaItens } from './pedidos.schema';

export const pendenciasOverbooking = pgTable('pendencias_overbooking', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  pedidoVendaId: uuid('pedido_venda_id').notNull().references(() => pedidosVenda.id),
  pedidoVendaItemId: uuid('pedido_venda_item_id').notNull().references(() => pedidosVendaItens.id),
  produtoId: uuid('produto_id').references(() => produtos.id),
  itemComercialId: uuid('item_comercial_id').notNull().references(() => itensComerciais.id),
  clienteId: uuid('cliente_id').notNull().references(() => clientes.id),
  vendedorUsuarioId: uuid('vendedor_usuario_id').notNull().references(() => usuarios.id),
  operacaoId: uuid('operacao_id').notNull().references(() => operacoes.id),
  quantidadeDeficit: numeric('quantidade_deficit', { precision: 15, scale: 3 }).notNull(),
  status: text('status').notNull().default('aberta'),
  decisaoJson: jsonb('decisao_json').notNull().default(sql`'{}'::jsonb`),
  responsavelId: uuid('responsavel_id').references(() => usuarios.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  check('chk_pend_ovb_deficit', sql`${t.quantidadeDeficit} > 0`),
  check('chk_pend_ovb_status', sql`${t.status} IN ('aberta','em_analise','compra_complementar_programada','redistribuicao_decidida','novo_pedido_criado','resolvida','cancelada')`),
  index('idx_pend_ovb_item').on(t.pedidoVendaItemId),
  index('idx_pend_ovb_operacao').on(t.operacaoId),
]);

export const pendenciasOverbookingHistorico = pgTable('pendencias_overbooking_historico', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  pendenciaId: uuid('pendencia_id').notNull().references(() => pendenciasOverbooking.id),
  acao: text('acao').notNull(),
  autorId: uuid('autor_id').notNull().references(() => usuarios.id),
  detalheJson: jsonb('detalhe_json').notNull().default(sql`'{}'::jsonb`),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('idx_pend_ovb_hist_pendencia').on(t.pendenciaId)]);
