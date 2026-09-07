# Onda 14 — Preço de tabela no pedido, ajuste manual, ocorrência e relatório — Plano de Implementação

> Para workers agênticos: usar o papel `worker` definido em `.codex/agents/worker.toml`.
> Seguir o plano **literalmente**. `old_string` não casa / teste falha após 1 correção / caso não coberto → **PARAR e reportar**. Não decidir regra, não improvisar, não abrir PR, não fazer Portão 2, não mergear.
> Este worker **não** escreve `docs/execucao/`. Este worker **não** cria a permissão `PEDIDO_PRECO_AJUSTAR`.

**Goal:** Integrar a faixa de preço do cliente (A/B/C/D) ao Pedido de Venda: resolver o preço da tabela `publicada` na data **exata** de `operacoes.data`, congelar no item, permitir ajuste manual sob `PEDIDOS_GERENCIAR`, gerar **uma** ocorrência informativa na finalização quando houver divergência, expor ciência na Fila Administrativa e um relatório em aba de `/gestao/relatorios`. Vocabulário pós-unificação: `produtoId`, `produtos.unidadePreco`. Completude E2E na mesma onda (Princípio II). Nenhum `git push` e nenhum `gh pr create` antes da validação presencial do Quality Owner (AD-16 item 7 / ALP-75).

**Architecture:** Modular monolith NestJS. `PrecosService.resolverPrecoVigente` / `resolverPrecosVigentes` é o único resolvedor (join direto `tabelas_preco` + `tabelas_preco_itens` + `produtos`). `PedidosService` congela preço na inclusão (mesma `tx` da reserva) e cria a ocorrência na `tx` de `finalizar`. Módulo novo `modules/comercial/ocorrencias-preco/` (consulta, ciente, relatório) — **não** entra em `AprovacoesService`. Frontend DS v3: campo em Clientes, coluna no editor, agregação client-side na fila, abas em Relatórios. Eventos pós-commit `OCORRENCIA_AJUSTE_PRECO_CRIADA` / `OCORRENCIA_AJUSTE_PRECO_CIENTE`. Migrations 0037–0043 via `drizzle-kit generate` (expand → backfill → contract).

**Tech Stack:** NestJS 11, TypeScript 5 strict, Drizzle ORM + drizzle-kit 0.31.10, PostgreSQL 18, Zod 4, WebSocket nativo + `@nestjs/event-emitter`, Jest/Supertest, Next.js 16 App Router/BFF, React 19, Tailwind 4, DS v3 (`Input` com `adornLeft`, `font-data`, `Tooltip`). Zero dependência nova.

