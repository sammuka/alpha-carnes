# Onda 8 — Estoque — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para implementar este plano task a task. Steps usam checkbox (`- [ ]`).
> Workers seguem o plano LITERALMENTE: não decidem regra de negócio, não improvisam. `old_string` não casa / teste falha após 1 correção / caso não coberto → PARAR e reportar.

**Goal:** Fechar as três rotas de Estoque (matriz linhas 20–22): Consulta de Estoque fiel (2 abas, FIFO como sugestão parametrizável P3, destinar a pedido, reimprimir, histórico), Entrada de Itens (caixarias por unidade, destino estoque ou pedido) e Ajustes de Estoque (alçada por limiar parametrizado, segregação criador≠aprovador integrada a `aprovacoes_operacionais`).

**Architecture:** Extensão do módulo `operacao/estoque` existente (`estoque-consulta.service.ts` + `estoque.controller.ts`). Nascem `entradas_itens` e `ajustes_estoque` (migration `0024` expand). Destinar reusa `consumirSaldo`/`devolverSaldo` de `pesagem/saldo.ts` e grava `associacoes_peca_historico` (CHECK de `acao` estendido com `destinar_estoque`). Ajuste relevante abre `aprovacoes_operacionais` tipo `ajuste_estoque_relevante` (já existe no CHECK — Onda 5) via `AprovacoesService`. Eventos novos no catálogo RA-04. Frontend substitui os 2 PlaceholderPage e reescreve a consulta fiel ao protótipo.

**Tech Stack:** NestJS 11 + TS 5 strict, Drizzle (PostgreSQL 18, `uuidv7()`), Zod 4, `@nestjs/event-emitter` + hub WS nativo, Jest (integration com Postgres efêmero), Next.js 16 App Router (BFF) + React 19 + shadcn/ui + Playwright.

**Base tip:** `origin/develop` @ `43d340f` (Onda 7 mergeada). Migration desta onda: **`0024`**. Protótipo pinado: `F:\Projetos\alpha-carnes-prototipo` @ `feature/completude-v1.1` `8d32aa4c`.

**Branch:** `feature/onda8-estoque` → PR para `develop`. Pode rodar em paralelo com a Onda 9 (worktrees separados; nenhum arquivo em comum — ver "Colisões" abaixo).

## Emenda 1 — Portão 1 (veredito `ajustar` 2026-08-01T20:41:23-03:00)

Fecha os 2 achados do Portão 1, item a item:

| # | Achado | Fechamento nesta emenda |
|---|---|---|
| 1 | D8.13/Task 1 Step 2 reescreviam `chk_assoc_hist_acao` descartando `'estorno'`,`'troca_saida'`,`'troca_entrada'` (Onda 6, migration 0021) — quebraria Estorno e Troca de Peça em produção (`associacao.service.ts:327`, `troca-peca.service.ts:163/171`) | D8.13 e Task 1 Step 2 corrigidos: a nova lista do CHECK **herda os 9 valores atuais** e só ADICIONA `'destinar_estoque'` → `('confirmar','redirecionar','sobra','analise','corte','divergencia','estorno','troca_saida','troca_entrada','destinar_estoque')` |
| 2 | D8.12 citava linhas erradas das rotas de reimpressão | Corrigido: peça = `pesagem.controller.ts:135`; subitem = `corte.controller.ts:196` |

---

## Global Constraints (herda constituição + plano mestre)

1. Regra de negócio só no backend (RA-01): saldo, FIFO, limiar, segregação — nada disso no client.
2. Mutação crítica em `db.transaction` + `auditoria.registrar(tx, …)` no MESMO escopo (RA-02).
3. Eventos SEMPRE pós-commit (`eventEmitter.emit` fora do callback da transação); broadcast só via handlers do `realtime.gateway.ts` (hub nativo — **proibido** `server.to().emit`). Zero `setInterval`/polling (RA-04).
4. Nenhuma falha silenciosa: `!res.ok` no client → `setErro`; nenhum `catch {}` vazio; nenhum `success: true` em caminho de erro (RA-05/06).
5. Envelope de listagem paginada = `{ data, total, page, pageSize }` via `montarPaginado`; **proibido** `itens`.
6. Convenções de schema (`docs/data/convencoes-schema.md`): uuidv7, TIMESTAMPTZ, NUMERIC(10,3) p/ pesos, TEXT+CHECK (nunca pg ENUM), soft delete `deleted_at`, `created_at`/`updated_at`.
7. Grep "Marca" como rótulo = 0 (Princípio IX). Terminologia: "Buscar cliente".
8. Cores só via tokens do DS Onda 2; zero hex avulso novo nas telas.
9. Testes: guarda por fixture ausente → `throw new Error(...)` (nunca `return`); teste de erro que muda estado asserta corpo E ausência de persistência; todo lock/UPDATE condicional novo tem teste de concorrência real em Postgres; mock de `update().set()` captura e asserta o argumento.
10. Pendências (Princípio VIII): P3 (§16.4 FIFO) permanece parâmetro + badge; **proibido** fixar ordem FIFO como regra imutável; **proibido** inventar validade/peso médio/local-entidade.

## Escopo

- Backend: consulta ampliada (joins de origem/NF/pedido/características + mapa de status), `POST /estoque/destinar`, `GET /estoque/:tipo/:id/historico`, CRUD de entradas, ajustes com alçada, RBAC AD-04, eventos, migration `0024`, seed do parâmetro de limiar.
- Frontend: 3 telas fiéis (`/estoque/consulta` com 2 abas, `/estoque/entrada-itens`, `/estoque/ajustes`), BFF, refetch por WS.
- Testes: mapa DoD 8.1–8.16 + e2e Playwright + evidências fail-hard.

## Fora de escopo

- Onda 9 (Carga) e Onda 10 (Faturamento).
- Modelagem real de local/câmara de estoque (AD-09 continua: badge Provisório onde a UI exibir local derivado).
- Congelamento como fluxo transacional (aba Sobras & Congelamento entra fiel com dados reais deriváveis + provisórios sinalizados — ver D8.7).
- Peso médio por produto (previsões de kg).

## Colisões com Onda 9 (paralelismo 8∥9)

Arquivos compartilhados que AMBAS tocam: `app/backend/src/realtime/events/eventos.ts`, `realtime.gateway.ts`, `common/rbac/permissoes.ts`, `database/schema/index.ts`, seed. Regra: Onda 8 usa migration `0024`; **Onda 9 usa `0025`** e rebase obrigatório sobre o merge da 8 (ou vice-versa — quem mergear primeiro define; a segunda onda rebase e renumera se preciso). Conflitos nesses 5 arquivos são triviais (adições disjuntas) e resolvidos no rebase pelo Executor, nunca pelo Worker sem reporte.

## Rotas da onda (matriz de rastreabilidade v1.1)

| Linha | Rota | Situação no tip | Ação |
|---|---|---|---|
| 20 | `/estoque/consulta` | Backend parcial (`GET /estoque/consulta` só `em_sobra`, sem joins) + client básico | Reescrever fiel |
| 21 | `/estoque/entrada-itens` | PlaceholderPage | Criar completa |
| 22 | `/estoque/ajustes` | PlaceholderPage | Criar completa |

## Contrato de rotas — path literal

| Método/Path (backend) | Permissão | Descrição |
|---|---|---|
| `GET /estoque/consulta?status=&produtoId=&local=&search=` | `ESTOQUE_LER` | Posição física com joins (D8.2) e ordenação FIFO-sugestão (D8.3) |
| `POST /estoque/destinar` | `ESTOQUE_GERENCIAR` | Destina peça/subitem/entrada `em estoque` a item de pedido (D8.4) |
| `GET /estoque/:tipo/:id/historico` | `ESTOQUE_LER` | Timeline do item (`tipo` ∈ `peca\|subitem\|entrada`) (D8.5) |
| `GET /estoque/entradas?page=&pageSize=` | `ESTOQUE_LER` | Lista entradas do dia (paginado `{data,…}`) |
| `POST /estoque/entradas` | `ESTOQUE_ENTRADA` | Registra entrada de caixaria (destino estoque\|pedido) (D8.6) |
| `GET /estoque/ajustes?page=&pageSize=&status=` | `ESTOQUE_LER` | Lista ajustes (paginado) |
| `POST /estoque/ajustes` | `ESTOQUE_AJUSTAR` | Cria ajuste; acima do limiar → `aguardando_aprovacao` + aprovação operacional (D8.8) |
| `POST /estoque/ajustes/:id/aprovar` | `ESTOQUE_AJUSTE_APROVAR` | Aprova e aplica (criador ≠ aprovador) (D8.9) |
| `POST /estoque/ajustes/:id/rejeitar` | `ESTOQUE_AJUSTE_APROVAR` | Rejeita (criador ≠ aprovador; motivo obrigatório) |

