-- 0035_onda13_catalogo_backfill.sql
-- DML fail-closed (AD-15 / Princípio VII). Uma transação (drizzle já envolve).

-- 1) Produto BOI a partir do item de compra BOI, se ainda não existir.
DO $$
DECLARE
  v_count int;
  v_item record;
BEGIN
  SELECT count(*) INTO v_count
  FROM itens_compra
  WHERE deleted_at IS NULL AND upper(btrim(codigo)) = 'BOI';
  IF v_count > 1 THEN
    RAISE EXCEPTION 'Onda 13 backfill: mais de um itens_compra.codigo=BOI ativo';
  END IF;
  IF v_count = 1 THEN
    SELECT * INTO v_item
    FROM itens_compra
    WHERE deleted_at IS NULL AND upper(btrim(codigo)) = 'BOI';
    IF NOT EXISTS (
      SELECT 1 FROM produtos p
      WHERE p.deleted_at IS NULL
        AND (p.legado_item_compra_id = v_item.id OR upper(btrim(p.codigo)) = 'BOI')
    ) THEN
      INSERT INTO produtos (
        codigo, nome, tipo_operacional, unidade_pedido, unidade_preco,
        exige_peso, ativo_venda, ativo_compra, status, legado_item_compra_id,
        atributos_json
      ) VALUES (
        'BOI',
        COALESCE(nullif(btrim(v_item.descricao), ''), 'BOI CASADO'),
        'compra_base',
        v_item.unidade_compra,
        'kg',
        true,
        false,
        true,
        v_item.status,
        v_item.id,
        '{"origemUnificacao":"AD-15","legado":"itens_compra"}'::jsonb
      );
    END IF;
  END IF;
END $$;

-- 2) Merge BANDA DE PORCO → produto BPORCO + flags de compráveis avulsos.
DO $$
DECLARE
  v_banda uuid;
  v_n_banda int;
  v_bporco uuid;
  v_n_bporco int;
BEGIN
  SELECT count(*) INTO v_n_banda
  FROM itens_compra
  WHERE deleted_at IS NULL AND upper(btrim(codigo)) = 'BANDA DE PORCO';
  IF v_n_banda > 1 THEN
    RAISE EXCEPTION 'Onda 13 backfill: mais de um itens_compra BANDA DE PORCO ativo';
  END IF;
  SELECT id INTO v_banda
  FROM itens_compra
  WHERE deleted_at IS NULL AND upper(btrim(codigo)) = 'BANDA DE PORCO';

  SELECT count(*) INTO v_n_bporco
  FROM produtos
  WHERE deleted_at IS NULL AND upper(btrim(codigo)) = 'BPORCO';
  IF v_n_bporco > 1 THEN
    RAISE EXCEPTION 'Onda 13 backfill: mais de um produtos.codigo=BPORCO ativo';
  END IF;
  SELECT id INTO v_bporco
  FROM produtos
  WHERE deleted_at IS NULL AND upper(btrim(codigo)) = 'BPORCO';

  IF v_banda IS NOT NULL AND v_bporco IS NULL THEN
    RAISE EXCEPTION 'Onda 13 backfill: item BANDA DE PORCO=% sem produto BPORCO', v_banda;
  END IF;
  IF v_bporco IS NOT NULL THEN
    UPDATE produtos
    SET ativo_compra = true,
        legado_item_compra_id = COALESCE(legado_item_compra_id, v_banda),
        updated_at = now()
    WHERE id = v_bporco;
  END IF;
END $$;

UPDATE produtos
SET ativo_compra = true, updated_at = now()
WHERE deleted_at IS NULL
  AND upper(btrim(codigo)) IN ('TZ', 'DT', 'PA', 'BPORCO');

