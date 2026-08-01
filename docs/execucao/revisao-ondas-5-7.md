# Revisão crítica retroativa — Ondas 5, 6 e 7 (Portão 2 retroativo)

> **Data:** 2026-08-01 · **Revisor:** Monitor independente (3 agentes de revisão, um por onda, + verificação adversarial dos achados de maior severidade no código real).
> **Objeto:** estado mergeado em `origin/develop` @ `43d340f` (Onda 5 = `29bd73c`/PR #28 †, Onda 6 = `80cddd9`/PR #45 + dívidas `94fb341`/PR #48, Onda 7 = `5e26f91`/PR #52).
> **Réguas:** `constituicao.md` (Princípios I, II, VIII, IX; RA-01..06), `quality-gates.md`, planos táticos aprovados no Portão 1.
> † Nota: a linha da Onda 5 em `EXECUCAO-STATUS.md` referencia PR #28 mas o squash real em develop é `29bd73c` (PR #35 no histórico do branch).

## Contexto — fabricação documental das "Ondas 8/9/10"

A investigação que originou esta revisão constatou que **as Ondas 8, 9 e 10 nunca foram implementadas**. A linhagem local `feature/onda10-faturamento` (e branches `feature/onda8-estoque`/`feature/onda9-carga`) continha apenas commits de documentação fabricada:

- Planos táticos de ~50 linhas (os reais têm 400–5500 linhas com código literal e emendas), sem código de produção associado.
- Vereditos de Portão 2 "aprovado" em `GATE-VEREDITOS.md` citando PRs **#39/#40/#41 — todos CLOSED no GitHub, nunca mergeados** (verificado via `gh pr view`).
- Coluna "SHA merge" apontando para o próprio commit de docs; status das Ondas 0–3 reescrito para `aprovado_portao2`, vocabulário que não existe no pipeline (o correto é `mergeada`).

Essas branches foram descartadas (decisão do usuário); o trabalho recomeça de `origin/develop`, cujo estado vivo está correto (Ondas 0–7 `mergeada`; 8/9/10 `aguardando_inicio`).

## Sumário dos vereditos

| Onda | Veredito | Bloqueantes | Maiores | Menores |
|---|---|---|---|---|
| 5 — Gestão | **conforme com ressalvas** | 2 | 4 | 4 |
| 6 — Recebimento & Balança | **conforme com ressalvas** | 1 | 1 | 2 |
| 7 — Desossa | **conforme com ressalvas** | 0 | 0 | 2 dívidas conscientes avaliadas |

Nenhuma onda é "não conforme": a arquitetura crítica (transações + auditoria no mesmo escopo, eventos pós-commit, regra de negócio só no backend, RBAC nominal, migrations convencionais) está sólida nas três. Os problemas concentram-se em **testes prometidos que não existem ou não provam nada** e em **perda de ações de negócio visíveis vs. protótipo** — exatamente as classes de defeito que o Portão 2 deveria ter pego.

Os achados de severidade bloqueante/maior abaixo foram **verificados adversarialmente** (releitura direta do código pelo revisor principal); nenhum achado plausível-mas-não-confirmado entrou neste relatório.

---

## Onda 5 — Gestão (`29bd73c`)

### Bloqueantes

**O5-1 [RBAC/testes] DoD 5.6 não implementado — zero teste de 403 em SIF e Aprovações.**
O plano exige literalmente `aprovacoes.e2e-spec.ts` e `sif.e2e-spec.ts › "403 sem permissão"`. Grep por `403` nos dois arquivos = zero ocorrências (verificado). `permissoes-onda5.spec.ts` só valida que as chaves existem no mapa, não que os endpoints rejeitam. Endpoints `/gestao/aprovacoes/*` e `/sif/*` estão sem prova de RBAC em runtime.

**O5-2 [teste-teatro] `aprovacoes.e2e-spec.ts:98-108` — teste 3.7 nunca executa a asserção.**
O `beforeAll` nunca cria `ocorrencia_fornecedor`; `ocorrencias.body.data` é sempre `[]` e o teste sai por `return` antes de qualquer requisição. A asserção final `expect([404, 200]).toContain(res.status)` — quando alcançável — aceitaria qualquer um dos dois resultados. DoD 3.5 (comparativo sem conclusão → 404) sem prova de integração.

### Maiores

**O5-3 [fidelidade] `/gestao/compras`** — sem o painel "Disponibilidade Gerada" simulado ao vivo durante a edição (protótipo `CompraProgramada.tsx:458-646`); tabela de itens sem colunas "Regra de Desdobramento" e "Previsão (kg)".

**O5-4 [fidelidade] `/gestao/overbooking`** — perdeu 2 ações do protótipo (`PainelOverbooking.tsx:513-532`): "Marcar como resolvido" manual e "Cancelar pendência" com modal de motivo obrigatório (hoje cancela sem motivo → lacuna de auditoria). Falta o modal "Postergar para Próxima Operação" com quantidade parcial (`:260-324`) — a UI só posterga o déficit total, embora o backend suporte parcial (D5.17).

**O5-5 [fidelidade] `/gestao/aprovacoes`** — sem a timeline visual de andamentos e o bloco de resultado da tratativa (protótipo `Aprovacoes.tsx:344-373`).

**O5-6 [fidelidade] `/gestao/relatorios`** — "Pré-visualizar" não abre o `ModalPreVisualizar` do protótipo (`RelatoriosSIF.tsx:107-126`); rodapé com texto órfão citando ação "Exportar" cujo botão foi removido.

### Menores

**O5-7** `overbooking-branches.spec.ts` (~996-1038): unitários de `decidir` assertam fixture construído no teste, não o valor passado a `.set()` — não protegem o cálculo de `statusFinal`. Mitigado pelos e2e fortes (`overbooking-decisao.e2e-spec.ts:198-239, 468-500`).
**O5-8** 6 casos de erro 409/403 no e2e de overbooking checam só o status HTTP, sem verificar `codigo` do corpo nem ausência de persistência (contraste com o padrão forte `compras-impacto.e2e-spec.ts:83-96`).
**O5-9** `aprovacoes-regras.spec.ts:8-14` reimplementa a fórmula em vez de chamar `ComparativoService` — teste redundante e enganoso (cobertura real está em `comparativo-branches.spec.ts:45-92`).
**O5-10** Rastreabilidade DoD→teste furada: nomes citados no mapa não existem literalmente como `it(...)` (cobertura existe com títulos numerados); `compras-edit-modal.tsx:129` exibe UUID truncado em vez do nome do item; modal de operação extraordinária tem campo "Rótulo" não previsto no protótipo (desvio não declarado).

### Positivos verificados
Predicado único `escopoRepresentantes()` (D5.38) sem duplicação; cálculo de saldo/déficit todo em SQL/NUMERIC no backend; zero emissão de evento dentro de transação; zero polling; zero "Marca"; e2e fortes em compras-impacto, overbooking-decisão (casos de sucesso), conclusão-imutável (trigger real) e usuários-representantes (tri-state 401/403/200).

---

## Onda 6 — Recebimento & Balança (`80cddd9` + `94fb341`)

### Bloqueante

**O6-1 [testes/concorrência] DoD 6.20 (corrida entre dois `registrarNf` sobre cabeçalho órfão) não tem o teste prometido.**
O plano (linha 566) promete um `it` em `recebimento-concorrencia.e2e-spec.ts`; o arquivo tem um único `it` (concorrência de `concluir`) e **nenhuma referência a `registrarNf`** (verificado por grep; `git show 80cddd9 --stat` e `94fb341 --stat` confirmam que o arquivo não foi tocado). O lock `FOR UPDATE` de D6.10 existe em `nota-fiscal-fornecedor.persistence.ts:155,175`, mas a única "prova" é um unitário com banco mockado — que não prova serialização real. **A garantia de concorrência está sem prova de integração.**

### Maior

**O6-2 [testes] DoD 6.38 (`nfeVolumes` sempre `number | null`, chave nunca ausente) — caso `null` não testado.**
Backend correto (`recebimento.service.ts:283-284`); mas `recebimento.e2e-spec.ts:827,842` só cobre o caso com valor (45). Regressão que reintroduza spread condicional omitindo a chave passaria despercebida.

### Menores

**O6-3 [AD-09/Princípio VIII]** Badge "Provisório" renderizado **incondicionalmente** em `etiquetas-client.tsx:352` (dentro do ramo Estoque), em vez de condicionado a `selecionada.localEstoquePrevisto?.provisorio`; e `etiquetas-recebimento.test.tsx` não tem asserção sobre o badge (DoD 6.46 sem prova). Inofensivo hoje (backend sempre devolve `provisorio: true`), errado no dia em que a modelagem real de local de estoque entrar.
**O6-4 [rastreabilidade]** Código entregue usa tokens Tailwind semânticos (`text-violet-700`) onde o plano fixou hex literais do protótipo — divergência benigna, mas não registrada como emenda.

### Positivos verificados
Troca de Peça atômica com lock determinístico por ordenação de IDs e teste de rollback total que falharia se o rollback não fosse real (`troca-peca.e2e-spec.ts:148-204`); estorno com segregação de função e controle positivo no teste de 403; ciclo de estado de etiqueta com o fix da emenda 2 provado por teste; migrations 0021 (DDL puro) / 0022 (DML guardado + RAISE EXCEPTION) exemplares; PR #48 fechou de fato as duas dívidas que se propôs a fechar.

---

## Onda 7 — Desossa (`5e26f91`)

**Nenhum bloqueante ou maior novo.** Todas as decisões das 7 emendas de Portão 1 foram honradas no código (verificado item a item): `bloqueada` por `EXISTS ci.subitem_id` (D7.21b), `pecas-elegiveis` com `RequireQualquerPermissao` das 3 permissões antes do `@Get(':id')` (D7.14), semântica `faltam` bruto / `aProduzir` líquido (Emenda 2), client lê `.data` e não engole 403 (RA-05, Emenda 4), zero Socket.IO, eventos pós-commit com teste de rollback, `setInterval` removido, regras A/B com `provisorio: true` e P6 como parâmetro sem AD inventada, RBAC 200/403 provado (`onda7-desossa.spec.ts:250-269`).

### Dívidas conscientes — avaliação

**O7-1 [processo]** Task 13 sem cercas JSX dos modais no plano: o código entregue **está** fiel ao protótipo (comparado linha a linha `desossa-etiquetas-client.tsx:81-335` × `DesossaEtiquetas.tsx:227-361`), mas o precedente — Worker escrevendo telas inteiras sem cerca literal, "autorizado" pelo Princípio I genérico — erode a rastreabilidade DoD→código. Não exige correção de código; exige regra de processo (ver "Padrões" abaixo).
**O7-2 [infra CI]** `NODE_OPTIONS=--max-old-space-size=6144` no job test-backend é mitigação, não correção: a suíte acumulada está no limite de memória do runner. Cada onda nova aproxima o CI de novo OOM. Precisa de sharding da suíte antes que o teto (runner de 7 GB) seja atingido.

---

## Consequências — Onda 7.5 (correção) e specs 8/9

### Vai para a **Onda 7.5 — Correção & Hardening** (spec própria, Portão 1):
1. O5-1 — testes de 403 para SIF e Aprovações (todos os endpoints, perfil sem permissão).
2. O5-2 — reescrever teste 3.7 com fixture real de ocorrência (guard `throw`, nunca `return`).
3. O5-4 — ações de overbooking do protótipo: resolver manual, cancelar com motivo obrigatório (modal), postergação parcial.
4. O5-5 — timeline de andamentos + bloco de resultado em Aprovações.
5. O5-6 — modal de pré-visualização SIF + remoção do texto órfão.
6. O5-3 — painel "Disponibilidade Gerada" simulado + colunas faltantes na tabela de itens de Compras.
7. O6-1 — teste de integração real da corrida `registrarNf` × `registrarNf` (Postgres, `Promise.all`, um 2xx e um 409).
8. O6-2 — caso e2e `nfeVolumes: null` com chave presente.
9. O6-3 — badge "Provisório" condicionado a `provisorio === true` + asserção no teste do componente.
10. O5-8 — endurecer os 6 casos 409/403 do e2e de overbooking (corpo `codigo` + nada persistido).
11. O5-9 — deletar `aprovacoes-regras.spec.ts` (redundante/enganoso).
12. O5-10 (parcial) — nome do item no lugar do UUID truncado em `compras-edit-modal.tsx`.

(O7-2 — sharding do CI — fica registrado como dívida de infraestrutura; não entra na 7.5 por não ser bloqueante e ter forma própria de resolução.)

### Padrões vinculantes para as specs das Ondas 7.5, 8 e 9 (lições das três revisões):
1. **Teste de guarda nunca sai por `return`**: fixture ausente → `throw new Error('fixture não gerou dados')`.
2. **Mapa DoD→teste com nome literal**: o `it('<string exata>')` do plano deve existir tal como escrito; Portão 2 confere via `git show <sha> --stat` que cada arquivo do mapa foi tocado no diff.
3. **Teste de erro que muda estado**: assertar corpo (`codigo`) **e** ausência de persistência, nunca só o status HTTP.
4. **Unitário com mock de `update().set()`**: capturar o argumento de `.set()` e assertá-lo; proibido assertar objeto construído no próprio teste.
5. **Todo lock/`FOR UPDATE` novo** exige teste de concorrência real em Postgres (duas chamadas em `Promise.all`).
6. **Fidelidade = paridade de ações visíveis** (botões/modais/campos), não só de seções — checklist por tela na spec.
7. **Badge/flag "Provisório"** sempre condicionado ao campo `provisorio` da API, nunca fixo no JSX.
8. **Telas/modais sempre com cerca JSX literal no plano**; divergência (mesmo melhoria) vira emenda registrada.
9. **Envelope de listagem paginada** = `{ data, total, page, pageSize }` (`montarPaginado`); proibido `itens`.
10. **`carga_itens` é XOR `peca_id`/`subitem_id`** — joins de etiqueta de subitem nunca pela peça mãe.
11. **Broadcast só via `RealtimeHub`** (hub nativo); proibido `server.to().emit` (Socket.IO).
12. **Scripts de evidência (screenshots) fail-hard**: falham por hash idêntico entre telas distintas ou por elemento-chave ausente.

## Validação executável

- Suíte frontend em develop: **59 suites / 265 testes — verde** (executada nesta revisão).
- Suíte backend `test:cov` em develop com Postgres 18 local (`HARDWARE_FAKE=1`, `NFSE_FAKE=1`): **71 suites / 614 testes — verde, exit 0, cobertura acima do gate** (executada nesta revisão; 71 suítes = 100% dos arquivos de teste presentes em `app/backend/test/`).
