INSERT INTO operacoes (data, dia_semana, rotulo, status, extraordinaria)
SELECT d.data,
       EXTRACT(DOW FROM d.data)::int,
       'Operação ' || to_char(d.data, 'DD/MM/YYYY'),
       CASE WHEN d.data < CURRENT_DATE THEN 'fechada' ELSE 'aberta' END,
       false
FROM (
  SELECT data_operacao AS data FROM compras_programadas
  UNION SELECT data_operacao FROM disponibilidades_virtuais
  UNION SELECT data_operacao FROM pedidos_venda
  UNION SELECT data_operacao FROM recebimentos
  UNION SELECT data_operacao FROM caminhoes
  UNION SELECT data_operacao FROM faturamentos
) d
WHERE d.data IS NOT NULL
ON CONFLICT (data) WHERE deleted_at IS NULL DO NOTHING;--> statement-breakpoint
UPDATE compras_programadas t SET operacao_id=o.id FROM operacoes o
 WHERE t.operacao_id IS NULL AND o.data=t.data_operacao AND o.deleted_at IS NULL;--> statement-breakpoint
UPDATE disponibilidades_virtuais t SET operacao_id=o.id FROM operacoes o
 WHERE t.operacao_id IS NULL AND o.data=t.data_operacao AND o.deleted_at IS NULL;--> statement-breakpoint
UPDATE pedidos_venda t SET operacao_id=o.id FROM operacoes o
 WHERE t.operacao_id IS NULL AND o.data=t.data_operacao AND o.deleted_at IS NULL;--> statement-breakpoint
UPDATE recebimentos t SET operacao_id=o.id FROM operacoes o
 WHERE t.operacao_id IS NULL AND o.data=t.data_operacao AND o.deleted_at IS NULL;--> statement-breakpoint
UPDATE caminhoes t SET operacao_id=o.id FROM operacoes o
 WHERE t.operacao_id IS NULL AND o.data=t.data_operacao AND o.deleted_at IS NULL;--> statement-breakpoint
UPDATE faturamentos t SET operacao_id=o.id FROM operacoes o
 WHERE t.operacao_id IS NULL AND o.data=t.data_operacao AND o.deleted_at IS NULL;--> statement-breakpoint
UPDATE divergencias_recebimento d
SET item_comercial_id=ri.item_comercial_id
FROM recebimentos_itens ri
WHERE d.item_comercial_id IS NULL
  AND d.recebimento_item_id=ri.id;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM divergencias_recebimento
    WHERE item_comercial_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'divergencia legada sem item comercial; saneamento explícito obrigatório';
  END IF;
END $$;--> statement-breakpoint
INSERT INTO pedidos_fornecedor
  (numero, fornecedor_id, operacao_id, compra_programada_id, status)
SELECT 'PF-RETRO-' || substr(cp.id::text, 1, 8), cp.fornecedor_id,
       cp.operacao_id, cp.id,
       CASE WHEN EXISTS (
         SELECT 1 FROM recebimentos r2
         WHERE r2.compra_programada_id=cp.id
           AND r2.status NOT IN ('finalizado','cancelado')
       ) THEN 'recebido' ELSE 'encerrado' END
FROM compras_programadas cp
WHERE EXISTS (SELECT 1 FROM recebimentos r WHERE r.compra_programada_id=cp.id)
  AND NOT EXISTS (SELECT 1 FROM pedidos_fornecedor pf WHERE pf.compra_programada_id=cp.id)
  AND cp.operacao_id IS NOT NULL;--> statement-breakpoint
INSERT INTO pedidos_fornecedor_itens
  (pedido_fornecedor_id, item_comercial_id, quantidade_prevista)
SELECT pf.id, dv.item_comercial_id, dv.quantidade_total_gerada
FROM pedidos_fornecedor pf
JOIN disponibilidades_virtuais dv ON dv.compra_programada_id=pf.compra_programada_id
WHERE NOT EXISTS (
  SELECT 1 FROM pedidos_fornecedor_itens pfi
  WHERE pfi.pedido_fornecedor_id=pf.id AND pfi.item_comercial_id=dv.item_comercial_id
);--> statement-breakpoint
UPDATE recebimentos r SET pedido_fornecedor_id=pf.id
FROM pedidos_fornecedor pf
WHERE r.pedido_fornecedor_id IS NULL AND pf.compra_programada_id=r.compra_programada_id;--> statement-breakpoint
INSERT INTO notas_fiscais_fornecedor
  (pedido_fornecedor_id, recebimento_id, numero, serie, chave, data_emissao,
   peso_total_declarado, payload_json)
SELECT r.pedido_fornecedor_id, r.id, r.nfe_numero, r.nfe_serie, r.nfe_chave,
       r.nfe_data_emissao, r.nfe_peso_bruto,
       jsonb_build_object('migracao','legado_sem_itens_nf','nfe_peso_liquido',r.nfe_peso_liquido,'nfe_volumes',r.nfe_volumes)
FROM recebimentos r
WHERE r.nfe_numero IS NOT NULL
  AND r.pedido_fornecedor_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM notas_fiscais_fornecedor nf WHERE nf.recebimento_id=r.id);--> statement-breakpoint
UPDATE reservas_disponibilidade
SET tipo_consumo='virtual'
WHERE tipo_consumo IS NULL;--> statement-breakpoint
UPDATE pedidos_venda
SET status = CASE
  WHEN status='reservado' THEN 'em_elaboracao_reserva_ativa'
  WHEN status='parcialmente_reservado' THEN 'aguardando_confirmacao_overbooking'
  ELSE status
END
WHERE status IN ('reservado','parcialmente_reservado');--> statement-breakpoint
UPDATE pedidos_venda_itens
SET status = CASE
  WHEN quantidade_pendente > 0 THEN 'aguardando_confirmacao_overbooking'
  ELSE 'totalmente_reservado'
END
WHERE status IN ('totalmente_reservado','parcialmente_reservado','sem_cobertura');--> statement-breakpoint
UPDATE recebimentos
SET status = CASE
  WHEN status IN ('aguardando_conferencia','em_conferencia') THEN 'pesagem_em_andamento'
  WHEN status='finalizado' AND EXISTS (
    SELECT 1 FROM divergencias_recebimento d
    WHERE d.recebimento_id=recebimentos.id
  ) THEN 'tratativa_administrativa_concluida'
  WHEN status='finalizado' THEN 'conferido_sem_divergencia'
  ELSE status
END
WHERE status IN ('aguardando_conferencia','em_conferencia','finalizado');--> statement-breakpoint
UPDATE divergencias_recebimento
SET descricao = descricao || ' [origem_legado=' || tipo || ']',
    tipo = CASE tipo
      WHEN 'quantidade_menor'        THEN 'falta'
      WHEN 'item_ausente'            THEN 'falta'
      WHEN 'quantidade_maior'        THEN 'excesso'
      WHEN 'item_excedente'          THEN 'excesso'
      WHEN 'peso_incompativel'       THEN 'peso_divergente'
      WHEN 'item_divergente'         THEN 'produto_nao_previsto'
      WHEN 'qualidade_divergente'    THEN 'outro'
      WHEN 'inconsistencia_nf_fisico' THEN 'outro'
    END
WHERE tipo IN (
  'quantidade_menor','quantidade_maior','item_divergente','qualidade_divergente',
  'peso_incompativel','item_ausente','item_excedente','inconsistencia_nf_fisico'
);
