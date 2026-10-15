# E09-T01 — Plano de contas e centros de custo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Histórico de revisões

| Rev. | Data | Autor | Motivo |
|---|---|---|---|
| r1 | 2026-10-15 | planner | versão inicial da fatia E09-T01 |
| r2 | 2026-10-15 | planner (nova instância) | Portão 1 r1 `ajustar` (6 achados; veredito `aa2b94b`, plano r1 `f0043b6`); ajuste cirúrgico: nenhum outro ponto do plano muda |

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
