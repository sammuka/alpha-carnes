ALTER TABLE "carga_itens" DROP CONSTRAINT "chk_carga_itens_status";--> statement-breakpoint
ALTER TABLE "caminhoes" ADD COLUMN "frota_caminhao_id" uuid;--> statement-breakpoint
ALTER TABLE "carga_itens" ADD COLUMN "divergencia_motivo" text;--> statement-breakpoint
ALTER TABLE "carga_itens" ADD COLUMN "divergencia_observacao" text;--> statement-breakpoint
ALTER TABLE "caminhoes" ADD CONSTRAINT "caminhoes_frota_caminhao_id_frota_caminhoes_id_fk" FOREIGN KEY ("frota_caminhao_id") REFERENCES "public"."frota_caminhoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_caminhoes_frota" ON "caminhoes" USING btree ("frota_caminhao_id") WHERE "caminhoes"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "carga_itens" ADD CONSTRAINT "chk_carga_itens_divergencia_motivo" CHECK ("carga_itens"."divergencia_motivo" IS NULL OR "carga_itens"."divergencia_motivo" IN ('peca_ausente','peca_errada','peso_divergente','etiqueta_ilegivel','avaria','outro'));--> statement-breakpoint
ALTER TABLE "carga_itens" ADD CONSTRAINT "chk_carga_itens_status" CHECK ("carga_itens"."status_carga_item" IN ('em_carga','conferido','divergente','removido'));