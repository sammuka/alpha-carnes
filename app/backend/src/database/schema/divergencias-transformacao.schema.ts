import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { transformacoes } from './transformacoes.schema';
import { aprovacoesOperacionais } from './aprovacoes-operacionais.schema';
import { usuarios } from './auth.schema';

export const divergenciasTransformacao = pgTable(
  'divergencias_transformacao',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    transformacaoId: uuid('transformacao_id').notNull().references(() => transformacoes.id),
    tipo: text('tipo').notNull(),
    detalheJson: jsonb('detalhe_json').notNull().default(sql`'{}'::jsonb`),
    aprovacaoId: uuid('aprovacao_id').references(() => aprovacoesOperacionais.id),
    abertoPorId: uuid('aberto_por_id').notNull().references(() => usuarios.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check(
      'chk_diverg_transf_tipo',
      sql`${t.tipo} IN ('subpeca_faltante','subpeca_excedente','produto_diferente','perda_informada')`,
    ),
    index('idx_diverg_transf_transformacao').on(t.transformacaoId).where(sql`${t.deletedAt} IS NULL`),
  ],
);
