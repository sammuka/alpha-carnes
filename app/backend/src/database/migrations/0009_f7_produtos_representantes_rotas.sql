CREATE TABLE "representantes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"codigo" text NOT NULL,
	"nome" text NOT NULL,
	"tipo_canal" text,
	"contato" text,
	"status" text DEFAULT 'ativo' NOT NULL,
	"observacao" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_representantes_status" CHECK ("representantes"."status" IN ('ativo','inativo'))
);
--> statement-breakpoint
CREATE TABLE "rotas" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"codigo" text NOT NULL,
	"nome" text NOT NULL,
	"regiao" text,
	"representante_padrao" text,
	"caminhao_padrao" text,
	"motorista_padrao" text,
	"observacoes" text,
	"status" text DEFAULT 'ativo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_rotas_status" CHECK ("rotas"."status" IN ('ativo','inativo'))
);
--> statement-breakpoint
CREATE TABLE "produtos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"codigo" text NOT NULL,
	"nome" text NOT NULL,
	"nome_operacional" text,
	"categoria" text,
	"tipo_operacional" text DEFAULT 'peca_inteira_pesavel' NOT NULL,
	"unidade_pedido" text NOT NULL,
	"unidade_preco" text DEFAULT 'kg' NOT NULL,
	"exige_peso" boolean DEFAULT true NOT NULL,
	"passa_balanca" boolean DEFAULT false NOT NULL,
	"passa_desossa" boolean DEFAULT false NOT NULL,
	"origem_transformacao" boolean DEFAULT false NOT NULL,
	"saida_transformacao" boolean DEFAULT false NOT NULL,
	"pode_estoque" boolean DEFAULT true NOT NULL,
	"ativo_venda" boolean DEFAULT true NOT NULL,
	"ativo_compra" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'ativo' NOT NULL,
	"observacoes_operacionais" text,
	"atributos_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"legado_item_comercial_id" uuid,
	"legado_item_compra_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_produtos_status" CHECK ("produtos"."status" IN ('ativo','inativo')),
	CONSTRAINT "chk_produtos_unidade_preco" CHECK ("produtos"."unidade_preco" IN ('kg','unidade')),
	CONSTRAINT "chk_produtos_tipo_operacional" CHECK ("produtos"."tipo_operacional" IN ('peca_inteira_pesavel','derivado_desossa','entrada_unidade','compra_base'))
);
--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "representante_id" uuid;
--> statement-breakpoint
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_legado_item_comercial_id_itens_comerciais_id_fk" FOREIGN KEY ("legado_item_comercial_id") REFERENCES "public"."itens_comerciais"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_legado_item_compra_id_itens_compra_id_fk" FOREIGN KEY ("legado_item_compra_id") REFERENCES "public"."itens_compra"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_representante_id_representantes_id_fk" FOREIGN KEY ("representante_id") REFERENCES "public"."representantes"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_representantes_codigo" ON "representantes" USING btree ("codigo") WHERE "representantes"."deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX "idx_representantes_status" ON "representantes" USING btree ("status") WHERE "representantes"."deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rotas_codigo" ON "rotas" USING btree ("codigo") WHERE "rotas"."deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX "idx_rotas_status" ON "rotas" USING btree ("status") WHERE "rotas"."deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_produtos_codigo" ON "produtos" USING btree ("codigo") WHERE "produtos"."deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX "idx_produtos_status" ON "produtos" USING btree ("status") WHERE "produtos"."deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX "idx_produtos_atributos_gin" ON "produtos" USING gin ("atributos_json");
--> statement-breakpoint
CREATE TRIGGER trg_representantes_updated_at BEFORE UPDATE ON "representantes" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_rotas_updated_at BEFORE UPDATE ON "rotas" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_produtos_updated_at BEFORE UPDATE ON "produtos" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
INSERT INTO "representantes" ("codigo", "nome", "tipo_canal", "status")
SELECT 'ALPHA', 'Alpha Carnes / Sabrina', 'interno', 'ativo'
WHERE NOT EXISTS (SELECT 1 FROM "representantes" WHERE "codigo" = 'ALPHA' AND "deleted_at" IS NULL);
--> statement-breakpoint
INSERT INTO "produtos" (
  "codigo", "nome", "nome_operacional", "categoria", "tipo_operacional",
  "unidade_pedido", "unidade_preco", "exige_peso", "passa_balanca", "passa_desossa",
  "origem_transformacao", "saida_transformacao", "pode_estoque", "ativo_venda", "ativo_compra",
  "status", "observacoes_operacionais", "legado_item_comercial_id"
)
SELECT
  ic."codigo",
  ic."descricao",
  ic."descricao",
  ic."categoria",
  CASE WHEN ic."permite_corte" THEN 'derivado_desossa' ELSE 'peca_inteira_pesavel' END,
  ic."unidade_comercial",
  'kg',
  true,
  NOT ic."permite_corte",
  ic."permite_corte",
  ic."permite_corte",
  ic."permite_corte",
  true,
  true,
  false,
  ic."status",
  ic."observacoes_operacionais",
  ic."id"
FROM "itens_comerciais" ic
WHERE ic."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "produtos" p
    WHERE p."legado_item_comercial_id" = ic."id" AND p."deleted_at" IS NULL
  );
--> statement-breakpoint
INSERT INTO "produtos" (
  "codigo", "nome", "nome_operacional", "categoria", "tipo_operacional",
  "unidade_pedido", "unidade_preco", "exige_peso", "passa_balanca", "passa_desossa",
  "origem_transformacao", "saida_transformacao", "pode_estoque", "ativo_venda", "ativo_compra",
  "status", "legado_item_compra_id"
)
SELECT
  ic."codigo",
  ic."descricao",
  ic."descricao",
  ic."categoria",
  'compra_base',
  ic."unidade_compra",
  'unidade',
  false,
  false,
  false,
  false,
  false,
  true,
  false,
  true,
  ic."status",
  ic."id"
FROM "itens_compra" ic
WHERE ic."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "produtos" p
    WHERE p."legado_item_compra_id" = ic."id" AND p."deleted_at" IS NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM "produtos" p
    WHERE p."codigo" = ic."codigo" AND p."deleted_at" IS NULL
  );
