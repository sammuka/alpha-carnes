# E09-T01 — Plano de contas e centros de custo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Histórico de revisões

| Rev. | Data | Autor | Motivo |
|---|---|---|---|
| r1 | 2026-10-15 | planner | versão inicial da fatia E09-T01 |
| r2 | 2026-10-15 | planner (nova instância) | Portão 1 r1 `ajustar` (6 achados; veredito `aa2b94b`, plano r1 `f0043b6`); ajuste cirúrgico: nenhum outro ponto do plano muda |
| r3 | 2026-10-15 | planner (nova instância) | revisão crítica independente sobre o código implementado até `93599bb` (B1 a B4, M1 a M3, M5, M6) e AD-25 item 3; só acrescenta a seção "Correções da revisão crítica (r3)" (Tasks 8 a 17, classe de risco alto); as Tasks 1 a 7 já implementadas não mudam |
| r4 | 2026-10-15 | planner (nova instância) | Portão 1 r3 `ajustar` (1 bloqueante, 8 menores; plano r3 `143aec2`, blob `d851f10…`); delta AD-22 cirúrgico: acrescenta a Task 17 (opções de conta pai, P-r3-2), corrige as Tasks 8 e 14 e passa a renumeração condicional para a Task 18, sempre a última, com os conflitos do merge com a E01 nomeados; as demais Tasks não mudam |
| r5 | 2026-10-15 | planner (nova instância) | Portão 1 r4 `ajustar` (1 bloqueante, 4 menores; plano r4 `589ae72`, blob `887ebc1…`); delta cirúrgico na Task 17: o campo permanente `Buscar conta contábil` sai e a busca passa para o padrão do protótipo (select + botão `Pesquisar` que abre o popup `lookup-card`, `aplicacao.js` L412 e L490); `carregarPais` com try/catch e contador de pedido também no erro; a Task 18 passa a recontar os números de menu nos arquivos. Backend, teto de 50 e BFF não mudam |

| Achado r1 | Correção r2 |
|---|---|
| Rota visível `/erp/contabilidade/e09-t01` (Goal, D7, Task 1, páginas, Playwright). Caderno B L601 proíbe nomenclatura de épico na UI. O teste da Task 6 só lia `document.body` | Segmento da App Router e href: `/erp/contabilidade/plano-de-contas`. Slug de `slug()` (aplicacao.js L13) sobre "Plano de contas" (catalogo.js L721; Caderno B L436), sem `E##-T##`. O prefixo `/erp/contabilidade/` de catalogo.js L726 permanece. A chave `e09-t01-plano` (D6) continua interna e não é renderizada. O `it` da Task 6 recusa `e09-t01` no texto |
| Rótulo abreviado em dois botões. catalogo.js L729 e aplicacao.js L40–L43 e L369 produzem um só: `Bloquear conta e mapear lançamentos` | D4 e a Task 6 usam esse texto integral na faixa (L369) e no drawer (L403–L405). `bloquear` e `mapear` continuam verbos distintos no service. Modal: `Justificativa / observação` (aplicacao.js L496). O drawer permanece `Motivo da alteração` (aplicacao.js L436). Aba Exceções em title case (aplicacao.js L14 e L203): `Conta desativada`, `Mudança de classificação após fechamento`. HTTP 422 segue o Caderno B L440, em minúsculas |
| Versionar `SUSPENDED` nascia `DRAFT` (D4) contra o Review Focus 1 | Conta suspensa não versiona: HTTP 422 `conta desativada` e nenhuma linha nova. D4 alinhado. O `it` que falha primeiro está na Task 4 |
| Task 1 não atualizava o que o RBAC já trava | Entram `perfil-permissoes.snapshot.json` (`perfil-permissoes-snapshot.spec.ts` L15–L18) e `perfil-menus.snapshot.json` (`menu-rbac.test.ts` L12–L17). Totais lidos nos testes: 40 rotas e 127 pares (126 + 1 só do administrador; L167–L169, L176–L180, L279–L280). O `it` de `menu-v2.test.ts` L66–L69 é substituído, e o `GRUPOS` de L6–L16 / o `it` de L62 passam a 10 grupos. `shell-ds.spec.ts` L29 e L86 travam os mesmos 9 grupos. `catalogo()` (`perfis.service.ts` L81–L84) ganha o prefixo `CONTABILIDADE_`. O array do gestor não recebe a rota: administrador espalha `MENUS_CANONICOS` (`menus-canonicos.ts` L61); o gestor é lista própria (L89–L90) e D7 não concede a rota a outro perfil. `GRUPOS_ESPERADOS.gestor` fica sem `CONTABILIDADE` |
| Tasks 3, 4, 5 e 6 descreviam em prosa `loteSchema`, `acaoSchema`, criar/editar/versionar/mapear/lote, o broadcast e o client depois do `h1`. O Step 2 da Task 4 apontava o spec unitário para um corpo que usa `db.execute` do harness e2e | Corpo literal nesses pontos. `broadcast(room, type, payload)` como `realtime.hub.ts` L37. O comando da Task 4 roda `plano-contas.e2e-spec.ts` |
| O `it` da Task 2 anunciava vigência invertida e o insert só enviava natureza `OUTRA` | O mesmo `it` faz o segundo insert com `vigenciaFim` anterior a `vigenciaInicio` e `rejects` |

**Goal:** Entregar a tela Plano de contas e centros de custo (`/erp/contabilidade/plano-de-contas`) com cadastro hierárquico de contas, centros de custo, vigência, situação, versionamento, revisão de competência, aprovação, bloqueio e mapeamento de lançamentos, sem diário, razão, SPED, apuração ou tela fiscal.

**Architecture:** Módulo NestJS `contabilidade/plano` é a autoridade das contas e dos centros de custo (Princípio III). A conta guarda o código imutável; cada versão guarda nome, classificação sintética/analítica, natureza, grupo, conta pai, centro de custo, vigência e situação. Mutações rodam em uma transação com `AuditoriaService.registrar` e só então emitem evento de domínio. O BFF remove identificadores internos antes do browser. A UI copia os rótulos do protótipo `docs/prototipos/erp-integrado-v1/` e o selo Provisório da persona que não é perfil canônico.

**Tech Stack:** Node 22, NestJS 11, TypeScript 5 strict, Next.js 16 App Router/BFF, React 19, PostgreSQL 18, Drizzle + drizzle-kit, Zod 4, WebSocket nativo, JWT + RBAC (11 perfis, AD-04), Jest/Supertest, Playwright.

**Spec:** `docs/expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md` §E09-T01 (L436–L444); protótipo `docs/prototipos/erp-integrado-v1/index.html` (casca que carrega `catalogo.js`, `componentes.js` e `aplicacao.js`; a âncora `#E09-T01` é o `id` renderizado por `aplicacao.js`), `componentes.js` L5836–L5908, `catalogo.js` L720–L732, `MATRIZ-UX-COMPONENTES-61-TELAS.md` L928–L947 e `MATRIZ-INTEGRAL-INTERFACES.md` L327–L333.

**Classe de risco (AD-22 item 6):** alto risco. A fatia cria permissão e entrada de menu (RBAC/autorização). Não há baixa, dinheiro movimentado, razão, cofre nem emissão fiscal. O Portão 1 confirma a classe. Rito da implementação: revisão crítica por commit, Portão 2 e Portão A.

**Ramo:** `feature/erp-e09-t01-plano-de-contas`, worktree `F:/Projetos/AlphaCarnes/.worktrees/e09-t01`, criado a partir de `origin/develop` no commit `a698824` informado ao planner. O worker não faz rebase na cadeia fiscal e não edita `docs/execucao/`.

## Global Constraints

- 11 perfis canônicos (AD-04, `docs/execucao/DECISOES.md` L11; seed `PERFIS_FIXOS` em `app/backend/src/database/seed.ts` L338–L350). Personas `contador` e `controladoria` não entram no seed (AD-18 item 5; constituição L94).
- Permissões novas `CONTABILIDADE_PLANO_LER` e `CONTABILIDADE_PLANO_GERENCIAR` só no mapa do slug `administrador`.
- Selo visível `Provisório` na tela, via `BadgeProvisorio` com `texto="Provisório"` (`app/frontend/src/components/ui/badge-provisorio.tsx` L35–L36). Sem código P-xx.
- Palavra `Marca` banida em rótulo, entidade, coluna e teste novo (Princípio IX). A exceção `Nome Fantasia/Marca` não se aplica a esta tela.
- UI, CSV, histórico, toast e menu não exibem UUID, `id`, nome de tabela ou épico `E09` / `E09-T01` (Caderno B L601; Princípio I.2(a) remove o eyebrow de protótipo).
- Código de negócio da conta e do centro pode aparecer. É o valor do combo, nunca um GUID.
- Dinheiro `NUMERIC(15,2)` não entra: esta fatia não persiste valor. Datas de vigência são `date`, como `operacoes.data` (`operacoes.schema.ts` L18). `created_at` / `updated_at` / `deleted_at` são `timestamptz`.
- Status em `TEXT` + `CHECK`, PK `uuid` com `DEFAULT uuidv7()`, soft delete, índice em toda FK (`docs/data/convencoes-schema.md` L12–L33 e L62–L66).
- Regras críticas só no NestJS. Zod do DTO recusa forma; a regra de negócio recusa com HTTP 422. Conflito de código ou de versão concorrente recusa com HTTP 409 (Caderno B L440). O pipe global `ZodValidationPipe` continua 400; não alterá-lo.
- Não criar empresa, estabelecimento, período contábil, lançamento, diário, razão, política de contabilização, SPED, apuração, menu Fiscal, módulo fiscal nem permissão fiscal.
- Não criar o 12º perfil. Não conceder a permissão nova aos outros dez slugs.
- As 39 rotas operacionais permanecem, na mesma ordem relativa (constituição L93; ADR-ERP-024 L49–L64). O grupo `CONTABILIDADE` entra depois de `FATURAMENTO` e antes de `CADASTROS & REGRAS`. Não criar os grupos Fiscal, Financeiro nem Bancos & Tesouraria nesta fatia.
- Migration: o worker calcula o ordinal na ponta em que for implementar. Proibido usar `0044`, `0045`, `0046` e `0047`. Este plano não contém o arquivo SQL.
- Evento de domínio só depois do commit (Princípio VI). Falha não grava sucesso parcial (Princípio VII).
- Paginação server-side de 20 linhas (`componentes.js` L5868). Ordenação default `contaContabil` (`componentes.js` L5867).

## Review Focus

1. Conta com situação Suspenso ainda aceita mapear lançamentos, versionar para uso ou aparecer no combo de conta pai — a pessoa espera HTTP 422 com a mensagem `conta desativada` e nenhuma linha nova.
2. Alterar natureza, grupo ou classificação sintética/analítica de uma versão Aprovado — a pessoa espera essa versão intacta e HTTP 422 com a mensagem `mudança de classificação após fechamento`.
3. Informar conta pai analítica ou um ciclo na hierarquia — a pessoa espera HTTP 422 e nenhuma conta nova.
4. Revisar competência sem início de vigência ou sem motivo da alteração — a pessoa espera HTTP 422 e a situação permanece Rascunho.
5. Mapear lançamentos em conta sintética, ou gravar débito/crédito — a pessoa espera HTTP 422 na sintética e nenhuma tabela de diário, razão, SPED ou apuração.

## Decisões

### D1 — Escopo é só plano de contas e centros de custo

Fonte: Caderno B L436–L440; pedido desta fatia. Entram criar, versionar, aprovar, bloquear conta, mapear lançamentos e revisar competência. Saem E09-T02 a E09-T09, SPED, apuração, diário, razão e a tela fiscal da E01. `mapear lançamentos` grava auditoria de que a versão analítica aprovada permanece vinculada ao centro já gravado. Não insere partida. `partida dobrada` (Caderno B L439) fica como texto da aba Regras e validações; a soma débito = crédito é regra de E09-T03 L459 e não é implementada aqui. RI-B05 (Caderno B L634) proíbe contabilidade paralela: esta fatia não cria segundo razão.

### D2 — Rótulos e campos

A grade usa só as colunas da matriz UX L931, nesta ordem: `Conta contábil`, `Situação`, `Natureza da conta`, `Centro de custo`, `Início de vigência`, `Fim de vigência`. Ordenáveis: as cinco de `componentes.js` L5860–L5866 (Situação fica de fora). Filtro da grade: só `Situação` (matriz UX L932). A frase genérica de filtro por empresa/período/estado (Caderno B L437) não acrescenta coluna nem filtro, porque a matriz UX desta tela é o contrato visual (constituição L93) e não existe tabela de empresa na develop.

O formulário Dados principais (`componentes.js` L5839–L5848) mostra os widgets do protótipo e os dados editáveis do Caderno B L437 / matriz integral L329 que o componente gerado não transformou em widget. Rótulos literais:

| Chave | Rótulo | Controle | Fonte do rótulo |
|---|---|---|---|
| `codigo` | `Código` | texto, obrigatório, máx. 32 | Caderno B L437, palavra `código`, com a primeira letra maiúscula como `titleCase` em `aplicacao.js` L14 |
| `nome` | `Conta contábil` | texto, obrigatório, máx. 180 | `componentes.js` L1229 e L425 |
| `contaPaiCodigo` | `Conta contábil` | combo de cadastro, valor = código de negócio | `componentes.js` L1227–L1237. Placeholder `Selecione conta contábil` (`aplicacao.js` L412). Dica `Vinculado a cadastro existente; seleção obrigatória no formulário.` (`aplicacao.js` L186). O input do nome usa a dica vazia e o placeholder `Informe conta contábil` |
| `classificacao` | `Conta sintética/analítica` | combo fechado | Caderno B L437. Opções visíveis `sintética` e `analítica`. Valores `sintetica` e `analitica` |
| `natureza` | `Natureza da conta` | combo fechado | `componentes.js` L1239–L1249 e enum L1866–L1886 |
| `grupo` | `Grupo` | texto, obrigatório, máx. 180 | Caderno B L437, palavra `grupo`. Não há enum na fonte; não é combo |
| `centroCodigo` | `Centro de custo` | combo de cadastro | `componentes.js` L883–L893 |
| `vigenciaInicio` | `Início de vigência` | `input type="date"`, obrigatório | `componentes.js` L154–L164 |
| `vigenciaFim` | `Fim de vigência` | `input type="date"`, opcional | `componentes.js` L166–L176 |
| `situacao` | `Situação` | combo fechado | `componentes.js` L178–L188 e enum L1688–L1708 |
| `justificativa` | `Motivo da alteração` no drawer; `Justificativa / observação` no modal de ação | textarea obrigatória | drawer: `aplicacao.js` L436. Modal: `aplicacao.js` L496. Não trocar um pelo outro |

Natureza, valor interno e rótulo: `ATIVO`/`Ativo`, `PASSIVO`/`Passivo`, `RECEITA`/`Receita`, `DESPESA`/`Despesa`, `CUSTO`/`Custos`.

Situação, valor interno e rótulo: `DRAFT`/`Rascunho`, `REVIEW`/`Aguardando revisão`, `APPROVED`/`Aprovado`, `REJECTED`/`Rejeitado`, `SUSPENDED`/`Suspenso`.

O filtro genérico `stateTypes` de `aplicacao.js` L8 (`Pendente de validação`, `Em revisão`, `Bloqueado`, `Concluído`) não é o enum do campo. O combo e o filtro usam os cinco rótulos do enum `status`. A ação bloquear grava `SUSPENDED` e mostra `Suspenso`, não a palavra `Bloqueado`.

`Criar` grava sempre `DRAFT`. O combo Situação no criar fica desabilitado em `Rascunho`. Enviar outra situação no POST de criação responde 422.

### D3 — Hierarquia

Fonte: Caderno B L437 e L439 (`conta sintética/analítica`, `níveis hierárquicos válidos`). Não há profundidade máxima na fonte; o worker não inventa teto.

- Conta sintética pode não ter pai (raiz) ou ter pai cuja versão aprovada vigente é sintética.
- Conta analítica exige pai. O pai tem uma versão `APPROVED`, não suspensa, não excluída, com classificação `sintetica`.
- Conta analítica não pode ser pai.
- O caminhamento de pais não pode alcançar a própria conta.
- Código é único entre contas com `deleted_at` nulo e não muda depois do criar.
- Combo de pai e de centro lista só cadastro ativo: versão mais recente `APPROVED`, `deleted_at` nulo, `vigencia_inicio` ≤ data civil de `America/Sao_Paulo`, `vigencia_fim` nulo ou ≥ essa data, situação diferente de `SUSPENDED`.

### D4 — Transições

Justificativa obrigatória em toda mutação (`componentes.js` L5892–L5895; `aplicacao.js` L499).

| Ação | Rótulo do botão | De | Para | Efeito |
|---|---|---|---|---|
| criar | `Criar` e `+ Novo registro` | — | `DRAFT` número 1 | insere conta e versão |
| editar | `Editar versão` | `DRAFT` | `DRAFT` | altera a versão rascunho |
| revisar | `Revisar competência` | `DRAFT` ou `REJECTED` | `REVIEW` | exige `vigenciaInicio` e motivo |
| aprovar | `Aprovar` | `REVIEW` | `APPROVED` | uma aprovação; não há segundo perfil (D7) |
| bloquear | verbo de backend; o controle visível é o integral abaixo | `APPROVED` | `SUSPENDED` | conta deixa o combo |
| versionar | `Versionar` | `APPROVED` | nova linha `DRAFT` | a versão anterior permanece. Origem `SUSPENDED`: HTTP 422 `conta desativada` e nenhuma linha nova (Review Focus 1) |
| mapear | verbo de backend; o controle visível é o integral abaixo | `APPROVED` e `analitica` | mesma situação | só auditoria se o centro enviado é o já gravado |
| validar | `Validar pré-condições` | qualquer | sem escrita | devolve mensagens |
| histórico | `Consultar histórico` | — | — | abre a aba Histórico |
| exportar | `Exportar` e `Exportar visão` | — | — | CSV das colunas da grade |

`actionNames` (`aplicacao.js` L40–L43) não parte `bloquear conta e mapear lançamentos`: o split é na vírgula, e o Caderno B L438 não põe vírgula antes do `e`. `titleCase` (`aplicacao.js` L14) aplicado na faixa (`aplicacao.js` L369) e no drawer (`aplicacao.js` L403–L405) produz um controle com o texto integral `Bloquear conta e mapear lançamentos`. Não existem os botões `Bloquear conta` e `Mapear lançamentos`. A separação dos verbos fica no backend (linhas `bloquear` e `mapear` desta tabela). O clique da faixa abre o modal e o `Confirmar` faz `POST .../bloquear`. O `Abrir decisão →` do mesmo texto, dentro de `Ações do processo`, faz `POST .../mapear`. Os dois posts não saem do mesmo clique.

Editar, revisar, aprovar ou versionar versão `SUSPENDED` responde 422 `conta desativada` e não grava. Versionar suspensa não nasce `DRAFT`. Mapear versão suspensa, sintética ou não aprovada responde 422. Se o centro enviado no mapear difere do centro da versão aprovada, responde 422 `mudança de classificação após fechamento` e não grava; o caminho é `Versionar`. A mensagem HTTP 422 permanece a do Caderno B L440 (`conta desativada`, `mudança de classificação após fechamento`), em minúsculas. O title case vale só para a aba Exceções (D6).

Não existe ação `Rejeitar` no Caderno B L438. `REJECTED` só é alcançado por `POST .../rejeitar` inexistente: o worker não cria essa rota. O rótulo `Rejeitado` permanece no combo porque está no enum. Nenhuma transição desta fatia grava `REJECTED`. Uma versão que já esteja `REJECTED` (não há como nascer assim) pode ir a `REVIEW` pela tabela acima; o teste não fabrica `REJECTED` por SQL de produto, só por inserção direta no teste de banco para travar a transição.

Concorrência: o corpo envia `numero`. A transação faz `SELECT ... FOR UPDATE` da conta. Se o maior número não excluído for diferente de `numero`, HTTP 409, mensagem `conflito concorrente`, sem gravar.

### D5 — Fechamento e empresa não existem nesta ponta

Não há tabela de período contábil nem de empresa/estabelecimento em `app/backend/src/database/schema/`. E09-T08 e E01-T01 são de outras fatias. O worker não cria essas tabelas e não declara FK para elas.

Até existir fechamento, versão `APPROVED` ou `SUSPENDED` não altera `classificacao`, `natureza`, `grupo` nem `centro_custo_id`. A resposta 422 usa o texto da exceção Caderno B L440: `mudança de classificação após fechamento`.

A ficha mostra o rótulo `Empresa` (`aplicacao.js` L190) com valor `—` e o selo `Provisório`. Não preencher `AlphaCarnes Matriz` (é fixture). Não mostrar o seletor HML/PROD nem o texto `Ambiente`.

### D6 — Abas, estados e o que sai da casca de protótipo

Abas, nesta ordem (`aplicacao.js` L7): `Ficha e campos`, `Movimentações`, `Regras e validações`, `Exceções`, `Histórico`, `Integrações`, `Aceite e testes`.

- Ficha e campos: campos D2 da versão mais recente e a trilha `Responsável` com o nome do usuário (`aplicacao.js` L190). Sem UUID.
- Movimentações: cabeçalhos `Acontecimento`, `Origem`, `Efeito`, `Situação` (`aplicacao.js` L195). Linhas reais da auditoria da conta. Sem as três linhas fictícias de SEFAZ/banco.
- Regras e validações: o texto literal `partida dobrada, níveis hierárquicos válidos, competência obrigatória` (`catalogo.js` L730).
- Exceções: dois blocos `Bloqueio / exceção:` (`aplicacao.js` L203) com o `titleCase` de `aplicacao.js` L14 sobre cada item de `catalogo.js` L731: `Conta desativada` e `Mudança de classificação após fechamento`. A mensagem HTTP 422 não usa esse title case; continua a do Caderno B L440.
- Histórico: acontecimento, data `pt-BR` e nome do responsável. Sem GUID (`aplicacao.js` L210).
- Integrações: a aba existe. Não renderizar os botões `Central de Integrações`, `Conciliação API × arquivos` e `Agendamentos` (`aplicacao.js` L218): as rotas não existem nesta ponta. Texto da aba: `Esta tela não chama serviço externo.`
- Aceite e testes: os oito itens de `aplicacao.js` L223–L232, como lista somente leitura, sem gravar aceite.

Estados de tela: `inicial`, `carregando`, `sem registros`, `validação inválida`, `sem acesso`, `conflito concorrente`, `revisão pendente`, `concluído com evidência` (`componentes.js` L5897–L5906). O estado `serviço externo indisponível` não é simulado: não há chamada externa (D1). Falha de rede do próprio backend mostra a mensagem retornada e sai de `carregando`.

Texto vazio da grade (`aplicacao.js` L172): `Nenhum resultado para o período, filtro ou situação escolhidos. Limpe os filtros ou cadastre um novo registro.`

Placeholder da busca (`aplicacao.js` L170): `Pesquisar descrição ou referência de negócio`. A busca casa nome, código, grupo e nome do centro. Não casa UUID.

Sai da UI, por Princípio I.2(a): `DADOS FICTÍCIOS`, `PROTÓTIPO`, `SIMULAR PERFIL`, KPIs `Itens no cenário` / `Ambiente em tela`, painel com `R$ 5.000,00` (`aplicacao.js` L350) e qualquer valor inventado.

Voltar restaura filtro, ordenação, página e rascunho do formulário a partir de `sessionStorage` chave `e09-t01-plano`. A chave é interna: nenhum JSX, grade, toast, aba ou atributo visível a imprime (Caderno B L601). Se o rascunho difere do último salvo, `window.confirm` com o texto `Há alterações não salvas. Deseja sair?`. Cancelar permanece na ficha.

Seleção múltipla (`componentes.js` L5869). Ação em lote envia a lista de códigos numa transação só. A primeira falha desfaz o lote inteiro e devolve 422 ou 409 da primeira conta, com o código de negócio no campo `codigo`.

### D7 — RBAC e menu

Fonte: AD-04 L11; AD-18 L25 item 5; constituição L93–L94; `catalogo.js` L16 e L720–L727; ADR-ERP-024 L61.

- Rota nova: `/erp/contabilidade/plano-de-contas`. O segmento `e09-t01` de catalogo.js L726 não entra no href nem na barra de endereço (Caderno B L601). O slug `plano-de-contas` é o nome de negócio do título (catalogo.js L721; Caderno B L436), sem `E##-T##`. Rótulo do item: `Plano de contas e centros de custo`. Grupo: `CONTABILIDADE`. `iconKey`: `FileText` (já presente em `ICON_MAP`; o protótipo usa bullet, não nomeia ícone lucide).
- `administrador` recebe a rota porque `MENUS_VISIVEIS_POR_PERFIL.administrador` é `[...MENUS_CANONICOS]`. Nenhum outro perfil ganha a rota no mapa.
- `definirMenusSchema` passa de `.max(39)` para `.max(40)` (`perfil.dto.ts` L10), senão o administrador não consegue persistir a lista com a rota nova.
- Os testes que exigem comprimento 39 passam a exigir: as 39 rotas antigas iguais e na mesma ordem; o total 40; a rota nova é a primeira de `CONTABILIDADE`.
- A home do grupo no protótipo aponta `E09-T03` (`catalogo.js` L1099). Essa tela não entra. A rota de entrada dos 11 perfis não muda.

### D8 — Ordinal da migration

Na ponta da implementação, em `app/backend/src/database/migrations/`:

```powershell
$reservados = 44,45,46,47
$usados = Get-ChildItem -Name -File |
  Where-Object { $_ -match '^(\d{4})_.*\.sql$' } |
  ForEach-Object { [int]$Matches[1] }
$n = ($(if ($usados) { ($usados | Measure-Object -Maximum).Maximum } else { 0 }) + 1)
while ($reservados -contains $n -or $usados -contains $n) { $n++ }
'{0:D4}' -f $n
```

Esse ordinal é o prefixo do arquivo. Se `drizzle-kit generate` emitir `0044`, `0045`, `0046` ou `0047`, o worker renomeia o `.sql` e o snapshot para o ordinal calculado e ajusta só o `tag` no `_journal.json`. Não reaproveita esses quatro números. Não cria migration vazia no lugar deles. Não edita SQL de outra fatia. O `idx` do journal é o próximo índice livre na mesma ponta. Este plano não grava SQL.

Se o generate não emitir `CREATE TRIGGER ... set_updated_at()`, o worker acrescenta ao final do arquivo gerado, para `centros_custo`, `contas_contabeis` e `conta_versoes`:

