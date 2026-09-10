CREATE TABLE IF NOT EXISTS "ocorrencias_ajuste_preco" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"pedido_venda_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"status" text DEFAULT 'aberta' NOT NULL,
	"quantidade_itens_ajustados" integer NOT NULL,
	"diferenca_total" numeric(15, 2) NOT NULL,
	"usuario_finalizacao_id" uuid NOT NULL,
	"data_hora_ocorrencia" timestamp with time zone DEFAULT now() NOT NULL,
	"usuario_ciente_id" uuid,
	"data_hora_ciente" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_ocorr_ajuste_preco_status" CHECK ("status" IN ('aberta','ciente'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ocorrencias_ajuste_preco_itens" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"ocorrencia_id" uuid NOT NULL,
	"pedido_venda_item_id" uuid NOT NULL,
	"produto_id" uuid NOT NULL,
	"preco_tabela_original" numeric(15, 2),
	"preco_aplicado" numeric(15, 2) NOT NULL,
	"diferenca_absoluta" numeric(15, 2) NOT NULL,
	"diferenca_percentual" numeric(10, 4),
	"usuario_ajuste_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ocorrencias_ajuste_preco" ADD CONSTRAINT "ocorrencias_ajuste_preco_pedido_venda_id_pedidos_venda_id_fk" FOREIGN KEY ("pedido_venda_id") REFERENCES "public"."pedidos_venda"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ocorrencias_ajuste_preco" ADD CONSTRAINT "ocorrencias_ajuste_preco_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ocorrencias_ajuste_preco" ADD CONSTRAINT "ocorrencias_ajuste_preco_usuario_finalizacao_id_usuarios_id_fk" FOREIGN KEY ("usuario_finalizacao_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ocorrencias_ajuste_preco" ADD CONSTRAINT "ocorrencias_ajuste_preco_usuario_ciente_id_usuarios_id_fk" FOREIGN KEY ("usuario_ciente_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ocorrencias_ajuste_preco_itens" ADD CONSTRAINT "ocorrencias_ajuste_preco_itens_ocorrencia_id_ocorrencias_ajuste_preco_id_fk" FOREIGN KEY ("ocorrencia_id") REFERENCES "public"."ocorrencias_ajuste_preco"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ocorrencias_ajuste_preco_itens" ADD CONSTRAINT "ocorrencias_ajuste_preco_itens_pedido_venda_item_id_pedidos_venda_itens_id_fk" FOREIGN KEY ("pedido_venda_item_id") REFERENCES "public"."pedidos_venda_itens"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ocorrencias_ajuste_preco_itens" ADD CONSTRAINT "ocorrencias_ajuste_preco_itens_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ocorrencias_ajuste_preco_itens" ADD CONSTRAINT "ocorrencias_ajuste_preco_itens_usuario_ajuste_id_usuarios_id_fk" FOREIGN KEY ("usuario_ajuste_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_ocorr_ajuste_preco_pedido" ON "ocorrencias_ajuste_preco" USING btree ("pedido_venda_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ocorr_ajuste_preco_status" ON "ocorrencias_ajuste_preco" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ocorr_ajuste_preco_data" ON "ocorrencias_ajuste_preco" USING btree ("data_hora_ocorrencia");
