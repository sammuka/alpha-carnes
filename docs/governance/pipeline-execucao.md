# Pipeline de Execução — AlphaCarnes

> **Status:** Vigente · **Versão:** 2.0.0 · **Data:** 2026-10-17 · **Base:** [AD-41](../execucao/DECISOES.md) (rito v2)
> Define o **rito de execução por fatia** com dois gates (Portão 1 sobre o plano e Gate único sobre o PR) e papéis separados. Complementa (não substitui): [`constituicao.md`](constituicao.md) (princípios), [`quality-gates.md`](quality-gates.md) (critérios objetivos), [`framework-revisao.md`](framework-revisao.md) (branches/PR/merge), [`roadmap-canonico.md`](roadmap-canonico.md) (o que entregar e em que ordem).
> Vale para toda fatia a partir da E09-T03. O PR #168 (E09-T01..T02) conclui no rito anterior (AD-22). Histórico de vereditos até a AD-40: [`GATE-VEREDITOS.md`](../execucao/GATE-VEREDITOS.md) (congelado).

## 1. O rito — 5 passos por fatia

```
1. PLANO        Planner escreve docs/superpowers/plans/<data>-<fatia>-<slug>.md (≤ 400 linhas, sem código literal)
2. PORTÃO 1     Monitor aplica o checklist fixo de 10 itens → veredito como comentário (teto 2 rodadas)
3. IMPLEMENT.   Worker implementa em worktree isolado, abre PR feature/<fatia>-* → develop
4. GATE ÚNICO   Monitor único audita o PR: conformidade + ataque de domínio → veredito como comentário no PR
5. MERGE        Agente que mergeia: gh pr merge --match-head-commit <head aprovado>, depois atualiza EXECUCAO-STATUS.md
```

Nenhum passo pula o anterior. Implementar sem Portão 1 aprovado ou mergear sem Gate único aprovado no head exato é violação de processo (o merge é revertido). Não existem mais revisão crítica por commit, Portão 2 e Portão A como etapas separadas: os três foram fundidos no Gate único (AD-41 item 1).

**PR só de documentação/skills:** Gate único = CI 8/8 no head + diff igual ao escopo declarado + ausência de segredo. Não há ataque de domínio.

## 2. Papéis

| Papel | Quem | Modelo (AD-41 item 9) | Escreve em | Nunca faz |
|---|---|---|---|---|
| **Planner** | sessão dedicada | `claude-opus-5.5` em alto risco; `claude-sonnet-5.5` em baixo risco e ajuste textual | um plano tático em `docs/superpowers/plans/` | implementar, auditar, inventar resposta para pendência §16 |
| **Monitor** | instância nova e independente por rodada | `claude-opus-5.5` — nunca rebaixar | **comentário** no PR (Gate único) ou no lugar único do Portão 1 (§3) | implementar; corrigir plano; confiar no relato do Worker sem verificar; ler veredito anterior antes de formar a própria conclusão |
| **Worker** | instância disparada por fatia/tarefa | `claude-sonnet-5.5` para tarefa pontual; `claude-opus-5.5` quando o plano exigir | código e testes no worktree da fatia; corpo do PR (relatório, §7) e comentários de relatório no PR | decidir regra de negócio; auditar; mergear; editar `docs/execucao/` |
| **Executor** | instância de coordenação | `claude-sonnet-5.5` | worktrees, operação de merge e `docs/execucao/EXECUCAO-STATUS.md` (uma vez por merge) | escrever veredito, plano ou código de produto; existir só para commitar docs de veredito |
| **Quality Owner** | usuário (`sammuka`) | — | emendas da constituição; decisões de produto em `DECISOES.md`; exceção ao teto de rodadas | — |

Regras de conduta (vinculantes):

