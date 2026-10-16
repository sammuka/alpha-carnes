CREATE TABLE "cfops" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"codigo" varchar(4) NOT NULL,
	"descricao" varchar(255) NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL,
	"criado_por_id" uuid NOT NULL,
	"atualizado_por_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "cfops_codigo_formato_check" CHECK ("cfops"."codigo" ~ '^[0-9]{4}$'),
	CONSTRAINT "cfops_descricao_preenchida_check" CHECK (btrim("cfops"."descricao") <> ''),
	CONSTRAINT "cfops_versao_positiva_check" CHECK ("cfops"."versao" >= 1)
);
--> statement-breakpoint
CREATE TABLE "enquadramentos_fiscais" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"codigo" varchar(20) NOT NULL,
	"empresa_id" uuid NOT NULL,
	"estabelecimento_id" uuid NOT NULL,
	"operacao_id" uuid NOT NULL,
	"tp_nf" varchar(1) NOT NULL,
	"fin_nfe" varchar(1) NOT NULL,
	"cfop_id" uuid NOT NULL,
	"abrangencia" text NOT NULL,
	"tipo_produto" text NOT NULL,
	"produto_id" uuid NOT NULL,
	"ncm_id" uuid NOT NULL,
	"cest" varchar(7) NOT NULL,
	"cliente_id" uuid NOT NULL,
	"vigencia_inicio" date NOT NULL,
	"vigencia_fim" date,
	"prioridade" integer NOT NULL,
	"situacao" text DEFAULT 'ATIVA' NOT NULL,
	"origem_enquadramento_id" uuid,
	"justificativa_situacao" text,
	"versao" integer DEFAULT 1 NOT NULL,
	"criado_por_id" uuid NOT NULL,
	"atualizado_por_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "enquadramentos_codigo_formato_check" CHECK ("enquadramentos_fiscais"."codigo" ~ '^[1-9][0-9]{0,17}$'),
	CONSTRAINT "enquadramentos_tp_nf_check" CHECK ("enquadramentos_fiscais"."tp_nf" IN ('0','1')),
	CONSTRAINT "enquadramentos_fin_nfe_check" CHECK ("enquadramentos_fiscais"."fin_nfe" IN ('1','2','3','4')),
	CONSTRAINT "enquadramentos_abrangencia_check" CHECK ("enquadramentos_fiscais"."abrangencia" IN ('INTERNA','INTER','EXT')),
	CONSTRAINT "enquadramentos_tipo_produto_check" CHECK ("enquadramentos_fiscais"."tipo_produto" IN ('PROPRIA','REVENDA','SUB')),
	CONSTRAINT "enquadramentos_cest_formato_check" CHECK ("enquadramentos_fiscais"."cest" ~ '^[0-9]{7}$'),
	CONSTRAINT "enquadramentos_vigencia_ordem_check" CHECK ("enquadramentos_fiscais"."vigencia_fim" IS NULL OR "enquadramentos_fiscais"."vigencia_fim" >= "enquadramentos_fiscais"."vigencia_inicio"),
	CONSTRAINT "enquadramentos_prioridade_check" CHECK ("enquadramentos_fiscais"."prioridade" >= 1),
	CONSTRAINT "enquadramentos_situacao_check" CHECK ("enquadramentos_fiscais"."situacao" IN ('ATIVA','INATIVA')),
	CONSTRAINT "enquadramentos_versao_positiva_check" CHECK ("enquadramentos_fiscais"."versao" >= 1),
	CONSTRAINT "enquadramentos_inativa_justificativa_check" CHECK ("enquadramentos_fiscais"."situacao" <> 'INATIVA' OR "enquadramentos_fiscais"."justificativa_situacao" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "ncms" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"codigo" varchar(8) NOT NULL,
	"descricao" varchar(255) NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL,
	"criado_por_id" uuid NOT NULL,
	"atualizado_por_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "ncms_codigo_formato_check" CHECK ("ncms"."codigo" ~ '^[0-9]{8}$'),
	CONSTRAINT "ncms_descricao_preenchida_check" CHECK (btrim("ncms"."descricao") <> ''),
	CONSTRAINT "ncms_versao_positiva_check" CHECK ("ncms"."versao" >= 1)
);
--> statement-breakpoint
ALTER TABLE "cfops" ADD CONSTRAINT "cfops_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cfops" ADD CONSTRAINT "cfops_atualizado_por_id_usuarios_id_fk" FOREIGN KEY ("atualizado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquadramentos_fiscais" ADD CONSTRAINT "enquadramentos_fiscais_operacao_id_operacoes_id_fk" FOREIGN KEY ("operacao_id") REFERENCES "public"."operacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquadramentos_fiscais" ADD CONSTRAINT "enquadramentos_fiscais_cfop_id_cfops_id_fk" FOREIGN KEY ("cfop_id") REFERENCES "public"."cfops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquadramentos_fiscais" ADD CONSTRAINT "enquadramentos_fiscais_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquadramentos_fiscais" ADD CONSTRAINT "enquadramentos_fiscais_ncm_id_ncms_id_fk" FOREIGN KEY ("ncm_id") REFERENCES "public"."ncms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquadramentos_fiscais" ADD CONSTRAINT "enquadramentos_fiscais_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquadramentos_fiscais" ADD CONSTRAINT "enquadramentos_fiscais_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquadramentos_fiscais" ADD CONSTRAINT "enquadramentos_fiscais_atualizado_por_id_usuarios_id_fk" FOREIGN KEY ("atualizado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquadramentos_fiscais" ADD CONSTRAINT "enquadramentos_fiscais_estabelecimento_empresa_fk" FOREIGN KEY ("estabelecimento_id","empresa_id") REFERENCES "public"."estabelecimentos"("id","empresa_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquadramentos_fiscais" ADD CONSTRAINT "enquadramentos_fiscais_origem_fk" FOREIGN KEY ("origem_enquadramento_id") REFERENCES "public"."enquadramentos_fiscais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ncms" ADD CONSTRAINT "ncms_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ncms" ADD CONSTRAINT "ncms_atualizado_por_id_usuarios_id_fk" FOREIGN KEY ("atualizado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cfops_codigo" ON "cfops" USING btree ("codigo") WHERE "cfops"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_cfops_criado_por" ON "cfops" USING btree ("criado_por_id");--> statement-breakpoint
CREATE INDEX "idx_cfops_atualizado_por" ON "cfops" USING btree ("atualizado_por_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_enquadramentos_codigo" ON "enquadramentos_fiscais" USING btree ("codigo") WHERE "enquadramentos_fiscais"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_enquadramentos_empresa" ON "enquadramentos_fiscais" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "idx_enquadramentos_estabelecimento" ON "enquadramentos_fiscais" USING btree ("estabelecimento_id");--> statement-breakpoint
CREATE INDEX "idx_enquadramentos_operacao" ON "enquadramentos_fiscais" USING btree ("operacao_id");--> statement-breakpoint
CREATE INDEX "idx_enquadramentos_cfop" ON "enquadramentos_fiscais" USING btree ("cfop_id");--> statement-breakpoint
CREATE INDEX "idx_enquadramentos_produto" ON "enquadramentos_fiscais" USING btree ("produto_id");--> statement-breakpoint
CREATE INDEX "idx_enquadramentos_ncm" ON "enquadramentos_fiscais" USING btree ("ncm_id");--> statement-breakpoint
CREATE INDEX "idx_enquadramentos_cliente" ON "enquadramentos_fiscais" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "idx_enquadramentos_origem" ON "enquadramentos_fiscais" USING btree ("origem_enquadramento_id");--> statement-breakpoint
CREATE INDEX "idx_enquadramentos_vigencia" ON "enquadramentos_fiscais" USING btree ("estabelecimento_id","vigencia_inicio");--> statement-breakpoint
CREATE INDEX "idx_enquadramentos_criado_por" ON "enquadramentos_fiscais" USING btree ("criado_por_id");--> statement-breakpoint
CREATE INDEX "idx_enquadramentos_atualizado_por" ON "enquadramentos_fiscais" USING btree ("atualizado_por_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ncms_codigo" ON "ncms" USING btree ("codigo") WHERE "ncms"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_ncms_criado_por" ON "ncms" USING btree ("criado_por_id");--> statement-breakpoint
CREATE INDEX "idx_ncms_atualizado_por" ON "ncms" USING btree ("atualizado_por_id");