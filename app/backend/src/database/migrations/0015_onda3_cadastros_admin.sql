-- Onda 3 — Cadastros & Regras + Administração. Expand puro: só cria.
CREATE TABLE IF NOT EXISTS "frota_caminhoes" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "placa" text NOT NULL,
  "descricao" text,
  "capacidade_kg" integer DEFAULT 0 NOT NULL,
  "rota_padrao_id" uuid,
  "status" text DEFAULT 'ativo' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "chk_frota_caminhoes_status" CHECK ("status" IN ('ativo','inativo')),
  CONSTRAINT "chk_frota_caminhoes_capacidade" CHECK ("capacidade_kg" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "frota_motoristas" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "nome" text NOT NULL,
  "documento" text NOT NULL,
  "telefone" text,
  "caminhao_padrao_id" uuid REFERENCES "frota_caminhoes"("id"),
  "status" text DEFAULT 'ativo' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "chk_frota_motoristas_status" CHECK ("status" IN ('ativo','inativo'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "modelos_etiqueta" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "slug" text NOT NULL,
  "nome" text NOT NULL,
  "campos" jsonb NOT NULL,
  "status" text DEFAULT 'ativo' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "chk_modelos_etiqueta_status" CHECK ("status" IN ('ativo','inativo'))
);
--> statement-breakpoint
ALTER TABLE "perfis" ADD COLUMN IF NOT EXISTS "menus_visiveis" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "rotas" ADD COLUMN IF NOT EXISTS "paradas" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "rotas" ADD COLUMN IF NOT EXISTS "dias_atendimento" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_frota_caminhoes_placa"
  ON "frota_caminhoes" ("placa") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_frota_caminhoes_status"
  ON "frota_caminhoes" ("status") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_frota_motoristas_documento"
  ON "frota_motoristas" ("documento") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_frota_motoristas_status"
  ON "frota_motoristas" ("status") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_frota_motoristas_caminhao"
  ON "frota_motoristas" ("caminhao_padrao_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_modelos_etiqueta_slug"
  ON "modelos_etiqueta" ("slug") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_modelos_etiqueta_status"
  ON "modelos_etiqueta" ("status") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE TRIGGER "trg_frota_caminhoes_updated_at" BEFORE UPDATE ON "frota_caminhoes"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER "trg_frota_motoristas_updated_at" BEFORE UPDATE ON "frota_motoristas"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER "trg_modelos_etiqueta_updated_at" BEFORE UPDATE ON "modelos_etiqueta"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