- **Revisor independente do implementador:** o Monitor de uma fatia nunca é a sessão que planejou ou implementou essa fatia. Nenhuma autoavaliação.
- O Worker segue o plano e escreve os snippets ele mesmo. Se o plano é omisso em regra de negócio, um contrato não fecha ou um teste continua falhando após uma correção: **parar e reportar** — não improvisar.
- O Monitor **roda ele mesmo** os comandos de verificação (`gh pr checks`, `git diff`, testes, `npm run e2e:ci`). Relato do Worker é hipótese, não evidência.
- **Fail-closed em decisão de produto pendente:** se a fatia depende de regra que só o Quality Owner decide, o veredito é `bloqueado` e a saída estruturada é `requires-human`; bloqueios técnicos, de dependência ou de agente usam `blocked`.
- **Divergência técnica não gera AD** (AD-41 item 5): o Worker a descreve na seção "Divergências" do corpo do PR e o Monitor a avalia no Gate único. AD em `DECISOES.md` só para regra de negócio decidida pelo Quality Owner.

## 3. Portão 1 — Gate de plano

Invocável via skill [`$gate-plano <fatia>`](../../.agents/skills/gate-plano/SKILL.md). O Monitor fixa o blob git do plano (`git rev-parse <sha>:<plano>` e sha256 de `git show <sha>:<plano>`) antes de ler e aplica **exatamente** este checklist fixo de 10 itens:

1. **Fontes citadas por tela:** cada tela aponta para o `.tsx` exato do protótipo (ou da interface da expansão, AD-18) e o arquivo existe.
2. **Invariantes explícitos:** as regras que não podem quebrar (saldo, vigência, segregação, unicidade, ordem de locks, auditoria antes/depois) estão escritas como invariantes verificáveis.
3. **Contratos:** schema (tabelas, colunas, CHECK, índices), endpoints (método, rota, permissão, códigos de erro) e eventos de domínio declarados e consistentes com o plano mestre e fatias vizinhas.
4. **DoD → teste 1:1:** cada critério de pronto tem um teste nomeado que o demonstra.
5. **Lista de arquivos com ownership:** todo path que a fatia cria ou altera, com dono exclusivo quando houver paralelismo.
6. **Critérios de parada:** quando o Worker deve parar e reportar em vez de decidir.
7. **Rollback:** como reverter migration e feature (reversibilidade, expand → backfill → contract quando aplicável).
8. **Classe de risco declarada:** `alto` (dinheiro, baixa, conciliação, razão, cofre/certificado/segredo, fiscal, RBAC/autorização, migração de dados) ou `baixo`, compatível com o escopo.
9. **Sem código literal:** o plano descreve contratos e comportamento; snippets de implementação são do Worker.
10. **≤ 400 linhas.**

Item reprovado é BLOQUEANTE só se cair em uma das seis classes da §4.4 ou tornar o plano inexecutável (item 2, 3, 4 ou 8 ausente); o resto é MENOR e segue como item obrigatório do Worker. Decisão de produto ausente → `bloqueado`/`requires-human`.

**Teto: 2 rodadas.** A 2ª rodada audita só o delta do plano e a resolução dos BLOQUEANTES da 1ª. Se a 2ª rodada ainda tiver BLOQUEANTE, o coordenador escala ao Quality Owner; exceção ao teto só por decisão explícita do QO.

**Registro — lugar único:** comentário (`gh pr comment`) no PR da fatia. Se o plano ainda não tem PR, o Planner abre o PR da fatia em rascunho (`gh pr create --draft`) com o commit do plano antes do Portão 1; esse PR é o lugar único de todo veredito da fatia (Portão 1 e Gate único). Não se escreve linha em `GATE-VEREDITOS.md` nem se usa lock.

## 4. Gate único — Gate de implementação por PR

Invocável via skill [`$gate-pr <fatia> <nº do PR>`](../../.agents/skills/gate-pr/SKILL.md). Um Monitor único (`claude-opus-5.5`), novo por rodada, executa as duas partes sobre o mesmo head.

### 4.1 Pré-condições

