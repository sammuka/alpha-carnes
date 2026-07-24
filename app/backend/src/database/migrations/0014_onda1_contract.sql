ALTER TABLE "pedidos_venda" DROP CONSTRAINT "chk_pedidos_venda_status";--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" DROP CONSTRAINT "chk_pedidos_itens_status";--> statement-breakpoint
ALTER TABLE "divergencias_recebimento" DROP CONSTRAINT "chk_diverg_receb_tipo";--> statement-breakpoint
ALTER TABLE "recebimentos" DROP CONSTRAINT "chk_recebimentos_status";--> statement-breakpoint
ALTER TABLE "recebimentos" DROP CONSTRAINT "recebimentos_compra_programada_id_compras_programadas_id_fk";
--> statement-breakpoint
DROP INDEX "uq_compras_prog_data_operacao";--> statement-breakpoint
DROP INDEX "idx_disp_data_operacao";--> statement-breakpoint
DROP INDEX "idx_pedidos_venda_data_operacao";--> statement-breakpoint
DROP INDEX "uq_recebimentos_compra";--> statement-breakpoint
DROP INDEX "idx_recebimentos_data_operacao";--> statement-breakpoint
DROP INDEX "idx_caminhoes_data_operacao";--> statement-breakpoint
DROP INDEX "idx_faturamentos_data";--> statement-breakpoint
ALTER TABLE "compras_programadas" ALTER COLUMN "operacao_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "disponibilidades_virtuais" ALTER COLUMN "operacao_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos_venda" ALTER COLUMN "operacao_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos_venda" ALTER COLUMN "status" SET DEFAULT 'em_elaboracao_reserva_ativa';--> statement-breakpoint
ALTER TABLE "divergencias_recebimento" ALTER COLUMN "item_comercial_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "recebimentos" ALTER COLUMN "operacao_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "recebimentos" ALTER COLUMN "pedido_fornecedor_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "recebimentos" ALTER COLUMN "status" SET DEFAULT 'pesagem_em_andamento';--> statement-breakpoint
ALTER TABLE "caminhoes" ALTER COLUMN "operacao_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "faturamentos" ALTER COLUMN "operacao_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_compras_prog_operacao" ON "compras_programadas" USING btree ("operacao_id") WHERE "compras_programadas"."deleted_at" IS NULL AND "compras_programadas"."status" <> 'cancelada';--> statement-breakpoint
CREATE INDEX "idx_compras_prog_operacao" ON "compras_programadas" USING btree ("operacao_id") WHERE "compras_programadas"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_disp_operacao" ON "disponibilidades_virtuais" USING btree ("operacao_id");--> statement-breakpoint
CREATE INDEX "idx_pedidos_venda_operacao" ON "pedidos_venda" USING btree ("operacao_id") WHERE "pedidos_venda"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_recebimentos_pedido_fornecedor" ON "recebimentos" USING btree ("pedido_fornecedor_id");--> statement-breakpoint
CREATE INDEX "idx_recebimentos_operacao" ON "recebimentos" USING btree ("operacao_id");--> statement-breakpoint
CREATE INDEX "idx_caminhoes_operacao" ON "caminhoes" USING btree ("operacao_id") WHERE "caminhoes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_faturamentos_operacao" ON "faturamentos" USING btree ("operacao_id") WHERE "faturamentos"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "compras_programadas" DROP COLUMN "data_operacao";--> statement-breakpoint
ALTER TABLE "disponibilidades_virtuais" DROP COLUMN "data_operacao";--> statement-breakpoint
ALTER TABLE "pedidos_venda" DROP COLUMN "data_operacao";--> statement-breakpoint
ALTER TABLE "recebimentos" DROP COLUMN "compra_programada_id";--> statement-breakpoint
ALTER TABLE "recebimentos" DROP COLUMN "data_operacao";--> statement-breakpoint
ALTER TABLE "recebimentos" DROP COLUMN "nfe_numero";--> statement-breakpoint
ALTER TABLE "recebimentos" DROP COLUMN "nfe_serie";--> statement-breakpoint
ALTER TABLE "recebimentos" DROP COLUMN "nfe_chave";--> statement-breakpoint
ALTER TABLE "recebimentos" DROP COLUMN "nfe_data_emissao";--> statement-breakpoint
ALTER TABLE "recebimentos" DROP COLUMN "nfe_peso_bruto";--> statement-breakpoint
ALTER TABLE "recebimentos" DROP COLUMN "nfe_peso_liquido";--> statement-breakpoint
ALTER TABLE "recebimentos" DROP COLUMN "nfe_volumes";--> statement-breakpoint
ALTER TABLE "caminhoes" DROP COLUMN "data_operacao";--> statement-breakpoint
ALTER TABLE "faturamentos" DROP COLUMN "data_operacao";--> statement-breakpoint
ALTER TABLE "pedidos_venda" ADD CONSTRAINT "chk_pedidos_venda_status" CHECK ("pedidos_venda"."status" IN (
      'rascunho','em_elaboracao_reserva_ativa','aguardando_confirmacao_overbooking',
      'finalizado','parcialmente_atendido','atendido','faturado','cancelado'
    ));--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" ADD CONSTRAINT "chk_pedidos_itens_status" CHECK ("pedidos_venda_itens"."status" IN (
      'totalmente_reservado','aguardando_confirmacao_overbooking',
      'overbooking_confirmado','cancelado'
    ));--> statement-breakpoint
ALTER TABLE "reservas_disponibilidade" ADD CONSTRAINT "chk_reservas_tipo_consumo" CHECK ("reservas_disponibilidade"."tipo_consumo" IN ('fisico','virtual','overbooking'));--> statement-breakpoint
ALTER TABLE "reservas_disponibilidade" ADD CONSTRAINT "chk_reservas_origem" CHECK (
      "reservas_disponibilidade"."tipo_consumo" = 'overbooking' OR "reservas_disponibilidade"."disponibilidade_virtual_id" IS NOT NULL
    );--> statement-breakpoint
ALTER TABLE "divergencias_recebimento" ADD CONSTRAINT "chk_diverg_receb_tipo" CHECK ("divergencias_recebimento"."tipo" IN (
      'falta','excesso','produto_nao_previsto','peso_divergente','outro'
    ));--> statement-breakpoint
ALTER TABLE "recebimentos" ADD CONSTRAINT "chk_recebimentos_status" CHECK ("recebimentos"."status" IN (
      'pesagem_em_andamento','aguardando_conclusao_pesagem','aguardando_conferencia_final',
      'conferido_sem_divergencia','conferido_com_divergencia',
      'ocorrencia_administrativa_aberta','tratativa_administrativa_concluida','cancelado'
    ));