-- 3) Funções de resolução (0 ou >1 → EXCEPTION).
CREATE OR REPLACE FUNCTION onda13_resolver_produto_comercial(p_item uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
  v_n int;
  v_codigo text;
BEGIN
  IF p_item IS NULL THEN
    RAISE EXCEPTION 'Onda 13 backfill: item_comercial_id nulo';
  END IF;
  SELECT count(*), min(id::text)::uuid INTO v_n, v_id
  FROM produtos
  WHERE deleted_at IS NULL AND legado_item_comercial_id = p_item;
  IF v_n = 1 THEN
    RETURN v_id;
  END IF;
  IF v_n > 1 THEN
    RAISE EXCEPTION 'Onda 13 backfill: % produtos para legado_item_comercial_id=%', v_n, p_item;
  END IF;
  SELECT codigo INTO v_codigo FROM itens_comerciais WHERE id = p_item;
  IF v_codigo IS NULL THEN
    RAISE EXCEPTION 'Onda 13 backfill: itens_comerciais.id=% inexistente', p_item;
  END IF;
  SELECT count(*), min(id::text)::uuid INTO v_n, v_id
  FROM produtos
  WHERE deleted_at IS NULL AND upper(btrim(codigo)) = upper(btrim(v_codigo));
  IF v_n = 1 THEN
    RETURN v_id;
  END IF;
  RAISE EXCEPTION 'Onda 13 backfill: fallback codigo=% do item comercial % retornou % produtos', v_codigo, p_item, v_n;
END;
$$;

CREATE OR REPLACE FUNCTION onda13_resolver_produto_compra(p_item uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
  v_n int;
  v_codigo text;
BEGIN
  IF p_item IS NULL THEN
    RAISE EXCEPTION 'Onda 13 backfill: item_compra_id nulo';
  END IF;
  SELECT count(*), min(id::text)::uuid INTO v_n, v_id
  FROM produtos
  WHERE deleted_at IS NULL AND legado_item_compra_id = p_item;
  IF v_n = 1 THEN
    RETURN v_id;
  END IF;
  IF v_n > 1 THEN
    RAISE EXCEPTION 'Onda 13 backfill: % produtos para legado_item_compra_id=%', v_n, p_item;
  END IF;
  SELECT codigo INTO v_codigo FROM itens_compra WHERE id = p_item;
  IF v_codigo IS NULL THEN
    RAISE EXCEPTION 'Onda 13 backfill: itens_compra.id=% inexistente', p_item;
  END IF;
  -- BANDA DE PORCO cai em BPORCO pelo passo 2 (legado_item_compra_id). Se ainda
  -- não bateu, tenta o código comercial sobrevivente.
  IF upper(btrim(v_codigo)) = 'BANDA DE PORCO' THEN
    SELECT count(*), min(id::text)::uuid INTO v_n, v_id
    FROM produtos
    WHERE deleted_at IS NULL AND upper(btrim(codigo)) = 'BPORCO';
  ELSE
    SELECT count(*), min(id::text)::uuid INTO v_n, v_id
    FROM produtos
    WHERE deleted_at IS NULL AND upper(btrim(codigo)) = upper(btrim(v_codigo));
  END IF;
  IF v_n = 1 THEN
    RETURN v_id;
  END IF;
  RAISE EXCEPTION 'Onda 13 backfill: fallback codigo=% do item compra % retornou % produtos', v_codigo, p_item, v_n;
END;
$$;

-- 4) Repontar FKs (todas as linhas, inclusive deleted).
UPDATE disponibilidades_virtuais t SET produto_id = onda13_resolver_produto_comercial(t.item_comercial_id);
UPDATE pedidos_venda_itens t SET produto_id = onda13_resolver_produto_comercial(t.item_comercial_id);
UPDATE adendos_pedido t SET produto_id = onda13_resolver_produto_comercial(t.item_comercial_id);
UPDATE pendencias_overbooking t SET produto_id = onda13_resolver_produto_comercial(t.item_comercial_id);
UPDATE pedidos_fornecedor_itens t SET produto_id = onda13_resolver_produto_comercial(t.item_comercial_id);
UPDATE notas_fiscais_fornecedor_itens t SET produto_id = onda13_resolver_produto_comercial(t.item_comercial_id);
UPDATE recebimentos_itens t SET produto_id = onda13_resolver_produto_comercial(t.item_comercial_id);
UPDATE divergencias_recebimento t SET produto_id = onda13_resolver_produto_comercial(t.item_comercial_id);
UPDATE pecas t SET produto_base_id = onda13_resolver_produto_comercial(t.item_comercial_base_id);
UPDATE subitens t SET produto_id = onda13_resolver_produto_comercial(t.item_comercial_id);
UPDATE compras_programadas_itens t SET produto_id = onda13_resolver_produto_compra(t.item_compra_id);
UPDATE regras_desdobramento_comercial t
SET produto_origem_id = onda13_resolver_produto_compra(t.item_compra_id),
    produto_destino_id = onda13_resolver_produto_comercial(t.item_comercial_id);

-- 5) Identidade 1:1: preencher e soft-delete (auditoria).
UPDATE regras_desdobramento_comercial
SET deleted_at = COALESCE(deleted_at, now()),
    status = 'inativo',
    updated_at = now()
