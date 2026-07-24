import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { usuarios } from './auth.schema';
import { notasFiscaisFornecedor } from './notas-fiscais-fornecedor.schema';
import { recebimentos } from './recebimentos.schema';

export const conclusoesConferencia = pgTable('conclusoes_conferencia', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  recebimentoId: uuid('recebimento_id').notNull().references(() => recebimentos.id),
  quadroJson: jsonb('quadro_json').notNull(),
  resultado: text('resultado').notNull(),
  observacao: text('observacao'),
  concluidaPorId: uuid('concluida_por_id').notNull().references(() => usuarios.id),
  concluidaEm: timestamp('concluida_em', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_conclusao_recebimento').on(t.recebimentoId),
  check('chk_conclusao_resultado', sql`${t.resultado} IN ('sem_divergencia','com_divergencia')`),
]);

export const conclusoesConferenciaNfs = pgTable('conclusoes_conferencia_nfs', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  conclusaoId: uuid('conclusao_id').notNull().references(() => conclusoesConferencia.id),
  nfFornecedorId: uuid('nf_fornecedor_id').notNull().references(() => notasFiscaisFornecedor.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_conclusao_nf').on(t.conclusaoId, t.nfFornecedorId),
  index('idx_conclusao_nf_fornecedor').on(t.nfFornecedorId),
]);
