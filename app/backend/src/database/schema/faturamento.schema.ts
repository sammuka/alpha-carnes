import { relations, sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { caminhoes } from './expedicao.schema';
import { pedidosVenda } from './pedidos.schema';
import { clientes } from './clientes.schema';
import { operacoes } from './operacoes.schema';
import { usuarios } from './auth.schema';

// ── faturamentos ──────────────────────────────────────────────────────────────
// Cabeçalho de faturamento de um caminhão. Máximo 1 ativo por caminhão.
// Criado pelo faturista após o caminhão atingir status 'liberado_faturamento'.
export const faturamentos = pgTable(
  'faturamentos',
  {
    id:                   uuid('id').primaryKey().default(sql`uuidv7()`),
    caminhaoId:           uuid('caminhao_id').notNull().references(() => caminhoes.id),
    statusFaturamento:    text('status_faturamento').notNull().default('em_consolidacao'),
    operacaoId:           uuid('operacao_id').notNull().references(() => operacoes.id),
    responsavelId:        uuid('responsavel_id').notNull().references(() => usuarios.id),
    observacoes:          text('observacoes'),
    createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:            timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check(
      'chk_faturamentos_status',
      sql`${t.statusFaturamento} IN ('em_consolidacao','pronto_para_emitir','parcialmente_emitido','concluido')`,
    ),
    // Máximo 1 faturamento ativo por caminhão
    uniqueIndex('uq_faturamentos_caminhao')
      .on(t.caminhaoId)
      .where(sql`${t.deletedAt} IS NULL`),
    index('idx_faturamentos_status').on(t.statusFaturamento).where(sql`${t.deletedAt} IS NULL`),
    index('idx_faturamentos_operacao').on(t.operacaoId).where(sql`${t.deletedAt} IS NULL`),
  ],
);

// ── notas_fiscais ─────────────────────────────────────────────────────────────
// Uma NFS-e por pedido de venda dentro de um faturamento.
// O índice único parcial uq_notas_fiscais_pedido_viva garante que não haja
// dupla emissão para o mesmo pedido enquanto a nota estiver viva (não cancelada
// e não em erro de emissão).
export const notasFiscais = pgTable(
  'notas_fiscais',
  {
    id:                   uuid('id').primaryKey().default(sql`uuidv7()`),
    faturamentoId:        uuid('faturamento_id').notNull().references(() => faturamentos.id),
    // Denormalizado para query de bloqueio de reabertura do caminhão
    caminhaoId:           uuid('caminhao_id').notNull().references(() => caminhoes.id),
    pedidoVendaId:        uuid('pedido_venda_id').notNull().references(() => pedidosVenda.id),
    clienteId:            uuid('cliente_id').notNull().references(() => clientes.id),
    numeroNfse:           text('numero_nfse'),
    codigoVerificacao:    text('codigo_verificacao'),
    linkNfse:             text('link_nfse'),
    statusNfse:           text('status_nfse').notNull().default('pendente'),
    valor:                numeric('valor', { precision: 15, scale: 2 }).notNull(),
    aliquota:             numeric('aliquota', { precision: 5, scale: 4 }).notNull().default('0.0500'),
    tentativasEmissao:    integer('tentativas_emissao').notNull().default(0),
    ultimoErroNfse:       text('ultimo_erro_nfse'),
    emitidaEm:            timestamp('emitida_em', { withTimezone: true }),
    canceladaEm:          timestamp('cancelada_em', { withTimezone: true }),
    motivoCancelamento:   text('motivo_cancelamento'),
    // Necessário para ConsultarNotaCompleta em caso de timeout na emissão
    numeroRps:            text('numero_rps'),
    // Nullable no banco desde 0008 (DEFAULT 'A'); não forçar NOT NULL no expand da Onda 1.
    serieRps:             text('serie_rps').default('A'),
    // request + response EISS; token REDACTADO antes de persistir
    payloadEiss:          jsonb('payload_eiss').notNull().default(sql`'{}'::jsonb`),
    createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:            timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check(
      'chk_notas_fiscais_status',
      sql`${t.statusNfse} IN ('pendente','emitida','erro_emissao','cancelada','erro_cancelamento')`,
    ),
    check(
      'chk_notas_fiscais_valor_positivo',
      sql`${t.valor} > 0`,
    ),
    check(
      'chk_notas_fiscais_aliquota_valida',
      sql`${t.aliquota} > 0 AND ${t.aliquota} <= 1`,
    ),
    // CRÍTICO: impede dupla emissão para o mesmo pedido enquanto nota estiver viva
    uniqueIndex('uq_notas_fiscais_pedido_viva')
      .on(t.pedidoVendaId)
      .where(sql`${t.statusNfse} NOT IN ('cancelada','erro_emissao') AND ${t.deletedAt} IS NULL`),
    index('idx_notas_fiscais_caminhao').on(t.caminhaoId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_notas_fiscais_faturamento').on(t.faturamentoId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_notas_fiscais_pedido').on(t.pedidoVendaId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_notas_fiscais_status').on(t.statusNfse).where(sql`${t.deletedAt} IS NULL`),
    index('idx_notas_fiscais_payload_gin').using('gin', t.payloadEiss),
  ],
);

// ── Relations ─────────────────────────────────────────────────────────────────

export const faturamentosRelations = relations(faturamentos, ({ one, many }) => ({
  caminhao: one(caminhoes, {
    fields: [faturamentos.caminhaoId],
    references: [caminhoes.id],
  }),
  responsavel: one(usuarios, {
    fields: [faturamentos.responsavelId],
    references: [usuarios.id],
  }),
  notasFiscais: many(notasFiscais),
}));

export const notasFiscaisRelations = relations(notasFiscais, ({ one }) => ({
  faturamento: one(faturamentos, {
    fields: [notasFiscais.faturamentoId],
    references: [faturamentos.id],
  }),
  caminhao: one(caminhoes, {
    fields: [notasFiscais.caminhaoId],
    references: [caminhoes.id],
  }),
  pedidoVenda: one(pedidosVenda, {
    fields: [notasFiscais.pedidoVendaId],
    references: [pedidosVenda.id],
  }),
  cliente: one(clientes, {
    fields: [notasFiscais.clienteId],
    references: [clientes.id],
  }),
}));
