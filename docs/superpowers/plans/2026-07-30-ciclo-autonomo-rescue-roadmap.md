# Ciclo Autônomo — Rescue #35 + Roadmap v1.1 Fidedigno

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Orquestração:** Executor segue `docs/governance/pipeline-execucao.md` + skills `/disparar-onda` e `/gate-pr`. Monitor ≠ Executor. Workers não escrevem `GATE-VEREDITOS.md`. Executor é único escritor de `EXECUCAO-STATUS.md`.

**Goal:** Restaurar a verdade processual pós-fraude Antigravity, mergear a Onda 4 (PR #35) com CI 8/8 real, e completar as Ondas 5–10 na ordem do `roadmap-canonico.md` §8 com Portão 1/2 fidedignos.

**Architecture:** Orquestração autônoma em fases sequenciais respeitando o grafo O3→O4∥O5→O6→O7→(O8∥O9)→O10. Código real de #35 e #28 é reaproveitado após rebase/coverage; PRs #37–#41 são inválidos e não entram em `develop`. Cada onda: plano tático completo → Portão 1 → worktree → Worker → PR → CI (lease PUBLIC→PRIVATE) → Portão 2 Monitor → adversarial (modo autônomo) → squash-merge → status.

**Tech Stack:** NestJS 11, Next.js 16, Drizzle/Postgres 18, Playwright, GitHub Actions, `gh` CLI para visibility lease.

## Global Constraints

- Constituição: Princípios I (fidelidade protótipo), II (completude E2E), VIII (não inventar pendências).
- Fonte de verdade de status: `origin/develop` → `docs/execucao/EXECUCAO-STATUS.md` (não branches onda6–10).
- Veredito Portão 2 exige: diff `app/` não vazio **ou** escopo docs-only explícito; `gh pr checks` 8 jobs Actions SUCCESS no mesmo HEAD; PlaceholderPage = 0 nas rotas da onda.
- Proibido citar SHA de commit `docs/*` como “implementação concluída”.
- Migrations: só via drizzle-kit; expand→backfill→contract; sem colisão de idx.
- Terminologia: banir “Marca”; usar “Nome Fantasia” / “Buscar cliente”.
- CI lease: `gh repo edit --visibility public` → aguardar checks → `gh repo edit --visibility private --accept-visibility-change-consequences`. Sempre restaurar PRIVATE mesmo se CI falhar (try/finally).
- Repo: `sammuka/alpha-carnes`. Branch base: `develop`.
- Protótipo: `F:/Projetos/alpha-carnes-prototipo` branch `feature/completude-v1.1`.

---

## Fase 0 — Higienização processual

### Task 0.1: Invalidar PRs e branches fictícios

**Files:**
- Modify via GitHub: PRs #37, #38, #39, #40, #41
- Não tocar `develop`

- [ ] **Step 1:** Comentar em cada PR (#37–#41) que o diff único vs predecessor é docs-only; implementação da onda = inexistente; PR fechado sem merge.
- [ ] **Step 2:** `gh pr close 37 38 39 40 41 --comment "…"` (um a um se necessário).
- [ ] **Step 3:** Deletar branches remotas `feature/onda6-recebimento-balanca`, `feature/onda7-desossa`, `feature/onda8-estoque`, `feature/onda9-carga`, `feature/onda10-faturamento` **somente após** close (não apagar `feature/onda4-comercial` nem `feature/onda5-gestao`).
- [ ] **Step 4:** Confirmar `origin/develop:docs/execucao/EXECUCAO-STATUS.md` ainda lista O4=implementando, O5=plano_aprovado, O6–10=aguardando_inicio. Se cópia local diverge, restaurar a partir de develop.

### Task 0.2: Registrar AD anti-fraude

**Files:**
- Modify: `docs/execucao/DECISOES.md` (append AD-xx — só com Quality Owner / nesta sessão autorizada pelo usuário)

- [ ] **Step 1:** Append AD registrando: vereditos sem diff `app/` + sem CI Actions no HEAD = nulos; Portão 2 não pode ser escrito pelo mesmo agente que implementou; PRs #37–#41 arquivados.
- [ ] **Step 2:** Commit em branch `chore/ad-anti-fraude-vereditos` → PR docs-only → merge após CI docs (ou incluir no rescue #35 se o Executor preferir PR separado curto).

---

## Fase 1 — Rescue Onda 4 (PR #35) — INÍCIO IMEDIATO

### Task 1.1: Worktree e diagnóstico coverage

**Files / branch:**
- Worktree: `.worktrees/onda4-rescue` em `feature/onda4-comercial` (tracking PR #35)
- Scripts: `scripts/check-coverage.mjs`, CI `.github/workflows/ci.yml`

- [ ] **Step 1:** `git fetch origin develop feature/onda4-comercial`
- [ ] **Step 2:** Criar/atualizar worktree no tip do PR #35
- [ ] **Step 3:** Rodar localmente no worktree:
  ```bash
  cd app/backend && npm run test:cov
  node ../../scripts/check-coverage.mjs --min 80
  ```
  (ajustar path do summary se o artifact for `app/backend/coverage`)
- [ ] **Step 4:** Se falha por limiar: listar services tocados pelo diff `origin/develop...HEAD` com lines/branches &lt;80%; abrir issues de teste.
- [ ] **Step 5:** Se falha CI histórica for job vazio/billing (steps=[] / ~10s): tratar como lease visibility, não como déficit de testes — ainda assim validar coverage local ≥80%.

### Task 1.2: Worker — fechar gaps de cobertura / ACMR

**Dispatch:** subagente Worker (implementer) no worktree.

- [ ] **Step 1:** Worker adiciona testes unit/e2e só para branches/linhas faltantes nos modules tocados pela Onda 4 (comercial: pedidos, precos, mapa, espelho, adendos, clientes).
- [ ] **Step 2:** Não alterar regra de negócio; não expandir escopo para O5+.
- [ ] **Step 3:** `npm run test:cov` + `check-coverage.mjs --min 80` verdes localmente.
- [ ] **Step 4:** Commit Conventional Commits pt-BR: `test(onda4): elevar cobertura ACMR dos services comerciais`
- [ ] **Step 5:** Push para `feature/onda4-comercial`.

### Task 1.3: Reviewer de task (spec + qualidade)

**Dispatch:** subagente reviewer / review-agent no diff do Task 1.2.

- [ ] **Step 1:** Revisar que testes falhariam se a regra sumisse; sem asserts vazios; sem mocks em prod.
- [ ] **Step 2:** Achados P0/P1 → devolver ao Worker (máx 3 rounds).

### Task 1.4: CI lease PUBLIC → run → PRIVATE

- [ ] **Step 1:** Capturar visibility atual: `gh repo view --json isPrivate,visibility`
- [ ] **Step 2:** `gh repo edit sammuka/alpha-carnes --visibility public`
- [ ] **Step 3:** `gh pr checks 35 --watch` (ou `gh workflow run` / empty commit se necessário) até 8 jobs concluírem no HEAD atual
- [ ] **Step 4:** **Finalmente (sempre):** `gh repo edit sammuka/alpha-carnes --visibility private --accept-visibility-change-consequences`
- [ ] **Step 5:** Confirmar `isPrivate=true`. Se PRIVATE falhar, alertar Quality Owner imediatamente (segurança).

### Task 1.5: Portão 2 Monitor (Onda 4)

**Dispatch:** subagente Monitor com skill `gate-pr` (modelo superior se disponível).

- [ ] **Step 1:** Executar checklist gate-pr (CI 8/8, diff vs plano O4, RA-01..06, PlaceholderPage comercial=0, protótipo).
- [ ] **Step 2:** Append veredito real em `GATE-VEREDITOS.md` (só Monitor).
- [ ] **Step 3:** Se `ajustar`: Worker corrige → Task 1.4 de novo. Se `aprovado`: seguir merge.

### Task 1.6: Merge Onda 4

- [ ] **Step 1:** Executor: `gh pr merge 35 --squash --delete-branch=false` (ou política do repo)
- [ ] **Step 2:** Atualizar `EXECUCAO-STATUS.md`: O4 → `mergeada`, SHA squash, PR #35
- [ ] **Step 3:** `git fetch origin develop` — tip contém O4

---

## Fase 2 — Onda 5 (PR #28) pós-O4

### Task 2.1: Rebase + renumerar migrations

- [ ] Rebase `feature/onda5-gestao` em `origin/develop` pós-O4
- [ ] Renomear `0018_onda5_gestao.sql` → cadeia `0019+` gerada/ajustada sem colidir com `0016–0018` O4; journal/snapshots Drizzle
- [ ] Resolver conflitos comercial/overbooking/pedidos
- [ ] Worker: coverage + e2e gestao
- [ ] Reviewer task
- [ ] CI lease PUBLIC→PRIVATE no #28
- [ ] Portão 2 Monitor → merge → O5 `mergeada`

---

## Fase 3 — Onda 6 Recebimento & Balança (do zero)

### Task 3.1: Plano tático completo (não reusar plano 50 linhas)

- [ ] Planejador: plano no padrão §6 pipeline (DoD→teste 1:1, refs protótipo por tela, dívidas O1 decisão 28)
- [ ] Portão 1 Monitor → aprovado
- [ ] `/disparar-onda onda6` em worktree novo a partir de develop
- [ ] Worker implementa §6.10 + Troca de Peça + etiquetas 5 estados + UI
- [ ] CI lease + Portão 2 + merge

---

## Fase 4 — Onda 7 Desossa

- [ ] Plano completo → P1 → worktree → Worker (painel TV, exclusividade regra AD-01, subpeças) → CI lease → P2 → merge

---

## Fase 5 — Onda 8 Estoque ∥ Fase 6 — Onda 9 Carga

- [ ] Após O7 mergeada: disparar O8 e O9 em worktrees paralelos (grafo permite)
- [ ] Cada uma com plano próprio, CI lease, Portão 2 independente
- [ ] Merge sequencial seguro (O8 depois O9 ou conforme lock multi-onda)

---

## Fase 7 — Onda 10 Faturamento

- [ ] Depende O8+O9 mergeadas
- [ ] EISS fake obrigatório; real se credenciais homologação
- [ ] Plano → P1 → Worker → CI lease → P2 → merge
- [ ] Ciclo v1.1 completo; release develop→main só com gate de fase

---

## Protocolo CI Visibility (obrigatório em todo Portão 2)

```bash
# BEFORE
PREV=$(gh repo view sammuka/alpha-carnes --json visibility -q .visibility)
gh repo edit sammuka/alpha-carnes --visibility public
# RUN
gh pr checks <N> --watch
# AFTER (sempre)
gh repo edit sammuka/alpha-carnes --visibility private --accept-visibility-change-consequences
gh repo view sammuka/alpha-carnes --json isPrivate -q .isPrivate   # deve ser true
```

Se qualquer passo falhar após PUBLIC, ainda assim executar PRIVATE.

---

## Critérios de parada (BLOCKED → reportar humano)

- PRIVATE não restaura
- Portão 2 encontra violação de princípio NÃO-NEGOCIÁVEL
- Worker para 2× no mesmo ponto do plano sem cobertura
- Credenciais EISS ausentes na Onda 10 (seguir só com fake + dívida AD)

---

## Ordem de dispatch nesta sessão

1. Escrever este plano (feito)
2. Task 0.1 (close PRs fictícios) em paralelo com Task 1.1
3. Task 1.2 Worker coverage
4. Task 1.3 Review
5. Task 1.4 CI lease
6. Task 1.5 Monitor gate-pr
7. Task 1.6 merge
8. Continuar Fase 2 sem pausa para o usuário
