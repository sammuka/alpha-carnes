---
name: disparar-onda
description: Dispara a implementação de uma fatia do AlphaCarnes após Portão 1 aprovado (rito v2, AD-41), usando Executor e Worker separados em worktree isolado, sem lock de vereditos e com estado atualizado só no merge. Use quando uma fatia tiver plano aprovado ou quando alguém pedir para iniciar, executar ou implementar uma fatia já aprovada.
---

# Disparar fatia (AD-41)

O coordenador delega Git e worktree ao agente `executor` e a implementação ao agente `worker`.
Ele não escreve nem implementa. Critérios completos: `docs/governance/pipeline-execucao.md`.
Modelos (AD-41 item 9): Monitor: sempre `claude-opus-5.5`. Planner: opus em fatia de alto risco, sonnet em baixo risco e ajuste textual. Worker pontual e Executor: sonnet; Worker de fatia nova ou integração com conflito: opus.

## Pré-condições do Executor

1. Normalize a fatia e localize o PR da fatia (lugar único de vereditos).
2. O comentário de Portão 1 mais recente no PR é `aprovado` e cita o OID do blob do plano igual a
   `git rev-parse <head>:<plano>`.
3. Todas as dependências do plano estão mergeadas em `develop`.
4. A branch do PR é a branch literal do plano.
5. Não reutilize worktree de outra execução sem adoção explícita.

Qualquer falha para sem mutação.

## Worktree

O Executor atualiza `origin/develop` e cria `.worktrees/<fatia>` na branch do PR. Não há lock de
vereditos nem escrita em `docs/execucao/` durante a fatia: o estado só muda no merge.

## Implementação do Worker

- Leia o plano por completo; os snippets são seus — o plano traz contratos, invariantes, DoD →
  teste, arquivos e critérios de parada.
- Leia o `.tsx` do protótipo antes de cada tela.
- Trabalhe em TDD e commite por unidade coerente.
- Não decida regra de negócio nem amplie escopo. Pare e reporte nos critérios de parada do plano,
  quando o plano for omisso em regra ou quando um teste continuar falhando após uma correção.
- Rode o gate local (comandos do CI) e o Playwright **somente** via `npm run e2e:ci`. O merge de `fix/harness-e2e-ci` é pré-condição do primeiro gate único com tela (E09-T03 em diante); até lá, Playwright roda com banco descartável recriado e `next build && next start`, nunca `next dev`.
- Use frontend host `4000`, backend host `4001` e PostgreSQL host `15433` (`3000`, `3001` e
  `5432` dentro dos containers).
- Escreva o relatório no **corpo do PR** (Resumo, Divergências, Evidências, DoD → teste,
  Pendências) e tire o PR de rascunho (`gh pr ready <n>`). Rodadas seguintes: relatório do delta
  como comentário (`gh pr comment`).
- Divergência técnica do plano vai em "Divergências"; nunca crie AD.
- Não faça merge nem edite `docs/execucao/`.

## Paralelismo

Fatias sem dependência entre si podem rodar ao mesmo tempo, cada uma em seu worktree, com lista
explícita de paths exclusivos. Contratos compartilhados precisam estar mergeados antes.

## Merge e estado

Depois do Gate único `aprovado` (comentário no PR, via `$gate-pr`), o agente que mergeia:

1. Faz o commit de coordenação neutra que altera só `docs/execucao/EXECUCAO-STATUS.md` (linha
   da fatia: `mergeada`, PR) no PR (AD-22 item 5, vigente).
2. Espera CI 8/8 no novo head e roda `gh pr merge <n> --squash --match-head-commit <novo head>`.

`EXECUCAO-STATUS.md` é atualizado pelo agente que mergeia, em commit de coordenação neutra no PR (AD-22 item 5, vigente), antes do `gh pr merge --match-head-commit`; o merge usa o head desse commit, com CI 8/8 nele.

Em bloqueio, preserve o worktree e reporte o ponto exato; não corrija o plano.

## Saída

Retorne fatia, PR, plano/OID do blob, worktree, branch, commits, testes e estado. Oriente uma
nova sessão a usar `$gate-pr`. Não execute o Gate único dentro desta skill.
