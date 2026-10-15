CREATE TABLE "empresas" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"razao_social" varchar(150) NOT NULL,
	"cnpj_raiz" varchar(8) NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL,
	"criado_por_id" uuid NOT NULL,
	"atualizado_por_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "empresas_cnpj_raiz_formato_check" CHECK ("empresas"."cnpj_raiz" ~ '^[0-9A-Z]{8}$'),
	CONSTRAINT "empresas_razao_social_preenchida_check" CHECK (btrim("empresas"."razao_social") <> ''),
	CONSTRAINT "empresas_versao_positiva_check" CHECK ("empresas"."versao" >= 1)
);
--> statement-breakpoint
CREATE TABLE "estabelecimento_alteracao_cnaes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"alteracao_id" uuid NOT NULL,
	"codigo" varchar(7) NOT NULL,
	"descricao" varchar(255) NOT NULL,
	"tipo" text NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL,
	"criado_por_id" uuid NOT NULL,
	"atualizado_por_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "estab_alt_cnaes_codigo_formato_check" CHECK ("estabelecimento_alteracao_cnaes"."codigo" ~ '^[0-9]{7}$'),
	CONSTRAINT "estab_alt_cnaes_tipo_valido_check" CHECK ("estabelecimento_alteracao_cnaes"."tipo" IN ('PRINCIPAL','SECUNDARIA')),
	CONSTRAINT "estab_alt_cnaes_descricao_preenchida_check" CHECK (btrim("estabelecimento_alteracao_cnaes"."descricao") <> '')
);
--> statement-breakpoint
CREATE TABLE "estabelecimento_alteracoes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"estabelecimento_id" uuid NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nome" varchar(120) NOT NULL,
	"inscricao_estadual" varchar(20) NOT NULL,
	"inscricao_municipal" varchar(20) NOT NULL,
	"uf" varchar(2) NOT NULL,
	"versao_base" integer NOT NULL,
	"situacao" text DEFAULT 'DRAFT' NOT NULL,
	"justificativa" text NOT NULL,
	"motivo_rejeicao" text,
	"submetido_por_id" uuid,
	"decidido_por_id" uuid,
	"decidido_em" timestamp with time zone,
	"versao" integer DEFAULT 1 NOT NULL,
	"criado_por_id" uuid NOT NULL,
	"atualizado_por_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "estab_alteracoes_ie_formato_check" CHECK ("estabelecimento_alteracoes"."inscricao_estadual" ~ '^[0-9A-Z]{1,20}$'),
	CONSTRAINT "estab_alteracoes_im_formato_check" CHECK ("estabelecimento_alteracoes"."inscricao_municipal" ~ '^[0-9A-Z]{1,20}$'),
	CONSTRAINT "estab_alteracoes_nome_preenchido_check" CHECK (btrim("estabelecimento_alteracoes"."nome") <> ''),
	CONSTRAINT "estab_alteracoes_uf_valida_check" CHECK ("estabelecimento_alteracoes"."uf" IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
	CONSTRAINT "estab_alteracoes_situacao_valida_check" CHECK ("estabelecimento_alteracoes"."situacao" IN ('DRAFT','REVIEW','APPROVED','REJECTED')),
	CONSTRAINT "estab_alteracoes_justificativa_preenchida_check" CHECK (btrim("estabelecimento_alteracoes"."justificativa") <> ''),
	CONSTRAINT "estab_alteracoes_review_submetido_check" CHECK ("estabelecimento_alteracoes"."situacao" <> 'REVIEW' OR "estabelecimento_alteracoes"."submetido_por_id" IS NOT NULL),
	CONSTRAINT "estab_alteracoes_decidido_check" CHECK ("estabelecimento_alteracoes"."situacao" NOT IN ('APPROVED','REJECTED') OR ("estabelecimento_alteracoes"."decidido_por_id" IS NOT NULL AND "estabelecimento_alteracoes"."decidido_em" IS NOT NULL)),
	CONSTRAINT "estab_alteracoes_rejeitada_motivo_check" CHECK ("estabelecimento_alteracoes"."situacao" <> 'REJECTED' OR "estabelecimento_alteracoes"."motivo_rejeicao" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "estabelecimento_cnaes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"estabelecimento_id" uuid NOT NULL,
	"empresa_id" uuid NOT NULL,
	"codigo" varchar(7) NOT NULL,
	"descricao" varchar(255) NOT NULL,
	"tipo" text NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL,
	"criado_por_id" uuid NOT NULL,
	"atualizado_por_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "estab_cnaes_codigo_formato_check" CHECK ("estabelecimento_cnaes"."codigo" ~ '^[0-9]{7}$'),
	CONSTRAINT "estab_cnaes_tipo_valido_check" CHECK ("estabelecimento_cnaes"."tipo" IN ('PRINCIPAL','SECUNDARIA')),
	CONSTRAINT "estab_cnaes_descricao_preenchida_check" CHECK (btrim("estabelecimento_cnaes"."descricao") <> '')
);
--> statement-breakpoint
CREATE TABLE "estabelecimentos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nome" varchar(120) NOT NULL,
	"cnpj" varchar(14) NOT NULL,
	"inscricao_estadual" varchar(20) NOT NULL,
	"inscricao_municipal" varchar(20) NOT NULL,
	"uf" varchar(2) NOT NULL,
	"municipio_ibge_codigo" varchar(7),
	"situacao" text DEFAULT 'DRAFT' NOT NULL,
	"justificativa_situacao" text,
	"submetido_por_id" uuid,
	"decidido_por_id" uuid,
	"decidido_em" timestamp with time zone,
	"versao" integer DEFAULT 1 NOT NULL,
	"criado_por_id" uuid NOT NULL,
	"atualizado_por_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "uq_estabelecimentos_id_empresa" UNIQUE("id","empresa_id"),
	CONSTRAINT "estabelecimentos_cnpj_formato_check" CHECK ("estabelecimentos"."cnpj" ~ '^[0-9A-Z]{12}[0-9]{2}$'),
	CONSTRAINT "estabelecimentos_ie_formato_check" CHECK ("estabelecimentos"."inscricao_estadual" ~ '^[0-9A-Z]{1,20}$'),
	CONSTRAINT "estabelecimentos_im_formato_check" CHECK ("estabelecimentos"."inscricao_municipal" ~ '^[0-9A-Z]{1,20}$'),
	CONSTRAINT "estabelecimentos_nome_preenchido_check" CHECK (btrim("estabelecimentos"."nome") <> ''),
	CONSTRAINT "estabelecimentos_uf_valida_check" CHECK ("estabelecimentos"."uf" IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
	CONSTRAINT "estabelecimentos_municipio_formato_check" CHECK ("estabelecimentos"."municipio_ibge_codigo" IS NULL OR "estabelecimentos"."municipio_ibge_codigo" ~ '^[0-9]{7}$'),
	CONSTRAINT "estabelecimentos_situacao_valida_check" CHECK ("estabelecimentos"."situacao" IN ('DRAFT','REVIEW','APPROVED','REJECTED','SUSPENDED')),
	CONSTRAINT "estabelecimentos_review_submetido_check" CHECK ("estabelecimentos"."situacao" <> 'REVIEW' OR "estabelecimentos"."submetido_por_id" IS NOT NULL),
	CONSTRAINT "estabelecimentos_aprovado_decidido_check" CHECK ("estabelecimentos"."situacao" <> 'APPROVED' OR ("estabelecimentos"."decidido_por_id" IS NOT NULL AND "estabelecimentos"."decidido_em" IS NOT NULL)),
	CONSTRAINT "estabelecimentos_justificativa_situacao_check" CHECK ("estabelecimentos"."situacao" NOT IN ('REJECTED','SUSPENDED') OR "estabelecimentos"."justificativa_situacao" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "regimes_tributarios" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"estabelecimento_id" uuid NOT NULL,
	"empresa_id" uuid NOT NULL,
	"crt" text NOT NULL,
	"vigencia_inicio" date NOT NULL,
	"vigencia_fim" date,
	"situacao" text DEFAULT 'DRAFT' NOT NULL,
	"justificativa" text NOT NULL,
	"motivo_rejeicao" text,
	"substitui_regime_id" uuid,
	"submetido_por_id" uuid,
	"decidido_por_id" uuid,
	"decidido_em" timestamp with time zone,
	"versao" integer DEFAULT 1 NOT NULL,
	"criado_por_id" uuid NOT NULL,
	"atualizado_por_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "uq_regimes_id_estabelecimento" UNIQUE("id","estabelecimento_id"),
	CONSTRAINT "regimes_crt_valido_check" CHECK ("regimes_tributarios"."crt" IN ('1','2','3','4')),
	CONSTRAINT "regimes_situacao_valida_check" CHECK ("regimes_tributarios"."situacao" IN ('DRAFT','REVIEW','APPROVED','REJECTED')),
	CONSTRAINT "regimes_vigencia_ordenada_check" CHECK ("regimes_tributarios"."vigencia_fim" IS NULL OR "regimes_tributarios"."vigencia_fim" >= "regimes_tributarios"."vigencia_inicio"),
	CONSTRAINT "regimes_justificativa_preenchida_check" CHECK (btrim("regimes_tributarios"."justificativa") <> ''),
	CONSTRAINT "regimes_review_submetido_check" CHECK ("regimes_tributarios"."situacao" <> 'REVIEW' OR "regimes_tributarios"."submetido_por_id" IS NOT NULL),
	CONSTRAINT "regimes_aprovado_decidido_check" CHECK ("regimes_tributarios"."situacao" <> 'APPROVED' OR ("regimes_tributarios"."decidido_por_id" IS NOT NULL AND "regimes_tributarios"."decidido_em" IS NOT NULL)),
	CONSTRAINT "regimes_rejeitado_motivo_check" CHECK ("regimes_tributarios"."situacao" <> 'REJECTED' OR "regimes_tributarios"."motivo_rejeicao" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_atualizado_por_id_usuarios_id_fk" FOREIGN KEY ("atualizado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estabelecimento_alteracao_cnaes" ADD CONSTRAINT "estabelecimento_alteracao_cnaes_alteracao_id_estabelecimento_alteracoes_id_fk" FOREIGN KEY ("alteracao_id") REFERENCES "public"."estabelecimento_alteracoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estabelecimento_alteracao_cnaes" ADD CONSTRAINT "estabelecimento_alteracao_cnaes_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estabelecimento_alteracao_cnaes" ADD CONSTRAINT "estabelecimento_alteracao_cnaes_atualizado_por_id_usuarios_id_fk" FOREIGN KEY ("atualizado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estabelecimento_alteracoes" ADD CONSTRAINT "estabelecimento_alteracoes_submetido_por_id_usuarios_id_fk" FOREIGN KEY ("submetido_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estabelecimento_alteracoes" ADD CONSTRAINT "estabelecimento_alteracoes_decidido_por_id_usuarios_id_fk" FOREIGN KEY ("decidido_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estabelecimento_alteracoes" ADD CONSTRAINT "estabelecimento_alteracoes_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estabelecimento_alteracoes" ADD CONSTRAINT "estabelecimento_alteracoes_atualizado_por_id_usuarios_id_fk" FOREIGN KEY ("atualizado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estabelecimento_alteracoes" ADD CONSTRAINT "fk_estab_alteracoes_estabelecimento_empresa" FOREIGN KEY ("estabelecimento_id","empresa_id") REFERENCES "public"."estabelecimentos"("id","empresa_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estabelecimento_cnaes" ADD CONSTRAINT "estabelecimento_cnaes_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estabelecimento_cnaes" ADD CONSTRAINT "estabelecimento_cnaes_atualizado_por_id_usuarios_id_fk" FOREIGN KEY ("atualizado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estabelecimento_cnaes" ADD CONSTRAINT "fk_estab_cnaes_estabelecimento_empresa" FOREIGN KEY ("estabelecimento_id","empresa_id") REFERENCES "public"."estabelecimentos"("id","empresa_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estabelecimentos" ADD CONSTRAINT "estabelecimentos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estabelecimentos" ADD CONSTRAINT "estabelecimentos_submetido_por_id_usuarios_id_fk" FOREIGN KEY ("submetido_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estabelecimentos" ADD CONSTRAINT "estabelecimentos_decidido_por_id_usuarios_id_fk" FOREIGN KEY ("decidido_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estabelecimentos" ADD CONSTRAINT "estabelecimentos_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estabelecimentos" ADD CONSTRAINT "estabelecimentos_atualizado_por_id_usuarios_id_fk" FOREIGN KEY ("atualizado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regimes_tributarios" ADD CONSTRAINT "regimes_tributarios_submetido_por_id_usuarios_id_fk" FOREIGN KEY ("submetido_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regimes_tributarios" ADD CONSTRAINT "regimes_tributarios_decidido_por_id_usuarios_id_fk" FOREIGN KEY ("decidido_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regimes_tributarios" ADD CONSTRAINT "regimes_tributarios_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regimes_tributarios" ADD CONSTRAINT "regimes_tributarios_atualizado_por_id_usuarios_id_fk" FOREIGN KEY ("atualizado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regimes_tributarios" ADD CONSTRAINT "fk_regimes_estabelecimento_empresa" FOREIGN KEY ("estabelecimento_id","empresa_id") REFERENCES "public"."estabelecimentos"("id","empresa_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regimes_tributarios" ADD CONSTRAINT "fk_regimes_substitui_mesmo_estabelecimento" FOREIGN KEY ("substitui_regime_id","estabelecimento_id") REFERENCES "public"."regimes_tributarios"("id","estabelecimento_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_empresas_cnpj_raiz" ON "empresas" USING btree ("cnpj_raiz") WHERE "empresas"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_empresas_criado_por" ON "empresas" USING btree ("criado_por_id");--> statement-breakpoint
CREATE INDEX "idx_empresas_atualizado_por" ON "empresas" USING btree ("atualizado_por_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_estab_alt_cnaes_principal" ON "estabelecimento_alteracao_cnaes" USING btree ("alteracao_id") WHERE "estabelecimento_alteracao_cnaes"."tipo" = 'PRINCIPAL' AND "estabelecimento_alteracao_cnaes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_estab_alt_cnaes_codigo" ON "estabelecimento_alteracao_cnaes" USING btree ("alteracao_id","codigo") WHERE "estabelecimento_alteracao_cnaes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_estab_alt_cnaes_alteracao" ON "estabelecimento_alteracao_cnaes" USING btree ("alteracao_id");--> statement-breakpoint
CREATE INDEX "idx_estab_alt_cnaes_criado_por" ON "estabelecimento_alteracao_cnaes" USING btree ("criado_por_id");--> statement-breakpoint
CREATE INDEX "idx_estab_alt_cnaes_atualizado_por" ON "estabelecimento_alteracao_cnaes" USING btree ("atualizado_por_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_estab_alteracoes_aberta" ON "estabelecimento_alteracoes" USING btree ("estabelecimento_id") WHERE "estabelecimento_alteracoes"."situacao" IN ('DRAFT','REVIEW') AND "estabelecimento_alteracoes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_estab_alteracoes_estabelecimento" ON "estabelecimento_alteracoes" USING btree ("estabelecimento_id");--> statement-breakpoint
CREATE INDEX "idx_estab_alteracoes_empresa" ON "estabelecimento_alteracoes" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "idx_estab_alteracoes_situacao" ON "estabelecimento_alteracoes" USING btree ("situacao") WHERE "estabelecimento_alteracoes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_estab_alteracoes_submetido_por" ON "estabelecimento_alteracoes" USING btree ("submetido_por_id");--> statement-breakpoint
CREATE INDEX "idx_estab_alteracoes_decidido_por" ON "estabelecimento_alteracoes" USING btree ("decidido_por_id");--> statement-breakpoint
CREATE INDEX "idx_estab_alteracoes_criado_por" ON "estabelecimento_alteracoes" USING btree ("criado_por_id");--> statement-breakpoint
CREATE INDEX "idx_estab_alteracoes_atualizado_por" ON "estabelecimento_alteracoes" USING btree ("atualizado_por_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_estab_cnaes_principal" ON "estabelecimento_cnaes" USING btree ("estabelecimento_id") WHERE "estabelecimento_cnaes"."tipo" = 'PRINCIPAL' AND "estabelecimento_cnaes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_estab_cnaes_codigo" ON "estabelecimento_cnaes" USING btree ("estabelecimento_id","codigo") WHERE "estabelecimento_cnaes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_estab_cnaes_estabelecimento" ON "estabelecimento_cnaes" USING btree ("estabelecimento_id");--> statement-breakpoint
CREATE INDEX "idx_estab_cnaes_empresa" ON "estabelecimento_cnaes" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "idx_estab_cnaes_criado_por" ON "estabelecimento_cnaes" USING btree ("criado_por_id");--> statement-breakpoint
CREATE INDEX "idx_estab_cnaes_atualizado_por" ON "estabelecimento_cnaes" USING btree ("atualizado_por_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_estabelecimentos_cnpj" ON "estabelecimentos" USING btree ("cnpj") WHERE "estabelecimentos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_estabelecimentos_empresa" ON "estabelecimentos" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "idx_estabelecimentos_situacao" ON "estabelecimentos" USING btree ("situacao") WHERE "estabelecimentos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_estabelecimentos_submetido_por" ON "estabelecimentos" USING btree ("submetido_por_id");--> statement-breakpoint
CREATE INDEX "idx_estabelecimentos_decidido_por" ON "estabelecimentos" USING btree ("decidido_por_id");--> statement-breakpoint
CREATE INDEX "idx_estabelecimentos_criado_por" ON "estabelecimentos" USING btree ("criado_por_id");--> statement-breakpoint
CREATE INDEX "idx_estabelecimentos_atualizado_por" ON "estabelecimentos" USING btree ("atualizado_por_id");--> statement-breakpoint
CREATE INDEX "idx_regimes_estabelecimento" ON "regimes_tributarios" USING btree ("estabelecimento_id");--> statement-breakpoint
CREATE INDEX "idx_regimes_empresa" ON "regimes_tributarios" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "idx_regimes_estab_situacao" ON "regimes_tributarios" USING btree ("estabelecimento_id","situacao") WHERE "regimes_tributarios"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_regimes_substitui" ON "regimes_tributarios" USING btree ("substitui_regime_id");--> statement-breakpoint
CREATE INDEX "idx_regimes_submetido_por" ON "regimes_tributarios" USING btree ("submetido_por_id");--> statement-breakpoint
CREATE INDEX "idx_regimes_decidido_por" ON "regimes_tributarios" USING btree ("decidido_por_id");--> statement-breakpoint
CREATE INDEX "idx_regimes_criado_por" ON "regimes_tributarios" USING btree ("criado_por_id");--> statement-breakpoint
CREATE INDEX "idx_regimes_atualizado_por" ON "regimes_tributarios" USING btree ("atualizado_por_id");