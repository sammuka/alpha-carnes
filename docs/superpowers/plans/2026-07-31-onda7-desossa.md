# Onda 7 — Desossa e Transformação — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Workers: papel `worker` em `.codex/agents/worker.toml`. Executar task a task sem reabrir decisões.

**Goal:** Fechar as três rotas de Desossa (matriz linhas 17–19) com backend transacional (bind de regra + exclusividade, checklist esperado×registrado, divergência formal), painel aeroporto/Modo TV por eventos WebSocket (zero poll), seed das regras A/B provisórias com Badge Provisório, e UIs idênticas ao protótipo — sem inventar AD para P6/P12.

**Architecture:** Extensão do módulo F4c já existente (`modules/operacao/corte` + `modules/operacao/desossa`). Não nasce módulo paralelo: `transformacoes` ganha `regra_transformacao_id`; nasce `divergencias_transformacao`; painel novo em `GET /desossa/painel`; eventos novos no catálogo RA-04 e no gateway WS. Frontend substitui PlaceholderPage e remove o `setInterval(60s)` do dashboard. Seed idempotente das regras TZ A/B no `db:seed`.

**Tech Stack:** NestJS 11 + TypeScript 5 strict, Drizzle ORM (PostgreSQL 18, `uuidv7()`), Zod 4, WebSocket nativo + `@nestjs/event-emitter`, Jest (unit/integration com Postgres efêmero + fakes), Next.js 16 App Router (BFF) + React 19 + Playwright e2e.

**Base tip:** `origin/develop` @ `94fb341` (Onda 6 mergeada + dívidas O6). Próxima migration: `0023`. Protótipo pinado: `F:\Projetos\alpha-carnes-prototipo` @ `feature/completude-v1.1` `8d32aa4c`. PR `#38` (`feature/onda7-desossa`) foi CLOSED — este plano é do zero; não reabrir.

## Emenda 1 — Portão 1 (veredito `ajustar` 2026-07-31T16:45:30-03:00)

Fecha **todos** os bloqueantes e menores do Portão 1, item a item:

| # | Achado | Fechamento nesta emenda |
|---|---|---|
| 1 | Task 3 usava `this.server.to().emit` (Socket.IO) | Handlers só via `private broadcast` → `RealtimeHub.broadcast` + `roomsDaData` estendido com literal `'desossa'` + teste unit |
| 2 | Densidade baixa (Tasks 6/7/8/10/12/13 sem literais) | `painel.calc`, `ChecklistCorteService.obter`, `abrirDivergencia` completo, emissores pós-commit, `listar` etiquetas, JSX Tasks 11–13 |
| 3 | Princípio I — Tasks 11–13 sem JSX fiel | Blocos TVMode/KPIs/tabela/sugestão; seletor A/B+Badge/checklist/modais; KPIs/filtros/Peça mãe/drawer |
| 4 | `abrirNaTx` incompleto | Literal com `operacaoId`, `descricao` (≥10), `impacto` (≥5) + demais campos do DTO real |
| 5 | D7.13/Task 12 contingente (endpoint opcional) | **Decisão: criar** `GET /operacao/corte/pecas-elegiveis` — handler+serviço literais (endpoint ausente no tip) |
| 6 | RBAC sem literal MAPA/push; page sem `DESOSSA_PAINEL_LER` | `MAPA_PERFIL_PERMISSOES` + `pushPermissoes` para `comercial`/`diretoria`; `page.tsx` com `DESOSSA_PAINEL_LER` |
| 7 | Códigos `code`/`message` vs backend | Padronizado `codigo`/`mensagem`; testes assertam `response.codigo` |
| 8 | DoD 7.11 sem arquivo/step | `test/unit/divergencia-transformacao.dto.spec.ts` na estrutura + Step na Task 6 |

**Base tip atualizado:** `origin/develop` @ `94fb341` (Onda 6 merge + dívidas). Próxima migration permanece `0023`.

## Emenda 2 — Portão 1 (veredito `ajustar` 2026-07-31T17:47:30-03:00 / tip `25300fa`)

Fecha **todos** os bloqueantes e menores do Portão 1 da Emenda 1, item a item. Protótipo revalidado: `F:\Projetos\alpha-carnes-prototipo` @ `feature/completude-v1.1` `8d32aa4c`.

| # | Achado | Fechamento nesta emenda |
|---|---|---|
| 1 | Task 7 `painel.calc`: spec `aProduzir:4` vs literal `aProduzir=quantidadeFaltante` (5) e vs tip `faltas.calc.ts:41` (líquido) | Semântica fixa: `quantidadeFaltante` já é líquido → `aProduzir = quantidadeFaltante`; `faltam = quantidadeFaltante + quantidadeEstoque` (demanda bruta só para rótulo UI); teste e literal idênticos |
| 2 | Task 12 modal chama `fetchBackend` no client (`next/headers`) | Client só `fetch('/api/...')` (padrão O6); BFF `divergencia` + `concluir` (concluir já existe) |
| 3 | Princípio I incompleto vs `DesossaDashboard`/`DesossaPesagem`/`DesossaEtiquetas` `8d32aa4c` | TVMode coluna CARGA/HORÁRIO; KPI «TZs na desossa»; tabela Rota/Carga+Representante+Alvo + joins; drawers Item/Regra/TZ com JSX; Etiquetas 11 cols + filtros por rótulo do protótipo |
| 4 | Task 3 Step 5 não roda snapshot RBAC | Comando explícito `perfil-permissoes-snapshot.spec.ts` + saída esperada comercial/diretoria |
| 5 | Modais pesagem só em prosa | Cercas JSX literais: `ModalSelecionarTz`, `ModalEtiquetaParte`, `ModalCancelarAcao` (`DesossaPesagem.tsx:121-279`) |

**Decisão semântica (bloqueante 1 — fechada):** não estender `FaltaDesossaItem` com demanda bruta. Tip `faltas.calc.ts:41` define `quantidadeFaltante = max(0, demanda − estoque)` (líquido). O protótipo (`DesossaDashboard.tsx:56-61`) mostra `faltam` como demanda bruta e `aProduzir = faltam − estoque`. O painel reconstrói `faltam` na projeção UI; `aProduzir` espelha o líquido do tip. Zero contradição teste↔literal↔tipo.

## Emenda 3 — Portão 1 (veredito `ajustar` 2026-07-31T17:58:00-03:00 / tip `b8aff66`)

Fecha **todos** os bloqueantes e menores do Portão 1 da Emenda 2 (`b8aff66`), item a item. Ancestral obrigatório: Emenda 2 `d1be02a` + veredito `b8aff66`. Protótipo revalidado: `F:\Projetos\alpha-carnes-prototipo` @ `feature/completude-v1.1` `8d32aa4c` (`DesossaDashboard.tsx:563` sugestão; `:600-638` TZs disponíveis).

| # | Achado (`b8aff66`) | Fechamento nesta emenda |
|---|---|---|
| 1 | DrawerTZ morto — sem tabela «TZs disponíveis» `:600-638` nem `setDrawerTZ` a partir da linha | Task 11: JSX literal da tabela (9 cols Peça/Peso/Lote/Origem/Entrada/Características/Situação/Obs./Eye) + fetch client + `setDrawerTZ(tz)`; tipo de linha com todos os campos |
| 2 | Fonte TZ × RBAC — `pecas-elegiveis` só `CORTE_GERENCIAR` → 403 no telão | **Decisão Opção A (D7.14):** `@RequireQualquerPermissao('DESOSSA_PAINEL_LER', 'DESOSSA_LER', 'CORTE_GERENCIAR')` no GET (padrão tip `dashboard.controller.ts:21`); DTO estendido com cols da tabela; zero 403 para leitores do painel |
| 3 | Sugestão incompleta vs `:563` — faltam Prior./Atende/Sobras/Impacto | Tipo `PainelDesossa.regras` + `painel.calc` + JSX thead/tbody + DrawerRegra com as 4 cols; Badge Provisório coexiste (P12), sem substituir Status |
| 4 | `bloqueada: false` hardcoded | Task 10: `bloqueada` via EXISTS carga fechada na peça mãe (`STATUS_CAMINHAO_FECHADO` / tip `carga-fechada.ts`) |
| 5 | `vincularRegra` / checklist sem cerca `fetch('/api/...')` | Task 12: literais `vincularRegra` + `carregarChecklist` no padrão do modal finalizar |

**Decisão D7.14 — Fonte de TZs do telão (Opção A — fechada):**
- Endpoint único: `GET /operacao/corte/pecas-elegiveis?operacaoId=` (já criado em D7.13/Task 12).
- Permissão OR: `RequireQualquerPermissao('DESOSSA_PAINEL_LER', 'DESOSSA_LER', 'CORTE_GERENCIAR')` — tip já exporta o decorator em `require-qualquer-permissao.decorator.ts`; guard `RbacGuard` honra `PERMISSOES_QUALQUER_KEY`.
- Dashboard (telão) e Pesagem consomem o **mesmo** endpoint; mutações (`POST .../regra`, checklist write-path, iniciar) permanecem `CORTE_GERENCIAR`.
- Opção B (`GET /desossa/painel/.../tzs-disponiveis`) **rejeitada** — duplicaria listagem e fragmentaria a fonte de verdade.
- DTO carrega cols do protótipo `:600-638` (lote←`recebimentos.romaneio`, origem←`fornecedores.razaoSocial`, entrada←ISO `pecas.createdAt`, caracteristicas←flags `capturaMeta`, obs←`capturaMeta.obs`, situacao←map de `statusPeca`).

## Emenda 4 — Portão 1 (veredito `ajustar` 2026-07-31T18:10:00-03:00 / tip `ef862bf`)

Fecha **todos** os bloqueantes e menores do Portão 1 da Emenda 3 (`ef862bf`), item a item. Ancestral obrigatório: Emenda 3 `6fb6d04` + veredito `ef862bf`. Tip código (develop): `expedicao.schema.ts` XOR `carga_itens` (`tipo_origem='subitem'` ⇒ `subitem_id` NOT NULL e `peca_id` NULL); `carga-fechada.ts` exporta `STATUS_CAMINHAO_FECHADO` + `etiquetaBloqueadaSql` (este **não** se copia cego — inclui `status_peca IN ('em_transformacao','transformada')` da mãe).

| # | Achado (`ef862bf`) | Fechamento nesta emenda |
|---|---|---|
| 1 | `bloqueada` com EXISTS em `ci.peca_id = pecas.id` (TZ mãe) — peças-parte em carga fechada nunca casam (XOR `subitem_id`) | Task 10: EXISTS `ci.subitem_id = ${subitens.id}` + `STATUS_CAMINHAO_FECHADO` (lista tip); **proibido** só `peca_id` da mãe; **proibido** copiar `etiquetaBloqueadaSql` (não marcar mãe `em_transformacao`/`transformada` como bloqueada); DoD 7.21b com fixture que falha se o join voltar ao `peca_id` |
| 2 | DoD 7.14b só no mapa — Task 14 sem cerca `it`/`expect` | Task 14: literais integration — `comercial` → 200 em `pecas-elegiveis`; perfil sem nenhuma das 3 perms (`faturamento`) → 403 |
| 3 | Task 11 engole 403 de TZs (`tzRes.status !== 403`) — viola RA-05 com D7.14 | Task 11: qualquer `!tzRes.ok` (incl. 403) → `setErro` + `setTzs([])`; zero silêncio |

**Decisão D7.21b — `bloqueada` por subitem em carga fechada (fechada):**
- Predicado canônico = `EXISTS` correlacionado em `carga_itens.subitem_id = subitens.id` com caminhão em `STATUS_CAMINHAO_FECHADO` (`fechado`…`expedido`), `ci.deleted_at IS NULL`, `ci.status_carga_item <> 'removido'`.
- Etiquetas da desossa são de **subitem** (`etiquetas_impressoes.subitem_id`); na expedição entram em `carga_itens` com `tipo_origem='subitem'` (XOR tip `:90-91`) — join por `peca_id` da TZ mãe é semanticamente errado e deixa o filtro UI «Bloqueada» morto.
- **Não** importar/reusar `etiquetaBloqueadaSql` da Onda 6: aquele predicado OR-a `pecas.status_peca IN ('em_transformacao','transformada')`, o que marcaria quase todas as etiquetas durante a desossa (mãe em transformação). Reusar só a **lista** `STATUS_CAMINHAO_FECHADO`.
- Teste DoD 7.21b: mãe **fora** de `carga_itens` + parte **dentro** com caminhão fechado → `bloqueada === true`; e mãe `em_transformacao` sem carga do subitem → `bloqueada === false`.

## Emenda 5 — Portão 1 (veredito `ajustar` 2026-07-31T18:17:13-03:00 / tip `04bc197`)

Fecha **todos** os bloqueantes e menores do Portão 1 da Emenda 4 (`04bc197`), item a item. Ancestral obrigatório: Emenda 4 `98b3a3b` + veredito `04bc197`. Tip código: `paginacao.ts` `Paginado`/`montarPaginado` → `{ data, total, page, pageSize }` (NÃO `itens`); e2e O6 `etiqueta.e2e-spec.ts` lê `body.data`.

| # | Achado (`04bc197`) | Fechamento nesta emenda |
|---|---|---|
| 1 | DoD 7.21b lê `res.body.itens` — tip `Paginado`/`montarPaginado` e O6 usam `data`; asserts nunca passam | Task 10 DoD 7.21b: `res.body.data`; Task 13: `setEtiquetas(json.data)`; **proibido** `body.itens`/`json.itens` na listagem de etiquetas/desossa |
| 2 | Fixtures DoD 7.21b com `// ... seedFixture...` — `operacaoId`/`subitemId` inventáveis | Literais completos `seedFixtureEtiquetaSubitemEmCargaFechada` / `…SemCarga` (HTTP O4/O6/O7 + SQL `carga_itens` XOR `subitem`) devolvendo ids tipados |

**Envelope listagem (fechado):** `GET /desossa/etiquetas` retorna `montarPaginado(...)` → `{ data: EtiquetaDesossaListada[], total, page, pageSize }`. Integration e client leem **só** `.data`.

## Emenda 6 — Portão 1 (veredito `ajustar` 2026-07-31T18:28:50-03:00 / tip `9608d20`)

Fecha **todos** os bloqueantes e menores do Portão 1 da Emenda 5 (`9608d20`), item a item. Ancestral obrigatório: Emenda 5 `99a639b` + veredito `9608d20`. Tip gate O7: após Tasks 2/4/5, `iniciarCorte` → `subitemCompleto` **sem** `POST /operacao/corte/:id/regra` ⇒ 409 `REGRA_TRANSFORMACAO_OBRIGATORIA` (DoD 7.6); saída fora das saídas da regra ⇒ 409 `SAIDA_FORA_DA_REGRA` (DoD 7.7).

| # | Achado (`9608d20`) | Fechamento nesta emenda |
|---|---|---|
| 1 | Fixtures DoD 7.21b literais, mas `iniciarCorte` → `subitemCompleto` sem bind de regra e com `c.itemComercialId` do recebimento — Expected PASS impossível no tip O7 | Nas **duas** fixtures: `seedCatalogoMvp` + `seedRegrasTransformacaoTz`; após `iniciarCorte`, buscar id `TZ_A`, `POST .../regra`, e `subitemCompleto`/`criarPedido` com `itemComercialId` de **saída** da regra (CB seed Task 2). **Proibido** passar o item da mãe/recebimento sem reconciliar com a regra |

**Ordem canônica (fechada) — ambas as fixtures DoD 7.21b:**
1. `seedCatalogoMvp(db)` + `seedRegrasTransformacaoTz(db)` (Task 2 — garante `TZ_A` e produtos CB/JAC com `legadoItemComercialId`).
2. Cenário pesagem + `iniciarCorte` → `transformacaoId`.
3. SELECT `regras_transformacao.id` WHERE `codigo='TZ_A'` AND `deleted_at IS NULL`.
4. `POST /operacao/corte/:transformacaoId/regra` body `{ regraTransformacaoId }` (cookies `corte` / `CORTE_GERENCIAR`).
5. SELECT `produtos.legado_item_comercial_id` WHERE `codigo='CB'` (saída da Alternativa A).
6. `criarPedido` + `subitemCompleto` com **esse** `itemComercialId` (overbooking de `criarPedido` cobre ausência de saldo virtual do derivado).

---

## Emenda 7 — Gate local bloqueado (Worker tip `34524a4` / branch `feature/onda7-desossa`)

