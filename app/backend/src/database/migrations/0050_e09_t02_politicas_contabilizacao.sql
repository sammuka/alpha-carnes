CREATE TABLE "politica_simulacoes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"politica_id" uuid NOT NULL,
	"versao_numero" integer NOT NULL,
	"valor" numeric(15, 2) NOT NULL,
	"debito" numeric(15, 2) NOT NULL,
	"credito" numeric(15, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_politica_simulacoes_balance" CHECK ("politica_simulacoes"."debito" = "politica_simulacoes"."credito" AND "politica_simulacoes"."valor" = "politica_simulacoes"."debito")
);
--> statement-breakpoint
CREATE TABLE "politica_versoes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"politica_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"conta_debito_id" uuid NOT NULL,
	"conta_credito_id" uuid NOT NULL,
	"centro_custo_id" uuid NOT NULL,
	"vigencia_inicio" date NOT NULL,
	"situacao" text NOT NULL,
	"justificativa" text NOT NULL,
	"responsavel_id" uuid NOT NULL,
	"aprovador_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_politica_versoes_situacao" CHECK ("politica_versoes"."situacao" IN ('DRAFT','REVIEW','APPROVED','REJECTED','SUSPENDED'))
);
--> statement-breakpoint
CREATE TABLE "politicas_contabilizacao" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"codigo" text NOT NULL,
	"tipo_evento" text NOT NULL,
	"competencia" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_politicas_tipo_evento" CHECK ("politicas_contabilizacao"."tipo_evento" IN ('LIQUIDACAO','REGISTRO','CANCELAMENTO','ESTORNO','TARIFA')),
	CONSTRAINT "chk_politicas_competencia_dia" CHECK (extract(day from "politicas_contabilizacao"."competencia") = 1)
);
--> statement-breakpoint
ALTER TABLE "politica_simulacoes" ADD CONSTRAINT "politica_simulacoes_politica_id_politicas_contabilizacao_id_fk" FOREIGN KEY ("politica_id") REFERENCES "public"."politicas_contabilizacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politica_versoes" ADD CONSTRAINT "politica_versoes_politica_id_politicas_contabilizacao_id_fk" FOREIGN KEY ("politica_id") REFERENCES "public"."politicas_contabilizacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politica_versoes" ADD CONSTRAINT "politica_versoes_conta_debito_id_contas_contabeis_id_fk" FOREIGN KEY ("conta_debito_id") REFERENCES "public"."contas_contabeis"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politica_versoes" ADD CONSTRAINT "politica_versoes_conta_credito_id_contas_contabeis_id_fk" FOREIGN KEY ("conta_credito_id") REFERENCES "public"."contas_contabeis"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politica_versoes" ADD CONSTRAINT "politica_versoes_centro_custo_id_centros_custo_id_fk" FOREIGN KEY ("centro_custo_id") REFERENCES "public"."centros_custo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politica_versoes" ADD CONSTRAINT "politica_versoes_responsavel_id_usuarios_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politica_versoes" ADD CONSTRAINT "politica_versoes_aprovador_id_usuarios_id_fk" FOREIGN KEY ("aprovador_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_politica_simulacoes_politica" ON "politica_simulacoes" USING btree ("politica_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_politica_versoes_numero" ON "politica_versoes" USING btree ("politica_id","numero") WHERE "politica_versoes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_politica_versoes_politica" ON "politica_versoes" USING btree ("politica_id");--> statement-breakpoint
CREATE INDEX "idx_politica_versoes_debito" ON "politica_versoes" USING btree ("conta_debito_id");--> statement-breakpoint
CREATE INDEX "idx_politica_versoes_credito" ON "politica_versoes" USING btree ("conta_credito_id");--> statement-breakpoint
CREATE INDEX "idx_politica_versoes_centro" ON "politica_versoes" USING btree ("centro_custo_id");--> statement-breakpoint
CREATE INDEX "idx_politica_versoes_responsavel" ON "politica_versoes" USING btree ("responsavel_id");--> statement-breakpoint
CREATE INDEX "idx_politica_versoes_aprovador" ON "politica_versoes" USING btree ("aprovador_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_politicas_contabilizacao_codigo" ON "politicas_contabilizacao" USING btree ("codigo") WHERE "politicas_contabilizacao"."deleted_at" IS NULL;
--> statement-breakpoint
CREATE TRIGGER trg_politicas_contabilizacao_updated_at
  BEFORE UPDATE ON politicas_contabilizacao
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_politica_versoes_updated_at
  BEFORE UPDATE ON politica_versoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_politica_simulacoes_updated_at
  BEFORE UPDATE ON politica_simulacoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();