```sql
CREATE TRIGGER trg_centros_custo_updated_at
  BEFORE UPDATE ON centros_custo
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_contas_contabeis_updated_at
  BEFORE UPDATE ON contas_contabeis
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_conta_versoes_updated_at
  BEFORE UPDATE ON conta_versoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

A função `set_updated_at()` já existe (migration `0015_onda3_cadastros_admin.sql` L68–L69).

### D9 — Apresentação sem UUID

O controller HTTP e o CSV devolvem `apresentar()`, que omite `id`, `contaId`, `centroId`, `usuarioId`, `registroId` e qualquer string UUID. O React usa `codigo` como chave. O histórico devolve `quando`, `quem` (nome), `acontecimento`, `justificativa`.

## File Structure

- Create: `app/backend/src/database/schema/contabilidade-plano.schema.ts` — tabelas da fatia.
- Modify: `app/backend/src/database/schema/index.ts` — reexporta o schema.
- Create: migration gerada na Task 2, ordinal D8.
- Create: `app/backend/src/modules/contabilidade/plano/plano.module.ts`
- Create: `app/backend/src/modules/contabilidade/plano/plano.service.ts`
- Create: `app/backend/src/modules/contabilidade/plano/plano.controller.ts`
- Create: `app/backend/src/modules/contabilidade/plano/dto/plano.dto.ts`
- Create: `app/backend/src/modules/contabilidade/plano/regra-contabil.exception.ts`
- Create: `app/backend/src/modules/contabilidade/plano/plano.service.spec.ts`
- Create: `app/backend/test/integration/plano-contas.e2e-spec.ts`
- Modify: `app/backend/src/app.module.ts` — importa `PlanoContasModule`.
- Modify: `app/backend/src/common/rbac/permissoes.ts`
- Modify: `app/backend/src/common/rbac/menus-canonicos.ts`
- Modify: `app/backend/src/modules/perfis/dto/perfil.dto.ts`
- Modify: `app/backend/src/realtime/events/eventos.ts`
- Modify: `app/backend/src/realtime/realtime.gateway.ts` — a room nova não alarga a assinatura das rooms de operação.
- Modify: `app/frontend/src/lib/menu-v2.ts`
- Modify: `app/frontend/__tests__/menu-v2.test.ts`
- Modify: `app/frontend/__tests__/menu-rbac.test.ts`
- Modify: `app/backend/test/integration/perfis-menus.e2e-spec.ts`
- Create: `app/frontend/src/app/(admin)/erp/contabilidade/plano-de-contas/page.tsx`
- Create: `app/frontend/src/app/(admin)/erp/contabilidade/plano-de-contas/plano-contas-client.tsx`
- Create: `app/frontend/src/app/api/contabilidade/plano/route.ts`
- Create: `app/frontend/src/app/api/contabilidade/plano/exportar/route.ts`
- Create: `app/frontend/src/app/api/contabilidade/plano/lote/route.ts`
- Create: `app/frontend/src/app/api/contabilidade/plano/validar/route.ts`
- Create: `app/frontend/src/app/api/contabilidade/plano/[codigo]/[acao]/route.ts`
- Create: `app/frontend/src/app/api/contabilidade/centros-custo/route.ts`
- Create: `app/frontend/e2e/e09-t01-plano-contas.spec.ts`
- Create: `app/frontend/__tests__/plano-contas-apresentacao.test.ts`

## Task 1: Permissões e menu

**Files:**
- Modify: `app/backend/src/common/rbac/permissoes.ts`
- Modify: `app/backend/src/common/rbac/menus-canonicos.ts`
- Modify: `app/backend/src/common/rbac/perfil-permissoes.snapshot.json`
- Modify: `app/backend/src/common/rbac/perfil-menus.snapshot.json`
- Modify: `app/backend/src/modules/perfis/dto/perfil.dto.ts`
- Modify: `app/backend/src/modules/perfis/perfis.service.ts` — `catalogo()` (`perfis.service.ts` L81–L84) lança se o prefixo não tem módulo
- Modify: `app/frontend/src/lib/menu-v2.ts`
- Modify: `app/frontend/__tests__/menu-v2.test.ts`
- Modify: `app/frontend/__tests__/menu-rbac.test.ts`
- Modify: `app/frontend/e2e/shell-ds.spec.ts` — `GRUPOS` L29–L39 e o teste L86 travam 9 grupos
- Modify: `app/backend/test/integration/perfis-menus.e2e-spec.ts`
- Create: `app/backend/test/unit/permissoes-e09-t01.spec.ts`

**Interfaces:**
- Consumes: `PERMISSOES`, `MAPA_PERFIL_PERMISSOES`, `MENUS_CANONICOS`, `MENU_V2`.
- Produces: `PERMISSOES.CONTABILIDADE_PLANO_LER`, `PERMISSOES.CONTABILIDADE_PLANO_GERENCIAR`, rota `/erp/contabilidade/plano-de-contas`.

- [ ] **Step 1: Write the failing test**

```ts
import { MAPA_PERFIL_PERMISSOES, PERMISSOES } from '../../src/common/rbac/permissoes';
import { MENUS_VISIVEIS_POR_PERFIL } from '../../src/common/rbac/menus-canonicos';

const ROTA = '/erp/contabilidade/plano-de-contas';
const CHAVES = [PERMISSOES.CONTABILIDADE_PLANO_LER, PERMISSOES.CONTABILIDADE_PLANO_GERENCIAR];

describe('E09-T01 RBAC', () => {
  it('concede as duas permissões só ao administrador', () => {
    expect(MAPA_PERFIL_PERMISSOES.administrador).toEqual(expect.arrayContaining(CHAVES));
    for (const [slug, lista] of Object.entries(MAPA_PERFIL_PERMISSOES)) {
      if (slug === 'administrador') continue;
      for (const chave of CHAVES) expect(lista).not.toContain(chave);
    }
  });

  it('põe a rota só no menu do administrador', () => {
    expect(MENUS_VISIVEIS_POR_PERFIL.administrador).toContain(ROTA);
    for (const [slug, menus] of Object.entries(MENUS_VISIVEIS_POR_PERFIL)) {
      if (slug === 'administrador') continue;
      expect(menus).not.toContain(ROTA);
    }
  });
});
```

Em `menu-v2.test.ts`, substituir o `const GRUPOS` de L6–L16 e o `it` de L62–L64 (hoje 9 grupos) e o `it` de L66–L69 (hoje `toEqual(ITENS_PROTOTIPO)` e `toHaveLength(39)`). Não deixar o `it` antigo ao lado do novo.

```ts
const GRUPOS = [
  'COMERCIAL', 'GESTÃO', 'RECEBIMENTO & BALANÇA', 'DESOSSA', 'ESTOQUE', 'CARGA',
  'FATURAMENTO', 'CONTABILIDADE', 'CADASTROS & REGRAS', 'ADMINISTRAÇÃO',
];

it('MENU_V2 tem os 10 grupos na ordem do prototipo', () => {
  expect(MENU_V2.map((g) => g.title)).toEqual(GRUPOS);
});

it('preserva as 39 rotas e acrescenta só o plano de contas', () => {
  const atual = MENU_V2.flatMap((g) => g.items.map((i) => [g.title, i.label, i.href]));
  const operacionais = atual.filter(([, , href]) => href !== '/erp/contabilidade/plano-de-contas');
  expect(operacionais).toEqual(ITENS_PROTOTIPO);
  expect(operacionais).toHaveLength(39);
  expect(atual).toHaveLength(40);
  expect(atual).toContainEqual([
    'CONTABILIDADE',
    'Plano de contas e centros de custo',
    '/erp/contabilidade/plano-de-contas',
  ]);
  expect(atual.some(([, , href]) => /e\d{2}-t\d{2}/i.test(String(href)))).toBe(false);
});
```

O `it` de L82–L93 (`page.tsx`) continua. A página nasce na Task 6; o Step 4 desta task não o executa.

Em `menu-rbac.test.ts`, os números lidos no arquivo hoje são 39 rotas (L167–L169 e L279) e 126 pares (L176–L180 e L280). A rota nova entra só no administrador, então os totais reais passam a 40 e 127. Não basta trocar 39 por 40.

```ts
const ROTA_PLANO = '/erp/contabilidade/plano-de-contas';

const MATRIZ_RASTREABILIDADE: Record<string, string[]> = {
  // as 39 chaves atuais, intactas, mais:
  [ROTA_PLANO]: ['administrador'],
};

const TODOS = [
  'COMERCIAL', 'GESTÃO', 'RECEBIMENTO & BALANÇA', 'DESOSSA', 'ESTOQUE',
  'CARGA', 'FATURAMENTO', 'CONTABILIDADE', 'CADASTROS & REGRAS', 'ADMINISTRAÇÃO',
];

const GRUPOS_ESPERADOS: Record<string, string[]> = {
  administrador: TODOS,
  gestor: [
    'COMERCIAL', 'GESTÃO', 'RECEBIMENTO & BALANÇA', 'DESOSSA', 'ESTOQUE',
    'CARGA', 'FATURAMENTO', 'CADASTROS & REGRAS', 'ADMINISTRAÇÃO',
  ],
  // os outros nove perfis permanecem como estão em L102–L110
};

it('a matriz transcrita cobre as 39 rotas operacionais e a rota nova', () => {
  const chaves = Object.keys(MATRIZ_RASTREABILIDADE);
  expect(chaves.filter((href) => href !== ROTA_PLANO).sort()).toEqual(
    [...ROTAS_CANONICAS].filter((href) => href !== ROTA_PLANO).sort(),
  );
  expect(chaves.filter((href) => href !== ROTA_PLANO)).toHaveLength(39);
  expect([...ROTAS_CANONICAS].sort()).toEqual(chaves.sort());
  expect(ROTAS_CANONICAS).toHaveLength(40);
});

it('a matriz soma 127 atribuicoes perfil x rota', () => {
  const total = PERFIS.reduce((soma, perfil) => soma + menusDe(perfil).length, 0);
  expect(total).toBe(127);
  expect(Object.values(MATRIZ_RASTREABILIDADE).reduce((s, p) => s + p.length, 0)).toBe(127);
});
```

O `it` de L274–L293 troca `toHaveLength(39)` por `toHaveLength(40)` e `toBe(126)` por `toBe(127)`, e afirma que `PERMISSOES_POR_PERFIL.administrador` contém as duas chaves novas e que nenhum outro perfil as contém. `filtrarMenuPorMenusVisiveis` (`menu-v2.ts` L119–L124) omite grupo sem item: o gestor não vê `CONTABILIDADE`.

Em `shell-ds.spec.ts`, o `GRUPOS` de L29–L39 ganha `'CONTABILIDADE'` entre `'FATURAMENTO'` e `'CADASTROS & REGRAS'`. O título do teste de L86 passa de "9 grupos" para "10 grupos". A asserção `toEqual(GRUPOS)` não é afrouxada.

Em `perfis-menus.e2e-spec.ts` L78–L79, `MENUS_CANONICOS` e `res.body.menus` passam a `toHaveLength(40)`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/unit/permissoes-e09-t01.spec.ts test/unit/perfil-permissoes-snapshot.spec.ts --runInBand` em `app/backend` e `npx jest __tests__/menu-v2.test.ts __tests__/menu-rbac.test.ts -t "10 grupos|preserva as 39|39 rotas operacionais|127 atribuicoes|onda 4" --runInBand` em `app/frontend`.

Expected: FAIL porque as chaves, a rota e os snapshots não existem.

- [ ] **Step 3: Write minimal implementation**

Em `permissoes.ts`, no objeto `PERMISSOES`, depois de `OCORRENCIA_PRECO_CIENTE`:

```ts
CONTABILIDADE_PLANO_LER: 'CONTABILIDADE_PLANO_LER',
CONTABILIDADE_PLANO_GERENCIAR: 'CONTABILIDADE_PLANO_GERENCIAR',
```

Depois de `pushPermissoes('diretoria', 'FATURAMENTO_LER');` (`permissoes.ts` L405):

```ts
pushPermissoes('administrador', 'CONTABILIDADE_PLANO_LER', 'CONTABILIDADE_PLANO_GERENCIAR');
```

Em `DESCRICOES_PERMISSOES`:

```ts
CONTABILIDADE_PLANO_LER: 'Consultar plano de contas e centros de custo',
CONTABILIDADE_PLANO_GERENCIAR: 'Criar, versionar, revisar, aprovar, bloquear e mapear o plano de contas',
```

Em `menus-canonicos.ts`, inserir `'/erp/contabilidade/plano-de-contas'` em `MENUS_CANONICOS`, depois de `'/faturamento/liberacao'` (L32) e antes de `'/cadastros/representantes'` (L33). O array `gestor` (L89–L90) tem o mesmo par e não recebe a rota: `administrador` é `[...MENUS_CANONICOS]` (L61); `gestor` é lista própria; D7 não concede a rota a outro perfil. Inserir no gestor criaria o 128º par e o grupo `CONTABILIDADE` para o gestor (`filtrarMenuPorMenusVisiveis`, `menu-v2.ts` L124). O comentário "Total: 126 pares" (L58) passa a "126 pares da matriz v1.1 + 1".

Em `perfil.dto.ts` L10, `.max(39)` vira `.max(40)`.

Em `perfis.service.ts`, `MODULOS` (L59–L67) ganha, depois de `Expedição e Faturamento`:

```ts
{ modulo: 'Contabilidade', prefixos: ['CONTABILIDADE_'] },
```

Sem esse prefixo, `catalogo()` lança `Permissões sem módulo no catálogo` (L81–L84) e o `it` de `perfis-menus.e2e-spec.ts` L71 quebra antes de L78.

Em `menu-v2.ts`, inserir o grupo depois de `FATURAMENTO`:

```ts
{
  title: 'CONTABILIDADE',
  items: [
    {
      href: '/erp/contabilidade/plano-de-contas',
      label: 'Plano de contas e centros de custo',
      iconKey: 'FileText',
    },
  ],
},
```

Não alterar `ROTA_ENTRADA_POR_PERFIL`.

Regenerar os dois snapshots a partir dos mapas, em `app/backend`:

```powershell
npx tsx scripts/gerar-snapshot-perfis.ts
```

`perfil-permissoes-snapshot.spec.ts` L15–L18 exige `perfil-permissoes.snapshot.json` igual a `MAPA_PERFIL_PERMISSOES` ordenado. `menu-rbac.test.ts` L12–L17 lê também `perfil-menus.snapshot.json`. Só a chave `administrador` muda em cada arquivo: as duas permissões novas, em ordem alfabética, e a rota nova. Nenhum outro slug ganha permissão nem rota.

- [ ] **Step 4: Run test to verify it passes**

Run: os mesmos comandos do Step 2, mais `npx jest test/integration/perfis-menus.e2e-spec.ts -t "catalogo de permissoes" --runInBand` em `app/backend`.

Expected: PASS. O `it` de `page.tsx` em `menu-v2.test.ts` L82 fica para a Task 6.

- [ ] **Step 5: Commit**

```powershell
git add app/backend/src/common/rbac/permissoes.ts app/backend/src/common/rbac/menus-canonicos.ts app/backend/src/common/rbac/perfil-permissoes.snapshot.json app/backend/src/common/rbac/perfil-menus.snapshot.json app/backend/src/modules/perfis/dto/perfil.dto.ts app/backend/src/modules/perfis/perfis.service.ts app/frontend/src/lib/menu-v2.ts app/frontend/__tests__/menu-v2.test.ts app/frontend/__tests__/menu-rbac.test.ts app/frontend/e2e/shell-ds.spec.ts app/backend/test/integration/perfis-menus.e2e-spec.ts app/backend/test/unit/permissoes-e09-t01.spec.ts
git commit -m @"
feat(contabilidade): abre o menu do plano de contas só ao administrador

### Descrição Detalhada:
Inclui as permissões de leitura e gestão do plano de contas no perfil administrador e a rota no grupo CONTABILIDADE.

### Motivo da Mudança:
A persona contador/controladoria não é um dos 11 perfis. A permissão nova não pode vazar para os outros slugs.

### Impacto:
O catálogo de menus do administrador passa de 39 para 40 rotas e de 126 para 127 pares. Os outros perfis permanecem iguais.
"@
```

## Task 2: Schema Drizzle e migration

**Files:**
- Create: `app/backend/src/database/schema/contabilidade-plano.schema.ts`
- Modify: `app/backend/src/database/schema/index.ts`
- Create: arquivo de migration no ordinal D8
- Test: `app/backend/test/integration/plano-contas.e2e-spec.ts` (só o caso de constraints; o harness copia o bootstrap de `perfis-menus.e2e-spec.ts`)

**Interfaces:**
- Consumes: `usuarios` de `auth.schema.ts`.
- Produces: tabelas `centros_custo`, `contas_contabeis`, `conta_versoes`.

- [ ] **Step 1: Write the failing test**

```ts
it('recusa natureza fora do enum e vigência invertida', async () => {
  const centro = await db.insert(centrosCusto).values({ codigo: 'CT1', nome: 'Operação industrial' }).returning();
  const conta = await db.insert(contasContabeis).values({ codigo: '1' }).returning();
  const base = {
    contaId: conta[0].id,
    numero: 1,
    nome: 'Caixa',
    classificacao: 'analitica' as const,
    grupo: 'Circulante',
    centroCustoId: centro[0].id,
    situacao: 'DRAFT' as const,
    justificativa: 'teste',
    responsavelId: adminId,
  };
  await expect(db.insert(contaVersoes).values({
    ...base,
    natureza: 'OUTRA',
    vigenciaInicio: '2026-10-01',
  })).rejects.toThrow();
  await expect(db.insert(contaVersoes).values({
    ...base,
    natureza: 'ATIVO',
    vigenciaInicio: '2026-10-01',
    vigenciaFim: '2026-09-01',
  })).rejects.toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/integration/plano-contas.e2e-spec.ts -t "natureza fora" --runInBand` em `app/backend`.

Expected: FAIL com módulo ou tabela ausente.

- [ ] **Step 3: Write minimal implementation**

```ts
import { sql } from 'drizzle-orm';
import { check, date, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { usuarios } from './auth.schema';

export const centrosCusto = pgTable(
  'centros_custo',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    codigo: text('codigo').notNull(),
    nome: text('nome').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('uq_centros_custo_codigo').on(t.codigo).where(sql`${t.deletedAt} IS NULL`),
  ],
);

export const contasContabeis = pgTable(
  'contas_contabeis',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    codigo: text('codigo').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('uq_contas_contabeis_codigo').on(t.codigo).where(sql`${t.deletedAt} IS NULL`),
  ],
);

export const contaVersoes = pgTable(
  'conta_versoes',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    contaId: uuid('conta_id').notNull().references(() => contasContabeis.id),
    numero: integer('numero').notNull(),
    nome: text('nome').notNull(),
    classificacao: text('classificacao').notNull(),
    natureza: text('natureza').notNull(),
    grupo: text('grupo').notNull(),
    contaPaiId: uuid('conta_pai_id').references(() => contasContabeis.id),
    centroCustoId: uuid('centro_custo_id').notNull().references(() => centrosCusto.id),
    vigenciaInicio: date('vigencia_inicio').notNull(),
    vigenciaFim: date('vigencia_fim'),
    situacao: text('situacao').notNull(),
    justificativa: text('justificativa').notNull(),
    responsavelId: uuid('responsavel_id').notNull().references(() => usuarios.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('uq_conta_versoes_numero').on(t.contaId, t.numero).where(sql`${t.deletedAt} IS NULL`),
    index('idx_conta_versoes_conta').on(t.contaId),
    index('idx_conta_versoes_pai').on(t.contaPaiId),
    index('idx_conta_versoes_centro').on(t.centroCustoId),
    index('idx_conta_versoes_responsavel').on(t.responsavelId),
    index('idx_conta_versoes_situacao').on(t.situacao).where(sql`${t.deletedAt} IS NULL`),
    check('chk_conta_versoes_classificacao', sql`${t.classificacao} IN ('sintetica','analitica')`),
    check('chk_conta_versoes_natureza', sql`${t.natureza} IN ('ATIVO','PASSIVO','RECEITA','DESPESA','CUSTO')`),
    check('chk_conta_versoes_situacao', sql`${t.situacao} IN ('DRAFT','REVIEW','APPROVED','REJECTED','SUSPENDED')`),
    check('chk_conta_versoes_vigencia', sql`${t.vigenciaFim} IS NULL OR ${t.vigenciaFim} >= ${t.vigenciaInicio}`),
  ],
);
```

Exportar em `schema/index.ts`. Gerar a migration pelo algoritmo D8 (`npm run db:generate` no `app/backend`, nome `e09_t01_plano_contas`) e aplicar os triggers de D8. Não numerar 0044–0047.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run db:migrate` e o Jest do Step 2, em `app/backend`.

Expected: PASS. O CHECK de natureza recusa `OUTRA`. O CHECK `chk_conta_versoes_vigencia` recusa fim `2026-09-01` com início `2026-10-01`.

- [ ] **Step 5: Commit**

```powershell
git add app/backend/src/database/schema/contabilidade-plano.schema.ts app/backend/src/database/schema/index.ts app/backend/src/database/migrations app/backend/test/integration/plano-contas.e2e-spec.ts
git commit -m @"
feat(contabilidade): cria as tabelas do plano de contas

### Descrição Detalhada:
Adiciona centros de custo, contas e versões com os enums literais do protótipo.

### Motivo da Mudança:
A hierarquia, a vigência e a situação precisam persistir antes das regras de transição.

### Impacto:
Nenhuma tabela fiscal ou de lançamento é criada. O ordinal da migration é o próximo livre fora de 0044 a 0047.
"@
```

## Task 3: Centros, criação e hierarquia

**Files:**
- Create: `app/backend/src/modules/contabilidade/plano/dto/plano.dto.ts`
- Create: `app/backend/src/modules/contabilidade/plano/regra-contabil.exception.ts`
- Create: `app/backend/src/modules/contabilidade/plano/plano.service.ts`
- Create: `app/backend/src/modules/contabilidade/plano/plano.module.ts`
- Modify: `app/backend/src/app.module.ts`
- Test: `app/backend/src/modules/contabilidade/plano/plano.service.spec.ts`
- Test: `app/backend/test/integration/plano-contas.e2e-spec.ts`

**Interfaces:**
- Consumes: tabelas da Task 2, `AuditoriaService`, `DRIZZLE`.
- Produces: `PlanoContasService.criarCentro`, `PlanoContasService.criar`, `PlanoContasService.listar`, `PlanoContasService.obter`, `PlanoContasService.apresentar`.

- [ ] **Step 1: Write the failing test**

Inclui o Review Focus 3. O teste fica em `plano-contas.e2e-spec.ts` e usa o service com o Postgres do harness. `aprovar` ainda não existe: a situação `APPROVED` do pai é gravada por `UPDATE` no teste.

```ts
function dtoBase(parcial: Partial<CriarContaDto>): CriarContaDto {
  return {
    codigo: '1',
    nome: 'Caixa e bancos',
    classificacao: 'sintetica',
    natureza: 'ATIVO',
    grupo: 'Circulante',
    contaPaiCodigo: null,
    centroCodigo: 'CT1',
    vigenciaInicio: '2026-10-01',
    vigenciaFim: null,
    justificativa: 'abertura',
    ...parcial,
  };
}

async function aprovarDireto(codigo: string) {
  await db.execute(sql`
    update conta_versoes v
       set situacao = 'APPROVED'
      from contas_contabeis c
     where v.conta_id = c.id
       and c.codigo = ${codigo}
       and v.numero = 1
  `);
}

it('recusa pai analítico e não grava a conta filha', async () => {
  await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
  await service.criar(dtoBase({ codigo: '1', classificacao: 'sintetica', contaPaiCodigo: null }), userId);
  await aprovarDireto('1');
  await service.criar(dtoBase({ codigo: '1.1', classificacao: 'analitica', contaPaiCodigo: '1' }), userId);
  await aprovarDireto('1.1');
  await expect(service.criar(dtoBase({
    codigo: '1.1.01',
    classificacao: 'analitica',
    contaPaiCodigo: '1.1',
  }), userId)).rejects.toMatchObject({
    status: 422,
    response: { message: 'Conta pai analítica não é nível hierárquico válido' },
  });
  const lista = await service.listar({ pagina: 1, q: '1.1.01', situacao: '', ordenar: 'contaContabil', direcao: 'asc' });
  expect(lista.total).toBe(0);
});

it('recusa pai inexistente', async () => {
  await service.criarCentro({ codigo: 'CT9', nome: 'Administrativo', justificativa: 'abre centro' }, userId);
  await expect(service.criar(dtoBase({
    codigo: '9',
    classificacao: 'analitica',
    contaPaiCodigo: 'nao-existe',
    centroCodigo: 'CT9',
  }), userId)).rejects.toMatchObject({
    status: 422,
    response: { message: 'Conta pai não encontrada' },
  });
});
```

Pai em `DRAFT` responde 422 `Conta pai não está ativa`. Código de conta repetido responde 409 `Já existe conta com este código`. Código de centro repetido responde 409 `Já existe centro de custo com este código`. O ciclo de pai entra na Task 4, no `versionar`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/integration/plano-contas.e2e-spec.ts -t "pai analítico" --runInBand` em `app/backend`.

Expected: FAIL com `PlanoContasService` indefinido.

- [ ] **Step 3: Write minimal implementation**

```ts
import { HttpException, HttpStatus } from '@nestjs/common';

export class RegraContabilException extends HttpException {
  constructor(message: string) {
    super({ message }, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
```

DTO Zod:

```ts
import { z } from 'zod';

const codigo = z.string().trim().min(1).max(32);
const texto180 = z.string().trim().min(1).max(180);
const motivo = z.string().trim().min(1).max(2000);
const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const criarCentroSchema = z.object({
  codigo,
  nome: texto180,
  justificativa: motivo,
});

export const criarContaSchema = z.object({
  codigo,
  nome: texto180,
  classificacao: z.enum(['sintetica', 'analitica']),
  natureza: z.enum(['ATIVO', 'PASSIVO', 'RECEITA', 'DESPESA', 'CUSTO']),
  grupo: texto180,
  contaPaiCodigo: codigo.nullable(),
  centroCodigo: codigo,
  vigenciaInicio: dataIso,
  vigenciaFim: dataIso.nullable(),
  justificativa: motivo,
}).refine((d) => d.vigenciaFim === null || d.vigenciaFim >= d.vigenciaInicio, {
  message: 'Fim de vigência anterior ao início de vigência',
});

export const listarPlanoSchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  q: z.string().trim().max(180).default(''),
  situacao: z.enum(['', 'DRAFT', 'REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED']).default(''),
  ordenar: z.enum(['contaContabil', 'naturezaConta', 'centroCusto', 'vigenciaInicio', 'vigenciaFim']).default('contaContabil'),
  direcao: z.enum(['asc', 'desc']).default('asc'),
});
```

```ts
async criar(dto: CriarContaDto, usuarioId: string) {
  await this.db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'contabilidade:conta:' + dto.codigo}))`);
    const duplicada = await tx.select({ id: contasContabeis.id }).from(contasContabeis)
      .where(and(eq(contasContabeis.codigo, dto.codigo), isNull(contasContabeis.deletedAt))).limit(1);
    if (duplicada.length > 0) throw new ConflictException('Já existe conta com este código');
    const centro = await this.centroAtivo(tx, dto.centroCodigo);
    const paiId = await this.paiValido(tx, dto.classificacao, dto.contaPaiCodigo);
    const [conta] = await tx.insert(contasContabeis).values({ codigo: dto.codigo }).returning();
    const [versao] = await tx.insert(contaVersoes).values({
      contaId: conta.id,
      numero: 1,
      nome: dto.nome,
      classificacao: dto.classificacao,
      natureza: dto.natureza,
      grupo: dto.grupo,
      contaPaiId: paiId,
      centroCustoId: centro.id,
      vigenciaInicio: dto.vigenciaInicio,
      vigenciaFim: dto.vigenciaFim,
      situacao: 'DRAFT',
      justificativa: dto.justificativa,
      responsavelId: usuarioId,
    }).returning();
    await this.auditoria.registrar(tx, {
      tabela: 'conta_versoes',
      registroId: versao.id,
      operacao: 'INSERT',
      modulo: 'contabilidade.plano',
      usuarioId,
      dadosAnteriores: {},
      dadosNovos: versao,
      justificativa: dto.justificativa,
    });
  });
  this.eventEmitter.emit(EVENTOS.PLANO_CONTA_CRIADA, { codigo: dto.codigo, acao: 'criar', situacao: 'DRAFT' });
  return this.obter(dto.codigo);
}

private async centroAtivo(tx: Tx, codigo: string) {
  const [centro] = await tx.select().from(centrosCusto)
    .where(and(eq(centrosCusto.codigo, codigo), isNull(centrosCusto.deletedAt))).limit(1);
  if (!centro) throw new RegraContabilException('Centro de custo não encontrado');
  return centro;
}

private async paiValido(tx: Tx, classificacao: 'sintetica' | 'analitica', contaPaiCodigo: string | null) {
  if (!contaPaiCodigo) {
    if (classificacao === 'analitica') throw new RegraContabilException('Conta pai não encontrada');
    return null;
  }
  const [pai] = await tx.select().from(contasContabeis)
    .where(and(eq(contasContabeis.codigo, contaPaiCodigo), isNull(contasContabeis.deletedAt))).limit(1);
  if (!pai) throw new RegraContabilException('Conta pai não encontrada');
  const [vigente] = await tx.select().from(contaVersoes).where(and(
    eq(contaVersoes.contaId, pai.id),
    eq(contaVersoes.situacao, 'APPROVED'),
    isNull(contaVersoes.deletedAt),
  )).orderBy(desc(contaVersoes.numero)).limit(1);
  if (!vigente) throw new RegraContabilException('Conta pai não está ativa');
  if (vigente.classificacao === 'analitica') {
    throw new RegraContabilException('Conta pai analítica não é nível hierárquico válido');
  }
  return pai.id;
}

async criarCentro(dto: CriarCentroDto, usuarioId: string) {
  await this.db.transaction(async (tx) => {
    const duplicado = await tx.select({ id: centrosCusto.id }).from(centrosCusto)
      .where(and(eq(centrosCusto.codigo, dto.codigo), isNull(centrosCusto.deletedAt))).limit(1);
    if (duplicado.length > 0) throw new ConflictException('Já existe centro de custo com este código');
    const [centro] = await tx.insert(centrosCusto).values({ codigo: dto.codigo, nome: dto.nome }).returning();
    await this.auditoria.registrar(tx, {
      tabela: 'centros_custo',
      registroId: centro.id,
      operacao: 'INSERT',
      modulo: 'contabilidade.plano',
      usuarioId,
      dadosAnteriores: {},
      dadosNovos: centro,
      justificativa: dto.justificativa,
    });
  });
  this.eventEmitter.emit(EVENTOS.CENTRO_CUSTO_CRIADO, { codigo: dto.codigo, acao: 'criar', situacao: 'APPROVED' });
}
```

`beforeEach` do spec apaga `conta_versoes`, `contas_contabeis` e `centros_custo`, nessa ordem.

`listar` devolve a versão de maior `numero` de cada conta não excluída, página de 20, filtro de situação e busca em nome, código, grupo e nome do centro. Ordenação: `contaContabil` → `nome`, `naturezaConta` → `natureza`, `centroCusto` → nome do centro, `vigenciaInicio`, `vigenciaFim`.

`apresentar` devolve só: `codigo`, `nome`, `classificacao`, `classificacaoRotulo`, `natureza`, `naturezaRotulo`, `grupo`, `contaPaiCodigo`, `centroCodigo`, `centroNome`, `vigenciaInicio`, `vigenciaFim`, `situacao`, `situacaoRotulo`, `numero`, `responsavelNome`, `criadoEm`, `alteradoEm`.

Rótulos de classificação: `sintetica` → `sintética`, `analitica` → `analítica`.

Registrar `PlanoContasModule` em `app.module.ts` ao lado dos outros módulos de domínio. O module importa `AuthModule` e `AuditoriaModule`.

- [ ] **Step 4: Run test to verify it passes**

Run: o Jest do Step 2 mais `npx jest src/modules/contabilidade/plano/plano.service.spec.ts --runInBand`.

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add app/backend/src/modules/contabilidade/plano app/backend/src/app.module.ts
git commit -m @"
feat(contabilidade): cria conta e centro com hierarquia válida

### Descrição Detalhada:
Persiste o centro de custo e a primeira versão em rascunho, recusando pai analítico, pai ausente e código repetido.

### Motivo da Mudança:
O plano de contas é hierárquico. Uma conta analítica não pode agrupar outra conta.

### Impacto:
Ainda não há aprovação nem bloqueio. Nenhuma partida contábil é gravada.
"@
```