BFF (Next.js, repasse puro com `repassar`/`fetchBackend` — padrão `api/operacao/...`): `GET/POST /api/operacao/estoque/consulta|destinar|entradas|ajustes|ajustes/[id]/aprovar|ajustes/[id]/rejeitar|[tipo]/[id]/historico`.

## Referências do protótipo (`F:\Projetos\alpha-carnes-prototipo` @ `feature/completude-v1.1` `8d32aa4c`)

| Tela app | Arquivo protótipo | Blocos obrigatórios (fidelidade) |
|---|---|---|
| Consulta | `src/app/pages/GestaoEstoque.tsx` (565 linhas) | Header + abas `:528-563` (Consulta / Sobras & Congelamento); filtros busca+Produto+Status+Local+Limpar+contador `:328-350`; tabela 13 colunas `:361-427` (Código c/ badge "Estoque anterior" `:379-384`, Produto, Tipo, Qtd, Peso, Origem/Frigorífico, NF/Lote, Entrada, Local, Status, Características, Pedido reservado, ações Destinar/Reimprimir/Histórico/Ban); `StatusBadge` 5 estados `:142-157`; `ModalDestinar` `:161-223` (resumo do item + lista de pedidos compatíveis + "Confirmar destinação"); `DrawerHistorico` `:227-284` (Dados do item + Linha do tempo); empty-state `:354-359`; aba Sobras `:441-521` (Sobras Críticas + Túnel de Congelamento) |
| Entrada de Itens | `src/app/pages/EntradaItens.tsx` (344 linhas) | Nota informativa `:117-122`; feedback sucesso `:124-129`; form `:133-296` (Produto select caixarias, Quantidade+Unidade, Fornecedor/origem, Lote/NF opcional, Local/câmara, Destino Estoque\|Pedido toggle `:209-224`, busca "Buscar cliente" + pedidos compatíveis `:226-272`, Observação, Limpar+Confirmar); tabela "Entradas de hoje" `:299-340` (Hora, Produto, Qtd, Destino c/ badge, Operador); empty-state `:305-309` |
| Ajustes | `src/app/pages/AjustesEstoque.tsx` (431 linhas) | Form `:223-354` (busca produto/item com dropdown `:226-265`, Qtd atual readonly, Ajuste +/-, Qtd ajustada calculada `:287-294`, Motivo select 5 opções, Descrição, Responsável readonly, checkbox "Requer aprovação da gestão" auto `:324-340` c/ aviso do limiar); tabela "Ajustes recentes" `:357-419` (9 colunas + ações Aprovar/Rejeitar quando pendente `:393-407`); `ModalDecisao` `:84-139` (resumo + aviso verde/vermelho + confirmar); `StatusBadge` 3 estados `:67-80` |

Tokens/cores: reutilizar DS Onda 2; hex do protótipo só via tokens existentes.

## Decisões de design (fixadas — só reabrir se houver quebra)

**D8.1 — RBAC AD-04 (recorte `ESTOQUE_*`, sem 12º perfil).**
Novas permissões: `ESTOQUE_ENTRADA` ("Registrar entrada de itens por unidade"), `ESTOQUE_AJUSTAR` ("Criar ajustes de estoque"), `ESTOQUE_AJUSTE_APROVAR` ("Aprovar/rejeitar ajustes de estoque"). Atribuições via `pushPermissoes`: `expedicao` e `recebimento_pesagem` ganham `ESTOQUE_LER`, `ESTOQUE_GERENCIAR`, `ESTOQUE_ENTRADA`, `ESTOQUE_AJUSTAR`; `gestor` e `administrador` ganham `ESTOQUE_ENTRADA`, `ESTOQUE_AJUSTAR`, `ESTOQUE_AJUSTE_APROVAR` (já têm LER/GERENCIAR em `permissoes.ts:178-181,218-221`). Segregação de função: NENHUM perfil operacional recebe `ESTOQUE_AJUSTE_APROVAR`. Atualizar `perfil-permissoes.snapshot.json` via teste snapshot.

**D8.2 — Consulta ampliada (uma query por fonte + joins batched).**
`EstoqueConsultaService.consultar(filtros)` passa a devolver `ItemEstoqueConsulta` com: `codigo` (etiqueta vigente ou `id.slice(0,8)`), `origem` (peça: `fornecedores.razaoSocial` via `recebimentos`; subitem: `Desossa interna (<codigo peça mãe>)`; entrada: `entradas_itens.fornecedor_nome`), `nfLote` (peça: `recebimentos.romaneio` + NF número; entrada: `lote_nf`), `entrada` (`createdAt` ISO), `local` (peça/subitem: `{ valor: null, provisorio: true }` — AD-09; entrada: `local` capturado), `caracteristicas` (peça: flags de `capturaMeta` — mesmo mapeamento de `pecas-elegiveis.service.ts`; subitem/entrada: `[]`), `pedidoReservado` (join `pedidos_venda`→`clientes.nomeFantasia` quando `pedidoVendaId` não nulo), `estoqueAnterior` (boolean: `createdAt::date < CURRENT_DATE`).
Fontes e mapa de status (protótipo `:14-15`):
- `pecas` com `statusPeca IN ('em_sobra','associada','em_transformacao','em_analise')`, `deletedAt IS NULL` → `em_sobra`→`Disponível` \| `associada`→`Destinado a pedido` \| `em_transformacao`→`Em desossa` \| `em_analise`→`Bloqueado por ocorrência`.
- `subitens` idem com `statusSubitem IN ('em_sobra','associado','em_analise')` → mesmos rótulos (map `associado`→`Destinado a pedido`).
- `entradas_itens` com `quantidade > 0`, `deletedAt IS NULL` → destino `estoque` sem pedido→`Disponível`; com `pedidoId`→`Destinado a pedido`.
- "Reservado" do protótipo NÃO tem fonte no modelo (reserva é de disponibilidade virtual, não de peça física) → o rótulo existe no filtro (fidelidade) e retorna lista vazia; NÃO inventar.
Ações permitidas por status: Destinar só em `Disponível`; Ban (ícone) só em `Bloqueado por ocorrência`.

**D8.3 — FIFO como sugestão parametrizável (P3/§16.4).**
Parâmetro existente `operacao.fifo_estoque` (seed, `valorJson.valor: boolean`). `consultar` ordena `createdAt ASC` quando `valor === true` (mais antigo primeiro = badge "Estoque anterior" no topo), senão `createdAt DESC`. `ModalDestinar` exibe os itens na mesma ordem. FIFO **nunca bloqueia**: destinar item mais novo com mais antigo disponível é permitido (P3 aberto). Badge "Estoque anterior" com `title` citando a regra FIFO (protótipo `:380-383`).

**D8.4 — `POST /estoque/destinar` (transação única).**
DTO: `{ tipo: 'peca'|'subitem'|'entrada', id: uuid, pedidoVendaItemId: uuid, quantidade?: number }` (`quantidade` só para `entrada`, int ≥1; peça/subitem sempre 1).
- peça: exige `statusPeca === 'em_sobra'` (senão 409 `ITEM_NAO_DISPONIVEL`); valida compatibilidade `itemComercialBaseId === pedidosVendaItens.itemComercialId` e pedido não cancelado (409 `ITEM_INCOMPATIVEL`); `consumirSaldo` (false → 409 `ITEM_DO_PEDIDO_COMPLETO`); UPDATE peça → `associada` + FKs; INSERT `associacoes_peca_historico` `acao='destinar_estoque'`; auditoria.
- subitem: idem sobre `statusSubitem === 'em_sobra'` → `associado` (NÃO reusa `SubitemService.associar`, que exige `pesado` — este é o caminho de estoque).
- entrada: exige saldo `quantidade` disponível; UPDATE atômico condicional em `pedidos_venda_itens`:
```sql
UPDATE pedidos_venda_itens SET quantidade_atendida = quantidade_atendida + :qtd
WHERE id = :itemId AND quantidade_atendida + :qtd <= quantidade_pedida
```
0 linhas → 409 `ITEM_DO_PEDIDO_COMPLETO` (nada persiste); sucesso → UPDATE `entradas_itens.pedido_id = :pedidoId`, `quantidade_destinada = quantidade_destinada + :qtd`; auditoria.
Evento pós-commit: `ESTOQUE_ITEM_DESTINADO { tipo, id, pedidoVendaItemId, dataOperacao }`.
Modal de pedidos compatíveis reusa `GET /operacao/pesagem/pecas/:id/compativeis` para peça; para subitem `GET /operacao/corte/subitens/:id/sugestao`; para entrada, novo cálculo no service de destinar: itens de pedido abertos do produto (`produtos.legadoItemComercialId`) com saldo, expostos por `GET /estoque/entradas/:id/compativeis` (`ESTOQUE_LER`).

