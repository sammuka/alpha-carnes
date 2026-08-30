# 01 — Visão Geral da Aplicação

> **Assessment funcional para homologação assistida do AlphaCarnes.**
> Documento produzido por análise estática do repositório em 2026-08-30 (branch `feature/alissen`).
> Nada aqui foi inventado: cada afirmação tem rastreabilidade em código, migration, schema ou documento canônico.
> Onde o comportamento correto não pôde ser determinado pelo código/documentação, o item está marcado como
> **⚠️ REGRA A CONFIRMAR COM NEGÓCIO**. Onde o código aparenta divergir do esperado, está marcado como
> **🔎 POSSÍVEL GAP IDENTIFICADO** e detalhado em [`06-gaps-identificados.md`](06-gaps-identificados.md).

---

## 1. O que é o sistema

AlphaCarnes é um sistema de gestão operacional para uma **distribuidora de carnes em Osasco/SP** que trabalha
em **cross-docking com compra programada e disponibilidade virtual**. Não é um ERP de estoque tradicional:
a mercadoria em geral **não fica parada** — ela entra, é pesada, é destinada a um pedido já existente e sai
no mesmo dia operacional.

O eixo do sistema é a **Operação** (um dia de compra/venda). Praticamente toda entidade transacional
(compra programada, pedido de venda, disponibilidade, recebimento, caminhão, faturamento, pendência,
aprovação, relatório SIF) carrega `operacao_id`.

### Cadeia de valor implementada

```
Cadastros estruturantes
        │
        ▼
   Operação (dia)
        │
        ├──► Compra Programada ──confirmar──► Disponibilidade Virtual
        │             │                              │
        │             │                              ▼
        │             │                       Pedido de Venda (reserva imediata)
        │             │                              │
        │             │                    ┌─────────┴─────────┐
        │             │                    ▼                   ▼
        │             │              (saldo ok)          Overbooking
        │             │                                  (confirmação + pendência)
        │             ▼
        │      Pedido ao Fornecedor ──enviar──► Recebimento de Carga
        │                                              │
        │                                    NF do fornecedor + itens
        │                                              │
        │                                              ▼
        │                                   Pesagem & Destinação (balança)
        │                                     │        │         │
        │                                  Pedido   Estoque   Desossa
        │                                     │        │         │
        │                                     │        │         ▼
        │                                     │        │   Transformação TZ (regra A/B)
        │                                     │        │      → subitens etiquetados
        │                                     │        │         │
        │                                     ▼        ▼         ▼
        │                              Conferência final Pedido × NF × Pesagem
        │                                              │
        └──────────────────────────────────────────────┤
                                                       ▼
                                          Planejamento de Carga (caminhão)
                                                       │
                                          Conferência por bipagem de etiqueta
                                                       │
                                              Enviar para Faturamento
                                                       │
                                    Pré-Faturamento → emissão NFS-e (EISS Osasco)
                                                       │
                                          Seguro manual + Checklist
                                                       │
                                            Liberação do Caminhão
```

---

## 2. Estado da implementação (fonte: `docs/execucao/EXECUCAO-STATUS.md`)