## Task 4: Versão, revisão, aprovação, bloqueio e mapeamento

**Files:**
- Modify: `app/backend/src/modules/contabilidade/plano/plano.service.ts`
- Modify: `app/backend/src/modules/contabilidade/plano/dto/plano.dto.ts`
- Modify: `app/backend/src/realtime/events/eventos.ts`
- Modify: `app/backend/src/realtime/realtime.gateway.ts`
- Test: `app/backend/test/integration/plano-contas.e2e-spec.ts` — os `it` abaixo usam `db.execute` do harness desta spec (Task 2). Não vão para `plano.service.spec.ts`.

**Interfaces:**
- Consumes: `criar` e `apresentar` da Task 3.
- Produces: `editar`, `revisarCompetencia`, `aprovar`, `bloquear`, `versionar`, `mapear`, `validar`, `historico`, `lote`. Eventos `plano_conta_criada`, `plano_conta_versionada`, `plano_conta_revisada`, `plano_conta_aprovada`, `plano_conta_bloqueada`, `plano_conta_mapeada`, `centro_custo_criado`.

- [ ] **Step 1: Write the failing test**

Review Focus 1, 2, 4 e 5, no harness de `plano-contas.e2e-spec.ts`. Helpers:

```ts
async function promover(codigo: string) {
  await service.revisarCompetencia(codigo, {
    numero: 1,
    vigenciaInicio: '2026-10-01',
    vigenciaFim: null,
    justificativa: 'revisa',
  }, userId);
  return service.aprovar(codigo, { numero: 1, justificativa: 'aprova' }, userId);
}

async function contaAprovadaSintetica() {
  await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
  await service.criar(dtoBase({ codigo: '1', classificacao: 'sintetica', contaPaiCodigo: null, centroCodigo: 'CT1' }), userId);
  return promover('1');
}

async function contaAprovadaAnalitica() {
  const pai = await contaAprovadaSintetica();
  await service.criar(dtoBase({
    codigo: '1.1.01',
    nome: 'Caixa e bancos',
    classificacao: 'analitica',
    contaPaiCodigo: pai.codigo,
    centroCodigo: pai.centroCodigo,
  }), userId);
  return promover('1.1.01');
}

async function contarVersoes(codigo: string) {
  const res = await db.execute(sql`
    select count(*)::int as total
      from conta_versoes v
      join contas_contabeis c on c.id = v.conta_id
     where c.codigo = ${codigo}
       and v.deleted_at is null
  `);
  return res.rows[0].total as number;
}

it('não versiona conta suspensa e não nasce rascunho', async () => {
  const conta = await contaAprovadaAnalitica();
  await service.bloquear(conta.codigo, { numero: conta.numero, justificativa: 'bloqueio' }, userId);
  await expect(service.versionar(conta.codigo, {
    ...dtoBase({ codigo: conta.codigo, contaPaiCodigo: conta.contaPaiCodigo, centroCodigo: conta.centroCodigo }),
    numero: conta.numero,
    justificativa: 'tenta versionar',
  }, userId)).rejects.toMatchObject({ response: { message: 'conta desativada' }, status: 422 });
  expect(await contarVersoes(conta.codigo)).toBe(1);
});

it('não mapeia conta suspensa e não grava outra versão', async () => {
  const conta = await contaAprovadaAnalitica();
  await service.bloquear(conta.codigo, { numero: conta.numero, justificativa: 'bloqueio' }, userId);
  await expect(service.mapear(conta.codigo, {
    numero: conta.numero,
    centroCodigo: conta.centroCodigo,
    justificativa: 'tenta mapear',
  }, userId)).rejects.toMatchObject({ response: { message: 'conta desativada' }, status: 422 });
  expect(await contarVersoes(conta.codigo)).toBe(1);
});

it('não altera natureza da versão aprovada', async () => {
  const conta = await contaAprovadaAnalitica();
  await expect(service.editar(conta.codigo, { ...conta, natureza: 'PASSIVO', numero: conta.numero, justificativa: 'troca' }, userId))
    .rejects.toMatchObject({ response: { message: 'mudança de classificação após fechamento' }, status: 422 });
  expect((await service.obter(conta.codigo)).natureza).toBe('ATIVO');
});

it('não revisa competência sem início de vigência', async () => {
  const conta = await service.criar(dtoBase({ vigenciaInicio: '2026-10-01' }), userId);
  await expect(service.revisarCompetencia(conta.codigo, {
    numero: 1,
    vigenciaInicio: '',
    vigenciaFim: null,
    justificativa: 'revisa',
  }, userId)).rejects.toMatchObject({ status: 422 });
  expect((await service.obter(conta.codigo)).situacao).toBe('DRAFT');
});

it('mapear conta sintética não cria tabela de lançamento', async () => {
  const conta = await contaAprovadaSintetica();
  await expect(service.mapear(conta.codigo, {
    numero: conta.numero,
    centroCodigo: conta.centroCodigo,
    justificativa: 'mapear grupo',
  }, userId)).rejects.toMatchObject({ status: 422 });
  const tabelas = await db.execute(sql`select to_regclass('public.lancamentos_contabeis') as nome`);
  expect(tabelas.rows[0].nome).toBeNull();
});
```

O DTO de revisar recusa `vigenciaInicio` vazio no Zod (400). O teste de Review Focus 4 chama o service com a string vazia depois de um refine interno: se `vigenciaInicio` não casa `/^\d{4}-\d{2}-\d{2}$/`, o service lança `RegraContabilException` 422 `Início de vigência é obrigatório` antes de mudar a situação. Motivo em branco no service lança 422 `Informe justificativa para auditoria.` (`aplicacao.js` L451) e também deixa `DRAFT`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/integration/plano-contas.e2e-spec.ts -t "suspensa|não versiona|natureza da versão|competência|sintética" --runInBand` em `app/backend`.

Expected: FAIL com método ausente.

- [ ] **Step 3: Write minimal implementation**

```ts
private async travar(tx: Tx, codigo: string, numero: number) {
  const [conta] = await tx.select().from(contasContabeis)
    .where(and(eq(contasContabeis.codigo, codigo), isNull(contasContabeis.deletedAt)))
    .for('update').limit(1);
  if (!conta) throw new NotFoundException('Conta não encontrada');
  const versoes = await tx.select().from(contaVersoes)
    .where(and(eq(contaVersoes.contaId, conta.id), isNull(contaVersoes.deletedAt)));
  const maior = versoes.reduce((m, v) => Math.max(m, v.numero), 0);
  if (maior !== numero) throw new ConflictException('conflito concorrente');
  const atual = versoes.find((v) => v.numero === numero);
  if (!atual) throw new NotFoundException('Conta não encontrada');
  return { conta, atual };
}

private mudouClassificacao(atual: ContaVersao, dto: { natureza: string; grupo: string; classificacao: string; centroCodigo: string }, centroId: string) {
  return atual.natureza !== dto.natureza || atual.grupo !== dto.grupo
    || atual.classificacao !== dto.classificacao || atual.centroCustoId !== centroId;
}

async editar(codigo: string, dto: EditarContaDto, usuarioId: string) {
  const salva = await this.db.transaction(async (tx) => {
    const { atual } = await this.travar(tx, codigo, dto.numero);
    if (atual.situacao === 'SUSPENDED') throw new RegraContabilException('conta desativada');
    const centro = await this.centroAtivo(tx, dto.centroCodigo);
    if (atual.situacao === 'APPROVED' && this.mudouClassificacao(atual, dto, centro.id)) {
      throw new RegraContabilException('mudança de classificação após fechamento');
    }
    if (atual.situacao !== 'DRAFT') throw new RegraContabilException('mudança de classificação após fechamento');
    if (!dto.justificativa.trim()) throw new RegraContabilException('Informe justificativa para auditoria.');
    const [nova] = await tx.update(contaVersoes).set({
      nome: dto.nome,
      classificacao: dto.classificacao,
      natureza: dto.natureza,
      grupo: dto.grupo,
      contaPaiId: await this.paiValido(tx, dto.classificacao, dto.contaPaiCodigo),
      centroCustoId: centro.id,
      vigenciaInicio: dto.vigenciaInicio,
      vigenciaFim: dto.vigenciaFim,
      justificativa: dto.justificativa,
      responsavelId: usuarioId,
    }).where(eq(contaVersoes.id, atual.id)).returning();
    await this.auditoria.registrar(tx, {
      tabela: 'conta_versoes', registroId: nova.id, operacao: 'UPDATE',
      modulo: 'contabilidade.plano', usuarioId, dadosAnteriores: atual, dadosNovos: nova,
      justificativa: dto.justificativa,
    });
    return nova;
  });
  this.eventEmitter.emit(EVENTOS.PLANO_CONTA_CRIADA, { codigo, acao: 'editar', situacao: salva.situacao });
  return this.obter(codigo);
}

async versionar(codigo: string, dto: EditarContaDto, usuarioId: string) {
  const salva = await this.db.transaction(async (tx) => {
    const { conta, atual } = await this.travar(tx, codigo, dto.numero);
    if (atual.situacao === 'SUSPENDED') throw new RegraContabilException('conta desativada');
    if (atual.situacao === 'DRAFT' || atual.situacao === 'REVIEW') {
      throw new ConflictException('Versão em aberto já existe');
    }
    if (atual.situacao !== 'APPROVED') throw new RegraContabilException('conta desativada');
    const paiId = await this.paiValido(tx, dto.classificacao, dto.contaPaiCodigo);
    if (paiId && await this.ciclo(tx, conta.id, paiId)) {
      const [paiVersao] = await tx.select().from(contaVersoes)
        .where(and(eq(contaVersoes.contaId, paiId), eq(contaVersoes.situacao, 'APPROVED'), isNull(contaVersoes.deletedAt)))
        .limit(1);
      throw new RegraContabilException(
        paiVersao?.classificacao === 'analitica'
          ? 'Conta pai analítica não é nível hierárquico válido'
          : 'Ciclo na hierarquia da conta',
      );
    }
    const centro = await this.centroAtivo(tx, dto.centroCodigo);
    const [nova] = await tx.insert(contaVersoes).values({
      contaId: conta.id,
      numero: atual.numero + 1,
      nome: dto.nome,
      classificacao: dto.classificacao,
      natureza: dto.natureza,
      grupo: dto.grupo,
      contaPaiId: paiId,
      centroCustoId: centro.id,
      vigenciaInicio: dto.vigenciaInicio,
      vigenciaFim: dto.vigenciaFim,
      situacao: 'DRAFT',
      justificativa: dto.justificativa,
      responsavelId: usuarioId,
    }).returning();
    await this.auditoria.registrar(tx, {
      tabela: 'conta_versoes', registroId: nova.id, operacao: 'INSERT',
      modulo: 'contabilidade.plano', usuarioId, dadosAnteriores: atual, dadosNovos: nova,
      justificativa: dto.justificativa,
    });
    return nova;
  });
  this.eventEmitter.emit(EVENTOS.PLANO_CONTA_VERSIONADA, { codigo, acao: 'versionar', situacao: 'DRAFT' });
  return this.obter(codigo);
}

async mapear(codigo: string, dto: { numero: number; centroCodigo: string; justificativa: string }, usuarioId: string) {
  await this.db.transaction(async (tx) => {
    const { atual } = await this.travar(tx, codigo, dto.numero);
    if (atual.situacao === 'SUSPENDED') throw new RegraContabilException('conta desativada');
    if (atual.classificacao !== 'analitica') {
      throw new RegraContabilException('Conta sintética não recebe mapeamento de lançamentos');
    }
    if (atual.situacao !== 'APPROVED') throw new RegraContabilException('Conta ainda não aprovada');
    const centro = await this.centroAtivo(tx, dto.centroCodigo);
    if (centro.id !== atual.centroCustoId) {
      throw new RegraContabilException('mudança de classificação após fechamento');
    }
    await this.auditoria.registrar(tx, {
      tabela: 'conta_versoes', registroId: atual.id, operacao: 'ACAO_MANUAL',
      modulo: 'contabilidade.plano', usuarioId, dadosAnteriores: atual, dadosNovos: atual,
      justificativa: dto.justificativa,
    });
  });
  this.eventEmitter.emit(EVENTOS.PLANO_CONTA_MAPEADA, { codigo, acao: 'mapear', situacao: 'APPROVED' });
  return this.obter(codigo);
}

async lote(dto: { acao: 'revisar-competencia' | 'aprovar' | 'bloquear'; codigos: string[]; justificativa: string; numeroPorCodigo: Record<string, number> }, usuarioId: string) {
  return this.db.transaction(async (tx) => {
    const saida = [];
    for (const codigo of dto.codigos) {
      const numero = dto.numeroPorCodigo[codigo];
      if (dto.acao === 'bloquear') saida.push(await this.bloquearNaTx(tx, codigo, numero, dto.justificativa, usuarioId));
      if (dto.acao === 'aprovar') saida.push(await this.aprovarNaTx(tx, codigo, numero, dto.justificativa, usuarioId));
      if (dto.acao === 'revisar-competencia') {
        saida.push(await this.revisarNaTx(tx, codigo, numero, dto.justificativa, usuarioId));
      }
    }
    return saida;
  });
}
```

`bloquear` grava `SUSPENDED` dentro da transação (`bloquearNaTx`). Segunda chamada: `ConflictException` 409 com mensagem `conta desativada`. `revisarNaTx` e `aprovarNaTx` seguem a tabela D4. `lote` usa a mesma `tx`: a primeira falha desfaz o lote e devolve 422 ou 409 da primeira conta, com o código de negócio no campo `codigo` (D6).

O teste do ciclo: criar `1` sintética aprovada, `1.1` analítica aprovada filha de `1`, `versionar` a conta `1` com `contaPaiCodigo: '1.1'` e esperar 422 `Ciclo na hierarquia da conta` com a versão `1` ainda em `numero` 1. `ciclo` sobe `conta_pai_id` e devolve verdadeiro se alcançar a própria conta.

`validar` executa as mesmas checagens e devolve `{ valido, mensagens }` sem `insert` nem `update`.

`historico` lê `auditoria` do `registro_id` das versões da conta e devolve apenas `quando`, `quem`, `acontecimento`, `justificativa`.

Em `eventos.ts`:

```ts
PLANO_CONTA_CRIADA: 'plano_conta_criada',
PLANO_CONTA_VERSIONADA: 'plano_conta_versionada',
PLANO_CONTA_REVISADA: 'plano_conta_revisada',
PLANO_CONTA_APROVADA: 'plano_conta_aprovada',
PLANO_CONTA_BLOQUEADA: 'plano_conta_bloqueada',
PLANO_CONTA_MAPEADA: 'plano_conta_mapeada',
CENTRO_CUSTO_CRIADO: 'centro_custo_criado',
```

Em `realtime.gateway.ts`, `podeAssinar` passa a receber a room:

```ts
private podeAssinar(ws: AuthSocket, room: string): boolean {
  if (room === 'contabilidade-plano') {
    return ws.user?.permissoes?.includes(PERMISSOES.CONTABILIDADE_PLANO_LER) ?? false;
  }
  return ws.user?.permissoes?.includes(PERMISSOES.DISPONIBILIDADE_LER) ?? false;
}
```

O `subscribe` (`realtime.gateway.ts` L141) chama `podeAssinar(ws, msg.room)`. Cada handler `@OnEvent` usa a assinatura real de `realtime.hub.ts` L37, `broadcast(room, type, payload)`, e não o `broadcast` privado que exige `dataOperacao` (L426–L429):

```ts
type PlanoContaPayload = { codigo: string; acao: string; situacao: string };

@OnEvent(EVENTOS.PLANO_CONTA_CRIADA)
handlePlanoContaCriada(payload: PlanoContaPayload): void {
  this.hub.broadcast('contabilidade-plano', EVENTOS.PLANO_CONTA_CRIADA, payload);
}

@OnEvent(EVENTOS.PLANO_CONTA_VERSIONADA)
handlePlanoContaVersionada(payload: PlanoContaPayload): void {
  this.hub.broadcast('contabilidade-plano', EVENTOS.PLANO_CONTA_VERSIONADA, payload);
}

@OnEvent(EVENTOS.PLANO_CONTA_REVISADA)
handlePlanoContaRevisada(payload: PlanoContaPayload): void {
  this.hub.broadcast('contabilidade-plano', EVENTOS.PLANO_CONTA_REVISADA, payload);
}

@OnEvent(EVENTOS.PLANO_CONTA_APROVADA)
handlePlanoContaAprovada(payload: PlanoContaPayload): void {
  this.hub.broadcast('contabilidade-plano', EVENTOS.PLANO_CONTA_APROVADA, payload);
}

@OnEvent(EVENTOS.PLANO_CONTA_BLOQUEADA)
handlePlanoContaBloqueada(payload: PlanoContaPayload): void {
  this.hub.broadcast('contabilidade-plano', EVENTOS.PLANO_CONTA_BLOQUEADA, payload);
}

@OnEvent(EVENTOS.PLANO_CONTA_MAPEADA)
handlePlanoContaMapeada(payload: PlanoContaPayload): void {
  this.hub.broadcast('contabilidade-plano', EVENTOS.PLANO_CONTA_MAPEADA, payload);
}

@OnEvent(EVENTOS.CENTRO_CUSTO_CRIADO)
handleCentroCustoCriado(payload: PlanoContaPayload): void {
  this.hub.broadcast('contabilidade-plano', EVENTOS.CENTRO_CUSTO_CRIADO, payload);
}
```

Quem tem só `CONTABILIDADE_PLANO_LER` não entra em room de operação.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/integration/plano-contas.e2e-spec.ts --runInBand` em `app/backend`.

Expected: PASS. O teste de sintética continua sem a relação `lancamentos_contabeis`.

- [ ] **Step 5: Commit**

```powershell
git add app/backend/src/modules/contabilidade/plano app/backend/src/realtime/events/eventos.ts app/backend/src/realtime/realtime.gateway.ts app/backend/test/integration/plano-contas.e2e-spec.ts
git commit -m @"
feat(contabilidade): versiona, aprova, bloqueia e mapeia contas

### Descrição Detalhada:
Fecha as transições do plano de contas com auditoria e evento pós-commit, sem gravar partida.

### Motivo da Mudança:
Conta suspensa e versão aprovada não podem mudar de classificação nem receber mapeamento indevido.

### Impacto:
A room contabilidade-plano exige a permissão nova. As rooms de operação continuam exigindo disponibilidade.
"@
```

## Task 5: HTTP e BFF

**Files:**
- Create: `app/backend/src/modules/contabilidade/plano/plano.controller.ts`
- Create: `app/frontend/src/app/api/contabilidade/plano/route.ts`
- Create: `app/frontend/src/app/api/contabilidade/plano/exportar/route.ts`
- Create: `app/frontend/src/app/api/contabilidade/plano/lote/route.ts`
- Create: `app/frontend/src/app/api/contabilidade/plano/validar/route.ts`
- Create: `app/frontend/src/app/api/contabilidade/plano/[codigo]/[acao]/route.ts`
- Create: `app/frontend/src/app/api/contabilidade/centros-custo/route.ts`
- Test: `plano-contas.e2e-spec.ts`

**Interfaces:**
- Consumes: métodos da Task 4 e `repassar` de `app/frontend/src/lib/bff.ts`.
- Produces: rotas HTTP abaixo. Resposta pública só com `apresentar`.

- [ ] **Step 1: Write the failing test**

```ts
it('nega o plano a um perfil que não é administrador', async () => {
  const res = await request(srv()).get('/contabilidade/plano').set('Cookie', comercialCookies);
  expect(res.status).toBe(403);
});

it('não devolve uuid na listagem', async () => {
  const res = await request(srv()).get('/contabilidade/plano').set('Cookie', adminCookies);
  expect(res.status).toBe(200);
  expect(JSON.stringify(res.body)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/integration/plano-contas.e2e-spec.ts -t "não é administrador|não devolve uuid" --runInBand` em `app/backend`.

Expected: FAIL 404.

- [ ] **Step 3: Write minimal implementation**

Em `plano.dto.ts`:

```ts
export const editarSchema = criarContaSchema.omit({ codigo: true }).extend({
  numero: z.number().int().positive(),
});

export const revisarSchema = z.object({
  numero: z.number().int().positive(),
  vigenciaInicio: dataIso,
  vigenciaFim: dataIso.nullable(),
  justificativa: motivo,
});

export const decidirSchema = z.object({
  numero: z.number().int().positive(),
  justificativa: motivo,
});

export const mapearSchema = z.object({
  numero: z.number().int().positive(),
  centroCodigo: codigo,
  justificativa: motivo,
});

export const acaoSchema = {
  editar: editarSchema,
  versionar: editarSchema,
  'revisar-competencia': revisarSchema,
  aprovar: decidirSchema,
  bloquear: decidirSchema,
  mapear: mapearSchema,
} as const;

export const loteSchema = z.object({
  acao: z.enum(['revisar-competencia', 'aprovar', 'bloquear']),
  codigos: z.array(codigo).min(1).max(20),
  justificativa: motivo,
  numeroPorCodigo: z.record(z.string(), z.number().int().positive()),
});
```

```ts
@SkipThrottle()
@Controller('contabilidade')
@UseGuards(JwtAuthGuard, RbacGuard)
export class PlanoContasController {
  constructor(private readonly plano: PlanoContasService) {}

  @Get('plano')
  @RequirePermissoes('CONTABILIDADE_PLANO_LER')
  listar(@Query(new ZodValidationPipe(listarPlanoSchema)) query: ListarPlanoQuery) {
    return this.plano.listar(query);
  }

  @Get('plano/exportar')
  @RequirePermissoes('CONTABILIDADE_PLANO_LER')
  exportar(@Query(new ZodValidationPipe(listarPlanoSchema)) query: ListarPlanoQuery) {
    return this.plano.exportarCsv(query);
  }

  @Get('centros-custo')
  @RequirePermissoes('CONTABILIDADE_PLANO_LER')
  centros() {
    return this.plano.listarCentrosAtivos();
  }

  @Post('centros-custo')
  @RequirePermissoes('CONTABILIDADE_PLANO_GERENCIAR')
  criarCentro(@Body(new ZodValidationPipe(criarCentroSchema)) dto: CriarCentroDto, @CurrentUser() user: CurrentUserPayload) {
    return this.plano.criarCentro(dto, user.sub);
  }

  @Post('plano')
  @RequirePermissoes('CONTABILIDADE_PLANO_GERENCIAR')
  criar(@Body(new ZodValidationPipe(criarContaSchema)) dto: CriarContaDto, @CurrentUser() user: CurrentUserPayload) {
    return this.plano.criar(dto, user.sub);
  }

  @Post('plano/validar')
  @RequirePermissoes('CONTABILIDADE_PLANO_LER')
  validar(@Body(new ZodValidationPipe(criarContaSchema)) dto: CriarContaDto, @CurrentUser() user: CurrentUserPayload) {
    return this.plano.validar(dto, user.sub);
  }

  @Post('plano/lote')
  @RequirePermissoes('CONTABILIDADE_PLANO_GERENCIAR')
  lote(@Body(new ZodValidationPipe(loteSchema)) dto: LoteDto, @CurrentUser() user: CurrentUserPayload) {
    return this.plano.lote(dto, user.sub);
  }

  @Get('plano/:codigo/historico')
  @RequirePermissoes('CONTABILIDADE_PLANO_LER')
  historico(@Param('codigo') codigo: string) {
    return this.plano.historico(codigo);
  }

  @Post('plano/:codigo/:acao')
  @RequirePermissoes('CONTABILIDADE_PLANO_GERENCIAR')
  acao(
    @Param('codigo') codigo: string,
    @Param('acao') acao: keyof typeof acaoSchema,
    @Body() corpo: unknown,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const schema = acaoSchema[acao];
    if (!schema) throw new NotFoundException();
    return this.plano.executar(acao, codigo, schema.parse(corpo), user.sub);
  }
}
```

`exportarCsv` responde `text/csv; charset=utf-8` com BOM `\uFEFF` e cabeçalho `Conta contábil;Situação;Natureza da conta;Centro de custo;Início de vigência;Fim de vigência`. Células são rótulos. Sem coluna de id.

Cada route do BFF:

```ts
import { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

export async function GET(req: NextRequest) {
  return repassar(`/contabilidade/plano${req.nextUrl.search}`);
}

export async function POST(req: NextRequest) {
  return repassar('/contabilidade/plano', { method: 'POST', body: await req.text() });
}
```

A rota `[codigo]/[acao]` repassa `POST /contabilidade/plano/${codigo}/${acao}`. `centros-custo`, `exportar`, `lote` e `validar` seguem o mesmo `repassar`. A ação fora da união responde 404 no service com `NotFoundException`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/integration/plano-contas.e2e-spec.ts --runInBand` em `app/backend`.

Expected: PASS. Comercial recebe 403. O JSON do administrador não contém UUID.

- [ ] **Step 5: Commit**

```powershell
git add app/backend/src/modules/contabilidade/plano/plano.controller.ts app/frontend/src/app/api/contabilidade app/backend/test/integration/plano-contas.e2e-spec.ts
git commit -m @"
feat(contabilidade): publica o plano de contas no BFF

### Descrição Detalhada:
Expõe a listagem, as ações e o CSV pelo Nest e pelo BFF, sem identificador interno no JSON.

### Motivo da Mudança:
A tela não pode receber UUID, e os demais perfis não podem chamar a API.

### Impacto:
Perfil comercial recebe 403. O administrador recebe códigos de negócio e rótulos.
"@
```

## Task 6: Tela

**Files:**
- Create: `app/frontend/src/app/(admin)/erp/contabilidade/plano-de-contas/page.tsx`
- Create: `app/frontend/src/app/(admin)/erp/contabilidade/plano-de-contas/plano-contas-client.tsx`
- Create: `app/frontend/__tests__/plano-contas-apresentacao.test.ts`

**Interfaces:**
- Consumes: BFF da Task 5, `BadgeProvisorio`, tokens DS v3 já usados nas telas `(admin)`.
- Produces: a página `/erp/contabilidade/plano-de-contas`.

- [ ] **Step 1: Write the failing test**

```ts
import { render, screen } from '@testing-library/react';
import { PlanoContasClient } from '../src/app/(admin)/erp/contabilidade/plano-de-contas/plano-contas-client';

