CREATE TABLE "divergencias_transformacao" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"transformacao_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"detalhe_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"aprovacao_id" uuid,
	"aberto_por_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_diverg_transf_tipo" CHECK ("divergencias_transformacao"."tipo" IN ('subpeca_faltante','subpeca_excedente','produto_diferente','perda_informada'))
);
--> statement-breakpoint
ALTER TABLE "regras_transformacao" ADD COLUMN "codigo" text;--> statement-breakpoint
ALTER TABLE "regras_transformacao" ADD COLUMN "provisorio" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transformacoes" ADD COLUMN "regra_transformacao_id" uuid;--> statement-breakpoint
ALTER TABLE "divergencias_transformacao" ADD CONSTRAINT "divergencias_transformacao_transformacao_id_transformacoes_id_fk" FOREIGN KEY ("transformacao_id") REFERENCES "public"."transformacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divergencias_transformacao" ADD CONSTRAINT "divergencias_transformacao_aprovacao_id_aprovacoes_operacionais_id_fk" FOREIGN KEY ("aprovacao_id") REFERENCES "public"."aprovacoes_operacionais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divergencias_transformacao" ADD CONSTRAINT "divergencias_transformacao_aberto_por_id_usuarios_id_fk" FOREIGN KEY ("aberto_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_diverg_transf_transformacao" ON "divergencias_transformacao" USING btree ("transformacao_id") WHERE "divergencias_transformacao"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "transformacoes" ADD CONSTRAINT "transformacoes_regra_transformacao_id_regras_transformacao_id_fk" FOREIGN KEY ("regra_transformacao_id") REFERENCES "public"."regras_transformacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_regras_transf_codigo" ON "regras_transformacao" USING btree ("codigo") WHERE "regras_transformacao"."deleted_at" IS NULL AND "regras_transformacao"."codigo" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_transf_regra" ON "transformacoes" USING btree ("regra_transformacao_id") WHERE "transformacoes"."deleted_at" IS NULL;