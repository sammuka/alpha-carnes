import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/** As 12 chaves booleanas de ModelosEtiqueta.tsx (decisão 16 da Onda 3). */
export const CAMPOS_ETIQUETA = [
  'codigo', 'produto', 'peso', 'clientePedido', 'destino', 'origemFrigorifico',
  'nfLote', 'dataHora', 'operador', 'caracteristicas', 'qrCode', 'codigoBarras',
] as const;

export const modelosEtiqueta = pgTable(
  'modelos_etiqueta',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    slug: text('slug').notNull(),
    nome: text('nome').notNull(),
    campos: jsonb('campos').notNull(),
    status: text('status').notNull().default('ativo'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_modelos_etiqueta_status', sql`${t.status} IN ('ativo','inativo')`),
    uniqueIndex('uq_modelos_etiqueta_slug').on(t.slug).where(sql`${t.deletedAt} IS NULL`),
    index('idx_modelos_etiqueta_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
  ],
);
