# Onda 6 — Recebimento & Balança

**Base:** `origin/develop` @ `29bd73c` (O4+O5 mergeadas) · **Branch de implementação:** `feature/onda6-recebimento-balanca`
**Escopo (roadmap §8):** recebimento v1.1 §6.10, pesagem §6.11–6.12, Troca de Peça atômica §6.13,
etiquetas §6.15/§10.4, UI fiel às 3 telas de recebimento/balança do protótipo.
**Herança obrigatória:** as 7 dívidas NF/Recebimento da Onda 1 redirecionadas pela decisão 28 do
plano da Onda 2 (`docs/superpowers/plans/2026-07-25-onda2-shell-ds.md:119-132`) entram no mapa
DoD→teste desta onda.

## Goal

Fechar as três rotas de recebimento/balança com backend transacional, UI idêntica ao protótipo e
as 7 dívidas de NF quitadas — sem criar módulo paralelo: **tudo é alteração dos artefatos que já
existem em `develop`** (`modules/operacao/recebimento`, `modules/operacao/pesagem`,
`app/(admin)/recebimento/*`).

## Rotas da onda (matriz de rastreabilidade v1.1)

| Rota | Tela real | Protótipo |
|---|---|---|
| `/recebimento/recebimento-carga` | `app/frontend/src/app/(admin)/recebimento/recebimento-carga/recebimento-carga-client.tsx` | `src/app/pages/RecebimentoCarga.tsx` |
| `/recebimento/pesagem-destinacao` | `app/frontend/src/app/(admin)/recebimento/pesagem-destinacao/pesagem-destinacao-client.tsx` | `src/app/pages/PesagemDestinacao.tsx` |
| `/recebimento/etiquetas` | `app/frontend/src/app/(admin)/recebimento/etiquetas/etiquetas-client.tsx` | `src/app/pages/EtiquetasRecebimento.tsx` |

## Referências do protótipo (`F:\Projetos\alpha-carnes-prototipo` @ `feature/completude-v1.1`)

| Bloco a reproduzir | Arquivo:linhas |
|---|---|
| Badge de status do lote (7 estados) | `src/app/pages/RecebimentoCarga.tsx:15-19,227-253` |
| Status do item de conferência | `src/app/pages/RecebimentoCarga.tsx:20,237-243` |
| Itens da NF por lote (captura) | `src/app/pages/RecebimentoCarga.tsx:124-135` |
| Modal “Pesagens do produto” | `src/app/pages/RecebimentoCarga.tsx:283-327` |
| Modal “Entrada direta” | `src/app/pages/RecebimentoCarga.tsx:328-359` |
| Cálculo das linhas do comparativo + diferença de peso | `src/app/pages/RecebimentoCarga.tsx:360-400` |
| Modal “Conclusão da conferência” (revisão obrigatória) | `src/app/pages/RecebimentoCarga.tsx:401-563` |
| Modal “Cancelar lote” | `src/app/pages/RecebimentoCarga.tsx:564-617` |
| Drawer “Novo recebimento” | `src/app/pages/RecebimentoCarga.tsx:618-847` |
| Cabeçalho e cartão de lote | `src/app/pages/RecebimentoCarga.tsx:848-1000` |
| Chips de Características | `src/app/pages/PesagemDestinacao.tsx:366,402-403,539-556` |
| Selo “pref. compatível” na sugestão | `src/app/pages/PesagemDestinacao.tsx:672` |
| Modal Etiqueta (pós-pesagem) | `src/app/pages/PesagemDestinacao.tsx:136-197` |
| Modal Cancelar/estornar destinação | `src/app/pages/PesagemDestinacao.tsx:198-262` |
| Modal Finalizar lote | `src/app/pages/PesagemDestinacao.tsx:263-359` |
| Troca de Peça — 6 passos, motivos, destinos | `src/app/components/TrocaPeca.tsx:79-97,104-183` |
| Status da etiqueta (5 rótulos + estilos) | `src/app/pages/EtiquetasRecebimento.tsx:13,151-174` |
| Preview da etiqueta | `src/app/pages/EtiquetasRecebimento.tsx:185-224` |
| Modal Reimprimir (inclui pendente) | `src/app/pages/EtiquetasRecebimento.tsx:227-296` |
| Modal Cancelar etiqueta | `src/app/pages/EtiquetasRecebimento.tsx:297-360` |
| Drawer de detalhe (regras `cancelavel`/`reimprimivel`) | `src/app/pages/EtiquetasRecebimento.tsx:361-400` |

