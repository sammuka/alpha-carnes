# Pipeline Reproduzível — Como replicar esta estrutura em um projeto novo

> **Status:** Vigente · **Versão:** 1.0.0 · **Data:** 2026-07-23
> Meta-documento: descreve as peças da pipeline de governança/execução do AlphaCarnes (adaptada do SiriusComex) de forma **agnóstica de projeto**, com checklist e ordem de criação, para reproduzi-la em qualquer projeto futuro.

## 1. As peças e o que cada uma resolve

| # | Peça | Arquivo(s) no AlphaCarnes | Problema que resolve |
|---|---|---|---|
| 1 | **Constituição** | `docs/governance/constituicao.md` | Princípios inegociáveis num só lugar, versionados (semver + log de emendas), citáveis por número nos gates. Sem ela, cada PR renegocia o que é "qualidade". |
| 2 | **Roadmap com grafo** | `docs/governance/roadmap-canonico.md` | Unidades de trabalho (ondas/fases) com dependências explícitas — permite paralelismo seguro e agendamento autônomo. |
| 3 | **Quality gates / DoD** | `docs/governance/quality-gates.md` | Critérios objetivos por PR (transversais) e invariantes testáveis por unidade de trabalho (DoD). |
| 4 | **Rito de execução (2 gates, 3 papéis)** | `docs/governance/pipeline-execucao.md` | Plano→Portão1→Implementação→Portão2→Merge. Portão 1 barra plano ruim ANTES do código; Portão 2 barra código ruim antes do merge. Papéis separados (Executor/Monitor/Worker) impedem auto-aprovação. |
| 5 | **Estado vivo** | `docs/execucao/EXECUCAO-STATUS.md`, `GATE-VEREDITOS.md`, `DECISOES.md` | Histórico auditável de status, vereditos (append-only) e decisões do cliente numeradas (AD-xx). Escritor único por arquivo elimina conflito. |
| 6 | **Skills de gate (rito manual)** | `.claude/skills/{gate-plano,gate-pr,disparar-onda}/SKILL.md` | Tornam o checklist *invocável* (`/gate-plano onda2`) em vez de prosa que ninguém segue. São a fonte canônica dos checklists. |
| 7 | **Planos táticos autossuficientes** | `docs/superpowers/plans/*.md` (padrão F4c) | Detalhe máximo (código literal, DoD→teste 1:1, comandos com saída esperada) para que um **worker de modelo inferior** execute sem decidir nada. Quem pensa é o Planejador; quem executa é o Worker. |
| 8 | **CI como gate automático** | `.github/workflows/ci.yml` + `docs/governance/ci-spec.md` | Gates binários que não dependem de julgamento (lint, types, testes, cobertura, audit, secret-scan). O Portão 2 verifica que o CI rodou; não o substitui. |
| 9 | **Workflows autônomos** | `.claude/workflows/ciclo-onda-autonomo.js`, `ciclo-multionda-autonomo.js`, `lib/lock.sh` | Rodam o rito inteiro sem humano, com uma etapa extra (verificação adversarial) e infraestrutura anti-falha (locks, checkpoints, retry por cadência). |

## 2. Ordem de criação em um projeto novo (checklist)

Copie os arquivos do AlphaCarnes como template e adapte nesta ordem — cada passo referencia o anterior:

- [ ] **1. Constituição** (`docs/governance/constituicao.md`): liste os princípios do projeto. Regras: numerar (I, II, …); marcar NÃO-NEGOCIÁVEL só o que realmente é; incluir seção de fontes de verdade com precedência; seção de pendências externas; governança de emendas + log. *Dica: os princípios saem das regras arquiteturais já existentes (no AlphaCarnes, RA-01..06) + das premissas do cliente (fidelidade a protótipo, completude E2E).*
- [ ] **2. Roadmap com grafo** : unidades de trabalho pequenas o suficiente para 1 PR revisável, com coluna "Depende de" e diagrama do grafo. Correções estruturais/dívidas vêm ANTES de features novas.
- [ ] **3. Quality gates**: gates transversais (o que o CI verifica) + DoD por unidade (invariantes com teste). Cobertura mínima como número, não intenção.
- [ ] **4. Rito** (`pipeline-execucao.md`): copie o do AlphaCarnes e ajuste: branch de integração, formato de plano, política de modelo por papel (Worker=inferior, Monitor=superior — nunca rebaixar o Monitor).
- [ ] **5. Estado vivo** (`docs/execucao/`): 3 arquivos vazios com cabeçalho, vocabulário de status fixo e regra de escritor único. GATE-VEREDITOS.md é append-only desde a linha 1.
- [ ] **6. Skills**: copie `gate-plano`, `gate-pr`, `disparar-onda` e substitua: caminhos das réguas, jobs do CI, verificações específicas do domínio (no AlphaCarnes, fidelidade ao protótipo; no SiriusComex, RLS multi-tenant). *A skill é a fonte canônica do checklist — os workflows autônomos espelham; deixe o aviso de SINCRONIA nos dois lados.*
- [ ] **7. CI**: jobs nomeados como gates, todos como status checks obrigatórios na branch protection. Integrações externas SEMPRE por fake determinístico no CI.
- [ ] **8. Primeiro plano tático** no padrão autossuficiente (ver §3) e primeira rodada MANUAL do rito (`/gate-plano` → implementar → `/gate-pr`) para calibrar.
- [ ] **9. Workflows autônomos** (só depois do passo 8 validado ao menos 1 vez): copie `ciclo-onda-autonomo.js` + `ciclo-multionda-autonomo.js` + `lib/lock.sh`; substitua: `REPO`, grafo (`GRAFO`), tokens de status, jobs do CI, blocos de auditoria (espelho das suas skills), padrões de arquivos compartilhados do passo 2c do merge. Adicione `.claude/workflows/.locks/` ao `.gitignore`.

## 3. Anatomia do plano tático autossuficiente (padrão F4c)

O contrato central da pipeline: **quem pensa é o Planejador (modelo superior); quem executa é o Worker (modelo inferior)**. Para isso funcionar, o plano precisa de:

```markdown
# <Unidade> — Plano de Implementação
> Para workers agênticos: SUB-SKILL OBRIGATÓRIA (subagent-driven-development / executing-plans)
**Goal / Architecture / Tech Stack** (3 linhas)
## Global Constraints        ← copiadas verbatim da constituição/spec, com valores exatos
## Decisões de design (fixadas — só reabrir se houver quebra)
## Referências externas POR ITEM  ← ex.: tela → arquivo .tsx do protótipo (fidelidade auditável)
## Estrutura de arquivos     ← paths exatos, responsabilidade de cada um
## Mapa DoD → teste (1:1)    ← cada invariante com o NOME do teste que o prova
## Task 1..N
   Files (Create/Modify/Test com paths exatos)
   Interfaces (Consumes/Produces — assinaturas exatas; é como tasks vizinhas se conhecem)
   Steps: teste falhando → rodar (saída esperada) → implementação (CÓDIGO LITERAL) → rodar → commit
## Gate local completo       ← comandos idênticos ao CI, para rodar antes do PR
## Self-Review               ← o Planejador confere cobertura da spec, placeholders, consistência de tipos
```

Proibições que o Portão 1 verifica por grep: `TBD`, `TODO`, "a definir", "implementar depois", "similar à Task N", passo de código sem bloco de código.

## 4. Regras de conduta que fazem a pipeline funcionar (independentes de projeto)

