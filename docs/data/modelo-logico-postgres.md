# Modelo Lógico PostgreSQL — AlphaCarnes

> **Convenções obrigatórias aplicadas em todas as tabelas:**
> - PKs: `UUID DEFAULT gen_random_uuid()`
> - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
> - `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` — atualizado por trigger
> - `deleted_at TIMESTAMPTZ` — soft delete (nunca DELETE físico em entidades de negócio)
> - Status/enums: `TEXT` com `CHECK` constraint — não usar pg ENUM
> - Valores monetários: `NUMERIC(15,2)` — nunca FLOAT
> - Pesos: `NUMERIC(10,3)`
> - Alíquotas: `NUMERIC(5,4)`
> - JSONB: `DEFAULT '{}'` com índice GIN quando a coluna for filtrada em queries
> - Referências: PostgreSQL 18 + Drizzle ORM (um arquivo de schema por domínio)

---

## Domínios cobertos

1. [Cadastros](#1-cadastros)
2. [Compra Programada e Disponibilidade Virtual](#2-compra-programada-e-disponibilidade-virtual)
3. [Pedidos de Venda](#3-pedidos-de-venda)
4. [Recebimento e Divergências](#4-recebimento-e-divergências)
5. [Peças, Pesagem e Associação](#5-peças-pesagem-e-associação)
6. [Corte, Transformação e Etiquetas](#6-corte-transformação-e-etiquetas)
7. [Expedição e Caminhões](#7-expedição-e-caminhões)
8. [Faturamento, NF e Documentos](#8-faturamento-nf-e-documentos)
9. [Estoque, Alertas e Auditoria](#9-estoque-alertas-e-auditoria)
10. [Triggers](#triggers)
11. [Status válidos por entidade](#status-válidos-por-entidade)

---

## 1. Cadastros

### 1.1 `clientes`

```sql
CREATE TABLE clientes (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo           TEXT        NOT NULL UNIQUE,
  razao_social     TEXT        NOT NULL,
  nome_fantasia    TEXT,
  cnpj             TEXT        UNIQUE,
  cpf              TEXT        UNIQUE,
  email            TEXT,
  telefone         TEXT,
  rota_padrao      TEXT,
  prioridade       INTEGER     NOT NULL DEFAULT 0,
  endereco         JSONB       NOT NULL DEFAULT '{}',
  dados_fiscais    JSONB       NOT NULL DEFAULT '{}',
  preferencias     JSONB       NOT NULL DEFAULT '{}',
  obs_operacionais TEXT,
  ativo            BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ,

  CONSTRAINT chk_clientes_documento CHECK (cnpj IS NOT NULL OR cpf IS NOT NULL)
);

CREATE INDEX idx_clientes_codigo        ON clientes (codigo);
CREATE INDEX idx_clientes_ativo         ON clientes (ativo) WHERE deleted_at IS NULL;
CREATE INDEX idx_clientes_rota          ON clientes (rota_padrao) WHERE deleted_at IS NULL;
CREATE INDEX idx_clientes_endereco_gin  ON clientes USING GIN (endereco);
CREATE INDEX idx_clientes_preferencias_gin ON clientes USING GIN (preferencias);
```

---

### 1.2 `fornecedores`

```sql
CREATE TABLE fornecedores (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo       TEXT        NOT NULL UNIQUE,
  razao_social TEXT        NOT NULL,
  cnpj         TEXT        NOT NULL UNIQUE,
  email        TEXT,
  telefone     TEXT,
  avaliacao    NUMERIC(3,2),
  contatos     JSONB       NOT NULL DEFAULT '{}',
  parametros   JSONB       NOT NULL DEFAULT '{}',
  observacoes  TEXT,
  ativo        BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ,

  CONSTRAINT chk_fornecedores_avaliacao CHECK (avaliacao IS NULL OR avaliacao BETWEEN 0 AND 5)
);

CREATE INDEX idx_fornecedores_codigo ON fornecedores (codigo);
CREATE INDEX idx_fornecedores_ativo  ON fornecedores (ativo) WHERE deleted_at IS NULL;
CREATE INDEX idx_fornecedores_contatos_gin   ON fornecedores USING GIN (contatos);
CREATE INDEX idx_fornecedores_parametros_gin ON fornecedores USING GIN (parametros);
```

---

### 1.3 `itens_compra`

Representa o item comprado na origem (boi, lote suíno, caixa de frango etc.).

```sql
CREATE TABLE itens_compra (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo        TEXT        NOT NULL UNIQUE,
  descricao     TEXT        NOT NULL,
  categoria     TEXT        NOT NULL,
  unidade_compra TEXT       NOT NULL,
  ativo         BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX idx_itens_compra_codigo    ON itens_compra (codigo);
CREATE INDEX idx_itens_compra_categoria ON itens_compra (categoria);
CREATE INDEX idx_itens_compra_ativo     ON itens_compra (ativo) WHERE deleted_at IS NULL;
```

---

### 1.4 `itens_comerciais`

Representa o item vendável (dianteiro, central, traseiro, subitem específico etc.).

```sql
CREATE TABLE itens_comerciais (
  id                   UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo               TEXT        NOT NULL UNIQUE,
  descricao            TEXT        NOT NULL,
  categoria            TEXT        NOT NULL,
  unidade_comercial    TEXT        NOT NULL,
  permite_corte        BOOLEAN     NOT NULL DEFAULT false,
  peso_medio_estimado  NUMERIC(10,3),
  obs_operacionais     TEXT,
  ativo                BOOLEAN     NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ
);

CREATE INDEX idx_itens_comerciais_codigo     ON itens_comerciais (codigo);
CREATE INDEX idx_itens_comerciais_categoria  ON itens_comerciais (categoria);
CREATE INDEX idx_itens_comerciais_ativo      ON itens_comerciais (ativo) WHERE deleted_at IS NULL;
```

Alias `itens` referenciado no enunciado — esta tabela unifica o cadastro de itens vendáveis com
o campo `tipo` podendo distinguir `'compra'` de `'comercial'` se necessário. Para V1, as duas
entidades são mantidas separadas conforme modelo conceitual (docs 010/011).

---

### 1.5 `regras_desdobramento_comercial`

Define como 1 item de compra gera disponibilidade virtual (ex.: 1 boi → 1 dianteiro + 1 central + 1 traseiro).

```sql
CREATE TABLE regras_desdobramento_comercial (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_compra_id   UUID        NOT NULL REFERENCES itens_compra (id),
  item_comercial_id UUID       NOT NULL REFERENCES itens_comerciais (id),
  fator_quantidade NUMERIC(10,4) NOT NULL DEFAULT 1,
  vigencia_inicio  DATE,
  vigencia_fim     DATE,
  status           TEXT        NOT NULL DEFAULT 'ativa'
                               CHECK (status IN ('ativa', 'inativa')),
  observacoes      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ,

  CONSTRAINT chk_regras_vigencia CHECK (
    vigencia_fim IS NULL OR vigencia_fim >= vigencia_inicio
  )
);

CREATE INDEX idx_regras_desdobr_item_compra    ON regras_desdobramento_comercial (item_compra_id, status);
CREATE INDEX idx_regras_desdobr_item_comercial ON regras_desdobramento_comercial (item_comercial_id, status);
```

---

### 1.6 `usuarios`

```sql
CREATE TABLE usuarios (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome          TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,
  senha_hash    TEXT        NOT NULL,
  perfil        TEXT        NOT NULL
                            CHECK (perfil IN (
                              'admin',
                              'gerente_comercial',
                              'vendedor',
                              'comprador',
                              'supervisor_operacional',
                              'operador_recebimento',
                              'operador_pesagem',
                              'operador_expedicao',
                              'faturista',
                              'financeiro',
                              'visualizador'
                            )),
  ativo         BOOLEAN     NOT NULL DEFAULT true,
  ultimo_acesso TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX idx_usuarios_email  ON usuarios (email);
CREATE INDEX idx_usuarios_perfil ON usuarios (perfil) WHERE deleted_at IS NULL;
CREATE INDEX idx_usuarios_ativo  ON usuarios (ativo) WHERE deleted_at IS NULL;
```

---

## 2. Compra Programada e Disponibilidade Virtual

### 2.1 `compras_programadas`

```sql
CREATE TABLE compras_programadas (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data_operacao       DATE        NOT NULL UNIQUE,  -- RN-07: um lote principal por dia na V1
  fornecedor_id       UUID        NOT NULL REFERENCES fornecedores (id),
  numero_interno      TEXT        UNIQUE,
  referencia_externa  TEXT,
  previsao_entrega    TIMESTAMPTZ,
  status              TEXT        NOT NULL DEFAULT 'rascunho'
                                  CHECK (status IN (
                                    'rascunho',
                                    'em_negociacao',
                                    'confirmada',
                                    'operacionalizada',
                                    'recebida',
                                    'encerrada',
                                    'cancelada'
                                  )),
  total_estimado      NUMERIC(15,2),
  data_confirmacao    TIMESTAMPTZ,
  criado_por          UUID        REFERENCES usuarios (id),
  confirmado_por      UUID        REFERENCES usuarios (id),
  observacoes         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_compras_prog_data_operacao ON compras_programadas (data_operacao);
CREATE INDEX idx_compras_prog_status        ON compras_programadas (status);
CREATE INDEX idx_compras_prog_fornecedor    ON compras_programadas (fornecedor_id);
```

---

### 2.2 `compras_programadas_itens`

```sql
CREATE TABLE compras_programadas_itens (
  id                     UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  compra_id              UUID        NOT NULL REFERENCES compras_programadas (id),
  item_compra_id         UUID        NOT NULL REFERENCES itens_compra (id),
  quantidade_partes      INTEGER     NOT NULL CHECK (quantidade_partes > 0),
  peso_estimado_total    NUMERIC(10,3),
  regra_desdobramento_id UUID        REFERENCES regras_desdobramento_comercial (id),
  observacoes            TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_compras_prog_itens_compra    ON compras_programadas_itens (compra_id);
CREATE INDEX idx_compras_prog_itens_item      ON compras_programadas_itens (item_compra_id);
```

---

### 2.3 `disponibilidades_virtuais`

Saldo comercial virtual gerado a partir da compra. Consumido pelos pedidos sem overbooking (CHECK-01).

```sql
CREATE TABLE disponibilidades_virtuais (
  id                       UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  compra_id                UUID        NOT NULL REFERENCES compras_programadas (id),
  item_comercial_id        UUID        NOT NULL REFERENCES itens_comerciais (id),
  data_validade            DATE        NOT NULL,
  quantidade_total         INTEGER     NOT NULL CHECK (quantidade_total > 0),
  quantidade_reservada     INTEGER     NOT NULL DEFAULT 0 CHECK (quantidade_reservada >= 0),
  quantidade_disponivel    INTEGER     NOT NULL DEFAULT 0 CHECK (quantidade_disponivel >= 0),
  quantidade_recebida      INTEGER     NOT NULL DEFAULT 0 CHECK (quantidade_recebida >= 0),
  quantidade_expedida      INTEGER     NOT NULL DEFAULT 0 CHECK (quantidade_expedida >= 0),
  quantidade_sobra         INTEGER     NOT NULL DEFAULT 0 CHECK (quantidade_sobra >= 0),
  quantidade_com_divergencia INTEGER   NOT NULL DEFAULT 0 CHECK (quantidade_com_divergencia >= 0),
  saldo_total              INTEGER     GENERATED ALWAYS AS (quantidade_total) STORED,
  saldo_disponivel         INTEGER     GENERATED ALWAYS AS (quantidade_disponivel) STORED,
  status                   TEXT        NOT NULL DEFAULT 'gerada'
                                       CHECK (status IN (
                                         'gerada',
                                         'parcialmente_reservada',
                                         'esgotada',
                                         'parcialmente_expedida',
                                         'encerrada',
                                         'com_sobra',
                                         'impactada_por_divergencia'
                                       )),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_disponibilidade_compra_item UNIQUE (compra_id, item_comercial_id)
);

CREATE INDEX idx_disp_virt_compra_item   ON disponibilidades_virtuais (compra_id, item_comercial_id);
CREATE INDEX idx_disp_virt_data_validade ON disponibilidades_virtuais (data_validade);
CREATE INDEX idx_disp_virt_status        ON disponibilidades_virtuais (status);
CREATE INDEX idx_disp_virt_item_status   ON disponibilidades_virtuais (item_comercial_id, status);
```

---

### 2.4 `reservas_disponibilidade`

Tabela transacional de rastreamento de reservas — permite auditoria de cada reserva individual.

```sql
CREATE TABLE reservas_disponibilidade (
  id                      UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  disponibilidade_id      UUID        NOT NULL REFERENCES disponibilidades_virtuais (id),
  pedido_venda_item_id    UUID        NOT NULL,  -- FK após criação de pedidos_venda_itens
  quantidade_reservada    INTEGER     NOT NULL CHECK (quantidade_reservada > 0),
  status_reserva          TEXT        NOT NULL DEFAULT 'ativa'
                                      CHECK (status_reserva IN ('ativa', 'liberada', 'consumida', 'cancelada')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_reserva_disp_item UNIQUE (disponibilidade_id, pedido_venda_item_id)
);

CREATE INDEX idx_reservas_disponibilidade ON reservas_disponibilidade (disponibilidade_id);
CREATE INDEX idx_reservas_pedido_item     ON reservas_disponibilidade (pedido_venda_item_id);
CREATE INDEX idx_reservas_status          ON reservas_disponibilidade (status_reserva);
```

---

## 3. Pedidos de Venda

### 3.1 `pedidos_venda`

```sql
CREATE TABLE pedidos_venda (
  id                 UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  compra_id          UUID        NOT NULL REFERENCES compras_programadas (id),
  cliente_id         UUID        NOT NULL REFERENCES clientes (id),
  data_pedido        TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_entrega       DATE,
  rota_prevista      TEXT,
  prioridade         INTEGER     NOT NULL DEFAULT 0,
  status             TEXT        NOT NULL DEFAULT 'rascunho'
                                 CHECK (status IN (
                                   'rascunho',
                                   'reservado',
                                   'confirmado',
                                   'em_atendimento',
                                   'em_expedicao',
                                   'concluido',
                                   'faturado',
                                   'cancelado',
                                   'impactado_por_divergencia'
                                 )),
  valor_total        NUMERIC(15,2),
  criado_por         UUID        REFERENCES usuarios (id),
  aprovado_por       UUID        REFERENCES usuarios (id),
  observacoes        TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
);

CREATE INDEX idx_pedidos_venda_compra      ON pedidos_venda (compra_id);
CREATE INDEX idx_pedidos_venda_cliente     ON pedidos_venda (cliente_id);
CREATE INDEX idx_pedidos_venda_status      ON pedidos_venda (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_pedidos_venda_data_pedido ON pedidos_venda (data_pedido);
CREATE INDEX idx_pedidos_venda_cliente_status ON pedidos_venda (cliente_id, data_pedido, status);
```

---

### 3.2 `pedidos_venda_itens`

```sql
CREATE TABLE pedidos_venda_itens (
  id                   UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id            UUID        NOT NULL REFERENCES pedidos_venda (id),
  item_comercial_id    UUID        NOT NULL REFERENCES itens_comerciais (id),
  disponibilidade_id   UUID        REFERENCES disponibilidades_virtuais (id),
  quantidade_pedida    INTEGER     NOT NULL CHECK (quantidade_pedida > 0),
  quantidade_reservada INTEGER     NOT NULL DEFAULT 0 CHECK (quantidade_reservada >= 0),
  quantidade_atendida  INTEGER     NOT NULL DEFAULT 0 CHECK (quantidade_atendida >= 0),
  quantidade_pendente  INTEGER     GENERATED ALWAYS AS (quantidade_pedida - quantidade_reservada) STORED,
  peso_estimado        NUMERIC(10,3),
  peso_real            NUMERIC(10,3),
  preferencias         JSONB       NOT NULL DEFAULT '{}',
  status               TEXT        NOT NULL DEFAULT 'pendente'
                                   CHECK (status IN (
                                     'pendente',
                                     'reservado',
                                     'parcialmente_atendido',
                                     'atendido',
                                     'em_expedicao',
                                     'expedido',
                                     'cancelado'
                                   )),
  observacoes          TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pv_itens_pedido         ON pedidos_venda_itens (pedido_id);
CREATE INDEX idx_pv_itens_item_comercial ON pedidos_venda_itens (item_comercial_id);
CREATE INDEX idx_pv_itens_status         ON pedidos_venda_itens (status);
CREATE INDEX idx_pv_itens_pedido_item    ON pedidos_venda_itens (pedido_id, item_comercial_id);
CREATE INDEX idx_pv_itens_preferencias_gin ON pedidos_venda_itens USING GIN (preferencias);

-- FK diferida (pedido_venda_item_id -> pedidos_venda_itens) em reservas_disponibilidade
ALTER TABLE reservas_disponibilidade
  ADD CONSTRAINT fk_reservas_pedido_venda_item
  FOREIGN KEY (pedido_venda_item_id) REFERENCES pedidos_venda_itens (id);
```

---

## 4. Recebimento e Divergências

### 4.1 `recebimentos`

```sql
CREATE TABLE recebimentos (
  id                     UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  compra_id              UUID        NOT NULL REFERENCES compras_programadas (id),
  fornecedor_id          UUID        NOT NULL REFERENCES fornecedores (id),
  data_hora_chegada      TIMESTAMPTZ NOT NULL DEFAULT now(),
  nota_fiscal_fornecedor TEXT,
  placa_veiculo          TEXT,
  motorista_fornecedor   TEXT,
  status                 TEXT        NOT NULL DEFAULT 'aguardando'
                                     CHECK (status IN (
                                       'aguardando',
                                       'em_andamento',
                                       'concluido',
                                       'com_divergencia',
                                       'cancelado'
                                     )),
  operador_id            UUID        REFERENCES usuarios (id),
  observacoes            TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at             TIMESTAMPTZ
);

CREATE INDEX idx_recebimentos_compra     ON recebimentos (compra_id);
CREATE INDEX idx_recebimentos_fornecedor ON recebimentos (fornecedor_id);
CREATE INDEX idx_recebimentos_status     ON recebimentos (status);
CREATE INDEX idx_recebimentos_data       ON recebimentos (data_hora_chegada);
```

---

### 4.2 `recebimentos_itens`

```sql
CREATE TABLE recebimentos_itens (
  id                    UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recebimento_id        UUID        NOT NULL REFERENCES recebimentos (id),
  item_comercial_id     UUID        REFERENCES itens_comerciais (id),
  classificacao_operacional TEXT,
  quantidade_recebida   INTEGER     NOT NULL CHECK (quantidade_recebida >= 0),
  peso_total_apurado    NUMERIC(10,3),
  status_apuracao       TEXT        NOT NULL DEFAULT 'pendente'
                                    CHECK (status_apuracao IN (
                                      'pendente',
                                      'apurado',
                                      'com_divergencia',
                                      'cancelado'
                                    )),
  observacoes           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_receb_itens_recebimento ON recebimentos_itens (recebimento_id);
CREATE INDEX idx_receb_itens_item        ON recebimentos_itens (item_comercial_id);
CREATE INDEX idx_receb_itens_status      ON recebimentos_itens (status_apuracao);
```

---

### 4.3 `divergencias_recebimento`

```sql
CREATE TABLE divergencias_recebimento (
  id                     UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recebimento_id         UUID        NOT NULL REFERENCES recebimentos (id),
  tipo                   TEXT        NOT NULL
                                     CHECK (tipo IN (
                                       'quantidade',
                                       'peso',
                                       'qualidade',
                                       'nota_fiscal',
                                       'especie',
                                       'outro'
                                     )),
  descricao              TEXT        NOT NULL,
  impacto_operacional    TEXT,
  impacto_comercial      TEXT,
  acao_imediata          TEXT,
  status                 TEXT        NOT NULL DEFAULT 'aberta'
                                     CHECK (status IN (
                                       'aberta',
                                       'em_tratamento',
                                       'resolvida',
                                       'encerrada_sem_resolucao'
                                     )),
  responsavel_id         UUID        REFERENCES usuarios (id),
  resolvido_em           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at             TIMESTAMPTZ
);

CREATE INDEX idx_diverg_receb_recebimento ON divergencias_recebimento (recebimento_id);
CREATE INDEX idx_diverg_receb_status      ON divergencias_recebimento (status);
CREATE INDEX idx_diverg_receb_tipo        ON divergencias_recebimento (tipo);
```

---

### 4.4 `divergencias_recebimento_pedidos_afetados`

```sql
CREATE TABLE divergencias_recebimento_pedidos_afetados (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  divergencia_id  UUID        NOT NULL REFERENCES divergencias_recebimento (id),
  pedido_id       UUID        NOT NULL REFERENCES pedidos_venda (id),
  impacto         TEXT,
  observacoes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_diverg_pedido UNIQUE (divergencia_id, pedido_id)
);

CREATE INDEX idx_div_ped_afet_divergencia ON divergencias_recebimento_pedidos_afetados (divergencia_id);
CREATE INDEX idx_div_ped_afet_pedido      ON divergencias_recebimento_pedidos_afetados (pedido_id);
```

---

### 4.5 `ocorrencias_fornecedor`

```sql
CREATE TABLE ocorrencias_fornecedor (
  id                    UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fornecedor_id         UUID        NOT NULL REFERENCES fornecedores (id),
  compra_id             UUID        REFERENCES compras_programadas (id),
  divergencia_id        UUID        REFERENCES divergencias_recebimento (id),
  status                TEXT        NOT NULL DEFAULT 'aberta'
                                    CHECK (status IN (
                                      'aberta',
                                      'em_negociacao',
                                      'aguardando_fornecedor',
                                      'resolvida',
                                      'encerrada'
                                    )),
  descricao             TEXT        NOT NULL,
  impacto               TEXT,
  desfecho              TEXT,
  data_hora_abertura    TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_hora_encerramento TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX idx_ocorr_forn_fornecedor ON ocorrencias_fornecedor (fornecedor_id);
CREATE INDEX idx_ocorr_forn_status     ON ocorrencias_fornecedor (status);
CREATE INDEX idx_ocorr_forn_compra     ON ocorrencias_fornecedor (compra_id);
```

---

### 4.6 `ocorrencias_fornecedor_historico`

```sql
CREATE TABLE ocorrencias_fornecedor_historico (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ocorrencia_id   UUID        NOT NULL REFERENCES ocorrencias_fornecedor (id),
  status_anterior TEXT        NOT NULL,
  status_novo     TEXT        NOT NULL,
  descricao       TEXT,
  responsavel_id  UUID        REFERENCES usuarios (id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ocorr_hist_ocorrencia ON ocorrencias_fornecedor_historico (ocorrencia_id);
```

---

## 5. Peças, Pesagem e Associação

### 5.1 `pecas`

Entidade central da operação física — cada peça física rastreada individualmente.

```sql
CREATE TABLE pecas (
  id                    UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero                BIGSERIAL   NOT NULL UNIQUE,  -- identificador operacional sequencial
  compra_id             UUID        NOT NULL REFERENCES compras_programadas (id),
  recebimento_id        UUID        NOT NULL REFERENCES recebimentos (id),
  item_comercial_id     UUID        REFERENCES itens_comerciais (id),
  classificacao_operacional TEXT,
  pedido_venda_item_id  UUID        REFERENCES pedidos_venda_itens (id),
  peso_bruto            NUMERIC(10,3),
  peso_liquido          NUMERIC(10,3),
  peso_original         NUMERIC(10,3),
  data_hora_pesagem     TIMESTAMPTZ,
  modo_captura_peso     TEXT        CHECK (modo_captura_peso IN (
                                      'balanca_automatica',
                                      'balanca_manual',
                                      'estimado',
                                      'nao_pesado'
                                    )),
  status                TEXT        NOT NULL DEFAULT 'recebida'
                                    CHECK (status IN (
                                      'recebida',
                                      'pesada',
                                      'sugerida',
                                      'associada_provisoriamente',
                                      'em_corte',
                                      'em_expedicao_aberta',
                                      'bloqueada_por_fechamento',
                                      'expedida',
                                      'enviada_para_estoque',
                                      'faturada'
                                    )),
  caminhao_id           UUID,       -- FK para caminhoes (criada em seção 7)
  qr_code               TEXT        UNIQUE,
  atributos             JSONB       NOT NULL DEFAULT '{}',
  observacoes           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX idx_pecas_numero             ON pecas (numero);
CREATE INDEX idx_pecas_compra             ON pecas (compra_id);
CREATE INDEX idx_pecas_recebimento        ON pecas (recebimento_id);
CREATE INDEX idx_pecas_status             ON pecas (status);
CREATE INDEX idx_pecas_pedido_venda_item  ON pecas (pedido_venda_item_id) WHERE pedido_venda_item_id IS NOT NULL;
CREATE INDEX idx_pecas_caminhao           ON pecas (caminhao_id) WHERE caminhao_id IS NOT NULL;
CREATE INDEX idx_pecas_status_caminhao    ON pecas (status, caminhao_id);
CREATE INDEX idx_pecas_qr_code            ON pecas (qr_code) WHERE qr_code IS NOT NULL;
CREATE INDEX idx_pecas_atributos_gin      ON pecas USING GIN (atributos);
```

---

### 5.2 `pesagens`

Log de todas as pesagens (incluindo manuais e repetições). Rastreabilidade de RI-04.

```sql
CREATE TABLE pesagens (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  peca_id      UUID        NOT NULL REFERENCES pecas (id),
  peso_lido    NUMERIC(10,3) NOT NULL CHECK (peso_lido > 0),
  modo_captura TEXT        NOT NULL CHECK (modo_captura IN (
                             'balanca_automatica',
                             'balanca_manual',
                             'estimado'
                           )),
  balanca_id   TEXT,
  estavel      BOOLEAN     NOT NULL DEFAULT true,
  confirmado   BOOLEAN     NOT NULL DEFAULT false,
  operador_id  UUID        REFERENCES usuarios (id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pesagens_peca     ON pesagens (peca_id);
CREATE INDEX idx_pesagens_operador ON pesagens (operador_id);
CREATE INDEX idx_pesagens_data     ON pesagens (created_at);
```

---

### 5.3 `sugestoes_associacao`

Recomendações do sistema para vincular peça a pedido. Pode ser efêmera ou persistida.

```sql
CREATE TABLE sugestoes_associacao (
  id                    UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  peca_id               UUID        NOT NULL REFERENCES pecas (id),
  pedido_id             UUID        NOT NULL REFERENCES pedidos_venda (id),
  pedido_venda_item_id  UUID        NOT NULL REFERENCES pedidos_venda_itens (id),
  score_compatibilidade NUMERIC(5,4) NOT NULL DEFAULT 0 CHECK (score_compatibilidade BETWEEN 0 AND 1),
  justificativa         TEXT,
  status                TEXT        NOT NULL DEFAULT 'pendente'
                                    CHECK (status IN (
                                      'pendente',
                                      'aceita',
                                      'recusada',
                                      'expirada'
                                    )),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sugest_assoc_peca   ON sugestoes_associacao (peca_id, status);
CREATE INDEX idx_sugest_assoc_pedido ON sugestoes_associacao (pedido_id);
```

---

### 5.4 `historico_associacoes_peca`

Toda transferência de destinação de peça deve ser registrada aqui (RI-05).

```sql
CREATE TABLE historico_associacoes_peca (
  id                         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  peca_id                    UUID        NOT NULL REFERENCES pecas (id),
  pedido_origem_id           UUID        REFERENCES pedidos_venda (id),
  pedido_destino_id          UUID        REFERENCES pedidos_venda (id),
  caminhao_origem_id         UUID,       -- FK para caminhoes
  caminhao_destino_id        UUID,       -- FK para caminhoes
  motivo                     TEXT,
  operador_id                UUID        REFERENCES usuarios (id),
  status_expedicao_no_momento TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hist_assoc_peca    ON historico_associacoes_peca (peca_id);
CREATE INDEX idx_hist_assoc_pedido  ON historico_associacoes_peca (pedido_destino_id);
```

---

## 6. Corte, Transformação e Etiquetas

### 6.1 `transformacoes`

```sql
CREATE TABLE transformacoes (
  id                    UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  peca_origem_id        UUID        NOT NULL REFERENCES pecas (id),
  tipo_transformacao    TEXT        NOT NULL CHECK (tipo_transformacao IN (
                                      'corte',
                                      'reprocessamento',
                                      'reclassificacao'
                                    )),
  motivo                TEXT,
  status                TEXT        NOT NULL DEFAULT 'aberta'
                                    CHECK (status IN (
                                      'aberta',
                                      'em_execucao',
                                      'aguardando_pesagem',
                                      'aguardando_associacao',
                                      'aguardando_etiqueta',
                                      'concluida',
                                      'cancelada',
                                      'bloqueada'
                                    )),
  operador_id           UUID        REFERENCES usuarios (id),
  data_hora_abertura    TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_hora_encerramento TIMESTAMPTZ,
  observacoes           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transform_peca_origem ON transformacoes (peca_origem_id);
CREATE INDEX idx_transform_status      ON transformacoes (status);
```

---

### 6.2 `subitens`

Cada item derivado de um corte/transformação. Tem identidade própria (RN-07).

```sql
CREATE TABLE subitens (
  id                    UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transformacao_id      UUID        NOT NULL REFERENCES transformacoes (id),
  peca_origem_id        UUID        NOT NULL REFERENCES pecas (id),
  item_comercial_id     UUID        REFERENCES itens_comerciais (id),
  classificacao         TEXT,
  peso                  NUMERIC(10,3) NOT NULL CHECK (peso > 0),
  quantidade            INTEGER     NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  status                TEXT        NOT NULL DEFAULT 'gerado'
                                    CHECK (status IN (
                                      'gerado',
                                      'pesado',
                                      'associado',
                                      'em_expedicao_aberta',
                                      'bloqueado',
                                      'expedido',
                                      'enviado_a_estoque',
                                      'faturado'
                                    )),
  pedido_venda_item_id  UUID        REFERENCES pedidos_venda_itens (id),
  caminhao_id           UUID,       -- FK para caminhoes
  observacoes           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subitens_transformacao ON subitens (transformacao_id);
CREATE INDEX idx_subitens_peca_origem   ON subitens (peca_origem_id);
CREATE INDEX idx_subitens_status        ON subitens (status);
CREATE INDEX idx_subitens_status_caminhao ON subitens (status, caminhao_id);
```

---

### 6.3 `etiquetas`

Histórico de todas as etiquetas emitidas. Reimpressões auditadas (RI-07).

```sql
CREATE TABLE etiquetas (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_etiqueta     TEXT        NOT NULL UNIQUE,
  tipo_etiqueta       TEXT        NOT NULL CHECK (tipo_etiqueta IN (
                                    'peca',
                                    'subitem',
                                    'reimpressao'
                                  )),
  peca_id             UUID        REFERENCES pecas (id),
  subitem_id          UUID        REFERENCES subitens (id),
  referencia_origem   TEXT,
  versao              INTEGER     NOT NULL DEFAULT 1,
  status              TEXT        NOT NULL DEFAULT 'ativa'
                                  CHECK (status IN (
                                    'ativa',
                                    'substituida',
                                    'cancelada'
                                  )),
  operador_id         UUID        REFERENCES usuarios (id),
  data_hora_impressao TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_etiqueta_origem CHECK (
    (peca_id IS NOT NULL AND subitem_id IS NULL) OR
    (peca_id IS NULL AND subitem_id IS NOT NULL)
  )
);

CREATE INDEX idx_etiquetas_codigo   ON etiquetas (codigo_etiqueta);
CREATE INDEX idx_etiquetas_peca     ON etiquetas (peca_id) WHERE peca_id IS NOT NULL;
CREATE INDEX idx_etiquetas_subitem  ON etiquetas (subitem_id) WHERE subitem_id IS NOT NULL;
CREATE INDEX idx_etiquetas_status   ON etiquetas (status);
```

---

## 7. Expedição e Caminhões

### 7.1 `caminhoes`

```sql
CREATE TABLE caminhoes (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  placa               TEXT        NOT NULL,
  motorista           TEXT        NOT NULL,
  rota                TEXT,
  itinerario          JSONB       NOT NULL DEFAULT '{}',
  status              TEXT        NOT NULL DEFAULT 'planejado'
                                  CHECK (status IN (
                                    'planejado',
                                    'em_carga',
                                    'em_conferencia',
                                    'fechado',
                                    'aguardando_faturamento',
                                    'faturado',
                                    'liberado',
                                    'expedido',
                                    'bloqueado'
                                  )),
  data_operacao       DATE        NOT NULL,
  hora_abertura_carga TIMESTAMPTZ,
  fechado_em          TIMESTAMPTZ,
  hora_liberacao      TIMESTAMPTZ,
  observacoes         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_caminhoes_data_operacao ON caminhoes (data_operacao);
CREATE INDEX idx_caminhoes_status        ON caminhoes (status);
CREATE INDEX idx_caminhoes_placa         ON caminhoes (placa);
CREATE INDEX idx_caminhoes_itinerario_gin ON caminhoes USING GIN (itinerario);

-- Completar FKs de caminhao_id nas tabelas anteriores
ALTER TABLE pecas
  ADD CONSTRAINT fk_pecas_caminhao
  FOREIGN KEY (caminhao_id) REFERENCES caminhoes (id);

ALTER TABLE subitens
  ADD CONSTRAINT fk_subitens_caminhao
  FOREIGN KEY (caminhao_id) REFERENCES caminhoes (id);

ALTER TABLE historico_associacoes_peca
  ADD CONSTRAINT fk_hist_assoc_caminhao_origem
  FOREIGN KEY (caminhao_origem_id) REFERENCES caminhoes (id);

ALTER TABLE historico_associacoes_peca
  ADD CONSTRAINT fk_hist_assoc_caminhao_destino
  FOREIGN KEY (caminhao_destino_id) REFERENCES caminhoes (id);
```

---

### 7.2 `caminhoes_pedidos`

Relaciona pedido de venda ao caminhão de entrega.

```sql
CREATE TABLE caminhoes_pedidos (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caminhao_id    UUID        NOT NULL REFERENCES caminhoes (id),
  pedido_id      UUID        NOT NULL REFERENCES pedidos_venda (id),
  ordem_na_carga INTEGER,
  status         TEXT        NOT NULL DEFAULT 'planejado'
                             CHECK (status IN (
                               'planejado',
                               'em_carga',
                               'concluido',
                               'removido'
                             )),
  observacoes    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_caminhao_pedido UNIQUE (caminhao_id, pedido_id)
);

CREATE INDEX idx_cam_pedidos_caminhao ON caminhoes_pedidos (caminhao_id);
CREATE INDEX idx_cam_pedidos_pedido   ON caminhoes_pedidos (pedido_id);
```

---

### 7.3 `carga_itens`

Relaciona peça ou subitem ao caminhão. CHECK-06: só um dos dois preenchido.

```sql
CREATE TABLE carga_itens (
  id                   UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caminhao_id          UUID        NOT NULL REFERENCES caminhoes (id),
  tipo_origem          TEXT        NOT NULL CHECK (tipo_origem IN ('peca', 'subitem')),
  peca_id              UUID        REFERENCES pecas (id),
  subitem_id           UUID        REFERENCES subitens (id),
  pedido_id            UUID        NOT NULL REFERENCES pedidos_venda (id),
  pedido_venda_item_id UUID        NOT NULL REFERENCES pedidos_venda_itens (id),
  posicao_carga        TEXT,
  data_hora_entrada    TIMESTAMPTZ NOT NULL DEFAULT now(),
  conferido            BOOLEAN     NOT NULL DEFAULT false,
  status               TEXT        NOT NULL DEFAULT 'carregado'
                                   CHECK (status IN (
                                     'carregado',
                                     'conferido',
                                     'removido'
                                   )),
  observacoes          TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_carga_item_origem CHECK (
    (tipo_origem = 'peca'    AND peca_id    IS NOT NULL AND subitem_id IS NULL) OR
    (tipo_origem = 'subitem' AND subitem_id IS NOT NULL AND peca_id    IS NULL)
  )
);

CREATE INDEX idx_carga_itens_caminhao ON carga_itens (caminhao_id, status);
CREATE INDEX idx_carga_itens_pedido   ON carga_itens (pedido_id);
CREATE INDEX idx_carga_itens_peca     ON carga_itens (peca_id) WHERE peca_id IS NOT NULL;
CREATE INDEX idx_carga_itens_subitem  ON carga_itens (subitem_id) WHERE subitem_id IS NOT NULL;
```

---

### 7.4 `conferencias_carga`

```sql
CREATE TABLE conferencias_carga (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caminhao_id       UUID        NOT NULL REFERENCES caminhoes (id),
  operador_id       UUID        REFERENCES usuarios (id),
  status            TEXT        NOT NULL DEFAULT 'iniciada'
                                CHECK (status IN (
                                  'iniciada',
                                  'em_andamento',
                                  'concluida_ok',
                                  'concluida_com_pendencias',
                                  'cancelada'
                                )),
  data_hora_inicio  TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_hora_fim     TIMESTAMPTZ,
  pendencias        JSONB       NOT NULL DEFAULT '{}',
  observacoes       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conf_carga_caminhao ON conferencias_carga (caminhao_id);
CREATE INDEX idx_conf_carga_status   ON conferencias_carga (status);
CREATE INDEX idx_conf_carga_pendencias_gin ON conferencias_carga USING GIN (pendencias);
```

---

## 8. Faturamento, NF e Documentos

### 8.1 `faturamentos`

```sql
CREATE TABLE faturamentos (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caminhao_id       UUID        NOT NULL REFERENCES caminhoes (id) UNIQUE,
  responsavel_id    UUID        REFERENCES usuarios (id),
  status            TEXT        NOT NULL DEFAULT 'iniciado'
                                CHECK (status IN (
                                  'iniciado',
                                  'em_emissao',
                                  'concluido',
                                  'com_erro',
                                  'cancelado'
                                )),
  data_hora_inicio  TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_hora_fim     TIMESTAMPTZ,
  observacoes       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_faturamentos_caminhao ON faturamentos (caminhao_id);
CREATE INDEX idx_faturamentos_status   ON faturamentos (status);
```

---

### 8.2 `notas_fiscais`

```sql
CREATE TABLE notas_fiscais (
  id                    UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  faturamento_id        UUID        NOT NULL REFERENCES faturamentos (id),
  pedido_id             UUID        REFERENCES pedidos_venda (id),
  expedicao_id          UUID        REFERENCES caminhoes (id),
  numero_nfse           TEXT        UNIQUE,
  chave_acesso          TEXT        UNIQUE,
  tipo_documento        TEXT        NOT NULL DEFAULT 'nfse'
                                    CHECK (tipo_documento IN ('nfse', 'nfe', 'outro')),
  status                TEXT        NOT NULL DEFAULT 'nao_iniciada'
                                    CHECK (status IN (
                                      'nao_iniciada',
                                      'em_preparacao',
                                      'em_emissao',
                                      'aguardando_autorizacao',
                                      'autorizada',
                                      'rejeitada',
                                      'cancelada'
                                    )),
  valor                 NUMERIC(15,2) NOT NULL DEFAULT 0,
  aliquota              NUMERIC(5,4),
  payload_eiss          JSONB       NOT NULL DEFAULT '{}',
  retorno_eiss          JSONB       NOT NULL DEFAULT '{}',
  emitido_em            TIMESTAMPTZ,
  autorizado_em         TIMESTAMPTZ,
  observacoes           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX idx_nf_faturamento  ON notas_fiscais (faturamento_id);
CREATE INDEX idx_nf_pedido       ON notas_fiscais (pedido_id) WHERE pedido_id IS NOT NULL;
CREATE INDEX idx_nf_status       ON notas_fiscais (status);
CREATE INDEX idx_nf_emitido_em   ON notas_fiscais (emitido_em) WHERE emitido_em IS NOT NULL;
CREATE INDEX idx_nf_payload_gin  ON notas_fiscais USING GIN (payload_eiss);
CREATE INDEX idx_nf_retorno_gin  ON notas_fiscais USING GIN (retorno_eiss);
```

---

### 8.3 `notas_fiscais_pedidos`

Tabela N:N — uma NF pode consolidar múltiplos pedidos.

```sql
CREATE TABLE notas_fiscais_pedidos (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nota_id      UUID        NOT NULL REFERENCES notas_fiscais (id),
  pedido_id    UUID        NOT NULL REFERENCES pedidos_venda (id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_nf_pedido UNIQUE (nota_id, pedido_id)
);

CREATE INDEX idx_nf_pedidos_nota   ON notas_fiscais_pedidos (nota_id);
CREATE INDEX idx_nf_pedidos_pedido ON notas_fiscais_pedidos (pedido_id);
```

---

### 8.4 `seguros_carga`

```sql
CREATE TABLE seguros_carga (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caminhao_id       UUID        NOT NULL REFERENCES caminhoes (id) UNIQUE,
  status            TEXT        NOT NULL DEFAULT 'pendente'
                                CHECK (status IN (
                                  'pendente',
                                  'gerado',
                                  'enviado',
                                  'confirmado',
                                  'cancelado'
                                )),
  protocolo         TEXT,
  data_hora_geracao TIMESTAMPTZ,
  observacoes       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_seguros_carga_caminhao ON seguros_carga (caminhao_id);
CREATE INDEX idx_seguros_carga_status   ON seguros_carga (status);
```

---

### 8.5 `envios_documento_motorista`

Evidência do envio eletrônico de documentos ao motorista.

```sql
CREATE TABLE envios_documento_motorista (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caminhao_id    UUID        NOT NULL REFERENCES caminhoes (id),
  tipo_documento TEXT        NOT NULL CHECK (tipo_documento IN (
                               'danfe',
                               'seguro',
                               'romaneio',
                               'outro'
                             )),
  canal_envio    TEXT        NOT NULL CHECK (canal_envio IN ('email', 'whatsapp', 'sms', 'outro')),
  destinatario   TEXT        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pendente'
                             CHECK (status IN (
                               'pendente',
                               'enviado',
                               'confirmado',
                               'erro'
                             )),
  evidencias     JSONB       NOT NULL DEFAULT '{}',
  data_hora_envio TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_envios_doc_caminhao ON envios_documento_motorista (caminhao_id);
CREATE INDEX idx_envios_doc_status   ON envios_documento_motorista (status);
CREATE INDEX idx_envios_doc_evidencias_gin ON envios_documento_motorista USING GIN (evidencias);
```

---

## 9. Estoque, Alertas e Auditoria

### 9.1 `estoque_movimentos`

Sobras e entradas excepcionais de estoque. Toda entrada registra origem operacional (RN-10).

```sql
CREATE TABLE estoque_movimentos (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_origem       TEXT        NOT NULL CHECK (tipo_origem IN ('peca', 'subitem')),
  peca_id           UUID        REFERENCES pecas (id),
  subitem_id        UUID        REFERENCES subitens (id),
  motivo_entrada    TEXT        NOT NULL CHECK (motivo_entrada IN (
                                  'sobra_operacional',
                                  'cancelamento_pedido',
                                  'divergencia',
                                  'reprocessamento',
                                  'outro'
                                )),
  status            TEXT        NOT NULL DEFAULT 'em_estoque'
                                CHECK (status IN (
                                  'em_estoque',
                                  'congelado',
                                  'descartado',
                                  'realocado'
                                )),
  operador_id       UUID        REFERENCES usuarios (id),
  data_hora_movimento TIMESTAMPTZ NOT NULL DEFAULT now(),
  observacoes       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_estoque_origem CHECK (
    (tipo_origem = 'peca'    AND peca_id    IS NOT NULL AND subitem_id IS NULL) OR
    (tipo_origem = 'subitem' AND subitem_id IS NOT NULL AND peca_id    IS NULL)
  )
);

CREATE INDEX idx_estoque_mov_peca    ON estoque_movimentos (peca_id) WHERE peca_id IS NOT NULL;
CREATE INDEX idx_estoque_mov_subitem ON estoque_movimentos (subitem_id) WHERE subitem_id IS NOT NULL;
CREATE INDEX idx_estoque_mov_status  ON estoque_movimentos (status);
CREATE INDEX idx_estoque_mov_motivo  ON estoque_movimentos (motivo_entrada);
```

---

### 9.2 `alertas`

```sql
CREATE TABLE alertas (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo             TEXT        NOT NULL CHECK (tipo IN (
                                 'saldo_critico',
                                 'divergencia_recebimento',
                                 'peca_sem_pedido',
                                 'caminhao_atrasado',
                                 'nf_rejeitada',
                                 'expedicao_bloqueada',
                                 'peso_inconsistente',
                                 'outro'
                               )),
  severidade       TEXT        NOT NULL CHECK (severidade IN ('info', 'aviso', 'critico')),
  modulo_origem    TEXT        NOT NULL,
  entidade_origem  TEXT,
  entidade_id      UUID,
  titulo           TEXT        NOT NULL,
  mensagem         TEXT        NOT NULL,
  lido             BOOLEAN     NOT NULL DEFAULT false,
  destinatario_id  UUID        REFERENCES usuarios (id),
  resolvido_em     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alertas_destinatario ON alertas (destinatario_id, lido);
CREATE INDEX idx_alertas_severidade   ON alertas (severidade) WHERE resolvido_em IS NULL;
CREATE INDEX idx_alertas_tipo         ON alertas (tipo);
CREATE INDEX idx_alertas_modulo       ON alertas (modulo_origem);
CREATE INDEX idx_alertas_nao_lidos    ON alertas (lido, created_at) WHERE lido = false;
```

---

### 9.3 `divergencias`

Tabela genérica de divergências (referenciada no enunciado como `divergencias`).
Complementa `divergencias_recebimento` para divergências de outros módulos.

```sql
CREATE TABLE divergencias (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recebimento_id   UUID        REFERENCES recebimentos (id),
  tipo             TEXT        NOT NULL,
  descricao        TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'aberta'
                               CHECK (status IN (
                                 'aberta',
                                 'em_tratamento',
                                 'resolvida',
                                 'encerrada'
                               )),
  responsavel_id   UUID        REFERENCES usuarios (id),
  resolvido_em     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX idx_divergencias_recebimento ON divergencias (recebimento_id) WHERE recebimento_id IS NOT NULL;
CREATE INDEX idx_divergencias_status      ON divergencias (status);
CREATE INDEX idx_divergencias_tipo        ON divergencias (tipo);
```

---

### 9.4 `auditoria`

Log imutável de todas as operações críticas. Nunca soft-delete — jamais deletar registros de auditoria.

```sql
CREATE TABLE auditoria (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tabela           TEXT        NOT NULL,
  registro_id      UUID        NOT NULL,
  operacao         TEXT        NOT NULL CHECK (operacao IN ('INSERT', 'UPDATE', 'DELETE', 'ACAO_MANUAL')),
  modulo           TEXT,
  usuario_id       UUID        REFERENCES usuarios (id),
  dados_anteriores JSONB       NOT NULL DEFAULT '{}',
  dados_novos      JSONB       NOT NULL DEFAULT '{}',
  justificativa    TEXT,
  ip               TEXT,
  user_agent       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auditoria_tabela_registro ON auditoria (tabela, registro_id);
CREATE INDEX idx_auditoria_usuario         ON auditoria (usuario_id);
CREATE INDEX idx_auditoria_modulo          ON auditoria (modulo);
CREATE INDEX idx_auditoria_data            ON auditoria (created_at);
CREATE INDEX idx_auditoria_operacao        ON auditoria (operacao);
CREATE INDEX idx_auditoria_dados_ant_gin   ON auditoria USING GIN (dados_anteriores);
CREATE INDEX idx_auditoria_dados_nov_gin   ON auditoria USING GIN (dados_novos);
```

---

## Triggers

### Função `set_updated_at()`

Atualiza `updated_at` automaticamente em todo UPDATE.

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Aplicação em todas as tabelas de negócio

```sql
-- Cadastros
CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_fornecedores_updated_at
  BEFORE UPDATE ON fornecedores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_itens_compra_updated_at
  BEFORE UPDATE ON itens_compra
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_itens_comerciais_updated_at
  BEFORE UPDATE ON itens_comerciais
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_regras_desdobr_updated_at
  BEFORE UPDATE ON regras_desdobramento_comercial
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_usuarios_updated_at
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Compra programada
CREATE TRIGGER trg_compras_prog_updated_at
  BEFORE UPDATE ON compras_programadas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_compras_prog_itens_updated_at
  BEFORE UPDATE ON compras_programadas_itens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_disp_virt_updated_at
  BEFORE UPDATE ON disponibilidades_virtuais
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_reservas_disp_updated_at
  BEFORE UPDATE ON reservas_disponibilidade
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Pedidos de venda
CREATE TRIGGER trg_pedidos_venda_updated_at
  BEFORE UPDATE ON pedidos_venda
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_pv_itens_updated_at
  BEFORE UPDATE ON pedidos_venda_itens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Recebimento e divergências
CREATE TRIGGER trg_recebimentos_updated_at
  BEFORE UPDATE ON recebimentos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_receb_itens_updated_at
  BEFORE UPDATE ON recebimentos_itens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_diverg_receb_updated_at
  BEFORE UPDATE ON divergencias_recebimento
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_ocorr_forn_updated_at
  BEFORE UPDATE ON ocorrencias_fornecedor
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Peças e pesagem
CREATE TRIGGER trg_pecas_updated_at
  BEFORE UPDATE ON pecas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_sugest_assoc_updated_at
  BEFORE UPDATE ON sugestoes_associacao
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Corte e transformação
CREATE TRIGGER trg_transformacoes_updated_at
  BEFORE UPDATE ON transformacoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_subitens_updated_at
  BEFORE UPDATE ON subitens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Expedição
CREATE TRIGGER trg_caminhoes_updated_at
  BEFORE UPDATE ON caminhoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_cam_pedidos_updated_at
  BEFORE UPDATE ON caminhoes_pedidos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_carga_itens_updated_at
  BEFORE UPDATE ON carga_itens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_conf_carga_updated_at
  BEFORE UPDATE ON conferencias_carga
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Faturamento
CREATE TRIGGER trg_faturamentos_updated_at
  BEFORE UPDATE ON faturamentos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_notas_fiscais_updated_at
  BEFORE UPDATE ON notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_seguros_carga_updated_at
  BEFORE UPDATE ON seguros_carga
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_envios_doc_updated_at
  BEFORE UPDATE ON envios_documento_motorista
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Estoque e alertas
CREATE TRIGGER trg_alertas_updated_at
  BEFORE UPDATE ON alertas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_divergencias_updated_at
  BEFORE UPDATE ON divergencias
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

### Função de auditoria genérica

Registra automaticamente INSERT/UPDATE/DELETE nas tabelas críticas.

```sql
CREATE OR REPLACE FUNCTION fn_auditoria_generica()
RETURNS TRIGGER AS $$
DECLARE
  v_dados_ant JSONB := '{}';
  v_dados_nov JSONB := '{}';
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_dados_ant := to_jsonb(OLD);
  ELSIF TG_OP = 'UPDATE' THEN
    v_dados_ant := to_jsonb(OLD);
    v_dados_nov := to_jsonb(NEW);
  ELSIF TG_OP = 'INSERT' THEN
    v_dados_nov := to_jsonb(NEW);
  END IF;

  INSERT INTO auditoria (tabela, registro_id, operacao, dados_anteriores, dados_novos)
  VALUES (
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN (OLD).id ELSE (NEW).id END,
    TG_OP,
    v_dados_ant,
    v_dados_nov
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar em tabelas críticas de negócio
CREATE TRIGGER trg_audit_pecas
  AFTER INSERT OR UPDATE OR DELETE ON pecas
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria_generica();

CREATE TRIGGER trg_audit_pedidos_venda
  AFTER INSERT OR UPDATE OR DELETE ON pedidos_venda
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria_generica();

CREATE TRIGGER trg_audit_notas_fiscais
  AFTER INSERT OR UPDATE OR DELETE ON notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria_generica();

CREATE TRIGGER trg_audit_caminhoes
  AFTER INSERT OR UPDATE OR DELETE ON caminhoes
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria_generica();

CREATE TRIGGER trg_audit_carga_itens
  AFTER INSERT OR UPDATE OR DELETE ON carga_itens
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria_generica();

CREATE TRIGGER trg_audit_disponibilidades_virtuais
  AFTER INSERT OR UPDATE OR DELETE ON disponibilidades_virtuais
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria_generica();

CREATE TRIGGER trg_audit_historico_associacoes
  AFTER INSERT ON historico_associacoes_peca
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria_generica();
```

---

## Status válidos por entidade

Consolidação de todos os `CHECK` constraints de status aplicados no DDL acima.

| Tabela | Coluna | Valores válidos |
|--------|--------|----------------|
| `clientes` | `ativo` | `true`, `false` |
| `fornecedores` | `ativo` | `true`, `false` |
| `regras_desdobramento_comercial` | `status` | `ativa`, `inativa` |
| `usuarios` | `perfil` | `admin`, `gerente_comercial`, `vendedor`, `comprador`, `supervisor_operacional`, `operador_recebimento`, `operador_pesagem`, `operador_expedicao`, `faturista`, `financeiro`, `visualizador` |
| `compras_programadas` | `status` | `rascunho`, `em_negociacao`, `confirmada`, `operacionalizada`, `recebida`, `encerrada`, `cancelada` |
| `disponibilidades_virtuais` | `status` | `gerada`, `parcialmente_reservada`, `esgotada`, `parcialmente_expedida`, `encerrada`, `com_sobra`, `impactada_por_divergencia` |
| `reservas_disponibilidade` | `status_reserva` | `ativa`, `liberada`, `consumida`, `cancelada` |
| `pedidos_venda` | `status` | `rascunho`, `reservado`, `confirmado`, `em_atendimento`, `em_expedicao`, `concluido`, `faturado`, `cancelado`, `impactado_por_divergencia` |
| `pedidos_venda_itens` | `status` | `pendente`, `reservado`, `parcialmente_atendido`, `atendido`, `em_expedicao`, `expedido`, `cancelado` |
| `recebimentos` | `status` | `aguardando`, `em_andamento`, `concluido`, `com_divergencia`, `cancelado` |
| `recebimentos_itens` | `status_apuracao` | `pendente`, `apurado`, `com_divergencia`, `cancelado` |
| `divergencias_recebimento` | `tipo` | `quantidade`, `peso`, `qualidade`, `nota_fiscal`, `especie`, `outro` |
| `divergencias_recebimento` | `status` | `aberta`, `em_tratamento`, `resolvida`, `encerrada_sem_resolucao` |
| `ocorrencias_fornecedor` | `status` | `aberta`, `em_negociacao`, `aguardando_fornecedor`, `resolvida`, `encerrada` |
| `pecas` | `modo_captura_peso` | `balanca_automatica`, `balanca_manual`, `estimado`, `nao_pesado` |
| `pecas` | `status` | `recebida`, `pesada`, `sugerida`, `associada_provisoriamente`, `em_corte`, `em_expedicao_aberta`, `bloqueada_por_fechamento`, `expedida`, `enviada_para_estoque`, `faturada` |
| `pesagens` | `modo_captura` | `balanca_automatica`, `balanca_manual`, `estimado` |
| `sugestoes_associacao` | `status` | `pendente`, `aceita`, `recusada`, `expirada` |
| `transformacoes` | `tipo_transformacao` | `corte`, `reprocessamento`, `reclassificacao` |
| `transformacoes` | `status` | `aberta`, `em_execucao`, `aguardando_pesagem`, `aguardando_associacao`, `aguardando_etiqueta`, `concluida`, `cancelada`, `bloqueada` |
| `subitens` | `status` | `gerado`, `pesado`, `associado`, `em_expedicao_aberta`, `bloqueado`, `expedido`, `enviado_a_estoque`, `faturado` |
| `etiquetas` | `tipo_etiqueta` | `peca`, `subitem`, `reimpressao` |
| `etiquetas` | `status` | `ativa`, `substituida`, `cancelada` |
| `caminhoes` | `status` | `planejado`, `em_carga`, `em_conferencia`, `fechado`, `aguardando_faturamento`, `faturado`, `liberado`, `expedido`, `bloqueado` |
| `caminhoes_pedidos` | `status` | `planejado`, `em_carga`, `concluido`, `removido` |
| `carga_itens` | `tipo_origem` | `peca`, `subitem` |
| `carga_itens` | `status` | `carregado`, `conferido`, `removido` |
| `conferencias_carga` | `status` | `iniciada`, `em_andamento`, `concluida_ok`, `concluida_com_pendencias`, `cancelada` |
| `faturamentos` | `status` | `iniciado`, `em_emissao`, `concluido`, `com_erro`, `cancelado` |
| `notas_fiscais` | `tipo_documento` | `nfse`, `nfe`, `outro` |
| `notas_fiscais` | `status` | `nao_iniciada`, `em_preparacao`, `em_emissao`, `aguardando_autorizacao`, `autorizada`, `rejeitada`, `cancelada` |
| `seguros_carga` | `status` | `pendente`, `gerado`, `enviado`, `confirmado`, `cancelado` |
| `envios_documento_motorista` | `tipo_documento` | `danfe`, `seguro`, `romaneio`, `outro` |
| `envios_documento_motorista` | `canal_envio` | `email`, `whatsapp`, `sms`, `outro` |
| `envios_documento_motorista` | `status` | `pendente`, `enviado`, `confirmado`, `erro` |
| `estoque_movimentos` | `tipo_origem` | `peca`, `subitem` |
| `estoque_movimentos` | `motivo_entrada` | `sobra_operacional`, `cancelamento_pedido`, `divergencia`, `reprocessamento`, `outro` |
| `estoque_movimentos` | `status` | `em_estoque`, `congelado`, `descartado`, `realocado` |
| `alertas` | `tipo` | `saldo_critico`, `divergencia_recebimento`, `peca_sem_pedido`, `caminhao_atrasado`, `nf_rejeitada`, `expedicao_bloqueada`, `peso_inconsistente`, `outro` |
| `alertas` | `severidade` | `info`, `aviso`, `critico` |
| `divergencias` | `status` | `aberta`, `em_tratamento`, `resolvida`, `encerrada` |
| `auditoria` | `operacao` | `INSERT`, `UPDATE`, `DELETE`, `ACAO_MANUAL` |