WHERE produto_origem_id = produto_destino_id;

-- 6) Asserts — qualquer count > 0 aborta.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM disponibilidades_virtuais WHERE produto_id IS NULL) THEN
    RAISE EXCEPTION 'Onda 13 backfill: disponibilidades_virtuais.produto_id NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM pedidos_venda_itens WHERE produto_id IS NULL) THEN
    RAISE EXCEPTION 'Onda 13 backfill: pedidos_venda_itens.produto_id NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM adendos_pedido WHERE produto_id IS NULL) THEN
    RAISE EXCEPTION 'Onda 13 backfill: adendos_pedido.produto_id NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM pendencias_overbooking WHERE produto_id IS NULL) THEN
    RAISE EXCEPTION 'Onda 13 backfill: pendencias_overbooking.produto_id NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM pedidos_fornecedor_itens WHERE produto_id IS NULL) THEN
    RAISE EXCEPTION 'Onda 13 backfill: pedidos_fornecedor_itens.produto_id NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM notas_fiscais_fornecedor_itens WHERE produto_id IS NULL) THEN
    RAISE EXCEPTION 'Onda 13 backfill: notas_fiscais_fornecedor_itens.produto_id NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM recebimentos_itens WHERE produto_id IS NULL) THEN
    RAISE EXCEPTION 'Onda 13 backfill: recebimentos_itens.produto_id NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM divergencias_recebimento WHERE produto_id IS NULL) THEN
    RAISE EXCEPTION 'Onda 13 backfill: divergencias_recebimento.produto_id NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM pecas WHERE produto_base_id IS NULL) THEN
    RAISE EXCEPTION 'Onda 13 backfill: pecas.produto_base_id NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM subitens WHERE produto_id IS NULL) THEN
    RAISE EXCEPTION 'Onda 13 backfill: subitens.produto_id NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM compras_programadas_itens WHERE produto_id IS NULL) THEN
    RAISE EXCEPTION 'Onda 13 backfill: compras_programadas_itens.produto_id NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM regras_desdobramento_comercial
    WHERE produto_origem_id IS NULL OR produto_destino_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Onda 13 backfill: regras origem/destino NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM regras_desdobramento_comercial
    WHERE deleted_at IS NULL AND produto_origem_id = produto_destino_id
  ) THEN
    RAISE EXCEPTION 'Onda 13 backfill: regra ativa com origem=destino';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM produtos WHERE deleted_at IS NULL AND upper(btrim(codigo)) = 'BOI'
      AND tipo_operacional = 'compra_base' AND ativo_compra AND NOT ativo_venda
  ) AND EXISTS (
    SELECT 1 FROM itens_compra WHERE deleted_at IS NULL AND upper(btrim(codigo)) = 'BOI'
  ) THEN
    RAISE EXCEPTION 'Onda 13 backfill: produto BOI ausente após insert';
  END IF;
END $$;

DROP FUNCTION onda13_resolver_produto_comercial(uuid);
DROP FUNCTION onda13_resolver_produto_compra(uuid);
