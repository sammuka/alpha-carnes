import { relations, sql } from 'drizzle-orm';
import { check, date, index, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { comprasProgramadas } from './compras-programadas.schema';
import { itensComerciais } from './itens-comerciais.schema';
import { operacoes } from './operacoes.schema';

// ── disponibilidades_virtuais ───────────────────────────────────────────────
// Saldo virtual do dia por item comercial, gerado ao confirmar a compra.
// Anti-overbooking: a reserva é um UPDATE condicional atômico; os CHECK >= 0
// são o backstop de invariante (saldo nunca negativo).
export const disponibilidadesVirtuais = pgTable(
  'disponibilidades_virtuais',
  {
    id:                     uuid('id').primaryKey().default(sql`uuidv7()`),
    compraProgramadaId:     uuid('compra_programada_id').notNull().references(() => comprasProgramadas.id),
    dataOperacao:           date('data_operacao').notNull(),
    operacaoId:             uuid('operacao_id').references(() => operacoes.id),
    itemComercialId:        uuid('item_comercial_id').notNull().references(() => itensComerciais.id),
    quantidadeTotalGerada:  numeric('quantidade_total_gerada', { precision: 15, scale: 3 }).notNull(),
    quantidadeReservada:    numeric('quantidade_reservada', { precision: 15, scale: 3 }).notNull().default('0'),
    quantidadeDisponivel:   numeric('quantidade_disponivel', { precision: 15, scale: 3 }).notNull(),
    // F4a: fato físico do recebimento (não rebalanceia reserva/disponível).
    quantidadeRecebida:        numeric('quantidade_recebida', { precision: 15, scale: 3 }).notNull().default('0'),
    quantidadeComDivergencia:  numeric('quantidade_com_divergencia', { precision: 15, scale: 3 }).notNull().default('0'),
    status:                 text('status').notNull().default('gerada'),
    createdAt:              timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:              timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Invariantes duros (backstop do anti-overbooking).
    check('chk_disp_disponivel_nao_negativo', sql`${t.quantidadeDisponivel} >= 0`),
    check('chk_disp_reservada_nao_negativo', sql`${t.quantidadeReservada} >= 0`),
    check('chk_disp_recebida_nao_negativo', sql`${t.quantidadeRecebida} >= 0`),
    check('chk_disp_com_divergencia_nao_negativo', sql`${t.quantidadeComDivergencia} >= 0`),
    check('chk_disp_status', sql`${t.status} IN ('gerada','parcialmente_reservada','esgotada')`),
    uniqueIndex('uq_disp_compra_item').on(t.compraProgramadaId, t.itemComercialId),
    index('idx_disp_data_operacao').on(t.dataOperacao),
    index('idx_disp_item_comercial').on(t.itemComercialId),
  ],
);

export const disponibilidadesVirtuaisRelations = relations(disponibilidadesVirtuais, ({ one }) => ({
  compra: one(comprasProgramadas, {
    fields: [disponibilidadesVirtuais.compraProgramadaId],
    references: [comprasProgramadas.id],
  }),
  itemComercial: one(itensComerciais, {
    fields: [disponibilidadesVirtuais.itemComercialId],
    references: [itensComerciais.id],
  }),
}));