## Decisões de design

**D6.1 — Troca de Peça é um serviço novo sobre tabelas existentes, não um módulo.**
`app/backend/src/modules/operacao/pesagem/troca-peca.service.ts` executa os 9 passos de v1.1 §6.13
dentro de **uma** `db.transaction`. Persistência: 1 linha em `trocas_peca` (nova) + 2 linhas em
`associacoes_peca_historico` (`acao='troca_saida'` na peça retirada, `acao='troca_entrada'` na
inserida). `pecas.peso_original` **nunca** é escrito pelo serviço — a troca altera destinação, não
pesagem (§6.13 “Regra confirmada”).

**D6.2 — Estado da etiqueta: domínio §10.4 no banco, rótulos do protótipo na tela.**
O protótipo mostra `Ativa | Reimpressa | Cancelada | Pendente de impressão | Bloqueada`
(`EtiquetasRecebimento.tsx:13`); a spec §10.4 define `emitida | ativa | invalidada por troca |
reimpressa | cancelada`. Persistimos §10.4 em `etiquetas_impressoes.estado` e derivamos os rótulos
do protótipo na tela, sem coluna redundante:

| Rótulo do protótipo | Derivação |
|---|---|
| Pendente de impressão | `estado='emitida' AND status_impressao='pendente'` |
| Ativa | `estado='ativa'` |
| Reimpressa | `estado='reimpressa'` |
| Cancelada | `estado='cancelada'` |
| Bloqueada | `estado IN ('ativa','reimpressa') AND pecas.status_peca IN ('em_transformacao','transformada')` ou peça em carga fechada |
| (sem rótulo próprio) | `estado='invalidada_por_troca'` → exibido como Cancelada com motivo “Troca de peça” |

**D6.3 — Estorno reusa `AssociacaoService`, com segregação de função.**
Novo método `AssociacaoService.estornar()` (não rota paralela): devolve `quantidade_atendida` ao
item do pedido, volta `status_peca` para `em_sobra`, grava `acao='estorno'` com motivo obrigatório
e cancela a etiqueta vigente — exatamente o texto do protótipo em `PesagemDestinacao.tsx:241`.
Exige a nova permissão `ASSOCIACAO_ESTORNAR` (doc 013, segregação: quem associa não estorna);
`ASSOCIACAO_GERENCIAR` sozinha não basta. Bloqueado com 409 se a peça já está em carga fechada.

**D6.4 — Características ficam em `pecas.captura_meta`; nenhuma coluna nova.**
A matriz sugeria `pecas.caracteristicasJson`, mas `captura_meta` (JSONB, já com
`idx_pecas_captura_meta_gin` em `pesagem.schema.ts:49`) já recebe as três flags pelo cliente atual
(`pesagem-destinacao-client.tsx:333-335`). Criar coluna nova seria duplicação.

**D6.5 — “pref. compatível” é selo, não peso de score.**
`calcularScores` ganha o campo booleano `prefCompativel` (característica da peça ∩ preferências do
cliente) **sem alterar o score nem a ordenação** — é assim que o protótipo usa
(`PesagemDestinacao.tsx:672`: badge). Nenhuma fonte define peso numérico para característica;
inventar um violaria o Princípio VIII.

**D6.6 — Acumuladores em tempo real por evento, não por polling (RA-04).**
`ConferenciaService.calcularQuadro` já é a fonte única dos acumuladores §6.10.3. A onda apenas
liga a tela aos eventos `PECA_PESADA`/`PECA_ASSOCIADA`/`PECA_REDIRECIONADA` já publicados e ao novo
`TROCA_PECA_EXECUTADA`. Nenhum total digitado vira fonte (§6.10.3, última frase).

**D6.7 — Um único evento novo.** `TROCA_PECA_EXECUTADA` (carrega `pecaRetiradaId`,
`pecaInseridaId`, `etiquetaInvalidada`, `novaEtiqueta`). Estorno reusa `PECA_REDIRECIONADA` —
semanticamente é redirecionamento para sobra; criar evento próprio seria ruído.

**D6.8 — Dívida (h): `marcarCabecalhoSemItens = (itensAtivos === 0)`.**
`nota-fiscal-fornecedor.persistence.ts:400` passa o literal `true` como terceiro argumento de
`mesclarPayloadNfCabecalho`, carimbando `cabecalho_sem_itens` em NF que **tem** itens. Passa a ser
calculado a partir da contagem de itens ativos.

