CREATE TABLE "simulacoes_fiscais" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"codigo" varchar(20) NOT NULL,
	"numero_versao" integer NOT NULL,
	"estabelecimento_id" uuid NOT NULL,
	"operacao_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"produto_id" uuid NOT NULL,
	"ncm_id" uuid NOT NULL,
	"quantidade" numeric(15, 3) NOT NULL,
	"peso_nf" numeric(10, 3) NOT NULL,
	"valor" numeric(15, 2) NOT NULL,
	"desconto" numeric(15, 2) NOT NULL,
	"competencia" varchar(7) NOT NULL,
	"enquadramento_id" uuid NOT NULL,
	"regra_id" uuid NOT NULL,
	"valor_liquido" numeric(15, 2) NOT NULL,
	"base_tributavel" numeric(15, 2) NOT NULL,
	"icms" numeric(15, 2) NOT NULL,
	"base_difere_bruto" boolean NOT NULL,
	"origem_versao_id" uuid,
	"situacao" text DEFAULT 'CALCULADA' NOT NULL,
	"justificativa" text NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL,
	"criado_por_id" uuid NOT NULL,
	"atualizado_por_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "simulacoes_codigo_formato_check" CHECK ("simulacoes_fiscais"."codigo" ~ '^[1-9][0-9]{0,17}$'),
	CONSTRAINT "simulacoes_numero_versao_check" CHECK ("simulacoes_fiscais"."numero_versao" >= 1),
	CONSTRAINT "simulacoes_quantidade_positiva_check" CHECK ("simulacoes_fiscais"."quantidade" > 0),
	CONSTRAINT "simulacoes_peso_positivo_check" CHECK ("simulacoes_fiscais"."peso_nf" > 0),
	CONSTRAINT "simulacoes_valor_positivo_check" CHECK ("simulacoes_fiscais"."valor" > 0),
	CONSTRAINT "simulacoes_desconto_nao_negativo_check" CHECK ("simulacoes_fiscais"."desconto" >= 0),
	CONSTRAINT "simulacoes_desconto_teto_check" CHECK ("simulacoes_fiscais"."desconto" <= "simulacoes_fiscais"."valor"),
	CONSTRAINT "simulacoes_liquido_check" CHECK ("simulacoes_fiscais"."valor_liquido" = "simulacoes_fiscais"."valor" - "simulacoes_fiscais"."desconto"),
	CONSTRAINT "simulacoes_base_flag_check" CHECK ("simulacoes_fiscais"."base_difere_bruto" = ("simulacoes_fiscais"."base_tributavel" <> "simulacoes_fiscais"."valor")),
	CONSTRAINT "simulacoes_competencia_check" CHECK ("simulacoes_fiscais"."competencia" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "simulacoes_situacao_check" CHECK ("simulacoes_fiscais"."situacao" = 'CALCULADA'),
	CONSTRAINT "simulacoes_versao_positiva_check" CHECK ("simulacoes_fiscais"."versao" >= 1)
);
--> statement-breakpoint
ALTER TABLE "simulacoes_fiscais" ADD CONSTRAINT "simulacoes_fiscais_estabelecimento_id_estabelecimentos_id_fk" FOREIGN KEY ("estabelecimento_id") REFERENCES "public"."estabelecimentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulacoes_fiscais" ADD CONSTRAINT "simulacoes_fiscais_operacao_id_operacoes_id_fk" FOREIGN KEY ("operacao_id") REFERENCES "public"."operacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulacoes_fiscais" ADD CONSTRAINT "simulacoes_fiscais_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulacoes_fiscais" ADD CONSTRAINT "simulacoes_fiscais_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulacoes_fiscais" ADD CONSTRAINT "simulacoes_fiscais_ncm_id_ncms_id_fk" FOREIGN KEY ("ncm_id") REFERENCES "public"."ncms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulacoes_fiscais" ADD CONSTRAINT "simulacoes_fiscais_enquadramento_id_enquadramentos_fiscais_id_fk" FOREIGN KEY ("enquadramento_id") REFERENCES "public"."enquadramentos_fiscais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulacoes_fiscais" ADD CONSTRAINT "simulacoes_fiscais_regra_id_regras_tributarias_id_fk" FOREIGN KEY ("regra_id") REFERENCES "public"."regras_tributarias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulacoes_fiscais" ADD CONSTRAINT "simulacoes_fiscais_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulacoes_fiscais" ADD CONSTRAINT "simulacoes_fiscais_atualizado_por_id_usuarios_id_fk" FOREIGN KEY ("atualizado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulacoes_fiscais" ADD CONSTRAINT "simulacoes_fiscais_origem_fk" FOREIGN KEY ("origem_versao_id") REFERENCES "public"."simulacoes_fiscais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_simulacoes_codigo_versao" ON "simulacoes_fiscais" USING btree ("codigo","numero_versao") WHERE "simulacoes_fiscais"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_simulacoes_estabelecimento" ON "simulacoes_fiscais" USING btree ("estabelecimento_id");--> statement-breakpoint
CREATE INDEX "idx_simulacoes_operacao" ON "simulacoes_fiscais" USING btree ("operacao_id");--> statement-breakpoint
CREATE INDEX "idx_simulacoes_cliente" ON "simulacoes_fiscais" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "idx_simulacoes_produto" ON "simulacoes_fiscais" USING btree ("produto_id");--> statement-breakpoint
CREATE INDEX "idx_simulacoes_ncm" ON "simulacoes_fiscais" USING btree ("ncm_id");--> statement-breakpoint
CREATE INDEX "idx_simulacoes_enquadramento" ON "simulacoes_fiscais" USING btree ("enquadramento_id");--> statement-breakpoint
CREATE INDEX "idx_simulacoes_regra" ON "simulacoes_fiscais" USING btree ("regra_id");--> statement-breakpoint
CREATE INDEX "idx_simulacoes_origem" ON "simulacoes_fiscais" USING btree ("origem_versao_id");--> statement-breakpoint
CREATE INDEX "idx_simulacoes_competencia" ON "simulacoes_fiscais" USING btree ("competencia") WHERE "simulacoes_fiscais"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_simulacoes_criado_por" ON "simulacoes_fiscais" USING btree ("criado_por_id");--> statement-breakpoint
CREATE INDEX "idx_simulacoes_atualizado_por" ON "simulacoes_fiscais" USING btree ("atualizado_por_id");