it('mostra os rótulos da grade e esconde uuid e a palavra Marca', () => {
  render(<PlanoContasClient inicial={[{
    codigo: '1.1.01',
    nome: 'Caixa e bancos',
    situacaoRotulo: 'Aprovado',
    naturezaRotulo: 'Ativo',
    centroNome: 'Operação industrial',
    vigenciaInicio: '2026-10-01',
    vigenciaFim: null,
    classificacaoRotulo: 'analítica',
    grupo: 'Circulante',
    contaPaiCodigo: '1',
    centroCodigo: 'CT1',
    situacao: 'APPROVED',
    natureza: 'ATIVO',
    classificacao: 'analitica',
    numero: 1,
    responsavelNome: 'Administrador',
    criadoEm: '2026-10-15T10:00:00.000Z',
    alteradoEm: '2026-10-15T10:00:00.000Z',
  }]} />);
  for (const rotulo of ['Conta contábil', 'Situação', 'Natureza da conta', 'Centro de custo', 'Início de vigência', 'Fim de vigência']) {
    expect(screen.getByRole('columnheader', { name: new RegExp(rotulo) })).toBeInTheDocument();
  }
  expect(screen.getByText('Provisório')).toBeInTheDocument();
  const texto = document.body.textContent ?? '';
  expect(texto).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  expect(texto).not.toMatch(/Marca/);
  expect(texto).not.toMatch(/E09/);
  expect(texto).not.toMatch(/e09-t01/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/plano-contas-apresentacao.test.ts --runInBand` em `app/frontend`.

Expected: FAIL com módulo ausente.

- [ ] **Step 3: Write minimal implementation**

`page.tsx` é server component que lê a primeira página em `/api/contabilidade/plano` e renderiza `PlanoContasClient`. Sem cookie de sessão, o BFF já redireciona pelo fluxo `(admin)` existente.

O client implementa D2, D4 e D6. A chave `e09-t01-plano` só entra em `sessionStorage.getItem` / `setItem`; nenhum texto do JSX a contém.

```tsx
const CHAVE_RASCUNHO = 'e09-t01-plano';
const ABAS = ['Ficha e campos', 'Movimentações', 'Regras e validações', 'Exceções', 'Histórico', 'Integrações', 'Aceite e testes'] as const;
const EXCECOES = ['Conta desativada', 'Mudança de classificação após fechamento'];

export function PlanoContasClient({ inicial }: { inicial: ContaApresentada[] }) {
  const selecionada = inicial[0];
  const [aba, setAba] = useState<(typeof ABAS)[number]>('Ficha e campos');
  const [processo, setProcesso] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [modal, setModal] = useState<null | 'bloquear' | 'mapear' | 'versionar' | 'aprovar' | 'revisar-competencia'>(null);
  const [motivo, setMotivo] = useState('');
  const [aviso, setAviso] = useState('');
  const colunas = ['Conta contábil', 'Situação', 'Natureza da conta', 'Centro de custo', 'Início de vigência', 'Fim de vigência'];

  useEffect(() => {
    const gravado = sessionStorage.getItem(CHAVE_RASCUNHO);
    if (gravado === null) sessionStorage.setItem(CHAVE_RASCUNHO, '{}');
  }, []);

  async function confirmar() {
    if (!selecionada) return;
    if (!motivo.trim()) {
      setAviso('Informe justificativa para demonstrar a decisão auditável.');
      return;
    }
    if (!modal) return;
    const resposta = await fetch(`/api/contabilidade/plano/${selecionada.codigo}/${modal}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero: selecionada.numero, justificativa: motivo, centroCodigo: selecionada.centroCodigo }),
    });
    if (resposta.status === 403) return setAviso('Acesso não permitido');
    if (resposta.status === 409) return setAviso('conflito concorrente');
    if (!resposta.ok) {
      const corpo = await resposta.json() as { message?: string };
      return setAviso(corpo.message ?? '');
    }
    if (modal === 'aprovar') setAviso('concluído com evidência');
    setModal(null);
  }

  return (
    <>
      <h1>Plano de contas e centros de custo</h1>
      <p>Acesso típico: contador/controladoria <BadgeProvisorio texto="Provisório" /></p>
      <button type="button">Exportar</button>
      <button type="button">+ Novo registro</button>
      <button type="button" onClick={() => setProcesso(true)}>Ações do processo</button>
      <div>
        <button type="button" onClick={() => setDrawer(true)}>Criar</button>
        <button type="button" onClick={() => setModal('versionar')}>Versionar</button>
        <button type="button" onClick={() => setModal('aprovar')}>Aprovar</button>
        <button type="button" onClick={() => setModal('bloquear')}>Bloquear conta e mapear lançamentos</button>
        <button type="button" onClick={() => setModal('revisar-competencia')}>Revisar competência</button>
      </div>
      <table>
        <thead>
          <tr>
            {colunas.map((rotulo) => (
              <th key={rotulo}><button type="button" aria-label={`Ordenar por ${rotulo}`}>{rotulo}</button></th>
            ))}
          </tr>
        </thead>
      </table>
      <div role="tablist">
        {ABAS.map((nome) => (
          <button key={nome} type="button" role="tab" onClick={() => setAba(nome)}>{nome}</button>
        ))}
      </div>
      {aba === 'Exceções' && EXCECOES.map((texto) => (
        <p key={texto}><b>Bloqueio / exceção:</b> {texto}.</p>
      ))}
      {processo && (
        <button type="button" onClick={() => { setProcesso(false); setModal('mapear'); }}>Abrir decisão →</button>
      )}
      {drawer ? <p><label htmlFor="review-justification">Motivo da alteração</label></p> : null}
      {modal && (
        <dialog open aria-modal="true">
          <label htmlFor="action-reason">Justificativa / observação</label>
          <textarea id="action-reason" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <button type="button" onClick={() => setModal(null)}>Cancelar</button>
          <button type="button" onClick={confirmar}>Confirmar</button>
          {aviso ? <p>{aviso}</p> : null}
        </dialog>
      )}
    </>
  );
}
```

O botão da faixa `Bloquear conta e mapear lançamentos` abre o modal e o `Confirmar` faz `POST .../bloquear` (D4). O `Abrir decisão →` do drawer `Ações do processo` abre o mesmo modal e o `Confirmar` faz `POST .../mapear`. Não há botão `Bloquear conta` nem `Mapear lançamentos`.

Abas com `role="tablist"` e `role="tab"`. Grade com `aria-label="Ordenar por {rótulo}"` no botão de cada coluna ordenável. Busca com `aria-label="Buscar registros da lista"`. Filtro com `aria-label="Filtrar situação"` e opções `Todos`, `Rascunho`, `Aguardando revisão`, `Aprovado`, `Rejeitado`, `Suspenso`.

Datas na grade em `dd/MM/yyyy` (`pt-BR`). Fim nulo mostra `—`.

Drawer `Dados principais` com os controles de D2. O rótulo do textarea do drawer é `Motivo da alteração` (`aplicacao.js` L436), não o do modal. Lookup de centro: botão `Pesquisar`. Se a lista vier vazia, toast `Nenhum cadastro disponível para seleção. Consulte a área responsável.` (`aplicacao.js` L487) e o mesmo drawer oferece `Código` + `Centro de custo` + `Motivo da alteração` e o botão `+ Novo registro` que chama `POST /api/contabilidade/centros-custo`.

`Criar` no drawer chama `POST /api/contabilidade/plano`. `Editar versão` chama `POST /api/contabilidade/plano/{codigo}/editar`. O botão do protótipo `Salvar rascunho ilustrativo` não é copiado. `Verificar dados` chama `POST /api/contabilidade/plano/validar`.

Ficha: `Editar versão`, `Validar pré-condições`, `Consultar histórico`.

403 renderiza o estado `sem acesso` com o texto `Acesso não permitido`. 409 mostra `conflito concorrente`. 422 mostra `message` do backend, inclusive `conta desativada` e `mudança de classificação após fechamento` em minúsculas (Caderno B L440). Depois de aprovar, toast `concluído com evidência`.

Mobile (`max-width: 800px`): cada linha da grade vira um cartão com os seis rótulos e os valores. Os botões de ação permanecem visíveis. Nenhum cartão mostra UUID (`componentes.js` L5908).

Não usar a palavra `Marca`. Não renderizar `E09`, `E09-T01` nem a chave `e09-t01-plano`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/plano-contas-apresentacao.test.ts __tests__/menu-v2.test.ts --runInBand` em `app/frontend`.

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add app/frontend/src/app/(admin)/erp/contabilidade app/frontend/__tests__/plano-contas-apresentacao.test.ts
git commit -m @"
feat(contabilidade): monta a tela do plano de contas

### Descrição Detalhada:
Reproduz grade, abas, ações e formulário com os rótulos do protótipo e o selo Provisório.

### Motivo da Mudança:
A persona contador/controladoria não é perfil canônico, e a tela não pode exibir UUID.

### Impacto:
O administrador passa a abrir /erp/contabilidade/plano-de-contas. Nenhuma outra rota operacional muda de rótulo.
"@
```

## Task 7: Playwright da jornada

**Files:**
- Create: `app/frontend/e2e/e09-t01-plano-contas.spec.ts`

**Interfaces:**
- Consumes: a tela da Task 6 e a API da Task 5. Login igual a `app/frontend/e2e/onda3-cadastros-admin.spec.ts` L22–L25 (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).
- Produces: evidência E2E da jornada criar → revisar → aprovar → bloquear → mapear recusado.

- [ ] **Step 1: Write the failing test**

```ts
test('administrador cria conta analítica, bloqueia e vê a conta desativada', async () => {
  const page = await adminContext.newPage();
  await page.goto('/erp/contabilidade/plano-de-contas');
  await expect(page).toHaveURL(/\/erp\/contabilidade\/plano-de-contas$/);
  await expect(page).not.toHaveURL(/e\d{2}-t\d{2}/i);
  await expect(page.getByRole('heading', { name: 'Plano de contas e centros de custo' })).toBeVisible();
  await expect(page.getByText('Provisório')).toBeVisible();
  await page.getByRole('button', { name: '+ Novo registro' }).click();
  await page.getByLabel('Código').fill('CT-E2E');
  await page.getByLabel('Centro de custo').fill('Operação industrial');
  await page.getByLabel('Motivo da alteração').fill('centro da jornada');
  await page.getByRole('button', { name: '+ Novo registro' }).nth(1).click();
  await criarConta(page, { codigo: '1', nome: 'Grupo do ativo', classificacao: 'sintética', pai: null });
  await revisarEAprovar(page);
  await page.getByRole('cell', { name: 'Grupo do ativo' }).click();
  await criarConta(page, { codigo: '1.1.01', nome: 'Caixa e bancos', classificacao: 'analítica', pai: '1' });
  await revisarEAprovar(page);
  await expect(page.getByRole('cell', { name: 'Caixa e bancos' })).toBeVisible();
  await expect(page.getByText(/[0-9a-f]{8}-[0-9a-f]{4}-7/i)).toHaveCount(0);
  await page.getByRole('button', { name: 'Bloquear conta e mapear lançamentos' }).click();
  await page.getByLabel('Justificativa / observação').fill('bloqueia a conta');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await page.getByRole('button', { name: /Ações do processo/ }).click();
  await page.getByRole('button', { name: 'Abrir decisão →' }).click();
  await page.getByLabel('Justificativa / observação').fill('tenta mapear');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('conta desativada')).toBeVisible();
  await page.getByRole('tab', { name: 'Regras e validações' }).click();
  await expect(page.getByText('partida dobrada, níveis hierárquicos válidos, competência obrigatória')).toBeVisible();
  await page.getByRole('tab', { name: 'Exceções' }).click();
  await expect(page.getByText('Conta desativada')).toBeVisible();
  await expect(page.getByText('Mudança de classificação após fechamento')).toBeVisible();
  await page.close();
});
```

`beforeAll` copia o login de `app/frontend/e2e/onda3-cadastros-admin.spec.ts` L47–L67: `browser.newContext`, `POST /api/auth/login` com `ADMIN_EMAIL` e `ADMIN_PASSWORD`, e `addCookies` dos `set-cookie`. `afterAll` fecha o contexto.

```ts
async function criarConta(
  page: Page,
  dados: { codigo: string; nome: string; classificacao: 'sintética' | 'analítica'; pai: string | null },
) {
  await page.getByRole('button', { name: '+ Novo registro' }).first().click();
  await page.getByLabel('Código').last().fill(dados.codigo);
  await page.getByPlaceholder('Informe conta contábil').fill(dados.nome);
  await page.getByLabel('Conta sintética/analítica').selectOption({ label: dados.classificacao });
  await page.getByLabel('Natureza da conta').selectOption({ label: 'Ativo' });
  await page.getByLabel('Grupo').fill('Circulante');
  if (dados.pai) await page.getByPlaceholder('Selecione conta contábil').selectOption({ label: 'Grupo do ativo' });
  await page.getByLabel('Centro de custo').last().selectOption({ label: 'Operação industrial' });
  await page.getByLabel('Início de vigência').fill('2026-10-01');
  await page.getByLabel('Motivo da alteração').last().fill('abre a conta');
  await page.getByRole('button', { name: 'Criar' }).click();
}

async function revisarEAprovar(page: Page) {
  await page.getByRole('button', { name: 'Revisar competência' }).click();
  await page.getByLabel('Justificativa / observação').last().fill('revisa a competência');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await page.getByRole('button', { name: 'Aprovar' }).click();
  await page.getByLabel('Justificativa / observação').last().fill('aprova a conta');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('Aprovado')).toBeVisible();
}
```

O combo de pai mostra o nome `Grupo do ativo` e guarda o código `1` no value. Depois de `Criar`, a linha nova fica selecionada. Um segundo teste cria só a sintética `1`, aprova, abre `Ações do processo` e clica `Abrir decisão →` (o verbo `mapear`, D4). A mensagem visível é `Conta sintética não recebe mapeamento de lançamentos`. A aba `Exceções` mostra `Conta desativada` e `Mudança de classificação após fechamento`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/e09-t01-plano-contas.spec.ts` em `app/frontend`, com o backend e o frontend de teste já usados pelos outros specs.

Expected: FAIL até a jornada existir por completo. Se as tasks 1–6 já passaram, este step falha só se um rótulo divergir; nesse caso corrigir a tela, não o rótulo da fonte.

- [ ] **Step 3: Write minimal implementation**

O spec acima é a implementação desta task. Ajustar só seletores instáveis (dialog `Confirmar`) para o componente realmente renderizado na Task 6, sem trocar rótulos.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/e09-t01-plano-contas.spec.ts` em `app/frontend`.

Expected: PASS. Em seguida, no `app/backend`: `npm run test:cov` continua com linha e branch ≥ 80%. No `app/frontend`: `npm test` e `npm run lint` dos arquivos novos passam.

- [ ] **Step 5: Commit**

```powershell
git add app/frontend/e2e/e09-t01-plano-contas.spec.ts
git commit -m @"
test(contabilidade): cobre a jornada do plano de contas

### Descrição Detalhada:
Exercita criar, revisar, aprovar, bloquear e a recusa de mapeamento da conta suspensa.

### Motivo da Mudança:
O aceite da fatia exige a jornada na tela, não só o serviço.

### Impacto:
O spec usa o administrador semeado. Não chama SEFAZ, banco nem EISS.
"@
```

## Correções da revisão crítica (r3)

**Classe de risco desta seção: ALTO** (AD-22 item 6). O delta altera regra de transição de conta contábil, descarte auditado de versão, validação de entrada HTTP, exportação CSV, uma leitura nova de opções de conta pai e (condicionalmente) migration. Rito: revisão crítica por commit, Portão 2 e Portão A. A seção não cria permissão, perfil, menu nem tabela; a única migration é a renumeração condicional da Task 18. A Task 17 lê com a permissão `CONTABILIDADE_PLANO_LER`, que já existe.

**Origem.** Revisão crítica preliminar independente de 2026-10-15 sobre o código implementado até `93599bb` (achados B1 a B4; menores M1, M2, M3, M5, M6) e AD-25 item 3 (`docs/execucao/DECISOES.md`). A Task 13 cobre também um achado do planner (A1: `lote` devolve linhas cruas com UUID). As linhas citadas são as do código lido na revisão e deslocam a cada task.

**Ordem.** As Tasks 8 a 17 são independentes, com três exceções: a Task 10 usa `ultimaVersaoDecidida` criada na Task 9, o `it` de rótulos da Task 12 exige o descarte da Task 11, e a Task 17 usa `vigencia.ts` e o helper `contaComV2Suspensa` da Task 9. A Task 18 é sempre a última e só roda quando o coordenador indicar. Um commit por task; cada teste novo falha antes e passa depois, salvo os `it` marcados "guarda", que passam antes e depois e travam a regra contra correção excessiva.

**Convenções dos testes.** Todos entram em `app/backend/test/integration/plano-contas.e2e-spec.ts`, dentro do `describe` existente (que limpa as três tabelas no `beforeEach`, L54 a L58), salvo onde a task disser outro arquivo. Reutilizar `dtoBase`, `promover`, `comoEdicao`, `contaAprovadaSintetica`, `contaAprovadaAnalitica` e `contarVersoes` do arquivo. Chamada HTTP: `request(srv()).post(url).set('Cookie', adminCookies).send(corpo)`. O `AllExceptionsFilter` responde `{ statusCode, message: <corpo da exceção>, ... }`, então a mensagem de regra está em `res.body.message.message`. Comando de teste do backend, sempre em `app/backend`: `npx jest test/integration/plano-contas.e2e-spec.ts --runInBand`.

### Mapa achado, task e teste (DoD 1:1)

| Achado | Task | `it` que falha antes e passa depois |
|---|---|---|
| B3 `ZodError` vira 500, data inexistente, `constructor`/`toString` | 8 | `entrada HTTP inválida` (it.each de 9 entradas, 400), `ação herdada %s responde 404`, `lote com código herdado do protótipo responde 422 conflito`; unit `dataCalendarioValida`; `npx tsc --noEmit` sem TS2345 no controller |
| B2 conta suspensa segue vigente | 9 | `conta com v1 aprovada e v2 suspensa não é pai válido` |
| B1 ciclo pelo `editar` e na aprovação | 10 | `editar recusa ciclo e pai próprio sem gravar`, `aprovar revalida o ciclo...`, `duas aprovações cruzadas não fecham ciclo` |
| AD-25 item 3 bloquear encerra o rascunho | 11 | `bloquear com rascunho aberto descarta...`, `revisão aberta também é descartada...`, `falha da auditoria desfaz o descarte` |
| M5 mensagem do editar e histórico cru | 12 | `editar fora do rascunho recusa com transição inválida`, `histórico rotula e ordena...` |
| M3 lote sem evento, A1 UUID no lote | 13 | `lote emite o evento de cada conta só depois do commit`, `lote não devolve uuid` |
| M1 CSV paginado, M2 fórmula | 14 | `csv exporta a visão inteira...`, `csv neutraliza célula que começa como fórmula` |
| M6 centro sem lock | 15 | `dez criações simultâneas do mesmo centro...` |
| B4 `limparPlano` fixo e destrutivo | 16 | jest `e09-t01-limpar-plano.test.ts` |
| P-r3-2 (Portão 1 r3, bloqueante) combo de conta pai limitado à página e ao filtro da grade | 17 | no e2e do backend, `describe` `opções de conta pai`: `pai fora da página 1 da grade aparece e a criação com ele funciona`, `o filtro e a busca da grade não reduzem as opções`, `pai aprovado com v2 em rascunho aparece...`, `pai com v1 aprovada e v2 suspensa não aparece`, `só entram sintéticas... igual a ultimaVersaoDecidida`, `busca por código ou nome...`, `passando do teto responde truncado...`, `exige a permissão de leitura e não devolve identificador` (403, 401); jest `plano-contas-opcoes-pai.test.tsx` (4 `it`) e `bff-plano-opcoes-pai.test.ts` |
| Renumeração 0048 para 0049 e conflitos do merge com a E01 | 18 | jest `e09-t01-migration-meta.spec.ts` (4 `it`, incluindo o `--> statement-breakpoint` antes de cada trigger) e os testes de menu e RBAC recontados (11 grupos, 45 rotas, 132 pares) |

### Portão 1 r3 e correção (r4)

Veredito: `ajustar`, 1 bloqueante e 8 menores, sobre o plano r3 (`143aec2`, blob `d851f10…`). Cada item abaixo tem a correção e o ponto do plano onde ela está.

| Item do veredito | Correção r4 |
|---|---|
| 1 (bloqueante) P-r3-2, combo de conta pai montado de `contas` (`plano-contas-client.tsx` L632) | Task 17: `GET /contabilidade/plano/opcoes-pai` (`CONTABILIDADE_PLANO_LER`), rota BFF e carga ao abrir o drawer e ao buscar. P-r3-2 sai das pendências |
| 2 Task 8, `ZodValidationPipe.transform` devolve `unknown` (`zod-validation.pipe.ts` L9) e `executar` não compila (TS2345) | Task 8: o `dto` recebe cast para `Parameters<PlanoContasService['executar']>[2]`, sem `any`; o Step 4 roda `npx tsc --noEmit` |
| 3 Task 17 (agora 18), `DATABASE_URL` apontava para o banco descartado | Task 18 Steps 3 e 4: `try/finally` repõe a variável; o banco da fatia é recriado e migrado só se o nome casar com `_(e2e\|test\|eNN_tNN)` (sufixo da Task 16), senão para |
| 4 `Substring` descartava o `--> statement-breakpoint` antes do primeiro trigger | Task 18 Step 3: o bloco começa na linha `--> statement-breakpoint` (original L54) e um `it` conta 3 triggers precedidos por ela |
| 5 conflitos semânticos do merge com a E01 | Task 18, tabela "Conflitos previstos no merge com a trilha E01": arquivos nomeados, números lidos em `e01-t05` e nesta branch (11 grupos, 45 rotas, 132 pares), regra de recomputo e critério de parada (a) a (f) |
| 6 rollback com `reset --hard` | Rollback do delta e Task 18 unificados: `git merge --abort` antes do commit do merge, `git revert -m 1` depois; sem `reset --hard` em lugar nenhum |
| 7 coerência com a E09-T02 | Decisões do delta, "Consulta compartilhável e coerência com a E09-T02" |
| 8 P-r3-1 | Pendência não bloqueante mantida, com a nota do Linear; nenhuma task afirma tempo real na tela |
| 9 Task 14 Step 2 | Expected corrigido: 10 linhas, não 21 |

### Portão 1 r4 e correção (r5)

Veredito: `ajustar`, 1 bloqueante e 4 menores, sobre o plano r4 (`589ae72`, blob `887ebc1…`). Delta restrito à Task 17 (client, testes Jest e Playwright) e à Task 18 (recontagem). Backend, teto de 50, BFF, DTO e a regra das opções não mudam.

| Item do veredito | Correção r5 | Task e teste |
|---|---|---|
| BLOQUEANTE: o input permanente `Buscar conta contábil` não existe no protótipo (Princípio I) | Input e rótulo removidos. O campo `Conta contábil` é o `select` com o botão `Pesquisar` (`aplicacao.js` L412), que abre o popup `lookup-card` com o input `Pesquisar cadastro` (L490), alimentado por `GET opcoes-pai?q=`. Nenhum componente do frontend implementa esse padrão (o `ComboboxField` é outro padrão e foi descartado); o popup é escrito no próprio client | Task 17, itens 2 a 6 do client; Jest `plano-contas-opcoes-pai.test.tsx` (`abrir o drawer não consulta...`, `a busca dentro do popup...`, `escolher uma opção...`, `Fechar descarta...`); Playwright `criarConta` (item 8) |
| (a) `carregarPais` sem try/catch | Corpo todo em `try/catch`; erro mostrado no popup (`erroPais`) | Jest `rede caída é capturada...` (sem `unhandledRejection`) |
| (b) falha de pedido obsoleto chamava `setAviso` | Contador conferido em todos os ramos (`atual()`), inclusive resposta não ok e exceção; o erro vai para o popup, não para `setAviso` | Jest `falha de pedido obsoleto...` e `rede caída de pedido obsoleto...` |
| (c) `getByLabel('Conta contábil')` não exato nos e2e | Rótulos novos: só `Selecionar Conta contábil` (popup) e `Pesquisar cadastro`. Conferência explícita por `Select-String`; leitura atual: nenhum seletor não exato | Task 17 item 7 (Expected: nenhuma linha) |
| (d) Task 18 copiava números de menu | Os números do plano viram valores esperados a conferir contra contagem feita nos arquivos resolvidos (bloco "Recontagem" no Step 3) | Task 18, regra de recomputo e Step 3 |

### Decisões do delta

- **Vigência (B2).** O plano já fixa o pai como "uma versão `APPROVED`, não suspensa" (D3) e a Task 4 recusa pai suspenso. Regra aplicada: a versão vigente é a de maior `numero` entre as `APPROVED` e `SUSPENDED` não excluídas, e a conta só é vigente se ela for `APPROVED`. Aprovar versão nova supera a anterior (maior número decidido). `DRAFT`, `REVIEW` e `REJECTED` não decidem nada: revisão em aberto não derruba a versão aprovada. Difere da leitura literal "a versão mais recente da conta precisa ser `APPROVED`" só quando há rascunho aberto sobre uma aprovada; a leitura literal impediria criar filhas durante qualquer revisão, o que D3 não pede.
- **Mensagem do pai suspenso.** Review Focus 1 pede `conta desativada`. Pai sem nenhuma versão decidida mantém `Conta pai não está ativa` (teste existente L134 a L145).
- **Consulta compartilhável e coerência com a E09-T02.** `ultimaVersaoDecidida(executor: Pick<NodePgDatabase<typeof schema>, 'select'>, contaId: string)` devolve a linha de `conta_versoes` ou `null` e fica em `plano/vigencia.ts`, sem dependência de Nest. A assinatura é estável: nome, caminho, parâmetros e retorno não mudam sem novo Portão 1. Na branch da E09-T02 (`feature/erp-e09-t02-politicas-contabilizacao`, commit `24d30b7`, `plano.service.ts` L173 a L198) o método `listarContasAnaliticasVigentes` mora no arquivo da T01 e ainda não existe nesta branch. Ele escolhe, por conta, a versão `APPROVED` analítica mais recente e por isso mantém vigente uma conta com v1 aprovada e v2 `SUSPENDED`. A correção desse método é do plano da T02 r4, que passa a decidir a vigência com `ultimaVersaoDecidida` desta fatia (a conta só é vigente se a última decidida for `APPROVED`; o filtro de analítica e a janela de data continuam da T02). Esta fatia não toca arquivo da T02 (critério de parada 4). O merge T01 para T02 é do coordenador: `plano.service.ts` conflitará em `exportarCsv` (Task 14) e ao lado de `listarCentrosAtivos` (`listarOpcoesPai`, Task 17), e `vigencia.ts` entra inteiro pela T01.
- **Opções de conta pai (Task 17).** Lista própria, lida do backend quando o usuário abre o popup `Pesquisar` (padrão do protótipo, sem campo de busca permanente) e ao buscar nele, sem relação com a página nem com o filtro da grade. Regra: conta não excluída, última versão decidida `APPROVED` e `sintetica` (D3), a mesma que `exigirPaiVigente` aplica. A janela de data não entra porque o backend também não a aplica. Teto de 50 com `truncado` e busca `q` por código ou nome.
- **Bloqueio com rascunho (AD-25 item 3).** O token de concorrência continua sendo o maior `numero` não excluído (D4), que é o número que a grade mostra. Logo `bloquear` com o número da versão aberta é aceito e número desatualizado segue 409. "Rascunho aberto" cobre `DRAFT` e `REVIEW`, as duas situações que `versionar` chama de "Versão em aberto" (`plano.service.ts` L319 a L321): deixar `REVIEW` viva permitiria aprová-la depois do bloqueio e reativar a conta. Sem versão `APPROVED` imediatamente anterior à aberta, responde 422 `Situação não permite esta transição` e nada é descartado.
- **Estado do descarte.** O `chk_conta_versoes_situacao` (`contabilidade-plano.schema.ts` L63) não tem estado de descarte. Usa-se soft delete (`deleted_at`) na versão aberta, conforme `docs/data/convencoes-schema.md`, e auditoria `operacao = 'DELETE'` (permitida por `chk_auditoria_operacao`, `auditoria.schema.ts` L21) na mesma transação do bloqueio. Sem status novo e sem migration.
- **CSV.** A visão exportada é o filtro inteiro, sem paginação. Célula que começa por `=`, `+`, `-`, `@`, tab ou CR recebe o prefixo `'` (CSV injection).
- **B3 e o pipe.** `ZodValidationPipe` (`common/pipes/zod-validation.pipe.ts`) responde 400. A rota de ação instancia o pipe com o schema da ação depois de provar a ação com `Object.hasOwn`. A API desta fatia não tem campo de competência `AAAA-MM`: a competência é `vigenciaInicio` e `vigenciaFim` (`AAAA-MM-DD`); `2026-13-01` e `2026-02-31` são os casos do achado.

### Pendências registradas (sem task nesta seção)

- **P-r3-1, tempo real na tela (não bloqueante, aceita no Portão 1 r3 item 8).** A room `contabilidade-plano` tem emissores no backend (`realtime.gateway.ts` L430 a L463) e nenhum consumidor no frontend; os eventos pós-commit cumprem o Princípio VI e nenhuma tela ERP consome room hoje. As Tasks 5, 6, 7 e 17 não exigem nem afirmam atualização em tempo real da tela: `plano-contas-client.tsx` só recarrega após a própria ação e o Playwright não testa segunda sessão. A Task 13 garante apenas que o evento sai no lote. O coordenador abre a issue no Linear antes do Portão 2; o worker não a abre e não escreve texto de tela sobre tempo real.

A P-r3-2 (combo de conta pai) saiu desta lista: virou a Task 17.

### Critérios de parada do delta

Parar e devolver ao coordenador, sem commitar, se:

1. Um teste novo (não marcado "guarda") passar antes da correção: o teste não prova nada, reescrever.
2. Qualquer teste existente quebrar fora das asserções que este delta altera de propósito: `plano-contas.e2e-spec.ts` L364 a L365 (Task 12) e a forma do retorno de `lote` (Task 13).
3. A correção exigir migration (só a Task 18 tem) ou alterar `CHECK`.
4. O diff tocar arquivo fora da lista da task, `docs/execucao/` ou arquivo da E09-T02.
5. `npm run test:cov` em `app/backend` ficar abaixo de 80% em linhas ou ramos.
6. Na Task 18: o `drizzle-kit generate` emitir prefixo diferente de `0049`, ou o SQL gerado diferir do original além dos três `CREATE TRIGGER`.
7. Na Task 18: qualquer item (a) a (f) do critério de parada dos conflitos do merge (totais diferentes de 11 grupos, 45 rotas e 132 pares; `FISCAL` fora de ordem; outro perfil com a rota; `MENUS_OPERACIONAIS` diferente de 39; conflito fora da tabela ou que escolha entre duas regras; teste de RBAC, menu ou room falhando depois do recomputo).
8. Na Task 17: o `it` `pai fora da página 1 da grade aparece e a criação com ele funciona` passar antes da implementação, ou a resposta de `opcoes-pai` trazer campo além de `codigo` e `nome`.

### Rollback do delta

- Cada task é um commit: `git revert <sha-da-task>` (nunca `reset`, `reset --hard` nem force push). A Task 18 tem o rollback dela ao final: `git merge --abort` antes do commit do merge e `git revert -m 1 <sha-do-merge>` depois.
- As Tasks 8 a 17 não mudam esquema: reverter o código restaura o comportamento anterior sem passo de banco. Reverter a Task 17 remove o endpoint, a rota BFF e o popup `Pesquisar` da conta pai, e o combo volta a ser montado da grade (com o defeito P-r3-2).
- Task 11: versões descartadas permanecem com `deleted_at` preenchido depois do revert. Compensação manual, só com autorização do coordenador e conta a conta: `update conta_versoes set deleted_at = null where id = '<registro_id da auditoria DELETE>'`, depois de conferir que a conta segue `SUSPENDED` na versão anterior.
- Task 16: o `TRUNCATE ... CASCADE` roda só em banco de teste; reverter restaura a limpeza antiga.

---

## Task 8: Entrada HTTP inválida responde 400 ou 404, não 500 (B3)

**Files:**
- Modify: `app/backend/src/modules/contabilidade/plano/dto/plano.dto.ts` (L6 `dataIso`)
- Modify: `app/backend/src/modules/contabilidade/plano/plano.controller.ts` (L76 a L87)
- Modify: `app/backend/src/modules/contabilidade/plano/plano.service.ts` (L288, L387, L491)
- Modify: `app/backend/src/modules/contabilidade/plano/plano.service.spec.ts`
- Modify: `app/backend/test/integration/plano-contas.e2e-spec.ts`

Causas lidas: `plano.controller.ts` L84 faz `acaoSchema[acao]` (lê o protótipo: `constructor` e `toString` são truthy) e L86 `schema.parse(corpo)` (lança `ZodError`, que o `AllExceptionsFilter` trata como 500 por não ser `HttpException`). `plano.dto.ts` L6 valida data só por regex. `plano.service.ts` L288 e L491 repetem a regex. L387 lê `numeroPorCodigo[codigo]` com código herdado do protótipo.

- [ ] **Step 1: Write the failing tests**

Em `plano.service.spec.ts` (trocar o import da primeira linha por `import { criarContaSchema, dataCalendarioValida } from './dto/plano.dto';`):

```ts
describe('dataCalendarioValida', () => {
  it.each(['2026-02-31', '2026-13-01', '2026-00-10', '2026-04-31', '2025-02-29', '0000-01-01', '2026-1-01', ''])(
    'recusa %s',
    (valor) => expect(dataCalendarioValida(valor)).toBe(false),
  );
  it.each(['2026-02-28', '2028-02-29', '2026-12-31'])('aceita %s', (valor) => expect(dataCalendarioValida(valor)).toBe(true));
  it('o schema de criação recusa data inexistente', () => {
    const base = {
      codigo: '1', nome: 'Caixa', classificacao: 'sintetica', natureza: 'ATIVO', grupo: 'Circulante',
      contaPaiCodigo: null, centroCodigo: 'CT1', vigenciaFim: null, justificativa: 'abertura',
    };
    expect(criarContaSchema.safeParse({ ...base, vigenciaInicio: '2026-02-31' }).success).toBe(false);
    expect(criarContaSchema.safeParse({ ...base, vigenciaInicio: '2026-10-01' }).success).toBe(true);
  });
});
```

Em `plano-contas.e2e-spec.ts`, antes do `});` final do `describe` principal:

```ts
  describe('entrada HTTP inválida', () => {
    const post = (url: string, corpo: unknown) =>
      request(srv()).post(url).set('Cookie', adminCookies).send(corpo as object);
    const contasGravadas = async () =>
      Number((await db.execute(sql`select count(*)::int as total from contas_contabeis`)).rows[0].total);
    const valida = {
      codigo: '1', nome: 'Caixa', classificacao: 'sintetica', natureza: 'ATIVO', grupo: 'Circulante',
      contaPaiCodigo: null, centroCodigo: 'CT1', vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'abertura',
    };

    it.each([
      ['numero não numérico', '/contabilidade/plano/1/aprovar', { numero: 'x', justificativa: 'ok' }],
      ['justificativa só de espaços', '/contabilidade/plano/1/aprovar', { numero: 1, justificativa: '   ' }],
      ['corpo vazio', '/contabilidade/plano/1/bloquear', {}],
      ['início inexistente', '/contabilidade/plano/1/revisar-competencia',
        { numero: 1, vigenciaInicio: '2026-02-31', vigenciaFim: null, justificativa: 'ok' }],
      ['mês 13', '/contabilidade/plano/1/revisar-competencia',
        { numero: 1, vigenciaInicio: '2026-13-01', vigenciaFim: null, justificativa: 'ok' }],
      ['fim inexistente', '/contabilidade/plano/1/revisar-competencia',
        { numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: '2026-04-31', justificativa: 'ok' }],
      ['criar com início inexistente', '/contabilidade/plano', { ...valida, vigenciaInicio: '2026-02-31' }],
      ['criar com mês 13', '/contabilidade/plano', { ...valida, vigenciaInicio: '2026-13-01' }],
      ['validar com fim inexistente', '/contabilidade/plano/validar', { ...valida, vigenciaFim: '2026-02-30' }],
    ])('%s responde 400 e não grava', async (_nome, url, corpo) => {
      const res = await post(url, corpo);
      expect(res.status).toBe(400);
      expect(await contasGravadas()).toBe(0);
    });

    it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])('ação herdada %s responde 404', async (acao) => {
      expect((await post(`/contabilidade/plano/1/${acao}`, {})).status).toBe(404);
    });

    it('lote com código herdado do protótipo responde 422 conflito', async () => {
      const res = await post('/contabilidade/plano/lote', {
        acao: 'bloquear', codigos: ['constructor'], justificativa: 'ok', numeroPorCodigo: {},
      });
      expect(res.status).toBe(422);
      expect(res.body.message.message).toBe('conflito concorrente');
    });
  });
```

- [ ] **Step 2: Run to verify failure**

Em `app/backend`: `npx jest src/modules/contabilidade/plano/plano.service.spec.ts test/integration/plano-contas.e2e-spec.ts --runInBand`.

Expected: FAIL. `dataCalendarioValida` não existe; as entradas inválidas chegam como 500 (ou 200 em `validar`); `constructor` e `toString` dão 500; o lote com `constructor` dá 404.

- [ ] **Step 3: Write minimal implementation**

`plano.dto.ts`, substituir L6:

```ts
export function dataCalendarioValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [ano, mes, dia] = valor.split('-').map(Number) as [number, number, number];
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

const dataIso = z.string().refine(dataCalendarioValida, { message: 'Data inexistente no calendário' });
```

(Anos 0000 a 0099 são recusados porque `Date.UTC` os remapeia para 19xx; vigência contábil não os usa.)

`plano.controller.ts`, substituir o método `acao` (L76 a L87):

```ts
  @Post('plano/:codigo/:acao')
  @RequirePermissoes('CONTABILIDADE_PLANO_GERENCIAR')
  acao(
    @Param('codigo') codigo: string,
    @Param('acao') acao: string,
    @Body() corpo: unknown,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (!Object.hasOwn(acaoSchema, acao)) throw new NotFoundException();
    const nome = acao as keyof typeof acaoSchema;
    // transform devolve unknown; o schema da ação já garantiu a forma, então o cast é para o tipo que executar espera.
    const dto = new ZodValidationPipe(acaoSchema[nome]).transform(corpo) as Parameters<PlanoContasService['executar']>[2];
    return this.plano.executar(nome, codigo, dto, user.sub);
  }
```

`plano.service.ts`: importar `dataCalendarioValida` de `./dto/plano.dto`; em L288 trocar `!/^\d{4}-\d{2}-\d{2}$/.test(dto.vigenciaInicio)` por `!dataCalendarioValida(dto.vigenciaInicio)`; em L491 trocar `!/^\d{4}-\d{2}-\d{2}$/.test(inicio)` por `!dataCalendarioValida(inicio)`; em L387 trocar a leitura por:

```ts
          const numero = Object.hasOwn(dto.numeroPorCodigo, codigo) ? dto.numeroPorCodigo[codigo] : undefined;
```

- [ ] **Step 4: Run to verify it passes**

Mesmo comando do Step 2, e depois `npx tsc --noEmit` em `app/backend`. Expected: PASS, sem erro de tipo (sem o cast, o `tsc` acusa TS2345 em `this.plano.executar(nome, codigo, dto, user.sub)`, porque `ZodValidationPipe.transform` devolve `unknown`, `zod-validation.pipe.ts` L9), incluindo o `it` existente L232 a L242 (`vigenciaInicio: ''` segue 422 pelo service).

- [ ] **Step 5: Commit**

```powershell
git add app/backend/src/modules/contabilidade/plano app/backend/test/integration/plano-contas.e2e-spec.ts
git commit -m @"
fix(e09-t01): valida entrada HTTP do plano de contas com 400 e 404

### Descrição Detalhada:
A rota de ação prova a ação com Object.hasOwn e valida o corpo com o ZodValidationPipe. A data de vigência é validada no calendário (dataCalendarioValida) e o lote lê numeroPorCodigo só por chave própria.

### Motivo da Mudança:
schema.parse lançava ZodError e as ações constructor e toString liam o protótipo; ambos chegavam como 500. Datas como 2026-02-31 chegavam ao PostgreSQL.

### Impacto:
Entrada inválida responde 400 (forma) ou 404 (ação). Regra de negócio segue 422. Sem migration.
"@
```

---

## Task 9: Conta suspensa deixa de ser vigente (B2)

**Files:**
- Create: `app/backend/src/modules/contabilidade/plano/vigencia.ts`
- Modify: `app/backend/src/modules/contabilidade/plano/plano.service.ts` (`paiValido` L234 a L252; `ciclo` L545 a L563)
- Modify: `app/backend/test/integration/plano-contas.e2e-spec.ts`

Causa lida: `paiValido` (L242 a L247) busca "alguma versão `APPROVED`" da conta pai; com v1 `APPROVED` e v2 `SUSPENDED`, a v1 satisfaz a busca e a conta suspensa serve de pai. `ciclo` (L552 a L559) tem a mesma busca. O combo da tela não é autoridade (pendência P-r3-2).

- [ ] **Step 1: Write the failing tests**

Importar `ultimaVersaoDecidida` de `'../../src/modules/contabilidade/plano/vigencia'`. Dentro do `describe`:

```ts
  async function contaComV2Suspensa() {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: '1', classificacao: 'sintetica' }), userId);
    const v1 = await promover('1');
    await service.versionar('1', comoEdicao(v1, { justificativa: 'abre v2' }), userId);
    await service.revisarCompetencia('1', { numero: 2, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa v2' }, userId);
    await service.aprovar('1', { numero: 2, justificativa: 'aprova v2' }, userId);
    await service.bloquear('1', { numero: 2, justificativa: 'bloqueia v2' }, userId);
  }

  it('conta com v1 aprovada e v2 suspensa não é pai válido', async () => {
    await contaComV2Suspensa();
    const [conta] = await db.select().from(contasContabeis).where(eq(contasContabeis.codigo, '1'));
    expect(await ultimaVersaoDecidida(db, conta!.id)).toMatchObject({ numero: 2, situacao: 'SUSPENDED' });
    const filha = dtoBase({ codigo: '1.1', classificacao: 'analitica', contaPaiCodigo: '1' });
    await expect(service.criar(filha, userId)).rejects.toMatchObject({
      status: 422, response: { message: 'conta desativada' },
    });
    expect(await service.validar(filha, userId)).toEqual({ valido: false, mensagens: ['conta desativada'] });
    const lista = await service.listar({ pagina: 1, q: '1.1', situacao: '', ordenar: 'contaContabil', direcao: 'asc' });
    expect(lista.total).toBe(0);
  });

  it('guarda: versão nova aprovada supera a anterior como pai', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: '0', classificacao: 'sintetica' }), userId);
    await promover('0');
    await service.criar(dtoBase({ codigo: '1', classificacao: 'sintetica' }), userId);
    const v1 = await promover('1');
    await service.versionar('1', comoEdicao(v1, { classificacao: 'analitica', contaPaiCodigo: '0', justificativa: 'vira analítica' }), userId);
    await service.revisarCompetencia('1', { numero: 2, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa' }, userId);
    await service.aprovar('1', { numero: 2, justificativa: 'aprova' }, userId);
    await expect(service.criar(dtoBase({ codigo: '1.1', classificacao: 'analitica', contaPaiCodigo: '1' }), userId))
      .rejects.toMatchObject({ status: 422, response: { message: 'Conta pai analítica não é nível hierárquico válido' } });
  });

  it('guarda: revisão aberta não derruba a vigência da versão aprovada', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: '1', classificacao: 'sintetica' }), userId);
    const v1 = await promover('1');
    await service.versionar('1', comoEdicao(v1, { justificativa: 'abre v2' }), userId);
    await expect(service.criar(dtoBase({ codigo: '1.1', classificacao: 'analitica', contaPaiCodigo: '1' }), userId))
      .resolves.toMatchObject({ codigo: '1.1', contaPaiCodigo: '1' });
  });
```

- [ ] **Step 2: Run to verify failure**

`npx jest test/integration/plano-contas.e2e-spec.ts --runInBand` em `app/backend`.

Expected: FAIL por módulo `vigencia` ausente; com o arquivo criado vazio, o primeiro `it` falha porque `criar` com pai suspenso resolve em vez de rejeitar. Os dois `it` "guarda" passam com o código atual.

- [ ] **Step 3: Write minimal implementation**

`plano/vigencia.ts`:

```ts
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../../../database/schema';
import { contaVersoes } from '../../../database/schema';

type Executor = Pick<NodePgDatabase<typeof schema>, 'select'>;

/**
 * Última versão com decisão (APPROVED ou SUSPENDED) de uma conta, não excluída.
 * Regra de vigência: a conta só está vigente se esta versão for APPROVED.
 * DRAFT, REVIEW e REJECTED não decidem nada: revisão em aberto não derruba a versão aprovada.
 */
export async function ultimaVersaoDecidida(executor: Executor, contaId: string) {
  const [versao] = await executor.select().from(contaVersoes).where(and(
    eq(contaVersoes.contaId, contaId),
    inArray(contaVersoes.situacao, ['APPROVED', 'SUSPENDED']),
    isNull(contaVersoes.deletedAt),
  )).orderBy(desc(contaVersoes.numero)).limit(1);
  return versao ?? null;
}
```

`plano.service.ts`: importar `ultimaVersaoDecidida` de `./vigencia`. Método privado novo, ao lado de `paiValido`:

```ts
  /** Versão vigente do pai, ou 422. Suspensa: `conta desativada`. Nunca decidida: `Conta pai não está ativa`. */
  private async exigirPaiVigente(tx: Tx, paiId: string) {
    const decidida = await ultimaVersaoDecidida(tx, paiId);
    if (!decidida) throw new RegraContabilException('Conta pai não está ativa');
    if (decidida.situacao === 'SUSPENDED') throw new RegraContabilException('conta desativada');
    if (decidida.classificacao === 'analitica') {
      throw new RegraContabilException('Conta pai analítica não é nível hierárquico válido');
    }
    return decidida;
  }
```

Em `paiValido`, substituir L242 a L250 (o `select` de `vigente` e os dois `if`) por `await this.exigirPaiVigente(tx, pai.id);`, mantendo `return pai.id;`.

Em `ciclo`, substituir o `select` de L552 a L560 por:

```ts
      const versao = await ultimaVersaoDecidida(tx, cursor);
      cursor = versao?.contaPaiId ?? null;
```

A conta suspensa mantém a aresta de pai no caminhamento, então o ciclo continua detectável. Remover do import de `drizzle-orm` o que ficar sem uso.

- [ ] **Step 4: Run to verify it passes**

`npx jest test/integration/plano-contas.e2e-spec.ts --runInBand`. Expected: PASS, incluindo L134 a L145 (`Conta pai não está ativa`), L255 a L271 e L412 a L428 (ciclo).

- [ ] **Step 5: Commit**

```powershell
git add app/backend/src/modules/contabilidade/plano app/backend/test/integration/plano-contas.e2e-spec.ts
git commit -m @"
fix(e09-t01): conta suspensa deixa de ser pai vigente

### Descrição Detalhada:
Cria ultimaVersaoDecidida (maior numero entre APPROVED e SUSPENDED) e a usa em paiValido e no caminhamento de ciclo. Pai cuja última decisão é SUSPENDED responde 422 conta desativada.

### Motivo da Mudança:
Com v1 aprovada e v2 suspensa, a busca por qualquer versão APPROVED mantinha a conta como pai válido.

### Impacto:
Revisão em aberto (DRAFT ou REVIEW) não derruba a versão aprovada. A consulta é reutilizável pela E09-T02 sem tocar arquivo dela. Sem migration.
"@
```

---

## Task 10: Ciclo e pai inválido barrados no editar e na aprovação (B1)

**Files:**
- Modify: `app/backend/src/modules/contabilidade/plano/plano.service.ts` (`editar` L254 a L285; `versionar` L323 a L333; `aprovarNaTx` L509 a L525)
- Modify: `app/backend/test/integration/plano-contas.e2e-spec.ts`

Causa lida: `editar` chama `paiValido` (L269) mas nunca `ciclo`; só `versionar` (L324) chama. Reprodução: conta 1 aprovada, conta 2 filha de 1; versionar 1 sem pai; `editar` v2 com `contaPaiCodigo: "2"` responde 201 e revisar e aprovar passam. A aprovação (L509 a L525) também não revalida a hierarquia, que pode mudar entre o rascunho e a aprovação. O pai analítico já é recusado no `editar` por `paiValido`; o `it` correspondente é "guarda".

- [ ] **Step 1: Write the failing tests**

```ts
  const contarAuditoriaVersoes = async () =>
    Number((await db.execute(sql`select count(*)::int as total from auditoria where tabela = 'conta_versoes'`)).rows[0].total);

  it('editar recusa ciclo e pai próprio sem gravar', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: '1', classificacao: 'sintetica' }), userId);
    const v1 = await promover('1');
    await service.criar(dtoBase({ codigo: '2', classificacao: 'sintetica', contaPaiCodigo: '1' }), userId);
    await promover('2');
    const v2 = await service.versionar('1', comoEdicao(v1, { contaPaiCodigo: null, justificativa: 'abre v2' }), userId);
    const auditoriasAntes = await contarAuditoriaVersoes();
    for (const pai of ['2', '1']) {
      const res = await request(srv()).post('/contabilidade/plano/1/editar').set('Cookie', adminCookies)
        .send(comoEdicao(v2, { contaPaiCodigo: pai }));
      expect(res.status).toBe(422);
      expect(res.body.message.message).toBe('Ciclo na hierarquia da conta');
    }
    expect((await service.obter('1')).contaPaiCodigo).toBeNull();
    expect(await contarAuditoriaVersoes()).toBe(auditoriasAntes);
  });

  it('guarda: editar recusa pai analítico', async () => {
    const analitica = await contaAprovadaAnalitica();
    await service.criar(dtoBase({ codigo: '7', classificacao: 'sintetica' }), userId);
    const rascunho = await service.obter('7');
    await expect(service.editar('7', comoEdicao(rascunho, { contaPaiCodigo: analitica.codigo }), userId))
      .rejects.toMatchObject({ status: 422, response: { message: 'Conta pai analítica não é nível hierárquico válido' } });
  });

  it('aprovar revalida o ciclo que a hierarquia criou depois do rascunho', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: '1', classificacao: 'sintetica' }), userId);
    const v1 = await promover('1');
    await service.criar(dtoBase({ codigo: '3', classificacao: 'sintetica' }), userId);
    const t1 = await promover('3');
    await service.versionar('1', comoEdicao(v1, { contaPaiCodigo: '3', justificativa: '1 sob 3' }), userId);
    await service.revisarCompetencia('1', { numero: 2, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa' }, userId);
    await service.versionar('3', comoEdicao(t1, { contaPaiCodigo: '1', justificativa: '3 sob 1' }), userId);
    await service.revisarCompetencia('3', { numero: 2, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa' }, userId);
    await service.aprovar('3', { numero: 2, justificativa: 'aprova 3 sob 1' }, userId);
    await expect(service.aprovar('1', { numero: 2, justificativa: 'aprova 1 sob 3' }, userId))
      .rejects.toMatchObject({ status: 422, response: { message: 'Ciclo na hierarquia da conta' } });
    expect((await service.obter('1')).situacao).toBe('REVIEW');
  });

  it('duas aprovações cruzadas não fecham ciclo', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    for (const codigo of ['A', 'B']) {
      await service.criar(dtoBase({ codigo, classificacao: 'sintetica' }), userId);
    }
    const a = await promover('A');
    const b = await promover('B');
    await service.versionar('A', comoEdicao(a, { contaPaiCodigo: 'B', justificativa: 'A sob B' }), userId);
    await service.versionar('B', comoEdicao(b, { contaPaiCodigo: 'A', justificativa: 'B sob A' }), userId);
    for (const codigo of ['A', 'B']) {
      await service.revisarCompetencia(codigo, { numero: 2, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa' }, userId);
    }
    const resultado = await Promise.allSettled([
      service.aprovar('A', { numero: 2, justificativa: 'aprova A' }, userId),
      service.aprovar('B', { numero: 2, justificativa: 'aprova B' }, userId),
    ]);
    expect(resultado.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const recusada = resultado.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(recusada.reason).toMatchObject({ status: 422, response: { message: 'Ciclo na hierarquia da conta' } });
  });
```

- [ ] **Step 2: Run to verify failure**

`npx jest test/integration/plano-contas.e2e-spec.ts --runInBand` em `app/backend`.

Expected: FAIL em `editar recusa ciclo` (responde 201), em `aprovar revalida o ciclo` (a aprovação passa) e em `duas aprovações cruzadas` (as duas resolvem). O `it` "guarda" passa.

- [ ] **Step 3: Write minimal implementation**

`plano.service.ts`. Métodos privados novos, ao lado de `paiValido`:

```ts
  private async recusarCiclo(tx: Tx, contaId: string, paiId: string | null) {
    if (paiId && await this.ciclo(tx, contaId, paiId)) {
      throw new RegraContabilException('Ciclo na hierarquia da conta');
    }
  }

  /** Pai de uma versão nova ou editada: existe, é vigente e sintético, e não fecha ciclo. */
  private async paiDaVersao(tx: Tx, contaId: string, classificacao: 'sintetica' | 'analitica', contaPaiCodigo: string | null) {
    const paiId = await this.paiValido(tx, classificacao, contaPaiCodigo);
    await this.recusarCiclo(tx, contaId, paiId);
    return paiId;
  }
```

`editar`: antes do `update` (L264), calcular `const paiId = await this.paiDaVersao(tx, atual.contaId, dto.classificacao, dto.contaPaiCodigo);` e usar `contaPaiId: paiId` no `.set({...})` no lugar da chamada de L269.

`versionar`: substituir L323 a L333 (a chamada de `paiValido` e o `if (paiId && await this.ciclo(...))` com o `select` de `paiVersao` e a mensagem condicional, cujo ramo "analítica" é morto porque `paiValido` já recusa pai analítico) por:

```ts
      const paiId = await this.paiDaVersao(tx, conta.id, dto.classificacao, dto.contaPaiCodigo);
```

`aprovarNaTx`: depois do `if (!justificativa.trim())` (L513) e antes do `update`:

```ts
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'contabilidade:hierarquia'}))`);
    if (atual.contaPaiId) {
      await this.exigirPaiVigente(tx, atual.contaPaiId);
      await this.recusarCiclo(tx, atual.contaId, atual.contaPaiId);
    } else if (atual.classificacao === 'analitica') {
      throw new RegraContabilException('Conta pai não encontrada');
    }
```

O lock transacional serializa aprovações: a segunda aprovação cruzada lê, depois do lock, a aresta que a primeira acabou de aprovar. Lock global por limitação conhecida (aprovação é ação rara; trocar por lock por raiz só se houver contenção medida).

- [ ] **Step 4: Run to verify it passes**

`npx jest test/integration/plano-contas.e2e-spec.ts --runInBand`. Expected: PASS, incluindo L255 a L271, L384 a L410 e L412 a L428.

- [ ] **Step 5: Commit**

```powershell
git add app/backend/src/modules/contabilidade/plano app/backend/test/integration/plano-contas.e2e-spec.ts
git commit -m @"
fix(e09-t01): barra ciclo e pai inválido no editar e na aprovação

### Descrição Detalhada:
editar e versionar passam por paiDaVersao (pai existente, vigente, sintético e sem ciclo). A aprovação revalida pai e ciclo sob advisory lock transacional da hierarquia.

### Motivo da Mudança:
editar não chamava ciclo(); a hierarquia podia mudar entre o rascunho e a aprovação, e duas aprovações cruzadas fechavam ciclo.

### Impacto:
Ciclo e pai inválido respondem 422 sem gravar. Aprovações de contas passam a ser serializadas. Sem migration.
"@
```

---

## Task 11: Bloquear conta com rascunho aberto descarta o rascunho (AD-25 item 3)

**Files:**
- Modify: `app/backend/src/modules/contabilidade/plano/plano.service.ts` (`travar` L452 a L464; `bloquearNaTx` L527 a L543)
- Modify: `app/backend/test/integration/plano-contas.e2e-spec.ts`

Estado lido: `travar` (L459 a L460) exige `numero` igual ao maior; com v1 `APPROVED` e v2 `DRAFT`, `bloquear` com `numero 1` responde 409 e com `numero 2` responde 422 (L530). Decisões do delta: o token é o maior número; `DRAFT` e `REVIEW` abertas são descartadas por `deleted_at` com auditoria `DELETE`, na transação do bloqueio.

- [ ] **Step 1: Write the failing tests**

Importar `AuditoriaService` de `'../../src/common/auditoria/auditoria.service'`.

```ts
  async function contaComRascunhoAberto(emRevisao = false) {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: '1', classificacao: 'sintetica' }), userId);
    const v1 = await promover('1');
    await service.versionar('1', comoEdicao(v1, { nome: 'Caixa v2', justificativa: 'abre v2' }), userId);
    if (emRevisao) {
      await service.revisarCompetencia('1', { numero: 2, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa v2' }, userId);
    }
  }
  const versaoBruta = async (numero: number) =>
    (await db.execute(sql`
      select v.id, v.situacao, v.deleted_at from conta_versoes v join contas_contabeis c on c.id = v.conta_id
       where c.codigo = '1' and v.numero = ${numero}`)).rows[0] as { id: string; situacao: string; deleted_at: Date | null };

  it('bloquear com rascunho aberto descarta o rascunho e suspende a aprovada', async () => {
    await contaComRascunhoAberto();
    const res = await request(srv()).post('/contabilidade/plano/1/bloquear').set('Cookie', adminCookies)
      .send({ numero: 2, justificativa: 'encerra a conta' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ numero: 1, situacao: 'SUSPENDED' });
    expect((await versaoBruta(2)).deleted_at).not.toBeNull();
    expect((await versaoBruta(1)).situacao).toBe('SUSPENDED');
    const trilha = (await db.execute(sql`
      select operacao, justificativa, created_at from auditoria
       where tabela = 'conta_versoes'
         and created_at = (select max(created_at) from auditoria where tabela = 'conta_versoes')
       order by id`)).rows as { operacao: string; justificativa: string; created_at: Date }[];
    expect(trilha.map((linha) => linha.operacao)).toEqual(['DELETE', 'UPDATE']);
    expect(trilha[0]!.justificativa).toMatch(/^Rascunho descartado pelo bloqueio da conta\. encerra a conta$/);
  });

  it('revisão aberta também é descartada pelo bloqueio', async () => {
    await contaComRascunhoAberto(true);
    await service.bloquear('1', { numero: 2, justificativa: 'encerra' }, userId);
    expect((await versaoBruta(2)).deleted_at).not.toBeNull();
    expect((await service.obter('1')).situacao).toBe('SUSPENDED');
  });

  it('guarda: número desatualizado segue 409 e não descarta', async () => {
    await contaComRascunhoAberto();
    await expect(service.bloquear('1', { numero: 1, justificativa: 'velho' }, userId))
      .rejects.toMatchObject({ status: 409, response: { message: 'conflito concorrente' } });
    expect((await versaoBruta(2)).deleted_at).toBeNull();
    expect((await versaoBruta(1)).situacao).toBe('APPROVED');
  });

  it('falha da auditoria desfaz o descarte', async () => {
    await contaComRascunhoAberto();
    const auditoriaSvc = app.get(AuditoriaService);
    const original = auditoriaSvc.registrar.bind(auditoriaSvc);
    const espiao = jest.spyOn(auditoriaSvc, 'registrar')
      .mockImplementationOnce(original)
      .mockRejectedValueOnce(new Error('falha injetada'));
    await expect(service.bloquear('1', { numero: 2, justificativa: 'encerra' }, userId)).rejects.toThrow('falha injetada');
    espiao.mockRestore();
    expect((await versaoBruta(2)).deleted_at).toBeNull();
    expect((await versaoBruta(1)).situacao).toBe('APPROVED');
  });
```

(As duas linhas da trilha compartilham `created_at` porque `defaultNow()` devolve o instante da transação; o bloqueio é a última transação do teste.)

- [ ] **Step 2: Run to verify failure**

`npx jest test/integration/plano-contas.e2e-spec.ts --runInBand` em `app/backend`.

Expected: FAIL nos três primeiros `it` que usam `numero: 2` (resposta 422, versão 2 não descartada). O `it` "guarda" passa.

- [ ] **Step 3: Write minimal implementation**

`travar` passa a devolver as versões: trocar `return { conta, atual };` por `return { conta, atual, versoes };`.

Substituir `bloquearNaTx` (L527 a L543):

```ts
  private async bloquearNaTx(tx: Tx, codigo: string, numero: number, justificativa: string, usuarioId: string) {
    const { atual, versoes } = await this.travar(tx, codigo, numero);
    if (atual.situacao === 'SUSPENDED') throw new ConflictException('conta desativada');
    const aberta = atual.situacao === 'DRAFT' || atual.situacao === 'REVIEW' ? atual : null;
    const alvo = aberta
      ? versoes.filter((v) => v.numero < aberta.numero).sort((a, b) => b.numero - a.numero)[0]
      : atual;
    if (!alvo || alvo.situacao !== 'APPROVED') throw new RegraContabilException('Situação não permite esta transição');
    if (!justificativa.trim()) throw new RegraContabilException('Informe justificativa para auditoria.');
    if (aberta) {
      // AD-25 item 3: o rascunho aberto é encerrado na mesma transação do bloqueio.
      const descartada = primeiroOuFalha(await tx.update(contaVersoes).set({ deletedAt: sql`now()` })
        .where(eq(contaVersoes.id, aberta.id)).returning());
      await this.auditoria.registrar(tx, {
        tabela: 'conta_versoes', registroId: aberta.id, operacao: 'DELETE',
        modulo: 'contabilidade.plano', usuarioId, dadosAnteriores: aberta, dadosNovos: descartada,
        justificativa: `Rascunho descartado pelo bloqueio da conta. ${justificativa}`,
      });
    }
    const nova = primeiroOuFalha(await tx.update(contaVersoes).set({
      situacao: 'SUSPENDED',
      justificativa,
      responsavelId: usuarioId,
    }).where(eq(contaVersoes.id, alvo.id)).returning());
    await this.auditoria.registrar(tx, {
      tabela: 'conta_versoes', registroId: nova.id, operacao: 'UPDATE',
      modulo: 'contabilidade.plano', usuarioId, dadosAnteriores: alvo, dadosNovos: nova,
      justificativa,
    });
    return nova;
  }
```

O `lote` com `bloquear` herda o comportamento porque chama `bloquearNaTx`.

- [ ] **Step 4: Run to verify it passes**

`npx jest test/integration/plano-contas.e2e-spec.ts --runInBand`. Expected: PASS, incluindo L500 a L562 (bloquear duas vezes segue 409 `conta desativada`; `bloquear('5')` em `REVIEW` sem versão anterior aprovada segue 422).

- [ ] **Step 5: Commit**

```powershell
git add app/backend/src/modules/contabilidade/plano app/backend/test/integration/plano-contas.e2e-spec.ts
git commit -m @"
feat(e09-t01): bloquear conta encerra o rascunho aberto (AD-25)

### Descrição Detalhada:
bloquearNaTx aceita o maior numero quando a versão aberta (DRAFT ou REVIEW) está sobre uma versão APPROVED, descarta a aberta por deleted_at com auditoria DELETE e suspende a aprovada na mesma transação.

### Motivo da Mudança:
AD-25 item 3: o rascunho não deve impedir o bloqueio. Sem estado de descarte no CHECK, usa-se o soft delete da convenção do repositório.

### Impacto:
Sem migration. Falha em qualquer etapa desfaz descarte e bloqueio. O lote de bloqueio herda a regra.
"@
```

---

## Task 12: Mensagem de transição inválida no editar e histórico rotulado (M5)

**Files:**
- Modify: `app/backend/src/modules/contabilidade/plano/plano.service.ts` (`editar` L262; `historico` L425 a L450)
- Modify: `app/backend/test/integration/plano-contas.e2e-spec.ts` (L364 a L365 e dois `it` novos)

Causa lida: L262 usa `mudança de classificação após fechamento` para toda situação diferente de `DRAFT`, inclusive `REVIEW` e `REJECTED`. `historico` (L432 a L449) devolve `auditoria.operacao` crua (`INSERT`, `UPDATE`).

- [ ] **Step 1: Write the failing tests**

Alterar a asserção de L364 a L365 (editar versão `APPROVED` sem mudar classificação não é mudança de classificação; o caminho é `Versionar`):

```ts
    await expect(service.editar(conta.codigo, comoEdicao(conta), userId))
      .rejects.toMatchObject({ response: { message: 'Situação não permite esta transição' }, status: 422 });
```

`it` novos:

```ts
  it('editar fora do rascunho recusa com transição inválida', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: '1', classificacao: 'sintetica' }), userId);
    await service.revisarCompetencia('1', { numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa' }, userId);
    const emRevisao = await service.obter('1');
    await expect(service.editar('1', comoEdicao(emRevisao), userId))
      .rejects.toMatchObject({ status: 422, response: { message: 'Situação não permite esta transição' } });
    await db.execute(sql`update conta_versoes set situacao = 'REJECTED' where deleted_at is null`);
    await expect(service.editar('1', comoEdicao(emRevisao), userId))
      .rejects.toMatchObject({ status: 422, response: { message: 'Situação não permite esta transição' } });
  });

  it('histórico rotula e ordena os acontecimentos', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: '1', classificacao: 'sintetica' }), userId);
    const v1 = await promover('1');
    const v2 = await service.versionar('1', comoEdicao(v1, { justificativa: 'abre v2' }), userId);
    await service.editar('1', comoEdicao(v2, { nome: 'Caixa v2 ajustada' }), userId);
    await service.bloquear('1', { numero: 2, justificativa: 'encerra' }, userId);
    const linhas = await service.historico('1');
    expect(linhas.map((linha) => linha.acontecimento)).toEqual([
      'Conta criada', 'Enviada para revisão', 'Aprovada', 'Nova versão criada',
      'Rascunho editado', 'Rascunho descartado', 'Bloqueada',
    ]);
  });