| Onda | Escopo | Status |
|---|---|---|
| 0 | Pipeline de governança | mergeada |
| 1 | Operação-pivô, overbooking v1.1, Pedido ao Fornecedor, conferência tripla | mergeada |
| 2 | Shell + Design System, menu de 9 grupos, login | mergeada |
| 3 | Cadastros & Regras + Administração | mergeada |
| 4 | Comercial (clientes, pedidos, preços, disponibilidade, espelho) | mergeada |
| 5 | Gestão (painel, operações, compras, overbooking, aprovações, SIF) | mergeada |
| 6 | Recebimento & Balança (incl. Troca de Peça e etiquetas) | mergeada |
| 7 / 7.5 | Desossa + hardening | mergeada |
| 8 | Estoque (consulta FIFO, entrada, ajustes) | mergeada |
| 9 | Carga (planejamento, conferência, envio a faturamento) | mergeada |
| 10 | Faturamento (EISS real + fake, notas/XML, seguro, liberação) | mergeada |
| DS v3 | Design System v3 aplicado às 41+ rotas (AD-10) | aguardando Portão 2 (PR #82) |

**Consequência prática para a homologação:** todas as telas do fluxo operacional existem e têm backend real.
A onda pendente (DS v3) é **exclusivamente visual** — não altera lógica nem contratos. Portanto o assessment
funcional pode ser executado agora; apenas espere pequenas diferenças de aparência se o ambiente não estiver
no branch do DS v3.

> ⚠️ Atenção ao ler documentos antigos: `docs/execucao/revisao-ondas-5-7.md` afirma que as Ondas 8/9/10
> "nunca foram implementadas". Aquele documento é um retrato de 2026-08-01 e foi superado — o estado
> canônico é o `EXECUCAO-STATUS.md`, que registra PR, SHA e CI verde para as três ondas.

---

## 3. Módulos identificados (23)

> As fichas de jornada ([`03`](03-jornadas-operacionais.md) a [`03d`](03d-jornadas-expedicao-faturamento.md))
> desdobram M11–M17 desta visão em módulos mais finos (M11–M23), porque cada um tem tela, permissão e
> ciclo de status próprios. A correspondência está na última coluna.

| # | Módulo | Objetivo | Perfis que usam | Telas | Entidades principais | Depende de |
|---|---|---|---|---|---|---|
| M01 | **Autenticação & Sessão** | Login JWT, refresh, resolução de permissões e menus | Todos | `/login` | `usuarios`, `refresh_tokens`, `perfis` | — |
| M02 | **Administração** | Usuários, perfis/RBAC, parâmetros, auditoria | administrador, diretoria, gestor (auditoria) | `/admin/usuarios`, `/admin/perfis`, `/admin/parametros`, `/admin/auditoria` | `usuarios`, `perfis`, `permissoes`, `parametros`, `auditoria` | M01 |
| M03 | **Cadastros estruturantes** | Catálogo, parceiros, frota, regras e modelos | administrador, gestor, compras, expedicao | 11 telas em `/cadastros/*` + `/comercial/clientes` | `clientes`, `fornecedores`, `produtos`, `itens_compra`, `itens_comerciais`, `representantes`, `rotas`, `frota_caminhoes`, `frota_motoristas`, `regras_desdobramento_comercial`, `regras_transformacao`, `modelos_etiqueta` | M01, M02 |
| M04 | **Operações** | Criar o dia operacional (cadência ou extraordinária) e controlar seu ciclo | gestor, compras, administrador | `/gestao/operacoes` | `operacoes` | M03 |
| M05 | **Compra Programada** | Planejar a compra do dia e gerar disponibilidade virtual | compras, gestor, administrador, comercial (leitura) | `/gestao/compras` | `compras_programadas`, `compras_programadas_itens`, `disponibilidades_virtuais` | M04, fornecedores, itens de compra, regras de desdobramento |
| M06 | **Disponibilidade** | Leitura em tempo real de físico/virtual/reservado/comprometido | comercial, gestor, diretoria, administrador | `/comercial/disponibilidade` | `disponibilidades_virtuais`, `reservas_disponibilidade` | M05 |
| M07 | **Pedidos de Venda** | Registrar venda com reserva imediata, adendo e overbooking | comercial, gestor, administrador | `/comercial/pedidos` | `pedidos_venda`, `pedidos_venda_itens`, `reservas_disponibilidade`, `adendos_pedido` | M05, M06, clientes |
| M08 | **Overbooking** | Resolver o déficit criado por venda acima do saldo | gestor, administrador (resolver); comercial, compras (ver) | `/gestao/overbooking` | `pendencias_overbooking`, `pendencias_overbooking_historico` | M07 |
| M09 | **Tabela de Preços** | Preço diário por produto em 4 faixas (A/B/C/D) | gestor, administrador (gerenciar); comercial (ler) | `/comercial/tabela-precos` | `tabelas_preco`, `tabelas_preco_itens`, `tabelas_preco_publicacoes` | produtos |
| M10 | **Espelho Comercial** | Conferência dos pedidos do dia agrupada e exportável | comercial, gestor, expedicao, administrador | `/comercial/espelho` | leitura de `pedidos_venda` | M07 |
| M11 | **Pedido ao Fornecedor** | Materializar a compra confirmada num pedido formal ao frigorífico | compras, gestor, administrador | 🔎 **sem tela** (só API + combobox do recebimento) — GAP-042 | `pedidos_fornecedor` | M05 |
| M12 | **Recebimento** | Abrir lote e concluir a conferência tripla Pedido × NF × Pesagem | recebimento_pesagem, gestor, compras, administrador | `/recebimento/recebimento-carga` | `recebimentos`, `notas_fiscais_fornecedor`, `divergencias_recebimento`, `conclusoes_conferencia`, `ocorrencias_fornecedor` | M11 |
| M13 | **Pesagem & Destinação** | Pesar cada peça, destiná-la (pedido/estoque/desossa) e trocá-la | recebimento_pesagem, gestor, administrador | `/recebimento/pesagem-destinacao` (+ wizard **Trocar Peça**) | `pecas`, `associacoes_peca_historico`, `trocas_peca` | M12, M07 |
| M14 | **Etiquetas (recebimento)** | Consultar, reimprimir e cancelar etiqueta de peça | recebimento_pesagem, gestor, administrador | `/recebimento/etiquetas` | `etiquetas`, `etiquetas_impressoes` | M13 |
| M15 | **Desossa / Transformação** | Transformar TZ em partes segundo regra exclusiva A ou B | corte, gestor, administrador | `/desossa/dashboard`, `/desossa/pesagem-destinacao`, `/desossa/etiquetas` | `transformacoes`, `subitens`, `regras_transformacao`, `divergencias_transformacao` | M13 |
| M16 | **Estoque** | Consulta FIFO, entrada de caixarias e ajustes com aprovação | expedicao, recebimento_pesagem, gestor, administrador | `/estoque/consulta`, `/estoque/entrada-itens`, `/estoque/ajustes` | `entradas_itens`, `ajustes_estoque` (+ `pecas`, `subitens`) | M13, M15 |
| M17 | **Aprovações & Ocorrências** | Fila administrativa de ocorrências e decisões operacionais | administrativo, gestor, administrador | `/gestao/aprovacoes` | `aprovacoes_operacionais`, `ocorrencias_fornecedor` | M12, M15, M16 |
| M18 | **Carga / Expedição** | Montar caminhão, conferir por bipagem, fechar e enviar ao faturamento | expedicao, conferente, gestor, administrador | `/carga/planejamento`, `/carga/conferencia`, `/carga/enviar-faturamento` | `caminhoes`, `caminhoes_pedidos`, `carga_itens`, `conferencias_carga` | M13, M15, M07 |
| M19 | **Faturamento & NFS-e** | Consolidar a carga e emitir/cancelar a nota no EISS Osasco | faturamento, gestor, administrador | `/faturamento/pre-faturamento`, `/faturamento/notas-xml` | `faturamentos`, `notas_fiscais` | M18 |
| M20 | **Seguro** | Registrar envio e confirmação manual do seguro da carga | faturamento, gestor, administrador | `/faturamento/seguro-manual` | `seguros_carga` | M18 |
| M21 | **Liberação do Caminhão** | Checklist calculado que autoriza a saída | faturamento, logistica, expedicao, gestor, administrador | `/faturamento/liberacao` | leitura de `caminhoes`, `notas_fiscais`, `seguros_carga` | M18, M19, M20 |
| M22 | **Painel Geral** | Visão executiva do dia com 10 KPIs e alertas em tempo real | gestor, diretoria, administrador, comercial, compras | `/gestao/dashboard` | leitura transversal | transversal |
| M23 | **Relatórios SIF** | Área regulatória (modelos oficiais pendentes — P8) | administrativo, gestor, administrador | `/gestao/relatorios` | `relatorios_sif` | M12, M15, M18 |

---

## 4. Personas / perfis (11 perfis canônicos — AD-04)

Os slugs abaixo são fixados por CHECK constraint em `perfis.slug`
(`app/backend/src/database/schema/auth.schema.ts`). **Não existe um 12º perfil "estoque"** — o recorte
`ESTOQUE_*` foi atribuído a `expedicao` e `recebimento_pesagem`.

| Slug | Nome de negócio | Faz | Não faz |
|---|---|---|---|
| `administrador` | Administrador do Sistema | Tudo: configuração, RBAC, parâmetros, catálogo estrutural, auditoria | — |
| `gestor` | Gestor Comercial/Operacional | Aprova compra, resolve overbooking, decide aprovações, estorna associação, aprova ajuste de estoque, reabre expedição | — |
| `compras` | Comprador | Cria/confirma compra programada, gerencia fornecedores, cria/envia Pedido ao Fornecedor, trata divergências e ocorrências | Não emite NF, não libera caminhão, não altera carga fechada |
| `comercial` | Operador Comercial | Cria/edita/cancela pedidos, confirma overbooking, finaliza pedido, consulta disponibilidade | Não resolve pendência de overbooking, não emite NF |
| `recebimento_pesagem` | Operador de Recebimento/Pesagem | Abre lote, registra NF/itens, conclui conferência, pesa, associa, etiqueta, entrada/ajuste de estoque | **Não estorna associação** (segregação D6.3/D6.19), não libera caminhão |
| `corte` | Operador de Corte/Desossa | Abre transformação, vincula regra, registra saídas, etiqueta subitens | Não fecha caminhão, não emite NF |
| `expedicao` | Operador de Expedição | Monta carga, aloca pedidos, confere, fecha, gerencia frota, estoque | Não emite NF |
| `conferente` | Conferente | Bipagem/conferência da carga, registro de divergência | Não redireciona peça, não emite NF |
| `faturamento` | Faturamento/Fiscal | Consolida, emite/cancela/reprocessa NFS-e, seguro, liberação, SIF | Não altera composição de carga fechada |
| `logistica` | Logística/Liberação | Seguro, liberação do caminhão, consulta notas | Não altera carga, não emite NF |
| `diretoria` | Diretoria | Visão executiva: dashboard, disponibilidade, aprovações, SIF, notas, auditoria | Sem mutação operacional |

Fonte da matriz de permissões: `app/backend/src/common/rbac/permissoes.ts` (`MAPA_PERFIL_PERMISSOES` + os
`pushPermissoes` das ondas 1, 3–10). Fonte dos menus por perfil:
`app/backend/src/common/rbac/menus-canonicos.ts` (`MENUS_VISIVEIS_POR_PERFIL`).

### Distinção importante para os testes de permissão

Existem **dois controles independentes**:

1. **`menus_visiveis`** (por perfil) — controla apenas se o item aparece na barra lateral.
2. **Permissões nomeadas** (`PERMISSOES`) — controlam o acesso real ao endpoint e, em várias telas,
   a renderização/habilitação dos botões de ação.

Um usuário pode ter o menu escondido e mesmo assim conseguir abrir a URL diretamente, ou ver o menu e
receber erro na ação. Isso é intencional (o menu é o "atalho recomendado" e a permissão é a fronteira real),
mas gera cenários de teste específicos — ver `JRN-AUTH-004` e a seção de permissões de cada ficha.

---

## 5. Mapa de dependências entre módulos (ETAPA 8)

```
                          M01 Autenticação
                                 │
                          M02 Administração
                                 │
                    M03 Cadastros estruturantes
       ┌──────────────┬──────────┴───────────┬─────────────────┐
       │              │                      │                 │
   M09 Preços    M04 Operações          (frota)           (regras)
       │              │                      │                 │
       │      ┌───────┴────────┐             │                 │
       │      │                │             │                 │
       │  M05 Compra      (cadência)         │                 │
       │  Programada                         │                 │
       │      │                              │                 │
       │      ├──► M06 Disponibilidade       │                 │
       │      │            │                 │                 │
       │      │            ▼                 │                 │
       │      │      M07 Pedidos ──► M08 Overbooking            │
       │      │            │                                   │
       │      │            ├──► M10 Espelho                    │
       │      │            │                                   │
       │      ▼            │                                   │
       │  M11 Pedido ao Fornecedor                              │
       │            │                                          │
       │            ▼                                          │
       │      M12 Recebimento (conferência tripla)              │
       │            │                                          │
       │            ▼                                          │
       │      M13 Pesagem & Destinação ─► M14 Etiquetas ◄───────┘
       │            │            │
       │            ▼            ▼
       │      M16 Estoque   M15 Desossa
       │            │            │
       │            └─────┬──────┘
       │                  ▼
       │           M18 Carga / Expedição
       │                  │
       │                  ▼
       │           M19 Faturamento & NFS-e ──► M20 Seguro
       │                  │                        │
       │                  └────────┬───────────────┘
       │                           ▼
       └──────────────►   M21 Liberação do Caminhão

  Transversais: M17 Aprovações & Ocorrências · M22 Painel Geral · M23 Relatórios SIF
```

### Jornadas que podem ser testadas isoladamente

| Testável sozinho (só precisa de login) | Exige jornada anterior |
|---|---|
| M01 Autenticação | M05 Compra (exige M03 + M04) |
| M02 Administração (usuários, perfis, parâmetros, auditoria) | M06 Disponibilidade (exige M05 confirmada) |
| M03 Cadastros (cada entidade) | M07 Pedidos (exige M05 confirmada + cliente) |
| M04 Operações (cadência/extraordinária) | M08 Overbooking (exige M07 com déficit confirmado) |
| M09 Tabela de Preços (exige só produtos) | M11 Pedido ao Fornecedor (exige M05 confirmada **com disponibilidade gerada**) |
| M22 Painel Geral (leitura; mostra zeros sem dados) | M12 Recebimento (exige M11 enviado) |
| M23 Relatórios SIF (fluxo, não conteúdo) | M13 Pesagem (exige M12 aberto) |
| | M14 Etiquetas (exige M13 com peça etiquetada) |
| | M15 Desossa (exige M13 com peça `para_corte`) |
| | M16 Estoque consulta (exige M13/M15 gerando itens) |
| | M17 Aprovações (exige ocorrência ou solicitação gerada) |
| | M18 Carga (exige M13/M15 com peça etiquetada e associada + pedido finalizado) |
| | M19 Faturamento (exige M18 fechado) |
| | M20 Seguro (exige carga existente) |
| | M21 Liberação (exige M18 + M19 + M20 completos) |

---

## 6. Arquitetura funcional relevante para o teste

| Aspecto | Como funciona | Impacto no roteiro |
|---|---|---|
| **Regras só no backend** (Princípio III) | A UI nunca decide; toda validação crítica é 4xx do backend | Cenários negativos devem verificar a mensagem retornada, não apenas o bloqueio visual |
| **BFF Next.js** | O navegador chama `/api/...` (178 route handlers) e o BFF repassa ao backend com o cookie JWT | Erros de rede aparecem como `Erro de conexão`; erros de negócio vêm com a mensagem do backend |
| **Tempo real por evento** | WebSocket com salas `dashboard` e `operacao:{data}`; sem polling | Disponibilidade, Painel e Pré-Faturamento devem atualizar em uma segunda aba sem F5 — isso é testável |
| **Hardware por gateway isolado** | `HARDWARE_FAKE=1` ativa balança/impressora/leitor falsos | Balança falsa devolve **12,500 kg**; impressora enfileira; leitor devolve código pré-definido |
| **NFS-e por gateway isolado** | `NFSE_FAKE=1` ativa o EISS falso | Emissão devolve `FAKE-001` / `FAKECODE123`; **valor `999.99` força erro de negócio** e **`888.88` força timeout** — gatilhos oficiais para cenários negativos |
| **Auditoria** | Tabela `auditoria` com `INSERT/UPDATE/DELETE/ACAO_MANUAL`, dados anteriores e novos em JSONB | Toda mutação crítica deve deixar rastro consultável em `/admin/auditoria` |
| **Soft delete** | `deleted_at` nas entidades de negócio; existe `POST .../restaurar` | "Excluir" na UI é inativação lógica — o registro continua consultável |

---

## 7. Ambiente de homologação

| Serviço | URL/porta no host | Observação |
|---|---|---|
| Frontend | `http://localhost:4000` | container expõe 3000 |
| Backend | `http://localhost:4001` | container expõe 3001; **sem prefixo global** (`/auth/login`, não `/api/auth/login`) |
| PostgreSQL | `localhost:15433` | usuário/senha/base `alphacarnes` |

```powershell
# subir tudo
docker compose up --build -d
# migrations + seed (dentro de app/backend, ou no container)
npm run db:migrate
npm run db:seed
```

### Usuário disponível após o seed

| Campo | Valor padrão |
|---|---|
| E-mail | `admin@alphacarnes.local` (sobrescrevível por `SEED_ADMIN_EMAIL`) |
| Senha | `Admin@AlphaCarnes2026!` (sobrescrevível por `SEED_ADMIN_PASSWORD`) |
| Perfil | `administrador` |

> **O seed cria apenas o administrador.** Os usuários dos outros 10 perfis (necessários para as jornadas de
> permissão e para a jornada E2E multiperfil) precisam ser criados manualmente em `/admin/usuarios` —
> isso é a jornada `JRN-ADM-001` e é pré-requisito de todo o bloco de testes de permissão.

### O que mais o seed cria

- **11 perfis** com permissões e `menus_visiveis` reconciliados.
- **~100 permissões** nomeadas.
- **21 parâmetros** (`comercial.*`, `operacao.*`, `estoque.*`, `desossa.*`, `gestao.*`, `fiscal.*`, `faturamento.*`),
  vários com `provisorio: true` e a pendência associada (P1, P3, P6, P8, P12, D10.x).
- **6 modelos de etiqueta** (`peca-pedido`, `peca-estoque`, …).
- **Catálogo MVP provisório (P11)**: 11 pares item comercial + produto — TZ, DT, PA, BPORCO, CB, JAC, CBA, FC,
  CXMIU, CXRABO, CXFIG (`seed-catalogo-mvp.ts`).
- **Regras de transformação TZ_A (CB+JAC) e TZ_B (CBA+FC)**, marcadas `provisorio: true` (`seed-regras-transformacao-tz.ts`).

O seed **não** cria: operações, compras, clientes, fornecedores, rotas, representantes, frota, tabela de preços.
Esses são exatamente os cadastros da Fase 1 do roadmap de homologação.

---

## 8. Convenções deste assessment

| Marcação | Significado |
|---|---|
| **Confirmado** | Comportamento lido diretamente no código (service, schema, controller) ou em teste automatizado existente |
| **Inferido** | Deduzido do conjunto código + documento, sem uma linha única que prove |
| **⚠️ REGRA A CONFIRMAR COM NEGÓCIO** | Nem código nem documento definem o comportamento correto |
| **🔎 POSSÍVEL GAP IDENTIFICADO** | O código faz algo que aparenta divergir do esperado — registrado em `06-gaps-identificados.md` |

### Nomenclatura de IDs

| Prefixo | Significado | Exemplo |
|---|---|---|
| `JRN-<MOD>-NNN` | Jornada (ficha completa) | `JRN-PVD-001` |
| `…-A<n>` | Cenário **alternativo** da mesma jornada | `JRN-PVD-001-A1` |
| `…-N<n>` | Cenário **negativo** da mesma jornada | `JRN-PVD-001-N3` |
| `…-P<n>` | Cenário de **permissão** | `JRN-PVD-001-P1` |
| `E2E-NNN` | Jornada ponta a ponta | `E2E-001` |
| `GAP-NNN` | Gap identificado | `GAP-014` |

### Códigos de módulo

`AUTH` · `ADM` · `CAD` · `OPE` · `CMP` · `DIS` · `PVD` · `OVB` · `PRC` · `ESP` · `REC` · `PES` · `DES` ·
`EST` · `CRG` · `FAT` · `GES`

---

## 9. Documentos deste assessment

| Arquivo | Conteúdo |
|---|---|
| `01-visao-geral.md` | Este documento |
| [`02-inventario-telas.md`](02-inventario-telas.md) | Todas as telas, rotas, ações, permissões e matriz de cobertura |
| [`03-jornadas-operacionais.md`](03-jornadas-operacionais.md) | Fichas detalhadas de cada jornada (documento principal) |
| [`04-matriz-testes.md`](04-matriz-testes.md) | Matriz mestre consolidada de todos os cenários |
| [`05-jornada-e2e.md`](05-jornada-e2e.md) | Operação completa do início ao fim |
| [`06-gaps-identificados.md`](06-gaps-identificados.md) | Gaps, inconsistências e regras a confirmar |
| [`07-roadmap-homologacao.md`](07-roadmap-homologacao.md) | Sequência recomendada de execução |
| [`08-matriz-estados-transicoes.md`](08-matriz-estados-transicoes.md) | Estados e transições de cada entidade |
| [`09-rastreabilidade-tecnica.md`](09-rastreabilidade-tecnica.md) | Jornada → rota, componente, endpoint, tabela |
