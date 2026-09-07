ALTER TABLE "regras_desdobramento_comercial" ADD COLUMN "produto_origem_id" uuid;--> statement-breakpoint
ALTER TABLE "regras_desdobramento_comercial" ADD COLUMN "produto_destino_id" uuid;--> statement-breakpoint
ALTER TABLE "compras_programadas_itens" ADD COLUMN "produto_id" uuid;--> statement-breakpoint
ALTER TABLE "disponibilidades_virtuais" ADD COLUMN "produto_id" uuid;--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" ADD COLUMN "produto_id" uuid;--> statement-breakpoint
ALTER TABLE "pendencias_overbooking" ADD COLUMN "produto_id" uuid;--> statement-breakpoint
ALTER TABLE "pedidos_fornecedor_itens" ADD COLUMN "produto_id" uuid;--> statement-breakpoint
ALTER TABLE "divergencias_recebimento" ADD COLUMN "produto_id" uuid;--> statement-breakpoint
ALTER TABLE "recebimentos_itens" ADD COLUMN "produto_id" uuid;--> statement-breakpoint
ALTER TABLE "notas_fiscais_fornecedor_itens" ADD COLUMN "produto_id" uuid;--> statement-breakpoint
ALTER TABLE "pecas" ADD COLUMN "produto_base_id" uuid;--> statement-breakpoint
ALTER TABLE "subitens" ADD COLUMN "produto_id" uuid;--> statement-breakpoint
ALTER TABLE "adendos_pedido" ADD COLUMN "produto_id" uuid;--> statement-breakpoint
ALTER TABLE "regras_desdobramento_comercial" ADD CONSTRAINT "regras_desdobramento_comercial_produto_origem_id_produtos_id_fk" FOREIGN KEY ("produto_origem_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regras_desdobramento_comercial" ADD CONSTRAINT "regras_desdobramento_comercial_produto_destino_id_produtos_id_fk" FOREIGN KEY ("produto_destino_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras_programadas_itens" ADD CONSTRAINT "compras_programadas_itens_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disponibilidades_virtuais" ADD CONSTRAINT "disponibilidades_virtuais_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" ADD CONSTRAINT "pedidos_venda_itens_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencias_overbooking" ADD CONSTRAINT "pendencias_overbooking_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos_fornecedor_itens" ADD CONSTRAINT "pedidos_fornecedor_itens_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divergencias_recebimento" ADD CONSTRAINT "divergencias_recebimento_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recebimentos_itens" ADD CONSTRAINT "recebimentos_itens_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_fiscais_fornecedor_itens" ADD CONSTRAINT "notas_fiscais_fornecedor_itens_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pecas" ADD CONSTRAINT "pecas_produto_base_id_produtos_id_fk" FOREIGN KEY ("produto_base_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subitens" ADD CONSTRAINT "subitens_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adendos_pedido" ADD CONSTRAINT "adendos_pedido_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_regras_desd_produto_origem" ON "regras_desdobramento_comercial" USING btree ("produto_origem_id") WHERE "regras_desdobramento_comercial"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_regras_desd_produto_destino" ON "regras_desdobramento_comercial" USING btree ("produto_destino_id") WHERE "regras_desdobramento_comercial"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_regras_desd_par_ativo_produto" ON "regras_desdobramento_comercial" USING btree ("produto_origem_id","produto_destino_id") WHERE "regras_desdobramento_comercial"."deleted_at" IS NULL AND "regras_desdobramento_comercial"."status" = 'ativo';--> statement-breakpoint
CREATE INDEX "idx_compras_prog_itens_produto" ON "compras_programadas_itens" USING btree ("produto_id") WHERE "compras_programadas_itens"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_disp_compra_produto" ON "disponibilidades_virtuais" USING btree ("compra_programada_id","produto_id");--> statement-breakpoint
CREATE INDEX "idx_disp_produto" ON "disponibilidades_virtuais" USING btree ("produto_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pedido_venda_produto_ativo" ON "pedidos_venda_itens" USING btree ("pedido_venda_id","produto_id") WHERE "pedidos_venda_itens"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_pedidos_itens_produto" ON "pedidos_venda_itens" USING btree ("produto_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pedido_fornecedor_produto" ON "pedidos_fornecedor_itens" USING btree ("pedido_fornecedor_id","produto_id") WHERE "pedidos_fornecedor_itens"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_pedido_fornecedor_produto" ON "pedidos_fornecedor_itens" USING btree ("produto_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_receb_itens_recebimento_produto" ON "recebimentos_itens" USING btree ("recebimento_id","produto_id");--> statement-breakpoint
CREATE INDEX "idx_receb_itens_produto" ON "recebimentos_itens" USING btree ("produto_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_nf_fornecedor_produto" ON "notas_fiscais_fornecedor_itens" USING btree ("nf_id","produto_id") WHERE "notas_fiscais_fornecedor_itens"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_nf_fornecedor_produto" ON "notas_fiscais_fornecedor_itens" USING btree ("produto_id");