**D6.9 — Dívida (c): renumeração de cabeçalho órfão passa a exigir confirmação explícita.**
`buscarCabecalhoParaCompletar` deixa de renumerar em silêncio: quando o número da NF informada
difere do cabeçalho órfão encontrado, `registrarNf` responde **409 `CABECALHO_ORFAO_DIVERGENTE`**
com os dois números. Com `confirmarSubstituicaoCabecalho: true` no DTO, completa e grava auditoria
`NF_CABECALHO_RENUMERADO`. Nada é apagado (RA-05/06).

**D6.10 — Dívida (d): `FOR UPDATE` no cabeçalho órfão.**
`buscarCabecalhoParaCompletar` passa a rodar dentro da transação de `completarCabecalhoComItensNaTx`
com `SELECT … FOR UPDATE`; o segundo `registrarNf` concorrente recebe 409 em vez de completar o
mesmo órfão (RA-02).

**D6.11 — Dívida (a): gate ACMR cobre também `*.persistence.ts`.**
`scripts/check-coverage-lib.mjs:20` tem um único pathspec
`':(glob)app/backend/src/**/*.service.ts'`. Ganha um **segundo** pathspec irmão
`':(glob)app/backend/src/**/*.persistence.ts'` — pathspec de git não expande `{a,b}`, então são
duas entradas, não uma chave. Consequência assumida nesta onda: escrever teste de regra de NF até
`nota-fiscal-fornecedor.persistence.ts` atingir ≥80% linha e branch.

**D6.12 — Dívidas (b)(e)(f) morrem junto com a tela que as consome.**
A tela de Recebimento de Carga passa a chamar `POST /pedidos-fornecedor/:id/nf` e
`/conferencia/concluir`; a rota BFF duplicada `app/api/operacao/recebimentos/[id]/nf/route.ts` é
**removida** (fica `[id]/nfe/route.ts`); `lib/operacao.ts:83` corrige `nfeVolumes` para
`number | null`, alinhado ao backend.

**D6.13 — Migration é expand puro, número 0021.**
`app/backend/src/database/migrations/0021_onda6_recebimento_balanca.sql`, gerada por
`npm run db:generate` (drizzle-kit) a partir do schema — nunca escrita à mão. Só cria tabela,
colunas, índices e recria dois CHECKs (operação reversível, registrada em `ROLLBACK.md`).
`chk_pecas_status` **não** muda: “em troca” é instantâneo dentro da transação e “estornada” é
`em_sobra`.

## Migration 0021 — conteúdo exato

1. `CREATE TABLE trocas_peca` — `id uuid pk default uuidv7()`, `recebimento_id`, `pedido_venda_id`,
   `pedido_venda_item_id`, `peca_retirada_id`, `peca_inserida_id`, `peso_retirada numeric(10,3)`,
   `peso_inserida numeric(10,3)`, `destino_retirada text` + CHECK `('estoque','desossa')`
   (`TrocaPeca.tsx:11`), `motivo text NOT NULL` (`TrocaPeca.tsx:79-86`),
   `etiqueta_invalidada_id`, `etiqueta_emitida_id`, `operador_id NOT NULL`, `created_at`.
   Índices: `idx_trocas_peca_recebimento`, `idx_trocas_peca_pedido`, `idx_trocas_peca_retirada`.
2. `ALTER TABLE etiquetas_impressoes` — `estado text NOT NULL DEFAULT 'emitida'`,
   `motivo_cancelamento text`, `invalidada_em timestamptz`, `invalidada_por_id uuid`,
   `troca_peca_id uuid`; CHECK `chk_etiq_estado` com os 5 valores de §10.4;
   `idx_etiq_estado`.
3. Backfill determinístico do `estado`: `reimpressao = true → 'reimpressa'`;
   `status_impressao = 'impressa' → 'ativa'`; demais → `'emitida'`.
4. Recriar `chk_assoc_hist_acao` (`pesagem.schema.ts:75-78`) incluindo
   `'estorno','troca_saida','troca_entrada'`.
5. Entrada correspondente em `app/backend/src/database/migrations/ROLLBACK.md`.

## Estrutura de arquivos