**Base pinada no momento do plano:** `origin/develop` @ `b95e1ae8a62c0a6a33b9c605cc0f3ccf3cb71d6b` (Onda 13 mergeada, PR #123 SHA `a88854e`, AD-15). Journal em `app/backend/src/database/migrations/meta/_journal.json` termina em `idx: 36` / `0036_onda13_catalogo_contract`. Próximos nomes livres: `0037`…`0043` (tabela abaixo). Se `origin/develop` avançar e o journal ganhar `idx ≥ 37`, **parar e reportar** — não renumerar sozinho.

**Worktree / branch:** `.worktrees/o14` · `feature/onda14-preco-tabela-pedido`. AD-16 commitada em `4cea1f10a3e81c1cc387d8e68cba40c39928c22b` — **não reabrir**. Worktree HEAD no início desta 6ª correção (`2026-09-07T04:31:43Z`): `851f6655905a8bb02a764f8c5802ee6b59eee62f`. `relatorios-client.tsx` relido neste SHA (L86–165). Conferências das rodadas 1–5 permanecem. Nunca implementar no worktree coordenador.

**Correção Portão 1 1ª rodada (5 achados — permanecem fechados, não reabrir):** (1) GET `/precos/vigente` envelope `{ data }` — T04 e T06; `unidadePreco` nullable. (2) T10 embute o JSON literal ALP-85. (3) T08 só list/detail/ciente; T10 declara `@Get('relatorio')` acima de `:id`, sem stub 501. (4) Persistência de preço: Zod + `numeric(15,2)`, nunca `Number()`. (5) T06 remap/lock de cliente + `it('...')` 1:1 em T06/T09.

**Correção Portão 1 2ª rodada (`2026-09-07T03:27:34Z` — fecha exatamente 2 achados, sem mudar escopo):** HEAD então `4a19c25790ece35c4ca6d140f4a679f81a6c5a87`. (1) T08/T09 — `operacaoId` obrigatório no DTO de list, join `pedidos_venda.operacao_id`, fetch literal da fila. (2) T11 — 12 `it('...')` literais ALP-86.

**Correção Portão 1 3ª rodada (`2026-09-07T03:40:46Z` — fecha exatamente 3 achados, sem mudar escopo nem reabrir 1–2):** (1) escala canônica de `diferenca_percentual` = **×100**, 4 casas; T07 persiste, T08/T10 serializam o valor gravado; C7 permanece `null` se original `null`; C8 exemplo `17.00` vs `18.50` → `"-8.1081"`. Worker **não** escolhe a escala. (2) RA-04 — `realtime.gateway.ts` na lista Modificar; handlers `@OnEvent` literais T07=`OCORRENCIA_AJUSTE_PRECO_CRIADA` e T08=`OCORRENCIA_AJUSTE_PRECO_CIENTE` no molde de `handleOcorrenciaAberta` / `handleAprovacaoRegistrada`. (3) T08/T09 contrato campo a campo `OcorrenciaPrecoLista` vs detalhe com `itens`; Jest T09 exige `GET /ocorrencias-preco/:id`; `old_string`/`new_string` do fetch de detalhe sobre `carregarDetalheOcorrencia` L86–90.

**Correção Portão 1 4ª rodada (`2026-09-07T03:55:27Z` — fecha exatamente 4 achados, sem mudar escopo nem reabrir 1–3):** (1) T09 — `carregar` compilável (`ItemFila`, `dataAbertura`→`dataHora`, título, setters); `old_string`/`new_string` do card L171–186 e do painel de preço; `conectarRealtime` literal `rooms: ['dashboard']`. (2) T11 — `onValueChange` literal; aba inicial `sif` se `SIF_LER` senão `gerenciais`; detalhe = `<details>`; loading = `Card` disabled (SIF **não** usa `Skeleton`). (3) T05/T06 unidade — `produtos.unidadePreco` no item e em `ProdutoPedido`; vigente `null` **não** vira `/kg` nem `?? 'kg'`. (4) T05 auditoria — `justificativa: 'pedido.item.preco_ajustado'` + um assert; T12 lista os 12 specs reais do HEAD.

**Correção Portão 1 5ª rodada (`2026-09-07T04:16:38Z` — fecha exatamente 1 achado T09, sem mudar escopo nem reabrir 1–4):** T09 — depois dos patches, `ocorrenciaSel` é `ItemFila`; o painel fornecedor (HEAD L195–197) ainda lia `ocorrenciaSel.fornecedorNome` / `nfChave` / `pedidoLote`, que só existem em `bruto` quando `tipo === 'fornecedor'`. `old_string`/`new_string` literais para `ocorrenciaSel.bruto.*`. Inventário completo `ocorrenciaSel.*` e `o.*` na aba ocorrências (StatusPill/labels da lista já no card). Zero acesso órfão. AD-16 intacta. Sem `PEDIDO_PRECO_AJUSTAR`.

**Correção Portão 1 6ª rodada (`2026-09-07T04:31:43Z` — fecha exatamente 2 achados, sem mudar escopo nem reabrir 1–5):** (1) T10 `faixaPreco` — `ocorrencias_ajuste_preco` **não** tem a coluna; origem = `pedidos_venda_itens.faixa_preco` via subquery correlacionada em `pedido_venda_id` da ocorrência (SQL único no SELECT e no filtro); **proibido** `clientes.faixa_preco` atual. (2) T11 wrap SIF — `old_string`/`new_string` literais de HEAD L104–165 (`KpiStrip` + cards); zero “colar”, zero `...` placeholder, zero fork A/B. AD-16 intacta. Sem `PEDIDO_PRECO_AJUSTAR`.

**Linear:** épico [ALP-55](https://linear.app/alphacarnes/issue/ALP-55). T00 [ALP-77](https://linear.app/alphacarnes/issue/ALP-77) Done neste SHA. Este arquivo é T01. Worker executa Task 1 (docs) + T02–T12 = ALP-78…86 + ALP-59 + ALP-61. T13 é o Quality Owner. T14 abre o PR só depois de T13 Done. **Este worker não faz Portão 2 nem merge.**

**Numeração de migration (conferida no HEAD `4cea1f1`):**

| idx | tag | Task | Conteúdo |
|---|---|---|---|
| 37 | `0037_onda14_faixa_expand` | T02 | `clientes.faixa_preco` nullable |
| 38 | `0038_onda14_faixa_backfill` | T02 | `UPDATE ... SET faixa_preco = 'A'` (inclusive `deleted_at`) |
| 39 | `0039_onda14_faixa_contract` | T02 | `NOT NULL` + `chk_clientes_faixa_preco` |
| 40 | `0040_onda14_item_preco_expand` | T05 | 7 colunas nullable em `pedidos_venda_itens` |
| 41 | `0041_onda14_item_preco_backfill` | T05 | fail-closed: se `count(*) > 0` em itens, **PARAR**; se `0`, evidência e seguir |
| 42 | `0042_onda14_item_preco_contract` | T05 | `NOT NULL` + CHECKs em `faixa_preco`, `unidade_preco`, `preco_aplicado` |
| 43 | `0043_onda14_ocorrencias_preco` | T07 | tabelas novas (sem expand/backfill — vazias) |

Não commitar diff local de `0035_onda13_catalogo_backfill.sql`. Este worktree está limpo em develop + AD-16.

---

## Global Constraints

1. **AD-16 é fechada.** Não reabrir faixa vs FK de tabela, vigência por data exata, backfill `'A'`, adendo que herda, permissão `PEDIDOS_GERENCIAR`, status `aberta`/`ciente`, rótulo `Marcar como ciente`, aba em `/gestao/relatorios`, nem a proibição de PR antes do QO.
2. **AD-15 intacta.** Vocabulário `produtoId` / `produtos.unidadePreco`. **Proibido** reintroduzir `item_comercial_id` / `itens_comerciais` / `ITENS_COMERCIAIS_*` / `ITENS_COMPRA_*`.
3. **Não criar `PEDIDO_PRECO_AJUSTAR`.** Ajuste de preço reusa `PEDIDOS_GERENCIAR`. Teste 403 de ajuste = usuário **sem** `PEDIDOS_GERENCIAR` (perfil `compras` ou `diretoria`, que têm `PEDIDOS_LER`). `OCORRENCIA_PRECO_CIENTE` **é** criada (ciência; não foi revogada).
4. **AD-01, AD-03, AD-05, AD-06, AD-10, AD-12, AD-13, AD-14 intactas.**
5. **Princípio I / AD-16 item 1:** as 4 adições de UI **não existem** no protótipo — escopo novo autorizado. Portão 2 **não** compara tela equivalente. Referência visual = DS v3 (AD-10) + telas irmãs. Equivalentes parciais: `PriceInput` de `TabelaPrecos.tsx` (prefixo `R$`, alinhado à direita) traduzido para tokens DS v3 (`adornLeft`, `font-data` — **não** hex do protótipo); Fila Administrativa permanece master-detail com cards, **sem accordion**.
6. **Princípio II:** preço + ajuste + ocorrência + relatório na mesma onda, com todos os estados.
7. **Princípio III / RA-01:** resolução, detecção de ajuste e criação de ocorrência são backend. Frontend só exibe e valida formulário. Faixa e data **nunca** vêm do cliente HTTP.
8. **Princípio IV / RA-02:** inclusão e finalização na `tx` existente + auditoria. Sem transação nova para ocorrência.
9. **Princípio VI / RA-04:** eventos pós-commit. Sem polling. `aprovacoes-client.tsx` **não tem** WebSocket hoje — a T09 **adiciona** `conectarRealtime` (padrão de `tabela-precos-client.tsx`). `app/backend/src/realtime/realtime.gateway.ts` só faz broadcast com `@OnEvent` **explícito** (sem wildcard): emitir no service **não** entrega o evento se o gateway não tiver handler. T07 acrescenta `handleOcorrenciaAjustePrecoCriada`; T08 acrescenta `handleOcorrenciaAjustePrecoCiente`. Ambos usam `payload.dataOperacao` + `this.broadcast(..., payload.dataOperacao)` (que já itera `roomsDaData`).
10. **Princípio VII:** ausência de preço = `null` no resolvedor / R$ 0,00 na UI / inclusão só com manual > 0. Percentual indefinido = `null`, nunca `0` nem `100`. Sem fallback de data.
11. **Princípio VIII:** P8 (modelos SIF) permanece badge só na aba SIF. P11 intacto. Não fechar pendências §16.
12. **Princípio IX:** `nomeFantasia`, "Buscar cliente". Zero rótulo isolado "Marca".
13. **Princípio X:** `drizzle-kit generate`; expand → backfill → contract. Sem `ALTER TABLE` avulso. Sem `.down.sql`.
14. **Não reusar** `PrecosService.precosDaUltimaPublicada` (fallback `lt` + `orderBy desc`). Ele permanece `private` e inalterado.
15. **Não "corrigir" a Onda 13.** `PrecosService.criar` já filtra `ativoVenda=true` (BOI não entra na tabela nova). Só **reportar** no Self-Review se confirmar. Rename residual `itemComercialId` no editor: **no HEAD o14 o arquivo já usa `produtoId`** — T06 escreve sobre esse estado; `rg itemComercialId` no editor deve ficar vazio.
16. **Não commitar** alias BOI CASADO em `0035_onda13_catalogo_backfill.sql`.
17. **Dívida consciente (NÃO implementar):** lista de pedidos `Valor estimado` hardcoded (protótipo `PedidoVenda.tsx:53-72`). ALP-55 declara fora de escopo.
18. **Matriz 39 intacta.** Sem rota nova. Sem mudança em `menus-canonicos.ts` / `menu-v2.ts`.
19. Cobertura backend ≥80% linha **e** branch nos services tocados. `HARDWARE_FAKE=1`, `NFSE_FAKE=1`.
20. Portas host: frontend `4000`, backend `4001`, PostgreSQL `15433`.
21. Serialidade: Task 1 → T02 → T03; T02 → T04 → T05 → T06; T05 → T07 → T08 → T09; T07 → T10 → T11; depois T12. T13 humana. T14 só depois de T13.
22. Preço trafega como **string** `NUMERIC` (`"18.50"`). Nunca `Number` no caminho de persistência (nem `Number(dto.precoAplicado)`, nem `z.coerce.number()`, nem `parseFloat`). Validar com Zod string + comparar via `::numeric(15,2)` / regex DECIMAL.
23. `preco_ajustado` **não é coluna**. Derivado de `preco_tabela_original IS DISTINCT FROM preco_aplicado`.
24. Comentário legado em `PedidosService` L105 (`item comercial`) e 409 `"Item comercial já existe neste pedido"` (L455/L483): T05 troca a string de 409 para `"Produto já existe neste pedido"` no mesmo patch de `incluirItem`. Não é onda paralela.

---

## Decisões de design (fixadas — só reabrir se houver quebra)

### AD-16 (já em `DECISOES.md` no o14, SHA `4cea1f1`) — texto vigente, não o rascunho da ALP-77

> **Preço de tabela no pedido de venda, com ajuste manual auditado.** (1) **Escopo novo pós-protótipo:** as adições de UI da Onda 14 — campo `Tabela de Preço` na aba Preferências Operacionais de `/comercial/clientes`, coluna `Preço unitário` editável na grade de itens de `/comercial/pedidos`, ocorrência de ajuste de preço na Fila Administrativa de `/gestao/aprovacoes` e aba `Relatórios Gerenciais` em `/gestao/relatorios` — são **escopo novo do cliente**, não divergência do protótipo validado. O Princípio I permanece íntegro: essas telas não existem no protótipo, logo não há "tela equivalente" a comparar no Portão 2. A referência visual é o DS v3 (AD-10) e o padrão de componente das telas irmãs. Onde o protótipo tem equivalente parcial, ele é seguido: o `PriceInput` de `TabelaPrecos.tsx` (prefixo `R$`, `font-mono`, alinhado à direita) é o padrão do campo de preço, e a Fila Administrativa permanece master-detail com cards, sem accordion. (2) **Faixa, não tabela:** `tabelas_preco` é uma tabela por data com A/B/C/D como quatro colunas de preço por produto; o cliente é associado a uma **faixa** (`clientes.faixa_preco` TEXT + CHECK `IN ('A','B','C','D')`), nunca a uma FK de `tabelas_preco.id`. Clientes existentes recebem backfill `'A'` e a coluna fica `NOT NULL` na mesma onda. (3) **Vigência por data exata:** o preço vem exclusivamente da tabela `publicada` cuja `data` é igual a `operacoes.data` do pedido. Não há fallback para a última publicada anterior. Sem tabela publicada na data, ou com a coluna da faixa `NULL`, o item inicia em R$ 0,00 e só entra no pedido com preço manual maior que zero (Princípio VII: nunca inventar preço). (4) **Adendo herda** `preco_aplicado` e `preco_tabela_original` do item, sem reconsultar a tabela e sem gerar novo ajuste. (5) **Permissão:** ajustar preço reusa `PEDIDOS_GERENCIAR` (quem monta o pedido pode ajustar o preço). Não se cria `PEDIDO_PRECO_AJUSTAR`. (6) **Ocorrência informativa:** ajuste na finalização gera linha em `ocorrencias_ajuste_preco` (tabela nova — `ocorrencias_fornecedor` tem `fornecedor_id NOT NULL` e `aprovacoes_operacionais` exige decisão aprovar/rejeitar, ambas incompatíveis). Status `aberta` ou `ciente`; rótulo `Marcar como ciente`; uma ocorrência por pedido; não bloqueia nem exige aprovação. (7) **Nenhum PR é aberto** antes da validação do Quality Owner na aplicação local.

### D1–D25 — fechadas por este plano (T01)

1. **Ordem de migrations:** 0037–0039 faixa; 0040–0042 colunas do item; 0043 tabelas de ocorrência. Conferir journal antes de cada `generate`.
2. **GET `/precos/vigente`:** `PrecosController` no HEAD é `@Controller('precos/tabelas')`. **Não** acrescentar `@Get('vigente')` nele (viraria `/precos/tabelas/vigente`). Criar `PrecosVigenteController` `@Controller('precos')` + `@Get('vigente')` no mesmo `PrecosModule`. Envelope canônico único (T04 e T06): `{ data: PrecoVigenteHttp[] }`. **Proibido** `{ itens }`. `PrecoVigenteHttp.unidadePreco` é `'kg' | 'unidade' | null` (null quando não há vigente).
3. **PATCH preço separado:** `PATCH /comercial/pedidos/:id/itens/:itemId/preco` com `@RequirePermissoes('PEDIDOS_GERENCIAR')`. Não sobrecarregar `PATCH .../itens/:itemId` (`reduzirItem`).
4. **Pedido editável = `STATUS_ABERTOS`** já no HEAD (`rascunho`, `em_elaboracao_reserva_ativa`, `aguardando_confirmacao_overbooking`). ALP-81 escreveu "em_elaboracao" — o Worker usa `STATUS_ABERTOS`. Finalizado/cancelado → 409.
5. **Adendo:** `AdendosService.registrar` já faz UPDATE de quantidade sem tocar preço. T05 **não** adiciona reconsulta. Teste prova herança. Sem coluna nova em `adendos_pedido`.
6. **Backfill `preco_aplicado`:** se `SELECT count(*) FROM pedidos_venda_itens` > 0 na base-alvo, **PARAR e escalar ao QO**. Se 0, registrar evidência e seguir. Fail-closed (Princípio VII).
7. **`GET /ocorrencias-preco/relatorio` declarado ANTES de `:id`.** T08 **não** cria essa rota nem stub 501. T10 insere `@Get('relatorio')` no mesmo controller, **acima** de `@Get(':id')`.
8. **Fila:** duas fontes no cliente (`/api/aprovacoes/ocorrencias` + `/api/ocorrencias-preco`). Sem agregador Nest. Sem accordion.
9. **Relatório:** consulta ao vivo em `ocorrencias-preco`. Sem `RelatoriosSifService` / `relatorios_sif`. Zero join com `tabelas_preco_itens`. Paginar por pedido. `produtoId` filtra o pedido; detalhe traz **todos** os itens ajustados.
10. **Lacuna representante histórico:** `representanteNome` vem do vínculo **atual** do cliente. Reportar no Self-Review; **não** inventar coluna.
11. **UI preço:** reusar `Input` DS v3 de `tabela-precos-client.tsx` (`adornLeft` `R$`, `font-data`, `text-right`). Destaque de ajuste = **só borda** (`border-warning`). Tooltip via `@/components/ui/tooltip`.
12. **Sem permissão de ajuste na UI** = `!podeGerenciar` (`PEDIDOS_GERENCIAR` já existe na tela).
13. **Ciência:** `POST .../ciente` sem corpo. 409 `OCORRENCIA_JA_CIENTE`. Sem justificativa. Sem volta `ciente`→`aberta`.
14. **`OCORRENCIA_PRECO_CIENTE`:** `pushPermissoes('administrador' | 'gestor', ...)`. Leitura reusa `APROVACOES_LER`.
15. **Abas Relatórios:** título `Relatórios`; SIF exige `SIF_LER`; Gerenciais exige `APROVACOES_LER`. Badge P8 e aviso âmbar **só** na aba SIF. Sem exportação. `SeletorOperacao` permanece no header.
16. **Fixtures:** reusar ALP-74 / `comercial-fixtures.ts`. Estender com `faixaPreco: 'A'` e tabela publicada. Sem catálogo paralelo.
17. **Todos os `insert(clientes)`** após 0039 precisam `faixaPreco: 'A'` (lista na T02).
18. **Docs canônicos na Task 1** (worker, docs only): roadmap §8 + mermaid; matriz linhas 3/4/12/13; quality-gates DoD Onda 14. Sem alterar ondas anteriores. Sem rota nova.
19. **T13 bloqueia T14.** Gate local + push/PR só depois do QO. Este worker não faz Portão 2 nem merge.
20. **Carga inicial** está em `scripts/carga-inicial/carga-inicial.ts` (raiz do repo, não `app/backend/scripts/...`).
21. **`atualizar` de clientes** lista campos no `.set()` — **não** espalha o DTO. T02 acrescenta `faixaPreco` no `.set()`.
22. **`listar`/`detalhar`** usam `$inferSelect` — a coluna nova sai sozinha após o schema.
23. **Regex de preço (Zod, string, sem `Number`):** `/^\d+(\.\d{1,2})?$/` + `.refine` que rejeita zero-like `/^0+(\.0{1,2})?$/` (`"0"`, `"0.0"`, `"0.00"`). Inclusão: se o resolvido (manual ou vigente) for ausente/zero-like → 400 nomeando o produto (não deixar estourar o CHECK). `ajustarPrecoItem` **não** usa `Number(dto.precoAplicado)`.
24. **Formatação de persistência:** gravar `preco_aplicado` / original com 2 casas (`18.50`). Comparação de "voltar ao original" via SQL `${dto.precoAplicado}::numeric(15,2) IS NOT DISTINCT FROM ${item.precoTabelaOriginal}`, não `Number`.
25. **Escala `diferenca_percentual` (fixada — Worker não escolhe):** persistir e serializar como **percentual × 100** em `NUMERIC(10,4)`. Fórmula SQL literal (T07, mesma `tx` do insert do item da ocorrência): `CASE WHEN original IS NULL THEN NULL ELSE ROUND(((aplicado - original) / original) * 100, 4) END`. Exemplo canônico: original `"18.50"`, aplicado `"17.00"` → `"-8.1081"`. Original NULL → JSON `null` (nunca `0`, nunca `100`, nunca `"-0.0811"`). T08 list/detail e T10 leem o valor **já persistido** — **proibido** multiplicar ou dividir de novo na serialização HTTP.

---

## Estado real do HEAD (discrepâncias vs. issues Linear)

O Worker planeja **sobre o HEAD `4cea1f1`**, não sobre o rascunho das issues nem sobre o worktree coordenador.

| Premissa da issue | Estado real no o14 | Consequência |
|---|---|---|
| ALP-82: `pedido-editor.tsx` mistura `produtoId` / `itemComercialId` ~353 e ~661 | `rg itemComercialId` no arquivo = **vazio**. `ItemNovo.produtoId`; lista ~657 usa `item.produtoId`; payload ~366 `itens: itensNovos` | T06 escreve a coluna Preço **sobre** `produtoId`. `rg` de aceite vazio. Não inventar o arquivo antigo |
| ALP-55/82: `onda4-pedidos.test.tsx` espera `itemComercialId` no POST | HEAD já usa `produtoId` (payload ~283–290; inclusão ~360 `produtoId: 'produto-novo'`) | T06 **estende** o teste com preço; se `rg itemComercialId` achar algo, substitui. Sem fixture paralela |
| Coordenador sujo tem `removerItemNovo(itemComercialId)` | **Não** está no o14 | Ignorar o coordenador |
| ALP-80: acrescentar GET no controller de tabelas | `@Controller('precos/tabelas')` | Controller irmão `@Controller('precos')` |
| ALP-59: "mesmo canal WebSocket que a tela já usa" | `aprovacoes-client.tsx` **não** importa `conectarRealtime`; só `useEffect`+fetch | T09 **adiciona** WS |
| ALP-81: `PATCH` em pedido `em_elaboracao` | Status reais = `STATUS_ABERTOS` | Usar a constante existente |
| ALP-78: `scripts/carga-inicial` sob `app/backend` | Path real: `scripts/carga-inicial/carga-inicial.ts` | Patch nesse arquivo |
| ALP-78: service "só propaga" | `atualizar` lista campos à mão (L137–151) | Acrescentar `faixaPreco` no `.set()` |
| ALP-69/55: BOI pode entrar na tabela | `criar` já filtra `eq(produtos.ativoVenda, true)` L97–98 | Não corrigir; reportar |
| ALP-83: `finalizar` L1034–1074 | Conferido: `UPDATE` L1051 + `auditoria` L1055 + `eventos` L1066 + `emitirEventosPosCommit` L1072 | Inserir ocorrência **entre** o UPDATE e a auditoria do pedido; acrescentar evento no array |
| quality-gates / roadmap | Sem Onda 14 | Task 1 documental |

---

## Referências do protótipo (Princípio I — por tela)

Protótipo nesta máquina: `D:\0 - Projetos\AC\alpha-carnes-prototipo`, branch `main`. (O default `F:\Projetos\alpha-carnes-prototipo` **não** é o path desta máquina.) AD-10: referência **visual** = DS v3; fluxos/regras = v1.1. As 4 adições **não** existem no protótipo — AD-16 autoriza. Verificado no disco:

| Tela / rota | Arquivo do protótipo (verificado) | O que o Worker faz |
|---|---|---|
| `/comercial/clientes` aba Preferências | `src/app/pages/Cadastros.tsx` aba `op` L199–235 | **Não** copiar o campo (inexistente). Irmão visual = `Perfil de Gordura Aceito` (Select). Campo novo **primeiro** do grid. DS v3 da tela real (`clientes-client.tsx`) |
| `/comercial/pedidos` grade | `src/app/pages/PedidoVenda.tsx` L719: `["Produto", "Qtd. pedida", "Saldo antes da inclusão", "Origem esperada", "Qtd. reservada", ""]` — **sem** preço | Coluna nova autorizada. Grade real do HEAD tem `Produto / Origem / Quantidade / ações` — inserir **entre** Quantidade e ações |
| Campo de preço (equivalente parcial) | `src/app/pages/TabelaPrecos.tsx` `PriceInput` L77–91 (prefixo `R$`, `font-mono`, direita; hex `#E2E8F0`/`#2563EB`/`#94A3B8`) | **Não** copiar hex. Traduzir para `Input` DS v3 de `tabela-precos-client.tsx` L377–387: `adornLeft={<span className="text-[11px]">R$</span>}`, `className="... text-right font-data"`, `step="0.01"` |
| `/gestao/aprovacoes` fila | `src/app/pages/Aprovacoes.tsx` master-detail, cards, ação `Concluir tratativa` | Preservar master-detail 320px + painel. **Sem accordion**. **Não** reusar `Concluir tratativa`. Badge de tipo + `Marcar como ciente` |
| `/gestao/relatorios` | `src/app/pages/RelatoriosSIF.tsx` — página única, 4 SIF, sem abas | Abas autorizadas. SIF **movido** sem mudar lógica. Badge P8 só no SIF |
| Menu | `src/app/components/Layout.tsx` `ALL_NAV_GROUPS` | **Intacto** (39). Sem entrada nova |

Tokens: paleta DS v3 vigente. Zero hex avulso. `font-data` (JetBrains Mono, AD-10) no lugar de `font-mono` cru do protótipo.

---

## Estrutura de arquivos

### Criar

- `app/backend/src/database/migrations/0037_onda14_faixa_expand.sql` (+ snapshot/journal)
- `app/backend/src/database/migrations/0038_onda14_faixa_backfill.sql` (+ journal)
- `app/backend/src/database/migrations/0039_onda14_faixa_contract.sql` (+ snapshot/journal)
- `app/backend/src/database/migrations/0040_onda14_item_preco_expand.sql` (+ snapshot/journal)
- `app/backend/src/database/migrations/0041_onda14_item_preco_backfill.sql` (+ journal)
- `app/backend/src/database/migrations/0042_onda14_item_preco_contract.sql` (+ snapshot/journal)
- `app/backend/src/database/migrations/0043_onda14_ocorrencias_preco.sql` (+ snapshot/journal)
- `app/backend/src/database/schema/ocorrencias-ajuste-preco.schema.ts`
- `app/backend/src/modules/comercial/precos/precos-vigente.controller.ts`
- `app/backend/src/modules/comercial/precos/dto/preco-vigente.dto.ts`
- `app/backend/src/modules/comercial/ocorrencias-preco/ocorrencias-preco.module.ts`
- `app/backend/src/modules/comercial/ocorrencias-preco/ocorrencias-preco.controller.ts`
- `app/backend/src/modules/comercial/ocorrencias-preco/ocorrencias-preco.service.ts`
- `app/backend/src/modules/comercial/ocorrencias-preco/dto/ocorrencia-preco.dto.ts`
- `app/frontend/src/app/api/precos/vigente/route.ts`
- `app/frontend/src/app/api/pedidos/[id]/itens/[itemId]/preco/route.ts` — **não**. O BFF de pedidos no HEAD vive em `app/frontend/src/app/api/comercial/pedidos/`. Criar `app/frontend/src/app/api/comercial/pedidos/[id]/itens/[itemId]/preco/route.ts`
- `app/frontend/src/app/api/ocorrencias-preco/route.ts`
- `app/frontend/src/app/api/ocorrencias-preco/[id]/route.ts`
- `app/frontend/src/app/api/ocorrencias-preco/[id]/ciente/route.ts`
- `app/frontend/src/app/api/ocorrencias-preco/relatorio/route.ts`
- `app/backend/test/integration/onda14-faixa-preco.e2e-spec.ts`
- `app/backend/test/unit/precos-vigente.spec.ts`
- `app/backend/test/integration/onda14-preco-pedido.e2e-spec.ts`
- `app/backend/test/integration/onda14-ocorrencias-preco.e2e-spec.ts`
- `app/frontend/__tests__/onda14-clientes-faixa.test.tsx`
- `app/frontend/__tests__/onda14-pedido-preco.test.tsx`
- `app/frontend/__tests__/onda14-aprovacoes-preco.test.tsx`
- `app/frontend/__tests__/onda14-relatorios-gerenciais.test.tsx`
- `docs/evidencias/onda14-preco-tabela-pedido/` (T12)

### Modificar

- `docs/governance/roadmap-canonico.md` (Task 1)
- `docs/governance/quality-gates.md` (Task 1)
- `docs/superpowers/plans/2026-07-22-matriz-rastreabilidade-v1.1.md` (Task 1)
- `app/backend/src/database/schema/clientes.schema.ts`
- `app/backend/src/database/schema/pedidos.schema.ts`
- `app/backend/src/database/schema/index.ts`
- `app/backend/src/modules/cadastros/clientes/dto/cliente.dto.ts`
- `app/backend/src/modules/cadastros/clientes/clientes.service.ts`
- `scripts/carga-inicial/carga-inicial.ts`
- inserts de `clientes` nos helpers/e2e listados na T02
- `app/backend/src/modules/comercial/precos/precos.service.ts`
- `app/backend/src/modules/comercial/precos/precos.module.ts`
- `app/backend/src/modules/comercial/pedidos/dto/pedido.dto.ts`
- `app/backend/src/modules/comercial/pedidos/pedidos.service.ts`
- `app/backend/src/modules/comercial/pedidos/pedidos.controller.ts`
- `app/backend/src/modules/comercial/pedidos/pedidos.module.ts`
- `app/backend/src/modules/comercial/comercial.module.ts`
- `app/backend/src/realtime/events/eventos.ts`
- `app/backend/src/realtime/realtime.gateway.ts`
- `app/backend/src/common/rbac/permissoes.ts` + snapshot via `npx tsx scripts/regen-rbac-snapshot.ts` em `app/backend`
- `app/frontend/src/app/(admin)/comercial/clientes/clientes-client.tsx`
- `app/frontend/src/app/(admin)/comercial/pedidos/pedido-editor.tsx`
- `app/frontend/src/lib/comercial.ts`
- `app/frontend/src/app/(admin)/gestao/aprovacoes/aprovacoes-client.tsx`
- `app/frontend/src/lib/aprovacoes.ts`
- `app/frontend/src/app/(admin)/gestao/relatorios/relatorios-client.tsx`
- testes existentes citados por task

### Fora de escopo de escrita

- `docs/execucao/DECISOES.md`, `EXECUCAO-STATUS.md`, `GATE-VEREDITOS.md`
- `landing/**`
- `menus-canonicos.ts`, `menu-v2.ts`
- `Valor estimado` da lista de pedidos
- `precosDaUltimaPublicada`
- Filtro BOI / `ativoVenda` em `PrecosService.criar`
- `0035_onda13_catalogo_backfill.sql`
- Portão 2, merge, push antes de T13

---

## Mapa DoD → teste (1:1)

Matriz ALP-61 + 10 cenários acrescentados. **Não** escrever o cenário removido "item comercial sem produto".

| # | Invariante (DoD ALP-55 / AD-16) | Teste | Nível | Task |
|---|---|---|---|---|
| 14.1 | Cliente sem faixa não pode ser salvo | `POST /clientes` sem `faixaPreco` → 400, chave `faixaPreco` | e2e | T02 |
| 14.1b | Clientes existentes têm faixa após backfill | `count(*) WHERE faixa_preco IS NULL` = 0 (ativos e soft-deleted) | migration | T02 |
| 14.1c | Enum / CHECK | `POST` `'E'` → 400; SQL `'X'` viola CHECK; `PATCH` `null` → 400; A→C round-trip | e2e | T02 |
| 14.2 | Pedido carrega preço da faixa na data | criar com tabela publicada → `precoTabelaOriginal = precoAplicado`, `precoAjustado=false` | e2e | T05 |
| 14.2b | Unidade ao lado do valor | `unidadePreco='unidade'` renderiza `/un` | Jest | T06 |
| 14.3 | Preço editável para mais e para menos | `PATCH .../preco` acima e abaixo | e2e | T05 |
| 14.3b | Divergência destaca só a borda | classe `border-warning`, sem fundo/ícone/badge | Jest | T06 |
| 14.3c | Tooltip valor da tabela | `Valor da Tabela: R$ ...` | Jest | T06 |
| 14.4 | Sem preço inicia em R$ 0,00 | resolvedor `null`; UI `0,00` | unit + Jest | T04/T06 |
| 14.4b | Só entra com manual > 0 | inclusão sem preço → **400 backend** | e2e | T05 |
| 14.5 | Histórico congelado | republicar tabela → item inalterado | e2e | T05 |
| 14.5b | Trocar faixa do cliente A→C → item inalterado | e2e | T05 |
| 14.6 | Finalizar com ajuste cria 1 ocorrência | 3 ajustados de 5 → 1 ocorrência, 3 linhas | e2e | T07 |
| 14.6b | Sem ajuste, 0 ocorrência | e2e | T07 |
| 14.6c | Ajuste desfeito (voltar ao original) → 0 ocorrência | e2e | T07 |
| 14.7 | Fila lista, painel detalha, ciente grava | e2e + Jest | T08/T09 |
| 14.7b | Sem aprovação | nenhum endpoint aprovar/rejeitar atinge a ocorrência | e2e | T08 |
| 14.8 | Relatório só com divergência; valores históricos | pedido sem ajuste ausente; republicação não altera | e2e | T10 |
| 14.9 | Cobertura ≥80% e CI verde | `test:cov` + 8 jobs **depois** de T13 | T12/T14 |
| 14.10 | Nenhum PR antes do QO | T14 é no-op até T13 Done | T13/T14 |
| C1 | Nenhuma tabela publicada na data | todos R$ 0,00; só fecha com manual em cada item | e2e | T04/T05 |
| C2 | Tabela publicada só no dia anterior | `null` / R$ 0,00 — **sem fallback** | unit + e2e | T04 |
| C3 | Coluna da faixa `NULL` num produto | só aquele item zera | e2e | T04 |
| C4 | Tabela `rascunho` na data | tratada como inexistente | unit | T04 |
| C5 | Finalização concorrente | unique `uq_ocorr_ajuste_preco_pedido` impede duplicata | e2e | T07 |
| C6 | Adendo em item ajustado | herda preço; sem novo ajuste | e2e | T05 |
| C7 | Original `NULL` → percentual `null` em ocorrência, fila e relatório | e2e + Jest | T07/T08/T10 |
| C8 | Desconto (aplicado `17.00` < original `18.50`) → `diferenca_total` negativa **e** `diferenca_percentual` `"-8.1081"` (escala ×100, 4 casas; nunca `"-0.0811"`) | e2e | T07/T10 |
| C9 | Rollback da finalização → 0 ocorrência órfã | e2e | T07 |
| C10 | Cliente sem representante → relatório `—`, join não quebra | e2e | T10 |

**Regressão obrigatória (T12):** reserva atômica; overbooking AD-05; adendos (quantidade); `PATCH :id/itens/:itemId` só quantidade; 4 SIF + versionamento; fila fornecedor + `Concluir tratativa`; snapshot RBAC sem `PEDIDO_PRECO_AJUSTAR` e sem `ITENS_*`; catálogo unificado (`rg item_comercial_id` vazio em `src/database/schema` e `src/modules`).

---

## Task 0 — AD-16 (já feita — não refazer)

[ALP-77](https://linear.app/alphacarnes/issue/ALP-77) Done. Commit `4cea1f10a3e81c1cc387d8e68cba40c39928c22b` no o14. AD-16 na tabela de `DECISOES.md` com os itens (b)(c)(d)(e) **já trocados pelo QO** (adendo herda; `PEDIDOS_GERENCIAR`; `aberta`/`ciente`; sem PR antes do QO). Worker **não** toca `docs/execucao/`.

---

## Task 1 — Documentação canônica (worker, docs only)

**Por quê:** `roadmap-canonico.md` §8 ainda não tem a Onda 14 — sem esta task o Portão 1 bloqueia por escopo. `quality-gates.md` não tem DoD da Onda 14. A matriz precisa das adições AD-16 nas 4 rotas, sem quinta rota.

**Files:**
- `docs/governance/roadmap-canonico.md`
- `docs/governance/quality-gates.md`
- `docs/superpowers/plans/2026-07-22-matriz-rastreabilidade-v1.1.md`

**Interfaces:** nenhuma. Zero código de produto.

### Steps

- [ ] **TDD:** não há teste de runtime. Aceite = diff só nesses 3 arquivos + ondas 0–13 intactas.

- [ ] `roadmap-canonico.md` — após a linha 13 da tabela §8, **acrescentar** (não editar linhas 0–13):

```
| 14 | Preço de tabela no pedido, ajuste manual, ocorrência informativa e relatório (AD-16) | 13 | idem |
```

`old_string` (tabela + mermaid, únicos no arquivo):

```
| 13 | Unificação do catálogo em Produtos — `itens_comerciais` e `itens_compra` extintos, FKs repontadas para `produtos.id`, cadastro único em `/cadastros/produtos` (AD-15) | 0–12 | idem |
```

`new_string`:

```
| 13 | Unificação do catálogo em Produtos — `itens_comerciais` e `itens_compra` extintos, FKs repontadas para `produtos.id`, cadastro único em `/cadastros/produtos` (AD-15) | 0–12 | idem |
| 14 | Preço de tabela no pedido, ajuste manual, ocorrência informativa e relatório (AD-16) | 13 | idem |
```

Mermaid — `old_string`:

```
    O12 --> O13["Onda 13 Unificacao do catalogo em Produtos"]
```

`new_string`:

```
    O12 --> O13["Onda 13 Unificacao do catalogo em Produtos"]
    O13 --> O14["Onda 14 Preco de tabela no pedido"]
```

Não alterar nós 0–13. Não mudar o texto da Onda 11 (`item_comercial` histórico permanece).

- [ ] `quality-gates.md` — após o bullet O10 (antes de `## Como o gate decide`), inserir:

```
### Onda 14 — Preço de tabela no pedido (AD-16)
DoD = mapa 1:1 deste plano (14.1–14.10 + C1–C10), derivado de ALP-55/ALP-61/AD-16:
- Cliente sem `faixaPreco` não salva; backfill `'A'` + `NOT NULL` + CHECK A–D.
- Resolvedor por data **exata** de `operacoes.data` (sem fallback); `null` é resposta legítima.
- Item congela `tabela_preco_id`, `faixa_preco`, `unidade_preco`, `preco_tabela_original`, `preco_aplicado`; `preco_ajustado` derivado; `PATCH .../preco` sob `PEDIDOS_GERENCIAR` (403 sem ela). **Não existe** `PEDIDO_PRECO_AJUSTAR`.
- Adendo herda preço; finalização com ≥1 ajuste cria exatamente 1 ocorrência `aberta`; sem ajuste, zero.
- Ciência: `POST .../ciente` com `OCORRENCIA_PRECO_CIENTE`; rótulo `Marcar como ciente`; 409 `OCORRENCIA_JA_CIENTE`.
- Relatório em aba de `/gestao/relatorios` (39 rotas intactas); fonte = ocorrência, nunca `tabelas_preco_itens`.
- UI nova autorizada (AD-16); DS v3; sem accordion na fila; Badge P8 só na aba SIF.
```

- [ ] Matriz — **não** adicionar linha 42. Atualizar só a coluna Observação das linhas 3, 4, 12 e 13. `old_string` / `new_string` por linha:

Linha 3 (clientes) — append ao final da Observação:

` **AD-16:** coluna real `clientes.faixa_preco` (A/B/C/D, NOT NULL) exposta como campo `Tabela de Preço` no primeiro slot da aba Preferências Operacionais. Sem FK para `tabelas_preco.id`.`

Linha 4 (pedidos) — append:

` **AD-16:** item congela preço de tabela (`tabela_preco_id`, `faixa_preco`, `unidade_preco`, `preco_tabela_original`, `preco_aplicado`, `usuario_ajuste_id`, `ajustado_em`). `PATCH /comercial/pedidos/:id/itens/:itemId/preco` sob `PEDIDOS_GERENCIAR`. Coluna UI `Preço unitário`. Evento `OCORRENCIA_AJUSTE_PRECO_CRIADA` na finalização com ajuste.`

Linha 12 (aprovações) — append:

` **AD-16:** a Fila Administrativa agrega no cliente `ocorrencias_ajuste_preco` (informativa, `aberta`/`ciente`, `Marcar como ciente`, permissão `OCORRENCIA_PRECO_CIENTE`) sem accordion e sem fluxo aprovar/rejeitar. Aba Aprovações Operacionais intacta.`

Linha 13 (relatórios) — append:

` **AD-16:** abas Relatórios SIF / Relatórios Gerenciais na **mesma** rota (matriz 39 intacta). Relatório de ajuste consulta `ocorrencias_ajuste_preco` (`GET /ocorrencias-preco/relatorio`); Badge P8 permanece só no SIF.`

- [ ] Aceite: `rg "Onda 14" docs/governance/roadmap-canonico.md` casa; mermaid tem `O13 --> O14`; quality-gates tem `### Onda 14`; matriz continua com 41 entradas de rota do protótipo (grep do cabeçalho "41 entradas"); zero linha nova `/comercial/...` ou `/gestao/...` além das 4 atualizadas.

**Commit:** `docs(onda14): registra Onda 14 no roadmap, matriz e quality-gates`

---

## Task 2 — Clientes: `faixa_preco` migration + backend (ALP-78)

**Files:** schema + DTO + service + carga-inicial + inserts de teste + 0037/0038/0039 + `onda14-faixa-preco.e2e-spec.ts`

**Interfaces:**

```ts
export const FAIXAS_PRECO = ['A', 'B', 'C', 'D'] as const;
export type FaixaPreco = (typeof FAIXAS_PRECO)[number];
export const faixaPrecoSchema = z.enum(FAIXAS_PRECO);
```

`createClienteSchema` ganha `faixaPreco: faixaPrecoSchema` (**obrigatório**, sem `.optional()`, sem default).
`updateClienteSchema` continua `createClienteSchema.omit({ codigo: true }).partial()` — chave opcional; `{ faixaPreco: null }` → 400.

### Steps

- [ ] **TDD primeiro:** criar `app/backend/test/integration/onda14-faixa-preco.e2e-spec.ts` com os casos da tabela ALP-78 (sem campo → 400; `'E'` → 400; PATCH `null` → 400; A→C; CHECK `'X'` via SQL). Rodar: deve falhar (coluna inexistente).

- [ ] Schema `clientes.schema.ts` — expand (nullable, **sem** CHECK ainda). Após `prioridade` (L18):

`old_string`:

```
    prioridade:              text('prioridade'),
    preferenciasJson:        jsonb('preferencias_json').notNull().default(sql`'{}'::jsonb`),
```

`new_string`:

```
    prioridade:              text('prioridade'),
    faixaPreco:              text('faixa_preco'),
    preferenciasJson:        jsonb('preferencias_json').notNull().default(sql`'{}'::jsonb`),
```

- [ ] Generate expand:

```powershell
Set-Location app/backend
npx drizzle-kit generate --name=onda14_faixa_expand
```

Saída esperada: tag `0037_...`. Renomear arquivo + `tag` do journal para `0037_onda14_faixa_expand` se o kit emitir outro slug. Se o generate criar DROP ou `NOT NULL` nesta etapa, **parar e reportar**.

- [ ] Backfill — `npx drizzle-kit generate --custom --name=onda14_faixa_backfill` e substituir o corpo por:

```sql
-- 0038_onda14_faixa_backfill.sql
-- AD-16: saneamento legado. Inclusive soft-deleted (senão o SET NOT NULL falha).
UPDATE clientes
SET faixa_preco = 'A', updated_at = now()
WHERE faixa_preco IS NULL;

DO $$
DECLARE
  v_nulos int;
BEGIN
  SELECT count(*) INTO v_nulos FROM clientes WHERE faixa_preco IS NULL;
  IF v_nulos <> 0 THEN
    RAISE EXCEPTION 'Onda 14 backfill faixa: % clientes ainda NULL', v_nulos;
  END IF;
END $$;
```

Renomear tag para `0038_onda14_faixa_backfill`.

- [ ] Contract: no schema, tornar `faixaPreco` `.notNull()` e acrescentar o CHECK no array, junto de `chk_clientes_status`:

```
    check('chk_clientes_status', sql`${t.status} IN ('ativo','inativo')`),
    check('chk_clientes_faixa_preco', sql`${t.faixaPreco} IN ('A','B','C','D')`),
```

Não criar índice. Generate `--name=onda14_faixa_contract` → `0039_onda14_faixa_contract`. SQL esperado: `SET NOT NULL` + CHECK. Sem DROP.

- [ ] `npx drizzle-kit check` — sem drift.
- [ ] `npm run db:migrate` aplica 0037–0039.

- [ ] DTO `cliente.dto.ts` — após `const statusSchema`:

```ts
export const FAIXAS_PRECO = ['A', 'B', 'C', 'D'] as const;
export const faixaPrecoSchema = z.enum(FAIXAS_PRECO);
```

Em `createClienteSchema`, após `prioridade`:

```
  prioridade: z.enum(['normal', 'alta']).optional(),
  faixaPreco: faixaPrecoSchema,
```

- [ ] `clientes.service.ts` `inserirCliente` `.values` — acrescentar `faixaPreco: dto.faixaPreco,` após `prioridade: dto.prioridade,`.

- [ ] `atualizar` `.set` — `old_string`:

```
            prioridade: dto.prioridade ?? anterior.prioridade,
            preferenciasJson: dto.preferenciasJson ?? anterior.preferenciasJson,
```

`new_string`:

```
            prioridade: dto.prioridade ?? anterior.prioridade,
            faixaPreco: dto.faixaPreco ?? anterior.faixaPreco,
            preferenciasJson: dto.preferenciasJson ?? anterior.preferenciasJson,
```

- [ ] `carga-inicial.ts` `importarClientes` insert L89–107. Acrescentar `faixaPreco`. Se o JSON legado trouxer faixa fora de A–D, **falhar explícito** (nunca normalizar). `old_string` do insert:

```
    await db.insert(clientes).values({
      codigo: codigoLegado,
      razaoSocial: nome,
      nomeFantasia: r.Marca?.trim() || null,
      documentoFiscal: doc,
      status: r.Ativo ? 'ativo' : 'inativo',
```

`new_string`:

```
    const faixaLegado = (r as { faixa_preco?: unknown; Faixa_Preco?: unknown }).faixa_preco
      ?? (r as { Faixa_Preco?: unknown }).Faixa_Preco;
    if (faixaLegado !== undefined && faixaLegado !== null && faixaLegado !== '') {
      const faixa = String(faixaLegado).trim().toUpperCase();
      if (!['A', 'B', 'C', 'D'].includes(faixa)) {
        throw new Error(`carga-inicial: cliente ${codigoLegado} com faixa_preco inválida ("${String(faixaLegado)}")`);
      }
    }
    await db.insert(clientes).values({
      codigo: codigoLegado,
      razaoSocial: nome,
      nomeFantasia: r.Marca?.trim() || null,
      documentoFiscal: doc,
      status: r.Ativo ? 'ativo' : 'inativo',
      faixaPreco: ((): 'A' | 'B' | 'C' | 'D' => {
        const raw = (r as { faixa_preco?: unknown; Faixa_Preco?: unknown }).faixa_preco
          ?? (r as { Faixa_Preco?: unknown }).Faixa_Preco;
        if (raw === undefined || raw === null || raw === '') return 'A';
        return String(raw).trim().toUpperCase() as 'A' | 'B' | 'C' | 'D';
      })(),
```

(A validação do `throw` ocorre **antes** do insert, no bloco `if` acima — o Worker pode fundir numa única leitura de `faixaLegado` para não duplicar. Não silenciar valor inválido.)

- [ ] **Todos** os inserts Drizzle em `clientes` (após 0039 quebram sem a coluna). Acrescentar `faixaPreco: 'A'` em cada um:

| Arquivo | Linha HEAD (aprox.) |
|---|---|
| `app/backend/test/helpers/comercial-fixtures.ts` | 57 |
| `app/backend/test/helpers/faturamento-fixtures.ts` | 31 |
| `app/backend/test/helpers/pesagem-fixtures.ts` | 79 |
| `app/backend/test/integration/espelho.e2e-spec.ts` | 73, 77 |
| `app/backend/test/integration/faturamento.e2e-spec.ts` | 148 |
| `app/backend/test/integration/escopo-representantes.e2e-spec.ts` | 75, 79, 82 |
| `app/backend/test/integration/pedidos-reserva.e2e-spec.ts` | 18 |
| `app/backend/test/integration/onda13-catalogo-unificacao.e2e-spec.ts` | 54 |
| `app/backend/test/integration/pedidos-concorrencia.e2e-spec.ts` | 64 |
| `app/backend/test/integration/pedidos-onda4.e2e-spec.ts` | 79, 86 |
| `app/backend/test/integration/recebimento.e2e-spec.ts` | 46 |

`rg "insert\\((schema\\.)?clientes\\)"` em `app/backend` + `scripts` (exceto `migrations/**`) deve ter `faixaPreco` em cada `.values`.

- [ ] Helpers HTTP `novoCliente()` em `clientes.e2e-spec.ts` e `clientes-onda4.e2e-spec.ts`: acrescentar `faixaPreco: 'A'` no objeto base (senão **todos** os POST existentes passam a 400 — regressão). O teste **novo** da T02 é o POST **sem** a chave.

- [ ] Rodar `onda14-faixa-preco` + `clientes.e2e-spec` + `clientes-onda4` — verdes.
- [ ] `npm run test:cov` no backend: `ClientesService` ≥80% linha e branch.

**Commit:** `feat(onda14): clientes.faixa_preco A-D via 0037-0039`

---

## Task 3 — UI `Tabela de Preço` na aba Preferências (ALP-79)

**Files:** `clientes-client.tsx`, `onda4-clientes.test.tsx` (estender), `onda14-clientes-faixa.test.tsx`

**Depende de:** T02.

### Steps

- [ ] **TDD:** `onda14-clientes-faixa.test.tsx` — os 5 testes ALP-79 (presença A–D; POST com `'C'`; 400 acende aba+campo; round-trip; desabilitado sem `CLIENTES_GERENCIAR`). Falham. Estender fixture de `onda4-clientes.test.tsx` com `faixaPreco: 'A'` no objeto `cliente` (L6–40) para não regressar.

- [ ] Tipo — após `prioridade` em `interface Cliente` (L103):

```
  prioridade: 'normal' | 'alta' | null;
  faixaPreco: 'A' | 'B' | 'C' | 'D' | '';
```

`CLIENTE_VAZIO` (L121–135) ganha `faixaPreco: '',` — **não** pré-selecionar `'A'`.

- [ ] `abaDaChave` (L140–145) — `old_string`:

```
function abaDaChave(chave: string): AbaClientes {
  if (chave.startsWith('dadosFiscaisJson.')) return 'fiscais';
  if (chave.startsWith('dadosContatoJson.')) return 'contatos';
  if (chave.startsWith('preferenciasJson.')) return 'preferencias';
  return 'gerais'; // razaoSocial, nomeFantasia, documentoFiscal, representanteId, rotaId, prioridade, status
}
```

`new_string`:

```
function abaDaChave(chave: string): AbaClientes {
  if (chave.startsWith('dadosFiscaisJson.')) return 'fiscais';
  if (chave.startsWith('dadosContatoJson.')) return 'contatos';
  if (chave === 'faixaPreco' || chave.startsWith('preferenciasJson.')) return 'preferencias';
  return 'gerais'; // razaoSocial, nomeFantasia, documentoFiscal, representanteId, rotaId, prioridade, status
}
```

`TabsTrigger` já tem `temErro={abasComErro.has(valor)}` (L510) — não mudar.

- [ ] Payload `salvar` (L290–305) — acrescentar `faixaPreco: form.faixaPreco || undefined,` no objeto (vazio omite → 400 backend).

- [ ] Campo **primeiro** do grid da aba `preferencias`, **antes** de `Faixa de Peso Mínima (kg)` (L758). Irmão = `Perfil de Gordura Aceito` (Select). **Não** chamar `atualizarJson`. `old_string`:

```
                      <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
                        <FormField
                          label="Faixa de Peso Mínima (kg)"
                          htmlFor="peso-minimo"
```

`new_string`:

```
                      <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
                        <FormField
                          label="Tabela de Preço"
                          htmlFor="faixa-preco"
                          error={erros['faixaPreco']}
                        >
                          <Select
                            value={form.faixaPreco ?? ''}
                            disabled={!podeGerenciar}
                            onValueChange={(valor) => {
                              limparCampo('faixaPreco');
                              setForm((atual) => (atual ? { ...atual, faixaPreco: valor as 'A' | 'B' | 'C' | 'D' } : atual));
                            }}
                          >
                            <SelectTrigger
                              id="faixa-preco"
                              aria-label="Tabela de Preço"
                              aria-invalid={'faixaPreco' in erros || undefined}
                            >
                              <SelectValue placeholder="Selecionar" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="A">A</SelectItem>
                              <SelectItem value="B">B</SelectItem>
                              <SelectItem value="C">C</SelectItem>
                              <SelectItem value="D">D</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormField>
                        <FormField
                          label="Faixa de Peso Mínima (kg)"
                          htmlFor="peso-minimo"
```

`Select` / `SelectTrigger` / `SelectContent` / `SelectItem` **já** são importados nesta tela (usados em Perfil de Gordura). Não mudar `grid-cols-2`. BFF de clientes **não** muda.

- [ ] Jest verde. Zero hex avulso.

**Commit:** `feat(onda14): campo Tabela de Preço na aba Preferências`

---

## Task 4 — `resolverPrecoVigente` (ALP-80)

**Files:** `precos.service.ts`, `precos-vigente.controller.ts`, `dto/preco-vigente.dto.ts`, `precos.module.ts`, BFF, `app/backend/test/unit/precos-vigente.spec.ts`. HTTP 403/404/envelope no mesmo `precos-vigente.spec.ts` (Supertest). C2 e2e fica só em `onda14-preco-pedido.e2e-spec.ts` (T05). **Não** criar terceira suíte.

**Depende de:** T02 (faixa do cliente existe).

**Proibido:** chamar `precosDaUltimaPublicada` neste caminho. Não alterar o método privado (L322–333).

### Steps

- [ ] **TDD unitário primeiro** (`precos-vigente.spec.ts`): os 8 cenários de serviço da ALP-80 (B publicado; rascunho; dia anterior **sem fallback**; produto ausente; coluna NULL; `deleted_at`; `unidadePreco='unidade'`; lote 3/1). Falham.

- [ ] Em `precos.service.ts`, após o type `Tx` / `MapaDePrecos`, acrescentar:

```ts
export type FaixaPreco = 'A' | 'B' | 'C' | 'D';
export interface PrecoVigente {
  preco: string;
  unidadePreco: 'kg' | 'unidade';
  tabelaPrecoId: string;
}

function colunaDaFaixa(faixa: FaixaPreco): typeof tabelasPrecoItens.precoA {
  switch (faixa) {
    case 'A': return tabelasPrecoItens.precoA;
    case 'B': return tabelasPrecoItens.precoB;
    case 'C': return tabelasPrecoItens.precoC;
    case 'D': return tabelasPrecoItens.precoD;
  }
}
```

**Nunca** interpolar a faixa em SQL.

Importar `clientes`, `operacoes` de `../../../database/schema`.

Métodos públicos no service **imediatamente antes** de `precosDaUltimaPublicada` (HEAD L322):

```ts
  async resolverPrecoVigente(
    tx: Tx,
    args: { produtoId: string; faixa: FaixaPreco; data: string },
  ): Promise<PrecoVigente | null> {
    const mapa = await this.resolverPrecosVigentes(tx, {
      produtoIds: [args.produtoId],
      faixa: args.faixa,
      data: args.data,
    });
    return mapa.get(args.produtoId) ?? null;
  }

  async resolverPrecosVigentes(
    tx: Tx,
    args: { produtoIds: string[]; faixa: FaixaPreco; data: string },
  ): Promise<Map<string, PrecoVigente>> {
    const saida = new Map<string, PrecoVigente>();
    if (args.produtoIds.length === 0) return saida;
    const [tabela] = await tx.select({ id: tabelasPreco.id }).from(tabelasPreco)
      .where(and(
        eq(tabelasPreco.data, args.data),
        eq(tabelasPreco.status, 'publicada'),
        isNull(tabelasPreco.deletedAt),
      ))
      .limit(1);
    if (!tabela) return saida;
    const col = colunaDaFaixa(args.faixa);
    const linhas = await tx
      .select({
        produtoId: tabelasPrecoItens.produtoId,
        preco: col,
        unidadePreco: produtos.unidadePreco,
      })
      .from(tabelasPrecoItens)
      .innerJoin(produtos, eq(produtos.id, tabelasPrecoItens.produtoId))
      .where(and(
        eq(tabelasPrecoItens.tabelaPrecoId, tabela.id),
        inArray(tabelasPrecoItens.produtoId, args.produtoIds),
      ));
    for (const linha of linhas) {
      if (linha.preco === null) continue;
      saida.set(linha.produtoId, {
        preco: linha.preco,
        unidadePreco: linha.unidadePreco as 'kg' | 'unidade',
        tabelaPrecoId: tabela.id,
      });
    }
    return saida;
  }

  async vigentePorClienteOperacao(args: {
    produtoIds: string[];
    clienteId: string;
    operacaoId: string;
  }): Promise<Array<{
    produtoId: string;
    preco: string | null;
    unidadePreco: 'kg' | 'unidade' | null;
    tabelaPrecoId: string | null;
  }>> {
    return this.db.transaction(async (tx) => {
      const [cliente] = await tx.select({
        id: clientes.id,
        faixaPreco: clientes.faixaPreco,
      }).from(clientes)
        .where(and(eq(clientes.id, args.clienteId), isNull(clientes.deletedAt)))
        .limit(1);
      if (!cliente) throw new NotFoundException('Cliente não encontrado');
      if (!cliente.faixaPreco) {
        throw new ConflictException({
          code: 'CLIENTE_SEM_FAIXA_PRECO',
          message: 'Cliente sem faixa de preço.',
        });
      }
      const [operacao] = await tx.select({ id: operacoes.id, data: operacoes.data })
        .from(operacoes).where(eq(operacoes.id, args.operacaoId)).limit(1);
      if (!operacao) throw new NotFoundException('Operação não encontrada');
      const mapa = await this.resolverPrecosVigentes(tx, {
        produtoIds: args.produtoIds,
        faixa: cliente.faixaPreco as FaixaPreco,
        data: operacao.data,
      });
      return args.produtoIds.map((produtoId) => {
        const hit = mapa.get(produtoId);
        return {
          produtoId,
          preco: hit?.preco ?? null,
          unidadePreco: hit?.unidadePreco ?? null,
          tabelaPrecoId: hit?.tabelaPrecoId ?? null,
        };
      });
    });
  }
```

Importar `inArray` de `drizzle-orm` (já há `and`, `eq`, `isNull`, `lt`, `desc`). `null` é resposta legítima — nunca devolver `"0"`.

- [ ] `dto/preco-vigente.dto.ts`:

```ts
import { z } from 'zod';

export const vigenteQuerySchema = z.object({
  produtoIds: z.string().min(1).transform((s, ctx) => {
    const ids = s.split(',').map((x) => x.trim()).filter(Boolean);
    if (ids.length === 0 || ids.some((id) => !z.string().uuid().safeParse(id).success)) {
      ctx.addIssue({ code: 'custom', message: 'produtoIds deve ser lista de UUIDs separados por vírgula.' });
      return z.NEVER;
    }
    return ids;
  }),
  clienteId: z.string().uuid(),
  operacaoId: z.string().uuid(),
});
export type VigenteQuery = z.infer<typeof vigenteQuerySchema>;
```

- [ ] `precos-vigente.controller.ts` **novo** (não editar as rotas `:id` de tabelas):

```ts
@SkipThrottle()
@Controller('precos')
@UseGuards(JwtAuthGuard, RbacGuard)
export class PrecosVigenteController {
  constructor(private readonly service: PrecosService) {}

  @Get('vigente')
  @RequirePermissoes('TABELA_PRECO_LER')
  async vigente(@Query(new ZodValidationPipe(vigenteQuerySchema)) query: VigenteQuery) {
    const data = await this.service.vigentePorClienteOperacao({
      produtoIds: query.produtoIds,
      clienteId: query.clienteId,
      operacaoId: query.operacaoId,
    });
    return { data };
  }
}
```

Tipo do envelope (exportar de `dto/preco-vigente.dto.ts`). O frontend **não** importa este arquivo — T06 redeclara o mesmo shape como `LinhaVigente`.

```ts
export type PrecoVigenteHttp = {
  produtoId: string;
  preco: string | null;
  unidadePreco: 'kg' | 'unidade' | null;
  tabelaPrecoId: string | null;
};
export type PrecoVigenteEnvelope = { data: PrecoVigenteHttp[] };
```

`vigentePorClienteOperacao` já devolve `PrecoVigenteHttp[]`. O controller **só** envelopa `{ data }`. **Nunca** `{ itens }`. Quando não há vigente, `preco`, `unidadePreco` e `tabelaPrecoId` são `null` (não `"0"`, não `'kg'` inventado).

- [ ] `precos.module.ts` — `controllers: [PrecosController, PrecosVigenteController]`. `exports` já tem `PrecosService`.

- [ ] BFF `app/frontend/src/app/api/precos/vigente/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  return repassar(`/precos/vigente${qs ? `?${qs}` : ''}`);
}
```

(`repassar` de `@/lib/bff` — **não** o helper local de `tabelas/route.ts`.)

- [ ] Testes HTTP: 403 sem `TABELA_PRECO_LER` (perfil `recebimento_pesagem`); 404 operação inexistente; 404 cliente inexistente. Sem fallback (C2) no unitário. Envelope: `expect(body).toEqual({ data: expect.any(Array) }); expect(body).not.toHaveProperty('itens');` — cada elemento tem exatamente `produtoId`, `preco` (`string | null`), `unidadePreco` (`'kg' | 'unidade' | null`), `tabelaPrecoId` (`string | null`). Caso sem vigente: os três campos de preço/unidade/tabela são `null`.

- [ ] `rg precosDaUltimaPublicada app/backend/src/modules/comercial/precos/precos.service.ts` — continua **apenas** nas linhas 99, 182 e 322 (criar/copiar/privado). Zero uso em `resolver*`.

**Commit:** `feat(onda14): resolverPrecoVigente por faixa+produto+data exata`

---

## Task 5 — Colunas de preço no item + `PATCH .../preco` (ALP-81)

**Files:** `pedidos.schema.ts`, 0040–0042, `pedido.dto.ts`, `pedidos.service.ts`, `pedidos.controller.ts`, `pedidos.module.ts`, `onda14-preco-pedido.e2e-spec.ts`

**Depende de:** T04. Permissão do PATCH = **`PEDIDOS_GERENCIAR`** (não criar outra).

### Steps — fail-closed de backfill (obrigatório, nesta ordem)

- [ ] **Antes** do contract 0042, no banco-alvo da worktree:

```powershell
Set-Location app/backend
npx tsx -e "const { Client } = require('pg'); const c = new Client({ connectionString: process.env.DATABASE_URL }); c.connect().then(async () => { const r = await c.query('select count(*)::int as n from pedidos_venda_itens'); console.log('onda14-itens-count=' + r.rows[0].n); await c.end(); });"
```

- Se `onda14-itens-count` > 0: **PARAR e escalar ao Quality Owner**. Não inventar `preco_aplicado`. Não aplicar 0042.
- Se `onda14-itens-count` = 0: gravar a linha em `docs/evidencias/onda14-preco-tabela-pedido/backfill-itens-count.txt` e seguir. O SQL de 0041 é o assert:

```sql
-- 0041_onda14_item_preco_backfill.sql
DO $$
DECLARE
  v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM pedidos_venda_itens;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'Onda 14 backfill preco_aplicado: base tem % itens. Escalar ao Quality Owner (AD-16 / Princípio VII).', v_n;
  END IF;
END $$;
```

### Schema expand (nullable, sem CHECK NOT NULL)

Em `pedidosVendaItens`, após `observacoes` (L61), **acrescentar**:

```
    tabelaPrecoId:             uuid('tabela_preco_id').references(() => tabelasPreco.id),
    faixaPreco:                text('faixa_preco'),
    unidadePreco:              text('unidade_preco'),
    precoTabelaOriginal:       numeric('preco_tabela_original', { precision: 15, scale: 2 }),
    precoAplicado:             numeric('preco_aplicado', { precision: 15, scale: 2 }),
    usuarioAjusteId:           uuid('usuario_ajuste_id').references(() => usuarios.id),
    ajustadoEm:                timestamp('ajustado_em', { withTimezone: true }),
```

Importar `tabelasPreco` de `./tabelas-preco.schema` (`usuarios` já importado). Generate `--name=onda14_item_preco_expand` → `0040_onda14_item_preco_expand`. Sem DROP, sem NOT NULL.

### Contract (só se count=0)

No schema, `faixaPreco`, `unidadePreco`, `precoAplicado` passam a `.notNull()`. CHECKs no callback:

```
    check('chk_pedidos_itens_faixa_preco', sql`${t.faixaPreco} IN ('A','B','C','D')`),
    check('chk_pedidos_itens_unidade_preco', sql`${t.unidadePreco} IN ('kg','unidade')`),
    check('chk_pedidos_itens_preco_aplicado_positivo', sql`${t.precoAplicado} > 0`),
```

`tabela_preco_id`, `preco_tabela_original`, `usuario_ajuste_id`, `ajustado_em` **permanecem nullable**. Generate `0042_onda14_item_preco_contract`. `drizzle-kit check` limpo.

### DTO

`itemPedidoSchema` e `incluirItemSchema` ganham:

```ts
const PRECO_APLICADO_REGEX = /^\d+(\.\d{1,2})?$/;
const PRECO_ZERO_LIKE = /^0+(\.0{1,2})?$/;

/** NUMERIC(15,2) como string. Sem Number(), sem coerce. */
export function ehPrecoNaoPositivo(valor: string | null | undefined): boolean {
  if (valor == null || valor.trim() === '') return true;
  const s = valor.trim();
  if (!PRECO_APLICADO_REGEX.test(s)) return true;
  return PRECO_ZERO_LIKE.test(s);
}

export const precoAplicadoSchema = z.string()
  .regex(PRECO_APLICADO_REGEX, 'precoAplicado deve ter no máximo 2 casas decimais')
  .refine((s) => !PRECO_ZERO_LIKE.test(s), 'precoAplicado deve ser maior que zero');
```

```ts
precoAplicado: precoAplicadoSchema.optional(),
```

Novo:

```ts
export const ajustarPrecoItemSchema = z.object({
  precoAplicado: precoAplicadoSchema,
}).strict();
export type AjustarPrecoItemDto = z.infer<typeof ajustarPrecoItemSchema>;
```

`ItemSolicitado` ganha `precoAplicado?: string`.

`createPedido` / `incluirItem` mapeiam `item.precoAplicado` para `ItemSolicitado`.

Importar `ehPrecoNaoPositivo` e `precoAplicadoSchema` de `./dto/pedido.dto` no service.

### Service — congelar na inclusão

`persistirItensPlanejados` (L562–592): **antes** do `insert`, na mesma `tx`. Acrescentar `produtos` no import nomeado de `../../../database/schema` (HEAD hoje importa `clientes` e `operacoes`, não `produtos`).

**Uma vez por chamada** (antes do `for`), faixa e data:

```ts
    const [clienteFaixa] = await tx.select({ faixaPreco: clientes.faixaPreco })
      .from(clientes)
      .where(and(eq(clientes.id, pedido.clienteId), isNull(clientes.deletedAt)))
      .limit(1);
    if (!clienteFaixa?.faixaPreco) {
      throw new ConflictException({
        code: 'CLIENTE_SEM_FAIXA_PRECO',
        message: 'Cliente sem faixa de preço.',
      });
    }
    if (!pedido.operacaoId) throw new ConflictException('Pedido sem operação');
    const [operacaoData] = await tx.select({ data: operacoes.data })
      .from(operacoes).where(eq(operacoes.id, pedido.operacaoId)).limit(1);
    if (!operacaoData) throw new NotFoundException('Operação não encontrada');
```

**Por item**, imediatamente antes do `tx.insert(pedidosVendaItens)`:

```ts
      const [produto] = await tx.select({
        codigo: produtos.codigo,
        nome: produtos.nome,
        unidadePreco: produtos.unidadePreco,
      }).from(produtos).where(eq(produtos.id, solicitado.produtoId)).limit(1);
      if (!produto) throw new NotFoundException('Produto não encontrado');
      const vigente = await this.precos.resolverPrecoVigente(tx, {
        produtoId: solicitado.produtoId,
        faixa: clienteFaixa.faixaPreco as 'A' | 'B' | 'C' | 'D',
        data: operacaoData.data,
      });
      // Catálogo NOT NULL (`produtos.unidade_preco`). Resolvedor null NÃO inventa 'kg'.
      // Nunca unidadePedido / unidadeComercial.
      const unidadePreco = produto.unidadePreco as 'kg' | 'unidade';
      const precoTabelaOriginal = vigente?.preco ?? null;
      const precoAplicado = solicitado.precoAplicado ?? vigente?.preco ?? null;
      if (ehPrecoNaoPositivo(precoAplicado)) {
        throw new BadRequestException(
          `Informe um preço unitário maior que zero para ${produto.codigo} (${produto.nome}).`,
        );
      }
      const distinto = await tx.execute<{ eq: boolean }>(sql`
        SELECT (${precoAplicado}::numeric(15,2) IS DISTINCT FROM ${precoTabelaOriginal}::numeric(15,2)) AS eq
      `);
      const ajustouNaInclusao = distinto.rows[0]?.eq === true;
```

No `.values({` do insert, acrescentar (demais campos do HEAD intactos):

```
        tabelaPrecoId: vigente?.tabelaPrecoId ?? null,
        faixaPreco: clienteFaixa.faixaPreco,
        unidadePreco,
        precoTabelaOriginal,
        precoAplicado,
        usuarioAjusteId: ajustouNaInclusao ? usuarioId : null,
        ajustadoEm: ajustouNaInclusao ? new Date() : null,
```

`PedidosModule` importa `PrecosModule`. Injetar `PrecosService` no construtor de `PedidosService`.

### `ajustarPrecoItem`

```ts
  async ajustarPrecoItem(
    pedidoId: string, itemId: string, dto: AjustarPrecoItemDto, usuarioId: string,
  ): Promise<PedidoVendaItem> {
    return this.db.transaction(async (tx) => {
      const pedido = await this.obterPedidoAtivoSobLock(tx, pedidoId, usuarioId);
      if (!(PedidosService.STATUS_ABERTOS as readonly string[]).includes(pedido.status)) {
        throw new ConflictException('Pedido não aceita ajuste de preço');
      }
      const item = await this.obterItemAtivoSobLock(tx, pedidoId, itemId, usuarioId);
      // Zod já rejeitou zero-like / formato. Recheck em NUMERIC(15,2) — nunca Number().
      // `tx.execute` neste arquivo devolve `{ rows }` (ver `composicaoLotes` L203–233).
      const positivo = await tx.execute<{ ok: boolean }>(sql`
        SELECT (${dto.precoAplicado}::numeric(15,2) > 0) AS ok
      `);
      if (positivo.rows[0]?.ok !== true) {
        throw new BadRequestException('precoAplicado deve ser maior que zero');
      }
      const igualOriginal = await tx.execute<{ eq: boolean }>(sql`
        SELECT (${dto.precoAplicado}::numeric(15,2) IS NOT DISTINCT FROM ${item.precoTabelaOriginal}) AS eq
      `);
      const limpar = igualOriginal.rows[0]?.eq === true;
      const [atualizado] = await tx.update(pedidosVendaItens).set({
        precoAplicado: dto.precoAplicado,
        usuarioAjusteId: limpar ? null : usuarioId,
        ajustadoEm: limpar ? null : new Date(),
        updatedAt: new Date(),
      }).where(eq(pedidosVendaItens.id, itemId)).returning();
      await this.auditoria.registrar(tx, {
        tabela: 'pedidos_venda_itens',
        registroId: itemId,
        operacao: 'UPDATE',
        modulo: 'comercial',
        usuarioId,
        justificativa: 'pedido.item.preco_ajustado',
        dadosAnteriores: {
          precoAnterior: item.precoAplicado,
          precoTabelaOriginal: item.precoTabelaOriginal,
        },
        dadosNovos: {
          precoNovo: dto.precoAplicado,
          precoTabelaOriginal: item.precoTabelaOriginal,
        },
      });
      if (!atualizado) throw new NotFoundException('Item não encontrado');
      return atualizado;
    });
  }
```

(Ajuste o `tx.execute` ao helper já usado no arquivo — `composicaoLotes` lê `.rows`. Comparação DECIMAL só via `::numeric(15,2)` — **não** `Number`.)

Auditoria: um único payload. `RegistroAuditoria` no HEAD (`auditoria.service.ts` L12–23) **já tem** `justificativa?: string | null`. Usar exatamente `justificativa: 'pedido.item.preco_ajustado'` como acima. **Proibido** o fork “se tiver campo livre / senão precoNovo”. `dadosNovos.precoNovo` permanece no JSON; o assert canônico é só `justificativa`.

### `finalizar` — revalidar preço > 0

Entre L1049 (`// overbooking_confirmado é aceito`) e o `UPDATE` L1051:

```
      const semPreco = await tx.select({ id: pedidosVendaItens.id, produtoId: pedidosVendaItens.produtoId })
        .from(pedidosVendaItens)
        .where(and(
          eq(pedidosVendaItens.pedidoVendaId, pedidoId),
          isNull(pedidosVendaItens.deletedAt),
          sql`${pedidosVendaItens.precoAplicado} IS NULL OR ${pedidosVendaItens.precoAplicado} <= 0`,
        ));
      if (semPreco.length) {
        throw new ConflictException({
          code: 'PEDIDO_ITEM_SEM_PRECO',
          message: 'Há itens sem preço aplicado maior que zero.',
          itens: semPreco,
        });
      }
```

A criação da ocorrência entra na **T07** (não nesta task), no mesmo ponto após o UPDATE.

### `detalhar`

O `with: { itens }` já devolve as colunas novas. Após o `findFirst` e o bloco `heranca` (HEAD L184–196), **query auxiliar** (não alterar relations Drizzle):

```ts
      const idsAjuste = [...new Set(
        pedido.itens
          .map((item) => item.usuarioAjusteId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      )];
      const nomesAjuste = idsAjuste.length === 0
        ? []
        : await tx.select({ id: usuarios.id, nome: usuarios.nome })
          .from(usuarios)
          .where(inArray(usuarios.id, idsAjuste));
      const mapaNomes = new Map(nomesAjuste.map((u) => [u.id, u.nome]));
      return {
        ...pedido,
        heranca: heranca ?? null,
        itens: pedido.itens.map((item) => ({
          ...item,
          precoAjustado: item.precoTabelaOriginal !== item.precoAplicado,
          usuarioAjusteNome: item.usuarioAjusteId
            ? (mapaNomes.get(item.usuarioAjusteId) ?? null)
            : null,
        })),
      };
```

Importar `usuarios` de `../../../database/schema` (`inArray` já está no import do arquivo). `precoAjustado` = `precoTabelaOriginal !== precoAplicado` nas strings persistidas (null vs valor = true).

`composicaoLotes` **não** precisa das colunas de preço (não é payload de item).

### Controller

Após `PATCH ':id/itens/:itemId'` (L134–143), **acrescentar** rota mais específica (Nest casa os dois):

```
  @Patch(':id/itens/:itemId/preco')
  @RequirePermissoes('PEDIDOS_GERENCIAR')
  async ajustarPreco(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body(new ZodValidationPipe(ajustarPrecoItemSchema)) dto: AjustarPrecoItemDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.ajustarPrecoItem(id, itemId, dto, user.sub);
  }
```

### IncluirItem 409 legado

`old_string` (duas ocorrências L455 e L483):

```
        throw new ConflictException('Item comercial já existe neste pedido');
```

`new_string`:

```
        throw new ConflictException('Produto já existe neste pedido');
```

(`replace_all` no arquivo.)

### Adendo

Não editar o `.set()` de quantidade em `adendos.service.ts` L77–83. Teste C6: item ajustado + adendo → mesmo `preco_aplicado` / `preco_tabela_original` / `usuario_ajuste_id`.

### Testes e2e (`onda14-preco-pedido.e2e-spec.ts`)

Todos os cenários ALP-81 + C1, C2, C6, 14.5, 14.5b. 403: `createTestUser({ perfil: 'compras' })` no PATCH `.../preco`. 409 em pedido finalizado. `'0'` e `'18.999'` → 400. Republicar tabela + mudar faixa do cliente.

Após o PATCH de ajuste, **um** assert de auditoria (tabela `auditoria`, último registro do `itemId`):

```ts
    const [reg] = await db.select({
      justificativa: auditoria.justificativa,
    }).from(auditoria)
      .where(eq(auditoria.registroId, itemId))
      .orderBy(desc(auditoria.createdAt))
      .limit(1);
    expect(reg?.justificativa).toBe('pedido.item.preco_ajustado');
```

C1 (sem vigente): item persistido tem `unidade_preco` = `produtos.unidade_preco` do catálogo (nunca `'kg'` inventado). Inclusive produto com `unidadePreco='unidade'`.

Reusar `comercial-fixtures.ts` (já com `faixaPreco: 'A'`). Criar tabela publicada no `operacao.data` por insert Drizzle (`tabelas_preco.status='publicada'` + linhas em `tabelas_preco_itens` com `precoB` etc.). **Não** chamar HTTP de `PrecosService.criar` neste e2e.

**Commit:** `feat(onda14): congela preço no item e PATCH .../preco (PEDIDOS_GERENCIAR)`

---

## Task 6 — UI coluna `Preço unitário` (ALP-82)

**Files:** `pedido-editor.tsx`, `lib/comercial.ts`, BFF `comercial/pedidos/[id]/itens/[itemId]/preco/route.ts`, `onda14-pedido-preco.test.tsx`, estender `onda4-pedidos.test.tsx`

**Depende de:** T05.

**Estado real:** editor já é `produtoId`. T06 **não** faz rename. Aceite: `rg itemComercialId app/frontend/src/app/(admin)/comercial/pedidos/pedido-editor.tsx` vazio.

### Steps

- [ ] **TDD Jest** com os `it('...')` enumerados no final desta task (10 ALP-82 + remap/lock + envelope `data`). Falham.

- [ ] `PedidoVendaItem` em `lib/comercial.ts` (L148–159) ganha:

```
  tabelaPrecoId?: string | null;
  faixaPreco?: 'A' | 'B' | 'C' | 'D';
  unidadePreco?: 'kg' | 'unidade';
  precoTabelaOriginal?: string | null;
  precoAplicado?: string;
  precoAjustado?: boolean;
  usuarioAjusteNome?: string | null;
  ajustadoEm?: string | null;
```

`CriarPedidoDto.itens` (HEAD L188–198) — `old_string`:

```
  itens: Array<{ produtoId: string; quantidadePedida: number; observacoes?: string }>;
```

`new_string`:

```
  itens: Array<{ produtoId: string; quantidadePedida: number; observacoes?: string; precoAplicado?: string }>;
```

`ProdutoPedido` (HEAD L48–55) **não** tem `unidadePreco` — só `unidadeComercial?: string`. Declarar o campo do catálogo. `old_string` único:

```
export interface ProdutoPedido {
  id: string;
  codigo: string;
  descricao: string;
  status: string;
  nome?: string;
  unidadeComercial?: string;
}
```

`new_string`:

```
export interface ProdutoPedido {
  id: string;
  codigo: string;
  descricao: string;
  status: string;
  nome?: string;
  unidadeComercial?: string;
  unidadePreco?: 'kg' | 'unidade';
}
```

`GET /api/cadastros/produtos` já devolve `produtos.unidadePreco` (`$inferSelect`). Não usar `unidadeComercial` como sufixo de preço.

`ItemNovo` no editor ganha os campos no patch abaixo (não só o tipo — o Worker aplica o `old_string`/`new_string` de `interface ItemNovo`).

- [ ] BFF novo `app/frontend/src/app/api/comercial/pedidos/[id]/itens/[itemId]/preco/route.ts` — copiar o padrão de `itens/[itemId]/route.ts` (`apiFetch` + helper `repassar` **local** daquele arquivo, que preserva 204):

```ts
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id, itemId } = await ctx.params;
  const body = await req.json();
  const response = await apiFetch(`/comercial/pedidos/${id}/itens/${itemId}/preco`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return repassar(response);
}
```

- [ ] Editor — ao mudar `clienteId` **e** `operacaoId`, `GET /api/precos/vigente?produtoIds=...&clienteId=...&operacaoId=...` e guardar mapa. Sem preço → `'0.00'` na UI (`0,00` exibido).

- [ ] `adicionarProduto` (L325–338): incluir desabilitado se preço da linha nova for `0` / `0.00`; mensagem no campo. Item ainda não gravado: `precoAplicado` no `ItemNovo` e no `payloadNovo` / POST inclusão.

- [ ] Grade persistida (L589–645) — `old_string` do header:

```
                  <TableHead>Produto</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead />
```

`new_string`:

```
                  <TableHead>Produto</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead className="text-right">Preço unitário</TableHead>
                  <TableHead />
```

Imports no topo do editor (HEAD L3: `useEffect, useMemo, useState` — sem `useRef`, sem `cn`, sem Tooltip). `old_string`:

```
import { useEffect, useMemo, useState } from 'react';
```

`new_string`:

```
import { useEffect, useMemo, useRef, useState } from 'react';
```

Após a linha `import { ModalOverbooking } from './modal-overbooking';`:

```
import { cn } from '@/lib/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
```

Helper local (após `origemItem`):

```ts
function formatarPtBr(valor: string): string {
  // Só exibição (tooltip). Payload permanece string DECIMAL. Não é persistência.
  const [inteiraBruta, fracBruta = ''] = valor.split('.');
  const inteira = (inteiraBruta.replace(/^0+(?=\d)/, '') || '0');
  const cents = (fracBruta + '00').slice(0, 2);
  return `${inteira},${cents}`;
}

function normalizarPrecoInput(bruto: string): string {
  const trimmed = bruto.trim().replace(',', '.');
  if (trimmed === '') return '';
  return trimmed;
}

function ehPrecoNaoPositivoUi(valor: string): boolean {
  const trimmed = valor.trim();
  if (trimmed === '' || !/^\d+(\.\d{1,2})?$/.test(trimmed)) return true;
  return /^0+(\.0{1,2})?$/.test(trimmed);
}

function sufixoUnidadePreco(unidade: 'kg' | 'unidade' | null | undefined): string | null {
  if (unidade === 'unidade') return '/un';
  if (unidade === 'kg') return '/kg';
  return null;
}
```

`ItemNovo` (L76–79) `old_string`:

```
interface ItemNovo {
  produtoId: string;
  quantidadePedida: number;
}
```

`new_string`:

```
interface ItemNovo {
  produtoId: string;
  quantidadePedida: number;
  precoAplicado: string;
  precoTabelaOriginal: string | null;
  unidadePreco: 'kg' | 'unidade' | null;
}
```

Estado após `quantidades` (L137):

```
  const [precos, setPrecos] = useState<Record<string, string>>({});
  const [precoNovo, setPrecoNovo] = useState('0.00');
  const [precoNovoTabela, setPrecoNovoTabela] = useState<string | null>(null);
  const [unidadePrecoNovo, setUnidadePrecoNovo] = useState<'kg' | 'unidade' | null>(null);
  const itensNovosRef = useRef(itensNovos);
  itensNovosRef.current = itensNovos;

`useEffect` de quantidades (L146–150) — **estender o mesmo efeito** (não criar irmão) para hidratar preços persistidos:

```
  useEffect(() => {
    setQuantidades(Object.fromEntries(
      (pedido?.itens ?? []).map((item) => [item.id, String(Number(item.quantidadePedida))]),
    ));
    setPrecos(Object.fromEntries(
      (pedido?.itens ?? []).map((item) => [item.id, item.precoAplicado ?? '0.00']),
    ));
  }, [pedido]);
```

Consulta vigente — **dois** `useEffect` (não um só com `[..., itensNovos]`). Envelope = `{ data }` (T04). `unidadePreco` do vigente pode ser `null` (sem tabela) — **não** vira `'kg'`. Sufixo = `ProdutoPedido.unidadePreco` (catálogo). Pedido já persistido: cliente e operação estão `disabled` no HEAD (L517 / L524) — **lock**; itens persistidos **nunca** reconsultam tabela.

```ts
  type LinhaVigente = {
    produtoId: string;
    preco: string | null;
    unidadePreco: 'kg' | 'unidade' | null;
    tabelaPrecoId: string | null;
  };

  function aplicarPrecoDoProdutoNovo(linha: LinhaVigente | undefined) {
    setPrecoNovo(linha?.preco ?? '0.00');
    setPrecoNovoTabela(linha?.preco ?? null);
  }

  useEffect(() => {
    const produto = produtos.find((item) => item.id === produtoNovo);
    setUnidadePrecoNovo(
      produto?.unidadePreco === 'unidade' || produto?.unidadePreco === 'kg'
        ? produto.unidadePreco
        : null,
    );
  }, [produtoNovo, produtos]);

  // Campo do produto em edição. Não remapeia itensNovos (evita loop).
  useEffect(() => {
    if (!clienteId || !operacaoId || !produtoNovo) return;
    let ativo = true;
    const qs = new URLSearchParams({
      clienteId,
      operacaoId,
      produtoIds: produtoNovo,
    });
    void fetch(`/api/precos/vigente?${qs.toString()}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((corpo: { data?: LinhaVigente[] } | null) => {
        if (!ativo) return;
        const doNovo = corpo?.data?.find((linha) => linha.produtoId === produtoNovo);
        aplicarPrecoDoProdutoNovo(doNovo);
      })
      .catch(() => {
        if (ativo) aplicarPrecoDoProdutoNovo(undefined);
      });
    return () => {
      ativo = false;
    };
  }, [clienteId, operacaoId, produtoNovo]);

  // Remap do rascunho: só quando cliente/operação mudam. Sem `itensNovos` nas deps.
  useEffect(() => {
    if (pedido) return;
    if (!clienteId || !operacaoId) return;
    const ids = itensNovosRef.current.map((item) => item.produtoId);
    if (ids.length === 0) return;
    let ativo = true;
    const qs = new URLSearchParams({
      clienteId,
      operacaoId,
      produtoIds: ids.join(','),
    });
    void fetch(`/api/precos/vigente?${qs.toString()}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((corpo: { data?: LinhaVigente[] } | null) => {
        if (!ativo || !Array.isArray(corpo?.data)) return;
        const mapa = new Map(corpo.data.map((linha) => [linha.produtoId, linha]));
        setItensNovos((atuais) => atuais.map((item) => {
          const hit = mapa.get(item.produtoId);
          return {
            ...item,
            precoAplicado: hit?.preco ?? '0.00',
            precoTabelaOriginal: hit?.preco ?? null,
          };
        }));
      })
      .catch(() => {
        /* ausência de rede não inventa preço */
      });
    return () => {
      ativo = false;
    };
  }, [clienteId, operacaoId, pedido]);
```

**Proibido** ler `corpo.itens`. UI usa `corpo.data`. `unidadePreco` do vigente `null` **não** exibe `/kg` e **não** aplica `?? 'kg'`. Sufixo = `sufixoUnidadePreco(produto.unidadePreco)` (campo declarado em `ProdutoPedido`). Se o catálogo não trouxer unidade, omitir o `<span>` do sufixo. Itens de `pedido.itens` não entram neste remap (preço congelado).

`adicionarProduto` (L325–351) — `old_string` do ramo sem pedido:

```
      setItensNovos((atuais) => [...atuais, {
        produtoId: produtoNovo,
        quantidadePedida: quantidade,
      }]);
      setProdutoNovo('');
      setQuantidadeNova('1');
      return;
```

`new_string`:

```
      if (ehPrecoNaoPositivoUi(precoNovo)) {
        setErro('Informe um preço unitário maior que zero para incluir o produto.');
        return;
      }
      setItensNovos((atuais) => [...atuais, {
        produtoId: produtoNovo,
        quantidadePedida: quantidade,
        precoAplicado: precoNovo,
        precoTabelaOriginal: precoNovoTabela,
        unidadePreco: unidadePrecoNovo,
      }]);
      setProdutoNovo('');
      setQuantidadeNova('1');
      setPrecoNovo('0.00');
      setPrecoNovoTabela(null);
      setUnidadePrecoNovo(null);
      return;
```

Ramo com pedido — `old_string`:

```
    const body = JSON.stringify({ produtoId: produtoNovo, quantidade });
```

`new_string`:

```
    if (ehPrecoNaoPositivoUi(precoNovo)) {
      setErro('Informe um preço unitário maior que zero para incluir o produto.');
      return;
    }
    const body = JSON.stringify({ produtoId: produtoNovo, quantidade, precoAplicado: precoNovo });
```

Após sucesso do `mutar` de inclusão, resetar `precoNovo`/`precoNovoTabela`/`unidadePrecoNovo` como no ramo novo.

Botão Adicionar (HEAD L694) — `old_string`:

```
          <Button type="button" variant="secondary" disabled={!podeGerenciar || pendente} onClick={() => void adicionarProduto()}>
```

`new_string`:

```
          <Button type="button" variant="secondary" disabled={!podeGerenciar || pendente || ehPrecoNaoPositivoUi(precoNovo)} onClick={() => void adicionarProduto()}>
```

`persistirPreco` — após `aplicarQuantidade`:

```ts
  async function persistirPreco(item: PedidoVendaDetalhe['itens'][number]) {
    if (!pedido) return;
    const bruto = normalizarPrecoInput(precos[item.id] ?? '');
    if (ehPrecoNaoPositivoUi(bruto)) {
      setErro('Informe um preço unitário maior que zero.');
      return;
    }
    if (bruto === item.precoAplicado) return;
    const ok = await mutar(`/api/comercial/pedidos/${pedido.id}/itens/${item.id}/preco`, {
      method: 'PATCH',
      body: JSON.stringify({ precoAplicado: bruto }),
    });
    if (ok) await recarregar();
  }
```

Pedido não editável (fora de `STATUS_ABERTOS`) ou `!podeGerenciar`: `disabled` + `readOnly`. Pedido `finalizado`: coluna **visível**, `readOnly`, `precoAjustado` do backend preserva a borda.

Entre a `TableCell` de Quantidade e a de ações, célula **literal**:

```tsx
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Input
                                aria-label="Preço unitário"
                                type="number"
                                step="0.01"
                                min={0}
                                inputMode="decimal"
                                adornLeft={<span className="text-[11px]">R$</span>}
                                className={cn(
                                  'h-8 w-28 text-right font-data',
                                  item.precoAjustado && 'border-warning',
                                )}
                                value={precos[item.id] ?? item.precoAplicado ?? ''}
                                disabled={!podeGerenciar || Boolean(pedido && !['rascunho', 'em_elaboracao_reserva_ativa', 'aguardando_confirmacao_overbooking'].includes(pedido.status))}
                                readOnly={!podeGerenciar || pedido?.status === 'finalizado'}
                                onChange={(event) => setPrecos((atuais) => ({
                                  ...atuais,
                                  [item.id]: normalizarPrecoInput(event.target.value),
                                }))}
                                onBlur={() => void persistirPreco(item)}
                              />
                            </TooltipTrigger>
                            {item.precoAjustado && (
                              <TooltipContent>
                                {item.precoTabelaOriginal == null
                                  ? 'Sem preço de tabela para esta data'
                                  : `Valor da Tabela: R$ ${formatarPtBr(item.precoTabelaOriginal)}`}
                              </TooltipContent>
                            )}
                          </Tooltip>
                          <span className="text-[11px] text-muted-foreground">
                            {sufixoUnidadePreco(item.unidadePreco ?? produtos.find((produto) => produto.id === item.produtoId)?.unidadePreco)}
                          </span>
                        </div>
                      </TableCell>
```

`precoAjustado` vem **do backend**, não é recalculado no cliente. Payload de API sempre com ponto (`"18.50"`); exibição pt-BR só no tooltip (`18,50`). Voltar ao original (blur com valor igual ao `precoTabelaOriginal`) chama o mesmo PATCH — o backend limpa autor/timestamp e `precoAjustado` vira false → borda some.

Lista `itensNovos` (L656–661) — acrescentar o preço à direita da quantidade:

`old_string`:

```
                  <span>{nomeProduto(produtos.find((produto) => produto.id === item.produtoId))}</span>
                  <span className="font-data">{item.quantidadePedida}</span>
```

`new_string`:

```
                  <span>{nomeProduto(produtos.find((produto) => produto.id === item.produtoId))}</span>
                  <span className="font-data">{item.quantidadePedida}</span>
                  <span className="font-data">{`R$ ${formatarPtBr(item.precoAplicado)}`}</span>
```

Footer de inclusão — após o `FormField` de quantidade (L682–693), **antes** do botão Adicionar, campo irmão (mesmo `Input` DS v3):

```tsx
          <FormField label="Preço unitário" htmlFor="preco-produto-novo">
            <div className="flex items-center gap-1">
              <Input
                id="preco-produto-novo"
                aria-label="Preço unitário do novo produto"
                type="number"
                step="0.01"
                min={0}
                inputMode="decimal"
                adornLeft={<span className="text-[11px]">R$</span>}
                className="h-8 w-28 text-right font-data"
                value={precoNovo}
                disabled={!podeGerenciar}
                onChange={(event) => setPrecoNovo(normalizarPrecoInput(event.target.value))}
              />
              <span className="text-[11px] text-muted-foreground">
                {sufixoUnidadePreco(unidadePrecoNovo)}
              </span>
            </div>
          </FormField>
```

BFF GET vigente: `app/frontend/src/app/api/precos/vigente/route.ts` usando `repassar` de `@/lib/bff` (não o helper local do PATCH de item).

- [ ] Pedido finalizado: coluna visível, `readOnly`, destaque preservado.
- [ ] Estender `onda4-pedidos.test.tsx`: mock de `GET /api/precos/vigente` em `instalarFetch` devolvendo `{ data: [...] }` (nunca `{ itens }`); payload de criação pode ganhar `precoAplicado` opcional. `rg itemComercialId` nesse arquivo deve permanecer vazio.
- [ ] Jest 1:1 — arquivo `onda14-pedido-preco.test.tsx`. Cada `it` abaixo é obrigatório (título literal):

```ts
it('grade renderiza a coluna Preço unitário', async () => {
  // render editor; expect(screen.getByText('Preço unitário')).toBeInTheDocument();
});
it('preço vem preenchido após escolher cliente e operação via corpo.data', async () => {
  // mock GET /api/precos/vigente → { data: [{ produtoId, preco: '18.50', unidadePreco: 'kg', tabelaPrecoId }] };
  // selecionar cliente+operação+produto; campo Preço unitário do novo produto = 18.50 (não lê corpo.itens).
});
it('produto sem preço mostra 0,00 e desabilita incluir', async () => {
  // mock data: [{ ..., preco: null, unidadePreco: null }]; input 0.00;
  // botão Adicionar produto disabled={true} via ehPrecoNaoPositivoUi(precoNovo).
});
it('editar para valor diferente aplica a classe border-warning', async () => {
  // item persistido precoAjustado=true; Input com className contendo border-warning.
});
it('tooltip mostra Valor da Tabela: R$ ...', async () => {
  // precoTabelaOriginal='18.50'; tooltip `Valor da Tabela: R$ 18,50`.
});
it('precoTabelaOriginal nulo mostra Sem preço de tabela para esta data, não R$ 0,00', async () => {
  // precoAjustado=true, precoTabelaOriginal=null; tooltip texto exato; query `R$ 0,00` ausente no tooltip.
});
it('voltar ao valor original remove a borda', async () => {
  // após PATCH com precoAplicado === original, recarregar com precoAjustado=false; border-warning ausente.
});
it('unidade unidade mostra /un, não /kg', async () => {
  // unidadePreco='unidade'; expect(screen.getByText('/un')); query /kg ausente na célula.
});
it('sem PEDIDOS_GERENCIAR o campo fica em leitura', async () => {
  // podeGerenciar=false; Input `disabled={true}` (a prop `disabled` do JSX literal).
});
it('pedido finalizado mantém destaque em leitura', async () => {
  // status=finalizado, precoAjustado=true; Input readOnly + border-warning.
});
it('trocar cliente remapeia precoAplicado de itensNovos a partir de corpo.data', async () => {
  // sem pedido; adicionar item com 18.50; selecionarCliente(outro); mock vigente do novo cliente { data: [{ preco: '22.00' }] };
  // lista rascunho mostra R$ 22,00.
});
it('pedido persistido não remapeia itens congelados ao montar (lock de cliente)', async () => {
  // pedido com cliente disabled (HEAD L517); item.precoAplicado='18.50'; GET vigente NÃO é chamado para o id do item persistido.
});
it('GET /api/precos/vigente com unidadePreco null usa sufixo do produto e não lê corpo.itens', async () => {
  // produto.unidadePreco='unidade'; mock { data: [{ preco: null, unidadePreco: null }] };
  // expect(screen.getByText('/un')); query /kg ausente na célula do novo produto;
  // um mock que só tivesse `itens` não preenche o campo de preço.
});
```

O mock do vigente **sempre** `{ data: [{ produtoId, preco, unidadePreco, tabelaPrecoId }] }`. Zero hex. Nenhuma regra de preço decidida no cliente.

**Commit:** `feat(onda14): coluna Preço unitário no editor de pedido`

---

## Task 7 — Ocorrência: tabelas + hook na finalização (ALP-83)

**Files:** `ocorrencias-ajuste-preco.schema.ts`, `schema/index.ts`, `0043_onda14_ocorrencias_preco.sql`, `pedidos.service.ts`, `eventos.ts`, `app/backend/src/realtime/realtime.gateway.ts`, e2e T07

**Depende de:** T05.

### Schema (arquivo novo)

```ts
import { relations, sql } from 'drizzle-orm';
import { check, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { pedidosVenda, pedidosVendaItens } from './pedidos.schema';
import { clientes } from './clientes.schema';
import { produtos } from './produtos.schema';
import { usuarios } from './auth.schema';

export const ocorrenciasAjustePreco = pgTable(
  'ocorrencias_ajuste_preco',
  {
    id:                     uuid('id').primaryKey().default(sql`uuidv7()`),
    pedidoVendaId:          uuid('pedido_venda_id').notNull().references(() => pedidosVenda.id),
    clienteId:              uuid('cliente_id').notNull().references(() => clientes.id),
    status:                 text('status').notNull().default('aberta'),
    quantidadeItensAjustados: integer('quantidade_itens_ajustados').notNull(),
    diferencaTotal:         numeric('diferenca_total', { precision: 15, scale: 2 }).notNull(),
    usuarioFinalizacaoId:   uuid('usuario_finalizacao_id').notNull().references(() => usuarios.id),
    dataHoraOcorrencia:     timestamp('data_hora_ocorrencia', { withTimezone: true }).notNull().defaultNow(),
    usuarioCienteId:        uuid('usuario_ciente_id').references(() => usuarios.id),
    dataHoraCiente:         timestamp('data_hora_ciente', { withTimezone: true }),
    createdAt:              timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:              timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_ocorr_ajuste_preco_status', sql`${t.status} IN ('aberta','ciente')`),
    uniqueIndex('uq_ocorr_ajuste_preco_pedido').on(t.pedidoVendaId),
    index('idx_ocorr_ajuste_preco_status').on(t.status),
    index('idx_ocorr_ajuste_preco_data').on(t.dataHoraOcorrencia),
  ],
);

export const ocorrenciasAjustePrecoItens = pgTable(
  'ocorrencias_ajuste_preco_itens',
  {
    id:                   uuid('id').primaryKey().default(sql`uuidv7()`),
    ocorrenciaId:         uuid('ocorrencia_id').notNull().references(() => ocorrenciasAjustePreco.id),
    pedidoVendaItemId:    uuid('pedido_venda_item_id').notNull().references(() => pedidosVendaItens.id),
    produtoId:            uuid('produto_id').notNull().references(() => produtos.id),
    precoTabelaOriginal:  numeric('preco_tabela_original', { precision: 15, scale: 2 }),
    precoAplicado:        numeric('preco_aplicado', { precision: 15, scale: 2 }).notNull(),
    diferencaAbsoluta:    numeric('diferenca_absoluta', { precision: 15, scale: 2 }).notNull(),
    diferencaPercentual:  numeric('diferenca_percentual', { precision: 10, scale: 4 }),
    usuarioAjusteId:      uuid('usuario_ajuste_id').references(() => usuarios.id),
    createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
);
```

`schema/index.ts` — após `export * from './tabelas-preco.schema';`:

```
export * from './ocorrencias-ajuste-preco.schema';
```

Generate `--name=onda14_ocorrencias_preco` → `0043_onda14_ocorrencias_preco`. Tabelas novas: sem expand/backfill. `drizzle-kit check` limpo.

### `eventos.ts`

Em `EVENTOS`, após `TABELA_PRECO_PUBLICADA`:

```
  OCORRENCIA_AJUSTE_PRECO_CRIADA: 'ocorrencia_ajuste_preco_criada',
  OCORRENCIA_AJUSTE_PRECO_CIENTE: 'ocorrencia_ajuste_preco_ciente',
```

Em `PayloadPorEvento` (usar o tipo exportado, não um inline divergente):

```
  ocorrencia_ajuste_preco_criada: OcorrenciaAjustePrecoPayload;
  ocorrencia_ajuste_preco_ciente: OcorrenciaAjustePrecoPayload;
```

Exportar o tipo (único — T07 e T08 / gateway importam o mesmo). `old_string` único em `eventos.ts` (após `OcorrenciaFornecedorPayload`):

```
export interface OcorrenciaFornecedorPayload {
  ocorrenciaId: string;
  fornecedorId: string;
  dataOperacao: string;
  status: string;
}
```

`new_string`:

```
export interface OcorrenciaFornecedorPayload {
  ocorrenciaId: string;
  fornecedorId: string;
  dataOperacao: string;
  status: string;
}

export interface OcorrenciaAjustePrecoPayload {
  ocorrenciaId: string;
  pedidoVendaId: string;
  clienteId: string;
  dataOperacao: string;
}
```

`old_string` único em `PayloadPorEvento` (após a linha de tabela de preço):

```
  tabela_preco_publicada: { tabelaPrecoId: string; data: string; autorId: string };
```

`new_string`:

```
  tabela_preco_publicada: { tabelaPrecoId: string; data: string; autorId: string };
  ocorrencia_ajuste_preco_criada: OcorrenciaAjustePrecoPayload;
  ocorrencia_ajuste_preco_ciente: OcorrenciaAjustePrecoPayload;
```

(`dataOperacao` permite rooms; se a operação não estiver à mão, ler de `operacoes` na tx. Sem data inventada.)

### Hook em `finalizar`

Após o `UPDATE` de status (L1051–1054) e **antes** de `auditoria.registrar` do pedido (L1055):

1. Selecionar itens ativos com `sql`${pedidosVendaItens.precoTabelaOriginal} IS DISTINCT FROM ${pedidosVendaItens.precoAplicado}``.
2. Lista vazia → seguir.
3. Senão: insert 1 ocorrência + N itens na **mesma** `tx`.
4. `diferenca_total` = soma `(preco_aplicado - preco_tabela_original)` **só** onde original NOT NULL (pode ser negativa). Itens sem original entram em `quantidade_itens_ajustados` mas **fora** da soma.
5. **Escala fixada (D25 — Worker não escolhe).** `diferenca_percentual` = `null` se original `null`; senão **percentual × 100** com 4 casas. SQL literal no INSERT do item da ocorrência:

```sql
CASE
  WHEN pedidos_venda_itens.preco_tabela_original IS NULL THEN NULL
  ELSE ROUND(
    ((pedidos_venda_itens.preco_aplicado - pedidos_venda_itens.preco_tabela_original)
      / pedidos_venda_itens.preco_tabela_original) * 100
    , 4)
END
```

Equivalente Drizzle (não gravar fração ` / original` sem `* 100`):

```ts
sql`CASE
  WHEN ${pedidosVendaItens.precoTabelaOriginal} IS NULL THEN NULL
  ELSE ROUND(
    ((${pedidosVendaItens.precoAplicado} - ${pedidosVendaItens.precoTabelaOriginal})
      / ${pedidosVendaItens.precoTabelaOriginal}) * 100
    , 4)
END`
```

Exemplo canônico: original `"18.50"`, aplicado `"17.00"` → coluna `NUMERIC(10,4)` = `-8.1081` (JSON `"-8.1081"`). **Proibido** gravar `-0.0811`. Nunca gravar `0` nem `100` por ausência de original.
6. `auditoria.registrar` da ocorrência (`modulo: 'comercial'`, `operacao: 'INSERT'`).
7. Push em `eventos`: `EVENTOS.OCORRENCIA_AJUSTE_PRECO_CRIADA` com `OcorrenciaAjustePrecoPayload` (`dataOperacao` lido de `operacoes.data` na tx). **Não** emitir dentro da tx. Emitir **não** basta: o gateway só entrega com `@OnEvent` explícito (passo abaixo).

Não alterar status do pedido em função da ocorrência. Não abrir tx nova.

### Gateway RA-04 (T07 — só `CRIADA`)

HEAD `e5ffa71` — `realtime.gateway.ts` **não** tem wildcard: cada evento exige `@OnEvent` + `this.broadcast(evento, payload, payload.dataOperacao)`, que itera `roomsDaData`. Sem este handler, `OCORRENCIA_AJUSTE_PRECO_CRIADA` não chega no WS.

`old_string` único no import de tipos (L27–28 do HEAD):

```
  type OcorrenciaFornecedorPayload,
  type PedidoEmRiscoPayload,
```

`new_string`:

```
  type OcorrenciaFornecedorPayload,
  type OcorrenciaAjustePrecoPayload,
  type PedidoEmRiscoPayload,
```

`old_string` único nos handlers (após `handleOcorrenciaAtualizada`, molde idêntico a `handleOcorrenciaAberta` / `handleAprovacaoRegistrada`):

```
  @OnEvent(EVENTOS.OCORRENCIA_FORNECEDOR_ATUALIZADA)
  handleOcorrenciaAtualizada(payload: OcorrenciaFornecedorPayload): void {
    this.broadcast(EVENTOS.OCORRENCIA_FORNECEDOR_ATUALIZADA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.PEDIDO_EM_RISCO)
```

`new_string`:

```
  @OnEvent(EVENTOS.OCORRENCIA_FORNECEDOR_ATUALIZADA)
  handleOcorrenciaAtualizada(payload: OcorrenciaFornecedorPayload): void {
    this.broadcast(EVENTOS.OCORRENCIA_FORNECEDOR_ATUALIZADA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.OCORRENCIA_AJUSTE_PRECO_CRIADA)
  handleOcorrenciaAjustePrecoCriada(payload: OcorrenciaAjustePrecoPayload): void {
    this.broadcast(EVENTOS.OCORRENCIA_AJUSTE_PRECO_CRIADA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.PEDIDO_EM_RISCO)
```

Zero `@OnEvent('**')`. Zero `OnEvent(EVENTOS.OCORRENCIA_AJUSTE_PRECO_CIENTE)` nesta task — isso é T08.

### Testes

14.6 / 14.6b / 14.6c / C5 / C7 / C8 / C9 / evento pós-commit (espiar `eventEmitter.emit` **depois** do commit; no-emit se a tx abortar). C7: item com `preco_tabela_original` NULL → `diferenca_percentual` SQL/JSON `null`. C8: original `"18.50"` aplicado `"17.00"` → `diferenca_total` negativa **e** `diferenca_percentual` `"-8.1081"` (coluna e JSON; `expect(...).not.toBe('-0.0811')`). Gateway: após emit, `handleOcorrenciaAjustePrecoCriada` chama `hub.broadcast` para cada room de `roomsDaData(payload.dataOperacao)` (`dashboard`, `desossa`, `operacao:${dataOperacao}`). Concorrência: duas `finalizar` paralelas — uma 200, outra unique 23505 traduzido para 409, **uma** linha na tabela.

**Commit:** `feat(onda14): ocorrencias_ajuste_preco na finalização do pedido`

---

## Task 8 — Endpoints + RBAC (ALP-84)

**Files:** módulo `ocorrencias-preco/*`, `comercial.module.ts`, `permissoes.ts` + snapshot, 3 rotas BFF, `app/backend/src/realtime/realtime.gateway.ts`, e2e

**Depende de:** T07. **Não** criar `PEDIDO_PRECO_AJUSTAR`. **Não** tocar `AprovacoesService`.

### Permissão

Em `PERMISSOES`, após `PEDIDO_RESERVA_LIBERAR` (L99):

```
  OCORRENCIA_PRECO_CIENTE: 'OCORRENCIA_PRECO_CIENTE',
```

Descrição no mapa (junto das outras, ~L470):

```
  OCORRENCIA_PRECO_CIENTE: 'Marcar como ciente uma ocorrência informativa de ajuste de preço',
```

Após os `pushPermissoes` de APROVACOES (L361–365):

```
pushPermissoes('administrador', 'OCORRENCIA_PRECO_CIENTE');
pushPermissoes('gestor',        'OCORRENCIA_PRECO_CIENTE');
```

```powershell
Set-Location app/backend
npx tsx scripts/regen-rbac-snapshot.ts
```

`rg PEDIDO_PRECO_AJUSTAR app/backend/src app/frontend/src` deve ser **vazio**.

### Endpoints

T08 cria **somente** list / detail / ciente. **Não** criar `@Get('relatorio')`. **Não** criar stub 501. O método de relatório entra na T10, no **mesmo** arquivo, **acima** de `@Get(':id')`.

| Método | Rota Nest | Permissão | Task |
|---|---|---|---|
| GET | `/ocorrencias-preco` | `APROVACOES_LER` | T08 |
| GET | `/ocorrencias-preco/:id` | `APROVACOES_LER` | T08 |
| POST | `/ocorrencias-preco/:id/ciente` | `OCORRENCIA_PRECO_CIENTE` | T08 |
| GET | `/ocorrencias-preco/relatorio` | `APROVACOES_LER` | **T10** — não nesta task |

`ocorrencias-preco.controller.ts` **desta task** (ordem: list, `:id`, `ciente` — `relatorio` ainda não existe):

```ts
import {
  Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { OcorrenciasPrecoService } from './ocorrencias-preco.service';
import {
  listarOcorrenciasPrecoQuerySchema,
  type ListarOcorrenciasPrecoQuery,
} from './dto/ocorrencia-preco.dto';

@SkipThrottle()
@Controller('ocorrencias-preco')
@UseGuards(JwtAuthGuard, RbacGuard)
export class OcorrenciasPrecoController {
  constructor(private readonly service: OcorrenciasPrecoService) {}

  @Get()
  @RequirePermissoes('APROVACOES_LER')
  async listar(@Query(new ZodValidationPipe(listarOcorrenciasPrecoQuerySchema)) query: ListarOcorrenciasPrecoQuery) {
    return this.service.listar(query);
  }

  @Get(':id')
  @RequirePermissoes('APROVACOES_LER')
  async detalhar(@Param('id') id: string) {
    return this.service.detalhar(id);
  }

  @Post(':id/ciente')
  @HttpCode(HttpStatus.OK)
  @RequirePermissoes('OCORRENCIA_PRECO_CIENTE')
  async marcarCiente(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.service.marcarCiente(id, user.sub);
  }
}
```

DTO de list em `dto/ocorrencia-preco.dto.ts`:

```ts
export const listarOcorrenciasPrecoQuerySchema = z.object({
  operacaoId: z.string().uuid(),
  status: z.enum(['aberta', 'ciente']).optional(),
  clienteId: z.string().uuid().optional(),
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListarOcorrenciasPrecoQuery = z.infer<typeof listarOcorrenciasPrecoQuerySchema>;
```

`operacaoId` é **obrigatório** (mesmo contrato de `listarAprovacoesSchema`). Sem `operacaoId` → 400 Zod. A tabela `ocorrencias_ajuste_preco` **não** tem `operacao_id`. `service.listar` filtra assim (não inventar coluna, não filtrar por `operacoes.data`):

```ts
.innerJoin(pedidosVenda, eq(ocorrenciasAjustePreco.pedidoVendaId, pedidosVenda.id))
.where(and(
  eq(pedidosVenda.operacaoId, query.operacaoId),
  query.status ? eq(ocorrenciasAjustePreco.status, query.status) : undefined,
  query.clienteId ? eq(ocorrenciasAjustePreco.clienteId, query.clienteId) : undefined,
  query.dataInicio
    ? sql`${ocorrenciasAjustePreco.dataHoraOcorrencia}::date >= ${query.dataInicio}::date`
    : undefined,
  query.dataFim
    ? sql`${ocorrenciasAjustePreco.dataHoraOcorrencia}::date <= ${query.dataFim}::date`
    : undefined,
))
```

Query list: `operacaoId` (obrigatório), `status` (`aberta`\|`ciente`), `clienteId`, `dataInicio`, `dataFim`, `page`, `pageSize`. Ordem `dataHoraOcorrencia DESC`. Envelope list `{ data, total, page, pageSize }` — `data: OcorrenciaPrecoLista[]`. **Proibido** incluir `itens` na list. `GET /:id` **não** usa envelope `{ data }` (mesmo padrão do detalhe de fornecedor no HEAD: objeto raiz).

`pedidoNumero`: usar `pedidos_venda.id` se não houver número de negócio — **não inventar** sequencial; se o detalhe do pedido já expõe um campo de número no HEAD, reusar; senão `pedidoVendaId` na chave `pedidoNumero` **é proibido**. Conferir `pedidos.service.ts` `listar`: **não há** `numero`. Devolver `pedidoVendaId` **e** `pedidoIdCurto` = 8 primeiros do UUID **somente se** a UI precisar de rótulo. ALP-84 pede `pedidoNumero`. No HEAD não existe. **Usar `pedidos_venda.id` no campo `pedidoNumero`** com o valor do UUID — identidade real, não fabricada. Documentar no Self-Review: lacuna de numeração de pedido (pré-existente), não inventar sequência.

### Contrato campo a campo (T08 — Worker não inventa chave)

Copiar estes tipos para `dto/ocorrencia-preco.dto.ts`. `diferencaPercentual` / `diferencaTotal` são o valor **persistido** (D25); serializar NUMERIC como string, sem `* 100` nem `/ 100` no HTTP.

```ts
export type OcorrenciaPrecoLista = {
  id: string;
  pedidoNumero: string; // UUID de pedidos_venda.id
  clienteNomeFantasia: string | null; // clientes.nome_fantasia (nullable no HEAD)
  status: 'aberta' | 'ciente';
  dataHora: string; // ISO de data_hora_ocorrencia
  usuarioFinalizacaoNome: string | null; // join usuarios em usuario_finalizacao_id
  quantidadeItensAjustados: number;
  diferencaTotal: string; // NUMERIC(15,2), pode ser negativo
};

export type OcorrenciaPrecoItem = {
  produtoCodigo: string;
  produtoNome: string;
  precoTabelaOriginal: string | null;
  precoAplicado: string;
  diferencaAbsoluta: string;
  diferencaPercentual: string | null; // ×100, 4 casas; null se original null; "17.00" vs "18.50" → "-8.1081"
  usuarioAjusteNome: string | null;
};

export type OcorrenciaPrecoDetalhe = OcorrenciaPrecoLista & {
  itens: OcorrenciaPrecoItem[];
  usuarioCienteNome: string | null;
  dataHoraCiente: string | null;
};
```

`service.listar` → `{ data: OcorrenciaPrecoLista[]; total: number; page: number; pageSize: number }` (zero `itens` em cada linha). `service.detalhar` → `OcorrenciaPrecoDetalhe` (objeto raiz). Join de itens: `produtoCodigo` / `produtoNome` via `produtos`; preços **da ocorrência** (não reconsultar tabela). 404 se id inexistente.

`POST .../ciente`: sem corpo. Já `ciente` → 409 `{ code: 'OCORRENCIA_JA_CIENTE' }`. Grava status, `usuario_ciente_id`, `data_hora_ciente`. Auditoria UPDATE. Evento pós-commit `OCORRENCIA_AJUSTE_PRECO_CIENTE` com `OcorrenciaAjustePrecoPayload` (`dataOperacao` de `operacoes.data`). Sem volta. Emitir **não** basta — handler T08 abaixo.

### Gateway RA-04 (T08 — só `CIENTE`)

Após a T07, `handleOcorrenciaAjustePrecoCriada` já existe. Inserir o par `CIENTE` no molde de `handleOcorrenciaAberta` / `handleAprovacaoRegistrada`.

`old_string` único (só existe depois da T07):

```
  @OnEvent(EVENTOS.OCORRENCIA_AJUSTE_PRECO_CRIADA)
  handleOcorrenciaAjustePrecoCriada(payload: OcorrenciaAjustePrecoPayload): void {
    this.broadcast(EVENTOS.OCORRENCIA_AJUSTE_PRECO_CRIADA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.PEDIDO_EM_RISCO)
```

`new_string`:

```
  @OnEvent(EVENTOS.OCORRENCIA_AJUSTE_PRECO_CRIADA)
  handleOcorrenciaAjustePrecoCriada(payload: OcorrenciaAjustePrecoPayload): void {
    this.broadcast(EVENTOS.OCORRENCIA_AJUSTE_PRECO_CRIADA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.OCORRENCIA_AJUSTE_PRECO_CIENTE)
  handleOcorrenciaAjustePrecoCiente(payload: OcorrenciaAjustePrecoPayload): void {
    this.broadcast(EVENTOS.OCORRENCIA_AJUSTE_PRECO_CIENTE, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.PEDIDO_EM_RISCO)
```

Import de `OcorrenciaAjustePrecoPayload` já entrou na T07. Zero wildcard.

Inexistente → 404.

`ComercialModule` importa `OcorrenciasPrecoModule`.

BFF: três rotas com `repassar` de `@/lib/bff` (GET list, GET id, POST ciente). List **encaminha a query** (padrão HEAD `app/frontend/src/app/api/gestao/aprovacoes/route.ts`):

```ts
import { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

export async function GET(req: NextRequest) {
  return repassar(`/ocorrencias-preco${req.nextUrl.search}`);
}
```

### Testes

403 list sem `APROVACOES_LER`; 403 ciente sem `OCORRENCIA_PRECO_CIENTE` (diretoria tem LER, não CIENTE); 400 list sem `operacaoId`; list `operacaoId=A` **não** devolve ocorrência cujo `pedidos_venda.operacao_id=B`; filtros opcionais (`status`, `clienteId`, `dataInicio`, `dataFim`); list **não** contém chave `itens`; `GET /ocorrencias-preco/:id` devolve `OcorrenciaPrecoDetalhe` (as 8 chaves da list + `itens` + `usuarioCienteNome` + `dataHoraCiente`); C7 percentual `null` no detalhe quando original é null; C8 detalhe `diferencaPercentual === "-8.1081"` para `17.00` vs `18.50`; 409 segunda ciência; 404; evento pós-commit `OCORRENCIA_AJUSTE_PRECO_CIENTE` + handler `handleOcorrenciaAjustePrecoCiente` entrega via `roomsDaData(payload.dataOperacao)`; snapshot sem `PEDIDO_PRECO_AJUSTAR` e sem `ITENS_*`.

**Commit:** `feat(onda14): endpoints de ocorrência de preço e OCORRENCIA_PRECO_CIENTE`

---

## Task 9 — Fila Administrativa UI (ALP-59)

**Files:** `aprovacoes-client.tsx`, `lib/aprovacoes.ts`, `onda14-aprovacoes-preco.test.tsx`

**Depende de:** T08.

### Estado real

A tela é master-detail (L167–188) **sem** WebSocket. T09 **adiciona** `conectarRealtime` no padrão de `tabela-precos-client.tsx` (`import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime'`). Sem accordion. Aba `operacionais` **intocada**.

### Steps

- [ ] Tipos em `lib/aprovacoes.ts` (mesmo contrato T08, campo a campo). `old_string` único após `OcorrenciaLista`:

```
export interface OcorrenciaLista {
  id: string;
  fornecedorNome: string;
  nfChave: string | null;
  pedidoLote: string | null;
  produtosDivergentes: number;
  difQtdTotal: string | null;
  difPesoTotal: string | null;
  responsavelNome: string | null;
  status: string;
  dataAbertura: string;
}
```

`new_string` (não alterar as 11 chaves de `OcorrenciaLista`):

```
export interface OcorrenciaLista {
  id: string;
  fornecedorNome: string;
  nfChave: string | null;
  pedidoLote: string | null;
  produtosDivergentes: number;
  difQtdTotal: string | null;
  difPesoTotal: string | null;
  responsavelNome: string | null;
  status: string;
  dataAbertura: string;
}

export type OcorrenciaPrecoLista = {
  id: string;
  pedidoNumero: string;
  clienteNomeFantasia: string | null;
  status: 'aberta' | 'ciente';
  dataHora: string;
  usuarioFinalizacaoNome: string | null;
  quantidadeItensAjustados: number;
  diferencaTotal: string;
};

export type OcorrenciaPrecoItem = {
  produtoCodigo: string;
  produtoNome: string;
  precoTabelaOriginal: string | null;
  precoAplicado: string;
  diferencaAbsoluta: string;
  diferencaPercentual: string | null; // persistido T07 ×100; null se original null
  usuarioAjusteNome: string | null;
};

export type OcorrenciaPrecoDetalhe = OcorrenciaPrecoLista & {
  itens: OcorrenciaPrecoItem[];
  usuarioCienteNome: string | null;
  dataHoraCiente: string | null;
};
```

Importar `OcorrenciaPrecoLista` e `OcorrenciaPrecoDetalhe` em `aprovacoes-client.tsx`. Estado extra: `const [detalhePreco, setDetalhePreco] = useState<OcorrenciaPrecoDetalhe | null>(null);`. List alimenta cards (`bruto: OcorrenciaPrecoLista`); a tabela do painel lê **somente** `detalhePreco.itens`.

Import no topo (após `mensagemDeErro`):

```
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
```

Estado da lista — `old_string` único (HEAD L53–55):

```
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaLista[]>([]);
  const [operacionais, setOperacionais] = useState<AprovacaoOperacional[]>([]);
  const [ocorrenciaSel, setOcorrenciaSel] = useState<OcorrenciaLista | null>(null);
```

`new_string`:

```
  const [ocorrencias, setOcorrencias] = useState<ItemFila[]>([]);
  const [operacionais, setOperacionais] = useState<AprovacaoOperacional[]>([]);
  const [ocorrenciaSel, setOcorrenciaSel] = useState<ItemFila | null>(null);
```

(`ItemFila` é o tipo discriminado abaixo; colocar o `type ItemFila` **antes** deste `useState`.)

- [ ] Tipo discriminado:

```ts
type ItemFila =
  | { tipo: 'fornecedor'; id: string; titulo: string; status: string; dataHora: string; bruto: OcorrenciaLista }
  | { tipo: 'preco'; id: string; titulo: string; status: string; dataHora: string; bruto: OcorrenciaPrecoLista };
```

- [ ] `carregar` (HEAD L65–80): **não** remover `if (!operacaoId) return`. `operacaoId` é o mesmo `searchParams.get('operacaoId')` de L49. Se `aba === 'ocorrencias'`, duas chamadas em paralelo; a de preço é **este fetch literal** (mesmo `operacaoId` já passado a `listarAprovacoes`). Unir, ordenar por `dataHora` desc.

`old_string` (único em `carregar`):

```
      if (aba === 'ocorrencias') {
        const res = await listarAprovacoes<OcorrenciaLista>({ operacaoId, aba: 'ocorrencias' });
        setOcorrencias(res.data);
        if (!ocorrenciaSel && res.data[0]) setOcorrenciaSel(res.data[0]);
```

`new_string`:

```
      if (aba === 'ocorrencias') {
        const qsPreco = new URLSearchParams({ operacaoId });
        const [resFornecedor, resPrecoHttp] = await Promise.all([
          listarAprovacoes<OcorrenciaLista>({ operacaoId, aba: 'ocorrencias' }),
          fetch(`/api/ocorrencias-preco?${qsPreco}`),
        ]);
        if (!resPrecoHttp.ok) throw new Error(await mensagemDeErro(resPrecoHttp));
        const resPreco = await resPrecoHttp.json() as { data: OcorrenciaPrecoLista[] };
        const fila: ItemFila[] = [
          ...resFornecedor.data.map((o): ItemFila => ({
            tipo: 'fornecedor',
            id: o.id,
            titulo: o.fornecedorNome,
            status: o.status,
            dataHora: o.dataAbertura,
            bruto: o,
          })),
          ...resPreco.data.map((o): ItemFila => ({
            tipo: 'preco',
            id: o.id,
            titulo: o.clienteNomeFantasia ?? '—',
            status: o.status,
            dataHora: o.dataHora,
            bruto: o,
          })),
        ];
        fila.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
        setOcorrencias(fila);
        if (!ocorrenciaSel && fila[0]) setOcorrenciaSel(fila[0]);
```

Zero `GET /api/ocorrencias-preco` sem query. Zero filtro inventado no cliente (não recortar por data da operação no frontend). A operação vem só do query param, igual a `listarAprovacoes` (`URLSearchParams` + `operacaoId`).

- [ ] Fetch de detalhe — HEAD `carregarDetalheOcorrencia` L86–90 só chama fornecedor. T09 ramifica; Jest exige `GET /api/ocorrencias-preco/:id` (não montar a tabela a partir da list).

`old_string` único (HEAD L86–94):

```
  const carregarDetalheOcorrencia = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/operacao/ocorrencias-fornecedor/${id}`);
      if (!res.ok) throw new Error(await mensagemDeErro(res));
      setDetalheOcorrencia(await res.json() as DetalheOcorrencia);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar detalhe da ocorrência');
    }
  }, []);
```

`new_string`:

```
  const carregarDetalheOcorrencia = useCallback(async (item: ItemFila) => {
    try {
      if (item.tipo === 'preco') {
        const res = await fetch(`/api/ocorrencias-preco/${item.id}`);
        if (!res.ok) throw new Error(await mensagemDeErro(res));
        setDetalhePreco(await res.json() as OcorrenciaPrecoDetalhe);
        setDetalheOcorrencia(null);
        return;
      }
      const res = await fetch(`/api/operacao/ocorrencias-fornecedor/${item.id}`);
      if (!res.ok) throw new Error(await mensagemDeErro(res));
      setDetalheOcorrencia(await res.json() as DetalheOcorrencia);
      setDetalhePreco(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar detalhe da ocorrência');
    }
  }, []);
```

`old_string` único do `useEffect` de seleção (HEAD L96–113) — **não** chamar `buscarComparativo` em ocorrência de preço:

```
  useEffect(() => {
    if (!ocorrenciaSel) {
      setComparativo(null);
      setSemComparativo(false);
      setDetalheOcorrencia(null);
      return;
    }
    void buscarComparativo(ocorrenciaSel.id).then((c) => {
      if (!c) {
        setSemComparativo(true);
        setComparativo(null);
      } else {
        setSemComparativo(false);
        setComparativo(c as { itens: Parameters<typeof QuadroComparativo>[0]['itens'] });
      }
    });
    void carregarDetalheOcorrencia(ocorrenciaSel.id);
  }, [ocorrenciaSel, carregarDetalheOcorrencia]);
```

`new_string`:

```
  useEffect(() => {
    if (!ocorrenciaSel) {
      setComparativo(null);
      setSemComparativo(false);
      setDetalheOcorrencia(null);
      setDetalhePreco(null);
      return;
    }
    if (ocorrenciaSel.tipo === 'preco') {
      setComparativo(null);
      setSemComparativo(false);
      setDetalheOcorrencia(null);
      void carregarDetalheOcorrencia(ocorrenciaSel);
      return;
    }
    void buscarComparativo(ocorrenciaSel.id).then((c) => {
      if (!c) {
        setSemComparativo(true);
        setComparativo(null);
      } else {
        setSemComparativo(false);
        setComparativo(c as { itens: Parameters<typeof QuadroComparativo>[0]['itens'] });
      }
    });
    void carregarDetalheOcorrencia(ocorrenciaSel);
  }, [ocorrenciaSel, carregarDetalheOcorrencia]);
```

Atualizar as duas chamadas `carregarDetalheOcorrencia(ocorrenciaSel.id)` em `enviarAndamento` / `concluir` (HEAD L121 e L133) para `carregarDetalheOcorrencia(ocorrenciaSel)` — só disparam no ramo fornecedor.

`ROTULO_STATUS_OCORRENCIA` `old_string` único:

```
export const ROTULO_STATUS_OCORRENCIA: Record<string, string> = {
  aberta: 'Aberta',
  em_analise: 'Em tratativa',
  aguardando_fornecedor: 'Aguardando fornecedor',
  resolvida: 'Concluída',
};
```

`new_string` (não remover `resolvida`):

```
export const ROTULO_STATUS_OCORRENCIA: Record<string, string> = {
  aberta: 'Aberta',
  em_analise: 'Em tratativa',
  aguardando_fornecedor: 'Aguardando fornecedor',
  resolvida: 'Concluída',
  ciente: 'Ciente',
};
```

- [ ] Card esquerdo — `old_string` único (HEAD L171–186):

```
                {ocorrencias.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setOcorrenciaSel(o)}
                    className={cn(
                      'block w-full border-b border-border px-3 py-2 text-left transition-colors duration-100 hover:bg-surface-2',
                      ocorrenciaSel?.id === o.id && 'bg-primary-soft shadow-[inset_2px_0_0_var(--color-primary)]',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <b className="min-w-0 flex-1 truncate text-[13px] font-semibold">{o.fornecedorNome}</b>
                      <StatusPill variant="pendente" label={ROTULO_STATUS_OCORRENCIA[o.status] ?? o.status} className="h-[17px] text-[10px]" />
                    </span>
                  </button>
                ))}
```

`new_string`:

```
                {ocorrencias.map((item) => (
                  <button
                    key={`${item.tipo}-${item.id}`}
                    type="button"
                    onClick={() => setOcorrenciaSel(item)}
                    className={cn(
                      'block w-full border-b border-border px-3 py-2 text-left transition-colors duration-100 hover:bg-surface-2',
                      ocorrenciaSel?.id === item.id && ocorrenciaSel.tipo === item.tipo && 'bg-primary-soft shadow-[inset_2px_0_0_var(--color-primary)]',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="shrink-0 text-[10px] font-semibold uppercase text-muted-foreground">
                        {item.tipo === 'preco' ? 'Preço' : 'Fornecedor'}
                      </span>
                      <b className="min-w-0 flex-1 truncate text-[13px] font-semibold">{item.titulo}</b>
                      <StatusPill variant="pendente" label={ROTULO_STATUS_OCORRENCIA[item.status] ?? item.status} className="h-[17px] text-[10px]" />
                    </span>
                  </button>
                ))}
```

HEAD usa `variant="pendente"` em todos os status da fila (inclusive `resolvida`). `ciente` permanece `variant="pendente"` + rótulo `Ciente`. Título preço = `item.titulo` (= `clienteNomeFantasia ?? '—'`).

- [ ] Painel direito — `old_string` único (HEAD L191–192):

```
              {ocorrenciaSel && (
                <>
```

`new_string`:

```
              {ocorrenciaSel?.tipo === 'preco' ? (
                <Card>
                  <CardContent className="space-y-3">
                    <p className="text-[13px]"><strong>Pedido:</strong> {ocorrenciaSel.bruto.pedidoNumero}</p>
                    <p className="text-[13px]"><strong>Cliente:</strong> {ocorrenciaSel.bruto.clienteNomeFantasia ?? '—'}</p>
                    <p className="text-[13px]"><strong>Data/hora:</strong> {formatDataHora(ocorrenciaSel.bruto.dataHora)}</p>
                    <p className="text-[13px]"><strong>Finalizado por:</strong> {ocorrenciaSel.bruto.usuarioFinalizacaoNome ?? '—'}</p>
                    <p className="text-[13px]"><strong>Itens ajustados:</strong> {ocorrenciaSel.bruto.quantidadeItensAjustados}</p>
                    <p className={cn(
                      'text-[13px] font-data',
                      ocorrenciaSel.bruto.diferencaTotal.startsWith('-') ? 'text-destructive' : 'text-success-fg',
                    )}>
                      <strong>Diferença total:</strong> {ocorrenciaSel.bruto.diferencaTotal}
                    </p>
                    {detalhePreco?.itens.some((linha) => linha.precoTabelaOriginal == null) && (
                      <p className="text-xs text-muted-foreground">Sem preço de tabela para a data</p>
                    )}
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="py-1">Produto</th>
                          <th className="py-1 text-right">Preço da tabela</th>
                          <th className="py-1 text-right">Preço aplicado</th>
                          <th className="py-1 text-right">Diferença</th>
                          <th className="py-1 text-right">Diferença %</th>
                          <th className="py-1">Ajustado por</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detalhePreco?.itens ?? []).map((linha, indice) => (
                          <tr key={`${linha.produtoCodigo}-${indice}`} className="border-b border-border">
                            <td className="py-1">{linha.produtoCodigo} {linha.produtoNome}</td>
                            <td className="py-1 text-right font-data">{linha.precoTabelaOriginal ?? '—'}</td>
                            <td className="py-1 text-right font-data">{linha.precoAplicado}</td>
                            <td className={cn(
                              'py-1 text-right font-data',
                              linha.diferencaAbsoluta.startsWith('-') ? 'text-destructive' : 'text-success-fg',
                            )}>{linha.diferencaAbsoluta}</td>
                            <td className="py-1 text-right font-data">{linha.diferencaPercentual ?? '—'}</td>
                            <td className="py-1">{linha.usuarioAjusteNome ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {detalhePreco?.status === 'ciente' ? (
                      <div className="flex items-start gap-2 rounded-lg border border-success-soft-border bg-success-soft p-3">
                        <div>
                          <p className="text-[13px] font-bold text-success-fg">Resultado</p>
                          <p className="mt-0.5 text-[13px] text-success-fg">
                            Ciente registrado por {detalhePreco.usuarioCienteNome ?? '—'} em {detalhePreco.dataHoraCiente ? formatDataHora(detalhePreco.dataHoraCiente) : '—'}
                          </p>
                        </div>
                      </div>
                    ) : permissoes.includes('OCORRENCIA_PRECO_CIENTE') && ocorrenciaSel.status === 'aberta' ? (
                      <Button size="sm" onClick={() => void marcarCiente()}>Marcar como ciente</Button>
                    ) : null}
                  </CardContent>
                </Card>
              ) : ocorrenciaSel && (
                <>
```

Zero montar linhas a partir da list. Tabela lê **somente** `detalhePreco?.itens`. Original null → `—` (não `R$ 0,00`).

O wrap acima **não** altera HEAD L195–197. Depois dele, `ocorrenciaSel` já é `ItemFila`; o ramo `else` (`tipo !== 'preco'`) ainda teria `ocorrenciaSel.fornecedorNome` / `nfChave` / `pedidoLote`, que **não existem** em `ItemFila` (só em `bruto` quando `tipo === 'fornecedor'`). Aplicar **depois** do wrap:

- [ ] Painel fornecedor — `old_string` único (HEAD L195–197; permanece único após o wrap):

```
                      <p className="text-[13px]"><strong>Fornecedor:</strong> {ocorrenciaSel.fornecedorNome}</p>
                      <p className="text-[13px]"><strong>NF:</strong> {ocorrenciaSel.nfChave ?? '—'}</p>
                      <p className="text-[13px]"><strong>Pedido/lote:</strong> {ocorrenciaSel.pedidoLote ?? '—'}</p>
```

`new_string`:

```
                      <p className="text-[13px]"><strong>Fornecedor:</strong> {ocorrenciaSel.bruto.fornecedorNome}</p>
                      <p className="text-[13px]"><strong>NF:</strong> {ocorrenciaSel.bruto.nfChave ?? '—'}</p>
                      <p className="text-[13px]"><strong>Pedido/lote:</strong> {ocorrenciaSel.bruto.pedidoLote ?? '—'}</p>
```

No ramo `else` o ternário `ocorrenciaSel?.tipo === 'preco' ? … : ocorrenciaSel && (…)` estreita `ocorrenciaSel` para `{ tipo: 'fornecedor'; bruto: OcorrenciaLista }`. **Proibido** ler `ocorrenciaSel.fornecedorNome` (top-level). **Proibido** ler `bruto.fornecedorNome` no ramo preço. Labels `Fornecedor` / `NF` / `Pedido/lote` intactos.

### Inventário HEAD `014699c` — aba `ocorrencias` (`aprovacoes-client.tsx` lido inteiro)

Aba `TabsContent value="ocorrencias"` = L167–262. Aba `operacionais` (L264–288, `a.*` / `ROTULO_STATUS_APROVACAO`) **intocada**.

**`o.*` no `ocorrencias.map` (HEAD L171–186)** — já cobertos pelo patch do card (4ª rodada). Após o patch a variável é `item: ItemFila`:

| HEAD | Acesso | Em `ItemFila`? | Patch |
|---|---|---|---|
| L173 | `o.id` (key) | sim (`id`) | `` `${item.tipo}-${item.id}` `` |
| L175 | `setOcorrenciaSel(o)` | o objeto vira `ItemFila` | `item` |
| L178 | `ocorrenciaSel?.id === o.id` | sim (`id`) | + `ocorrenciaSel.tipo === item.tipo` |
| L182 | `o.fornecedorNome` (título) | **não** (só `titulo` / `bruto`) | `{item.titulo}` |
| L183 | `StatusPill` `label={ROTULO_STATUS_OCORRENCIA[o.status] ?? o.status}` `variant="pendente"` | sim (`status`) | `item.status`; variant permanece `"pendente"`; `ciente` → rótulo `Ciente` via `ROTULO` (já acrescentado) |

**`ocorrenciaSel.*` na aba + handlers da aba (HEAD):**

| HEAD | Acesso | Em `ItemFila`? | Patch |
|---|---|---|---|
| L55 | `useState<OcorrenciaLista \| null>` | — | `ItemFila \| null` |
| L72 | `ocorrenciaSel` + `res.data[0]` | `res.data[0]` era `OcorrenciaLista` | `fila[0]` (`carregar`) |
| L97, L116, L128 | `ocorrenciaSel` (truthy) | — | intacto |
| L103, L118, L130 | `ocorrenciaSel.id` | sim | intacto |
| L112, L121, L133 | `carregarDetalheOcorrencia(ocorrenciaSel.id)` | — | passa `ocorrenciaSel` |
| L178 | `ocorrenciaSel?.id` | sim | + `tipo` (card) |
| L191 | `{ocorrenciaSel && (` | — | ternário `tipo === 'preco'` (4ª) |
| L195 | `ocorrenciaSel.fornecedorNome` | **não** | **5ª: `ocorrenciaSel.bruto.fornecedorNome`** |
| L196 | `ocorrenciaSel.nfChave` | **não** | **5ª: `ocorrenciaSel.bruto.nfChave`** |
| L197 | `ocorrenciaSel.pedidoLote` | **não** | **5ª: `ocorrenciaSel.bruto.pedidoLote`** |

**Acessos introduzidos pela T09 (não quebram — campos de `ItemFila` ou `bruto` já discriminado):** `ocorrenciaSel.tipo`; `ocorrenciaSel.status` (botão ciente); `ocorrenciaSel.id` (`marcarCiente`); ramo preço `ocorrenciaSel.bruto.{pedidoNumero,clienteNomeFantasia,dataHora,usuarioFinalizacaoNome,quantidadeItensAjustados,diferencaTotal}`.

**`o.*` em `carregar` (após 4ª):** o callback `resFornecedor.data.map((o) => …)` é `OcorrenciaLista` (`o.fornecedorNome`, `o.status`, `o.dataAbertura`, `o.id`); `resPreco.data.map((o) => …)` é `OcorrenciaPrecoLista` (`o.clienteNomeFantasia`, `o.status`, `o.dataHora`, `o.id`). Não são `ItemFila`. Intactos.

**StatusPill / labels:** o único `StatusPill` da aba ocorrências é o da lista (HEAD L183) — já `item.status`. Não há `StatusPill` no painel direito (nem fornecedor nem preço). Labels do painel fornecedor permanecem `Fornecedor` / `NF` / `Pedido/lote`; valores = `bruto`. Badge de tipo (`Preço` / `Fornecedor`) já no card.

**Zero acesso órfão** após este patch: nenhum `ocorrenciaSel.fornecedorNome` / `.nfChave` / `.pedidoLote` / `o.fornecedorNome` restante no TSX pós-T09.

`marcarCiente` (após `concluir`):

```ts
  const marcarCiente = async () => {
    if (!ocorrenciaSel || ocorrenciaSel.tipo !== 'preco') return;
    try {
      const res = await fetch(`/api/ocorrencias-preco/${ocorrenciaSel.id}/ciente`, { method: 'POST' });
      if (!res.ok) throw new Error(await mensagemDeErro(res));
      await carregar();
      await carregarDetalheOcorrencia(ocorrenciaSel);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao marcar como ciente');
    }
  };
```

- [ ] WS — após o `useEffect` que chama `carregar` (HEAD L82–84). `old_string` único:

```
  useEffect(() => {
    void carregar();
  }, [carregar]);
```

`new_string` (padrão `tabela-precos-client.tsx` L146–155; rooms **fixas** — o gateway já manda `dashboard` via `roomsDaData`):

```
  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    const onMessage = (msg: RealtimeMensagem) => {
      if (
        msg.type === 'ocorrencia_ajuste_preco_criada'
        || msg.type === 'ocorrencia_ajuste_preco_ciente'
      ) {
        void carregar();
      }
    };
    return conectarRealtime({
      rooms: ['dashboard'],
      onMessage,
      onReconnect: () => void carregar(),
    });
  }, [carregar]);
```

Sem `operacao:${...}`. Sem polling. Sem `setInterval`. Cleanup = retorno de `conectarRealtime`.

- [ ] Jest: os 10 `it('...')` abaixo. Zero accordion (`rg accordion` no arquivo = vazio, como hoje).

```ts
it('fila mistura fornecedor e preço ordenada por data desc', async () => {
  // mock listarAprovacoes({ operacaoId, aba: 'ocorrencias' }) e GET `/api/ocorrencias-preco?${new URLSearchParams({ operacaoId })}` (mesmo uuid da URL); cards na ordem dataHora desc misturando tipos.
});
it('badge distingue Fornecedor de Preço', async () => {
  // expect texto Fornecedor e Preço nos badges; título preço = clienteNomeFantasia.
});
it('selecionar ocorrência de preço mostra o painel específico', async () => {
  // click no card preço; painel tem Pedido/Cliente/Data/hora — sem bloco de fornecedor.
});
it('painel lista todos os itens ajustados', async () => {
  // selecionar card preço dispara GET `/api/ocorrencias-preco/${id}` (não só a list);
  // N linhas na tabela = N itens do JSON de detalhe (OcorrenciaPrecoDetalhe.itens). Mock da list sem `itens`.
});
it('item sem preço de tabela mostra —, não R$ 0,00', async () => {
  // precoTabelaOriginal null → em-dash e legenda Sem preço de tabela para a data; query R$ 0,00 ausente.
});
it('desconto e acréscimo diferenciados por sinal', async () => {
  // diferenca negativa com text-destructive; positiva com text-success-fg.
});
it('Marcar como ciente some sem OCORRENCIA_PRECO_CIENTE', async () => {
  // permissoes sem a chave; getByRole button name /Marcar como ciente/ não existe.
});
it('após ciente o painel mostra autor e timestamp', async () => {
  // POST 200; texto Ciente registrado por ... em ...
});
it('ocorrência já ciente não mostra o botão', async () => {
  // status ciente + permissão presente; botão ausente.
});
it('evento WebSocket atualiza a fila sem polling', async () => {
  // conectarRealtime chamado; onMessage com OCORRENCIA_AJUSTE_PRECO_CRIADA dispara GET de novo; zero setInterval.
});
```

Cada título é o critério de aceite. Corpos: seguir os passos já desta task (agregar duas fontes; badge; painel; `GET /api/ocorrencias-preco/:id` para `itens`; `—`; sinal; RBAC do botão; bloco "Ciente registrado por"; botão ausente se `ciente`; `onMessage` chama `carregar()`). **Não** reduzir a 10 casos a um único `it`.

**Commit:** `feat(onda14): ocorrências de preço na Fila Administrativa`

---

## Task 10 — Relatório endpoint (ALP-85)

**Files:** mesmo módulo T08; `GET relatorio` **acima** de `:id`; BFF `ocorrencias-preco/relatorio/route.ts`; e2e

**Depende de:** T08 (módulo existe). Permissão `APROVACOES_LER`. **Não** usar `PEDIDO_PRECO_AJUSTAR` (não existe). **Não** criar stub 501 — inserir o método real.

### Steps

- [ ] No controller da T08, inserir `@Get('relatorio')` **acima** de `@Get(':id')` (Nest casa na ordem de declaração; se `relatorio` ficar depois de `:id`, vira 404/UUID inválido).

`old_string` (único no arquivo após T08):

```
  @Get(':id')
  @RequirePermissoes('APROVACOES_LER')
  async detalhar(@Param('id') id: string) {
    return this.service.detalhar(id);
  }
```

`new_string`:

```
  @Get('relatorio')
  @RequirePermissoes('APROVACOES_LER')
  async relatorio(
    @Query(new ZodValidationPipe(relatorioQuerySchema)) query: RelatorioQuery,
  ) {
    return this.service.relatorio(query);
  }

  @Get(':id')
  @RequirePermissoes('APROVACOES_LER')
  async detalhar(@Param('id') id: string) {
    return this.service.detalhar(id);
  }
```

Zero `HttpStatus.NOT_IMPLEMENTED`. Zero `501`. Acrescentar no topo do controller:

```
import {
  listarOcorrenciasPrecoQuerySchema,
  relatorioQuerySchema,
  type ListarOcorrenciasPrecoQuery,
  type RelatorioQuery,
} from './dto/ocorrencia-preco.dto';
```

(substituir o import só de listar que a T08 gravou).

- [ ] DTO query (mesmo arquivo de DTO da T08):

```ts
export const relatorioQuerySchema = z.object({
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  clienteId: z.string().uuid().optional(),
  representanteId: z.string().uuid().optional(),
  produtoId: z.string().uuid().optional(),
  faixaPreco: z.enum(['A', 'B', 'C', 'D']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type RelatorioQuery = z.infer<typeof relatorioQuerySchema>;
```

Sem `dataInicio`/`dataFim` → 400 (Zod). Fonte = `ocorrencias_ajuste_preco` + itens. **Zero** `from(tabelasPrecoItens)`. **Não** acrescentar coluna `faixa_preco` em `ocorrencias_ajuste_preco` (T07 intacta).

### `faixaPreco` no relatório (AD-16 — congelada no item)

A tabela `ocorrencias_ajuste_preco` **não** tem `faixa_preco`. AD-16 congela a faixa em `pedidos_venda_itens.faixa_preco` na inclusão (T05). JSON `faixaPreco` **é** esse valor congelado.

Origem obrigatória: join pelo `pedido_venda_id` da ocorrência → `pedidos_venda_itens`. **Proibido** `clientes.faixa_preco` / `clientes.faixaPreco` (faixa atual do cadastro). `rg "clientes\\.faixaPreco|clientes\\.faixa_preco" app/backend/src/modules/comercial/ocorrencias-preco` = vazio.

Predicado canônico único (SELECT **e** filtro `query.faixaPreco` — o Worker não inventa outro):

```sql
(
  SELECT pvi.faixa_preco
  FROM pedidos_venda_itens pvi
  WHERE pvi.pedido_venda_id = ocorrencias_ajuste_preco.pedido_venda_id
    AND pvi.deleted_at IS NULL
  ORDER BY pvi.created_at ASC, pvi.id ASC
  LIMIT 1
)
```

Drizzle no `OcorrenciasPrecoService.relatorio` (constante única; `sql` já usado na T08 do mesmo arquivo):

```ts
const faixaCongeladaSql = sql`(
  SELECT pvi.faixa_preco
  FROM pedidos_venda_itens pvi
  WHERE pvi.pedido_venda_id = ${ocorrenciasAjustePreco.pedidoVendaId}
    AND pvi.deleted_at IS NULL
  ORDER BY pvi.created_at ASC, pvi.id ASC
  LIMIT 1
)`;
```

SELECT da página (além dos demais campos do envelope):

```ts
faixaPreco: sql<'A' | 'B' | 'C' | 'D'>`${faixaCongeladaSql}`.as('faixa_preco'),
```

Filtros AND. Quando `query.faixaPreco` vier, o **mesmo** `faixaCongeladaSql`:

```ts
query.faixaPreco ? sql`${faixaCongeladaSql} = ${query.faixaPreco}` : undefined,
```

`produtoId` restringe **pedidos** que têm aquele produto ajustado; a segunda query `IN (pedidoIds da página)` traz **todos** os itens ajustados desses pedidos.

Paginar por pedido (`count` + `limit/offset` na ocorrência). `valorTotalAjustado` = `diferenca_total` da ocorrência (já persistido).

`representanteNome`: `clientes.representante_id` → `representantes.nome` **atual**. Sem representante → `null` (UI `—`). Self-Review: lacuna histórica. **Não** aplicar a mesma lacuna à faixa: faixa é histórica (item), representante é atual (D10).

### Shape JSON (ALP-85, literal — este é o contrato)

O handler devolve **exatamente** este envelope. `pedidoNumero` = UUID de `pedidos_venda.id` (T08: não há sequencial no HEAD). `precoTabelaOriginal` e `diferencaPercentual` aceitam JSON `null`. `valorTotalAjustado` / diferenças são strings NUMERIC. `diferencaPercentual` é o valor **persistido na T07** (D25, ×100, 4 casas): original `"18.50"` + aplicado `"17.00"` → `"-8.1081"`. **Proibido** o relatório multiplicar ou dividir de novo.

```json
{
  "data": [{
    "pedidoVendaId": "...",
    "pedidoNumero": "...",
    "clienteNomeFantasia": "...",
    "representanteNome": "...",
    "dataPedido": "2026-09-01",
    "faixaPreco": "B",
    "quantidadeItensAjustados": 3,
    "valorTotalAjustado": "-42.50",
    "itens": [{
      "produtoCodigo": "...",
      "produtoNome": "...",
      "precoTabelaOriginal": "18.50",
      "precoAplicado": "17.00",
      "diferencaAbsoluta": "-1.50",
      "diferencaPercentual": "-8.1081",
      "usuarioAjusteNome": "..."
    }]
  }],
  "total": 12,
  "page": 1,
  "pageSize": 20
}
```

Campo a campo (TypeScript = o retorno de `service.relatorio`):

```ts
export type RelatorioAjustePrecoItem = {
  produtoCodigo: string;
  produtoNome: string;
  precoTabelaOriginal: string | null;
  precoAplicado: string;
  diferencaAbsoluta: string;
  diferencaPercentual: string | null; // persistido T07 ×100; null se original null; "17.00" vs "18.50" → "-8.1081"
  usuarioAjusteNome: string | null;
};

export type RelatorioAjustePrecoPedido = {
  pedidoVendaId: string;
  pedidoNumero: string; // UUID de pedidos_venda.id
  clienteNomeFantasia: string | null;
  representanteNome: string | null;
  dataPedido: string; // YYYY-MM-DD (operacoes.data do pedido)
  faixaPreco: 'A' | 'B' | 'C' | 'D'; // subquery pedidos_venda_itens.faixa_preco; NUNCA clientes.faixa_preco
  quantidadeItensAjustados: number;
  valorTotalAjustado: string; // NUMERIC(15,2), pode ser negativo
  itens: RelatorioAjustePrecoItem[];
};

export type RelatorioAjustePrecoEnvelope = {
  data: RelatorioAjustePrecoPedido[];
  total: number;
  page: number;
  pageSize: number;
};
```

Nulos JSON: `precoTabelaOriginal`, `diferencaPercentual` (quando original é null), `representanteNome`, `clienteNomeFantasia`, `usuarioAjusteNome`. Não omitir a chave.

Teste de republicação: alterar `tabelas_preco_itens` após a ocorrência → relatório idêntico. 403 sem `APROVACOES_LER`. C7 (`diferencaPercentual` JSON `null` se original null). C8 (`"-8.1081"` no item; `valorTotalAjustado` negativo). C10.

Faixa congelada (obrigatório, mesmo e2e T10): item com `faixa_preco='A'`; `UPDATE clientes SET faixa_preco='C'` depois da ocorrência → JSON `faixaPreco === 'A'`; `GET .../relatorio?faixaPreco=C` **não** devolve esse pedido; `GET ...?faixaPreco=A` devolve. Zero assert sobre `clientes.faixa_preco` no JSON.

BFF GET `app/frontend/src/app/api/ocorrencias-preco/relatorio/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  return repassar(`/ocorrencias-preco/relatorio${qs ? `?${qs}` : ''}`);
}
```

**Commit:** `feat(onda14): GET /ocorrencias-preco/relatorio`

---

## Task 11 — Aba Relatórios Gerenciais (ALP-86)

**Files:** `relatorios-client.tsx`, `onda14-relatorios-gerenciais.test.tsx`

**Depende de:** T10.

### Steps

- [ ] **TDD** os 12 `it('...')` literais ALP-86 no bloco Jest no fim desta task. Não colapsar RBAC num único caso.

- [ ] `old_string` do header (L86–98):

```
      <PageHeader title="Relatórios SIF" subtitle="Área de relatórios ligados ao Serviço de Inspeção Federal.">
        <BadgeProvisorio codigo="P8" />
        <SeletorOperacao />
      </PageHeader>

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
        <p className="flex-1 text-xs leading-snug text-amber-900">
          Modelos oficiais dos relatórios SIF pendentes de fornecimento pelo cliente. Nomes e campos abaixo são provisórios (demonstração).
        </p>
      </div>
```

`new_string`:

```
      <PageHeader title="Relatórios" subtitle="Relatórios do Serviço de Inspeção Federal e relatórios gerenciais de preço.">
        <SeletorOperacao />
      </PageHeader>
```

Erro HEAD L100–102 permanece **fora** das abas (não entra no wrap). Diálogos SIF permanecem **depois** de `</Tabs>`. O wrap é o `old_string`/`new_string` de HEAD L104–165 mais abaixo — o Worker não inventa outro recorte.

Após os `useState` existentes de `RelatoriosConteudo`, acrescentar (SIF **não** usa `Skeleton` — `rg Skeleton relatorios-client.tsx` no HEAD = vazio; loading gerencial = `Card` disabled). Helpers de data **fora** do componente:

```ts
function primeiroDiaMesCorrenteIso(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-01`;
}
function hojeIsoLocal(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}
```

Dentro de `RelatoriosConteudo`, depois de `podeGerar`:

```ts
  const podeSif = permissoes.includes('SIF_LER');
  const podeGerenciais = permissoes.includes('APROVACOES_LER');
  const [aba, setAba] = useState<'sif' | 'gerenciais'>(podeSif ? 'sif' : 'gerenciais');

  type RelatorioGerencialPedido = {
    pedidoVendaId: string;
    pedidoNumero: string;
    clienteNomeFantasia: string | null;
    representanteNome: string | null;
    dataPedido: string;
    faixaPreco: 'A' | 'B' | 'C' | 'D';
    quantidadeItensAjustados: number;
    valorTotalAjustado: string;
    itens: Array<{
      produtoCodigo: string;
      produtoNome: string;
      precoTabelaOriginal: string | null;
      precoAplicado: string;
      diferencaAbsoluta: string;
      diferencaPercentual: string | null;
      usuarioAjusteNome: string | null;
    }>;
  };

  const [dataInicio, setDataInicio] = useState(primeiroDiaMesCorrenteIso);
  const [dataFim, setDataFim] = useState(hojeIsoLocal);
  const [clienteIdFiltro, setClienteIdFiltro] = useState('');
  const [representanteIdFiltro, setRepresentanteIdFiltro] = useState('');
  const [produtoIdFiltro, setProdutoIdFiltro] = useState('');
  const [faixaPrecoFiltro, setFaixaPrecoFiltro] = useState('');
  const [pedidosGerenciais, setPedidosGerenciais] = useState<RelatorioGerencialPedido[]>([]);
  const [carregandoGerenciais, setCarregandoGerenciais] = useState(false);
  const [clientesFiltro, setClientesFiltro] = useState<Array<{ id: string; nomeFantasia?: string | null; razaoSocial: string }>>([]);
  const [representantesFiltro, setRepresentantesFiltro] = useState<Array<{ id: string; nome: string }>>([]);
  const [produtosFiltro, setProdutosFiltro] = useState<Array<{ id: string; codigo: string; nome: string }>>([]);

  useEffect(() => {
    if (!podeGerenciais) return;
    void Promise.all([
      fetch('/api/cadastros/clientes?pageSize=100', { cache: 'no-store' }).then((r) => r.ok ? r.json() : { data: [] }),
      fetch('/api/cadastros/representantes?pageSize=100', { cache: 'no-store' }).then((r) => r.ok ? r.json() : { data: [] }),
      fetch('/api/cadastros/produtos?status=ativo&ativoVenda=true&pageSize=100', { cache: 'no-store' }).then((r) => r.ok ? r.json() : { data: [] }),
    ]).then(([c, r, p]) => {
      setClientesFiltro((c as { data: typeof clientesFiltro }).data ?? []);
      setRepresentantesFiltro((r as { data: typeof representantesFiltro }).data ?? []);
      setProdutosFiltro((p as { data: typeof produtosFiltro }).data ?? []);
    });
  }, [podeGerenciais]);

  const carregarGerenciais = useCallback(async () => {
    if (!dataInicio || !dataFim) return;
    setCarregandoGerenciais(true);
    setErro(null);
    try {
      const qs = new URLSearchParams({ dataInicio, dataFim });
      if (clienteIdFiltro) qs.set('clienteId', clienteIdFiltro);
      if (representanteIdFiltro) qs.set('representanteId', representanteIdFiltro);
      if (produtoIdFiltro) qs.set('produtoId', produtoIdFiltro);
      if (faixaPrecoFiltro) qs.set('faixaPreco', faixaPrecoFiltro);
      const res = await fetch(`/api/ocorrencias-preco/relatorio?${qs}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(await mensagemDeErro(res));
      const corpo = await res.json() as { data: RelatorioGerencialPedido[]; total: number };
      setPedidosGerenciais(corpo.data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar relatórios gerenciais');
    } finally {
      setCarregandoGerenciais(false);
    }
  }, [dataInicio, dataFim, clienteIdFiltro, representanteIdFiltro, produtoIdFiltro, faixaPrecoFiltro]);

  useEffect(() => {
    if (aba !== 'gerenciais') return;
    if (!dataInicio || !dataFim) return;
    void carregarGerenciais();
  }, [aba, carregarGerenciais, dataInicio, dataFim]);
```

Importar no topo (além dos já existentes): `mensagemDeErro` de `@/lib/error-message` — **não** usar `import()` dinâmico. Acrescentar `import { mensagemDeErro } from '@/lib/error-message';` e no `carregarGerenciais` usar `mensagemDeErro(res)` direto. Também:

```
import { ComboboxField } from '@/components/ui/combobox-field';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { SelectNative } from '@/components/ui/select-native';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
```

`FormField` já está importado. `Tabs*` = mesmo import de `aprovacoes-client.tsx` L20.

Aplicar **depois** do patch do header. Erro L100–102 **não** entra neste `old_string`.

`old_string` único (HEAD `851f665` L104–165 — `KpiStrip` + cards; único no arquivo):

```
      <KpiStrip>
        <Kpi label="Pendentes de dados" value={kpis.pendentes} tone="alert" />
        <Kpi label="Prontos para gerar" value={kpis.prontos} tone="ok" />
        <Kpi label="Gerados/Retificados" value={kpis.gerados} tone="default" />
      </KpiStrip>

      <div className="space-y-2.5">
        {relatorios.map((r) => (
          <Card key={r.id}>
            <CardContent className="flex flex-wrap items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[13px] font-semibold">{r.nome}</h3>
                  <BadgeProvisorio pendencia="P8" />
                  <StatusPill variant="pendente" label={ROTULO_STATUS_SIF[r.status]} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{r.codigo} · Responsável: {r.perfilResponsavel}</p>
                {r.pendenciasJson.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {r.pendenciasJson.map((p) => (
                      <li key={p} className="flex items-center gap-1 text-[11px] text-warning-fg">
                        <AlertTriangle size={12} /> {p}
                      </li>
                    ))}
                  </ul>
                )}
                {r.ultimaVersao && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Última versão: v{r.ultimaVersao.versao} em {formatDataHora(r.ultimaVersao.geradoEm)}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  disabled={!podeGerar || r.status === 'pendente_dados'}
                  title={r.status === 'pendente_dados' ? 'Resolva as pendências de dados antes de gerar' : 'Gerar nova versão'}
                  onClick={() => void gerarRelatorio(r.id).then(carregar).catch((e: Error) => setErro(e.message))}
                >
                  Gerar
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void previewRelatorio(r.id)
                    .then((v) => setModalPreview({ relatorio: r, versao: v }))
                    .catch((e: Error) => setErro(e.message))}
                >
                  <Eye /> Pré-visualizar
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setModalRetificar(r)} disabled={!podeGerar || r.versaoAtual < 1}>
                  Retificar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void abrirHistorico(r)}>
                  <History /> Histórico
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
```

`new_string` (KpiStrip e cards = HEAD L104–165 reindentados em `TabsContent value="sif"`; P8 + aviso âmbar entram em `sif`; gerenciais no segundo `TabsContent`):

```tsx
      <Tabs value={aba} onValueChange={(v) => setAba(v as 'sif' | 'gerenciais')}>
        <TabsList>
          {podeSif && <TabsTrigger value="sif">Relatórios SIF</TabsTrigger>}
          {podeGerenciais && <TabsTrigger value="gerenciais">Relatórios Gerenciais</TabsTrigger>}
        </TabsList>
        <TabsContent value="sif" className="space-y-3">
          <BadgeProvisorio codigo="P8" />
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <p className="flex-1 text-xs leading-snug text-amber-900">
              Modelos oficiais dos relatórios SIF pendentes de fornecimento pelo cliente. Nomes e campos abaixo são provisórios (demonstração).
            </p>
          </div>
          <KpiStrip>
            <Kpi label="Pendentes de dados" value={kpis.pendentes} tone="alert" />
            <Kpi label="Prontos para gerar" value={kpis.prontos} tone="ok" />
            <Kpi label="Gerados/Retificados" value={kpis.gerados} tone="default" />
          </KpiStrip>
          <div className="space-y-2.5">
            {relatorios.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex flex-wrap items-center gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[13px] font-semibold">{r.nome}</h3>
                      <BadgeProvisorio pendencia="P8" />
                      <StatusPill variant="pendente" label={ROTULO_STATUS_SIF[r.status]} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{r.codigo} · Responsável: {r.perfilResponsavel}</p>
                    {r.pendenciasJson.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {r.pendenciasJson.map((p) => (
                          <li key={p} className="flex items-center gap-1 text-[11px] text-warning-fg">
                            <AlertTriangle size={12} /> {p}
                          </li>
                        ))}
                      </ul>
                    )}
                    {r.ultimaVersao && (
                      <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Última versão: v{r.ultimaVersao.versao} em {formatDataHora(r.ultimaVersao.geradoEm)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      disabled={!podeGerar || r.status === 'pendente_dados'}
                      title={r.status === 'pendente_dados' ? 'Resolva as pendências de dados antes de gerar' : 'Gerar nova versão'}
                      onClick={() => void gerarRelatorio(r.id).then(carregar).catch((e: Error) => setErro(e.message))}
                    >
                      Gerar
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void previewRelatorio(r.id)
                        .then((v) => setModalPreview({ relatorio: r, versao: v }))
                        .catch((e: Error) => setErro(e.message))}
                    >
                      <Eye /> Pré-visualizar
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setModalRetificar(r)} disabled={!podeGerar || r.versaoAtual < 1}>
                      Retificar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void abrirHistorico(r)}>
                      <History /> Histórico
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="gerenciais" className="space-y-3">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            <FormField label="Data início" htmlFor="rel-data-inicio">
              <DatePickerField id="rel-data-inicio" value={dataInicio} onChange={setDataInicio} aria-label="Data início" />
            </FormField>
            <FormField label="Data fim" htmlFor="rel-data-fim">
              <DatePickerField id="rel-data-fim" value={dataFim} onChange={setDataFim} aria-label="Data fim" />
            </FormField>
            <FormField label="Cliente" htmlFor="rel-cliente">
              <ComboboxField
                id="rel-cliente"
                items={clientesFiltro.map((c) => ({
                  id: c.id,
                  label: c.nomeFantasia || c.razaoSocial,
                }))}
                value={clienteIdFiltro}
                onChange={setClienteIdFiltro}
                placeholder="Buscar cliente"
                searchPlaceholder="Buscar cliente"
                emptyText="Nenhum cliente encontrado."
                clearable
              />
            </FormField>
            <FormField label="Representante" htmlFor="rel-representante">
              <SelectNative
                id="rel-representante"
                value={representanteIdFiltro}
                onChange={(event) => setRepresentanteIdFiltro(event.target.value)}
              >
                <option value="">Todas</option>
                {representantesFiltro.map((r) => (
                  <option key={r.id} value={r.id}>{r.nome}</option>
                ))}
              </SelectNative>
            </FormField>
            <FormField label="Produto" htmlFor="rel-produto">
              <ComboboxField
                id="rel-produto"
                items={produtosFiltro.map((p) => ({
                  id: p.id,
                  label: `${p.codigo} — ${p.nome}`,
                }))}
                value={produtoIdFiltro}
                onChange={setProdutoIdFiltro}
                placeholder="Todos"
                searchPlaceholder="Buscar produto..."
                emptyText="Nenhum produto encontrado."
                clearable
              />
            </FormField>
            <FormField label="Faixa" htmlFor="rel-faixa">
              <SelectNative
                id="rel-faixa"
                value={faixaPrecoFiltro}
                onChange={(event) => setFaixaPrecoFiltro(event.target.value)}
              >
                <option value="">Todas</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </SelectNative>
            </FormField>
          </div>
          {carregandoGerenciais ? (
            <Card className="pointer-events-none opacity-60">
              <CardContent className="p-3">
                <p className="text-sm text-muted-foreground">Carregando…</p>
              </CardContent>
            </Card>
          ) : pedidosGerenciais.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido com alteração de preço no período selecionado.</p>
          ) : (
            <div className="space-y-2.5">
              {pedidosGerenciais.map((pedido) => (
                <details key={pedido.pedidoVendaId} className="rounded-lg border border-border">
                  <summary className="cursor-pointer list-none p-3">
                    <div className="grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-6">
                      <span><strong>Número</strong> {pedido.pedidoNumero}</span>
                      <span><strong>Cliente</strong> {pedido.clienteNomeFantasia ?? '—'}</span>
                      <span><strong>Representante</strong> {pedido.representanteNome ?? '—'}</span>
                      <span><strong>Data</strong> {pedido.dataPedido}</span>
                      <span><strong>Itens ajustados</strong> {pedido.quantidadeItensAjustados}</span>
                      <span className={cn(
                        'font-data',
                        pedido.valorTotalAjustado.startsWith('-') ? 'text-destructive' : 'text-success-fg',
                      )}>
                        <strong>Valor total ajustado</strong> {pedido.valorTotalAjustado}
                      </span>
                    </div>
                  </summary>
                  <div className="border-t border-border p-3">
                    {pedido.itens.some((item) => item.precoTabelaOriginal == null) && (
                      <p className="mb-2 text-xs text-muted-foreground">Sem preço de tabela para a data</p>
                    )}
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="py-1">Produto</th>
                          <th className="py-1 text-right">Preço da tabela</th>
                          <th className="py-1 text-right">Preço aplicado</th>
                          <th className="py-1 text-right">Diferença</th>
                          <th className="py-1 text-right">Diferença %</th>
                          <th className="py-1">Ajustado por</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pedido.itens.map((item, indice) => (
                          <tr key={`${item.produtoCodigo}-${indice}`} className="border-b border-border">
                            <td className="py-1">{item.produtoCodigo} {item.produtoNome}</td>
                            <td className="py-1 text-right font-data">{item.precoTabelaOriginal ?? '—'}</td>
                            <td className="py-1 text-right font-data">{item.precoAplicado}</td>
                            <td className={cn(
                              'py-1 text-right font-data',
                              item.diferencaAbsoluta.startsWith('-') ? 'text-destructive' : 'text-success-fg',
                            )}>{item.diferencaAbsoluta}</td>
                            <td className="py-1 text-right font-data">{item.diferencaPercentual ?? '—'}</td>
                            <td className="py-1">{item.usuarioAjusteNome ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
```

Aba inicial: **`sif` se `SIF_LER`, senão `gerenciais`**. Uma aba só → já selecionada (Jest). Detalhe = **`<details>`** (não painel, não accordion da fila). Loading = **`Card` disabled** (`pointer-events-none opacity-60`) — `Skeleton` existe no DS mas **não** na tela SIF. `cn` já não está em `relatorios-client.tsx`: acrescentar `import { cn } from '@/lib/cn';`. **Sem** botão exportar. `SeletorOperacao` permanece no header. Consulta **não** dispara se `dataInicio` ou `dataFim` estiver vazio.

- [ ] `rg "exportar|Exportar" app/frontend/src/app/(admin)/gestao/relatorios/relatorios-client.tsx` vazio. `menus-canonicos.ts` e `menu-v2.ts` **não** entram no diff.

- [ ] Jest 1:1 — arquivo `onda14-relatorios-gerenciais.test.tsx`. Cada `it` abaixo é obrigatório (título literal, tabela de testes ALP-86):

```ts
it('tela renderiza as duas abas', async () => {
  // SIF_LER + APROVACOES_LER; TabsTrigger Relatórios SIF e Relatórios Gerenciais visíveis.
});
it('aba SIF preserva os 4 relatórios e a geração', async () => {
  // 4 cards SIF + botão Gerar intactos; lógica SIF inalterada.
});
it('BadgeProvisorio P8 aparece só na aba SIF', async () => {
  // P8 e aviso âmbar dentro de TabsContent sif; ausentes no PageHeader e na aba gerenciais.
});
it('sem SIF_LER a aba SIF não aparece', async () => {
  // permissoes só APROVACOES_LER; TabsTrigger Relatórios SIF ausente; aba gerenciais já selecionada.
});
it('sem APROVACOES_LER a aba Gerenciais não aparece', async () => {
  // permissoes só SIF_LER; TabsTrigger Relatórios Gerenciais ausente; aba sif já selecionada.
});
it('período default preenchido ao abrir', async () => {
  // dataInicio = 1º dia do mês corrente; dataFim = hoje (YYYY-MM-DD local).
});
it('limpar o período bloqueia a consulta', async () => {
  // limpar dataInicio ou dataFim; GET /api/ocorrencias-preco/relatorio NÃO disparado.
});
it('filtros combinados chegam na query', async () => {
  // dataInicio, dataFim, clienteId, representanteId, produtoId, faixaPreco na URL do GET /api/ocorrencias-preco/relatorio.
});
it('detalhamento mostra todos os itens', async () => {
  // expandir pedido; N linhas = N itens do JSON; colunas Produto, Preço da tabela, Preço aplicado, Diferença, Diferença %, Ajustado por.
});
it('item sem preço de tabela mostra —', async () => {
  // precoTabelaOriginal null → em-dash nas colunas tabela e %; legenda Sem preço de tabela para a data; query R$ 0,00 e 0% ausentes.
});
it('resultado vazio mostra a mensagem correta', async () => {
  // GET data:[], total:0 → texto Nenhum pedido com alteração de preço no período selecionado.
});
it('erro do endpoint aparece em role="alert"', async () => {
  // GET 500; elemento role=alert com a mensagem; padrão L100–102.
});
```

Cada título é o critério de aceite. Corpos: seguir os passos já desta task. **Não** reduzir os 12 casos a um único `it`.

**Commit:** `feat(onda14): aba Relatórios Gerenciais em /gestao/relatorios`

---

## Task 12 — Matriz DoD → teste, regressão, evidências (ALP-61)

**Files:** completar testes faltantes; `docs/evidencias/onda14-preco-tabela-pedido/`; **não** criar fixture paralela de produto.

### Steps

- [ ] Conferir 1:1 o mapa deste plano: cada linha 14.1–14.10 e C1–C10 tem teste verde com nome rastreável (`it('DoD 14.6 ...')` / `it('C2 sem fallback ...')`).
- [ ] **Não** existe teste "item comercial sem produto" (`rg "sem produto vinculado|item comercial sem produto" app`).
- [ ] Regressão 8 áreas — rodar **estes arquivos que existem no HEAD** (paths relativos a `app/backend`) e colar a saída na evidência. **Não** ajustar glob. **Não** existe `relatorios-sif*`.

```powershell
Set-Location app/backend
npx jest --runInBand --testPathPattern "test/integration/pedidos-onda4.e2e-spec.ts|test/integration/pedidos-reserva.e2e-spec.ts|test/integration/pedidos-concorrencia.e2e-spec.ts|test/integration/adendos.e2e-spec.ts|test/integration/overbooking-lifecycle.e2e-spec.ts|test/integration/overbooking-decisao.e2e-spec.ts|test/integration/overbooking-concorrencia.e2e-spec.ts|test/integration/sif.e2e-spec.ts|test/integration/aprovacoes.e2e-spec.ts|test/integration/ocorrencia-fornecedor.e2e-spec.ts|test/unit/perfil-permissoes-snapshot.spec.ts|test/integration/onda13-catalogo-unificacao.e2e-spec.ts"
```

Arquivos (1:1 com o comando):

1. Reserva atômica — `test/integration/pedidos-reserva.e2e-spec.ts`
2. Overbooking AD-05 — `test/integration/overbooking-lifecycle.e2e-spec.ts`, `test/integration/overbooking-decisao.e2e-spec.ts`, `test/integration/overbooking-concorrencia.e2e-spec.ts`
3. Adendos (quantidade) — `test/integration/adendos.e2e-spec.ts`
4. `PATCH :id/itens/:itemId` só quantidade — `test/integration/pedidos-onda4.e2e-spec.ts`
5. 4 SIF + versionamento — `test/integration/sif.e2e-spec.ts`
6. Fila fornecedor + `Concluir tratativa` — `test/integration/aprovacoes.e2e-spec.ts`, `test/integration/ocorrencia-fornecedor.e2e-spec.ts`
7. Snapshot RBAC — `test/unit/perfil-permissoes-snapshot.spec.ts`
8. Catálogo unificado — `test/integration/onda13-catalogo-unificacao.e2e-spec.ts`

Não reescrever specs históricos de migrate `< 0034`.

- [ ] Snapshot RBAC: `OCORRENCIA_PRECO_CIENTE` em admin/gestor; **ausente** `PEDIDO_PRECO_AJUSTAR`; **ausente** `ITENS_COMERCIAIS_*` / `ITENS_COMPRA_*`.
- [ ] `rg item_comercial_id app/backend/src/database/schema app/backend/src/modules` vazio.
- [ ] `rg itemComercialId app/frontend/src/app/(admin)/comercial/pedidos` vazio.
- [ ] Evidências: `test:cov` (percentuais dos services tocados: `ClientesService`, `PrecosService`, `PedidosService`, `OcorrenciasPrecoService`); `drizzle-kit check`; `backfill-itens-count.txt`; `docker compose ps` (T13/T14); screenshots das 4 telas (cliente campo; editor coluna+borda; fila ocorrência; relatório). Sem inventar captura — se Playwright local não rodar, listar os testes Jest como evidência de UI e **reportar** a lacuna de screenshot ao QO na T13.

**Commit:** `test(onda14): matriz DoD, regressão e evidências`

---

## Task 13 — Validação presencial do Quality Owner (bloqueante)

**Humana. Worker para e reporta.** Igual ALP-75 / AD-16 item 7.

Checklist para o QO na app local (`localhost:4000` / `4001`, `HARDWARE_FAKE=1`, `NFSE_FAKE=1`, Postgres `15433`):

1. Novo cliente: aba Preferências, `Tabela de Preço` primeiro, sem pré-seleção; salvar sem faixa falha no campo e na aba.
2. Cliente existente: faixa `A` (backfill); editar para `C`.
3. Pedido do dia com tabela publicada: preço preenchido; unidade correta.
4. Sem tabela na data / rascunho / dia anterior: R$ 0,00; inclusão bloqueada até manual > 0.
5. Ajuste para mais e para menos: só borda + tooltip (tabela vs ausência).
6. Voltar ao original: borda some.
7. Finalizar com ajuste: 1 ocorrência na fila; sem ajuste: nada.
8. `Marcar como ciente` (gestor/admin); segunda vez 409; comercial sem o botão.
9. Relatórios: duas abas; SIF intacto + P8 só lá; gerencial lista só divergência.
10. Adendo não muda preço.

**Proibido:** `git push`, `gh pr create`, Portão 2, merge. O Worker escreve `docs/evidencias/onda14-preco-tabela-pedido/AGUARDANDO-QO.md` com o checklist e **para**.

Sem commit de produto. Se o Executor quiser um commit de evidência, ele commita.

---

## Task 14 — Gate local completo + push/PR (somente depois da T13)

**Pré-condição:** Quality Owner marcou T13 Done (validação presencial). Se não, **não executar esta task**.

**Este worker NÃO faz Portão 2, NÃO registra veredito, NÃO mergeia, NÃO edita `docs/execucao/`.** Após o PR, o Executor dispara `$gate-pr` numa sessão Monitor **nova**.

### Gate local (PowerShell 7, worktree o14)

```powershell
Set-Location "d:\0 - Projetos\AC\alpha-carnes\.worktrees\o14"
$env:HARDWARE_FAKE = '1'
$env:NFSE_FAKE = '1'
npm ci
npm run lint
npm run type-check
npm run test
npm run build
Set-Location app/backend
npx drizzle-kit check
npm run test:cov   # ≥80% linha e branch
Set-Location ../frontend
npm run test
Set-Location ../..
```

Saída esperada: lint 0 errors; type-check 0; testes verdes; build ok; `drizzle-kit check` sem drift; coverage backend ≥80% linha **e** branch; frontend Jest verde.

```powershell
rg "PEDIDO_PRECO_AJUSTAR" app/backend/src app/frontend/src
# esperado: nenhum match
rg "item_comercial_id|itens_comerciais" app/backend/src/database/schema app/backend/src/modules
# esperado: nenhum match
```

Docker (aceite local):

```powershell
docker compose up --build -d
docker compose ps
# postgres + backend + frontend healthy; host 4000 / 4001 / 15433
```

### Push e PR (só depois do gate verde **e** T13 Done)

```powershell
git -C "d:\0 - Projetos\AC\alpha-carnes\.worktrees\o14" push -u origin HEAD
gh pr create --base develop --head feature/onda14-preco-tabela-pedido --title "Onda 14 — Preço de tabela no pedido (AD-16)" --body "$(@'
## Summary
- Faixa A/B/C/D no cliente, preço vigente na data exata da operação, ajuste sob PEDIDOS_GERENCIAR.
- Ocorrência informativa aberta/ciente + relatório em aba de /gestao/relatorios (39 rotas intactas).
- Sem PEDIDO_PRECO_AJUSTAR. Sem PR antes da validação presencial do QO (T13 Done).

## Test plan
- [ ] Matriz DoD 14.1–14.10 + C1–C10 verde
- [ ] test:cov ≥80% linha e branch
- [ ] 8 jobs CI
- [ ] QO validou localmente
'@)"
```

Não `gh pr merge`. Não `$gate-pr`. Reportar URL do PR + SHA HEAD ao Executor.

**Commit desta task:** nenhum extra se o gate não gerar diff; se `regen-rbac-snapshot` ou evidência mudar, `chore(onda14): evidências e snapshot RBAC do gate local`.

---

## Gate local completo (comandos = CI) + abertura do PR

A seção "abertura do PR" **é a Task 14**. Até T13 Done ela é no-op. Comandos = bloco da T14. Portas 4000/4001/15433. `HARDWARE_FAKE=1`, `NFSE_FAKE=1`. Oito jobs canônicos no CI após o PR. Vercel não é gate (diff não toca `landing/**`).

---

## Self-Review

### O que o Worker deve confirmar no relatório

1. Diff só no escopo das tasks. Zero `docs/execucao/`. Zero `0035_onda13_*`.
2. `PEDIDO_PRECO_AJUSTAR` **não** aparece em `app/backend/src` nem `app/frontend/src`.
3. `resolverPrecoVigente` não chama `precosDaUltimaPublicada`. Teste C2 verde.
4. Backfill itens: count=0 com evidência **ou** escala ao QO (nunca preço inventado).
5. `PrecosService.criar` continua `ativoVenda=true` — **reportar** (BOI não entra). Não "corrigir".
6. Lacuna `representanteNome` histórico — **reportar**. Sem coluna nova.
7. Lacuna `pedidoNumero` = UUID (não há sequencial de pedido no HEAD) — **reportar**.
8. `aprovacoes-client` ganhou WS (não existia). Sem accordion.
9. Editor/testes HEAD já eram `produtoId`; T06 não reintroduziu `itemComercialId`.
10. Dívida `Valor estimado` **não** implementada.
11. Roadmap tem Onda 14 + nó mermaid; matriz 41 entradas / 39 telas; quality-gates tem DoD 14.
12. T13 bloqueou push; T14 só após QO. Este worker **não** fez Portão 2 nem merge.

### Pendências / dívidas (explícitas — não implementar)

- Lista de pedidos `Valor estimado` hardcoded (ALP-55 fora de escopo).
- Representante do relatório = vínculo atual do cliente.
- Numeração amigável de pedido inexistente no HEAD.
- Screenshots Playwright se o ambiente local do Worker não tiver browser — QO na T13.

### requires-human

Nenhum bloqueio de **decisão** neste plano: AD-16 está em `DECISOES.md` no SHA `4cea1f1`. O único `requires-human` **operacional** é a T13 (validação presencial) e o fail-closed da T05 se a base-alvo tiver `pedidos_venda_itens.count > 0`.
