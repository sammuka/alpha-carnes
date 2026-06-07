-- Migration 0001: cadastros base (F2) — clientes, fornecedores, itens de compra,
-- itens comerciais, regras de desdobramento comercial e parâmetros do sistema.
--
-- Nota de manutenção: a migration 0000 (F1) foi escrita à mão e seu snapshot
-- drizzle ficou vazio; por isso o `drizzle-kit generate` re-emitiu as tabelas da F1.
-- Os statements de F1 foram removidos deste arquivo (já existem desde a 0000); o
-- `0001_snapshot.json` mantém o estado completo (13 tabelas), de modo que futuros
-- `generate` diffam corretamente. Apenas o attach dos triggers set_updated_at é SQL
-- manual (mesmo padrão da F1) — set_updated_at() já existe desde a 0000.

CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"codigo" text NOT NULL,
	"razao_social" text NOT NULL,
	"nome_fantasia" text,
	"documento_fiscal" text NOT NULL,
	"status" text DEFAULT 'ativo' NOT NULL,
	"rota_padrao" text,
	"prioridade" text,
	"preferencias_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dados_fiscais_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dados_contato_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"observacoes_operacionais" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_clientes_status" CHECK ("clientes"."status" IN ('ativo','inativo'))
);
--> statement-breakpoint
CREATE TABLE "fornecedores" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"codigo" text NOT NULL,
	"razao_social" text NOT NULL,
	"documento_fiscal" text NOT NULL,
	"status" text DEFAULT 'ativo' NOT NULL,
	"contatos_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"parametros_operacionais_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"observacoes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_fornecedores_status" CHECK ("fornecedores"."status" IN ('ativo','inativo'))
);
--> statement-breakpoint
CREATE TABLE "itens_compra" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"codigo" text NOT NULL,
	"descricao" text NOT NULL,
	"categoria" text,
	"unidade_compra" text NOT NULL,
	"status" text DEFAULT 'ativo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_itens_compra_status" CHECK ("itens_compra"."status" IN ('ativo','inativo'))
);
--> statement-breakpoint
CREATE TABLE "itens_comerciais" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"codigo" text NOT NULL,
	"descricao" text NOT NULL,
	"categoria" text,
	"unidade_comercial" text NOT NULL,
	"permite_corte" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'ativo' NOT NULL,
	"observacoes_operacionais" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_itens_comerciais_status" CHECK ("itens_comerciais"."status" IN ('ativo','inativo'))
);
--> statement-breakpoint
CREATE TABLE "regras_desdobramento_comercial" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"item_compra_id" uuid NOT NULL,
	"item_comercial_id" uuid NOT NULL,
	"fator_quantidade" numeric(10, 3) NOT NULL,
	"status" text DEFAULT 'ativo' NOT NULL,
	"vigencia_inicio" timestamp with time zone NOT NULL,
	"vigencia_fim" timestamp with time zone,
	"observacoes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_regras_desd_status" CHECK ("regras_desdobramento_comercial"."status" IN ('ativo','inativo')),
	CONSTRAINT "chk_regras_desd_fator_positivo" CHECK ("regras_desdobramento_comercial"."fator_quantidade" > 0)
);
--> statement-breakpoint
CREATE TABLE "parametros" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"chave" text NOT NULL,
	"valor_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"descricao" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "parametros_chave_unique" UNIQUE("chave")
);
--> statement-breakpoint
ALTER TABLE "regras_desdobramento_comercial" ADD CONSTRAINT "regras_desdobramento_comercial_item_compra_id_itens_compra_id_fk" FOREIGN KEY ("item_compra_id") REFERENCES "public"."itens_compra"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regras_desdobramento_comercial" ADD CONSTRAINT "regras_desdobramento_comercial_item_comercial_id_itens_comerciais_id_fk" FOREIGN KEY ("item_comercial_id") REFERENCES "public"."itens_comerciais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_clientes_codigo" ON "clientes" USING btree ("codigo") WHERE "clientes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_clientes_documento_fiscal" ON "clientes" USING btree ("documento_fiscal") WHERE "clientes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_clientes_status" ON "clientes" USING btree ("status") WHERE "clientes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_clientes_preferencias_gin" ON "clientes" USING gin ("preferencias_json");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_fornecedores_codigo" ON "fornecedores" USING btree ("codigo") WHERE "fornecedores"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_fornecedores_documento_fiscal" ON "fornecedores" USING btree ("documento_fiscal") WHERE "fornecedores"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_fornecedores_status" ON "fornecedores" USING btree ("status") WHERE "fornecedores"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_fornecedores_parametros_gin" ON "fornecedores" USING gin ("parametros_operacionais_json");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_itens_compra_codigo" ON "itens_compra" USING btree ("codigo") WHERE "itens_compra"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_itens_compra_status" ON "itens_compra" USING btree ("status") WHERE "itens_compra"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_itens_comerciais_codigo" ON "itens_comerciais" USING btree ("codigo") WHERE "itens_comerciais"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_itens_comerciais_status" ON "itens_comerciais" USING btree ("status") WHERE "itens_comerciais"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_regras_desd_item_compra" ON "regras_desdobramento_comercial" USING btree ("item_compra_id") WHERE "regras_desdobramento_comercial"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_regras_desd_item_comercial" ON "regras_desdobramento_comercial" USING btree ("item_comercial_id") WHERE "regras_desdobramento_comercial"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_regras_desd_par_ativo" ON "regras_desdobramento_comercial" USING btree ("item_compra_id","item_comercial_id") WHERE "regras_desdobramento_comercial"."deleted_at" IS NULL AND "regras_desdobramento_comercial"."status" = 'ativo';--> statement-breakpoint
-- Triggers set_updated_at (a função já existe desde a migration 0000) — SQL manual.
CREATE TRIGGER trg_clientes_updated_at BEFORE UPDATE ON "clientes" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_fornecedores_updated_at BEFORE UPDATE ON "fornecedores" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_itens_compra_updated_at BEFORE UPDATE ON "itens_compra" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_itens_comerciais_updated_at BEFORE UPDATE ON "itens_comerciais" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_regras_desd_updated_at BEFORE UPDATE ON "regras_desdobramento_comercial" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_parametros_updated_at BEFORE UPDATE ON "parametros" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
