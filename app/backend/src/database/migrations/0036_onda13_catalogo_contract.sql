ALTER TABLE "regras_desdobramento_comercial" ALTER COLUMN "produto_origem_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "regras_desdobramento_comercial" ALTER COLUMN "produto_destino_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "compras_programadas_itens" ALTER COLUMN "produto_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "disponibilidades_virtuais" ALTER COLUMN "produto_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" ALTER COLUMN "produto_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pendencias_overbooking" ALTER COLUMN "produto_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos_fornecedor_itens" ALTER COLUMN "produto_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "divergencias_recebimento" ALTER COLUMN "produto_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "recebimentos_itens" ALTER COLUMN "produto_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notas_fiscais_fornecedor_itens" ALTER COLUMN "produto_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pecas" ALTER COLUMN "produto_base_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "subitens" ALTER COLUMN "produto_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "adendos_pedido" ALTER COLUMN "produto_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "regras_desdobramento_comercial" ADD CONSTRAINT "chk_regras_desd_origem_destino_distintos" CHECK (deleted_at IS NOT NULL OR produto_origem_id <> produto_destino_id);--> statement-breakpoint
ALTER TABLE "regras_desdobramento_comercial" DROP CONSTRAINT "regras_desdobramento_comercial_item_compra_id_itens_compra_id_fk";--> statement-breakpoint
ALTER TABLE "regras_desdobramento_comercial" DROP CONSTRAINT "regras_desdobramento_comercial_item_comercial_id_itens_comerciais_id_fk";--> statement-breakpoint
ALTER TABLE "compras_programadas_itens" DROP CONSTRAINT "compras_programadas_itens_item_compra_id_itens_compra_id_fk";--> statement-breakpoint
ALTER TABLE "disponibilidades_virtuais" DROP CONSTRAINT "disponibilidades_virtuais_item_comercial_id_itens_comerciais_id_fk";--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" DROP CONSTRAINT "pedidos_venda_itens_item_comercial_id_itens_comerciais_id_fk";--> statement-breakpoint
ALTER TABLE "pendencias_overbooking" DROP CONSTRAINT "pendencias_overbooking_item_comercial_id_itens_comerciais_id_fk";--> statement-breakpoint
ALTER TABLE "pedidos_fornecedor_itens" DROP CONSTRAINT "pedidos_fornecedor_itens_item_comercial_id_itens_comerciais_id_fk";--> statement-breakpoint
ALTER TABLE "divergencias_recebimento" DROP CONSTRAINT "divergencias_recebimento_item_comercial_id_itens_comerciais_id_fk";--> statement-breakpoint
ALTER TABLE "recebimentos_itens" DROP CONSTRAINT "recebimentos_itens_item_comercial_id_itens_comerciais_id_fk";--> statement-breakpoint
ALTER TABLE "notas_fiscais_fornecedor_itens" DROP CONSTRAINT "notas_fiscais_fornecedor_itens_item_comercial_id_itens_comerciais_id_fk";--> statement-breakpoint
ALTER TABLE "pecas" DROP CONSTRAINT "pecas_item_comercial_base_id_itens_comerciais_id_fk";--> statement-breakpoint
ALTER TABLE "subitens" DROP CONSTRAINT "subitens_item_comercial_id_itens_comerciais_id_fk";--> statement-breakpoint
ALTER TABLE "adendos_pedido" DROP CONSTRAINT "adendos_pedido_item_comercial_id_itens_comerciais_id_fk";--> statement-breakpoint
DROP INDEX "idx_regras_desd_item_compra";--> statement-breakpoint
DROP INDEX "idx_regras_desd_item_comercial";--> statement-breakpoint
DROP INDEX "idx_regras_desd_par_ativo_produto";--> statement-breakpoint
DROP INDEX "idx_compras_prog_itens_item_compra";--> statement-breakpoint
DROP INDEX "uq_disp_compra_item";--> statement-breakpoint
DROP INDEX "idx_disp_item_comercial";--> statement-breakpoint
DROP INDEX "uq_pedido_venda_item_comercial_ativo";--> statement-breakpoint
DROP INDEX "idx_pedidos_itens_item_comercial";--> statement-breakpoint
DROP INDEX "uq_pedido_fornecedor_item";--> statement-breakpoint
DROP INDEX "idx_pedido_fornecedor_item_comercial";--> statement-breakpoint
DROP INDEX "uq_receb_itens_recebimento_item";--> statement-breakpoint
DROP INDEX "idx_receb_itens_item_comercial";--> statement-breakpoint
DROP INDEX "uq_nf_fornecedor_item";--> statement-breakpoint
DROP INDEX "idx_nf_fornecedor_item_comercial";--> statement-breakpoint
DROP INDEX "idx_regras_desd_par_ativo";--> statement-breakpoint
CREATE INDEX "idx_regras_desd_par_ativo" ON "regras_desdobramento_comercial" USING btree ("produto_origem_id","produto_destino_id") WHERE "regras_desdobramento_comercial"."deleted_at" IS NULL AND "regras_desdobramento_comercial"."status" = 'ativo';--> statement-breakpoint
ALTER TABLE "produtos" DROP CONSTRAINT "produtos_legado_item_comercial_id_itens_comerciais_id_fk";--> statement-breakpoint
ALTER TABLE "produtos" DROP CONSTRAINT "produtos_legado_item_compra_id_itens_compra_id_fk";--> statement-breakpoint
ALTER TABLE "produtos" DROP COLUMN "legado_item_comercial_id";--> statement-breakpoint
ALTER TABLE "produtos" DROP COLUMN "legado_item_compra_id";--> statement-breakpoint
ALTER TABLE "regras_desdobramento_comercial" DROP COLUMN "item_compra_id";--> statement-breakpoint
ALTER TABLE "regras_desdobramento_comercial" DROP COLUMN "item_comercial_id";--> statement-breakpoint
ALTER TABLE "compras_programadas_itens" DROP COLUMN "item_compra_id";--> statement-breakpoint
ALTER TABLE "disponibilidades_virtuais" DROP COLUMN "item_comercial_id";--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" DROP COLUMN "item_comercial_id";--> statement-breakpoint
ALTER TABLE "pendencias_overbooking" DROP COLUMN "item_comercial_id";--> statement-breakpoint
ALTER TABLE "pedidos_fornecedor_itens" DROP COLUMN "item_comercial_id";--> statement-breakpoint
ALTER TABLE "divergencias_recebimento" DROP COLUMN "item_comercial_id";--> statement-breakpoint
ALTER TABLE "recebimentos_itens" DROP COLUMN "item_comercial_id";--> statement-breakpoint
ALTER TABLE "notas_fiscais_fornecedor_itens" DROP COLUMN "item_comercial_id";--> statement-breakpoint
ALTER TABLE "pecas" DROP COLUMN "item_comercial_base_id";--> statement-breakpoint
ALTER TABLE "subitens" DROP COLUMN "item_comercial_id";--> statement-breakpoint
ALTER TABLE "adendos_pedido" DROP COLUMN "item_comercial_id";--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name IN ('itens_comerciais', 'itens_compra')
  ) THEN
    RAISE EXCEPTION 'Onda 13 contract: ainda há FK para itens_comerciais/itens_compra';
  END IF;
END $$;--> statement-breakpoint
DROP TABLE "itens_comerciais" CASCADE;--> statement-breakpoint
DROP TABLE "itens_compra" CASCADE;--> statement-breakpoint
-- Rollback desta migration: restaurar backup Postgres capturado ANTES da 0036.
-- Recriar as duas tabelas vazias NÃO é aceitável (perda de dados / AD-15).
