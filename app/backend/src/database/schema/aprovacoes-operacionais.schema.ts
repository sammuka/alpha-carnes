import { sql } from 'drizzle-orm';
import {
  check, index, pgTable, text, timestamp, uuid,
} from 'drizzle-orm/pg-core';
import { usuarios } from './auth.schema';
import { operacoes } from './operacoes.schema';

export const aprovacoesOperacionais = pgTable(
  'aprovacoes_operacionais',
  {
    id:               uuid('id').primaryKey().default(sql`uuidv7()`),
    operacaoId:       uuid('operacao_id').notNull().references(() => operacoes.id),
    tipo:             text('tipo').notNull(),
    origem:           text('origem').notNull(),
    descricao:        text('descricao').notNull(),
    impacto:          text('impacto').notNull(),
    referenciaTabela: text('referencia_tabela'),
    referenciaId:     uuid('referencia_id'),
    solicitanteId:    uuid('solicitante_id').notNull().references(() => usuarios.id),
    solicitadoEm:     timestamp('solicitado_em', { withTimezone: true }).notNull().defaultNow(),
    status:           text('status').notNull().default('pendente'),
    decisaoMotivo:    text('decisao_motivo'),
    decididoPorId:    uuid('decidido_por_id').references(() => usuarios.id),
    decididoEm:       timestamp('decidido_em', { withTimezone: true }),
    createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:        timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check(
      'chk_aprovacao_tipo',
      sql`${t.tipo} IN ('divergencia_transformacao','estorno_fora_regra',
                        'reabertura_carga_pedido','ajuste_estoque_relevante')`,
    ),
    check('chk_aprovacao_status', sql`${t.status} IN ('pendente','aprovada','rejeitada')`),
    check(
      'chk_aprovacao_decisao',
      sql`(
        (${t.status} = 'pendente'
          AND ${t.decisaoMotivo} IS NULL AND ${t.decididoPorId} IS NULL AND ${t.decididoEm} IS NULL)
        OR
        (${t.status} IN ('aprovada','rejeitada')
          AND ${t.decisaoMotivo} IS NOT NULL AND length(btrim(${t.decisaoMotivo})) >= 10
          AND ${t.decididoPorId} IS NOT NULL AND ${t.decididoEm} IS NOT NULL)
      )`,
    ),
    index('idx_aprovacoes_operacao').on(t.operacaoId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_aprovacoes_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
    index('idx_aprovacoes_referencia').on(t.referenciaTabela, t.referenciaId)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);
