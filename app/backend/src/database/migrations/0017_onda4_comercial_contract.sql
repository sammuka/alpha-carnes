-- Onda 4 — Comercial. Contract: remove clientes.rota_padrao após o backfill do 0016.
DO $$
DECLARE pendentes integer;
BEGIN
  SELECT count(*) INTO pendentes
    FROM "clientes"
   WHERE "deleted_at" IS NULL AND "rota_padrao" IS NOT NULL AND "rota_id" IS NULL;
  IF pendentes > 0 THEN
    RAISE EXCEPTION 'backfill incompleto: % cliente(s) com rota_padrao sem rota_id', pendentes;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "clientes" DROP COLUMN IF EXISTS "rota_padrao";
