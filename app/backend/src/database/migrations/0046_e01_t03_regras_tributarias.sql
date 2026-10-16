CREATE TABLE "beneficios_fiscais" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"codigo" varchar(8) NOT NULL,
	"descricao" varchar(255) NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL,
	"criado_por_id" uuid NOT NULL,
	"atualizado_por_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "beneficios_codigo_formato_check" CHECK ("beneficios_fiscais"."codigo" ~ '^[A-Z]{2}[0-9]{6}$'),
	CONSTRAINT "beneficios_descricao_preenchida_check" CHECK (btrim("beneficios_fiscais"."descricao") <> ''),
	CONSTRAINT "beneficios_versao_positiva_check" CHECK ("beneficios_fiscais"."versao" >= 1)
);
--> statement-breakpoint
CREATE TABLE "classificacoes_ibs_cbs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"codigo" varchar(6) NOT NULL,
	"descricao" varchar(255) NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL,
	"criado_por_id" uuid NOT NULL,
	"atualizado_por_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "classificacoes_codigo_formato_check" CHECK ("classificacoes_ibs_cbs"."codigo" ~ '^[0-9]{6}$'),
	CONSTRAINT "classificacoes_descricao_preenchida_check" CHECK (btrim("classificacoes_ibs_cbs"."descricao") <> ''),
	CONSTRAINT "classificacoes_versao_positiva_check" CHECK ("classificacoes_ibs_cbs"."versao" >= 1)
);
--> statement-breakpoint
CREATE TABLE "regras_tributarias" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"codigo" varchar(20) NOT NULL,
	"numero_versao" integer NOT NULL,
	"enquadramento_id" uuid NOT NULL,
	"icms_cst" varchar(2) NOT NULL,
	"p_red_bc" numeric(5, 4) NOT NULL,
	"p_icms" numeric(5, 4) NOT NULL,
	"beneficio_fiscal_id" uuid NOT NULL,
	"ipi_cst" varchar(2) NOT NULL,
	"pis_cst" varchar(2) NOT NULL,
	"ibs_cst" varchar(3) NOT NULL,
	"classificacao_ibs_cbs_id" uuid NOT NULL,
	"vigencia_inicio" date NOT NULL,
	"vigencia_fim" date,
	"situacao" text DEFAULT 'RASCUNHO' NOT NULL,
	"origem_versao_id" uuid,
	"justificativa" text NOT NULL,
	"submetido_por_id" uuid,
	"submetido_em" timestamp with time zone,
	"aprovado_por_id" uuid,
	"aprovado_em" timestamp with time zone,
	"aposentado_por_id" uuid,
	"aposentado_em" timestamp with time zone,
	"versao" integer DEFAULT 1 NOT NULL,
	"criado_por_id" uuid NOT NULL,
	"atualizado_por_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "regras_codigo_formato_check" CHECK ("regras_tributarias"."codigo" ~ '^[1-9][0-9]{0,17}$'),
	CONSTRAINT "regras_numero_versao_check" CHECK ("regras_tributarias"."numero_versao" >= 1),
	CONSTRAINT "regras_icms_cst_check" CHECK ("regras_tributarias"."icms_cst" IN ('00','20','40','41','51')),
	CONSTRAINT "regras_ipi_cst_check" CHECK ("regras_tributarias"."ipi_cst" IN ('51','53','99')),
	CONSTRAINT "regras_pis_cst_check" CHECK ("regras_tributarias"."pis_cst" IN ('01','06','08','99')),
	CONSTRAINT "regras_ibs_cst_check" CHECK ("regras_tributarias"."ibs_cst" IN ('000','200')),
	CONSTRAINT "regras_p_red_bc_faixa_check" CHECK ("regras_tributarias"."p_red_bc" >= 0 AND "regras_tributarias"."p_red_bc" <= 1),
	CONSTRAINT "regras_p_icms_faixa_check" CHECK ("regras_tributarias"."p_icms" >= 0 AND "regras_tributarias"."p_icms" <= 1),
	CONSTRAINT "regras_vigencia_ordem_check" CHECK ("regras_tributarias"."vigencia_fim" IS NULL OR "regras_tributarias"."vigencia_fim" >= "regras_tributarias"."vigencia_inicio"),
	CONSTRAINT "regras_situacao_check" CHECK ("regras_tributarias"."situacao" IN ('RASCUNHO','SUBMETIDA','APROVADA','APOSENTADA')),
	CONSTRAINT "regras_versao_positiva_check" CHECK ("regras_tributarias"."versao" >= 1),
	CONSTRAINT "regras_submetida_autor_check" CHECK ("regras_tributarias"."situacao" = 'RASCUNHO' OR "regras_tributarias"."submetido_por_id" IS NOT NULL),
	CONSTRAINT "regras_aprovada_check" CHECK ("regras_tributarias"."situacao" NOT IN ('APROVADA','APOSENTADA') OR ("regras_tributarias"."aprovado_por_id" IS NOT NULL AND "regras_tributarias"."aprovado_em" IS NOT NULL)),
	CONSTRAINT "regras_aposentada_check" CHECK ("regras_tributarias"."situacao" <> 'APOSENTADA' OR ("regras_tributarias"."aposentado_por_id" IS NOT NULL AND "regras_tributarias"."aposentado_em" IS NOT NULL)),
	CONSTRAINT "regras_aprovador_diferente_check" CHECK ("regras_tributarias"."aprovado_por_id" IS NULL OR "regras_tributarias"."aprovado_por_id" <> "regras_tributarias"."submetido_por_id"),
	CONSTRAINT "regras_aposentador_diferente_check" CHECK ("regras_tributarias"."aposentado_por_id" IS NULL OR "regras_tributarias"."aposentado_por_id" <> "regras_tributarias"."submetido_por_id")
);
--> statement-breakpoint
ALTER TABLE "beneficios_fiscais" ADD CONSTRAINT "beneficios_fiscais_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beneficios_fiscais" ADD CONSTRAINT "beneficios_fiscais_atualizado_por_id_usuarios_id_fk" FOREIGN KEY ("atualizado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classificacoes_ibs_cbs" ADD CONSTRAINT "classificacoes_ibs_cbs_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classificacoes_ibs_cbs" ADD CONSTRAINT "classificacoes_ibs_cbs_atualizado_por_id_usuarios_id_fk" FOREIGN KEY ("atualizado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regras_tributarias" ADD CONSTRAINT "regras_tributarias_enquadramento_id_enquadramentos_fiscais_id_fk" FOREIGN KEY ("enquadramento_id") REFERENCES "public"."enquadramentos_fiscais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regras_tributarias" ADD CONSTRAINT "regras_tributarias_beneficio_fiscal_id_beneficios_fiscais_id_fk" FOREIGN KEY ("beneficio_fiscal_id") REFERENCES "public"."beneficios_fiscais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regras_tributarias" ADD CONSTRAINT "regras_tributarias_classificacao_ibs_cbs_id_classificacoes_ibs_cbs_id_fk" FOREIGN KEY ("classificacao_ibs_cbs_id") REFERENCES "public"."classificacoes_ibs_cbs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regras_tributarias" ADD CONSTRAINT "regras_tributarias_submetido_por_id_usuarios_id_fk" FOREIGN KEY ("submetido_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regras_tributarias" ADD CONSTRAINT "regras_tributarias_aprovado_por_id_usuarios_id_fk" FOREIGN KEY ("aprovado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regras_tributarias" ADD CONSTRAINT "regras_tributarias_aposentado_por_id_usuarios_id_fk" FOREIGN KEY ("aposentado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regras_tributarias" ADD CONSTRAINT "regras_tributarias_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regras_tributarias" ADD CONSTRAINT "regras_tributarias_atualizado_por_id_usuarios_id_fk" FOREIGN KEY ("atualizado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regras_tributarias" ADD CONSTRAINT "regras_tributarias_origem_fk" FOREIGN KEY ("origem_versao_id") REFERENCES "public"."regras_tributarias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_beneficios_codigo" ON "beneficios_fiscais" USING btree ("codigo") WHERE "beneficios_fiscais"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_beneficios_criado_por" ON "beneficios_fiscais" USING btree ("criado_por_id");--> statement-breakpoint
CREATE INDEX "idx_beneficios_atualizado_por" ON "beneficios_fiscais" USING btree ("atualizado_por_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_classificacoes_codigo" ON "classificacoes_ibs_cbs" USING btree ("codigo") WHERE "classificacoes_ibs_cbs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_classificacoes_criado_por" ON "classificacoes_ibs_cbs" USING btree ("criado_por_id");--> statement-breakpoint
CREATE INDEX "idx_classificacoes_atualizado_por" ON "classificacoes_ibs_cbs" USING btree ("atualizado_por_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_regras_codigo_versao" ON "regras_tributarias" USING btree ("codigo","numero_versao") WHERE "regras_tributarias"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_regras_abertas_codigo" ON "regras_tributarias" USING btree ("codigo") WHERE "regras_tributarias"."deleted_at" IS NULL AND "regras_tributarias"."situacao" IN ('RASCUNHO','SUBMETIDA');--> statement-breakpoint
CREATE INDEX "idx_regras_enquadramento" ON "regras_tributarias" USING btree ("enquadramento_id");--> statement-breakpoint
CREATE INDEX "idx_regras_beneficio" ON "regras_tributarias" USING btree ("beneficio_fiscal_id");--> statement-breakpoint
CREATE INDEX "idx_regras_classificacao" ON "regras_tributarias" USING btree ("classificacao_ibs_cbs_id");--> statement-breakpoint
CREATE INDEX "idx_regras_origem" ON "regras_tributarias" USING btree ("origem_versao_id");--> statement-breakpoint
CREATE INDEX "idx_regras_situacao" ON "regras_tributarias" USING btree ("situacao") WHERE "regras_tributarias"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_regras_criado_por" ON "regras_tributarias" USING btree ("criado_por_id");--> statement-breakpoint
CREATE INDEX "idx_regras_atualizado_por" ON "regras_tributarias" USING btree ("atualizado_por_id");--> statement-breakpoint
CREATE INDEX "idx_regras_submetido_por" ON "regras_tributarias" USING btree ("submetido_por_id");--> statement-breakpoint
CREATE INDEX "idx_regras_aprovado_por" ON "regras_tributarias" USING btree ("aprovado_por_id");--> statement-breakpoint
CREATE INDEX "idx_regras_aposentado_por" ON "regras_tributarias" USING btree ("aposentado_por_id");