import { relations, sql } from 'drizzle-orm';
import { check, date, index, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { comprasProgramadas } from './compras-programadas.schema';
import { fornecedores } from './fornecedores.schema';
import { itensComerciais } from './itens-comerciais.schema';
import { usuarios } from './auth.schema';

// ── recebimentos ────────────────────────────────────────────────────────────
// Cabeçalho do recebimento físico do lote do dia. Sempre vinculado a uma compra
// programada CONFIRMADA (F4a). Imutável após conclusão.
export const recebimentos = pgTable(
  'recebimentos',
  {
    id:                       uuid('id').primaryKey().default(sql`uuidv7()`),
    compraProgramadaId:       uuid('compra_programada_id').notNull().references(() => comprasProgramadas.id),
    fornecedorId:             uuid('fornecedor_id').notNull().references(() => fornecedores.id),
    dataOperacao:             date('data_operacao').notNull(),
    dataHoraChegada:          timestamp('data_hora_chegada', { withTimezone: true }).notNull().defaultNow(),
    notaFiscalFornecedor:     text('nota_fiscal_fornecedor'),
    placaVeiculo:             text('placa_veiculo'),
    motorista:                text('motorista'),
    doca:                     text('doca'),
    responsavelRecebimentoId: uuid('responsavel_recebimento_id').notNull().references(() => usuarios.id),
    status:                   text('status').notNull().default('em_andamento'),
    observacoes:              text('observacoes'),
    usuarioConclusaoId:       uuid('usuario_conclusao_id').references(() => usuarios.id),
    dataConclusao:            timestamp('data_conclusao', { withTimezone: true }),
    createdAt:                timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:                timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:                timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_recebimentos_status', sql`${t.status} IN ('em_andamento','com_divergencia','concluido')`),
    // Um recebimento ativo por compra (suporta idempotência do iniciar).
    uniqueIndex('uq_recebimentos_compra').on(t.compraProgramadaId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_recebimentos_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
    index('idx_recebimentos_data_operacao').on(t.dataOperacao).where(sql`${t.deletedAt} IS NULL`),
    index('idx_recebimentos_fornecedor').on(t.fornecedorId).where(sql`${t.deletedAt} IS NULL`),
  ],
);

// ── recebimentos_itens ──────────────────────────────────────────────────────
// Conferência por item comercial: esperado (derivado da disponibilidade do dia)
// × recebido. Item excedente vive aqui com quantidade_esperada = 0.
export const recebimentosItens = pgTable(
  'recebimentos_itens',
  {
    id:                  uuid('id').primaryKey().default(sql`uuidv7()`),
    recebimentoId:       uuid('recebimento_id').notNull().references(() => recebimentos.id),
    itemComercialId:     uuid('item_comercial_id').notNull().references(() => itensComerciais.id),
    quantidadeEsperada:  numeric('quantidade_esperada', { precision: 15, scale: 3 }).notNull(),
    quantidadeRecebida:  numeric('quantidade_recebida', { precision: 15, scale: 3 }).notNull().default('0'),
    pesoTotalApurado:    numeric('peso_total_apurado', { precision: 10, scale: 3 }),
    statusApuracao:      text('status_apuracao').notNull().default('aguardando'),
    observacoes:         text('observacoes'),
    createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_receb_itens_esperada_nao_negativa', sql`${t.quantidadeEsperada} >= 0`),
    check('chk_receb_itens_recebida_nao_negativa', sql`${t.quantidadeRecebida} >= 0`),
    check('chk_receb_itens_status_apuracao', sql`${t.statusApuracao} IN ('aguardando','conforme','divergente')`),
    uniqueIndex('uq_receb_itens_recebimento_item').on(t.recebimentoId, t.itemComercialId),
    index('idx_receb_itens_recebimento').on(t.recebimentoId),
    index('idx_receb_itens_item_comercial').on(t.itemComercialId),
  ],
);

// ── divergencias_recebimento ────────────────────────────────────────────────
// Toda diferença esperado×recebido gera uma divergência formal (RA-06). Nasce
// 'aberta'; mover para fora de 'aberta' (tratativa auditada) libera a conclusão.
export const divergenciasRecebimento = pgTable(
  'divergencias_recebimento',
  {
    id:                     uuid('id').primaryKey().default(sql`uuidv7()`),
    recebimentoId:          uuid('recebimento_id').notNull().references(() => recebimentos.id),
    recebimentoItemId:      uuid('recebimento_item_id').notNull().references(() => recebimentosItens.id),
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
    check(
      'chk_diverg_receb_tipo',
      sql`${t.tipo} IN ('quantidade_menor','quantidade_maior','item_divergente','qualidade_divergente','peso_incompativel','item_ausente','item_excedente','inconsistencia_nf_fisico')`,
    ),
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
  compra: one(comprasProgramadas, {
    fields: [recebimentos.compraProgramadaId],
    references: [comprasProgramadas.id],
  }),
  fornecedor: one(fornecedores, {
    fields: [recebimentos.fornecedorId],
    references: [fornecedores.id],
  }),
  itens: many(recebimentosItens),
  divergencias: many(divergenciasRecebimento),
}));

export const recebimentosItensRelations = relations(recebimentosItens, ({ one, many }) => ({
  recebimento: one(recebimentos, {
    fields: [recebimentosItens.recebimentoId],
    references: [recebimentos.id],
  }),
  itemComercial: one(itensComerciais, {
    fields: [recebimentosItens.itemComercialId],
    references: [itensComerciais.id],
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