Fecha **todos** os bloqueantes do Gate local `npm run test:cov` após DoD 7.6/7.7/7.9 no tip de implementação, item a item. Ancestral obrigatório: Emenda 6 + Portão 1 aprovado `7aba152` / tip plano mergeado `39156dd` (PR #47) / pin sha256-lf pré-Emenda 7 `56f24730…572b`. Suíte nova `onda7-desossa.spec.ts` **PASS** isolada — **não** alterar produção O7; só helpers/suítes legadas/meta/probe.

| # | Achado (Gate `test:cov` @ `34524a4`) | Fechamento nesta emenda |
|---|---|---|
| 1 | Helpers/suítes legadas chamam `adicionarSubitem`/`subitemCompleto` sem `POST .../regra` e/ou com `itemComercialId` da mãe → 409 `REGRA_TRANSFORMACAO_OBRIGATORIA` / `SAIDA_FORA_DA_REGRA`; concluir sem checklist fechado → 409 `CHECKLIST_DIVERGENTE`; cascata `id` undefined → 500/400 | Task 16 Step A–C: helpers O7-aware (seed+bind `TZ_A` + saída CB/JAC + alinhar pedido + `concluirCorteOnda7`); patches literais nos specs que associam fora de `subitemCompleto` |
| 2 | `corte-branches.spec.ts`: `new CorteService(db, auditoria, emitter)` sem `ChecklistCorteService` | Task 16 Step D: `makeChecklist()` + 4º arg em **todas** as 21 construções |
| 3 | `onda6-migrations-meta.spec.ts`: `filter(idx >= 20)` inclui journal `0023` e quebra `toEqual` até 0022 | Task 16 Step E: filtrar `idx >= 20 && idx <= 22` (escopo O6) |
| 4 | `onda4-migrations.e2e-spec.ts` probe: `divergencias-transformacao.schema.ts` importa `aprovacoes-operacionais` (removido do probe); schema O7 em `transformacoes`/`regras` geraria DDL extra | Task 16 Step F: remover `0023`+divergencias do probe; restaurar fixtures pré-O7; filtrar `index.ts` |
| 5 | (dívida menor) scripts `capture-onda7-*.mjs` untracked sem PNGs — Gate UI ambíguo | Task 16 Step H: Step literal commit+run dos scripts **após** `test:cov` verde; **não** bloqueia Step G |

**Expected PASS após aplicar Emenda 7 sobre tip `34524a4` (ou tip atual de `feature/onda7-desossa`):**

```bash
cd app/backend && npm run test:cov
# Expected: exit 0 — zero FAIL; cobertura ≥80% linha e branch
```

**Proibido:** inventar AD para P6/P12; rótulo `[Mm]arca`; alterar código na branch de plano; “similar à Task” / TBD / TODO.

**Ordem canônica herdada da Emenda 6 (agora nos helpers):**
1. `seedCatalogoMvp` + `seedRegrasTransformacaoTz`
2. `iniciarCorte` → `transformacaoId`
3. `POST /operacao/corte/:id/regra` com `TZ_A`
4. `itemComercialId` de **saída** (`CB` / `JAC` via `legadoItemComercialId`) — **nunca** item da mãe/recebimento sem reconciliar
5. Antes de `concluir` com sucesso: checklist completo **ou** `POST .../divergencia` (DoD 7.9)

---

## Global Constraints

- Constituição: Princípio I (fidelidade absoluta ao protótipo), II (completude E2E), V (gateways/fakes), VIII (não inventar pendência), RA-01..06.
- Regras de negócio só no backend (RA-01); mutações críticas em transação + auditoria (RA-02); hardware via gateways + fake (RA-03); tempo real por eventos pós-commit, **sem poll** (RA-04); sem falha silenciosa / sem inventar peso (RA-05/06).
- Terminologia: zero "Marca" em UI/código (v1.1 §6.8).
- P6 (§16.7 momento da escolha da regra) e P12 (§16.15 outras transformações além do TZ) permanecem abertos → **parâmetro + Badge Provisório**. Proibido gravar AD-xx em `DECISOES.md` nesta onda.
- AD-01 (boi casado 2+2+2) já seedado em desdobramento comercial — fora do badge Provisório; não reabrir.
- Coverage backend ≥80% linha **e** branch nos services tocados; CI 8/8 verde.
- Migrations: expand gerado por drizzle-kit; never ALTER TABLE manual fora da cadeia.

---

## Escopo

| # | Entrega | Matriz |
|---|---|---|
| E7.1 | `GET /desossa/painel?modoTv=` (payload aeroporto + visão por regra) + evento `FALTAS_DESOSSA_ATUALIZADAS` | 17 |
| E7.2 | Dashboard `/desossa/dashboard` fiel ao protótipo, Modo TV, **WS sem poll** | 17 |
| E7.3 | Bind `POST /operacao/corte/:id/regra` com exclusividade por unidade de TZ | 18 |
| E7.4 | `GET /operacao/corte/:id/checklist` (esperado × registrado) | 18 |
| E7.5 | `POST /operacao/corte/:id/divergencia` + tabela `divergencias_transformacao` + fila de aprovações | 18 |
| E7.6 | Gate: gerar subitem exige regra; saídas fora da regra → 409 | 18 |
| E7.7 | UI `/desossa/pesagem-destinacao` fiel (`DesossaPesagem.tsx`) | 18 |
| E7.8 | UI `/desossa/etiquetas` fiel (`DesossaEtiquetas.tsx`) + listagem com peça mãe e `invalidada_por_troca` | 19 |
| E7.9 | Seed idempotente regras A/B provisórias + Badge Provisório (P12) + parâmetro P6 | 18 / dívida O3 |
| E7.10 | RBAC + testes DoD O7 (exclusividade, checklist, divergência, painel TV por eventos) | — |

## Fora de escopo

- Onda 8 (estoque FIFO/ajustes), Onda 9 (carga/expedição UI), Onda 10 (EISS real).
- Produção de bandejas, embalagem, custos, etiquetas de varejo (v1.1 §6.14.5).
- Fechar P6/P12 com AD em `DECISOES.md`.
- Reabrir PR `#38` ou PRs fictícios `#37`–`#41`.
- Alterar contrato Onda 6 de `GET /operacao/etiquetas` que exige `recebimentoId`. Desossa ganha `GET /desossa/etiquetas` que **reusa** a lógica de `EtiquetaService`.
- Refatoração ampla do F4c além do necessário para bind/checklist/divergência.

---

## Rotas da onda (matriz de rastreabilidade v1.1)

| Rota FE | Tela real (alvo) | Protótipo |
|---|---|---|
| `/desossa/dashboard` | `app/frontend/src/app/(admin)/desossa/dashboard/desossa-dashboard-client.tsx` | `src/app/pages/DesossaDashboard.tsx` |
| `/desossa/pesagem-destinacao` | `app/frontend/src/app/(admin)/desossa/pesagem-destinacao/desossa-pesagem-client.tsx` (**criar**) | `src/app/pages/DesossaPesagem.tsx` |
| `/desossa/etiquetas` | `app/frontend/src/app/(admin)/desossa/etiquetas/desossa-etiquetas-client.tsx` (**criar**) | `src/app/pages/DesossaEtiquetas.tsx` |

## Reconciliação matriz → plano (bloqueante Portão 1)

| Linha matriz | Endpoint / entrega no plano | Task |
|---|---|---|
| 17 | `GET /desossa/painel?modoTv=` + evento `FALTAS_DESOSSA_ATUALIZADAS` + UI dashboard/TV sem poll | T3, T7, T8, T11 |
| 18 | `POST /operacao/corte/:id/regra`, `GET .../checklist`, `POST .../divergencia` + UI pesagem + seed A/B | T1–T6, T9, T12 |
| 19 | `GET /desossa/etiquetas` + UI com peça mãe e `invalidada_por_troca` | T10, T13 |
| (dívida O3 seed) | Seed regras A/B em `regras_transformacao` (+ saídas) com `provisorio=true` | T2 |
| (não-escopo) | Linha 36 cadastro regras — CRUD/simulador já existem; O7 só garante seed + badge na operação | — |

## Contrato de rotas — path literal

| Método | Path | Permissão | Notas |
|---|---|---|---|
| `GET` | `/desossa/painel` | `DESOSSA_PAINEL_LER` | Query: `modoTv` (bool), `operacaoId?`. Perfis leitores recebem essa permissão junto com `DESOSSA_LER` (D7.8). |
| `GET` | `/desossa/faltas` | `DESOSSA_LER` | Mantido (compat); painel é a fonte canônica da tela |
| `GET` | `/desossa/etiquetas` | `DESOSSA_LER` | Query: `operacaoId` obrigatório, `transformacaoId?`, `estado?`, `page`, `pageSize` |
| `GET` | `/operacao/corte/pecas-elegiveis` | `RequireQualquerPermissao('DESOSSA_PAINEL_LER', 'DESOSSA_LER', 'CORTE_GERENCIAR')` | Query: `operacaoId`. Fonte única TZs do telão + pesagem (D7.14 Opção A). |
| `POST` | `/operacao/corte/:id/regra` | `CORTE_GERENCIAR` | Body: `{ regraTransformacaoId: uuid }` |
| `GET` | `/operacao/corte/:id/checklist` | `CORTE_GERENCIAR` | Esperado × registrado |
| `POST` | `/operacao/corte/:id/divergencia` | `CORTE_GERENCIAR` | Abre `aprovacoes_operacionais.tipo='divergencia_transformacao'` |
| (F4c existentes) | iniciar / subitens / pesar / associar / concluir | `CORTE_GERENCIAR` | Passam a respeitar regra/checklist |

### Eventos WS (pós-commit, RA-04)

| Constante | String wire | Rooms | Quando |
|---|---|---|---|
| `EVENTOS.FALTAS_DESOSSA_ATUALIZADAS` | `faltas_desossa_atualizadas` | `dashboard`, `desossa`, `operacao:{data}` | Após mutação que altere faltas/painel |
| `EVENTOS.DIVERGENCIA_TRANSFORMACAO_ABERTA` | `divergencia_transformacao_aberta` | `dashboard`, `desossa`, `operacao:{data}` | Após INSERT divergência + aprovação |
| (já existem) | `corte_iniciado`, `subitem_gerado`, `subitem_pesado`, `subitem_associado`, `corte_concluido` | existentes | Dashboard também escuta para refetch |

**Proibido:** `setInterval` / poll HTTP no dashboard ou Modo TV. Reconexão WS chama refetch pontual (`onReconnect`), igual `gestao/dashboard/dashboard-client.tsx`.

---

## Referências do protótipo (`F:\Projetos\alpha-carnes-prototipo` @ `feature/completude-v1.1` `8d32aa4c`)

| Tela app | Arquivo protótipo | Blocos obrigatórios (fidelidade) |
|---|---|---|
| Dashboard | `src/app/pages/DesossaDashboard.tsx` (722 linhas) | Header; KPIs `:452-467` (KPI #3 = «TZs na desossa» `:457`); tabela itens `:508-510` (Rota/Carga, Representante, Alvo); sugestão `:554-600` thead `:563` (**Prior. / Atende / Sobras previstas / Impacto**); tabela **TZs disponíveis** `:600-638` (abre DrawerTZ); drawers Item/Regra/TZ `:128-276`; TVMode `:280-370` com col **CARGA / HORÁRIO** `:306`; copy `:496` |
| Pesagem | `src/app/pages/DesossaPesagem.tsx` (943 linhas) | TZ origem; seletor A/B + Badge Provisório `:575-600`; checklist `:701-739`; `ModalSelecionarTz` `:121-157`; `ModalEtiquetaParte` (Peça mãe) `:160-216`; `ModalCancelarAcao` `:220-279`; `ModalFinalizarTransformacao` `:283+` |
| Etiquetas | `src/app/pages/DesossaEtiquetas.tsx` (742 linhas) | KPIs `:597-610`; filtros Status por rótulo `:623`; tabela 11 cols `:650` (Parte, Origem peso, Cliente/Pedido, Peça mãe); drawer Invalidada por troca `:365-443`; zero mock seed em runtime |

Tokens/cores: reutilizar DS Onda 2. Hex do protótipo só via tokens existentes. Grep de hex avulso nas telas novas = falha do DoD de fidelidade.

---

## Decisões de design (fixadas — só reabrir se houver quebra)

**D7.1 — `transformacoes.regra_transformacao_id` nullable no banco, obrigatória antes de gerar saídas.**
P6 permite escolha na entrada **ou** na saída. Coluna `NULL` ao `iniciar`; enforcement no service antes de `SubitemService.adicionar` → 409 `REGRA_TRANSFORMACAO_OBRIGATORIA`. Sem CHECK SQL `NOT NULL` (quebraria o fluxo "escolher na saída").

**D7.2 — Exclusividade por unidade (v1.1 §6.6).**
`POST /operacao/corte/:id/regra` grava a FK. Troca de regra só com zero subitens ativos. Após 1ª saída → 409 `REGRA_BLOQUEADA_APOS_SAIDA`. `adicionar` só aceita `itemComercialId` presente nas saídas da regra (via `produtos.legado_item_comercial_id`); senão 409 `SAIDA_FORA_DA_REGRA`.

**D7.3 — Checklist = saídas da regra × subitens registrados.**
Para cada `regras_transformacao_saidas`: `esperado = quantidade_fixa`, `registrado = count(subitens ativos do produto/item)`. Status: `pendente | parcial | completo | excedente`. Concluir com checklist divergente **sem** divergência formal aberta → 409 `CHECKLIST_DIVERGENTE`.

**D7.4 — `divergencias_transformacao` + reuso de `aprovacoes_operacionais`.**
Tabela nova (mestre §3.5). Tipos CHECK: `subpeca_faltante | subpeca_excedente | produto_diferente | perda_informada`. Na mesma TX: INSERT divergência + `AprovacoesService.abrirNaTx` com `tipo='divergencia_transformacao'` (já no CHECK Onda 5). Evento `DIVERGENCIA_TRANSFORMACAO_ABERTA` pós-commit.

**D7.5 — P6/P12 sem AD (Princípio VIII).**
- Parâmetro seed `desossa.momento_escolha_regra` = `{ valor: 'ambos', opcoes: ['entrada','saida','ambos'], provisorio: true, pendencia: 'P6' }`.
- Regras A/B seedadas com `provisorio=true`; UI exibe Badge Provisório com `title` citando P12/§16.15.
- Estrutura de regras já genérica (`produto_origem_codigo`); só TZ é seedado (P12).

**D7.6 — Painel vs faltas.**
`GET /desossa/faltas` permanece. `GET /desossa/painel` agrega itens a produzir, sugestões por regra ativa, alertas derivados e contexto de carga (rota/representante/horário alvo); `modoTv=true` omite regras detalhadas e mantém itens+alertas+totais (protótipo `TVMode` lista itens com CARGA/HORÁRIO). Cálculo puro em `painel.calc.ts`. Semântica: tip `quantidadeFaltante` é líquido; projeção UI `faltam = líquido + estoque`, `aProduzir = líquido` (Emenda 2).

**D7.7 — RA-04 no dashboard.**
Remover `setInterval(..., 60_000)` de `desossa-dashboard-client.tsx`. Usar `conectarRealtime` com rooms `['desossa','dashboard']`. Refetch em `faltas_desossa_atualizadas`, eventos de corte e `onReconnect`.

**D7.8 — RBAC telão.**
Nova permissão `DESOSSA_PAINEL_LER`. Atribuída a: `administrador`, `gestor`, `corte`, `comercial`, `diretoria`. Esses perfis também recebem/mantêm `DESOSSA_LER` (matriz: comercial consulta). `@RequirePermissoes('DESOSSA_PAINEL_LER')` no painel.

**D7.9 — Etiquetas desossa sem furar contrato O6.**
`GET /operacao/etiquetas` permanece exigindo `recebimentoId`. Novo `GET /desossa/etiquetas?operacaoId=` lista etiquetas de subitens da operação com `pecaMaeCodigo`, `transformacaoId`, `estado`.

**D7.10 — Emissão de `FALTAS_DESOSSA_ATUALIZADAS`.**
Emitir pós-commit em: `SubitemService.associar`, `CorteService.concluir`, bind de regra. Payload: `{ dataOperacao, motivo: string }`. Painel faz refetch completo (sem patch otimista inventado).

**D7.11 — Migration única expand `0023` (sem contract).**
Onda aditiva: coluna FK + `provisorio`/`codigo` em regras + tabela `divergencias_transformacao`. Seed de regras A/B e parâmetro P6 no `db:seed` (idempotente), não na migration DML.

**D7.12 — Fidelidade: zero seed mock do protótipo no FE.**
Nenhum `ITENS_SEED` / `REGRAS_SEED` / `ETQ_SEED` do protótipo como dado de runtime.

**D7.13 — Listagem de peças elegíveis à desossa (criar endpoint — ausente no tip `94fb341`).**
`corte.controller.ts` hoje não expõe listagem de peças `para_corte`/`em_transformacao` por operação. Task 12 **cria** `GET /operacao/corte/pecas-elegiveis?operacaoId=` com handler+serviço literais: filtra `pecas.status_peca IN ('para_corte','em_transformacao')` da operação (join `recebimentos.operacao_id`), soft-delete nulo, ordenação por `created_at`. Zero contingência. Permissão do GET: ver D7.14 (Emenda 3).

**D7.14 — Fonte de TZs do telão (Opção A — Emenda 3).**
Mesmo endpoint D7.13. Decorador: `@RequireQualquerPermissao('DESOSSA_PAINEL_LER', 'DESOSSA_LER', 'CORTE_GERENCIAR')` (OR). DTO inclui cols da tabela «TZs disponíveis» (`:600-638`). Dashboard e Pesagem compartilham a fonte; leitores do telão nunca tomam 403 por falta de `CORTE_GERENCIAR`. Opção B rejeitada (ver Emenda 3).

---

## Cadeia de migrations — `0023` expand gerado

Estado verificado em `94fb341`: journal idx 22 = `0022_onda6_etiqueta_estado_backfill`. Próximo: **`0023_onda7_desossa_expand`**.

### Delta de schema (fonte do generate)

**`transformacoes.schema.ts`** — adicionar:
```ts
import { regrasTransformacao } from './regras-transformacao.schema';
// no pgTable:
regraTransformacaoId: uuid('regra_transformacao_id').references(() => regrasTransformacao.id),
// indexes:
index('idx_transf_regra').on(t.regraTransformacaoId).where(sql`${t.deletedAt} IS NULL`),
```

**`regras-transformacao.schema.ts`** — adicionar:
```ts
codigo: text('codigo'),
provisorio: boolean('provisorio').notNull().default(false),
// uniqueIndex parcial codigo WHERE deleted_at IS NULL AND codigo IS NOT NULL
```

**Novo `divergencias-transformacao.schema.ts`:**
```ts
export const divergenciasTransformacao = pgTable(
  'divergencias_transformacao',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    transformacaoId: uuid('transformacao_id').notNull().references(() => transformacoes.id),
    tipo: text('tipo').notNull(),
    detalheJson: jsonb('detalhe_json').notNull().default(sql`'{}'::jsonb`),
    aprovacaoId: uuid('aprovacao_id').references(() => aprovacoesOperacionais.id),
    abertoPorId: uuid('aberto_por_id').notNull().references(() => usuarios.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check(
      'chk_diverg_transf_tipo',
      sql`${t.tipo} IN ('subpeca_faltante','subpeca_excedente','produto_diferente','perda_informada')`,
    ),
    index('idx_diverg_transf_transformacao').on(t.transformacaoId).where(sql`${t.deletedAt} IS NULL`),
  ],
);
```

### Proveniência (gate)

```bash
cd app/backend
npx drizzle-kit generate --name=onda7_desossa_expand
# Esperado: 0023_onda7_desossa_expand.sql + meta/0023_snapshot.json + journal idx 23
# Proibido: editar meta/_journal.json à mão; editar snapshot; CREATE/ALTER manual fora do generate
```

### Rollback

Onda aditiva. Emergência: `DROP TABLE divergencias_transformacao;` + drop das colunas novas. Sem estágio contract.

---

## Estrutura de arquivos

**Criar (backend):**
- `app/backend/src/database/schema/divergencias-transformacao.schema.ts`
- `app/backend/src/database/migrations/0023_onda7_desossa_expand.sql` (+ meta)
- `app/backend/src/database/seed-regras-transformacao-tz.ts`
- `app/backend/src/modules/operacao/desossa/painel.calc.ts`
- `app/backend/src/modules/operacao/desossa/painel.service.ts`
- `app/backend/src/modules/operacao/desossa/etiquetas-desossa.service.ts`
- `app/backend/src/modules/operacao/desossa/dto/painel.dto.ts`
- `app/backend/src/modules/operacao/corte/regra-corte.service.ts`
- `app/backend/src/modules/operacao/corte/checklist-corte.service.ts`
- `app/backend/src/modules/operacao/corte/dto/regra-corte.dto.ts`
- `app/backend/src/modules/operacao/corte/dto/divergencia-transformacao.dto.ts`
- `app/backend/src/modules/operacao/corte/pecas-elegiveis.service.ts`
- `app/backend/src/modules/operacao/corte/dto/pecas-elegiveis.dto.ts`
- `app/backend/test/unit/onda7-migration-0023.spec.ts`
- `app/backend/test/unit/painel.calc.spec.ts`
- `app/backend/test/unit/checklist-corte.service.spec.ts`
- `app/backend/test/unit/regra-corte.service.spec.ts`
- `app/backend/test/unit/seed-regras-transformacao-tz.spec.ts`
- `app/backend/test/unit/divergencia-transformacao.dto.spec.ts`
- `app/backend/test/unit/rooms-da-data.spec.ts`
- `app/backend/test/integration/onda7-desossa.spec.ts`

**Modificar (backend):**
- `transformacoes.schema.ts`, `regras-transformacao.schema.ts`, `schema/index.ts`
- `database/seed.ts`
- `common/rbac/permissoes.ts`, `perfil-permissoes.snapshot.json`
- `realtime/events/eventos.ts`, `realtime/realtime.gateway.ts`
- `desossa.controller.ts`, `desossa.module.ts`
- `corte.controller.ts`, `corte.module.ts`, `corte.service.ts`, `subitem.service.ts`

**Criar (frontend):**
- `desossa/pesagem-destinacao/desossa-pesagem-client.tsx`
- `desossa/etiquetas/desossa-etiquetas-client.tsx`
- `app/api/desossa/painel/route.ts`, `app/api/desossa/etiquetas/route.ts`
- `app/api/operacao/corte/pecas-elegiveis/route.ts`
- `app/api/operacao/corte/[id]/regra/route.ts`, `.../checklist/route.ts`, `.../divergencia/route.ts`
- `e2e/onda7-desossa.spec.ts`
- `scripts/capture-onda7-app.mjs`, `scripts/capture-onda7-prototipo.mjs`
- `docs/evidencias/onda7-desossa/README.md`

**Modificar (frontend):**
- `desossa/dashboard/desossa-dashboard-client.tsx` — WS, fidelidade, Modo TV
- `desossa/dashboard/page.tsx` — gate `DESOSSA_PAINEL_LER`
- `desossa/pesagem-destinacao/page.tsx`, `desossa/etiquetas/page.tsx` — sair de PlaceholderPage
- `lib/desossa.ts` — tipos painel/checklist/divergência/etiquetas

---

## Arquivos de teste (ação por arquivo)

| Arquivo | Prova |
|---|---|
| `test/unit/onda7-migration-0023.spec.ts` | SQL 0023 + journal idx 23 |
| `test/unit/seed-regras-transformacao-tz.spec.ts` | Seed A/B idempotente + provisorio |
| `test/unit/painel.calc.spec.ts` | Shape painel + modoTv + sugestão por regra |
| `test/unit/regra-corte.service.spec.ts` | Bind; bloqueio troca; 409 sem regra |
| `test/unit/checklist-corte.service.spec.ts` | esperado×registrado; A bloqueia B |
| `test/unit/divergencia-transformacao.dto.spec.ts` | DoD 7.11 — tipo inválido → Zod 400 |
| `test/unit/rooms-da-data.spec.ts` | `roomsDaData` inclui `desossa` |
| `test/integration/onda7-desossa.spec.ts` | Fluxo API completo + WS emit + RBAC 403 |
| `e2e/onda7-desossa.spec.ts` | 3 rotas + Modo TV + Badge Provisório |
| `docs/evidencias/onda7-desossa/` | Screenshots app×protótipo |

---

## Mapa DoD → teste (1:1)

| DoD | Critério verificável | Teste |
|---|---|---|
| 7.1 | Migration `0023` gerada por drizzle-kit; journal idx 23 | `onda7-migration-0023.spec.ts` |
| 7.2 | `regra_transformacao_id` aceita NULL no iniciar | integration: iniciar sem regra → 201 |
| 7.3 | Seed cria `TZ_A`/`TZ_B` com saídas CB+JAC e CBA+FC; `provisorio=true` | seed spec |
| 7.4 | Parâmetro `desossa.momento_escolha_regra` com `provisorio: true` (P6) | seed spec |
| 7.5 | Bind regra; troca com subitem → 409 `REGRA_BLOQUEADA_APOS_SAIDA` | `regra-corte.service.spec` |
| 7.6 | `adicionar` sem regra → 409 `REGRA_TRANSFORMACAO_OBRIGATORIA` | integration |
| 7.7 | Regra A + item da B → 409 `SAIDA_FORA_DA_REGRA` | checklist/regra spec (**quality-gates O7**) |
| 7.8 | `GET .../checklist` devolve slots esperados | checklist spec |
| 7.9 | Concluir divergente sem divergência → 409 `CHECKLIST_DIVERGENTE` | integration |
| 7.10 | `POST .../divergencia` cria linha + aprovação na mesma TX; evento emitido | integration |
| 7.11 | Tipo de divergência inválido → 400 Zod | `divergencia-transformacao.dto.spec.ts` |
| 7.12 | `GET /desossa/painel` itens+regras+alertas; `modoTv=true` enxuto | painel + integration |
| 7.13 | `faltas_desossa_atualizadas` após associar; **não** emitido em rollback | integration spy |
| 7.14 | Sem `DESOSSA_PAINEL_LER` → 403 painel; sem `CORTE_GERENCIAR` → 403 bind | integration RBAC |
| 7.14b | `GET /operacao/corte/pecas-elegiveis` com perfil `comercial` (`DESOSSA_PAINEL_LER`, sem `CORTE_GERENCIAR`) → **200** (D7.14 Opção A); sem nenhuma das 3 perms → 403 | integration RBAC |
| 7.15 | `comercial` tem `DESOSSA_LER` + `DESOSSA_PAINEL_LER` no snapshot | snapshot/seed |
| 7.16 | `rg setInterval` em `desossa/dashboard/**` = 0 | script/e2e gate |
| 7.17 | Dashboard usa `conectarRealtime` e refetch no evento | e2e/RTL |
| 7.18 | UI pesagem exibe Badge Provisório nas regras A/B | e2e |
| 7.19 | UI bloqueia troca de regra após 1ª saída | e2e + integration |
| 7.20 | Pesagem e etiquetas ≠ PlaceholderPage | e2e |
| 7.21 | Etiquetas listam `pecaMaeCodigo` e estado `invalidada_por_troca` | integration + e2e |
| 7.21b | `bloqueada=true` quando `carga_itens.subitem_id` em caminhão `STATUS_CAMINHAO_FECHADO` (mãe fora da carga); `bloqueada=false` se só mãe `em_transformacao` sem subitem na carga — falha se EXISTS usar `ci.peca_id` ou copiar `etiquetaBloqueadaSql` | integration (`onda7-desossa.spec.ts`) |
| 7.22 | Screenshots 3 rotas + Modo TV em `docs/evidencias/onda7-desossa/` | artefato PR |
| 7.23 | Cobertura ≥80% linha e branch nos services tocados | `npm run test:cov` |
| 7.24 | Zero rótulo `Marca` nas telas da onda | grep |
| 7.25 | Nenhum AD novo em `DECISOES.md` | diff vazio |
| 7.26 | Gate local `test:cov` verde com DoD 7.6/7.7/7.9: helpers O7-aware + suítes legadas + `corte-branches` DI + meta O6 idx≤22 + probe O4 sem `divergencias-transformacao` | Task 16 (`npm run test:cov`) |

---

## Tasks

### Task 1 — Schema declarativo + migration `0023`

**Files:**
- Modify: `app/backend/src/database/schema/transformacoes.schema.ts`
- Modify: `app/backend/src/database/schema/regras-transformacao.schema.ts`
- Create: `app/backend/src/database/schema/divergencias-transformacao.schema.ts`
- Modify: `app/backend/src/database/schema/index.ts`
- Generate: `0023_onda7_desossa_expand.sql` + meta

**Interfaces:** Produz colunas/tabelas D7.1/D7.4/D7.11 para Tasks 2–6.

- [ ] **Step 1: Escrever teste de proveniência (falha sem migration)**

```ts
// test/unit/onda7-migration-0023.spec.ts
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('migration 0023 onda7', () => {
  const root = path.join(__dirname, '../../src/database/migrations');
  it('existe SQL 0023 e entrada no journal', () => {
    const sql = fs.readdirSync(root).find((f) => f.startsWith('0023_') && f.endsWith('.sql'));
    expect(sql).toBeTruthy();
    const journal = JSON.parse(
      fs.readFileSync(path.join(root, 'meta/_journal.json'), 'utf8'),
    ) as { entries: { idx: number; tag: string }[] };
    const e = journal.entries.find((x) => x.idx === 23);
    expect(e?.tag).toMatch(/onda7_desossa/);
  });
});
```

- [ ] **Step 2: Rodar e ver falha**

```bash
cd app/backend && npx jest test/unit/onda7-migration-0023.spec.ts -v
# Expected: FAIL — 0023 não existe
```

- [ ] **Step 3: Alterar schemas** conforme seção "Cadeia de migrations". Exportar em `schema/index.ts`:

```ts
export * from './divergencias-transformacao.schema';
```

- [ ] **Step 4: Gerar migration**

```bash
cd app/backend && npx drizzle-kit generate --name=onda7_desossa_expand
# Expected: 0023_*.sql com ALTER transformacoes, ALTER regras_transformacao, CREATE divergencias_transformacao
```

- [ ] **Step 5: Teste PASS + migrate**

```bash
npx jest test/unit/onda7-migration-0023.spec.ts -v
npm run db:migrate
# Expected: PASS
```

- [ ] **Step 6: Commit**

```bash
git add app/backend/src/database/schema app/backend/src/database/migrations app/backend/test/unit/onda7-migration-0023.spec.ts
git commit -m "$(cat <<'EOF'
feat(onda7): schema e migration 0023 de desossa/transformação

### Descrição Detalhada:
Adiciona regra_transformacao_id, flags provisorio/codigo e tabela divergencias_transformacao.

### Motivo da Mudança:
Base estrutural do bind de regra, checklist e divergência formal (Onda 7).
EOF
)"
```

---

### Task 2 — Seed regras A/B + parâmetro P6

**Files:**
- Create: `app/backend/src/database/seed-regras-transformacao-tz.ts`
- Modify: `app/backend/src/database/seed.ts`
- Test: `app/backend/test/unit/seed-regras-transformacao-tz.spec.ts`

**Interfaces:** `seedRegrasTransformacaoTz(db)` idempotente; consome produtos `CB`, `JAC`, `CBA`, `FC`.

- [ ] **Step 1: Teste falhando**

```ts
describe('seedRegrasTransformacaoTz', () => {
  it('cria TZ_A (CB+JAC) e TZ_B (CBA+FC) com provisorio=true', async () => {
    await seedCatalogoMvp(db);
    await seedRegrasTransformacaoTz(db);
    await seedRegrasTransformacaoTz(db); // idempotente
    const regras = await db.select().from(regrasTransformacao).where(isNull(regrasTransformacao.deletedAt));
    const ativas = regras.filter((r) => r.codigo === 'TZ_A' || r.codigo === 'TZ_B');
    expect(ativas).toHaveLength(2);
    expect(ativas.every((r) => r.provisorio === true)).toBe(true);
  });
});
```

- [ ] **Step 2: Implementar seed**

```ts
// seed-regras-transformacao-tz.ts
export async function seedRegrasTransformacaoTz(db: NodePgDatabase<typeof schema>) {
  const byCodigo = async (codigo: string) => {
    const [p] = await db.select().from(produtos)
      .where(and(eq(produtos.codigo, codigo), isNull(produtos.deletedAt))).limit(1);
    if (!p) throw new Error(`Produto ${codigo} ausente — rode seed catálogo MVP antes`);
    return p;
  };
  const cb = await byCodigo('CB');
  const jac = await byCodigo('JAC');
  const cba = await byCodigo('CBA');
  const fc = await byCodigo('FC');

  async function upsertRegra(
    codigo: string,
    nome: string,
    saidas: { produtoId: string; qtd: string }[],
  ) {
    const [existente] = await db.select().from(regrasTransformacao)
      .where(and(eq(regrasTransformacao.codigo, codigo), isNull(regrasTransformacao.deletedAt)))
      .limit(1);
    let regraId = existente?.id;
    if (!regraId) {
      const [criada] = await db.insert(regrasTransformacao).values({
        codigo,
        nome,
        produtoOrigemCodigo: 'TZ',
        status: 'ativo',
        prioridade: codigo === 'TZ_A' ? 1 : 2, // Emenda 3 — 1=Alta/Recomendada, 2=Média/Útil
        provisorio: true,
        observacao: 'Regra provisória v1.1 §6.6 / P12 — validar com cliente',
      }).returning();
      regraId = criada.id;
    } else {
      await db.update(regrasTransformacao)
        .set({ provisorio: true, nome, updatedAt: new Date() })
        .where(eq(regrasTransformacao.id, regraId));
    }
    await db.delete(regrasTransformacaoSaidas).where(eq(regrasTransformacaoSaidas.regraId, regraId));
    await db.insert(regrasTransformacaoSaidas).values(
      saidas.map((s) => ({ regraId: regraId!, produtoId: s.produtoId, quantidadeFixa: s.qtd })),
    );
  }

  await upsertRegra('TZ_A', 'Alternativa A — TZ → Coxão-bola + Jacaré', [
    { produtoId: cb.id, qtd: '1' },
    { produtoId: jac.id, qtd: '1' },
  ]);
  await upsertRegra('TZ_B', 'Alternativa B — TZ → Coxão-bola c/ alcatra + Filé curto', [
    { produtoId: cba.id, qtd: '1' },
    { produtoId: fc.id, qtd: '1' },
  ]);
}
```

Em `seed.ts`, após catálogo MVP, adicionar parâmetro P6 e chamar o seed:

```ts
{
  chave: 'desossa.momento_escolha_regra',
  descricao: 'Momento da escolha da regra de transformação na desossa',
  valor: {
    valor: 'ambos',
    opcoes: ['entrada', 'saida', 'ambos'],
    provisorio: true,
    pendencia: 'P6',
    titulo: 'Momento da escolha da regra (P6)',
    detalhe:
      'v1.1 §16.7 — escolha na entrada ou confirmação na saída; obrigatória antes de gerar produtos.',
  },
},
// ...
await seedRegrasTransformacaoTz(db);
```

- [ ] **Step 3: PASS + commit**

```bash
npx jest test/unit/seed-regras-transformacao-tz.spec.ts -v
# Expected: PASS
```

```bash
git commit -m "$(cat <<'EOF'
feat(onda7): seed regras TZ A/B provisórias e parâmetro P6

### Descrição Detalhada:
Semeia Alternativas A/B com badge Provisório e parâmetro desossa.momento_escolha_regra.

### Motivo da Mudança:
P12/P6 abertos — avançar com parâmetro + badge, sem inventar AD.
EOF
)"
```

---

### Task 3 — RBAC `DESOSSA_PAINEL_LER` + eventos WS (hub nativo)

**Files:**
- Modify: `app/backend/src/common/rbac/permissoes.ts`
- Modify: `app/backend/src/common/rbac/perfil-permissoes.snapshot.json`
- Modify: `app/backend/src/realtime/events/eventos.ts`
- Modify: `app/backend/src/realtime/realtime.gateway.ts`
- Modify: `app/frontend/src/app/(admin)/desossa/dashboard/page.tsx`
- Create: `app/backend/test/unit/rooms-da-data.spec.ts`

**Âncoras tip `94fb341`:** `realtime.gateway.ts` — `this.server` é `http.Server` (ws nativo); broadcast real = `private broadcast` → `this.hub.broadcast(room, evento, payload)` via `roomsDaData`. **Proibido** Socket.IO (`this.server.to().emit`).

- [ ] **Step 1: Declaração canônica + mapa de perfis**

```ts
// permissoes.ts — em PERMISSOES (após DESOSSA_GERENCIAR):
DESOSSA_PAINEL_LER: 'DESOSSA_PAINEL_LER',

// em DESCRICOES_PERMISSOES:
DESOSSA_PAINEL_LER: 'Consultar painel aeroporto/Modo TV da desossa (telão)',

// pushPermissoes — bloco Onda 7 (após pushes existentes de SIF/APROVACOES):
pushPermissoes(
  'administrador',
  'DESOSSA_PAINEL_LER',
);
pushPermissoes(
  'gestor',
  'DESOSSA_PAINEL_LER',
);
pushPermissoes(
  'corte',
  'DESOSSA_PAINEL_LER',
);
// comercial e diretoria NÃO têm DESOSSA_LER hoje (tip 94fb341) — conceder ambos:
pushPermissoes(
  'comercial',
  'DESOSSA_LER',
  'DESOSSA_PAINEL_LER',
);
pushPermissoes(
  'diretoria',
  'DESOSSA_LER',
  'DESOSSA_PAINEL_LER',
);
```

Regenerar/atualizar `perfil-permissoes.snapshot.json` pelo fluxo já usado nas ondas anteriores (teste de snapshot deve PASS).

- [ ] **Step 2: Eventos + roomsDaData com room canônica `desossa`**

```ts
// eventos.ts — em EVENTOS (após bloco Onda 6):
FALTAS_DESOSSA_ATUALIZADAS: 'faltas_desossa_atualizadas',
DIVERGENCIA_TRANSFORMACAO_ABERTA: 'divergencia_transformacao_aberta',

// roomsDaData — estender literalmente:
export function roomsDaData(dataOperacao: string): string[] {
  return ['dashboard', 'desossa', `operacao:${dataOperacao}`];
}

// payloads tipados:
export interface FaltasDesossaAtualizadasPayload {
  dataOperacao: string;
  motivo: string;
}

export interface DivergenciaTransformacaoAbertaPayload {
  dataOperacao: string;
  transformacaoId: string;
  divergenciaId: string;
  aprovacaoId: string;
  tipo: string;
}
```

```ts
// test/unit/rooms-da-data.spec.ts
import { roomsDaData } from '../../src/realtime/events/eventos';

describe('roomsDaData', () => {
  it('inclui dashboard, desossa e operacao:{data}', () => {
    expect(roomsDaData('2026-07-31')).toEqual([
      'dashboard',
      'desossa',
      'operacao:2026-07-31',
    ]);
  });
});
```

- [ ] **Step 3: Handlers no gateway — padrão hub nativo (sem Socket.IO)**

```ts
// realtime.gateway.ts — imports: adicionar FaltasDesossaAtualizadasPayload, DivergenciaTransformacaoAbertaPayload

@OnEvent(EVENTOS.FALTAS_DESOSSA_ATUALIZADAS)
handleFaltasDesossaAtualizadas(payload: FaltasDesossaAtualizadasPayload): void {
  this.broadcast(EVENTOS.FALTAS_DESOSSA_ATUALIZADAS, payload, payload.dataOperacao);
}

@OnEvent(EVENTOS.DIVERGENCIA_TRANSFORMACAO_ABERTA)
handleDivergenciaTransformacaoAberta(payload: DivergenciaTransformacaoAbertaPayload): void {
  this.broadcast(EVENTOS.DIVERGENCIA_TRANSFORMACAO_ABERTA, payload, payload.dataOperacao);
}

// private broadcast permanece o existente (tip 94fb341 L339-347):
// for (const room of roomsDaData(dataOperacao)) this.hub.broadcast(room, evento, payload);
```

- [ ] **Step 4: Page dashboard considera `DESOSSA_PAINEL_LER`**

```tsx
// app/frontend/src/app/(admin)/desossa/dashboard/page.tsx
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { DesossaDashboardClient } from './desossa-dashboard-client';

export default async function DesossaDashboardPage() {
  const user = await getMe();
  if (!user) redirect('/login');

  const podeVer =
    user.permissoes.includes('DESOSSA_PAINEL_LER') ||
    user.permissoes.includes('DESOSSA_LER') ||
    user.permissoes.includes('CORTE_GERENCIAR');

  if (!podeVer) {
    return (
      <p className="text-sm text-destructive">
        Você não tem permissão para visualizar o dashboard da desossa.
      </p>
    );
  }

  return <DesossaDashboardClient />;
}
```

- [ ] **Step 5: Testes (rooms + snapshot RBAC) + commit**

```bash
cd app/backend && npx jest test/unit/rooms-da-data.spec.ts -v
# Expected: PASS — roomsDaData = ['dashboard','desossa','operacao:2026-07-31']
```

```bash
cd app/backend && npx jest test/unit/perfil-permissoes-snapshot.spec.ts -v
# Expected: PASS — 2 testes
# Expected: snapshot['comercial'] inclui 'DESOSSA_LER' e 'DESOSSA_PAINEL_LER' (ordenados)
# Expected: snapshot['diretoria'] inclui 'DESOSSA_LER' e 'DESOSSA_PAINEL_LER' (ordenados)
# Falha típica se esquecer regenerar perfil-permissoes.snapshot.json após pushPermissoes
```

```bash
# Prova explícita (opcional, após regenerar snapshot):
node -e "const s=require('./src/common/rbac/perfil-permissoes.snapshot.json'); for (const p of ['comercial','diretoria']) { if (!s[p].includes('DESOSSA_LER')||!s[p].includes('DESOSSA_PAINEL_LER')) { console.error('FAIL',p); process.exit(1);} } console.log('OK comercial+diretoria DESOSSA_LER+DESOSSA_PAINEL_LER');"
# Expected: OK comercial+diretoria DESOSSA_LER+DESOSSA_PAINEL_LER
```

```bash
git commit -m "$(cat <<'EOF'
feat(onda7): RBAC do painel TV e eventos WS nativos da desossa

### Descrição Detalhada:
Adiciona DESOSSA_PAINEL_LER, concede DESOSSA_* a comercial/diretoria, estende roomsDaData com room desossa e handlers via RealtimeHub.

### Motivo da Mudança:
Portão 1 — eliminar Socket.IO e fechar lacuna RBAC do telão.
EOF
)"
```

---

### Task 4 — `RegraCorteService` + `POST /operacao/corte/:id/regra`

**Files:**
- Create: `regra-corte.service.ts`, `dto/regra-corte.dto.ts`
- Modify: `corte.controller.ts`, `corte.module.ts`
- Test: `test/unit/regra-corte.service.spec.ts`

**Interfaces:**
```ts
export const vincularRegraSchema = z.object({
  regraTransformacaoId: z.string().uuid(),
});
export type VincularRegraDto = z.infer<typeof vincularRegraSchema>;
```

- [ ] **Step 1: Testes (assertam `codigo`, não `message`/`code`)**

```ts
it('vincula regra A em transformação aberta', async () => {
  const out = await svc.vincular(id, { regraTransformacaoId: regraA }, op);
  expect(out.regraTransformacaoId).toBe(regraA);
});

it('bloqueia troca após subitem ativo', async () => {
  await expect(svc.vincular(id, { regraTransformacaoId: regraB }, op)).rejects.toMatchObject({
    response: {
      codigo: 'REGRA_BLOQUEADA_APOS_SAIDA',
      mensagem: expect.stringMatching(/primeira saída/i),
    },
  });
});

it('rejeita regra inativa/inexistente', async () => {
  await expect(svc.vincular(id, { regraTransformacaoId: uuidInexistente }, op))
    .rejects.toBeInstanceOf(NotFoundException);
});
```

- [ ] **Step 2: Implementação (conflitos com `codigo`/`mensagem`)**

```ts
@Injectable()
export class RegraCorteService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly auditoria: AuditoriaService,
    private readonly events: EventEmitter2,
  ) {}

  async vincular(transformacaoId: string, dto: VincularRegraDto, operadorId: string) {
    const row = await this.db.transaction(async (tx) => {
      const [transf] = await tx.select().from(transformacoes)
        .where(and(eq(transformacoes.id, transformacaoId), isNull(transformacoes.deletedAt)))
        .for('update');
      if (!transf) throw new NotFoundException('Transformação não encontrada');
      if (['concluida', 'cancelada'].includes(transf.statusTransformacao)) {
        throw new ConflictException({
          codigo: 'TRANSFORMACAO_FECHADA',
          mensagem: 'Transformação fechada não aceita vínculo de regra',
        });
      }
      const [regra] = await tx.select().from(regrasTransformacao).where(and(
        eq(regrasTransformacao.id, dto.regraTransformacaoId),
        eq(regrasTransformacao.status, 'ativo'),
        isNull(regrasTransformacao.deletedAt),
      ));
      if (!regra) throw new NotFoundException('Regra não encontrada');
      if (regra.produtoOrigemCodigo !== 'TZ') {
        throw new ConflictException({
          codigo: 'REGRA_ORIGEM_NAO_SUPORTADA_MVP',
          mensagem: 'Somente regras com origem TZ são aceitas nesta versão',
        });
      }
      const [{ c }] = await tx.select({ c: sql<number>`count(*)::int` }).from(subitens)
        .where(and(eq(subitens.transformacaoId, transformacaoId), isNull(subitens.deletedAt)));
      if (
        c > 0 &&
        transf.regraTransformacaoId &&
        transf.regraTransformacaoId !== dto.regraTransformacaoId
      ) {
        throw new ConflictException({
          codigo: 'REGRA_BLOQUEADA_APOS_SAIDA',
          mensagem: 'A regra não pode ser alterada após registrar a primeira saída',
        });
      }
      const [upd] = await tx.update(transformacoes)
        .set({ regraTransformacaoId: dto.regraTransformacaoId, updatedAt: new Date() })
        .where(eq(transformacoes.id, transformacaoId))
        .returning();
      await this.auditoria.registrar(tx, {
        tabela: 'transformacoes',
        registroId: transformacaoId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: transf,
        dadosNovos: upd,
      });
      const dataOperacao = await this.dataOperacaoPorPeca(tx, transf.pecaOrigemId);
      return { upd, dataOperacao };
    });
    this.events.emit(EVENTOS.FALTAS_DESOSSA_ATUALIZADAS, {
      dataOperacao: row.dataOperacao,
      motivo: 'regra_vinculada',
    });
    return row.upd;
  }

  private async dataOperacaoPorPeca(tx: Tx, pecaId: string): Promise<string> {
    const [r] = await tx
      .select({ data: operacoes.data })
      .from(pecas)
      .innerJoin(recebimentos, eq(recebimentos.id, pecas.recebimentoId))
      .innerJoin(operacoes, eq(operacoes.id, recebimentos.operacaoId))
      .where(eq(pecas.id, pecaId))
      .limit(1);
    return r?.data ?? '';
  }
}
```

```ts
@Post(':id/regra')
@RequirePermissoes('CORTE_GERENCIAR')
vincularRegra(
  @Param('id') id: string,
  @Body(new ZodValidationPipe(vincularRegraSchema)) dto: VincularRegraDto,
  @CurrentUser() user: CurrentUserPayload,
) {
  return this.regraCorte.vincular(id, dto, user.sub);
}
```

- [ ] **Step 3: PASS + commit** `feat(onda7): bind de regra de transformação no corte`

---

### Task 5 — Enforcement em `SubitemService.adicionar`

**Files:** Modify `subitem.service.ts`; testes integration/unit.

- [ ] **Step 1: Testes 7.6 e 7.7**

```ts
it('409 REGRA_TRANSFORMACAO_OBRIGATORIA sem regra', async () => {
  const err = await svc.adicionar(transfId, dto, op).catch((e) => e);
  expect(err.getResponse()).toMatchObject({
    codigo: 'REGRA_TRANSFORMACAO_OBRIGATORIA',
  });
});

it('409 SAIDA_FORA_DA_REGRA quando item é da alternativa B com regra A', async () => {
  const err = await svc.adicionar(transfId, { itemComercialId: itemDaB }, op).catch((e) => e);
  expect(err.getResponse()).toMatchObject({ codigo: 'SAIDA_FORA_DA_REGRA' });
});

it('permite saídas da regra A (CB e JAC)', async () => {
  await expect(svc.adicionar(transfId, { itemComercialId: itemCb }, op)).resolves.toBeTruthy();
});
```

- [ ] **Step 2: Guard no início de `adicionar` (dentro da TX)**

```ts
if (!transf.regraTransformacaoId) {
  throw new ConflictException({
    codigo: 'REGRA_TRANSFORMACAO_OBRIGATORIA',
    mensagem: 'Defina a regra de transformação antes de gerar produtos',
  });
}
const saidas = await tx.select({
  legado: produtos.legadoItemComercialId,
}).from(regrasTransformacaoSaidas)
  .innerJoin(produtos, eq(produtos.id, regrasTransformacaoSaidas.produtoId))
  .where(eq(regrasTransformacaoSaidas.regraId, transf.regraTransformacaoId));
const permitido = new Set(saidas.map((s) => s.legado).filter(Boolean) as string[]);
if (!permitido.has(dto.itemComercialId)) {
  throw new ConflictException({
    codigo: 'SAIDA_FORA_DA_REGRA',
    mensagem: 'Produto incompatível com a regra escolhida para este TZ',
  });
}
```

- [ ] **Step 3: Commit** `feat(onda7): exclusividade de saídas por regra no corte`

---

### Task 6 — Checklist + divergência formal + gate no concluir

**Files:**
- Create: `checklist-corte.service.ts`, `dto/divergencia-transformacao.dto.ts`
- Modify: `corte.service.ts`, `corte.controller.ts`, `corte.module.ts` (import `AprovacoesModule`)
- Create: `test/unit/divergencia-transformacao.dto.spec.ts` (DoD 7.11)
- Create/Modify: `test/unit/checklist-corte.service.spec.ts`

**Interfaces:**
```ts
export const abrirDivergenciaTransformacaoSchema = z.object({
  tipo: z.enum([
    'subpeca_faltante',
    'subpeca_excedente',
    'produto_diferente',
    'perda_informada',
  ]),
  detalhe: z.record(z.string(), z.unknown()).default({}),
  observacao: z.string().trim().min(3).max(1000).optional(),
});
export type AbrirDivergenciaTransformacaoDto = z.infer<typeof abrirDivergenciaTransformacaoSchema>;

export type ChecklistSlot = {
  produtoId: string;
  produtoCodigo: string;
  produtoNome: string;
  esperado: number;
  registrado: number;
  status: 'pendente' | 'parcial' | 'completo' | 'excedente';
};

export type ChecklistResponse = {
  transformacaoId: string;
  regraTransformacaoId: string | null;
  regraNome: string | null;
  regraProvisoria: boolean;
  slots: ChecklistSlot[];
  divergente: boolean;
  divergenciaAbertaId: string | null;
};
```

- [ ] **Step 1: DoD 7.11 — teste unit do DTO (tipo inválido)**

```ts
// test/unit/divergencia-transformacao.dto.spec.ts
import { abrirDivergenciaTransformacaoSchema } from '../../src/modules/operacao/corte/dto/divergencia-transformacao.dto';

describe('abrirDivergenciaTransformacaoSchema', () => {
  it('rejeita tipo inválido', () => {
    const r = abrirDivergenciaTransformacaoSchema.safeParse({
      tipo: 'tipo_inventado',
      detalhe: {},
    });
    expect(r.success).toBe(false);
  });

  it('aceita subpeca_faltante com detalhe', () => {
    const r = abrirDivergenciaTransformacaoSchema.safeParse({
      tipo: 'subpeca_faltante',
      detalhe: { slot: 'JAC' },
      observacao: 'Jacaré não saiu da peça',
    });
    expect(r.success).toBe(true);
  });
});
```

```bash
cd app/backend && npx jest test/unit/divergencia-transformacao.dto.spec.ts -v
# Expected: FAIL até o schema existir; depois PASS
```

- [ ] **Step 2: Testes 7.8–7.10**

```ts
it('checklist A espera CB=1 e JAC=1', async () => {
  const c = await svc.obter(transfId);
  expect(c.slots.map((s) => s.produtoCodigo).sort()).toEqual(['CB', 'JAC']);
  expect(c.slots.every((s) => s.esperado === 1)).toBe(true);
});

it('concluir divergente sem divergência → 409 CHECKLIST_DIVERGENTE', async () => {
  const err = await corte.concluir(transfId, op).catch((e) => e);
  expect(err.getResponse()).toMatchObject({ codigo: 'CHECKLIST_DIVERGENTE' });
});

it('abrir divergência cria aprovação na mesma TX', async () => {
  const d = await svc.abrirDivergencia(
    transfId,
    { tipo: 'subpeca_faltante', detalhe: { slot: 'JAC' }, observacao: 'Falta jacaré na peça' },
    op,
  );
  const [ap] = await db.select().from(aprovacoesOperacionais)
    .where(eq(aprovacoesOperacionais.id, d.aprovacaoId));
  expect(ap.tipo).toBe('divergencia_transformacao');
  expect(ap.operacaoId).toBeTruthy();
  expect(ap.descricao.length).toBeGreaterThanOrEqual(10);
  expect(ap.impacto.length).toBeGreaterThanOrEqual(5);
});
```

- [ ] **Step 3: `ChecklistCorteService.obter` completo**

```ts
@Injectable()
export class ChecklistCorteService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly aprovacoes: AprovacoesService,
    private readonly auditoria: AuditoriaService,
    private readonly events: EventEmitter2,
  ) {}

  async obter(transformacaoId: string): Promise<ChecklistResponse> {
    return this.db.transaction((tx) => this.obterNaTx(tx, transformacaoId));
  }

  async obterNaTx(tx: Tx, transformacaoId: string): Promise<ChecklistResponse> {
    const [transf] = await tx.select().from(transformacoes)
      .where(and(eq(transformacoes.id, transformacaoId), isNull(transformacoes.deletedAt)));
    if (!transf) throw new NotFoundException('Transformação não encontrada');

    let regraNome: string | null = null;
    let regraProvisoria = false;
    const slots: ChecklistSlot[] = [];

    if (transf.regraTransformacaoId) {
      const [regra] = await tx.select().from(regrasTransformacao)
        .where(eq(regrasTransformacao.id, transf.regraTransformacaoId));
      regraNome = regra?.nome ?? null;
      regraProvisoria = regra?.provisorio ?? false;

      const saidas = await tx
        .select({
          produtoId: produtos.id,
          produtoCodigo: produtos.codigo,
          produtoNome: produtos.nome,
          esperado: regrasTransformacaoSaidas.quantidadeFixa,
          legado: produtos.legadoItemComercialId,
        })
        .from(regrasTransformacaoSaidas)
        .innerJoin(produtos, eq(produtos.id, regrasTransformacaoSaidas.produtoId))
        .where(eq(regrasTransformacaoSaidas.regraId, transf.regraTransformacaoId));

      const ativos = await tx.select({
        itemComercialId: subitens.itemComercialId,
      }).from(subitens).where(and(
        eq(subitens.transformacaoId, transformacaoId),
        isNull(subitens.deletedAt),
      ));

      const contagem = new Map<string, number>();
      for (const s of ativos) {
        contagem.set(s.itemComercialId, (contagem.get(s.itemComercialId) ?? 0) + 1);
      }

      for (const s of saidas) {
        const esperado = Number.parseInt(String(s.esperado), 10) || 0;
        const registrado = s.legado ? (contagem.get(s.legado) ?? 0) : 0;
        let status: ChecklistSlot['status'] = 'pendente';
        if (registrado === 0) status = 'pendente';
        else if (registrado < esperado) status = 'parcial';
        else if (registrado === esperado) status = 'completo';
        else status = 'excedente';
        slots.push({
          produtoId: s.produtoId,
          produtoCodigo: s.produtoCodigo,
          produtoNome: s.produtoNome,
          esperado,
          registrado,
          status,
        });
      }
    }

    const [divAberta] = await tx.select({ id: divergenciasTransformacao.id })
      .from(divergenciasTransformacao)
      .where(and(
        eq(divergenciasTransformacao.transformacaoId, transformacaoId),
        isNull(divergenciasTransformacao.deletedAt),
      ))
      .limit(1);

    const divergente = slots.some((s) => s.status !== 'completo');
    return {
      transformacaoId,
      regraTransformacaoId: transf.regraTransformacaoId,
      regraNome,
      regraProvisoria,
      slots,
      divergente,
      divergenciaAbertaId: divAberta?.id ?? null,
    };
  }
```

- [ ] **Step 4: `abrirDivergencia` completo (`abrirNaTx` com DTO real)**

```ts
  async abrirDivergencia(
    transformacaoId: string,
    dto: AbrirDivergenciaTransformacaoDto,
    operadorId: string,
  ) {
    const { divergencia, aprovacao, dataOperacao } = await this.db.transaction(async (tx) => {
      const [transf] = await tx.select().from(transformacoes)
        .where(and(eq(transformacoes.id, transformacaoId), isNull(transformacoes.deletedAt)))
        .for('update');
      if (!transf) throw new NotFoundException('Transformação não encontrada');
      if (['concluida', 'cancelada'].includes(transf.statusTransformacao)) {
        throw new ConflictException({
          codigo: 'TRANSFORMACAO_FECHADA',
          mensagem: 'Transformação fechada não aceita divergência',
        });
      }

      const [ctx] = await tx
        .select({
          operacaoId: recebimentos.operacaoId,
          dataOperacao: operacoes.data,
          etiqueta: pecas.etiquetaAtual,
        })
        .from(pecas)
        .innerJoin(recebimentos, eq(recebimentos.id, pecas.recebimentoId))
        .innerJoin(operacoes, eq(operacoes.id, recebimentos.operacaoId))
        .where(eq(pecas.id, transf.pecaOrigemId))
        .limit(1);
      if (!ctx?.operacaoId) {
        throw new NotFoundException('Operação da transformação não encontrada');
      }

      const [divergencia] = await tx.insert(divergenciasTransformacao).values({
        transformacaoId,
        tipo: dto.tipo,
        detalheJson: {
          ...dto.detalhe,
          observacao: dto.observacao ?? null,
        },
        abertoPorId: operadorId,
      }).returning();
      if (!divergencia) throw new Error('Falha ao abrir divergência de transformação');

      const descricao =
        `Divergência de transformação (${dto.tipo}) na peça ` +
        `${ctx.etiqueta ?? transf.pecaOrigemId}: checklist esperado×registrado não fecha. ` +
        (dto.observacao ? dto.observacao : 'Sem observação adicional do operador.');
      const impacto =
        'Conclusão da desossa fica condicionada à aprovação gestora; ' +
        'pedidos/cargas que dependem das saídas podem ficar sem cobertura.';

      const aprovacao = await this.aprovacoes.abrirNaTx(
        tx,
        {
          operacaoId: ctx.operacaoId,
          tipo: 'divergencia_transformacao',
          origem: 'desossa',
          descricao,
          impacto,
          referenciaTabela: 'divergencias_transformacao',
          referenciaId: divergencia.id,
        },
        operadorId,
      );

      const [comAprovacao] = await tx.update(divergenciasTransformacao)
        .set({ aprovacaoId: aprovacao.id, updatedAt: new Date() })
        .where(eq(divergenciasTransformacao.id, divergencia.id))
        .returning();

      await this.auditoria.registrar(tx, {
        tabela: 'divergencias_transformacao',
        registroId: divergencia.id,
        operacao: 'INSERT',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: {},
        dadosNovos: comAprovacao,
      });

      return {
        divergencia: comAprovacao,
        aprovacao,
        dataOperacao: ctx.dataOperacao,
      };
    });

    this.events.emit(EVENTOS.DIVERGENCIA_TRANSFORMACAO_ABERTA, {
      dataOperacao,
      transformacaoId,
      divergenciaId: divergencia.id,
      aprovacaoId: aprovacao.id,
      tipo: dto.tipo,
    });
    this.events.emit(EVENTOS.FALTAS_DESOSSA_ATUALIZADAS, {
      dataOperacao,
      motivo: 'divergencia_transformacao_aberta',
    });

    return divergencia;
  }
}
```

- [ ] **Step 5: Gate no `CorteService.concluir` + endpoints**

```ts
const checklist = await this.checklist.obterNaTx(tx, transformacaoId);
if (checklist.divergente && !checklist.divergenciaAbertaId) {
  throw new ConflictException({
    codigo: 'CHECKLIST_DIVERGENTE',
    mensagem: 'Registre a divergência de transformação antes de concluir',
  });
}
```

```ts
@Get(':id/checklist')
@RequirePermissoes('CORTE_GERENCIAR')
checklist(@Param('id') id: string) {
  return this.checklist.obter(id);
}

@Post(':id/divergencia')
@RequirePermissoes('CORTE_GERENCIAR')
divergencia(
  @Param('id') id: string,
  @Body(new ZodValidationPipe(abrirDivergenciaTransformacaoSchema)) dto: AbrirDivergenciaTransformacaoDto,
  @CurrentUser() user: CurrentUserPayload,
) {
  return this.checklist.abrirDivergencia(id, dto, user.sub);
}
```

- [ ] **Step 6: Commit** `feat(onda7): checklist e divergência formal de transformação`

---

### Task 7 — `GET /desossa/painel?modoTv=`

**Files:**
- Create: `painel.calc.ts`, `painel.service.ts`, `dto/painel.dto.ts`
- Modify: `desossa.controller.ts`, `desossa.module.ts`
- Create: `test/unit/painel.calc.spec.ts`

**Query DTO:**
```ts
export const painelQuerySchema = z.object({
  modoTv: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => v === true || v === 'true'),
  operacaoId: z.string().uuid().optional(),
});
export type PainelQuery = z.infer<typeof painelQuerySchema>;
```

- [ ] **Step 1: Teste unit de `painel.calc` (falha sem implementação)**

Semântica tip (`faltas.calc.ts:41`): `quantidadeFaltante` **já é líquido** (`demanda − estoque`). Não inventar demanda bruta no tipo `FaltaDesossaItem`. Protótipo (`DesossaDashboard.tsx:56-61`) exibe `faltam` bruto e `aProduzir` líquido — o calc reconstrói o bruto só na projeção.

```ts
// test/unit/painel.calc.spec.ts
import { montarPainelDesossa } from '../../src/modules/operacao/desossa/painel.calc';

describe('montarPainelDesossa', () => {
  // quantidadeFaltante=5 já líquido (tip); estoque=1 → demanda bruta exibida = 6
  const faltas = [
    {
      produto: { id: 'p1', codigo: 'CB', nome: 'Coxão-bola' },
      quantidadeFaltante: 5,
      quantidadeEstoque: 1,
      origem: 'TZ',
      rota: 'Carga Centro 11:30',
      representante: 'Alpha Carnes / Sabrina',
      horarioAlvo: '10:45',
    },
  ];
  const regras = [
    {
      id: 'r1',
      codigo: 'TZ_A',
      nome: 'Alternativa A — TZ → Coxão-bola + Jacaré',
      provisorio: true,
      saidasLabel: '1× CB + 1× JAC',
      prioridade: 1,
      saidasCodigos: ['CB', 'JAC'],
    },
  ];

  it('projeta faltam bruto, aProduzir = líquido tip e contexto de carga', () => {
    const p = montarPainelDesossa({
      faltas,
      regras,
      modoTv: false,
      geradoEm: '2026-07-31T12:00:00.000Z',
      tzsNaDesossa: 24,
      operacaoId: '11111111-1111-1111-1111-111111111111',
    });
    expect(p.modoTv).toBe(false);
    expect(p.operacaoId).toBe('11111111-1111-1111-1111-111111111111');
    expect(p.itens).toHaveLength(1);
    expect(p.itens[0]).toMatchObject({
      produtoCodigo: 'CB',
      faltam: 6, // 5 líquido + 1 estoque
      prontoEstoque: 1,
      aProduzir: 5, // === quantidadeFaltante (líquido tip)
      origem: 'TZ',
      rota: 'Carga Centro 11:30',
      representante: 'Alpha Carnes / Sabrina',
      horarioAlvo: '10:45',
    });
    expect(p.regras[0].provisorio).toBe(true);
    expect(p.regras[0].prioridade).toBe('Alta');
    expect(p.regras[0].atende).toBe('Carga Centro 11:30');
    expect(p.regras[0].sobras).toMatch(/estoque/);
    expect(p.regras[0].impacto).toMatch(/Coxão/);
    expect(p.regras[0].status).toBe('Recomendada');
    expect(p.totais.itensFaltantes).toBe(1);
    expect(p.totais.tzsNaDesossa).toBe(24);
    expect(p.totais.prontoEstoque).toBe(1);
  });

  it('modoTv omit regras detalhadas e mantém itens com CARGA/HORÁRIO', () => {
    const p = montarPainelDesossa({
      faltas,
      regras,
      modoTv: true,
      geradoEm: '2026-07-31T12:00:00.000Z',
      tzsNaDesossa: 24,
      operacaoId: '11111111-1111-1111-1111-111111111111',
    });
    expect(p.modoTv).toBe(true);
    expect(p.itens).toHaveLength(1);
    expect(p.itens[0].rota).toBe('Carga Centro 11:30');
    expect(p.itens[0].horarioAlvo).toBe('10:45');
    expect(p.regras).toEqual([]);
  });
});
```

- [ ] **Step 2: `painel.calc.ts` literal**

```ts
// app/backend/src/modules/operacao/desossa/painel.calc.ts
import type { FaltaDesossaItem } from './faltas.calc';

/** Falta tip + contexto de carga para colunas Rota/Representante/Alvo (protótipo). */
export type FaltaPainelInput = FaltaDesossaItem & {
  rota: string | null;
  representante: string | null;
  horarioAlvo: string | null;
};

export type PainelRegraInput = {
  id: string;
  codigo: string | null;
  nome: string;
  provisorio: boolean;
  saidasLabel: string;
  prioridade: number; // 1=Alta/Recomendada, 2=Média/Útil, ≥3=Baixa/Opcional
  saidasCodigos: string[]; // códigos item comercial das saídas (ex.: CB, JAC)
};

export type PainelDesossa = {
  geradoEm: string;
  modoTv: boolean;
  operacaoId: string; // Emenda 3 — client busca TZs em pecas-elegiveis
  itens: Array<{
    produtoId: string;
    produtoCodigo: string;
    produtoNome: string;
    faltam: number;
    prontoEstoque: number;
    aProduzir: number;
    origem: string;
    rota: string | null;
    representante: string | null;
    horarioAlvo: string | null;
    prioridade: 'Alta' | 'Média' | 'Baixa';
    status: string;
  }>;
  regras: Array<{
    regraId: string;
    codigo: string | null;
    nome: string;
    provisorio: boolean;
    prioridade: 'Alta' | 'Média' | 'Baixa';
    tzsEstimados: number;
    saidasEsperadas: string;
    atende: string;
    sobras: string;
    impacto: string;
    status: 'Recomendada' | 'Útil' | 'Opcional';
  }>;
  alertas: Array<{ tipo: string; msg: string }>;
  totais: {
    itensFaltantes: number;
    prontoEstoque: number;
    tzsNaDesossa: number;
    pecasAProduzir: number;
  };
};

function prioridadeDe(aProduzir: number): 'Alta' | 'Média' | 'Baixa' {
  if (aProduzir >= 5) return 'Alta';
  if (aProduzir >= 2) return 'Média';
  return 'Baixa';
}

function statusDe(aProduzir: number, estoque: number): string {
  if (aProduzir <= 0 && estoque > 0) return 'Coberto por estoque';
  if (aProduzir >= 5) return 'Crítico';
  if (aProduzir >= 2) return 'Atenção';
  if (aProduzir > 0) return 'A produzir';
  return 'Aguardando TZ';
}

function prioridadeRegraLabel(n: number): 'Alta' | 'Média' | 'Baixa' {
  if (n <= 1) return 'Alta';
  if (n === 2) return 'Média';
  return 'Baixa';
}

function statusRegraDe(n: number): 'Recomendada' | 'Útil' | 'Opcional' {
  if (n <= 1) return 'Recomendada';
  if (n === 2) return 'Útil';
  return 'Opcional';
}

function atendeDe(
  itens: Array<{ produtoCodigo: string; aProduzir: number; rota: string | null }>,
  saidasCodigos: string[],
): string {
  const rotas = itens
    .filter((i) => saidasCodigos.includes(i.produtoCodigo) && i.aProduzir > 0 && i.rota)
    .map((i) => i.rota as string);
  const uniq = [...new Set(rotas)];
  return uniq[0] ?? '—';
}

function sobrasDe(
  itens: Array<{ produtoCodigo: string; produtoNome: string; prontoEstoque: number }>,
  saidasCodigos: string[],
): string {
  const cobertos = itens.filter((i) => saidasCodigos.includes(i.produtoCodigo) && i.prontoEstoque > 0);
  if (cobertos.length === 0) return 'Sem sobra prevista';
  const c = cobertos[0];
  return `${c.prontoEstoque} ${c.produtoNome} p/ estoque`;
}

function impactoDe(
  itens: Array<{ produtoCodigo: string; produtoNome: string; aProduzir: number }>,
  saidasCodigos: string[],
): string {
  const nomes = itens
    .filter((i) => saidasCodigos.includes(i.produtoCodigo) && i.aProduzir > 0)
    .map((i) => i.produtoNome);
  if (nomes.length === 0) return 'Sem demanda ativa coberta';
  return `Cobre ${nomes.join(' e ')}`;
}

/**
 * Tip: quantidadeFaltante já líquido (faltas.calc.ts:41).
 * UI protótipo: faltam = demanda bruta; aProduzir = líquido.
 */
export function montarPainelDesossa(input: {
  faltas: FaltaPainelInput[];
  regras: PainelRegraInput[];
  modoTv: boolean;
  geradoEm: string;
  tzsNaDesossa: number;
  operacaoId: string;
}): PainelDesossa {
  const itens = input.faltas.map((f) => {
    const aProduzir = Math.max(0, f.quantidadeFaltante);
    const faltam = aProduzir + Math.max(0, f.quantidadeEstoque);
    return {
      produtoId: f.produto.id,
      produtoCodigo: f.produto.codigo,
      produtoNome: f.produto.nome,
      faltam,
      prontoEstoque: f.quantidadeEstoque,
      aProduzir,
      origem: f.origem,
      rota: f.rota,
      representante: f.representante,
      horarioAlvo: f.horarioAlvo,
      prioridade: prioridadeDe(aProduzir),
      status: statusDe(aProduzir, f.quantidadeEstoque),
    };
  });

  const totais = {
    itensFaltantes: itens.filter((i) => i.aProduzir > 0 || i.faltam > 0).length,
    prontoEstoque: itens.reduce((acc, i) => acc + i.prontoEstoque, 0),
    tzsNaDesossa: input.tzsNaDesossa,
    pecasAProduzir: itens.reduce((acc, i) => acc + i.aProduzir, 0),
  };

  const alertas: PainelDesossa['alertas'] = [];
  const criticos = itens.filter((i) => i.status === 'Crítico');
  if (criticos.length > 0) {
    alertas.push({
      tipo: 'Crítico',
      msg: `${criticos.length} item(ns) crítico(s) na desossa — priorizar TZ`,
    });
  }

  const regras = input.modoTv
    ? []
    : input.regras.map((r) => ({
        regraId: r.id,
        codigo: r.codigo,
        nome: r.nome,
        provisorio: r.provisorio,
        prioridade: prioridadeRegraLabel(r.prioridade),
        tzsEstimados: Math.ceil(totais.pecasAProduzir / 2) || 0,
        saidasEsperadas: r.saidasLabel,
        atende: atendeDe(itens, r.saidasCodigos),
        sobras: sobrasDe(itens, r.saidasCodigos),
        impacto: impactoDe(itens, r.saidasCodigos),
        status: statusRegraDe(r.prioridade),
      }));

  return {
    geradoEm: input.geradoEm,
    modoTv: input.modoTv,
    operacaoId: input.operacaoId,
    itens,
    regras,
    alertas,
    totais,
  };
}
```

- [ ] **Step 3: Service + joins de contexto + controller**

```ts
// painel.service.ts
// imports: NotFoundException; operacoes; desc/inArray/and/eq/isNull/sql (drizzle);
// schema: produtos, regrasTransformacao(+Saidas), pecas, recebimentos, pedidos*, caminhoes*, clientes, representantes
@Injectable()
export class PainelDesossaService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly faltas: FaltasService,
  ) {}

  /** Próxima carga do item comercial — protótipo cols Rota/Carga, Representante, Alvo. */
  private async contextoCargaPorItemComercial(
    itemComercialIds: string[],
  ): Promise<Map<string, { rota: string | null; representante: string | null; horarioAlvo: string | null }>> {
    const mapa = new Map<string, { rota: string | null; representante: string | null; horarioAlvo: string | null }>();
    if (itemComercialIds.length === 0) return mapa;

    const linhas = await this.db
      .select({
        itemComercialId: pedidosVendaItens.itemComercialId,
        rotaCaminhao: caminhoes.rota,
        rotaPrevista: pedidosVenda.rotaPrevista,
        horaAbertura: caminhoes.horaAberturaCarga,
        representanteNome: representantes.nome,
      })
      .from(pedidosVendaItens)
      .innerJoin(pedidosVenda, eq(pedidosVendaItens.pedidoVendaId, pedidosVenda.id))
      .innerJoin(clientes, eq(clientes.id, pedidosVenda.clienteId))
      .leftJoin(representantes, eq(representantes.id, clientes.representanteId))
      .leftJoin(
        caminhoesPedidos,
        and(eq(caminhoesPedidos.pedidoVendaId, pedidosVenda.id), isNull(caminhoesPedidos.deletedAt)),
      )
      .leftJoin(
        caminhoes,
        and(eq(caminhoes.id, caminhoesPedidos.caminhaoId), isNull(caminhoes.deletedAt)),
      )
      .where(
        and(
          isNull(pedidosVenda.deletedAt),
          isNull(pedidosVendaItens.deletedAt),
          inArray(pedidosVendaItens.itemComercialId, itemComercialIds),
          inArray(pedidosVenda.status, [
            'em_elaboracao_reserva_ativa',
            'aguardando_confirmacao_overbooking',
            'finalizado',
            'parcialmente_atendido',
          ]),
        ),
      )
      .orderBy(asc(caminhoes.horaAberturaCarga));

    for (const l of linhas) {
      if (mapa.has(l.itemComercialId)) continue; // primeira = carga mais cedo
      const hora = l.horaAbertura
        ? new Date(l.horaAbertura as Date).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo',
          })
        : null;
      const rotaBase = l.rotaCaminhao ?? l.rotaPrevista;
      const rota =
        rotaBase && hora
          ? `Carga ${rotaBase} ${hora}`
          : rotaBase
            ? `Carga ${rotaBase}`
            : null;
      mapa.set(l.itemComercialId, {
        rota,
        representante: l.representanteNome,
        horarioAlvo: hora,
      });
    }
    return mapa;
  }

  async obter(q: PainelQuery) {
    const listaFaltas = await this.faltas.listarFaltas();
    // legadoItemComercialId não está em FaltaDesossaItem — resolve via produtos.id
    const produtosRows =
      listaFaltas.length === 0
        ? []
        : await this.db
            .select({ id: produtos.id, legado: produtos.legadoItemComercialId })
            .from(produtos)
            .where(inArray(produtos.id, listaFaltas.map((f) => f.produto.id)));
    const produtoParaItem = new Map(produtosRows.map((r) => [r.id, r.legado]));
    const itemComercialIds = [
      ...new Set(produtosRows.map((r) => r.legado).filter((x): x is string => !!x)),
    ];
    const contextos = await this.contextoCargaPorItemComercial(itemComercialIds);

    const faltasPainel: FaltaPainelInput[] = listaFaltas.map((f) => {
      const itemId = produtoParaItem.get(f.produto.id) ?? null;
      const ctx = itemId ? contextos.get(itemId) : undefined;
      return {
        ...f,
        rota: ctx?.rota ?? null,
        representante: ctx?.representante ?? null,
        horarioAlvo: ctx?.horarioAlvo ?? null,
      };
    });

    const [tzRow] = await this.db
      .select({ n: sql<string>`count(*)::text` })
      .from(pecas)
      .innerJoin(recebimentos, eq(recebimentos.id, pecas.recebimentoId))
      .where(
        and(
          isNull(pecas.deletedAt),
          inArray(pecas.statusPeca, ['para_corte', 'em_transformacao']),
          q.operacaoId ? eq(recebimentos.operacaoId, q.operacaoId) : sql`true`,
        ),
      );
    const tzsNaDesossa = Number.parseInt(tzRow?.n ?? '0', 10) || 0;

    const regrasDb = await this.db
      .select()
      .from(regrasTransformacao)
      .where(and(eq(regrasTransformacao.status, 'ativo'), isNull(regrasTransformacao.deletedAt)));
    const regras: PainelRegraInput[] = [];
    for (const r of regrasDb) {
      const saidas = await this.db
        .select({ codigo: produtos.codigo, qtd: regrasTransformacaoSaidas.quantidadeFixa })
        .from(regrasTransformacaoSaidas)
        .innerJoin(produtos, eq(produtos.id, regrasTransformacaoSaidas.produtoId))
        .where(eq(regrasTransformacaoSaidas.regraId, r.id));
      regras.push({
        id: r.id,
        codigo: r.codigo,
        nome: r.nome,
        provisorio: r.provisorio,
        prioridade: r.prioridade, // tip: integer em regras_transformacao
        saidasLabel: saidas.map((s) => `${s.qtd}× ${s.codigo}`).join(' + '),
        saidasCodigos: saidas.map((s) => s.codigo).filter((c): c is string => !!c),
      });
    }

    // Emenda 3 — operacaoId canônico para o client buscar TZs (D7.14)
    let operacaoId = q.operacaoId ?? null;
    if (!operacaoId) {
      const [op] = await this.db
        .select({ id: operacoes.id })
        .from(operacoes)
        .where(
          and(
            isNull(operacoes.deletedAt),
            inArray(operacoes.status, ['aberta', 'em_andamento']),
          ),
        )
        .orderBy(desc(operacoes.dataOperacao))
        .limit(1);
      operacaoId = op?.id ?? null;
    }
    if (!operacaoId) {
      throw new NotFoundException({
        codigo: 'OPERACAO_NAO_ENCONTRADA',
        mensagem: 'Nenhuma operação aberta/em_andamento para o painel da desossa',
      });
    }

    return montarPainelDesossa({
      faltas: faltasPainel,
      regras,
      modoTv: q.modoTv === true,
      geradoEm: new Date().toISOString(),
      tzsNaDesossa,
      operacaoId,
    });
  }
}
```

```ts
@Get('painel')
@RequirePermissoes('DESOSSA_PAINEL_LER')
async painel(@Query(new ZodValidationPipe(painelQuerySchema)) q: PainelQuery) {
  return this.painel.obter(q);
}
```

- [ ] **Step 4: PASS + commit** `feat(onda7): endpoint GET /desossa/painel com modo TV`

---

### Task 8 — Emissores de `FALTAS_DESOSSA_ATUALIZADAS`

**Files:** `subitem.service.ts` (associar), `corte.service.ts` (concluir); T4 já emite no bind.

- [ ] **Step 1: Teste spy (rollback × commit)**

```ts
it('não emite faltas_desossa_atualizadas em rollback', async () => {
  const spy = jest.spyOn(events, 'emit');
  await expect(subitem.associar(subId, dtoQueFalha, op)).rejects.toBeTruthy();
  expect(spy.mock.calls.filter((c) => c[0] === EVENTOS.FALTAS_DESOSSA_ATUALIZADAS)).toHaveLength(0);
});

it('emite faltas_desossa_atualizadas após associar com commit', async () => {
  const spy = jest.spyOn(events, 'emit');
  await subitem.associar(subId, dtoOk, op);
  expect(spy).toHaveBeenCalledWith(
    EVENTOS.FALTAS_DESOSSA_ATUALIZADAS,
    expect.objectContaining({ motivo: 'subitem_associado', dataOperacao: expect.any(String) }),
  );
});
```

- [ ] **Step 2: Literais pós-commit**

```ts
// subitem.service.ts — após commit bem-sucedido de associar (fora do transaction callback):
this.events.emit(EVENTOS.FALTAS_DESOSSA_ATUALIZADAS, {
  dataOperacao: resultado.dataOperacao,
  motivo: 'subitem_associado',
});

// corte.service.ts — após commit bem-sucedido de concluir:
this.events.emit(EVENTOS.FALTAS_DESOSSA_ATUALIZADAS, {
  dataOperacao: resultado.dataOperacao,
  motivo: 'corte_concluido',
});
```

Emit **somente após commit** (padrão F4c / ADR-004). Gateway entrega via `roomsDaData` (inclui `desossa`).

- [ ] **Step 3: Commit** `feat(onda7): broadcast faltas_desossa_atualizadas pós-commit`

---

### Task 9 — BFF Next.js

**Files:** routes API listadas; tipos em `lib/desossa.ts`.

Padrão (espelho de `api/desossa/faltas/route.ts`):

```ts
// app/frontend/src/app/api/desossa/painel/route.ts
import { NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const { data, error, status } = await fetchBackend(
    `/desossa/painel${qs ? `?${qs}` : ''}`,
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data);
}
```

```ts
// app/frontend/src/app/api/desossa/etiquetas/route.ts
export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const { data, error, status } = await fetchBackend(
    `/desossa/etiquetas${qs ? `?${qs}` : ''}`,
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data);
}
```

```ts
// app/frontend/src/app/api/operacao/corte/[id]/regra/route.ts
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  const { data, error, status } = await fetchBackend(`/operacao/corte/${id}/regra`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status });
}
```

Idem checklist (GET). Divergência (POST) em `api/operacao/corte/[id]/divergencia/route.ts` (literal na Task 12 Step 3). Concluir já existe no tip. Tipos em `lib/desossa.ts`: `PainelDesossa` (com `rota`/`representante`/`horarioAlvo`/`totais.tzsNaDesossa`), `ChecklistResponse`, `EtiquetaDesossaListada` (Parte/Origem peso/Cliente), `PecaElegivelDesossa`.

- [ ] Commit: `feat(onda7): BFF painel, etiquetas e bind/checklist/divergência`

---

### Task 10 — `GET /desossa/etiquetas`

**Files:** `etiquetas-desossa.service.ts`, controller GET, testes.

```ts
// dto
export const listarEtiquetasDesossaSchema = z.object({
  operacaoId: z.string().uuid(),
  transformacaoId: z.string().uuid().optional(),
  estado: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
```

```ts
export type EtiquetaDesossaListada = {
  id: string;
  codigo: string | null;
  parteCodigo: string | null; // coluna «Parte» — protótipo DesossaEtiquetas.tsx:650
  produtoCodigo: string;
  produtoNome: string;
  peso: string | null;
  origemPeso: 'balanca' | 'manual' | string | null; // coluna «Origem peso»
  destino: 'pedido' | 'estoque' | string;
  clientePedido: string | null; // coluna «Cliente / Pedido»
  pecaMaeCodigo: string | null; // coluna «Peça mãe (TZ)»
  estado: string; // wire: emitida|ativa|reimpressa|cancelada|invalidada_por_troca (+ UI «Pendente de impressão»/«Bloqueada» via derivação)
  transformacaoId: string;
  subitemId: string;
  createdAt: string;
  invalidadaEm: string | null;
  bloqueada: boolean; // true se subitem em carga fechada (EXISTS subitem_id) — rótulo UI «Bloqueada» (Emenda 4)
  pendenteImpressao: boolean; // true se emitida e ainda sem impressão confirmada — rótulo «Pendente de impressão»
};

@Injectable()
export class EtiquetasDesossaService {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>) {}

  async listar(filtros: z.infer<typeof listarEtiquetasDesossaSchema>): Promise<Paginado<EtiquetaDesossaListada>> {
    // etiquetas_impressoes (tip 94fb341) não tem deleted_at — filtrar por operação + subitem
    const condicoes = [
      eq(recebimentos.operacaoId, filtros.operacaoId),
      isNotNull(etiquetasImpressoes.subitemId),
    ];
    if (filtros.transformacaoId) {
      condicoes.push(eq(transformacoes.id, filtros.transformacaoId));
    }
    if (filtros.estado) {
      // CHECK chk_etiq_estado: emitida|ativa|invalidada_por_troca|reimpressa|cancelada
      condicoes.push(eq(etiquetasImpressoes.estado, filtros.estado));
    }

    const linhas = await this.db
      .select({
        id: etiquetasImpressoes.id,
        codigo: sql<string | null>`${etiquetasImpressoes.payload}->>'qr'`,
        estado: etiquetasImpressoes.estado,
        peso: subitens.peso,
        modoCapturaPeso: subitens.modoCapturaPeso,
        produtoCodigo: itensComerciais.codigo,
        produtoNome: itensComerciais.descricao,
        parteCodigo: subitens.etiquetaAtual,
        pecaMaeCodigo: pecas.etiquetaAtual,
        transformacaoId: transformacoes.id,
        subitemId: subitens.id,
        pedidoVendaId: subitens.pedidoVendaId,
        clienteNome: clientes.nomeFantasia,
        pedidoCodigo: pedidosVenda.id,
        createdAt: etiquetasImpressoes.createdAt,
        invalidadaEm: etiquetasImpressoes.invalidadaEm,
        statusImpressao: etiquetasImpressoes.statusImpressao,
        // Emenda 4 — filtro UI «Bloqueada» por SUBITEM em carga fechada.
        // tip expedicao.schema.ts: XOR carga_itens (tipo_origem='subitem' ⇒ subitem_id NOT NULL, peca_id NULL).
        // PROIBIDO: ci.peca_id = pecas.id (TZ mãe) — peças-parte nunca casam.
        // PROIBIDO: copiar etiquetaBloqueadaSql (Onda 6) — OR-a status_peca IN
        // ('em_transformacao','transformada') e marcaria quase tudo durante a desossa.
        // Reusar só a lista STATUS_CAMINHAO_FECHADO de carga-fechada.ts.
        bloqueada: sql<boolean>`(
          EXISTS (
            SELECT 1
              FROM ${cargaItens} ci
              JOIN ${caminhoes} c ON c.id = ci.caminhao_id
             WHERE ci.subitem_id = ${subitens.id}
               AND ci.deleted_at IS NULL
               AND ci.status_carga_item <> 'removido'
               AND c.status_caminhao IN ('fechado','liberado_faturamento','faturado','liberado_saida','expedido')
          )
        )`,
      })
      .from(etiquetasImpressoes)
      .innerJoin(subitens, eq(subitens.id, etiquetasImpressoes.subitemId))
      .innerJoin(transformacoes, eq(transformacoes.id, subitens.transformacaoId))
      .innerJoin(pecas, eq(pecas.id, transformacoes.pecaOrigemId))
      .innerJoin(recebimentos, eq(recebimentos.id, pecas.recebimentoId))
      .innerJoin(itensComerciais, eq(itensComerciais.id, subitens.itemComercialId))
      .leftJoin(pedidosVenda, eq(pedidosVenda.id, subitens.pedidoVendaId))
      .leftJoin(clientes, eq(clientes.id, pedidosVenda.clienteId))
      .where(and(...condicoes))
      .orderBy(desc(etiquetasImpressoes.createdAt));
// imports obrigatórios no service: cargaItens, caminhoes (expedicao.schema);
// STATUS_CAMINHAO_FECHADO documenta a lista IN acima (não embutir status_peca).

    const itens: EtiquetaDesossaListada[] = linhas.map((l) => {
      const origemPeso =
        l.modoCapturaPeso === 'automatico'
          ? 'balanca'
          : l.modoCapturaPeso === 'manual_assistido'
            ? 'manual'
            : l.modoCapturaPeso;
      const clientePedido =
        l.pedidoVendaId && l.clienteNome
          ? `${l.clienteNome} / ${l.pedidoCodigo}`
          : l.pedidoVendaId
            ? String(l.pedidoCodigo)
            : null;
      return {
        id: l.id,
        codigo: l.codigo,
        parteCodigo: l.parteCodigo,
        produtoCodigo: l.produtoCodigo,
        produtoNome: l.produtoNome,
        peso: l.peso,
        origemPeso,
        destino: l.pedidoVendaId ? 'pedido' : 'estoque',
        clientePedido,
        pecaMaeCodigo: l.pecaMaeCodigo,
        estado: l.estado,
        transformacaoId: l.transformacaoId,
        subitemId: l.subitemId,
        createdAt: new Date(l.createdAt as Date).toISOString(),
        invalidadaEm: l.invalidadaEm
          ? new Date(l.invalidadaEm as Date).toISOString()
          : null,
        bloqueada: Boolean(l.bloqueada),
        pendenteImpressao: l.statusImpressao === 'pendente',
      };
    });

    const inicio = (filtros.page - 1) * filtros.pageSize;
    return montarPaginado(
      itens.slice(inicio, inicio + filtros.pageSize),
      itens.length,
      { page: filtros.page, pageSize: filtros.pageSize },
    );
  }
}
```

```ts
@Get('etiquetas')
@RequirePermissoes('DESOSSA_LER')
listarEtiquetas(
  @Query(new ZodValidationPipe(listarEtiquetasDesossaSchema)) q: ListarEtiquetasDesossaDto,
) {
  return this.etiquetasDesossa.listar(q);
}
```

DoD 7.21: fixture com `estado='invalidada_por_troca'` aparece quando aplicável.

- [ ] **Step DoD 7.21b: testes que falham se o EXISTS voltar a `peca_id` ou copiar `etiquetaBloqueadaSql`**

Envelope tip (`paginacao.ts`): `montarPaginado` → `{ data, total, page, pageSize }`. **PROIBIDO** ler `res.body.itens` / `json.itens` nesta listagem (Emenda 5 / veredito `04bc197`).

Gate O7 (Emenda 6 / veredito `9608d20`): **PROIBIDO** `subitemCompleto` sem `POST /operacao/corte/:id/regra` (409 `REGRA_TRANSFORMACAO_OBRIGATORIA`, DoD 7.6) ou com `itemComercialId` da mãe/recebimento fora das saídas (409 `SAIDA_FORA_DA_REGRA`, DoD 7.7).

```ts
// test/integration/onda7-desossa.spec.ts
import type { INestApplication } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, isNull } from 'drizzle-orm';
import request from 'supertest';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { seedCatalogoMvp } from '../../src/database/seed-catalogo-mvp';
import { seedRegrasTransformacaoTz } from '../../src/database/seed-regras-transformacao-tz';
import { STATUS_CAMINHAO_FECHADO } from '../../src/modules/operacao/pesagem/carga-fechada';
import { createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';
import {
  montarCenarioPesagem,
  criarPedido,
  pesarPeca,
  fakes,
} from '../helpers/pesagem-fixtures';
import { iniciarCorte, subitemCompleto } from '../helpers/corte-fixtures';

type Db = NodePgDatabase<typeof schema>;

/** Emenda 5+6 — fixture completa (zero reticências). Mãe fora da carga; subitem em caminhão fechado. */
async function seedFixtureEtiquetaSubitemEmCargaFechada(
  app: INestApplication,
): Promise<{ operacaoId: string; pecaMaeId: string; subitemId: string; cookiesCorte: string }> {
  const { db } = app.get<{ db: Db }>(DRIZZLE);
  const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
  const compras = await createTestUser(app, { perfil: 'compras' });
  const comercial = await createTestUser(app, { perfil: 'comercial' });
  const corte = await createTestUser(app, { perfil: 'corte' });
  const cookiesReceb = await loginCookies(app, receb.adminEmail, receb.adminPassword);
  const cookiesCompras = await loginCookies(app, compras.adminEmail, compras.adminPassword);
  const cookiesComercial = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
  const cookiesCorte = await loginCookies(app, corte.adminEmail, corte.adminPassword);

  // Emenda 6 — seed Task 2 antes do bind (TZ_A + CB/JAC com legadoItemComercialId)
  await seedCatalogoMvp(db);
  await seedRegrasTransformacaoTz(db);

  const base = await seedComercialBase(app, { fator: 1 });
  const c = await montarCenarioPesagem(
    app,
    { compras: cookiesCompras, recebimento: cookiesReceb },
    base,
    { dataOperacao: '2026-07-31', quantidade: 10 },
  );
  const [rec] = await db
    .select({ operacaoId: schema.recebimentos.operacaoId })
    .from(schema.recebimentos)
    .where(eq(schema.recebimentos.id, c.recebimentoId));
  if (!rec?.operacaoId) throw new Error('operacaoId ausente no recebimento da fixture 7.21b');
  const operacaoId = rec.operacaoId;

  fakes(app).balanca.definirStatus('disponivel');
  fakes(app).balanca.definirPeso('12.000');
  fakes(app).impressora.definirStatus('disponivel');

  const pecaMaeId = await pesarPeca(app, cookiesReceb, {
    recebimentoId: c.recebimentoId,
    itemComercialBaseId: c.itemComercialId,
  });
  // iniciarCorte → status_peca='em_transformacao'; mãe SEM linha em carga_itens.peca_id
  const transformacaoId = await iniciarCorte(app, cookiesCorte, pecaMaeId);

  // Emenda 6 — DoD 7.6: POST /regra antes de subitemCompleto
  const [regraA] = await db
    .select({ id: schema.regrasTransformacao.id })
    .from(schema.regrasTransformacao)
    .where(
      and(
        eq(schema.regrasTransformacao.codigo, 'TZ_A'),
        isNull(schema.regrasTransformacao.deletedAt),
      ),
    )
    .limit(1);
  if (!regraA) {
    throw new Error('Regra seed TZ_A ausente — rode seedRegrasTransformacaoTz (Task 2)');
  }
  const bind = await request(app.getHttpServer())
    .post(`/operacao/corte/${transformacaoId}/regra`)
    .set('Cookie', cookiesCorte)
    .send({ regraTransformacaoId: regraA.id });
  if (bind.status !== 200 && bind.status !== 201) {
    throw new Error(
      `Falha ao vincular TZ_A na transformação: ${bind.status} ${JSON.stringify(bind.body)}`,
    );
  }

  // Emenda 6 — DoD 7.7: saída da regra (CB), NÃO c.itemComercialId do recebimento/TZ mãe
  const [saidaCb] = await db
    .select({ itemComercialId: schema.produtos.legadoItemComercialId })
    .from(schema.produtos)
    .where(and(eq(schema.produtos.codigo, 'CB'), isNull(schema.produtos.deletedAt)))
    .limit(1);
  if (!saidaCb?.itemComercialId) {
    throw new Error('Produto CB seed sem legadoItemComercialId (catálogo MVP / Task 2)');
  }
  const itemSaidaRegraId = saidaCb.itemComercialId;

  const pedido = await criarPedido(app, cookiesComercial, {
    compraId: c.compraId,
    clienteId: c.clienteId,
    itemComercialId: itemSaidaRegraId,
    dataOperacao: c.dataOperacao,
    quantidade: 5,
  });
  const subitemId = await subitemCompleto(
    app,
    cookiesCorte,
    transformacaoId,
    itemSaidaRegraId,
    pedido.pedidoItemId,
  );

  // XOR tip expedicao.schema: tipo_origem='subitem' ⇒ subitem_id NOT NULL, peca_id NULL.
  // PROIBIDO semear carga_itens.peca_id = pecaMaeId (mascararia regressão do EXISTS Emenda 3).
  const [caminhao] = await db
    .insert(schema.caminhoes)
    .values({
      placa: `O721B-${Date.now().toString(36).slice(-5)}`,
      motorista: 'Motorista Fixture DoD 7.21b',
      operacaoId,
      statusCaminhao: 'fechado',
    })
    .returning();
  if (!caminhao) throw new Error('Falha ao semear caminhão fechado DoD 7.21b');

  await db.insert(schema.cargaItens).values({
    caminhaoId: caminhao.id,
    tipoOrigem: 'subitem',
    subitemId,
    pecaId: null,
    pedidoVendaId: pedido.pedidoId,
    pedidoVendaItemId: pedido.pedidoItemId,
    statusCargaItem: 'em_carga',
    conferido: false,
  });

  return { operacaoId, pecaMaeId, subitemId, cookiesCorte };
}

/** Emenda 5+6 — mãe em_transformacao + etiqueta; ZERO carga_itens do subitem. */
async function seedFixtureEtiquetaSubitemSemCarga(
  app: INestApplication,
): Promise<{ operacaoId: string; subitemIdSemCarga: string; cookiesCorte: string }> {
  const { db } = app.get<{ db: Db }>(DRIZZLE);
  const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
  const compras = await createTestUser(app, { perfil: 'compras' });
  const comercial = await createTestUser(app, { perfil: 'comercial' });
  const corte = await createTestUser(app, { perfil: 'corte' });
  const cookiesReceb = await loginCookies(app, receb.adminEmail, receb.adminPassword);
  const cookiesCompras = await loginCookies(app, compras.adminEmail, compras.adminPassword);
  const cookiesComercial = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
  const cookiesCorte = await loginCookies(app, corte.adminEmail, corte.adminPassword);

  // Emenda 6 — seed Task 2 antes do bind (TZ_A + CB/JAC com legadoItemComercialId)
  await seedCatalogoMvp(db);
  await seedRegrasTransformacaoTz(db);

  const base = await seedComercialBase(app, { fator: 1 });
  const c = await montarCenarioPesagem(
    app,
    { compras: cookiesCompras, recebimento: cookiesReceb },
    base,
    { dataOperacao: '2026-08-01', quantidade: 10 },
  );
  const [rec] = await db
    .select({ operacaoId: schema.recebimentos.operacaoId })
    .from(schema.recebimentos)
    .where(eq(schema.recebimentos.id, c.recebimentoId));
  if (!rec?.operacaoId) throw new Error('operacaoId ausente no recebimento da fixture 7.21b-sem-carga');
  const operacaoId = rec.operacaoId;

  fakes(app).balanca.definirStatus('disponivel');
  fakes(app).balanca.definirPeso('11.000');
  fakes(app).impressora.definirStatus('disponivel');

  const pecaMaeId = await pesarPeca(app, cookiesReceb, {
    recebimentoId: c.recebimentoId,
    itemComercialBaseId: c.itemComercialId,
  });
  const transformacaoId = await iniciarCorte(app, cookiesCorte, pecaMaeId);

  // Emenda 6 — DoD 7.6: POST /regra antes de subitemCompleto
  const [regraA] = await db
    .select({ id: schema.regrasTransformacao.id })
    .from(schema.regrasTransformacao)
    .where(
      and(
        eq(schema.regrasTransformacao.codigo, 'TZ_A'),
        isNull(schema.regrasTransformacao.deletedAt),
      ),
    )
    .limit(1);
  if (!regraA) {
    throw new Error('Regra seed TZ_A ausente — rode seedRegrasTransformacaoTz (Task 2)');
  }
  const bind = await request(app.getHttpServer())
    .post(`/operacao/corte/${transformacaoId}/regra`)
    .set('Cookie', cookiesCorte)
    .send({ regraTransformacaoId: regraA.id });
  if (bind.status !== 200 && bind.status !== 201) {
    throw new Error(
      `Falha ao vincular TZ_A na transformação: ${bind.status} ${JSON.stringify(bind.body)}`,
    );
  }

  // Emenda 6 — DoD 7.7: saída da regra (CB), NÃO c.itemComercialId do recebimento/TZ mãe
  const [saidaCb] = await db
    .select({ itemComercialId: schema.produtos.legadoItemComercialId })
    .from(schema.produtos)
    .where(and(eq(schema.produtos.codigo, 'CB'), isNull(schema.produtos.deletedAt)))
    .limit(1);
  if (!saidaCb?.itemComercialId) {
    throw new Error('Produto CB seed sem legadoItemComercialId (catálogo MVP / Task 2)');
  }
  const itemSaidaRegraId = saidaCb.itemComercialId;

  const pedido = await criarPedido(app, cookiesComercial, {
    compraId: c.compraId,
    clienteId: c.clienteId,
    itemComercialId: itemSaidaRegraId,
    dataOperacao: c.dataOperacao,
    quantidade: 5,
  });
  const subitemIdSemCarga = await subitemCompleto(
    app,
    cookiesCorte,
    transformacaoId,
    itemSaidaRegraId,
    pedido.pedidoItemId,
  );
  // Intencional: NÃO inserir caminhoes/carga_itens — prova que em_transformacao sozinho ≠ bloqueada.

  return { operacaoId, subitemIdSemCarga, cookiesCorte };
}

it('DoD 7.21b: bloqueada=true quando subitem está em carga fechada (não peca_id da mãe)', async () => {
  expect(STATUS_CAMINHAO_FECHADO).toContain('fechado');

  const { operacaoId, subitemId, cookiesCorte } =
    await seedFixtureEtiquetaSubitemEmCargaFechada(app);

  const res = await request(app.getHttpServer())
    .get(`/desossa/etiquetas?operacaoId=${operacaoId}`)
    .set('Cookie', cookiesCorte);
  expect(res.status).toBe(200);
  // Emenda 5 — tip Paginado/montarPaginado + e2e O6: envelope é `data`, NÃO `itens`.
  expect(Array.isArray(res.body.data)).toBe(true);
  expect(res.body).toEqual(
    expect.objectContaining({
      data: expect.any(Array),
      total: expect.any(Number),
      page: expect.any(Number),
      pageSize: expect.any(Number),
    }),
  );
  const etq = (res.body.data as Array<{ subitemId: string; bloqueada: boolean }>).find(
    (e) => e.subitemId === subitemId,
  );
  expect(etq).toBeDefined();
  expect(etq!.bloqueada).toBe(true);
  // Regressão Emenda 3/ef862bf: EXISTS com ci.peca_id = pecas.id ⇒ bloqueada=false
  // (mãe fora da carga) e o filtro UI «Bloqueada» morre.
});

it('DoD 7.21b: mãe em_transformacao sem subitem na carga ⇒ bloqueada=false (não copiar etiquetaBloqueadaSql)', async () => {
  const { operacaoId, subitemIdSemCarga, cookiesCorte } =
    await seedFixtureEtiquetaSubitemSemCarga(app);

  const res = await request(app.getHttpServer())
    .get(`/desossa/etiquetas?operacaoId=${operacaoId}`)
    .set('Cookie', cookiesCorte);
  expect(res.status).toBe(200);
  const etq = (res.body.data as Array<{ subitemId: string; bloqueada: boolean }>).find(
    (e) => e.subitemId === subitemIdSemCarga,
  );
  expect(etq).toBeDefined();
  expect(etq!.bloqueada).toBe(false);
  // Se alguém colar etiquetaBloqueadaSql, este caso falha (mãe em_transformacao ⇒ true).
});
```

```bash
cd app/backend && npx jest test/integration/onda7-desossa.spec.ts -t "DoD 7.21b"
# Expected: PASS (2 testes)

# Gate envelope (implementação): asserts/client leem `.data` — zero envelope `itens`
rg -n "res\.body\.itens|json\.itens" \
  "app/backend/test/integration/onda7-desossa.spec.ts" \
  "app/frontend/src/app/(admin)/desossa/etiquetas" && echo FAIL || echo OK
# Expected: OK

# Gate Emenda 6 / DoD 7.6+7.7: ambas fixtures bindam TZ_A + usam itemSaidaRegraId (CB)
rg -n "regrasTransformacao\.codigo, 'TZ_A'" \
  "docs/superpowers/plans/2026-07-31-onda7-desossa.md"
# Expected: 2 hits (uma por fixture)
rg -n "operacao/corte/\$\{transformacaoId\}/regra" \
  "docs/superpowers/plans/2026-07-31-onda7-desossa.md"
# Expected: 2 hits (uma por fixture DoD 7.21b)
rg -n "itemSaidaRegraId" \
  "docs/superpowers/plans/2026-07-31-onda7-desossa.md"
# Expected: ≥6 hits (decl + criarPedido + subitemCompleto × 2 fixtures)
```

- [ ] Commit: `feat(onda7): listagem de etiquetas da desossa com peça mãe`

---

### Task 11 — UI Dashboard fiel + WS (remove poll)

**Files:** `desossa-dashboard-client.tsx` (+ `TVMode`, drawers no mesmo arquivo).

**Protótipo pinado (ler ANTES de escrever):** `DesossaDashboard.tsx` @ `8d32aa4c`
- Drawers Item/Regra/TZ: `:128-276`
- TVMode (cols PRIOR./PRODUTO/FALTAM/A PRODUZIR/ORIGEM/**CARGA / HORÁRIO**/STATUS): `:280-370` (thead `:306`)
- KPIs (rótulo #3 = **TZs na desossa**): `:452-467` (label `:457`)
- Tabela itens (Rota/Carga, Representante, Alvo): `:492-552` (thead `:508-510`)
- Sugestão por regra: `:554-600` (thead `:563` Prior./Atende/Sobras/Impacto)
- **TZs disponíveis para desossa:** `:600-638` (abre DrawerTZ — Emenda 3)
- Copy "Não representa produção em andamento": `:496`

Client carrega via `fetch('/api/desossa/painel')` — **nunca** `fetchBackend` (server-only).

- [ ] **Step 1: Remover poll e conectar WS**

```tsx
const EVENTOS_REFETCH = new Set([
  'faltas_desossa_atualizadas',
  'divergencia_transformacao_aberta',
  'corte_iniciado',
  'subitem_associado',
  'corte_concluido',
]);

const [tzs, setTzs] = useState<PecaElegivelDesossa[]>([]);
const [drawerTZ, setDrawerTZ] = useState<{
  peca: string;
  peso: string | null;
  lote: string | null;
  origem: string | null;
  entrada: string | null;
  situacao: string;
  caracteristicas: string | null;
  obs: string | null;
} | null>(null);

const carregar = useCallback(async () => {
  const res = await fetch('/api/desossa/painel', { cache: 'no-store' });
  if (!res.ok) {
    setErro((await res.json().catch(() => ({}))).message ?? 'Erro ao carregar painel');
    return;
  }
  const painelJson = (await res.json()) as PainelDesossa & { operacaoId?: string };
  setPainel(painelJson);

  // Emenda 3/4 — TZs do telão via pecas-elegiveis (D7.14 Opção A; DESOSSA_PAINEL_LER)
  const operacaoId = painelJson.operacaoId;
  if (operacaoId) {
    const tzRes = await fetch(
      `/api/operacao/corte/pecas-elegiveis?operacaoId=${encodeURIComponent(operacaoId)}`,
      { cache: 'no-store' },
    );
    if (tzRes.ok) {
      setTzs((await tzRes.json()) as PecaElegivelDesossa[]);
    } else {
      // Emenda 4 / RA-05 — com D7.14, 403 é erro real (bug de RBAC ou regressão).
      // PROIBIDO engolir 403 (`tzRes.status !== 403`): mascara falha e deixa tabela vazia sem alerta.
      setTzs([]);
      setErro(
        (await tzRes.json().catch(() => ({}))).message ??
          `Erro ao carregar TZs (${tzRes.status})`,
      );
    }
  }
}, []);

useEffect(() => {
  void carregar();
  const off = conectarRealtime({
    rooms: ['desossa', 'dashboard'],
    onMessage: (msg) => {
      if (EVENTOS_REFETCH.has(msg.type)) void carregar();
    },
    onReconnect: () => void carregar(),
    onStatus: setWsStatus,
  });
  return off;
}, [carregar]);
// PROIBIDO: setInterval / poll HTTP
```

- [ ] **Step 2: TVMode fiel — inclui coluna CARGA / HORÁRIO** (`DesossaDashboard.tsx:306-338`)

```tsx
function TVMode({
  itens,
  hora,
  alertas,
  onExit,
}: {
  itens: PainelDesossa['itens'];
  hora: string;
  alertas: PainelDesossa['alertas'];
  onExit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-login-panel">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-white/10 px-8 py-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/50">ALFA CARNES</p>
          <h1 className="mt-0.5 text-[28px] font-black tracking-wide text-white">
            DESOSSA — PAINEL OPERACIONAL
          </h1>
          <p className="mt-1 text-[13px] text-white/50">
            O que falta produzir para atender pedidos e cargas
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-white/40">Atualizado às</p>
            <p className="font-mono text-[18px] font-black text-white">{hora}</p>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="flex h-9 items-center gap-1.5 rounded-md border border-white/20 px-4 text-[12px] font-medium text-white/70 hover:bg-white/8"
          >
            <X className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-8 py-4">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              {['PRIOR.', 'PRODUTO', 'FALTAM', 'A PRODUZIR', 'ORIGEM', 'CARGA / HORÁRIO', 'STATUS'].map(
                (h) => (
                  <th
                    key={h}
                    className="pb-3 text-left text-[11px] font-black tracking-[0.2em] text-white/40"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={item.produtoId} className="border-b border-white/7">
                <td className="py-4 pr-4 text-[11px] font-black text-white">{item.prioridade}</td>
                <td className="py-4 pr-6 text-[22px] font-black text-white">{item.produtoNome}</td>
                <td className="py-4 pr-6 font-mono text-[22px] font-black text-info-ink">{item.faltam}</td>
                <td className="py-4 pr-6 font-mono text-[20px] font-black text-white">
                  {item.aProduzir} <span className="text-[13px] text-white/40">peças</span>
                </td>
                <td className="py-4 pr-6 text-[16px] font-bold text-white/60">{item.origem}</td>
                <td className="py-4 pr-6">
                  <p className="text-[15px] font-bold text-white/80">{item.rota ?? '—'}</p>
                  <p className="mt-0.5 font-mono text-[13px] text-white/40">{item.horarioAlvo ?? ''}</p>
                </td>
                <td className="py-4 text-[12px] font-black text-white">{item.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-shrink-0 items-center gap-6 border-t border-white/8 px-8 py-3">
        {alertas.map((a, i) => (
          <p key={i} className="text-[11px] text-white/50">{a.msg}</p>
        ))}
        <p className="ml-auto text-[10px] uppercase tracking-widest text-white/30">
          Atualização por eventos em tempo real
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: KPIs (rótulo literal «TZs na desossa») + tabela com Rota/Representante/Alvo + sugestão**

```tsx
{/* KPIs — DesossaDashboard.tsx:452-467 — KPI #3 NÃO é «Peças faltantes» */}
<div className="grid grid-cols-5 gap-3">
  {[
    { label: 'Itens faltantes', value: painel.totais.itensFaltantes, color: 'text-destructive' },
    { label: 'Prontos em estoque', value: painel.totais.prontoEstoque, color: 'text-success-strong' },
    { label: 'TZs na desossa', value: painel.totais.tzsNaDesossa, color: 'text-info-ink' },
    { label: 'Regras sugeridas', value: painel.regras.length, color: 'text-violet-700' },
    {
      label: 'Prioridade alta',
      value: painel.itens.filter((i) => i.prioridade === 'Alta').length,
      color: 'text-warning-ink',
    },
  ].map((k) => (
    <div key={k.label} className="rounded-xl border border-border bg-card px-4 py-3.5">
      <p className="mb-1 text-[11px] font-medium text-muted-foreground">{k.label}</p>
      <p className={`text-[32px] font-black leading-none ${k.color}`}>{k.value}</p>
    </div>
  ))}
</div>

{/* Tabela — DesossaDashboard.tsx:508-510 */}
<div className="overflow-hidden rounded-xl border border-border bg-card">
  <div className="border-b border-border px-5 py-3.5">
    <h2 className="text-[13px] font-bold text-foreground">Painel de Itens a Produzir</h2>
    <p className="mt-0.5 text-[11px] text-muted-foreground">
      Lista orientativa dos produtos que faltam para pedidos e cargas. Não representa produção em
      andamento.
    </p>
  </div>
  <table className="w-full text-[12px]">
    <thead>
      <tr className="border-b border-border bg-muted/40">
        {[
          'Prior.',
          'Produto',
          'Faltam',
          'Estoque pronto',
          'A produzir',
          'Origem',
          'Rota / Carga',
          'Representante',
          'Alvo',
          'Status',
          '',
        ].map((h) => (
          <th
            key={h || 'acoes'}
            className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
          >
            {h}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {painel.itens.map((item) => (
        <tr key={item.produtoId} className="border-b border-border/60">
          <td className="px-3 py-2.5">{item.prioridade}</td>
          <td className="px-3 py-2.5 font-bold">{item.produtoNome}</td>
          <td className="px-3 py-2.5 font-mono font-black">{item.faltam}</td>
          <td className="px-3 py-2.5">{item.prontoEstoque || '—'}</td>
          <td className="px-3 py-2.5 font-mono font-black">{item.aProduzir}</td>
          <td className="px-3 py-2.5 font-semibold text-violet-700">{item.origem}</td>
          <td className="px-3 py-2.5 whitespace-nowrap text-[11px] text-muted-foreground">
            {item.rota ?? '—'}
          </td>
          <td className="max-w-[120px] truncate px-3 py-2.5 text-[11px] text-muted-foreground">
            {(item.representante ?? '—').split('/')[0]?.trim()}
          </td>
          <td className="px-3 py-2.5 font-mono text-[11px] font-bold">{item.horarioAlvo ?? '—'}</td>
          <td className="px-3 py-2.5">{item.status}</td>
          <td className="px-3 py-2.5">
            <button type="button" title="Ver detalhes" onClick={() => setDrawerItem(item)}>
              <Eye className="h-3.5 w-3.5" />
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

{/* Sugestão por regra — DesossaDashboard.tsx:554-600 thead :563 */}
<div className="overflow-hidden rounded-xl border border-border bg-card">
  <div className="border-b border-border px-5 py-3.5">
    <h2 className="text-[13px] font-bold text-foreground">Sugestão por Regra de Transformação</h2>
    <p className="mt-0.5 text-[11px] text-muted-foreground">
      Agrupamento orientativo para evitar leitura duplicada de produtos que compartilham o mesmo TZ.
    </p>
  </div>
  <table className="w-full text-[12px]">
    <thead>
      <tr className="border-b border-border bg-muted/40">
        {[
          'Prior.',
          'Regra sugerida',
          'TZs estimados',
          'Saídas esperadas',
          'Atende',
          'Sobras previstas',
          'Impacto',
          'Status',
          '',
        ].map((h) => (
          <th
            key={h || 'acoes-regra'}
            className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap"
          >
            {h}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {painel.regras.map((r) => (
        <tr key={r.regraId} className="border-b border-border/60">
          <td className="px-3 py-2.5">{r.prioridade}</td>
          <td className="px-3 py-2.5 font-bold text-violet-700">
            {r.nome}
            {r.provisorio ? (
              <Badge
                variant="outline"
                className="ml-2"
                title="P12 / v1.1 §16.15 — validar com cliente"
              >
                Provisório
              </Badge>
            ) : null}
          </td>
          <td className="px-3 py-2.5 font-mono font-black">{r.tzsEstimados}</td>
          <td className="px-3 py-2.5">{r.saidasEsperadas}</td>
          <td className="px-3 py-2.5 whitespace-nowrap text-[11px] text-muted-foreground">{r.atende}</td>
          <td className="px-3 py-2.5 text-[11px] text-muted-foreground">{r.sobras}</td>
          <td className="max-w-[160px] truncate px-3 py-2.5 text-[11px] text-muted-foreground">{r.impacto}</td>
          <td className="px-3 py-2.5">{r.status}</td>
          <td className="px-3 py-2.5">
            <button type="button" onClick={() => setDrawerRegra(r)}>
              <Eye className="h-3.5 w-3.5" />
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
  <div className="border-t border-border bg-muted/30 px-5 py-3">
    <p className="text-[11px] italic text-muted-foreground">
      As regras sugeridas orientam a equipe, mas a execução real será registrada na tela Pesagem e
      Destinação da Desossa.
    </p>
  </div>
</div>

{/* TZs disponíveis — DesossaDashboard.tsx:600-638 — abre DrawerTZ (Emenda 3) */}
<div className="overflow-hidden rounded-xl border border-border bg-card">
  <div className="border-b border-border px-5 py-3.5">
    <h2 className="text-[13px] font-bold text-foreground">TZs disponíveis para desossa</h2>
    <p className="mt-0.5 text-[11px] text-muted-foreground">
      Peças encaminhadas pela balança ou disponíveis para transformação.
    </p>
  </div>
  <table className="w-full text-[12px]">
    <thead>
      <tr className="border-b border-border bg-muted/40">
        {['Peça', 'Peso', 'Lote', 'Origem', 'Entrada', 'Características', 'Situação', 'Obs.', ''].map(
          (h) => (
            <th
              key={h || 'acoes-tz'}
              className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap"
            >
              {h}
            </th>
          ),
        )}
      </tr>
    </thead>
    <tbody>
      {tzs.map((tz) => (
        <tr key={tz.pecaId} className="border-b border-border/60 hover:bg-muted/20">
          <td className="px-3 py-2.5 font-mono text-[11px] font-bold">{tz.etiquetaAtual ?? tz.pecaId}</td>
          <td className="px-3 py-2.5 font-mono text-muted-foreground">
            {tz.pesoOriginal
              ? `${Number(tz.pesoOriginal).toFixed(3).replace('.', ',')} kg`
              : '—'}
          </td>
          <td className="px-3 py-2.5 text-muted-foreground">{tz.lote ?? '—'}</td>
          <td className="px-3 py-2.5 whitespace-nowrap text-[11px] text-muted-foreground">
            {(tz.origem ?? '—').replace(/^Frigorífico\s+/i, '')}
          </td>
          <td className="px-3 py-2.5 whitespace-nowrap text-[11px] text-muted-foreground">
            {tz.entrada ?? '—'}
          </td>
          <td className="px-3 py-2.5 text-[11px] text-muted-foreground">{tz.caracteristicas || '—'}</td>
          <td className="px-3 py-2.5">
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold">{tz.situacao}</span>
          </td>
          <td className="max-w-[140px] truncate px-3 py-2.5 text-[11px] text-muted-foreground">
            {tz.obs ?? '—'}
          </td>
          <td className="px-3 py-2.5">
            <button
              type="button"
              title="Ver detalhes"
              onClick={() =>
                setDrawerTZ({
                  peca: tz.etiquetaAtual ?? tz.pecaId,
                  peso: tz.pesoOriginal,
                  lote: tz.lote,
                  origem: tz.origem,
                  entrada: tz.entrada,
                  situacao: tz.situacao,
                  caracteristicas: tz.caracteristicas,
                  obs: tz.obs,
                })
              }
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

<button type="button" onClick={() => setModoTV(true)}>
  <Tv className="h-3.5 w-3.5" /> Modo TV
</button>
{modoTV && (
  <TVMode
    itens={painel.itens}
    hora={hora}
    alertas={painel.alertas}
    onExit={() => setModoTV(false)}
  />
)}
```

- [ ] **Step 4: Drawers Item / Regra / TZ** (`DesossaDashboard.tsx:128-276`)

```tsx
function DrawerItem({
  item,
  onClose,
}: {
  item: PainelDesossa['itens'][number] | null;
  onClose: () => void;
}) {
  if (!item) return null;
  return (
    <Sheet open={!!item} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="flex max-w-full w-[440px] flex-col bg-card p-0">
        <SheetHeader className="flex flex-shrink-0 flex-row items-center justify-between border-b border-border px-6 py-4">
          <SheetTitle className="text-[15px] font-bold">{item.produtoNome}</SheetTitle>
          <button type="button" onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
          <div className="flex items-start gap-2 rounded-lg border border-info-border bg-info-surface p-3">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-info-ink" />
            <p className="text-[12px] text-info-ink">
              Painel somente orientativo. A execução ocorre na Pesagem e Destinação da Desossa.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                ['Produto', item.produtoNome],
                ['Prioridade', item.prioridade],
                ['Total faltante', `${item.faltam} peças`],
                ['Pronto em estoque', `${item.prontoEstoque} peças`],
                ['A produzir', `${item.aProduzir} peças`],
                ['Origem', item.origem],
                ['Rota / Carga', item.rota ?? '—'],
                ['Representante', item.representante ?? '—'],
                ['Horário alvo', item.horarioAlvo ?? '—'],
                ['Status', item.status],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{k}</p>
                <p className="mt-0.5 text-[13px] font-semibold text-foreground">{v}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-shrink-0 border-t border-border px-6 py-4">
          <button type="button" onClick={onClose} className="h-8 w-full rounded-md border border-border text-[13px] font-medium text-muted-foreground">
            Fechar
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DrawerRegra({
  regra,
  onClose,
}: {
  regra: PainelDesossa['regras'][number] | null;
  onClose: () => void;
}) {
  if (!regra) return null;
  return (
    <Sheet open={!!regra} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="flex max-w-full w-[440px] flex-col bg-card p-0">
        <SheetHeader className="flex flex-shrink-0 flex-row items-center justify-between border-b border-border px-6 py-4">
          <SheetTitle className="text-[14px] font-bold">{regra.nome}</SheetTitle>
          <button type="button" onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          <div className="flex items-start gap-2 rounded-lg border border-info-border bg-info-surface p-3">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-info-ink" />
            <p className="text-[12px] text-info-ink">
              Regra sugerida. A execução real ocorre na Pesagem e Destinação da Desossa. Não há
              controle de produção aqui.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                ['Regra', regra.nome],
                ['Produto origem', 'TZ'],
                ['Prioridade', regra.prioridade],
                ['TZs estimados', `${regra.tzsEstimados} peças`],
                ['Saídas esperadas', regra.saidasEsperadas],
                ['Atende', regra.atende],
                ['Sobras previstas', regra.sobras],
                ['Status', regra.status],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className={k === 'Regra' || k === 'Saídas esperadas' ? 'col-span-2' : ''}>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{k}</p>
                <p className="mt-0.5 text-[13px] font-semibold">{v}</p>
              </div>
            ))}
            <div className="col-span-2">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Impacto</p>
              <p className="mt-0.5 text-[13px] font-semibold">{regra.impacto}</p>
            </div>
          </div>
          {regra.provisorio ? (
            <Badge variant="outline" title="P12 / v1.1 §16.15 — validar com cliente">
              Provisório
            </Badge>
          ) : null}
        </div>
        <div className="flex-shrink-0 border-t border-border px-6 py-4">
          <button type="button" onClick={onClose} className="h-8 w-full rounded-md border border-border text-[13px]">
            Fechar
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DrawerTZ({
  tz,
  onClose,
}: {
  tz: {
    peca: string;
    peso: string | null;
    lote: string | null;
    origem: string | null;
    entrada: string | null;
    situacao: string;
    caracteristicas: string | null;
    obs: string | null;
  } | null;
  onClose: () => void;
}) {
  if (!tz) return null;
  return (
    <Sheet open={!!tz} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="flex max-w-full w-[400px] flex-col bg-card p-0">
        <SheetHeader className="flex flex-shrink-0 flex-row items-center justify-between border-b border-border px-6 py-4">
          <SheetTitle className="text-[15px] font-bold">{tz.peca}</SheetTitle>
          <button type="button" onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                ['Código da peça', tz.peca],
                ['Peso', tz.peso ? `${tz.peso} kg` : '—'],
                ['Lote', tz.lote ?? '—'],
                ['Frigorífico', tz.origem ?? '—'],
                ['Pesagem', tz.entrada ?? '—'],
                ['Situação', tz.situacao],
                ['Características', tz.caracteristicas || '—'],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className={k === 'Frigorífico' || k === 'Situação' || k === 'Características' ? 'col-span-2' : ''}>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{k}</p>
                <p className="mt-0.5 text-[13px] font-semibold">{v}</p>
              </div>
            ))}
          </div>
          {tz.obs ? (
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Observação</p>
              <p className="text-[12px] text-muted-foreground">{tz.obs}</p>
            </div>
          ) : null}
        </div>
        <div className="flex-shrink-0 border-t border-border px-6 py-4">
          <button type="button" onClick={onClose} className="h-8 w-full rounded-md border border-border text-[13px]">
            Fechar
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

{/* Montagem — DesossaDashboard.tsx:716-719 */}
<DrawerItem item={drawerItem} onClose={() => setDrawerItem(null)} />
<DrawerRegra regra={drawerRegra} onClose={() => setDrawerRegra(null)} />
<DrawerTZ tz={drawerTZ} onClose={() => setDrawerTZ(null)} />
```

Fonte de TZs (Emenda 3 / D7.14 Opção A): `GET /api/operacao/corte/pecas-elegiveis?operacaoId=` com `RequireQualquerPermissao('DESOSSA_PAINEL_LER','DESOSSA_LER','CORTE_GERENCIAR')` — tabela «TZs disponíveis» + `setDrawerTZ` a partir da linha Eye. Campos: `etiquetaAtual`→Peça, `pesoOriginal`→Peso, `lote`/`origem`/`entrada`/`caracteristicas`/`situacao`/`obs` literais do DTO. Zero `TZS_SEED`/`ITENS_SEED` em runtime. DrawerTZ **não** pode existir sem a tabela.

```bash
rg -n "setInterval" "app/frontend/src/app/(admin)/desossa/dashboard" && echo FAIL || echo OK
# Expected: OK
rg -n "TZs na desossa|CARGA / HORÁRIO|Rota / Carga|TZs disponíveis para desossa|Sobras previstas" "app/frontend/src/app/(admin)/desossa/dashboard/desossa-dashboard-client.tsx"
# Expected: ≥5 hits (KPI + TVMode + tabela itens + bloco TZs + sugestão)
rg -n "fetchBackend" "app/frontend/src/app/(admin)/desossa" && echo FAIL || echo OK
# Expected: OK (zero fetchBackend no client admin/desossa)
```

- [ ] Commit: `feat(onda7): dashboard desossa fiel com Modo TV e WebSocket`

---

### Task 12 — UI Pesagem/Destinação fiel + `pecas-elegiveis`

**Decisão D7.13 (fechada):** endpoint **não existe** no tip `94fb341` → **criar** nesta task.

**Files:**
- Create: `pecas-elegiveis.service.ts`, `dto/pecas-elegiveis.dto.ts`
- Modify: `corte.controller.ts`, `corte.module.ts`
- Create: `desossa-pesagem-client.tsx`; atualizar `page.tsx`
- BFF: `app/api/operacao/corte/pecas-elegiveis/route.ts`

- [ ] **Step 1: Backend `GET /operacao/corte/pecas-elegiveis` literal**

```ts
// dto/pecas-elegiveis.dto.ts
export const pecasElegiveisQuerySchema = z.object({
  operacaoId: z.string().uuid(),
});
export type PecasElegiveisQuery = z.infer<typeof pecasElegiveisQuerySchema>;

export type PecaElegivelDesossa = {
  pecaId: string;
  etiquetaAtual: string | null;
  statusPeca: string;
  pesoOriginal: string | null;
  itemComercialId: string;
  produtoCodigo: string | null;
  recebimentoId: string;
  transformacaoId: string | null;
  // cols «TZs disponíveis» — DesossaDashboard.tsx:600-638 (Emenda 3)
  lote: string | null;
  origem: string | null;
  entrada: string | null;
  caracteristicas: string;
  situacao: 'Disponível para desossa' | 'Aguardando chegada à desossa' | 'Prioritário';
  obs: string | null;
};
```

```ts
// pecas-elegiveis.service.ts
@Injectable()
export class PecasElegiveisService {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>) {}

  async listar(q: PecasElegiveisQuery): Promise<PecaElegivelDesossa[]> {
    const linhas = await this.db
      .select({
        pecaId: pecas.id,
        etiquetaAtual: pecas.etiquetaAtual,
        statusPeca: pecas.statusPeca,
        pesoOriginal: pecas.pesoOriginal,
        itemComercialId: pecas.itemComercialBaseId,
        produtoCodigo: itensComerciais.codigo,
        recebimentoId: pecas.recebimentoId,
        transformacaoId: transformacoes.id,
        lote: recebimentos.romaneio,
        origem: fornecedores.razaoSocial,
        entrada: pecas.createdAt,
        capturaMeta: pecas.capturaMeta,
      })
      .from(pecas)
      .innerJoin(recebimentos, eq(recebimentos.id, pecas.recebimentoId))
      .innerJoin(fornecedores, eq(fornecedores.id, recebimentos.fornecedorId))
      .leftJoin(itensComerciais, eq(itensComerciais.id, pecas.itemComercialBaseId))
      .leftJoin(
        transformacoes,
        and(
          eq(transformacoes.pecaOrigemId, pecas.id),
          isNull(transformacoes.deletedAt),
          notInArray(transformacoes.statusTransformacao, ['concluida', 'cancelada']),
        ),
      )
      .where(and(
        eq(recebimentos.operacaoId, q.operacaoId),
        inArray(pecas.statusPeca, ['para_corte', 'em_transformacao']),
        isNull(pecas.deletedAt),
      ))
      .orderBy(asc(pecas.createdAt));

    return linhas.map((l) => {
      const meta = (l.capturaMeta ?? {}) as Record<string, unknown>;
      const flags: string[] = [];
      if (meta.maisPesada === true) flags.push('Mais pesada');
      if (meta.maisGorda === true) flags.push('Mais gorda');
      if (meta.melhorAcabamento === true) flags.push('Melhor acabamento');
      const situacao: PecaElegivelDesossa['situacao'] =
        meta.prioritario === true
          ? 'Prioritário'
          : l.statusPeca === 'em_transformacao'
            ? 'Disponível para desossa'
            : 'Aguardando chegada à desossa';
      return {
        pecaId: l.pecaId,
        etiquetaAtual: l.etiquetaAtual,
        statusPeca: l.statusPeca,
        pesoOriginal: l.pesoOriginal,
        itemComercialId: l.itemComercialId,
        produtoCodigo: l.produtoCodigo,
        recebimentoId: l.recebimentoId,
        transformacaoId: l.transformacaoId,
        lote: l.lote,
        origem: l.origem,
        entrada: l.entrada ? new Date(l.entrada as Date).toISOString() : null,
        caracteristicas: flags.length > 0 ? flags.join(', ') : '—',
        situacao,
        obs: typeof meta.obs === 'string' ? meta.obs : null,
      };
    });
  }
}
```

```ts
// corte.controller.ts — ANTES de @Get(':id') para não capturar "pecas-elegiveis" como id
// Emenda 3 / D7.14 Opção A — OR para telão (DESOSSA_PAINEL_LER) + operadores (CORTE_GERENCIAR)
import { RequireQualquerPermissao } from '../../../common/rbac/require-qualquer-permissao.decorator';

@Get('pecas-elegiveis')
@RequireQualquerPermissao('DESOSSA_PAINEL_LER', 'DESOSSA_LER', 'CORTE_GERENCIAR')
listarPecasElegiveis(
  @Query(new ZodValidationPipe(pecasElegiveisQuerySchema)) q: PecasElegiveisQuery,
) {
  return this.pecasElegiveis.listar(q);
}
```

```ts
// BFF app/api/operacao/corte/pecas-elegiveis/route.ts
export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const { data, error, status } = await fetchBackend(
    `/operacao/corte/pecas-elegiveis${qs ? `?${qs}` : ''}`,
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data);
}
```

- [ ] **Step 2: Fluxo API da tela + cercas fetch client (Emenda 3)**

1. `GET /api/operacao/corte/pecas-elegiveis?operacaoId=` (OR perms — D7.14)
2. `POST /api/operacao/corte/pecas/:id/iniciar`
3. `POST /api/operacao/corte/:id/regra` via `vincularRegra`
4. Por slot: subitens → pesar → associar
5. Se divergente: `POST .../divergencia` → `POST .../concluir`
6. Checklist: `GET .../checklist` via `carregarChecklist`

```tsx
// desossa-pesagem-client.tsx — NUNCA fetchBackend (server-only)
async function vincularRegra(regraTransformacaoId: string) {
  if (!transformacaoId) return;
  const res = await fetch(`/api/operacao/corte/${transformacaoId}/regra`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ regraTransformacaoId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    setErro(body.message ?? body.mensagem ?? 'Falha ao vincular regra');
    return;
  }
  setRegraId(regraTransformacaoId);
  await carregarChecklist();
}

async function carregarChecklist() {
  if (!transformacaoId) return;
  const res = await fetch(`/api/operacao/corte/${transformacaoId}/checklist`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    setErro(body.message ?? body.mensagem ?? 'Falha ao carregar checklist');
    return;
  }
  setChecklist(await res.json());
}

useEffect(() => {
  if (transformacaoId) void carregarChecklist();
}, [transformacaoId]);
```

- [ ] **Step 3: JSX fiel — Badge, seletor A/B, checklist, modais** (`DesossaPesagem.tsx` @ `8d32aa4c`)

```tsx
function BadgeProvisorio({ texto }: { texto?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-warning-border bg-warning-surface px-2 py-0.5 text-[10px] font-bold text-warning-ink"
      title="P12 / v1.1 §16.15 — validar com cliente"
    >
      <AlertTriangle className="h-2.5 w-2.5" /> {texto ?? 'Provisório'}
    </span>
  );
}

{/* Seletor de regra A/B — :575-600 */}
{tz && (
  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
    <span className="mr-1 whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      Regra de transformação:
    </span>
    {regras.map((r) => (
      <button
        key={r.id}
        type="button"
        disabled={regraBloqueada && regraId !== r.id}
        onClick={() => void vincularRegra(r.id)}
        title={
          regraBloqueada && regraId !== r.id
            ? 'A regra não pode ser alterada após registrar a primeira saída. Cancele os registros para trocar.'
            : undefined
        }
        className={`h-7 whitespace-nowrap rounded-md border px-3 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
          regraId === r.id
            ? 'border-violet-800 bg-violet-800 text-white'
            : 'border-border bg-card text-muted-foreground'
        }`}
      >
        {r.nome}
      </button>
    ))}
    <BadgeProvisorio texto="Regras provisórias — validar com cliente" />
  </div>
)}

{/* Checklist de saídas — :701-739 */}
<div className="overflow-hidden rounded-xl border border-border bg-card">
  <div className="flex items-center justify-between border-b border-border px-4 py-3">
    <div>
      <p className="text-[12px] font-bold">Saídas da regra</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        {registradas} de {checklist.slots.length} registradas
      </p>
    </div>
    <button type="button" onClick={() => setModalFinalizar(true)} className="...">
      Finalizar
    </button>
  </div>
  <div className="flex flex-col gap-2 p-3">
    {checklist.slots.map((s) => (
      <button
        key={s.produtoId}
        type="button"
        disabled={s.status === 'completo'}
        onClick={() => setSlotAtual(s.produtoId)}
        className="..."
      >
        <p className="text-[12px] font-bold">{s.produtoNome}</p>
        <p className="text-[10px] text-muted-foreground">
          {s.registrado}/{s.esperado} · {s.status}
        </p>
      </button>
    ))}
  </div>
</div>
```

```tsx
{/* Modal finalizar — DesossaPesagem.tsx:283+ — client usa fetch('/api/...') NUNCA fetchBackend */}
{modalFinalizar && (
  <Dialog open onOpenChange={setModalFinalizar}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Finalizar transformação</DialogTitle>
      </DialogHeader>
      {checklist.divergente ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Checklist divergente — registre o tipo antes de concluir.
          </p>
          <Select value={tipoDiv} onValueChange={setTipoDiv}>
            <SelectTrigger><SelectValue placeholder="Tipo de divergência" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="subpeca_faltante">Subpeça faltante</SelectItem>
              <SelectItem value="subpeca_excedente">Subpeça excedente</SelectItem>
              <SelectItem value="produto_diferente">Produto diferente</SelectItem>
              <SelectItem value="perda_informada">Perda informada</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            value={obsDiv}
            onChange={(e) => setObsDiv(e.target.value)}
            placeholder="Observação (ao menos 3 caracteres)"
          />
          <Button
            onClick={async () => {
              const rDiv = await fetch(`/api/operacao/corte/${transfId}/divergencia`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tipo: tipoDiv, detalhe: {}, observacao: obsDiv }),
              });
              if (!rDiv.ok) {
                setErro((await rDiv.json().catch(() => ({}))).message ?? 'Erro na divergência');
                return;
              }
              // BFF concluir já existe: app/frontend/src/app/api/operacao/corte/[id]/concluir/route.ts
              const rConc = await fetch(`/api/operacao/corte/${transfId}/concluir`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
              });
              if (!rConc.ok) {
                setErro((await rConc.json().catch(() => ({}))).message ?? 'Erro ao concluir');
                return;
              }
              setModalFinalizar(false);
            }}
          >
            Registrar divergência e concluir
          </Button>
        </div>
      ) : (
        <Button
          onClick={async () => {
            const r = await fetch(`/api/operacao/corte/${transfId}/concluir`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
            });
            if (!r.ok) {
              setErro((await r.json().catch(() => ({}))).message ?? 'Erro ao concluir');
              return;
            }
            setModalFinalizar(false);
          }}
        >
          Concluir
        </Button>
      )}
    </DialogContent>
  </Dialog>
)}
```

BFF divergência (criar — tip não tem rota BFF):

```ts
// app/frontend/src/app/api/operacao/corte/[id]/divergencia/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { data, error, status } = await fetchBackend(`/operacao/corte/${id}/divergencia`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status });
}
```

- [ ] **Step 4: Modais JSX literais** (`DesossaPesagem.tsx:121-279`)

```tsx
function ModalSelecionarTz({
  open,
  onClose,
  tzs,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  tzs: PecaElegivelDesossa[];
  onSelect: (pecaId: string) => void;
}) {
  const disponiveis = tzs.filter((t) => t.statusPeca === 'para_corte');
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md gap-0 bg-card p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-[15px] font-bold">Selecionar TZ para desossa</DialogTitle>
        </DialogHeader>
        <p className="px-5 pt-3 text-[12px] text-muted-foreground">
          Peças encaminhadas pela balança principal. Leia a etiqueta (QR) ou selecione manualmente.
        </p>
        <div className="flex flex-col divide-y divide-border p-2">
          {disponiveis.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              Nenhum TZ disponível para desossa.
            </p>
          ) : (
            disponiveis.map((t) => (
              <button
                key={t.pecaId}
                type="button"
                onClick={() => {
                  onSelect(t.pecaId);
                  onClose();
                }}
                className="flex items-start justify-between rounded-lg px-3 py-3 text-left hover:bg-muted/40"
              >
                <div>
                  <p className="font-mono text-[13px] font-bold">{t.etiquetaAtual ?? t.pecaId}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t.produtoCodigo ?? 'TZ'} · status {t.statusPeca}
                  </p>
                </div>
                <span className="mt-0.5 font-mono text-[13px] font-bold">
                  {t.pesoOriginal ? `${t.pesoOriginal} kg` : '—'}
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModalEtiquetaParte({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: {
    etiqueta: string;
    produto: string;
    peso: string;
    origemPeso: string;
    destino: string;
    pedido: string | null;
    tzOrigem: string;
    lote: string | null;
    nfe: string | null;
    fornecedor: string | null;
  } | null;
}) {
  if (!data) return null;
  const tipoEtq = data.destino === 'pedido' ? 'Parte para Pedido' : 'Parte para Estoque';
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm gap-0 bg-card p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-[15px] font-bold">Etiqueta gerada</DialogTitle>
        </DialogHeader>
        <div className="p-5">
          <div className="rounded-xl border-2 border-violet-600 bg-violet-surface p-4 font-mono">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{tipoEtq}</p>
            <p className="text-[18px] font-black text-violet-900">{data.produto}</p>
            <p className="text-[11px] text-violet-700">Origem: desossa</p>
            <div className="mt-3 grid grid-cols-2 gap-y-1.5 border-t border-dashed border-violet-200 pt-3 text-[11px]">
              <div>
                <span className="text-muted-foreground">Peso: </span>
                <span className="font-bold">{data.peso} kg</span>
              </div>
              <div>
                <span className="text-muted-foreground">Origem peso: </span>
                <span>{data.origemPeso}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Destino: </span>
                <span className="font-bold">{data.destino}</span>
              </div>
              {data.pedido ? (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Pedido: </span>
                  <span className="font-bold">{data.pedido}</span>
                </div>
              ) : null}
              <div className="col-span-2">
                <span className="text-muted-foreground">Peça mãe (TZ): </span>
                <span className="font-bold text-violet-800">{data.tzOrigem}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Lote: </span>
                <span>{data.lote ?? '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">NF-e: </span>
                <span>{data.nfe ?? '—'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Frigorífico: </span>
                <span>{data.fornecedor ?? '—'}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button type="button" className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-border text-[13px]">
            <Printer className="h-3.5 w-3.5" /> Reimprimir
          </button>
          <button type="button" onClick={onClose} className="h-8 flex-1 rounded-md bg-violet-800 text-[13px] font-semibold text-white">
            Fechar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModalCancelarAcao({
  open,
  onClose,
  acao,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  acao: {
    produto: string;
    peso: string;
    destino: string;
    hora: string;
    etiqueta: string;
    tzOrigem: string;
  } | null;
  onConfirm: (motivo: string, obs: string) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [obs, setObs] = useState('');
  if (!acao) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md gap-0 bg-card p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-[15px] font-bold">Cancelar registro de parte</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 p-5">
          <div className="grid grid-cols-2 gap-y-1.5 rounded-lg bg-muted/40 p-3 text-[12px]">
            <div>
              <span className="text-muted-foreground">Produto: </span>
              <span className="font-semibold">{acao.produto}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Peso: </span>
              <span className="font-semibold">{acao.peso}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Destino: </span>
              <span className="font-semibold">{acao.destino}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Hora: </span>
              <span className="font-semibold">{acao.hora}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Etiqueta: </span>
              <span className="font-semibold">{acao.etiqueta}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Peça mãe: </span>
              <span className="font-semibold text-violet-800">{acao.tzOrigem}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold">
              Motivo do cancelamento <span className="text-destructive">*</span>
            </label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="h-8 w-full rounded-md border border-border px-2.5 text-[13px]"
            >
              <option value="">Selecione o motivo</option>
              {[
                'Peso informado incorretamente',
                'Produto registrado incorretamente',
                'Pedido selecionado incorretamente',
                'Destino selecionado incorretamente',
                'Etiqueta impressa incorretamente',
                'Outro',
              ].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold">Observação</label>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-md border border-border px-2.5 py-2 text-[13px]"
            />
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-surface p-3">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-destructive" />
            <p className="text-[12px] text-danger-rose leading-snug">
              O cancelamento estorna a associação/destino da parte, invalida a etiqueta anterior e
              devolve a saída ao checklist da transformação.
            </p>
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button type="button" onClick={onClose} className="h-8 flex-1 rounded-md border border-border text-[13px]">
            Voltar
          </button>
          <button
            type="button"
            disabled={!motivo}
            onClick={() => {
              onConfirm(motivo, obs);
              onClose();
            }}
            className="h-8 flex-1 rounded-md bg-destructive text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Confirmar Cancelamento
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

Zero `ITENS_SEED`/`REGRAS_SEED`/`TZS_INICIAIS` em runtime. Grep de `fetchBackend` no client da pesagem = falha.

```bash
rg -n "fetchBackend" "app/frontend/src/app/(admin)/desossa" && echo FAIL || echo OK
# Expected: OK (fetchBackend só em app/api/** BFF)
```

- [ ] **Step 5: Commit** `feat(onda7): tela pesagem desossa fiel e pecas-elegiveis`

---

### Task 13 — UI Etiquetas desossa fiel

**Files:** `desossa-etiquetas-client.tsx`; page; consome `fetch('/api/desossa/etiquetas?operacaoId=')`.

**Protótipo pinado (ler ANTES de escrever):** `DesossaEtiquetas.tsx` @ `8d32aa4c`
- KPIs: `:597-610`
- Filtros Status com rótulos UI: `:620-623` (`Ativa`, `Reimpressa`, `Cancelada`, `Invalidada por troca`, `Pendente de impressão`, `Bloqueada`)
- Tabela 11 colunas: `:650` — Código, Parte, Produto, Peso, Origem peso, Destino, Cliente / Pedido, Peça mãe (TZ), Emissão, Status, ''
- Drawer Invalidada por troca: `:365-443` (alerta + Peça mãe)

- [ ] **Step 0 (Emenda 5): carregar listagem pelo envelope `Paginado.data`**

```tsx
// desossa-etiquetas-client.tsx — tip backend paginacao.ts / montarPaginado
// Espelhar em lib/desossa.ts (mesmo shape de lib/comercial.ts Paginado):
export type PaginadoEtiquetasDesossa = {
  data: EtiquetaDesossaListada[];
  total: number;
  page: number;
  pageSize: number;
};

const [etiquetas, setEtiquetas] = useState<EtiquetaDesossaListada[]>([]);
const [erro, setErro] = useState<string | null>(null);

const carregar = useCallback(async () => {
  if (!operacaoId) {
    setEtiquetas([]);
    return;
  }
  const res = await fetch(
    `/api/desossa/etiquetas?operacaoId=${encodeURIComponent(operacaoId)}`,
  );
  if (!res.ok) {
    setEtiquetas([]);
    setErro(
      (await res.json().catch(() => ({}))).message ??
        `Erro ao carregar etiquetas (${res.status})`,
    );
    return;
  }
  const json = (await res.json()) as PaginadoEtiquetasDesossa;
  // Emenda 5 / tip: montarPaginado → { data, total, page, pageSize }.
  // PROIBIDO: json.itens (undefined no tip; lista vazia silenciosa — RA-05).
  setEtiquetas(json.data);
  setErro(null);
}, [operacaoId]);

useEffect(() => {
  void carregar();
}, [carregar]);
```

```bash
rg -n "json\.itens|body\.itens|\.itens\b" "app/frontend/src/app/(admin)/desossa/etiquetas" && echo FAIL || echo OK
# Expected: OK (só json.data / setEtiquetas(json.data))
```

```tsx
/** Wire → rótulo protótipo DesossaEtiquetas.tsx:11 / :623 */
function rotuloStatusEtiqueta(e: EtiquetaDesossaListada): string {
  if (e.bloqueada) return 'Bloqueada';
  if (e.pendenteImpressao) return 'Pendente de impressão';
  const mapa: Record<string, string> = {
    emitida: 'Ativa',
    ativa: 'Ativa',
    reimpressa: 'Reimpressa',
    cancelada: 'Cancelada',
    invalidada_por_troca: 'Invalidada por troca',
  };
  return mapa[e.estado] ?? e.estado;
}

function StatusBadge({ etq }: { etq: EtiquetaDesossaListada }) {
  return <Badge variant="outline">{rotuloStatusEtiqueta(etq)}</Badge>;
}

function OrigemPesoBadge({ origem }: { origem: string | null }) {
  const label = origem === 'balanca' ? 'Balança' : origem === 'manual' ? 'Manual' : origem ?? '—';
  return <Badge variant="outline">{label}</Badge>;
}

{/* KPIs — DesossaEtiquetas.tsx:597-603 */}
<div className="grid grid-cols-5 gap-4">
  {[
    { label: 'Emitidas', value: stats.emitidas, color: 'text-violet-800' },
    { label: 'Reimpressões', value: stats.reimpressoes, color: 'text-info-ink' },
    { label: 'Canceladas', value: stats.canceladas, color: 'text-muted-foreground' },
    { label: 'Invalidadas por troca', value: stats.invalidadas, color: 'text-destructive' },
    { label: 'Pendentes de impressão', value: stats.pendentes, color: 'text-warning-ink' },
  ].map((k) => (
    <div key={k.label} className="rounded-xl border border-border bg-card px-5 py-4">
      <p className="mb-1 text-[11px] font-medium text-muted-foreground">{k.label}</p>
      <p className={`text-[28px] font-black leading-none ${k.color}`}>{k.value}</p>
    </div>
  ))}
</div>

{/* Filtros — rótulos literais do protótipo :623 (NÃO códigos wire no <option>) */}
<div className="flex flex-wrap items-center gap-2">
  <input
    type="text"
    value={busca}
    onChange={(e) => setBusca(e.target.value)}
    placeholder="Buscar por etiqueta, parte, cliente, TZ, lote ou NF"
    className="h-8 min-w-[220px] flex-1 rounded-md border border-border bg-card px-3 text-[13px]"
  />
  <select value={filtroProduto} onChange={(e) => setFiltroProduto(e.target.value)} className="h-8 rounded-md border border-border px-2.5 text-[13px]">
    {['Todos', 'Coxão-bola', 'Jacaré', 'Coxão-bola com alcatra', 'Filé curto'].map((o) => (
      <option key={o} value={o}>{o === 'Todos' ? 'Produto: Todos' : o}</option>
    ))}
  </select>
  <select value={filtroDestino} onChange={(e) => setFiltroDestino(e.target.value)} className="h-8 rounded-md border border-border px-2.5 text-[13px]">
    {['Todos', 'Pedido', 'Estoque'].map((o) => (
      <option key={o} value={o}>{o === 'Todos' ? 'Destino: Todos' : o}</option>
    ))}
  </select>
  <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="h-8 rounded-md border border-border px-2.5 text-[13px]">
    {[
      'Todos',
      'Ativa',
      'Reimpressa',
      'Cancelada',
      'Invalidada por troca',
      'Pendente de impressão',
      'Bloqueada',
    ].map((o) => (
      <option key={o} value={o}>{o === 'Todos' ? 'Status: Todos' : o}</option>
    ))}
  </select>
  <select value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value)} className="h-8 rounded-md border border-border px-2.5 text-[13px]">
    {['Todos', 'Hoje', 'Ontem', 'Últimos 7 dias'].map((o) => (
      <option key={o} value={o}>{o === 'Todos' ? 'Período: Todos' : o}</option>
    ))}
  </select>
</div>

{/* Tabela 11 cols — DesossaEtiquetas.tsx:650 */}
<table className="w-full text-[12px]">
  <thead>
    <tr className="border-b border-border bg-muted/40">
      {[
        'Código',
        'Parte',
        'Produto',
        'Peso',
        'Origem peso',
        'Destino',
        'Cliente / Pedido',
        'Peça mãe (TZ)',
        'Emissão',
        'Status',
        '',
      ].map((h) => (
        <th
          key={h || 'acoes'}
          className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
        >
          {h}
        </th>
      ))}
    </tr>
  </thead>
  <tbody>
    {filtradas.map((e) => {
      const inativa = e.estado === 'cancelada' || e.estado === 'invalidada_por_troca';
      return (
        <tr
          key={e.id}
          onClick={() => setDrawer(e)}
          className={`cursor-pointer border-b border-border/60 hover:bg-violet-surface/40 ${inativa ? 'opacity-50' : ''}`}
        >
          <td className="px-4 py-2.5">
            <span className={`rounded bg-violet-surface px-1.5 py-0.5 font-mono text-[11px] font-bold text-violet-800 ${inativa ? 'line-through' : ''}`}>
              {e.codigo}
            </span>
          </td>
          <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{e.parteCodigo ?? '—'}</td>
          <td className="px-4 py-2.5 font-bold text-violet-800">{e.produtoNome}</td>
          <td className="px-4 py-2.5 font-mono text-muted-foreground">{e.peso ?? '—'}</td>
          <td className="px-4 py-2.5"><OrigemPesoBadge origem={e.origemPeso} /></td>
          <td className="px-4 py-2.5">{e.destino === 'pedido' ? 'Pedido' : 'Estoque'}</td>
          <td className="max-w-[180px] truncate px-4 py-2.5 text-muted-foreground">{e.clientePedido ?? '—'}</td>
          <td className="px-4 py-2.5 font-mono text-[11px] text-violet-700">{e.pecaMaeCodigo ?? '—'}</td>
          <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
            {new Date(e.createdAt).toLocaleString('pt-BR')}
          </td>
          <td className="px-4 py-2.5"><StatusBadge etq={e} /></td>
          <td className="px-4 py-2.5" onClick={(ev) => ev.stopPropagation()}>
            <button type="button" title="Visualizar" onClick={() => setDrawer(e)}>
              <Eye className="h-3.5 w-3.5" />
            </button>
          </td>
        </tr>
      );
    })}
  </tbody>
</table>

{/* Drawer — DesossaEtiquetas.tsx:365-443 */}
{drawer && (
  <Sheet open onOpenChange={() => setDrawer(null)}>
    <SheetContent side="right" className="w-[560px] max-w-full p-0">
      <SheetHeader className="border-b px-6 py-4">
        <SheetTitle>Etiqueta {drawer.codigo}</SheetTitle>
        <StatusBadge etq={drawer} />
      </SheetHeader>
      <div className="flex flex-col gap-6 p-6">
        {drawer.estado === 'invalidada_por_troca' && (
          <div className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-surface p-3">
            <RefreshCcw className="mt-0.5 h-4 w-4 text-destructive" />
            <p className="text-[12px] text-danger-rose">
              Esta etiqueta foi invalidada em razão de uma troca de peça (v1.1 §10.4). Uma nova
              etiqueta foi emitida para a peça correta — consulte o histórico.
            </p>
          </div>
        )}
        <div>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Rastreabilidade
          </p>
          <div className="grid grid-cols-2 gap-y-2 rounded-lg border border-violet-200 bg-violet-surface p-4 text-[12px]">
            <div className="col-span-2">
              <span className="text-muted-foreground">Peça mãe (TZ): </span>
              <span className="font-mono font-bold text-violet-800">{drawer.pecaMaeCodigo}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Parte: </span>
              <span className="font-mono">{drawer.parteCodigo ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Origem peso: </span>
              <span>{drawer.origemPeso === 'balanca' ? 'Balança' : drawer.origemPeso === 'manual' ? 'Manual' : drawer.origemPeso ?? '—'}</span>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Cliente / Pedido: </span>
              <span className="font-bold">{drawer.clientePedido ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Transformação: </span>
              <span className="font-mono">{drawer.transformacaoId}</span>
            </div>
          </div>
        </div>
      </div>
    </SheetContent>
  </Sheet>
)}
```

Filtro client-side por rótulo: `filtradas = etiquetas.filter(e => filtroStatus === 'Todos' || rotuloStatusEtiqueta(e) === filtroStatus)`. Stats derivados de `etiquetas` (= `json.data` do Step 0 — emitidas = `estado` em emitida/ativa/reimpressa; invalidadas = `invalidada_por_troca`; pendentes = `pendenteImpressao`). Zero `SEED`/`ETQ_SEED` em runtime.

```bash
rg -n "Peça mãe \(TZ\)|Pendente de impressão|Origem peso|Cliente / Pedido" "app/frontend/src/app/(admin)/desossa/etiquetas"
# Expected: hits nos rótulos do thead/filtros
```

- [ ] Commit: `feat(onda7): tela etiquetas da desossa fiel ao protótipo`

### Task 14 — Testes DoD, e2e, evidências, grep Marca

**Files:** `test/integration/onda7-desossa.spec.ts`, `e2e/onda7-desossa.spec.ts`, scripts capture, `docs/evidencias/onda7-desossa/README.md`.

E2E obrigatório:
1. Login perfil `corte`
2. `/desossa/dashboard` — KPI «TZs na desossa» + copy anti-"em produção"; status WS; colunas Rota/Carga+Representante+Alvo
3. Modo TV acionável com coluna «CARGA / HORÁRIO»
4. `/desossa/pesagem-destinacao` — não placeholder; Badge Provisório; modais TZ/etiqueta/cancelar
5. `/desossa/etiquetas` — 11 colunas incl. Parte, Origem peso, Cliente/Pedido, Peça mãe; filtros por rótulo UI

- [ ] **Step DoD 7.14b: cerca literal RBAC `pecas-elegiveis` / `@RequireQualquerPermissao`**

```ts
// test/integration/onda7-desossa.spec.ts
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';

describe('DoD 7.14b — pecas-elegiveis RequireQualquerPermissao', () => {
  it('comercial (DESOSSA_PAINEL_LER, sem CORTE_GERENCIAR) → 200', async () => {
    // MAPA: comercial recebe DESOSSA_PAINEL_LER + DESOSSA_LER; NÃO recebe CORTE_GERENCIAR
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const cookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    const res = await request(app.getHttpServer())
      .get(`/operacao/corte/pecas-elegiveis?operacaoId=${operacaoId}`)
      .set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('perfil sem nenhuma das 3 perms (faturamento) → 403', async () => {
    // faturamento: zero DESOSSA_PAINEL_LER / DESOSSA_LER / CORTE_GERENCIAR no MAPA Onda 7
    const fat = await createTestUser(app, { perfil: 'faturamento' });
    const cookies = await loginCookies(app, fat.adminEmail, fat.adminPassword);
    const res = await request(app.getHttpServer())
      .get(`/operacao/corte/pecas-elegiveis?operacaoId=${operacaoId}`)
      .set('Cookie', cookies);
    expect(res.status).toBe(403);
  });
});
```

```bash
cd app/backend && npx jest test/integration/onda7-desossa.spec.ts -t "DoD 7.14b"
# Expected: PASS (comercial 200; faturamento 403)
```

Gate regressão Task 11 (RA-05 — não engolir 403):

```bash
rg -n "tzRes\.status !== 403" "app/frontend/src/app/(admin)/desossa" && echo FAIL || echo OK
# Expected: OK (zero hits — Emenda 4)
rg -n "ci\.peca_id = \$\{pecas\.id\}|etiquetaBloqueadaSql" "app/backend/src/modules/operacao/desossa" && echo FAIL || echo OK
# Expected: OK (bloqueada só via subitem_id; sem cópia cega O6)
```

```bash
cd app/backend && npm run test:cov
cd app/frontend && npm run test && npx playwright test e2e/onda7-desossa.spec.ts
rg -n "\bMarca\b" "app/frontend/src/app/(admin)/desossa" && echo FAIL || echo OK
# Expected: coverage ≥80%; e2e PASS; grep OK
```

- [ ] Commit: `test(onda7): DoD exclusividade, checklist, divergência, e2e e evidências`

---

### Task 16 — Emenda 7: desbloquear Gate local (suítes legadas + meta + probe O4)

> Task do **Worker na branch `feature/onda7-desossa`** (tip base `34524a4` ou tip atual). **Não** altera regras de negócio O7; só testa/helpers/meta para herdarem DoD 7.6/7.7/7.9.
> Executar **antes** do Gate final da Task 15 (`test:cov`). Após verde, seguir Task 15 (PR impl).

**Files:**
- Replace: `app/backend/test/helpers/corte-fixtures.ts`
- Modify: `app/backend/test/integration/corte.e2e-spec.ts`
- Modify: `app/backend/test/integration/subitens.e2e-spec.ts`
- Modify: `app/backend/test/integration/reetiqueta-subitem.e2e-spec.ts`
- Modify: `app/backend/test/integration/corte-concorrencia.e2e-spec.ts`
- **Não** modificar (herdam Step A): `expedicao.e2e-spec.ts`, `faturamento.e2e-spec.ts`, `rastreabilidade-corte.e2e-spec.ts`, `conferencia.e2e-spec.ts` — se Step G falhar nesses arquivos, **parar e reportar** (não improvisar patch)
- Modify: `app/backend/test/unit/corte-branches.spec.ts`
- Modify: `app/backend/test/unit/onda6-migrations-meta.spec.ts`
- Modify: `app/backend/test/integration/onda4-migrations.e2e-spec.ts`
- Create: `app/backend/test/helpers/fixtures/transformacoes.schema.pre-onda7.ts`
- Create: `app/backend/test/helpers/fixtures/regras-transformacao.schema.pre-onda7.ts`
- (Step H, após cov verde) Create/commit: `app/frontend/scripts/capture-onda7-app.mjs`, `capture-onda7-prototipo.mjs` + PNGs em `docs/evidencias/onda7-desossa/`

- [ ] **Step A: Substituir `corte-fixtures.ts` pelo arquivo literal abaixo (O7-aware)**

```ts
// app/backend/test/helpers/corte-fixtures.ts
import type { INestApplication } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { seedCatalogoMvp } from '../../src/database/seed-catalogo-mvp';
import { seedRegrasTransformacaoTz } from '../../src/database/seed-regras-transformacao-tz';

type Db = NodePgDatabase<typeof schema>;

function dbOf(app: INestApplication): Db {
  return app.get<{ db: Db }>(DRIZZLE).db;
}

/**
 * Emenda 7 — seed Task 2 (catálogo MVP + regras TZ A/B) e devolve
 * legadoItemComercialId do produto CB (saída canônica Alternativa A).
 */
export async function itemSaidaCanonicoCb(app: INestApplication): Promise<string> {
  const db = dbOf(app);
  await seedCatalogoMvp(db);
  await seedRegrasTransformacaoTz(db);
  const [saidaCb] = await db
    .select({ itemComercialId: schema.produtos.legadoItemComercialId })
    .from(schema.produtos)
    .where(and(eq(schema.produtos.codigo, 'CB'), isNull(schema.produtos.deletedAt)))
    .limit(1);
  if (!saidaCb?.itemComercialId) {
    throw new Error('Produto CB seed sem legadoItemComercialId (catálogo MVP / Task 2)');
  }
  return saidaCb.itemComercialId;
}

/**
 * Emenda 7 — seed + bind TZ_A na transformação; devolve ids de saída CB/JAC.
 * Idempotente: re-bind da mesma TZ_A com subitens já existentes é permitido pelo tip.
 */
export async function prepararTransformacaoComRegraTzA(
  app: INestApplication,
  cookies: string,
  transformacaoId: string,
): Promise<{ regraId: string; itemSaidaCbId: string; itemSaidaJacId: string }> {
  const { default: request } = await import('supertest');
  const db = dbOf(app);
  await seedCatalogoMvp(db);
  await seedRegrasTransformacaoTz(db);

  const [regraA] = await db
    .select({ id: schema.regrasTransformacao.id })
    .from(schema.regrasTransformacao)
    .where(
      and(
        eq(schema.regrasTransformacao.codigo, 'TZ_A'),
        isNull(schema.regrasTransformacao.deletedAt),
      ),
    )
    .limit(1);
  if (!regraA) {
    throw new Error('Regra seed TZ_A ausente — rode seedRegrasTransformacaoTz (Task 2)');
  }

  const bind = await request(app.getHttpServer())
    .post(`/operacao/corte/${transformacaoId}/regra`)
    .set('Cookie', cookies)
    .send({ regraTransformacaoId: regraA.id });
  if (bind.status !== 200 && bind.status !== 201) {
    throw new Error(
      `Falha ao vincular TZ_A na transformação: ${bind.status} ${JSON.stringify(bind.body)}`,
    );
  }

  const [saidaCb] = await db
    .select({ itemComercialId: schema.produtos.legadoItemComercialId })
    .from(schema.produtos)
    .where(and(eq(schema.produtos.codigo, 'CB'), isNull(schema.produtos.deletedAt)))
    .limit(1);
  const [saidaJac] = await db
    .select({ itemComercialId: schema.produtos.legadoItemComercialId })
    .from(schema.produtos)
    .where(and(eq(schema.produtos.codigo, 'JAC'), isNull(schema.produtos.deletedAt)))
    .limit(1);
  if (!saidaCb?.itemComercialId || !saidaJac?.itemComercialId) {
    throw new Error('Produtos CB/JAC seed sem legadoItemComercialId (catálogo MVP / Task 2)');
  }
  return {
    regraId: regraA.id,
    itemSaidaCbId: saidaCb.itemComercialId,
    itemSaidaJacId: saidaJac.itemComercialId,
  };
}

/** Se item informado já é saída da regra, mantém; senão CB (Emenda 6/7). */
export function resolverItemSaidaRegra(
  itemComercialId: string,
  saidas: { itemSaidaCbId: string; itemSaidaJacId: string },
): string {
  if (
    itemComercialId === saidas.itemSaidaCbId ||
    itemComercialId === saidas.itemSaidaJacId
  ) {
    return itemComercialId;
  }
  return saidas.itemSaidaCbId;
}

/**
 * Emenda 7 — alinha `pedidos_venda_itens.item_comercial_id` à saída efetiva
 * para `associar` não falhar com "Item de pedido incompatível".
 */
export async function alinharPedidoItemComSaidaCorte(
  app: INestApplication,
  pedidoVendaItemId: string,
  itemSaidaId: string,
): Promise<void> {
  const db = dbOf(app);
  const [item] = await db
    .select({
      id: schema.pedidosVendaItens.id,
      itemComercialId: schema.pedidosVendaItens.itemComercialId,
    })
    .from(schema.pedidosVendaItens)
    .where(eq(schema.pedidosVendaItens.id, pedidoVendaItemId))
    .limit(1);
  if (!item) {
    throw new Error(`Pedido item ${pedidoVendaItemId} ausente para alinhar saída O7`);
  }
  if (item.itemComercialId === itemSaidaId) return;
  await db
    .update(schema.pedidosVendaItens)
    .set({ itemComercialId: itemSaidaId, updatedAt: new Date() })
    .where(eq(schema.pedidosVendaItens.id, pedidoVendaItemId));
}

/**
 * Emenda 7 / DoD 7.9 — se checklist divergente sem divergência aberta,
 * abre `subpeca_faltante` (TZ_A incompleta é o caso legado típico).
 */
export async function fecharChecklistSeDivergente(
  app: INestApplication,
  cookies: string,
  transformacaoId: string,
): Promise<void> {
  const { default: request } = await import('supertest');
  const chk = await request(app.getHttpServer())
    .get(`/operacao/corte/${transformacaoId}/checklist`)
    .set('Cookie', cookies);
  if (chk.status !== 200) {
    throw new Error(
      `Falha ao obter checklist: ${chk.status} ${JSON.stringify(chk.body)}`,
    );
  }
  if (chk.body.divergente && !chk.body.divergenciaAbertaId) {
    const div = await request(app.getHttpServer())
      .post(`/operacao/corte/${transformacaoId}/divergencia`)
      .set('Cookie', cookies)
      .send({
        tipo: 'subpeca_faltante',
        detalhe: { origem: 'fixture-legado-onda7' },
        observacao: 'Fixture legada: checklist incompleto vs regra TZ_A',
      });
    if (div.status !== 200 && div.status !== 201) {
      throw new Error(
        `Falha ao abrir divergência de transformação: ${div.status} ${JSON.stringify(div.body)}`,
      );
    }
  }
}

/** Conclui corte fechando checklist (DoD 7.9) quando necessário. */
export async function concluirCorteOnda7(
  app: INestApplication,
  cookies: string,
  transformacaoId: string,
  body: Record<string, unknown> = {},
) {
  const { default: request } = await import('supertest');
  await fecharChecklistSeDivergente(app, cookies, transformacaoId);
  return request(app.getHttpServer())
    .post(`/operacao/corte/${transformacaoId}/concluir`)
    .set('Cookie', cookies)
    .send(body);
}

/** Inicia um corte sobre uma peça e retorna o id da transformação. */
export async function iniciarCorte(
  app: INestApplication,
  cookies: string,
  pecaId: string,
  body: Partial<{ tipoTransformacao: string; motivo: string; motivoDetalhe: string }> = {},
): Promise<string> {
  const { default: request } = await import('supertest');
  const res = await request(app.getHttpServer())
    .post(`/operacao/corte/pecas/${pecaId}/iniciar`)
    .set('Cookie', cookies)
    .send({
      tipoTransformacao: body.tipoTransformacao ?? 'subdivisao',
      motivo: body.motivo ?? 'necessidade_operacional',
      motivoDetalhe: body.motivoDetalhe,
    });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(
      `Falha ao iniciar corte: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  if (!res.body?.id) {
    throw new Error(`iniciarCorte sem id: ${JSON.stringify(res.body)}`);
  }
  return res.body.id as string;
}

/**
 * Gera um subitem na transformação; retorna o id.
 * Emenda 7: bind TZ_A + remapeia item fora das saídas → CB.
 */
export async function adicionarSubitem(
  app: INestApplication,
  cookies: string,
  transformacaoId: string,
  itemComercialId: string,
): Promise<string> {
  const { default: request } = await import('supertest');
  const saidas = await prepararTransformacaoComRegraTzA(app, cookies, transformacaoId);
  const itemEfetivo = resolverItemSaidaRegra(itemComercialId, saidas);
  const res = await request(app.getHttpServer())
    .post(`/operacao/corte/${transformacaoId}/subitens`)
    .set('Cookie', cookies)
    .send({ itemComercialId: itemEfetivo });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(
      `Falha ao adicionar subitem: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  if (!res.body?.id) {
    throw new Error(`adicionarSubitem sem id: ${JSON.stringify(res.body)}`);
  }
  return res.body.id as string;
}

/** Pesa um subitem (automático por padrão). Retorna a resposta completa. */
export async function pesarSubitem(
  app: INestApplication,
  cookies: string,
  subitemId: string,
  body: Record<string, unknown> = { modoCaptura: 'automatico' },
) {
  const { default: request } = await import('supertest');
  return request(app.getHttpServer())
    .post(`/operacao/corte/subitens/${subitemId}/pesar`)
    .set('Cookie', cookies)
    .send(body);
}

/**
 * Leva um subitem até 'associado' + etiqueta emitida — destino completo para concluir.
 * Emenda 7: bind+saída+alinha pedidoVendaItemId à saída efetiva (DoD 7.6/7.7).
 */
export async function subitemCompleto(
  app: INestApplication,
  cookies: string,
  transformacaoId: string,
  itemComercialId: string,
  pedidoVendaItemId: string,
): Promise<string> {
  const { default: request } = await import('supertest');
  const saidas = await prepararTransformacaoComRegraTzA(app, cookies, transformacaoId);
  const itemEfetivo = resolverItemSaidaRegra(itemComercialId, saidas);
  await alinharPedidoItemComSaidaCorte(app, pedidoVendaItemId, itemEfetivo);

  const resAdd = await request(app.getHttpServer())
    .post(`/operacao/corte/${transformacaoId}/subitens`)
    .set('Cookie', cookies)
    .send({ itemComercialId: itemEfetivo });
  if (resAdd.status !== 200 && resAdd.status !== 201) {
    throw new Error(
      `Falha ao adicionar subitem (completo): ${resAdd.status} ${JSON.stringify(resAdd.body)}`,
    );
  }
  const subitemId = resAdd.body.id as string;
  if (!subitemId) {
    throw new Error(`subitemCompleto sem id: ${JSON.stringify(resAdd.body)}`);
  }

  await pesarSubitem(app, cookies, subitemId);
  const assoc = await request(app.getHttpServer())
    .post(`/operacao/corte/subitens/${subitemId}/associar`)
    .set('Cookie', cookies)
    .send({ pedidoVendaItemId });
  if (assoc.status !== 200 && assoc.status !== 201) {
    throw new Error(
      `Falha ao associar subitem: ${assoc.status} ${JSON.stringify(assoc.body)}`,
    );
  }
  const etiq = await request(app.getHttpServer())
    .post(`/operacao/corte/subitens/${subitemId}/etiqueta`)
    .set('Cookie', cookies)
    .send();
  if (etiq.status !== 200 && etiq.status !== 201) {
    throw new Error(
      `Falha ao emitir etiqueta de subitem: ${etiq.status} ${JSON.stringify(etiq.body)}`,
    );
  }
  return subitemId;
}
```

```bash
cd app/backend && npx tsc --noEmit -p tsconfig.json 2>&1 | head -40
# Expected: sem erro apontando corte-fixtures.ts
```

- [ ] **Step B: Patches literais — `corte.e2e-spec.ts` (concluir com sucesso via `concluirCorteOnda7`)**

Import:

```ts
# old_string
import { iniciarCorte, adicionarSubitem, pesarSubitem, subitemCompleto } from '../helpers/corte-fixtures';
# new_string
import {
  iniciarCorte,
  adicionarSubitem,
  pesarSubitem,
  subitemCompleto,
  concluirCorteOnda7,
  fecharChecklistSeDivergente,
} from '../helpers/corte-fixtures';
```

Conservação de peso (Σ > original) — trocar `subitemCompleto`+`concluir` de sucesso:

```ts
# old_string
    fakes(app).balanca.definirPeso('13.000');
    await subitemCompleto(app, corteCookies, transfId, c.itemComercialId, p.pedidoItemId);

    const semJust = await request(srv()).post(`/operacao/corte/${transfId}/concluir`).set('Cookie', corteCookies).send({});
    expect(semJust.status).toBe(409);

    const comJust = await request(srv())
      .post(`/operacao/corte/${transfId}/concluir`)
      .set('Cookie', corteCookies)
      .send({ justificativaDiferenca: 'ganho por hidratação medido' });
    expect(comJust.status).toBe(201);
    expect(comJust.body.statusTransformacao).toBe('concluida');
# new_string
    fakes(app).balanca.definirPeso('13.000');
    await subitemCompleto(app, corteCookies, transfId, c.itemComercialId, p.pedidoItemId);

    // Emenda 7: fechar checklist (DoD 7.9) antes de exercitar justificativa de peso
    await fecharChecklistSeDivergente(app, corteCookies, transfId);

    const semJust = await request(srv()).post(`/operacao/corte/${transfId}/concluir`).set('Cookie', corteCookies).send({});
    expect(semJust.status).toBe(409);

    const comJust = await concluirCorteOnda7(app, corteCookies, transfId, {
      justificativaDiferenca: 'ganho por hidratação medido',
    });
    expect(comJust.status).toBe(201);
    expect(comJust.body.statusTransformacao).toBe('concluida');
```

Conservação de peso (perda):

```ts
# old_string
    fakes(app).balanca.definirPeso('10.000'); // perda de 2.500
    await subitemCompleto(app, corteCookies, transfId, c.itemComercialId, p.pedidoItemId);

    const semJust = await request(srv()).post(`/operacao/corte/${transfId}/concluir`).set('Cookie', corteCookies).send({});
    expect(semJust.status).toBe(409);

    const comJust = await request(srv())
      .post(`/operacao/corte/${transfId}/concluir`)
      .set('Cookie', corteCookies)
      .send({ justificativaDiferenca: 'apara removida conforme padrão' });
    expect(comJust.status).toBe(201);
# new_string
    fakes(app).balanca.definirPeso('10.000'); // perda de 2.500
    await subitemCompleto(app, corteCookies, transfId, c.itemComercialId, p.pedidoItemId);

    await fecharChecklistSeDivergente(app, corteCookies, transfId);

    const semJust = await request(srv()).post(`/operacao/corte/${transfId}/concluir`).set('Cookie', corteCookies).send({});
    expect(semJust.status).toBe(409);

    const comJust = await concluirCorteOnda7(app, corteCookies, transfId, {
      justificativaDiferenca: 'apara removida conforme padrão',
    });
    expect(comJust.status).toBe(201);
```

Conclusão idempotente (dois subitens) — caminho único (sem bifurcação):

```ts
# old_string
    fakes(app).balanca.definirPeso('6.250');
    await subitemCompleto(app, corteCookies, transfId, c.itemComercialId, p.pedidoItemId);
    await subitemCompleto(app, corteCookies, transfId, c.itemComercialId, p.pedidoItemId);

    const ok = await request(srv()).post(`/operacao/corte/${transfId}/concluir`).set('Cookie', corteCookies).send({});
    expect(ok.status).toBe(201);
# new_string
    fakes(app).balanca.definirPeso('6.250');
    await subitemCompleto(app, corteCookies, transfId, c.itemComercialId, p.pedidoItemId);
    await subitemCompleto(app, corteCookies, transfId, c.itemComercialId, p.pedidoItemId);

    // Emenda 7 / DoD 7.9: 2× CB deixa JAC pendente → concluirCorteOnda7 abre divergência
    const ok = await concluirCorteOnda7(app, corteCookies, transfId, {});
    expect(ok.status).toBe(201);
```

Destinação mista — trocar só o concluir final:

```ts
# old_string
    // Concluir com Σ = peso_original (6.250 × 2 = 12.500 → sem justificativa)
    const ok = await request(srv()).post(`/operacao/corte/${transfId}/concluir`).set('Cookie', corteCookies).send({});
    expect(ok.status).toBe(201);
    expect(ok.body.statusTransformacao).toBe('concluida');
    expect(ok.body.diferencaPeso).toBe('0.000');
# new_string
    // Emenda 7: DoD 7.9 — fechar checklist antes do 201
    const ok = await concluirCorteOnda7(app, corteCookies, transfId, {});
    expect(ok.status).toBe(201);
    expect(ok.body.statusTransformacao).toBe('concluida');
    expect(ok.body.diferencaPeso).toBe('0.000');
```

Testes que **esperam** 409 em `concluir` (sem destino / sem etiqueta) **não** usam `concluirCorteOnda7` — o 409 de `CHECKLIST_DIVERGENTE` ou de destino/etiqueta permanece aceitável (`expect(res.status).toBe(409)`).

- [ ] **Step C: Patches literais — suítes com `adicionarSubitem` + `associar` manual**

#### `reetiqueta-subitem.e2e-spec.ts`

```ts
# old_string
import { iniciarCorte, adicionarSubitem, pesarSubitem } from '../helpers/corte-fixtures';
# new_string
import {
  iniciarCorte,
  adicionarSubitem,
  pesarSubitem,
  itemSaidaCanonicoCb,
  alinharPedidoItemComSaidaCorte,
} from '../helpers/corte-fixtures';
```

```ts
# old_string
    const p = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId, dataOperacao: c.dataOperacao, quantidade: 5 });
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    const subId = await adicionarSubitem(app, corteCookies, transfId, c.itemComercialId);
    await pesarSubitem(app, corteCookies, subId);
    await request(srv()).post(`/operacao/corte/subitens/${subId}/associar`).set('Cookie', corteCookies).send({ pedidoVendaItemId: p.pedidoItemId });
# new_string
    const itemSaidaCbId = await itemSaidaCanonicoCb(app);
    const p = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: c.clienteId, itemComercialId: itemSaidaCbId, dataOperacao: c.dataOperacao, quantidade: 5 });
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    const subId = await adicionarSubitem(app, corteCookies, transfId, itemSaidaCbId);
    await pesarSubitem(app, corteCookies, subId);
    await alinharPedidoItemComSaidaCorte(app, p.pedidoItemId, itemSaidaCbId);
    await request(srv()).post(`/operacao/corte/subitens/${subId}/associar`).set('Cookie', corteCookies).send({ pedidoVendaItemId: p.pedidoItemId });
```

#### `corte-concorrencia.e2e-spec.ts`

```ts
# old_string
import { iniciarCorte, adicionarSubitem, pesarSubitem } from '../helpers/corte-fixtures';
# new_string
import {
  iniciarCorte,
  adicionarSubitem,
  pesarSubitem,
  itemSaidaCanonicoCb,
  alinharPedidoItemComSaidaCorte,
} from '../helpers/corte-fixtures';
```

```ts
# old_string
    const saldo = 3;
    const total = 6;
    const { pedidoItemId } = await criarPedido(app, comercialCookies, {
      compraId: c.compraId,
      clienteId: c.clienteId,
      itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao,
      quantidade: saldo,
    });

    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);

    const subIds: string[] = [];
    for (let i = 0; i < total; i++) {
      const subId = await adicionarSubitem(app, corteCookies, transfId, c.itemComercialId);
      await pesarSubitem(app, corteCookies, subId);
      subIds.push(subId);
    }
# new_string
    const saldo = 3;
    const total = 6;
    const itemSaidaCbId = await itemSaidaCanonicoCb(app);
    const { pedidoItemId } = await criarPedido(app, comercialCookies, {
      compraId: c.compraId,
      clienteId: c.clienteId,
      itemComercialId: itemSaidaCbId,
      dataOperacao: c.dataOperacao,
      quantidade: saldo,
    });

    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    await alinharPedidoItemComSaidaCorte(app, pedidoItemId, itemSaidaCbId);

    const subIds: string[] = [];
    for (let i = 0; i < total; i++) {
      const subId = await adicionarSubitem(app, corteCookies, transfId, itemSaidaCbId);
      await pesarSubitem(app, corteCookies, subId);
      subIds.push(subId);
    }
```

#### `subitens.e2e-spec.ts`

```ts
# old_string
import { iniciarCorte, adicionarSubitem, pesarSubitem } from '../helpers/corte-fixtures';
# new_string
import {
  iniciarCorte,
  adicionarSubitem,
  pesarSubitem,
  itemSaidaCanonicoCb,
  alinharPedidoItemComSaidaCorte,
  prepararTransformacaoComRegraTzA,
} from '../helpers/corte-fixtures';
```

Teste pesar (1º it) — após `iniciarCorte`, usar saída CB:

```ts
# old_string
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    const subId = await adicionarSubitem(app, corteCookies, transfId, c.itemComercialId);

    fakes(app).balanca.definirStatus('indisponivel');
# new_string
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    const itemSaidaCbId = await itemSaidaCanonicoCb(app);
    const subId = await adicionarSubitem(app, corteCookies, transfId, itemSaidaCbId);

    fakes(app).balanca.definirStatus('indisponivel');
```

Teste reclassificação — **PROIBIDO** inventar item fora da regra (DoD 7.7). Usar **JAC** como “item2” (saída TZ_A distinta de CB):

```ts
# old_string
  it('associar subitem reclassificado consome unidade do item correto (não o item base da peça)', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-11-02');

    // Segundo item comercial para reclassificação
    const [item2] = await db()
      .insert(schema.itensComerciais)
      .values({ codigo: `ICOM2-${Date.now()}`, descricao: 'Traseiro', unidadeComercial: 'parte' })
      .returning();
    if (!item2) throw new Error('falha ao criar item2');

    // Pedido no item2 (alvo da reclassificação)
    const pedido2 = await criarPedido(app, comercialCookies, {
      compraId: c.compraId,
      clienteId: c.clienteId,
      itemComercialId: item2.id,
      dataOperacao: c.dataOperacao,
      quantidade: 2,
    });
    // Pedido no item base (não deve ser consumido)
    const pedidoBase = await criarPedido(app, comercialCookies, {
      compraId: c.compraId,
      clienteId: c.clienteId,
      itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao,
      quantidade: 2,
    });

    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    const subId = await adicionarSubitem(app, corteCookies, transfId, item2.id); // reclassifica
    await pesarSubitem(app, corteCookies, subId);

    // Tentar associar ao item base → incompatível
    const incompat = await request(srv())
      .post(`/operacao/corte/subitens/${subId}/associar`)
      .set('Cookie', corteCookies)
      .send({ pedidoVendaItemId: pedidoBase.pedidoItemId });
    expect(incompat.status).toBe(409);

    // Associar ao item2 → ok, consome a unidade de item2
    const ok = await request(srv())
      .post(`/operacao/corte/subitens/${subId}/associar`)
      .set('Cookie', corteCookies)
      .send({ pedidoVendaItemId: pedido2.pedidoItemId });
    expect(ok.status).toBe(201);

    const item2Linha = await db()
      .select()
      .from(schema.pedidosVendaItens)
      .where(eq(schema.pedidosVendaItens.id, pedido2.pedidoItemId))
      .then((r) => r[0]!);
    expect(item2Linha.quantidadeAtendida).toBe('1.000');

    // Item base não foi tocado
    const itemBaseLinha = await db()
      .select()
      .from(schema.pedidosVendaItens)
      .where(eq(schema.pedidosVendaItens.id, pedidoBase.pedidoItemId))
      .then((r) => r[0]!);
    expect(itemBaseLinha.quantidadeAtendida).toBe('0.000');
  });
# new_string
  it('associar subitem reclassificado consome unidade do item correto (não o item base da peça)', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-11-02');

    // Emenda 7 / DoD 7.7: "item2" = JAC (saída TZ_A), não item inventado fora da regra
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    const saidas = await prepararTransformacaoComRegraTzA(app, corteCookies, transfId);
    const item2Id = saidas.itemSaidaJacId; // reclassifica para JAC
    const itemBaseId = saidas.itemSaidaCbId; // "base" compatível com regra = CB

    const pedido2 = await criarPedido(app, comercialCookies, {
      compraId: c.compraId,
      clienteId: c.clienteId,
      itemComercialId: item2Id,
      dataOperacao: c.dataOperacao,
      quantidade: 2,
    });
    const pedidoBase = await criarPedido(app, comercialCookies, {
      compraId: c.compraId,
      clienteId: c.clienteId,
      itemComercialId: itemBaseId,
      dataOperacao: c.dataOperacao,
      quantidade: 2,
    });

    const subId = await adicionarSubitem(app, corteCookies, transfId, item2Id);
    await pesarSubitem(app, corteCookies, subId);

    const incompat = await request(srv())
      .post(`/operacao/corte/subitens/${subId}/associar`)
      .set('Cookie', corteCookies)
      .send({ pedidoVendaItemId: pedidoBase.pedidoItemId });
    expect(incompat.status).toBe(409);

    const ok = await request(srv())
      .post(`/operacao/corte/subitens/${subId}/associar`)
      .set('Cookie', corteCookies)
      .send({ pedidoVendaItemId: pedido2.pedidoItemId });
    expect(ok.status).toBe(201);

    const item2Linha = await db()
      .select()
      .from(schema.pedidosVendaItens)
      .where(eq(schema.pedidosVendaItens.id, pedido2.pedidoItemId))
      .then((r) => r[0]!);
    expect(item2Linha.quantidadeAtendida).toBe('1.000');

    const itemBaseLinha = await db()
      .select()
      .from(schema.pedidosVendaItens)
      .where(eq(schema.pedidosVendaItens.id, pedidoBase.pedidoItemId))
      .then((r) => r[0]!);
    expect(itemBaseLinha.quantidadeAtendida).toBe('0.000');
  });
```

Teste redirecionar:

```ts
# old_string
    const pa = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId, dataOperacao: c.dataOperacao, quantidade: 2 });
    const pb = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: await criarOutroCliente(app), itemComercialId: c.itemComercialId, dataOperacao: c.dataOperacao, quantidade: 2 });

    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    const subId = await adicionarSubitem(app, corteCookies, transfId, c.itemComercialId);
    await pesarSubitem(app, corteCookies, subId);
    await request(srv()).post(`/operacao/corte/subitens/${subId}/associar`).set('Cookie', corteCookies).send({ pedidoVendaItemId: pa.pedidoItemId });
# new_string
    const itemSaidaCbId = await itemSaidaCanonicoCb(app);
    const pa = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: c.clienteId, itemComercialId: itemSaidaCbId, dataOperacao: c.dataOperacao, quantidade: 2 });
    const pb = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: await criarOutroCliente(app), itemComercialId: itemSaidaCbId, dataOperacao: c.dataOperacao, quantidade: 2 });

    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    const subId = await adicionarSubitem(app, corteCookies, transfId, itemSaidaCbId);
    await pesarSubitem(app, corteCookies, subId);
    await alinharPedidoItemComSaidaCorte(app, pa.pedidoItemId, itemSaidaCbId);
    await request(srv()).post(`/operacao/corte/subitens/${subId}/associar`).set('Cookie', corteCookies).send({ pedidoVendaItemId: pa.pedidoItemId });
```

Teste sem-cobertura:

```ts
# old_string
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    const subId = await adicionarSubitem(app, corteCookies, transfId, c.itemComercialId);
    await pesarSubitem(app, corteCookies, subId);

    const semMotivo = await request(srv()).post(`/operacao/corte/subitens/${subId}/sem-cobertura`).set('Cookie', corteCookies).send({ destino: 'sobra' });
# new_string
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    const itemSaidaCbId = await itemSaidaCanonicoCb(app);
    const subId = await adicionarSubitem(app, corteCookies, transfId, itemSaidaCbId);
    await pesarSubitem(app, corteCookies, subId);

    const semMotivo = await request(srv()).post(`/operacao/corte/subitens/${subId}/sem-cobertura`).set('Cookie', corteCookies).send({ destino: 'sobra' });
```

e no mesmo teste o 2º subitem:

```ts
# old_string
    const sub2 = await adicionarSubitem(app, corteCookies, transfId, c.itemComercialId);
# new_string
    const sub2 = await adicionarSubitem(app, corteCookies, transfId, itemSaidaCbId);
```

#### `conferencia.e2e-spec.ts` / `faturamento.e2e-spec.ts` / `expedicao.e2e-spec.ts` / `rastreabilidade-corte.e2e-spec.ts`

Herdam `subitemCompleto` (Step A) — **zero** patch nestes arquivos nesta emenda. Qualquer FAIL em Step G → parar e reportar.

- [ ] **Step D: `corte-branches.spec.ts` — injetar `ChecklistCorteService`**

Após `function makeAuditoria()` inserir:

```ts
# old_string
function makeAuditoria() {
  return { registrar: jest.fn() };
}
# new_string
function makeAuditoria() {
  return { registrar: jest.fn() };
}

/** Emenda 7 — CorteService exige ChecklistCorteService no construtor (DoD 7.9). */
function makeChecklist(
  overrides: Partial<{ divergente: boolean; divergenciaAbertaId: string | null }> = {},
) {
  return {
    obterNaTx: jest.fn(async () => ({
      transformacaoId: 't1',
      regraTransformacaoId: null,
      regraNome: null,
      regraProvisoria: false,
      slots: [],
      divergente: false,
      divergenciaAbertaId: null,
      ...overrides,
    })),
    obter: jest.fn(),
    abrirDivergencia: jest.fn(),
  };
}
```

Substituir **todas** as construções (21 ocorrências, 3 formas):

```ts
# old_string
new CorteService({ db } as never, makeAuditoria() as never, makeEmitter())
# new_string
new CorteService({ db } as never, makeAuditoria() as never, makeEmitter(), makeChecklist() as never)
```

```ts
# old_string
new CorteService({ db } as never, auditoria as never, makeEmitter())
# new_string
new CorteService({ db } as never, auditoria as never, makeEmitter(), makeChecklist() as never)
```

```ts
# old_string
new CorteService({ db } as never, makeAuditoria() as never, emitter)
# new_string
new CorteService({ db } as never, makeAuditoria() as never, emitter, makeChecklist() as never)
```

```bash
cd app/backend && npx jest test/unit/corte-branches.spec.ts -v
# Expected: PASS
```

- [ ] **Step E: `onda6-migrations-meta.spec.ts` — escopo journal O6**

```ts
# old_string
  it('encadeia journal e snapshots gerados de 0020 a 0022', () => {
    const journal = readJson<Journal>(path.join(META_DIR, '_journal.json'));
    const entries = journal.entries.filter((entry) => entry.idx >= 20);

    expect(journal.version).toBe('7');
    expect(journal.dialect).toBe('postgresql');
    expect(entries.map(({ idx, tag }) => ({ idx, tag }))).toEqual([
      { idx: 20, tag: '0020_onda5_usuarios_representantes' },
      { idx: 21, tag: '0021_onda6_recebimento_balanca_expand' },
      { idx: 22, tag: '0022_onda6_etiqueta_estado_backfill' },
    ]);
# new_string
  it('encadeia journal e snapshots gerados de 0020 a 0022', () => {
    const journal = readJson<Journal>(path.join(META_DIR, '_journal.json'));
    // Emenda 7: O7 adiciona idx 23 — meta O6 isola 20..22 (não quebrar com 0023)
    const entries = journal.entries.filter((entry) => entry.idx >= 20 && entry.idx <= 22);

    expect(journal.version).toBe('7');
    expect(journal.dialect).toBe('postgresql');
    expect(entries.map(({ idx, tag }) => ({ idx, tag }))).toEqual([
      { idx: 20, tag: '0020_onda5_usuarios_representantes' },
      { idx: 21, tag: '0021_onda6_recebimento_balanca_expand' },
      { idx: 22, tag: '0022_onda6_etiqueta_estado_backfill' },
    ]);
```

```bash
cd app/backend && npx jest test/unit/onda6-migrations-meta.spec.ts -v
# Expected: PASS (com 0023 presente no journal)
```

- [ ] **Step F: probe O4 — fixtures pré-O7 + lista de artefatos**

Criar `app/backend/test/helpers/fixtures/transformacoes.schema.pre-onda7.ts` com o conteúdo **byte-a-byte** de `origin/develop` @ `94fb341` (`app/backend/src/database/schema/transformacoes.schema.ts` — **sem** `regra_transformacao_id` / **sem** `idx_transf_regra`).

Criar `app/backend/test/helpers/fixtures/regras-transformacao.schema.pre-onda7.ts` com o conteúdo **byte-a-byte** de `origin/develop` @ `94fb341` (`regras-transformacao.schema.ts` — **sem** `codigo` / **sem** `provisorio` / **sem** `uq_regras_transf_codigo`).

Comando para materializar (Worker executa na worktree impl):

```bash
cd app/backend
git show 94fb341:app/backend/src/database/schema/transformacoes.schema.ts \
  > test/helpers/fixtures/transformacoes.schema.pre-onda7.ts
git show 94fb341:app/backend/src/database/schema/regras-transformacao.schema.ts \
  > test/helpers/fixtures/regras-transformacao.schema.pre-onda7.ts
# Expected: 2 arquivos; rg regra_transformacao_id|provisorio fixtures/*.pre-onda7.ts → zero hits
```

Patch do probe em `onda4-migrations.e2e-spec.ts`:

```ts
# old_string
      for (const postO4Artifact of [
        'migrations/0019_onda5_gestao.sql',
        'migrations/0020_onda5_usuarios_representantes.sql',
        'migrations/0021_onda6_recebimento_balanca_expand.sql',
        'migrations/0022_onda6_etiqueta_estado_backfill.sql',
        'migrations/meta/0019_snapshot.json',
        'migrations/meta/0020_snapshot.json',
        'migrations/meta/0021_snapshot.json',
        'migrations/meta/0022_snapshot.json',
        'schema/relatorios-sif.schema.ts',
        'schema/aprovacoes-operacionais.schema.ts',
      ]) {
        fs.rmSync(path.join(probe, postO4Artifact), { force: true });
      }
      // pesagem.schema da O6 (trocas_peca + estado da etiqueta) voltaria a gerar DDL extra —
      // restaura o snapshot pré-O6 pinado (sem depender de git fetch no CI shallow).
      fs.copyFileSync(
        path.resolve(__dirname, '../helpers/fixtures/pesagem.schema.pre-onda6.ts'),
        path.join(probe, 'schema/pesagem.schema.ts'),
      );
# new_string
      for (const postO4Artifact of [
        'migrations/0019_onda5_gestao.sql',
        'migrations/0020_onda5_usuarios_representantes.sql',
        'migrations/0021_onda6_recebimento_balanca_expand.sql',
        'migrations/0022_onda6_etiqueta_estado_backfill.sql',
        'migrations/0023_onda7_desossa_expand.sql',
        'migrations/meta/0019_snapshot.json',
        'migrations/meta/0020_snapshot.json',
        'migrations/meta/0021_snapshot.json',
        'migrations/meta/0022_snapshot.json',
        'migrations/meta/0023_snapshot.json',
        'schema/relatorios-sif.schema.ts',
        'schema/aprovacoes-operacionais.schema.ts',
        // Emenda 7: importa aprovacoes-operacionais — quebra resolve do probe O4
        'schema/divergencias-transformacao.schema.ts',
      ]) {
        fs.rmSync(path.join(probe, postO4Artifact), { force: true });
      }
      // pesagem.schema da O6 (trocas_peca + estado da etiqueta) voltaria a gerar DDL extra —
      // restaura o snapshot pré-O6 pinado (sem depender de git fetch no CI shallow).
      fs.copyFileSync(
        path.resolve(__dirname, '../helpers/fixtures/pesagem.schema.pre-onda6.ts'),
        path.join(probe, 'schema/pesagem.schema.ts'),
      );
      // Emenda 7: colunas O7 em transformacoes/regras gerariam DDL extra no generate O4
      fs.copyFileSync(
        path.resolve(__dirname, '../helpers/fixtures/transformacoes.schema.pre-onda7.ts'),
        path.join(probe, 'schema/transformacoes.schema.ts'),
      );
      fs.copyFileSync(
        path.resolve(__dirname, '../helpers/fixtures/regras-transformacao.schema.pre-onda7.ts'),
        path.join(probe, 'schema/regras-transformacao.schema.ts'),
      );
```

```ts
# old_string
      const o4SchemaLines = fs.readFileSync(probeSchemaIndex, 'utf8')
        .split(/\r?\n/)
        .filter((line) =>
          !line.includes('relatorios-sif.schema') &&
          !line.includes('aprovacoes-operacionais.schema') &&
          !line.includes('usuarios-representantes.schema'),
        );
# new_string
      const o4SchemaLines = fs.readFileSync(probeSchemaIndex, 'utf8')
        .split(/\r?\n/)
        .filter((line) =>
          !line.includes('relatorios-sif.schema') &&
          !line.includes('aprovacoes-operacionais.schema') &&
          !line.includes('usuarios-representantes.schema') &&
          !line.includes('divergencias-transformacao.schema'),
        );
```

```bash
cd app/backend && npx jest test/integration/onda4-migrations.e2e-spec.ts -v --testTimeout=120000
# Expected: PASS
```

- [ ] **Step G: Gate `test:cov` (Expected PASS Emenda 7)**

```bash
cd app/backend && npm run test:cov
# Expected: exit 0 — 0 FAIL
# Expected: suítes legadas corte/subitens/reetiqueta/concorrencia/expedicao/faturamento/conferencia/rastreabilidade PASS
# Expected: corte-branches PASS; onda6-migrations-meta PASS; onda4-migrations PASS
# Expected: onda7-desossa.spec.ts continua PASS
# Expected: coverage ≥80% linha e branch
```

Se **qualquer** FAIL restar após Steps A–F: **parar e reportar** (não improvisar). Anexar nome do spec + mensagem.

- [ ] **Step H (após G verde; não bloqueia G): evidências Playwright lado a lado**

Os scripts podem existir untracked no worktree (`capture-onda7-app.mjs` / `capture-onda7-prototipo.mjs`). Worker deve:

1. Garantir que estão commitados sob `app/frontend/scripts/` (conteúdo já presente no WIP — **não** reescrever se o arquivo untracked já aponta `docs/evidencias/onda7-desossa`).
2. Subir app+protótipo conforme Task 14 e rodar:

```bash
cd app/frontend
node scripts/capture-onda7-app.mjs
node scripts/capture-onda7-prototipo.mjs
# Expected: PNGs em docs/evidencias/onda7-desossa/ (dashboard, TV, pesagem, etiquetas) lado a lado
ls docs/evidencias/onda7-desossa/*.png | wc -l
# Expected: ≥ 4
```

3. Commit: `test(onda7): evidências Playwright desossa lado a lado`

- [ ] **Step I: Commit Emenda 7 (helpers + meta)**

```bash
git add app/backend/test/helpers/corte-fixtures.ts \
  app/backend/test/helpers/fixtures/transformacoes.schema.pre-onda7.ts \
  app/backend/test/helpers/fixtures/regras-transformacao.schema.pre-onda7.ts \
  app/backend/test/integration/corte.e2e-spec.ts \
  app/backend/test/integration/subitens.e2e-spec.ts \
  app/backend/test/integration/reetiqueta-subitem.e2e-spec.ts \
  app/backend/test/integration/corte-concorrencia.e2e-spec.ts \
  app/backend/test/unit/corte-branches.spec.ts \
  app/backend/test/unit/onda6-migrations-meta.spec.ts \
  app/backend/test/integration/onda4-migrations.e2e-spec.ts
git commit -m "$(cat <<'EOF'
test(onda7): desbloqueia Gate local — suítes legadas e meta O6/O4

### Descrição Detalhada:
Helpers de corte passam a bindar TZ_A, usar saídas CB/JAC e fechar checklist
antes de concluir; meta O6 isola journal 20..22; probe O4 restaura schemas pré-O7.

### Motivo da Mudança:
Emenda 7 — Gate test:cov quebrava por DoD 7.6/7.7/7.9 sem literais no plano.

### Impacto:
Suítes F4c/expedição/faturamento herdam fluxo O7 sem regressão da suíte nova.

EOF
)"
```

---

### Task 15 — Gate local (= CI) + PR de implementação

> Task do **Executor/Worker na implementação**, não deste PR de plano.

> **Pré-requisito Emenda 7:** Task 16 Step G (`npm run test:cov`) **PASS** no tip de `feature/onda7-desossa` (base `34524a4` + patches Task 16). Sem isso, **não** abrir PR de implementação.

```bash
npm ci
cd app/backend && npm run lint && npm run test:cov && npm run build
# Expected PASS Emenda 7: exit 0 — 0 FAIL (suítes legadas + meta O6/O4 + onda7-desossa)
cd app/frontend && npm run lint && npm run test && npm run build
# Step H (evidências) se ainda sem PNGs em docs/evidencias/onda7-desossa/
gh pr create --base develop --title "feat(onda7): Desossa e Transformação" --body "..."
```

Atualizar `EXECUCAO-STATUS.md` para `implementando` / `aguardando_portao2` conforme rito.

---

## Ordem de execução

```
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11 → T12 → T13 → T14 → T16 → T15
```

Paralelismo seguro após deps de API: T11 ∥ T12 ∥ T13. **T16 (Emenda 7) é obrigatória antes do Gate `test:cov` da T15.**

---

## Critérios Portão 1 (Monitor)

1. Princípio I: 3 telas mapeadas a `.tsx` do protótipo com SHA pinado.
2. Princípio II: zero "parcial/depois"; linhas 17–19 cobertas na reconciliação.
3. Princípio VIII: P6/P12 → parâmetro + badge; `DECISOES.md` intocado.
4. Autossuficiência: Goal/Architecture/Tech Stack, decisões D7.x, estrutura, mapa DoD 7.1–7.26, tasks com código literal (inclui Task 16 Emenda 7).
5. RA-04 explícito: remoção do poll + eventos nomeados.
6. Quality-gates O7: exclusividade A↔B, checklist, divergência formal, painel TV por eventos — cada um com DoD→teste.
7. Grep plano: zero `TBD` / `TODO` / `implementar depois` / `similar à Task`.
8. Dep O6 = `mergeada` em `EXECUCAO-STATUS.md`.

## Critérios Portão 2 (Monitor — implementação futura)

1. CI 8/8 verde no head.
2. Diff ⊆ plano; nada de O8/O9/O10.
3. DoD 7.1–7.26 demonstrados por teste/artefato.
4. Screenshots 3 rotas + Modo TV vs protótipo.
5. `rg setInterval` limpo em `desossa/dashboard`.
6. `DECISOES.md` sem AD novo.
7. Cobertura ≥80% linha e branch.

---

## Self-Review (Planejador)

1. **Spec coverage:** §6.6 exclusividade → T4/T5/7.7; §6.14 fluxo → D7.1/D7.5; telas §8.9 → T11–T13; §16.7/§16.15 → parâmetro+badge; matriz 17–19 → reconciliação; quality-gates O7 → DoD 7.7/7.8/7.10/7.13/7.16.
2. **Placeholder scan:** nenhum TBD/TODO/a definir/implementar depois/similar à Task/fase 2; zero compromisso de entrega incompleta; D7.13+D7.14 decididos (criar endpoint + Opção A OR perms).
3. **Type consistency:** `regraTransformacaoId`, wires `faltas_desossa_atualizadas` / `divergencia_transformacao_aberta`, tipos de divergência alinhados ao CHECK; `PainelDesossa.itens` com `rota`/`representante`/`horarioAlvo`; `PainelDesossa.regras` com `prioridade`/`atende`/`sobras`/`impacto`; `PainelDesossa.operacaoId`; `PecaElegivelDesossa` com cols TZs; `aProduzir === quantidadeFaltante` (líquido tip).
4. **PR #38:** não reutilizado; branch de plano `feature/onda7-plano-desossa`.
5. **Emenda 2 vs veredito `25300fa`:** (1) teste+calc alinhados ao tip líquido; (2) client sem `fetchBackend`; (3) TVMode CARGA/HORÁRIO + KPI TZs na desossa + tabela Rota/Representante/Alvo + drawers + etiquetas 11 cols/filtros rótulo; (4) snapshot RBAC com comando; (5) modais pesagem com cercas JSX.
6. **Emenda 3 vs veredito `b8aff66`:** (1) tabela TZs `:600-638` + `setDrawerTZ` vivo; (2) D7.14 Opção A `RequireQualquerPermissao` — zero 403 telão; (3) sugestão Prior./Atende/Sobras/Impacto + calc; (4) `bloqueada` via EXISTS carga fechada (**corrigido na Emenda 4** — join era `peca_id` da mãe); (5) `vincularRegra`/`carregarChecklist` com `fetch('/api/...')`.
7. **Emenda 4 vs veredito `ef862bf`:** (1) `bloqueada` EXISTS `ci.subitem_id = subitens.id` + `STATUS_CAMINHAO_FECHADO`, sem `etiquetaBloqueadaSql` cego + DoD 7.21b; (2) Task 14 cerca literal DoD 7.14b comercial→200 / faturamento→403; (3) Task 11 não engole 403 de TZs (RA-05).
8. **Emenda 5 vs veredito `04bc197`:** (1) DoD 7.21b + Task 13 leem `res.body.data` / `json.data` (tip `Paginado`/`montarPaginado`; zero `itens` no envelope); (2) fixtures DoD 7.21b literais com `operacaoId`/`subitemId` tipados (HTTP + SQL XOR `subitem`, sem reticências).
9. **Emenda 6 vs veredito `9608d20`:** (1) ambas fixtures DoD 7.21b, após `iniciarCorte`, buscam `TZ_A`, `POST /operacao/corte/:id/regra`, e usam `itemComercialId` de saída CB (seed Task 2) em `criarPedido`/`subitemCompleto` — Expected PASS factível contra DoD 7.6/7.7; zero `c.itemComercialId` da mãe nesses calls.
10. **Emenda 7 vs Gate local tip `34524a4`:** (1) `corte-fixtures` O7-aware (bind TZ_A + saída CB/JAC + alinhar pedido + `concluirCorteOnda7`); (2) patches literais corte/subitens/reetiqueta/concorrência; (3) `makeChecklist` no `corte-branches`; (4) meta O6 `idx<=22`; (5) probe O4 remove `0023`+`divergencias-transformacao` e restaura schemas pré-O7; (6) Expected PASS `npm run test:cov`; zero TBD/TODO/similar à Task.

---

## Fora de escopo (resto)

Qualquer cadastro admin além do seed; mudanças em Troca de Peça (O6); adapter de balança real; relatórios SIF novos.
