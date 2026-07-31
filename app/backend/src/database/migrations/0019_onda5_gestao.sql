CREATE TABLE "relatorios_sif" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"operacao_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"codigo" text NOT NULL,
	"nome" text NOT NULL,
	"status" text DEFAULT 'pendente_dados' NOT NULL,
	"perfil_responsavel" text NOT NULL,
	"pendencias_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"versao_atual" integer DEFAULT 0 NOT NULL,
	"provisorio" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_relatorios_sif_tipo" CHECK ("relatorios_sif"."tipo" IN ('mapa_recebimento','producao_desossa','controle_expedicao','perdas_destinacao')),
	CONSTRAINT "chk_relatorios_sif_status" CHECK ("relatorios_sif"."status" IN ('pendente_dados','pronto_para_gerar','gerado','retificado')),
	CONSTRAINT "chk_relatorios_sif_versao" CHECK ("relatorios_sif"."versao_atual" >= 0)
);
--> statement-breakpoint
CREATE TABLE "relatorios_sif_versoes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relatorio_id" uuid NOT NULL,
	"versao" integer NOT NULL,
	"tipo_geracao" text NOT NULL,
	"motivo_retificacao" text,
	"conteudo_json" jsonb NOT NULL,
	"gerado_por_id" uuid NOT NULL,
	"gerado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_sif_versao_tipo" CHECK ("relatorios_sif_versoes"."tipo_geracao" IN ('gerado','retificado')),
	CONSTRAINT "chk_sif_versao_positiva" CHECK ("relatorios_sif_versoes"."versao" >= 1),
	CONSTRAINT "chk_sif_versao_motivo" CHECK (("relatorios_sif_versoes"."tipo_geracao" = 'gerado' AND "relatorios_sif_versoes"."motivo_retificacao" IS NULL)
          OR ("relatorios_sif_versoes"."tipo_geracao" = 'retificado' AND "relatorios_sif_versoes"."motivo_retificacao" IS NOT NULL
              AND length(btrim("relatorios_sif_versoes"."motivo_retificacao")) >= 10))
);
--> statement-breakpoint
CREATE TABLE "aprovacoes_operacionais" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"operacao_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"origem" text NOT NULL,
	"descricao" text NOT NULL,
	"impacto" text NOT NULL,
	"referencia_tabela" text,
	"referencia_id" uuid,
	"solicitante_id" uuid NOT NULL,
	"solicitado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"decisao_motivo" text,
	"decidido_por_id" uuid,
	"decidido_em" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_aprovacao_tipo" CHECK ("aprovacoes_operacionais"."tipo" IN ('divergencia_transformacao','estorno_fora_regra',
                        'reabertura_carga_pedido','ajuste_estoque_relevante')),
	CONSTRAINT "chk_aprovacao_status" CHECK ("aprovacoes_operacionais"."status" IN ('pendente','aprovada','rejeitada')),
	CONSTRAINT "chk_aprovacao_decisao" CHECK ((
        ("aprovacoes_operacionais"."status" = 'pendente'
          AND "aprovacoes_operacionais"."decisao_motivo" IS NULL AND "aprovacoes_operacionais"."decidido_por_id" IS NULL AND "aprovacoes_operacionais"."decidido_em" IS NULL)
        OR
        ("aprovacoes_operacionais"."status" IN ('aprovada','rejeitada')
          AND "aprovacoes_operacionais"."decisao_motivo" IS NOT NULL AND length(btrim("aprovacoes_operacionais"."decisao_motivo")) >= 10
          AND "aprovacoes_operacionais"."decidido_por_id" IS NOT NULL AND "aprovacoes_operacionais"."decidido_em" IS NOT NULL)
      ))
);
--> statement-breakpoint
ALTER TABLE "relatorios_sif" ADD CONSTRAINT "relatorios_sif_operacao_id_operacoes_id_fk" FOREIGN KEY ("operacao_id") REFERENCES "public"."operacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relatorios_sif_versoes" ADD CONSTRAINT "relatorios_sif_versoes_relatorio_id_relatorios_sif_id_fk" FOREIGN KEY ("relatorio_id") REFERENCES "public"."relatorios_sif"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relatorios_sif_versoes" ADD CONSTRAINT "relatorios_sif_versoes_gerado_por_id_usuarios_id_fk" FOREIGN KEY ("gerado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aprovacoes_operacionais" ADD CONSTRAINT "aprovacoes_operacionais_operacao_id_operacoes_id_fk" FOREIGN KEY ("operacao_id") REFERENCES "public"."operacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aprovacoes_operacionais" ADD CONSTRAINT "aprovacoes_operacionais_solicitante_id_usuarios_id_fk" FOREIGN KEY ("solicitante_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aprovacoes_operacionais" ADD CONSTRAINT "aprovacoes_operacionais_decidido_por_id_usuarios_id_fk" FOREIGN KEY ("decidido_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_relatorios_sif_operacao_tipo" ON "relatorios_sif" USING btree ("operacao_id","tipo") WHERE "relatorios_sif"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_relatorios_sif_status" ON "relatorios_sif" USING btree ("status") WHERE "relatorios_sif"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_relatorios_sif_pendencias_gin" ON "relatorios_sif" USING gin ("pendencias_json");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sif_versao" ON "relatorios_sif_versoes" USING btree ("relatorio_id","versao");--> statement-breakpoint
CREATE INDEX "idx_sif_versao_relatorio" ON "relatorios_sif_versoes" USING btree ("relatorio_id","versao");--> statement-breakpoint
CREATE INDEX "idx_aprovacoes_operacao" ON "aprovacoes_operacionais" USING btree ("operacao_id") WHERE "aprovacoes_operacionais"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_aprovacoes_status" ON "aprovacoes_operacionais" USING btree ("status") WHERE "aprovacoes_operacionais"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_aprovacoes_referencia" ON "aprovacoes_operacionais" USING btree ("referencia_tabela","referencia_id") WHERE "aprovacoes_operacionais"."deleted_at" IS NULL;--> statement-breakpoint
-- Imutabilidade do comparativo Pedido x NF x Pesagem (v1.1 6.10.7).
CREATE OR REPLACE FUNCTION conclusao_conferencia_imutavel() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'conclusoes_conferencia e imutavel (v1.1 6.10.7): tentativa de % em %',
    TG_OP, TG_TABLE_NAME
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER trg_conclusoes_conferencia_imutavel
  BEFORE UPDATE OR DELETE ON conclusoes_conferencia
  FOR EACH ROW EXECUTE FUNCTION conclusao_conferencia_imutavel();--> statement-breakpoint
CREATE TRIGGER trg_conclusoes_conferencia_nfs_imutavel
  BEFORE UPDATE OR DELETE ON conclusoes_conferencia_nfs
  FOR EACH ROW EXECUTE FUNCTION conclusao_conferencia_imutavel();--> statement-breakpoint
CREATE TRIGGER trg_relatorios_sif_updated_at
  BEFORE UPDATE ON relatorios_sif
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_aprovacoes_operacionais_updated_at
  BEFORE UPDATE ON aprovacoes_operacionais
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();