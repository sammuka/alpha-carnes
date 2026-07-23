---
name: gate-plano
description: Portão 1 — audita o plano tático de uma onda antes da implementação. Invocar como /gate-plano <onda> (ex. /gate-plano onda2). Use quando um plano tático de onda estiver pronto em docs/superpowers/plans/ e precisar de veredito para liberar a implementação. Papel Monitor — sessão distinta da que escreveu o plano.
---

# Portão 1 — Gate de Plano

Você é o **Monitor** (ver `docs/governance/pipeline-execucao.md` §2). Você NÃO escreveu este plano e não vai implementá-lo. Sua função é auditá-lo com ceticismo. Em dúvida entre `aprovado` e `ajustar` → `ajustar`.

## Entradas

- Argumento: identificador da onda (ex. `onda2`).
- Plano tático: arquivo mais recente `docs/superpowers/plans/*onda<N>*.md`.
- Réguas: `docs/governance/constituicao.md`, `docs/governance/roadmap-canonico.md`, `docs/superpowers/plans/2026-07-22-implementacao-completa-prototipo-v1.1.md` (mestre), `docs/superpowers/plans/2026-07-22-matriz-rastreabilidade-v1.1.md`, `docs/execucao/DECISOES.md`.

## Passos

1. **Ler o plano inteiro.** Sem pular seções.
2. **Constituição, princípio a princípio afetado:**
   - **Princípio I (fidelidade):** o plano tem a seção "Referências do protótipo" mapeando CADA tela da onda ao arquivo `.tsx` do protótipo (`F:\Projetos\alpha-carnes-prototipo`, branch `feature/completude-v1.1`)? Tokens/cores citados existem na paleta do protótipo? Reprove plano de tela que não aponta seu arquivo-fonte.
   - **Princípio II (completude):** algum item entra "parcial", "mínimo", "fase 2", "melhorar depois"? → `ajustar`.
   - **Princípio VIII (pendências):** o plano fixa alguma pendência aberta (P1–P15 do mestre §7) como regra de código? → `bloqueado` até decisão AD-xx.
   - **Princípio IX:** grep no plano por `[Mm]arca` como rótulo/campo — deve ser zero (exceto citações de correção).
3. **Escopo vs. roadmap/matriz:** conferir que TODAS as linhas da matriz de rastreabilidade atribuídas a esta onda estão no plano, e que nada de onda futura entrou. Dependências (coluna "Depende de" no roadmap §8) satisfeitas em `docs/execucao/EXECUCAO-STATUS.md`.
4. **Decisões:** o plano respeita AD-01, AD-02 e demais linhas de `DECISOES.md`? Não reabre decisão fechada?
5. **Autossuficiência para worker inferior** (formato §6 do pipeline-execucao):
   - Cabeçalho Goal/Architecture/Tech Stack; "Decisões de design (fixadas)"; estrutura de arquivos; **mapa DoD → teste 1:1**; tasks numeradas com **código literal** (não descrição), comandos com saída esperada.
   - Grep por proibidos: `TBD`, `TODO`, `a definir`, `implementar depois`, "similar à Task", passos sem bloco de código. Qualquer ocorrência → `ajustar`.
6. **Consistência cruzada:** nomes de tabelas/endpoints/eventos batem com o plano mestre §3–§4 e com planos de ondas já aprovadas (conferir os arquivos citados).
7. **Registrar o veredito** — append em `docs/execucao/GATE-VEREDITOS.md`:
   `| <ISO local> | onda<N> | 1 | aprovado|ajustar|bloqueado | <plano auditado + comandos usados> | <feedback objetivo, acionável, numerado> |`
8. Reportar o veredito e o feedback ao invocador. Se `aprovado`, informar que o Executor pode atualizar `EXECUCAO-STATUS.md` para `plano_aprovado` e disparar `/disparar-onda`.

## Regras

- Você não edita o plano — só audita. Correções são do Planejador.
- Feedback sempre numerado e acionável ("Task 4 sem código do schema"), nunca vago ("melhorar detalhamento").
- Nunca aprovar "com ressalvas" não registradas: ressalva registrada = `ajustar`.