1. Portão 1 `aprovado` registrado no PR com o OID do blob do plano igual ao do head atual. Plano alterado depois do gate volta ao Portão 1.
2. `gh pr view <n>`: base `develop`, branch declarada no plano; capturar `headRefOid`.
3. Worktree de auditoria destacado no head exato, separado do worktree do Worker.
4. Corpo do PR contém o relatório da §7, incluindo a seção "Divergências".

Falha de pré-condição → `bloqueado`.

### 4.2 Parte 1 — Conformidade

1. **CI 8/8 no head exato** (`gh pr checks`): `lint`, `type-check`, `test-backend`, `coverage` (≥80% linha e branch), `test-frontend`, `build`, `audit`, `secret-scan`. Pending ou skipped em job obrigatório não aprova. Vercel só quando o diff toca `landing/**`. Quando o CI exigir visibilidade pública temporária, usar `.codex/scripts/visibility-ci.ps1 -EnableVisibilityLease` (AD-21).
2. **Diff vs. plano:** `git diff <base>...<head>` coberto pela lista de arquivos do plano; nada fora do escopo; divergências declaradas no PR.
3. **DoD → teste:** cada teste do mapa existe, sua asserção prova o critério e passa.
4. **RA-01..06** ([`framework-revisao.md`](framework-revisao.md) §6): regra crítica só no backend; mutação crítica em transação com auditoria; evento só pós-commit, sem polling; falha externa explícita; nada inventado.
5. **Migrations:** geradas por `drizzle-kit`, reversíveis, sem `ALTER TABLE` manual nem DELETE físico em entidade de negócio.
6. **E2E:** Playwright executado pelo próprio Monitor via `npm run e2e:ci` (§11); `next dev` não é ambiente de gate.

### 4.3 Parte 2 — Ataque de domínio (lista mínima)

O Monitor tenta quebrar a fatia, não confirmar que funciona. No mínimo:

1. **Invariantes do plano:** cada invariante da §3 item 2 atacado por caminho alternativo (outro endpoint, outra ordem, payload limite).
2. **Vigência:** sobreposição, lacuna, retroatividade, pai com vigência que exclui filhas, registro vigente alterado por fora.
3. **Segregação de funções:** autoaprovação, mesmo usuário em etapas que exigem pessoas distintas.
4. **Concorrência:** duas requisições simultâneas, ordem de locks (deadlock), `FOR UPDATE`/`FOR SHARE` no pai ao criar filho, guarda de envio em voo.
5. **Auditoria:** toda mutação crítica grava quem, quando, valor anterior e novo.
6. **RBAC dos 11 perfis:** cada endpoint novo com teste de 403 para perfil sem permissão; nenhuma rota sem guarda.
7. **Caminho completo UI → API → DB → evento → UI:** o dado gravado é o que a tela mostra; lookup não grava código oculto diferente do exibido; evento atualiza a outra tela.
8. **Cálculo fiscal/financeiro:** cada campo que deveria controlar o cálculo realmente o controla (ex.: CST governa o ICMS), arredondamento e escala `NUMERIC`.
9. **UI no DS:** tela usa o DS e os componentes do protótipo citados no plano.

### 4.4 Classificação fechada

**BLOQUEANTE** — somente estas seis classes:

1. perda ou corrupção de dado;
2. cálculo fiscal ou financeiro errado;
3. bypass de RBAC ou de segregação de funções;
4. segredo exposto;
5. violação de invariante escrito no plano;
6. erro 500 em caminho de usuário.

Tudo o mais é **MENOR**. Em dúvida, **MENOR com justificativa** escrita no laudo. Fidelidade visual bloqueia só por tela sem o DS ou componente do protótipo ausente (enquadrados na classe 5 quando o plano os cita); variante de componente, texto literal e espaçamento são MENOR. Decisão de produto ausente não é severidade: é `bloqueado`/`requires-human`. Achado de uma classe já coberta por verificação automatizada (§11) não é achado de Monitor — se a verificação falhou, o CI já está vermelho.

