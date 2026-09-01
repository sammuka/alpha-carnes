WITH numeradas AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY operacao_id
           ORDER BY created_at, id
         )::integer AS numero_sequencial
    FROM compras_programadas
)
UPDATE compras_programadas cp
   SET numero_sequencial = n.numero_sequencial
  FROM numeradas n
 WHERE n.id = cp.id
   AND cp.numero_sequencial IS NULL;
--> statement-breakpoint
UPDATE associacoes_peca_historico h
   SET compra_programada_origem_id = p.compra_programada_id,
       recebimento_origem_id = p.recebimento_id
  FROM pecas p
 WHERE h.peca_id = p.id
   AND (h.compra_programada_origem_id IS NULL OR h.recebimento_origem_id IS NULL);
--> statement-breakpoint
UPDATE associacoes_peca_historico h
   SET compra_programada_origem_id = p.compra_programada_id,
       recebimento_origem_id = p.recebimento_id
  FROM subitens s
  JOIN pecas p ON p.id = s.peca_origem_id
 WHERE h.subitem_id = s.id
   AND (h.compra_programada_origem_id IS NULL OR h.recebimento_origem_id IS NULL);
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM compras_programadas WHERE numero_sequencial IS NULL) THEN
    RAISE EXCEPTION 'backfill incompleto: compras_programadas.numero_sequencial';
  END IF;
  IF EXISTS (
    SELECT 1 FROM associacoes_peca_historico
     WHERE compra_programada_origem_id IS NULL OR recebimento_origem_id IS NULL
  ) THEN
    RAISE EXCEPTION 'backfill incompleto: origem física de associacoes_peca_historico';
  END IF;
END $$;
