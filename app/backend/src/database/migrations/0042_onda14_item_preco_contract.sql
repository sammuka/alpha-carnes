ALTER TABLE "pedidos_venda_itens" ALTER COLUMN "faixa_preco" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" ALTER COLUMN "unidade_preco" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" ALTER COLUMN "preco_aplicado" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" ADD CONSTRAINT "chk_pedidos_itens_faixa_preco" CHECK ("pedidos_venda_itens"."faixa_preco" IN ('A','B','C','D'));--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" ADD CONSTRAINT "chk_pedidos_itens_unidade_preco" CHECK ("pedidos_venda_itens"."unidade_preco" IN ('kg','unidade'));--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" ADD CONSTRAINT "chk_pedidos_itens_preco_aplicado_positivo" CHECK ("pedidos_venda_itens"."preco_aplicado" > 0);
