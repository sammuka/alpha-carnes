-- 0038_onda14_faixa_backfill.sql
-- AD-16: saneamento legado. Inclusive soft-deleted (senão o SET NOT NULL falha).
UPDATE clientes
SET faixa_preco = 'A', updated_at = now()
WHERE faixa_preco IS NULL;

DO $$
DECLARE
  v_nulos int;
BEGIN
  SELECT count(*) INTO v_nulos FROM clientes WHERE faixa_preco IS NULL;
  IF v_nulos <> 0 THEN
    RAISE EXCEPTION 'Onda 14 backfill faixa: % clientes ainda NULL', v_nulos;
  END IF;
END $$;