```

- [ ] **Step 2: Run to verify failure**

`npx jest test/integration/plano-contas.e2e-spec.ts --runInBand` em `app/backend`.

Expected: FAIL nos dois `it` novos (mensagem antiga; rótulos `INSERT`/`UPDATE`/`DELETE`) e na asserção alterada de L364. O `it` do histórico depende do descarte da Task 11.

- [ ] **Step 3: Write minimal implementation**

`editar`: L262 passa a ser

```ts
      if (atual.situacao !== 'DRAFT') throw new RegraContabilException('Situação não permite esta transição');
```

O ramo de L259 a L261 (`APPROVED` com natureza, grupo, classificação ou centro diferentes) mantém `mudança de classificação após fechamento` (Review Focus 2).

`historico`: o `select` ganha `novos: auditoria.dadosNovos`; o `orderBy` vira `.orderBy(asc(auditoria.createdAt), asc(auditoria.id))` (desempate por uuidv7, porque descarte e bloqueio compartilham o instante da transação); o `map` usa:

```ts
      acontecimento: rotularAcontecimento(linha.acontecimento, linha.novos),
```

No fim do arquivo, ao lado de `textoDe`:

```ts
function rotularAcontecimento(operacao: string, novos: unknown): string {
  const dados = (novos ?? {}) as { situacao?: string; numero?: number };
  if (operacao === 'INSERT') return (dados.numero ?? 1) > 1 ? 'Nova versão criada' : 'Conta criada';
  if (operacao === 'DELETE') return 'Rascunho descartado';
  if (operacao === 'ACAO_MANUAL') return 'Lançamentos mapeados';
  if (dados.situacao === 'REVIEW') return 'Enviada para revisão';
  if (dados.situacao === 'APPROVED') return 'Aprovada';
  if (dados.situacao === 'SUSPENDED') return 'Bloqueada';
  return 'Rascunho editado';
}
```

O campo da resposta continua `acontecimento`; o React já o renderiza (`plano-contas-client.tsx` L573 e L587).

- [ ] **Step 4: Run to verify it passes**

`npx jest test/integration/plano-contas.e2e-spec.ts --runInBand`. Expected: PASS, incluindo L500 a L562 (a linha de auditoria manual sem dados vira `Lançamentos mapeados`; o `it` só confere `quem` e `justificativa`).

- [ ] **Step 5: Commit**

```powershell
git add app/backend/src/modules/contabilidade/plano app/backend/test/integration/plano-contas.e2e-spec.ts
git commit -m @"
fix(e09-t01): corrige a mensagem do editar e rotula o histórico

