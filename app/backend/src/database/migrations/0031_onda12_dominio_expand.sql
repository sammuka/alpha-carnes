ALTER TABLE "rotas" ADD COLUMN "representante_padrao_id" uuid;--> statement-breakpoint
ALTER TABLE "rotas" ADD COLUMN "caminhao_padrao_id" uuid;--> statement-breakpoint
ALTER TABLE "rotas" ADD COLUMN "motorista_padrao_id" uuid;--> statement-breakpoint
ALTER TABLE "pedidos_venda" ADD COLUMN "rota_id" uuid;--> statement-breakpoint
ALTER TABLE "caminhoes" ADD COLUMN "motorista_id" uuid;--> statement-breakpoint
ALTER TABLE "caminhoes" ADD COLUMN "rota_id" uuid;--> statement-breakpoint
ALTER TABLE "entradas_itens" ADD COLUMN "fornecedor_id" uuid;--> statement-breakpoint
ALTER TABLE "rotas" ADD CONSTRAINT "rotas_representante_padrao_id_representantes_id_fk" FOREIGN KEY ("representante_padrao_id") REFERENCES "public"."representantes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotas" ADD CONSTRAINT "rotas_caminhao_padrao_id_frota_caminhoes_id_fk" FOREIGN KEY ("caminhao_padrao_id") REFERENCES "public"."frota_caminhoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotas" ADD CONSTRAINT "rotas_motorista_padrao_id_frota_motoristas_id_fk" FOREIGN KEY ("motorista_padrao_id") REFERENCES "public"."frota_motoristas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos_venda" ADD CONSTRAINT "pedidos_venda_rota_id_rotas_id_fk" FOREIGN KEY ("rota_id") REFERENCES "public"."rotas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caminhoes" ADD CONSTRAINT "caminhoes_motorista_id_frota_motoristas_id_fk" FOREIGN KEY ("motorista_id") REFERENCES "public"."frota_motoristas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caminhoes" ADD CONSTRAINT "caminhoes_rota_id_rotas_id_fk" FOREIGN KEY ("rota_id") REFERENCES "public"."rotas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entradas_itens" ADD CONSTRAINT "entradas_itens_fornecedor_id_fornecedores_id_fk" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."fornecedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_rotas_representante_padrao" ON "rotas" USING btree ("representante_padrao_id") WHERE "rotas"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_rotas_caminhao_padrao" ON "rotas" USING btree ("caminhao_padrao_id") WHERE "rotas"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_rotas_motorista_padrao" ON "rotas" USING btree ("motorista_padrao_id") WHERE "rotas"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_pedidos_venda_rota" ON "pedidos_venda" USING btree ("rota_id") WHERE "pedidos_venda"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_caminhoes_motorista" ON "caminhoes" USING btree ("motorista_id") WHERE "caminhoes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_caminhoes_rota" ON "caminhoes" USING btree ("rota_id") WHERE "caminhoes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_entradas_itens_fornecedor" ON "entradas_itens" USING btree ("fornecedor_id") WHERE "entradas_itens"."deleted_at" IS NULL;