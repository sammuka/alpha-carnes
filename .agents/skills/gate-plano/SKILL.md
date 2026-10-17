---
name: gate-plano
description: Portão 1 (rito v2, AD-41) — audita o plano tático de uma fatia do AlphaCarnes antes da implementação com um checklist fixo de 10 itens e teto de 2 rodadas, registrando o veredito como comentário no PR da fatia. Use quando um plano em docs/superpowers/plans estiver pronto, ou quando alguém pedir gate, revisão ou aprovação de plano.
---

# Portão 1 — Gate de plano (AD-41)

Delegue a auditoria inteira a uma nova instância `monitor` (`claude-opus-5.5`), independente de
quem escreveu o plano. O coordenador não audita, não edita o plano e não escreve o veredito. Se
não for possível criar um Monitor independente, retorne `bloqueado`. Critérios completos:
`docs/governance/pipeline-execucao.md` §3.

## Entrada e lugar único de registro

1. Normalize o argumento para a fatia (ex. `e09-t03`).
2. Localize o PR da fatia (`gh pr list --head <branch do plano>`). Ele é o **lugar único** de todo
   veredito da fatia. Se o plano ainda não tem PR, o Planner abre o PR rascunho
   (`gh pr create --draft --base develop`) com o commit do plano antes do gate; sem PR da fatia,
   retorne `bloqueado`.
3. Fixe o plano no head do PR: `git rev-parse <head>:<plano>` (OID do blob) e sha256 de
   `git show <head>:<plano>`. Nunca o arquivo em disco.
4. Leia as réguas necessárias: constituição, `DECISOES.md`, plano mestre/épico, fontes de UI.

Arquivo ou régua ausente bloqueia o gate; não use conhecimento presumido.

## Checklist fixo (10 itens)

1. **Fontes citadas por tela** — cada tela aponta para o `.tsx` exato do protótipo (ou interface
   da expansão, AD-18) e o arquivo existe.
2. **Invariantes explícitos** — numerados e verificáveis.
3. **Contratos** — schema, endpoints (permissão e erros) e eventos, consistentes com o plano
   mestre e fatias vizinhas.
4. **DoD → teste 1:1.**
5. **Lista de arquivos com ownership.**
6. **Critérios de parada** do Worker.
7. **Rollback** de migration e feature.
8. **Classe de risco declarada** (`alto`/`baixo`) e compatível com o escopo.
9. **Sem código literal.**
10. **≤ 400 linhas.**

Nada além do checklist é critério de reprovação.

## Classificação

- **BLOQUEANTE** só quando o item reprovado cai em uma das seis classes (perda/corrupção de dado;
  cálculo fiscal/financeiro errado; bypass de RBAC/segregação; segredo exposto; violação de
  invariante; 500 em caminho de usuário) ou torna o plano inexecutável (itens 2, 3, 4 ou 8
  ausentes).
- Tudo o mais é **MENOR**, item obrigatório do Worker. Em dúvida, MENOR com justificativa.
- Decisão de produto ausente → `bloqueado`, e na saída estruturada `requires-human`; demais
  bloqueios → `blocked`.
- `aprovado` = zero BLOQUEANTE.

## Rodadas

Teto de **2 rodadas**. A 2ª audita só o delta do plano (`git diff <head-anterior>..<head-novo> --
<plano>`) e a resolução dos BLOQUEANTES; forme a conclusão sobre o delta antes de ler o laudo
anterior. BLOQUEANTE na 2ª rodada → o coordenador escala ao Quality Owner. Exceção ao teto só
por decisão explícita do QO.

## Registro

Poste o laudo como comentário no PR da fatia — sem lock, sem `GATE-VEREDITOS.md`, sem commit:

```powershell
gh pr comment <n> --body-file <laudo.md>
```

```markdown
## Portão 1 — <fatia> — rodada <r>
- head: <sha completo>
- plano: <path>
- plano-blob: <OID do blob> (sha256 <hash>)
- risco: alto | baixo
- rodada: <r> de 2
- veredito: aprovado | ajustar | bloqueado
- modelo: solicitado <id>; efetivo <id ou "não atestável">
### Checklist
1. [ok|falha] Fontes citadas por tela — <nota>
...
10. [ok|falha] ≤ 400 linhas — <contagem>
### Achados
1. [BLOQUEANTE] <achado> — <evidência>
2. [MENOR] <achado> — <justificativa>
```

## Saída

Retorne fatia, PR, plano, OID do blob, rodada, veredito, achados e a URL do comentário. Se
aprovado, informe que a implementação pode ser disparada com `$disparar-onda`.
