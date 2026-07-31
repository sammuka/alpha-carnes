# Onda 6 — Recebimento & Balança

**Base:** `origin/develop` @ `1de895a` (O4+O5 mergeadas) · **Branch de implementação:** `feature/onda6-recebimento-balanca`
**Branch deste plano:** `feature/onda6-plano-recebimento` · **PR draft:** [#44](https://github.com/sammuka/alpha-carnes/pull/44)
**Escopo (roadmap §8):** recebimento v1.1 §6.10, pesagem §6.11–6.12, Troca de Peça atômica §6.13,
etiquetas §6.15/§10.4, UI fiel às 3 telas de recebimento/balança do protótipo.
**Herança obrigatória:** as 7 dívidas NF/Recebimento da Onda 1 redirecionadas pela decisão 28 do
plano da Onda 2 (`docs/superpowers/plans/2026-07-25-onda2-shell-ds.md:119-132`) entram no mapa
DoD→teste desta onda.

## Emenda 1 — resposta ao Portão 1 `ajustar` (veredito `0d3d209`)

O Monitor aprovou o mérito de escopo e reprovou a autossuficiência. Esta emenda fecha os oito
bloqueantes numerados e os dois ajustes menores. Nada de escopo novo foi acrescentado: as
alterações são de **densidade** (código literal), de **proveniência de migration** e de
**reconciliação de nomes com a matriz**.

| # | Bloqueante do veredito | Onde está fechado nesta emenda |
|---|---|---|
| 1 | Tasks 1–11 eram descrição, não código copiável (2 blocos em 422 linhas contra 118/O4 e 120/O5) | Tasks 1–11 reescritas com o `pgTable('trocas_peca')`, as 4 colunas + `chk_etiq_estado` + `chk_etiq_cancelada_motivo` de `etiquetas_impressoes`, o `chk_assoc_hist_acao` recriado, os 4 DTOs Zod, o corpo de `TrocaPecaService.executar()`, o de `AssociacaoService.estornar()`, os métodos novos de `EtiquetaService`, os handlers dos 2 controllers, os 4 handlers BFF, o JSX dos modais e o SQL do backfill |
| 2 | Migration violava D36/Princípio X (`UPDATE` à mão dentro do SQL gerado) | **D6.13** reescrita: `0021` é expand estrutural puro gerado por `npm run db:generate -- --name=onda6_recebimento_balanca_expand`; `0022` é invólucro criado por `npm run db:generate -- --custom --name=onda6_etiqueta_estado_backfill` e é o **único** arquivo que recebe DML. Journal 21–22, snapshots gerados, drift zero, provas em DoD 6.34–6.36 |
| 3 | Faltava `GET /operacao/etiquetas?filtros` (matriz linha 16), BFF e campos `estado`/`status_impressao`/`motivo_cancelamento` + bloqueio D6.2 | **D6.15**: `EtiquetaController` novo em `@Controller('operacao/etiquetas')` com `GET /` e `POST /:id/cancelar`; `EtiquetaService.listar()` devolve os campos e o booleano `bloqueada` calculado; BFF `app/api/operacao/etiquetas/route.ts`. DoD 6.32/6.33 |
| 4 | Nomes divergentes da matriz sem reconciliação | **D6.7** revisada + **D6.16**: adotados `PECA_TROCADA`, `PESAGEM_ESTORNADA`, `ETIQUETA_INVALIDADA`, `POST /operacao/pesagem/trocas` e `POST /operacao/pesagem/pecas/:id/estornar`. Tabela de reconciliação matriz→plano com uma linha por nome, sem silêncio |
| 5 | Paths ambíguos entre `@Controller('operacao/pesagem')` e BFF `api/operacao/etiquetas/...` | Tabela “Contrato de rotas — path literal” fixa os seis paths finais, o controller de cada um e o arquivo BFF correspondente |
| 6 | Task 2.2 delegava decisão de RBAC ao Worker | **D6.19**: tabela nominal dos 11 perfis com quem recebe e quem **não** recebe `ASSOCIACAO_ESTORNAR`, ancorada em doc 013 §2.5/§3.3/§4.3, mais o trecho literal de `permissoes.ts` |
| 7 | DoD 6.22 apontava `npm run test:cov`, não um teste 1:1 | **D6.20**: 6.22 passa a nomear cinco casos de `test/unit/nota-fiscal-fornecedor.persistence.spec.ts`; o gate ACMR continua como consequência, não como prova |
| 8 | Dívida (f) fixava `number \| null` sem provar o contrato | **D6.14**: o backend **hoje** omite a chave (`recebimento.service.ts:285` faz spread condicional), logo o contrato real é `number \| undefined`. A onda normaliza o backend para `?? null` e só então o tipo `number \| null` passa a ser verdadeiro. DoD 6.38 prova os dois lados |
| menor | Âncora da dívida (h) — o veredito diz que `:400` deveria ser `:399` | **Reverificado na base e mantido `:400`.** `git show 1de895a:app/backend/src/modules/operacao/recebimento/nota-fiscal-fornecedor.persistence.ts \| sed -n '399,400p'` devolve `399` = linha em branco e `400` = `const payloadJson = mesclarPayloadNfCabecalho(null, campos, true);`. O que **de fato** faltava é que há **duas** ocorrências do literal `true`, não uma: `:379` (terceiro argumento da chamada que abre em `:376`, caminho de PATCH de cabeçalho) e `:400` (caminho de INSERT). D6.8 e a Task 8.1 agora citam as duas, com o trecho copiado de cada uma |
| menor | `__tests__/troca-peca-modal.test.tsx` já existe | Todas as citações a esse arquivo dizem **estender**; a coluna “Ação” da tabela de testes diz NOVO ou ESTENDER para cada um dos 19 arquivos |

### Renumeração dos critérios das 7 dívidas

O veredito conferiu o mapa das dívidas na numeração anterior. A emenda inseriu critérios novos
(6.32–6.36 para etiquetas e migrations), então as dívidas (b), (e) e (f) deslocaram. Mapa atual:

| Dívida da Onda 1 (decisão 28) | Critério antes | Critério agora |
|---|---|---|
| (h) `cabecalho_sem_itens` incondicional | 6.17 | **6.17** (igual) |
| (c) renumeração silenciosa de cabeçalho órfão | 6.18 / 6.19 | **6.18 / 6.19** (igual) |
| (d) corrida entre dois `registrarNf` | 6.20 | **6.20** (igual) |
| (a) gate ACMR não alcança `*.persistence.ts` | 6.21 / 6.22 | **6.21 / 6.22** (igual) |
| (b) tela não captura itens da NF | 6.23 | **6.23** (igual) |
| (e) rota BFF duplicada de NF | 6.24 | **6.24** (igual) |
| (f) contrato de `nfeVolumes` | 6.25 | **6.38 (backend) + 6.39 (tela)** — separados para manter 1:1 |

## Emenda 2 — resposta ao Portão 1 `ajustar` (veredito `abd7039`)

Os oito bloqueantes da emenda 1 foram confirmados fechados pelo Monitor por leitura e execução; o
veredito `ajustar` desta rodada aponta dois defeitos introduzidos pelo próprio código literal que a
emenda 1 tornou copiável, mais cinco achados menores. Nenhum escopo novo.

| # | Bloqueante do veredito | Onde está fechado nesta emenda |
|---|---|---|
| A | `EtiquetaService.listar()` (Task 6.3) filtrava por `estado` no mesmo `WHERE` cujo resultado `agruparPorPeca` interpreta como "primeira linha = vigente, demais = histórico" — uma peça cuja vigente é `cancelada` mas que tem uma linha `ativa` anterior aparecia como vigente `ativa` sob `?estado=ativa`, e o histórico devolvido ficava truncado ao estado filtrado, contradizendo a precedência de D6.2 | Task 6.3 reescrita: o filtro de `estado` sai do `WHERE` de linhas — que continua sempre buscando o histórico completo por peça — e passa a avaliar a vigente **depois** de `agruparPorPeca` determinar qual linha é a vigente de cada peça. DoD 6.32 ganha a asserção nomeada do caso |
| B | DoD 6.22 nomeava `montarPatchCabecalhoUi` e `extrairPayloadNfUi`, que hoje não são exportados de `nota-fiscal-fornecedor.persistence.ts`; a primeira só tem chamador dentro de `persistirNfCabecalhoUiNaTx` (função transacional), inalcançável por `test/unit` sem banco, e o parâmetro `extras` da segunda nunca é passado por nenhum chamador real | Task 8 ganha o passo **8.5**: as duas funções recebem `export`, no mesmo precedente das quatro puras já exportadas no arquivo (`temCamposNfEstruturados`, `mesclarPayloadNfCabecalho`, `mesclarPayloadNfCompleta`, `mapearCamposNfParaRegistrar`). Task 9.3 atualizada — os cinco casos de 6.22 importam as duas diretamente, sem passar por função transacional |
| menor | `EtiquetaListada.codigo` lia `pecas.etiquetaAtual` — o código **atual** da peça, não o da etiqueta daquela linha; `etiquetas_impressoes` não tem coluna de código (só `payload`), então uma linha cancelada/invalidada exibiria o código da etiqueta nova | Task 6.3: `codigo` passa a vir de `payload->>'qr'`, o mesmo campo gravado por `emitir`/`reimprimir`/`emitirNaTx`/`troca-peca.service.ts` |
| menor | D6.13 descrevia o conteúdo esperado de `0021` como "15 colunas, 4 CHECKs e 5 FKs", mas a Task 1.1 declara 8 `.references()` (recebimento, pedido, item, 2 peças, 2 etiquetas, operador) | D6.13 corrigida para "8 FKs" — contagem batida com o `pgTable('trocas_peca')` literal da Task 1.1 |
| menor | Task 4.3 chamava `this.etiqueta.imprimirPayload(...)` antes da transação, mas as checagens sob lock (peça já associada, item comercial divergente, carga fechada) só rodam dentro dela — um 409 deixava etiqueta física impressa sem fato de negócio | A chamada de impressão move para **dentro** da transação, logo após as três checagens sob lock e antes das mutações (passos 3–9) — nenhum 409 acima imprime fisicamente |
| menor | `agruparPorPeca` e `paginarEmMemoria` eram citadas como "funções puras no mesmo arquivo" sem corpo literal; `paginarEmMemoria` não existe hoje em `common/crud/paginacao.ts` (que só tem `montarPaginado`) | Task 6.3 ganha os dois corpos literais, reusando `montarPaginado`/`Paginado<T>` já existentes |
| menor | Na tela de Etiquetas, "Preview da etiqueta" (`EtiquetasRecebimento.tsx:185-224`) e "Modal Reimprimir (inclui pendente)" (`:227-296`) estão no bloco a reproduzir, mas não apareciam na Task 11.2 nem em critério algum | Task 11.2 ganha o preview no drawer e o modal Reimprimir, ligado à rota BFF **já existente** `POST /api/operacao/pesagem/pecas/:id/etiqueta/reimprimir` — nenhum endpoint novo. DoD 6.29 alinhada à fórmula "renderiza os blocos do protótipo" de 6.26/6.27 |

## Goal

Fechar as três rotas de recebimento/balança com backend transacional, UI idêntica ao protótipo e
as 7 dívidas de NF quitadas — sem criar módulo paralelo: **tudo é alteração dos artefatos que já
existem em `develop`** (`modules/operacao/recebimento`, `modules/operacao/pesagem`,
`app/(admin)/recebimento/*`). O único artefato novo de backend é `troca-peca.service.ts` mais o
`EtiquetaController` exigido pela matriz linha 16.

## Rotas da onda (matriz de rastreabilidade v1.1)

| Rota | Tela real | Protótipo |
|---|---|---|
| `/recebimento/recebimento-carga` | `app/frontend/src/app/(admin)/recebimento/recebimento-carga/recebimento-carga-client.tsx` | `src/app/pages/RecebimentoCarga.tsx` |
| `/recebimento/pesagem-destinacao` | `app/frontend/src/app/(admin)/recebimento/pesagem-destinacao/pesagem-destinacao-client.tsx` | `src/app/pages/PesagemDestinacao.tsx` |
| `/recebimento/etiquetas` | `app/frontend/src/app/(admin)/recebimento/etiquetas/etiquetas-client.tsx` | `src/app/pages/EtiquetasRecebimento.tsx` |

## Reconciliação matriz → plano (bloqueante 4)

A matriz (`docs/superpowers/plans/2026-07-22-matriz-rastreabilidade-v1.1.md`, linhas 14/15/16) é
contrato. Cada nome que ela cita tem aqui uma linha explícita: **adotado** ou **decisão** com
justificativa. Nenhum nome fica sem resposta.

| Nome na matriz | Linha | Resolução | Onde |
|---|---|---|---|
| `POST /operacao/pesagem/trocas` | 15 | **Adotado literalmente.** O `pecaRetiradaId` viaja no corpo, não no path | Task 4.3 |
| `POST /pecas/:id/estornar` | 15 | **Adotado literalmente** como `POST /operacao/pesagem/pecas/:id/estornar` (o prefixo é o `@Controller('operacao/pesagem')` que já existe em `pesagem.controller.ts:23`) | Task 5.2 |
| `GET /recebimentos/:id/acumuladores` | 15 | **D6.17 — não é criado.** `GET /operacao/recebimentos/:id/conferencia` (`recebimento.controller.ts:128`) já devolve o quadro de acumuladores §6.10.3 calculado por `ConferenciaService.calcularQuadro`, que é a mesma leitura pedida pela linha 15. Criar um segundo endpoint com outro nome para o mesmo dado seria duplicação | D6.17 |
| `GET /operacao/etiquetas?filtros` | 16 | **Adotado literalmente.** Controller novo `EtiquetaController` (`@Controller('operacao/etiquetas')`) | Task 6.3 |
| `POST /etiquetas/:id/cancelar` | 16 | **Adotado literalmente** como `POST /operacao/etiquetas/:id/cancelar`, no mesmo controller — o que resolve a ambiguidade apontada no bloqueante 5 | Task 6.4 |
| evento `PECA_TROCADA` | 15 | **Adotado.** Substitui o `TROCA_PECA_EXECUTADA` da versão anterior do plano | Task 3.3 |
| evento `PESAGEM_ESTORNADA` | 15 | **Adotado.** A versão anterior reusava `PECA_REDIRECIONADA`; o Monitor tem razão — estorno e redirecionamento são fatos distintos para quem consome o barramento | Task 3.3 |
| evento `ETIQUETA_INVALIDADA` | 16 | **Adotado.** Emitido tanto na invalidação por troca quanto no cancelamento, com `motivo` no payload | Task 3.3 |
| `pecas.caracteristicasJson` | 15 | **D6.4 — não é criada.** As três flags já são gravadas em `pecas.captura_meta` (JSONB com `idx_pecas_captura_meta_gin`, `pesagem.schema.ts:49`) pelo cliente atual (`pesagem-destinacao-client.tsx:333-335`) | D6.4 |
| `trocas_peca` (nova) | 15 | **Adotada.** Tabela criada na migration `0021` | Task 1.1 |
| `etiquetas_impressoes` (ampliar estados) | 16 | **Adotado.** 4 colunas novas + 2 CHECKs + 1 índice | Task 1.2 |

## Contrato de rotas — path literal (bloqueante 5)

| Método e path final | Controller (arquivo:decorator) | Permissão | BFF |
|---|---|---|---|
| `POST /operacao/pesagem/trocas` | `pesagem.controller.ts` › `@Controller('operacao/pesagem')` + `@Post('trocas')` | `ASSOCIACAO_GERENCIAR` | `app/api/operacao/pesagem/trocas/route.ts` |
| `POST /operacao/pesagem/pecas/:id/estornar` | `pesagem.controller.ts` › `@Post('pecas/:id/estornar')` | `ASSOCIACAO_ESTORNAR` | `app/api/operacao/pesagem/pecas/[id]/estornar/route.ts` |
| `GET /operacao/etiquetas` | `etiqueta.controller.ts` (NOVO) › `@Controller('operacao/etiquetas')` + `@Get()` | `PESAGEM_LER` | `app/api/operacao/etiquetas/route.ts` |
| `POST /operacao/etiquetas/:id/cancelar` | `etiqueta.controller.ts` › `@Post(':id/cancelar')` | `ETIQUETA_GERENCIAR` | `app/api/operacao/etiquetas/[id]/cancelar/route.ts` |
| `POST /operacao/pesagem/pecas/:id/etiqueta` | `pesagem.controller.ts:105` (existe, inalterado) | `ETIQUETA_GERENCIAR` | `app/api/operacao/pesagem/pecas/[id]/etiqueta/route.ts` (existe) |
| `GET /operacao/recebimentos/:id/conferencia` | `recebimento.controller.ts:128` (existe, inalterado) | `RECEBIMENTO_LER` | `app/api/operacao/recebimentos/[id]/conferencia/route.ts` (existe) |

`EtiquetaController` mora em `app/backend/src/modules/operacao/pesagem/etiqueta.controller.ts` e é
registrado no `PesagemModule` — mesmo módulo, controller próprio, porque o prefixo `operacao/etiquetas`
não cabe sob `@Controller('operacao/pesagem')` sem inventar um path que a matriz não pediu.

## Referências do protótipo (`F:\Projetos\alpha-carnes-prototipo` @ `feature/completude-v1.1` `8d32aa4c`)

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
| Pendente de impressão | `estado='emitida' AND status_impressao IN ('pendente','falha_impressao')` |
| Ativa | `estado='ativa'` |
| Reimpressa | `estado='reimpressa'` |
| Cancelada | `estado='cancelada'` |
| Bloqueada | `estado IN ('ativa','reimpressa') AND bloqueada = true` (regra em D6.18) |
| (sem rótulo próprio) | `estado='invalidada_por_troca'` → exibido como Cancelada com motivo “Troca de peça” |

Precedência na tela: **Bloqueada vence Ativa/Reimpressa**; `cancelada` e `invalidada_por_troca` são
terminais e nunca viram Bloqueada.

**D6.3 — Estorno reusa `AssociacaoService`, com segregação de função.**
Novo método `AssociacaoService.estornar()` (não rota paralela): devolve `quantidade_atendida` ao
item do pedido, volta `status_peca` para `em_sobra`, grava `acao='estorno'` com motivo obrigatório
e cancela a etiqueta vigente — exatamente o texto do protótipo em `PesagemDestinacao.tsx:241`.
Exige a nova permissão `ASSOCIACAO_ESTORNAR` (nominal em D6.19); `ASSOCIACAO_GERENCIAR` sozinha não
basta. Bloqueado com 409 se a peça já está em carga fechada (mesma regra de D6.18).

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
liga a tela aos eventos `PECA_PESADA`/`PECA_ASSOCIADA`/`PECA_REDIRECIONADA` já publicados e aos
novos `PECA_TROCADA`/`PESAGEM_ESTORNADA`. Nenhum total digitado vira fonte (§6.10.3, última frase).

**D6.7 — Três eventos novos, com os nomes da matriz (revoga a versão anterior).**
`PECA_TROCADA`, `PESAGEM_ESTORNADA` e `ETIQUETA_INVALIDADA`. A versão anterior deste plano criava
um único `TROCA_PECA_EXECUTADA` e reusava `PECA_REDIRECIONADA` para estorno; o Portão 1 rejeitou —
com razão, porque quem consome o barramento não consegue distinguir “peça foi para outro pedido”
de “a destinação foi desfeita”. Os três nomes da matriz são adotados sem alteração.

**D6.8 — Dívida (h): `marcarCabecalhoSemItens = (itensAtivos === 0)`.**
`nota-fiscal-fornecedor.persistence.ts:379` e `:400` passam o literal `true` como terceiro
argumento de `mesclarPayloadNfCabecalho`, carimbando `cabecalho_sem_itens` em NF que **tem** itens.
No caminho de PATCH (`:379`) passa a ser calculado a partir da contagem de itens ativos; no de
INSERT (`:400`) continua verdadeiro, porque o cabeçalho nasce sem item, mas com o porquê escrito.

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

**D6.12 — Dívidas (b)(e) morrem junto com a tela que as consome.**
A tela de Recebimento de Carga passa a chamar `POST /pedidos-fornecedor/:id/nf` e
`/conferencia/concluir`; a rota BFF duplicada `app/api/operacao/recebimentos/[id]/nf/route.ts` é
**removida** (fica `[id]/nfe/route.ts`).

**D6.13 — Cadeia de migrations em dois estágios gerados, conforme o precedente D36 da Onda 4.**
A versão anterior deste plano mandava “acrescentar à mão” o `UPDATE` de backfill dentro do `0021`
gerado. Isso viola o Princípio X (`docs/governance/constituicao.md:54`) e o precedente D36
(`docs/superpowers/plans/2026-07-26-onda4-comercial.md:831-885`), que nasceu justamente de um
Portão 2 `ajustar`. Substituída por:

1. **Expand estrutural** — o schema declara `trocasPeca`, as 4 colunas de `etiquetasImpressoes`,
   os CHECKs e os índices; `npm run db:generate -- --name=onda6_recebimento_balanca_expand` deve
   criar **exatamente** `0021_onda6_recebimento_balanca_expand.sql`, `meta/0021_snapshot.json` e a
   entrada 21. O arquivo contém só DDL e **nenhum** `UPDATE`.
2. **Backfill custom** — sem tocar no schema,
   `npm run db:generate -- --custom --name=onda6_etiqueta_estado_backfill` cria
   `0022_onda6_etiqueta_estado_backfill.sql`, `meta/0022_snapshot.json` e a entrada 22. **Só esse
   SQL recebe edição humana**, limitada a `UPDATE`, `DO`/`RAISE EXCEPTION`, comentário e
   `--> statement-breakpoint`; nada de `CREATE`, `ALTER`, `DROP` ou `TRUNCATE`.

Não há estágio de contract: a onda é puramente aditiva — nenhuma coluna é removida.
`chk_pecas_status` **não** muda: “em troca” é instantâneo dentro da transação e “estornada” é
`em_sobra`. É proibido renomear migration gerada, editar `meta/_journal.json`, editar qualquer
`*_snapshot.json`, copiar snapshot anterior ou trocar `id`/`prevId`. Se o DDL sair errado, volta-se
ao estado `0020`, corrige-se o schema e regenera-se a cadeia inteira.

**D6.14 — Dívida (f): o contrato de `nfeVolumes` é `number | null` só depois de o backend parar de omitir a chave.**
O Monitor pediu prova e a prova contradiz a versão anterior do plano. Hoje:

- `dto/recebimento.dto.ts:5` define `volumesNfSchema = z.number().nonnegative()…` e `:23`/`:47`
  expõem `nfeVolumes: volumesNfSchema.optional()` — na entrada, `number | undefined`.
- `nota-fiscal-fornecedor.persistence.ts:46` (`if (dto.nfeVolumes !== undefined) payload.volumes = …`)
  e `:57` gravam em `payload_json.volumes` como **número**, nunca string, nunca `null`.
- `recebimento.service.ts:257` tipa `payloadNf` como `{ volumes?: number; pesoLiquido?: number } | null`
  e `:285` faz `...(payloadNf?.volumes !== undefined ? { nfeVolumes: payloadNf.volumes } : {})` —
  spread condicional: **quando não há volume, a chave simplesmente não existe na resposta**.
- `lib/operacao.ts:83` declara `nfeVolumes: string | null` em `RecebimentoDetalhe` — errado no tipo
  (é número) **e** errado na cardinalidade (é ausente, não `null`).
- `lib/operacao.ts:156` declara `nfeVolumes?: number` em `IniciarRecebimentoPayload` — esse está
  correto e **não** muda: é o payload de entrada, espelho do DTO Zod.

Decisão: a onda normaliza `detalhar()` para `nfeVolumes: payloadNf?.volumes ?? null` (e, na mesma
expressão de retorno, `nfePesoLiquido: payloadNf?.pesoLiquido !== undefined ? formatarQtd(...) : null`,
que sofre exatamente da mesma omissão e cuja interface já promete `string | null`). Só depois disso
`lib/operacao.ts:83` vira `nfeVolumes: number | null` sem mentir. O DoD 6.38 prova os dois lados:
o backend emite a chave com `null`, e a tela renderiza o valor no detalhe do lote.

**D6.15 — `EtiquetaController` próprio para a linha 16 da matriz.**
`GET /operacao/etiquetas?filtros` e `POST /operacao/etiquetas/:id/cancelar` não cabem sob
`@Controller('operacao/pesagem')`. Nasce
`app/backend/src/modules/operacao/pesagem/etiqueta.controller.ts` com `@Controller('operacao/etiquetas')`,
registrado no `PesagemModule` já existente. `EtiquetaService.listar()` devolve, por etiqueta:
`id`, `pecaId`, `codigo`, `estado`, `statusImpressao`, `reimpressao`, `motivoCancelamento`,
`invalidadaEm`, `bloqueada`, `pesoOriginal`, `statusPeca`, `recebimentoId`, `operadorId`,
`createdAt`. Sem esse endpoint os critérios 6.12 e 6.29 são inatingíveis, como o Portão 1 apontou.

**D6.16 — Nomes da matriz têm precedência sobre a conveniência do plano.**
Toda divergência de nome entre matriz e plano foi resolvida na tabela “Reconciliação matriz → plano”.
Só há uma recusa (`GET /recebimentos/:id/acumuladores`), registrada em D6.17.

**D6.17 — `GET /recebimentos/:id/acumuladores` não é criado.**
`GET /operacao/recebimentos/:id/conferencia` (`recebimento.controller.ts:128`) já devolve o quadro
de acumuladores §6.10.3 produzido por `ConferenciaService.calcularQuadro`, que é a mesma leitura
descrita pela matriz linha 15. Criar um segundo endpoint com nome diferente para o mesmo dado
seria duplicação pura (ponytail). A tela consome o endpoint existente.

**D6.18 — “Bloqueada” é derivado no backend, não é coluna.**
`etiquetas_impressoes` **não** ganha coluna de bloqueio. `EtiquetaService.listar()` calcula
`bloqueada = true` quando a peça está em transformação **ou** em carga fechada:

```sql
pecas.status_peca IN ('em_transformacao','transformada')
OR EXISTS (
  SELECT 1 FROM carga_itens ci
    JOIN caminhoes c ON c.id = ci.caminhao_id
   WHERE ci.peca_id = pecas.id
     AND ci.deleted_at IS NULL
     AND ci.status_carga_item <> 'removido'
     AND c.status_caminhao IN ('fechado','liberado_faturamento','faturado','liberado_saida','expedido')
)
```

Os valores vêm de `pesagem.schema.ts:43` (`chk_pecas_status`), `expedicao.schema.ts:95`
(`chk_carga_itens_status`) e `expedicao.schema.ts:32` (`chk_caminhoes_status`) — nenhum estado
inventado. A mesma expressão é reusada pelo 409 de `estornar()` e de `cancelar()`.

**D6.19 — RBAC nominal de `ASSOCIACAO_ESTORNAR` (bloqueante 6).**
Estorno é “correção manual excepcional”, listada em doc 013 §4.3 como aprovação de exceção
operacional, que exige perfil superior. Doc 013 §3.3 atribui pesar/associar/redirecionar ao
Operador de Pesagem — e **não** menciona desfazer. Doc 013 §2.5 (“Não deve”) não autoriza reversão.
Logo, a permissão vai só para os dois perfis de escalada:

| Perfil (slug do seed F1) | Recebe `ASSOCIACAO_ESTORNAR`? | Fundamento |
|---|---|---|
| `administrador` | **Sim** | doc 013 §2.1 — gerencia tudo; é o padrão de todas as permissões novas em `permissoes.ts` |
| `gestor` | **Sim** | doc 013 §4.3 — exceção operacional exige perfil superior; §2.3 dá ao gestor a aprovação de exceções |
| `recebimento_pesagem` | **Não** | é quem associa (`ASSOCIACAO_GERENCIAR`, `permissoes.ts:263`); doc 013 §3.3 lhe dá associar/redirecionar, não desfazer. É exatamente esta a segregação exigida por D6.3 |
| `corte` | **Não** | tem `ASSOCIACAO_GERENCIAR` (`permissoes.ts:274`) pelo mesmo motivo do anterior; doc 013 §2.6 “Não deve” |
| `expedicao` | **Não** | doc 013 §2.7 permite transferir peça enquanto aberto — transferência é `redirecionar`, não estorno |
| `comercial` | **Não** | doc 013 §2.4 — não opera peça física |
| `compras` | **Não** | doc 013 §2.2 — trata divergência com fornecedor, não destinação de peça |
| `conferente` | **Não** | doc 013 §2.8 — só leitura de cadastros |
| `faturamento` | **Não** | doc 013 §2.9 — consulta pesagem; §2.9 “Não deve” alterar composição física (SF-03) |
| `logistica` | **Não** | doc 013 §2.10 — liberação, não operação de peça |
| `diretoria` | **Não** | doc 013 §2.11 — leitura executiva |

Nota honesta: `administrador` e `gestor` também têm `ASSOCIACAO_GERENCIAR`, então para eles não há
separação de pessoas — a segregação que este desenho garante é a do **operador de piso**, que
associa e não pode reverter sozinho. É o que doc 013 §4.3 pede e é o máximo que o documento
sustenta; inventar um perfil “auditor de estorno” violaria o Princípio VIII.

**D6.20 — DoD 6.22 é provado por casos nomeados, não por `test:cov`.**
O gate ACMR continua rodando, mas a prova 1:1 são cinco casos novos em
`test/unit/nota-fiscal-fornecedor.persistence.spec.ts`, listados no mapa DoD. O gate é a
consequência automática, não o critério.

## Cadeia de migrations — `0021` expand gerado + `0022` backfill custom

Estado atual verificado: último arquivo é `0020_onda5_usuarios_representantes.sql`, o journal tem
`version: "7"`, `dialect: "postgresql"` e a entrada 20 com `when: 1785459703644`. Logo `0021` e
`0022` são os próximos índices contíguos.

### `0021_onda6_recebimento_balanca_expand.sql` — só DDL, 100% gerado

Conteúdo esperado, derivado exclusivamente do delta de `pesagem.schema.ts` (Task 1):

1. `CREATE TABLE "trocas_peca"` com as 15 colunas, 4 CHECKs e 8 FKs declaradas no schema (Task 1.1:
   `recebimentoId`, `pedidoVendaId`, `pedidoVendaItemId`, `pecaRetiradaId`, `pecaInseridaId`,
   `etiquetaInvalidadaId`, `etiquetaEmitidaId`, `operadorId`).
2. Os 4 índices de `trocas_peca`.
3. `ALTER TABLE "etiquetas_impressoes" ADD COLUMN "estado" text DEFAULT 'emitida' NOT NULL`,
   `"motivo_cancelamento" text`, `"invalidada_em" timestamp with time zone`,
   `"invalidada_por_id" uuid` + a FK para `usuarios`.
4. `chk_etiq_estado` e `chk_etiq_cancelada_motivo` em `etiquetas_impressoes`; `idx_etiq_estado`.
5. `DROP CONSTRAINT "chk_assoc_hist_acao"` + `ADD CONSTRAINT "chk_assoc_hist_acao"` com os três
   valores novos — o gerador emite esse par sozinho quando o predicado do `check()` muda no schema.

**Nenhum `UPDATE` neste arquivo.** O teste estático de DoD 6.34 rejeita `UPDATE`, `INSERT`,
`DELETE` e `TRUNCATE` em `0021`.

### `0022_onda6_etiqueta_estado_backfill.sql` — invólucro gerado, DML escrito à mão

Criado por `npm run db:generate -- --custom --name=onda6_etiqueta_estado_backfill`. O gerador cria
o SQL vazio, `meta/0022_snapshot.json` e a entrada 22; **só o SQL é editado**, com este conteúdo:

```sql
-- Onda 6 — ciclo de estado da etiqueta (v1.1 §10.4).
-- Backfill determinístico e idempotente: só toca linhas ainda no default 'emitida'.
UPDATE "etiquetas_impressoes"
   SET "estado" = 'reimpressa'
 WHERE "estado" = 'emitida'
   AND "reimpressao" = true;
--> statement-breakpoint
UPDATE "etiquetas_impressoes"
   SET "estado" = 'ativa'
 WHERE "estado" = 'emitida'
   AND "reimpressao" = false
   AND "status_impressao" = 'impressa';
--> statement-breakpoint
DO $$
DECLARE fora_do_dominio integer;
BEGIN
  SELECT count(*) INTO fora_do_dominio
    FROM "etiquetas_impressoes"
   WHERE "estado" NOT IN ('emitida','ativa','invalidada_por_troca','reimpressa','cancelada');
  IF fora_do_dominio > 0 THEN
    RAISE EXCEPTION 'backfill incompleto: % etiqueta(s) fora do dominio v1.1 10.4', fora_do_dominio;
  END IF;
END $$;
```

Por que é idempotente: as duas cláusulas partem de `estado = 'emitida'` e decidem por colunas que
o backfill não escreve (`reimpressao`, `status_impressao`). Reaplicar não altera linha já
promovida, e um `cancelada` posterior nunca é revertido para `ativa`. Por que é determinístico:
`reimpressao = true` vence, senão `status_impressao = 'impressa'` promove para `ativa`, senão
permanece `emitida` — sem `ORDER BY`, sem “primeiro resultado”, sem inventar estado.

### Proveniência (gate)

`0021.prevId` = `id` real de `meta/0020_snapshot.json`; `0022.prevId` = `id` real de `0021`;
os três ids são UUIDs distintos; journal 20–22 contíguo com as tags exatas. Após todos os testes,
`npm run db:generate -- --name=onda6_drift_probe` deve responder
`No schema changes, nothing to migrate`, **não** criar `0023` e deixar `migrations/` sem diff.
Os SHA-256 de `0021.sql`, `0021_snapshot.json`, `0022.sql`, `0022_snapshot.json` e `_journal.json`
são publicados no relatório de evidências e repetidos após a suíte, exigindo igualdade byte a byte.

### Rollback

Forward-only, sem down SQL manual, no formato de `ROLLBACK.md` usado por `0015`–`0020`: como a onda
é puramente aditiva, restaurar a versão anterior da aplicação **não** exige desfazer `0021`/`0022`
(colunas novas têm default e as tabelas novas ficam ociosas). Se ainda assim for preciso remover a
estrutura, o procedimento é hotfix isolada → remover `trocasPeca` e as 4 colunas do schema →
`npm run db:generate -- --name=onda6_rollback_contract` → migrar. Nenhum `ALTER TABLE` colado no
documento.

## Estrutura de arquivos

```
app/backend/src/
  database/schema/pesagem.schema.ts                        ALTERAR  (trocasPeca, 4 colunas, 3 checks)
  database/migrations/0021_onda6_recebimento_balanca_expand.sql   NOVO (db:generate)
  database/migrations/0022_onda6_etiqueta_estado_backfill.sql     NOVO (db:generate --custom)
  database/migrations/meta/0021_snapshot.json                     NOVO (gerado)
  database/migrations/meta/0022_snapshot.json                     NOVO (gerado)
  database/migrations/ROLLBACK.md                          ALTERAR
  common/rbac/permissoes.ts                                ALTERAR  (ASSOCIACAO_ESTORNAR)
  realtime/events/eventos.ts                               ALTERAR  (3 eventos + payloads)
  modules/operacao/pesagem/
    troca-peca.service.ts                                  NOVO
    dto/troca-peca.dto.ts                                  NOVO  (Zod)
    dto/estorno.dto.ts                                     NOVO  (Zod)
    dto/etiqueta.dto.ts                                    ALTERAR (cancelar + filtros de listagem)
    etiqueta.controller.ts                                 NOVO  (@Controller('operacao/etiquetas'))
    associacao.service.ts                                  ALTERAR (estornar)
    associacao-score.ts                                    ALTERAR (prefCompativel)
    compatibilidade.ts                                     ALTERAR (propaga prefCompativel)
    etiqueta.service.ts                                    ALTERAR (ciclo de estado, invalidar, cancelar, listar)
    pesagem.controller.ts                                  ALTERAR (trocas, estornar)
    pesagem.module.ts                                      ALTERAR (TrocaPecaService + EtiquetaController)
  modules/operacao/recebimento/
    nota-fiscal-fornecedor.persistence.ts                  ALTERAR (dívidas h, c, d)
    recebimento.service.ts                                 ALTERAR (409 + auditoria + nfeVolumes/nfePesoLiquido)
    dto/pedido-fornecedor.dto.ts                           ALTERAR (confirmarSubstituicaoCabecalho)
scripts/check-coverage-lib.mjs                             ALTERAR (dívida a)
app/frontend/src/
  lib/operacao.ts                                          ALTERAR (nfeVolumes, tipos de troca/estorno/etiqueta)
  app/api/operacao/recebimentos/[id]/nf/route.ts           REMOVER (dívida e)
  app/api/operacao/pesagem/trocas/route.ts                 NOVO
  app/api/operacao/pesagem/pecas/[id]/estornar/route.ts    NOVO
  app/api/operacao/etiquetas/route.ts                      NOVO
  app/api/operacao/etiquetas/[id]/cancelar/route.ts        NOVO
  components/ui/troca-peca-modal.tsx                       ALTERAR (ligar ao backend; hoje é casca da O2)
  app/(admin)/recebimento/recebimento-carga/recebimento-carga-client.tsx   ALTERAR
  app/(admin)/recebimento/pesagem-destinacao/pesagem-destinacao-client.tsx ALTERAR
  app/(admin)/recebimento/etiquetas/etiquetas-client.tsx                   ALTERAR
```

## Arquivos de teste (ação por arquivo)

| Arquivo | Ação | Critérios |
|---|---|---|
| `app/backend/test/integration/troca-peca.e2e-spec.ts` | NOVO | 6.1–6.6 |
| `app/backend/test/integration/estorno-associacao.e2e-spec.ts` | NOVO | 6.8–6.11 |
| `app/backend/test/integration/etiqueta.e2e-spec.ts` | ESTENDER | 6.12, 6.13, 6.32, 6.33 |
| `app/backend/test/integration/conferencia-tripla.e2e-spec.ts` | ESTENDER | 6.14, 6.15 |
| `app/backend/test/integration/recebimento.e2e-spec.ts` | ESTENDER | 6.18, 6.19, 6.38 |
| `app/backend/test/integration/recebimento-concorrencia.e2e-spec.ts` | ESTENDER | 6.20 |
| `app/backend/test/integration/onda6-migrations.e2e-spec.ts` | NOVO | 6.35 |
| `app/backend/test/unit/onda6-migrations-meta.spec.ts` | NOVO | 6.34, 6.36 |
| `app/backend/test/unit/pesagem-eventos.spec.ts` | ESTENDER | 6.7, 6.37 |
| `app/backend/test/unit/associacao-score.spec.ts` | ESTENDER | 6.16 |
| `app/backend/test/unit/nota-fiscal-fornecedor.persistence.spec.ts` | ESTENDER | 6.17, 6.22 |
| `scripts/check-coverage.test.mjs` | ESTENDER | 6.21 |
| `app/frontend/__tests__/bff-onda6.test.ts` | NOVO | 6.24, 6.25 |
| `app/frontend/__tests__/recebimento.test.tsx` | ESTENDER | 6.26, 6.39 |
| `app/frontend/__tests__/pesagem.test.tsx` | ESTENDER | 6.27 |
| `app/frontend/__tests__/troca-peca-modal.test.tsx` | ESTENDER | 6.28 |
| `app/frontend/__tests__/etiquetas-recebimento.test.tsx` | NOVO | 6.29 |
| `app/frontend/__tests__/terminologia.test.ts` | ESTENDER | 6.30 |
| `app/frontend/e2e/onda6-recebimento.spec.ts` | NOVO | 6.23, 6.31 |

## Mapa DoD → teste (1:1)

Cada linha é um critério de pronto e o teste **único** que o prova. Portão 2 roda esta tabela.

| # | Critério | Teste (arquivo › nome) |
|---|---|---|
| 6.1 | Troca executa os 9 passos de §6.13 numa única transação | `test/integration/troca-peca.e2e-spec.ts` › “executa os 9 passos da §6.13 em uma transação” |
| 6.2 | Peso original das duas peças preservado | mesmo arquivo › “preserva peso_original da peça retirada e da inserida” |
| 6.3 | Falha em qualquer passo desfaz tudo | mesmo arquivo › “falha ao emitir a nova etiqueta faz rollback total (trocas_peca vazia)” |
| 6.4 | Etiqueta anterior vira `invalidada_por_troca` e nova é emitida | mesmo arquivo › “invalida a etiqueta anterior e emite a nova” |
| 6.5 | Destino da peça retirada é estoque ou desossa, com motivo obrigatório | mesmo arquivo › “rejeita 422 sem motivo e com destino fora de estoque/desossa” |
| 6.6 | Troca exige `ASSOCIACAO_GERENCIAR` | mesmo arquivo › “403 para perfil sem ASSOCIACAO_GERENCIAR” |
| 6.7 | `PECA_TROCADA` publicado só pós-commit | `test/unit/pesagem-eventos.spec.ts` › “PECA_TROCADA publicado após o commit” |
| 6.8 | Estorno devolve `quantidade_atendida` e volta a peça para `em_sobra` | `test/integration/estorno-associacao.e2e-spec.ts` › “devolve quantidade_atendida e retorna a peça para em_sobra” |
| 6.9 | Estorno cancela a etiqueta vigente e grava motivo | mesmo arquivo › “cancela a etiqueta vigente com motivo do estorno” |
| 6.10 | Segregação: sem `ASSOCIACAO_ESTORNAR` → 403 | mesmo arquivo › “403 para perfil com ASSOCIACAO_GERENCIAR mas sem ASSOCIACAO_ESTORNAR” |
| 6.11 | Estorno bloqueado após carga fechada | mesmo arquivo › “409 quando a peça está em carga fechada” |
| 6.12 | Ciclo de estado da etiqueta §10.4 | `test/integration/etiqueta.e2e-spec.ts` › “transições emitida → ativa → reimpressa → cancelada” |
| 6.13 | QR de etiqueta invalidada não resolve | mesmo arquivo › “resolverQr responde 409 para etiqueta invalidada_por_troca” |
| 6.14 | Acumuladores §6.10.3 vêm das pesagens, nunca de total digitado | `test/integration/conferencia-tripla.e2e-spec.ts` › “quadro recalcula a cada peça pesada sem total digitado” |
| 6.15 | Conclusão do lote exige revisão e classifica com/sem divergência | mesmo arquivo › “concluir sem passar pela revisão responde 409” |
| 6.16 | `prefCompativel` é selo e não muda score nem ordem | `test/unit/associacao-score.spec.ts` › “marca prefCompativel sem alterar score nem ordenação” |
| 6.17 | **Dívida (h)** `cabecalho_sem_itens` só quando não há itens | `test/unit/nota-fiscal-fornecedor.persistence.spec.ts` › “cabecalho_sem_itens é true apenas com itensAtivos === 0” |
| 6.18 | **Dívida (c)** renumeração silenciosa eliminada | `test/integration/recebimento.e2e-spec.ts` › “409 CABECALHO_ORFAO_DIVERGENTE sem confirmação explícita” |
| 6.19 | **Dívida (c)** substituição confirmada é auditada | mesmo arquivo › “confirmarSubstituicaoCabecalho grava auditoria NF_CABECALHO_RENUMERADO” |
| 6.20 | **Dívida (d)** dois `registrarNf` concorrentes não completam o mesmo órfão | `test/integration/recebimento-concorrencia.e2e-spec.ts` › “registrarNf concorrente sobre cabeçalho órfão: um completa, outro recebe 409” |
| 6.21 | **Dívida (a)** gate ACMR inclui `*.persistence.ts` | `scripts/check-coverage.test.mjs` › “glob de cobertura por arquivo inclui persistence.ts” |
| 6.22 | **Dívida (a)** `nota-fiscal-fornecedor.persistence.ts` ≥80% linha e branch | `test/unit/nota-fiscal-fornecedor.persistence.spec.ts` › os cinco casos nomeados: “montarPatchCabecalhoUi mantém peso do existente quando o patch não traz peso”, “mapearCamposNfParaRegistrar exige nfeNumero e lança BadRequest sem ele”, “extrairPayloadNfUi omite chaves não enviadas e preserva extras”, “mesclarPayloadNfCompleta remove cabecalho_sem_itens ao completar com itens”, “temCamposNfEstruturados cobre cada um dos sete campos isoladamente” (D6.20) |
| 6.23 | **Dívida (b)** tela captura itens da NF e conclui a conferência | `app/frontend/e2e/onda6-recebimento.spec.ts` › “captura itens da NF e conclui a conferência pela tela” |
| 6.24 | **Dívida (e)** rota BFF duplicada removida | `app/frontend/__tests__/bff-onda6.test.ts` › “não existe rota app/api/operacao/recebimentos/[id]/nf” |
| 6.25 | Os 4 handlers BFF repassam método, path e status sem regra de negócio | mesmo arquivo › “trocas, estornar, listar e cancelar etiqueta repassam ao backend sem decidir” |
| 6.26 | Recebimento de Carga fiel: 7 status de lote, comparativo, conclusão obrigatória, entrada direta, cancelar lote, drawer novo recebimento | `app/frontend/__tests__/recebimento.test.tsx` › “Recebimento de Carga renderiza os blocos do protótipo” |
| 6.27 | Pesagem fiel: chips de características, selo pref. compatível, modal etiqueta, estorno | `app/frontend/__tests__/pesagem.test.tsx` › “Pesagem & Destinação renderiza os blocos do protótipo” |
| 6.28 | Troca de Peça: 6 passos ligados ao backend, resultado com etiqueta invalidada | `app/frontend/__tests__/troca-peca-modal.test.tsx` › “conclui os 6 passos e exibe o resultado do backend” |
| 6.29 | Etiquetas: 5 rótulos do protótipo derivados de §10.4, regras `cancelavel`/`reimprimivel`, preview da etiqueta e modal Reimprimir (inclui pendente) no drawer | `app/frontend/__tests__/etiquetas-recebimento.test.tsx` › “renderiza os blocos do protótipo” (mesma fórmula de 6.26/6.27), cobrindo o mapeamento de rótulos, o preview e o modal Reimprimir chamando a rota de reimpressão |
| 6.30 | Nenhum termo banido nas telas da onda; “Nome Fantasia”/“Buscar cliente” onde há cliente | `app/frontend/__tests__/terminologia.test.ts` › “rotas de recebimento sem termo banido” |
| 6.31 | Jornada E2E das 3 rotas com banco semeado, sem erro de console | `app/frontend/e2e/onda6-recebimento.spec.ts` › “percorre as 3 rotas de recebimento pelo menu” |
| 6.32 | `GET /operacao/etiquetas` filtra por recebimento, estado e busca, devolve `estado`/`statusImpressao`/`motivoCancelamento`, e uma peça com vigente `cancelada` (histórico com linha `ativa` anterior) não aparece no filtro `?estado=ativa` nem tem o histórico truncado (D6.2) | `test/integration/etiqueta.e2e-spec.ts` › “lista etiquetas do recebimento filtrando por estado e busca” e “peça com vigente cancelada não aparece no filtro estado=ativa e mantém o histórico completo” |
| 6.33 | Bloqueio D6.18 é calculado: peça em transformação ou em carga fechada vem `bloqueada: true` | mesmo arquivo › “marca bloqueada para peça em transformação e para peça em carga fechada” |
| 6.34 | **D6.13** `0021` é expand puro gerado: sem `UPDATE`/`INSERT`/`DELETE`/`TRUNCATE`; `0022` é só DML/guarda, sem `CREATE`/`ALTER`/`DROP` | `test/unit/onda6-migrations-meta.spec.ts` › “separa ddl gerado de sql custom de backfill” |
| 6.35 | **D6.13** backfill promove reimpressa/ativa corretamente, não toca estado já promovido e é idempotente ao reaplicar | `test/integration/onda6-migrations.e2e-spec.ts` › “0022 faz backfill determinístico e idempotente do estado da etiqueta” |
| 6.36 | **D6.13** journal 20–22 contíguo, `prevId` encadeado com ids distintos, snapshots presentes, `db:generate` não encontra drift | `test/unit/onda6-migrations-meta.spec.ts` › “encadeia journal e snapshots gerados de 0020 a 0022” |
| 6.37 | `PESAGEM_ESTORNADA` e `ETIQUETA_INVALIDADA` publicados só pós-commit, com motivo no payload | `test/unit/pesagem-eventos.spec.ts` › “PESAGEM_ESTORNADA e ETIQUETA_INVALIDADA publicados após o commit com motivo” |
| 6.38 | **Dívida (f)** backend sempre emite a chave: `nfeVolumes` é `number` ou `null`, nunca ausente | `test/integration/recebimento.e2e-spec.ts` › “detalhar devolve nfeVolumes null quando a NF não declara volumes” |
| 6.39 | **Dívida (f)** a tela consome `number \| null` no detalhe do lote | `app/frontend/__tests__/recebimento.test.tsx` › “detalhe do lote renderiza nfeVolumes number e trata null” |

## Tasks

### Task 1 — Schema declarativo e migration `0021` (expand gerado)

**Files:** `app/backend/src/database/schema/pesagem.schema.ts`,
`app/backend/src/database/migrations/0021_onda6_recebimento_balanca_expand.sql` (gerado),
`meta/0021_snapshot.json` (gerado), `app/backend/test/unit/onda6-migrations-meta.spec.ts`.

**1.1** Ao **final** de `pesagem.schema.ts` — depois de `etiquetasImpressoes`, porque `trocasPeca`
referencia essa tabela — acrescentar:

```ts
// ── trocas_peca ───────────────────────────────────────────────────────────────
// Registro atômico da Troca de Peça (v1.1 §6.13). Uma linha por troca executada;
// os pesos das duas peças são copiados aqui como snapshot — peso_original das peças
// NUNCA é alterado pela troca ("Regra confirmada" de §6.13).
export const trocasPeca = pgTable(
  'trocas_peca',
  {
    id:                   uuid('id').primaryKey().default(sql`uuidv7()`),
    recebimentoId:        uuid('recebimento_id').notNull().references(() => recebimentos.id),
    pedidoVendaId:        uuid('pedido_venda_id').notNull().references(() => pedidosVenda.id),
    pedidoVendaItemId:    uuid('pedido_venda_item_id').notNull().references(() => pedidosVendaItens.id),
    pecaRetiradaId:       uuid('peca_retirada_id').notNull().references(() => pecas.id),
    pecaInseridaId:       uuid('peca_inserida_id').notNull().references(() => pecas.id),
    pesoRetirada:         numeric('peso_retirada', { precision: 10, scale: 3 }).notNull(),
    pesoInserida:         numeric('peso_inserida', { precision: 10, scale: 3 }).notNull(),
    destinoRetirada:      text('destino_retirada').notNull(),
    motivo:               text('motivo').notNull(),
    observacoes:          text('observacoes'),
    etiquetaInvalidadaId: uuid('etiqueta_invalidada_id').references(() => etiquetasImpressoes.id),
    etiquetaEmitidaId:    uuid('etiqueta_emitida_id').references(() => etiquetasImpressoes.id),
    operadorId:           uuid('operador_id').notNull().references(() => usuarios.id),
    createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Destinos da peça retirada — TrocaPeca.tsx:11 (`type DestinoRetirada = "Estoque" | "Desossa"`).
    check('chk_trocas_peca_destino', sql`${t.destinoRetirada} IN ('estoque','desossa')`),
    // Motivos — TrocaPeca.tsx:79-86 (const MOTIVOS), em slug.
    check(
      'chk_trocas_peca_motivo',
      sql`${t.motivo} IN ('peca_mais_adequada','peso_fora_preferencia','qualidade','erro_associacao','outro')`,
    ),
    check('chk_trocas_peca_pecas_distintas', sql`${t.pecaRetiradaId} <> ${t.pecaInseridaId}`),
    check('chk_trocas_peca_pesos_positivos', sql`${t.pesoRetirada} > 0 AND ${t.pesoInserida} > 0`),
    index('idx_trocas_peca_recebimento').on(t.recebimentoId),
    index('idx_trocas_peca_pedido').on(t.pedidoVendaId),
    index('idx_trocas_peca_retirada').on(t.pecaRetiradaId),
    index('idx_trocas_peca_inserida').on(t.pecaInseridaId),
  ],
);

export const trocasPecaRelations = relations(trocasPeca, ({ one }) => ({
  recebimento:  one(recebimentos,  { fields: [trocasPeca.recebimentoId],     references: [recebimentos.id] }),
  pedido:       one(pedidosVenda,  { fields: [trocasPeca.pedidoVendaId],     references: [pedidosVenda.id] }),
  pedidoItem:   one(pedidosVendaItens, { fields: [trocasPeca.pedidoVendaItemId], references: [pedidosVendaItens.id] }),
  pecaRetirada: one(pecas,         { fields: [trocasPeca.pecaRetiradaId],    references: [pecas.id], relationName: 'trocaPecaRetirada' }),
  pecaInserida: one(pecas,         { fields: [trocasPeca.pecaInseridaId],    references: [pecas.id], relationName: 'trocaPecaInserida' }),
}));
```

**1.2** Em `etiquetasImpressoes` (`pesagem.schema.ts:93-115`), acrescentar as **4** colunas e trocar
o bloco de constraints. Não existe coluna `troca_peca_id` (D6.17 — a ligação já é
`trocas_peca.etiqueta_invalidada_id`/`etiqueta_emitida_id`; um FK de volta criaria ciclo entre as
duas `pgTable` e duplicaria a informação):

```ts
    operadorId:         uuid('operador_id').notNull().references(() => usuarios.id),
    // ── Onda 6 — ciclo de estado da etiqueta (v1.1 §10.4) ──────────────────────
    estado:             text('estado').notNull().default('emitida'),
    motivoCancelamento: text('motivo_cancelamento'),
    invalidadaEm:       timestamp('invalidada_em', { withTimezone: true }),
    invalidadaPorId:    uuid('invalidada_por_id').references(() => usuarios.id),
    createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_etiq_status_impressao', sql`${t.statusImpressao} IN ('impressa','falha_impressao','pendente')`),
    // v1.1 §10.4 — os cinco estados do domínio. Os rótulos do protótipo são derivados na tela (D6.2).
    check(
      'chk_etiq_estado',
      sql`${t.estado} IN ('emitida','ativa','invalidada_por_troca','reimpressa','cancelada')`,
    ),
    // RA-06: estado terminal de cancelamento nunca fica sem motivo registrado.
    check(
      'chk_etiq_cancelada_motivo',
      sql`${t.estado} <> 'cancelada' OR ${t.motivoCancelamento} IS NOT NULL`,
    ),
    check(
      'chk_etiq_um_alvo',
      sql`(${t.pecaId} IS NOT NULL)::int + (${t.subitemId} IS NOT NULL)::int = 1`,
    ),
    index('idx_etiq_peca').on(t.pecaId),
    index('idx_etiq_subitem').on(t.subitemId),
    index('idx_etiq_estado').on(t.estado),
    index('idx_etiq_payload_gin').using('gin', t.payload),
  ],
);
```

**1.3** Em `associacoesPecaHistorico` (`pesagem.schema.ts:75-78`), ampliar o CHECK — o gerador
emite `DROP CONSTRAINT` + `ADD CONSTRAINT` sozinho a partir deste delta:

```ts
    check(
      'chk_assoc_hist_acao',
      sql`${t.acao} IN ('confirmar','redirecionar','sobra','analise','corte','divergencia','estorno','troca_saida','troca_entrada')`,
    ),
```

**1.4** Exportar `trocasPeca` e `trocasPecaRelations` em `database/schema/index.ts`, no mesmo
formato das demais exportações do arquivo.

**1.5** Gerar o expand, sem criar nem renomear arquivo antes ou depois:

```bash
cd app/backend
npm run db:generate -- --name=onda6_recebimento_balanca_expand
cd ../..
```

O único resultado aceito é `0021_onda6_recebimento_balanca_expand.sql` +
`meta/0021_snapshot.json` + entrada 21 no journal. Inspecionar **sem editar**: existe
`CREATE TABLE "trocas_peca"`, existem os quatro `ALTER TABLE "etiquetas_impressoes" ADD COLUMN`,
existem `chk_etiq_estado`, `chk_etiq_cancelada_motivo`, `idx_etiq_estado`, o par
`DROP CONSTRAINT/ADD CONSTRAINT "chk_assoc_hist_acao"`, e **não** existe `UPDATE`, `INSERT`,
`DELETE` nem `TRUNCATE`. Se qualquer DDL não explicado aparecer, descartar `0021`, corrigir o
schema e regerar.

**1.6** Escrever `test/unit/onda6-migrations-meta.spec.ts` já com os dois casos de 6.34 e 6.36; o
segundo fica vermelho até a Task 2 existir.

**Commit:** `feat(onda6): schema de troca de peça e ciclo de estado da etiqueta`

---

### Task 2 — Migration `0022` (backfill custom gerado), rollback e provas de proveniência

**Files:** `0022_onda6_etiqueta_estado_backfill.sql` (invólucro gerado, DML à mão),
`meta/0022_snapshot.json` (gerado), `migrations/ROLLBACK.md`,
`test/integration/onda6-migrations.e2e-spec.ts`, `test/unit/onda6-migrations-meta.spec.ts`.

**2.1** Com o schema **inalterado** desde a Task 1, gerar o invólucro custom:

```bash
cd app/backend
npm run db:generate -- --custom --name=onda6_etiqueta_estado_backfill
cd ../..
```

Confirmar a criação automática de `0022_onda6_etiqueta_estado_backfill.sql`,
`meta/0022_snapshot.json` e entrada 22. **Não editar** os dois últimos.

**2.2** Substituir o comentário do SQL custom pelo conteúdo exato da seção “Cadeia de migrations”
deste plano (dois `UPDATE` guardados por `estado = 'emitida'` + bloco `DO $$ … RAISE EXCEPTION`).
Nada de `CREATE`, `ALTER`, `DROP`, `TRUNCATE` ou criação de índice neste arquivo.

**2.3** `test/integration/onda6-migrations.e2e-spec.ts`, no isolamento de `onda4-migrations`
(banco dedicado, reset até `0020`, aplicação por tag), provando 6.35 com fixtures:
`reimpressao=true` + `status_impressao='pendente'` → `reimpressa`; `reimpressao=false` +
`'impressa'` → `ativa`; `reimpressao=false` + `'falha_impressao'` → segue `emitida`; linha já
marcada `cancelada` antes da reaplicação **continua** `cancelada`; reaplicar `0022` não muda
nenhuma contagem.

**2.4** `ROLLBACK.md` ganha a seção `0021`/`0022` no formato já usado por `0015`–`0020`, listando
exatamente os objetos criados (`trocas_peca`, seus 4 índices e 4 CHECKs; as 4 colunas, 2 CHECKs e
1 índice de `etiquetas_impressoes`; o CHECK reescrito de `associacoes_peca_historico`) e o
procedimento forward-only descrito em D6.13. Nenhum `ALTER TABLE` manual no documento.

**2.5** Fechar `onda6-migrations-meta.spec.ts`: `0021.prevId === id` de `meta/0020_snapshot.json`,
`0022.prevId === id` de `0021`, três ids distintos, journal 20–22 contíguo com as tags exatas,
`version`/`dialect` coerentes, e a separação DDL × DML de 6.34 lida dos dois arquivos `.sql`.

**2.6** Prova de drift, com árvore limpa antes e depois:

```bash
cd app/backend
npm run db:generate -- --name=onda6_drift_probe   # deve dizer: No schema changes, nothing to migrate
git status --porcelain src/database/migrations     # deve sair vazio
cd ../..
```

Registrar no relatório de evidências os SHA-256 de `0021.sql`, `meta/0021_snapshot.json`,
`0022.sql`, `meta/0022_snapshot.json` e `meta/_journal.json`, antes e depois da suíte, exigindo
igualdade byte a byte.

**Commit:** `feat(onda6): backfill gerado do estado da etiqueta e rollback documentado`

---

### Task 3 — Permissão `ASSOCIACAO_ESTORNAR` e os três eventos da matriz

**Files:** `app/backend/src/common/rbac/permissoes.ts`,
`app/backend/src/realtime/events/eventos.ts`.

**3.1** Em `permissoes.ts`, no bloco F4b do objeto `PERMISSOES` (depois de
`ASSOCIACAO_GERENCIAR`, linha 52):

```ts
  ASSOCIACAO_ESTORNAR: 'ASSOCIACAO_ESTORNAR', // desfazer destinação já confirmada (doc 013 §4.3)
```

**3.2** Concessão nominal (D6.19). Como o mapa de perfis já foi construído, a concessão entra pelo
mesmo mecanismo `pushPermissoes` usado pelas ondas anteriores, ao final do arquivo, junto dos
demais blocos de onda:

```ts
// Onda 6 — estorno de destinação é exceção operacional (doc 013 §4.3): só escalada.
// recebimento_pesagem e corte têm ASSOCIACAO_GERENCIAR e deliberadamente NÃO recebem esta
// permissão — é a segregação "quem associa não estorna" (D6.3/D6.19).
pushPermissoes('administrador', 'ASSOCIACAO_ESTORNAR');
pushPermissoes('gestor',        'ASSOCIACAO_ESTORNAR');
```

E a descrição em `DESCRICOES_PERMISSOES`:

```ts
  ASSOCIACAO_ESTORNAR: 'Estornar associação/destinação já confirmada de uma peça',
```

O seed (`app/backend/src/database/seed.ts:224,229`) consome `DESCRICOES_PERMISSOES` e
`MAPA_PERFIL_PERMISSOES` diretamente — nenhum arquivo de seed precisa ser editado, e rodar
`npm run db:seed` é idempotente.

**3.3** Em `realtime/events/eventos.ts`, no fim do objeto `EVENTOS`:

```ts
  // ── Onda 6 — Recebimento & Balança ────────────────────────────────────────
  PECA_TROCADA: 'peca_trocada',
  PESAGEM_ESTORNADA: 'pesagem_estornada',
  ETIQUETA_INVALIDADA: 'etiqueta_invalidada',
```

E os payloads, junto dos demais de F4b:

```ts
export interface PecaTrocadaPayload {
  trocaId: string;
  dataOperacao: string;
  pedidoVendaId: string;
  pedidoVendaItemId: string;
  pecaRetiradaId: string;
  pecaInseridaId: string;
  destinoRetirada: 'estoque' | 'desossa';
  motivo: string;
  etiquetaInvalidadaId: string | null;
  etiquetaEmitidaId: string;
}

export interface PesagemEstornadaPayload {
  pecaId: string;
  dataOperacao: string;
  pedidoOrigemId: string | null;
  pedidoItemOrigemId: string;
  motivo: string;
}

export interface EtiquetaInvalidadaPayload {
  etiquetaId: string;
  pecaId: string;
  dataOperacao: string;
  estado: 'invalidada_por_troca' | 'cancelada';
  motivo: string;
}
```

Acrescentar as três chaves em `PayloadPorEvento`, na seção Onda 6:

```ts
  peca_trocada: PecaTrocadaPayload;
  pesagem_estornada: PesagemEstornadaPayload;
  etiqueta_invalidada: EtiquetaInvalidadaPayload;
```

**Commit:** `feat(onda6): permissão de estorno e eventos de troca, estorno e invalidação`

---

### Task 4 — `TrocaPecaService` e `POST /operacao/pesagem/trocas`

**Files:** `dto/troca-peca.dto.ts` (novo), `carga-fechada.ts` (novo), `troca-peca.service.ts`
(novo), `etiqueta.service.ts` (alterar), `pesagem.controller.ts`, `pesagem.module.ts`,
`test/integration/troca-peca.e2e-spec.ts`, `test/unit/pesagem-eventos.spec.ts`.

**4.1** `dto/troca-peca.dto.ts` — os motivos e destinos são os do protótipo
(`TrocaPeca.tsx:11` e `:79-86`), em slug, com os rótulos exportados para a UI:

```ts
import { z } from 'zod';

export const DESTINOS_RETIRADA = ['estoque', 'desossa'] as const;
export type DestinoRetirada = (typeof DESTINOS_RETIRADA)[number];

/** Motivos de TrocaPeca.tsx:79-86, em slug estável. */
export const MOTIVOS_TROCA_PECA = [
  'peca_mais_adequada',
  'peso_fora_preferencia',
  'qualidade',
  'erro_associacao',
  'outro',
] as const;
export type MotivoTrocaPeca = (typeof MOTIVOS_TROCA_PECA)[number];

export const ROTULOS_MOTIVO_TROCA_PECA: Record<MotivoTrocaPeca, string> = {
  peca_mais_adequada: 'Peça mais adequada ao cliente',
  peso_fora_preferencia: 'Peso fora da preferência',
  qualidade: 'Qualidade',
  erro_associacao: 'Erro de associação',
  outro: 'Outro',
};

export const executarTrocaSchema = z
  .object({
    pecaRetiradaId: z.string().uuid(),
    pecaInseridaId: z.string().uuid(),
    pedidoVendaItemId: z.string().uuid(),
    destinoRetirada: z.enum(DESTINOS_RETIRADA),
    motivo: z.enum(MOTIVOS_TROCA_PECA),
    observacoes: z.string().trim().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.pecaRetiradaId === v.pecaInseridaId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pecaInseridaId'],
        message: 'peça de entrada precisa ser diferente da peça retirada',
      });
    }
    if (v.motivo === 'outro' && !v.observacoes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['observacoes'],
        message: 'observação é obrigatória quando o motivo é "Outro"',
      });
    }
  });
export type ExecutarTrocaDto = z.infer<typeof executarTrocaSchema>;
```

**4.2** `carga-fechada.ts` — regra única de D6.18, usada pela troca, pelo estorno e pela listagem
de etiquetas. Os literais vêm de `expedicao.schema.ts:32,95` e `pesagem.schema.ts:43`:

```ts
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { caminhoes, cargaItens, pecas } from '../../../database/schema';

type Tx = NodePgDatabase<typeof schema>;

/** chk_caminhoes_status (expedicao.schema.ts:32) — a partir de 'fechado' a carga não muda. */
export const STATUS_CAMINHAO_FECHADO = [
  'fechado',
  'liberado_faturamento',
  'faturado',
  'liberado_saida',
  'expedido',
] as const;

/** chk_pecas_status (pesagem.schema.ts:43) — peça consumida pela transformação. */
export const STATUS_PECA_EM_TRANSFORMACAO = ['em_transformacao', 'transformada'] as const;

export async function pecaEmCargaFechada(tx: Tx, pecaId: string): Promise<boolean> {
  const linha = await tx
    .select({ id: cargaItens.id })
    .from(cargaItens)
    .innerJoin(caminhoes, eq(caminhoes.id, cargaItens.caminhaoId))
    .where(
      and(
        eq(cargaItens.pecaId, pecaId),
        isNull(cargaItens.deletedAt),
        ne(cargaItens.statusCargaItem, 'removido'),
        inArray(caminhoes.statusCaminhao, [...STATUS_CAMINHAO_FECHADO]),
      ),
    )
    .limit(1)
    .then((r) => r[0] ?? null);
  return linha !== null;
}

/** Predicado SQL correlacionado para uso em SELECT de listagem (D6.18). */
export const etiquetaBloqueadaSql = sql<boolean>`(
  ${pecas.statusPeca} IN ('em_transformacao','transformada')
  OR EXISTS (
    SELECT 1
      FROM ${cargaItens} ci
      JOIN ${caminhoes} c ON c.id = ci.caminhao_id
     WHERE ci.peca_id = ${pecas.id}
       AND ci.deleted_at IS NULL
       AND ci.status_carga_item <> 'removido'
       AND c.status_caminhao IN ('fechado','liberado_faturamento','faturado','liberado_saida','expedido')
  )
)`;
```

**4.3** `troca-peca.service.ts` — os 9 passos de §6.13 numa transação. Como a peça nova ocupa
**a mesma unidade** já consumida do item, `quantidade_atendida` não muda: nem `consumirSaldo` nem
`devolverSaldo` são chamados, e é isso que preserva o atendimento do pedido durante a troca.

```ts
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  associacoesPecaHistorico,
  operacoes,
  pecas,
  pedidosVenda,
  pedidosVendaItens,
  recebimentos,
  trocasPeca,
} from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { primeiroOuFalha } from '../../../common/crud/paginacao';
import { EVENTOS } from '../../../realtime/events/eventos';
import { EtiquetaService } from './etiqueta.service';
import { pecaEmCargaFechada } from './carga-fechada';
import type { ExecutarTrocaDto } from './dto/troca-peca.dto';

type Tx = NodePgDatabase<typeof schema>;
type Peca = typeof pecas.$inferSelect;
type Etiqueta = typeof schema.etiquetasImpressoes.$inferSelect;

export interface ResultadoTrocaPeca {
  troca: typeof trocasPeca.$inferSelect;
  pecaRetirada: Peca;
  pecaInserida: Peca;
  etiquetaInvalidada: Etiqueta | null;
  etiquetaEmitida: Etiqueta;
}

@Injectable()
export class TrocaPecaService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly etiqueta: EtiquetaService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  /**
   * Troca de Peça (v1.1 §6.13): passos 1–9 numa única transação.
   * peso_original das duas peças NUNCA é escrito — a troca altera destinação, não pesagem.
   */
  async executar(dto: ExecutarTrocaDto, operadorId: string): Promise<ResultadoTrocaPeca> {
    const contexto = await this.validarTroca(dto);

    const resultado = await this.db.transaction(async (tx) => {
      // 1 e 2 — revalida sob lock. Ordem determinística de lock evita deadlock com a troca inversa.
      const [primeiroId, segundoId] = [dto.pecaRetiradaId, dto.pecaInseridaId].sort();
      const travadas = new Map<string, Peca>();
      travadas.set(primeiroId, await this.travarPeca(tx, primeiroId));
      travadas.set(segundoId, await this.travarPeca(tx, segundoId));
      const retirada = travadas.get(dto.pecaRetiradaId)!;
      const inserida = travadas.get(dto.pecaInseridaId)!;

      if (retirada.statusPeca !== 'associada' || retirada.pedidoVendaItemId !== dto.pedidoVendaItemId) {
        throw new ConflictException('Peça retirada não está mais associada a este item do pedido');
      }
      if (inserida.statusPeca === 'associada') {
        throw new ConflictException('Peça de entrada já está associada a um pedido');
      }
      if (inserida.itemComercialBaseId !== retirada.itemComercialBaseId) {
        throw new ConflictException('Peça de entrada é de outro item comercial');
      }
      if (await pecaEmCargaFechada(tx, retirada.id)) {
        throw new ConflictException('Peça retirada já está em carga fechada — troca bloqueada');
      }

      // Impressão física só DEPOIS de todas as checagens sob lock passarem: um 409 acima nunca
      // deixa etiqueta física impressa sem fato de negócio associado (RA-02). Best-effort — nunca
      // lança; falha vira status_impressao='falha_impressao', o mesmo padrão do precedente
      // etiqueta.service.ts:43-55, aplicado aqui dentro do lock porque a checagem depende de
      // duas peças e não pode ser feita antes de travá-las.
      const impressao = await this.etiqueta.imprimirPayload(contexto.payloadEtiqueta);

      // 3 e 4 — desassocia a antiga e a destina (estoque → em_sobra; desossa → para_corte).
      const statusRetirada = dto.destinoRetirada === 'estoque' ? 'em_sobra' : 'para_corte';
      const retiradaAtualizada = primeiroOuFalha(
        await tx
          .update(pecas)
          .set({ statusPeca: statusRetirada, pedidoVendaId: null, pedidoVendaItemId: null })
          .where(eq(pecas.id, retirada.id))
          .returning(),
      );

      // 5 — associa a nova ao MESMO item; a unidade do saldo é a mesma, logo
      // quantidade_atendida permanece intacta (nem consumirSaldo nem devolverSaldo).
      const inseridaAtualizada = primeiroOuFalha(
        await tx
          .update(pecas)
          .set({
            statusPeca: 'associada',
            pedidoVendaId: contexto.pedidoVendaId,
            pedidoVendaItemId: dto.pedidoVendaItemId,
            etiquetaAtual: contexto.codigoNovaEtiqueta,
          })
          .where(eq(pecas.id, inserida.id))
          .returning(),
      );

      // 6 — preservação do peso: nenhum dos dois UPDATE acima toca peso_original.

      // 7 — invalida a etiqueta vigente da peça retirada.
      const etiquetaInvalidada = await this.etiqueta.invalidarPorTrocaNaTx(tx, retirada.id, operadorId);

      // 8 — emite a nova etiqueta da peça inserida.
      const etiquetaEmitida = await this.etiqueta.emitirNaTx(tx, {
        pecaId: inserida.id,
        codigo: contexto.codigoNovaEtiqueta,
        payload: contexto.payloadEtiqueta,
        impressao,
        reimpressao: false,
        operadorId,
      });

      // 9 — histórico completo: 1 linha em trocas_peca + 2 em associacoes_peca_historico.
      const troca = primeiroOuFalha(
        await tx
          .insert(trocasPeca)
          .values({
            recebimentoId: inserida.recebimentoId,
            pedidoVendaId: contexto.pedidoVendaId,
            pedidoVendaItemId: dto.pedidoVendaItemId,
            pecaRetiradaId: retirada.id,
            pecaInseridaId: inserida.id,
            pesoRetirada: retirada.pesoOriginal,
            pesoInserida: inserida.pesoOriginal,
            destinoRetirada: dto.destinoRetirada,
            motivo: dto.motivo,
            observacoes: dto.observacoes ?? null,
            etiquetaInvalidadaId: etiquetaInvalidada?.id ?? null,
            etiquetaEmitidaId: etiquetaEmitida.id,
            operadorId,
          })
          .returning(),
      );

      await tx.insert(associacoesPecaHistorico).values([
        {
          pecaId: retirada.id,
          acao: 'troca_saida',
          pedidoOrigemId: contexto.pedidoVendaId,
          motivo: dto.motivo,
          operadorId,
          statusExpedicaoNoMomento: 'aberta',
        },
        {
          pecaId: inserida.id,
          acao: 'troca_entrada',
          pedidoDestinoId: contexto.pedidoVendaId,
          pedidoItemDestinoId: dto.pedidoVendaItemId,
          motivo: dto.motivo,
          operadorId,
          statusExpedicaoNoMomento: 'aberta',
        },
      ]);

      await this.auditoria.registrar(tx, {
        tabela: 'trocas_peca',
        registroId: troca.id,
        operacao: 'INSERT',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: { pecaRetirada: retirada, pecaInserida: inserida },
        dadosNovos: { troca, pecaRetirada: retiradaAtualizada, pecaInserida: inseridaAtualizada },
      });

      return {
        troca,
        pecaRetirada: retiradaAtualizada,
        pecaInserida: inseridaAtualizada,
        etiquetaInvalidada,
        etiquetaEmitida,
      };
    });

    // PÓS-COMMIT (ADR-004): nada é publicado se a transação falhou.
    this.eventEmitter.emit(EVENTOS.PECA_TROCADA, {
      trocaId: resultado.troca.id,
      dataOperacao: contexto.dataOperacao,
      pedidoVendaId: contexto.pedidoVendaId,
      pedidoVendaItemId: dto.pedidoVendaItemId,
      pecaRetiradaId: resultado.pecaRetirada.id,
      pecaInseridaId: resultado.pecaInserida.id,
      destinoRetirada: dto.destinoRetirada,
      motivo: dto.motivo,
      etiquetaInvalidadaId: resultado.etiquetaInvalidada?.id ?? null,
      etiquetaEmitidaId: resultado.etiquetaEmitida.id,
    });
    if (resultado.etiquetaInvalidada) {
      this.eventEmitter.emit(EVENTOS.ETIQUETA_INVALIDADA, {
        etiquetaId: resultado.etiquetaInvalidada.id,
        pecaId: resultado.pecaRetirada.id,
        dataOperacao: contexto.dataOperacao,
        estado: 'invalidada_por_troca',
        motivo: dto.motivo,
      });
    }

    return resultado;
  }

  // ── internos ───────────────────────────────────────────────────────────────

  /** Leitura pré-transação: valida o item de destino e monta o payload da nova etiqueta. */
  private async validarTroca(dto: ExecutarTrocaDto) {
    const item = await this.db
      .select({
        id: pedidosVendaItens.id,
        pedidoVendaId: pedidosVendaItens.pedidoVendaId,
        itemComercialId: pedidosVendaItens.itemComercialId,
        statusPedido: pedidosVenda.status,
        deletedAt: pedidosVenda.deletedAt,
      })
      .from(pedidosVendaItens)
      .innerJoin(pedidosVenda, eq(pedidosVendaItens.pedidoVendaId, pedidosVenda.id))
      .where(eq(pedidosVendaItens.id, dto.pedidoVendaItemId))
      .then((r) => r[0] ?? null);
    if (!item || item.deletedAt) throw new NotFoundException('Item de pedido não encontrado');
    if (item.statusPedido === 'cancelado') {
      throw new ConflictException('Pedido cancelado não aceita troca de peça');
    }

    const inserida = await this.buscarAtiva(this.db, dto.pecaInseridaId);
    if (!inserida) throw new NotFoundException('Peça de entrada não encontrada');
    if (inserida.itemComercialBaseId !== item.itemComercialId) {
      throw new ConflictException('Peça de entrada incompatível com o item do pedido');
    }

    const dataOperacao = await this.dataOperacaoDaPeca(this.db, inserida);
    const codigoNovaEtiqueta = inserida.etiquetaAtual ?? `QR-${inserida.id}`;

    return {
      pedidoVendaId: item.pedidoVendaId,
      dataOperacao,
      codigoNovaEtiqueta,
      payloadEtiqueta: {
        pecaId: inserida.id,
        itemComercialBaseId: inserida.itemComercialBaseId,
        pesoOriginal: inserida.pesoOriginal,
        pedidoVendaId: item.pedidoVendaId,
        pedidoVendaItemId: item.id,
        qr: codigoNovaEtiqueta,
        dataHoraPesagem: inserida.dataHoraPesagem,
        origemTroca: true,
      } as Record<string, unknown>,
    };
  }

  private async travarPeca(tx: Tx, id: string): Promise<Peca> {
    const peca = await tx
      .select()
      .from(pecas)
      .where(and(eq(pecas.id, id), isNull(pecas.deletedAt)))
      .for('update')
      .then((r) => r[0] ?? null);
    if (!peca) throw new NotFoundException('Peça não encontrada');
    return peca;
  }

  private async buscarAtiva(tx: Tx, id: string): Promise<Peca | null> {
    return tx
      .select()
      .from(pecas)
      .where(and(eq(pecas.id, id), isNull(pecas.deletedAt)))
      .then((r) => r[0] ?? null);
  }

  private async dataOperacaoDaPeca(tx: Tx, peca: Peca): Promise<string> {
    const r = await tx
      .select({ dataOperacao: operacoes.data })
      .from(recebimentos)
      .innerJoin(operacoes, eq(operacoes.id, recebimentos.operacaoId))
      .where(eq(recebimentos.id, peca.recebimentoId))
      .then((rows) => rows[0] ?? null);
    return r?.dataOperacao ?? '';
  }
}
```

**4.4** `pesagem.controller.ts` — o path é o da matriz (`POST /operacao/pesagem/trocas`), com o
`pecaRetiradaId` no corpo:

```ts
  // ── Troca de Peça (v1.1 §6.13) ─────────────────────────────────────────────
  @Post('trocas')
  @RequirePermissoes('ASSOCIACAO_GERENCIAR')
  trocar(
    @Body(new ZodValidationPipe(executarTrocaSchema)) dto: ExecutarTrocaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.troca.executar(dto, user.sub);
  }
```

com `private readonly troca: TrocaPecaService` no construtor e o import
`import { executarTrocaSchema, type ExecutarTrocaDto } from './dto/troca-peca.dto';`.

**4.5** `pesagem.module.ts`: acrescentar `TrocaPecaService` em `providers` e `exports`.

**4.6** `test/integration/troca-peca.e2e-spec.ts` cobrindo 6.1–6.6 com banco real. O cenário 6.3 é
determinístico: um `jest.spyOn(etiquetaService, 'emitirNaTx').mockRejectedValueOnce(new Error('impressao falhou'))`
faz o passo 8 estourar depois de os passos 3–7 já terem escrito; o teste assere, **após** a
rejeição, que `SELECT count(*) FROM trocas_peca` é `0`, que a etiqueta anterior continua `ativa`
(não `invalidada_por_troca`), que as duas peças voltaram ao `status_peca` e ao `pedido_venda_item_id`
originais e que **nenhum** evento foi publicado. `test/unit/pesagem-eventos.spec.ts` ganha o caso 6.7.

**Commit:** `feat(onda6): troca de peça atômica preservando pesos`

---

### Task 5 — Estorno de associação (`POST /operacao/pesagem/pecas/:id/estornar`)

**Files:** `dto/estorno.dto.ts` (novo), `associacao.service.ts`, `pesagem.controller.ts`,
`test/integration/estorno-associacao.e2e-spec.ts`, `test/unit/pesagem-eventos.spec.ts`.

**5.1** `dto/estorno.dto.ts` — motivos do modal “Cancelar ação realizada”
(`PesagemDestinacao.tsx:198-262`, lista literal na linha do `<select>`):

```ts
import { z } from 'zod';

export const MOTIVOS_ESTORNO = [
  'peso_incorreto',
  'pedido_incorreto',
  'destino_incorreto',
  'etiqueta_incorreta',
  'outro',
] as const;
export type MotivoEstorno = (typeof MOTIVOS_ESTORNO)[number];

export const ROTULOS_MOTIVO_ESTORNO: Record<MotivoEstorno, string> = {
  peso_incorreto: 'Peso informado incorretamente',
  pedido_incorreto: 'Pedido selecionado incorretamente',
  destino_incorreto: 'Destino selecionado incorretamente',
  etiqueta_incorreta: 'Etiqueta impressa incorretamente',
  outro: 'Outro',
};

export const estornarSchema = z
  .object({
    motivo: z.enum(MOTIVOS_ESTORNO),
    observacoes: z.string().trim().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.motivo === 'outro' && !v.observacoes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['observacoes'],
        message: 'observação é obrigatória quando o motivo é "Outro"',
      });
    }
  });
export type EstornarDto = z.infer<typeof estornarSchema>;
```

**5.2** `associacao.service.ts` — injetar `EtiquetaService` no construtor (não há ciclo:
`EtiquetaService` não importa `AssociacaoService`) e acrescentar, depois de `semCobertura`:

```ts
  /**
   * Estorno de destinação já confirmada (D6.3). Devolve a unidade ao item do pedido,
   * volta a peça para em_sobra, cancela a etiqueta vigente e grava histórico + auditoria.
   * Bloqueado com 409 depois que a carga fecha (D6.18). Exige ASSOCIACAO_ESTORNAR.
   */
  async estornar(pecaId: string, dto: EstornarDto, operadorId: string): Promise<Peca> {
    const resultado = await this.db.transaction(async (tx) => {
      const peca = await tx
        .select()
        .from(pecas)
        .where(and(eq(pecas.id, pecaId), isNull(pecas.deletedAt)))
        .for('update')
        .then((r) => r[0] ?? null);
      if (!peca) throw new NotFoundException('Peça não encontrada');
      if (peca.statusPeca !== 'associada' || !peca.pedidoVendaItemId) {
        throw new ConflictException('Só é possível estornar peça associada a um pedido');
      }
      if (await pecaEmCargaFechada(tx, pecaId)) {
        throw new ConflictException('Peça já está em carga fechada — estorno bloqueado');
      }

      const pedidoOrigemId = peca.pedidoVendaId;
      const pedidoItemOrigemId = peca.pedidoVendaItemId;

      // Devolve a unidade ao item do pedido (RF-PS-17: quantidade_atendida volta a caber).
      await devolverSaldo(tx, pedidoItemOrigemId);

      const atualizada = primeiroOuFalha(
        await tx
          .update(pecas)
          .set({
            statusPeca: 'em_sobra',
            pedidoVendaId: null,
            pedidoVendaItemId: null,
            observacoes: dto.observacoes ?? peca.observacoes,
          })
          .where(eq(pecas.id, pecaId))
          .returning(),
      );

      // "invalida a etiqueta anterior" — texto do protótipo em PesagemDestinacao.tsx:241.
      const etiquetaCancelada = await this.etiqueta.cancelarVigenteNaTx(tx, pecaId, dto.motivo, operadorId);

      await this.gravarHistorico(tx, {
        pecaId,
        acao: 'estorno',
        pedidoOrigemId,
        motivo: dto.motivo,
        operadorId,
      });

      await this.auditoria.registrar(tx, {
        tabela: 'pecas',
        registroId: pecaId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: peca,
        dadosNovos: atualizada,
      });

      return {
        peca: atualizada,
        pedidoOrigemId,
        pedidoItemOrigemId,
        etiquetaCancelada,
        dataOperacao: await this.dataOperacaoDaPeca(tx, peca),
      };
    });

    this.eventEmitter.emit(EVENTOS.PESAGEM_ESTORNADA, {
      pecaId,
      dataOperacao: resultado.dataOperacao,
      pedidoOrigemId: resultado.pedidoOrigemId,
      pedidoItemOrigemId: resultado.pedidoItemOrigemId,
      motivo: dto.motivo,
    });
    if (resultado.etiquetaCancelada) {
      this.eventEmitter.emit(EVENTOS.ETIQUETA_INVALIDADA, {
        etiquetaId: resultado.etiquetaCancelada.id,
        pecaId,
        dataOperacao: resultado.dataOperacao,
        estado: 'cancelada',
        motivo: dto.motivo,
      });
    }

    return resultado.peca;
  }
```

Ampliar o union de `gravarHistorico` (`associacao.service.ts:312`) para incluir os três valores
novos do CHECK:

```ts
      acao: 'confirmar' | 'redirecionar' | 'sobra' | 'analise' | 'corte' | 'divergencia'
        | 'estorno' | 'troca_saida' | 'troca_entrada';
```

**5.3** `pesagem.controller.ts`:

```ts
  @Post('pecas/:id/estornar')
  @RequirePermissoes('ASSOCIACAO_ESTORNAR')
  estornar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(estornarSchema)) dto: EstornarDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.associacao.estornar(id, dto, user.sub);
  }
```

**5.4** `test/integration/estorno-associacao.e2e-spec.ts` cobrindo 6.8–6.11. O caso 6.10 loga um
usuário com perfil `recebimento_pesagem` (que tem `ASSOCIACAO_GERENCIAR` e **não** tem
`ASSOCIACAO_ESTORNAR`, D6.19), executa `POST /operacao/pesagem/pecas/:id/confirmar` com **200** —
controle positivo, provando que o 403 seguinte é da permissão de estorno e não de sessão — e então
`POST /operacao/pesagem/pecas/:id/estornar` com **403**. O caso 6.11 semeia `carga_itens` +
`caminhoes` com `status_caminhao='fechado'` e espera 409. `pesagem-eventos.spec.ts` ganha o 6.37.

**Commit:** `feat(onda6): estorno auditado de associação com segregação de função`

---

### Task 6 — Ciclo de estado da etiqueta, `GET /operacao/etiquetas` e cancelamento

**Files:** `etiqueta.service.ts`, `dto/etiqueta.dto.ts`, `etiqueta.controller.ts` (novo),
`pesagem.module.ts`, `test/integration/etiqueta.e2e-spec.ts`.

**6.1** `dto/etiqueta.dto.ts` — acrescentar, ao lado do `resolverQrSchema` já existente:

```ts
export const ESTADOS_ETIQUETA = [
  'emitida',
  'ativa',
  'invalidada_por_troca',
  'reimpressa',
  'cancelada',
] as const;
export type EstadoEtiqueta = (typeof ESTADOS_ETIQUETA)[number];

/** Motivos do modal "Cancelar etiqueta e estornar ação" — EtiquetasRecebimento.tsx:330-333. */
export const MOTIVOS_CANCELAMENTO_ETIQUETA = [
  'peso_incorreto',
  'pedido_incorreto',
  'destino_incorreto',
  'etiqueta_incorreta',
  'peca_incorreta',
  'outro',
] as const;
export type MotivoCancelamentoEtiqueta = (typeof MOTIVOS_CANCELAMENTO_ETIQUETA)[number];

export const ROTULOS_MOTIVO_CANCELAMENTO_ETIQUETA: Record<MotivoCancelamentoEtiqueta, string> = {
  peso_incorreto: 'Peso informado incorretamente',
  pedido_incorreto: 'Pedido selecionado incorretamente',
  destino_incorreto: 'Destino selecionado incorretamente',
  etiqueta_incorreta: 'Etiqueta impressa incorretamente',
  peca_incorreta: 'Peça identificada incorretamente',
  outro: 'Outro',
};

export const cancelarEtiquetaSchema = z
  .object({
    motivo: z.enum(MOTIVOS_CANCELAMENTO_ETIQUETA),
    observacoes: z.string().trim().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.motivo === 'outro' && !v.observacoes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['observacoes'],
        message: 'observação é obrigatória quando o motivo é "Outro"',
      });
    }
  });
export type CancelarEtiquetaDto = z.infer<typeof cancelarEtiquetaSchema>;

/** Filtros da matriz linha 16 (`GET /operacao/etiquetas?filtros`). */
export const listarEtiquetasSchema = z.object({
  recebimentoId: z.string().uuid().optional(),
  estado: z.enum(ESTADOS_ETIQUETA).optional(),
  busca: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(30),
});
export type ListarEtiquetasDto = z.infer<typeof listarEtiquetasSchema>;
```

**6.2** `etiqueta.service.ts` — extrair a persistência de `emitir`/`reimprimir` para métodos
transacionais reusáveis e acrescentar os quatro métodos novos. `emitir()` e `reimprimir()` passam a
delegar, mantendo o contrato público intacto:

```ts
export interface ParametrosEmissaoNaTx {
  pecaId: string;
  codigo: string;
  payload: Record<string, unknown>;
  impressao: ResultadoImpressao;
  reimpressao: boolean;
  operadorId: string;
}

  /** Impressão física isolada — best-effort, nunca lança (ADR-010). Usada também pela troca. */
  async imprimirPayload(payload: Record<string, unknown>): Promise<ResultadoImpressao> {
    return this.impressora.imprimir(payload);
  }

  /**
   * Persiste a etiqueta LÓGICA dentro de uma transação existente. Estado inicial conforme
   * v1.1 §10.4: 'ativa' quando o gateway confirmou a impressão, 'emitida' caso contrário;
   * reimpressão confirmada nasce 'reimpressa'.
   */
  async emitirNaTx(tx: Tx, p: ParametrosEmissaoNaTx): Promise<Etiqueta> {
    const estado = p.impressao.impresso ? (p.reimpressao ? 'reimpressa' : 'ativa') : 'emitida';

    await tx.update(pecas).set({ etiquetaAtual: p.codigo }).where(eq(pecas.id, p.pecaId));

    const etiqueta = primeiroOuFalha(
      await tx
        .insert(etiquetasImpressoes)
        .values({
          pecaId: p.pecaId,
          payload: {
            ...p.payload,
            jobId: p.impressao.jobId,
            erro: p.impressao.erro ?? null,
            gateway_status: p.impressao.saude,
          },
          statusImpressao: p.impressao.impresso ? 'impressa' : 'falha_impressao',
          reimpressao: p.reimpressao,
          estado,
          operadorId: p.operadorId,
        })
        .returning(),
    );

    await this.auditoria.registrar(tx, {
      tabela: 'etiquetas_impressoes',
      registroId: etiqueta.id,
      operacao: 'INSERT',
      modulo: 'operacao',
      usuarioId: p.operadorId,
      dadosAnteriores: {},
      dadosNovos: etiqueta,
    });

    return etiqueta;
  }

  /** Etiqueta vigente da peça: última linha ainda não terminal. */
  private async buscarVigenteNaTx(tx: Tx, pecaId: string): Promise<Etiqueta | null> {
    return tx
      .select()
      .from(etiquetasImpressoes)
      .where(
        and(
          eq(etiquetasImpressoes.pecaId, pecaId),
          notInArray(etiquetasImpressoes.estado, ['cancelada', 'invalidada_por_troca']),
        ),
      )
      .orderBy(desc(etiquetasImpressoes.createdAt))
      .limit(1)
      .for('update')
      .then((r) => r[0] ?? null);
  }

  /** Passo 7 de §6.13: a etiqueta da peça retirada deixa de valer por causa da troca. */
  async invalidarPorTrocaNaTx(tx: Tx, pecaId: string, operadorId: string): Promise<Etiqueta | null> {
    const vigente = await this.buscarVigenteNaTx(tx, pecaId);
    if (!vigente) return null;
    return this.encerrarNaTx(tx, vigente, 'invalidada_por_troca', 'troca_peca', operadorId);
  }

  /** Cancelamento vindo do estorno de destinação (D6.3). */
  async cancelarVigenteNaTx(tx: Tx, pecaId: string, motivo: string, operadorId: string): Promise<Etiqueta | null> {
    const vigente = await this.buscarVigenteNaTx(tx, pecaId);
    if (!vigente) return null;
    return this.encerrarNaTx(tx, vigente, 'cancelada', motivo, operadorId);
  }

  private async encerrarNaTx(
    tx: Tx,
    vigente: Etiqueta,
    estado: 'cancelada' | 'invalidada_por_troca',
    motivo: string,
    operadorId: string,
  ): Promise<Etiqueta> {
    const encerrada = primeiroOuFalha(
      await tx
        .update(etiquetasImpressoes)
        .set({
          estado,
          motivoCancelamento: motivo,
          invalidadaEm: new Date(),
          invalidadaPorId: operadorId,
        })
        .where(eq(etiquetasImpressoes.id, vigente.id))
        .returning(),
    );

    await this.auditoria.registrar(tx, {
      tabela: 'etiquetas_impressoes',
      registroId: vigente.id,
      operacao: 'UPDATE',
      modulo: 'operacao',
      usuarioId: operadorId,
      dadosAnteriores: vigente,
      dadosNovos: encerrada,
    });

    return encerrada;
  }

  /** POST /operacao/etiquetas/:id/cancelar. Bloqueado depois que a carga fecha (D6.18). */
  async cancelar(etiquetaId: string, dto: CancelarEtiquetaDto, operadorId: string): Promise<Etiqueta> {
    const resultado = await this.db.transaction(async (tx) => {
      const alvo = await tx
        .select()
        .from(etiquetasImpressoes)
        .where(eq(etiquetasImpressoes.id, etiquetaId))
        .for('update')
        .then((r) => r[0] ?? null);
      if (!alvo) throw new NotFoundException('Etiqueta não encontrada');
      if (alvo.estado === 'cancelada' || alvo.estado === 'invalidada_por_troca') {
        throw new ConflictException('Etiqueta já está em estado terminal');
      }
      if (alvo.pecaId && (await pecaEmCargaFechada(tx, alvo.pecaId))) {
        throw new ConflictException('Peça já está em carga fechada — cancelamento bloqueado');
      }
      const encerrada = await this.encerrarNaTx(tx, alvo, 'cancelada', dto.motivo, operadorId);
      return { encerrada, dataOperacao: await this.dataOperacaoDaEtiqueta(tx, alvo) };
    });

    this.eventEmitter.emit(EVENTOS.ETIQUETA_INVALIDADA, {
      etiquetaId,
      pecaId: resultado.encerrada.pecaId!,
      dataOperacao: resultado.dataOperacao,
      estado: 'cancelada',
      motivo: dto.motivo,
    });

    return resultado.encerrada;
  }
```

`resolverQr` (`etiqueta.service.ts:246`) ganha, depois de resolver a peça, a checagem de estado
terminal — 6.13:

```ts
    const peca = await this.resolverPorCodigo(codigo);
    if (!peca) throw new NotFoundException('Código não corresponde a nenhuma peça');
    const vigente = await this.db
      .select({ estado: etiquetasImpressoes.estado })
      .from(etiquetasImpressoes)
      .where(eq(etiquetasImpressoes.pecaId, peca.id))
      .orderBy(desc(etiquetasImpressoes.createdAt))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (vigente && (vigente.estado === 'invalidada_por_troca' || vigente.estado === 'cancelada')) {
      throw new ConflictException(
        vigente.estado === 'invalidada_por_troca'
          ? 'Etiqueta invalidada por troca de peça — use a etiqueta vigente'
          : 'Etiqueta cancelada — não deve ser usada na operação',
      );
    }
    return peca;
```

`EtiquetaService` passa a receber `EventEmitter2` no construtor (para `ETIQUETA_INVALIDADA`).

**6.3** `listar()` — a linha 16 da matriz. Uma entrada por **peça com etiqueta**, com a linha
vigente no topo e o histórico completo dentro, exatamente como a interface `Etiqueta` do protótipo
(`EtiquetasRecebimento.tsx:22-46`, com `historico: HistoricoEvento[]`):

```ts
export interface EtiquetaListada {
  id: string;
  pecaId: string;
  codigo: string | null;
  estado: EstadoEtiqueta;
  statusImpressao: string;
  reimpressao: boolean;
  motivoCancelamento: string | null;
  invalidadaEm: string | null;
  bloqueada: boolean;
  pesoOriginal: string;
  statusPeca: string;
  recebimentoId: string;
  pedidoVendaId: string | null;
  operadorId: string;
  createdAt: string;
  historico: Array<{
    id: string;
    estado: string;
    statusImpressao: string;
    reimpressao: boolean;
    motivoCancelamento: string | null;
    operadorId: string;
    createdAt: string;
  }>;
}

/** Linha bruta da consulta — mesmo shape de `EtiquetaListada`, sem o array de histórico. */
type LinhaEtiqueta = Omit<EtiquetaListada, 'historico'>;

/**
 * Agrupa linhas (peça × etiqueta) por peça. `linhas` já vem ordenada por `createdAt DESC` pela
 * consulta de `listar()`, então a primeira ocorrência de cada `pecaId` é a etiqueta vigente
 * (D6.2) e as demais compõem o histórico completo. Função pura, módulo, testável sem I/O — mesmo
 * padrão de `carga-fechada.ts` (Task 4.2).
 */
export function agruparPorPeca(linhas: LinhaEtiqueta[]): EtiquetaListada[] {
  const porPeca = new Map<string, EtiquetaListada>();
  for (const linha of linhas) {
    const vigente = porPeca.get(linha.pecaId);
    if (!vigente) {
      porPeca.set(linha.pecaId, { ...linha, historico: [] });
      continue;
    }
    vigente.historico.push({
      id: linha.id,
      estado: linha.estado,
      statusImpressao: linha.statusImpressao,
      reimpressao: linha.reimpressao,
      motivoCancelamento: linha.motivoCancelamento,
      operadorId: linha.operadorId,
      createdAt: linha.createdAt,
    });
  }
  return [...porPeca.values()];
}

/**
 * Pagina um array já pronto em memória — a listagem já é filtrada por recebimento (D6.15) e a
 * maior carga observada é de ~200 peças por lote. Reusa o envelope de `montarPaginado`.
 */
export function paginarEmMemoria<T>(itens: T[], page: number, pageSize: number): Paginado<T> {
  const inicio = (page - 1) * pageSize;
  return montarPaginado(itens.slice(inicio, inicio + pageSize), itens.length, { page, pageSize });
}

  /**
   * `estado` NÃO entra no `WHERE` desta consulta: filtrar aqui truncaria o histórico e faria uma
   * linha antiga `ativa` aparecer como vigente de uma peça cuja etiqueta atual já é terminal —
   * violando a precedência de D6.2 (`cancelada`/`invalidada_por_troca` nunca "voltam" a ser uma
   * etiqueta ativa antiga) e RA-06. O histórico completo é sempre buscado por peça; o filtro de
   * `estado` só é aplicado DEPOIS de `agruparPorPeca` determinar qual linha é a vigente real.
   */
  async listar(filtros: ListarEtiquetasDto): Promise<Paginado<EtiquetaListada>> {
    const condicoes = [isNull(pecas.deletedAt), isNotNull(etiquetasImpressoes.pecaId)];
    if (filtros.recebimentoId) condicoes.push(eq(pecas.recebimentoId, filtros.recebimentoId));
    if (filtros.busca) {
      const q = `%${filtros.busca.toLowerCase()}%`;
      condicoes.push(sql`(lower(coalesce(${pecas.etiquetaAtual}, '')) LIKE ${q}
                          OR lower(${pecas.id}::text) LIKE ${q})`);
    }

    const linhas: LinhaEtiqueta[] = await this.db
      .select({
        id: etiquetasImpressoes.id,
        pecaId: pecas.id,
        // Código DESTA etiqueta, não o atual da peça (que muda após troca) — payload é o único
        // lugar que guarda o QR gravado no momento da emissão (emitir/reimprimir/emitirNaTx).
        codigo: sql<string | null>`${etiquetasImpressoes.payload}->>'qr'`,
        estado: etiquetasImpressoes.estado,
        statusImpressao: etiquetasImpressoes.statusImpressao,
        reimpressao: etiquetasImpressoes.reimpressao,
        motivoCancelamento: etiquetasImpressoes.motivoCancelamento,
        invalidadaEm: etiquetasImpressoes.invalidadaEm,
        bloqueada: etiquetaBloqueadaSql,
        pesoOriginal: pecas.pesoOriginal,
        statusPeca: pecas.statusPeca,
        recebimentoId: pecas.recebimentoId,
        pedidoVendaId: pecas.pedidoVendaId,
        operadorId: etiquetasImpressoes.operadorId,
        createdAt: etiquetasImpressoes.createdAt,
      })
      .from(etiquetasImpressoes)
      .innerJoin(pecas, eq(pecas.id, etiquetasImpressoes.pecaId))
      .where(and(...condicoes))
      .orderBy(desc(etiquetasImpressoes.createdAt));

    // Agrupa por peça (histórico completo, nunca truncado): a primeira linha (mais recente) é a
    // vigente; as demais viram histórico. O filtro de estado avalia a vigente JÁ DETERMINADA —
    // nunca uma linha isolada — então uma peça com vigente `cancelada` não some do resultado nem
    // "vira" `ativa` só porque teve uma linha `ativa` no passado.
    const agrupadas = agruparPorPeca(linhas);
    const filtradas = filtros.estado
      ? agrupadas.filter((e) => e.estado === filtros.estado)
      : agrupadas;
    return paginarEmMemoria(filtradas, filtros.page, filtros.pageSize);
  }
```

`agruparPorPeca` e `paginarEmMemoria` (acima) são funções puras de módulo, fora da classe, no
mesmo arquivo — importar `montarPaginado`/`Paginado` de `common/crud/paginacao` ao lado dos
demais imports do arquivo.

**6.4** `etiqueta.controller.ts` (novo) — resolve o bloqueante 5 fixando o prefixo:

```ts
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { EtiquetaService } from './etiqueta.service';
import {
  cancelarEtiquetaSchema,
  listarEtiquetasSchema,
  type CancelarEtiquetaDto,
  type ListarEtiquetasDto,
} from './dto/etiqueta.dto';

// Matriz de rastreabilidade v1.1, linha 16: GET /operacao/etiquetas?filtros e
// POST /operacao/etiquetas/:id/cancelar.
@SkipThrottle()
@Controller('operacao/etiquetas')
@UseGuards(JwtAuthGuard, RbacGuard)
export class EtiquetaController {
  constructor(private readonly etiqueta: EtiquetaService) {}

  @Get()
  @RequirePermissoes('PESAGEM_LER')
  listar(@Query(new ZodValidationPipe(listarEtiquetasSchema)) filtros: ListarEtiquetasDto) {
    return this.etiqueta.listar(filtros);
  }

  @Post(':id/cancelar')
  @RequirePermissoes('ETIQUETA_GERENCIAR')
  cancelar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cancelarEtiquetaSchema)) dto: CancelarEtiquetaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.etiqueta.cancelar(id, dto, user.sub);
  }
}
```

**6.5** `pesagem.module.ts`: `controllers: [PesagemController, EtiquetaController]`.

**6.6** Estender `test/integration/etiqueta.e2e-spec.ts` com 6.12, 6.13, 6.32 e 6.33.

**Commit:** `feat(onda6): ciclo de estado da etiqueta e leitura filtrada conforme v1.1 §10.4`

---

### Task 7 — Selo `prefCompativel` (D6.5)

**Files:** `associacao-score.ts`, `compatibilidade.ts`, `test/unit/associacao-score.spec.ts`.

**7.1** `associacao-score.ts` — o campo entra na peça, no candidato e no resultado, **sem** tocar
em nenhum dos quatro pesos nem no comparador de ordenação:

```ts
export interface PecaParaScore {
  itemComercialBaseId: string;
  /** Peso da peça como string NUMERIC(.,3). */
  pesoOriginal: string;
  /** Flags de pecas.captura_meta (D6.4): mais_pesada, mais_gorda, melhor_acabamento. */
  caracteristicas?: string[];
}

export interface PreferenciasCliente {
  faixaPesoMin?: number;
  faixaPesoMax?: number;
  perfilGordura?: string;
  /** Características preferidas do cliente, mesmos slugs de captura_meta. */
  caracteristicasPreferidas?: string[];
}

export interface SugestaoScored extends CandidatoPedido {
  score: number;
  justificativa: string;
  /**
   * D6.5 — SELO, não peso: interseção entre as características da peça e as preferências do
   * cliente. Não entra no score nem no desempate; o protótipo o usa como badge
   * (PesagemDestinacao.tsx:672). Nenhuma fonte define peso numérico para característica.
   */
  prefCompativel: boolean;
}
```

Dentro do laço de `calcularScores`, **depois** de todo o cálculo de `score` e imediatamente antes
do `scored.push`:

```ts
    const preferidas = c.preferencias.caracteristicasPreferidas ?? [];
    const daPeca = peca.caracteristicas ?? [];
    const prefCompativel = preferidas.length > 0 && preferidas.some((p) => daPeca.includes(p));

    scored.push({ ...c, score, justificativa: motivos.join('; '), prefCompativel });
```

O bloco `scored.sort(...)` (`associacao-score.ts:91-97`) **não** é alterado.

**7.2** `compatibilidade.ts`: `calcularCompativeisItem` passa `caracteristicas` lidas de
`pecas.captura_meta` e `caracteristicasPreferidas` lidas das preferências do cliente já
carregadas, sem nova consulta.

**7.3** `test/unit/associacao-score.spec.ts` › “marca prefCompativel sem alterar score nem
ordenação” compara, no mesmo conjunto de candidatos, a lista com e sem características e assere
igualdade item a item de `score` e da sequência de `pedidoVendaItemId`, mais o `prefCompativel`
correto em cada linha.

**Commit:** `feat(onda6): selo pref. compatível na sugestão de associação`

---

### Task 8 — Dívidas (h), (c) e (d) da NF do fornecedor

**Files:** `nota-fiscal-fornecedor.persistence.ts`, `recebimento.service.ts`,
`dto/pedido-fornecedor.dto.ts`, `test/integration/recebimento.e2e-spec.ts`,
`test/integration/recebimento-concorrencia.e2e-spec.ts`,
`test/unit/nota-fiscal-fornecedor.persistence.spec.ts`.

**8.1 (dívida h — D6.8).** O trecho atual, em `persistirNfCabecalhoUiNaTx`, carimba
`cabecalho_sem_itens` nos dois caminhos:

```ts
// nota-fiscal-fornecedor.persistence.ts:376-380 (patch de NF existente)
    patch.payloadJson = mesclarPayloadNfCabecalho(
      existente.payloadJson as Record<string, unknown> | null,
      campos,
      true,
    );

// nota-fiscal-fornecedor.persistence.ts:400 (INSERT de cabeçalho novo)
  const payloadJson = mesclarPayloadNfCabecalho(null, campos, true);
```

O primeiro passa a consultar a contagem real; o segundo é sempre verdadeiro porque o `INSERT`
nasce sem item, mas fica explícito em vez de literal mágico:

```ts
    const itensAtivos = await contarItensNfAtivos(tx, existente.id);
    patch.payloadJson = mesclarPayloadNfCabecalho(
      existente.payloadJson as Record<string, unknown> | null,
      campos,
      itensAtivos === 0,
    );
```

```ts
  // Cabeçalho recém-criado nasce sem item; a contagem é zero por construção.
  const payloadJson = mesclarPayloadNfCabecalho(null, campos, /* itensAtivos === 0 */ true);
```

**8.2 (dívida c — D6.9).** `buscarCabecalhoParaCompletar` passa a devolver também a divergência:

```ts
export interface CabecalhoOrfaoEncontrado {
  nf: typeof notasFiscaisFornecedor.$inferSelect;
  /** true quando o órfão foi achado pelo recebimento, com numero diferente do informado. */
  numeroDivergente: boolean;
}

async function buscarCabecalhoParaCompletar(
  tx: Tx,
  recebimentoId: string,
  numero: string,
): Promise<CabecalhoOrfaoEncontrado | null> {
  const porNumero = await buscarNfCabecalhoAtivaPorNumero(tx, recebimentoId, numero);
  if (porNumero) return { nf: porNumero, numeroDivergente: false };
  const porRecebimento = await buscarNfCabecalhoAtivaPorRecebimento(tx, recebimentoId);
  if (!porRecebimento) return null;
  return { nf: porRecebimento, numeroDivergente: porRecebimento.numero !== numero };
}
```

e `persistirNfEstruturadaNaTx` (`:311-318`) exige a confirmação antes de renumerar:

```ts
  const cabecalhoOrfao = await buscarCabecalhoParaCompletar(tx, recebimentoId, dto.numero);
  if (cabecalhoOrfao) {
    if (cabecalhoOrfao.numeroDivergente && !dto.confirmarSubstituicaoCabecalho) {
      throw new ConflictException({
        codigo: 'CABECALHO_ORFAO_DIVERGENTE',
        message:
          `A NF ${dto.numero} não corresponde ao cabeçalho ${cabecalhoOrfao.nf.numero} já aberto `
          + 'neste recebimento. Confirme a substituição para renumerar.',
        numeroInformado: dto.numero,
        numeroCabecalhoExistente: cabecalhoOrfao.nf.numero,
      });
    }
    if (cabecalhoOrfao.numeroDivergente) {
      await auditoria.registrar(tx, {
        tabela: 'notas_fiscais_fornecedor',
        registroId: cabecalhoOrfao.nf.id,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId,
        dadosAnteriores: { evento: 'NF_CABECALHO_RENUMERADO', numero: cabecalhoOrfao.nf.numero },
        dadosNovos: { evento: 'NF_CABECALHO_RENUMERADO', numero: dto.numero },
      });
    }
    return completarCabecalhoComItensNaTx(tx, auditoria, {
      existente: cabecalhoOrfao.nf,
      dto,
      usuarioId,
    });
  }
```

`dto/pedido-fornecedor.dto.ts` ganha o campo no `registrarNfSchema`:

```ts
  /** D6.9 — sem isto, renumerar cabeçalho órfão responde 409 CABECALHO_ORFAO_DIVERGENTE. */
  confirmarSubstituicaoCabecalho: z.boolean().optional().default(false),
```

**8.3 (dívida d — D6.10).** Os dois `SELECT` de cabeçalho órfão passam a travar a linha, o que faz
a segunda transação concorrente esperar e, ao acordar, enxergar a NF já com itens — caindo no
caminho de 409 em vez de completar o mesmo órfão:

```ts
async function buscarNfCabecalhoAtivaPorNumero(tx: Tx, recebimentoId: string, numero: string) {
  const candidatas = await tx
    .select()
    .from(notasFiscaisFornecedor)
    .where(and(
      eq(notasFiscaisFornecedor.recebimentoId, recebimentoId),
      eq(notasFiscaisFornecedor.numero, numero),
      isNull(notasFiscaisFornecedor.deletedAt),
    ))
    .orderBy(desc(notasFiscaisFornecedor.createdAt))
    .for('update');            // D6.10 — serializa concorrentes sobre o mesmo cabeçalho

  for (const nf of candidatas) {
    if (await contarItensNfAtivos(tx, nf.id) === 0) return nf;
  }
  return null;
}
```

O mesmo `.for('update')` entra em `buscarNfCabecalhoAtivaPorRecebimento`. `buscarNfParaAtualizarCabecalhoUi`
(caminho de PATCH, `:181`) **não** muda: ele não completa cabeçalho com itens.
`completarCabecalhoComItensNaTx` já roda dentro da transação de `registrarNf`, então nenhum
`db.transaction` novo é aberto.

**8.4** Testes 6.17–6.20 nos arquivos citados no mapa, mais os cinco casos de 6.22 (D6.20).

**8.5 (fecha o bloqueante B do Portão 1 — DoD 6.22).** `montarPatchCabecalhoUi` (`:212`) e
`extrairPayloadNfUi` (`:41`) ganham `export`, no mesmo precedente das quatro puras já exportadas
neste arquivo (`temCamposNfEstruturados`, `mesclarPayloadNfCabecalho`, `mesclarPayloadNfCompleta`,
`mapearCamposNfParaRegistrar`). Sem isso os dois casos nomeados em 6.22 não compilam:
`montarPatchCabecalhoUi` só tem chamador dentro de `persistirNfCabecalhoUiNaTx` — função
transacional inalcançável por `test/unit` sem banco — e o parâmetro `extras` de
`extrairPayloadNfUi` nunca é passado por nenhum chamador real, então o ramo "preserva extras" do
caso 6.22 ficaria intestável mesmo passando pelo wrapper `mapearCamposNfParaRegistrar`.

```ts
// nota-fiscal-fornecedor.persistence.ts:41 — ganha `export`, assinatura inalterada.
export function extrairPayloadNfUi(
  dto: Partial<NfCamposUi>,
  extras?: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...extras };
  if (dto.nfeVolumes !== undefined) payload.volumes = dto.nfeVolumes;
  if (dto.nfePesoLiquido !== undefined) payload.pesoLiquido = dto.nfePesoLiquido;
  return payload;
}
```

```ts
// nota-fiscal-fornecedor.persistence.ts:212 — ganha `export`, assinatura inalterada.
export function montarPatchCabecalhoUi(
  campos: Partial<NfCamposUi>,
  existente?: typeof notasFiscaisFornecedor.$inferSelect,
): Partial<typeof notasFiscaisFornecedor.$inferInsert> {
  const patch: Partial<typeof notasFiscaisFornecedor.$inferInsert> = {};
  if (campos.nfeSerie !== undefined) patch.serie = campos.nfeSerie;
  if (campos.nfeChave !== undefined) patch.chave = campos.nfeChave;
  if (campos.nfeDataEmissao !== undefined) patch.dataEmissao = campos.nfeDataEmissao;
  if (campos.nfePesoBruto !== undefined) {
    patch.pesoTotalDeclarado = formatarQtd(campos.nfePesoBruto);
  } else if (existente) {
    patch.pesoTotalDeclarado = existente.pesoTotalDeclarado;
  }
  return patch;
}
```

**Commit:** `fix(onda6): quita dívidas h/c/d de NF do fornecedor da Onda 1`

---

### Task 9 — Dívida (a): gate ACMR alcança `*.persistence.ts`

**Files:** `scripts/check-coverage-lib.mjs`, `scripts/check-coverage.test.mjs`.

**9.1** `check-coverage-lib.mjs:20` — pathspec de git não expande `{a,b}`, então é uma **segunda
entrada** na lista, não uma chave:

```js
    `${baseRef}...HEAD`,
    '--',
    ':(glob)app/backend/src/**/*.service.ts',
    ':(glob)app/backend/src/**/*.persistence.ts',
  ],
```

**9.2** `check-coverage.test.mjs` — o caso existente “considera apenas services presentes no
resultado ACMR do diff” já assere o array de argumentos e passa a falhar; atualizar a asserção e
acrescentar o caso 6.21:

```js
test('glob de cobertura por arquivo inclui persistence.ts', () => {
  let invocation;
  listChangedServices('base-sha', {
    execute(command, args, options) {
      invocation = { command, args, options };
      return 'app/backend/src/modules/operacao/recebimento/nota-fiscal-fornecedor.persistence.ts\n';
    },
  });
  assert.ok(invocation.args.includes(':(glob)app/backend/src/**/*.service.ts'));
  assert.ok(invocation.args.includes(':(glob)app/backend/src/**/*.persistence.ts'));
});
```

**9.3** Completar `test/unit/nota-fiscal-fornecedor.persistence.spec.ts` com os cinco casos
nomeados em 6.22 até o arquivo passar o próprio gate (≥80% linha **e** branch). O arquivo hoje tem
6 casos cobrindo só as quatro funções puras exportadas; a Task 8.5 exporta `montarPatchCabecalhoUi`
e `extrairPayloadNfUi`, e os cinco novos casos **importam as duas diretamente** (sem passar por
função transacional) e cobrem os ramos de `temCamposNfEstruturados`.

**Commit:** `test(onda6): estende gate ACMR e cobre a persistência de NF`

---

### Task 10 — Contrato `number | null` (dívida f) e os handlers BFF (dívida e)

**Files:** `recebimento.service.ts`, `app/frontend/src/lib/operacao.ts`, 4 rotas BFF novas,
`app/api/operacao/recebimentos/[id]/nf/route.ts` (remover), `__tests__/bff-onda6.test.ts`.

**10.1 (dívida f, backend).** `recebimento.service.ts:282-285` — trocar os dois spreads
condicionais, que **omitem a chave**, por chaves sempre presentes:

```ts
      nfePesoBruto: nfAtiva?.pesoTotalDeclarado ?? null,
      nfePesoLiquido:
        payloadNf?.pesoLiquido !== undefined ? formatarQtd(payloadNf.pesoLiquido) : null,
      nfeVolumes: payloadNf?.volumes ?? null,
      itens: itensEnriquecidos,
```

**10.2 (dívida f, frontend).** `lib/operacao.ts:83` — o tipo passa a dizer a verdade
(`payload_json.volumes` é gravado como número em `nota-fiscal-fornecedor.persistence.ts:46`):

```ts
  nfePesoLiquido: string | null;
  nfeVolumes: number | null;
```

`lib/operacao.ts:156` (`nfeVolumes?: number` em `IniciarRecebimentoPayload`) **não** muda: é o
payload de **entrada**, espelho de `volumesNfSchema` no DTO Zod. `recebimento-carga-client.tsx:301`
(`nfeVolumes: d.nfeVolumes ?? ''`) já tolera `null`, mas o `??` passa a receber `number`, então a
linha vira `String(d.nfeVolumes ?? '')`; `:798` (`{detalhe.nfeVolumes ?? '—'}`) continua correta.

**10.3** `lib/operacao.ts` — tipos das rotas novas, ao lado dos de pesagem já existentes:

```ts
// ── Onda 6 — troca, estorno e ciclo da etiqueta ───────────────────────────────

export type DestinoRetirada = 'estoque' | 'desossa';

export interface ExecutarTrocaPayload {
  pecaRetiradaId: string;
  pecaInseridaId: string;
  pedidoVendaItemId: string;
  destinoRetirada: DestinoRetirada;
  motivo: string;
  observacoes?: string;
}

export interface ResultadoTroca {
  troca: { id: string; createdAt: string };
  pecaRetirada: Peca;
  pecaInserida: Peca;
  etiquetaInvalidada: { id: string; motivoCancelamento: string | null } | null;
  etiquetaEmitida: { id: string; statusImpressao: string };
}

export type EstadoEtiqueta =
  | 'emitida'
  | 'ativa'
  | 'invalidada_por_troca'
  | 'reimpressa'
  | 'cancelada';

export interface EtiquetaListada {
  id: string;
  pecaId: string;
  codigo: string | null;
  estado: EstadoEtiqueta;
  statusImpressao: 'impressa' | 'falha_impressao' | 'pendente';
  reimpressao: boolean;
  motivoCancelamento: string | null;
  invalidadaEm: string | null;
  bloqueada: boolean;
  pesoOriginal: string;
  statusPeca: string;
  recebimentoId: string;
  pedidoVendaId: string | null;
  operadorId: string;
  createdAt: string;
  historico: Array<{
    id: string;
    estado: EstadoEtiqueta;
    statusImpressao: string;
    reimpressao: boolean;
    motivoCancelamento: string | null;
    operadorId: string;
    createdAt: string;
  }>;
}
```

**10.4** As quatro rotas BFF. Todas usam o par `apiFetch` + `responderBruto` de
`app/api/operacao/recebimentos/route.ts:1-13`, e **não** o `fetchBackend` de
`pecas/[id]/confirmar/route.ts:9`: o corpo do 409 de estorno/cancelamento carrega `codigo`
(`CABECALHO_ORFAO_DIVERGENTE` e afins) e precisa chegar íntegro à tela.

`app/api/operacao/pesagem/trocas/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

// BFF: Troca de Peça (v1.1 §6.13). Repasse puro — a atomicidade é do backend (RA-01).
export async function POST(req: NextRequest) {
  const upstream = await apiFetch('/operacao/pesagem/trocas', {
    method: 'POST',
    body: await req.text(),
  });
  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
```

`app/api/operacao/pesagem/pecas/[id]/estornar/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

// BFF: estorno de destinação. O 403 de segregação e o 409 de carga fechada passam íntegros.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const upstream = await apiFetch(`/operacao/pesagem/pecas/${id}/estornar`, {
    method: 'POST',
    body: await req.text(),
  });
  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
```

`app/api/operacao/etiquetas/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

// BFF: matriz linha 16 — GET /operacao/etiquetas?filtros. Query string repassada sem reescrita.
export async function GET(req: NextRequest) {
  const upstream = await apiFetch(`/operacao/etiquetas${req.nextUrl.search}`);
  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
```

`app/api/operacao/etiquetas/[id]/cancelar/route.ts`: idêntico ao de `estornar`, com o path
`/operacao/etiquetas/${id}/cancelar`.

**10.5 (dívida e).** Remover `app/frontend/src/app/api/operacao/recebimentos/[id]/nf/route.ts`
(o diretório `[id]/nf/` fica vazio e vai junto). A tela passa a usar
`POST /api/operacao/pedidos-fornecedor/:id/nf`, que já existe e é o caminho com itens
estruturados. `[id]/nfe/route.ts` **permanece** — é o PATCH de cabeçalho da UI.

**10.6** `__tests__/bff-onda6.test.ts` cobre 6.24 e 6.25: o primeiro caso faz
`existsSync` do arquivo removido; o segundo dá `mock` em `apiFetch` e assere, para cada uma das
quatro rotas, o path chamado, o método e que o `status` devolvido é o mesmo do upstream (inclusive
403 e 409), sem nenhum `if` de regra no handler.

**Commit:** `feat(onda6): rotas BFF de troca, estorno e etiquetas e contrato nfeVolumes`

---

### Task 11 — Telas fiéis ao protótipo e jornada E2E

**Files:** `troca-peca-modal.tsx`, `etiquetas-client.tsx`, `pesagem-destinacao-client.tsx`,
`recebimento-carga-client.tsx`, 5 arquivos de teste de front.

**11.1 `troca-peca-modal.tsx` (hoje casca da Onda 2, 176 linhas, sem chamada de rede).** Os 6
passos e o layout vêm de `TrocaPeca.tsx`; a mudança é ligar o passo final ao backend:

```tsx
  const confirmar = async () => {
    setEnviando(true);
    setErro(null);
    const res = await fetch('/api/operacao/pesagem/trocas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        pecaRetiradaId: pecaRetirada.id,
        pecaInseridaId: pecaInserida.id,
        pedidoVendaItemId,
        destinoRetirada,
        motivo,
        ...(observacoes.trim() ? { observacoes: observacoes.trim() } : {}),
      } satisfies ExecutarTrocaPayload),
    });
    setEnviando(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      setErro(body.message ?? 'Não foi possível concluir a troca');
      return;
    }
    setResultado((await res.json()) as ResultadoTroca);
    setPasso(6);
    onTrocaConcluida?.();
  };
```

O passo 6 exibe o resultado vindo do backend — nada calculado na tela:

```tsx
      {passo === 6 && resultado && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-[13px] font-semibold">Troca concluída</span>
          </div>
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Etiqueta invalidada</dt>
              <dd className="font-mono">
                {resultado.etiquetaInvalidada
                  ? resultado.etiquetaInvalidada.id.slice(0, 8)
                  : 'nenhuma'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Nova etiqueta</dt>
              <dd className="font-mono">{resultado.etiquetaEmitida.id.slice(0, 8)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Peça retirada</dt>
              <dd>{rotuloDestinoPeca(resultado.pecaRetirada.statusPeca)}</dd>
            </div>
          </dl>
          {resultado.etiquetaEmitida.statusImpressao !== 'impressa' && (
            <p role="alert" className="text-[12px] text-amber-700">
              Nova etiqueta registrada, mas a impressora não confirmou — reimprima pela tela de
              Etiquetas.
            </p>
          )}
        </div>
      )}
```

Os motivos do `<select>` do passo de motivo passam a vir de `ROTULOS_MOTIVO_TROCA_PECA`, mantendo
os mesmos textos de `TrocaPeca.tsx:79-86` com os slugs do CHECK — um único lugar define a lista.

**11.2 `etiquetas-client.tsx` (255 linhas).** Hoje lista **peças**
(`/api/operacao/pesagem/recebimentos/:id/pecas`, linha 61) e não tem estado de etiqueta, filtro de
estado, cancelamento nem histórico. Passa a consumir `GET /api/operacao/etiquetas`:

```tsx
// Derivação D6.2: domínio v1.1 §10.4 → os 5 rótulos de EtiquetasRecebimento.tsx:13.
// "Bloqueada" vence Ativa/Reimpressa; estados terminais nunca viram Bloqueada.
export function rotuloEtiqueta(e: EtiquetaListada): string {
  if (e.estado === 'cancelada') return 'Cancelada';
  if (e.estado === 'invalidada_por_troca') return 'Cancelada';
  if (e.estado === 'emitida') return 'Pendente de impressão';
  if (e.bloqueada) return 'Bloqueada';
  return e.estado === 'reimpressa' ? 'Reimpressa' : 'Ativa';
}

// EtiquetasRecebimento.tsx:366-367 — as duas regras de habilitação dos botões do drawer.
export const cancelavel = (e: EtiquetaListada) =>
  !e.bloqueada && ['ativa', 'reimpressa', 'emitida'].includes(e.estado);
export const reimprimivel = (e: EtiquetaListada) =>
  e.estado !== 'cancelada' && e.estado !== 'invalidada_por_troca';
```

As duas funções ficam exportadas no topo do arquivo, puras, para o teste 6.29 exercitá-las sem
render. A tabela ganha a coluna **Status** com `rotuloEtiqueta`, o filtro de estado
(`<Select>` com os cinco estados de domínio, enviado como `?estado=`), o drawer ganha o histórico
em timeline (`EtiquetasRecebimento.tsx:462`, alimentado por `etiqueta.historico`) e o bloco
vermelho de motivo quando cancelada (`:384`), e o rodapé ganha o botão **Cancelar etiqueta**
(`:489-492`) abrindo o modal de `:308-313` — o aviso “irá invalidá-la e estornar a ação
operacional vinculada” é literal do protótipo.

O drawer ganha também o **preview da etiqueta** (`LabelPreview` do protótipo,
`EtiquetasRecebimento.tsx:185-224`) — mesmo layout do cartão, mas só com os campos que
`GET /operacao/etiquetas` realmente devolve: código (`etiqueta.codigo`), peso
(`etiqueta.pesoOriginal`), destino (`rotuloDestinoPeca(etiqueta.statusPeca)`, o mesmo helper de
`@/lib/status-ui` já usado pela tabela atual e por `troca-peca-modal.tsx` na Task 11.1 — sem regra
nova), operador e emissão (`etiqueta.createdAt`). O protótipo também mostra produto/lote/NF-e/
origem, que `EtiquetaListada` não modela hoje — nota honesta (Princípio VIII): nenhum desses
quatro campos é inventado ou mockado; o preview simplesmente não os renderiza até uma onda futura
estender o contrato. O botão
**Reimprimir** (habilitado por `reimprimivel`) abre o modal `:227-296`, que distingue "Imprimir
etiqueta pendente" de "Reimprimir etiqueta" conforme `estado === 'emitida'` e exige motivo só no
segundo caso. O modal chama a rota BFF **já existente**
`POST /api/operacao/pesagem/pecas/:pecaId/etiqueta/reimprimir` (que repassa a
`EtiquetaService.reimprimir()` de `etiqueta.service.ts:93`, já implementada) — nenhum endpoint
novo, backend ou BFF, é criado para isto.

**11.3 `pesagem-destinacao-client.tsx` (956 linhas).** Acrescentar: os chips de característica
alimentando `captura_meta` (já existem em `:333-335`, agora também enviados na sugestão), o selo
**pref. compatível** ao lado do candidato quando `sugestao.prefCompativel`
(`PesagemDestinacao.tsx:672`), e o modal “Cancelar ação realizada” (`:198-262`) chamando
`POST /api/operacao/pesagem/pecas/:id/estornar` com `ROTULOS_MOTIVO_ESTORNO`. O botão de estorno só
renderiza com `permissoes.includes('ASSOCIACAO_ESTORNAR')` — a tela não decide a regra, só evita
oferecer o que vai voltar 403 (D6.19).

**11.4 `recebimento-carga-client.tsx` (1264 linhas).** Ligar a captura de itens da NF a
`POST /api/operacao/pedidos-fornecedor/:id/nf` e a conclusão a `/conferencia/concluir` (dívida b),
ajustar a leitura de `nfeVolumes` conforme 10.2, e completar os blocos do protótipo cobrados por
6.26: os 7 status de lote, o comparativo Pedido × NF × Pesagem, a conclusão obrigatória, a entrada
direta, o cancelar lote e o drawer de novo recebimento.

**11.5** Testes: `recebimento.test.tsx` (6.26, 6.38-front), `pesagem.test.tsx` (6.27),
`troca-peca-modal.test.tsx` (**estende** o arquivo já existente, 6.28),
`etiquetas-recebimento.test.tsx` (novo, 6.29), `terminologia.test.ts` (6.30) e
`e2e/onda6-recebimento.spec.ts` (6.23, 6.31).

**Commit:** `feat(onda6): telas de recebimento, pesagem e etiquetas fiéis ao protótipo`

## Ordem de execução

1 → 2 (migrations) → 3 (contratos compartilhados) → 4, 5, 6 (backend de domínio, nesta ordem: 6
depende dos métodos transacionais que 4 usa) → 7 → 8 → 9 → 10 → 11. As tasks 7, 8 e 9 são
independentes entre si e podem ir em paralelo depois da 3.

## Fora de escopo

- Segundo endpoint de acumuladores (D6.17) e coluna `caracteristicasJson` (D6.4).
- Estágio de contract: a onda é aditiva (D6.13).
- Peso numérico para característica no score (D6.5) e coluna de bloqueio (D6.18).
- Qualquer alteração em `chk_pecas_status` ou em migrations anteriores a `0021`.
