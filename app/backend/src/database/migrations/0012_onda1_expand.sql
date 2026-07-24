CREATE TABLE "operacoes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"data" date NOT NULL,
	"dia_semana" integer NOT NULL,
	"rotulo" text NOT NULL,
	"status" text DEFAULT 'aberta' NOT NULL,
	"extraordinaria" boolean DEFAULT false NOT NULL,
	"criada_por_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_operacoes_status" CHECK ("operacoes"."status" IN ('aberta','em_andamento','fechada')),
	CONSTRAINT "chk_operacoes_dia_semana" CHECK ("operacoes"."dia_semana" BETWEEN 0 AND 6)
);--> statement-breakpoint
CREATE TABLE "pendencias_overbooking" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"pedido_venda_id" uuid NOT NULL,
	"pedido_venda_item_id" uuid NOT NULL,
	"item_comercial_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"vendedor_usuario_id" uuid NOT NULL,
	"operacao_id" uuid NOT NULL,
	"quantidade_deficit" numeric(15, 3) NOT NULL,
	"status" text DEFAULT 'aberta' NOT NULL,
	"decisao_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"responsavel_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_pend_ovb_deficit" CHECK ("pendencias_overbooking"."quantidade_deficit" > 0),
	CONSTRAINT "chk_pend_ovb_status" CHECK ("pendencias_overbooking"."status" IN ('aberta','em_analise','compra_complementar_programada','redistribuicao_decidida','novo_pedido_criado','resolvida','cancelada'))
);--> statement-breakpoint
CREATE TABLE "pendencias_overbooking_historico" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"pendencia_id" uuid NOT NULL,
	"acao" text NOT NULL,
	"autor_id" uuid NOT NULL,
	"detalhe_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "pedidos_fornecedor" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"numero" text NOT NULL,
	"fornecedor_id" uuid NOT NULL,
	"operacao_id" uuid NOT NULL,
	"compra_programada_id" uuid NOT NULL,
	"status" text DEFAULT 'rascunho' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_pedidos_fornecedor_status" CHECK ("pedidos_fornecedor"."status" IN ('rascunho','enviado','aguardando_recebimento','recebido','encerrado','cancelado'))
);--> statement-breakpoint
CREATE TABLE "pedidos_fornecedor_itens" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"pedido_fornecedor_id" uuid NOT NULL,
	"item_comercial_id" uuid NOT NULL,
	"quantidade_prevista" numeric(15, 3) NOT NULL,
	"peso_previsto" numeric(10, 3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE "notas_fiscais_fornecedor" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"pedido_fornecedor_id" uuid NOT NULL,
	"recebimento_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"serie" text,
	"chave" text,
	"data_emissao" date,
	"peso_total_declarado" numeric(10, 3),
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE "notas_fiscais_fornecedor_itens" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"nf_id" uuid NOT NULL,
	"item_comercial_id" uuid NOT NULL,
	"quantidade_declarada" numeric(15, 3) NOT NULL,
	"peso_declarado" numeric(10, 3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE "conclusoes_conferencia" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"recebimento_id" uuid NOT NULL,
	"quadro_json" jsonb NOT NULL,
	"resultado" text NOT NULL,
	"observacao" text,
	"concluida_por_id" uuid NOT NULL,
	"concluida_em" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_conclusao_resultado" CHECK ("conclusoes_conferencia"."resultado" IN ('sem_divergencia','com_divergencia'))
);--> statement-breakpoint
CREATE TABLE "conclusoes_conferencia_nfs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"conclusao_id" uuid NOT NULL,
	"nf_fornecedor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "reservas_disponibilidade" ALTER COLUMN "disponibilidade_virtual_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "divergencias_recebimento" ALTER COLUMN "recebimento_item_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "compras_programadas" ADD COLUMN "operacao_id" uuid;--> statement-breakpoint
ALTER TABLE "disponibilidades_virtuais" ADD COLUMN "operacao_id" uuid;--> statement-breakpoint
ALTER TABLE "pedidos_venda" ADD COLUMN "operacao_id" uuid;--> statement-breakpoint
ALTER TABLE "pedidos_venda" ADD COLUMN "motivo_cancelamento" text;--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" ADD COLUMN "quantidade_overbooking" numeric(15, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reservas_disponibilidade" ADD COLUMN "tipo_consumo" text DEFAULT 'virtual' NOT NULL;--> statement-breakpoint
ALTER TABLE "divergencias_recebimento" ADD COLUMN "item_comercial_id" uuid;--> statement-breakpoint
ALTER TABLE "divergencias_recebimento" ADD COLUMN "conclusao_conferencia_id" uuid;--> statement-breakpoint
ALTER TABLE "divergencias_recebimento" ADD COLUMN "nf_fornecedor_id" uuid;--> statement-breakpoint
ALTER TABLE "recebimentos" ADD COLUMN "operacao_id" uuid;--> statement-breakpoint
ALTER TABLE "recebimentos" ADD COLUMN "pedido_fornecedor_id" uuid;--> statement-breakpoint
ALTER TABLE "ocorrencias_fornecedor" ADD COLUMN "conclusao_conferencia_id" uuid;--> statement-breakpoint
ALTER TABLE "ocorrencias_fornecedor" ADD COLUMN "nf_fornecedor_id" uuid;--> statement-breakpoint
ALTER TABLE "caminhoes" ADD COLUMN "operacao_id" uuid;--> statement-breakpoint
ALTER TABLE "faturamentos" ADD COLUMN "operacao_id" uuid;--> statement-breakpoint
ALTER TABLE "operacoes" ADD CONSTRAINT "operacoes_criada_por_id_usuarios_id_fk" FOREIGN KEY ("criada_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencias_overbooking" ADD CONSTRAINT "pendencias_overbooking_pedido_venda_id_pedidos_venda_id_fk" FOREIGN KEY ("pedido_venda_id") REFERENCES "public"."pedidos_venda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencias_overbooking" ADD CONSTRAINT "pendencias_overbooking_pedido_venda_item_id_pedidos_venda_itens_id_fk" FOREIGN KEY ("pedido_venda_item_id") REFERENCES "public"."pedidos_venda_itens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencias_overbooking" ADD CONSTRAINT "pendencias_overbooking_item_comercial_id_itens_comerciais_id_fk" FOREIGN KEY ("item_comercial_id") REFERENCES "public"."itens_comerciais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencias_overbooking" ADD CONSTRAINT "pendencias_overbooking_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencias_overbooking" ADD CONSTRAINT "pendencias_overbooking_vendedor_usuario_id_usuarios_id_fk" FOREIGN KEY ("vendedor_usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencias_overbooking" ADD CONSTRAINT "pendencias_overbooking_operacao_id_operacoes_id_fk" FOREIGN KEY ("operacao_id") REFERENCES "public"."operacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencias_overbooking" ADD CONSTRAINT "pendencias_overbooking_responsavel_id_usuarios_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencias_overbooking_historico" ADD CONSTRAINT "pendencias_overbooking_historico_pendencia_id_pendencias_overbooking_id_fk" FOREIGN KEY ("pendencia_id") REFERENCES "public"."pendencias_overbooking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencias_overbooking_historico" ADD CONSTRAINT "pendencias_overbooking_historico_autor_id_usuarios_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos_fornecedor" ADD CONSTRAINT "pedidos_fornecedor_fornecedor_id_fornecedores_id_fk" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."fornecedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos_fornecedor" ADD CONSTRAINT "pedidos_fornecedor_operacao_id_operacoes_id_fk" FOREIGN KEY ("operacao_id") REFERENCES "public"."operacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos_fornecedor" ADD CONSTRAINT "pedidos_fornecedor_compra_programada_id_compras_programadas_id_fk" FOREIGN KEY ("compra_programada_id") REFERENCES "public"."compras_programadas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos_fornecedor_itens" ADD CONSTRAINT "pedidos_fornecedor_itens_pedido_fornecedor_id_pedidos_fornecedor_id_fk" FOREIGN KEY ("pedido_fornecedor_id") REFERENCES "public"."pedidos_fornecedor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos_fornecedor_itens" ADD CONSTRAINT "pedidos_fornecedor_itens_item_comercial_id_itens_comerciais_id_fk" FOREIGN KEY ("item_comercial_id") REFERENCES "public"."itens_comerciais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_fiscais_fornecedor" ADD CONSTRAINT "notas_fiscais_fornecedor_pedido_fornecedor_id_pedidos_fornecedor_id_fk" FOREIGN KEY ("pedido_fornecedor_id") REFERENCES "public"."pedidos_fornecedor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_fiscais_fornecedor" ADD CONSTRAINT "notas_fiscais_fornecedor_recebimento_id_recebimentos_id_fk" FOREIGN KEY ("recebimento_id") REFERENCES "public"."recebimentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_fiscais_fornecedor_itens" ADD CONSTRAINT "notas_fiscais_fornecedor_itens_nf_id_notas_fiscais_fornecedor_id_fk" FOREIGN KEY ("nf_id") REFERENCES "public"."notas_fiscais_fornecedor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_fiscais_fornecedor_itens" ADD CONSTRAINT "notas_fiscais_fornecedor_itens_item_comercial_id_itens_comerciais_id_fk" FOREIGN KEY ("item_comercial_id") REFERENCES "public"."itens_comerciais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conclusoes_conferencia" ADD CONSTRAINT "conclusoes_conferencia_recebimento_id_recebimentos_id_fk" FOREIGN KEY ("recebimento_id") REFERENCES "public"."recebimentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conclusoes_conferencia" ADD CONSTRAINT "conclusoes_conferencia_concluida_por_id_usuarios_id_fk" FOREIGN KEY ("concluida_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conclusoes_conferencia_nfs" ADD CONSTRAINT "conclusoes_conferencia_nfs_conclusao_id_conclusoes_conferencia_id_fk" FOREIGN KEY ("conclusao_id") REFERENCES "public"."conclusoes_conferencia"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conclusoes_conferencia_nfs" ADD CONSTRAINT "conclusoes_conferencia_nfs_nf_fornecedor_id_notas_fiscais_fornecedor_id_fk" FOREIGN KEY ("nf_fornecedor_id") REFERENCES "public"."notas_fiscais_fornecedor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_operacoes_data" ON "operacoes" USING btree ("data") WHERE "operacoes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_operacoes_status" ON "operacoes" USING btree ("status") WHERE "operacoes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_pend_ovb_item" ON "pendencias_overbooking" USING btree ("pedido_venda_item_id");--> statement-breakpoint
CREATE INDEX "idx_pend_ovb_operacao" ON "pendencias_overbooking" USING btree ("operacao_id");--> statement-breakpoint
CREATE INDEX "idx_pend_ovb_hist_pendencia" ON "pendencias_overbooking_historico" USING btree ("pendencia_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pedidos_fornecedor_numero" ON "pedidos_fornecedor" USING btree ("numero") WHERE "pedidos_fornecedor"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_pedidos_fornecedor_fornecedor" ON "pedidos_fornecedor" USING btree ("fornecedor_id");--> statement-breakpoint
CREATE INDEX "idx_pedidos_fornecedor_operacao" ON "pedidos_fornecedor" USING btree ("operacao_id");--> statement-breakpoint
CREATE INDEX "idx_pedidos_fornecedor_compra" ON "pedidos_fornecedor" USING btree ("compra_programada_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pedido_fornecedor_item" ON "pedidos_fornecedor_itens" USING btree ("pedido_fornecedor_id","item_comercial_id") WHERE "pedidos_fornecedor_itens"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_pedido_fornecedor_item_comercial" ON "pedidos_fornecedor_itens" USING btree ("item_comercial_id");--> statement-breakpoint
CREATE INDEX "idx_nf_fornecedor_pedido" ON "notas_fiscais_fornecedor" USING btree ("pedido_fornecedor_id");--> statement-breakpoint
CREATE INDEX "idx_nf_fornecedor_recebimento" ON "notas_fiscais_fornecedor" USING btree ("recebimento_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_nf_fornecedor_chave" ON "notas_fiscais_fornecedor" USING btree ("chave") WHERE "notas_fiscais_fornecedor"."deleted_at" IS NULL AND "notas_fiscais_fornecedor"."chave" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_nf_fornecedor_item" ON "notas_fiscais_fornecedor_itens" USING btree ("nf_id","item_comercial_id") WHERE "notas_fiscais_fornecedor_itens"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_nf_fornecedor_item_comercial" ON "notas_fiscais_fornecedor_itens" USING btree ("item_comercial_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_conclusao_recebimento" ON "conclusoes_conferencia" USING btree ("recebimento_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_conclusao_nf" ON "conclusoes_conferencia_nfs" USING btree ("conclusao_id","nf_fornecedor_id");--> statement-breakpoint
CREATE INDEX "idx_conclusao_nf_fornecedor" ON "conclusoes_conferencia_nfs" USING btree ("nf_fornecedor_id");--> statement-breakpoint
ALTER TABLE "compras_programadas" ADD CONSTRAINT "compras_programadas_operacao_id_operacoes_id_fk" FOREIGN KEY ("operacao_id") REFERENCES "public"."operacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disponibilidades_virtuais" ADD CONSTRAINT "disponibilidades_virtuais_operacao_id_operacoes_id_fk" FOREIGN KEY ("operacao_id") REFERENCES "public"."operacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos_venda" ADD CONSTRAINT "pedidos_venda_operacao_id_operacoes_id_fk" FOREIGN KEY ("operacao_id") REFERENCES "public"."operacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divergencias_recebimento" ADD CONSTRAINT "divergencias_recebimento_item_comercial_id_itens_comerciais_id_fk" FOREIGN KEY ("item_comercial_id") REFERENCES "public"."itens_comerciais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divergencias_recebimento" ADD CONSTRAINT "divergencias_recebimento_conclusao_conferencia_id_conclusoes_conferencia_id_fk" FOREIGN KEY ("conclusao_conferencia_id") REFERENCES "public"."conclusoes_conferencia"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divergencias_recebimento" ADD CONSTRAINT "divergencias_recebimento_nf_fornecedor_id_notas_fiscais_fornecedor_id_fk" FOREIGN KEY ("nf_fornecedor_id") REFERENCES "public"."notas_fiscais_fornecedor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recebimentos" ADD CONSTRAINT "recebimentos_operacao_id_operacoes_id_fk" FOREIGN KEY ("operacao_id") REFERENCES "public"."operacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recebimentos" ADD CONSTRAINT "recebimentos_pedido_fornecedor_id_pedidos_fornecedor_id_fk" FOREIGN KEY ("pedido_fornecedor_id") REFERENCES "public"."pedidos_fornecedor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocorrencias_fornecedor" ADD CONSTRAINT "ocorrencias_fornecedor_conclusao_conferencia_id_conclusoes_conferencia_id_fk" FOREIGN KEY ("conclusao_conferencia_id") REFERENCES "public"."conclusoes_conferencia"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocorrencias_fornecedor" ADD CONSTRAINT "ocorrencias_fornecedor_nf_fornecedor_id_notas_fiscais_fornecedor_id_fk" FOREIGN KEY ("nf_fornecedor_id") REFERENCES "public"."notas_fiscais_fornecedor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caminhoes" ADD CONSTRAINT "caminhoes_operacao_id_operacoes_id_fk" FOREIGN KEY ("operacao_id") REFERENCES "public"."operacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faturamentos" ADD CONSTRAINT "faturamentos_operacao_id_operacoes_id_fk" FOREIGN KEY ("operacao_id") REFERENCES "public"."operacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pedido_venda_item_comercial_ativo" ON "pedidos_venda_itens" USING btree ("pedido_venda_id","item_comercial_id") WHERE "pedidos_venda_itens"."deleted_at" IS NULL;--> statement-breakpoint
-- 0012 (append): ampliar CHECKs de status para o superset antes do backfill 0013.
-- Superset = valores legados ∪ valores finais; o aperto ao conjunto final é feito no 0014.
ALTER TABLE "pedidos_venda" DROP CONSTRAINT IF EXISTS "chk_pedidos_venda_status";--> statement-breakpoint
ALTER TABLE "pedidos_venda" ADD CONSTRAINT "chk_pedidos_venda_status" CHECK ("pedidos_venda"."status" IN (
  'reservado','parcialmente_reservado',
  'rascunho','em_elaboracao_reserva_ativa','aguardando_confirmacao_overbooking',
  'finalizado','parcialmente_atendido','atendido','faturado','cancelado'
));--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" DROP CONSTRAINT IF EXISTS "chk_pedidos_itens_status";--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" ADD CONSTRAINT "chk_pedidos_itens_status" CHECK ("pedidos_venda_itens"."status" IN (
  'totalmente_reservado','parcialmente_reservado','sem_cobertura',
  'aguardando_confirmacao_overbooking','overbooking_confirmado','cancelado'
));--> statement-breakpoint
ALTER TABLE "recebimentos" DROP CONSTRAINT IF EXISTS "chk_recebimentos_status";--> statement-breakpoint
ALTER TABLE "recebimentos" ADD CONSTRAINT "chk_recebimentos_status" CHECK ("recebimentos"."status" IN (
  'aguardando_conferencia','em_conferencia','finalizado',
  'pesagem_em_andamento','aguardando_conclusao_pesagem','aguardando_conferencia_final',
  'conferido_sem_divergencia','conferido_com_divergencia',
  'ocorrencia_administrativa_aberta','tratativa_administrativa_concluida','cancelado'
));--> statement-breakpoint
-- chk_diverg_receb_tipo também é apertado no fim da migração (Task 5 grava os 5 tipos
-- v1.1 em conferências novas ANTES do backfill 0013). Superset = 8 tipos legados
-- (recebimentos.schema.ts) ∪ 5 tipos v1.1 (`classificarTipoV11`); o aperto ao conjunto
-- final de 5 é feito no 0014 depois que o 0013 remapeia 100% das linhas legadas.
ALTER TABLE "divergencias_recebimento" DROP CONSTRAINT IF EXISTS "chk_diverg_receb_tipo";--> statement-breakpoint
ALTER TABLE "divergencias_recebimento" ADD CONSTRAINT "chk_diverg_receb_tipo" CHECK ("divergencias_recebimento"."tipo" IN (
  'quantidade_menor','quantidade_maior','item_divergente','qualidade_divergente',
  'peso_incompativel','item_ausente','item_excedente','inconsistencia_nf_fisico',
  'falta','excesso','produto_nao_previsto','peso_divergente','outro'
));
