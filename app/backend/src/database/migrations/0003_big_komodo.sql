CREATE TABLE "divergencias_recebimento" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"recebimento_id" uuid NOT NULL,
	"recebimento_item_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"descricao" text NOT NULL,
	"impacto_operacional" text,
	"impacto_comercial" text,
	"acao_imediata" text NOT NULL,
	"responsavel_registro_id" uuid NOT NULL,
	"aprovador_id" uuid,
	"status" text DEFAULT 'aberta' NOT NULL,
	"pedidos_impactados" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_diverg_receb_tipo" CHECK ("divergencias_recebimento"."tipo" IN ('quantidade_menor','quantidade_maior','item_divergente','qualidade_divergente','peso_incompativel','item_ausente','item_excedente','inconsistencia_nf_fisico')),
	CONSTRAINT "chk_diverg_receb_status" CHECK ("divergencias_recebimento"."status" IN ('aberta','em_analise','aguardando_fornecedor','resolvida'))
);
--> statement-breakpoint
CREATE TABLE "recebimentos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"compra_programada_id" uuid NOT NULL,
	"fornecedor_id" uuid NOT NULL,
	"data_operacao" date NOT NULL,
	"data_hora_chegada" timestamp with time zone DEFAULT now() NOT NULL,
	"nota_fiscal_fornecedor" text,
	"placa_veiculo" text,
	"motorista" text,
	"doca" text,
	"responsavel_recebimento_id" uuid NOT NULL,
	"status" text DEFAULT 'em_andamento' NOT NULL,
	"observacoes" text,
	"usuario_conclusao_id" uuid,
	"data_conclusao" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_recebimentos_status" CHECK ("recebimentos"."status" IN ('em_andamento','com_divergencia','concluido'))
);
--> statement-breakpoint
CREATE TABLE "recebimentos_itens" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"recebimento_id" uuid NOT NULL,
	"item_comercial_id" uuid NOT NULL,
	"quantidade_esperada" numeric(15, 3) NOT NULL,
	"quantidade_recebida" numeric(15, 3) DEFAULT '0' NOT NULL,
	"peso_total_apurado" numeric(10, 3),
	"status_apuracao" text DEFAULT 'aguardando' NOT NULL,
	"observacoes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_receb_itens_esperada_nao_negativa" CHECK ("recebimentos_itens"."quantidade_esperada" >= 0),
	CONSTRAINT "chk_receb_itens_recebida_nao_negativa" CHECK ("recebimentos_itens"."quantidade_recebida" >= 0),
	CONSTRAINT "chk_receb_itens_status_apuracao" CHECK ("recebimentos_itens"."status_apuracao" IN ('aguardando','conforme','divergente'))
);
--> statement-breakpoint
CREATE TABLE "ocorrencias_fornecedor" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"fornecedor_id" uuid NOT NULL,
	"compra_programada_id" uuid,
	"divergencia_id" uuid,
	"status" text DEFAULT 'aberta' NOT NULL,
	"descricao" text NOT NULL,
	"impacto" text,
	"data_hora_abertura" timestamp with time zone DEFAULT now() NOT NULL,
	"data_hora_encerramento" timestamp with time zone,
	"desfecho" text,
	"usuario_abertura_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_ocorr_forn_status" CHECK ("ocorrencias_fornecedor"."status" IN ('aberta','em_analise','aguardando_fornecedor','resolvida'))
);
--> statement-breakpoint
CREATE TABLE "ocorrencias_fornecedor_historico" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"ocorrencia_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"acao" text NOT NULL,
	"retorno_fornecedor" text,
	"proximo_passo" text,
	"situacao" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "disponibilidades_virtuais" ADD COLUMN "quantidade_recebida" numeric(15, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "disponibilidades_virtuais" ADD COLUMN "quantidade_com_divergencia" numeric(15, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "divergencias_recebimento" ADD CONSTRAINT "divergencias_recebimento_recebimento_id_recebimentos_id_fk" FOREIGN KEY ("recebimento_id") REFERENCES "public"."recebimentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divergencias_recebimento" ADD CONSTRAINT "divergencias_recebimento_recebimento_item_id_recebimentos_itens_id_fk" FOREIGN KEY ("recebimento_item_id") REFERENCES "public"."recebimentos_itens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divergencias_recebimento" ADD CONSTRAINT "divergencias_recebimento_responsavel_registro_id_usuarios_id_fk" FOREIGN KEY ("responsavel_registro_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divergencias_recebimento" ADD CONSTRAINT "divergencias_recebimento_aprovador_id_usuarios_id_fk" FOREIGN KEY ("aprovador_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recebimentos" ADD CONSTRAINT "recebimentos_compra_programada_id_compras_programadas_id_fk" FOREIGN KEY ("compra_programada_id") REFERENCES "public"."compras_programadas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recebimentos" ADD CONSTRAINT "recebimentos_fornecedor_id_fornecedores_id_fk" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."fornecedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recebimentos" ADD CONSTRAINT "recebimentos_responsavel_recebimento_id_usuarios_id_fk" FOREIGN KEY ("responsavel_recebimento_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recebimentos" ADD CONSTRAINT "recebimentos_usuario_conclusao_id_usuarios_id_fk" FOREIGN KEY ("usuario_conclusao_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recebimentos_itens" ADD CONSTRAINT "recebimentos_itens_recebimento_id_recebimentos_id_fk" FOREIGN KEY ("recebimento_id") REFERENCES "public"."recebimentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recebimentos_itens" ADD CONSTRAINT "recebimentos_itens_item_comercial_id_itens_comerciais_id_fk" FOREIGN KEY ("item_comercial_id") REFERENCES "public"."itens_comerciais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocorrencias_fornecedor" ADD CONSTRAINT "ocorrencias_fornecedor_fornecedor_id_fornecedores_id_fk" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."fornecedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocorrencias_fornecedor" ADD CONSTRAINT "ocorrencias_fornecedor_compra_programada_id_compras_programadas_id_fk" FOREIGN KEY ("compra_programada_id") REFERENCES "public"."compras_programadas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocorrencias_fornecedor" ADD CONSTRAINT "ocorrencias_fornecedor_divergencia_id_divergencias_recebimento_id_fk" FOREIGN KEY ("divergencia_id") REFERENCES "public"."divergencias_recebimento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocorrencias_fornecedor" ADD CONSTRAINT "ocorrencias_fornecedor_usuario_abertura_id_usuarios_id_fk" FOREIGN KEY ("usuario_abertura_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocorrencias_fornecedor_historico" ADD CONSTRAINT "ocorrencias_fornecedor_historico_ocorrencia_id_ocorrencias_fornecedor_id_fk" FOREIGN KEY ("ocorrencia_id") REFERENCES "public"."ocorrencias_fornecedor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocorrencias_fornecedor_historico" ADD CONSTRAINT "ocorrencias_fornecedor_historico_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_diverg_receb_recebimento" ON "divergencias_recebimento" USING btree ("recebimento_id");--> statement-breakpoint
CREATE INDEX "idx_diverg_receb_item" ON "divergencias_recebimento" USING btree ("recebimento_item_id");--> statement-breakpoint
CREATE INDEX "idx_diverg_receb_status" ON "divergencias_recebimento" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_diverg_receb_pedidos_gin" ON "divergencias_recebimento" USING gin ("pedidos_impactados");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_recebimentos_compra" ON "recebimentos" USING btree ("compra_programada_id") WHERE "recebimentos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_recebimentos_status" ON "recebimentos" USING btree ("status") WHERE "recebimentos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_recebimentos_data_operacao" ON "recebimentos" USING btree ("data_operacao") WHERE "recebimentos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_recebimentos_fornecedor" ON "recebimentos" USING btree ("fornecedor_id") WHERE "recebimentos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_receb_itens_recebimento_item" ON "recebimentos_itens" USING btree ("recebimento_id","item_comercial_id");--> statement-breakpoint
CREATE INDEX "idx_receb_itens_recebimento" ON "recebimentos_itens" USING btree ("recebimento_id");--> statement-breakpoint
CREATE INDEX "idx_receb_itens_item_comercial" ON "recebimentos_itens" USING btree ("item_comercial_id");--> statement-breakpoint
CREATE INDEX "idx_ocorr_forn_fornecedor" ON "ocorrencias_fornecedor" USING btree ("fornecedor_id");--> statement-breakpoint
CREATE INDEX "idx_ocorr_forn_divergencia" ON "ocorrencias_fornecedor" USING btree ("divergencia_id");--> statement-breakpoint
CREATE INDEX "idx_ocorr_forn_status" ON "ocorrencias_fornecedor" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ocorr_forn_hist_ocorrencia" ON "ocorrencias_fornecedor_historico" USING btree ("ocorrencia_id");--> statement-breakpoint
ALTER TABLE "disponibilidades_virtuais" ADD CONSTRAINT "chk_disp_recebida_nao_negativo" CHECK ("disponibilidades_virtuais"."quantidade_recebida" >= 0);--> statement-breakpoint
ALTER TABLE "disponibilidades_virtuais" ADD CONSTRAINT "chk_disp_com_divergencia_nao_negativo" CHECK ("disponibilidades_virtuais"."quantidade_com_divergencia" >= 0);--> statement-breakpoint
-- Triggers set_updated_at (a função já existe desde a migration 0000) — SQL manual.
CREATE TRIGGER trg_recebimentos_updated_at BEFORE UPDATE ON "recebimentos" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_recebimentos_itens_updated_at BEFORE UPDATE ON "recebimentos_itens" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_divergencias_recebimento_updated_at BEFORE UPDATE ON "divergencias_recebimento" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_ocorrencias_fornecedor_updated_at BEFORE UPDATE ON "ocorrencias_fornecedor" FOR EACH ROW EXECUTE FUNCTION set_updated_at();