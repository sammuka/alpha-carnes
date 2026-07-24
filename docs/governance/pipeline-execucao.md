# Pipeline de Execução — AlphaCarnes

> **Status:** Vigente · **Versão:** 1.0.0 · **Data:** 2026-07-23
> Define o **rito de execução por ondas** com dois gates e três papéis, adaptado da pipeline validada no projeto SiriusComex. Complementa (não substitui): [`constituicao.md`](constituicao.md) (princípios), [`quality-gates.md`](quality-gates.md) (critérios objetivos), [`framework-revisao.md`](framework-revisao.md) (branches/PR/merge), [`roadmap-canonico.md`](roadmap-canonico.md) (o que entregar e em que ordem).

## 1. O rito — 5 passos por onda

```
1. PLANO       Planejador escreve docs/superpowers/plans/<data>-onda<N>-<slug>.md
2. PORTÃO 1    Monitor audita o plano  → veredito em docs/execucao/GATE-VEREDITOS.md
3. IMPLEMENT.  Worker implementa em worktree isolado, abre PR feature/onda<N>-* → develop
4. PORTÃO 2    Monitor audita o PR (CI + mérito + fidelidade) → veredito
5. MERGE       Executor faz squash-merge, atualiza EXECUCAO-STATUS.md, libera dependentes
```

Nenhum passo pula o anterior. Implementar sem Portão 1 aprovado ou mergear sem Portão 2 aprovado é violação de processo (o merge é revertido).

## 2. Papéis

| Papel | Quem | Modelo (política) | Escreve em | Nunca faz |
|---|---|---|---|---|
| **Executor / Orquestrador** | agente Codex `executor` (ou script autônomo) | workhorse | `docs/execucao/EXECUCAO-STATUS.md` (**único escritor**) | aprovar o próprio trabalho; escrever vereditos |
| **Monitor / Validador** | agente Codex `monitor` independente | **superior — nunca rebaixar** | `docs/execucao/GATE-VEREDITOS.md` (**único escritor**, append-only) | implementar; confiar no relato do worker sem verificar |
| **Worker de implementação** | agente Codex `worker` disparado por onda/tarefa | modelo adequado à mecanicidade — por isso os planos táticos têm detalhe máximo: o worker executa, não decide | código no worktree; relatório de implementação | decidir regra de negócio; improvisar quando o plano não cobre (**PARA e reporta**) |
| **Planejador** | Executor ou sessão dedicada com modelo superior | superior recomendado | plano tático da onda | inventar resposta para pendência §16 |
| **Quality Owner** | usuário (sammuka) | — | emendas da constituição; decisões em `DECISOES.md` | — |

Regras de conduta herdadas do SiriusComex (vinculantes):
- O Worker segue o plano **literalmente**. Se um `old_string` não casa, um teste falha após 1 correção, ou o plano não cobre o caso: **parar e reportar** — não improvisar.
- O Monitor **roda ele mesmo** os comandos de verificação (`gh pr checks`, diff, greps dos critérios de aceite, execução local quando preciso). Relato do worker é hipótese, não evidência.
- Em dúvida entre `aprovado` e `ajustar` → `ajustar`.

## 3. Portão 1 — Gate de plano

Invocável via skill [`$gate-plano <onda>`](../../.agents/skills/gate-plano/SKILL.md). O Monitor verifica:

1. **Constituição:** o plano cita e respeita os princípios afetados (I — arquivos-fonte do protótipo referenciados por tela; II — nenhuma feature entra "parcial"; VIII — pendências como parâmetro+badge).
2. **Roadmap/matriz:** escopo bate com a onda no [`roadmap-canonico.md`](roadmap-canonico.md) e com as linhas correspondentes da [matriz de rastreabilidade](../superpowers/plans/2026-07-22-matriz-rastreabilidade-v1.1.md); nenhuma rota da onda ficou de fora.
3. **Decisões:** consistente com `docs/execucao/DECISOES.md` (não reabre AD-01..AD-06; não fixa as pendências P1–P15 que continuam abertas).
4. **Autossuficiência para o worker:** padrão do plano F4c — Goal/Architecture/Tech Stack, decisões fixadas, estrutura de arquivos, mapa DoD→teste 1:1, tasks com código literal, comandos com saída esperada, zero "TBD"/"implementar depois". Um worker de modelo inferior consegue executar sem decidir nada.
5. **Consistência cruzada:** nomes de entidades/endpoints/eventos batem com o plano mestre e com planos de ondas vizinhas.

Veredito: `aprovado | ajustar | bloqueado` + feedback objetivo, registrado em `GATE-VEREDITOS.md`. O Monitor fixa o SHA e o blob do plano antes de ler, revalida ambos dentro do lock compartilhado e registra os OIDs; plano móvel nunca recebe aprovação.
Quando o motivo for uma decisão de produto que só o Quality Owner pode fornecer, o veredito
continua `bloqueado`, mas a saída estruturada do orquestrador é `requires-human`; bloqueios
técnicos, de dependência ou de agente usam `blocked`.

