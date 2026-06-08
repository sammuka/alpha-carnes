ALTER TABLE "carga_itens" DROP CONSTRAINT "chk_carga_itens_tipo_origem";--> statement-breakpoint
ALTER TABLE "carga_itens" DROP CONSTRAINT "chk_carga_itens_xor_alvo";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_conferencias_carga_caminhao_ativa" ON "conferencias_carga" USING btree ("caminhao_id") WHERE "conferencias_carga"."status_conferencia" = 'aberta' AND "conferencias_carga"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "carga_itens" ADD CONSTRAINT "chk_carga_itens_tipo_origem_xor" CHECK (("carga_itens"."tipo_origem" = 'peca'    AND "carga_itens"."peca_id"    IS NOT NULL AND "carga_itens"."subitem_id" IS NULL) OR
          ("carga_itens"."tipo_origem" = 'subitem' AND "carga_itens"."subitem_id" IS NOT NULL AND "carga_itens"."peca_id"    IS NULL));