```
app/backend/src/
  database/schema/pesagem.schema.ts            ALTERAR  (trocas_peca, etiquetas.estado, chk acao)
  database/migrations/0021_onda6_recebimento_balanca.sql   NOVO (db:generate)
  database/migrations/ROLLBACK.md              ALTERAR
  common/rbac/permissoes.ts                    ALTERAR  (ASSOCIACAO_ESTORNAR)
  database/seeds/*                             ALTERAR  (permissão nos perfis conforme doc 013)
  realtime/events/eventos.ts                   ALTERAR  (TROCA_PECA_EXECUTADA)
  modules/operacao/pesagem/
    troca-peca.service.ts                      NOVO
    dto/troca-peca.dto.ts                      NOVO  (Zod)
    associacao.service.ts                      ALTERAR (estornar, prefCompativel)
    associacao-score.ts                        ALTERAR (prefCompativel)
    etiqueta.service.ts                        ALTERAR (ciclo de estado, invalidar, cancelar)
    pesagem.controller.ts                      ALTERAR (rotas troca/estorno/cancelar etiqueta)
  modules/operacao/recebimento/
    nota-fiscal-fornecedor.persistence.ts      ALTERAR (dívidas h, c, d)
    recebimento.service.ts                     ALTERAR (409 + auditoria NF_CABECALHO_RENUMERADO)
    dto/*.dto.ts                               ALTERAR (confirmarSubstituicaoCabecalho)
scripts/check-coverage-lib.mjs                 ALTERAR (dívida a)
app/frontend/src/
  lib/operacao.ts                              ALTERAR (nfeVolumes, tipos de troca/estorno)
  app/api/operacao/recebimentos/[id]/nf/route.ts   REMOVER (dívida e)
  app/api/operacao/pesagem/pecas/[id]/troca/route.ts     NOVO
  app/api/operacao/pesagem/pecas/[id]/estorno/route.ts   NOVO
  app/api/operacao/etiquetas/[id]/cancelar/route.ts      NOVO
  components/ui/troca-peca-modal.tsx           ALTERAR (ligar ao backend; hoje é casca da O2)
  app/(admin)/recebimento/recebimento-carga/recebimento-carga-client.tsx  ALTERAR
  app/(admin)/recebimento/pesagem-destinacao/pesagem-destinacao-client.tsx ALTERAR
  app/(admin)/recebimento/etiquetas/etiquetas-client.tsx                   ALTERAR
```

## Mapa DoD → teste (1:1)

Cada linha é um critério de pronto e o teste **único** que o prova. Portão 2 roda esta tabela.