**D8.5 — Histórico.**
`GET /estoque/:tipo/:id/historico` monta timeline mesclando: criação (`createdAt`, rótulo "Recebida/Gerada/Entrada registrada"), `associacoes_peca_historico` do alvo (peça/subitem), decisões de ajuste que referenciam o item, e (entrada) destinações. Ordenação `createdAt ASC`. Shape: `Array<{ descricao: string; dataHora: string }>` — exatamente o que o `DrawerHistorico` do protótipo renderiza.

**D8.6 — `entradas_itens` (migration 0024).**
Colunas (mestre §3.6 + campos do protótipo): `id` uuidv7 PK, `produto_id` FK `produtos` NOT NULL (só `tipo_operacional='entrada_unidade'` — validado no service, 409 `PRODUTO_NAO_E_CAIXARIA`), `quantidade` integer NOT NULL CHECK `> 0`, `quantidade_destinada` integer NOT NULL DEFAULT 0 CHECK `>= 0 AND quantidade_destinada <= quantidade`, `unidade` text NOT NULL CHECK `IN ('caixa','unidade')`, `fornecedor_nome` text NOT NULL (texto livre do protótipo — fornecedor de caixaria pode não ser cadastrado; **não** FK), `lote_nf` text, `local` text (captura livre do select do protótipo; local segue sem entidade — AD-09 intocada), `destino` text NOT NULL CHECK `IN ('estoque','pedido')`, `pedido_id` FK `pedidos_venda` (obrigatório no service quando `destino='pedido'`), `pedido_venda_item_id` FK, `observacao` text, `registrado_por` FK `usuarios` NOT NULL, `created_at`/`updated_at`/`deleted_at`.
`POST /estoque/entradas` com `destino='pedido'` consome saldo na MESMA transação (UPDATE condicional de D8.4; 409 → nada persiste). Evento `ENTRADA_ITENS_REGISTRADA { entradaId, produtoId, quantidade, destino, dataOperacao }`.

**D8.7 — Aba "Sobras & Congelamento" fiel + provisória (Princípio VIII).**
- "Sobras Críticas": lista real = itens `em_sobra` com `estoqueAnterior === true` (entrada em dia anterior), ordenados `createdAt ASC`. Campo "Validade" NÃO existe no modelo → exibir `—` + um único `BadgeProvisorio` no header do card com `title` "Validade por lote pendente de modelagem (§16.4/P3)". Botão "Decidir Destino" abre o `ModalDestinar` do item.
- "Túnel de Congelamento": ocupação NÃO tem modelagem → card renderiza com `BadgeProvisorio` e valores do parâmetro novo `estoque.tunel_congelamento` (seed: `{ grupo: 'Operação', tipo: 'info', titulo: 'Túnel de congelamento', capacidadeKg: 10000, provisorio: true, pendencia: 'P3' }`); barra de ocupação exibe `—%` (sem dado real); botão "Autorizar Congelamento" `disabled` com `title` "Fluxo de congelamento pendente de modelagem"; botão "Apontar Quebra / Descarte" navega para `/estoque/ajustes` (link real).
- **Proibido** seedar sobras/ocupação mockadas em runtime.

**D8.8 — `ajustes_estoque` (migration 0024) + alçada.**
Colunas: `id` uuidv7 PK, `tipo_alvo` text NOT NULL CHECK `IN ('peca','subitem','entrada')`, `peca_id` FK, `subitem_id` FK, `entrada_id` FK + CHECK XOR (exatamente um alvo não nulo: `(peca_id IS NOT NULL)::int + (subitem_id IS NOT NULL)::int + (entrada_id IS NOT NULL)::int = 1`), `produto_codigo` text NOT NULL (snapshot p/ tabela), `quantidade_delta` integer NOT NULL CHECK `<> 0`, `quantidade_anterior` integer NOT NULL, `motivo` text NOT NULL CHECK `IN ('quebra','perda','erro_contagem','vencimento','outro')`, `descricao` text, `status` text NOT NULL DEFAULT 'aplicado' CHECK `IN ('aplicado','aguardando_aprovacao','rejeitado')`, `criado_por` FK usuarios NOT NULL, `decidido_por` FK usuarios, `decidido_em` timestamptz, `decisao_motivo` text, `aprovacao_operacional_id` FK `aprovacoes_operacionais`, CHECK decisão coerente (`status='aplicado' AND criado_por IS NOT NULL` sempre ok; `status IN ('aplicado','rejeitado') AND aprovacao_operacional_id IS NOT NULL → decidido_por IS NOT NULL`), `created_at`/`updated_at`/`deleted_at`.
Limiar: parâmetro novo `estoque.limiar_aprovacao_ajuste` (seed: `{ grupo: 'Operação', tipo: 'numero', titulo: 'Limiar de aprovação de ajustes', valor: 5, provisorio: true, pendencia: 'doc 04 §5.3 — valor de demonstração' }`). `|quantidade_delta| > valor` → `status='aguardando_aprovacao'` + `AprovacoesService.abrirNaTx({ tipo: 'ajuste_estoque_relevante', origem: 'Ajuste de estoque <produto_codigo>', descricao, impacto })` na MESMA transação; senão aplica imediatamente (D8.10). Badge Provisório do limiar na tela (aviso âmbar do protótipo `:333-340`, texto citando o parâmetro).

**D8.9 — Decisão do ajuste (segregação).**
`aprovar`/`rejeitar`: 409 `AJUSTE_NAO_PENDENTE` se `status !== 'aguardando_aprovacao'`; **403 `SEGREGACAO_CRIADOR_APROVADOR` se `criado_por === user.sub`** (guard no service, além da permissão); rejeitar exige `motivo` (Zod min 5). Aprovar aplica (D8.10) + UPDATE status/decidido_por/decidido_em na mesma transação; se houver `aprovacao_operacional_id`, decide a aprovação operacional vinculada na mesma transação (UPDATE direto na tabela com o mesmo shape que `AprovacoesService.decidir` usa). Evento `AJUSTE_ESTOQUE_DECIDIDO { ajusteId, decisao, dataOperacao }`.

**D8.10 — Aplicação física do ajuste (fixada).**
- Alvo `entrada`: `quantidade = quantidade + delta` com CHECK `>= quantidade_destinada` (UPDATE condicional; violaria → 409 `SALDO_INSUFICIENTE`, transação aborta e o ajuste NÃO fica aplicado).
- Alvo `peca`/`subitem` com `delta = -1` e status `em_sobra`: soft delete (`deleted_at = now()`) + auditoria (motivo no registro do ajuste). Qualquer outro delta/status → 409 `AJUSTE_INVALIDO_PARA_PECA` ("peça é unitária; ajuste só -1 sobre item disponível") — **proibido** criar peça por ajuste (peça só nasce de pesagem).
- `quantidade_anterior` capturada no momento da criação, dentro da transação, com `SELECT ... FOR UPDATE` do alvo.

**D8.11 — Eventos e realtime.**
`eventos.ts` ganha: `ESTOQUE_ITEM_DESTINADO: 'estoque_item_destinado'`, `ENTRADA_ITENS_REGISTRADA: 'entrada_itens_registrada'`, `AJUSTE_ESTOQUE_CRIADO: 'ajuste_estoque_criado'`, `AJUSTE_ESTOQUE_DECIDIDO: 'ajuste_estoque_decidido'`. Handlers no `realtime.gateway.ts` (padrão `@OnEvent` + `this.broadcast(evento, payload, payload.dataOperacao)`). Clients das 3 telas usam `conectarRealtime` (rooms `['dashboard']`) e refazem fetch nos 4 eventos (padrão do `desossa-dashboard-client.tsx`); **sem** patch otimista.

**D8.12 — Reimprimir etiqueta na consulta.**
Peça: `POST /operacao/pesagem/pecas/:id/etiqueta/reimprimir` (existe, `pesagem.controller.ts:135`). Subitem: `POST /operacao/corte/subitens/:id/etiqueta/reimprimir` (existe, `corte.controller.ts:196`). Entrada: botão oculto (caixaria não tem etiqueta emitida pelo sistema — sem endpoint; **não** inventar). Client mostra spinner 1.2s como o protótipo `:321-324` e erro real em falha.

**D8.13 — CHECK de `associacoes_peca_historico.acao` (Emenda 1).**
A lista VIGENTE em develop (`pesagem.schema.ts:76-78`, pós-Onda 6) é `('confirmar','redirecionar','sobra','analise','corte','divergencia','estorno','troca_saida','troca_entrada')`. Migration 0024 faz `ALTER TABLE ... DROP CONSTRAINT chk_assoc_hist_acao` + `ADD CONSTRAINT ... CHECK (acao IN ('confirmar','redirecionar','sobra','analise','corte','divergencia','estorno','troca_saida','troca_entrada','destinar_estoque'))` — herda os 9 valores atuais e só ADICIONA `'destinar_estoque'` (expand aditivo; **proibido** remover valor existente). Schema Drizzle atualizado em conjunto.

