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
| **Executor / Orquestrador** | sessão Claude dedicada (ou workflow autônomo) | workhorse (Sonnet-classe) | `docs/execucao/EXECUCAO-STATUS.md` (**único escritor**) | aprovar o próprio trabalho; escrever vereditos |
| **Monitor / Validador** | sessão Claude separada (ou etapa do workflow) | **superior** (Opus-classe — nunca rebaixar) | `docs/execucao/GATE-VEREDITOS.md` (**único escritor**, append-only) | implementar; confiar no relato do worker sem verificar |
| **Worker de implementação** | subagente disparado por onda/tarefa | **inferior é aceitável** (Sonnet/Haiku conforme mecanicidade) — por isso os planos táticos têm detalhe máximo: o worker executa, não decide | código no worktree; relatório de implementação | decidir regra de negócio; improvisar quando o plano não cobre (**PARA e reporta**) |
| **Planejador** | Executor ou sessão dedicada com modelo superior | superior recomendado | plano tático da onda | inventar resposta para pendência §16 |
| **Quality Owner** | usuário (sammuka) | — | emendas da constituição; decisões em `DECISOES.md` | — |

Regras de conduta herdadas do SiriusComex (vinculantes):
- O Worker segue o plano **literalmente**. Se um `old_string` não casa, um teste falha após 1 correção, ou o plano não cobre o caso: **parar e reportar** — não improvisar.
- O Monitor **roda ele mesmo** os comandos de verificação (`gh pr checks`, diff, greps dos critérios de aceite, execução local quando preciso). Relato do worker é hipótese, não evidência.
- Em dúvida entre `aprovado` e `ajustar` → `ajustar`.

## 3. Portão 1 — Gate de plano

Invocável via skill [`/gate-plano <onda>`](../../.claude/skills/gate-plano/SKILL.md). O Monitor verifica:

1. **Constituição:** o plano cita e respeita os princípios afetados (I — arquivos-fonte do protótipo referenciados por tela; II — nenhuma feature entra "parcial"; VIII — pendências como parâmetro+badge).
2. **Roadmap/matriz:** escopo bate com a onda no [`roadmap-canonico.md`](roadmap-canonico.md) e com as linhas correspondentes da [matriz de rastreabilidade](../superpowers/plans/2026-07-22-matriz-rastreabilidade-v1.1.md); nenhuma rota da onda ficou de fora.
3. **Decisões:** consistente com `docs/execucao/DECISOES.md` (não reabre AD-01..AD-06; não fixa as pendências P1–P15 que continuam abertas).
4. **Autossuficiência para o worker:** padrão do plano F4c — Goal/Architecture/Tech Stack, decisões fixadas, estrutura de arquivos, mapa DoD→teste 1:1, tasks com código literal, comandos com saída esperada, zero "TBD"/"implementar depois". Um worker de modelo inferior consegue executar sem decidir nada.
5. **Consistência cruzada:** nomes de entidades/endpoints/eventos batem com o plano mestre e com planos de ondas vizinhas.

Veredito: `aprovado | ajustar | bloqueado` + feedback objetivo, registrado em `GATE-VEREDITOS.md`.

## 4. Portão 2 — Gate de PR

Invocável via skill [`/gate-pr <onda> <nº do PR>`](../../.claude/skills/gate-pr/SKILL.md). O Monitor verifica, **executando ele mesmo**:

1. **CI 100% verde** (`gh pr checks`) — os oito jobs canônicos de [`ci-spec.md`](ci-spec.md)
   (lint, type-check, testes, cobertura ≥80% linha+branch, build, audit, secret-scan). Vercel é
   exigido somente quando o diff toca `landing/**`; nos demais PRs seu status não faz parte do
   gate da aplicação.
2. **Diff vs. plano:** todo item do plano tático implementado; nada fora do escopo; critérios de aceite (§ do plano) verificados um a um (grep/execução).
3. **RA-01..06 em runtime** — checklist de [`framework-revisao.md`](framework-revisao.md) §6.
4. **Fidelidade ao protótipo (Princípio I):** para cada tela do PR, comparar com a rota equivalente do protótipo (rodar ambos ou comparar screenshots Playwright vs. protótipo); divergência não autorizada → `ajustar`.
5. **DoD da onda** ([`quality-gates.md`](quality-gates.md)) demonstrada por teste com link.
6. **Segurança:** sem segredo commitado, RBAC nos endpoints novos (teste de 403), migrations reversíveis.

Veredito registrado; merge só com `aprovado`. Reprovação volta ao Worker com lista objetiva.

## 5. Estado vivo (`docs/execucao/`)

| Arquivo | Escritor único | Conteúdo |
|---|---|---|
| `EXECUCAO-STATUS.md` | Executor | tabela por onda: status (`aguardando_inicio → planejando → aguardando_portao1 → plano_aprovado → implementando → aguardando_portao2 → mergeada` \| `bloqueada`), PR, SHA do merge, observações |
| `GATE-VEREDITOS.md` | Monitor | **append-only**; linha por veredito: `data · onda · portão · veredito · evidência · feedback` |
| `DECISOES.md` | Quality Owner (registrado pelo Executor) | decisões numeradas `AD-xx` que fecham pendências (fonte de precedência máxima abaixo da constituição) |

## 6. Formato obrigatório do plano tático de onda

Padrão consolidado no plano F4c (`docs/superpowers/plans/2026-06-07-f4c-corte-transformacao.md`) e exigido no Portão 1:

```markdown
# Onda <N> — <Nome> — Plano de Implementação
> Para workers agênticos: SUB-SKILL OBRIGATÓRIA superpowers:subagent-driven-development ou executing-plans.
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

- **Assistida (skills):** humano/Executor invoca `/gate-plano`, `/disparar-onda`, `/gate-pr` manualmente.
- **Autônoma (workflows):** [`.claude/workflows/ciclo-onda-autonomo.js`](../../.claude/workflows/ciclo-onda-autonomo.js) executa o ciclo completo de UMA onda (pré-condições → Portão 1 → implementação → Portão 2 → **verificação adversarial** → merge) sem intervenção; [`.claude/workflows/ciclo-multionda-autonomo.js`](../../.claude/workflows/ciclo-multionda-autonomo.js) agenda múltiplas ondas respeitando o grafo de dependências do roadmap, com lock em disco para exclusão mútua. A **verificação adversarial** é uma etapa extra exclusiva do modo autônomo: após o Portão 2 aprovar, um segundo revisor independente tenta **refutar** a aprovação; refutação sustentada reabre o ciclo. Política de modelo preservada: workers em modelo inferior, gates em modelo superior.

## 9. Relação com o framework de revisão existente

[`framework-revisao.md`](framework-revisao.md) permanece vigente para o mecânico de branches/PR/proteções/relatório de gate de fase. Este documento adiciona por cima: o Portão 1 (que não existia), os papéis separados Executor/Monitor/Worker (antes: revisor humano único) e o estado vivo auditável. O "Revisor/Quality Owner" do framework mapeia para Quality Owner (autoridade) + Monitor (execução da auditoria).