### Descrição Detalhada:
editar fora do rascunho responde Situação não permite esta transição; a mensagem de classificação fica só para versão aprovada com campo de classificação alterado. O histórico traduz operação e situação em rótulos e desempata por id.

### Motivo da Mudança:
Editar em REVIEW devolvia a mensagem de fechamento, e a aba Histórico mostrava INSERT e UPDATE crus.

### Impacto:
Altera a asserção de editar versão aprovada sem mudança (L364 a L365) para a mensagem correta. Sem migration.
"@
```

---

## Task 13: Lote emite evento pós-commit e não devolve UUID (M3 e A1)

**Files:**
- Modify: `app/backend/src/modules/contabilidade/plano/plano.service.ts` (`lote` L382 a L403; emissões em L295, L303 e L311)
- Modify: `app/backend/test/integration/plano-contas.e2e-spec.ts`

Causas lidas: `lote` não chama `eventEmitter.emit`, ao contrário das ações individuais (L295, L303, L311). `lote` devolve `saida`, as linhas cruas de `conta_versoes` (`id`, `contaId`, `centroCustoId`, `responsavelId`), contra D9. A tela não consome a room (pendência P-r3-1); o evento sai no backend como nas outras ações.

- [ ] **Step 1: Write the failing tests**

Importar `EventEmitter2` de `'@nestjs/event-emitter'` e `EVENTOS` de `'../../src/realtime/events/eventos'`.

```ts
  it('lote emite o evento de cada conta só depois do commit', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    for (const codigo of ['A', 'B']) {
      await service.criar(dtoBase({ codigo, classificacao: 'sintetica' }), userId);
      await service.revisarCompetencia(codigo, { numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa' }, userId);
    }
    const emitir = jest.spyOn(app.get(EventEmitter2), 'emit');
    await service.lote({ acao: 'aprovar', codigos: ['A', 'B'], justificativa: 'aprova em lote', numeroPorCodigo: { A: 1, B: 1 } }, userId);
    const aprovadas = emitir.mock.calls.filter(([evento]) => evento === EVENTOS.PLANO_CONTA_APROVADA);
    expect(aprovadas.map(([, payload]) => payload)).toEqual([
      { codigo: 'A', acao: 'aprovar', situacao: 'APPROVED' },
      { codigo: 'B', acao: 'aprovar', situacao: 'APPROVED' },
    ]);
    emitir.mockClear();
    await service.criar(dtoBase({ codigo: 'C', classificacao: 'sintetica' }), userId);
    await service.revisarCompetencia('C', { numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa' }, userId);
    await expect(service.lote({
      acao: 'bloquear', codigos: ['A', 'C'], justificativa: 'falha no segundo', numeroPorCodigo: { A: 1, C: 1 },
    }, userId)).rejects.toMatchObject({ status: 422 });
    expect(emitir.mock.calls.filter(([evento]) => evento === EVENTOS.PLANO_CONTA_BLOQUEADA)).toHaveLength(0);
    expect((await service.obter('A')).situacao).toBe('APPROVED');
    emitir.mockRestore();
  });

  it('lote não devolve uuid', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: 'A', classificacao: 'sintetica' }), userId);
    await service.revisarCompetencia('A', { numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa' }, userId);
    const res = await request(srv()).post('/contabilidade/plano/lote').set('Cookie', adminCookies)
      .send({ acao: 'aprovar', codigos: ['A'], justificativa: 'aprova', numeroPorCodigo: { A: 1 } });
    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ codigo: 'A', situacao: 'APPROVED' });
    expect(JSON.stringify(res.body)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  });
```

- [ ] **Step 2: Run to verify failure**

`npx jest test/integration/plano-contas.e2e-spec.ts --runInBand` em `app/backend`.

Expected: FAIL: nenhum evento emitido pelo lote e o corpo traz `id` e `contaId` em UUID.

- [ ] **Step 3: Write minimal implementation**

No topo do service, junto às constantes:

```ts
const EVENTO_DA_ACAO = {
  'revisar-competencia': { evento: EVENTOS.PLANO_CONTA_REVISADA, acao: 'revisar', situacao: 'REVIEW' },
  aprovar: { evento: EVENTOS.PLANO_CONTA_APROVADA, acao: 'aprovar', situacao: 'APPROVED' },
  bloquear: { evento: EVENTOS.PLANO_CONTA_BLOQUEADA, acao: 'bloquear', situacao: 'SUSPENDED' },
} as const;
```

Método privado:

```ts
  private emitirAcao(chave: keyof typeof EVENTO_DA_ACAO, codigo: string) {
    const { evento, acao, situacao } = EVENTO_DA_ACAO[chave];
    this.eventEmitter.emit(evento, { codigo, acao, situacao });
  }
```

`revisarCompetencia`, `aprovar` e `bloquear` trocam seus `this.eventEmitter.emit(...)` por `this.emitirAcao('revisar-competencia' | 'aprovar' | 'bloquear', codigo)`; o payload é idêntico ao atual.

`lote`:

```ts
  async lote(dto: LoteDto, usuarioId: string) {
    await this.db.transaction(async (tx) => {
      for (const codigo of dto.codigos) {
        try {
          const numero = Object.hasOwn(dto.numeroPorCodigo, codigo) ? dto.numeroPorCodigo[codigo] : undefined;
          if (numero === undefined) throw new RegraContabilException('conflito concorrente');
          if (dto.acao === 'bloquear') await this.bloquearNaTx(tx, codigo, numero, dto.justificativa, usuarioId);
          if (dto.acao === 'aprovar') await this.aprovarNaTx(tx, codigo, numero, dto.justificativa, usuarioId);
          if (dto.acao === 'revisar-competencia') await this.revisarNaTx(tx, codigo, numero, dto.justificativa, usuarioId);
        } catch (erro) {
          if (erro instanceof HttpException) {
            throw new HttpException({ message: textoDe(erro), codigo }, erro.getStatus());
          }
          throw erro;
        }
      }
    });
    for (const codigo of dto.codigos) this.emitirAcao(dto.acao, codigo);
    return Promise.all(dto.codigos.map((codigo) => this.obter(codigo)));
  }
```

Os `it` de lote existentes (L449 a L482) só conferem `toHaveLength(1)` e as falhas, e continuam válidos.

- [ ] **Step 4: Run to verify it passes**

`npx jest test/integration/plano-contas.e2e-spec.ts --runInBand`. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add app/backend/src/modules/contabilidade/plano app/backend/test/integration/plano-contas.e2e-spec.ts
git commit -m @"
fix(e09-t01): lote emite evento pós-commit e devolve contas apresentadas

### Descrição Detalhada:
O lote emite, depois da transação, o mesmo evento das ações individuais (mapa EVENTO_DA_ACAO compartilhado) e devolve ContaApresentada por código em vez das linhas cruas.

### Motivo da Mudança:
O lote gravava sem avisar a room contabilidade-plano e vazava id, contaId e demais UUIDs (D9).

### Impacto:
A resposta do lote passa a ser a lista de contas apresentadas. Lote que falha não emite nada. Sem migration.
"@
```

---

## Task 14: CSV da visão inteira e sem injeção de fórmula (M1 e M2)

**Files:**
- Modify: `app/backend/src/modules/contabilidade/plano/plano.service.ts` (`exportarCsv` L173 a L187)
- Modify: `app/backend/test/integration/plano-contas.e2e-spec.ts`

Causas lidas: `exportarCsv` chama `this.listar(query)` (L174), que pagina em `PAGINA = 20` (L55): 29 contas exportam 20 linhas. `escapar` (L184) só cita `"`, `;` e quebra de linha e não neutraliza `=`, `+`, `-`, `@`, tab nem CR no início da célula. Não há helper de CSV nesta árvore (o `exportacao-csv.ts` fiscal vive em outro ramo): implementação local mínima.

- [ ] **Step 1: Write the failing tests**

```ts
  it('csv exporta a visão inteira, não a página', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    for (let i = 1; i <= 29; i += 1) {
      await service.criar(dtoBase({ codigo: String(i).padStart(2, '0'), nome: `Conta ${i}` }), userId);
    }
    const csv = await service.exportarCsv({ pagina: 2, q: '', situacao: '', ordenar: 'contaContabil', direcao: 'asc' });
    expect(csv.replace('\uFEFF', '').split('\n')).toHaveLength(30);
    const filtrado = await service.exportarCsv({ pagina: 1, q: 'Conta 2', situacao: 'DRAFT', ordenar: 'contaContabil', direcao: 'asc' });
    expect(filtrado.replace('\uFEFF', '').split('\n')).toHaveLength(12);
  });

  it('csv neutraliza célula que começa como fórmula', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    const nomes = ['=1+1', '+SUM(A1)', '-2', '@cmd', '\t=tab', '=HYPERLINK("http://x")'];
    for (const [i, nome] of nomes.entries()) {
      await service.criar(dtoBase({ codigo: `F${i}`, nome }), userId);
    }
    const csv = await service.exportarCsv({ pagina: 1, q: '', situacao: '', ordenar: 'contaContabil', direcao: 'asc' });
    const linhas = csv.replace('\uFEFF', '').split('\n');
    for (const inicio of ["'=1+1;", "'+SUM(A1);", "'-2;", "'@cmd;"]) {
      expect(linhas.some((linha) => linha.startsWith(inicio))).toBe(true);
    }
    expect(csv).toContain(`"'\t=tab"`);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
  });
```

Contagem do filtro: `Conta 2` e `Conta 20` a `Conta 29` são 11 contas, mais o cabeçalho, 12 linhas.

- [ ] **Step 2: Run to verify failure**

`npx jest test/integration/plano-contas.e2e-spec.ts --runInBand` em `app/backend`.

Expected: FAIL: com `pagina: 2` o CSV antigo tem 10 linhas (cabeçalho e as 9 contas da segunda página, porque 29 contas dão 20 na primeira e 9 na segunda) em vez de 30; a segunda asserção (filtro `Conta 2` com `DRAFT`, 12 linhas) cabe numa página e só seria alcançada depois da primeira; as fórmulas saem sem prefixo.

- [ ] **Step 3: Write minimal implementation**

```ts
  async exportarCsv(query: ListarPlanoQuery): Promise<string> {
    const { linhas: bruto } = await this.consultar(query, false);
    const itens = bruto.map((linha) => this.apresentar(linha));
    const cabecalho = ['Conta contábil', 'Situação', 'Natureza da conta', 'Centro de custo', 'Início de vigência', 'Fim de vigência'];
    const linhas = itens.map((item) => [
      item.nome,
      item.situacaoRotulo,
      item.naturezaRotulo,
      item.centroNome,
      item.vigenciaInicio,
      item.vigenciaFim ?? '—',
    ]);
    // Célula que o Excel ou o Calc leria como fórmula ganha o prefixo ' (CSV injection).
    const neutralizar = (valor: string) => (/^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor);
    const escapar = (valor: string) => {
      const seguro = neutralizar(valor);
      return /[",;\r\n\t]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
    };
    const corpo = [cabecalho, ...linhas].map((linha) => linha.map(escapar).join(';')).join('\n');
    return `\uFEFF${corpo}`;
  }
```

O `it` existente L294 a L319 (`"Caixa ""A"";"`, `2026-12-31`, `—`) segue válido.

- [ ] **Step 4: Run to verify it passes**

`npx jest test/integration/plano-contas.e2e-spec.ts --runInBand`. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add app/backend/src/modules/contabilidade/plano app/backend/test/integration/plano-contas.e2e-spec.ts
git commit -m @"
fix(e09-t01): exporta o CSV da visão inteira e neutraliza fórmula

### Descrição Detalhada:
exportarCsv consulta sem paginação e prefixa com apóstrofo a célula iniciada por =, +, -, @, tab ou CR antes de citar.

### Motivo da Mudança:
O CSV de 29 contas saía com 20 linhas e o nome da conta podia executar fórmula no Excel.

### Impacto:
O arquivo passa a ter todas as linhas do filtro. Sem migration.
"@
```

---

## Task 15: Criação simultânea do mesmo centro responde 409 (M6)

**Files:**
- Modify: `app/backend/src/modules/contabilidade/plano/plano.service.ts` (`criarCentro` L130 a L148)
- Modify: `app/backend/test/integration/plano-contas.e2e-spec.ts`

Causa lida: `criarCentro` verifica duplicidade com `select` (L132 a L134) sem o advisory lock que `criar` usa (L93). Duas criações concorrentes passam no `select` e a segunda quebra no índice `uq_centros_custo_codigo` com erro de banco (500).

- [ ] **Step 1: Write the failing test**

```ts
  it('dez criações simultâneas do mesmo centro: uma grava, nove respondem 409', async () => {
    const resultados = await Promise.allSettled(
      Array.from({ length: 10 }, () => service.criarCentro({ codigo: 'CTX', nome: 'Concorrente', justificativa: 'corrida' }, userId)),
    );
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    for (const r of resultados.filter((x): x is PromiseRejectedResult => x.status === 'rejected')) {
      expect(r.reason).toMatchObject({ status: 409, response: { message: 'Já existe centro de custo com este código' } });
    }
    expect((await service.listarCentrosAtivos()).filter((c) => c.codigo === 'CTX')).toHaveLength(1);
  });
```

- [ ] **Step 2: Run to verify failure**

`npx jest test/integration/plano-contas.e2e-spec.ts --runInBand` em `app/backend`.

Expected: FAIL: as rejeições são violações do índice único, sem `status` 409.

- [ ] **Step 3: Write minimal implementation**

No início da transação de `criarCentro`, antes do `select` de duplicidade:

```ts
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'contabilidade:centro:' + dto.codigo}))`);
```

- [ ] **Step 4: Run to verify it passes**

`npx jest test/integration/plano-contas.e2e-spec.ts --runInBand`. Expected: PASS, incluindo L156 a L162.

- [ ] **Step 5: Commit**

```powershell
git add app/backend/src/modules/contabilidade/plano app/backend/test/integration/plano-contas.e2e-spec.ts
git commit -m @"
fix(e09-t01): serializa a criação de centro de custo por código

### Descrição Detalhada:
criarCentro toma o mesmo advisory lock transacional por código que criar usa para a conta.

### Motivo da Mudança:
Duas criações simultâneas do mesmo código chegavam ao índice único e respondiam 500.

### Impacto:
A segunda criação responde 409. Sem migration.
"@
```

---

## Task 16: Limpeza do e2e derivada do ambiente, não de banco fixo (B4)

**Files:**
- Create: `app/frontend/e2e/limpar-plano.ts`
- Modify: `app/frontend/e2e/e09-t01-plano-contas.spec.ts` (L1 e L9 a L27; import novo)
- Create: `app/frontend/__tests__/e09-t01-limpar-plano.test.ts`

Causa lida: `e2e/e09-t01-plano-contas.spec.ts` L9 a L27 roda `docker exec ... psql -d alphacarnes_e09_t01 -c "delete from conta_versoes; ..."`. O nome do banco é fixo, o `delete` é irrestrito e a ordem ignora tabelas da T02 que referenciem as da T01. Não existe API de exclusão (soft delete), então a limpeza continua por SQL, mas só em banco de teste e derivada do `DATABASE_URL`.

- [ ] **Step 1: Write the failing test**

`app/frontend/__tests__/e09-t01-limpar-plano.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { comandoLimpezaPlano } from '../e2e/limpar-plano';

describe('limpeza do e2e do plano de contas', () => {
  const env = (url?: string) => ({ DATABASE_URL: url }) as NodeJS.ProcessEnv;
  const lerE2e = (arquivo: string) => readFileSync(join(__dirname, '..', 'e2e', arquivo), 'utf8');

  it('deriva usuário e banco do DATABASE_URL', () => {
    const { args } = comandoLimpezaPlano(env('postgres://alphacarnes:senha@localhost:15433/alphacarnes_e09_t01'));
    expect(args).toEqual(expect.arrayContaining(['-U', 'alphacarnes', '-d', 'alphacarnes_e09_t01']));
    const outro = comandoLimpezaPlano(env('postgres://u:p@localhost:15433/alphacarnes_e09_t02'));
    expect(outro.args).toEqual(expect.arrayContaining(['-d', 'alphacarnes_e09_t02']));
  });

  it('trunca as três tabelas em cascata, cobrindo tabelas da T02 se existirem', () => {
    const { args } = comandoLimpezaPlano(env('postgres://u:p@h:1/alphacarnes_e2e'));
    expect(args.at(-1)).toBe('TRUNCATE conta_versoes, contas_contabeis, centros_custo CASCADE;');
  });

  it.each([undefined, '', 'postgres://u:p@h:1/alphacarnes', 'postgres://u:p@h:1/producao'])('recusa %s', (url) => {
    expect(() => comandoLimpezaPlano(env(url))).toThrow();
  });

  it('nem o helper nem o spec carregam o nome de banco fixo nem delete irrestrito', () => {
    expect(lerE2e('limpar-plano.ts')).not.toContain('alphacarnes_e09_t01');
    expect(lerE2e('e09-t01-plano-contas.spec.ts')).not.toContain('alphacarnes_e09_t01');
    expect(lerE2e('e09-t01-plano-contas.spec.ts')).not.toContain('delete from');
  });
});
```

- [ ] **Step 2: Run to verify failure**

`npx jest __tests__/e09-t01-limpar-plano.test.ts` em `app/frontend`.

Expected: FAIL: `../e2e/limpar-plano` não existe.

- [ ] **Step 3: Write minimal implementation**

`app/frontend/e2e/limpar-plano.ts`:

```ts
import { execFileSync } from 'node:child_process';

/** Só bancos de teste: sufixo _e2e, _test ou _eNN_tNN (um banco por fatia). */
const BANCO_DE_TESTE = /_(e2e|test|e\d{2}_t\d{2})$/;

export function comandoLimpezaPlano(env: NodeJS.ProcessEnv = process.env): { container: string; args: string[] } {
  const bruto = env.DATABASE_URL;
  if (!bruto) throw new Error('DATABASE_URL ausente: o e2e do plano de contas não limpa banco sem saber qual.');
  const url = new URL(bruto);
  const banco = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const usuario = decodeURIComponent(url.username);
  if (!usuario) throw new Error('DATABASE_URL sem usuário.');
  if (!BANCO_DE_TESTE.test(banco)) {
    throw new Error(`Banco "${banco}" não é de teste (sufixo _e2e, _test ou _eNN_tNN). Limpeza recusada.`);
  }
  const container = env.E2E_POSTGRES_CONTAINER ?? 'alphacarnes-postgres-1';
  return {
    container,
    // CASCADE esvazia também as tabelas que referenciem estas (política da T02, quando existir) sem nomeá-las.
    args: ['exec', container, 'psql', '-U', usuario, '-d', banco, '-v', 'ON_ERROR_STOP=1', '-c',
      'TRUNCATE conta_versoes, contas_contabeis, centros_custo CASCADE;'],
  };
}

export function limparPlano() {
  execFileSync('docker', comandoLimpezaPlano().args, { stdio: 'pipe' });
}
```

No spec Playwright: remover `import { execFileSync } from 'node:child_process';` (L1), remover a função `limparPlano` (L9 a L27) e acrescentar `import { limparPlano } from './limpar-plano';`. Nenhum outro trecho do spec muda.

- [ ] **Step 4: Run to verify it passes**

`npx jest __tests__/e09-t01-limpar-plano.test.ts` em `app/frontend`. Expected: PASS. Depois, com a pilha local no ar como na Task 7, `npx playwright test e2e/e09-t01-plano-contas.spec.ts`. Expected: PASS, com o `DATABASE_URL` do `.env` da raiz do worktree apontando para o banco de teste da fatia.

- [ ] **Step 5: Commit**