## Cadeia de migrations — `0024` expand (gerada por drizzle-kit)

- [ ] Editar schemas Drizzle (Task 1), rodar `npx drizzle-kit generate --name onda8_estoque_expand` em `app/backend`; conferir que gerou `0024_onda8_estoque_expand.sql` + snapshot + `_journal.json` com `idx: 24` e `prevId` = id do snapshot 0023. DDL apenas (CREATE TABLE `entradas_itens`, `ajustes_estoque`, ALTER CHECK D8.13, índices). Nenhum DML (seeds vão em `db:seed`).
- [ ] Teste de meta: `test/unit/onda8-migrations-meta.spec.ts` — journal contíguo até 24; `0024` não contém `DROP TABLE`/`DELETE`/`UPDATE`.

## Estrutura de arquivos

```
app/backend/src/database/schema/estoque.schema.ts                           [novo: entradasItens, ajustesEstoque]
app/backend/src/database/schema/pesagem.schema.ts                           [CHECK acao +destinar_estoque]
app/backend/src/database/schema/index.ts                                    [export estoque.schema]
app/backend/src/database/migrations/0024_onda8_estoque_expand.sql           [gerada]
app/backend/src/database/seed.ts                                            [+2 parâmetros: limiar_aprovacao_ajuste, tunel_congelamento]
app/backend/src/common/rbac/permissoes.ts                                   [+3 permissões, pushPermissoes AD-04]
app/backend/src/modules/operacao/estoque/estoque-consulta.service.ts        [reescrever: filtros+joins+status map+FIFO]
app/backend/src/modules/operacao/estoque/destinar.service.ts                [novo]
app/backend/src/modules/operacao/estoque/entradas.service.ts                [novo]
app/backend/src/modules/operacao/estoque/ajustes.service.ts                 [novo]
app/backend/src/modules/operacao/estoque/historico.service.ts               [novo]
app/backend/src/modules/operacao/estoque/dto/estoque.dto.ts                 [novo: Zod schemas]
app/backend/src/modules/operacao/estoque/estoque.controller.ts              [ampliar: 9 rotas]
app/backend/src/modules/operacao/estoque/estoque.module.ts                  [providers novos + AprovacoesModule import]
app/backend/src/realtime/events/eventos.ts                                  [+4 eventos + payloads]
app/backend/src/realtime/realtime.gateway.ts                                [+4 handlers]
app/frontend/src/lib/estoque.ts                                             [tipos + fetchers]
app/frontend/src/app/(admin)/estoque/consulta/page.tsx                      [permissões]
app/frontend/src/app/(admin)/estoque/consulta/estoque-consulta-client.tsx   [reescrever fiel: 2 abas]
app/frontend/src/app/(admin)/estoque/entrada-itens/page.tsx                 [substituir placeholder]
app/frontend/src/app/(admin)/estoque/entrada-itens/entrada-itens-client.tsx [novo]
app/frontend/src/app/(admin)/estoque/ajustes/page.tsx                       [substituir placeholder]
app/frontend/src/app/(admin)/estoque/ajustes/ajustes-client.tsx             [novo]
app/frontend/src/app/api/operacao/estoque/**                                [BFF: 8 route handlers]
```

## Arquivos de teste (ação por arquivo)

```
app/backend/test/unit/onda8-migrations-meta.spec.ts          [novo]
app/backend/test/unit/estoque-consulta.service.spec.ts       [ESTENDER: status map + FIFO asc/desc]
app/backend/test/unit/ajustes-regras.spec.ts                 [novo: limiar/segregação/aplicação — chama o service com mocks que capturam .set()]
app/backend/test/integration/onda8-estoque.e2e-spec.ts       [novo: DoD 8.1–8.14]
app/backend/test/unit/perfil-permissoes-snapshot.spec.ts     [ESTENDER: snapshot com ESTOQUE_ENTRADA/AJUSTAR/AJUSTE_APROVAR]
app/frontend/src/__tests__/estoque-consulta.test.tsx         [novo]
app/frontend/src/__tests__/entrada-itens.test.tsx            [novo]
app/frontend/src/__tests__/ajustes-estoque.test.tsx          [novo]
app/frontend/e2e/onda8-estoque.spec.ts                       [novo: Playwright]
```

## Mapa DoD → teste (1:1) — todos em `onda8-estoque.e2e-spec.ts` salvo indicação

| DoD | Invariante | `it` literal |
|---|---|---|
| 8.1 | Consulta devolve peça/subitem/entrada com status mapeado D8.2 | `'DoD 8.1 consulta mapeia status físico para os rótulos do protótipo'` |
| 8.2 | FIFO: param true → `createdAt ASC`; false → DESC | `'DoD 8.2 ordenação segue parâmetro operacao.fifo_estoque'` |
| 8.3 | Destinar peça em_sobra consome saldo e vira associada + histórico `destinar_estoque` | `'DoD 8.3 destinar peça de estoque a pedido'` |
| 8.4 | Destinar peça já associada → 409 `ITEM_NAO_DISPONIVEL`, nada persiste | `'DoD 8.4 destinar item indisponível é rejeitado sem efeito'` |
| 8.5 | Destinar em item completo → 409 `ITEM_DO_PEDIDO_COMPLETO`, saldo intacto | `'DoD 8.5 destinar em item completo não persiste'` |
| 8.6 | Concorrência: 2 destinações simultâneas da MESMA peça → exatamente 1 sucesso | `'DoD 8.6 destinar concorrente da mesma peça: um completa, outro 409'` |
| 8.7 | Entrada destino estoque persiste; produto não-caixaria → 409 `PRODUTO_NAO_E_CAIXARIA` | `'DoD 8.7 entrada de caixaria valida tipo operacional'` |
| 8.8 | Entrada destino pedido consome N unidades atomicamente; acima do saldo → 409 sem efeito | `'DoD 8.8 entrada destinada a pedido consome saldo atômico'` |
| 8.9 | Ajuste abaixo do limiar aplica na hora (`status='aplicado'`, efeito físico D8.10) | `'DoD 8.9 ajuste dentro do limiar aplica imediatamente'` |
| 8.10 | Ajuste acima do limiar → `aguardando_aprovacao` + aprovação operacional criada + SEM efeito físico | `'DoD 8.10 ajuste acima do limiar exige aprovação e não aplica'` |
| 8.11 | Criador tenta aprovar o próprio ajuste → 403 `SEGREGACAO_CRIADOR_APROVADOR`, status inalterado | `'DoD 8.11 segregação criador≠aprovador'` |
| 8.12 | Aprovação por gestor aplica efeito físico + decide aprovação operacional vinculada | `'DoD 8.12 aprovar ajuste aplica efeito e fecha aprovação operacional'` |
| 8.13 | Ajuste -1 em peça em_sobra soft-deleta; delta +1 em peça → 409 `AJUSTE_INVALIDO_PARA_PECA` | `'DoD 8.13 aplicação física em peça é unitária e nunca cria peça'` |
| 8.14 | RBAC: `corte` (sem ESTOQUE_*) → 403 na consulta; `expedicao` → 200; `expedicao` sem AJUSTE_APROVAR → 403 no aprovar | `'DoD 8.14 recorte AD-04 de permissões de estoque'` |
| 8.15 | Eventos pós-commit: falha na transação de destinar → zero evento emitido | `unit ajustes-regras.spec.ts › 'DoD 8.15 rollback não emite evento'` |
| 8.16 | UI fiel: 13 colunas, 2 abas, modais, badges | Playwright `onda8-estoque.spec.ts` + screenshots fail-hard |

---

## Task 1 — Schemas Drizzle + migration 0024 + seed de parâmetros

**Files:** `estoque.schema.ts` (novo), `pesagem.schema.ts`, `index.ts`, `seed.ts`

