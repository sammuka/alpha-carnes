import { relations, sql } from 'drizzle-orm';
import { boolean, check, index, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { fornecedores } from './fornecedores.schema';
import { produtos } from './produtos.schema';
import { operacoes } from './operacoes.schema';
import { pedidosFornecedor } from './pedidos-fornecedor.schema';
import { usuarios } from './auth.schema';
import { conclusoesConferencia } from './conclusoes-conferencia.schema';
import { notasFiscaisFornecedor } from './notas-fiscais-fornecedor.schema';

export const STATUS_RECEBIMENTO = [
  'pesagem_em_andamento',
  'aguardando_conclusao_pesagem',
  'aguardando_conferencia_final',
  'conferido_sem_divergencia',
  'conferido_com_divergencia',
  'ocorrencia_administrativa_aberta',
  'tratativa_administrativa_concluida',
  'cancelado',
] as const;

export const STATUS_APURACAO_ITEM = [
  'aguardando',
  'em_conferencia',
  'conferido',
  'divergente',
  'entrada_direta',
] as const;

// ── recebimentos ────────────────────────────────────────────────────────────
export const recebimentos = pgTable(
  'recebimentos',
  {
    id:                       uuid('id').primaryKey().default(sql`uuidv7()`),
    fornecedorId:             uuid('fornecedor_id').notNull().references(() => fornecedores.id),
    operacaoId:               uuid('operacao_id').notNull().references(() => operacoes.id),
    pedidoFornecedorId:       uuid('pedido_fornecedor_id').notNull().references(() => pedidosFornecedor.id),
    dataHoraChegada:          timestamp('data_hora_chegada', { withTimezone: true }).notNull().defaultNow(),
    notaFiscalFornecedor:     text('nota_fiscal_fornecedor'),
    romaneio:                 text('romaneio'),
    placaVeiculo:             text('placa_veiculo'),
    motorista:                text('motorista'),
    doca:                     text('doca'),
    responsavelRecebimentoId: uuid('responsavel_recebimento_id').notNull().references(() => usuarios.id),
    status:                   text('status').notNull().default('pesagem_em_andamento'),
    observacoes:              text('observacoes'),
    usuarioConclusaoId:       uuid('usuario_conclusao_id').references(() => usuarios.id),
    dataConclusao:            timestamp('data_conclusao', { withTimezone: true }),
    createdAt:                timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:                timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:                timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_recebimentos_status', sql`${t.status} IN (
      'pesagem_em_andamento','aguardando_conclusao_pesagem','aguardando_conferencia_final',
      'conferido_sem_divergencia','conferido_com_divergencia',
      'ocorrencia_administrativa_aberta','tratativa_administrativa_concluida','cancelado'
    )`),
    index('idx_recebimentos_pedido_fornecedor').on(t.pedidoFornecedorId),
    index('idx_recebimentos_operacao').on(t.operacaoId),
    index('idx_recebimentos_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
    index('idx_recebimentos_fornecedor').on(t.fornecedorId).where(sql`${t.deletedAt} IS NULL`),
  ],
);

export const recebimentosItens = pgTable(
  'recebimentos_itens',
  {
    id:                  uuid('id').primaryKey().default(sql`uuidv7()`),
    recebimentoId:       uuid('recebimento_id').notNull().references(() => recebimentos.id),
    produtoId:           uuid('produto_id').notNull().references(() => produtos.id),
    origemDescricao:     text('origem_descricao'),
    quantidadeEsperada:  numeric('quantidade_esperada', { precision: 15, scale: 3 }).notNull(),
    quantidadeRecebida:  numeric('quantidade_recebida', { precision: 15, scale: 3 }).notNull().default('0'),
    unidadeEsperada:     text('unidade_esperada'),
    requerBalanca:       boolean('requer_balanca').notNull().default(true),
    pesoTotalApurado:    numeric('peso_total_apurado', { precision: 10, scale: 3 }),
    statusApuracao:      text('status_apuracao').notNull().default('aguardando'),
    observacoes:         text('observacoes'),
    createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_receb_itens_esperada_nao_negativa', sql`${t.quantidadeEsperada} >= 0`),
    check('chk_receb_itens_recebida_nao_negativa', sql`${t.quantidadeRecebida} >= 0`),
    check(
      'chk_receb_itens_status_apuracao',
      sql`${t.statusApuracao} IN ('aguardando','em_conferencia','conferido','divergente','entrada_direta')`,
    ),
    uniqueIndex('uq_receb_itens_recebimento_produto').on(t.recebimentoId, t.produtoId),
    index('idx_receb_itens_recebimento').on(t.recebimentoId),
    index('idx_receb_itens_produto').on(t.produtoId),
  ],
);

export const divergenciasRecebimento = pgTable(
  'divergencias_recebimento',
  {
    id:                     uuid('id').primaryKey().default(sql`uuidv7()`),
    recebimentoId:          uuid('recebimento_id').notNull().references(() => recebimentos.id),
    recebimentoItemId:      uuid('recebimento_item_id').references(() => recebimentosItens.id),
    produtoId:              uuid('produto_id').notNull().references(() => produtos.id),
    conclusaoConferenciaId: uuid('conclusao_conferencia_id').references(() => conclusoesConferencia.id),
    nfFornecedorId:         uuid('nf_fornecedor_id').references(() => notasFiscaisFornecedor.id),
    tipo:                   text('tipo').notNull(),
    descricao:              text('descricao').notNull(),
    impactoOperacional:     text('impacto_operacional'),
    impactoComercial:       text('impacto_comercial'),
    acaoImediata:           text('acao_imediata').notNull(),
    responsavelRegistroId:  uuid('responsavel_registro_id').notNull().references(() => usuarios.id),
    aprovadorId:            uuid('aprovador_id').references(() => usuarios.id),
    status:                 text('status').notNull().default('aberta'),
    pedidosImpactados:      jsonb('pedidos_impactados').notNull().default(sql`'[]'::jsonb`),
    createdAt:              timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:              timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_diverg_receb_tipo', sql`${t.tipo} IN (
      'falta','excesso','produto_nao_previsto','peso_divergente','outro'
    )`),
    check(
      'chk_diverg_receb_status',
      sql`${t.status} IN ('aberta','em_analise','aguardando_fornecedor','resolvida')`,
    ),
    index('idx_diverg_receb_recebimento').on(t.recebimentoId),
    index('idx_diverg_receb_item').on(t.recebimentoItemId),
    index('idx_diverg_receb_status').on(t.status),
    index('idx_diverg_receb_pedidos_gin').using('gin', t.pedidosImpactados),
  ],
);

export const recebimentosRelations = relations(recebimentos, ({ one, many }) => ({
  pedidoFornecedor: one(pedidosFornecedor, {
    fields: [recebimentos.pedidoFornecedorId],
    references: [pedidosFornecedor.id],
  }),
  fornecedor: one(fornecedores, {
    fields: [recebimentos.fornecedorId],
    references: [fornecedores.id],
  }),
  operacao: one(operacoes, {
    fields: [recebimentos.operacaoId],
    references: [operacoes.id],
  }),
  itens: many(recebimentosItens),
  divergencias: many(divergenciasRecebimento),
}));

export const recebimentosItensRelations = relations(recebimentosItens, ({ one, many }) => ({
  recebimento: one(recebimentos, {
    fields: [recebimentosItens.recebimentoId],
    references: [recebimentos.id],
  }),
  produto: one(produtos, {
    fields: [recebimentosItens.produtoId],
    references: [produtos.id],
  }),
  divergencias: many(divergenciasRecebimento),
}));

export const divergenciasRecebimentoRelations = relations(divergenciasRecebimento, ({ one }) => ({
  recebimento: one(recebimentos, {
    fields: [divergenciasRecebimento.recebimentoId],
    references: [recebimentos.id],
  }),
  item: one(recebimentosItens, {
    fields: [divergenciasRecebimento.recebimentoItemId],
    references: [recebimentosItens.id],
  }),
}));