```powershell
git add app/frontend/e2e/limpar-plano.ts app/frontend/e2e/e09-t01-plano-contas.spec.ts app/frontend/__tests__/e09-t01-limpar-plano.test.ts
git commit -m @"
test(e09-t01): deriva o banco da limpeza do e2e do DATABASE_URL

### Descrição Detalhada:
Extrai limparPlano para e2e/limpar-plano.ts, que lê usuário e banco do DATABASE_URL, recusa banco sem sufixo de teste e usa TRUNCATE em cascata das três tabelas.

### Motivo da Mudança:
O spec apagava linhas de um banco de nome fixo, sem proteção e sem considerar tabelas da T02 que referenciem as da T01.

### Impacto:
O e2e falha cedo se apontar para banco que não é de teste. Não quebra quando a T02 não existe na branch.
"@
```

---

## Task 17: Opções de conta pai independentes da grade (P-r3-2, bloqueante do Portão 1 r3)

**Depende da Task 9** (`ultimaVersaoDecidida`, `vigencia.ts` e o helper `contaComV2Suspensa` do mesmo `describe`). Não cria permissão, menu, perfil, tabela nem migration: usa `CONTABILIDADE_PLANO_LER`, já existente.

**Files:**
- Modify: `app/backend/src/modules/contabilidade/plano/vigencia.ts`
- Modify: `app/backend/src/modules/contabilidade/plano/dto/plano.dto.ts`
- Modify: `app/backend/src/modules/contabilidade/plano/plano.service.ts`
- Modify: `app/backend/src/modules/contabilidade/plano/plano.controller.ts`
- Modify: `app/backend/test/integration/plano-contas.e2e-spec.ts`
- Create: `app/frontend/src/app/api/contabilidade/plano/opcoes-pai/route.ts`
- Modify: `app/frontend/src/app/(admin)/erp/contabilidade/plano-de-contas/plano-contas-client.tsx`
- Modify: `app/frontend/e2e/e09-t01-plano-contas.spec.ts`
- Create: `app/frontend/__tests__/plano-contas-opcoes-pai.test.tsx`
- Create: `app/frontend/__tests__/bff-plano-opcoes-pai.test.ts`

Causa lida: `plano-contas-client.tsx` L632 monta o combo de conta pai com `contas`, o estado preenchido por `carregar` (L225 a L249) com a página corrente de 20 linhas já filtrada por busca e situação da grade, e só aceita a linha cuja situação exibida é `APPROVED`. Com mais de 20 contas, na página 2, com o filtro Rascunho ou com a conta aprovada que tem a v2 em rascunho (a linha da grade mostra a v2), um pai que o backend aceitaria não pode ser escolhido. O backend (`paiValido` L234, Tasks 9 e 10) é a autoridade; a tela precisa de uma lista própria, vinda do mesmo critério.

Regra das opções (D3 e Task 9): conta com `deleted_at` nulo cuja `ultimaVersaoDecidida` é `APPROVED` e `sintetica`. D3 exige pai sintético (`paiValido`, L248 a L250, recusa pai analítico), então só sintéticas entram, e a classificação lida é a da versão decidida, a mesma que `exigirPaiVigente` confere. Janela de data (`vigencia_inicio` e `vigencia_fim`) não entra: nem `exigirPaiVigente` nem o `ciclo` a aplicam, e a opção existe exatamente quando o backend aceitaria. Ordem por `codigo`. A resposta tem só `codigo` e `nome` (D9, sem UUID). Há busca (`q`, por código ou nome) e teto de 50 itens (`LIMITE_OPCOES_PAI`), porque o plano de contas não tem tamanho máximo; passando do teto a resposta traz `truncado: true` e o combo mostra a orientação de refinar a busca. A carga é por demanda, como em `pesquisarCentros` (L339 a L351), com erro tratado, e a busca por texto segue `clientes.service.ts`.

**Padrão de UI (Portão 1 r4, Princípio I).** O protótipo não tem campo de busca permanente no formulário. O campo `relation` é um `select` com o botão `Pesquisar` ao lado (`aplicacao.js` L412, `title` "Pesquisar cadastro pelo nome"); o botão abre `openLookup` (L486 a L494): popup `lookup-popup` com o `lookup-card` (título `Selecionar <rótulo>`, botão `Fechar`, `input` `type="search"` com `aria-label="Pesquisar cadastro"` e placeholder "Pesquisar pelo nome ou descrição", lista de botões `lookup-option` com `<b>` nome e `<small>` detalhe, e a dica "A seleção utiliza uma referência interna invisível, nunca digitação de GUID."). Escolher uma opção grava o valor no `select` e fecha o popup (L507). A matriz UX L940 manda "Combo de cadastro com busca". Aqui o popup é alimentado por `GET /contabilidade/plano/opcoes-pai?q=` em vez do catálogo local.

Reuso lido no frontend: nenhum componente implementa esse `lookup-card`/`Pesquisar` (busca de `lookup-card`, `lookup-popup` e `Pesquisar cadastro` em `app/frontend/src` e `e2e`: 0 ocorrências; as regras CSS `.lookup-popup` e `.lookup-card` só existem no protótipo, `docs/prototipos/erp-integrado-v1`, L71 e L72 do CSS). O `ComboboxField` (`app/frontend/src/components/ui/combobox-field.tsx`, usado em clientes, pedidos, rotas e outras telas) é um popover `Command` sem botão `Pesquisar` nem cartão; adotá-lo trocaria o padrão do protótipo por outro e por isso foi descartado. O popup é escrito no próprio `plano-contas-client.tsx`, com as classes Tailwind equivalentes às duas regras CSS (`fixed inset-0 z-[120] grid place-items-center bg-[rgba(17,32,50,.4)] p-3.5` e `w-[min(490px,95vw)] overflow-hidden rounded-[9px] bg-white shadow-lg`). Não se cria componente compartilhado nem se altera outro cliente.

- [ ] **Step 1: Write the failing tests**

`plano-contas.e2e-spec.ts`: acrescentar `LIMITE_OPCOES_PAI` ao import de `'../../src/modules/contabilidade/plano/vigencia'` (feito na Task 9 só para `ultimaVersaoDecidida`). Antes do `});` final do `describe` principal:

```ts
  describe('opções de conta pai', () => {
    const opcoes = (qs = '', cookies = adminCookies) =>
      request(srv()).get(`/contabilidade/plano/opcoes-pai${qs}`).set('Cookie', cookies);
    const codigosDe = (res: request.Response) => (res.body.itens as { codigo: string }[]).map((i) => i.codigo);
    const grade = (pagina: number, extra: { q?: string; situacao?: '' | 'DRAFT' } = {}) =>
      service.listar({ pagina, q: extra.q ?? '', situacao: extra.situacao ?? '', ordenar: 'contaContabil', direcao: 'asc' });

    async function sinteticasAprovadas(quantidade: number) {
      await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
      for (let i = 1; i <= quantidade; i += 1) {
        const n = String(i).padStart(2, '0');
        await service.criar(dtoBase({ codigo: `C${n}`, nome: `Conta ${n}`, classificacao: 'sintetica' }), userId);
        await aprovarDireto(`C${n}`);
      }
    }

    it('pai fora da página 1 da grade aparece e a criação com ele funciona', async () => {
      await sinteticasAprovadas(25);
      const primeira = await grade(1);
      const segunda = await grade(2);
      expect(primeira.total).toBe(25);
      expect(primeira.itens).toHaveLength(20);
      const foraDaPagina = segunda.itens[0]!.codigo;
      expect(primeira.itens.map((i) => i.codigo)).not.toContain(foraDaPagina);

      const res = await opcoes();
      expect(res.status).toBe(200);
      expect(res.body.truncado).toBe(false);
      expect(codigosDe(res)).toHaveLength(25);
      expect(codigosDe(res)).toContain(foraDaPagina);

      const criada = await request(srv()).post('/contabilidade/plano').set('Cookie', adminCookies)
        .send(dtoBase({ codigo: 'FILHA', nome: 'Filha', classificacao: 'analitica', contaPaiCodigo: foraDaPagina }));
      expect(criada.status).toBe(201);
      expect(criada.body.contaPaiCodigo).toBe(foraDaPagina);
    });

    it('o filtro e a busca da grade não reduzem as opções', async () => {
      await sinteticasAprovadas(3);
      const filtrada = await grade(1, { q: 'zzz', situacao: 'DRAFT' });
      expect(filtrada.total).toBe(0);
      expect(codigosDe(await opcoes())).toEqual(['C01', 'C02', 'C03']);
    });

    it('pai aprovado com v2 em rascunho aparece, com o nome da versão vigente', async () => {
      await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
      await service.criar(dtoBase({ codigo: '1', nome: 'Caixa e bancos', classificacao: 'sintetica' }), userId);
      const v1 = await promover('1');
      await service.versionar('1', comoEdicao(v1, { nome: 'Caixa novo', justificativa: 'abre v2' }), userId);
      expect((await opcoes()).body.itens).toEqual([{ codigo: '1', nome: 'Caixa e bancos' }]);
    });

    it('pai com v1 aprovada e v2 suspensa não aparece', async () => {
      await contaComV2Suspensa();
      const res = await opcoes();
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ itens: [], truncado: false });
    });

    it('só entram sintéticas cuja última versão decidida é aprovada, igual a ultimaVersaoDecidida', async () => {
      await contaAprovadaAnalitica();
      await service.criar(dtoBase({ codigo: '2', nome: 'Só rascunho', classificacao: 'sintetica' }), userId);
      await service.criar(dtoBase({ codigo: '3', nome: 'Com revisão aberta', classificacao: 'sintetica' }), userId);
      const v1 = await promover('3');
      await service.versionar('3', comoEdicao(v1, { justificativa: 'abre v2' }), userId);
      await service.revisarCompetencia('3', { numero: 2, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa v2' }, userId);

      const esperados: string[] = [];
      for (const conta of await db.select().from(contasContabeis)) {
        const decidida = await ultimaVersaoDecidida(db, conta.id);
        if (decidida?.situacao === 'APPROVED' && decidida.classificacao === 'sintetica') esperados.push(conta.codigo);
      }
      expect(esperados.sort()).toEqual(['1', '3']);
      expect(codigosDe(await opcoes())).toEqual(esperados.sort());
    });

    it('busca por código ou nome sem caixa, e % é literal', async () => {
      await sinteticasAprovadas(3);
      expect(codigosDe(await opcoes('?q=conta%2002'))).toEqual(['C02']);
      expect(codigosDe(await opcoes('?q=c03'))).toEqual(['C03']);
      expect((await opcoes('?q=%25')).body.itens).toEqual([]);
    });

    it('passando do teto responde truncado e a busca devolve a conta fora dele', async () => {
      await sinteticasAprovadas(LIMITE_OPCOES_PAI + 1);
      const res = await opcoes();
      expect(res.body.itens).toHaveLength(LIMITE_OPCOES_PAI);
      expect(res.body.truncado).toBe(true);
      const ultima = `C${LIMITE_OPCOES_PAI + 1}`;
      expect(codigosDe(await opcoes(`?q=${ultima}`))).toEqual([ultima]);
      expect((await opcoes(`?q=${ultima}`)).body.truncado).toBe(false);
    });

    it('exige a permissão de leitura e não devolve identificador', async () => {
      await sinteticasAprovadas(2);
      expect((await opcoes('', comercialCookies)).status).toBe(403);
      expect((await request(srv()).get('/contabilidade/plano/opcoes-pai')).status).toBe(401);
      const res = await opcoes();
      for (const item of res.body.itens as object[]) expect(Object.keys(item).sort()).toEqual(['codigo', 'nome']);
      expect(JSON.stringify(res.body)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    });
  });
```

`app/frontend/__tests__/plano-contas-opcoes-pai.test.tsx`:

```tsx
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanoContasClient, type ContaGrade } from '../src/app/(admin)/erp/contabilidade/plano-de-contas/plano-contas-client';

const linha = (codigo: string, nome: string): ContaGrade => ({
  codigo, nome, situacaoRotulo: 'Aprovado', naturezaRotulo: 'Ativo', centroNome: 'Operação industrial',
  vigenciaInicio: '2026-10-01', vigenciaFim: null, classificacaoRotulo: 'sintética', grupo: 'Circulante',
  contaPaiCodigo: null, centroCodigo: 'CT1', situacao: 'APPROVED', natureza: 'ATIVO', classificacao: 'sintetica',
  numero: 1, responsavelNome: 'Administrador', criadoEm: '2026-10-15T10:00:00.000Z', alteradoEm: '2026-10-15T10:00:00.000Z',
});

type Opcoes = { itens: { codigo: string; nome: string }[]; truncado?: boolean };
type Resposta = Opcoes | { falha: Response } | { rede: true };

function resposta(r: Resposta): Response {
  if ('falha' in r) return r.falha;
  return { ok: true, status: 200, json: async () => ({ truncado: false, ...(r as Opcoes) }) } as Response;
}

function mockFetch(opcoes: Resposta | ((q: string) => Promise<Response>)) {
  const chamadas: string[] = [];
  const posts: { url: string; corpo: string }[] = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    chamadas.push(String(url));
    if (init?.method === 'POST') posts.push({ url: String(url), corpo: String(init.body) });
    if (!String(url).startsWith('/api/contabilidade/plano/opcoes-pai')) {
      return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' } as Response;
    }
    if (typeof opcoes === 'function') return opcoes(new URL(String(url), 'http://x').searchParams.get('q') ?? '');
    if ('rede' in opcoes) throw new TypeError('Failed to fetch');
    return resposta(opcoes);
  }) as unknown as typeof fetch;
  return { chamadas, posts };
}

const campoPai = () => screen.getByPlaceholderText('Selecione conta contábil');

async function abrirDrawer() {
  await userEvent.click(screen.getByRole('button', { name: '+ Novo registro' }));
}

async function abrirPesquisaPai(drawerAberto = false) {
  if (!drawerAberto) await abrirDrawer();
  const botoes = screen.getAllByRole('button', { name: 'Pesquisar' });
  await userEvent.click(botoes[botoes.length - 1]!);
  return screen.findByRole('dialog', { name: 'Selecionar Conta contábil' });
}

describe('lookup de conta pai (padrão Pesquisar do protótipo)', () => {
  it('abrir o drawer não consulta; o botão Pesquisar abre o popup com as opções do backend e não as da grade', async () => {
    const { chamadas } = mockFetch({ itens: [{ codigo: 'P99', nome: 'Pai de outra página' }] });
    render(<PlanoContasClient inicial={[linha('G1', 'Só na grade')]} />);
    await abrirDrawer();
    expect(chamadas).toEqual([]);
    expect(screen.queryByLabelText('Buscar conta contábil')).not.toBeInTheDocument();
    const popup = await abrirPesquisaPai(true);
    await waitFor(() => expect(chamadas).toContain('/api/contabilidade/plano/opcoes-pai?q='));
    expect(await within(popup).findByRole('button', { name: /Pai de outra página/ })).toBeInTheDocument();
    expect(within(popup).queryByRole('button', { name: /Só na grade/ })).not.toBeInTheDocument();
    expect(within(popup).getByLabelText('Pesquisar cadastro')).toHaveAttribute('type', 'search');
    expect(within(popup).getByText('A seleção utiliza uma referência interna invisível, nunca digitação de GUID.')).toBeInTheDocument();
  });

  it('a busca dentro do popup consulta o backend com o texto digitado', async () => {
    const { chamadas } = mockFetch({ itens: [] });
    render(<PlanoContasClient inicial={[]} />);
    const popup = await abrirPesquisaPai();
    await userEvent.type(within(popup).getByLabelText('Pesquisar cadastro'), 'cx');
    await waitFor(() => expect(chamadas).toContain('/api/contabilidade/plano/opcoes-pai?q=cx'));
  });

  it('escolher uma opção grava o pai no select, fecha o popup e o Criar envia o código', async () => {
    const { posts } = mockFetch({ itens: [{ codigo: 'P99', nome: 'Pai de outra página' }] });
    render(<PlanoContasClient inicial={[]} />);
    const popup = await abrirPesquisaPai();
    await userEvent.click(await within(popup).findByRole('button', { name: /Pai de outra página/ }));
    expect(screen.queryByRole('dialog', { name: 'Selecionar Conta contábil' })).not.toBeInTheDocument();
    expect(campoPai()).toHaveValue('P99');
    expect(campoPai()).toHaveDisplayValue('Pai de outra página');
    await userEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(posts.find((post) => post.url === '/api/contabilidade/plano')?.corpo).toContain('"contaPaiCodigo":"P99"'));
  });

  it('Fechar descarta o popup sem alterar o pai', async () => {
    mockFetch({ itens: [{ codigo: 'P99', nome: 'Pai de outra página' }] });
    render(<PlanoContasClient inicial={[]} />);
    const popup = await abrirPesquisaPai();
    await userEvent.click(within(popup).getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog', { name: 'Selecionar Conta contábil' })).not.toBeInTheDocument();
    expect(campoPai()).toHaveValue('');
  });

  it('avisa quando a lista foi cortada no teto', async () => {
    mockFetch({ itens: [{ codigo: 'P1', nome: 'Primeira' }], truncado: true });
    render(<PlanoContasClient inicial={[]} />);
    const popup = await abrirPesquisaPai();
    expect(await within(popup).findByText('Refine a busca para ver mais contas.')).toBeInTheDocument();
  });

  it('mostra a falha do backend no popup em vez de lista vazia silenciosa', async () => {
    mockFetch({ falha: { ok: false, status: 500, text: async () => JSON.stringify({ message: 'Falha ao carregar as contas' }) } as Response });
    render(<PlanoContasClient inicial={[]} />);
    const popup = await abrirPesquisaPai();
    expect(await within(popup).findByText('Falha ao carregar as contas')).toBeInTheDocument();
  });

  it('rede caída é capturada: mostra o erro no popup e não gera rejeição não tratada', async () => {
    const rejeicoes: unknown[] = [];
    const aoRejeitar = (motivo: unknown) => rejeicoes.push(motivo);
    process.on('unhandledRejection', aoRejeitar);
    try {
      mockFetch({ rede: true });
      render(<PlanoContasClient inicial={[]} />);
      const popup = await abrirPesquisaPai();
      expect(await within(popup).findByText('Não foi possível carregar as contas. Tente novamente.')).toBeInTheDocument();
      await new Promise((resolver) => setTimeout(resolver, 0));
      expect(rejeicoes).toEqual([]);
    } finally {
      process.off('unhandledRejection', aoRejeitar);
    }
  });

  it('falha de pedido obsoleto não mostra erro nem apaga a lista do pedido mais novo', async () => {
    let falharPrimeiro: (r: Response) => void = () => undefined;
    const primeiro = new Promise<Response>((resolver) => { falharPrimeiro = resolver; });
    mockFetch((q) => (q === ''
      ? primeiro
      : Promise.resolve(resposta({ itens: [{ codigo: 'P7', nome: 'Pai recente' }] }))));
    render(<PlanoContasClient inicial={[]} />);
    const popup = await abrirPesquisaPai();
    await userEvent.type(within(popup).getByLabelText('Pesquisar cadastro'), 'a');
    expect(await within(popup).findByRole('button', { name: /Pai recente/ })).toBeInTheDocument();
    falharPrimeiro({ ok: false, status: 500, text: async () => JSON.stringify({ message: 'Falha antiga' }) } as Response);
    await new Promise((resolver) => setTimeout(resolver, 0));
    expect(screen.queryByText('Falha antiga')).not.toBeInTheDocument();
    expect(within(popup).getByRole('button', { name: /Pai recente/ })).toBeInTheDocument();
  });

  it('rede caída de pedido obsoleto também não mostra erro', async () => {
    let rejeitarPrimeiro: (e: unknown) => void = () => undefined;
    const primeiro = new Promise<Response>((_ok, rejeitar) => { rejeitarPrimeiro = rejeitar; });
    mockFetch((q) => (q === '' ? primeiro : Promise.resolve(resposta({ itens: [{ codigo: 'P7', nome: 'Pai recente' }] }))));
    render(<PlanoContasClient inicial={[]} />);
    const popup = await abrirPesquisaPai();
    await userEvent.type(within(popup).getByLabelText('Pesquisar cadastro'), 'a');
    expect(await within(popup).findByRole('button', { name: /Pai recente/ })).toBeInTheDocument();
    rejeitarPrimeiro(new TypeError('Failed to fetch'));
    await new Promise((resolver) => setTimeout(resolver, 0));
    expect(screen.queryByText('Não foi possível carregar as contas. Tente novamente.')).not.toBeInTheDocument();
  });
});
```

`app/frontend/__tests__/bff-plano-opcoes-pai.test.ts`:

```ts
const mockApiFetch = jest.fn();

jest.mock('next/server', () => ({
  NextRequest: class {
    nextUrl: URL;
    constructor(url: string) { this.nextUrl = new URL(url); }
  },
  NextResponse: class {
    status: number;
    constructor(_corpo: unknown, init?: { status?: number }) { this.status = init?.status ?? 200; }
  },
}));
jest.mock('@/lib/api', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/contabilidade/plano/opcoes-pai/route';

it('repassa a consulta ao backend e devolve o status dele', async () => {
  mockApiFetch.mockResolvedValue({ status: 403, text: async () => '{"message":"Forbidden"}' });
  const res = await GET(new NextRequest('http://interno/api/contabilidade/plano/opcoes-pai?q=cx') as never);
  expect(mockApiFetch).toHaveBeenCalledWith('/contabilidade/plano/opcoes-pai?q=cx', { method: 'GET' });
  expect(res.status).toBe(403);
});
```

- [ ] **Step 2: Run to verify failure**

Em `app/backend`: `npx jest test/integration/plano-contas.e2e-spec.ts --runInBand`. Em `app/frontend`: `npx jest __tests__/plano-contas-opcoes-pai.test.tsx __tests__/bff-plano-opcoes-pai.test.ts`.

Expected: FAIL em todos. Backend: `LIMITE_OPCOES_PAI` não é exportado de `vigencia` (erro de tipo do ts-jest); sem o import, `GET /contabilidade/plano/opcoes-pai` responde 404 em vez de 200, 403 e 401. Frontend: a rota `opcoes-pai/route` não existe e o combo ainda é montado de `contas`.

- [ ] **Step 3: Write minimal implementation**

`vigencia.ts`: trocar a linha de import do `drizzle-orm` por `import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';` e acrescentar ao final do arquivo:

```ts
/** Teto da lista de opções de conta pai; acima dele a busca (`q`) reduz o resultado. */
export const LIMITE_OPCOES_PAI = 50;

/**
 * Contas que o backend aceitaria como pai: a última versão decidida (a mesma de
 * `ultimaVersaoDecidida`) é APPROVED e sintética. Não depende de página nem de filtro da grade.
 * Uma consulta só (DISTINCT ON) em vez de uma por conta. `q` filtra por código ou nome, sem caixa;
 * `%`, `_` e `\` do texto são literais.
 */
export async function opcoesPaiVigentes(
  executor: Pick<NodePgDatabase<typeof schema>, 'execute'>,
  q: string,
  limite: number,
) {
  const padrao = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
  const resultado = await executor.execute(sql`
    select d.codigo, d.nome
      from (
        select distinct on (c.id) c.codigo, v.nome, v.classificacao, v.situacao
          from contas_contabeis c
          join conta_versoes v on v.conta_id = c.id
         where c.deleted_at is null
           and v.deleted_at is null
           and v.situacao in ('APPROVED', 'SUSPENDED')
         order by c.id, v.numero desc
      ) d
     where d.situacao = 'APPROVED'
       and d.classificacao = 'sintetica'
       and (${q} = '' or d.codigo ilike ${padrao} escape '\\' or d.nome ilike ${padrao} escape '\\')
     order by d.codigo
     limit ${limite}`);
  return resultado.rows as { codigo: string; nome: string }[];
}
```

`plano.dto.ts`: acrescentar depois de `listarPlanoSchema` e junto aos tipos:

```ts
export const opcoesPaiSchema = z.object({ q: z.string().trim().max(180).default('') });
export type OpcoesPaiQuery = z.infer<typeof opcoesPaiSchema>;
```

`plano.service.ts`: importar `LIMITE_OPCOES_PAI` e `opcoesPaiVigentes` de `./vigencia` (junto de `ultimaVersaoDecidida`), `type OpcoesPaiQuery` de `./dto/plano.dto`, e acrescentar ao lado de `listarCentrosAtivos`:

```ts
  async listarOpcoesPai(query: OpcoesPaiQuery) {
    const linhas = await opcoesPaiVigentes(this.db, query.q, LIMITE_OPCOES_PAI + 1);
    return { itens: linhas.slice(0, LIMITE_OPCOES_PAI), truncado: linhas.length > LIMITE_OPCOES_PAI };
  }
```

`plano.controller.ts`: importar `opcoesPaiSchema` e `type OpcoesPaiQuery` e acrescentar antes de `@Get('plano/:codigo/historico')`:

```ts
  @Get('plano/opcoes-pai')
  @RequirePermissoes('CONTABILIDADE_PLANO_LER')
  opcoesPai(@Query(new ZodValidationPipe(opcoesPaiSchema)) query: OpcoesPaiQuery) {
    return this.plano.listarOpcoesPai(query);
  }
```

`app/frontend/src/app/api/contabilidade/plano/opcoes-pai/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

export async function GET(req: NextRequest) {
  return repassar(`/contabilidade/plano/opcoes-pai${req.nextUrl.search}`);
}
```

`plano-contas-client.tsx`:

1. `import { useEffect, useRef, useState } from 'react';` (L3) e, junto aos tipos (L64): `type OpcaoPai = { codigo: string; nome: string };`.
2. Estados, ao lado de `centros` (L206):

```tsx
  const [lookupPai, setLookupPai] = useState(false);
  const [paisOpcoes, setPaisOpcoes] = useState<OpcaoPai[]>([]);
  const [paisTruncado, setPaisTruncado] = useState(false);
  const [paiBusca, setPaiBusca] = useState('');
  const [paiRotulo, setPaiRotulo] = useState('');
  const [erroPais, setErroPais] = useState('');
  const pedidoPais = useRef(0);
```

3. Funções ao lado de `pesquisarCentros`. Todo o corpo de `carregarPais` está em `try/catch` (nenhuma rejeição escapa do `void`) e o contador de pedido é conferido em todos os ramos, inclusive nos de erro:

```tsx
  async function carregarPais(q: string) {
    const pedido = (pedidoPais.current += 1);
    const atual = () => pedido === pedidoPais.current;
    try {
      const resposta = await fetch(`/api/contabilidade/plano/opcoes-pai?q=${encodeURIComponent(q)}`);
      if (!resposta.ok) {
        const mensagem = await lerMensagem(resposta);
        if (atual()) setErroPais(mensagem || 'Não foi possível carregar as contas. Tente novamente.');
        return;
      }
      const corpo = await resposta.json() as { itens?: OpcaoPai[]; truncado?: boolean };
      if (!atual()) return;
      setErroPais('');
      setPaisOpcoes(corpo.itens ?? []);
      setPaisTruncado(corpo.truncado === true);
    } catch {
      if (atual()) setErroPais('Não foi possível carregar as contas. Tente novamente.');
    }
  }

  function abrirPesquisaPai() {
    setPaiBusca('');
    setErroPais('');
    setLookupPai(true);
    void carregarPais('');
  }

  function escolherPai(opcao: OpcaoPai) {
    setForm({ ...form, contaPaiCodigo: opcao.codigo });
    setPaiRotulo(opcao.nome);
    setLookupPai(false);
  }
```

4. Em `abrirCriar` e `abrirEditar`, depois do `setDrawer(...)`: `setPaiRotulo(''); setLookupPai(false);`. Nada é carregado ao abrir o drawer; a consulta só acontece quando o usuário clica em `Pesquisar`, como no protótipo.
5. Substituir o `<label htmlFor="conta-pai">` e o `<select id="conta-pai">` (L629 a L635) pelo campo `relation` do protótipo: o `select` (rótulo `Conta contábil` e placeholder `Selecione conta contábil`, ambos já existentes) com o botão `Pesquisar` ao lado:

```tsx
          <label htmlFor="conta-pai">Conta contábil</label>
          <div className="flex items-center gap-2">
            <select id="conta-pai" ref={(elemento) => { elemento?.setAttribute('placeholder', 'Selecione conta contábil'); }} value={form.contaPaiCodigo} onChange={(evento) => setForm({ ...form, contaPaiCodigo: evento.target.value })}>
              <option value="">Selecione conta contábil</option>
              {form.contaPaiCodigo && <option value={form.contaPaiCodigo}>{paiRotulo || form.contaPaiCodigo}</option>}
            </select>
            <button type="button" title="Pesquisar cadastro pelo nome" onClick={abrirPesquisaPai}>Pesquisar</button>
          </div>
```

   O `select` só tem o placeholder e o pai já escolhido (na edição, o código gravado até o usuário pesquisar de novo); a lista de candidatos vive no popup. Não há `<label>` nem `<input>` novo de busca no formulário. Os dois botões `Pesquisar` do drawer (centro de custo, primeiro no DOM, e conta pai, último) se distinguem pela ordem: os testes Jest usam `getAllByRole` e o último, e o Playwright `.first()` e `.last()`.