- [ ] Step 1 — `app/backend/src/database/schema/estoque.schema.ts`:
```ts
import { relations, sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { produtos } from './produtos.schema';
import { pedidosVenda, pedidosVendaItens } from './pedidos.schema';
import { pecas } from './pesagem.schema';
import { subitens } from './transformacoes.schema';
import { aprovacoesOperacionais } from './aprovacoes-operacionais.schema';
import { usuarios } from './auth.schema';

// ── entradas_itens ────────────────────────────────────────────────────────────
// Caixarias/itens por unidade: não passam por balança nem desossa (v1.1 §4.1).
export const entradasItens = pgTable(
  'entradas_itens',
  {
    id:                  uuid('id').primaryKey().default(sql`uuidv7()`),
    produtoId:           uuid('produto_id').notNull().references(() => produtos.id),
    quantidade:          integer('quantidade').notNull(),
    quantidadeDestinada: integer('quantidade_destinada').notNull().default(0),
    unidade:             text('unidade').notNull().default('caixa'),
    fornecedorNome:      text('fornecedor_nome').notNull(),
    loteNf:              text('lote_nf'),
    local:               text('local'),
    destino:             text('destino').notNull(),
    pedidoId:            uuid('pedido_id').references(() => pedidosVenda.id),
    pedidoVendaItemId:   uuid('pedido_venda_item_id').references(() => pedidosVendaItens.id),
    observacao:          text('observacao'),
    registradoPor:       uuid('registrado_por').notNull().references(() => usuarios.id),
    createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:           timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_entradas_itens_qtd', sql`${t.quantidade} > 0`),
    check('chk_entradas_itens_destinada', sql`${t.quantidadeDestinada} >= 0 AND ${t.quantidadeDestinada} <= ${t.quantidade}`),
    check('chk_entradas_itens_unidade', sql`${t.unidade} IN ('caixa','unidade')`),
    check('chk_entradas_itens_destino', sql`${t.destino} IN ('estoque','pedido')`),
    index('idx_entradas_itens_produto').on(t.produtoId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_entradas_itens_created').on(t.createdAt).where(sql`${t.deletedAt} IS NULL`),
  ],
);

// ── ajustes_estoque ───────────────────────────────────────────────────────────
// Ajuste controlado de saldo físico (doc 04 §5.3). Limiar de aprovação = parâmetro.
export const ajustesEstoque = pgTable(
  'ajustes_estoque',
  {
    id:                      uuid('id').primaryKey().default(sql`uuidv7()`),
    tipoAlvo:                text('tipo_alvo').notNull(),
    pecaId:                  uuid('peca_id').references(() => pecas.id),
    subitemId:               uuid('subitem_id').references(() => subitens.id),
    entradaId:               uuid('entrada_id').references(() => entradasItens.id),
    produtoCodigo:           text('produto_codigo').notNull(),
    quantidadeDelta:         integer('quantidade_delta').notNull(),
    quantidadeAnterior:      integer('quantidade_anterior').notNull(),
    motivo:                  text('motivo').notNull(),
    descricao:               text('descricao'),
    status:                  text('status').notNull().default('aplicado'),
    criadoPor:               uuid('criado_por').notNull().references(() => usuarios.id),
    decididoPor:             uuid('decidido_por').references(() => usuarios.id),
    decididoEm:              timestamp('decidido_em', { withTimezone: true }),
    decisaoMotivo:           text('decisao_motivo'),
    aprovacaoOperacionalId:  uuid('aprovacao_operacional_id').references(() => aprovacoesOperacionais.id),
    createdAt:               timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:               timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:               timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_ajustes_tipo_alvo', sql`${t.tipoAlvo} IN ('peca','subitem','entrada')`),
    check('chk_ajustes_um_alvo', sql`(${t.pecaId} IS NOT NULL)::int + (${t.subitemId} IS NOT NULL)::int + (${t.entradaId} IS NOT NULL)::int = 1`),
    check('chk_ajustes_delta', sql`${t.quantidadeDelta} <> 0`),
    check('chk_ajustes_motivo', sql`${t.motivo} IN ('quebra','perda','erro_contagem','vencimento','outro')`),
    check('chk_ajustes_status', sql`${t.status} IN ('aplicado','aguardando_aprovacao','rejeitado')`),
    index('idx_ajustes_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
    index('idx_ajustes_created').on(t.createdAt).where(sql`${t.deletedAt} IS NULL`),
  ],
);

export const entradasItensRelations = relations(entradasItens, ({ one }) => ({
  produto: one(produtos, { fields: [entradasItens.produtoId], references: [produtos.id] }),
  pedido: one(pedidosVenda, { fields: [entradasItens.pedidoId], references: [pedidosVenda.id] }),
}));
```
- [ ] Step 2 — `pesagem.schema.ts:77`: trocar a lista do CHECK `chk_assoc_hist_acao` por `('confirmar','redirecionar','sobra','analise','corte','divergencia','estorno','troca_saida','troca_entrada','destinar_estoque')` (Emenda 1 — herda os 9 valores vigentes da Onda 6 e só adiciona `'destinar_estoque'`).
- [ ] Step 3 — `index.ts`: `export * from './estoque.schema';`.
- [ ] Step 4 — `npx drizzle-kit generate --name onda8_estoque_expand`; inspecionar o SQL gerado (DDL puro; o ALTER do CHECK deve aparecer como DROP+ADD CONSTRAINT). Rodar `npm run db:migrate` num banco limpo → sucesso.
- [ ] Step 5 — `seed.ts`: adicionar às `PARAMETROS_SEED` (idempotente, mesmo padrão das 9 chaves):
```ts
{
  chave: 'estoque.limiar_aprovacao_ajuste',
  descricao: 'Limiar de aprovação de ajustes de estoque',
  valorJson: { grupo: 'Operação', tipo: 'numero', titulo: 'Limiar de aprovação de ajustes',
    texto: 'Ajustes com |delta| acima deste valor exigem aprovação da gestão.', valor: 5, provisorio: true, pendencia: 'doc 04 §5.3 — valor de demonstração' },
},
{
  chave: 'estoque.tunel_congelamento',
  descricao: 'Túnel de congelamento (capacidade informativa)',
  valorJson: { grupo: 'Operação', tipo: 'info', titulo: 'Túnel de congelamento',
    texto: 'Capacidade nominal informativa; ocupação real pendente de modelagem.', capacidadeKg: 10000, provisorio: true, pendencia: 'P3' },
},
```
Atualizar `ORDEM_CANONICA_CHAVES` em `parametros.service.ts` inserindo as 2 chaves após `'operacao.fifo_estoque'`.
- [ ] Step 6 — `test/unit/onda8-migrations-meta.spec.ts`: journal contíguo `0..24`; conteúdo de `0024` sem `DROP TABLE|DELETE FROM|UPDATE ` (regex, case-insensitive, exceto o DROP CONSTRAINT esperado). Commit: `feat(onda8): schemas entradas_itens/ajustes_estoque + migration 0024 + parâmetros`.

## Task 2 — RBAC AD-04

**Files:** `permissoes.ts`, `perfil-permissoes-snapshot.spec.ts`

- [ ] Step 1 — em `PERMISSOES` (após `ESTOQUE_GERENCIAR`, linha 67):
```ts
ESTOQUE_ENTRADA: 'ESTOQUE_ENTRADA',
ESTOQUE_AJUSTAR: 'ESTOQUE_AJUSTAR',
ESTOQUE_AJUSTE_APROVAR: 'ESTOQUE_AJUSTE_APROVAR',
```
Em `DESCRICOES_PERMISSOES`: `ESTOQUE_ENTRADA: 'Registrar entrada de itens por unidade (caixarias)'`, `ESTOQUE_AJUSTAR: 'Criar ajustes de estoque'`, `ESTOQUE_AJUSTE_APROVAR: 'Aprovar/rejeitar ajustes de estoque (gestão)'`.
- [ ] Step 2 — após o bloco de `pushPermissoes` existente:
```ts
// Onda 8 — AD-04: recorte ESTOQUE_* para expedicao e recebimento_pesagem (sem 12º perfil)
pushPermissoes('expedicao', 'ESTOQUE_LER', 'ESTOQUE_GERENCIAR', 'ESTOQUE_ENTRADA', 'ESTOQUE_AJUSTAR');
pushPermissoes('recebimento_pesagem', 'ESTOQUE_LER', 'ESTOQUE_GERENCIAR', 'ESTOQUE_ENTRADA', 'ESTOQUE_AJUSTAR');
pushPermissoes('gestor', 'ESTOQUE_ENTRADA', 'ESTOQUE_AJUSTAR', 'ESTOQUE_AJUSTE_APROVAR');
pushPermissoes('administrador', 'ESTOQUE_ENTRADA', 'ESTOQUE_AJUSTAR', 'ESTOQUE_AJUSTE_APROVAR');
```
- [ ] Step 3 — rodar `npx jest test/unit/perfil-permissoes-snapshot.spec.ts` — vai falhar por snapshot desatualizado; atualizar o snapshot revisando o diff (só as adições acima). Commit: `feat(onda8): RBAC AD-04 — ESTOQUE_ENTRADA/AJUSTAR/AJUSTE_APROVAR`.

## Task 3 — DTOs Zod

**Files:** `dto/estoque.dto.ts` (novo)

