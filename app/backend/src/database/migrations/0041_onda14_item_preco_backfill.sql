DO $$
DECLARE
  v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM pedidos_venda_itens;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'Onda 14 backfill preco_aplicado: base tem % itens. Escalar ao Quality Owner (AD-16 / Princípio VII).', v_n;
  END IF;
END $$;
