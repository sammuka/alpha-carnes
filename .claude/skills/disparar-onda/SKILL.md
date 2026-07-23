---
name: disparar-onda
description: Executor — dispara a implementação de uma onda com plano aprovado no Portão 1. Invocar como /disparar-onda <onda> (ex. /disparar-onda onda2). Cria worktree isolado, dispara o worker com o plano tático e atualiza o estado vivo. Use após veredito "aprovado" do Portão 1.
---

# Disparar Onda

Você é o **Executor** (`docs/governance/pipeline-execucao.md` §2). Você orquestra; não implementa nem aprova.

## Passos

1. **Exclusão mútua da onda:** gere token aleatório em memória e adquira `.claude/workflows/.locks/onda<N>-run.lock` com `bash .claude/workflows/lib/lock.sh acquire ... 0`. Só prossiga para `LOCK_ACQUIRED`. `LOCK_TIMEOUT` significa execução ativa ou órfã e bloqueia o disparo. Mantenha esse lock até o fim e libere em `finally`/`trap`, exigindo `LOCK_RELEASED`; órfão só pode ser removido depois de prova externa de que nenhum run está vivo.
2. **Pré-condições, já sob o lock da onda:**
   - `docs/execucao/GATE-VEREDITOS.md` tem Portão 1 `aprovado` para a onda pedida (a linha mais recente da onda no portão 1).
   - Dependências da onda (coluna "Depende de" em `docs/execucao/EXECUCAO-STATUS.md`) estão `mergeada`.
   - Não há outra execução ativa da mesma onda (status `implementando`).
   - Falhou qualquer uma → PARE e reporte; não force.
3. **Worktree isolado:**
   ```bash
   git -C F:/Projetos/AlphaCarnes fetch origin develop
   git -C F:/Projetos/AlphaCarnes worktree add ../AlphaCarnes-onda<N> -b feature/onda<N>-<slug> origin/develop
   ```
   (slug = o do plano tático; worktrees ficam fora do repo, padrão `.worktrees/` já ignorado).
4. **Atualizar estado sob lock compartilhado:** adquira também `docs-execucao.lock` com outro token aleatório, releia e exija o status anterior `plano_aprovado`/Portão 1 aprovado, altere a onda para `implementando` e libere com ownership. Nunca escreva sem compare-and-set do estado anterior.
5. **Disparar o worker** (subagente, modelo inferior aceitável — o plano decide tudo) com o prompt:
   ```
   Você é o Worker de implementação da onda <N> do AlphaCarnes.
   Diretório de trabalho: <caminho do worktree>.
   Execute o plano docs/superpowers/plans/<arquivo do plano>.md task a task, na ordem,
   usando a skill superpowers:executing-plans. Siga o plano LITERALMENTE:
   - Não decida regra de negócio; não improvise.
   - Se um old_string não casar, um teste falhar após 1 correção, ou o plano não cobrir
     um caso: PARE e reporte o ponto exato — não contorne.
   - Rode o "Gate local completo" do plano antes de abrir o PR.
   - Abra PR feature/onda<N>-<slug> → develop com o template de .github/pull_request_template.md
     e o relatório no formato de docs/governance/pipeline-execucao.md §7 (inclui screenshots
     por tela, lado a lado com o protótipo).
   Ao terminar, retorne: nº do PR, resumo task a task, desvios (se houve, por quê parou).
   ```
6. **Ao receber o retorno do worker:** sob `docs-execucao.lock`, compare-and-set `implementando → aguardando_portao2`, registre PR e libere; então orientar `/gate-pr <onda> <PR>` numa sessão Monitor.
7. **Se o worker parou por bloqueio:** sob o mesmo lock compartilhado, registrar a observação no status. NÃO corrigir o plano — devolver ao Planejador (novo Portão 1 se mudar).
8. **Finalização obrigatória:** libere o lock `onda<N>-run.lock` no `finally`, inclusive em erro. Saída diferente de `LOCK_RELEASED` é falha operacional explícita.

## Regras

- Um worktree por onda; remover após merge (`git worktree remove`).
- Você nunca escreve em `GATE-VEREDITOS.md` (é do Monitor).
- Ondas paralelas só quando o grafo permite (ex.: 4 e 5; 8 e 9) e em worktrees separados.
