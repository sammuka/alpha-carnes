CREATE TABLE "centros_custo" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"codigo" text NOT NULL,
	"nome" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "conta_versoes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"conta_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"nome" text NOT NULL,
	"classificacao" text NOT NULL,
	"natureza" text NOT NULL,
	"grupo" text NOT NULL,
	"conta_pai_id" uuid,
	"centro_custo_id" uuid NOT NULL,
	"vigencia_inicio" date NOT NULL,
	"vigencia_fim" date,
	"situacao" text NOT NULL,
	"justificativa" text NOT NULL,
	"responsavel_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_conta_versoes_classificacao" CHECK ("conta_versoes"."classificacao" IN ('sintetica','analitica')),
	CONSTRAINT "chk_conta_versoes_natureza" CHECK ("conta_versoes"."natureza" IN ('ATIVO','PASSIVO','RECEITA','DESPESA','CUSTO')),
	CONSTRAINT "chk_conta_versoes_situacao" CHECK ("conta_versoes"."situacao" IN ('DRAFT','REVIEW','APPROVED','REJECTED','SUSPENDED')),
	CONSTRAINT "chk_conta_versoes_vigencia" CHECK ("conta_versoes"."vigencia_fim" IS NULL OR "conta_versoes"."vigencia_fim" >= "conta_versoes"."vigencia_inicio")
);
--> statement-breakpoint
CREATE TABLE "contas_contabeis" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"codigo" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "conta_versoes" ADD CONSTRAINT "conta_versoes_conta_id_contas_contabeis_id_fk" FOREIGN KEY ("conta_id") REFERENCES "public"."contas_contabeis"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conta_versoes" ADD CONSTRAINT "conta_versoes_conta_pai_id_contas_contabeis_id_fk" FOREIGN KEY ("conta_pai_id") REFERENCES "public"."contas_contabeis"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conta_versoes" ADD CONSTRAINT "conta_versoes_centro_custo_id_centros_custo_id_fk" FOREIGN KEY ("centro_custo_id") REFERENCES "public"."centros_custo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conta_versoes" ADD CONSTRAINT "conta_versoes_responsavel_id_usuarios_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_centros_custo_codigo" ON "centros_custo" USING btree ("codigo") WHERE "centros_custo"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_conta_versoes_numero" ON "conta_versoes" USING btree ("conta_id","numero") WHERE "conta_versoes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_conta_versoes_conta" ON "conta_versoes" USING btree ("conta_id");--> statement-breakpoint
CREATE INDEX "idx_conta_versoes_pai" ON "conta_versoes" USING btree ("conta_pai_id");--> statement-breakpoint
CREATE INDEX "idx_conta_versoes_centro" ON "conta_versoes" USING btree ("centro_custo_id");--> statement-breakpoint
CREATE INDEX "idx_conta_versoes_responsavel" ON "conta_versoes" USING btree ("responsavel_id");--> statement-breakpoint
CREATE INDEX "idx_conta_versoes_situacao" ON "conta_versoes" USING btree ("situacao") WHERE "conta_versoes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_contas_contabeis_codigo" ON "contas_contabeis" USING btree ("codigo") WHERE "contas_contabeis"."deleted_at" IS NULL;
--> statement-breakpoint
CREATE TRIGGER trg_centros_custo_updated_at
  BEFORE UPDATE ON centros_custo
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_contas_contabeis_updated_at
  BEFORE UPDATE ON contas_contabeis
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_conta_versoes_updated_at
  BEFORE UPDATE ON conta_versoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();