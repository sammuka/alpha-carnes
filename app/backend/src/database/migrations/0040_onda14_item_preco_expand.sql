ALTER TABLE "pedidos_venda_itens" ADD COLUMN "tabela_preco_id" uuid;--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" ADD COLUMN "faixa_preco" text;--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" ADD COLUMN "unidade_preco" text;--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" ADD COLUMN "preco_tabela_original" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" ADD COLUMN "preco_aplicado" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" ADD COLUMN "usuario_ajuste_id" uuid;--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" ADD COLUMN "ajustado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" ADD CONSTRAINT "pedidos_venda_itens_tabela_preco_id_tabelas_preco_id_fk" FOREIGN KEY ("tabela_preco_id") REFERENCES "public"."tabelas_preco"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" ADD CONSTRAINT "pedidos_venda_itens_usuario_ajuste_id_usuarios_id_fk" FOREIGN KEY ("usuario_ajuste_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