1. **Worker para em vez de improvisar.** Se `old_string` não casa, um teste falha após 1 correção, ou o plano não cobre o caso → reporta o ponto exato e para. Um worker que "dá um jeito" destrói a garantia do Portão 1.
2. **Monitor executa, não confia.** Relato do worker é hipótese. `gh pr checks`, diff, greps e execução local são evidência.
3. **Em dúvida, reprova.** `ajustar` é barato; defeito mergeado é caro.
4. **Vereditos são append-only.** Histórico de gate nunca é editado — nova rodada, nova linha.
5. **Decisão do cliente vira AD-xx** antes de virar código. Pendência sem AD = parâmetro + badge provisório.
6. **Escritor único por arquivo de estado.** Executor → STATUS; Monitor → VEREDITOS; Quality Owner → DECISOES.
7. **Um worktree por unidade de trabalho**, removido após o merge.
8. **Nunca rebaixar o modelo do Monitor** para economizar — o gate é onde o julgamento importa.

## 5. Lições operacionais herdadas do SiriusComex (embutidas nos workflows)

Estas defesas custaram diagnósticos reais lá — não as remova ao adaptar:

- **Watchdog de silêncio (~3 min sem token)** mata turnos de raciocínio longos, não tarefas longas → auditorias decompostas em blocos paralelos de contexto pequeno + diretiva de cadência no retry (`agentComRetry`). Nunca "ler menos"; sempre "passos mais curtos".
- **Memória de progresso em disco** (`.locks/progresso-*.md`): implementações longas retomam do checkpoint em vez de recomeçar do zero a cada reinício do harness.
- **Lock em disco via `mkdir` atômico** (`lib/lock.sh`, versionado — o agente invoca verbatim, nunca reimplementa): serializa escrita no estado vivo e a janela crítica de merge entre execuções concorrentes; rouba locks órfãos com marker atômico anti-TOCTOU.
- **Lock de instância única do orquestrador**: dois runs multionda sobrepostos saturam a RAM (N workers × jest/tsc cada).
- **Pin de SHA auditado**: o merge só vale para o commit que os gates auditaram; head diferente → re-auditoria.
- **Espera de CI explícita** antes de cada rodada de auditoria (PR recém-aberto está sempre pending — sem a espera, as rodadas de correção são queimadas por latência, não por defeito).
- **Auto-recuperação de branch desatualizada** no merge (rebase + reteste + force-with-lease + re-espera de CI), FORA do lock; re-checagem de mergeable DENTRO do lock.
- **Disparo de workflow filho por `scriptPath`**, não por nome (o registro por nome pode cachear versão antiga do script).
- **Normalização de status antes de comparar** (células reais trazem sufixo: "mergeada (PR #12, …)").
- **Lista positiva de status elegíveis** no agendador — status desconhecido = não disparar, nunca disparar por omissão.
- **Resultado adiável ≠ bloqueante**: dependência não satisfeita por timing volta à fila; veredito negativo de gate para o run.
- **Sem interação síncrona em background**: todo agente do workflow recebe o preâmbulo que proíbe AskUserQuestion/PlanMode e ensina a escalar via `requerDecisaoHumana`.

## 6. O que é específico de cada projeto (adaptar, não copiar)

| Dimensão | AlphaCarnes | SiriusComex | Num projeto novo |
|---|---|---|---|
| Verificação de domínio no Portão 2 | Fidelidade ao protótipo (Princípio I) + RA-01..06 | Isolamento multi-tenant (RLS) + anti-marca/anti-paleta | O(s) invariante(s) que, violado(s), invalidam o produto |
| Branch de integração | `develop` (release por fase → `main`) | `main` direto | Conforme o modelo de release |
| Unidade de trabalho | Onda (grupo de telas/módulo) | Subfase (fatia de onda) | Menor unidade com PR revisável e DoD própria |
| Fonte de verdade visual | Protótipo React validado | Design system token-only | O contrato visual que o cliente aprovou |
| Pendências | v1.1 §16 → parâmetro + badge "Provisório" | Pendências externas da constituição | Toda incerteza do cliente vira parâmetro sinalizado |