| # | Critério | Teste (arquivo › nome) |
|---|---|---|
| 6.1 | Troca executa os 9 passos de §6.13 numa única transação | `app/backend/test/integration/troca-peca.e2e-spec.ts` › “executa os 9 passos da §6.13 em uma transação” |
| 6.2 | Peso original das duas peças preservado | mesmo arquivo › “preserva peso_original da peça retirada e da inserida” |
| 6.3 | Falha em qualquer passo desfaz tudo | mesmo arquivo › “falha ao emitir a nova etiqueta faz rollback total (trocas_peca vazia)” |
| 6.4 | Etiqueta anterior vira `invalidada_por_troca` e nova é emitida | mesmo arquivo › “invalida a etiqueta anterior e emite a nova” |
| 6.5 | Destino da peça retirada é estoque ou desossa, com motivo obrigatório | mesmo arquivo › “rejeita 422 sem motivo e com destino fora de estoque/desossa” |
| 6.6 | Troca exige `ASSOCIACAO_GERENCIAR` | mesmo arquivo › “403 para perfil sem ASSOCIACAO_GERENCIAR” |
| 6.7 | `TROCA_PECA_EXECUTADA` publicado só pós-commit | `app/backend/test/unit/pesagem-eventos.spec.ts` › “TROCA_PECA_EXECUTADA publicado após o commit” |
| 6.8 | Estorno devolve `quantidade_atendida` e volta a peça para `em_sobra` | `app/backend/test/integration/estorno-associacao.e2e-spec.ts` › “devolve quantidade_atendida e retorna a peça para em_sobra” |
| 6.9 | Estorno cancela a etiqueta vigente e grava motivo | mesmo arquivo › “cancela a etiqueta vigente com motivo do estorno” |
| 6.10 | Segregação: sem `ASSOCIACAO_ESTORNAR` → 403 | mesmo arquivo › “403 para perfil com ASSOCIACAO_GERENCIAR mas sem ASSOCIACAO_ESTORNAR” |
| 6.11 | Estorno bloqueado após carga fechada | mesmo arquivo › “409 quando a peça está em carga fechada” |
| 6.12 | Ciclo de estado da etiqueta §10.4 | `app/backend/test/integration/etiqueta.e2e-spec.ts` › “transições emitida → ativa → reimpressa → cancelada” |
| 6.13 | QR de etiqueta invalidada não resolve | mesmo arquivo › “resolverQr responde 409 para etiqueta invalidada_por_troca” |
| 6.14 | Acumuladores §6.10.3 vêm das pesagens, nunca de total digitado | `app/backend/test/integration/conferencia-tripla.e2e-spec.ts` › “quadro recalcula a cada peça pesada sem total digitado” |
| 6.15 | Conclusão do lote exige revisão e classifica com/sem divergência | mesmo arquivo › “concluir sem passar pela revisão responde 409” |
| 6.16 | `prefCompativel` é selo e não muda score nem ordem | `app/backend/test/unit/associacao-score.spec.ts` › “marca prefCompativel sem alterar score nem ordenação” |
| 6.17 | **Dívida (h)** `cabecalho_sem_itens` só quando não há itens | `app/backend/test/unit/nota-fiscal-fornecedor.persistence.spec.ts` › “cabecalho_sem_itens é true apenas com itensAtivos === 0” |
| 6.18 | **Dívida (c)** renumeração silenciosa eliminada | `app/backend/test/integration/recebimento.e2e-spec.ts` › “409 CABECALHO_ORFAO_DIVERGENTE sem confirmação explícita” |
| 6.19 | **Dívida (c)** substituição confirmada é auditada | mesmo arquivo › “confirmarSubstituicaoCabecalho grava auditoria NF_CABECALHO_RENUMERADO” |
| 6.20 | **Dívida (d)** dois `registrarNf` concorrentes não completam o mesmo órfão | `app/backend/test/integration/recebimento-concorrencia.e2e-spec.ts` › “registrarNf concorrente sobre cabeçalho órfão: um completa, outro recebe 409” |
| 6.21 | **Dívida (a)** gate ACMR inclui `*.persistence.ts` | `scripts/check-coverage.test.mjs` › “glob de cobertura por arquivo inclui persistence.ts” |
| 6.22 | **Dívida (a)** `nota-fiscal-fornecedor.persistence.ts` ≥80% linha e branch | `npm run test:cov` (o próprio gate ACMR falha abaixo do limiar) |
| 6.23 | **Dívida (b)** tela captura itens da NF e conclui a conferência | `app/frontend/e2e/onda6-recebimento.spec.ts` › “captura itens da NF e conclui a conferência pela tela” |
| 6.24 | **Dívida (e)** rota BFF duplicada removida | `app/frontend/__tests__/bff-onda6.test.ts` › “não existe rota app/api/operacao/recebimentos/[id]/nf” |
| 6.25 | **Dívida (f)** `nfeVolumes` tipado como `number \| null` | mesmo arquivo › “nfeVolumes é number|null e é renderizado no detalhe do lote” |
| 6.26 | Recebimento de Carga fiel: 7 status de lote, comparativo, conclusão obrigatória, entrada direta, cancelar lote, drawer novo recebimento | `app/frontend/__tests__/recebimento.test.tsx` › “Recebimento de Carga renderiza os blocos do protótipo” |
| 6.27 | Pesagem fiel: chips de características, selo pref. compatível, modal etiqueta, estorno | `app/frontend/__tests__/pesagem.test.tsx` › “Pesagem & Destinação renderiza os blocos do protótipo” |
| 6.28 | Troca de Peça: 6 passos ligados ao backend, resultado com etiqueta invalidada | `app/frontend/__tests__/troca-peca-modal.test.tsx` › “conclui os 6 passos e exibe o resultado do backend” |
| 6.29 | Etiquetas: 5 rótulos do protótipo derivados de §10.4, regras `cancelavel`/`reimprimivel` | `app/frontend/__tests__/etiquetas-recebimento.test.tsx` › “mapeia estado do domínio para os rótulos do protótipo” |
| 6.30 | Nenhum termo banido nas telas da onda; “Nome Fantasia”/“Buscar cliente” onde há cliente | `app/frontend/__tests__/terminologia.test.ts` › “rotas de recebimento sem termo banido” |
| 6.31 | Jornada E2E das 3 rotas com banco semeado, sem erro de console | `app/frontend/e2e/onda6-recebimento.spec.ts` › “percorre as 3 rotas de recebimento pelo menu” |

## Tasks

### Task 1 — Schema e migration 0021