## 4. Portão 2 — Gate de PR

Invocável via skill [`$gate-pr <onda> <nº do PR>`](../../.agents/skills/gate-pr/SKILL.md). O Monitor verifica, **executando ele mesmo**:

1. **CI 100% verde** (`gh pr checks`) — os oito jobs canônicos de [`ci-spec.md`](ci-spec.md)
   (lint, type-check, testes, cobertura ≥80% linha+branch, build, audit, secret-scan). Vercel é
   exigido somente quando o diff toca `landing/**`; nos demais PRs seu status não faz parte do
   gate da aplicação.
2. **Diff vs. plano:** o Monitor fixa `baseOid` e `headRefOid`, usa apenas `git diff <base>...<head>`/`git show <head>:<plano>`; todo item implementado, nada fora do escopo e critérios de aceite verificados um a um.
3. **RA-01..06 em runtime** — checklist de [`framework-revisao.md`](framework-revisao.md) §6.
4. **Fidelidade ao protótipo (Princípio I):** para cada tela do PR, comparar com a rota equivalente do protótipo (rodar ambos ou comparar screenshots Playwright vs. protótipo); divergência não autorizada → `ajustar`.
5. **DoD da onda** ([`quality-gates.md`](quality-gates.md)) demonstrada por teste com link.
6. **Segurança:** sem segredo commitado, RBAC nos endpoints novos (teste de 403), migrations reversíveis.

Veredito registrado sob lock, incluindo os dois OIDs; merge só com `aprovado`. O Executor revalida base e head dentro do mesmo lock e usa `gh pr merge --match-head-commit <head>`; mudança em qualquer objeto exige novo Portão 2. Como `develop` não aceita push direto, a formalização de `EXECUCAO-STATUS`/`GATE-VEREDITOS` entra por um PR de coordenação próprio, também com CI e compare-and-swap, ainda sob o lock. Reprovação volta ao Worker com lista objetiva.

## 5. Estado vivo (`docs/execucao/`)

| Arquivo | Escritor único | Conteúdo |
|---|---|---|
| `EXECUCAO-STATUS.md` | Executor | tabela por onda: status (`aguardando_inicio → planejando → aguardando_portao1 → plano_aprovado → implementando → aguardando_portao2 → mergeada` \| `bloqueada`), PR, SHA do merge, observações |
| `GATE-VEREDITOS.md` | Monitor | **append-only**; linha por veredito: `data · onda · portão · veredito · evidência · feedback` |
| `DECISOES.md` | Quality Owner (registrado pelo Executor) | decisões numeradas `AD-xx` que fecham pendências (fonte de precedência máxima abaixo da constituição) |

Toda escrita nesses arquivos usa [`.codex/scripts/lock.ps1`](../../.codex/scripts/lock.ps1) com token aleatório por seção, persistido apenas como hash, e valida a saída estruturada de acquire/release. Uma execução mantém também `onda<N>-run.lock` durante o ciclo inteiro; isso impede dois disparos da mesma onda, inclusive entre modo assistido e autônomo. Lock órfão nunca é recuperado apenas por idade: a quarentena exige prova externa de que o dono não está vivo e compare-and-swap do owner observado.

## 6. Formato obrigatório do plano tático de onda

Padrão consolidado no plano F4c (`docs/superpowers/plans/2026-06-07-f4c-corte-transformacao.md`) e exigido no Portão 1:

```markdown
# Onda <N> — <Nome> — Plano de Implementação
> Para workers agênticos: usar o papel `worker` definido em `.codex/agents/worker.toml`.
**Goal:** ... **Architecture:** ... **Tech Stack:** ...
## Global Constraints (herda constituição + plano mestre)
## Decisões de design (fixadas — só reabrir se houver quebra)
## Referências do protótipo (tela → arquivo .tsx do protótipo, POR TELA)   ← Princípio I
## Estrutura de arquivos
## Mapa DoD → teste (1:1)
## Task 1..N (Files / Interfaces / Steps com código literal, TDD, commit)
## Gate local completo (comandos = CI) + abertura do PR
## Self-Review
```

## 7. Formato do relatório de implementação (Worker → Portão 2)

```markdown
# Relatório — Onda <N> (PR #<n>)
## O que foi implementado (task a task, com desvios do plano = NENHUM ou listados)
## Evidências: saída de testes, cobertura, screenshots por tela (lado a lado com o protótipo)
## Critérios de aceite: [ok/falha] item a item com link do teste
## Pendências/dívidas propostas (se houver — nunca silenciosas)
```