- [ ] Step 1:
```ts
import { z } from 'zod';

export const consultaEstoqueQuerySchema = z.object({
  status: z.enum(['disponivel', 'destinado', 'em_desossa', 'bloqueado']).optional(),
  produtoId: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional(),
});
export type ConsultaEstoqueQuery = z.infer<typeof consultaEstoqueQuerySchema>;

export const destinarSchema = z
  .object({
    tipo: z.enum(['peca', 'subitem', 'entrada']),
    id: z.string().uuid(),
    pedidoVendaItemId: z.string().uuid(),
    quantidade: z.number().int().min(1).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.tipo === 'entrada' && !v.quantidade) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['quantidade'], message: 'quantidade é obrigatória para entrada' });
    }
    if (v.tipo !== 'entrada' && v.quantidade !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['quantidade'], message: 'quantidade só se aplica a entrada' });
    }
  });
export type DestinarDto = z.infer<typeof destinarSchema>;

export const criarEntradaSchema = z
  .object({
    produtoId: z.string().uuid(),
    quantidade: z.number().int().min(1),
    unidade: z.enum(['caixa', 'unidade']).default('caixa'),
    fornecedorNome: z.string().trim().min(1).max(200),
    loteNf: z.string().trim().max(120).optional(),
    local: z.string().trim().max(60).optional(),
    destino: z.enum(['estoque', 'pedido']),
    pedidoVendaItemId: z.string().uuid().optional(),
    observacao: z.string().trim().max(1000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.destino === 'pedido' && !v.pedidoVendaItemId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pedidoVendaItemId'], message: 'pedidoVendaItemId é obrigatório quando destino=pedido' });
    }
  });
export type CriarEntradaDto = z.infer<typeof criarEntradaSchema>;

export const criarAjusteSchema = z.object({
  tipo: z.enum(['peca', 'subitem', 'entrada']),
  id: z.string().uuid(),
  quantidadeDelta: z.number().int().refine((n) => n !== 0, 'delta não pode ser zero'),
  motivo: z.enum(['quebra', 'perda', 'erro_contagem', 'vencimento', 'outro']),
  descricao: z.string().trim().max(2000).optional(),
});
export type CriarAjusteDto = z.infer<typeof criarAjusteSchema>;

export const rejeitarAjusteSchema = z.object({
  motivo: z.string().trim().min(5).max(1000),
});
export type RejeitarAjusteDto = z.infer<typeof rejeitarAjusteSchema>;

export const historicoParamsSchema = z.object({
  tipo: z.enum(['peca', 'subitem', 'entrada']),
  id: z.string().uuid(),
});
```
Commit junto com a Task 4.

## Task 4 — Services de backend

**Files:** `estoque-consulta.service.ts` (reescrever), `destinar.service.ts`, `entradas.service.ts`, `ajustes.service.ts`, `historico.service.ts`, `estoque.module.ts`

- [ ] Step 1 — `estoque-consulta.service.ts`: implementar D8.2/D8.3. Estrutura obrigatória (assinaturas e semântica fixas; corpo segue o padrão de queries batched já existente no arquivo):
```ts
export interface ItemEstoqueConsulta {
  id: string;
  tipo: 'peca' | 'subitem' | 'entrada';
  codigo: string;                       // etiqueta vigente ?? id.slice(0, 8).toUpperCase()
  statusFisico: string;                 // valor bruto do banco
  statusRotulo: 'Disponível' | 'Destinado a pedido' | 'Em desossa' | 'Bloqueado por ocorrência';
  quantidade: string;
  peso: string | null;
  unidade: string;                      // 'peça' | 'peças' | 'caixas' | 'unidades'
  produto: { id: string | null; codigo: string; nome: string };
  origem: string;                       // D8.2
  nfLote: string | null;
  local: { valor: string | null; provisorio: boolean };  // AD-09 p/ peca/subitem; capturado p/ entrada
  caracteristicas: string[];
  pedidoReservado: string | null;       // '#<id8> — <nomeFantasia>'
  estoqueAnterior: boolean;
  createdAt: Date;
}

async consultar(filtros: ConsultaEstoqueQuery): Promise<ItemEstoqueConsulta[]>
```
Regras do corpo: 3 SELECTs (pecas/subitens/entradas com os status de D8.2) + mapas batched (itensComerciais, produtos por `legadoItemComercialId`, recebimentos→fornecedores p/ origem/NF, pedidosVenda→clientes p/ pedidoReservado, etiqueta vigente via `etiquetasImpressoes` mais recente ativa). Ordenação final: ler parâmetro `operacao.fifo_estoque` (SELECT em `parametros` por chave; `valorJson.valor === true` → `createdAt ASC`, senão DESC). Filtro `search` aplicado em memória sobre codigo/produto/origem/nfLote (coerente com o protótipo `:305-312`). Mapa de rótulos EXATAMENTE:
```ts
const ROTULO_PECA: Record<string, ItemEstoqueConsulta['statusRotulo']> = {
  em_sobra: 'Disponível', associada: 'Destinado a pedido',
  em_transformacao: 'Em desossa', em_analise: 'Bloqueado por ocorrência',
};
const ROTULO_SUBITEM: Record<string, ItemEstoqueConsulta['statusRotulo']> = {
  em_sobra: 'Disponível', associado: 'Destinado a pedido', em_analise: 'Bloqueado por ocorrência',
};
```
- [ ] Step 2 — `destinar.service.ts` (D8.4). Esqueleto obrigatório:
```ts
@Injectable()
export class DestinarEstoqueService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}
  private get db() { return this.drizzle.db; }

  async destinar(dto: DestinarDto, operadorId: string) {
    const resultado = await this.db.transaction(async (tx) => {
      switch (dto.tipo) {
        case 'peca': return this.destinarPeca(tx, dto, operadorId);
        case 'subitem': return this.destinarSubitem(tx, dto, operadorId);
        case 'entrada': return this.destinarEntrada(tx, dto, operadorId);
      }
    });
    this.eventEmitter.emit(EVENTOS.ESTOQUE_ITEM_DESTINADO, {
      tipo: dto.tipo, id: dto.id, pedidoVendaItemId: dto.pedidoVendaItemId,
      dataOperacao: resultado.dataOperacao,
    });
    return resultado.item;
  }
}
```
`destinarPeca`: `SELECT ... FOR UPDATE` da peça ativa; `statusPeca !== 'em_sobra'` → `ConflictException({ codigo: 'ITEM_NAO_DISPONIVEL', mensagem: ... })`; item do pedido ativo, não cancelado e `itemComercialId === peca.itemComercialBaseId` (senão `ITEM_INCOMPATIVEL`); `consumirSaldo(tx, dto.pedidoVendaItemId)` false → `ITEM_DO_PEDIDO_COMPLETO`; UPDATE peça `{ statusPeca: 'associada', pedidoVendaId, pedidoVendaItemId }`; INSERT `associacoesPecaHistorico` `{ pecaId, acao: 'destinar_estoque', pedidoDestinoId, pedidoItemDestinoId, operadorId }` (mesmo shape do INSERT em `associacao.service.ts.gravarHistorico`); `auditoria.registrar(tx, …)`. `dataOperacao` derivada como em `associacao.service.ts` (via recebimento→operação).
`destinarSubitem`: análogo sobre `subitens` (`statusSubitem 'em_sobra' → 'associado'`, histórico com `subitemId`).
`destinarEntrada`: `SELECT ... FOR UPDATE` da entrada; saldo `quantidade - quantidadeDestinada >= dto.quantidade` senão `SALDO_INSUFICIENTE`; UPDATE condicional de saldo do pedido (SQL literal de D8.4, via `sql` template) — 0 linhas → `ITEM_DO_PEDIDO_COMPLETO`; UPDATE entrada (`quantidadeDestinada += qtd`, `pedidoId`, `pedidoVendaItemId`); auditoria. `dataOperacao` = data do pedido de venda.
- [ ] Step 3 — `entradas.service.ts` (D8.6): `criar(dto, userId)` valida `produtos.tipoOperacional === 'entrada_unidade'` (senão `ConflictException({ codigo: 'PRODUTO_NAO_E_CAIXARIA' … })`); `destino='pedido'` → consumo atômico na mesma transação (mesmo UPDATE condicional); INSERT + auditoria; evento `ENTRADA_ITENS_REGISTRADA` pós-commit. `listar(query)` → `montarPaginado` ordenado `createdAt DESC`. `compativeis(entradaId)` → itens de pedido abertos do produto com saldo (join `produtos.legadoItemComercialId = pedidosVendaItens.itemComercialId`, pedido não cancelado, `quantidadeAtendida < quantidadePedida`), shape `Array<{ pedidoVendaItemId, pedidoVendaId, clienteNome, pendencia: string }>`.
- [ ] Step 4 — `ajustes.service.ts` (D8.8/9/10): `criar(dto, userId)` — transação: alvo sob `FOR UPDATE` (peça/subitem: exige existir ativo; entrada idem), captura `quantidadeAnterior` (peça/subitem: 1; entrada: `quantidade - quantidadeDestinada`), lê limiar do parâmetro; `|delta| <= limiar` → aplica (D8.10) + `status='aplicado'`; senão INSERT `status='aguardando_aprovacao'` + `AprovacoesService.abrirNaTx(tx, { operacaoId: null, tipo: 'ajuste_estoque_relevante', origem, descricao, impacto })` — **conferir a assinatura real de `abrirNaTx` em `aprovacoes.service.ts` e usá-la literalmente; se exigir `operacaoId` NOT NULL, derivar da data corrente via tabela `operacoes` (SELECT operação do dia) e, se não houver operação aberta, usar a mais recente**; INSERT do ajuste com `aprovacaoOperacionalId`. Evento `AJUSTE_ESTOQUE_CRIADO` pós-commit.
`aprovar(id, userId)` / `rejeitar(id, dto, userId)`: transação; `FOR UPDATE`; `status !== 'aguardando_aprovacao'` → `AJUSTE_NAO_PENDENTE`; `criadoPor === userId` → `ForbiddenException({ codigo: 'SEGREGACAO_CRIADOR_APROVADOR' … })`; aprovar aplica D8.10 (falha de aplicação → exceção → rollback total, ajuste permanece pendente); UPDATE ajuste + UPDATE `aprovacoes_operacionais` vinculada (`status='aprovada'|'rejeitada'`, `decisaoMotivo`, `decididoPor`, `decididoEm` — colunas reais do schema Onda 5); auditoria; evento `AJUSTE_ESTOQUE_DECIDIDO` pós-commit.
Aplicação (D8.10) em método privado `aplicarNaTx(tx, ajuste)`:
```ts
if (ajuste.tipoAlvo === 'entrada') {
  const r = await tx.execute(sql`
    UPDATE entradas_itens SET quantidade = quantidade + ${ajuste.quantidadeDelta}, updated_at = now()
    WHERE id = ${ajuste.entradaId} AND deleted_at IS NULL
      AND quantidade + ${ajuste.quantidadeDelta} >= quantidade_destinada
      AND quantidade + ${ajuste.quantidadeDelta} >= 0
    RETURNING id`);
  if (r.rows.length === 0) throw new ConflictException({ codigo: 'SALDO_INSUFICIENTE', mensagem: 'Ajuste deixaria o saldo abaixo do já destinado' });
} else {
  if (ajuste.quantidadeDelta !== -1) throw new ConflictException({ codigo: 'AJUSTE_INVALIDO_PARA_PECA', mensagem: 'Peça/subitem é unitário; ajuste físico só -1 sobre item disponível' });
  // soft delete do alvo em_sobra (senão 409 AJUSTE_INVALIDO_PARA_PECA)
}
```
- [ ] Step 5 — `historico.service.ts` (D8.5): `obter(tipo, id)` → `Array<{ descricao: string; dataHora: string }>` mesclando criação + `associacoesPecaHistorico` (peça/subitem) + ajustes decididos do alvo + (entrada) destinação. Rótulos: `confirmar/destinar_estoque` → `'Destinada ao pedido'`; `sobra` → `'Enviada ao estoque'`; `estorno` → `'Estornada'`; criação peça → `'Recebida e destinada ao estoque'`; subitem → `'Gerada na desossa e enviada ao estoque'`; entrada → `'Entrada registrada (Entrada de Itens)'`.
- [ ] Step 6 — `estoque.module.ts`: providers + `imports: [AprovacoesModule]` (exportar `AprovacoesService` lá se ainda não exporta — conferir; se não exportar, adicionar `exports: [AprovacoesService]` no módulo da Onda 5). Commit: `feat(onda8): services de consulta ampliada, destinar, entradas, ajustes e histórico`.