**1.1** `pesagem.schema.ts`: adicionar `export const trocasPeca = pgTable('trocas_peca', …)` com os
campos e CHECKs da seção “Migration 0021”; adicionar as 5 colunas novas + `chk_etiq_estado` +
`idx_etiq_estado` em `etiquetasImpressoes`; recriar `chk_assoc_hist_acao` (`pesagem.schema.ts:75-78`)
com `'estorno','troca_saida','troca_entrada'`; declarar as relations de `trocasPeca`.
**1.2** `cd app/backend && npm run db:generate` → confere que o arquivo gerado é
`0021_onda6_recebimento_balanca.sql`. Acrescentar à mão **apenas** o `UPDATE` de backfill do item 3.
**1.3** Registrar o par expand/rollback em `ROLLBACK.md` no formato já usado pelas migrations 0016–0020.
**Commit:** `feat(onda6): schema de troca de peça e ciclo de estado da etiqueta`

### Task 2 — Permissão, seed e evento

**2.1** `common/rbac/permissoes.ts`: `ASSOCIACAO_ESTORNAR` (D6.3), no mesmo formato de
`ASSOCIACAO_GERENCIAR`.
**2.2** Seed RBAC: conceder a nova permissão apenas aos perfis que doc 013 autoriza a reverter
destinação; **não** conceder a quem já tem `PESAGEM_GERENCIAR` isolada — é a segregação exigida.
**2.3** `realtime/events/eventos.ts`: `TROCA_PECA_EXECUTADA` (D6.7), seguindo o formato de
`PECA_REDIRECIONADA`.
**Commit:** `feat(onda6): permissão de estorno e evento de troca de peça`

### Task 3 — `TrocaPecaService`

**3.1** `dto/troca-peca.dto.ts` (Zod): `pedidoVendaItemId`, `pecaInseridaId`, `destinoRetirada`
(`'estoque' | 'desossa'`), `pedidoDestinoRetiradaId?`, `motivo` (enum de `TrocaPeca.tsx:79-86`,
obrigatório).
**3.2** `troca-peca.service.ts`: método `executar(pecaRetiradaId, dto, operadorId)` em **uma**
transação, na ordem de §6.13 — validar associação vigente → validar peça nova compatível e sem
destino → desassociar antiga → destinar antiga → associar nova → invalidar etiqueta antiga
(`estado='invalidada_por_troca'`, `invalidada_em`, `invalidada_por_id`, `troca_peca_id`) → emitir
nova via `EtiquetaService` → gravar `trocas_peca` + 2 linhas de histórico → publicar
`TROCA_PECA_EXECUTADA` pós-commit. Nenhum `UPDATE` em `pecas.peso_original`.
**3.3** `pesagem.controller.ts`: `POST /pesagem/pecas/:id/troca`, guard `ASSOCIACAO_GERENCIAR`.
**3.4** `test/integration/troca-peca.e2e-spec.ts` cobrindo 6.1–6.6;
`test/unit/pesagem-eventos.spec.ts` estendido para 6.7.
**Commit:** `feat(onda6): troca de peça atômica preservando pesos`

### Task 4 — Estorno de associação

**4.1** `associacao.service.ts`: `estornar(pecaId, dto, operadorId)` conforme D6.3, transacional,
com auditoria e cancelamento da etiqueta (`estado='cancelada'`, `motivo_cancelamento`).
**4.2** `pesagem.controller.ts`: `POST /pesagem/pecas/:id/estorno`, guard `ASSOCIACAO_ESTORNAR`.
**4.3** `test/integration/estorno-associacao.e2e-spec.ts` cobrindo 6.8–6.11.
**Commit:** `feat(onda6): estorno auditado de associação com segregação de função`

### Task 5 — Ciclo de estado da etiqueta

**5.1** `etiqueta.service.ts`: `emitir` grava `estado='emitida'` e promove para `'ativa'` quando o
gateway confirma impressão; `reimprimir` grava `'reimpressa'`; novos `invalidarPorTroca` (usado pela
Task 3) e `cancelar(etiquetaId, motivo, operadorId)`; `resolverQr` responde 409 para
`invalidada_por_troca` ou `cancelada`.
**5.2** `pesagem.controller.ts`: `POST /etiquetas/:id/cancelar`, guard `ETIQUETA_GERENCIAR`.
**5.3** Estender `test/integration/etiqueta.e2e-spec.ts` para 6.12–6.13.
**Commit:** `feat(onda6): ciclo de estado da etiqueta conforme v1.1 §10.4`

### Task 6 — Dívidas (h), (c), (d) de NF