## 8. Automação autônoma

O rito acima roda de duas formas:

- **Assistida (skills):** humano/Executor invoca `$gate-plano`, `$disparar-onda` e `$gate-pr`.
- **Autônoma (PowerShell 7):** [`.codex/scripts/invoke-onda.ps1`](../../.codex/scripts/invoke-onda.ps1)
  executa uma onda; [`.codex/scripts/invoke-multionda.ps1`](../../.codex/scripts/invoke-multionda.ps1)
  agenda o grafo; `lock.ps1`, `checkpoint.ps1`, `wait-pr-checks.ps1` e `visibility-ci.ps1`
  fornecem exclusão mútua, retomada, espera de CI e lease de visibilidade. O orquestrador
  inicia um processo `codex exec` novo para cada papel/estágio, desabilita delegação interna e
  exige `thread.started` único mais `turn.completed`; `roleTrace` é montado dessas evidências,
  nunca aceito da resposta do modelo. O Portão 2 aprovado é seguido por outro processo Monitor
  adversarial; refutação sustentada reabre o ciclo.
  O protótipo usa por padrão `F:\Projetos\alpha-carnes-prototipo`; ambientes
  diferentes devem informar `-PrototypePath` ou `ALPHACARNES_PROTOTYPE_PATH`.

Limite da CLI pinada: o Codex `0.145.0` não expõe subcomando programático de `spawn`; pedir
delegação a uma única sessão e confiar na resposta final não comprova que um subagente nasceu.
Por isso `invoke-role.ps1` lê os perfis `.codex/agents/*.toml`, cria processos `codex exec`
separados e rejeita stream sem evidência ou com `collab_tool_call` interno; `invoke-onda.ps1`
rejeita thread repetida entre etapas. Mudança de versão/configuração que deixe de aceitar esses
overrides falha fechada antes de um gate.

## 9. Paralelismo de Workers (sem perder o plano literal)

Dois níveis — e só esses — são permitidos:

### 9.1 Ondas paralelas (já no grafo)

Quando [`roadmap-canonico.md`](roadmap-canonico.md) §8 mostra ramos independentes (ex.: Ondas 4∥5; 8∥9) **e** todas as dependências estão `mergeada`, o Executor pode disparar um Worker por onda em worktrees/branches isolados. Um único Writer por artefato de estado (`EXECUCAO-STATUS`, `GATE-VEREDITOS`). Integração e Portão 2 continuam **por onda**, serialmente.

### 9.2 Fatias paralelas dentro de uma Task de regressão

Quando o plano tático tem uma task do tipo “atualizar fixtures / regressão por domínio” **sem patches literais arquivo a arquivo**, o Executor pode fatiar a task em Workers paralelos sob estas regras:

1. **Pré-condição:** tasks estruturais anteriores da onda (migrations, services canônicos) já commitadas; helpers compartilhados estáveis no HEAD da branch da onda.
2. **Ownership exclusivo de arquivos** por Worker (lista explícita no prompt). Proibido dois Workers tocarem o mesmo path. Helpers compartilhados (`test/helpers/*`) só mudam num Worker “helpers” serial **antes** das fatias, ou ficam congelados.
3. **Worktree/branch por fatia** (ex.: `feature/onda<N>-t<M>-<dominio>`), base pinada no mesmo SHA. Merge de volta na branch da onda é **serial** (Executor), depois um único gate do plano (`npm run test -- "<regex domínio>"` + `test:cov` quando exigido).
4. **Modelo por complexidade** (política, não princípio constitucional):
   - mecânico (arity, remaps de string, mocks): modelo workhorse / rápido;
   - domínio médio (status AD-05, recebimento/PF): modelo thinking intermediário;
   - cadeia longa (expedição→faturamento, corte/rastreabilidade): modelo superior thinking.
5. **STOP idêntico ao Worker único:** plano omisso de regra de negócio → parar e reportar; não improvisar. Paralelismo acelera fixtures alinhadas ao contrato já aprovado — não autoriza atalho de Portão nem decisão de produto.
6. **Checkpoint:** cada fatia atualiza `.codex/runtime/PROGRESSO-SESSAO.md` da sua worktree; o Executor consolida na worktree da onda.

Proibido: dois Workers na mesma branch/worktree; paralelizar expand→backfill→contract; reutilizar veredito de Portão de outro SHA.

## 10. Relação com o framework de revisão existente

[`framework-revisao.md`](framework-revisao.md) permanece vigente para o mecânico de branches/PR/proteções/relatório de gate de fase. Este documento adiciona por cima: o Portão 1 (que não existia), os papéis separados Executor/Monitor/Worker (antes: revisor humano único) e o estado vivo auditável. O "Revisor/Quality Owner" do framework mapeia para Quality Owner (autoridade) + Monitor (execução da auditoria).
