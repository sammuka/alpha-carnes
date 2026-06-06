import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  check,
} from 'drizzle-orm/pg-core';

const PERFIL_SLUGS = [
  'administrador', 'compras', 'gestor', 'comercial', 'recebimento_pesagem',
  'corte', 'expedicao', 'conferente', 'faturamento', 'logistica', 'diretoria',
] as const;

// ── usuarios ─────────────────────────────────────────────────────────────────
export const usuarios = pgTable(
  'usuarios',
  {
    id:            uuid('id').primaryKey().default(sql`uuidv7()`),
    nome:          text('nome').notNull(),
    email:         text('email').notNull().unique(),
    senhaHash:     text('senha_hash').notNull(),
    ativo:         boolean('ativo').notNull().default(true),
    ultimoAcesso:  timestamp('ultimo_acesso', { withTimezone: true }),
    createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:     timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_usuarios_email').on(t.email),
    index('idx_usuarios_ativo').on(t.ativo).where(sql`${t.deletedAt} IS NULL`),
  ],
);

// ── perfis ────────────────────────────────────────────────────────────────────
export const perfis = pgTable(
  'perfis',
  {
    id:        uuid('id').primaryKey().default(sql`uuidv7()`),
    slug:      text('slug').notNull().unique(),
    nome:      text('nome').notNull(),
    descricao: text('descricao'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_perfis_slug', sql`${t.slug} IN (${sql.join(PERFIL_SLUGS.map((s) => sql.raw(`'${s}'`)), sql`, `)})`),
  ],
);

// ── usuarios_perfis ───────────────────────────────────────────────────────────
export const usuariosPerfis = pgTable(
  'usuarios_perfis',
  {
    id:        uuid('id').primaryKey().default(sql`uuidv7()`),
    usuarioId: uuid('usuario_id').notNull().references(() => usuarios.id),
    perfilId:  uuid('perfil_id').notNull().references(() => perfis.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('uq_usuario_perfil').on(t.usuarioId, t.perfilId),
    index('idx_usuarios_perfis_usuario').on(t.usuarioId),
    index('idx_usuarios_perfis_perfil').on(t.perfilId),
  ],
);

// ── permissoes ────────────────────────────────────────────────────────────────
export const permissoes = pgTable('permissoes', {
  id:        uuid('id').primaryKey().default(sql`uuidv7()`),
  codigo:    text('codigo').notNull().unique(),
  descricao: text('descricao'),
});

// ── perfis_permissoes ─────────────────────────────────────────────────────────
export const perfisPermissoes = pgTable(
  'perfis_permissoes',
  {
    id:          uuid('id').primaryKey().default(sql`uuidv7()`),
    perfilId:    uuid('perfil_id').notNull().references(() => perfis.id),
    permissaoId: uuid('permissao_id').notNull().references(() => permissoes.id),
  },
  (t) => [
    unique('uq_perfil_permissao').on(t.perfilId, t.permissaoId),
    index('idx_perfis_permissoes_perfil').on(t.perfilId),
    index('idx_perfis_permissoes_permissao').on(t.permissaoId),
  ],
);

// ── refresh_tokens ────────────────────────────────────────────────────────────
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id:           uuid('id').primaryKey().default(sql`uuidv7()`),
    usuarioId:    uuid('usuario_id').notNull().references(() => usuarios.id),
    tokenHash:    text('token_hash').notNull().unique(),
    expiresAt:    timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt:    timestamp('revoked_at', { withTimezone: true }),
    replacedById: uuid('replaced_by_id'),  // self-FK adicionada via migrate
    userAgent:    text('user_agent'),
    ip:           text('ip'),
    createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_refresh_tokens_usuario').on(t.usuarioId),
    index('idx_refresh_tokens_hash').on(t.tokenHash),
    index('idx_refresh_tokens_expires').on(t.expiresAt),
  ],
);

// ── Relations ─────────────────────────────────────────────────────────────────
export const usuariosRelations = relations(usuarios, ({ many }) => ({
  perfis: many(usuariosPerfis),
  refreshTokens: many(refreshTokens),
}));

export const perfisRelations = relations(perfis, ({ many }) => ({
  usuarios: many(usuariosPerfis),
  permissoes: many(perfisPermissoes),
}));

export const usuariosPerfisRelations = relations(usuariosPerfis, ({ one }) => ({
  usuario: one(usuarios, { fields: [usuariosPerfis.usuarioId], references: [usuarios.id] }),
  perfil: one(perfis, { fields: [usuariosPerfis.perfilId], references: [perfis.id] }),
}));

export const permissoesRelations = relations(permissoes, ({ many }) => ({
  perfis: many(perfisPermissoes),
}));

export const perfisPermissoesRelations = relations(perfisPermissoes, ({ one }) => ({
  perfil: one(perfis, { fields: [perfisPermissoes.perfilId], references: [perfis.id] }),
  permissao: one(permissoes, { fields: [perfisPermissoes.permissaoId], references: [permissoes.id] }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  usuario: one(usuarios, { fields: [refreshTokens.usuarioId], references: [usuarios.id] }),
}));
