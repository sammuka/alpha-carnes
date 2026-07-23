---
name: gate-pr
description: Audita a implementação e o PR de uma onda do AlphaCarnes antes do merge e registra o Portão 2. Use quando um PR feature/onda para develop estiver aberto, o CI tiver sido iniciado, ou quando alguém pedir gate, revisão ou aprovação de PR de onda.
---

# Portão 2 — Gate de PR

Delegue a auditoria inteira a uma nova instância `monitor`. O coordenador e o Worker não
auditam. O Monitor verifica por comandos próprios; relatório do Worker não é evidência.

## Pré-condições

1. Normalize a onda e valide o número do PR.
2. Resolva o plano pelo link em `EXECUCAO-STATUS.md`.
3. Exija que o veredito mais recente de Portão 1 seja `aprovado` e contenha o SHA-256 atual
   do plano. Plano alterado depois do gate volta ao Portão 1.
4. Confirme com `gh pr view` que o alvo é `develop`, a branch é a declarada no plano e capture
   o `headRefOid`.
5. Crie um worktree de auditoria destacado no SHA exato, separado do Worker.

Falha de qualquer pré-condição retorna `bloqueado`.

## Auditoria

1. **CI**
   - Rode `.codex/scripts/visibility-ci.ps1 -PrNumber <n> -EnableVisibilityLease`.
   - O helper exige preflight `PRIVATE`, instala watchdog oculto, concede lease `PUBLIC` apenas
     durante a espera dos checks e restaura/verifica `PRIVATE` em `finally`.
   - Exija `lint`, `type-check`, `test-backend`, `coverage`, `test-frontend`, `build`,
     `audit` e `secret-scan`, todos concluídos com sucesso.
   - Derive `landingChanged` dos paths do diff. Se for verdadeiro, exija também o check Vercel;
     se for falso, ignore status Vercel. PR restrito à aplicação exige somente os oito jobs.
   - Pending ou skipped em job obrigatório não aprova.
2. **Diff vs. plano**
   - Confira task a task, arquivo a arquivo e a ausência de escopo estranho.
   - Migrations devem ser Drizzle, reversíveis e sem destruição injustificada.
3. **DoD → teste**
   - Localize cada teste do mapa, leia a asserção e execute o gate local exigido pelo plano.
4. **RA-01..06 e segurança**
   - Regra crítica só no backend; mutação crítica em transação com auditoria.
   - Evento somente pós-commit; nenhum polling novo.
   - Falha externa explícita; endpoint novo com permissão e teste 403; nenhum segredo.
5. **Fidelidade**
   - Compare telas com o `.tsx` citado e screenshots; reprove hex estranho e “Marca” em UI.
6. **Pin**
   - Releia `headRefOid` ao terminar. SHA diferente invalida toda a rodada.

Em dúvida, use `ajustar`. Segurança, violação não negociável ou decisão de produto ausente usa
`bloqueado` no veredito. Na saída estruturada do ciclo, decisão de produto ausente mapeia
obrigatoriamente para `requires-human`; os demais bloqueios mapeiam para `blocked`.

## Registro

Sob o lock `coordination`, anexe uma linha e nunca edite histórico:

```text
| <timestamp UTC> | onda<N> | 2 | aprovado|ajustar|bloqueado | PR #<n>; head=<sha>; plano-sha256=<hash>; comandos=<resumo> | <feedback numerado> |
```

Escape células, libere o lock em `finally` e remova somente o worktree de auditoria desta rodada.

## Saída

Retorne onda, PR, plano/hash, head auditado, veredito, verificações, feedback e linha anexada.
Só `aprovado` libera revisão adversarial ou merge.
