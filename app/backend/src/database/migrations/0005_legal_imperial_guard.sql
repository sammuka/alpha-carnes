CREATE TABLE "subitens" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"transformacao_id" uuid NOT NULL,
	"peca_origem_id" uuid NOT NULL,
	"item_comercial_id" uuid NOT NULL,
	"classificacao" text,
	"peso" numeric(10, 3),
	"quantidade" numeric(10, 3) DEFAULT '1' NOT NULL,
	"modo_captura_peso" text,
	"captura_meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status_subitem" text DEFAULT 'gerado' NOT NULL,
	"etiqueta_atual" text,
	"pedido_venda_id" uuid,
	"pedido_venda_item_id" uuid,
	"caminhao_id" uuid,
	"observacoes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_subitens_modo_captura" CHECK ("subitens"."modo_captura_peso" IS NULL OR "subitens"."modo_captura_peso" IN ('automatico','manual_assistido')),
	CONSTRAINT "chk_subitens_peso_positivo" CHECK ("subitens"."peso" IS NULL OR "subitens"."peso" > 0),
	CONSTRAINT "chk_subitens_status" CHECK ("subitens"."status_subitem" IN ('gerado','pesado','associado','em_sobra','em_analise'))
);
--> statement-breakpoint
CREATE TABLE "transformacoes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"peca_origem_id" uuid NOT NULL,
	"tipo_transformacao" text NOT NULL,
	"motivo" text NOT NULL,
	"motivo_detalhe" text,
	"operador_responsavel_id" uuid NOT NULL,
	"status_transformacao" text DEFAULT 'aberta' NOT NULL,
	"data_hora_abertura" timestamp with time zone DEFAULT now() NOT NULL,
	"data_hora_encerramento" timestamp with time zone,
	"peso_original" numeric(10, 3) NOT NULL,
	"peso_subitens_total" numeric(10, 3),
	"diferenca_peso" numeric(10, 3),
	"justificativa_diferenca" text,
	"observacoes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_transf_tipo" CHECK ("transformacoes"."tipo_transformacao" IN ('simples','subdivisao','reclassificacao','destinacao_mista')),
	CONSTRAINT "chk_transf_motivo" CHECK ("transformacoes"."motivo" IN ('preferencia_cliente','necessidade_operacional','divergencia','decisao_humana')),
	CONSTRAINT "chk_transf_status" CHECK ("transformacoes"."status_transformacao" IN ('aberta','em_execucao','aguardando_pesagem','aguardando_associacao','aguardando_etiquetagem','concluida','cancelada'))
);
--> statement-breakpoint
ALTER TABLE "pecas" DROP CONSTRAINT "chk_pecas_status";--> statement-breakpoint
ALTER TABLE "etiquetas_impressoes" ALTER COLUMN "peca_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "etiquetas_impressoes" ADD COLUMN "subitem_id" uuid;--> statement-breakpoint
ALTER TABLE "subitens" ADD CONSTRAINT "subitens_transformacao_id_transformacoes_id_fk" FOREIGN KEY ("transformacao_id") REFERENCES "public"."transformacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subitens" ADD CONSTRAINT "subitens_peca_origem_id_pecas_id_fk" FOREIGN KEY ("peca_origem_id") REFERENCES "public"."pecas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subitens" ADD CONSTRAINT "subitens_item_comercial_id_itens_comerciais_id_fk" FOREIGN KEY ("item_comercial_id") REFERENCES "public"."itens_comerciais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subitens" ADD CONSTRAINT "subitens_pedido_venda_id_pedidos_venda_id_fk" FOREIGN KEY ("pedido_venda_id") REFERENCES "public"."pedidos_venda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subitens" ADD CONSTRAINT "subitens_pedido_venda_item_id_pedidos_venda_itens_id_fk" FOREIGN KEY ("pedido_venda_item_id") REFERENCES "public"."pedidos_venda_itens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transformacoes" ADD CONSTRAINT "transformacoes_peca_origem_id_pecas_id_fk" FOREIGN KEY ("peca_origem_id") REFERENCES "public"."pecas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transformacoes" ADD CONSTRAINT "transformacoes_operador_responsavel_id_usuarios_id_fk" FOREIGN KEY ("operador_responsavel_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_subitens_transformacao" ON "subitens" USING btree ("transformacao_id") WHERE "subitens"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_subitens_peca_origem" ON "subitens" USING btree ("peca_origem_id") WHERE "subitens"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_subitens_pedido_item" ON "subitens" USING btree ("pedido_venda_item_id") WHERE "subitens"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_subitens_captura_meta_gin" ON "subitens" USING gin ("captura_meta");--> statement-breakpoint
CREATE INDEX "idx_transf_peca_origem" ON "transformacoes" USING btree ("peca_origem_id") WHERE "transformacoes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_transf_status" ON "transformacoes" USING btree ("status_transformacao") WHERE "transformacoes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_etiq_subitem" ON "etiquetas_impressoes" USING btree ("subitem_id");--> statement-breakpoint
ALTER TABLE "etiquetas_impressoes" ADD CONSTRAINT "chk_etiq_um_alvo" CHECK (("etiquetas_impressoes"."peca_id" IS NOT NULL)::int + ("etiquetas_impressoes"."subitem_id" IS NOT NULL)::int = 1);--> statement-breakpoint
ALTER TABLE "pecas" ADD CONSTRAINT "chk_pecas_status" CHECK ("pecas"."status_peca" IN ('pesada','associada','em_sobra','em_analise','para_corte','divergente','em_transformacao','transformada'));--> statement-breakpoint
ALTER TABLE "etiquetas_impressoes" ADD CONSTRAINT "etiquetas_impressoes_subitem_id_subitens_id_fk" FOREIGN KEY ("subitem_id") REFERENCES "public"."subitens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE TRIGGER trg_transformacoes_updated_at BEFORE UPDATE ON "transformacoes" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_subitens_updated_at BEFORE UPDATE ON "subitens" FOR EACH ROW EXECUTE FUNCTION set_updated_at();