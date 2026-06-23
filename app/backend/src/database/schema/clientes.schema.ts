import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { representantes } from './representantes.schema';

// ── clientes ──────────────────────────────────────────────────────────────────
export const clientes = pgTable(
  'clientes',
  {
    id:                      uuid('id').primaryKey().default(sql`uuidv7()`),
    representanteId:         uuid('representante_id').references(() => representantes.id),
    codigo:                  text('codigo').notNull(),
    razaoSocial:             text('razao_social').notNull(),
    nomeFantasia:            text('nome_fantasia'),
    documentoFiscal:         text('documento_fiscal').notNull(), // CNPJ ou CPF, só dígitos
    status:                  text('status').notNull().default('ativo'),
    rotaPadrao:              text('rota_padrao'),
    prioridade:              text('prioridade'),
    preferenciasJson:        jsonb('preferencias_json').notNull().default(sql`'{}'::jsonb`),
    dadosFiscaisJson:        jsonb('dados_fiscais_json').notNull().default(sql`'{}'::jsonb`),
    dadosContatoJson:        jsonb('dados_contato_json').notNull().default(sql`'{}'::jsonb`),
    observacoesOperacionais: text('observacoes_operacionais'),
    createdAt:               timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:               timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:               timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_clientes_status', sql`${t.status} IN ('ativo','inativo')`),
    // Unicidade parcial: só vale para registros ativos (não colide com soft-deletados).
    uniqueIndex('uq_clientes_codigo').on(t.codigo).where(sql`${t.deletedAt} IS NULL`),
    uniqueIndex('uq_clientes_documento_fiscal').on(t.documentoFiscal).where(sql`${t.deletedAt} IS NULL`),
    index('idx_clientes_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
    // JSONB filtrável (preferências) com índice GIN (convenção de schema).
    index('idx_clientes_preferencias_gin').using('gin', t.preferenciasJson),
  ],
);
