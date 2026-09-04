import { relations, sql } from 'drizzle-orm';
import { check, index, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { pecas } from './pesagem.schema';
import { produtos } from './produtos.schema';
import { produtos } from './produtos.schema';
import { pedidosVenda, pedidosVendaItens } from './pedidos.schema';
import { usuarios } from './auth.schema';
import { regrasTransformacao } from './regras-transformacao.schema';

// ── transformacoes ─────────────────────────────────────────────────────────
export const transformacoes = pgTable(
  'transformacoes',
  {
    id:                     uuid('id').primaryKey().default(sql`uuidv7()`),
    pecaOrigemId:           uuid('peca_origem_id').notNull().references(() => pecas.id),
    tipoTransformacao:      text('tipo_transformacao').notNull(),
    motivo:                 text('motivo').notNull(),
    motivoDetalhe:          text('motivo_detalhe'),
    operadorResponsavelId:  uuid('operador_responsavel_id').notNull().references(() => usuarios.id),
    statusTransformacao:    text('status_transformacao').notNull().default('aberta'),
    dataHoraAbertura:       timestamp('data_hora_abertura', { withTimezone: true }).notNull().defaultNow(),
    dataHoraEncerramento:   timestamp('data_hora_encerramento', { withTimezone: true }),
    pesoOriginal:           numeric('peso_original', { precision: 10, scale: 3 }).notNull(),
    pesoSubitensTotal:      numeric('peso_subitens_total', { precision: 10, scale: 3 }),
    diferencaPeso:          numeric('diferenca_peso', { precision: 10, scale: 3 }),
    justificativaDiferenca: text('justificativa_diferenca'),
    observacoes:            text('observacoes'),
    regraTransformacaoId:   uuid('regra_transformacao_id').references(() => regrasTransformacao.id),
    createdAt:              timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:              timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:              timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check(
      'chk_transf_tipo',
      sql`${t.tipoTransformacao} IN ('simples','subdivisao','reclassificacao','destinacao_mista')`,
    ),
    check(
      'chk_transf_motivo',
      sql`${t.motivo} IN ('preferencia_cliente','necessidade_operacional','divergencia','decisao_humana')`,
    ),
    check(
      'chk_transf_status',
      sql`${t.statusTransformacao} IN ('aberta','em_execucao','aguardando_pesagem','aguardando_associacao','aguardando_etiquetagem','concluida','cancelada')`,
    ),
    index('idx_transf_peca_origem').on(t.pecaOrigemId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_transf_status').on(t.statusTransformacao).where(sql`${t.deletedAt} IS NULL`),
    index('idx_transf_regra').on(t.regraTransformacaoId).where(sql`${t.deletedAt} IS NULL`),
  ],
);

// ── subitens ───────────────────────────────────────────────────────────────
export const subitens = pgTable(
  'subitens',
  {
    id:                 uuid('id').primaryKey().default(sql`uuidv7()`),
    transformacaoId:    uuid('transformacao_id').notNull().references(() => transformacoes.id),
    pecaOrigemId:       uuid('peca_origem_id').notNull().references(() => pecas.id),
    produtoId:          uuid('produto_id').notNull().references(() => produtos.id),
    classificacao:      text('classificacao'),
    peso:               numeric('peso', { precision: 10, scale: 3 }),
    quantidade:         numeric('quantidade', { precision: 10, scale: 3 }).notNull().default('1'),
    modoCapturaPeso:    text('modo_captura_peso'),
    capturaMeta:        jsonb('captura_meta').notNull().default(sql`'{}'::jsonb`),
    statusSubitem:      text('status_subitem').notNull().default('gerado'),
    etiquetaAtual:      text('etiqueta_atual'),
    pedidoVendaId:      uuid('pedido_venda_id').references(() => pedidosVenda.id),
    pedidoVendaItemId:  uuid('pedido_venda_item_id').references(() => pedidosVendaItens.id),
    caminhaoId:         uuid('caminhao_id'),
    observacoes:        text('observacoes'),
    createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:          timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:          timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_subitens_modo_captura', sql`${t.modoCapturaPeso} IS NULL OR ${t.modoCapturaPeso} IN ('automatico','manual_assistido')`),
    check('chk_subitens_peso_positivo', sql`${t.peso} IS NULL OR ${t.peso} > 0`),
    check(
      'chk_subitens_status',
      sql`${t.statusSubitem} IN ('gerado','pesado','associado','em_sobra','em_analise')`,
    ),
    index('idx_subitens_transformacao').on(t.transformacaoId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_subitens_peca_origem').on(t.pecaOrigemId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_subitens_pedido_item').on(t.pedidoVendaItemId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_subitens_captura_meta_gin').using('gin', t.capturaMeta),
  ],
);

export const transformacoesRelations = relations(transformacoes, ({ one, many }) => ({
  pecaOrigem: one(pecas, {
    fields: [transformacoes.pecaOrigemId],
    references: [pecas.id],
  }),
  subitens: many(subitens),
}));

export const subitensRelations = relations(subitens, ({ one }) => ({
  transformacao: one(transformacoes, {
    fields: [subitens.transformacaoId],
    references: [transformacoes.id],
  }),
  pecaOrigem: one(pecas, {
    fields: [subitens.pecaOrigemId],
    references: [pecas.id],
  }),
  produto: one(produtos, {
    fields: [subitens.produtoId],
    references: [produtos.id],
  }),
}));