6. O popup, junto do `{drawer && (...)}` (fora da `<section>`, para cobrir a tela como o `lookup-popup`). A própria conta não é oferecida como pai dela na edição (o backend também recusa, Task 10):

```tsx
      {lookupPai && (
        <div role="dialog" aria-label="Selecionar Conta contábil" className="fixed inset-0 z-[120] grid place-items-center bg-[rgba(17,32,50,.4)] p-3.5">
          <div className="w-[min(490px,95vw)] overflow-hidden rounded-[9px] bg-white shadow-lg">
            <div>
              <h2>Selecionar Conta contábil</h2>
              <button type="button" onClick={() => setLookupPai(false)}>Fechar</button>
            </div>
            <input
              type="search"
              autoFocus
              placeholder="Pesquisar pelo nome ou descrição"
              aria-label="Pesquisar cadastro"
              value={paiBusca}
              onChange={(evento) => { setPaiBusca(evento.target.value); void carregarPais(evento.target.value); }}
            />
            <div>
              {paisOpcoes.filter((opcao) => !(drawer === 'editar' && opcao.codigo === selecionada?.codigo)).map((opcao) => (
                <button type="button" key={opcao.codigo} onClick={() => escolherPai(opcao)}>
                  <b>{opcao.nome}</b>
                  <small>{opcao.codigo}</small>
                </button>
              ))}
            </div>
            {erroPais && <p role="alert">{erroPais}</p>}
            {paisTruncado && <p>Refine a busca para ver mais contas.</p>}
            <p>A seleção utiliza uma referência interna invisível, nunca digitação de GUID.</p>
          </div>
        </div>
      )}
```

   O `<small>` mostra o código da conta (referência de negócio), nunca UUID. O botão `Pesquisar` deixa de ser só do centro de custo: serve também à conta pai, como em todo campo `relation` do protótipo.
7. Conferência dos rótulos (menor c). Os únicos rótulos novos são o `aria-label` `Selecionar Conta contábil` (popup) e `Pesquisar cadastro` (busca). Em `app/frontend`, confirmar que nenhum seletor não exato fora de `plano-contas-opcoes-pai.test.tsx` casa com eles:

```powershell
Select-String -Path e2e/*.ts, __tests__/*.ts, __tests__/*.tsx -Pattern "getByLabel(Text)?\('[^']*(Conta contábil|Pesquisar)[^']*'\)"
```

   Expected: nenhuma linha. Os usos atuais de `Conta contábil` e `Pesquisar` em `e2e/e09-t01-plano-contas.spec.ts` (L93, L113 e L182) são `getByRole` com `name` e `exact: true` ou `getByPlaceholder`, e não casam. Linha encontrada: torná-la exata antes de seguir.
8. `app/frontend/e2e/e09-t01-plano-contas.spec.ts`: em `criarCentro`, o clique no `Pesquisar` passa a `.first()` (L93: `page.getByRole('button', { name: 'Pesquisar', exact: true }).first().click()`); em `criarConta`, o bloco `if (dados.pai)` (L112 a L114) vira o fluxo do popup:

```ts
  if (dados.pai) {
    await page.getByRole('button', { name: 'Pesquisar', exact: true }).last().click();
    const lookup = page.getByRole('dialog', { name: 'Selecionar Conta contábil', exact: true });
    await lookup.getByLabel('Pesquisar cadastro', { exact: true }).fill('Grupo do ativo');
    await lookup.getByRole('button', { name: /Grupo do ativo/ }).click();
    await expect(lookup).toBeHidden();
    await expect(page.getByPlaceholder('Selecione conta contábil').locator('option:checked')).toHaveText('Grupo do ativo');
  }
```

- [ ] **Step 4: Run to verify it passes**

Em `app/backend`: `npx jest test/integration/plano-contas.e2e-spec.ts --runInBand` e `npx tsc --noEmit`. Em `app/frontend`: `npx jest __tests__/plano-contas-opcoes-pai.test.tsx __tests__/bff-plano-opcoes-pai.test.ts __tests__/plano-contas-apresentacao.test.tsx` e `npx tsc --noEmit`. Expected: PASS e sem erro de tipo. Depois, com a pilha local no ar como na Task 7: `npx playwright test e2e/e09-t01-plano-contas.spec.ts`. Expected: PASS; a seleção do pai (spec L112 a L114) passa a ser: clicar em `Pesquisar`, buscar no popup, escolher e criar; as opções vêm do endpoint e a conta pai aprovada antes aparece sem recarregar a grade.

- [ ] **Step 5: Commit**

```powershell
git add app/backend/src/modules/contabilidade/plano app/backend/test/integration/plano-contas.e2e-spec.ts app/frontend/src/app/api/contabilidade/plano/opcoes-pai "app/frontend/src/app/(admin)/erp/contabilidade/plano-de-contas/plano-contas-client.tsx" app/frontend/e2e/e09-t01-plano-contas.spec.ts app/frontend/__tests__/plano-contas-opcoes-pai.test.tsx app/frontend/__tests__/bff-plano-opcoes-pai.test.ts
git commit -m @"
fix(e09-t01): combo de conta pai vem de endpoint próprio, não da grade

### Descrição Detalhada:
Cria GET /contabilidade/plano/opcoes-pai (CONTABILIDADE_PLANO_LER) com as contas sintéticas cuja última versão decidida é APPROVED, busca por código ou nome, teto de 50 e sem identificador. O client usa o padrão do protótipo: select de conta pai com botão Pesquisar que abre o popup de busca alimentado pelo endpoint.

### Motivo da Mudança:
O combo usava a página corrente da grade, já filtrada. Pai válido em outra página, sob filtro ou com a v2 em rascunho não podia ser escolhido, contra a regra de vigência da Task 9.

### Impacto:
Sem permissão, perfil, menu nem migration. A tela passa a depender do novo endpoint para escolher o pai; o backend segue como autoridade da hierarquia.
"@
```

## Task 18: Renumeração da migration para 0049 (condicional, sempre a última)

**Pré-condição explícita.** Executar somente quando o coordenador indicar. A condição é `origin/develop` conter as migrations `0044` a `0048` da trilha E01, a última sendo `0048_e01_t05_homologacoes_regras`. Verificação, em `F:/Projetos/AlphaCarnes/.worktrees/e09-t01`:

```powershell
git fetch origin
git ls-tree --name-only origin/develop app/backend/src/database/migrations/ | ForEach-Object { Split-Path $_ -Leaf } | Where-Object { $_ -match '^004[4-8]_.*\.sql$' }
```

Saída esperada: cinco linhas, de `0044_...sql` a `0048_e01_t05_homologacoes_regras.sql`. Qualquer outro resultado: parar e devolver ao coordenador.

**Files:**
- Merge: `git merge origin/develop` (normal, sem rebase)
- Delete: `app/backend/src/database/migrations/0048_e09_t01_plano_contas.sql`
- Create (gerado): `app/backend/src/database/migrations/0049_e09_t01_plano_contas.sql` e `meta/0049_snapshot.json`
- Modify (gerado): `app/backend/src/database/migrations/meta/_journal.json`
- Modify (conflitos semânticos do merge, tabela abaixo): `app/backend/src/common/rbac/menus-canonicos.ts`, `perfil-permissoes.snapshot.json`, `perfil-menus.snapshot.json`, `app/frontend/src/lib/menu-v2.ts`, `app/frontend/__tests__/menu-rbac.test.ts`, `app/frontend/__tests__/menu-v2.test.ts`, `app/frontend/e2e/shell-ds.spec.ts`
- Create: `app/backend/test/unit/e09-t01-migration-meta.spec.ts`

Estado lido: o ramo tem `0048_e09_t01_plano_contas.sql` (65 linhas: três `CREATE TABLE`, sete índices, três `CREATE TRIGGER`), `meta/0048_snapshot.json` e a entrada `idx 44` com a tag `0048_e09_t01_plano_contas` no journal. No `origin/develop` o prefixo `0048` e o `idx` seguem a E01; o merge conflita em `meta/_journal.json` e `meta/0048_snapshot.json`. O teste segue o precedente `test/unit/onda11-migrations-meta.spec.ts`.

### Conflitos previstos no merge com a trilha E01

Lidos em `F:/Projetos/AlphaCarnes/.worktrees/e01-t05` (HEAD `35848f3`, trilha E01 completa, base `a698824`) e nesta branch (`143aec2`). A E01 deixa 44 rotas (39 operacionais e 5 em `/fiscal/`), 131 pares perfil x rota e 10 grupos com `FISCAL` em 8º. Esta fatia acrescenta 1 rota só do administrador. O resultado do merge tem de ser **11 grupos, 45 rotas e 132 pares** (126 da matriz v1.1, 5 fiscais e 1 do plano de contas), com `FISCAL` antes de `CONTABILIDADE` (ADR-ERP-024 L49 a L64: Fiscal 8º, Contabilidade 11º dos 13 grupos possíveis).

| Arquivo | E01 | Esta fatia | Resolução |
|---|---|---|---|
| `menus-canonicos.ts` | divide em `MENUS_OPERACIONAIS` (39), `MENUS_ERP` (5 `/fiscal/`) e `MENUS_CANONICOS = [...MENUS_OPERACIONAIS, ...MENUS_ERP]` | insere `/erp/contabilidade/plano-de-contas` dentro do array de 39 (L33) | Pode mesclar sem marcador de conflito e ainda assim errar, porque a rota cairia em `MENUS_OPERACIONAIS` (40). Mover a rota para o fim de `MENUS_ERP`; `MENUS_OPERACIONAIS` volta a 39. O array do gestor segue sem a rota |
| `perfil-permissoes.snapshot.json` | `FISCAL_*` nos perfis que a E01 definiu (219 linhas alteradas) | `CONTABILIDADE_PLANO_GERENCIAR` e `CONTABILIDADE_PLANO_LER` só no administrador | Lista ordenada: manter as duas contribuições na posição alfabética. Conferir com `perfil-permissoes-snapshot.spec.ts` |
| `perfil-menus.snapshot.json` | 5 rotas `/fiscal/` no administrador | `/erp/contabilidade/plano-de-contas` no administrador | Lista ordenada: administrador com 45 rotas; nenhum outro perfil muda. Conferir com `menu-rbac.test.ts` |
| `menu-v2.ts` | grupo `FISCAL` com 5 itens depois de `FATURAMENTO` | grupo `CONTABILIDADE` depois de `FATURAMENTO` | Ordem `FATURAMENTO`, `FISCAL`, `CONTABILIDADE`, `CADASTROS & REGRAS`, `ADMINISTRAÇÃO` |
| `menu-v2.test.ts` | `GRUPOS` com `FISCAL` (10), `ITENS_ERP` com 5, total 44, `FISCAL` na 8ª posição | `GRUPOS` com `CONTABILIDADE` (10), `operacionais` filtrado pelo href do plano, total 40 | `GRUPOS` com 11, `FISCAL` em `MENU_V2[7]` e `CONTABILIDADE` em `MENU_V2[8]`; `semFiscal` passa a excluir também o grupo `CONTABILIDADE`; `ITENS_ERP` ganha o 6º item `['CONTABILIDADE', 'Plano de contas e centros de custo', '/erp/contabilidade/plano-de-contas']` e o `it` que compara só o grupo `FISCAL` compara os 5 primeiros; totais 39 e 45 |
| `menu-rbac.test.ts` | `MATRIZ_RASTREABILIDADE` 39 rotas e 126 pares; `MATRIZ_ERP` 5; `MATRIZ_COMPLETA` 44 e 131; filtro `semFiscal` por `/fiscal/` | rota do plano dentro de `MATRIZ_RASTREABILIDADE` (40 e 127) | A rota sai de `MATRIZ_RASTREABILIDADE` e entra em `MATRIZ_ERP` (6 e 6); `MATRIZ_RASTREABILIDADE` volta a 39 e 126; `MATRIZ_COMPLETA` 45 e 132; o filtro `semFiscal` exclui `/fiscal/` e `/erp/`; as somas `130 + 1` das duas asserções viram 132 |
| `shell-ds.spec.ts` | `GRUPOS` com `FISCAL` (10) | `GRUPOS` com `CONTABILIDADE` (10) e título do teste | `GRUPOS` com 11 na ordem acima; título do `test` com 11 grupos |
| `permissoes.ts`, `perfis.service.ts` (`modulo: 'Fiscal'` e prefixo `CONTABILIDADE_`), `schema/index.ts`, `app.module.ts`, `realtime/events/eventos.ts` | acréscimos | acréscimos | Aditivos: manter os dois lados |
| `realtime.gateway.ts` | `podeAssinar(ws, room)` com rooms fiscais (+99 linhas) e `test/unit/realtime-gateway-rooms.spec.ts` | `podeAssinar(ws, room)` com a room `contabilidade-plano` | Os dois mudam a mesma assinatura. Manter as regras das duas rooms e rodar `realtime-gateway-rooms.spec.ts` e o `it` da room `contabilidade-plano` de `plano-contas.e2e-spec.ts` |

**Regra de recomputo.** Os números da tabela e deste parágrafo (11 grupos, 45 rotas, 132 pares, 39, 40, 44, 126, 127, 131 e os 10 grupos) foram lidos em `e01-t05` na data do plano e são **valores esperados a conferir, não valores a copiar**. Depois de resolver, os números não são copiados do plano: são recontados nos arquivos. `ROTAS_CANONICAS.length`, a soma de `menusDe(perfil)` nos 11 perfis e `MENU_V2.length` têm de dar 45, 132 e 11. Cada teste de menu que citava 39, 40, 44, 126, 127 ou 131 passa a usar o valor recontado, nunca um valor ajustado até passar.

**Critério de parada (devolver ao coordenador, sem commitar o merge).** (a) Os totais recontados forem diferentes de 11 grupos, 45 rotas e 132 pares. (b) `FISCAL` não ficar antes de `CONTABILIDADE`, ou outro grupo mudar de posição. (c) Qualquer perfil, além do administrador, ganhar a rota do plano de contas ou uma permissão `CONTABILIDADE_PLANO_*`, ou algum perfil perder uma permissão `FISCAL_*` que a E01 deu. (d) `MENUS_OPERACIONAIS` deixar de ter 39 itens. (e) Conflito em arquivo fora da tabela, ou conflito que exija escolher entre duas regras (e não somar as duas). (f) `perfil-permissoes-snapshot.spec.ts`, `menu-rbac.test.ts`, `menu-v2.test.ts` ou `realtime-gateway-rooms.spec.ts` falharem depois do recomputo.

- [ ] **Step 1: Write the failing test**

`app/backend/test/unit/e09-t01-migration-meta.spec.ts`:

```ts
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const MIGRATIONS = path.resolve(__dirname, '../../src/database/migrations');
const META = path.join(MIGRATIONS, 'meta');

interface Journal { entries: { idx: number; tag: string }[] }

describe('migration do plano de contas (E09-T01)', () => {
  const journal = JSON.parse(readFileSync(path.join(META, '_journal.json'), 'utf8')) as Journal;

  it('o journal tem a tag 0049_e09_t01_plano_contas uma única vez e nenhuma 0048_e09', () => {
    const tags = journal.entries.map((e) => e.tag);
    expect(tags.filter((t) => t === '0049_e09_t01_plano_contas')).toHaveLength(1);
    expect(tags.some((t) => t.startsWith('0048_e09'))).toBe(false);
    expect(tags).toContain('0048_e01_t05_homologacoes_regras');
  });

  it('idx do journal é crescente e sem repetição, e a tag 0049 é a última', () => {
    const idxs = journal.entries.map((e) => e.idx);
    expect(idxs).toEqual([...new Set(idxs)].sort((a, b) => a - b));
    expect(journal.entries.at(-1)?.tag).toBe('0049_e09_t01_plano_contas');
  });

  it('arquivos coincidem com a tag e o SQL mantém tabelas e triggers', () => {
    expect(readdirSync(MIGRATIONS).some((f) => f.startsWith('0048_e09'))).toBe(false);
    expect(existsSync(path.join(META, '0049_snapshot.json'))).toBe(true);
    const sql = readFileSync(path.join(MIGRATIONS, '0049_e09_t01_plano_contas.sql'), 'utf8');
    for (const tabela of ['centros_custo', 'contas_contabeis', 'conta_versoes']) {
      expect(sql).toContain(`CREATE TABLE "${tabela}"`);
      expect(sql).toContain(`CREATE TRIGGER trg_${tabela}_updated_at`);
    }
  });

  it('cada CREATE TRIGGER é precedido pela linha --> statement-breakpoint', () => {
    const sql = readFileSync(path.join(MIGRATIONS, '0049_e09_t01_plano_contas.sql'), 'utf8');
    expect(sql.match(/CREATE TRIGGER/g)).toHaveLength(3);
    expect(sql.match(/-->\s*statement-breakpoint\r?\nCREATE TRIGGER/g)).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run to verify failure**

`npx jest test/unit/e09-t01-migration-meta.spec.ts` em `app/backend`. Expected: FAIL: a tag atual é `0048_e09_t01_plano_contas`.

- [ ] **Step 3: Merge, remover a 0048 e regenerar como 0049**

```powershell
Set-Location F:/Projetos/AlphaCarnes/.worktrees/e09-t01
$antes = git rev-parse HEAD
git show "${antes}:app/backend/src/database/migrations/0048_e09_t01_plano_contas.sql" | Set-Content "$env:TEMP/e09-0048-original.sql"
git merge origin/develop
```

Conflitos esperados e resolução conforme a tabela acima. Para os dois arquivos de migration (`--theirs` é o `origin/develop` durante o merge):

```powershell
git checkout --theirs app/backend/src/database/migrations/meta/_journal.json app/backend/src/database/migrations/meta/0048_snapshot.json
git add app/backend/src/database/migrations/meta/_journal.json app/backend/src/database/migrations/meta/0048_snapshot.json
git rm -f app/backend/src/database/migrations/0048_e09_t01_plano_contas.sql
if (Select-String -Path app/backend/src/database/migrations/meta/_journal.json -Pattern 'e09' -Quiet) { throw 'journal ainda cita e09' }
```

Depois de resolver os demais arquivos pela tabela, **recontar nos arquivos resolvidos** antes de editar qualquer número de teste:

```powershell
# Recontagem, em F:/Projetos/AlphaCarnes/.worktrees/e09-t01 com o merge ainda não commitado
Set-Location app/backend
node -e "const j=require('./src/common/rbac/perfil-menus.snapshot.json');const v=Object.values(j);console.log('perfis',Object.keys(j).length,'pares',v.reduce((a,l)=>a+l.length,0),'rotas do administrador',j.administrador.length)"
Set-Location ../frontend
(Select-String -Path src/lib/menu-v2.ts -Pattern "^    title:").Count
(Select-String -Path src/lib/menu-v2.ts -Pattern "href: '/").Count
```

Contar também os itens de `MENUS_OPERACIONAIS` e de `MENUS_ERP` direto dos arrays em `menus-canonicos.ts` (linhas de rota entre `export const MENUS_OPERACIONAIS = [` e o `] as const` seguinte, e idem `MENUS_ERP`). Comparar com o esperado: 11 perfis, 132 pares, 45 rotas do administrador, 11 grupos, 45 `href` em `menu-v2.ts` e 39 operacionais. Número diferente é o critério de parada (a) ou (d), não motivo para ajustar o teste. Só com os números batendo, trocar nos testes de menu cada valor antigo (39, 40, 44, 126, 127, 131) pelo valor **recontado**, e então rodar a suíte. Depois, recontar de novo com a regra de recomputo, rodar `npx jest __tests__/menu-rbac.test.ts __tests__/menu-v2.test.ts` em `app/frontend` e `npx jest src/common/rbac test/unit/realtime-gateway-rooms.spec.ts` em `app/backend`. Só então `git commit --no-edit`. Qualquer item do critério de parada acima: `git merge --abort` e devolver ao coordenador.

Gerar com o drizzle-kit (o diff é entre o último snapshot do develop e `contabilidade-plano.schema.ts`):

```powershell
Set-Location app/backend
npx drizzle-kit generate --name e09_t01_plano_contas
Get-ChildItem src/database/migrations -Filter '*_e09_t01_plano_contas.sql' | Select-Object -ExpandProperty Name
```

Critério de parada: o nome impresso tem de ser exatamente `0049_e09_t01_plano_contas.sql`, e a última entrada do journal tem de ter a tag `0049_e09_t01_plano_contas`. Se o prefixo for outro (por exemplo `0048` ou `0050`), parar sem renomear à mão: `git checkout -- src/database/migrations/meta/_journal.json`, apagar só os dois arquivos gerados (o `.sql` e o snapshot novo) e devolver ao coordenador, porque outra trilha ocupou o ordinal.

Comparar o SQL e repor os triggers (o drizzle-kit não os emite):

```powershell
git diff --no-index --ignore-all-space "$env:TEMP/e09-0048-original.sql" src/database/migrations/0049_e09_t01_plano_contas.sql
```

A única diferença aceitável são os três `CREATE TRIGGER` ausentes no arquivo novo; qualquer diferença em tabela, coluna, índice ou `CHECK` é parada. Se faltarem só os triggers, acrescentar ao final de `0049_e09_t01_plano_contas.sql` o bloco idêntico ao final do original, **incluindo a linha `--> statement-breakpoint` que precede o primeiro `CREATE TRIGGER`** (no original é a linha 54, sozinha, depois do último índice):

```powershell
$original = Get-Content "$env:TEMP/e09-0048-original.sql" -Raw
$posTrigger = $original.IndexOf('CREATE TRIGGER trg_centros_custo_updated_at')
$posQuebra = $original.LastIndexOf('--> statement-breakpoint', $posTrigger)
if ($posTrigger -lt 0 -or $posQuebra -lt 0) { throw 'bloco de triggers não encontrado no original' }
$bloco = $original.Substring($posQuebra)
Add-Content src/database/migrations/0049_e09_t01_plano_contas.sql ("`n" + $bloco)
```

O `it` "cada CREATE TRIGGER é precedido pela linha --> statement-breakpoint" do Step 1 trava o resultado: sem a linha, o drizzle-orm executaria o último `CREATE UNIQUE INDEX` e o primeiro `CREATE TRIGGER` na mesma instrução.

Conferir a cadeia do snapshot e aplicar em banco vazio e descartável (distinto do banco da fatia). O `DATABASE_URL` da fatia é guardado antes e reposto no fim, mesmo com erro:

```powershell
$urlFatia = $env:DATABASE_URL
node -e "const m='./src/database/migrations/meta/';const a=require(m+'0048_snapshot.json'),b=require(m+'0049_snapshot.json');if(b.prevId!==a.id)process.exit(1)"
docker exec alphacarnes-postgres-1 psql -U alphacarnes -d postgres -c "CREATE DATABASE alphacarnes_e09_t01_mig"
try {
  $env:DATABASE_URL = 'postgres://alphacarnes:alphacarnes@localhost:15433/alphacarnes_e09_t01_mig'
  npm run db:migrate
  docker exec alphacarnes-postgres-1 psql -U alphacarnes -d alphacarnes_e09_t01_mig -c "select to_regclass('public.conta_versoes'), to_regclass('public.centros_custo'), to_regclass('public.contas_contabeis')"
} finally {
  $env:DATABASE_URL = $urlFatia
  docker exec alphacarnes-postgres-1 psql -U alphacarnes -d postgres -c "DROP DATABASE IF EXISTS alphacarnes_e09_t01_mig"
}
```

Expected: `db:migrate` com código 0 e as três tabelas existentes. Se `$urlFatia` estiver vazio aqui, a variável vem do `.env` da raiz: ler de lá em vez de seguir sem ela.

- [ ] **Step 4: Run to verify it passes**

O banco da fatia já tem a `0048_e09_t01_plano_contas` registrada no controle do drizzle e não tem as tabelas da E01; migrar por cima colidiria. Recriar e migrar, **só se o nome casar com o sufixo de teste da Task 16**, e só então rodar os testes:

```powershell
Set-Location F:/Projetos/AlphaCarnes/.worktrees/e09-t01/app/backend
if (-not $urlFatia) { throw 'DATABASE_URL da fatia ausente: definir antes de continuar' }
$banco = ([Uri]$urlFatia).AbsolutePath.TrimStart('/')
if ($banco -notmatch '_(e2e|test|e\d{2}_t\d{2})$') { throw "banco $banco não é de teste: recriação recusada" }
docker exec alphacarnes-postgres-1 psql -U alphacarnes -d postgres -c "DROP DATABASE IF EXISTS $banco WITH (FORCE)"
docker exec alphacarnes-postgres-1 psql -U alphacarnes -d postgres -c "CREATE DATABASE $banco"
$env:DATABASE_URL = $urlFatia
npm run db:migrate
npm run db:seed
```

Em `app/backend`: `npx jest test/unit/e09-t01-migration-meta.spec.ts`, `npx jest test/integration/plano-contas.e2e-spec.ts --runInBand` e `npm run test:cov` (gate de 80%). Em `app/frontend`: `npx jest`. Expected: PASS nos quatro. Sem a recriação, `test:cov` falha por tabelas da E01 ausentes e a `0049` colide com a `0048` já aplicada.

- [ ] **Step 5: Commit**

```powershell
git add app/backend/src/database/migrations app/backend/test/unit/e09-t01-migration-meta.spec.ts
git commit -m @"
chore(e09-t01): renumera a migration do plano de contas para 0049

### Descrição Detalhada:
Após o merge de origin/develop (migrations 0044 a 0048 da E01), remove a 0048_e09_t01 e seu snapshot e regenera como 0049_e09_t01_plano_contas com o drizzle-kit, mantendo o SQL equivalente e os três triggers set_updated_at.

### Motivo da Mudança:
O ordinal 0048 passou a pertencer à E01 (0048_e01_t05_homologacoes_regras). O teste de meta confere a tag, o idx, os arquivos e a linha statement-breakpoint antes de cada trigger.

### Impacto:
Banco novo aplica a 0049 sem diferença de esquema. Quem já aplicou a 0048 da E09 em banco local recria o banco de teste da fatia.
"@
```

Os arquivos de menu e de RBAC resolvidos no merge entram no commit do próprio merge (`git commit --no-edit`, Step 3), não neste.

**Rollback da Task 18** (o mesmo critério do rollback do delta). Antes do `git commit --no-edit` do merge: `git merge --abort`. Depois do commit do merge, com ou sem push: `git revert -m 1 <sha-do-merge>` e commit corretivo, com autorização do coordenador; nunca `reset --hard` nem force push. Se só o commit de renumeração (Step 5) estiver errado: `git revert <sha-do-commit>`.

---

## Fora desta fatia

- E09-T02 políticas de contabilização, E09-T03 diário/razão/lançamentos, E09-T04 demonstrações, E09-T05 apuração, E09-T06 CMV, E09-T07 SPED, E09-T08 fechamento, E09-T09 exportação contábil ampla.
- Menu e módulo Fiscal, migrations `0044`–`0047`, tabelas de empresa e de período.
- 12º perfil, concessão seed aos dez perfis que não são `administrador`, dual approval.
- Valor monetário, partida dobrada persistida, integração externa, fila `pending/reconcile`.
- Seed dos nomes fictícios `Caixa e bancos`, `Fornecedores a pagar`, `Receita operacional`, `Custo de mercadorias vendidas`, `Operação industrial` e `Administrativo` (`componentes.js` L2615–L2647). A tela nasce vazia com o texto de `sem registros`.

## Self-review

- Caderno B L437–L440: campos e ações têm task (3, 4 e 6). Partida dobrada não vira lançamento (D1). Empresa não vira FK (D5).
- Matriz UX L928–L947: grade, filtro, abas e estados têm task 6. O estado de serviço externo não é fabricado (D6).
- Enums de `componentes.js` L1688–L1708 e L1866–L1886 estão no CHECK da Task 2 e nos rótulos da Task 6.
- Review Focus 1–5 têm teste na Task 4, e o foco 3 tem teste na Task 3.
- `apresentar` da Task 3 é o contrato que a Task 5 e a Task 6 consomem, com os mesmos nomes de campo.
- r3: cada achado B1 a B4, cada menor M1 a M3, M5, M6 e AD-25 item 3 tem task e teste no mapa da seção "Correções da revisão crítica (r3)". Não há migration nas Tasks 8 a 17. A Task 18 é condicional, é sempre a última e só roda por indicação do coordenador.
- r3: nenhuma task toca `docs/execucao/` nem arquivo da E09-T02. A pendência P-r3-1 não tem task e está registrada na seção; a P-r3-2 virou a Task 17.
- r4: cada item do veredito do Portão 1 r3 (1 bloqueante e 8 menores) tem correção na subseção "Portão 1 r3 e correção (r4)". A Task 17 não cria permissão, perfil nem menu, e a Task 18 continua a última. Nenhuma task afirma tempo real na tela.
- r5: o bloqueante (campo fora do protótipo) e os menores (a) a (d) do Portão 1 r4 têm correção na subseção "Portão 1 r4 e correção (r5)", com o mapa achado, task e teste. O formulário volta a ter só os campos do protótipo; o `Pesquisar` da conta pai segue o `openLookup` (L486 a L494).