**6.1** (h) `nota-fiscal-fornecedor.persistence.ts:400`: substituir o literal `true` da chamada
`mesclarPayloadNfCabecalho(null, campos, true)` por `itensAtivos === 0` (D6.8).
**6.2** (c) `buscarCabecalhoParaCompletar` retorna o cabeçalho encontrado **e** a divergência de
número; `recebimento.service.ts` lança 409 `CABECALHO_ORFAO_DIVERGENTE` salvo
`confirmarSubstituicaoCabecalho: true` no DTO, caso em que grava auditoria
`NF_CABECALHO_RENUMERADO` (D6.9).
**6.3** (d) mover o `buscarCabecalhoParaCompletar` para dentro da transação de
`completarCabecalhoComItensNaTx` com `SELECT … FOR UPDATE` (D6.10).
**6.4** Testes 6.17–6.20 nos arquivos já existentes citados no mapa.
**Commit:** `fix(onda6): quita dívidas h/c/d de NF do fornecedor da Onda 1`

### Task 7 — Dívida (a): gate ACMR e cobertura da persistência de NF

**7.1** `scripts/check-coverage-lib.mjs:20`: acrescentar o pathspec
`':(glob)app/backend/src/**/*.persistence.ts'` logo abaixo do de `*.service.ts` (D6.11).
**7.2** `scripts/check-coverage.test.mjs`: caso 6.21.
**7.3** Completar `test/unit/nota-fiscal-fornecedor.persistence.spec.ts` até o arquivo passar o
próprio gate (6.22).
**Commit:** `test(onda6): estende gate ACMR e cobre a persistência de NF`

### Task 8 — BFF e contratos

**8.1** Criar as 3 rotas BFF listadas na estrutura de arquivos, no mesmo formato das rotas de
`app/api/operacao/pesagem/` já existentes (repasse do JWT, tradução de erro, sem regra).
**8.2** Remover `app/api/operacao/recebimentos/[id]/nf/route.ts` (dívida e).
**8.3** `lib/operacao.ts`: `nfeVolumes: number | null` (dívida f) e tipos
`ResultadoTrocaPeca`/`EstornoPayload` alinhados ao backend.
**8.4** `__tests__/bff-onda6.test.ts` cobrindo 6.24–6.25, no formato de `bff-onda5.test.ts`.
**Commit:** `feat(onda6): rotas BFF de troca, estorno e cancelamento de etiqueta`

### Task 9 — Tela Recebimento de Carga

**9.1** `recebimento-carga-client.tsx`: captura dos itens da NF (`RecebimentoCarga.tsx:124-135`),
comparativo Pedido × NF × Pesagem com as colunas de §6.10.4 e o cálculo de
`RecebimentoCarga.tsx:360-400`, atualização por evento (D6.6), modais de pesagens (283-327),
entrada direta (328-359), conclusão obrigatória (401-563) e cancelar lote (564-617), drawer de novo
recebimento (618-847), badges dos 7 status (227-253). Consome `POST /pedidos-fornecedor/:id/nf` e
`/conferencia/concluir` — dívida (b).
**9.2** Confirmação da renumeração de cabeçalho (D6.9) no fluxo de informar NF.
**9.3** `__tests__/recebimento.test.tsx` estendido para 6.26.
**Commit:** `feat(onda6): tela de recebimento de carga fiel ao protótipo`

### Task 10 — Tela Pesagem & Destinação e Troca de Peça

**10.1** `pesagem-destinacao-client.tsx`: chips de características gravando em `captura_meta`
(D6.4), selo “pref. compatível” a partir de `prefCompativel` (D6.5), modal de etiqueta
(`PesagemDestinacao.tsx:136-197`), modal de cancelamento/estorno com o texto de
`PesagemDestinacao.tsx:198-262` chamando a rota de estorno, modal finalizar (263-359).
**10.2** `associacao-score.ts` + `associacao.service.ts`: expor `prefCompativel` (teste 6.16).
**10.3** `components/ui/troca-peca-modal.tsx`: preencher os 6 passos (`TrocaPeca.tsx:104-183`) e
chamar a rota de troca; `resultado` deixa de ser mock e passa a vir do backend.
**10.4** `__tests__/pesagem.test.tsx` (6.27) e `__tests__/troca-peca-modal.test.tsx` (6.28).
**Commit:** `feat(onda6): pesagem, destinação e troca de peça ligadas ao backend`

### Task 11 — Tela Etiquetas

