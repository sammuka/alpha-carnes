CREATE TABLE "seguros_carga" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"caminhao_id" uuid NOT NULL,
	"valor_carga" numeric(15, 2),
	"status" text DEFAULT 'pendente' NOT NULL,
	"responsavel_id" uuid,
	"enviado_em" timestamp with time zone,
	"confirmado_em" timestamp with time zone,
	"observacao" text,
	"anexos_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_seguros_carga_status" CHECK ("seguros_carga"."status" IN ('pendente','enviado','confirmado'))
);
--> statement-breakpoint
ALTER TABLE "notas_fiscais" ADD COLUMN "modelo_fiscal" text DEFAULT 'padrao' NOT NULL;--> statement-breakpoint
ALTER TABLE "seguros_carga" ADD CONSTRAINT "seguros_carga_caminhao_id_caminhoes_id_fk" FOREIGN KEY ("caminhao_id") REFERENCES "public"."caminhoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seguros_carga" ADD CONSTRAINT "seguros_carga_responsavel_id_usuarios_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_seguros_carga_caminhao" ON "seguros_carga" USING btree ("caminhao_id") WHERE "seguros_carga"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_seguros_carga_status" ON "seguros_carga" USING btree ("status") WHERE "seguros_carga"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "chk_notas_fiscais_modelo_fiscal" CHECK ("notas_fiscais"."modelo_fiscal" IN ('padrao','rtc'));