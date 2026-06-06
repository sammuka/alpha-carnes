import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid, check } from 'drizzle-orm/pg-core';

export const auditoria = pgTable(
  'auditoria',
  {
    id:              uuid('id').primaryKey().default(sql`uuidv7()`),
    tabela:          text('tabela').notNull(),
    registroId:      uuid('registro_id').notNull(),
    operacao:        text('operacao').notNull(),
    modulo:          text('modulo'),
    usuarioId:       uuid('usuario_id'),  // nullable — pode ser sistema
    dadosAnteriores: jsonb('dados_anteriores').notNull().default(sql`'{}'::jsonb`),
    dadosNovos:      jsonb('dados_novos').notNull().default(sql`'{}'::jsonb`),
    justificativa:   text('justificativa'),
    ip:              text('ip'),
    userAgent:       text('user_agent'),
    createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_auditoria_operacao', sql`${t.operacao} IN ('INSERT','UPDATE','DELETE','ACAO_MANUAL')`),
    index('idx_auditoria_tabela_registro').on(t.tabela, t.registroId),
    index('idx_auditoria_usuario').on(t.usuarioId),
    index('idx_auditoria_modulo').on(t.modulo),
    index('idx_auditoria_data').on(t.createdAt),
    index('idx_auditoria_operacao').on(t.operacao),
  ],
);