## Task 5 — Controller + eventos + gateway

**Files:** `estoque.controller.ts`, `eventos.ts`, `realtime.gateway.ts`

- [ ] Step 1 — controller com as 9 rotas do contrato (padrão do arquivo atual: `@SkipThrottle()`, `@UseGuards(JwtAuthGuard, RbacGuard)`, `ZodValidationPipe`, `@CurrentUser()`). Ordem dos handlers: rotas literais (`consulta`, `destinar`, `entradas`, `ajustes`) ANTES de `:tipo/:id/historico` (evita captura de rota — lição D7.14).
- [ ] Step 2 — `eventos.ts`: bloco `// ── Onda 8 — Estoque ──` com os 4 eventos de D8.11 + interfaces de payload (`EstoqueItemDestinadoPayload`, `EntradaItensRegistradaPayload`, `AjusteEstoqueCriadoPayload`, `AjusteEstoqueDecididoPayload` — todas com `dataOperacao: string`).
- [ ] Step 3 — `realtime.gateway.ts`: 4 handlers `@OnEvent(EVENTOS.X)` → `this.broadcast(EVENTOS.X, payload, payload.dataOperacao)` (cópia literal do padrão dos handlers F4a).
- [ ] Step 4 — teste unit `realtime.hub.spec.ts`: estender lista de eventos cobertos (padrão existente). Commit: `feat(onda8): endpoints REST + eventos RA-04 de estoque`.

## Task 6 — BFF Next.js

**Files:** `app/frontend/src/app/api/operacao/estoque/**`, `lib/estoque.ts`

- [ ] Step 1 — route handlers de repasse puro (padrão `repassar`/`fetchBackend` dos arquivos vizinhos): `consulta/route.ts` (GET com querystring repassada), `destinar/route.ts` (POST), `entradas/route.ts` (GET/POST), `entradas/[id]/compativeis/route.ts` (GET), `ajustes/route.ts` (GET/POST), `ajustes/[id]/aprovar/route.ts` (POST), `ajustes/[id]/rejeitar/route.ts` (POST), `[tipo]/[id]/historico/route.ts` (GET). Zero lógica de negócio.
- [ ] Step 2 — `lib/estoque.ts`: tipos espelhando os DTOs/shapes do backend + fetchers (`consultarEstoque`, `destinarItem`, `listarEntradas`, `criarEntrada`, `compativeisEntrada`, `listarAjustes`, `criarAjuste`, `aprovarAjuste`, `rejeitarAjuste`, `historicoItem`) — todos `!res.ok → throw new Error(await mensagemDeErro(res))`. Commit: `feat(onda8): BFF e lib de estoque`.

## Task 7 — UI Consulta de Estoque fiel (2 abas)

**Files:** `estoque/consulta/page.tsx`, `estoque-consulta-client.tsx`

- [ ] Step 1 — `page.tsx`: permissão `ESTOQUE_LER` (remover o OR atual com PESAGEM/CORTE — recorte AD-04 é a fonte agora; `expedicao`/`recebimento_pesagem`/`gestor`/`administrador` têm). Passar `permissoes` ao client.
- [ ] Step 2 — client fiel a `GestaoEstoque.tsx`: header "Estoque / Consulta de Estoque" + subtítulo `:530-534`; abas `:543-560` (ícones Warehouse/ClipboardList); badge "Capacidade Túnel" só na aba sobras `:535-539` com valor `—` + BadgeProvisorio (D8.7).
  Aba Consulta: filtros (busca com placeholder "Buscar por código, produto, origem ou NF/lote", selects Produto/Status/Local derivados dos dados, Limpar, contador "N itens") `:328-350`; tabela com AS 13 COLUNAS na ordem do protótipo `:365`; badge "Estoque anterior" `:379-384` com o `title` literal do protótipo; `StatusBadge` mapeando `statusRotulo` → `StatusPill`/tokens do DS; ações por linha: Destinar (`SendHorizontal`, só `Disponível`), Reimprimir (`Printer`, spinner 1.2s, oculto p/ entrada — D8.12), Histórico (`Eye`), `Ban` cursor-help quando bloqueado `:398-419`; empty-state `:354-359`.
  `ModalDestinar` `:161-223`: resumo (Código/Produto/Qtd/Peso/Local), lista de compatíveis (fetch por tipo — D8.4), seleção única, "Confirmar destinação" desabilitado sem seleção; para `entrada`, input de quantidade (1..saldo). Sucesso → refetch; erro → mensagem no modal.
  `DrawerHistorico` `:227-284`: Sheet com "Dados do item" (grid 2 cols) + "Linha do tempo" (bullets, último em `bg-primary`).
  Aba Sobras & Congelamento: D8.7 (dados reais em_sobra antigos; validade `—`; túnel provisório; botões conforme decisão).
  WS: `conectarRealtime(['dashboard'])`, refetch nos 4 eventos da onda + `PECA_ASSOCIADA`/`SUBITEM_ASSOCIADO`.
