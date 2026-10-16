CREATE TABLE "cenarios_regressao" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"homologacao_id" uuid NOT NULL,
	"simulacao_id" uuid NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL,
	"criado_por_id" uuid NOT NULL,
	"atualizado_por_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "cenarios_versao_positiva_check" CHECK ("cenarios_regressao"."versao" >= 1)
);
--> statement-breakpoint
CREATE TABLE "homologacoes_regras" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"codigo" varchar(20) NOT NULL,
	"regra_id" uuid NOT NULL,
	"descricao" text NOT NULL,
	"situacao" text DEFAULT 'EM_REVISAO' NOT NULL,
	"justificativa" text NOT NULL,
	"aprovado_por_id" uuid,
	"aprovado_em" timestamp with time zone,
	"rejeitado_por_id" uuid,
	"rejeitado_em" timestamp with time zone,
	"publicado_por_id" uuid,
	"publicado_em" timestamp with time zone,
	"versao" integer DEFAULT 1 NOT NULL,
	"criado_por_id" uuid NOT NULL,
	"atualizado_por_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "homologacoes_codigo_formato_check" CHECK ("homologacoes_regras"."codigo" ~ '^[1-9][0-9]{0,17}$'),
	CONSTRAINT "homologacoes_situacao_check" CHECK ("homologacoes_regras"."situacao" IN ('EM_REVISAO','APROVADA','REJEITADA','PUBLICADA')),
	CONSTRAINT "homologacoes_versao_positiva_check" CHECK ("homologacoes_regras"."versao" >= 1),
	CONSTRAINT "homologacoes_descricao_preenchida_check" CHECK (btrim("homologacoes_regras"."descricao") <> ''),
	CONSTRAINT "homologacoes_descricao_tamanho_check" CHECK (char_length(btrim("homologacoes_regras"."descricao")) BETWEEN 3 AND 500),
	CONSTRAINT "homologacoes_aprovada_check" CHECK ("homologacoes_regras"."situacao" <> 'APROVADA' OR ("homologacoes_regras"."aprovado_por_id" IS NOT NULL AND "homologacoes_regras"."aprovado_em" IS NOT NULL)),
	CONSTRAINT "homologacoes_rejeitada_check" CHECK ("homologacoes_regras"."situacao" <> 'REJEITADA' OR ("homologacoes_regras"."rejeitado_por_id" IS NOT NULL AND "homologacoes_regras"."rejeitado_em" IS NOT NULL)),
	CONSTRAINT "homologacoes_publicada_check" CHECK ("homologacoes_regras"."situacao" <> 'PUBLICADA' OR ("homologacoes_regras"."aprovado_por_id" IS NOT NULL AND "homologacoes_regras"."aprovado_em" IS NOT NULL AND "homologacoes_regras"."publicado_por_id" IS NOT NULL AND "homologacoes_regras"."publicado_em" IS NOT NULL)),
	CONSTRAINT "homologacoes_rejeitada_sem_aprovador_check" CHECK ("homologacoes_regras"."situacao" <> 'REJEITADA' OR "homologacoes_regras"."aprovado_por_id" IS NULL)
);
--> statement-breakpoint
ALTER TABLE "cenarios_regressao" ADD CONSTRAINT "cenarios_regressao_homologacao_id_homologacoes_regras_id_fk" FOREIGN KEY ("homologacao_id") REFERENCES "public"."homologacoes_regras"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cenarios_regressao" ADD CONSTRAINT "cenarios_regressao_simulacao_id_simulacoes_fiscais_id_fk" FOREIGN KEY ("simulacao_id") REFERENCES "public"."simulacoes_fiscais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cenarios_regressao" ADD CONSTRAINT "cenarios_regressao_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cenarios_regressao" ADD CONSTRAINT "cenarios_regressao_atualizado_por_id_usuarios_id_fk" FOREIGN KEY ("atualizado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homologacoes_regras" ADD CONSTRAINT "homologacoes_regras_regra_id_regras_tributarias_id_fk" FOREIGN KEY ("regra_id") REFERENCES "public"."regras_tributarias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homologacoes_regras" ADD CONSTRAINT "homologacoes_regras_aprovado_por_id_usuarios_id_fk" FOREIGN KEY ("aprovado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homologacoes_regras" ADD CONSTRAINT "homologacoes_regras_rejeitado_por_id_usuarios_id_fk" FOREIGN KEY ("rejeitado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homologacoes_regras" ADD CONSTRAINT "homologacoes_regras_publicado_por_id_usuarios_id_fk" FOREIGN KEY ("publicado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homologacoes_regras" ADD CONSTRAINT "homologacoes_regras_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homologacoes_regras" ADD CONSTRAINT "homologacoes_regras_atualizado_por_id_usuarios_id_fk" FOREIGN KEY ("atualizado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cenarios_homologacao_simulacao" ON "cenarios_regressao" USING btree ("homologacao_id","simulacao_id") WHERE "cenarios_regressao"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_cenarios_homologacao" ON "cenarios_regressao" USING btree ("homologacao_id");--> statement-breakpoint
CREATE INDEX "idx_cenarios_simulacao" ON "cenarios_regressao" USING btree ("simulacao_id");--> statement-breakpoint
CREATE INDEX "idx_cenarios_criado_por" ON "cenarios_regressao" USING btree ("criado_por_id");--> statement-breakpoint
CREATE INDEX "idx_cenarios_atualizado_por" ON "cenarios_regressao" USING btree ("atualizado_por_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_homologacoes_codigo" ON "homologacoes_regras" USING btree ("codigo") WHERE "homologacoes_regras"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_homologacoes_regra_aberta" ON "homologacoes_regras" USING btree ("regra_id") WHERE "homologacoes_regras"."deleted_at" IS NULL AND "homologacoes_regras"."situacao" IN ('EM_REVISAO','APROVADA','PUBLICADA');--> statement-breakpoint
CREATE INDEX "idx_homologacoes_regra" ON "homologacoes_regras" USING btree ("regra_id");--> statement-breakpoint
CREATE INDEX "idx_homologacoes_situacao" ON "homologacoes_regras" USING btree ("situacao");--> statement-breakpoint
CREATE INDEX "idx_homologacoes_criado_por" ON "homologacoes_regras" USING btree ("criado_por_id");--> statement-breakpoint
CREATE INDEX "idx_homologacoes_atualizado_por" ON "homologacoes_regras" USING btree ("atualizado_por_id");--> statement-breakpoint
CREATE INDEX "idx_homologacoes_aprovado_por" ON "homologacoes_regras" USING btree ("aprovado_por_id");--> statement-breakpoint
CREATE INDEX "idx_homologacoes_rejeitado_por" ON "homologacoes_regras" USING btree ("rejeitado_por_id");--> statement-breakpoint
CREATE INDEX "idx_homologacoes_publicado_por" ON "homologacoes_regras" USING btree ("publicado_por_id");