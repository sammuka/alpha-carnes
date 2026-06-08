CREATE TABLE "caminhoes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"placa" text NOT NULL,
	"motorista" text NOT NULL,
	"rota" text,
	"itinerario" text,
	"data_operacao" date NOT NULL,
	"status_caminhao" text DEFAULT 'planejado' NOT NULL,
	"hora_abertura_carga" timestamp with time zone,
	"hora_fechamento_carga" timestamp with time zone,
	"hora_liberacao" timestamp with time zone,
	"observacoes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_caminhoes_status" CHECK ("caminhoes"."status_caminhao" IN ('planejado','aguardando_carga','em_carga','em_conferencia','fechado','liberado_faturamento','faturado','liberado_saida','expedido'))
);
--> statement-breakpoint
CREATE TABLE "caminhoes_pedidos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"caminhao_id" uuid NOT NULL,
	"pedido_venda_id" uuid NOT NULL,
	"ordem_na_carga" integer,
	"status_na_carga" text DEFAULT 'planejado' NOT NULL,
	"observacoes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_caminhoes_pedidos_status" CHECK ("caminhoes_pedidos"."status_na_carga" IN ('planejado','em_carga','completo','parcial'))
);
--> statement-breakpoint
CREATE TABLE "carga_itens" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"caminhao_id" uuid NOT NULL,
	"tipo_origem" text NOT NULL,
	"peca_id" uuid,
	"subitem_id" uuid,
	"pedido_venda_id" uuid NOT NULL,
	"pedido_venda_item_id" uuid NOT NULL,
	"data_hora_entrada_carga" timestamp with time zone DEFAULT now() NOT NULL,
	"status_carga_item" text DEFAULT 'em_carga' NOT NULL,
	"conferido" boolean DEFAULT false NOT NULL,
	"observacoes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_carga_itens_tipo_origem" CHECK ("carga_itens"."tipo_origem" IN ('peca','subitem')),
	CONSTRAINT "chk_carga_itens_xor_alvo" CHECK (("carga_itens"."peca_id" IS NOT NULL)::int + ("carga_itens"."subitem_id" IS NOT NULL)::int = 1),
	CONSTRAINT "chk_carga_itens_status" CHECK ("carga_itens"."status_carga_item" IN ('em_carga','conferido','removido'))
);
--> statement-breakpoint
CREATE TABLE "conferencias_carga" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"caminhao_id" uuid NOT NULL,
	"operador_responsavel_id" uuid NOT NULL,
	"data_hora_inicio" timestamp with time zone DEFAULT now() NOT NULL,
	"data_hora_fim" timestamp with time zone,
	"status_conferencia" text DEFAULT 'aberta' NOT NULL,
	"pendencias" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"observacoes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_conferencias_status" CHECK ("conferencias_carga"."status_conferencia" IN ('aberta','concluida'))
);
--> statement-breakpoint
ALTER TABLE "associacoes_peca_historico" ALTER COLUMN "peca_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "associacoes_peca_historico" ADD COLUMN "subitem_id" uuid;--> statement-breakpoint
ALTER TABLE "caminhoes_pedidos" ADD CONSTRAINT "caminhoes_pedidos_caminhao_id_caminhoes_id_fk" FOREIGN KEY ("caminhao_id") REFERENCES "public"."caminhoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caminhoes_pedidos" ADD CONSTRAINT "caminhoes_pedidos_pedido_venda_id_pedidos_venda_id_fk" FOREIGN KEY ("pedido_venda_id") REFERENCES "public"."pedidos_venda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carga_itens" ADD CONSTRAINT "carga_itens_caminhao_id_caminhoes_id_fk" FOREIGN KEY ("caminhao_id") REFERENCES "public"."caminhoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carga_itens" ADD CONSTRAINT "carga_itens_peca_id_pecas_id_fk" FOREIGN KEY ("peca_id") REFERENCES "public"."pecas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carga_itens" ADD CONSTRAINT "carga_itens_subitem_id_subitens_id_fk" FOREIGN KEY ("subitem_id") REFERENCES "public"."subitens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carga_itens" ADD CONSTRAINT "carga_itens_pedido_venda_id_pedidos_venda_id_fk" FOREIGN KEY ("pedido_venda_id") REFERENCES "public"."pedidos_venda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carga_itens" ADD CONSTRAINT "carga_itens_pedido_venda_item_id_pedidos_venda_itens_id_fk" FOREIGN KEY ("pedido_venda_item_id") REFERENCES "public"."pedidos_venda_itens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conferencias_carga" ADD CONSTRAINT "conferencias_carga_caminhao_id_caminhoes_id_fk" FOREIGN KEY ("caminhao_id") REFERENCES "public"."caminhoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conferencias_carga" ADD CONSTRAINT "conferencias_carga_operador_responsavel_id_usuarios_id_fk" FOREIGN KEY ("operador_responsavel_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_caminhoes_data_operacao" ON "caminhoes" USING btree ("data_operacao") WHERE "caminhoes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_caminhoes_status" ON "caminhoes" USING btree ("status_caminhao") WHERE "caminhoes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_caminhoes_pedidos_caminhao_pedido" ON "caminhoes_pedidos" USING btree ("caminhao_id","pedido_venda_id") WHERE "caminhoes_pedidos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_carga_itens_peca" ON "carga_itens" USING btree ("peca_id") WHERE "carga_itens"."peca_id" IS NOT NULL AND "carga_itens"."status_carga_item" <> 'removido' AND "carga_itens"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_carga_itens_subitem" ON "carga_itens" USING btree ("subitem_id") WHERE "carga_itens"."subitem_id" IS NOT NULL AND "carga_itens"."status_carga_item" <> 'removido' AND "carga_itens"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_carga_itens_caminhao" ON "carga_itens" USING btree ("caminhao_id") WHERE "carga_itens"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_conferencias_caminhao" ON "conferencias_carga" USING btree ("caminhao_id") WHERE "conferencias_carga"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_assoc_hist_subitem" ON "associacoes_peca_historico" USING btree ("subitem_id") WHERE "associacoes_peca_historico"."subitem_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "associacoes_peca_historico" ADD CONSTRAINT "chk_assoc_hist_um_alvo" CHECK (("associacoes_peca_historico"."peca_id" IS NOT NULL)::int + ("associacoes_peca_historico"."subitem_id" IS NOT NULL)::int = 1);
--> statement-breakpoint
ALTER TABLE "associacoes_peca_historico" ADD CONSTRAINT "assoc_hist_subitem_id_subitens_id_fk" FOREIGN KEY ("subitem_id") REFERENCES "public"."subitens"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TRIGGER trg_caminhoes_updated_at BEFORE UPDATE ON "caminhoes" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_caminhoes_pedidos_updated_at BEFORE UPDATE ON "caminhoes_pedidos" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_carga_itens_updated_at BEFORE UPDATE ON "carga_itens" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_conferencias_carga_updated_at BEFORE UPDATE ON "conferencias_carga" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