`aprovado` = zero BLOQUEANTE. `ajustar` = ao menos um BLOQUEANTE corrigível. `bloqueado` = pré-condição falhou ou decisão de produto ausente.

### 4.5 Registro por comentário

O veredito é **um comentário no PR** postado pelo próprio Monitor com `gh pr comment <n> --body-file <laudo>`. Sem lock, sem linha em `GATE-VEREDITOS.md`, sem Executor para commitar. Laudo estruturado:

```markdown
## Gate único — <fatia> — rodada <r>
- head: <sha completo>
- plano-blob: <OID do blob> (sha256 <hash>)
- risco: alto | baixo
- rodada: <r> de 3
- veredito: aprovado | ajustar | bloqueado
- modelo: solicitado <id>; efetivo <id ou "não atestável">
- comandos: <resumo do que o Monitor executou>
### Conformidade
<resultado item a item da §4.2>
### Ataque de domínio
<o que foi atacado e o resultado, item a item da §4.3>
### Achados
1. [BLOQUEANTE classe <1-6>] <achado> — <evidência>
2. [MENOR] <achado> — <justificativa>
```

### 4.6 Rodadas e teto

- **1ª rodada:** conformidade + ataque de domínio completos.
- **2ª rodada:** só existe se a 1ª teve BLOQUEANTE; audita apenas o delta `git diff <head-anterior>..<head-novo>` e a resolução dos BLOQUEANTES. O Monitor novo forma sua conclusão sobre o delta **antes** de ler o laudo anterior. Achado novo fora do delta só conta se for BLOQUEANTE.
- **3ª rodada:** aprova; MENORES restantes vão para o backlog do PR de hardening do épico (§5). BLOQUEANTE ainda presente na 3ª rodada é escalado ao Quality Owner.
- **Exceção ao teto só por decisão explícita do Quality Owner**, nunca por AD delegada.
- Qualquer commit novo no PR invalida o veredito; o merge usa `gh pr merge --match-head-commit <head aprovado>`.

## 5. Estado vivo (`docs/execucao/`)

| Arquivo | Escritor | Quando | Conteúdo |
|---|---|---|---|
| `EXECUCAO-STATUS.md` | agente que mergeia (Executor) | **uma vez por merge**, em PR de coordenação ou no próximo PR da fatia | linha por fatia: status, PR, SHA do merge, observações |
| `GATE-VEREDITOS.md` | — | **congelado** | histórico até a AD-40; não recebe novas linhas (AD-41 item 6) |
| `DECISOES.md` | Quality Owner (registrado por agente) | só com decisão de regra de negócio do QO | decisões `AD-xx` (precedência máxima abaixo da constituição) |

Vereditos vivem nos comentários do PR. Não há escrita de estado sob lock durante a fatia; `lock.ps1` continua existindo para o modo autônomo (§8).

**MENORES em lote (AD-41 item 8):** os MENORES aprovados de todas as fatias de um épico são acumulados no backlog (issue do épico no Linear) e entregues em **um PR de hardening por épico** ao fim da fase, auditado por um Monitor único no mesmo Gate único.

## 6. Formato do plano tático enxuto

Um plano cobre **uma fatia E2E** (UI → API → PostgreSQL → eventos), tem **no máximo 400 linhas** e **nenhum código literal**. O pin é o OID/sha256 do blob git. O plano não afirma estado volátil (HEAD, head de PR, contagem de commits).

```markdown
# <Fatia> — <Nome> — Plano tático
**Goal:** ... **Classe de risco:** alto | baixo (motivo) **Branch:** feature/<fatia>-<slug>
## Fontes (por tela: rota → arquivo .tsx do protótipo / interface da expansão)
## Decisões aplicadas (AD-xx citadas; pendências como parâmetro + badge Provisório)
## Invariantes (numerados, verificáveis)
## Contratos
### Schema (tabelas, colunas, CHECK, índices, migration)
### Endpoints (método, rota, permissão, request/response, erros)
### Eventos (nome, payload, quem consome)
## Mapa DoD → teste (1:1)
## Arquivos (path → criar/alterar → owner)
## Critérios de parada (quando o Worker para e reporta)
## Rollback
```

