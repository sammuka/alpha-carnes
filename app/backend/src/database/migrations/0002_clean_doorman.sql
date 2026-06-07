CREATE TABLE "compras_programadas" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"data_operacao" date NOT NULL,
	"fornecedor_id" uuid NOT NULL,
	"numero_interno" text,
	"referencia_externa" text,
	"previsao_entrega" timestamp with time zone,
	"status" text DEFAULT 'rascunho' NOT NULL,
	"observacoes" text,
	"data_confirmacao" timestamp with time zone,
	"usuario_criacao_id" uuid NOT NULL,
	"usuario_confirmacao_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_compras_prog_status" CHECK ("compras_programadas"."status" IN ('rascunho','em_negociacao','confirmada','cancelada'))
);
--> statement-breakpoint
CREATE TABLE "compras_programadas_itens" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"compra_programada_id" uuid NOT NULL,
	"item_compra_id" uuid NOT NULL,
	"quantidade_comprada" numeric(15, 3) NOT NULL,
	"observacoes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_compras_prog_itens_qtd_positiva" CHECK ("compras_programadas_itens"."quantidade_comprada" > 0)
);
--> statement-breakpoint
CREATE TABLE "disponibilidades_virtuais" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"compra_programada_id" uuid NOT NULL,
	"data_operacao" date NOT NULL,
	"item_comercial_id" uuid NOT NULL,
	"quantidade_total_gerada" numeric(15, 3) NOT NULL,
	"quantidade_reservada" numeric(15, 3) DEFAULT '0' NOT NULL,
	"quantidade_disponivel" numeric(15, 3) NOT NULL,
	"status" text DEFAULT 'gerada' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_disp_disponivel_nao_negativo" CHECK ("disponibilidades_virtuais"."quantidade_disponivel" >= 0),
	CONSTRAINT "chk_disp_reservada_nao_negativo" CHECK ("disponibilidades_virtuais"."quantidade_reservada" >= 0),
	CONSTRAINT "chk_disp_status" CHECK ("disponibilidades_virtuais"."status" IN ('gerada','parcialmente_reservada','esgotada'))
);
--> statement-breakpoint
CREATE TABLE "pedidos_venda" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"compra_programada_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"data_operacao" date NOT NULL,
	"data_entrega" date,
	"rota_prevista" text,
	"prioridade" integer,
	"status" text DEFAULT 'reservado' NOT NULL,
	"observacoes_gerais" text,
	"usuario_criacao_id" uuid NOT NULL,
	"usuario_aprovacao_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_pedidos_venda_status" CHECK ("pedidos_venda"."status" IN ('reservado','parcialmente_reservado','cancelado'))
);
--> statement-breakpoint
CREATE TABLE "pedidos_venda_itens" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"pedido_venda_id" uuid NOT NULL,
	"item_comercial_id" uuid NOT NULL,
	"quantidade_pedida" numeric(15, 3) NOT NULL,
	"quantidade_reservada" numeric(15, 3) DEFAULT '0' NOT NULL,
	"quantidade_pendente" numeric(15, 3) DEFAULT '0' NOT NULL,
	"preferencias_aplicadas_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text NOT NULL,
	"observacoes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_pedidos_itens_pedida_positiva" CHECK ("pedidos_venda_itens"."quantidade_pedida" > 0),
	CONSTRAINT "chk_pedidos_itens_reservada_nao_negativa" CHECK ("pedidos_venda_itens"."quantidade_reservada" >= 0),
	CONSTRAINT "chk_pedidos_itens_pendente_nao_negativa" CHECK ("pedidos_venda_itens"."quantidade_pendente" >= 0),
	CONSTRAINT "chk_pedidos_itens_status" CHECK ("pedidos_venda_itens"."status" IN ('totalmente_reservado','parcialmente_reservado','sem_cobertura','cancelado'))
);
--> statement-breakpoint
CREATE TABLE "reservas_disponibilidade" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"disponibilidade_virtual_id" uuid NOT NULL,
	"pedido_venda_item_id" uuid NOT NULL,
	"quantidade_reservada" numeric(15, 3) NOT NULL,
	"status" text DEFAULT 'ativa' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_reservas_qtd_positiva" CHECK ("reservas_disponibilidade"."quantidade_reservada" > 0),
	CONSTRAINT "chk_reservas_status" CHECK ("reservas_disponibilidade"."status" IN ('ativa','liberada'))
);
--> statement-breakpoint
ALTER TABLE "compras_programadas" ADD CONSTRAINT "compras_programadas_fornecedor_id_fornecedores_id_fk" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."fornecedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras_programadas" ADD CONSTRAINT "compras_programadas_usuario_criacao_id_usuarios_id_fk" FOREIGN KEY ("usuario_criacao_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras_programadas" ADD CONSTRAINT "compras_programadas_usuario_confirmacao_id_usuarios_id_fk" FOREIGN KEY ("usuario_confirmacao_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras_programadas_itens" ADD CONSTRAINT "compras_programadas_itens_compra_programada_id_compras_programadas_id_fk" FOREIGN KEY ("compra_programada_id") REFERENCES "public"."compras_programadas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras_programadas_itens" ADD CONSTRAINT "compras_programadas_itens_item_compra_id_itens_compra_id_fk" FOREIGN KEY ("item_compra_id") REFERENCES "public"."itens_compra"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disponibilidades_virtuais" ADD CONSTRAINT "disponibilidades_virtuais_compra_programada_id_compras_programadas_id_fk" FOREIGN KEY ("compra_programada_id") REFERENCES "public"."compras_programadas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disponibilidades_virtuais" ADD CONSTRAINT "disponibilidades_virtuais_item_comercial_id_itens_comerciais_id_fk" FOREIGN KEY ("item_comercial_id") REFERENCES "public"."itens_comerciais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos_venda" ADD CONSTRAINT "pedidos_venda_compra_programada_id_compras_programadas_id_fk" FOREIGN KEY ("compra_programada_id") REFERENCES "public"."compras_programadas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos_venda" ADD CONSTRAINT "pedidos_venda_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos_venda" ADD CONSTRAINT "pedidos_venda_usuario_criacao_id_usuarios_id_fk" FOREIGN KEY ("usuario_criacao_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos_venda" ADD CONSTRAINT "pedidos_venda_usuario_aprovacao_id_usuarios_id_fk" FOREIGN KEY ("usuario_aprovacao_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" ADD CONSTRAINT "pedidos_venda_itens_pedido_venda_id_pedidos_venda_id_fk" FOREIGN KEY ("pedido_venda_id") REFERENCES "public"."pedidos_venda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" ADD CONSTRAINT "pedidos_venda_itens_item_comercial_id_itens_comerciais_id_fk" FOREIGN KEY ("item_comercial_id") REFERENCES "public"."itens_comerciais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas_disponibilidade" ADD CONSTRAINT "reservas_disponibilidade_disponibilidade_virtual_id_disponibilidades_virtuais_id_fk" FOREIGN KEY ("disponibilidade_virtual_id") REFERENCES "public"."disponibilidades_virtuais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas_disponibilidade" ADD CONSTRAINT "reservas_disponibilidade_pedido_venda_item_id_pedidos_venda_itens_id_fk" FOREIGN KEY ("pedido_venda_item_id") REFERENCES "public"."pedidos_venda_itens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_compras_prog_data_operacao" ON "compras_programadas" USING btree ("data_operacao") WHERE "compras_programadas"."deleted_at" IS NULL AND "compras_programadas"."status" <> 'cancelada';--> statement-breakpoint
CREATE INDEX "idx_compras_prog_status" ON "compras_programadas" USING btree ("status") WHERE "compras_programadas"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_compras_prog_fornecedor" ON "compras_programadas" USING btree ("fornecedor_id") WHERE "compras_programadas"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_compras_prog_itens_compra" ON "compras_programadas_itens" USING btree ("compra_programada_id") WHERE "compras_programadas_itens"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_compras_prog_itens_item_compra" ON "compras_programadas_itens" USING btree ("item_compra_id") WHERE "compras_programadas_itens"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_disp_compra_item" ON "disponibilidades_virtuais" USING btree ("compra_programada_id","item_comercial_id");--> statement-breakpoint
CREATE INDEX "idx_disp_data_operacao" ON "disponibilidades_virtuais" USING btree ("data_operacao");--> statement-breakpoint
CREATE INDEX "idx_disp_item_comercial" ON "disponibilidades_virtuais" USING btree ("item_comercial_id");--> statement-breakpoint
CREATE INDEX "idx_pedidos_venda_compra" ON "pedidos_venda" USING btree ("compra_programada_id") WHERE "pedidos_venda"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_pedidos_venda_cliente" ON "pedidos_venda" USING btree ("cliente_id") WHERE "pedidos_venda"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_pedidos_venda_status" ON "pedidos_venda" USING btree ("status") WHERE "pedidos_venda"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_pedidos_venda_data_operacao" ON "pedidos_venda" USING btree ("data_operacao") WHERE "pedidos_venda"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_pedidos_itens_pedido" ON "pedidos_venda_itens" USING btree ("pedido_venda_id");--> statement-breakpoint
CREATE INDEX "idx_pedidos_itens_item_comercial" ON "pedidos_venda_itens" USING btree ("item_comercial_id");--> statement-breakpoint
CREATE INDEX "idx_pedidos_itens_preferencias_gin" ON "pedidos_venda_itens" USING gin ("preferencias_aplicadas_json");--> statement-breakpoint
CREATE INDEX "idx_reservas_disponibilidade" ON "reservas_disponibilidade" USING btree ("disponibilidade_virtual_id");--> statement-breakpoint
CREATE INDEX "idx_reservas_pedido_item" ON "reservas_disponibilidade" USING btree ("pedido_venda_item_id");--> statement-breakpoint
-- Triggers set_updated_at (a função já existe desde a migration 0000) — SQL manual.
CREATE TRIGGER trg_compras_programadas_updated_at BEFORE UPDATE ON "compras_programadas" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_compras_programadas_itens_updated_at BEFORE UPDATE ON "compras_programadas_itens" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_disponibilidades_virtuais_updated_at BEFORE UPDATE ON "disponibilidades_virtuais" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_pedidos_venda_updated_at BEFORE UPDATE ON "pedidos_venda" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_pedidos_venda_itens_updated_at BEFORE UPDATE ON "pedidos_venda_itens" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_reservas_disponibilidade_updated_at BEFORE UPDATE ON "reservas_disponibilidade" FOR EACH ROW EXECUTE FUNCTION set_updated_at();