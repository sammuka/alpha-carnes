-- Onda 5 — Gestão. Expand puro: apenas CREATE. Nenhum ALTER/DROP em objeto existente.

CREATE TABLE relatorios_sif (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  operacao_id         uuid NOT NULL REFERENCES operacoes(id),
  tipo                text NOT NULL,
  codigo              text NOT NULL,
  nome                text NOT NULL,
  status              text NOT NULL DEFAULT 'pendente_dados',
  perfil_responsavel  text NOT NULL,
  pendencias_json     jsonb NOT NULL DEFAULT '[]'::jsonb,
  versao_atual        integer NOT NULL DEFAULT 0,
  provisorio          boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  CONSTRAINT chk_relatorios_sif_tipo CHECK (
    tipo IN ('mapa_recebimento','producao_desossa','controle_expedicao','perdas_destinacao')
  ),
  CONSTRAINT chk_relatorios_sif_status CHECK (
    status IN ('pendente_dados','pronto_para_gerar','gerado','retificado')
  ),
  CONSTRAINT chk_relatorios_sif_versao CHECK (versao_atual >= 0)
);

CREATE UNIQUE INDEX uq_relatorios_sif_operacao_tipo
  ON relatorios_sif (operacao_id, tipo) WHERE deleted_at IS NULL;
CREATE INDEX idx_relatorios_sif_status
  ON relatorios_sif (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_relatorios_sif_pendencias_gin
  ON relatorios_sif USING gin (pendencias_json);

CREATE TABLE relatorios_sif_versoes (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  relatorio_id        uuid NOT NULL REFERENCES relatorios_sif(id),
  versao              integer NOT NULL,
  tipo_geracao        text NOT NULL,
  motivo_retificacao  text,
  conteudo_json       jsonb NOT NULL,
  gerado_por_id       uuid NOT NULL REFERENCES usuarios(id),
  gerado_em           timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_sif_versao_tipo CHECK (tipo_geracao IN ('gerado','retificado')),
  CONSTRAINT chk_sif_versao_positiva CHECK (versao >= 1),
  CONSTRAINT chk_sif_versao_motivo CHECK (
    (tipo_geracao = 'gerado'     AND motivo_retificacao IS NULL)
    OR
    (tipo_geracao = 'retificado' AND motivo_retificacao IS NOT NULL
                                 AND length(btrim(motivo_retificacao)) >= 10)
  )
);

CREATE UNIQUE INDEX uq_sif_versao ON relatorios_sif_versoes (relatorio_id, versao);
CREATE INDEX idx_sif_versao_relatorio ON relatorios_sif_versoes (relatorio_id, versao DESC);

CREATE TABLE aprovacoes_operacionais (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  operacao_id         uuid NOT NULL REFERENCES operacoes(id),
  tipo                text NOT NULL,
  origem              text NOT NULL,
  descricao           text NOT NULL,
  impacto             text NOT NULL,
  referencia_tabela   text,
  referencia_id       uuid,
  solicitante_id      uuid NOT NULL REFERENCES usuarios(id),
  solicitado_em       timestamptz NOT NULL DEFAULT now(),
  status              text NOT NULL DEFAULT 'pendente',
  decisao_motivo      text,
  decidido_por_id     uuid REFERENCES usuarios(id),
  decidido_em         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  CONSTRAINT chk_aprovacao_tipo CHECK (
    tipo IN ('divergencia_transformacao','estorno_fora_regra',
             'reabertura_carga_pedido','ajuste_estoque_relevante')
  ),
  CONSTRAINT chk_aprovacao_status CHECK (status IN ('pendente','aprovada','rejeitada')),
  CONSTRAINT chk_aprovacao_decisao CHECK (
    (status = 'pendente'
      AND decisao_motivo IS NULL AND decidido_por_id IS NULL AND decidido_em IS NULL)
    OR
    (status IN ('aprovada','rejeitada')
      AND decisao_motivo IS NOT NULL AND length(btrim(decisao_motivo)) >= 10
      AND decidido_por_id IS NOT NULL AND decidido_em IS NOT NULL)
  )
);

CREATE INDEX idx_aprovacoes_operacao
  ON aprovacoes_operacionais (operacao_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_aprovacoes_status
  ON aprovacoes_operacionais (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_aprovacoes_referencia
  ON aprovacoes_operacionais (referencia_tabela, referencia_id) WHERE deleted_at IS NULL;

-- Imutabilidade do comparativo Pedido x NF x Pesagem (v1.1 6.10.7).
CREATE OR REPLACE FUNCTION conclusao_conferencia_imutavel() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'conclusoes_conferencia e imutavel (v1.1 6.10.7): tentativa de % em %',
    TG_OP, TG_TABLE_NAME
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_conclusoes_conferencia_imutavel
  BEFORE UPDATE OR DELETE ON conclusoes_conferencia
  FOR EACH ROW EXECUTE FUNCTION conclusao_conferencia_imutavel();

CREATE TRIGGER trg_conclusoes_conferencia_nfs_imutavel
  BEFORE UPDATE OR DELETE ON conclusoes_conferencia_nfs
  FOR EACH ROW EXECUTE FUNCTION conclusao_conferencia_imutavel();

CREATE TRIGGER trg_relatorios_sif_updated_at
  BEFORE UPDATE ON relatorios_sif
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_aprovacoes_operacionais_updated_at
  BEFORE UPDATE ON aprovacoes_operacionais
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
