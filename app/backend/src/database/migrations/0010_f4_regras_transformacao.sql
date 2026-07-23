CREATE TABLE "regras_transformacao" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"nome" text NOT NULL,
	"produto_origem_codigo" text DEFAULT 'TZ' NOT NULL,
	"status" text DEFAULT 'ativo' NOT NULL,
	"prioridade" integer DEFAULT 0 NOT NULL,
	"observacao" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_regras_transf_status" CHECK ("regras_transformacao"."status" IN ('ativo','inativo'))
);
--> statement-breakpoint
CREATE TABLE "regras_transformacao_saidas" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"regra_id" uuid NOT NULL,
	"produto_id" uuid NOT NULL,
	"quantidade_fixa" numeric(10, 3) DEFAULT '1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_regras_transf_saidas_qtd_positiva" CHECK ("regras_transformacao_saidas"."quantidade_fixa" > 0)
);
--> statement-breakpoint
ALTER TABLE "regras_transformacao_saidas" ADD CONSTRAINT "regras_transformacao_saidas_regra_id_regras_transformacao_id_fk" FOREIGN KEY ("regra_id") REFERENCES "public"."regras_transformacao"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "regras_transformacao_saidas" ADD CONSTRAINT "regras_transformacao_saidas_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_regras_transf_status" ON "regras_transformacao" USING btree ("status") WHERE "regras_transformacao"."deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX "idx_regras_transf_saidas_regra" ON "regras_transformacao_saidas" USING btree ("regra_id");
--> statement-breakpoint
CREATE INDEX "idx_regras_transf_saidas_produto" ON "regras_transformacao_saidas" USING btree ("produto_id");
--> statement-breakpoint
CREATE TRIGGER trg_regras_transformacao_updated_at BEFORE UPDATE ON "regras_transformacao" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_regras_transformacao_saidas_updated_at BEFORE UPDATE ON "regras_transformacao_saidas" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
