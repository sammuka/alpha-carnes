---
name: gate-pr
description: Portão 2 — audita a implementação/PR de uma onda antes do merge. Invocar como /gate-pr <onda> <nº do PR> (ex. /gate-pr onda2 12). Use quando um PR feature/onda* → develop estiver aberto com CI rodado. Papel Monitor — verifica executando, nunca confia no relato do worker.
---

# Portão 2 — Gate de PR

Você é o **Monitor** (`docs/governance/pipeline-execucao.md` §2/§4). O relatório do worker é hipótese, não evidência: **rode você mesmo** cada verificação. Em dúvida → `ajustar`. Merge só com `aprovado`.

## Entradas

- Argumentos: onda (ex. `onda2`) e número do PR.
- Plano tático aprovado no Portão 1 (conferir em `docs/execucao/GATE-VEREDITOS.md`).
- Réguas: `constituicao.md`, `quality-gates.md` (gates transversais + DoD da onda), `framework-revisao.md` §6 (RA-01..06), protótipo em `F:\Projetos\alpha-carnes-prototipo` (branch `feature/completude-v1.1`).

## Passos

1. **Pré-condição:** `GATE-VEREDITOS.md` tem Portão 1 `aprovado` para esta onda. Sem isso → `bloqueado`.
2. **Fixar os objetos:** `git fetch origin`; capture `headRefOid` do PR e `baseRefName`; exija base `develop`; capture `baseOid=$(git rev-parse origin/develop)`. Todo `git show`, `git diff` e leitura do plano usa exclusivamente esses dois OIDs completos, nunca refs simbólicos.
3. **CI:** `gh pr checks <PR>` — os oito checks canônicos verdes (lint, type-check, test-backend, coverage ≥80%, test-frontend, build, audit, secret-scan). Verificar o diff fixo para decidir se Vercel é obrigatório (somente `landing/**`). Depois dos checks, recapture `headRefOid` e `origin/develop`; ambos devem continuar iguais aos pins. Qualquer check obrigatório vermelho/pendente ou pin alterado → `ajustar` imediato.
4. **Diff vs. plano:** `git diff <baseOid>...<headRefOid>` e `git show <headRefOid>:<plano>`. Conferir task a task: tudo implementado? Algo fora do escopo? Arquivos tocados batem com a "Estrutura de arquivos"?
5. **Critérios de aceite / mapa DoD→teste:** para cada invariante do plano, localizar o teste (grep pelo nome no diff) e conferir que ele **falharia** se a regra fosse violada (ler a asserção, não só o título).
6. **RA-01..06 em runtime:**
   - RA-01: grep no diff do frontend por lógica de decisão (cálculo de saldo, bloqueio) — deve estar no backend.
   - RA-02: mutações críticas dentro de `db.transaction` + registro de auditoria no mesmo escopo.
   - RA-04: eventos emitidos **pós-commit** (padrão do repo); nenhum `setInterval`/polling novo.
   - RA-05/06: nenhum `success: true` em caminho de erro; falhas com log + status explícito.
7. **Fidelidade ao protótipo (Princípio I — obrigatório para PR com telas):**
   - Para CADA tela do PR: abrir o `.tsx` correspondente do protótipo (referenciado no plano) e comparar estrutura (seções, abas, modais, botões, rótulos, estados). Se houver screenshots Playwright no PR, comparar lado a lado com a tela do protótipo.
   - Grep no diff por cores hex fora dos tokens do DS — hex avulso que não esteja na paleta do protótipo → `ajustar`.
   - Grep por `[Mm]arca` em rótulo/UI → `ajustar` (Princípio IX).
   - Divergência visual/fluxo sem autorização registrada no plano → `ajustar`. "Ficou melhor" não aprova.
8. **Segurança/dados:** sem segredos no diff; endpoints novos com `@RequirePermissoes` + teste de 403; migrations geradas por drizzle-kit, reversíveis, sem DELETE/DROP não justificado.
9. **Registrar sob lock:** adquira `docs-execucao.lock` com token aleatório mantido apenas em memória. Dentro do lock, recapture e exija `origin/develop == <baseOid>` e `headRefOid == <headOid>`; então append:
   `| <ISO local> | onda<N> | 2 | aprovado|ajustar|bloqueado | PR #<n>, base <baseOid>, head <headOid> + comandos | <feedback numerado> |`
   Libere em `finally`/`trap`; exija `LOCK_RELEASED`. Qualquer timeout, mudança ou release inválido falha fechado.
10. Reportar. Se `aprovado`, o Executor só pode mergear sob o mesmo lock após revalidar base/head e deve usar `gh pr merge <PR> --squash --delete-branch --match-head-commit <headOid>`. Se base ou head mudar, novo Portão 2 é obrigatório. Depois formaliza `EXECUCAO-STATUS.md` e os vereditos por PR de coordenação separado (CI verde + `--match-head-commit`); push direto em `develop` é proibido. Violação de segurança ou princípio NÃO-NEGOCIÁVEL → `bloqueado`.

## Regras

- Nunca aprovar com check de CI pendente "porque vai passar".
- Nunca delegar a comparação visual ao relato do worker.
- Dívida aceita conscientemente = registrada no veredito com fase de resolução; nunca silenciosa.
