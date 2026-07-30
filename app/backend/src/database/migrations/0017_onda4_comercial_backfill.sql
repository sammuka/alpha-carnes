-- Onda 4 — Comercial. Backfill preservador + guarda pré-contract.
UPDATE "clientes" AS c
   SET "rota_id" = r."id"
  FROM "rotas" AS r
 WHERE c."rota_id" IS NULL
   AND c."rota_padrao" IS NOT NULL
   AND r."deleted_at" IS NULL
   AND r."codigo" = c."rota_padrao";
--> statement-breakpoint
WITH "rotas_nome_unico" AS (
  SELECT "nome", min("id"::text)::uuid AS "id"
    FROM "rotas"
   WHERE "deleted_at" IS NULL
   GROUP BY "nome"
  HAVING count(*) = 1
)
UPDATE "clientes" AS c
   SET "rota_id" = r."id"
  FROM "rotas_nome_unico" AS r
 WHERE c."rota_id" IS NULL
   AND c."rota_padrao" IS NOT NULL
   AND r."nome" = c."rota_padrao";
--> statement-breakpoint
DO $$
DECLARE pendentes integer;
BEGIN
  SELECT count(*) INTO pendentes
    FROM "clientes"
   WHERE "rota_padrao" IS NOT NULL
     AND "rota_id" IS NULL;
  IF pendentes > 0 THEN
    RAISE EXCEPTION 'backfill incompleto: % cliente(s) com rota_padrao sem rota_id', pendentes;
  END IF;
END $$;
