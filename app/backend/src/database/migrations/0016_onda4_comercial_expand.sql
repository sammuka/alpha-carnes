CREATE TABLE "adendos_pedido" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"pedido_venda_id" uuid NOT NULL,
	"pedido_venda_item_id" uuid NOT NULL,
	"item_comercial_id" uuid NOT NULL,
	"operacao_id" uuid NOT NULL,
	"quantidade_anterior" numeric(10, 3) NOT NULL,
	"quantidade_adicionada" numeric(10, 3) NOT NULL,
	"quantidade_resultante" numeric(10, 3) NOT NULL,
	"origem_consumo" text NOT NULL,
	"motivo" text NOT NULL,
	"autor_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_adendos_pedido_quantidade" CHECK ("adendos_pedido"."quantidade_adicionada" > 0),
	CONSTRAINT "chk_adendos_pedido_origem" CHECK ("adendos_pedido"."origem_consumo" IN ('fisico','virtual','overbooking'))
);
--> statement-breakpoint
CREATE TABLE "tabelas_preco" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"data" date NOT NULL,
	"status" text DEFAULT 'rascunho' NOT NULL,
	"observacao" text,
	"publicada_por" uuid,
	"publicada_em" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_tabelas_preco_status" CHECK ("tabelas_preco"."status" IN ('rascunho','publicada'))
);
--> statement-breakpoint
CREATE TABLE "tabelas_preco_itens" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tabela_preco_id" uuid NOT NULL,
	"produto_id" uuid NOT NULL,
	"preco_a" numeric(15, 2),
	"preco_b" numeric(15, 2),
	"preco_c" numeric(15, 2),
	"preco_d" numeric(15, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_tabelas_preco_itens_positivos" CHECK (
      ("tabelas_preco_itens"."preco_a" IS NULL OR "tabelas_preco_itens"."preco_a" > 0) AND ("tabelas_preco_itens"."preco_b" IS NULL OR "tabelas_preco_itens"."preco_b" > 0) AND
      ("tabelas_preco_itens"."preco_c" IS NULL OR "tabelas_preco_itens"."preco_c" > 0) AND ("tabelas_preco_itens"."preco_d" IS NULL OR "tabelas_preco_itens"."preco_d" > 0)
    )
);
--> statement-breakpoint
CREATE TABLE "tabelas_preco_publicacoes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tabela_preco_id" uuid NOT NULL,
	"acao" text NOT NULL,
	"autor_id" uuid NOT NULL,
	"observacao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_tabelas_preco_publicacoes_acao" CHECK ("tabelas_preco_publicacoes"."acao" IN ('publicada','revertida_para_rascunho'))
);
--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "rota_id" uuid;--> statement-breakpoint
ALTER TABLE "adendos_pedido" ADD CONSTRAINT "adendos_pedido_pedido_venda_id_pedidos_venda_id_fk" FOREIGN KEY ("pedido_venda_id") REFERENCES "public"."pedidos_venda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adendos_pedido" ADD CONSTRAINT "adendos_pedido_pedido_venda_item_id_pedidos_venda_itens_id_fk" FOREIGN KEY ("pedido_venda_item_id") REFERENCES "public"."pedidos_venda_itens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adendos_pedido" ADD CONSTRAINT "adendos_pedido_item_comercial_id_itens_comerciais_id_fk" FOREIGN KEY ("item_comercial_id") REFERENCES "public"."itens_comerciais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adendos_pedido" ADD CONSTRAINT "adendos_pedido_operacao_id_operacoes_id_fk" FOREIGN KEY ("operacao_id") REFERENCES "public"."operacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adendos_pedido" ADD CONSTRAINT "adendos_pedido_autor_id_usuarios_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tabelas_preco" ADD CONSTRAINT "tabelas_preco_publicada_por_usuarios_id_fk" FOREIGN KEY ("publicada_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tabelas_preco_itens" ADD CONSTRAINT "tabelas_preco_itens_tabela_preco_id_tabelas_preco_id_fk" FOREIGN KEY ("tabela_preco_id") REFERENCES "public"."tabelas_preco"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tabelas_preco_itens" ADD CONSTRAINT "tabelas_preco_itens_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tabelas_preco_publicacoes" ADD CONSTRAINT "tabelas_preco_publicacoes_tabela_preco_id_tabelas_preco_id_fk" FOREIGN KEY ("tabela_preco_id") REFERENCES "public"."tabelas_preco"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tabelas_preco_publicacoes" ADD CONSTRAINT "tabelas_preco_publicacoes_autor_id_usuarios_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_adendos_pedido_pedido" ON "adendos_pedido" USING btree ("pedido_venda_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tabelas_preco_data" ON "tabelas_preco" USING btree ("data") WHERE "tabelas_preco"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tabelas_preco_itens_produto" ON "tabelas_preco_itens" USING btree ("tabela_preco_id","produto_id");--> statement-breakpoint
CREATE INDEX "idx_tabelas_preco_publicacoes_tabela" ON "tabelas_preco_publicacoes" USING btree ("tabela_preco_id");--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_rota_id_rotas_id_fk" FOREIGN KEY ("rota_id") REFERENCES "public"."rotas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_clientes_rota" ON "clientes" USING btree ("rota_id") WHERE "clientes"."deleted_at" IS NULL;