- [ ] Step 3 — teste `estoque-consulta.test.tsx`: renderiza 13 cabeçalhos na ordem; badge "Estoque anterior" só quando `estoqueAnterior`; ação Destinar só em Disponível; aba sobras exibe BadgeProvisorio e botão congelamento desabilitado. Commit: `feat(onda8): consulta de estoque fiel (2 abas, destinar, histórico)`.

## Task 8 — UI Entrada de Itens fiel

**Files:** `entrada-itens/page.tsx`, `entrada-itens-client.tsx`

- [ ] Step 1 — `page.tsx`: `getMe()` + exigir `ESTOQUE_ENTRADA` para o form (sem a permissão e com `ESTOQUE_LER` → só a tabela, form oculto; sem nenhuma → mensagem de permissão).
- [ ] Step 2 — client fiel a `EntradaItens.tsx`: breadcrumb+título `:110-114`; nota azul `:117-122` (texto literal "Caixarias são vendidas por unidade; não passam por balança nem desossa."); feedback verde 2.5s `:124-129`; form `:133-296` — Produto = select de produtos `tipoOperacional='entrada_unidade'` ativos (fetch `GET /api/cadastros/produtos?...` existente, filtrado), Quantidade+Unidade, Fornecedor/origem (input livre), Lote/NF opcional, Local/câmara select (`Câmara 1|Câmara 2|Túnel` — valores do protótipo `:204`), Destino toggle Estoque|Pedido `:209-224`, bloco pedido com input placeholder EXATO "Buscar cliente" `:234` + lista de compatíveis (fetch on select de produto: reusar `compativeis` — como a entrada ainda não existe, expor `GET /api/operacao/estoque/entradas/compativeis?produtoId=` adicional no BFF/backend com a mesma query de D8.4 por produto), chip selecionado com X `:263-270`, Observação, Limpar + "Confirmar entrada" (disabled = regra `podeConfirmar` do protótipo `:70-75`); tabela "Entradas de hoje" `:299-340` (5 colunas, badge destino verde/azul, operador = nome do usuário registrador) alimentada por `GET /estoque/entradas` filtrada ao dia corrente no client; empty-state `:305-309`.
- [ ] Step 3 — teste `entrada-itens.test.tsx`: botão desabilitado sem produto/qtd/fornecedor; destino Pedido exige seleção de pedido; placeholder "Buscar cliente" presente (Princípio IX). Commit: `feat(onda8): entrada de itens fiel`.

## Task 9 — UI Ajustes fiel

**Files:** `ajustes/page.tsx`, `ajustes-client.tsx`

- [ ] Step 1 — `page.tsx`: `ESTOQUE_AJUSTAR` para criar; `ESTOQUE_AJUSTE_APROVAR` habilita ações de decisão (passar ambas ao client).
- [ ] Step 2 — client fiel a `AjustesEstoque.tsx`: form `:223-354` — busca de item (dropdown sobre `consultarEstoque()` filtrando `Disponível`, exibindo `codigo — produto` + qtd `:243-253`), chip do selecionado `:258-265`, "Quantidade/peso atual" readonly, "Ajuste (+/-)" number, "Quantidade ajustada" calculada `:287-294` (vermelho se negativa), Motivo select (Quebra/Perda/Erro de contagem/Vencimento/Outro), Descrição, Responsável readonly (nome do usuário logado), checkbox auto "Requer aprovação da gestão" `:324-332` marcado quando `|delta| > limiar` (limiar vem de `GET /api/parametros` — fetch da chave `estoque.limiar_aprovacao_ajuste`), aviso âmbar `:333-340` com o valor do limiar + BadgeProvisorio; "Criar ajuste" → `criarAjuste`; erro do backend → banner.
  Tabela "Ajustes recentes" `:357-419`: 9 colunas (Código/Produto/Ajuste±cor/Qtd ajustada/Motivo/Responsável/Data-hora/Status/ações); Aprovar/Rejeitar só quando `aguardando_aprovacao` E usuário tem `ESTOQUE_AJUSTE_APROVAR` `:393-407`; `ModalDecisao` `:84-139` (resumo, aviso verde/vermelho com os textos literais `:117-119`, Confirmar aprovação/rejeição — rejeição exige motivo min 5 num Textarea extra, exigência do backend). 403 de segregação → exibir a mensagem do backend.
- [ ] Step 3 — teste `ajustes-estoque.test.tsx`: checkbox auto-marca acima do limiar; Aprovar/Rejeitar ausentes sem permissão; qtd ajustada negativa em vermelho. Commit: `feat(onda8): ajustes de estoque fiel c/ alçada`.

## Task 10 — Testes de integração (DoD 8.1–8.15)

**Files:** `test/integration/onda8-estoque.e2e-spec.ts`, `test/unit/ajustes-regras.spec.ts`, `test/unit/estoque-consulta.service.spec.ts`

- [ ] Step 1 — e2e com `createTestApp`/`createTestUser`/`loginCookies` + fixtures de `comercial-fixtures`/`pesagem-fixtures` (peça em_sobra: criar via fluxo pesagem→sem-cobertura/sobra — helper existente em pesagem-fixtures; conferir e reusar). Implementar os `it` do mapa DoD com os NOMES LITERAIS da tabela. Regras: cada 409/403 asserta `res.body.codigo` (valores fixados nas decisões) E estado inalterado (SELECT direto via DRIZZLE); DoD 8.6 usa `Promise.all` com 2 `destinar` da mesma peça (um 2xx, um 409, `quantidadeAtendida` incrementada exatamente 1); fixture ausente → `throw new Error('fixture não gerou <x>')`.
- [ ] Step 2 — `ajustes-regras.spec.ts` (unit): mocks Drizzle no padrão de `corte-branches.spec.ts`, capturando o argumento de `.set()`/`.execute()` e assertando os valores calculados (nunca objeto construído no teste); caso DoD 8.15: mock que lança na transação → `expect(emitter.emit).not.toHaveBeenCalled()`.
- [ ] Step 3 — `estoque-consulta.service.spec.ts`: estender com status map e FIFO asc/desc (mock do parâmetro). Commit: `test(onda8): DoD 8.1–8.15`.

## Task 11 — e2e Playwright + evidências + Gate local + PR

- [ ] Step 1 — `e2e/onda8-estoque.spec.ts` (padrão dos specs O6/O7): jornada — login expedicao → entrada de caixaria destino estoque → aparece na consulta como Disponível → destinar a pedido → vira "Destinado a pedido" → ajuste -8 (acima do limiar) → aguardando aprovação → login gestor → aprovar → aplicado. Asserções de UI com os rótulos do protótipo.
- [ ] Step 2 — screenshots das 3 rotas (+ aba sobras) vs protótipo em `docs/evidencias/onda8-estoque/` com script fail-hard (hash distinto entre telas + elementos-chave: "Estoque anterior", "Confirmar entrada", "Requer aprovação da gestão").
- [ ] Step 3 — Gate local (= CI):
```bash
npm ci
cd app/backend && npm run lint && npm run db:migrate && npm run test:cov && npm run build
cd ../frontend && npm run lint && npm run test && npm run build
# Expected: exit 0; cobertura ≥80% linha e branch
```
- [ ] Step 4 — PR `feature/onda8-estoque` → `develop` com template + relatório §7 (task a task, evidências lado a lado). Atualizar `EXECUCAO-STATUS.md` → `aguardando_portao2`.

## Ordem de execução

```
T1 → T2 → T3 → T4 → T5 → T6 → (T7 ∥ T8 ∥ T9) → T10 → T11
```

## Self-Review (critérios Portão 1)

1. Princípio I: 3 telas mapeadas a `.tsx` com linhas pinadas; 13 colunas, modais e abas com cercas. ✓
2. Princípio II: linhas 20–22 da matriz 100% cobertas; nada "parcial" (aba Sobras entra inteira com tratamento provisório explícito). ✓
3. Princípio VIII: P3/FIFO = parâmetro + badge; validade/túnel/local = provisório sinalizado, zero dado inventado; limiar = parâmetro provisório. ✓
4. RA-01..06: saldo/limiar/segregação no backend; transação+auditoria; eventos pós-commit; zero polling. ✓
5. Mapa DoD→teste 1:1 com nomes literais; concorrência real (8.6); rollback sem evento (8.15). ✓
6. AD-04 respeitada (recorte, sem 12º perfil); AD-09 intocada (local provisório). ✓
7. Grep proibidos: zero `TBD`/`a definir`/"similar à Task". A única inspeção delegada (assinatura real de `abrirNaTx`) tem instrução fechada de resolução e critério de parada. ✓
