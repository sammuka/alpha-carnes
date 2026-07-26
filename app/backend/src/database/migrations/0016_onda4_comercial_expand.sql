-- Onda 4 — Comercial. Expand: cria tabelas novas e adiciona clientes.rota_id (com backfill).
CREATE TABLE IF NOT EXISTS "adendos_pedido" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "pedido_venda_id" uuid NOT NULL REFERENCES "pedidos_venda"("id"),
  "pedido_venda_item_id" uuid NOT NULL REFERENCES "pedidos_venda_itens"("id"),
  "item_comercial_id" uuid NOT NULL REFERENCES "itens_comerciais"("id"),
  "operacao_id" uuid NOT NULL REFERENCES "operacoes"("id"),
  "quantidade_anterior" numeric(10,3) NOT NULL,
  "quantidade_adicionada" numeric(10,3) NOT NULL,
  "quantidade_resultante" numeric(10,3) NOT NULL,
  "origem_consumo" text NOT NULL,
  "motivo" text NOT NULL,
  "autor_id" uuid NOT NULL REFERENCES "usuarios"("id"),
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chk_adendos_pedido_quantidade" CHECK ("quantidade_adicionada" > 0),
  CONSTRAINT "chk_adendos_pedido_origem" CHECK ("origem_consumo" IN ('fisico','virtual','overbooking'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_adendos_pedido_pedido" ON "adendos_pedido" ("pedido_venda_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tabelas_preco" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "data" date NOT NULL,
  "status" text DEFAULT 'rascunho' NOT NULL,
  "observacao" text,
  "publicada_por" uuid REFERENCES "usuarios"("id"),
  "publicada_em" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "chk_tabelas_preco_status" CHECK ("status" IN ('rascunho','publicada'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_tabelas_preco_data"
  ON "tabelas_preco" ("data") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tabelas_preco_itens" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "tabela_preco_id" uuid NOT NULL REFERENCES "tabelas_preco"("id"),
  "produto_id" uuid NOT NULL REFERENCES "produtos"("id"),
  "preco_a" numeric(15,2),
  "preco_b" numeric(15,2),
  "preco_c" numeric(15,2),
  "preco_d" numeric(15,2),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chk_tabelas_preco_itens_positivos" CHECK (
    ("preco_a" IS NULL OR "preco_a" > 0) AND ("preco_b" IS NULL OR "preco_b" > 0) AND
    ("preco_c" IS NULL OR "preco_c" > 0) AND ("preco_d" IS NULL OR "preco_d" > 0)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_tabelas_preco_itens_produto"
  ON "tabelas_preco_itens" ("tabela_preco_id", "produto_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tabelas_preco_publicacoes" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "tabela_preco_id" uuid NOT NULL REFERENCES "tabelas_preco"("id"),
  "acao" text NOT NULL,
  "autor_id" uuid NOT NULL REFERENCES "usuarios"("id"),
  "observacao" text,
  "criado_em" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chk_tabelas_preco_publicacoes_acao"
    CHECK ("acao" IN ('publicada','revertida_para_rascunho'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tabelas_preco_publicacoes_tabela"
  ON "tabelas_preco_publicacoes" ("tabela_preco_id");
--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "rota_id" uuid REFERENCES "rotas"("id");
--> statement-breakpoint
UPDATE "clientes" c SET "rota_id" = r."id"
  FROM "rotas" r
 WHERE c."rota_id" IS NULL AND c."rota_padrao" IS NOT NULL
   AND (r."codigo" = c."rota_padrao" OR r."nome" = c."rota_padrao")
   AND r."deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_clientes_rota" ON "clientes" ("rota_id")
  WHERE "deleted_at" IS NULL;
