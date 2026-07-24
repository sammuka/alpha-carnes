import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { usuarios } from './auth.schema';

export const operacoes = pgTable('operacoes', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  data: date('data').notNull(),
  diaSemana: integer('dia_semana').notNull(),
  rotulo: text('rotulo').notNull(),
  status: text('status').notNull().default('aberta'),
  extraordinaria: boolean('extraordinaria').notNull().default(false),
  criadaPorId: uuid('criada_por_id').references(() => usuarios.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  check('chk_operacoes_status', sql`${t.status} IN ('aberta','em_andamento','fechada')`),
  check('chk_operacoes_dia_semana', sql`${t.diaSemana} BETWEEN 0 AND 6`),
  uniqueIndex('uq_operacoes_data').on(t.data).where(sql`${t.deletedAt} IS NULL`),
  index('idx_operacoes_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
]);
