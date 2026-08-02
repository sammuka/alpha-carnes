CREATE TABLE "ajustes_estoque" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tipo_alvo" text NOT NULL,
	"peca_id" uuid,
	"subitem_id" uuid,
	"entrada_id" uuid,
	"produto_codigo" text NOT NULL,
	"quantidade_delta" integer NOT NULL,
	"quantidade_anterior" integer NOT NULL,
	"motivo" text NOT NULL,
	"descricao" text,
	"status" text DEFAULT 'aplicado' NOT NULL,
	"criado_por" uuid NOT NULL,
	"decidido_por" uuid,
	"decidido_em" timestamp with time zone,
	"decisao_motivo" text,
	"aprovacao_operacional_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_ajustes_tipo_alvo" CHECK ("ajustes_estoque"."tipo_alvo" IN ('peca','subitem','entrada')),
	CONSTRAINT "chk_ajustes_um_alvo" CHECK (("ajustes_estoque"."peca_id" IS NOT NULL)::int + ("ajustes_estoque"."subitem_id" IS NOT NULL)::int + ("ajustes_estoque"."entrada_id" IS NOT NULL)::int = 1),
	CONSTRAINT "chk_ajustes_delta" CHECK ("ajustes_estoque"."quantidade_delta" <> 0),
	CONSTRAINT "chk_ajustes_motivo" CHECK ("ajustes_estoque"."motivo" IN ('quebra','perda','erro_contagem','vencimento','outro')),
	CONSTRAINT "chk_ajustes_status" CHECK ("ajustes_estoque"."status" IN ('aplicado','aguardando_aprovacao','rejeitado'))
);
--> statement-breakpoint
CREATE TABLE "entradas_itens" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"produto_id" uuid NOT NULL,
	"quantidade" integer NOT NULL,
	"quantidade_destinada" integer DEFAULT 0 NOT NULL,
	"unidade" text DEFAULT 'caixa' NOT NULL,
	"fornecedor_nome" text NOT NULL,
	"lote_nf" text,
	"local" text,
	"destino" text NOT NULL,
	"pedido_id" uuid,
	"pedido_venda_item_id" uuid,
	"observacao" text,
	"registrado_por" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_entradas_itens_qtd" CHECK ("entradas_itens"."quantidade" > 0),
	CONSTRAINT "chk_entradas_itens_destinada" CHECK ("entradas_itens"."quantidade_destinada" >= 0 AND "entradas_itens"."quantidade_destinada" <= "entradas_itens"."quantidade"),
	CONSTRAINT "chk_entradas_itens_unidade" CHECK ("entradas_itens"."unidade" IN ('caixa','unidade')),
	CONSTRAINT "chk_entradas_itens_destino" CHECK ("entradas_itens"."destino" IN ('estoque','pedido'))
);
--> statement-breakpoint
ALTER TABLE "associacoes_peca_historico" DROP CONSTRAINT "chk_assoc_hist_acao";--> statement-breakpoint
ALTER TABLE "ajustes_estoque" ADD CONSTRAINT "ajustes_estoque_peca_id_pecas_id_fk" FOREIGN KEY ("peca_id") REFERENCES "public"."pecas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ajustes_estoque" ADD CONSTRAINT "ajustes_estoque_subitem_id_subitens_id_fk" FOREIGN KEY ("subitem_id") REFERENCES "public"."subitens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ajustes_estoque" ADD CONSTRAINT "ajustes_estoque_entrada_id_entradas_itens_id_fk" FOREIGN KEY ("entrada_id") REFERENCES "public"."entradas_itens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ajustes_estoque" ADD CONSTRAINT "ajustes_estoque_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ajustes_estoque" ADD CONSTRAINT "ajustes_estoque_decidido_por_usuarios_id_fk" FOREIGN KEY ("decidido_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ajustes_estoque" ADD CONSTRAINT "ajustes_estoque_aprovacao_operacional_id_aprovacoes_operacionais_id_fk" FOREIGN KEY ("aprovacao_operacional_id") REFERENCES "public"."aprovacoes_operacionais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entradas_itens" ADD CONSTRAINT "entradas_itens_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entradas_itens" ADD CONSTRAINT "entradas_itens_pedido_id_pedidos_venda_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos_venda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entradas_itens" ADD CONSTRAINT "entradas_itens_pedido_venda_item_id_pedidos_venda_itens_id_fk" FOREIGN KEY ("pedido_venda_item_id") REFERENCES "public"."pedidos_venda_itens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entradas_itens" ADD CONSTRAINT "entradas_itens_registrado_por_usuarios_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ajustes_status" ON "ajustes_estoque" USING btree ("status") WHERE "ajustes_estoque"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_ajustes_created" ON "ajustes_estoque" USING btree ("created_at") WHERE "ajustes_estoque"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_entradas_itens_produto" ON "entradas_itens" USING btree ("produto_id") WHERE "entradas_itens"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_entradas_itens_created" ON "entradas_itens" USING btree ("created_at") WHERE "entradas_itens"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "associacoes_peca_historico" ADD CONSTRAINT "chk_assoc_hist_acao" CHECK ("associacoes_peca_historico"."acao" IN ('confirmar','redirecionar','sobra','analise','corte','divergencia','estorno','troca_saida','troca_entrada','destinar_estoque'));