## 7. Relatório do Worker = corpo do PR

O relatório não é arquivo: é o **corpo do PR** (e, em rodadas seguintes, comentário no PR postado pelo Worker com `gh pr comment`).

```markdown
## Resumo
<o que a fatia entrega, por item do plano>
## Divergências
<desvios técnicos do plano com motivo — ou "Nenhuma">
## Evidências
<saídas de teste, cobertura, `npm run e2e:ci`, screenshots por tela lado a lado com o protótipo>
## DoD → teste
<[ok/falha] item a item com o teste que o demonstra>
## Pendências
<itens que dependem de decisão do QO ou viram backlog — nunca silenciosos>
```

## 8. Automação autônoma

O rito acima roda de duas formas:

- **Assistida (skills):** humano/coordenador invoca `$gate-plano`, `$disparar-onda` e `$gate-pr`.
- **Autônoma (PowerShell 7):** [`.codex/scripts/invoke-onda.ps1`](../../.codex/scripts/invoke-onda.ps1)
  executa uma onda; [`.codex/scripts/invoke-multionda.ps1`](../../.codex/scripts/invoke-multionda.ps1)
  agenda o grafo; `lock.ps1`, `checkpoint.ps1`, `wait-pr-checks.ps1` e `visibility-ci.ps1`
  fornecem exclusão mútua, retomada, espera de CI e lease de visibilidade. O orquestrador
  inicia um processo `codex exec` novo para cada papel/estágio, desabilita delegação interna e
  exige `thread.started` único mais `turn.completed`; `roleTrace` é montado dessas evidências,
  nunca aceito da resposta do modelo.
  O protótipo usa por padrão `F:\Projetos\alpha-carnes-prototipo`; ambientes
  diferentes devem informar `-PrototypePath` ou `ALPHACARNES_PROTOTYPE_PATH`.
  Os scripts autônomos ainda registram vereditos em `GATE-VEREDITOS.md` sob lock (rito AD-22);
  até serem adaptados ao rito v2, fatias da E09-T03 em diante rodam no modo assistido.

Limite da CLI pinada: o Codex `0.145.0` não expõe subcomando programático de `spawn`; pedir
delegação a uma única sessão e confiar na resposta final não comprova que um subagente nasceu.
Por isso `invoke-role.ps1` lê os perfis `.codex/agents/*.toml`, cria processos `codex exec`
separados e rejeita stream sem evidência ou com `collab_tool_call` interno; `invoke-onda.ps1`
rejeita thread repetida entre etapas. Mudança de versão/configuração que deixe de aceitar esses
overrides falha fechada antes de um gate.

## 9. Paralelismo de Workers (sem perder o plano)

Dois níveis — e só esses — são permitidos:

### 9.1 Fatias paralelas (já no grafo)

Quando [`roadmap-canonico.md`](roadmap-canonico.md) mostra ramos independentes **e** todas as dependências estão `mergeada`, o coordenador pode disparar um Worker por fatia em worktrees/branches isolados, com ownership exclusivo de paths. `EXECUCAO-STATUS.md` continua com um único escritor por merge. O Gate único continua **por PR**.

### 9.2 Fatias paralelas dentro de uma Task de regressão

Quando o plano tático tem uma task do tipo “atualizar fixtures / regressão por domínio”, o Executor pode fatiar a task em Workers paralelos sob estas regras:

