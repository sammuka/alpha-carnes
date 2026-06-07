CREATE TABLE "associacoes_peca_historico" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"peca_id" uuid NOT NULL,
	"pedido_origem_id" uuid,
	"pedido_destino_id" uuid,
	"pedido_item_destino_id" uuid,
	"acao" text NOT NULL,
	"motivo" text,
	"score_sugerido" integer,
	"justificativa_sugerida" text,
	"operador_id" uuid NOT NULL,
	"status_expedicao_no_momento" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_assoc_hist_acao" CHECK ("associacoes_peca_historico"."acao" IN ('confirmar','redirecionar','sobra','analise','corte','divergencia'))
);
--> statement-breakpoint
CREATE TABLE "etiquetas_impressoes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"peca_id" uuid NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status_impressao" text DEFAULT 'pendente' NOT NULL,
	"reimpressao" boolean DEFAULT false NOT NULL,
	"operador_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_etiq_status_impressao" CHECK ("etiquetas_impressoes"."status_impressao" IN ('impressa','falha_impressao','pendente'))
);
--> statement-breakpoint
CREATE TABLE "pecas" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"compra_programada_id" uuid NOT NULL,
	"recebimento_id" uuid NOT NULL,
	"item_comercial_base_id" uuid NOT NULL,
	"classificacao_operacional" text,
	"peso_original" numeric(10, 3) NOT NULL,
	"data_hora_pesagem" timestamp with time zone DEFAULT now() NOT NULL,
	"modo_captura_peso" text NOT NULL,
	"captura_meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status_peca" text DEFAULT 'pesada' NOT NULL,
	"etiqueta_atual" text,
	"pedido_venda_id" uuid,
	"pedido_venda_item_id" uuid,
	"caminhao_id" uuid,
	"observacoes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_pecas_modo_captura" CHECK ("pecas"."modo_captura_peso" IN ('automatico','manual_assistido')),
	CONSTRAINT "chk_pecas_peso_positivo" CHECK ("pecas"."peso_original" > 0),
	CONSTRAINT "chk_pecas_status" CHECK ("pecas"."status_peca" IN ('pesada','associada','em_sobra','em_analise','para_corte','divergente'))
);
--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" ADD COLUMN "quantidade_atendida" numeric(15, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "associacoes_peca_historico" ADD CONSTRAINT "associacoes_peca_historico_peca_id_pecas_id_fk" FOREIGN KEY ("peca_id") REFERENCES "public"."pecas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "associacoes_peca_historico" ADD CONSTRAINT "associacoes_peca_historico_pedido_origem_id_pedidos_venda_id_fk" FOREIGN KEY ("pedido_origem_id") REFERENCES "public"."pedidos_venda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "associacoes_peca_historico" ADD CONSTRAINT "associacoes_peca_historico_pedido_destino_id_pedidos_venda_id_fk" FOREIGN KEY ("pedido_destino_id") REFERENCES "public"."pedidos_venda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "associacoes_peca_historico" ADD CONSTRAINT "associacoes_peca_historico_pedido_item_destino_id_pedidos_venda_itens_id_fk" FOREIGN KEY ("pedido_item_destino_id") REFERENCES "public"."pedidos_venda_itens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "associacoes_peca_historico" ADD CONSTRAINT "associacoes_peca_historico_operador_id_usuarios_id_fk" FOREIGN KEY ("operador_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etiquetas_impressoes" ADD CONSTRAINT "etiquetas_impressoes_peca_id_pecas_id_fk" FOREIGN KEY ("peca_id") REFERENCES "public"."pecas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etiquetas_impressoes" ADD CONSTRAINT "etiquetas_impressoes_operador_id_usuarios_id_fk" FOREIGN KEY ("operador_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pecas" ADD CONSTRAINT "pecas_compra_programada_id_compras_programadas_id_fk" FOREIGN KEY ("compra_programada_id") REFERENCES "public"."compras_programadas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pecas" ADD CONSTRAINT "pecas_recebimento_id_recebimentos_id_fk" FOREIGN KEY ("recebimento_id") REFERENCES "public"."recebimentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pecas" ADD CONSTRAINT "pecas_item_comercial_base_id_itens_comerciais_id_fk" FOREIGN KEY ("item_comercial_base_id") REFERENCES "public"."itens_comerciais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pecas" ADD CONSTRAINT "pecas_pedido_venda_id_pedidos_venda_id_fk" FOREIGN KEY ("pedido_venda_id") REFERENCES "public"."pedidos_venda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pecas" ADD CONSTRAINT "pecas_pedido_venda_item_id_pedidos_venda_itens_id_fk" FOREIGN KEY ("pedido_venda_item_id") REFERENCES "public"."pedidos_venda_itens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_assoc_hist_peca" ON "associacoes_peca_historico" USING btree ("peca_id");--> statement-breakpoint
CREATE INDEX "idx_assoc_hist_destino" ON "associacoes_peca_historico" USING btree ("pedido_destino_id");--> statement-breakpoint
CREATE INDEX "idx_etiq_peca" ON "etiquetas_impressoes" USING btree ("peca_id");--> statement-breakpoint
CREATE INDEX "idx_etiq_payload_gin" ON "etiquetas_impressoes" USING gin ("payload");--> statement-breakpoint
CREATE INDEX "idx_pecas_recebimento" ON "pecas" USING btree ("recebimento_id") WHERE "pecas"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_pecas_compra" ON "pecas" USING btree ("compra_programada_id") WHERE "pecas"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_pecas_status" ON "pecas" USING btree ("status_peca") WHERE "pecas"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_pecas_pedido_item" ON "pecas" USING btree ("pedido_venda_item_id") WHERE "pecas"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_pecas_captura_meta_gin" ON "pecas" USING gin ("captura_meta");--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" ADD CONSTRAINT "chk_pedidos_itens_atendida_nao_negativa" CHECK ("pedidos_venda_itens"."quantidade_atendida" >= 0);--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" ADD CONSTRAINT "chk_pedidos_itens_atendida_ate_pedida" CHECK ("pedidos_venda_itens"."quantidade_atendida" <= "pedidos_venda_itens"."quantidade_pedida");--> statement-breakpoint
-- Trigger set_updated_at (a função já existe desde a migration 0000) — SQL manual.
CREATE TRIGGER trg_pecas_updated_at BEFORE UPDATE ON "pecas" FOR EACH ROW EXECUTE FUNCTION set_updated_at();