**11.1** `etiquetas-client.tsx`: derivar os 5 rótulos conforme a tabela de D6.2, estilos de
`EtiquetasRecebimento.tsx:151-184`, preview (185-224), modais de reimpressão (227-296) e
cancelamento (297-360), drawer com as regras `cancelavel`/`reimprimivel` (`:366-367`).
**11.2** `__tests__/etiquetas-recebimento.test.tsx` para 6.29.
**Commit:** `feat(onda6): tela de etiquetas com os estados do protótipo`

### Task 12 — E2E, terminologia, evidências e gate local

**12.1** `app/frontend/e2e/onda6-recebimento.spec.ts` (6.23 e 6.31), no formato de
`e2e/onda5-gestao.spec.ts`.
**12.2** Estender `__tests__/terminologia.test.ts` para varrer
`src/app/(admin)/recebimento/**` e `src/components/recebimento/**` (6.30).
**12.3** Evidências em `docs/evidencias/onda6-recebimento/`: `01-recebimento-carga.png`,
`02-pesagem-destinacao.png`, `03-etiquetas.png`, `04-conclusao-conferencia.png`,
`05-troca-peca-resultado.png`, `06-etiqueta-invalidada.png` e `index.html` no formato de
`docs/evidencias/alpha-jornada-e2e/`. Capturas do app real com banco semeado — **proibido** print
do protótipo.
**12.4** README de evidências com comandos, resultados, cobertura, SHAs e caminhos. O Worker entrega
o pacote ao Executor e **não** edita `docs/execucao/EXECUCAO-STATUS.md` nem este plano.
**12.5** Gate local completo, na raiz do repositório — idêntico ao CI:

```bash
npm ci
npm run lint
npm run type-check
cd app/backend && npm run db:migrate && npm run db:seed && npm run test:cov
cd ../frontend && npm run test && npx playwright test
cd ../.. && npm run build
npm audit --omit=dev --audit-level=high   # AD-08
```

Aprovação: lint e type-check limpos; cobertura de linha **e** branch ≥ 80% (incluindo o novo glob
da Task 7); todos os testes verdes; build sem erro; audit sem high/critical em produção.
**Commit:** `test(onda6): e2e de recebimento, terminologia e evidências`

## Ordem de execução

```
Task 1 (schema + migration)
  ├─ Task 2 (permissão + evento)
  │    ├─ Task 3 (troca) ─┐
  │    ├─ Task 4 (estorno)┤
  │    └─ Task 5 (etiqueta)┘→ Task 8 (BFF) → Task 10, Task 11
  ├─ Task 6 (dívidas h/c/d) → Task 9
  └─ Task 7 (dívida a — independente)
Task 9, 10, 11 → Task 12 (E2E + gate)
```

## Dívidas deixadas por esta onda

Nenhuma nova. As 7 herdadas da Onda 1 (decisão 28) são quitadas nas linhas 6.17–6.25 do mapa
DoD→teste. Qualquer dívida descoberta durante a implementação exige nova atuação do Planner —
o Worker não edita esta seção.

## Fora de escopo (por onda de destino)

Desossa/transformação (§6.14) → **O7**; ajuste de estoque → **O8**; bipagem de expedição → **O9**;
NFS-e → **O10**. Nenhum arquivo desses domínios é tocado aqui.

## Autorrevisão do plano

- Princípio I — 21 blocos do protótipo referenciados com arquivo e linha; D6.2 resolve o único
  conflito protótipo × spec sem inventar rótulo.
- Princípio II — as 3 rotas entram completas: backend transacional, BFF, tela, teste e evidência.
- Princípio III (RA-01) — troca, estorno, renumeração de cabeçalho e acumuladores decidem no
  backend; o BFF só repassa.
- Princípio IV (RA-02) — Tasks 3, 4 e 6.3 são transacionais e auditadas.
- Princípio VII (RA-05/06) — D6.9 troca renumeração silenciosa por 409 + auditoria; nenhum dado
  apagado.
- Princípio VIII — D6.5 recusa inventar peso de característica.
- Ponytail — zero módulo novo: 1 serviço, 1 tabela, 5 colunas, 1 permissão, 1 evento, 3 rotas BFF;
  todo o resto é alteração de arquivo existente.

## Contagens

- **Tasks:** 12
- **Decisões (D6.x):** 13
- **Critérios DoD → teste:** 31 (7 deles = dívidas herdadas da Onda 1)
- **Migration:** 1 (`0021_onda6_recebimento_balanca.sql`)
- **Rotas do protótipo cobertas:** 3/3