1. **Pré-condição:** tasks estruturais anteriores (migrations, services canônicos) já commitadas; helpers compartilhados estáveis no HEAD da branch.
2. **Ownership exclusivo de arquivos** por Worker (lista explícita no prompt). Proibido dois Workers tocarem o mesmo path. Helpers compartilhados (`test/helpers/*`) só mudam num Worker “helpers” serial **antes** das fatias, ou ficam congelados.
3. **Worktree/branch por fatia** (ex.: `feature/<fatia>-t<M>-<dominio>`), base pinada no mesmo SHA. Merge de volta na branch da fatia é **serial** (Executor), depois um único gate local (`npm run test -- "<regex domínio>"` + `test:cov` quando exigido).
4. **Modelo por complexidade:** mecânico → `claude-sonnet-5.5`; cadeia longa de domínio → `claude-opus-5.5`.
5. **STOP idêntico ao Worker único:** plano omisso de regra de negócio → parar e reportar. Paralelismo não autoriza atalho de gate nem decisão de produto.
6. **Checkpoint:** cada fatia atualiza `.codex/runtime/PROGRESSO-SESSAO.md` da sua worktree; o Executor consolida.

Proibido: dois Workers na mesma branch/worktree; paralelizar expand→backfill→contract; reutilizar veredito de outro SHA.

## 10. Relação com o framework de revisão existente

[`framework-revisao.md`](framework-revisao.md) permanece vigente para o mecânico de branches/PR/proteções. Este documento adiciona por cima: o Portão 1, o Gate único com ataque de domínio, os papéis separados e o estado vivo. O "Revisor/Quality Owner" do framework mapeia para Quality Owner (autoridade) + Monitor (execução da auditoria).

## 11. Verificações automatizadas (AD-41 item 3)

Achado recorrente de Monitor vira verificação automatizada que falha o CI — não volta a ser achado manual. Cada check mora em `scripts/` (verificação estática genérica, executada pelo job `lint` via `npm run lint`/`npm run test:ci-scripts`) ou em teste genérico do workspace (executado pelos jobs `test-backend`/`test-frontend`):

| Check | Onde mora | Job do CI |
|---|---|---|
| CSV exportado neutraliza fórmula (`=`, `+`, `-`, `@` no início da célula) | teste genérico do utilitário de exportação (`app/backend`) | `test-backend` |
| CSV exportado sem BOM indevido e sem byte NUL | teste genérico do utilitário de exportação (`app/backend`) | `test-backend` |
| Data ISO crua exibida na UI | `scripts/` — varredura do frontend por renderização de data sem formatador | `lint` |
| Paginação sem desempate (`ORDER BY` sem chave única final) | `scripts/` — varredura dos services Drizzle | `lint` |
| Lista e total fora da mesma transação | teste genérico de listagem paginada (`app/backend`) | `test-backend` |
| Escape de `%`, `_` e `\` em filtros `LIKE`/`ILIKE` | teste genérico do helper de busca (`app/backend`) | `test-backend` |
| Hex/`rgba` fora de `app/frontend/src/app/globals.css` | `scripts/` — varredura de `app/frontend/src` | `lint` |
| "Marca" como rótulo isolado, UUID ou código `E##-T##` visível na UI | `scripts/` — varredura de textos de `app/frontend/src` | `lint` |
| Guarda de envio em voo (botão de submit desabilitado durante a requisição) | teste genérico de formulário (`app/frontend`) | `test-frontend` |
| `FOR UPDATE`/`FOR SHARE` do pai na criação de filho | `scripts/` — varredura dos services que inserem filho com FK para pai versionado/vigente | `lint` |

**Dependência:** a implementação desses checks e do script `e2e:ci` está no PR técnico separado da branch `fix/harness-e2e-ci`. Até o merge dele, o Monitor verifica esses itens manualmente e os classifica pela §4.4.

### 11.1 Ambiente e2e único (AD-41 item 7)

`npm run e2e:ci` é o **único** ambiente aceito para Playwright, por qualquer agente: cria banco novo por execução a partir de template, aplica seed, sobe o frontend com `next build && next start` e roda a suíte. `next dev` não é ambiente de gate; falha observada só em `next dev` não é achado.
