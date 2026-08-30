DROP INDEX "uq_compras_prog_operacao";--> statement-breakpoint
ALTER TABLE "pedidos_venda" ALTER COLUMN "compra_programada_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "compras_programadas" ADD COLUMN "numero_sequencial" integer;--> statement-breakpoint
ALTER TABLE "associacoes_peca_historico" ADD COLUMN "compra_programada_origem_id" uuid;--> statement-breakpoint
ALTER TABLE "associacoes_peca_historico" ADD COLUMN "recebimento_origem_id" uuid;--> statement-breakpoint
ALTER TABLE "associacoes_peca_historico" ADD CONSTRAINT "associacoes_peca_historico_compra_programada_origem_id_compras_programadas_id_fk" FOREIGN KEY ("compra_programada_origem_id") REFERENCES "public"."compras_programadas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "associacoes_peca_historico" ADD CONSTRAINT "associacoes_peca_historico_recebimento_origem_id_recebimentos_id_fk" FOREIGN KEY ("recebimento_origem_id") REFERENCES "public"."recebimentos"("id") ON DELETE no action ON UPDATE no action;