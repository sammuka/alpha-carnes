---
name: gate-plano
description: Portão 1 (rito v2, AD-41) — audita o plano tático de uma fatia do AlphaCarnes antes da implementação com um checklist fixo de 10 itens, escala aprovado/ajustar e teto de 2 rodadas, registrando o veredito como comentário no PR da fatia. Use quando um plano em docs/superpowers/plans estiver pronto, ou quando alguém pedir gate, revisão ou aprovação de plano.
---

# Portão 1 — Gate de plano (AD-41)

Delegue a auditoria inteira a uma nova instância `monitor` (`claude-opus-5.5`), independente de
quem escreveu o plano. O coordenador não audita, não edita o plano e não escreve o veredito. Se
não for possível criar um Monitor independente, a saída estruturada é `blocked`. Critérios
completos: `docs/governance/pipeline-execucao.md` §3.

## Entrada e lugar único de registro

1. Normalize o argumento para a fatia (ex. `e09-t03`).
2. Localize o PR da fatia (`gh pr list --head <branch do plano>`). Ele é o **lugar único** de todo
   veredito da fatia. Se o plano ainda não tem PR, o Planner abre o PR rascunho
   (`gh pr create --draft --base develop`) com o commit do plano antes do gate; sem PR da fatia,
   a saída estruturada é `blocked`.
3. Fixe o plano no head do PR: `git rev-parse <head>:<plano>` (OID do blob) e sha256 de
   `git show <head>:<plano>`. Nunca o arquivo em disco.
4. Leia as réguas necessárias: constituição, `DECISOES.md`, plano mestre/épico, fontes de UI.

Régua ausente reprova o item correspondente; não use conhecimento presumido.

## Checklist fixo (10 itens)

1. **Fontes citadas por tela:** cada tela aponta para o `.tsx` exato do protótipo (ou da interface da expansão, AD-18) e o arquivo existe.
2. **Invariantes explícitos:** as regras que não podem quebrar (saldo, vigência, segregação, unicidade, ordem de locks, auditoria antes/depois) estão escritas como invariantes numerados e verificáveis.
3. **Contratos:** schema (tabelas, colunas, CHECK, índices — em prosa/tabela, não SQL), endpoints (método, rota, permissão, códigos de erro) e eventos de domínio declarados e consistentes com o plano mestre e fatias vizinhas.
4. **DoD → teste 1:1:** cada critério de pronto tem um teste nomeado que o demonstra.
5. **Lista de arquivos com ownership:** todo path que a fatia cria ou altera, com dono exclusivo quando houver paralelismo.
6. **Critérios de parada e executabilidade:** quando o Worker para e reporta, e nada fica para ele decidir (sem `TBD`, sem regra de negócio ou decisão de produto em aberto).
7. **Rollback:** como reverter migration e feature (reversibilidade, expand → backfill → contract quando aplicável).
8. **Classe de risco declarada:** `alto` (dinheiro, baixa, conciliação, razão, cofre/certificado/segredo, fiscal, RBAC/autorização, migração de dados) ou `baixo`, compatível com o escopo.
9. **Sem código literal:** o plano descreve contratos e comportamento; snippets de implementação são do Worker.
10. **≤ 400 linhas.**

Nada além do checklist é critério de reprovação.

## Escala e rodadas

Escala própria do Portão 1: `aprovado` (os 10 itens ok) ou `ajustar` (qualquer item falhando). Não há `bloqueado` nem as seis classes, que são do Gate único. Teto de 2 rodadas; na 3ª tentativa escala ao QO. Decisão de produto ausente reprova o item 6 e a saída estruturada é `requires-human`.

- A 2ª rodada audita só o delta do plano (`git diff <head-anterior>..<head-novo> -- <plano>`) e
  os itens reprovados na 1ª; forme a conclusão sobre o delta antes de ler o laudo anterior.
- Exceção ao teto só por decisão explícita do QO.

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
- veredito: aprovado | ajustar
- modelo: solicitado <id>; efetivo <id ou "não atestável">
### Checklist
1. [ok|falha] Fontes citadas por tela — <nota>
2. [ok|falha] Invariantes explícitos — <nota>
3. [ok|falha] Contratos — <nota>
4. [ok|falha] DoD → teste 1:1 — <nota>
5. [ok|falha] Lista de arquivos com ownership — <nota>
6. [ok|falha] Critérios de parada e executabilidade — <nota>
7. [ok|falha] Rollback — <nota>
8. [ok|falha] Classe de risco declarada — <nota>
9. [ok|falha] Sem código literal — <nota>
10. [ok|falha] ≤ 400 linhas — <contagem>
### Itens a ajustar
1. <item n> — <o que falta>
```

## Saída

Retorne fatia, PR, plano, OID do blob, rodada, veredito, itens reprovados e a URL do
comentário. Se aprovado, informe que a implementação pode ser disparada com `$disparar-onda`.
