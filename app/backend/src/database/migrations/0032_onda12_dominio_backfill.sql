UPDATE produtos
SET unidade_pedido = CASE
  WHEN lower(btrim(unidade_pedido)) IN ('kg', 'quilo', 'quilograma') THEN 'kg'
  WHEN lower(btrim(unidade_pedido)) IN ('peça', 'peca', 'un', 'und', 'unid', 'unidade') THEN 'unidade'
  ELSE unidade_pedido
END;
--> statement-breakpoint
UPDATE itens_compra
SET unidade_compra = CASE
  WHEN lower(btrim(unidade_compra)) IN ('kg', 'quilo', 'quilograma') THEN 'kg'
  WHEN lower(btrim(unidade_compra)) IN ('peça', 'peca', 'un', 'und', 'unid', 'unidade') THEN 'unidade'
  ELSE unidade_compra
END;
--> statement-breakpoint
UPDATE itens_comerciais
SET unidade_comercial = CASE
  WHEN lower(btrim(unidade_comercial)) IN ('kg', 'quilo', 'quilograma') THEN 'kg'
  WHEN lower(btrim(unidade_comercial)) IN ('peça', 'peca', 'un', 'und', 'unid', 'unidade') THEN 'unidade'
  ELSE unidade_comercial
END;
--> statement-breakpoint
-- rotas.representante_padrao -> rotas.representante_padrao_id
UPDATE rotas SET representante_padrao_id = NULL;
--> statement-breakpoint
WITH correspondencias AS (
  SELECT
    r.id AS rota_id,
    min(rep.id::text)::uuid AS representante_id
  FROM rotas r
  JOIN representantes rep
    ON rep.deleted_at IS NULL
   AND rep.status = 'ativo'
   AND (
     lower(btrim(rep.codigo)) = lower(btrim(r.representante_padrao))
     OR lower(btrim(rep.nome)) = lower(btrim(r.representante_padrao))
   )
  WHERE r.deleted_at IS NULL
    AND nullif(btrim(r.representante_padrao), '') IS NOT NULL
  GROUP BY r.id
  HAVING count(DISTINCT rep.id) = 1
)
UPDATE rotas r
SET representante_padrao_id = c.representante_id
FROM correspondencias c
WHERE r.id = c.rota_id;
--> statement-breakpoint
-- rotas.caminhao_padrao -> rotas.caminhao_padrao_id
UPDATE rotas SET caminhao_padrao_id = NULL;
--> statement-breakpoint
WITH correspondencias AS (
  SELECT
    r.id AS rota_id,
    min(fc.id::text)::uuid AS caminhao_id
  FROM rotas r
  JOIN frota_caminhoes fc
    ON fc.deleted_at IS NULL
   AND fc.status = 'ativo'
   AND lower(btrim(fc.placa)) = lower(btrim(r.caminhao_padrao))
  WHERE r.deleted_at IS NULL
    AND nullif(btrim(r.caminhao_padrao), '') IS NOT NULL
  GROUP BY r.id
  HAVING count(DISTINCT fc.id) = 1
)
UPDATE rotas r
SET caminhao_padrao_id = c.caminhao_id
FROM correspondencias c
WHERE r.id = c.rota_id;
--> statement-breakpoint
-- rotas.motorista_padrao -> rotas.motorista_padrao_id
UPDATE rotas SET motorista_padrao_id = NULL;
--> statement-breakpoint
WITH correspondencias AS (
  SELECT
    r.id AS rota_id,
    min(fm.id::text)::uuid AS motorista_id
  FROM rotas r
  JOIN frota_motoristas fm
    ON fm.deleted_at IS NULL
   AND fm.status = 'ativo'
   AND lower(btrim(fm.nome)) = lower(btrim(r.motorista_padrao))
  WHERE r.deleted_at IS NULL
    AND nullif(btrim(r.motorista_padrao), '') IS NOT NULL
  GROUP BY r.id
  HAVING count(DISTINCT fm.id) = 1
)
UPDATE rotas r
SET motorista_padrao_id = c.motorista_id
FROM correspondencias c
WHERE r.id = c.rota_id;
--> statement-breakpoint
-- pedidos_venda.rota_prevista -> pedidos_venda.rota_id
UPDATE pedidos_venda SET rota_id = NULL;
--> statement-breakpoint
WITH correspondencias AS (
  SELECT
    p.id AS pedido_id,
    min(r.id::text)::uuid AS rota_id
  FROM pedidos_venda p
  JOIN rotas r
    ON r.deleted_at IS NULL
   AND r.status = 'ativo'
   AND (
     lower(btrim(r.codigo)) = lower(btrim(p.rota_prevista))
     OR lower(btrim(r.nome)) = lower(btrim(p.rota_prevista))
   )
  WHERE p.deleted_at IS NULL
    AND nullif(btrim(p.rota_prevista), '') IS NOT NULL
  GROUP BY p.id
  HAVING count(DISTINCT r.id) = 1
)
UPDATE pedidos_venda p
SET rota_id = c.rota_id
FROM correspondencias c
WHERE p.id = c.pedido_id;
--> statement-breakpoint
-- caminhoes.motorista -> caminhoes.motorista_id
UPDATE caminhoes SET motorista_id = NULL;
--> statement-breakpoint
WITH correspondencias AS (
  SELECT
    c.id AS caminhao_operacional_id,
    min(fm.id::text)::uuid AS motorista_id
  FROM caminhoes c
  JOIN frota_motoristas fm
    ON fm.deleted_at IS NULL
   AND fm.status = 'ativo'
   AND lower(btrim(fm.nome)) = lower(btrim(c.motorista))
  WHERE c.deleted_at IS NULL
    AND nullif(btrim(c.motorista), '') IS NOT NULL
  GROUP BY c.id
  HAVING count(DISTINCT fm.id) = 1
)
UPDATE caminhoes c
SET motorista_id = x.motorista_id
FROM correspondencias x
WHERE c.id = x.caminhao_operacional_id;
--> statement-breakpoint
-- caminhoes.rota -> caminhoes.rota_id
UPDATE caminhoes SET rota_id = NULL;
--> statement-breakpoint
WITH correspondencias AS (
  SELECT
    c.id AS caminhao_operacional_id,
    min(r.id::text)::uuid AS rota_id
  FROM caminhoes c
  JOIN rotas r
    ON r.deleted_at IS NULL
   AND r.status = 'ativo'
   AND (
     lower(btrim(r.codigo)) = lower(btrim(c.rota))
     OR lower(btrim(r.nome)) = lower(btrim(c.rota))
   )
  WHERE c.deleted_at IS NULL
    AND nullif(btrim(c.rota), '') IS NOT NULL
  GROUP BY c.id
  HAVING count(DISTINCT r.id) = 1
)
UPDATE caminhoes c
SET rota_id = x.rota_id
FROM correspondencias x
WHERE c.id = x.caminhao_operacional_id;
--> statement-breakpoint
-- entradas_itens.fornecedor_nome -> entradas_itens.fornecedor_id
UPDATE entradas_itens SET fornecedor_id = NULL;
--> statement-breakpoint
WITH correspondencias AS (
  SELECT
    e.id AS entrada_id,
    min(f.id::text)::uuid AS fornecedor_id
  FROM entradas_itens e
  JOIN fornecedores f
    ON f.deleted_at IS NULL
   AND f.status = 'ativo'
   AND (
     lower(btrim(f.codigo)) = lower(btrim(e.fornecedor_nome))
     OR lower(btrim(f.razao_social)) = lower(btrim(e.fornecedor_nome))
   )
  WHERE e.deleted_at IS NULL
    AND nullif(btrim(e.fornecedor_nome), '') IS NOT NULL
  GROUP BY e.id
  HAVING count(DISTINCT f.id) = 1
)
UPDATE entradas_itens e
SET fornecedor_id = c.fornecedor_id
FROM correspondencias c
WHERE e.id = c.entrada_id;
--> statement-breakpoint
-- As duas FKs abaixo já armazenam UUID em origin/develop; não há snapshot textual
-- correspondente. O contract falha, em vez de apagar ou inventar vínculo órfão.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM frota_caminhoes fc
    LEFT JOIN rotas r ON r.id = fc.rota_padrao_id
    WHERE fc.rota_padrao_id IS NOT NULL AND r.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Onda 12: frota_caminhoes.rota_padrao_id órfão';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM frota_motoristas fm
    LEFT JOIN frota_caminhoes fc ON fc.id = fm.caminhao_padrao_id
    WHERE fm.caminhao_padrao_id IS NOT NULL AND fc.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Onda 12: frota_motoristas.caminhao_padrao_id órfão';
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM produtos WHERE unidade_pedido NOT IN ('kg', 'unidade')
    UNION ALL
    SELECT 1 FROM itens_compra WHERE unidade_compra NOT IN ('kg', 'unidade')
    UNION ALL
    SELECT 1 FROM itens_comerciais WHERE unidade_comercial NOT IN ('kg', 'unidade')
  ) THEN
    RAISE EXCEPTION 'Onda 12: unidade histórica fora de kg|unidade; corrigir dado de origem antes do contract';
  END IF;
END $$;
