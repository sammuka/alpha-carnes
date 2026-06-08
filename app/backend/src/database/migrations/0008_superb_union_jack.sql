CREATE TABLE "faturamentos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"caminhao_id" uuid NOT NULL,
	"status_faturamento" text DEFAULT 'em_consolidacao' NOT NULL,
	"data_operacao" date NOT NULL,
	"responsavel_id" uuid NOT NULL,
	"observacoes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_faturamentos_status" CHECK ("faturamentos"."status_faturamento" IN ('em_consolidacao','pronto_para_emitir','parcialmente_emitido','concluido'))
);
--> statement-breakpoint
CREATE TABLE "notas_fiscais" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"faturamento_id" uuid NOT NULL,
	"caminhao_id" uuid NOT NULL,
	"pedido_venda_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"numero_nfse" text,
	"codigo_verificacao" text,
	"link_nfse" text,
	"status_nfse" text DEFAULT 'pendente' NOT NULL,
	"valor" numeric(15, 2) NOT NULL,
	"aliquota" numeric(5, 4) DEFAULT '0.0500' NOT NULL,
	"tentativas_emissao" integer DEFAULT 0 NOT NULL,
	"ultimo_erro_nfse" text,
	"emitida_em" timestamp with time zone,
	"cancelada_em" timestamp with time zone,
	"motivo_cancelamento" text,
	"numero_rps" text,
	"serie_rps" text DEFAULT 'A',
	"payload_eiss" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_notas_fiscais_status" CHECK ("notas_fiscais"."status_nfse" IN ('pendente','emitida','erro_emissao','cancelada','erro_cancelamento')),
	CONSTRAINT "chk_notas_fiscais_valor_positivo" CHECK ("notas_fiscais"."valor" > 0),
	CONSTRAINT "chk_notas_fiscais_aliquota_valida" CHECK ("notas_fiscais"."aliquota" > 0 AND "notas_fiscais"."aliquota" <= 1)
);
--> statement-breakpoint
ALTER TABLE "faturamentos" ADD CONSTRAINT "faturamentos_caminhao_id_caminhoes_id_fk" FOREIGN KEY ("caminhao_id") REFERENCES "public"."caminhoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faturamentos" ADD CONSTRAINT "faturamentos_responsavel_id_usuarios_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_faturamento_id_faturamentos_id_fk" FOREIGN KEY ("faturamento_id") REFERENCES "public"."faturamentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_caminhao_id_caminhoes_id_fk" FOREIGN KEY ("caminhao_id") REFERENCES "public"."caminhoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_pedido_venda_id_pedidos_venda_id_fk" FOREIGN KEY ("pedido_venda_id") REFERENCES "public"."pedidos_venda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_faturamentos_caminhao" ON "faturamentos" USING btree ("caminhao_id") WHERE "faturamentos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_faturamentos_status" ON "faturamentos" USING btree ("status_faturamento") WHERE "faturamentos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_faturamentos_data" ON "faturamentos" USING btree ("data_operacao") WHERE "faturamentos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_notas_fiscais_pedido_viva" ON "notas_fiscais" USING btree ("pedido_venda_id") WHERE "notas_fiscais"."status_nfse" NOT IN ('cancelada','erro_emissao') AND "notas_fiscais"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_notas_fiscais_caminhao" ON "notas_fiscais" USING btree ("caminhao_id") WHERE "notas_fiscais"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_notas_fiscais_faturamento" ON "notas_fiscais" USING btree ("faturamento_id") WHERE "notas_fiscais"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_notas_fiscais_pedido" ON "notas_fiscais" USING btree ("pedido_venda_id") WHERE "notas_fiscais"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_notas_fiscais_status" ON "notas_fiscais" USING btree ("status_nfse") WHERE "notas_fiscais"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_notas_fiscais_payload_gin" ON "notas_fiscais" USING gin ("payload_eiss");
--> statement-breakpoint
CREATE TRIGGER trg_faturamentos_updated_at BEFORE UPDATE ON "faturamentos" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_notas_fiscais_updated_at BEFORE UPDATE ON "notas_fiscais" FOR EACH ROW EXECUTE FUNCTION set_updated_at();