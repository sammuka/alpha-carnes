-- Migration 0000: schema inicial auth/RBAC/auditoria (F1)
-- PKs: uuidv7() nativo do PostgreSQL 18 (ADR-003/ADR-007)
-- Nota: uuidv7() disponível nativamente no PostgreSQL 18 sem extensão adicional

-- ── usuarios ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "usuarios" (
  "id"            UUID        NOT NULL DEFAULT uuidv7() PRIMARY KEY,
  "nome"          TEXT        NOT NULL,
  "email"         TEXT        NOT NULL UNIQUE,
  "senha_hash"    TEXT        NOT NULL,
  "ativo"         BOOLEAN     NOT NULL DEFAULT true,
  "ultimo_acesso" TIMESTAMPTZ,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at"    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "idx_usuarios_email" ON "usuarios" ("email");
CREATE INDEX IF NOT EXISTS "idx_usuarios_ativo"  ON "usuarios" ("ativo") WHERE "deleted_at" IS NULL;

-- ── perfis ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "perfis" (
  "id"        UUID NOT NULL DEFAULT uuidv7() PRIMARY KEY,
  "slug"      TEXT NOT NULL UNIQUE,
  "nome"      TEXT NOT NULL,
  "descricao" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "chk_perfis_slug" CHECK ("slug" IN (
    'administrador','compras','gestor','comercial','recebimento_pesagem',
    'corte','expedicao','conferente','faturamento','logistica','diretoria'
  ))
);

-- ── usuarios_perfis ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "usuarios_perfis" (
  "id"         UUID        NOT NULL DEFAULT uuidv7() PRIMARY KEY,
  "usuario_id" UUID        NOT NULL REFERENCES "usuarios" ("id"),
  "perfil_id"  UUID        NOT NULL REFERENCES "perfis" ("id"),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "uq_usuario_perfil" UNIQUE ("usuario_id", "perfil_id")
);

CREATE INDEX IF NOT EXISTS "idx_usuarios_perfis_usuario" ON "usuarios_perfis" ("usuario_id");
CREATE INDEX IF NOT EXISTS "idx_usuarios_perfis_perfil"  ON "usuarios_perfis" ("perfil_id");

-- ── permissoes ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "permissoes" (
  "id"        UUID NOT NULL DEFAULT uuidv7() PRIMARY KEY,
  "codigo"    TEXT NOT NULL UNIQUE,
  "descricao" TEXT
);

-- ── perfis_permissoes ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "perfis_permissoes" (
  "id"           UUID NOT NULL DEFAULT uuidv7() PRIMARY KEY,
  "perfil_id"    UUID NOT NULL REFERENCES "perfis" ("id"),
  "permissao_id" UUID NOT NULL REFERENCES "permissoes" ("id"),
  CONSTRAINT "uq_perfil_permissao" UNIQUE ("perfil_id", "permissao_id")
);

CREATE INDEX IF NOT EXISTS "idx_perfis_permissoes_perfil"    ON "perfis_permissoes" ("perfil_id");
CREATE INDEX IF NOT EXISTS "idx_perfis_permissoes_permissao" ON "perfis_permissoes" ("permissao_id");

-- ── refresh_tokens ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "id"             UUID        NOT NULL DEFAULT uuidv7() PRIMARY KEY,
  "usuario_id"     UUID        NOT NULL REFERENCES "usuarios" ("id"),
  "token_hash"     TEXT        NOT NULL UNIQUE,
  "expires_at"     TIMESTAMPTZ NOT NULL,
  "revoked_at"     TIMESTAMPTZ,
  "replaced_by_id" UUID        REFERENCES "refresh_tokens" ("id"),
  "user_agent"     TEXT,
  "ip"             TEXT,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_usuario" ON "refresh_tokens" ("usuario_id");
CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_hash"    ON "refresh_tokens" ("token_hash");
CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_expires" ON "refresh_tokens" ("expires_at");

-- ── auditoria ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "auditoria" (
  "id"               UUID        NOT NULL DEFAULT uuidv7() PRIMARY KEY,
  "tabela"           TEXT        NOT NULL,
  "registro_id"      UUID        NOT NULL,
  "operacao"         TEXT        NOT NULL CHECK ("operacao" IN ('INSERT','UPDATE','DELETE','ACAO_MANUAL')),
  "modulo"           TEXT,
  "usuario_id"       UUID,
  "dados_anteriores" JSONB       NOT NULL DEFAULT '{}',
  "dados_novos"      JSONB       NOT NULL DEFAULT '{}',
  "justificativa"    TEXT,
  "ip"               TEXT,
  "user_agent"       TEXT,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_auditoria_tabela_registro" ON "auditoria" ("tabela", "registro_id");
CREATE INDEX IF NOT EXISTS "idx_auditoria_usuario"         ON "auditoria" ("usuario_id");
CREATE INDEX IF NOT EXISTS "idx_auditoria_modulo"          ON "auditoria" ("modulo");
CREATE INDEX IF NOT EXISTS "idx_auditoria_data"            ON "auditoria" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_auditoria_operacao"        ON "auditoria" ("operacao");

-- ── Trigger: set_updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_usuarios_updated_at
  BEFORE UPDATE ON "usuarios"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_perfis_updated_at
  BEFORE UPDATE ON "perfis"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
