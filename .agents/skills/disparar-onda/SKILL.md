---
name: disparar-onda
description: Dispara a implementação de uma onda do AlphaCarnes após Portão 1 aprovado, usando Executor e Worker separados, worktree isolado, checkpoint e atualização de estado. Use quando uma onda estiver plano_aprovado ou quando alguém pedir para iniciar, executar ou implementar uma onda já aprovada.
---

# Disparar onda

O coordenador delega operações de estado e Git ao agente `executor` e implementação ao agente
`worker`. Ele não escreve nem implementa.

## Pré-condições do Executor

1. Normalize `onda<N>` e leia a linha em `EXECUCAO-STATUS.md`.
2. Resolva o plano pelo link da coluna `Plano tático`.
3. Confirme Portão 1 `aprovado` vinculado ao SHA-256 atual do plano.
4. Exija todas as dependências como `mergeada`.
5. Rejeite status ativo, concluído, bloqueado ou desconhecido.
6. Confirme a branch `feature/onda<N>-<slug>` literal do plano.
7. Não reutilize branch/worktree sem checkpoint proprietário ou adoção órfã explícita.

Qualquer falha para sem mutação.

## Worktree e estado

O Executor:

1. Adquire lock `onda-<N>` e inicializa checkpoint.
2. Atualiza `origin/develop`.
3. Cria `.worktrees/o<N>` a partir de `origin/develop`.
4. Sob lock `coordination`, muda somente a linha para `implementando` e registra run ID,
   branch e worktree.
5. Libera o lock compartilhado antes do trabalho longo.

Não crie worktree sibling fora do repositório.

## Implementação do Worker

- Leia o plano por completo e siga tasks na ordem.
- Leia o `.tsx` do protótipo antes de cada tela.
- Trabalhe em TDD e commite por task.
- Não decida regra nem amplie escopo.
- Pare se contexto esperado não casar, o plano for omisso ou um teste continuar falhando após
  uma correção.
- Rode o gate local completo e abra PR para `develop` com relatório e screenshots.
- Use frontend host `4000`, backend host `4001` e PostgreSQL host `15433` nos testes locais
  (`3000`, `3001` e `5432` dentro dos containers).
- Se o diff tocar `landing/**`, aguarde Vercel; caso contrário, reporte apenas os oito jobs CI.
- Não faça merge nem edite `docs/execucao/`.

## Retorno ao Executor

Com PR válido, o Executor, sob lock `coordination`, muda somente a linha para
`aguardando_portao2` e registra o PR. Em bloqueio, preserve worktree/checkpoint e registre o
ponto exato; não corrija o plano. Libere todos os locks em `finally`.

## Saída

Retorne run ID, onda, plano/hash, worktree, branch, commits, testes, PR e estado final. Oriente
uma nova sessão a usar `$gate-pr`. Não execute Portão 2 dentro desta skill assistida.
