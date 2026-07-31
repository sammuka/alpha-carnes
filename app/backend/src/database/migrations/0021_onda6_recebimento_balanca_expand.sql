CREATE TABLE "trocas_peca" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"recebimento_id" uuid NOT NULL,
	"pedido_venda_id" uuid NOT NULL,
	"pedido_venda_item_id" uuid NOT NULL,
	"peca_retirada_id" uuid NOT NULL,
	"peca_inserida_id" uuid NOT NULL,
	"peso_retirada" numeric(10, 3) NOT NULL,
	"peso_inserida" numeric(10, 3) NOT NULL,
	"destino_retirada" text NOT NULL,
	"motivo" text NOT NULL,
	"observacoes" text,
	"etiqueta_invalidada_id" uuid,
	"etiqueta_emitida_id" uuid,
	"operador_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_trocas_peca_destino" CHECK ("trocas_peca"."destino_retirada" IN ('estoque','desossa')),
	CONSTRAINT "chk_trocas_peca_motivo" CHECK ("trocas_peca"."motivo" IN ('peca_mais_adequada','peso_fora_preferencia','qualidade','erro_associacao','outro')),
	CONSTRAINT "chk_trocas_peca_pecas_distintas" CHECK ("trocas_peca"."peca_retirada_id" <> "trocas_peca"."peca_inserida_id"),
	CONSTRAINT "chk_trocas_peca_pesos_positivos" CHECK ("trocas_peca"."peso_retirada" > 0 AND "trocas_peca"."peso_inserida" > 0)
);
--> statement-breakpoint
ALTER TABLE "associacoes_peca_historico" DROP CONSTRAINT "chk_assoc_hist_acao";--> statement-breakpoint
ALTER TABLE "aprovacoes_operacionais" DROP CONSTRAINT "chk_aprovacao_tipo";--> statement-breakpoint
ALTER TABLE "etiquetas_impressoes" ADD COLUMN "estado" text DEFAULT 'emitida' NOT NULL;--> statement-breakpoint
ALTER TABLE "etiquetas_impressoes" ADD COLUMN "motivo_cancelamento" text;--> statement-breakpoint
ALTER TABLE "etiquetas_impressoes" ADD COLUMN "invalidada_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "etiquetas_impressoes" ADD COLUMN "invalidada_por_id" uuid;--> statement-breakpoint
ALTER TABLE "trocas_peca" ADD CONSTRAINT "trocas_peca_recebimento_id_recebimentos_id_fk" FOREIGN KEY ("recebimento_id") REFERENCES "public"."recebimentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trocas_peca" ADD CONSTRAINT "trocas_peca_pedido_venda_id_pedidos_venda_id_fk" FOREIGN KEY ("pedido_venda_id") REFERENCES "public"."pedidos_venda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trocas_peca" ADD CONSTRAINT "trocas_peca_pedido_venda_item_id_pedidos_venda_itens_id_fk" FOREIGN KEY ("pedido_venda_item_id") REFERENCES "public"."pedidos_venda_itens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trocas_peca" ADD CONSTRAINT "trocas_peca_peca_retirada_id_pecas_id_fk" FOREIGN KEY ("peca_retirada_id") REFERENCES "public"."pecas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trocas_peca" ADD CONSTRAINT "trocas_peca_peca_inserida_id_pecas_id_fk" FOREIGN KEY ("peca_inserida_id") REFERENCES "public"."pecas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trocas_peca" ADD CONSTRAINT "trocas_peca_etiqueta_invalidada_id_etiquetas_impressoes_id_fk" FOREIGN KEY ("etiqueta_invalidada_id") REFERENCES "public"."etiquetas_impressoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trocas_peca" ADD CONSTRAINT "trocas_peca_etiqueta_emitida_id_etiquetas_impressoes_id_fk" FOREIGN KEY ("etiqueta_emitida_id") REFERENCES "public"."etiquetas_impressoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trocas_peca" ADD CONSTRAINT "trocas_peca_operador_id_usuarios_id_fk" FOREIGN KEY ("operador_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_trocas_peca_recebimento" ON "trocas_peca" USING btree ("recebimento_id");--> statement-breakpoint
CREATE INDEX "idx_trocas_peca_pedido" ON "trocas_peca" USING btree ("pedido_venda_id");--> statement-breakpoint
CREATE INDEX "idx_trocas_peca_retirada" ON "trocas_peca" USING btree ("peca_retirada_id");--> statement-breakpoint
CREATE INDEX "idx_trocas_peca_inserida" ON "trocas_peca" USING btree ("peca_inserida_id");--> statement-breakpoint
ALTER TABLE "etiquetas_impressoes" ADD CONSTRAINT "etiquetas_impressoes_invalidada_por_id_usuarios_id_fk" FOREIGN KEY ("invalidada_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_etiq_estado" ON "etiquetas_impressoes" USING btree ("estado");--> statement-breakpoint
ALTER TABLE "associacoes_peca_historico" ADD CONSTRAINT "chk_assoc_hist_acao" CHECK ("associacoes_peca_historico"."acao" IN ('confirmar','redirecionar','sobra','analise','corte','divergencia','estorno','troca_saida','troca_entrada'));--> statement-breakpoint
ALTER TABLE "etiquetas_impressoes" ADD CONSTRAINT "chk_etiq_estado" CHECK ("etiquetas_impressoes"."estado" IN ('emitida','ativa','invalidada_por_troca','reimpressa','cancelada'));--> statement-breakpoint
ALTER TABLE "etiquetas_impressoes" ADD CONSTRAINT "chk_etiq_cancelada_motivo" CHECK ("etiquetas_impressoes"."estado" <> 'cancelada' OR "etiquetas_impressoes"."motivo_cancelamento" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "aprovacoes_operacionais" ADD CONSTRAINT "chk_aprovacao_tipo" CHECK ("aprovacoes_operacionais"."tipo" IN ('divergencia_transformacao','estorno_fora_regra',
                        'reabertura_carga_pedido','ajuste_estoque_relevante',
                        'pendencia_fisica_etiqueta'));