---
name: gate-pr
description: Gate único de implementação (rito v2, AD-41) — audita o PR de uma fatia do AlphaCarnes antes do merge, em duas partes (conformidade e ataque de domínio), e registra o veredito como comentário no PR. Use quando um PR de fatia para develop estiver aberto com CI rodado, ou quando alguém pedir gate, revisão ou aprovação de PR. Substitui revisão crítica por commit, Portão 2 e Portão A.
---

# Gate único — Gate de implementação por PR (AD-41)

Delegue a auditoria inteira a uma nova instância `monitor` (`claude-opus-5.5`), independente de
quem planejou e implementou a fatia. O coordenador e o Worker não auditam. O Monitor verifica por
comandos próprios; o relatório do Worker é hipótese, não evidência. Critérios completos:
`docs/governance/pipeline-execucao.md` §4.

## Pré-condições

PR só de documentação/skills: dispensa as pré-condições de plano (Portão 1 aprovado e seções do corpo do PR); gate = CI 8/8 + diff = escopo + sem segredo + leitura de coerência quando tocar governança.

Demais PRs:

1. Normalize a fatia e valide o número do PR.
2. `gh pr view <n> --json baseRefName,headRefName,headRefOid,body,comments`: base `develop`,
   branch declarada no plano; capture `headRefOid`.
3. O comentário de Portão 1 mais recente no PR é `aprovado` e cita o OID do blob do plano igual a
   `git rev-parse <head>:<plano>`. Plano alterado depois do gate volta ao Portão 1.
4. O corpo do PR tem Resumo, Divergências, Evidências, DoD → teste e Pendências.
5. Crie um worktree de auditoria destacado no head exato, separado de `.worktrees/<fatia>`.
6. Fatia com tela: `fix/harness-e2e-ci` mergeado em `develop`. O merge de `fix/harness-e2e-ci` é pré-condição do primeiro gate único com tela (E09-T03 em diante); até lá, Playwright roda com banco descartável recriado e `next build && next start`, nunca `next dev`.

Falha de qualquer pré-condição → `bloqueado`.

## Parte 1 — Conformidade

1. **CI 8/8 no head exato** (`gh pr checks <n>`): `lint`, `type-check`, `test-backend`,
   `coverage`, `test-frontend`, `build`, `audit`, `secret-scan`, todos com sucesso. Pending ou
   skipped não aprova. Vercel só se o diff tocar `landing/**`. Repositório privado com CI que
   exige visibilidade: `.codex/scripts/visibility-ci.ps1 -PrNumber <n> -EnableVisibilityLease`
   (AD-21).
2. **Diff vs. plano:** `git diff <base>...<head>` coberto pela lista de arquivos do plano; nada
   fora do escopo; cada divergência está declarada no PR.
3. **DoD → teste:** cada teste do mapa existe, a asserção prova o critério e passa.
4. **RA-01..06:** regra crítica só no backend; mutação crítica em transação com auditoria;
   evento só pós-commit, sem polling; falha externa explícita; nada inventado.
5. **Migrations:** `drizzle-kit`, reversíveis, sem `ALTER TABLE` manual nem DELETE físico.
6. **E2E:** Playwright via `npm run e2e:ci`. O merge de `fix/harness-e2e-ci` é pré-condição do primeiro gate único com tela (E09-T03 em diante); até lá, Playwright roda com banco descartável recriado e `next build && next start`, nunca `next dev`.

## Parte 2 — Ataque de domínio (lista mínima)

Tente quebrar a fatia:

1. **Invariantes do plano:** cada invariante atacado por caminho alternativo (outro endpoint, outra ordem, payload limite).
2. **Vigência:** sobreposição, lacuna, retroatividade, pai com vigência que exclui filhas.
3. **Segregação de funções:** autoaprovação; mesmo usuário em etapas que exigem pessoas distintas.
4. **Concorrência:** requisições simultâneas, ordem de locks (deadlock), `FOR UPDATE`/`FOR SHARE` do pai na criação de filho, guarda de envio em voo.
5. **Auditoria:** toda mutação crítica grava quem, quando, valor anterior e novo.
6. **RBAC dos 11 perfis:** teste de 403 por endpoint novo; nenhuma rota sem guarda.
7. **Caminho UI → API → DB → evento → UI:** a tela mostra o que foi gravado; lookup não grava código oculto; evento atualiza a outra tela.
8. **Cálculo fiscal/financeiro:** o campo que deveria controlar o cálculo o controla; escala e arredondamento `NUMERIC`.
9. **UI no DS v3:** tela usa o DS v3 e os componentes do protótipo citados no plano.

## Classificação fechada

**BLOQUEANTE** — somente estas seis classes:

1. perda ou corrupção de dado;
2. cálculo fiscal ou financeiro errado;
3. bypass de RBAC ou de segregação de funções;
4. segredo exposto;
5. violação de invariante escrito no plano;
6. erro 500 em caminho de usuário.

Tudo o mais é **MENOR**. Em dúvida de severidade, MENOR com justificativa; dúvida de decisão de produto bloqueia (fail-closed).

Fidelidade visual: tela sem o DS v3 ou componente do protótipo ausente = BLOQUEANTE pela classe 5 (invariante do plano/Princípio I); variante, texto literal, espaçamento = MENOR.

Item já coberto por verificação automatizada mergeada (`pipeline-execucao.md` §11) não é achado
de Monitor; enquanto o check não existir, verifique o item manualmente. Decisão de produto
ausente → `bloqueado`, e na saída estruturada `requires-human`; demais bloqueios → `blocked`.

`aprovado` = zero BLOQUEANTE. `ajustar` = BLOQUEANTE corrigível. `bloqueado` = pré-condição
falhou ou decisão de produto ausente.

## Rodadas

Rodadas do Gate único: r1 completa; r2 só por delta e só se houve BLOQUEANTE; r3 por delta: se não restar BLOQUEANTE, aprova e os MENORES vão ao backlog; se restar BLOQUEANTE, escala ao QO. Exceção ao teto só por decisão explícita do QO.

- Na r2 e na r3 audite `git diff <head-anterior>..<head-novo>` e a resolução dos BLOQUEANTES;
  forme a conclusão sobre o delta **antes** de ler o laudo anterior. Achado novo fora do delta só
  conta se for BLOQUEANTE.
- Releia `headRefOid` ao terminar. Head diferente invalida a rodada.

## Registro

Poste o laudo como comentário no PR — sem lock, sem `GATE-VEREDITOS.md`, sem commit:

```powershell
gh pr comment <n> --body-file <laudo.md>
```

```markdown
## Gate único — <fatia> — rodada <r>
- head: <sha completo>
- plano-blob: <OID do blob> (sha256 <hash>)
- risco: alto | baixo
- rodada: <r> de 3
- veredito: aprovado | ajustar | bloqueado
- modelo: solicitado <id>; efetivo <id ou "não atestável">
- comandos: <resumo>
### Conformidade
<item a item>
### Ataque de domínio
<item a item>
### Achados
1. [BLOQUEANTE classe <1-6>] <achado> — <evidência>
2. [MENOR] <achado> — <justificativa>
```

Remova só o worktree de auditoria desta rodada.

## Saída

Retorne fatia, PR, head auditado, plano-blob, risco, rodada, veredito, achados classificados e a
URL do comentário. Só `aprovado` libera o merge. `EXECUCAO-STATUS.md` é atualizado pelo agente que mergeia, em commit de coordenação neutra no PR (AD-22 item 5, vigente), antes do `gh pr merge --match-head-commit`; o merge usa o head desse commit, com CI 8/8 nele.
