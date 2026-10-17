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

1. Normalize a fatia e valide o número do PR.
2. `gh pr view <n> --json baseRefName,headRefName,headRefOid,body,comments`: base `develop`,
   branch declarada no plano; capture `headRefOid`.
3. O comentário de Portão 1 mais recente no PR é `aprovado` e cita o OID do blob do plano igual a
   `git rev-parse <head>:<plano>`. Plano alterado depois do gate volta ao Portão 1.
4. O corpo do PR tem Resumo, Divergências, Evidências, DoD → teste e Pendências.
5. Crie um worktree de auditoria destacado no head exato, separado do worktree do Worker.

Falha de qualquer pré-condição → `bloqueado`.

**PR só de documentação/skills:** o gate é CI 8/8 no head + diff igual ao escopo declarado +
ausência de segredo. Pule o ataque de domínio.

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
6. **E2E:** rode `npm run e2e:ci`. `next dev` não é ambiente de gate.

## Parte 2 — Ataque de domínio (lista mínima)

Tente quebrar a fatia:

1. Invariantes do plano por caminho alternativo (outro endpoint, outra ordem, payload limite).
2. Vigência: sobreposição, lacuna, retroatividade, pai com vigência que exclui filhas.
3. Segregação de funções: autoaprovação, mesmo usuário em etapas distintas.
4. Concorrência: requisições simultâneas, ordem de locks, `FOR UPDATE`/`FOR SHARE` do pai na
   criação de filho, guarda de envio em voo.
5. Auditoria: quem, quando, valor anterior e novo em toda mutação crítica.
6. RBAC dos 11 perfis: teste de 403 por endpoint novo; nenhuma rota sem guarda.
7. Caminho UI → API → DB → evento → UI: o que a tela mostra é o que foi gravado; lookup não grava
   código oculto; evento atualiza a outra tela.
8. Cálculo fiscal/financeiro: o campo que deveria controlar o cálculo o controla; escala e
   arredondamento `NUMERIC`.
9. UI no DS e com os componentes do protótipo citados no plano.

## Classificação fechada

**BLOQUEANTE** somente: (1) perda ou corrupção de dado; (2) cálculo fiscal ou financeiro
errado; (3) bypass de RBAC ou de segregação; (4) segredo exposto; (5) violação de invariante
escrito no plano; (6) erro 500 em caminho de usuário.

Tudo o mais é **MENOR**. Em dúvida, **MENOR com justificativa**. Fidelidade visual bloqueia só
por tela sem o DS ou componente do protótipo ausente; variante, texto literal e espaçamento são
MENOR. Item coberto por verificação automatizada (`pipeline-execucao.md` §11) não é achado de
Monitor. Decisão de produto ausente → `bloqueado`, e na saída estruturada `requires-human`;
demais bloqueios → `blocked`.

`aprovado` = zero BLOQUEANTE. `ajustar` = BLOQUEANTE corrigível. `bloqueado` = pré-condição
falhou ou decisão de produto ausente.

## Rodadas

- 1ª: conformidade + ataque completos.
- 2ª: só se a 1ª teve BLOQUEANTE; audite apenas `git diff <head-anterior>..<head-novo>` e a
  resolução dos BLOQUEANTES. Forme a conclusão sobre o delta **antes** de ler o laudo anterior.
  Achado novo fora do delta só conta se for BLOQUEANTE.
- 3ª: aprova; MENORES restantes vão para o PR de hardening do épico. BLOQUEANTE persistente é
  escalado ao Quality Owner. Exceção ao teto só por decisão explícita do QO, nunca por AD
  delegada.
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
URL do comentário. Só `aprovado` libera o merge, que usa
`gh pr merge <n> --squash --match-head-commit <head aprovado>`; depois o agente que mergeia
atualiza `EXECUCAO-STATUS.md` uma vez.
