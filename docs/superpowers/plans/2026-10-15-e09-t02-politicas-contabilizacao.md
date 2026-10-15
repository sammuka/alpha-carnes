# E09-T02 — Políticas de contabilização

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Histórico de revisões

| Rev. | Data | Autor | Motivo |
|---|---|---|---|
| r1 | 2026-10-15 | planner | versão inicial da fatia E09-T02 |
| r2 | 2026-10-15 | planner | Portão 1 r1 (`c52c27b`) pediu ajustar: envelope do `AllExceptionsFilter`, vigência só na ficha, Situação fora da ordenação, lote na seleção múltipla e o spec de serviço fora da Task 3 |
| r3 | 2026-10-15 | planner | revisão crítica preliminar independente (head `c4f99ee`, ramo `ebb40ed`): B2 conta suspensa aceita, B3 `ZodError` virando 500 e competência/valor inválidos, B7/AD-25 simulação 0,00, B8 Playwright (corrida do modal, sucesso sem confirmação do backend, dados fixos), `deletedAt` removido de `consulta()` e bloco de exceção fora da aba. Tasks 8–15 e seção "Correções da revisão crítica (r3)"; AD-25 (1), o vínculo de (2) e M7 registrados sem mudança |
| r4 | 2026-10-15 | planner | Portão 1 r3 (plano `a0b65cc`, blob `e6d072c6…`) deu ajustar: B1 o combo `listarContasAnaliticasVigentes` é da própria T02 e a T01 r3 não o corrige (Task 9 passa a corrigi-lo, exceção só dessa função ao critério de parada 2); B2 paginação sem controle na tela (nova Task 15); B3 `Exportar` e `Exportar visão` sem download, CSV de 20 linhas e injeção de fórmula (nova Task 16); menores 4 a 9 nas Tasks 8, 9, 11, 13 e 14. O veredito chama as novas de Tasks 16 e 17; aqui ficam 15 e 16 para a renumeração condicional continuar a última (agora Task 17). Delta puro sobre a r3: Tasks 1–7, 10 e 12 não mudam |

**Goal:** Entregar a tela Políticas de contabilização (`/erp/contabilidade/politicas-de-contabilizacao`) em que o administrador configura o mapeamento de débito e crédito de um evento fonte, simula o evento com balanceamento exato e aprova a regra com outra pessoa, sem gravar diário, razão ou partida.

**Architecture:** Módulo NestJS `contabilidade/politicas` é a autoridade da regra (Princípio III). A origem (`tipoEvento` + competência) nasce imutável. Conta de débito, conta de crédito e centro de custo são linhas já gravadas pela E09-T01; esta fatia não recria essas tabelas. Mutações rodam numa transação com `AuditoriaService.registrar` e só então emitem evento de domínio. Simular grava a memória da simulação e não grava lançamento. O BFF remove identificadores internos antes do browser. A UI copia os rótulos literais do protótipo e o selo Provisório da persona que não é perfil canônico.

**Tech Stack:** Node 22, NestJS 11, TypeScript 5 strict, Next.js 16 App Router/BFF, React 19, PostgreSQL 18, Drizzle + drizzle-kit, Zod 4, WebSocket nativo, JWT + RBAC (11 perfis, AD-04), Jest/Supertest, Playwright.

**Spec:** `docs/expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md` §E09-T02 (L446–L454); protótipo `docs/prototipos/erp-integrado-v1/index.html` (casca que carrega `catalogo.js`, `componentes.js` e `aplicacao.js`; a âncora `#E09-T02` é o `id` renderizado por `aplicacao.js`), `catalogo.js` L735–L747, `componentes.js` L5910–L5991 e os dicionários citados em D2, `aplicacao.js` L13–L14, L40–L43, L201–L203, L369 e L496, `MATRIZ-UX-COMPONENTES-61-TELAS.md` L949–L971 e `MATRIZ-INTEGRAL-INTERFACES.md` L335–L341.

**Conferência de rótulo (não houve parada):** título, ações, regras e exceções do Caderno B L447–L450 são a mesma frase de `catalogo.js` L743–L746. Os botões visíveis são o `titleCase` de `aplicacao.js` L14 sobre cada item de `actionNames` (`aplicacao.js` L40–L43), sem cortar palavra. A grade e o formulário usam o rótulo integral de `componentes.js` / matriz UX L952–L969. Onde o Caderno nomeia o dado e o widget usa outro rótulo, D2 registra o rótulo visível e a seção Decisões em aberto registra o que a fonte não liga.

**Classe de risco (AD-22 item 6):** alto risco. A fatia cria permissão e entrada de menu (RBAC/autorização) e persiste valor de simulação em `NUMERIC(15,2)`. Não há baixa, razão, cofre nem emissão fiscal. O Portão 1 confirma a classe. Rito da implementação: revisão crítica por commit, Portão 2 e Portão A.

**Ramo:** `feature/erp-e09-t02-politicas-contabilizacao`, worktree `F:/Projetos/AlphaCarnes/.worktrees/e09-t02`, ponta `93599bb` (E09-T01). O worker não faz rebase em `develop`, não commita na branch da T01 e não edita `docs/execucao/`.

## Global Constraints

- 11 perfis canônicos (AD-04). Personas `contador` e `controladoria` não entram no seed (AD-18 item 5; constituição L94). H-E01-12: permissão nova só no `administrador`. Persona não é 12º perfil.
- Permissões novas `CONTABILIDADE_POLITICA_LER` e `CONTABILIDADE_POLITICA_GERENCIAR` só no mapa do slug `administrador`. O array `gestor` de `menus-canonicos.ts` não recebe a rota. Snapshots dos outros dez slugs não ganham chave nem mudam de ordem.
- Selo visível `Provisório` na tela, via `BadgeProvisorio` com `texto="Provisório"`. Sem código P-xx.
- Palavra `Marca` banida em rótulo, entidade, coluna e teste novo (Princípio IX).
- UI, CSV, histórico, toast e menu não exibem UUID, `id`, nome de tabela nem o código `E09` / `E09-T02` (Caderno B L601). A chave interna de rascunho também não contém `e09-t02`.
- O valor interno do enum (`LIQUIDACAO` e os outros quatro) não aparece como texto. O combo mostra o rótulo.
- Dinheiro é `NUMERIC(15,2)`, transportado como string `^\d{1,13}\.\d{2}$`. Proibido `number`, `parseFloat` e float na soma. A comparação usa centavos em `bigint`.
- Datas desta fatia: `competencia` (`date`, dia 01) e `vigencia_inicio` (`date`). H-E01-10 continua aberta: não criar `data_comercial`, `data_fiscal` nem `data_efetiva`. `created_at` / `updated_at` / `deleted_at` são `timestamptz`.
- Status em `TEXT` + `CHECK`, PK `uuid` com `DEFAULT uuidv7()`, soft delete, índice em toda FK (`docs/data/convencoes-schema.md`).
- Regras críticas só no NestJS. Zod do DTO recusa forma (HTTP 400 pelo `ZodValidationPipe`, que não muda). Regra de negócio recusa HTTP 422 e conflito recusa HTTP 409. A `HttpException` carrega `{ message, codigo }`. O `AllExceptionsFilter` (`app/backend/src/common/filters/all-exceptions.filter.ts` L47–L53), registrado por `createTestApp`, responde `{ statusCode, message: { message, codigo }, timestamp, path, requestId }`. O teste de serviço afirma `response` da exceção. O teste HTTP afirma o envelope. `codigo` é o código de negócio da política, nunca um UUID.
- Zod 4: não chamar `.omit()` num schema que já tem `.refine()`. O objeto base fica sem refine; o refine entra só no schema exportado.
- Evento de domínio só depois do commit (Princípio VI). Falha não grava sucesso parcial (Princípio VII).
- `Button` do DS (`app/frontend/src/components/ui/button.tsx`) não tem `outline`. Ação principal usa a variante default. As demais usam `variant="secondary"`.
- Não criar empresa, estabelecimento, período contábil, lançamento, diário, razão, partida, SPED, apuração, menu Fiscal, módulo fiscal nem permissão fiscal. Não editar arquivos desses módulos.
- Não recriar `centros_custo`, `contas_contabeis` nem `conta_versoes`. Não renumerar `0048_e09_t01_plano_contas`. A migration desta branch é `0049`.
- As 39 rotas operacionais permanecem, na mesma ordem relativa. A rota da T01 `/erp/contabilidade/plano-de-contas` permanece, no mesmo grupo, imediatamente antes da rota nova.
- H-E01-11: não inventar quórum numérico. Aprovar exige uma pessoa diferente do autor. Não há segundo número, segundo perfil nem terceiro voto.
- Paginação server-side de 20 linhas (`componentes.js` L5950). Ordenação default `competencia` (`componentes.js` L5949).

## Review Focus

1. Simular ou aprovar sem conta de débito, sem conta de crédito, com conta ausente ou com conta que não está analítica e aprovada — a pessoa espera HTTP 422 `{ message: 'mapeamento ausente', codigo }` e nenhuma linha em `politica_simulacoes`, diário, razão ou partida.
2. Gravar segunda política com o mesmo tipo de ocorrência e a mesma competência — a pessoa espera HTTP 409 `{ message: 'evento duplicado', codigo }` da política já gravada e nenhuma linha nova.
3. Soma de débitos diferente da soma de créditos — a pessoa espera HTTP 422 `{ message: 'balanceamento exato', codigo }` e nenhuma gravação. Quando a simulação passa, débito e crédito persistidos são o mesmo `NUMERIC(15,2)`.
4. O autor aprova a própria regra — a pessoa espera HTTP 422 `{ message: 'aprovador diferente do autor', codigo }` e a situação continua `Rascunho`. O teste não procura um número de quórum.
5. Enviar outro tipo de ocorrência ou outra competência depois de gravada a origem — a pessoa espera HTTP 422 `{ message: 'origem imutável', codigo }` e os dois valores gravados permanecem.

## Decisões

### D1 — Escopo é configurar, simular e aprovar

Fonte: Caderno B L448–L450; pedido desta fatia. Entram configurar o mapeamento débito/crédito de um evento fonte, simular o evento e aprovar a regra. Saem E09-T03 a E09-T09. Simular e aprovar não inserem em tabela de diário, razão, lançamento ou partida. Sem mapeamento correto, a resposta é 422 `mapeamento ausente` e não há linha de simulação nem de lançamento. RI-B05 (Caderno B L634) proíbe contabilidade paralela: esta fatia não cria segundo razão.

`actions.primary` de `componentes.js` L5976 é `Revisar competência`. `renderScreen` (`aplicacao.js` L369) não desenha esse texto: os botões saem de `actionNames`. O Caderno B L448 também não lista revisar competência. Esta fatia não cria a transição nem o botão `Revisar competência`.

### D2 — Rótulos e campos

A grade usa só as colunas da matriz UX L952, nesta ordem: `Competência`, `Situação`, `Conta de débito`, `Conta de crédito`, `Centro de custo`, `Tipo de ocorrência`. Ordenáveis: as cinco de `componentes.js` L5942–L5948 (`Situação` fica de fora). Filtros: `Competência` e `Situação` (`componentes.js` L5966–L5968; matriz UX L953). O `select` hardcoded de `aplicacao.js` L170, com `stateTypes` de L8, não é o filtro desta tela. O combo Situação usa os cinco rótulos do enum `status`.

O formulário segue as seções de `componentes.js` L5912–L5931. Rótulos literais, sem abreviação:

| Chave | Rótulo | Controle | Fonte do rótulo |
|---|---|---|---|
| `contaDebitoCodigo` | `Conta de débito` | combo de cadastro, valor = código de negócio da conta | `componentes.js` L1275–L1285. Placeholder `Selecione conta de débito` (`aplicacao.js` L412) |
| `contaCreditoCodigo` | `Conta de crédito` | combo de cadastro | `componentes.js` L1287–L1297. Placeholder `Selecione conta de crédito` |
| `centroCodigo` | `Centro de custo` | combo de cadastro | `componentes.js` L883–L893. Placeholder `Selecione centro de custo` |
| `tipoEvento` | `Tipo de ocorrência` | combo fechado | `componentes.js` L1251–L1261 e enum L2168–L2189. Placeholder `Selecione tipo de ocorrência` |
| `competencia` | `Competência` | `input type="month"`, obrigatório | `componentes.js` L478–L488. Valor de API `YYYY-MM` |
| `enquadramentoFiscal` | `Enquadramento fiscal` | combo desabilitado, valor visível `—` | `componentes.js` L310–L320. Sem opção e sem POST. Ver Decisões em aberto |
| `vigenciaInicio` | `Início de vigência` | `input type="date"`, obrigatório | `componentes.js` L154–L164 |
| `situacao` | `Situação` | combo fechado, desabilitado em `Rascunho` no criar | `componentes.js` L178–L188 e enum L1688–L1708 |
| `justificativa` | `Justificativa auditável` no drawer | textarea | `componentes.js` L418–L428. A seção L5927–L5930 já inclui o campo, então `aplicacao.js` L436 não acrescenta `Motivo da alteração` |
| `justificativa` no modal | `Justificativa / observação` | textarea | `aplicacao.js` L496. Não trocar pelo rótulo do drawer |
| `valor` só no modal de simular | `Valor` | texto mascarado em pt-BR, enviado como string com ponto e dois decimais | `componentes.js` L454–L464. Não é coluna da grade (matriz L952 não lista `Valor`) |
| `numero` na ficha | `Versão` | somente leitura | Caderno B L447, palavra `versão`, com a primeira letra maiúscula como `titleCase` (`aplicacao.js` L14). Não é coluna da grade |

Dica de combo de cadastro no formulário: `Seleção vinculada ao cadastro; sem digitar identificadores.` (`aplicacao.js` L412). Dica na ficha: `Vinculado a cadastro existente; seleção obrigatória no formulário.` (`aplicacao.js` L186). Dica do enum: `Valor pertencente ao conjunto de opções do domínio.` (`aplicacao.js` L186).

Tipo de ocorrência, valor interno e rótulo: `LIQUIDACAO`/`Liquidação`, `REGISTRO`/`Registro de cobrança`, `CANCELAMENTO`/`Cancelamento`, `ESTORNO`/`Estorno`, `TARIFA`/`Tarifa`.

Situação, valor interno e rótulo: `DRAFT`/`Rascunho`, `REVIEW`/`Aguardando revisão`, `APPROVED`/`Aprovado`, `REJECTED`/`Rejeitado`, `SUSPENDED`/`Suspenso`.

`Configurar mappings` grava sempre `DRAFT`. O combo Situação no criar fica desabilitado em `Rascunho`. O POST não aceita `situacao`; o service grava `DRAFT`.

O código de negócio da API é `${tipoEvento}-${competencia}` (exemplo `LIQUIDACAO-2026-10`). Ele vai no JSON e no caminho HTTP. A tela não o imprime: a grade mostra o rótulo do tipo e a competência por extenso.

Botões de domínio, texto integral (`catalogo.js` L744 partido na vírgula e passado em `titleCase`): `Configurar mappings`, `Simular evento`, `Aprovar regra`. Não existem `Configurar`, `Mapear` nem `Mappings`. Não traduzir `mappings`.

### D3 — Origem, mapeamento e balanceamento

Fonte: Caderno B L449 (`origem imutável, não lançar sem mapeamento correto, balanceamento exato`).

- `tipoEvento` e `competencia` são gravados na política e não mudam. Corpo de edição que traga outro valor responde 422 `origem imutável` e não grava.
- O código de negócio derivado também não muda.
- Competência `YYYY-MM` persiste como `date` no dia 01. `CHECK` recusa outro dia.
- Conta de débito e conta de crédito precisam, cada uma, de uma versão `APPROVED`, `classificacao = 'analitica'`, `deleted_at` nulo na conta e na versão, `vigencia_inicio` ≤ data civil de `America/Sao_Paulo`, `vigencia_fim` nulo ou ≥ essa data. Senão, 422 `mapeamento ausente`.
- Centro de custo precisa existir com `deleted_at` nulo. Senão, 422 `mapeamento ausente`.
- A mesma conta nos dois lados não é recusada: a fonte não cria essa proibição (Decisões em aberto).
- Simular monta duas linhas com o mesmo `valor`: uma de débito e uma de crédito. `balancear` soma centavos com `bigint`. Se a soma divergir, 422 `balanceamento exato` e a transação não insere. Se passar, `politica_simulacoes.valor`, `.debito` e `.credito` são o mesmo `NUMERIC(15,2)`. O `CHECK` do banco repete `debito = credito AND valor = debito`.
- Simular não altera `situacao`. Simular não insere em tabela de diário, razão, lançamento ou partida.
- Aprovar sem uma simulação balanceada da mesma versão responde 422 `mapeamento ausente`.
- Segunda política com o mesmo código de negócio (o par tipo + competência) responde 409 `evento duplicado`, com o `codigo` da política já gravada.

`centavos('0.10') + centavos('0.20')` é `30n`, igual a `centavos('0.30')`. A implementação não passa por `Number`.

### D4 — Transições

Justificativa obrigatória em toda mutação (`componentes.js` L5977; `aplicacao.js` L451 e L499). O dicionário marca `justificativa.required = false`, então o rótulo do drawer não leva asterisco (`aplicacao.js` L433). O server recusa texto vazio mesmo assim.

| Ação | Rótulo do botão | De | Para | Efeito |
|---|---|---|---|---|
| configurar | `Configurar mappings` e `+ Novo registro` | — | `DRAFT` número 1 | insere política e versão. Origem imutável |
| editar | `Editar versão` | `DRAFT` | `DRAFT` | altera contas, centro, vigência e justificativa. Não altera tipo nem competência |
| simular | `Simular evento` | `DRAFT` ou `APPROVED` | a mesma | grava `politica_simulacoes`. Não grava lançamento |
| aprovar | `Aprovar regra` | `DRAFT` | `APPROVED` | uma pessoa diferente do autor. Exige simulação balanceada desta versão |
| validar | `Validar pré-condições` | qualquer | sem escrita | devolve mensagens |
| histórico | `Consultar histórico` | — | — | abre a aba Histórico |
| exportar | `Exportar` e `Exportar visão` | — | — | CSV das colunas da grade |

Não há rota `rejeitar`, `bloquear`, `revisar-competencia` nem `versionar`. `REVIEW`, `REJECTED` e `SUSPENDED` continuam no combo porque estão no enum. Nenhuma transição desta fatia os grava. O teste de banco pode inserir `APPROVED` direto só para travar a edição fora de rascunho; o produto não nasce assim.

Editar fora de `DRAFT` responde 409 `{ message: 'conflito concorrente', codigo }` e não grava. Aprovar fora de `DRAFT` responde o mesmo 409. Aprovar com o mesmo `usuarioId` do autor responde 422 `{ message: 'aprovador diferente do autor', codigo }` e a situação fica `DRAFT`.

Concorrência: o corpo envia `numero`. A transação faz `SELECT ... FOR UPDATE` da política. Se o maior número não excluído for diferente de `numero`, HTTP 409 `{ message: 'conflito concorrente', codigo }`, sem gravar.

Motivo vazio no service: 422 `{ message: 'Informe justificativa para auditoria.', codigo }` (`aplicacao.js` L451). No modal, a tela impede o POST e mostra `Informe justificativa para demonstrar a decisão auditável.` (`aplicacao.js` L499).

Lote (`componentes.js` L5951 `multiSelect: true`; matriz UX L952, “Seleção múltipla por alçada e ação em lote auditada”) aceita `simular` ou `aprovar`, no máximo 20 códigos, numa transação só. A primeira falha desfaz o lote e devolve 422 ou 409 da primeira política, com o código de negócio no campo `codigo`. Na tela, uma linha marcada chama a rota da ação. Com mais de uma linha marcada, `Simular evento` e `Aprovar regra` chamam `POST /api/contabilidade/politicas/lote`. Simular em lote envia `valor`. Sem `valor`, o POST não sai e a tela mostra `Valor é obrigatório.` (`aplicacao.js` L446, rótulo do campo mais ` é obrigatório.`; o rótulo é `Valor` em `componentes.js` L455).

### D5 — Fiscal, empresa, período e as três datas não existem nesta ponta

Não há tabela de período contábil nem de empresa em uso por esta fatia. E09-T08, E01 e o módulo fiscal são de outras fatias. O worker não cria essas tabelas, não declara FK para elas e não edita o módulo fiscal.

O widget `Enquadramento fiscal` permanece visível, desabilitado, com valor `—` e selo `Provisório`. Não há coluna, não há seed de `regrasFiscais` e o POST não envia o campo.

A ficha mostra o rótulo `Empresa` (`aplicacao.js` L190) com valor `—` e o selo `Provisório`. Não preencher `AlphaCarnes Matriz`. Não mostrar o seletor HML/PROD nem o texto `Ambiente`.

H-E01-10: o texto “separar datas comercial/fiscal/efetiva” do Caderno B L449 não vira coluna. As únicas datas de negócio são competência e início de vigência.

### D6 — Abas, estados e o que sai da casca de protótipo

Abas, nesta ordem (`aplicacao.js` L7): `Ficha e campos`, `Movimentações`, `Regras e validações`, `Exceções`, `Histórico`, `Integrações`, `Aceite e testes`.

- Ficha e campos: campos D2 da versão mais recente, `Versão` com o número e a trilha `Responsável` com o nome do usuário (`aplicacao.js` L190). Sem UUID e sem o código de negócio cru. `Início de vigência` aparece só na ficha, em `dd/MM/yyyy`, como `fieldVal` (`aplicacao.js` L145 devolve `20/10/2026` para `vigenciaInicio`). A grade não tem essa coluna (`componentes.js` L5934–L5941).
- Movimentações: cabeçalhos `Acontecimento`, `Origem`, `Efeito`, `Situação` (`aplicacao.js` L195). Linhas reais da auditoria da política. Sem as três linhas fictícias de SEFAZ/banco.
- Regras e validações: o texto literal `origem imutável, não lançar sem mapeamento correto, balanceamento exato` (`catalogo.js` L745).
- Exceções: `aplicacao.js` L201 parte em `;`. A frase do Caderno não tem `;`, então o runtime do protótipo cairia no acréscimo genérico. Esses três genéricos não estão no Caderno B L450 nem em `catalogo.js` L746. A aba mostra dois blocos `Bloqueio / exceção:` (`aplicacao.js` L203) com `titleCase` de cada item separado por vírgula: `Mapeamento ausente` e `Evento duplicado`. A mensagem HTTP permanece a do Caderno, em minúsculas.
- Histórico: acontecimento, data `pt-BR` e nome do responsável. Sem GUID (`aplicacao.js` L210).
- Integrações: a aba existe. Não renderizar os botões `Central de Integrações`, `Conciliação API × arquivos` e `Agendamentos` (`aplicacao.js` L218). Texto da aba: `Esta tela não chama serviço externo.`
- Aceite e testes: os oito itens de `aplicacao.js` L223–L232, como lista somente leitura, sem gravar aceite.

Estados de tela: `inicial`, `carregando`, `sem registros`, `validação inválida`, `sem acesso`, `conflito concorrente`, `revisão pendente`, `concluído com evidência` (`componentes.js` L5980–L5989). O estado `serviço externo indisponível` não é simulado: não há chamada externa (D1). Falha de rede do próprio backend mostra a mensagem retornada e sai de `carregando`.

Texto vazio da grade (`aplicacao.js` L172): `Nenhum resultado para o período, filtro ou situação escolhidos. Limpe os filtros ou cadastre um novo registro.`

Placeholder da busca (`aplicacao.js` L170): `Pesquisar descrição ou referência de negócio`. A busca casa rótulo do tipo, nome das duas contas e nome do centro. Não casa UUID nem o token do enum.

Sai da UI, por Princípio I.2(a): `DADOS FICTÍCIOS`, `PROTÓTIPO`, `SIMULAR PERFIL`, KPIs `Itens no cenário` / `Ambiente em tela`, o painel `Controle contábil · competência` com `R$ 5.000,00` (`aplicacao.js` L350) e qualquer valor inventado.

Voltar restaura filtro, ordenação, página e rascunho do formulário a partir de `sessionStorage` chave `politicas-de-contabilizacao`. A chave é interna: nenhum JSX, grade, toast, aba ou atributo visível a imprime. Se o rascunho difere do último salvo, `window.confirm` com o texto `Há alterações não salvas. Deseja sair?`. Cancelar permanece na ficha.

Competência na grade: mês por extenso em pt-BR com a primeira letra maiúscula e o ano, no formato do `fieldVal` de `aplicacao.js` L147 (`Outubro de 2026`).

### D7 — RBAC e menu

Fonte: AD-04; AD-18 item 5; H-E01-12; constituição L93–L94; `catalogo.js` L735–L741.

- Rota nova: `/erp/contabilidade/politicas-de-contabilizacao`. O prefixo é o de `catalogo.js` L741 (`/erp/contabilidade/`). O segmento é `slug()` (`aplicacao.js` L13) sobre o título inteiro `Políticas de contabilização` (`catalogo.js` L736 e Caderno B L446). O segmento `e09-t02` não entra no href nem na barra de endereço. Rótulo do item: `Políticas de contabilização`. Grupo: `CONTABILIDADE`, logo depois de `Plano de contas e centros de custo`. `iconKey`: `FileText` (já está em `ICON_MAP` de `app-sidebar.tsx` L82; o protótipo usa bullet e não nomeia ícone lucide).
- `administrador` recebe a rota porque `MENUS_VISIVEIS_POR_PERFIL.administrador` é `[...MENUS_CANONICOS]`. Nenhum outro perfil ganha a rota. O array `gestor` (lista própria) não é editado.
- `definirMenusSchema` passa de `.max(40)` para `.max(41)` (`perfil.dto.ts` L10).
- Os testes que exigem comprimento 40 passam a exigir: as 39 rotas operacionais iguais e na mesma ordem; a rota da T01 no mesmo lugar; o total 41; a rota nova é a segunda de `CONTABILIDADE`.
- `GRUPOS` de `menu-v2.test.ts` e de `shell-ds.spec.ts` já têm 10 grupos, com `CONTABILIDADE` entre `FATURAMENTO` e `CADASTROS & REGRAS`. Não reordenar. Não editar `shell-ds.spec.ts`.
- `ROTA_ENTRADA_POR_PERFIL` não muda. A home do grupo no protótipo aponta `E09-T03` (`catalogo.js`). Essa tela não entra.
- Totais lidos nos testes hoje: 40 rotas e 127 pares. Passam a 41 e 128 (127 + 1 só do administrador).

### D8 — Migration 0049

O arquivo é `app/backend/src/database/migrations/0049_e09_t02_politicas_contabilizacao.sql`. O snapshot é `meta/0049_snapshot.json`. No `_journal.json`, a entrada nova usa `tag` `0049_e09_t02_politicas_contabilizacao` e o próximo `idx` livre. Nesta ponta o journal termina em `idx` 44 / `0048_e09_t01_plano_contas`, então o `idx` novo é 45.

Não renomear, não editar e não reordenar `0048_e09_t01_plano_contas.sql` nem `meta/0048_snapshot.json`. Se `drizzle-kit generate` emitir outro ordinal, o worker renomeia só os arquivos novos e o `tag` novo. Não reaproveita `0048`. Não cria migration vazia no lugar de outro número.

Se o generate não emitir `CREATE TRIGGER ... set_updated_at()`, o worker acrescenta ao final do arquivo gerado:

```sql
CREATE TRIGGER trg_politicas_contabilizacao_updated_at
  BEFORE UPDATE ON politicas_contabilizacao
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_politica_versoes_updated_at
  BEFORE UPDATE ON politica_versoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_politica_simulacoes_updated_at
  BEFORE UPDATE ON politica_simulacoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

A função `set_updated_at()` já existe (migration `0015_onda3_cadastros_admin.sql`).

### D9 — Apresentação sem UUID

O controller HTTP e o CSV devolvem `apresentar()`, que omite `id`, `politicaId`, `contaDebitoId`, `contaCreditoId`, `centroId`, `usuarioId`, `registroId` e qualquer string UUID. O React usa o código de negócio só como chave de fetch, nunca como texto. O histórico devolve `quando`, `quem` (nome), `acontecimento`, `justificativa`.

`apresentar` devolve: `codigo`, `tipoEvento`, `tipoEventoRotulo`, `competencia`, `competenciaRotulo`, `contaDebitoCodigo`, `contaDebitoNome`, `contaCreditoCodigo`, `contaCreditoNome`, `centroCodigo`, `centroNome`, `vigenciaInicio`, `situacao`, `situacaoRotulo`, `numero`, `responsavelNome`, `aprovadorNome`, `criadoEm`, `alteradoEm`, `simulacaoValor`, `simulacaoDebito`, `simulacaoCredito`. `aprovadorNome` e os três campos de simulação podem ser `null`. Não há campo de enquadramento fiscal no JSON.

## File Structure

- Create: `app/backend/src/database/schema/contabilidade-politicas.schema.ts` — tabelas da fatia.
- Modify: `app/backend/src/database/schema/index.ts` — reexporta o schema.
- Create: `app/backend/src/database/migrations/0049_e09_t02_politicas_contabilizacao.sql` e o snapshot `0049`.
- Create: `app/backend/src/modules/contabilidade/politicas/politicas.module.ts`
- Create: `app/backend/src/modules/contabilidade/politicas/politicas.service.ts`
- Create: `app/backend/src/modules/contabilidade/politicas/politicas.controller.ts`
- Create: `app/backend/src/modules/contabilidade/politicas/dto/politicas.dto.ts`
- Create: `app/backend/src/modules/contabilidade/politicas/regra-politica.exception.ts`
- Create: `app/backend/src/modules/contabilidade/politicas/centavos.ts`
- Create: `app/backend/src/modules/contabilidade/politicas/politicas.service.spec.ts`
- Create: `app/backend/test/integration/politicas-contabilizacao.e2e-spec.ts`
- Modify: `app/backend/src/modules/contabilidade/plano/plano.service.ts` — só o método novo de leitura das contas analíticas vigentes.
- Modify: `app/backend/src/app.module.ts` — importa `PoliticasContabilizacaoModule`.
- Modify: `app/backend/src/common/rbac/permissoes.ts`
- Modify: `app/backend/src/common/rbac/menus-canonicos.ts`
- Modify: `app/backend/src/common/rbac/perfil-permissoes.snapshot.json`
- Modify: `app/backend/src/common/rbac/perfil-menus.snapshot.json`
- Modify: `app/backend/src/modules/perfis/dto/perfil.dto.ts`
- Modify: `app/backend/src/realtime/events/eventos.ts`
- Modify: `app/backend/src/realtime/realtime.gateway.ts` — a room nova não alarga a room `contabilidade-plano` nem as rooms de operação.
- Modify: `app/frontend/src/lib/menu-v2.ts`
- Modify: `app/frontend/__tests__/menu-v2.test.ts`
- Modify: `app/frontend/__tests__/menu-rbac.test.ts`
- Modify: `app/backend/test/integration/perfis-menus.e2e-spec.ts`
- Create: `app/frontend/src/app/(admin)/erp/contabilidade/politicas-de-contabilizacao/page.tsx` — mínimo na Task 1; tela na Task 6.
- Create: `app/frontend/src/app/(admin)/erp/contabilidade/politicas-de-contabilizacao/politicas-contabilizacao-client.tsx`
- Create: `app/frontend/src/app/api/contabilidade/politicas/route.ts`
- Create: `app/frontend/src/app/api/contabilidade/politicas/exportar/route.ts`
- Create: `app/frontend/src/app/api/contabilidade/politicas/lote/route.ts`
- Create: `app/frontend/src/app/api/contabilidade/politicas/validar/route.ts`
- Create: `app/frontend/src/app/api/contabilidade/politicas/opcoes/route.ts`
- Create: `app/frontend/src/app/api/contabilidade/politicas/[codigo]/[acao]/route.ts`
- Create: `app/frontend/e2e/e09-t02-politicas-contabilizacao.spec.ts`
- Create: `app/frontend/__tests__/politicas-contabilizacao-apresentacao.test.ts`
- Create: `app/backend/test/unit/permissoes-e09-t02.spec.ts`

## Task 1: Permissões, menu e page.tsx mínimo

**Files:**
- Modify: `app/backend/src/common/rbac/permissoes.ts`
- Modify: `app/backend/src/common/rbac/menus-canonicos.ts`
- Modify: `app/backend/src/common/rbac/perfil-permissoes.snapshot.json`
- Modify: `app/backend/src/common/rbac/perfil-menus.snapshot.json`
- Modify: `app/backend/src/modules/perfis/dto/perfil.dto.ts`
- Modify: `app/frontend/src/lib/menu-v2.ts`
- Modify: `app/frontend/__tests__/menu-v2.test.ts`
- Modify: `app/frontend/__tests__/menu-rbac.test.ts`
- Modify: `app/backend/test/integration/perfis-menus.e2e-spec.ts`
- Create: `app/backend/test/unit/permissoes-e09-t02.spec.ts`
- Create: `app/frontend/src/app/(admin)/erp/contabilidade/politicas-de-contabilizacao/page.tsx`

**Interfaces:**
- Consumes: `PERMISSOES`, `MAPA_PERFIL_PERMISSOES`, `MENUS_CANONICOS`, `MENU_V2`. O prefixo `CONTABILIDADE_` já está em `perfis.service.ts` L67. Não duplicar o módulo do catálogo.
- Produces: `PERMISSOES.CONTABILIDADE_POLITICA_LER`, `PERMISSOES.CONTABILIDADE_POLITICA_GERENCIAR`, rota `/erp/contabilidade/politicas-de-contabilizacao`, arquivo `page.tsx` que o teste de menu exige.

- [ ] **Step 1: Write the failing test**

```ts
import { MAPA_PERFIL_PERMISSOES, PERMISSOES } from '../../src/common/rbac/permissoes';
import { MENUS_VISIVEIS_POR_PERFIL } from '../../src/common/rbac/menus-canonicos';

const ROTA = '/erp/contabilidade/politicas-de-contabilizacao';
const CHAVES = [PERMISSOES.CONTABILIDADE_POLITICA_LER, PERMISSOES.CONTABILIDADE_POLITICA_GERENCIAR];

describe('E09-T02 RBAC', () => {
  it('concede as duas permissões só ao administrador', () => {
    expect(MAPA_PERFIL_PERMISSOES.administrador).toEqual(expect.arrayContaining(CHAVES));
    for (const [slug, lista] of Object.entries(MAPA_PERFIL_PERMISSOES)) {
      if (slug === 'administrador') continue;
      for (const chave of CHAVES) expect(lista).not.toContain(chave);
    }
  });

  it('põe a rota só no menu do administrador e não mexe no gestor', () => {
    expect(MENUS_VISIVEIS_POR_PERFIL.administrador).toContain(ROTA);
    expect(MENUS_VISIVEIS_POR_PERFIL.gestor).not.toContain(ROTA);
    for (const [slug, menus] of Object.entries(MENUS_VISIVEIS_POR_PERFIL)) {
      if (slug === 'administrador') continue;
      expect(menus).not.toContain(ROTA);
    }
  });
});
```

Em `menu-v2.test.ts`, substituir o `it` de L59–L71. Não deixar o `it` antigo ao lado do novo. `GRUPOS` de L6–L9 permanece com 10 títulos.

```ts
const ROTAS_CONTABILIDADE = [
  '/erp/contabilidade/plano-de-contas',
  '/erp/contabilidade/politicas-de-contabilizacao',
];

it('preserva as 39 rotas e acrescenta plano e políticas', () => {
  const atual = MENU_V2.flatMap((g) => g.items.map((i) => [g.title, i.label, i.href]));
  const operacionais = atual.filter(([, , href]) => !ROTAS_CONTABILIDADE.includes(String(href)));
  expect(operacionais).toEqual(ITENS_PROTOTIPO);
  expect(operacionais).toHaveLength(39);
  expect(atual).toHaveLength(41);
  expect(atual.filter(([grupo]) => grupo === 'CONTABILIDADE').map(([, , href]) => href)).toEqual(ROTAS_CONTABILIDADE);
  expect(atual).toContainEqual([
    'CONTABILIDADE',
    'Políticas de contabilização',
    '/erp/contabilidade/politicas-de-contabilizacao',
  ]);
  expect(atual.some(([, , href]) => /e\d{2}-t\d{2}/i.test(String(href)))).toBe(false);
});
```

O `it` de L83–L93 (`page.tsx`) passa a rodar no Step 4, porque o arquivo mínimo nasce neste step.

Em `menu-rbac.test.ts`, acrescentar a constante ao lado de `ROTA_PLANO` (L19) e a chave na matriz (depois de L65), sem reordenar as 39 chaves operacionais nem a do plano:

```ts
const ROTA_POLITICAS = '/erp/contabilidade/politicas-de-contabilizacao';
const ROTAS_FORA_DA_OPERACAO = [ROTA_PLANO, ROTA_POLITICAS];
```

```ts
[ROTA_POLITICAS]: ['administrador'],
```

Substituir o `it` de L173–L181 e o `it` de L187–L191. Não deixar a versão de 40/127 ao lado.

```ts
it('a matriz transcrita cobre as 39 rotas operacionais e as duas rotas de contabilidade', () => {
  const chaves = Object.keys(MATRIZ_RASTREABILIDADE);
  const operacionais = chaves.filter((href) => !ROTAS_FORA_DA_OPERACAO.includes(href));
  expect(operacionais.sort()).toEqual(
    [...ROTAS_CANONICAS].filter((href) => !ROTAS_FORA_DA_OPERACAO.includes(href)).sort(),
  );
  expect(operacionais).toHaveLength(39);
  expect([...ROTAS_CANONICAS].sort()).toEqual(chaves.sort());
  expect(ROTAS_CANONICAS).toHaveLength(41);
});

it('a matriz soma 128 atribuicoes perfil x rota', () => {
  const total = PERFIS.reduce((soma, perfil) => soma + menusDe(perfil).length, 0);
  expect(total).toBe(128);
  expect(Object.values(MATRIZ_RASTREABILIDADE).reduce((s, p) => s + p.length, 0)).toBe(128);
});
```

O `it` de L285–L307 troca `toHaveLength(40)` por `toHaveLength(41)` e `toBe(127)` por `toBe(128)`. Afirma que `PERMISSOES_POR_PERFIL.administrador` contém as duas chaves novas e que nenhum outro perfil as contém. `GRUPOS_ESPERADOS.gestor` (L104–L107) continua sem `CONTABILIDADE`. Não reordenar os outros nove perfis.

Em `perfis-menus.e2e-spec.ts` L78–L79, `MENUS_CANONICOS` e `res.body.menus` passam a `toHaveLength(41)`.

`page.tsx` mínimo, só para o teste de existência:

```tsx
export default function PoliticasContabilizacaoPage() {
  return <h1>Políticas de contabilização</h1>;
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/unit/permissoes-e09-t02.spec.ts test/unit/perfil-permissoes-snapshot.spec.ts --runInBand` em `app/backend` e `npx jest __tests__/menu-v2.test.ts __tests__/menu-rbac.test.ts -t "preserva as 39|39 rotas operacionais|128 atribuicoes|onda 4|page.tsx" --runInBand` em `app/frontend`.

Expected: FAIL porque as chaves, a rota, os snapshots e, antes do Step 3, o `page.tsx` não existem.

- [ ] **Step 3: Write minimal implementation**

Em `permissoes.ts`, no objeto `PERMISSOES`, depois de `CONTABILIDADE_PLANO_GERENCIAR`:

```ts
CONTABILIDADE_POLITICA_LER: 'CONTABILIDADE_POLITICA_LER',
CONTABILIDADE_POLITICA_GERENCIAR: 'CONTABILIDADE_POLITICA_GERENCIAR',
```

Depois do `pushPermissoes` do plano:

```ts
pushPermissoes('administrador', 'CONTABILIDADE_POLITICA_LER', 'CONTABILIDADE_POLITICA_GERENCIAR');
```

Em `DESCRICOES_PERMISSOES`:

```ts
CONTABILIDADE_POLITICA_LER: 'Consultar políticas de contabilização',
CONTABILIDADE_POLITICA_GERENCIAR: 'Configurar mappings, simular evento e aprovar regra',
```

Em `menus-canonicos.ts`, inserir `'/erp/contabilidade/politicas-de-contabilizacao'` em `MENUS_CANONICOS` imediatamente depois de `'/erp/contabilidade/plano-de-contas'` (L33) e antes de `'/cadastros/representantes'`. Não inserir no array `gestor`. O comentário de pares (L59) passa a "127 pares da matriz v1.1 + 1".

Em `perfil.dto.ts` L10, `.max(40)` vira `.max(41)`.

Em `menu-v2.ts`, no grupo `CONTABILIDADE`, depois do item do plano:

```ts
{
  href: '/erp/contabilidade/politicas-de-contabilizacao',
  label: 'Políticas de contabilização',
  iconKey: 'FileText',
},
```

Não alterar `ROTA_ENTRADA_POR_PERFIL`.

Criar o `page.tsx` mínimo do Step 1.

Regenerar os dois snapshots a partir dos mapas, em `app/backend`:

```powershell
npx tsx scripts/gerar-snapshot-perfis.ts
```

Só a chave `administrador` muda. Nas permissões, a ordem alfabética fica `CONTABILIDADE_PLANO_GERENCIAR`, `CONTABILIDADE_PLANO_LER`, `CONTABILIDADE_POLITICA_GERENCIAR`, `CONTABILIDADE_POLITICA_LER`. No snapshot de menus, a rota nova entra logo depois do plano de contas. Se o script reordenar outro slug, restaurar a ordem anterior desse slug. Nenhum outro slug ganha permissão nem rota.

- [ ] **Step 4: Run test to verify it passes**

Run: os mesmos comandos do Step 2, mais `npx jest test/integration/perfis-menus.e2e-spec.ts -t "catalogo de permissoes" --runInBand` em `app/backend`.

Expected: PASS, inclusive o `it` de `page.tsx`.

- [ ] **Step 5: Commit**

```powershell
git add app/backend/src/common/rbac/permissoes.ts app/backend/src/common/rbac/menus-canonicos.ts app/backend/src/common/rbac/perfil-permissoes.snapshot.json app/backend/src/common/rbac/perfil-menus.snapshot.json app/backend/src/modules/perfis/dto/perfil.dto.ts app/frontend/src/lib/menu-v2.ts app/frontend/__tests__/menu-v2.test.ts app/frontend/__tests__/menu-rbac.test.ts app/backend/test/integration/perfis-menus.e2e-spec.ts app/backend/test/unit/permissoes-e09-t02.spec.ts "app/frontend/src/app/(admin)/erp/contabilidade/politicas-de-contabilizacao/page.tsx"
git commit -m @"
feat(contabilidade): abre o menu das políticas só ao administrador

### Descrição Detalhada:
Inclui as permissões de leitura e gestão das políticas no perfil administrador, a rota no grupo CONTABILIDADE e o page.tsx mínimo que o teste de menu exige.

### Motivo da Mudança:
A persona contador não é um dos 11 perfis. A permissão nova não pode vazar para o gestor nem para os outros slugs.

### Impacto:
O catálogo do administrador passa de 40 para 41 rotas e de 127 para 128 pares. Os outros perfis e a rota do plano de contas permanecem.
"@
```

## Task 2: Schema Drizzle e migration 0049

**Files:**
- Create: `app/backend/src/database/schema/contabilidade-politicas.schema.ts`
- Modify: `app/backend/src/database/schema/index.ts`
- Create: `app/backend/src/database/migrations/0049_e09_t02_politicas_contabilizacao.sql`
- Test: `app/backend/test/integration/politicas-contabilizacao.e2e-spec.ts` (só o caso de constraints; o harness copia o bootstrap de `plano-contas.e2e-spec.ts`)

**Interfaces:**
- Consumes: `usuarios` de `auth.schema.ts`, `contasContabeis` e `centrosCusto` de `contabilidade-plano.schema.ts`.
- Produces: tabelas `politicas_contabilizacao`, `politica_versoes`, `politica_simulacoes`. Não produz diário, razão nem lançamento.

- [ ] **Step 1: Write the failing test**

```ts
it('recusa tipo fora do enum, competência fora do dia 01 e simulação desbalanceada', async () => {
  const centro = await db.insert(centrosCusto).values({ codigo: 'CT1', nome: 'Operação industrial' }).returning();
  const debito = await db.insert(contasContabeis).values({ codigo: '1.1.01' }).returning();
  const credito = await db.insert(contasContabeis).values({ codigo: '2.1.01' }).returning();
  const politica = await db.insert(politicasContabilizacao).values({
    codigo: 'LIQUIDACAO-2026-10',
    tipoEvento: 'LIQUIDACAO',
    competencia: '2026-10-01',
  }).returning();
  await expect(db.insert(politicasContabilizacao).values({
    codigo: 'OUTRO-2026-10',
    tipoEvento: 'COMPRA',
    competencia: '2026-10-01',
  })).rejects.toThrow();
  await expect(db.insert(politicasContabilizacao).values({
    codigo: 'LIQUIDACAO-2026-11',
    tipoEvento: 'LIQUIDACAO',
    competencia: '2026-11-15',
  })).rejects.toThrow();
  const versao = await db.insert(politicaVersoes).values({
    politicaId: politica[0].id,
    numero: 1,
    contaDebitoId: debito[0].id,
    contaCreditoId: credito[0].id,
    centroCustoId: centro[0].id,
    vigenciaInicio: '2026-10-01',
    situacao: 'DRAFT',
    justificativa: 'abre',
    responsavelId: adminId,
  }).returning();
  await expect(db.insert(politicaSimulacoes).values({
    politicaId: politica[0].id,
    versaoNumero: versao[0].numero,
    valor: '10.00',
    debito: '10.00',
    credito: '10.01',
  })).rejects.toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/integration/politicas-contabilizacao.e2e-spec.ts -t "tipo fora do enum" --runInBand` em `app/backend`.

Expected: FAIL com módulo ou tabela ausente.

- [ ] **Step 3: Write minimal implementation**

```ts
import { sql } from 'drizzle-orm';
import { check, date, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { usuarios } from './auth.schema';
import { centrosCusto, contasContabeis } from './contabilidade-plano.schema';

export const politicasContabilizacao = pgTable(
  'politicas_contabilizacao',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    codigo: text('codigo').notNull(),
    tipoEvento: text('tipo_evento').notNull(),
    competencia: date('competencia').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('uq_politicas_contabilizacao_codigo').on(t.codigo).where(sql`${t.deletedAt} IS NULL`),
    check('chk_politicas_tipo_evento', sql`${t.tipoEvento} IN ('LIQUIDACAO','REGISTRO','CANCELAMENTO','ESTORNO','TARIFA')`),
    check('chk_politicas_competencia_dia', sql`extract(day from ${t.competencia}) = 1`),
  ],
);

export const politicaVersoes = pgTable(
  'politica_versoes',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    politicaId: uuid('politica_id').notNull().references(() => politicasContabilizacao.id),
    numero: integer('numero').notNull(),
    contaDebitoId: uuid('conta_debito_id').notNull().references(() => contasContabeis.id),
    contaCreditoId: uuid('conta_credito_id').notNull().references(() => contasContabeis.id),
    centroCustoId: uuid('centro_custo_id').notNull().references(() => centrosCusto.id),
    vigenciaInicio: date('vigencia_inicio').notNull(),
    situacao: text('situacao').notNull(),
    justificativa: text('justificativa').notNull(),
    responsavelId: uuid('responsavel_id').notNull().references(() => usuarios.id),
    aprovadorId: uuid('aprovador_id').references(() => usuarios.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('uq_politica_versoes_numero').on(t.politicaId, t.numero).where(sql`${t.deletedAt} IS NULL`),
    index('idx_politica_versoes_politica').on(t.politicaId),
    index('idx_politica_versoes_debito').on(t.contaDebitoId),
    index('idx_politica_versoes_credito').on(t.contaCreditoId),
    index('idx_politica_versoes_centro').on(t.centroCustoId),
    index('idx_politica_versoes_responsavel').on(t.responsavelId),
    index('idx_politica_versoes_aprovador').on(t.aprovadorId),
    check('chk_politica_versoes_situacao', sql`${t.situacao} IN ('DRAFT','REVIEW','APPROVED','REJECTED','SUSPENDED')`),
  ],
);

export const politicaSimulacoes = pgTable(
  'politica_simulacoes',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    politicaId: uuid('politica_id').notNull().references(() => politicasContabilizacao.id),
    versaoNumero: integer('versao_numero').notNull(),
    valor: numeric('valor', { precision: 15, scale: 2 }).notNull(),
    debito: numeric('debito', { precision: 15, scale: 2 }).notNull(),
    credito: numeric('credito', { precision: 15, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_politica_simulacoes_politica').on(t.politicaId),
    check('chk_politica_simulacoes_balance', sql`${t.debito} = ${t.credito} AND ${t.valor} = ${t.debito}`),
  ],
);
```

Exportar em `schema/index.ts`. Gerar a migration com nome `e09_t02_politicas_contabilizacao` e aplicar D8: ordinal `0049`, sem tocar na `0048`. Acrescentar os três triggers se o generate não os emitir.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run db:migrate` e o Jest do Step 2, em `app/backend`.

Expected: PASS. O CHECK de tipo recusa `COMPRA`. O CHECK do dia recusa `2026-11-15`. O CHECK de balanceamento recusa crédito `10.01` com débito `10.00`.

- [ ] **Step 5: Commit**

```powershell
git add app/backend/src/database/schema/contabilidade-politicas.schema.ts app/backend/src/database/schema/index.ts app/backend/src/database/migrations/0049_e09_t02_politicas_contabilizacao.sql app/backend/src/database/migrations/meta/0049_snapshot.json app/backend/src/database/migrations/meta/_journal.json app/backend/test/integration/politicas-contabilizacao.e2e-spec.ts
git commit -m @"
feat(contabilidade): cria as tabelas das políticas de contabilização

### Descrição Detalhada:
Adiciona a política, a versão e a simulação com o enum do protótipo e o balanceamento em NUMERIC(15,2).

### Motivo da Mudança:
A origem e o mapeamento precisam persistir antes da simulação, e a simulação não pode nascer desbalanceada.

### Impacto:
A migration é 0049. A 0048 do plano de contas não é renumerada. Nenhuma tabela de lançamento é criada.
"@
```

## Task 3: Configurar o mapeamento

**Files:**
- Create: `app/backend/src/modules/contabilidade/politicas/dto/politicas.dto.ts`
- Create: `app/backend/src/modules/contabilidade/politicas/regra-politica.exception.ts`
- Create: `app/backend/src/modules/contabilidade/politicas/politicas.service.ts`
- Create: `app/backend/src/modules/contabilidade/politicas/politicas.module.ts`
- Modify: `app/backend/src/modules/contabilidade/plano/plano.service.ts`
- Modify: `app/backend/src/app.module.ts`
- Test: `app/backend/test/integration/politicas-contabilizacao.e2e-spec.ts`

**Interfaces:**
- Consumes: tabelas da Task 2, `PlanoContasService.listarContasAnaliticasVigentes`, `PlanoContasService.listarCentrosAtivos`, `AuditoriaService`.
- Produces: `PoliticasContabilizacaoService.configurar`, `editar`, `listar`, `obter`, `apresentar`, `listarOpcoes`.

- [ ] **Step 1: Write the failing test**

Review Focus 2 e 5. O pai analítico aprovado é gravado com o `PlanoContasService` já existente; a situação `APPROVED` da conta, se o helper da T01 não estiver exportado, usa o mesmo `UPDATE` de teste que `plano-contas.e2e-spec.ts` já usa. Não criar conta por SQL de produto.

```ts
function dtoConfigurar(parcial: Partial<ConfigurarPoliticaDto> = {}): ConfigurarPoliticaDto {
  return {
    tipoEvento: 'LIQUIDACAO',
    competencia: '2026-10',
    contaDebitoCodigo: '1.1.01',
    contaCreditoCodigo: '2.1.01',
    centroCodigo: 'CT1',
    vigenciaInicio: '2026-10-01',
    justificativa: 'abre a regra',
    ...parcial,
  };
}

it('recusa evento duplicado e não grava a segunda política', async () => {
  await prepararContasAnaliticas();
  await service.configurar(dtoConfigurar(), autorId);
  await expect(service.configurar(dtoConfigurar(), autorId)).rejects.toMatchObject({
    status: 409,
    response: { message: 'evento duplicado', codigo: 'LIQUIDACAO-2026-10' },
  });
  const lista = await service.listar({ pagina: 1, q: '', situacao: '', competencia: '', ordenar: 'competencia', direcao: 'asc' });
  expect(lista.total).toBe(1);
});

it('não troca o tipo de ocorrência e mantém a origem', async () => {
  await prepararContasAnaliticas();
  const politica = await service.configurar(dtoConfigurar(), autorId);
  await expect(service.editar(politica.codigo, {
    numero: 1,
    tipoEvento: 'TARIFA',
    competencia: '2026-10',
    contaDebitoCodigo: '1.1.01',
    contaCreditoCodigo: '2.1.01',
    centroCodigo: 'CT1',
    vigenciaInicio: '2026-10-01',
    justificativa: 'tenta trocar a origem',
  }, autorId)).rejects.toMatchObject({
    status: 422,
    response: { message: 'origem imutável', codigo: 'LIQUIDACAO-2026-10' },
  });
  expect((await service.obter(politica.codigo)).tipoEvento).toBe('LIQUIDACAO');
});

it('recusa conta sintética como mapeamento ausente', async () => {
  await prepararContaSinteticaAprovada('1');
  await expect(service.configurar(dtoConfigurar({ contaDebitoCodigo: '1' }), autorId)).rejects.toMatchObject({
    status: 422,
    response: { message: 'mapeamento ausente', codigo: 'LIQUIDACAO-2026-10' },
  });
  expect((await service.listar({ pagina: 1, q: '', situacao: '', competencia: '', ordenar: 'competencia', direcao: 'asc' })).total).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/integration/politicas-contabilizacao.e2e-spec.ts -t "evento duplicado|origem|sintética" --runInBand` em `app/backend`.

Expected: FAIL com `PoliticasContabilizacaoService` indefinido.

- [ ] **Step 3: Write minimal implementation**

```ts
import { HttpException, HttpStatus } from '@nestjs/common';

export class RegraPoliticaException extends HttpException {
  constructor(message: string, codigo: string) {
    super({ message, codigo }, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class ConflitoPoliticaException extends HttpException {
  constructor(message: string, codigo: string) {
    super({ message, codigo }, HttpStatus.CONFLICT);
  }
}
```

DTO Zod. O objeto base não tem `.refine()`. Nenhum schema desta fatia usa `.omit()`.

```ts
import { z } from 'zod';

const codigo = z.string().trim().min(1).max(32);
const motivo = z.string().trim().min(1).max(2000);
const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const competencia = z.string().regex(/^\d{4}-\d{2}$/);
const tipoEvento = z.enum(['LIQUIDACAO', 'REGISTRO', 'CANCELAMENTO', 'ESTORNO', 'TARIFA']);

export const configurarSchema = z.object({
  tipoEvento,
  competencia,
  contaDebitoCodigo: codigo,
  contaCreditoCodigo: codigo,
  centroCodigo: codigo,
  vigenciaInicio: dataIso,
  justificativa: motivo,
});

export const editarSchema = z.object({
  numero: z.number().int().positive(),
  tipoEvento: tipoEvento.optional(),
  competencia: competencia.optional(),
  contaDebitoCodigo: codigo,
  contaCreditoCodigo: codigo,
  centroCodigo: codigo,
  vigenciaInicio: dataIso,
  justificativa: motivo,
});

export const listarPoliticasSchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  q: z.string().trim().max(180).default(''),
  situacao: z.enum(['', 'DRAFT', 'REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED']).default(''),
  competencia: z.union([z.literal(''), competencia]).default(''),
  ordenar: z.enum(['competencia', 'contaDebito', 'contaCredito', 'centroCusto', 'tipoEvento']).default('competencia'),
  direcao: z.enum(['asc', 'desc']).default('asc'),
});
```

```ts
function codigoDe(tipo: string, competenciaMes: string) {
  return `${tipo}-${competenciaMes}`;
}

async configurar(dto: ConfigurarPoliticaDto, usuarioId: string) {
  const codigo = codigoDe(dto.tipoEvento, dto.competencia);
  await this.db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'contabilidade:politica:' + codigo}))`);
    const duplicada = await tx.select({ codigo: politicasContabilizacao.codigo }).from(politicasContabilizacao)
      .where(and(eq(politicasContabilizacao.codigo, codigo), isNull(politicasContabilizacao.deletedAt))).limit(1);
    if (duplicada.length > 0) throw new ConflitoPoliticaException('evento duplicado', duplicada[0].codigo);
    const debito = await this.contaAnaliticaVigente(tx, dto.contaDebitoCodigo, codigo);
    const credito = await this.contaAnaliticaVigente(tx, dto.contaCreditoCodigo, codigo);
    const centro = await this.centroExistente(tx, dto.centroCodigo, codigo);
    const politica = primeiroOuFalha(await tx.insert(politicasContabilizacao).values({
      codigo,
      tipoEvento: dto.tipoEvento,
      competencia: `${dto.competencia}-01`,
    }).returning());
    const versao = primeiroOuFalha(await tx.insert(politicaVersoes).values({
      politicaId: politica.id,
      numero: 1,
      contaDebitoId: debito.id,
      contaCreditoId: credito.id,
      centroCustoId: centro.id,
      vigenciaInicio: dto.vigenciaInicio,
      situacao: 'DRAFT',
      justificativa: dto.justificativa,
      responsavelId: usuarioId,
    }).returning());
    await this.auditoria.registrar(tx, {
      tabela: 'politica_versoes',
      registroId: versao.id,
      operacao: 'INSERT',
      modulo: 'contabilidade.politicas',
      usuarioId,
      dadosAnteriores: {},
      dadosNovos: { codigo, tipoEvento: dto.tipoEvento, competencia: dto.competencia, numero: 1 },
      justificativa: dto.justificativa,
    });
  });
  this.eventEmitter.emit(EVENTOS.POLITICA_CONFIGURADA, { codigo, acao: 'configurar', situacao: 'DRAFT' });
  return this.obter(codigo);
}
```

`contaAnaliticaVigente` lê `contas_contabeis` + a versão de maior `numero` com `situacao = 'APPROVED'`, `classificacao = 'analitica'`, `deleted_at` nulo e vigência cobrindo `(now() at time zone 'America/Sao_Paulo')::date`. Falha com `RegraPoliticaException('mapeamento ausente', codigo)`. `centroExistente` usa `centros_custo` com `deleted_at` nulo; a mesma exceção se faltar.

`editar` trava a política, recusa `numero` diferente com `ConflitoPoliticaException('conflito concorrente', codigo)`, recusa situação diferente de `DRAFT` com o mesmo conflito, recusa `tipoEvento` ou `competencia` diferentes com `RegraPoliticaException('origem imutável', codigo)`, e não altera `responsavelId`.

`listarContasAnaliticasVigentes` entra em `PlanoContasService` e devolve `{ codigo, nome }[]` com a mesma regra de conta. `listarCentrosAtivos` já existe. `listarOpcoes` devolve os dois, sem UUID. `listar` devolve a versão de maior `numero`, página de 20. Ordenação: `competencia`, nome da conta de débito, nome da conta de crédito, nome do centro, `tipoEvento`.

`PoliticasContabilizacaoModule` importa `PlanoContasModule` e `AuditoriaModule`. Registrar o módulo em `app.module.ts`. `beforeEach` do spec apaga `politica_simulacoes`, `politica_versoes` e `politicas_contabilizacao`, nessa ordem, e não apaga o plano de contas fora do que o próprio teste criou.

- [ ] **Step 4: Run test to verify it passes**

Run: o Jest do Step 2, em `app/backend`.

Expected: PASS dos três `it` de configurar e editar.

`politicas.service.spec.ts` não existe neste passo. O arquivo nasce na Task 4, com centavos, balanceamento, simulação e aprovação. Quem espera PASS desse spec é o Step 4 da Task 4.

- [ ] **Step 5: Commit**

```powershell
git add app/backend/src/modules/contabilidade/politicas app/backend/src/modules/contabilidade/plano/plano.service.ts app/backend/src/app.module.ts app/backend/test/integration/politicas-contabilizacao.e2e-spec.ts
git commit -m @"
feat(contabilidade): configura o mapeamento da política

### Descrição Detalhada:
Grava a origem imutável e as contas analíticas vigentes do plano de contas, recusando evento duplicado e mapeamento ausente.

### Motivo da Mudança:
Sem o par débito/crédito correto a regra não pode seguir para simulação.

### Impacto:
Nenhuma tabela da T01 é recriada. Ainda não há simulação nem aprovação.
"@
```

## Task 4: Simular e aprovar

**Files:**
- Create: `app/backend/src/modules/contabilidade/politicas/centavos.ts`
- Modify: `app/backend/src/modules/contabilidade/politicas/politicas.service.ts`
- Modify: `app/backend/src/modules/contabilidade/politicas/dto/politicas.dto.ts`
- Modify: `app/backend/src/realtime/events/eventos.ts`
- Modify: `app/backend/src/realtime/realtime.gateway.ts`
- Test: `app/backend/src/modules/contabilidade/politicas/politicas.service.spec.ts`
- Test: `app/backend/test/integration/politicas-contabilizacao.e2e-spec.ts`

**Interfaces:**
- Consumes: `configurar` e `apresentar` da Task 3.
- Produces: `simular`, `aprovar`, `validar`, `historico`, `lote`, `exportarCsv`. Eventos `politica_configurada`, `politica_editada`, `politica_simulada`, `politica_aprovada`.

- [ ] **Step 1: Write the failing test**

Review Focus 1, 3 e 4.

```ts
import { balancear, centavos } from './centavos';

it('soma 0.10 e 0.20 em centavos, sem float', () => {
  expect(centavos('0.10') + centavos('0.20')).toBe(30n);
  expect(centavos('0.10') + centavos('0.20')).toBe(centavos('0.30'));
});

it('recusa soma desbalanceada e não grava lançamento', () => {
  try {
    balancear([
      { lado: 'D', valor: '10.00' },
      { lado: 'C', valor: '10.01' },
    ], 'LIQUIDACAO-2026-10');
    throw new Error('deveria recusar');
  } catch (erro) {
    expect(erro).toMatchObject({
      status: 422,
      response: { message: 'balanceamento exato', codigo: 'LIQUIDACAO-2026-10' },
    });
  }
});
```

```ts
it('simular não grava diário, razão nem partida', async () => {
  await prepararContasAnaliticas();
  const politica = await service.configurar(dtoConfigurar(), autorId);
  const saida = await service.simular(politica.codigo, {
    numero: 1,
    valor: '10.10',
    justificativa: 'simula',
  }, autorId);
  expect(saida.simulacaoDebito).toBe('10.10');
  expect(saida.simulacaoCredito).toBe('10.10');
  expect(saida.situacao).toBe('DRAFT');
  for (const nome of ['lancamentos_contabeis', 'diario_contabil', 'razao_contabil', 'partidas_contabeis']) {
    const tabelas = await db.execute(sql`select to_regclass(${'public.' + nome}) as nome`);
    expect(tabelas.rows[0].nome).toBeNull();
  }
});

it('não aprova sem mapeamento simulado', async () => {
  await prepararContasAnaliticas();
  const politica = await service.configurar(dtoConfigurar(), autorId);
  await expect(service.aprovar(politica.codigo, { numero: 1, justificativa: 'aprova' }, outraPessoaId))
    .rejects.toMatchObject({ status: 422, response: { message: 'mapeamento ausente', codigo: politica.codigo } });
  expect((await service.obter(politica.codigo)).situacao).toBe('DRAFT');
});

it('o autor não aprova a própria regra', async () => {
  await prepararContasAnaliticas();
  const politica = await service.configurar(dtoConfigurar(), autorId);
  await service.simular(politica.codigo, { numero: 1, valor: '10.00', justificativa: 'simula' }, autorId);
  await expect(service.aprovar(politica.codigo, { numero: 1, justificativa: 'eu mesmo' }, autorId))
    .rejects.toMatchObject({
      status: 422,
      response: { message: 'aprovador diferente do autor', codigo: politica.codigo },
    });
  expect((await service.obter(politica.codigo)).situacao).toBe('DRAFT');
});
```

`outraPessoaId` é um segundo `usuarios` com o perfil `administrador` já semeado. O teste não cria slug de perfil.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/modules/contabilidade/politicas/politicas.service.spec.ts test/integration/politicas-contabilizacao.e2e-spec.ts -t "centavos|desbalance|diário|sem mapeamento|própria regra" --runInBand` em `app/backend`.

Expected: FAIL com método ou módulo ausente.

- [ ] **Step 3: Write minimal implementation**

```ts
import { RegraPoliticaException } from './regra-politica.exception';

export function centavos(valor: string): bigint {
  const casado = /^(\d{1,13})\.(\d{2})$/.exec(valor);
  if (!casado) throw new RegraPoliticaException('mapeamento ausente', '');
  return BigInt(casado[1]) * 100n + BigInt(casado[2]);
}

export function formatarCentavos(total: bigint): string {
  const sinal = total < 0n ? '-' : '';
  const absoluto = total < 0n ? -total : total;
  const inteiro = absoluto / 100n;
  const frac = (absoluto % 100n).toString().padStart(2, '0');
  return `${sinal}${inteiro}.${frac}`;
}

export function balancear(
  linhas: { lado: 'D' | 'C'; valor: string }[],
  codigo: string,
): { debito: string; credito: string } {
  let debito = 0n;
  let credito = 0n;
  for (const linha of linhas) {
    const valor = centavos(linha.valor);
    if (linha.lado === 'D') debito += valor;
    else credito += valor;
  }
  if (debito !== credito) throw new RegraPoliticaException('balanceamento exato', codigo);
  return { debito: formatarCentavos(debito), credito: formatarCentavos(credito) };
}
```

```ts
export const dinheiro = z.string().regex(/^\d{1,13}\.\d{2}$/);

export const simularSchema = z.object({
  numero: z.number().int().positive(),
  valor: dinheiro,
  justificativa: motivo,
});

export const aprovarSchema = z.object({
  numero: z.number().int().positive(),
  justificativa: motivo,
});

const loteBase = z.object({
  acao: z.enum(['simular', 'aprovar']),
  codigos: z.array(codigo).min(1).max(20),
  justificativa: motivo,
  numeroPorCodigo: z.record(z.string(), z.number().int().positive()),
  valor: dinheiro.optional(),
});

export const loteSchema = loteBase.superRefine((dto, ctx) => {
  if (dto.acao === 'simular' && !dto.valor) {
    ctx.addIssue({ code: 'custom', path: ['valor'], message: 'Valor é obrigatório.' });
  }
});
```

`simular` trava a versão, exige situação `DRAFT` ou `APPROVED`, relê as duas contas e o centro, chama `balancear` com duas linhas do mesmo `dto.valor`, insere `politica_simulacoes` e audita. O `emit` de `POLITICA_SIMULADA` fica fora da transação. Não há `insert` em outra tabela.

`aprovar` trava a versão, exige `DRAFT`, exige `usuarioId !== versao.responsavelId` (senão 422 `aprovador diferente do autor`), exige uma `politica_simulacoes` não excluída daquele `politicaId` + `versaoNumero` (senão 422 `mapeamento ausente`), grava `APPROVED` e `aprovadorId`, audita, e só depois emite `POLITICA_APROVADA`. Não insere lançamento.

`validar` executa as checagens de conta, centro e origem e devolve `{ valido, mensagens }` sem `insert` nem `update`. `historico` lê `auditoria` das versões e devolve só `quando`, `quem`, `acontecimento`, `justificativa`. `lote` usa uma transação: a primeira falha desfaz o lote. `simular` em lote exige `valor` (`loteSchema`); `aprovar` em lote não envia `valor`. `exportarCsv` responde `text/csv; charset=utf-8` com BOM `\uFEFF` e cabeçalho `Competência;Situação;Conta de débito;Conta de crédito;Centro de custo;Tipo de ocorrência`. Células são rótulos. Sem coluna de id.

Em `eventos.ts`:

```ts
POLITICA_CONFIGURADA: 'politica_configurada',
POLITICA_EDITADA: 'politica_editada',
POLITICA_SIMULADA: 'politica_simulada',
POLITICA_APROVADA: 'politica_aprovada',
```

Em `realtime.gateway.ts`, `podeAssinar` ganha um ramo novo sem alterar o ramo `contabilidade-plano` nem o retorno de `DISPONIBILIDADE_LER`:

```ts
if (room === 'contabilidade-politicas') {
  return ws.user?.permissoes?.includes(PERMISSOES.CONTABILIDADE_POLITICA_LER) ?? false;
}
```

Cada handler novo usa `broadcast(room, type, payload)` de `realtime.hub.ts`:

```ts
type PoliticaPayload = { codigo: string; acao: string; situacao: string };

@OnEvent(EVENTOS.POLITICA_CONFIGURADA)
handlePoliticaConfigurada(payload: PoliticaPayload): void {
  this.hub.broadcast('contabilidade-politicas', EVENTOS.POLITICA_CONFIGURADA, payload);
}

@OnEvent(EVENTOS.POLITICA_EDITADA)
handlePoliticaEditada(payload: PoliticaPayload): void {
  this.hub.broadcast('contabilidade-politicas', EVENTOS.POLITICA_EDITADA, payload);
}

@OnEvent(EVENTOS.POLITICA_SIMULADA)
handlePoliticaSimulada(payload: PoliticaPayload): void {
  this.hub.broadcast('contabilidade-politicas', EVENTOS.POLITICA_SIMULADA, payload);
}

@OnEvent(EVENTOS.POLITICA_APROVADA)
handlePoliticaAprovada(payload: PoliticaPayload): void {
  this.hub.broadcast('contabilidade-politicas', EVENTOS.POLITICA_APROVADA, payload);
}
```

`editar` emite `POLITICA_EDITADA` depois do commit. Quem tem só `CONTABILIDADE_POLITICA_LER` não entra na room `contabilidade-plano` nem numa room de operação.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/integration/politicas-contabilizacao.e2e-spec.ts src/modules/contabilidade/politicas/politicas.service.spec.ts --runInBand` em `app/backend`.

Expected: PASS. O teste de simulação continua sem as quatro relações de lançamento. Débito e crédito gravados são `10.10`.

- [ ] **Step 5: Commit**

```powershell
git add app/backend/src/modules/contabilidade/politicas app/backend/src/realtime/events/eventos.ts app/backend/src/realtime/realtime.gateway.ts app/backend/test/integration/politicas-contabilizacao.e2e-spec.ts
git commit -m @"
feat(contabilidade): simula e aprova a política sem lançar

### Descrição Detalhada:
Calcula o balanceamento em centavos, grava só a simulação e exige outra pessoa para aprovar.

### Motivo da Mudança:
Sem mapeamento correto não há lançamento, e o autor não aprova a própria regra.

### Impacto:
A room contabilidade-politicas exige a permissão nova. Diário, razão e partida continuam inexistentes.
"@
```

## Task 5: HTTP e BFF

**Files:**
- Create: `app/backend/src/modules/contabilidade/politicas/politicas.controller.ts`
- Create: `app/frontend/src/app/api/contabilidade/politicas/route.ts`
- Create: `app/frontend/src/app/api/contabilidade/politicas/exportar/route.ts`
- Create: `app/frontend/src/app/api/contabilidade/politicas/lote/route.ts`
- Create: `app/frontend/src/app/api/contabilidade/politicas/validar/route.ts`
- Create: `app/frontend/src/app/api/contabilidade/politicas/opcoes/route.ts`
- Create: `app/frontend/src/app/api/contabilidade/politicas/[codigo]/[acao]/route.ts`
- Test: `politicas-contabilizacao.e2e-spec.ts`

**Interfaces:**
- Consumes: métodos da Task 4 e `repassar` de `app/frontend/src/lib/bff.ts`.
- Produces: rotas HTTP abaixo. Resposta pública só com `apresentar`.

- [ ] **Step 1: Write the failing test**

```ts
it('nega a política a um perfil que não é administrador', async () => {
  const res = await request(srv()).get('/contabilidade/politicas').set('Cookie', comercialCookies);
  expect(res.status).toBe(403);
});

it('não devolve uuid na listagem', async () => {
  const res = await request(srv()).get('/contabilidade/politicas').set('Cookie', adminCookies);
  expect(res.status).toBe(200);
  expect(JSON.stringify(res.body)).not.toMatch(
    /[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
  );
});

it('devolve 422 com message e codigo quando o mapeamento não existe', async () => {
  const res = await request(srv()).post('/contabilidade/politicas').set('Cookie', adminCookies).send({
    tipoEvento: 'LIQUIDACAO',
    competencia: '2026-10',
    contaDebitoCodigo: 'nao-existe',
    contaCreditoCodigo: 'tambem-nao',
    centroCodigo: 'CT1',
    vigenciaInicio: '2026-10-01',
    justificativa: 'tenta',
  });
  expect(res.status).toBe(422);
  expect(res.body).toEqual({
    statusCode: 422,
    message: { message: 'mapeamento ausente', codigo: 'LIQUIDACAO-2026-10' },
    timestamp: expect.any(String),
    path: '/contabilidade/politicas',
    requestId: 'unknown',
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/integration/politicas-contabilizacao.e2e-spec.ts -t "não é administrador|não devolve uuid|message e codigo" --runInBand` em `app/backend`.

Expected: FAIL 404.

- [ ] **Step 3: Write minimal implementation**

```ts
@SkipThrottle()
@Controller('contabilidade/politicas')
@UseGuards(JwtAuthGuard, RbacGuard)
export class PoliticasContabilizacaoController {
  constructor(private readonly politicas: PoliticasContabilizacaoService) {}

  @Get()
  @RequirePermissoes('CONTABILIDADE_POLITICA_LER')
  listar(@Query(new ZodValidationPipe(listarPoliticasSchema)) query: ListarPoliticasQuery) {
    return this.politicas.listar(query);
  }

  @Get('exportar')
  @RequirePermissoes('CONTABILIDADE_POLITICA_LER')
  exportar(@Query(new ZodValidationPipe(listarPoliticasSchema)) query: ListarPoliticasQuery) {
    return this.politicas.exportarCsv(query);
  }

  @Get('opcoes')
  @RequirePermissoes('CONTABILIDADE_POLITICA_LER')
  opcoes() {
    return this.politicas.listarOpcoes();
  }

  @Post()
  @RequirePermissoes('CONTABILIDADE_POLITICA_GERENCIAR')
  configurar(@Body(new ZodValidationPipe(configurarSchema)) dto: ConfigurarPoliticaDto, @CurrentUser() user: CurrentUserPayload) {
    return this.politicas.configurar(dto, user.sub);
  }

  @Post('validar')
  @RequirePermissoes('CONTABILIDADE_POLITICA_LER')
  validar(@Body(new ZodValidationPipe(configurarSchema)) dto: ConfigurarPoliticaDto) {
    return this.politicas.validar(dto);
  }

  @Post('lote')
  @RequirePermissoes('CONTABILIDADE_POLITICA_GERENCIAR')
  lote(@Body(new ZodValidationPipe(loteSchema)) dto: LotePoliticaDto, @CurrentUser() user: CurrentUserPayload) {
    return this.politicas.lote(dto, user.sub);
  }

  @Get(':codigo/historico')
  @RequirePermissoes('CONTABILIDADE_POLITICA_LER')
  historico(@Param('codigo') codigo: string) {
    return this.politicas.historico(codigo);
  }

  @Post(':codigo/:acao')
  @RequirePermissoes('CONTABILIDADE_POLITICA_GERENCIAR')
  acao(
    @Param('codigo') codigo: string,
    @Param('acao') acao: 'editar' | 'simular' | 'aprovar',
    @Body() corpo: unknown,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const schema = acao === 'editar' ? editarSchema : acao === 'simular' ? simularSchema : acao === 'aprovar' ? aprovarSchema : null;
    if (!schema) throw new NotFoundException();
    return this.politicas.executar(acao, codigo, schema.parse(corpo), user.sub);
  }
}
```

Declarar `exportar`, `opcoes`, `validar` e `lote` antes de `:codigo`, senão o Nest trata o segmento fixo como código.

Cada route do BFF usa `repassar`. A rota `[codigo]/[acao]` repassa `POST /contabilidade/politicas/${codigo}/${acao}`. Ação fora de `editar` | `simular` | `aprovar` responde 404.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/integration/politicas-contabilizacao.e2e-spec.ts --runInBand` em `app/backend`.

Expected: PASS. Comercial recebe 403. O JSON do administrador não contém UUID. O 422 traz o envelope do `AllExceptionsFilter`: `message` é o objeto `{ message: 'mapeamento ausente', codigo: 'LIQUIDACAO-2026-10' }`, `requestId` é `unknown` quando o teste não manda `x-request-id`, e `path` é `/contabilidade/politicas`.

- [ ] **Step 5: Commit**

```powershell
git add app/backend/src/modules/contabilidade/politicas/politicas.controller.ts app/frontend/src/app/api/contabilidade/politicas app/backend/test/integration/politicas-contabilizacao.e2e-spec.ts
git commit -m @"
feat(contabilidade): publica as políticas de contabilização no BFF

### Descrição Detalhada:
Expõe a listagem, a simulação, a aprovação e o CSV pelo Nest e pelo BFF, com erro de domínio no formato message e codigo.

### Motivo da Mudança:
A tela não pode receber UUID, e os demais perfis não podem chamar a API.

### Impacto:
Perfil comercial recebe 403. O administrador recebe rótulos e o código de negócio só no JSON.
"@
```

## Task 6: Tela

**Files:**
- Modify: `app/frontend/src/app/(admin)/erp/contabilidade/politicas-de-contabilizacao/page.tsx`
- Create: `app/frontend/src/app/(admin)/erp/contabilidade/politicas-de-contabilizacao/politicas-contabilizacao-client.tsx`
- Create: `app/frontend/__tests__/politicas-contabilizacao-apresentacao.test.ts`

**Interfaces:**
- Consumes: BFF da Task 5, `BadgeProvisorio`, `Button` de `@/components/ui/button`.
- Produces: a página `/erp/contabilidade/politicas-de-contabilizacao`.

- [ ] **Step 1: Write the failing test**

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PoliticasContabilizacaoClient } from '../src/app/(admin)/erp/contabilidade/politicas-de-contabilizacao/politicas-contabilizacao-client';

function linha(codigo: string, tipoEventoRotulo: string): PoliticaApresentada {
  return {
    codigo,
    tipoEvento: 'LIQUIDACAO',
    tipoEventoRotulo,
    competencia: '2026-10-01',
    competenciaRotulo: 'Outubro de 2026',
    contaDebitoCodigo: '1.1.01',
    contaDebitoNome: 'Caixa e bancos',
    contaCreditoCodigo: '2.1.01',
    contaCreditoNome: 'Fornecedores',
    centroCodigo: 'CT1',
    centroNome: 'Operação industrial',
    vigenciaInicio: '2026-10-01',
    situacao: 'DRAFT',
    situacaoRotulo: 'Rascunho',
    numero: 1,
    responsavelNome: 'Administrador',
    aprovadorNome: null,
    criadoEm: '2026-10-15T10:00:00.000Z',
    alteradoEm: '2026-10-15T10:00:00.000Z',
    simulacaoValor: null,
    simulacaoDebito: null,
    simulacaoCredito: null,
  };
}

it('mostra os rótulos da grade e esconde uuid, enum cru e a palavra Marca', () => {
  render(<PoliticasContabilizacaoClient inicial={[{
    codigo: 'LIQUIDACAO-2026-10',
    tipoEvento: 'LIQUIDACAO',
    tipoEventoRotulo: 'Liquidação',
    competencia: '2026-10-01',
    competenciaRotulo: 'Outubro de 2026',
    contaDebitoCodigo: '1.1.01',
    contaDebitoNome: 'Caixa e bancos',
    contaCreditoCodigo: '2.1.01',
    contaCreditoNome: 'Fornecedores',
    centroCodigo: 'CT1',
    centroNome: 'Operação industrial',
    vigenciaInicio: '2026-10-01',
    situacao: 'DRAFT',
    situacaoRotulo: 'Rascunho',
    numero: 1,
    responsavelNome: 'Administrador',
    aprovadorNome: null,
    criadoEm: '2026-10-15T10:00:00.000Z',
    alteradoEm: '2026-10-15T10:00:00.000Z',
    simulacaoValor: null,
    simulacaoDebito: null,
    simulacaoCredito: null,
  }]} />);
  for (const rotulo of ['Competência', 'Situação', 'Conta de débito', 'Conta de crédito', 'Centro de custo', 'Tipo de ocorrência']) {
    expect(screen.getByRole('columnheader', { name: new RegExp(rotulo) })).toBeInTheDocument();
  }
  expect(screen.getByRole('button', { name: 'Configurar mappings' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Simular evento' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Aprovar regra' })).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'Selecionar Liquidação' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Ordenar por Situação' })).not.toBeInTheDocument();
  expect(screen.queryByRole('columnheader', { name: 'Início de vigência' })).not.toBeInTheDocument();
  for (const rotulo of ['Competência', 'Conta de débito', 'Conta de crédito', 'Centro de custo', 'Tipo de ocorrência']) {
    expect(screen.getByRole('button', { name: `Ordenar por ${rotulo}` })).toBeInTheDocument();
  }
  expect(screen.getByText('Provisório')).toBeInTheDocument();
  expect(screen.getByText('Enquadramento fiscal')).toBeInTheDocument();
  const texto = document.body.textContent ?? '';
  expect(texto).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  expect(texto).not.toMatch(/Marca/);
  expect(texto).not.toMatch(/E09/);
  expect(texto).not.toMatch(/e09-t02/i);
  expect(texto).not.toMatch(/LIQUIDACAO/);
});

it('desembrulha o envelope e mostra aprovador diferente do autor', async () => {
  const user = userEvent.setup();
  const fetchMock = jest.fn().mockResolvedValue({
    ok: false,
    status: 422,
    text: async () => JSON.stringify({
      statusCode: 422,
      message: { message: 'aprovador diferente do autor', codigo: 'LIQUIDACAO-2026-10' },
      timestamp: '2026-10-15T00:00:00.000Z',
      path: '/contabilidade/politicas/LIQUIDACAO-2026-10/aprovar',
      requestId: 'unknown',
    }),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  await user.click(screen.getByRole('button', { name: 'Aprovar regra' }));
  await user.type(screen.getByLabelText('Justificativa / observação'), 'o autor tenta aprovar');
  await user.click(screen.getByRole('button', { name: 'Confirmar' }));
  expect(await screen.findByText('aprovador diferente do autor')).toBeInTheDocument();
});

it('com duas linhas marcadas, Simular evento e Aprovar regra chamam o lote', async () => {
  const user = userEvent.setup();
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' });
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[
    linha('LIQUIDACAO-2026-10', 'Liquidação'),
    linha('TARIFA-2026-10', 'Tarifa'),
  ]} />);
  await user.click(screen.getByRole('checkbox', { name: 'Selecionar Liquidação' }));
  await user.click(screen.getByRole('checkbox', { name: 'Selecionar Tarifa' }));
  await user.click(screen.getByRole('button', { name: 'Simular evento' }));
  await user.type(screen.getByLabelText('Justificativa / observação'), 'simula o lote');
  await user.click(screen.getByRole('button', { name: 'Confirmar' }));
  expect(screen.getByText('Valor é obrigatório.')).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText('Valor'), '10,10');
  await user.click(screen.getByRole('button', { name: 'Confirmar' }));
  expect(fetchMock).toHaveBeenCalledWith('/api/contabilidade/politicas/lote', expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({
      acao: 'simular',
      codigos: ['LIQUIDACAO-2026-10', 'TARIFA-2026-10'],
      justificativa: 'simula o lote',
      numeroPorCodigo: { 'LIQUIDACAO-2026-10': 1, 'TARIFA-2026-10': 1 },
      valor: '10.10',
    }),
  }));
  fetchMock.mockClear();
  await user.click(screen.getByRole('button', { name: 'Aprovar regra' }));
  await user.type(screen.getByLabelText('Justificativa / observação'), 'aprova o lote');
  await user.click(screen.getByRole('button', { name: 'Confirmar' }));
  expect(fetchMock).toHaveBeenCalledWith('/api/contabilidade/politicas/lote', expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({
      acao: 'aprovar',
      codigos: ['LIQUIDACAO-2026-10', 'TARIFA-2026-10'],
      justificativa: 'aprova o lote',
      numeroPorCodigo: { 'LIQUIDACAO-2026-10': 1, 'TARIFA-2026-10': 1 },
    }),
  }));
});

it('não marca o 21º código', async () => {
  const user = userEvent.setup();
  const linhas = Array.from({ length: 21 }, (_, indice) => linha(
    `REGISTRO-2026-${String(indice + 1).padStart(2, '0')}`,
    `Registro ${indice + 1}`,
  ));
  render(<PoliticasContabilizacaoClient inicial={linhas} />);
  for (const item of linhas) {
    await user.click(screen.getByRole('checkbox', { name: `Selecionar ${item.tipoEventoRotulo}` }));
  }
  expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(20);
  expect(screen.getByRole('checkbox', { name: 'Selecionar Registro 21' })).not.toBeChecked();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/politicas-contabilizacao-apresentacao.test.ts --runInBand` em `app/frontend`.

Expected: FAIL com módulo ausente.

- [ ] **Step 3: Write minimal implementation**

`page.tsx` substitui o mínimo da Task 1. É server component que lê a primeira página em `/api/contabilidade/politicas` e renderiza `PoliticasContabilizacaoClient`. Sem cookie de sessão, o BFF já redireciona pelo fluxo `(admin)` existente.

O client implementa D2, D4 e D6. A chave `politicas-de-contabilizacao` só entra em `sessionStorage.getItem` / `setItem`.

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';

const CHAVE_RASCUNHO = 'politicas-de-contabilizacao';
const ABAS = ['Ficha e campos', 'Movimentações', 'Regras e validações', 'Exceções', 'Histórico', 'Integrações', 'Aceite e testes'] as const;
const EXCECOES = ['Mapeamento ausente', 'Evento duplicado'];
const COLUNAS: { rotulo: string; ordenar?: 'competencia' | 'contaDebito' | 'contaCredito' | 'centroCusto' | 'tipoEvento' }[] = [
  { rotulo: 'Competência', ordenar: 'competencia' },
  { rotulo: 'Situação' },
  { rotulo: 'Conta de débito', ordenar: 'contaDebito' },
  { rotulo: 'Conta de crédito', ordenar: 'contaCredito' },
  { rotulo: 'Centro de custo', ordenar: 'centroCusto' },
  { rotulo: 'Tipo de ocorrência', ordenar: 'tipoEvento' },
];

function textoMensagem(message: unknown): string {
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.map(String).join(' ');
  if (message && typeof message === 'object' && 'message' in message) {
    return textoMensagem((message as { message: unknown }).message);
  }
  return '';
}

async function lerMensagem(resposta: Response): Promise<string> {
  const texto = await resposta.text();
  if (!texto) return '';
  try {
    const corpo = JSON.parse(texto) as { message?: unknown };
    return textoMensagem(corpo.message);
  } catch {
    return texto;
  }
}

export function PoliticasContabilizacaoClient({ inicial, semAcesso = false }: { inicial: PoliticaApresentada[]; semAcesso?: boolean }) {
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [linhas] = useState(inicial);
  if (semAcesso) return <p>Acesso não permitido</p>;

  function alternar(codigo: string) {
    setMarcadas((atual) => {
      if (atual.includes(codigo)) return atual.filter((item) => item !== codigo);
      if (atual.length >= 20) return atual;
      return [...atual, codigo];
    });
  }

  return (
    <>
      <h1>Políticas de contabilização</h1>
      <p>Acesso típico: contador <BadgeProvisorio texto="Provisório" /></p>
      <Button type="button" variant="secondary">Exportar</Button>
      <Button type="button" variant="secondary">+ Novo registro</Button>
      <Button type="button">Configurar mappings</Button>
      <Button type="button" variant="secondary">Simular evento</Button>
      <Button type="button" variant="secondary">Aprovar regra</Button>
      <table>
        <thead>
          <tr>
            <th><span className="sr-only">Selecionar</span></th>
            {COLUNAS.map((coluna) => (
              <th key={coluna.rotulo}>
                {coluna.ordenar
                  ? <button type="button" aria-label={`Ordenar por ${coluna.rotulo}`}>{coluna.rotulo}</button>
                  : coluna.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr key={linha.codigo}>
              <td>
                <input
                  type="checkbox"
                  aria-label={`Selecionar ${linha.tipoEventoRotulo}`}
                  checked={marcadas.includes(linha.codigo)}
                  onChange={() => alternar(linha.codigo)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div role="tablist">
        {ABAS.map((nome) => (
          <button key={nome} type="button" role="tab">{nome}</button>
        ))}
      </div>
      <p><b>Bloqueio / exceção:</b> {EXCECOES[0]}.</p>
      <p>Enquadramento fiscal</p>
      <p>— <BadgeProvisorio texto="Provisório" /></p>
    </>
  );
}
```

`renderTable` (`aplicacao.js` L164–L177) não desenha checkbox, mesmo com `multiSelect: true`. O rótulo do controle é `Selecionar` mais o nome de negócio da linha. Nesta tela esse nome é `tipoEventoRotulo` (a célula do enum; exemplo `Selecionar Liquidação`). Não é coluna visível nova: o cabeçalho `Selecionar` usa `className="sr-only"`, a mesma classe de `plano-contas-client.tsx`. O código de negócio não entra no `aria-label`. `Situação` fica texto, porque `sortable` (`componentes.js` L5942–L5948) e `listarPoliticasSchema.ordenar` não têm `situacao`. O botão `Ordenar por` fica nas outras cinco.

O snippet acima é o contrato da grade que o teste enxerga. A implementação completa acrescenta, sem trocar esses textos:

`dataBr`, `valorApi` e `confirmarLoteOuAcao` ficam dentro do client. `marcadas` é o estado dos códigos. `linhas` é a lista em tela, iniciada com `inicial`. Ao abrir o modal, `Valor` e `Justificativa / observação` começam vazios e só um `Confirmar` fica visível. No sucesso o modal fecha, para o `type` seguinte não concatenar no campo anterior.

```tsx
function dataBr(iso: string | null): string {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  if (!ano || !mes || !dia) return '—';
  return `${dia}/${mes}/${ano}`;
}

function valorApi(texto: string): string {
  const casado = /^(\d{1,13}),(\d{2})$/.exec(texto.trim());
  return casado ? `${casado[1]}.${casado[2]}` : '';
}

async function confirmarLoteOuAcao(acao: 'simular' | 'aprovar', textoValor: string, justificativa: string, selecionada: PoliticaApresentada) {
  const valor = valorApi(textoValor);
  if (acao === 'simular' && !valor) {
    setAviso('Valor é obrigatório.');
    return;
  }
  const emLote = marcadas.length > 1;
  const resposta = emLote
    ? await fetch('/api/contabilidade/politicas/lote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        acao,
        codigos: marcadas,
        justificativa,
        numeroPorCodigo: Object.fromEntries(
          linhas.filter((linha) => marcadas.includes(linha.codigo)).map((linha) => [linha.codigo, linha.numero]),
        ),
        ...(acao === 'simular' ? { valor } : {}),
      }),
    })
    : await fetch(`/api/contabilidade/politicas/${encodeURIComponent(selecionada.codigo)}/${acao}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(acao === 'simular'
        ? { numero: selecionada.numero, valor, justificativa }
        : { numero: selecionada.numero, justificativa }),
    });
  if (!resposta.ok) {
    setAviso(await lerMensagem(resposta));
    return;
  }
  setModal(null);
  if (acao === 'aprovar') setAviso('concluído com evidência');
}
```

- `Configurar mappings` e `+ Novo registro` abrem o drawer `Dados principais` e o POST vai para `/api/contabilidade/politicas`. O botão de confirmar o drawer repete `Configurar mappings`. Não usar `Salvar rascunho ilustrativo` nem `Criar`.
- `Editar versão` faz `POST /api/contabilidade/politicas/{codigo}/editar`.
- Uma linha marcada, ou nenhuma além da linha aberta: `Simular evento` abre o modal com `Valor` e `Justificativa / observação`. O valor pt-BR `10,10` sai no JSON como `"10.10"`. O POST é `.../simular`. `Aprovar regra` abre o modal só com `Justificativa / observação` e faz `POST .../aprovar`.
- Duas ou mais linhas marcadas: os mesmos botões chamam `confirmarLoteOuAcao`. O corpo vai para `POST /api/contabilidade/politicas/lote`. Simular sem valor não chama `fetch` e mostra `Valor é obrigatório.`. Aprovar em lote não envia `valor`. O cartão mobile (`max-width: 800px`) repete o mesmo checkbox, com o mesmo `aria-label`.
- `Ações do processo` abre o drawer com os três comandos e `Abrir decisão →`. Cada um dispara a mesma ação do botão de mesmo rótulo. Não fundir os três num botão só.
- Drawer: label `Justificativa auditável`. Não renderizar `Motivo da alteração`.
- `Verificar dados` chama `POST /api/contabilidade/politicas/validar`.
- Filtro `aria-label="Filtrar competência"` (`input type="month"`) e `aria-label="Filtrar situação"` com `Todos`, `Rascunho`, `Aguardando revisão`, `Aprovado`, `Rejeitado`, `Suspenso`.
- Busca `aria-label="Buscar registros da lista"`.
- Lookup `Pesquisar`. Lista vazia: toast `Nenhum cadastro disponível para seleção. Consulte a área responsável.`
- 403 mostra `Acesso não permitido`. 409 e 422 passam `message` em `lerMensagem` / `textoMensagem` e mostram o texto interno (`evento duplicado`, `conflito concorrente`, `mapeamento ausente`, `origem imutável`, `balanceamento exato`, `aprovador diferente do autor`). O Playwright da Task 7 procura esse texto, não o objeto do filtro. Depois de aprovar, toast `concluído com evidência`.
- Na ficha, `Início de vigência` usa `dataBr` (`01/10/2026` para `2026-10-01`). A grade não tem essa coluna.
- Aba Regras e validações: `origem imutável, não lançar sem mapeamento correto, balanceamento exato`.
- Aba Exceções: `Mapeamento ausente` e `Evento duplicado`.
- Aba Integrações: `Esta tela não chama serviço externo.`
- Mobile (`max-width: 800px`): cada linha da grade vira um cartão com os seis rótulos. Nenhum cartão mostra UUID nem `LIQUIDACAO`.
- Nenhum `Button` usa `variant="outline"`.

Não usar a palavra `Marca`. Não renderizar `E09`, `E09-T02`, a chave de rascunho nem o token do enum.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/politicas-contabilizacao-apresentacao.test.ts __tests__/menu-v2.test.ts --runInBand` em `app/frontend`.

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add "app/frontend/src/app/(admin)/erp/contabilidade/politicas-de-contabilizacao" app/frontend/__tests__/politicas-contabilizacao-apresentacao.test.ts
git commit -m @"
feat(contabilidade): monta a tela das políticas de contabilização

### Descrição Detalhada:
Reproduz grade, abas, ações e formulário com os rótulos integrais do protótipo e o selo Provisório.

### Motivo da Mudança:
A persona contador não é perfil canônico, e a tela não pode exibir UUID nem o código da task.

### Impacto:
O administrador passa a abrir /erp/contabilidade/politicas-de-contabilizacao. A rota do plano de contas e as 39 rotas operacionais não mudam de rótulo.
"@
```

## Task 7: Playwright da jornada

**Files:**
- Create: `app/frontend/e2e/e09-t02-politicas-contabilizacao.spec.ts`

**Interfaces:**
- Consumes: a tela da Task 6 e a API da Task 5. Login igual a `app/frontend/e2e/shell-ds.spec.ts` L42–L61 (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`). O segundo usuário nasce por `POST /api/usuarios` com `perfis: ['administrador']` (`createUsuarioSchema` aceita slugs; `vincularPerfis` grava o perfil existente). Não cria o 12º perfil.
- Produces: evidência E2E da jornada configurar → simular → aprovar por outra pessoa, mais o 422 do autor.

- [ ] **Step 1: Write the failing test**

```ts
test('administrador configura, simula e outra pessoa aprova', async ({ browser }) => {
  const admin = await browser.newContext();
  const page = await admin.newPage();
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto('/erp/contabilidade/politicas-de-contabilizacao');
  await expect(page).toHaveURL(/\/erp\/contabilidade\/politicas-de-contabilizacao$/);
  await expect(page).not.toHaveURL(/e\d{2}-t\d{2}/i);
  await expect(page.getByRole('heading', { name: 'Políticas de contabilização' })).toBeVisible();
  await expect(page.getByText('Provisório')).toBeVisible();
  await prepararContasPelaTelaDoPlano(page);
  await page.goto('/erp/contabilidade/politicas-de-contabilizacao');
  await page.getByRole('button', { name: 'Configurar mappings' }).click();
  await page.getByLabel('Conta de débito').selectOption({ label: 'Caixa e bancos' });
  await page.getByLabel('Conta de crédito').selectOption({ label: 'Fornecedores' });
  await page.getByLabel('Centro de custo').selectOption({ label: 'Operação industrial' });
  await page.getByLabel('Tipo de ocorrência').selectOption({ label: 'Liquidação' });
  await page.getByLabel('Competência').fill('2026-10');
  await page.getByLabel('Início de vigência').fill('2026-10-01');
  await page.getByLabel('Justificativa auditável').fill('abre a regra');
  await page.getByRole('button', { name: 'Configurar mappings' }).last().click();
  await expect(page.getByRole('cell', { name: 'Liquidação' })).toBeVisible();
  await expect(page.getByText('LIQUIDACAO')).toHaveCount(0);
  await page.getByRole('button', { name: 'Simular evento' }).click();
  await page.getByLabel('Valor').fill('10,10');
  await page.getByLabel('Justificativa / observação').fill('simula o evento');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await page.getByRole('button', { name: 'Aprovar regra' }).click();
  await page.getByLabel('Justificativa / observação').fill('o autor tenta aprovar');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('aprovador diferente do autor')).toBeVisible();
  await page.getByRole('tab', { name: 'Regras e validações' }).click();
  await expect(page.getByText('origem imutável, não lançar sem mapeamento correto, balanceamento exato')).toBeVisible();
  await page.getByRole('tab', { name: 'Exceções' }).click();
  await expect(page.getByText('Mapeamento ausente')).toBeVisible();
  await expect(page.getByText('Evento duplicado')).toBeVisible();
  const outra = await browser.newContext();
  const paginaOutra = await outra.newPage();
  await criarSegundoAdministrador(page);
  await login(paginaOutra, 'contador.provisorio@alphacarnes.local', 'senha-da-jornada');
  await paginaOutra.goto('/erp/contabilidade/politicas-de-contabilizacao');
  await paginaOutra.getByRole('cell', { name: 'Liquidação' }).click();
  await paginaOutra.getByRole('button', { name: 'Aprovar regra' }).click();
  await paginaOutra.getByLabel('Justificativa / observação').fill('outra pessoa aprova');
  await paginaOutra.getByRole('button', { name: 'Confirmar' }).click();
  await expect(paginaOutra.getByText('Aprovado')).toBeVisible();
  await expect(paginaOutra.getByText('concluído com evidência')).toBeVisible();
  await admin.close();
  await outra.close();
});
```

`prepararContasPelaTelaDoPlano` usa a rota já existente `/erp/contabilidade/plano-de-contas`. Não cria tabela nova de plano. Para cada conta, o helper abre `+ Novo registro`, preenche `Código`, `Informe conta contábil`, `Conta sintética/analítica`, `Natureza da conta` = `Ativo`, `Grupo` = `Circulante`, o pai quando houver, `Centro de custo`, `Início de vigência` = `2026-10-01` e `Motivo da alteração`, clica `Criar`, depois `Revisar competência` e `Aprovar` com `Justificativa / observação` e `Confirmar`. A ordem é: centro `Operação industrial` pelo `+ Novo registro` do lookup; conta sintética `1` / `Grupo do ativo` sem pai; analítica `1.1.01` / `Caixa e bancos` filha de `1`; sintética `2` / `Grupo do passivo` sem pai; analítica `2.1.01` / `Fornecedores` filha de `2`.

`criarSegundoAdministrador` faz, com o cookie do primeiro administrador:

```ts
await page.request.post('/api/usuarios', {
  data: {
    nome: 'Contador provisório',
    email: 'contador.provisorio@alphacarnes.local',
    password: 'senha-da-jornada',
    perfis: ['administrador'],
  },
});
```

O slug `administrador` já existe no seed. A chamada não cria perfil.

Um segundo teste repete a configuração na competência `2026-11` com o mesmo tipo e, em seguida, tenta de novo `2026-10`. A mensagem visível é `evento duplicado`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/e09-t02-politicas-contabilizacao.spec.ts` em `app/frontend`, com o backend e o frontend de teste já usados pelos outros specs.

Expected: FAIL até a jornada existir por completo. Se as tasks 1–6 já passaram, este step falha só se um rótulo divergir; nesse caso corrigir a tela, não o rótulo da fonte.

- [ ] **Step 3: Write minimal implementation**

O spec acima é a implementação desta task. Ajustar só seletores instáveis (dialog `Confirmar`) para o componente realmente renderizado na Task 6, sem trocar rótulos.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/e09-t02-politicas-contabilizacao.spec.ts` em `app/frontend`.

Expected: PASS. Em seguida, no `app/backend`: `npm run test:cov` continua com linha e branch ≥ 80%. No `app/frontend`: `npm test` dos arquivos novos passa.

- [ ] **Step 5: Commit**

```powershell
git add app/frontend/e2e/e09-t02-politicas-contabilizacao.spec.ts
git commit -m @"
test(contabilidade): cobre a jornada das políticas de contabilização

### Descrição Detalhada:
Exercita configurar, simular, a recusa do autor e a aprovação por outra pessoa no mesmo perfil administrador.

### Motivo da Mudança:
O aceite da fatia exige a jornada na tela, não só o serviço.

### Impacto:
O spec usa dois usuários do perfil administrador. Não chama SEFAZ, banco nem EISS e não grava lançamento.
"@
```

## Correções da revisão crítica (r3)

Origem: revisão crítica preliminar independente de 2026-10-15 (head `c4f99ee`; o ramo está em `ebb40ed`, que só acrescenta o AD-25 em `docs/execucao/DECISOES.md`). Os números de linha abaixo são os do ramo atual e valem só para os arquivos da E09-T02. As Tasks 1–7 acima estão implementadas até `c4f99ee` e não são reescritas; as Tasks 8–17 corrigem por cima delas (a 17 é condicional e a última). Onde uma Task 1–7 contradiz uma Task 8–17, vale a Task 8–17 (em especial: o bloco `Bloqueio / exceção:` fora das abas da Task 6, L1484, e a recusa de `0.00` que a Task 4 e a seção "Decisões em aberto" item 6 diziam não existir).

### Decisões aplicadas (AD-25) e pontos que não geram mudança

- **AD-25 (1), segregação por autor original:** `aprovarNaTx` (`politicas.service.ts` L575) compara o aprovador só com `responsavelId` da versão. Quem editou pode aprovar, desde que não seja o autor. **Não gera mudança.** As Tasks 8–17 não alteram esse `if`, e nenhum teste novo exige "editor diferente do aprovador".
- **AD-25 (2), vínculo da simulação à versão:** `aprovarNaTx` (L578–L584) aceita qualquer simulação da mesma `versaoNumero`; editar sem trocar o número não invalida a simulação. **Não gera mudança** no vínculo. A parte "valor simulado maior que 0,00" **gera mudança** (Task 10).
- **M7, mesma conta em débito e crédito:** o plano permite (Decisões em aberto item 6, primeira metade). Nada é recusado. Fica registrado aqui; nenhum teste novo.
- **Migration para um CHECK `valor > 0`:** **não há migration nova.** O CHECK atual `chk_politica_simulacoes_balance` (`contabilidade-politicas.schema.ts` L69) aceita `0.00`. A Task 10 fecha o caminho no DTO (400), no serviço (422, também para o lote) e no `aprovarNaTx` (ignora simulação com valor zero já gravada). Todo escritor da tabela passa pelo serviço, e um CHECK novo falharia ou exigiria `NOT VALID` em bancos que já tenham `0.00`. Se o Portão 1 ou o Portão 2 exigir o CHECK, ele vira uma migration `0051` depois da renumeração da Task 17, e a colisão de numeração com a trilha E01 é do coordenador. Nenhum worker cria essa migration por conta própria.

### Pré-condição: dependência da E09-T01 corrigida

A E09-T01 tem uma r3 em paralelo (outro Planner). A E09-T02 só começa a Task 8 depois que o coordenador integrar essa r3 na branch por **merge normal** (`git merge --no-ff <ref-informado-pelo-coordenador>`; confirmar com `git merge-base --is-ancestor <sha-informado> HEAD`). Sem rebase, sem cherry-pick, sem editar `app/backend/src/modules/contabilidade/plano/**` (a única exceção é o método `listarContasAnaliticasVigentes`, na Task 9), `contabilidade-plano.schema.ts` nem o spec da T01 (`app/frontend/e2e/e09-t01-plano-contas.spec.ts`).

O que a T02 usa da T01:

- A regra "conta vigente" é a da T01 corrigida: **a versão em vigor é a de maior `numero` entre as versões já decididas (`APPROVED` ou `SUSPENDED`)**, e a conta só serve se essa versão for `APPROVED`, `analitica` e dentro da vigência. Uma versão `DRAFT`, `REVIEW` ou `REJECTED` mais nova não derruba a versão em vigor. A Task 9 implementa essa regra em `contaAnaliticaVigente` (arquivo da T02), reutilizando `ultimaVersaoDecidida` de `plano/vigencia.ts` (criada pela Task 9 da T01 r3, commit `143aec2`), e também em `PlanoContasService.listarContasAnaliticasVigentes` (`plano.service.ts` L173–L198), de onde vem `GET /contabilidade/politicas/opcoes`. Esse método **é da própria T02** (criado no commit `24d30b7`) e a T01 r3 não o corrige: é a única exceção ao critério de parada 2.
- O helper de teste `prepararContasAnaliticas` (`politicas-contabilizacao.e2e-spec.ts` L106–L120) chama `PlanoContasService.criar`/`criarCentro`. Se o merge mudar essas assinaturas, o worker ajusta só o helper de teste da T02.
- O seed HTTP da Task 14 usa os contratos `POST /contabilidade/centros-custo`, `POST /contabilidade/plano`, `POST /contabilidade/plano/:codigo/revisar-competencia` e `.../aprovar` (`plano.dto.ts` L9–L27, L51–L60). Se a T01 corrigida mudar um desses contratos, o worker ajusta só `app/frontend/e2e/helpers/e09-t02-seed.ts`.

**Parada na pré-condição:** (a) o merge da T01 r3 não está na branch; (b) o merge da T01 r3 não trouxe `plano/vigencia.ts` com `ultimaVersaoDecidida` exportada (a Task 9 não compila): reportar, não recriar. A lista de opções com conta suspensa deixou de ser parada, porque a Task 9 a corrige; (c) o merge exige editar arquivo da T01 para a T02 compilar.

### Achados cobertos, com evidência no código atual

| Achado | Evidência atual | Task |
|---|---|---|
| B3 — `ZodError` vira 500 | `politicas.controller.ts` L81–L83 usa `schema.parse(corpo)`; `dto/politicas.dto.ts` L6 aceita `2026-13`; L5 aceita `2026-02-30`; `listarPoliticasSchema` L58 sem teto de `pagina`; `centavos.ts` L7 devolve `mapeamento ausente` com `codigo` vazio para valor monetário inválido | 8 |
| B2 (lado T02) — conta suspensa ainda vale | `politicas.service.ts` L616–L631 aceita qualquer versão `APPROVED`, mesmo com versão mais nova `SUSPENDED` | 9 |
| B7 / AD-25 (2) — simulação `0.00` destrava a aprovação | `dto/politicas.dto.ts` L30 e L34; `politicas.service.ts` L547–L557 e L578–L584 | 10 |
| Processo — filtro `deletedAt` removido em `c4f99ee` | `politicas.service.ts` L467–L501 (`consulta()` sem `where`; antes: `.where(isNull(politicasContabilizacao.deletedAt))`) | 11 |
| B8 (a) corrida do modal, B8 (c) sucesso exibido sem confirmação, processo `Bloqueio / exceção` | `politicas-contabilizacao-client.tsx` L286 (`setModal(null)` incondicional), L289–L297 (atualização otimista de `Aprovado` e do aviso sem ler o corpo), L488–L490 (bloco fora da aba) | 12 |
| B8 (b) determinismo — filtro e busca não consultam o servidor | `politicas-contabilizacao-client.tsx` L154–L158 (estado) e L388–L393 (controles) só alimentam o CSV; a lista é sempre `inicial` (`page.tsx` L9) | 13 |
| B8 (b) determinismo — Playwright com dados fixos | `e2e/e09-t02-politicas-contabilizacao.spec.ts` L3–L4 e L28–L31 (e-mail fixo do segundo administrador), L42–L47 (`CT1`), L91–L94 (códigos e nomes de conta), L127, L163 e L165 (competências fixas), L133–L136 (clica sem esperar a resposta) | 14 |
| Renumeração | `meta/_journal.json` entrada `idx` 45, tag `0049_e09_t02_politicas_contabilizacao` | 17 |

### Achados do Portão 1 r3 (r4): achado, evidência, Task e teste

| Item | Evidência no código atual | Task | Teste que falha antes e passa depois |
|---|---|---|---|
| B1 — combo ainda lista conta suspensa; critério (b) e critério 2 em impasse | `plano.service.ts` L173–L198 (método criado pela T02 em `24d30b7`; a T01 r3 `143aec2` só trata `paiValido` e ciclo) | 9 | `politicas-contabilizacao.e2e-spec.ts`: "a conta suspensa não aparece nas opções do combo" |
| B2 — registro 21+ inalcançável | `page.tsx` L8–L12 descarta `total`; cliente da Task 13 fixa `pagina: '1'`; `PAGINA = 20` em `politicas.service.ts` L36 | 15 | Jest: "Próxima página consulta pagina=2 e Anterior volta para a 1", "mudar a busca/situação/ordenação volta à página 1", "descarta a resposta antiga da página 2", "restaura a página do sessionStorage"; Playwright: "com mais de 20 políticas a página 2 é alcançada pela tela" |
| B3 — Exportar não baixa; CSV de 20 linhas; fórmula não neutralizada; BFF força JSON | cliente L380 e L393 (`void fetch`); `politicas.service.ts` L376–L390 e `escapar` L387; `bff.ts` L11–L22 | 16 | Jest backend `celulaCsv` e "exporta a visão inteira"; integração "o endpoint devolve text/csv..."; Jest BFF `bff-politicas-exportar.test.ts`; Jest cliente "Exportar visão baixa o arquivo..."; Playwright com `waitForEvent('download')` |
| 4 — Task 8 mandava parar se um caso de 400 passasse antes, mas vários já passam | `configurarSchema` enum, `listarPoliticasSchema` `min(1)` e enums, `lote` pelo `ZodValidationPipe` (`politicas.controller.ts` L61–L65) | 8 | casos marcados `guarda:`; critério 1 só para os que hoje dão 500 |
| 5 — Confirmar vira no-op silencioso quando a selecionada saiu da lista | `alvo()` L197–L201 contra `selecionada` L187 e o `return` L250 | 13 | "confirma na política exibida na ficha..." e "sem política na lista, Confirmar mostra aviso" |
| 6 — restauração não repõe `ordenar`/`direcao`; GET extra sob StrictMode | efeito L160–L172 contra o save L175; guarda `primeiraRenderizacao` | 13 (e 15 para a página) | "restaura busca, ordenação e direção..." e "sob StrictMode não faz consulta extra ao montar" |
| 7 — mutação que remove os dois `isNull` juntos | `consulta()` L467–L501 e `filtro()` L504 | 11 | dois testes, uma mutação para cada: "obter e histórico ignoram..." (mutação em `consulta`) e "listar, total e exportar ignoram..." (mutação em `filtro`) |
| 8 — credenciais do Playwright divergem do seed; mensagem de commit com três frases | spec L28–L31 (`SEED_ADMIN_*` e senha fixa) contra `loginBackend` de `onda6-seed.ts` | 14 | o spec usa `ADMIN_EMAIL` e a senha devolvida por `loginBackend`; o commit leva uma só frase de causa |
| 9 — `aprovarNaTx` não revalida contas | `politicas.service.ts` L571–L600 | 9 | "aprovar recusa quando a conta 1.1.01/2.1.01 foi suspensa depois da simulação" |

Fora da r4 por decisão: nenhuma Task implementa `PaginationPrevious`/`PaginationNext` do DS (o texto fixo em inglês não serve) e a Task 15 usa `PaginationLink`; `plano-contas-client.tsx` (L531–L533) continua com botões simples, é arquivo da T01.

### Anomalia do Playwright (B8 c): hipóteses e como a Task 14 decide

O screenshot de falha mostrou `Aprovado` e `concluído com evidência` com o banco em `DRAFT` e sem auditoria de aprovar. No código atual essas duas strings só aparecem depois de `resposta.ok` verdadeiro (`politicas-contabilizacao-client.tsx` L282–L296), e o BFF repassa o status do backend sem alterar (`app/frontend/src/lib/bff.ts` L11–L22). Portanto, ou (H1) a tela falou com um backend/banco diferente do que foi inspecionado — `playwright.config.ts` L54 usa `reuseExistingServer: !process.env.CI` e o `BACKEND_INTERNAL_URL` padrão é `http://127.0.0.1:4001`, então um Next ou backend já em pé em outra worktree é reaproveitado sem aviso —, ou (H2) o backend respondeu 2xx sem efeito, o que o código lido não permite, ou (H3) a leitura do screenshot confundiu a opção `Aprovado` do filtro de situação (`politicas-contabilizacao-client.tsx` L39) com a célula. A Task 12 faz o cliente nunca exibir sucesso sem o corpo confirmar (`situacao === 'APPROVED'`). A Task 14 prova no próprio spec, pela API por trás do BFF, que a tela e o banco consultado são o mesmo sistema, e registra qual hipótese ocorreu.

### Critérios de parada do delta

Parar e reportar ao coordenador, sem contornar:

1. Qualquer teste "falha antes" desta seção passar antes da correção (a reprodução está errada). Exceções declaradas: Task 11, que é característica de comportamento e usa duas mutações separadas, e os casos marcados `guarda:` (Tasks 8, 9, 13), que passam antes e depois por desenho; um `guarda:` que **falhe** antes também é parada.
2. Necessidade de editar arquivo fora da T02 (pasta `plano/`, schema do plano, `e09-t01-*`, `docs/execucao/`). **Exceção explícita e única:** o método `PlanoContasService.listarContasAnaliticasVigentes` (`plano.service.ts`), criado pela própria T02, editado na Task 9. Qualquer outro método ou arquivo de `plano/**` segue proibido. A Task 16 edita `app/frontend/src/lib/bff.ts` (só acrescenta `repassarArquivo`), que é arquivo compartilhado do frontend e não da T01.
3. Cobertura do backend abaixo de 80% de linha ou de branch; snapshot de RBAC de outro slug que não `administrador` mudando; rota operacional mudando de ordem.
4. Mensagem ou `codigo` dos Review Focus 1–5 mudando de texto.
5. Qualquer Task 8–16 exigir migration (a exceção é a Task 17).
6. Playwright (Tasks 14, 15 ou 16) vermelho depois da Task 13 sem causa isolada. Não se acrescenta `retries`, `sleep` nem limpeza de banco para passar.
7. Prefixo de migration divergente na Task 17, ou drizzle-kit gerando DDL fora das três tabelas da T02.

### Rollback do delta

Cada Task é um commit. Reverter na ordem inversa (`git revert <sha>`), um a um: 17, 16, 15, 14, 13, 12, 11, 10, 9, 8. As Tasks 8–16 não têm migration nem dado: o revert devolve só código e teste (a Task 9 devolve também o corpo antigo de `listarContasAnaliticasVigentes`, e a 16 remove `csv.ts`, `repassarArquivo` e o teste do BFF). A Task 17 só é revertida com `git revert` do commit dela, e só vale em banco descartável (ver Step 6 da Task 17). Nenhuma Task usa `git reset --hard`, `git push` nem `--force`.

### Verificação do delta (antes do Portão 2)

```powershell
Set-Location app/backend
npm run lint
npm run type-check
npm run test:cov
Set-Location ../frontend
npm run lint
npm run type-check
npm test
npx playwright test e2e/e09-t02-politicas-contabilizacao.spec.ts
```

Esperado: tudo verde, cobertura do backend ≥ 80% de linha e de branch, Playwright com todos os testes do arquivo (jornada, evento duplicado, paginação e exportação) passando em duas execuções seguidas no mesmo banco (a segunda prova que não há estado residual). O Portão 2 e o Portão A seguem a classe de risco alto: revisão crítica por commit.

## Task 8: Entrada inválida responde 400, nunca 500 (B3)

**Files:**
- Modify: `app/backend/src/modules/contabilidade/politicas/dto/politicas.dto.ts` (L5–L6, L30, L58)
- Modify: `app/backend/src/modules/contabilidade/politicas/politicas.controller.ts` (L73–L85 e imports L1, L8–L21)
- Modify: `app/backend/src/modules/contabilidade/politicas/centavos.ts` (L3–L9, L26)
- Modify: `app/backend/src/modules/contabilidade/politicas/politicas.service.ts` (remove `executar`, L392–L401)
- Test: `app/backend/test/integration/politicas-contabilizacao.e2e-spec.ts`, `app/backend/src/modules/contabilidade/politicas/politicas.service.spec.ts`

**Interfaces:**
- Consumes: `ZodValidationPipe` de `app/backend/src/common/pipes/zod-validation.pipe.ts` (responde 400 com `{ message: 'Validação falhou', errors }`), o mesmo pipe que `listar`, `exportar`, `configurar`, `validar` e `lote` já usam.
- Produces: as três rotas de ação (`editar`, `simular`, `aprovar`) validadas pelo pipe; `centavos(valor, codigo)` com a mensagem `valor monetário inválido`; `competencia` e `dataIso` com calendário.

- [ ] **Step 1: Write the failing tests**

Em `politicas-contabilizacao.e2e-spec.ts`, depois do último `it` (L257–L271), dentro do mesmo `describe`:

```ts
describe('entrada inválida responde 400 e não grava', () => {
  const corpo = {
    tipoEvento: 'LIQUIDACAO',
    competencia: '2026-10',
    contaDebitoCodigo: '1.1.01',
    contaCreditoCodigo: '2.1.01',
    centroCodigo: 'CT1',
    vigenciaInicio: '2026-10-01',
    justificativa: 'tenta',
  };
  const post = (rota: string, enviado: object) =>
    request(srv()).post(rota).set('Cookie', adminCookies).send(enviado);
  const get = (rota: string) => request(srv()).get(rota).set('Cookie', adminCookies);

  const invalidosDeOrigem: [string, Record<string, unknown>][] = [
    ['competência com mês 13', { competencia: '2026-13' }],
    ['competência com mês 00', { competencia: '2026-00' }],
    ['competência com ano 0000', { competencia: '0000-05' }],
    ['vigência em 30 de fevereiro', { vigenciaInicio: '2026-02-30' }],
    ['vigência com mês 13', { vigenciaInicio: '2026-13-01' }],
    ['vigência com ano 0000', { vigenciaInicio: '0000-01-01' }],
  ];

  it.each(invalidosDeOrigem)('configurar recusa %s', async (_rotulo, parcial) => {
    await prepararContasAnaliticas();
    const res = await post('/contabilidade/politicas', { ...corpo, ...parcial });
    expect(res.status).toBe(400);
    expect(res.body.statusCode).toBe(400);
    expect(await db.select().from(politicasContabilizacao)).toHaveLength(0);
  });

  it.each(invalidosDeOrigem)('validar recusa %s', async (_rotulo, parcial) => {
    await prepararContasAnaliticas();
    const res = await post('/contabilidade/politicas/validar', { ...corpo, ...parcial });
    expect(res.status).toBe(400);
  });

  // Guarda: o enum do DTO já recusa hoje. Passa antes e depois e trava a regressão; não prova reprodução.
  it('guarda: configurar e validar recusam tipo fora do enum', async () => {
    await prepararContasAnaliticas();
    for (const rota of ['/contabilidade/politicas', '/contabilidade/politicas/validar']) {
      expect((await post(rota, { ...corpo, tipoEvento: 'COMPRA' })).status).toBe(400);
    }
    expect(await db.select().from(politicasContabilizacao)).toHaveLength(0);
  });

  it.each([
    ['competência com mês 13', { competencia: '2026-13' }],
    ['vigência em 30 de fevereiro', { vigenciaInicio: '2026-02-30' }],
    ['número zero', { numero: 0 }],
    ['número negativo', { numero: -1 }],
    ['número fracionário', { numero: 1.5 }],
    ['justificativa vazia', { justificativa: '   ' }],
  ])('editar recusa %s', async (_rotulo, parcial) => {
    await prepararContasAnaliticas();
    const politica = await service.configurar(dtoConfigurar(), autorId);
    const res = await post(`/contabilidade/politicas/${politica.codigo}/editar`, {
      numero: 1,
      contaDebitoCodigo: '1.1.01',
      contaCreditoCodigo: '2.1.01',
      centroCodigo: 'CT1',
      vigenciaInicio: '2026-10-01',
      justificativa: 'edita',
      ...parcial,
    });
    expect(res.status).toBe(400);
  });

  it.each([
    ['negativo', '-1.00'],
    ['três casas decimais', '1.005'],
    ['uma casa decimal', '10.5'],
    ['sem casas decimais', '10'],
    ['vírgula no lugar do ponto', '10,50'],
    ['14 dígitos inteiros', '12345678901234.00'],
    ['texto', 'abc'],
    ['vazio', ''],
  ])('simular recusa valor %s e não grava simulação', async (_rotulo, valor) => {
    await prepararContasAnaliticas();
    const politica = await service.configurar(dtoConfigurar(), autorId);
    const res = await post(`/contabilidade/politicas/${politica.codigo}/simular`, {
      numero: 1,
      valor,
      justificativa: 'simula',
    });
    expect(res.status).toBe(400);
    expect(await db.select().from(politicaSimulacoes)).toHaveLength(0);
  });

  it.each([
    ['número zero', { numero: 0 }],
    ['número texto', { numero: 'um' }],
    ['justificativa ausente', { justificativa: undefined }],
  ])('aprovar recusa %s', async (_rotulo, parcial) => {
    await prepararContasAnaliticas();
    const politica = await service.configurar(dtoConfigurar(), autorId);
    const res = await post(`/contabilidade/politicas/${politica.codigo}/aprovar`, {
      numero: 1,
      justificativa: 'aprova',
      ...parcial,
    });
    expect(res.status).toBe(400);
    expect((await service.obter(politica.codigo)).situacao).toBe('DRAFT');
  });

  // Guarda: o ZodValidationPipe do lote (controller L61-L65) já responde 400 hoje.
  it('guarda: lote recusa valor monetário inválido e não grava simulação', async () => {
    await prepararContasAnaliticas();
    const politica = await service.configurar(dtoConfigurar(), autorId);
    const res = await post('/contabilidade/politicas/lote', {
      acao: 'simular',
      codigos: [politica.codigo],
      justificativa: 'simula',
      numeroPorCodigo: { [politica.codigo]: 1 },
      valor: '1.005',
    });
    expect(res.status).toBe(400);
    expect(await db.select().from(politicaSimulacoes)).toHaveLength(0);
  });

  it.each([
    ['competência com mês 13', '?competencia=2026-13'],
    ['página maior que o teto', '?pagina=100000000000000000000'],
  ])('listar e exportar recusam %s', async (_rotulo, consulta) => {
    expect((await get(`/contabilidade/politicas${consulta}`)).status).toBe(400);
    expect((await get(`/contabilidade/politicas/exportar${consulta}`)).status).toBe(400);
  });

  // Guardas: página 0 (min(1)) e os enums de situação e ordenação já respondem 400 hoje.
  it.each([
    ['página zero', '?pagina=0'],
    ['situação fora do enum', '?situacao=APROVADA'],
    ['ordenação fora do enum', '?ordenar=senha'],
  ])('guarda: listar e exportar recusam %s', async (_rotulo, consulta) => {
    expect((await get(`/contabilidade/politicas${consulta}`)).status).toBe(400);
    expect((await get(`/contabilidade/politicas/exportar${consulta}`)).status).toBe(400);
  });

  it('guarda: ação inexistente continua 404', async () => {
    const res = await post('/contabilidade/politicas/LIQUIDACAO-2026-10/destruir', { numero: 1, justificativa: 'x' });
    expect(res.status).toBe(404);
  });
});
```

Em `politicas.service.spec.ts`, no `describe('centavos da política')`:

```ts
it.each(['-1.00', '1.005', '10.5', '10', '10,50', '12345678901234.00', 'abc', ''])(
  'recusa %p como valor monetário inválido, com o código da política',
  (valor) => {
    try {
      centavos(valor, 'LIQUIDACAO-2026-10');
      throw new Error('deveria recusar');
    } catch (erro) {
      expect(erro).toMatchObject({
        status: 422,
        response: { message: 'valor monetário inválido', codigo: 'LIQUIDACAO-2026-10' },
      });
    }
  },
);
```

E nas duas chamadas existentes do mesmo arquivo (L5–L6), passar o segundo argumento: `centavos('0.10', 'X')`, `centavos('0.20', 'X')`, `centavos('0.30', 'X')`.

- [ ] **Step 2: Run tests to verify they fail**

```powershell
Set-Location app/backend
npx jest test/integration/politicas-contabilizacao.e2e-spec.ts src/modules/contabilidade/politicas/politicas.service.spec.ts --runInBand
```

Expected, em duas listas.

**Falham hoje (prova de reprodução):** `editar`, `simular` e `aprovar` com corpo inválido respondem 500, porque o `ZodError` do `schema.parse` do controller (L83) não é `HttpException`; `configurar` com competência de mês 00/13 ou ano 0000 e com vigência `2026-02-30`, mês 13 ou ano 0000 passa pelo regex e chega ao Postgres (500 na gravação), e `validar` com os mesmos valores não responde 400; `listar` e `exportar` com `competencia=2026-13` e com página acima do teto (`OFFSET` fora do intervalo) respondem 500; `centavos` devolve `mapeamento ausente` com `codigo` vazio e o spec novo não compila por causa do segundo argumento. Se algum destes passar antes da correção, parar (critério 1).

**Já passam hoje e ficam marcados `guarda:` (travam regressão; não provam reprodução):** `configurar` e `validar` com tipo fora do enum (`configurarSchema` já tem o enum), `listar` e `exportar` com página 0 (`min(1)`), situação e ordenação fora do enum, `lote` com `1.005` (o `ZodValidationPipe` do lote já responde 400) e a ação inexistente (404). O critério de parada 1 **não** se aplica a eles; um `guarda:` que falhe antes da correção é erro de leitura e também é parada.

- [ ] **Step 3: Write minimal implementation**

`dto/politicas.dto.ts` (substitui L5–L6, L30 e a linha `pagina` de L58):

```ts
function dataNoCalendario(valor: string): boolean {
  const [ano, mes, dia] = valor.split('-').map(Number);
  if (!ano || !mes || !dia) return false;
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(dataNoCalendario, 'Data inexistente no calendário.');
const competencia = z.string().regex(/^\d{4}-\d{2}$/)
  .refine((valor) => dataNoCalendario(`${valor}-01`), 'Competência inexistente no calendário.');
```

O `dinheiro` (L30) permanece `z.string().regex(/^\d{1,13}\.\d{2}$/)`. `listarPoliticasSchema` L58 passa a `pagina: z.coerce.number().int().min(1).max(100000).default(1)`. Nenhum `.omit()` é chamado em schema com `.refine()` nesta mudança (os `refine` ficam nos campos, não nos objetos).

`politicas.controller.ts`: apagar `NotFoundException` do import (L1), os tipos e schemas que o método genérico usava só se ficarem sem uso, e trocar o método `acao` (L73–L85) por três rotas explícitas. Rotas de um segmento (`validar`, `lote`) e a rota GET `:codigo/historico` não conflitam. Uma ação desconhecida cai no 404 padrão do Nest.

```ts
@Post(':codigo/editar')
@RequirePermissoes('CONTABILIDADE_POLITICA_GERENCIAR')
editar(
  @Param('codigo') codigo: string,
  @Body(new ZodValidationPipe(editarSchema)) dto: EditarPoliticaDto,
  @CurrentUser() user: CurrentUserPayload,
) {
  return this.politicas.editar(codigo, dto, user.sub);
}

@Post(':codigo/simular')
@RequirePermissoes('CONTABILIDADE_POLITICA_GERENCIAR')
simular(
  @Param('codigo') codigo: string,
  @Body(new ZodValidationPipe(simularSchema)) dto: SimularPoliticaDto,
  @CurrentUser() user: CurrentUserPayload,
) {
  return this.politicas.simular(codigo, dto, user.sub);
}

@Post(':codigo/aprovar')
@RequirePermissoes('CONTABILIDADE_POLITICA_GERENCIAR')
aprovar(
  @Param('codigo') codigo: string,
  @Body(new ZodValidationPipe(aprovarSchema)) dto: AprovarPoliticaDto,
  @CurrentUser() user: CurrentUserPayload,
) {
  return this.politicas.aprovar(codigo, dto, user.sub);
}
```

`politicas.service.ts`: apagar `executar` (L392–L401), que fica sem chamador. Antes, `Select-String -Path app/backend -Pattern "politicas.executar|PoliticasContabilizacaoService.*executar" -Recurse` deve achar só o controller antigo (o `executar` do `plano.service.ts` e o de pesagem são de outros módulos e ficam).

`centavos.ts`:

```ts
export function centavos(valor: string, codigo: string): bigint {
  const casado = /^(\d{1,13})\.(\d{2})$/.exec(valor);
  const inteiro = casado?.[1];
  const fracao = casado?.[2];
  if (!inteiro || !fracao) throw new RegraPoliticaException('valor monetário inválido', codigo);
  return BigInt(inteiro) * 100n + BigInt(fracao);
}
```

e L26 vira `const valor = centavos(linha.valor, codigo);`.

- [ ] **Step 4: Run tests to verify they pass**

```powershell
npx jest test/integration/politicas-contabilizacao.e2e-spec.ts src/modules/contabilidade/politicas/politicas.service.spec.ts --runInBand
npm run lint
npm run type-check
```

Expected: PASS, sem aviso de import sem uso. Conferir com `npm run test:cov` que linha e branch continuam ≥ 80%.

- [ ] **Step 5: Commit**

```powershell
git add app/backend/src/modules/contabilidade/politicas app/backend/test/integration/politicas-contabilizacao.e2e-spec.ts
git commit -m @"
fix(contabilidade): valida a entrada das políticas pelo pipe e recusa com 400

### Descrição Detalhada:
As ações editar, simular e aprovar passam a ser rotas próprias com ZodValidationPipe, no lugar do schema.parse que lançava ZodError e virava 500. A competência e a data de vigência são conferidas no calendário, a página da listagem tem teto, e o valor monetário inválido devolve a mensagem valor monetário inválido com o código da política.

### Motivo da Mudança:
A revisão crítica (B3) reproduziu 500 para competência 2026-13, valor -1.00, 1.005, 10.5 e 14 dígitos inteiros, e a mensagem mapeamento ausente com código vazio para valor monetário inválido (M8).

### Impacto:
Forma inválida responde 400 antes de abrir transação; regra de negócio continua 422 e conflito 409. Nenhuma migration. O método executar do serviço foi removido por ficar sem chamador. O 404 de ação inexistente é mantido.
"@
```

## Task 9: Conta suspensa não mapeia e não aparece nas opções (B2, lado T02; B1 do Portão 1 r3)

**Files:**
- Modify: `app/backend/src/modules/contabilidade/politicas/politicas.service.ts` (`contaAnaliticaVigente` L616–L631, `aprovarNaTx` L571–L600, imports L21–L22)
- Modify: `app/backend/src/modules/contabilidade/plano/plano.service.ts` (**somente** `listarContasAnaliticasVigentes`, L173–L198)
- Test: `app/backend/test/integration/politicas-contabilizacao.e2e-spec.ts`

**Exceção declarada ao critério de parada 2 (só esta função).** `listarContasAnaliticasVigentes` foi criada pela própria E09-T02 (commit `24d30b7`, achado por `git log -S listarContasAnaliticasVigentes -- app/backend/src/modules/contabilidade/plano/plano.service.ts`) para alimentar `GET /contabilidade/politicas/opcoes`. A E09-T01 r3 (`143aec2`) não a conhece: o plano dela não contém esse nome e só corrige `paiValido` e o caminhamento de ciclo, por `ultimaVersaoDecidida`. Sem esta edição, o teste "a conta suspensa não aparece nas opções" falharia por construção depois do merge, e o critério 2 impediria corrigir. Esta Task edita só essa função dentro de `plano/`; nenhum outro método, nenhum outro arquivo de `plano/**` (nem `vigencia.ts`), nenhum schema e nenhum spec da T01. O merge pode dar conflito textual em `plano.service.ts`, porque a T01 r3 reescreve `exportarCsv` logo abaixo desta função: a resolução mantém os dois lados e é do coordenador.

**Interfaces:**
- Consumes: `ultimaVersaoDecidida(executor, contaId)` de `app/backend/src/modules/contabilidade/plano/vigencia.ts`, criada pela Task 9 da E09-T01 r3 (devolve a linha de `conta_versoes` de maior `numero` entre as versões `APPROVED` ou `SUSPENDED` não excluídas, ou `null`; o `executor` aceita `Tx`). Esta Task só a importa (`import { ultimaVersaoDecidida } from '../plano/vigencia';`), não a altera.
- Produces: `contaAnaliticaVigente` recusa com 422 `mapeamento ausente` uma conta cuja versão em vigor é `SUSPENDED`, em `configurar`, `editar`, `validar`, `simular` e `aprovar`; `aprovarNaTx` revalida débito e crédito; `listarContasAnaliticasVigentes` (combo) aplica a mesma regra de vigência.

**Por que o combo repete a regra em SQL.** `ultimaVersaoDecidida` é por conta; usá-la para as N contas do combo seria uma consulta por conta. `listarContasAnaliticasVigentes` aplica a mesma regra numa única consulta (subconsulta de maior `numero` entre `APPROVED` e `SUSPENDED`), e os testes abaixo ligam os dois caminhos: a conta que `contaAnaliticaVigente` recusa não aparece no combo, e a que ela aceita aparece.

- [ ] **Step 1: Write the failing tests**

No mesmo arquivo de integração, junto dos helpers (L90–L125):

```ts
async function novaVersaoDaConta(codigo: string, numero: number, situacao: 'SUSPENDED' | 'DRAFT' | 'REVIEW' | 'REJECTED') {
  await db.execute(sql`
    insert into conta_versoes (conta_id, numero, nome, classificacao, natureza, grupo, conta_pai_id,
                               centro_custo_id, vigencia_inicio, vigencia_fim, situacao, justificativa, responsavel_id)
    select v.conta_id, ${numero}, v.nome, v.classificacao, v.natureza, v.grupo, v.conta_pai_id,
           v.centro_custo_id, v.vigencia_inicio, v.vigencia_fim, ${situacao}, 'caso de teste', v.responsavel_id
      from conta_versoes v
      join contas_contabeis c on c.id = v.conta_id
     where c.codigo = ${codigo} and v.numero = 1
  `);
}
```

```ts
describe('conta cuja versão em vigor está suspensa', () => {
  it('configurar recusa a conta com 422 e não grava a política', async () => {
    await prepararContasAnaliticas();
    await novaVersaoDaConta('1.1.01', 2, 'SUSPENDED');
    const res = await request(srv()).post('/contabilidade/politicas').set('Cookie', adminCookies).send(dtoConfigurar());
    expect(res.status).toBe(422);
    expect(res.body.message).toEqual({ message: 'mapeamento ausente', codigo: 'LIQUIDACAO-2026-10' });
    expect(await db.select().from(politicasContabilizacao)).toHaveLength(0);
  });

  it('a conta suspensa não aparece nas opções do combo', async () => {
    await prepararContasAnaliticas();
    await novaVersaoDaConta('1.1.01', 2, 'SUSPENDED');
    const res = await request(srv()).get('/contabilidade/politicas/opcoes').set('Cookie', adminCookies);
    expect(res.status).toBe(200);
    const codigos = (res.body.contas as { codigo: string }[]).map((conta) => conta.codigo);
    expect(codigos).not.toContain('1.1.01');
    expect(codigos).toContain('2.1.01');
  });

  it('simular recusa quando a conta foi suspensa depois da configuração', async () => {
    await prepararContasAnaliticas();
    const politica = await service.configurar(dtoConfigurar(), autorId);
    await novaVersaoDaConta('1.1.01', 2, 'SUSPENDED');
    await expect(service.simular(politica.codigo, { numero: 1, valor: '10.00', justificativa: 'simula' }, autorId))
      .rejects.toMatchObject({ status: 422, response: { message: 'mapeamento ausente', codigo: politica.codigo } });
    expect(await db.select().from(politicaSimulacoes)).toHaveLength(0);
  });

  it.each(['1.1.01', '2.1.01'])(
    'aprovar recusa quando a conta %s foi suspensa depois da simulação e a regra continua em rascunho',
    async (codigoConta) => {
      await prepararContasAnaliticas();
      const politica = await service.configurar(dtoConfigurar(), autorId);
      await service.simular(politica.codigo, { numero: 1, valor: '10.00', justificativa: 'simula' }, autorId);
      await novaVersaoDaConta(codigoConta, 2, 'SUSPENDED');
      await expect(service.aprovar(politica.codigo, { numero: 1, justificativa: 'aprova' }, outraPessoaId))
        .rejects.toMatchObject({ status: 422, response: { message: 'mapeamento ausente', codigo: politica.codigo } });
      expect((await service.obter(politica.codigo)).situacao).toBe('DRAFT');
    },
  );

  it.each(['DRAFT', 'REVIEW', 'REJECTED'] as const)(
    'guarda: uma versão %s mais nova não derruba a conta em vigor nem tira a conta das opções',
    async (situacao) => {
      await prepararContasAnaliticas();
      await novaVersaoDaConta('1.1.01', 2, situacao);
      const politica = await service.configurar(dtoConfigurar(), autorId);
      expect(politica.situacao).toBe('DRAFT');
      const opcoes = await service.listarOpcoes();
      expect(opcoes.contas.map((conta) => conta.codigo)).toContain('1.1.01');
    },
  );
});
```

O teste de aprovação por outra pessoa com contas vigentes (L227) já existe e segue como guarda de que a revalidação não bloqueia o caso feliz.

- [ ] **Step 2: Run tests to verify they fail**

```powershell
Set-Location app/backend
npx jest test/integration/politicas-contabilizacao.e2e-spec.ts -t "versão em vigor está suspensa" --runInBand
```

Expected: FAIL em `configurar` (201 em vez de 422, porque `contaAnaliticaVigente` acha a v1 `APPROVED`), em `simular` (grava a simulação), nos dois `aprovar` (a aprovação passa) e em "não aparece nas opções" (`listarContasAnaliticasVigentes` ainda lista a v1 `APPROVED`). Os três casos `guarda: ... DRAFT/REVIEW/REJECTED` passam antes e depois (guarda do significado de "em vigor"). Se algum teste que não é guarda passar antes da correção, parar (critério 1).

- [ ] **Step 3: Write minimal implementation**

`politicas.service.ts`, import novo ao lado do de `PlanoContasService` (L21): `import { ultimaVersaoDecidida } from '../plano/vigencia';`. `contaAnaliticaVigente` (L616–L631) passa a escolher a versão em vigor pelo helper da T01 e só depois confere classificação, situação e vigência:

```ts
  private async contaAnaliticaVigente(tx: Tx, codigoConta: string, codigoPolitica: string) {
    const [conta] = await tx.select({ id: contasContabeis.id }).from(contasContabeis)
      .where(and(eq(contasContabeis.codigo, codigoConta), isNull(contasContabeis.deletedAt))).limit(1);
    const emVigor = conta ? await ultimaVersaoDecidida(tx, conta.id) : null;
    if (!conta || !emVigor || emVigor.situacao !== 'APPROVED' || emVigor.classificacao !== 'analitica') {
      throw new RegraPoliticaException('mapeamento ausente', codigoPolitica);
    }
    const [vigente] = await tx.select({ id: contaVersoes.id }).from(contaVersoes).where(and(
      eq(contaVersoes.id, emVigor.id),
      sql`${contaVersoes.vigenciaInicio} <= ${HOJE}`,
      sql`(${contaVersoes.vigenciaFim} is null or ${contaVersoes.vigenciaFim} >= ${HOJE})`,
    )).limit(1);
    if (!vigente) throw new RegraPoliticaException('mapeamento ausente', codigoPolitica);
    return conta;
  }
```

`desc` continua importado porque `listar` (L406) o usa.

`aprovarNaTx` (L571–L600): depois do `if (!simulacao) throw ...` (L584) e antes do `update` (L585), revalidar as duas contas da versão. O `if` do autor (L575, AD-25 item 1) e o vínculo da simulação à `versaoNumero` (L578–L584, AD-25 item 2) não mudam; a Task 10 só acrescenta `valor > 0` na consulta da simulação:

```ts
    const idsDasContas = [versao.contaDebitoId, versao.contaCreditoId];
    const codigosDasContas = new Map((await tx.select({ id: contasContabeis.id, codigo: contasContabeis.codigo })
      .from(contasContabeis).where(inArray(contasContabeis.id, idsDasContas))).map((c) => [c.id, c.codigo]));
    for (const idConta of idsDasContas) {
      const codigoConta = codigosDasContas.get(idConta);
      if (!codigoConta) throw new RegraPoliticaException('mapeamento ausente', codigo);
      await this.contaAnaliticaVigente(tx, codigoConta, codigo);
    }
```

`plano.service.ts`, **só** `listarContasAnaliticasVigentes` (L173–L198), com a mesma regra numa consulta, sem o laço de deduplicação (o par `conta_id`+`numero` é único, então sai uma linha por conta):

```ts
  async listarContasAnaliticasVigentes(): Promise<{ codigo: string; nome: string }[]> {
    const hoje = sql`(now() at time zone 'America/Sao_Paulo')::date`;
    // Mesma regra de plano/vigencia.ts (ultimaVersaoDecidida): vale a versão de maior numero entre APPROVED e SUSPENDED.
    return this.db.select({
      codigo: contasContabeis.codigo,
      nome: contaVersoes.nome,
    }).from(contasContabeis)
      .innerJoin(contaVersoes, and(
        eq(contaVersoes.contaId, contasContabeis.id),
        isNull(contaVersoes.deletedAt),
        sql`${contaVersoes.numero} = (
          select max(v2.numero) from conta_versoes v2
          where v2.conta_id = ${contasContabeis.id}
            and v2.deleted_at is null
            and v2.situacao in ('APPROVED', 'SUSPENDED')
        )`,
        eq(contaVersoes.situacao, 'APPROVED'),
        eq(contaVersoes.classificacao, 'analitica'),
        sql`${contaVersoes.vigenciaInicio} <= ${hoje}`,
        sql`(${contaVersoes.vigenciaFim} is null or ${contaVersoes.vigenciaFim} >= ${hoje})`,
      ))
      .where(isNull(contasContabeis.deletedAt))
      .orderBy(asc(contasContabeis.codigo));
  }
```

`desc` continua importado em `plano.service.ts` (L273, L585 e L621 o usam).

- [ ] **Step 4: Run tests to verify they pass**

```powershell
npx jest test/integration/politicas-contabilizacao.e2e-spec.ts --runInBand
npx jest test/integration/plano-contas.e2e-spec.ts --runInBand
npm run lint
npm run type-check
```

Expected: PASS nos dois arquivos de integração (o da T01 prova que a edição de `listarContasAnaliticasVigentes` não quebrou o resto do `plano.service.ts`).

**Parada na Step 4 (critério b da pré-condição, agora restrito):** só se o merge da E09-T01 r3 **não** estiver na branch, ou seja, `plano/vigencia.ts` não existe ou `ultimaVersaoDecidida` não é exportada. Nesse caso o import desta Task não compila: reportar ao coordenador, não recriar o arquivo.

- [ ] **Step 5: Commit**

```powershell
git add app/backend/src/modules/contabilidade/politicas/politicas.service.ts app/backend/src/modules/contabilidade/plano/plano.service.ts app/backend/test/integration/politicas-contabilizacao.e2e-spec.ts
git commit -m @"
fix(contabilidade): recusa conta suspensa no mapeamento e nas opções da política

### Descrição Detalhada:
contaAnaliticaVigente passa a usar a versão em vigor da conta, a de maior número entre as versões aprovadas ou suspensas (ultimaVersaoDecidida da E09-T01), e só aceita a conta se essa versão estiver aprovada, analítica e vigente. O combo de opções aplica a mesma regra. aprovarNaTx revalida a conta de débito e a de crédito e recusa com 422 mapeamento ausente.

### Motivo da Mudança:
A revisão crítica (B2) mostrou uma conta com v1 aprovada e v2 suspensa listada nas opções e aceita em POST de política (201), enquanto mapear a mesma conta na tela do plano dava 422. O Portão 1 r3 (B1) apontou que o combo é método da própria T02 e que a aprovação não revalidava as contas.

### Impacto:
Configurar, editar, validar, simular e aprovar dão 422 mapeamento ausente para conta suspensa, sem gravar. Edita em plano/ só listarContasAnaliticasVigentes, método criado pela T02. O if do autor e o vínculo da simulação não mudam. Nenhuma migration.
"@
```

## Task 10: Simulação exige valor maior que 0,00 (B7, AD-25 item 2)

**Files:**
- Modify: `app/backend/src/modules/contabilidade/politicas/dto/politicas.dto.ts` (L30–L36, L48)
- Modify: `app/backend/src/modules/contabilidade/politicas/politicas.service.ts` (`simularNaTx` L527–L568, `aprovarNaTx` L578–L584)
- Test: `app/backend/test/integration/politicas-contabilizacao.e2e-spec.ts`

**Interfaces:**
- Consumes: `centavos(valor, codigo)` da Task 8.
- Produces: `dinheiroPositivo` (DTO), 422 `valor deve ser maior que zero` no serviço, e `aprovarNaTx` que só conta simulação com `valor > 0`. Sem migration (ver Decisões aplicadas). A Task 9 já acrescentou ao `aprovarNaTx` a revalidação das contas, depois do `if (!simulacao)`; esta Task só altera a consulta da simulação acima dele.

- [ ] **Step 1: Write the failing tests**

```ts
describe('valor simulado maior que zero', () => {
  async function politicaPronta() {
    await prepararContasAnaliticas();
    return service.configurar(dtoConfigurar(), autorId);
  }

  it.each(['0.00', '0000000000000.00'])('HTTP recusa %s com 400 e não grava', async (valor) => {
    const politica = await politicaPronta();
    const res = await request(srv()).post(`/contabilidade/politicas/${politica.codigo}/simular`)
      .set('Cookie', adminCookies).send({ numero: 1, valor, justificativa: 'simula' });
    expect(res.status).toBe(400);
    expect(await db.select().from(politicaSimulacoes)).toHaveLength(0);
  });

  it('o serviço recusa 0.00 com 422, para quem chama sem passar pelo DTO', async () => {
    const politica = await politicaPronta();
    await expect(service.simular(politica.codigo, { numero: 1, valor: '0.00', justificativa: 'simula' }, autorId))
      .rejects.toMatchObject({
        status: 422,
        response: { message: 'valor deve ser maior que zero', codigo: politica.codigo },
      });
    expect(await db.select().from(politicaSimulacoes)).toHaveLength(0);
  });

  it('o lote recusa 0.00 e desfaz tudo', async () => {
    const politica = await politicaPronta();
    const res = await request(srv()).post('/contabilidade/politicas/lote').set('Cookie', adminCookies).send({
      acao: 'simular',
      codigos: [politica.codigo],
      justificativa: 'simula',
      numeroPorCodigo: { [politica.codigo]: 1 },
      valor: '0.00',
    });
    expect(res.status).toBe(400);
    expect(await db.select().from(politicaSimulacoes)).toHaveLength(0);
  });

  it('uma simulação 0.00 já gravada não destrava a aprovação', async () => {
    const politica = await politicaPronta();
    await db.execute(sql`
      insert into politica_simulacoes (politica_id, versao_numero, valor, debito, credito)
      select p.id, 1, 0, 0, 0 from politicas_contabilizacao p where p.codigo = ${politica.codigo}
    `);
    await expect(service.aprovar(politica.codigo, { numero: 1, justificativa: 'aprova' }, outraPessoaId))
      .rejects.toMatchObject({ status: 422, response: { message: 'mapeamento ausente', codigo: politica.codigo } });
    expect((await service.obter(politica.codigo)).situacao).toBe('DRAFT');
  });

  it('0.01 é o menor valor aceito e permite a aprovação por outra pessoa', async () => {
    const politica = await politicaPronta();
    await service.simular(politica.codigo, { numero: 1, valor: '0.01', justificativa: 'simula' }, autorId);
    const aprovada = await service.aprovar(politica.codigo, { numero: 1, justificativa: 'aprova' }, outraPessoaId);
    expect(aprovada.situacao).toBe('APPROVED');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```powershell
Set-Location app/backend
npx jest test/integration/politicas-contabilizacao.e2e-spec.ts -t "valor simulado maior que zero" --runInBand
```

Expected: FAIL nos quatro primeiros (HTTP e serviço aceitam `0.00`; o lote grava; a simulação zerada destrava `aprovar`). O quinto (`0.01`) passa antes e depois.

- [ ] **Step 3: Write minimal implementation**

`dto/politicas.dto.ts`: abaixo de `dinheiro` (L30) acrescentar

```ts
export const dinheiroPositivo = dinheiro.refine((valor) => /[1-9]/.test(valor), 'Valor deve ser maior que zero.');
```

e usar `valor: dinheiroPositivo` em `simularSchema` (L34) e `valor: dinheiroPositivo.optional()` em `loteBase` (L48).

`politicas.service.ts`, em `simularNaTx`, logo depois da conferência da justificativa (L528):

```ts
if (centavos(dto.valor, codigo) <= 0n) throw new RegraPoliticaException('valor deve ser maior que zero', codigo);
```

(importar `centavos` junto de `balancear`, L22). Em `aprovarNaTx`, a busca da simulação (L578–L583) ganha a condição:

```ts
.where(and(
  eq(politicaSimulacoes.politicaId, versao.politicaId),
  eq(politicaSimulacoes.versaoNumero, versao.numero),
  sql`${politicaSimulacoes.valor} > 0`,
  isNull(politicaSimulacoes.deletedAt),
)).limit(1);
```

Registrar a mudança de decisão no texto do plano já foi feito na seção "Decisões em aberto" item 6 (edição desta revisão).

- [ ] **Step 4: Run tests to verify they pass**

```powershell
npx jest test/integration/politicas-contabilizacao.e2e-spec.ts --runInBand
npm run lint
npm run type-check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add app/backend/src/modules/contabilidade/politicas app/backend/test/integration/politicas-contabilizacao.e2e-spec.ts
git commit -m @"
fix(contabilidade): exige valor simulado maior que zero na política

### Descrição Detalhada:
O DTO de simulação e o de lote recusam 0.00 com 400. O serviço recusa 0.00 com 422 valor deve ser maior que zero e a aprovação ignora simulação gravada com valor zero.

### Motivo da Mudança:
A revisão crítica (B7) e o AD-25 item 2: uma simulação de 0,00 balanceava e destravava a aprovação da regra sem ter simulado nada.

### Impacto:
Sem migration: o CHECK de balanceamento continua aceitando zero, e a defesa fica no DTO, no serviço e na aprovação, que cobre linhas zeradas já gravadas. O vínculo da simulação ao número da versão não muda.
"@
```

## Task 11: Filtro de exclusão lógica volta a `consulta()` (processo)

**Files:**
- Modify: `app/backend/src/modules/contabilidade/politicas/politicas.service.ts` (`listar` L407, `obter` L424–L427, `consulta` L467–L501)
- Test: `app/backend/test/integration/politicas-contabilizacao.e2e-spec.ts`

**Interfaces:**
- Consumes: Drizzle `SQL`.
- Produces: `consulta(extra?: SQL)`, que sempre aplica `politicas_contabilizacao.deleted_at is null`. O commit `c4f99ee` (rotulado `test`) removeu o `.where(isNull(...))` de `consulta()` porque o builder do Drizzle não aceita um segundo `.where` encadeado pelos chamadores. A defesa volta por parâmetro, sem encadear dois `where`.

- [ ] **Step 1: Write the characterization tests**

Dois testes, para que cada mutação do Step 4 seja pega por um deles e a defesa de cada caminho fique provada separadamente:

```ts
async function politicaComExclusaoLogica() {
  await prepararContasAnaliticas();
  const politica = await service.configurar(dtoConfigurar(), autorId);
  await db.execute(sql`update politicas_contabilizacao set deleted_at = now() where codigo = ${politica.codigo}`);
  return politica;
}

it('obter e histórico ignoram a política com exclusão lógica', async () => {
  const politica = await politicaComExclusaoLogica();
  await expect(service.obter(politica.codigo)).rejects.toMatchObject({ status: 404 });
  await expect(service.historico(politica.codigo)).rejects.toMatchObject({ status: 404 });
});

it('listar, total e exportar ignoram a política com exclusão lógica', async () => {
  await politicaComExclusaoLogica();
  const consulta = { pagina: 1, q: '', situacao: '', competencia: '', ordenar: 'competencia', direcao: 'asc' } as const;
  const lista = await service.listar(consulta);
  expect(lista.total).toBe(0);
  expect(lista.itens).toHaveLength(0);
  expect(await service.exportarCsv(consulta)).not.toContain('Liquidação');
});
```

- [ ] **Step 2: Run the test (característica, não falha antes)**

```powershell
Set-Location app/backend
npx jest test/integration/politicas-contabilizacao.e2e-spec.ts -t "com exclusão lógica" --runInBand
```

Expected: os dois PASS antes da mudança, porque os dois chamadores de `consulta()` hoje repetem o filtro (`filtro()` L504 e `obter` L426). Esta Task é uma defesa por construção e é a exceção ao critério 1: os testes fixam o comportamento, e o Step 4 prova, com duas mutações separadas, que cada defesa tem um teste que a pega.

- [ ] **Step 3: Write minimal implementation**

`politicas.service.ts`: importar `type SQL` de `drizzle-orm`, mudar a assinatura e terminar a cadeia da consulta com `where`:

```ts
private consulta(extra?: SQL) {
  const aprovador = alias(usuarios, 'aprovador_politica');
  return this.db.select({ /* campos inalterados, L470–L488 */ })
    .from(politicasContabilizacao)
    .innerJoin(/* inalterado, L490–L497 */)
    .innerJoin(centrosCusto, eq(centrosCusto.id, politicaVersoes.centroCustoId))
    .innerJoin(usuarios, eq(usuarios.id, politicaVersoes.responsavelId))
    .leftJoin(aprovador, eq(aprovador.id, politicaVersoes.aprovadorId))
    .where(and(isNull(politicasContabilizacao.deletedAt), extra));
}
```

`listar` (L407) passa a `await this.consulta(this.filtro(query)).orderBy(ordem).limit(PAGINA).offset((query.pagina - 1) * PAGINA)`, e `obter` (L424) a `await this.consulta(eq(politicasContabilizacao.codigo, codigo)).limit(1)`. `filtro()` e a contagem de `listar` (L408–L419) ficam como estão: a contagem tem o filtro dela.

- [ ] **Step 4: Prove each guard by its own mutation, then run everything**

Aplicar **uma mutação por vez** e restaurar antes da seguinte:

1. Mutação A, só `consulta()`: remover `isNull(politicasContabilizacao.deletedAt),` do `where(and(...))` de `consulta()`, deixando `filtro()` intacto. Rodar `npx jest test/integration/politicas-contabilizacao.e2e-spec.ts -t "com exclusão lógica" --runInBand`. Esperado: falha **"obter e histórico ignoram a política com exclusão lógica"** (`obter` passa a depender só de `consulta()`); "listar, total e exportar..." continua verde, porque `filtro()` ainda tem o seu `isNull`. Restaurar a linha.
2. Mutação B, só `filtro()` (L504): trocar `const termos = [isNull(politicasContabilizacao.deletedAt)];` por `const termos: SQL[] = [];`, deixando `consulta()` intacto. Rodar o mesmo comando. Esperado: falha **"listar, total e exportar ignoram a política com exclusão lógica"** em `expect(lista.total).toBe(0)` (a contagem de `listar` usa só o `filtro()`); "obter e histórico..." continua verde. Restaurar a linha.

Registrar no corpo do commit o nome do teste que falhou em cada mutação, como observado. Se uma mutação não derrubar nenhum teste, a defesa dessa função não está provada: parar e reportar, sem enfraquecer o teste. Depois, restaurado tudo:

```powershell
npx jest test/integration/politicas-contabilizacao.e2e-spec.ts --runInBand
npm run lint
npm run type-check
git diff --stat
```

Expected: PASS; `git diff --stat` mostra só `politicas.service.ts` e o spec, sem sobra de mutação.

- [ ] **Step 5: Commit**

```powershell
git add app/backend/src/modules/contabilidade/politicas/politicas.service.ts app/backend/test/integration/politicas-contabilizacao.e2e-spec.ts
git commit -m @"
fix(contabilidade): restaura o filtro de exclusão lógica em consulta das políticas

### Descrição Detalhada:
consulta passa a receber o filtro do chamador e sempre aplica deleted_at is null na política, no lugar do where encadeado que o commit c4f99ee removeu. listar e obter passam o filtro por parâmetro.

### Motivo da Mudança:
O commit c4f99ee, rotulado test, mexeu em código de produção e tirou a defesa de exclusão lógica de consulta. A convenção do projeto proíbe expor linha com deleted_at.

### Impacto:
Sem mudança de comportamento hoje, porque os dois chamadores repetiam o filtro. Os dois testes de característica fixam isso e cada defesa foi provada por uma mutação própria (consulta e filtro), com o nome do teste que falhou registrado neste commit. Nenhuma migration.
"@
```

## Task 12: Tela confirma pelo backend, modal sem corrida e bloco de exceção na aba (B8 a, B8 c, processo)

**Files:**
- Modify: `app/frontend/src/app/(admin)/erp/contabilidade/politicas-de-contabilizacao/politicas-contabilizacao-client.tsx` (L3, L99–L122, L140–L146, L241–L298, L488–L490, L598)
- Modify: `app/frontend/__tests__/politicas-contabilizacao-apresentacao.test.tsx` (teste de lote em L80+ passa a devolver corpo JSON)

**Interfaces:**
- Consumes: o corpo que o backend já devolve em `editar`/`simular`/`aprovar` (`obter(codigo)`, `PoliticaApresentada`) e em `lote` (`{ codigo, acao, situacao }[]`, `politicas.service.ts` L348–L374).
- Produces: uma tela que só exibe `Aprovado` e `concluído com evidência` depois que o corpo da resposta confirma `situacao === 'APPROVED'`; um modal que só fecha se ainda for o da requisição; `Confirmar` desabilitado durante o envio.
- Fidelidade ao protótipo: `aplicacao.js` L364 chama `renderExceptions` só quando a aba é `Exceções`, e L200–L203 desenha os blocos `Bloqueio / exceção:` ali. O bloco que `c4f99ee` moveu (e que a Task 6 L1484 deixava fora das abas) **sai das outras abas**: aparece só dentro de `Exceções`, onde a Task 6 já pedia dois blocos (D6, "Exceções").

- [ ] **Step 1: Write the failing tests**

Em `politicas-contabilizacao-apresentacao.test.tsx` (imports: `act`, `within` de `@testing-library/react`):

```tsx
function adiavel() {
  let resolver!: (valor: unknown) => void;
  const promessa = new Promise((resolve) => { resolver = resolve; });
  return { promessa, resolver };
}

function corpoOk(corpo: unknown) {
  return { ok: true, status: 201, text: async () => JSON.stringify(corpo) };
}

async function abrirAprovar(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Aprovar regra' }));
  await user.type(screen.getByLabelText('Justificativa / observação'), 'outra pessoa aprova');
  await user.click(screen.getByRole('button', { name: 'Confirmar' }));
}

it('a resposta da simulação não fecha o modal de aprovação aberto depois', async () => {
  const user = userEvent.setup();
  const simulacao = adiavel();
  global.fetch = jest.fn().mockReturnValueOnce(simulacao.promessa) as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  await user.click(screen.getByRole('button', { name: 'Simular evento' }));
  await user.type(screen.getByLabelText('Valor'), '10,10');
  await user.type(screen.getByLabelText('Justificativa / observação'), 'simula');
  await user.click(screen.getByRole('button', { name: 'Confirmar' }));
  await user.click(screen.getByRole('button', { name: 'Aprovar regra' }));
  expect(screen.queryByLabelText('Valor')).not.toBeInTheDocument();
  await act(async () => {
    simulacao.resolver(corpoOk({ ...linha('LIQUIDACAO-2026-10', 'Liquidação'), simulacaoValor: '10.10', simulacaoDebito: '10.10', simulacaoCredito: '10.10' }));
  });
  expect(screen.getByLabelText('Justificativa / observação')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Confirmar' })).toBeEnabled();
});

it('Confirmar fica desabilitado enquanto a requisição está em voo', async () => {
  const user = userEvent.setup();
  const simulacao = adiavel();
  const fetchMock = jest.fn().mockReturnValueOnce(simulacao.promessa);
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  await user.click(screen.getByRole('button', { name: 'Simular evento' }));
  await user.type(screen.getByLabelText('Valor'), '10,10');
  await user.type(screen.getByLabelText('Justificativa / observação'), 'simula');
  await user.click(screen.getByRole('button', { name: 'Confirmar' }));
  expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
  await act(async () => { simulacao.resolver(corpoOk(linha('LIQUIDACAO-2026-10', 'Liquidação'))); });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('200 sem a situação aprovada não mostra Aprovado nem concluído com evidência', async () => {
  const user = userEvent.setup();
  global.fetch = jest.fn().mockResolvedValue(corpoOk(linha('LIQUIDACAO-2026-10', 'Liquidação'))) as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  await abrirAprovar(user);
  expect(await screen.findByText(/O servidor não confirmou a operação/)).toBeInTheDocument();
  expect(screen.queryByRole('cell', { name: 'Aprovado' })).not.toBeInTheDocument();
  expect(screen.queryByText('concluído com evidência')).not.toBeInTheDocument();
});

it('200 sem corpo não mostra sucesso', async () => {
  const user = userEvent.setup();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 201, text: async () => '' }) as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  await abrirAprovar(user);
  expect(await screen.findByText(/O servidor não confirmou a operação/)).toBeInTheDocument();
  expect(screen.queryByRole('cell', { name: 'Aprovado' })).not.toBeInTheDocument();
});

it('422 do backend mostra o texto interno e nenhum sucesso', async () => {
  const user = userEvent.setup();
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 422,
    text: async () => JSON.stringify({ statusCode: 422, message: { message: 'aprovador diferente do autor', codigo: 'LIQUIDACAO-2026-10' } }),
  }) as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  await abrirAprovar(user);
  expect(await screen.findByText('aprovador diferente do autor')).toBeInTheDocument();
  expect(screen.queryByRole('cell', { name: 'Aprovado' })).not.toBeInTheDocument();
  expect(screen.queryByText('concluído com evidência')).not.toBeInTheDocument();
});

it('o corpo aprovado do backend atualiza a linha e só então mostra o sucesso', async () => {
  const user = userEvent.setup();
  global.fetch = jest.fn().mockResolvedValue(corpoOk({
    ...linha('LIQUIDACAO-2026-10', 'Liquidação'), situacao: 'APPROVED', situacaoRotulo: 'Aprovado', aprovadorNome: 'Outra pessoa',
  })) as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  await abrirAprovar(user);
  expect(await screen.findByRole('cell', { name: 'Aprovado' })).toBeInTheDocument();
  expect(screen.getByText('concluído com evidência')).toBeInTheDocument();
});

it('lote aprovado só mostra sucesso se todos os efeitos voltam aprovados', async () => {
  const user = userEvent.setup();
  global.fetch = jest.fn().mockResolvedValue(corpoOk([
    { codigo: 'LIQUIDACAO-2026-10', acao: 'aprovar', situacao: 'APPROVED' },
  ])) as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[
    linha('LIQUIDACAO-2026-10', 'Liquidação'),
    linha('TARIFA-2026-10', 'Tarifa'),
  ]} />);
  await user.click(screen.getByRole('checkbox', { name: 'Selecionar Liquidação' }));
  await user.click(screen.getByRole('checkbox', { name: 'Selecionar Tarifa' }));
  await abrirAprovar(user);
  expect(await screen.findByText(/O servidor não confirmou a operação/)).toBeInTheDocument();
  expect(screen.queryByText('concluído com evidência')).not.toBeInTheDocument();
});

it('valor 0,00 é recusado na tela antes de chamar o servidor', async () => {
  const user = userEvent.setup();
  const fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  await user.click(screen.getByRole('button', { name: 'Simular evento' }));
  await user.type(screen.getByLabelText('Valor'), '0,00');
  await user.type(screen.getByLabelText('Justificativa / observação'), 'simula');
  await user.click(screen.getByRole('button', { name: 'Confirmar' }));
  expect(await screen.findByText('Valor deve ser maior que zero.')).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('o bloco Bloqueio / exceção existe só na aba Exceções', async () => {
  const user = userEvent.setup();
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  expect(screen.queryByText(/Bloqueio \/ exceção/)).not.toBeInTheDocument();
  await user.click(screen.getByRole('tab', { name: 'Regras e validações' }));
  expect(screen.queryByText(/Bloqueio \/ exceção/)).not.toBeInTheDocument();
  await user.click(screen.getByRole('tab', { name: 'Exceções' }));
  expect(screen.getAllByText(/Bloqueio \/ exceção/)).toHaveLength(2);
  expect(screen.getByText(/Mapeamento ausente/)).toBeInTheDocument();
  expect(screen.getByText(/Evento duplicado/)).toBeInTheDocument();
});
```

No teste existente "com duas linhas marcadas..." (L80+), o mock `text: async () => ''` passa a devolver, para o lote, um JSON de efeitos coerente com a ação testada (`simular` → `[{ codigo, acao: 'simular', situacao: 'DRAFT' }, ...]`; `aprovar` → `situacao: 'APPROVED'`), e as asserções de chamada ao `/lote` permanecem.

- [ ] **Step 2: Run tests to verify they fail**

```powershell
Set-Location app/frontend
npx jest __tests__/politicas-contabilizacao-apresentacao.test.tsx --runInBand
```

Expected: FAIL em: corrida do modal (hoje `setModal(null)` L286 fecha o modal de aprovação), `Confirmar` habilitado em voo, 200 sem aprovação (hoje L291–L296 mostra `Aprovado` e o aviso), 200 sem corpo, lote parcial, `0,00` (hoje chama o servidor) e o bloco fora da aba (hoje L490). Os testes de 422 e de corpo aprovado passam antes e depois (guardas). Se o de 200 sem aprovação passar antes, parar (critério 1).

- [ ] **Step 3: Write minimal implementation**

No topo: `import { useEffect, useRef, useState } from 'react';`. Constante e auxiliares junto de `lerMensagem` (L113–L122):

```tsx
const NAO_CONFIRMADO = 'O servidor não confirmou a operação. Atualize a tela e confira a situação.';

async function lerCorpo(resposta: Response): Promise<unknown> {
  const texto = await resposta.text();
  if (!texto) return null;
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return null;
  }
}

function ehPolitica(corpo: unknown): corpo is PoliticaApresentada {
  if (!corpo || typeof corpo !== 'object') return false;
  const { codigo, situacao, numero } = corpo as Record<string, unknown>;
  return typeof codigo === 'string' && typeof situacao === 'string' && typeof numero === 'number';
}

function rotuloSituacao(situacao: string): string {
  return SITUACOES.find(([valor]) => valor === situacao)?.[1] ?? situacao;
}
```

Estado (após L146): `const [enviando, setEnviando] = useState(false);` e `const sequenciaModal = useRef(0);` (antes do `if (semAcesso)`, L178, para manter a ordem dos hooks). `abrirModal` (L241) começa com `sequenciaModal.current += 1;`.

`confirmarLoteOuAcao` (L248–L298): manter as validações; acrescentar, depois da de `Valor é obrigatório.`, `if (acao === 'simular' && /^0+\.00$/.test(valor)) { setAviso('Valor deve ser maior que zero.'); return; }`. Depois, envolver o envio:

```tsx
const emLote = marcadas.length > 1;
const token = sequenciaModal.current;
setEnviando(true);
try {
  const resposta = /* os dois fetch existentes, L261–L281, sem mudança */;
  if (!resposta.ok) {
    setAviso(await lerMensagem(resposta));
    return;
  }
  const corpo = await lerCorpo(resposta);
  if (emLote) {
    const efeitos = Array.isArray(corpo) ? corpo as { codigo?: unknown; acao?: unknown; situacao?: unknown }[] : null;
    const confere = efeitos !== null
      && efeitos.length === marcadas.length
      && efeitos.every((efeito) => typeof efeito.codigo === 'string' && marcadas.includes(efeito.codigo)
        && efeito.acao === acao && typeof efeito.situacao === 'string'
        && (acao !== 'aprovar' || efeito.situacao === 'APPROVED'));
    if (!confere) {
      setAviso(NAO_CONFIRMADO);
      return;
    }
    if (acao === 'aprovar') {
      const situacoes = new Map(efeitos.map((efeito) => [String(efeito.codigo), String(efeito.situacao)]));
      setLinhas((lista) => lista.map((item) => {
        const situacao = situacoes.get(item.codigo);
        return situacao ? { ...item, situacao, situacaoRotulo: rotuloSituacao(situacao) } : item;
      }));
    }
  } else {
    if (!ehPolitica(corpo) || corpo.codigo !== atual!.codigo || (acao === 'aprovar' && corpo.situacao !== 'APPROVED')) {
      setAviso(NAO_CONFIRMADO);
      return;
    }
    setLinhas((lista) => lista.map((item) => (item.codigo === corpo.codigo ? corpo : item)));
  }
  if (sequenciaModal.current === token) {
    setModal(null);
    setValorTexto('');
    setJustificativaModal('');
  }
  setAviso(acao === 'aprovar' ? 'concluído com evidência' : '');
} catch {
  setAviso('Não foi possível concluir a operação. Tente novamente.');
} finally {
  setEnviando(false);
}
```

`Confirmar` (L598): `<Button type="button" disabled={enviando} onClick={...}>Confirmar</Button>`. L488–L490 vira `{aba === 'Exceções' ? EXCECOES.map((item) => <p key={item}><b>Bloqueio / exceção:</b> {item}.</p>) : null}`. Nenhuma palavra, rótulo ou ordem de botão muda.

- [ ] **Step 4: Run tests to verify they pass**

```powershell
npx jest __tests__/politicas-contabilizacao-apresentacao.test.tsx --runInBand
npm run lint
npm run type-check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add "app/frontend/src/app/(admin)/erp/contabilidade/politicas-de-contabilizacao/politicas-contabilizacao-client.tsx" app/frontend/__tests__/politicas-contabilizacao-apresentacao.test.tsx
git commit -m @"
fix(contabilidade): a tela das políticas só mostra sucesso confirmado pelo backend

### Descrição Detalhada:
Simular, aprovar e o lote passam a ler o corpo da resposta: a linha é substituída pelo que o backend devolveu e Aprovado e concluído com evidência só aparecem se a situação voltar APPROVED. O modal só fecha se ainda for o da requisição, Confirmar fica desabilitado durante o envio e 0,00 é recusado na tela. O bloco Bloqueio / exceção volta a existir apenas na aba Exceções, como no protótipo.

### Motivo da Mudança:
A revisão crítica (B8) achou a corrida em que a resposta da simulação fechava o modal de aprovação aberto depois, e uma tela que exibia Aprovado por atualização otimista sem confirmação (RA-05/06). O commit c4f99ee, rotulado test, também moveu o bloco de exceção para fora da aba, contra aplicacao.js L364.

### Impacto:
Resposta 2xx sem corpo válido mostra O servidor não confirmou a operação em vez de sucesso. Nenhum rótulo, botão ou rota muda.
"@
```

## Task 13: A lista da tela consulta o servidor (necessária ao B8 b)

**Files:**
- Modify: `app/frontend/src/app/(admin)/erp/contabilidade/politicas-de-contabilizacao/politicas-contabilizacao-client.tsx` (restauração L160–L172, hooks antes de L178, `alvo` L197–L201, início de `confirmarLoteOuAcao` L248–L250)
- Modify: `app/frontend/__tests__/politicas-contabilizacao-apresentacao.test.tsx`

**Interfaces:**
- Consumes: `GET /api/contabilidade/politicas?pagina&q&competencia&situacao&ordenar&direcao` (BFF `route.ts` L4–L6, backend `listarPoliticasSchema` L57–L64), que já filtra e ordena no servidor. Os valores de `ordenar` que a tela guarda (`competencia`, `contaDebito`, `contaCredito`, `centroCusto`, `tipoEvento`) são os mesmos do backend.
- Produces: busca, filtro de competência, filtro de situação e ordenação que de fato recarregam a lista (Matriz UX L952, "persistência de filtro/ordenação"). A restauração de filtro, ordenação e direção do `sessionStorage` volta a valer (a MATRIZ-UX exige retorno a filtro, ordenação e posição; a posição é a Task 15), e `Confirmar` age sobre a política que a ficha mostra, nunca em silêncio. Sem isso, o Playwright da Task 14 não acha a linha própria da execução quando o banco já tem mais de 20 políticas. Se o coordenador retirar esta Task, a Task 14 não pode ser executada como escrita (parar).

- [ ] **Step 1: Write the failing tests**

O rascunho da tela vai para `sessionStorage` (L174–L176) e o jsdom o mantém entre testes do mesmo arquivo; como agora restaurar a busca dispara a consulta, o arquivo ganha `beforeEach(() => sessionStorage.clear());`.

```tsx
it('digitar na busca recarrega a lista pelo servidor com os filtros atuais', async () => {
  const user = userEvent.setup();
  const fetchMock = jest.fn().mockResolvedValue(corpoOk({ itens: [linha('TARIFA-2026-10', 'Tarifa')], total: 1 }));
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  expect(fetchMock).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText('Buscar registros da lista'), 'x');
  expect(await screen.findByRole('cell', { name: 'Tarifa' })).toBeInTheDocument();
  expect(screen.queryByRole('cell', { name: 'Liquidação' })).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenLastCalledWith(
    '/api/contabilidade/politicas?pagina=1&q=x&competencia=&situacao=&ordenar=competencia&direcao=asc',
  );
});

it('ordenar por uma coluna recarrega a lista', async () => {
  const user = userEvent.setup();
  const fetchMock = jest.fn().mockResolvedValue(corpoOk({ itens: [], total: 0 }));
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  await user.click(screen.getByRole('button', { name: 'Ordenar por Conta de débito' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('ordenar=contaDebito&direcao=asc')));
});

it('uma resposta antiga não sobrescreve a consulta mais nova', async () => {
  const user = userEvent.setup();
  const lenta = adiavel();
  global.fetch = jest.fn()
    .mockReturnValueOnce(lenta.promessa)
    .mockResolvedValueOnce(corpoOk({ itens: [linha('TARIFA-2026-10', 'Tarifa')], total: 1 })) as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[]} />);
  await user.type(screen.getByLabelText('Buscar registros da lista'), 'ab');
  expect(await screen.findByRole('cell', { name: 'Tarifa' })).toBeInTheDocument();
  await act(async () => { lenta.resolver(corpoOk({ itens: [linha('LIQUIDACAO-2026-10', 'Liquidação')], total: 1 })); });
  expect(screen.queryByRole('cell', { name: 'Liquidação' })).not.toBeInTheDocument();
});

it('falha ao recarregar mostra a mensagem e não apaga a lista', async () => {
  const user = userEvent.setup();
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, text: async () => JSON.stringify({ message: 'Validação falhou' }) }) as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  await user.type(screen.getByLabelText('Buscar registros da lista'), 'x');
  expect(await screen.findByText('Validação falhou')).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: 'Liquidação' })).toBeInTheDocument();
});
```

```tsx
it('restaura busca, ordenação e direção do sessionStorage e consulta uma única vez', async () => {
  sessionStorage.setItem('politicas-de-contabilizacao', JSON.stringify({ busca: 'x', ordenar: 'contaDebito', direcao: 'desc' }));
  const fetchMock = jest.fn().mockResolvedValue(corpoOk({ itens: [linha('TARIFA-2026-10', 'Tarifa')], total: 1 }));
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  expect(await screen.findByRole('cell', { name: 'Tarifa' })).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith('/api/contabilidade/politicas?pagina=1&q=x&competencia=&situacao=&ordenar=contaDebito&direcao=desc');
});

// Guarda: hoje a tela não consulta ao montar; o teste trava a consulta extra que uma guarda de "primeira renderização" causaria.
it('guarda: ordenação inválida no sessionStorage é ignorada e sob StrictMode não há consulta extra ao montar', async () => {
  sessionStorage.setItem('politicas-de-contabilizacao', JSON.stringify({ ordenar: 'senha', direcao: 'x' }));
  const fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<StrictMode><PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} /></StrictMode>);
  await act(async () => {});
  expect(fetchMock).not.toHaveBeenCalled();
});

it('confirma na política exibida na ficha quando a selecionada saiu da lista recarregada', async () => {
  const user = userEvent.setup();
  const aprovada = { ...linha('LIQUIDACAO-2026-10', 'Liquidação'), situacao: 'APPROVED', situacaoRotulo: 'Aprovado' };
  const fetchMock = jest.fn()
    .mockResolvedValueOnce(corpoOk({ itens: [linha('LIQUIDACAO-2026-10', 'Liquidação')], total: 1 }))
    .mockResolvedValueOnce(corpoOk(aprovada));
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação'), linha('TARIFA-2026-10', 'Tarifa')]} />);
  await user.click(screen.getByRole('cell', { name: 'Tarifa' }));
  await user.type(screen.getByLabelText('Buscar registros da lista'), 'x');
  await waitFor(() => expect(screen.queryByRole('cell', { name: 'Tarifa' })).not.toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: 'Aprovar regra' }));
  await user.type(screen.getByLabelText('Justificativa / observação'), 'outra pessoa aprova');
  await user.click(screen.getByRole('button', { name: 'Confirmar' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/contabilidade/politicas/LIQUIDACAO-2026-10/aprovar');
});

it('sem política na lista, Confirmar mostra aviso e não chama o servidor', async () => {
  const user = userEvent.setup();
  const fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[]} />);
  await user.click(screen.getByRole('button', { name: 'Simular evento' }));
  await user.type(screen.getByLabelText('Valor'), '10,10');
  await user.type(screen.getByLabelText('Justificativa / observação'), 'simula');
  await user.click(screen.getByRole('button', { name: 'Confirmar' }));
  expect(await screen.findByText('Selecione uma política na lista.')).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});
```

(`waitFor` entra no import de `@testing-library/react` e `StrictMode` no de `react`.)

- [ ] **Step 2: Run tests to verify they fail**

```powershell
Set-Location app/frontend
npx jest __tests__/politicas-contabilizacao-apresentacao.test.tsx --runInBand
```

Expected: FAIL nos quatro primeiros (hoje busca, filtros e ordenação só mudam estado local e a lista é sempre a `inicial`, L154–L158), no de restauração (o efeito L160–L172 não repõe `ordenar` nem `direcao`), no de "política exibida na ficha" (`alvo()` devolve `undefined` e `Confirmar` retorna em silêncio, L250) e no de "sem política na lista" (sem aviso). O teste marcado `guarda:` passa antes e depois: ele trava a consulta extra que uma guarda de primeira renderização causaria sob StrictMode e não conta para o critério de parada 1.

- [ ] **Step 3: Write minimal implementation**

Antes do `if (semAcesso)` (L178), junto dos outros `useEffect`:

```tsx
const ultimaConsulta = useRef(new URLSearchParams({
  pagina: '1', q: '', competencia: '', situacao: '', ordenar: 'competencia', direcao: 'asc',
}).toString());
const sequenciaLista = useRef(0);

useEffect(() => {
  const consulta = new URLSearchParams({
    pagina: '1', q: busca, competencia: filtroCompetencia, situacao: filtroSituacao, ordenar, direcao,
  }).toString();
  // Compara com a última consulta feita (inicialmente, a da lista que o servidor entregou): não consulta ao montar
  // nem na segunda montagem simulada do StrictMode, e consulta uma vez só depois da restauração do sessionStorage.
  if (consulta === ultimaConsulta.current) return;
  ultimaConsulta.current = consulta;
  sequenciaLista.current += 1;
  const minha = sequenciaLista.current;
  void (async () => {
    try {
      const resposta = await fetch(`/api/contabilidade/politicas?${consulta}`);
      if (minha !== sequenciaLista.current) return;
      if (!resposta.ok) {
        setAviso(await lerMensagem(resposta));
        return;
      }
      const corpo = await lerCorpo(resposta) as { itens?: PoliticaApresentada[] } | null;
      if (minha !== sequenciaLista.current) return;
      if (!corpo || !Array.isArray(corpo.itens)) {
        setAviso(NAO_CONFIRMADO);
        return;
      }
      setLinhas(corpo.itens);
      setMarcadas([]);
      setAviso('');
    } catch {
      if (minha === sequenciaLista.current) setAviso('Não foi possível atualizar a lista. Tente novamente.');
    }
  })();
}, [busca, filtroCompetencia, filtroSituacao, ordenar, direcao]);
```

`// ponytail: uma requisição por tecla, sem debounce; a guarda de sequência descarta resposta antiga. Adicionar debounce de 250 ms se o servidor sentir.`

Restauração (efeito de L160–L172): o tipo do rascunho ganha `ordenar?: string; direcao?: string` e, junto dos outros `if`:

```tsx
      if (COLUNAS.some((coluna) => coluna.ordenar === rascunho.ordenar)) setOrdenar(rascunho.ordenar!);
      if (rascunho.direcao === 'asc' || rascunho.direcao === 'desc') setDirecao(rascunho.direcao);
```

(valor desconhecido no `sessionStorage` é ignorado, em vez de virar um 400 do servidor).

`alvo()` (L197–L201) passa a usar `selecionada` (L187), a política que a ficha mostra, e deixa de ler `codigoSelecionado` direto:

```tsx
  function alvo(): PoliticaApresentada | undefined {
    if (marcadas.length === 1) return linhas.find((linha) => linha.codigo === marcadas[0]);
    return selecionada;
  }
```

E, no início de `confirmarLoteOuAcao`, o retorno silencioso (L250) vira aviso:

```tsx
    const atual = alvo();
    if (!atual && marcadas.length <= 1) {
      setAviso('Selecione uma política na lista.');
      return;
    }
```

- [ ] **Step 4: Run tests to verify they pass**

```powershell
npx jest __tests__/politicas-contabilizacao-apresentacao.test.tsx --runInBand
npm run lint
npm run type-check
```

Expected: PASS, incluindo os testes da Task 12.

- [ ] **Step 5: Commit**

```powershell
git add "app/frontend/src/app/(admin)/erp/contabilidade/politicas-de-contabilizacao/politicas-contabilizacao-client.tsx" app/frontend/__tests__/politicas-contabilizacao-apresentacao.test.tsx
git commit -m @"
fix(contabilidade): busca, filtros e ordenação das políticas consultam o servidor

### Descrição Detalhada:
Mudar a busca, a competência, a situação ou a ordenação recarrega a lista por GET no BFF com os mesmos parâmetros do backend, comparando com a última consulta feita para não consultar ao montar nem sob StrictMode. Uma guarda de sequência descarta resposta antiga e uma falha mostra a mensagem sem apagar a lista. A restauração do sessionStorage repõe também ordenação e direção, e Confirmar age sobre a política que a ficha mostra ou avisa que não há seleção.

### Motivo da Mudança:
Os controles só alteravam estado local e alimentavam o CSV, então a grade era sempre a primeira página inicial. Sem consulta ao servidor, o Playwright não acha a linha criada na própria execução quando o banco já acumula mais de 20 políticas.

### Impacto:
Sem mudança de rótulo, rota ou contrato. A paginação de 20 linhas ganha controle na tela na Task 15.
"@
```

## Task 14: Playwright determinístico e que prova o sistema que a tela usa (B8 b, B8 c)

**Files:**
- Create: `app/frontend/e2e/helpers/e09-t02-seed.ts`
- Modify (reescreve): `app/frontend/e2e/e09-t02-politicas-contabilizacao.spec.ts`

**Interfaces:**
- Consumes: `BACKEND_URL`, `ADMIN_EMAIL` e `loginBackend` de `app/frontend/e2e/helpers/onda6-seed.ts` (mesmo padrão de `onda10-seed.ts`), os contratos HTTP do plano da T01 (ver Pré-condição) e a tela das Tasks 12 e 13.
- Produces: um spec que cria os próprios dados por execução (sufixo único, competências sorteadas, e-mail único), não depende de nome de banco, de `docker exec`, de `delete` nem da ordem entre testes, e que confere o estado pela API por trás do BFF. É proibido neste spec: `execFileSync`, `docker`, `psql`, `retries`, `waitForTimeout`.

- [ ] **Step 1: Reproduce the failure of the current spec (e investigar a anomalia)**

Pré-voo, em PowerShell, antes de qualquer execução (registra a causa da anomalia B8 c):

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3100,4001 -ErrorAction SilentlyContinue | Select-Object LocalPort, OwningProcess
docker compose ps
Set-Location app/frontend
$env:E2E_FRONTEND_URL; $env:BACKEND_INTERNAL_URL
```

Se já houver Next na 3100 ou backend na 4001 vindos de **outra** worktree ou de imagem antiga, parar esses processos e subir os desta worktree (`docker compose up --build -d`); `reuseExistingServer` só é seguro com o servidor desta worktree. Para saber em qual banco o backend em execução escreve, ler a `DATABASE_URL` do processo (`docker compose exec backend printenv DATABASE_URL`, ou o `.env` da raiz desta worktree) e usar esse valor em `psql`; nunca um nome de banco escrito à mão.

```powershell
npx playwright test e2e/e09-t02-politicas-contabilizacao.spec.ts --trace on
npx playwright test e2e/e09-t02-politicas-contabilizacao.spec.ts --trace on
```

Expected: a segunda execução FALHA no spec atual, porque o centro `CT1`, as contas `1`, `1.1.01`, `2`, `2.1.01`, o e-mail do segundo administrador e as competências `2026-10`/`2026-11` já existem do primeiro run (`e2e/e09-t02-politicas-contabilizacao.spec.ts` L28–L31, L42–L47, L91–L94, L127, L163, L165). Guardar o trace. Do trace de qualquer falha em que `Aprovado` ou `concluído com evidência` apareça, extrair o status e o corpo da resposta de `aprovar` e a `DATABASE_URL` conferida; isso decide entre H1, H2 e H3. Se a anomalia não reaparecer, registrar "não reproduzida" com a evidência da execução limpa; não inventar causa.

- [ ] **Step 2: Write the new spec and helper**

`app/frontend/e2e/helpers/e09-t02-seed.ts`:

```ts
import { randomInt } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { BACKEND_URL, loginBackend } from './onda6-seed';

export interface PlanoDaJornada {
  sufixo: string;
  centroCodigo: string;
  centroNome: string;
  debitoNome: string;
  creditoNome: string;
}

const competenciasUsadas = new Set<string>();

/** Competência futura sorteada (ano 3000–8999), única dentro da execução. */
export function competenciaUnica(): string {
  for (;;) {
    const candidata = `${randomInt(3000, 9000)}-${String(randomInt(1, 13)).padStart(2, '0')}`;
    if (!competenciasUsadas.has(candidata)) {
      competenciasUsadas.add(candidata);
      return candidata;
    }
  }
}

function ontemIso(): string {
  const data = new Date();
  data.setUTCDate(data.getUTCDate() - 1);
  return data.toISOString().slice(0, 10);
}

async function postar(request: APIRequestContext, cookie: string, rota: string, corpo: unknown) {
  const resposta = await request.post(`${BACKEND_URL}${rota}`, {
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    data: corpo,
  });
  if (!resposta.ok()) throw new Error(`POST ${rota} -> ${resposta.status()}: ${await resposta.text()}`);
}

export async function criarPlanoDaJornada(request: APIRequestContext): Promise<PlanoDaJornada> {
  const { cookieHeader } = await loginBackend(request);
  const sufixo = `${Date.now().toString(36)}${randomInt(46656).toString(36)}`;
  const vigenciaInicio = ontemIso();
  const centroCodigo = `CT${sufixo}`;
  const plano: PlanoDaJornada = {
    sufixo,
    centroCodigo,
    centroNome: `Operação industrial ${sufixo}`,
    debitoNome: `Caixa e bancos ${sufixo}`,
    creditoNome: `Fornecedores ${sufixo}`,
  };
  await postar(request, cookieHeader, '/contabilidade/centros-custo', {
    codigo: centroCodigo, nome: plano.centroNome, justificativa: 'abre o centro da jornada',
  });
  const contas = [
    { codigo: `A${sufixo}`, nome: `Grupo do ativo ${sufixo}`, classificacao: 'sintetica', natureza: 'ATIVO', pai: null },
    { codigo: `A${sufixo}.1`, nome: plano.debitoNome, classificacao: 'analitica', natureza: 'ATIVO', pai: `A${sufixo}` },
    { codigo: `P${sufixo}`, nome: `Grupo do passivo ${sufixo}`, classificacao: 'sintetica', natureza: 'PASSIVO', pai: null },
    { codigo: `P${sufixo}.1`, nome: plano.creditoNome, classificacao: 'analitica', natureza: 'PASSIVO', pai: `P${sufixo}` },
  ];
  for (const conta of contas) {
    await postar(request, cookieHeader, '/contabilidade/plano', {
      codigo: conta.codigo, nome: conta.nome, classificacao: conta.classificacao, natureza: conta.natureza,
      grupo: 'Circulante', contaPaiCodigo: conta.pai, centroCodigo, vigenciaInicio, vigenciaFim: null,
      justificativa: 'abre a conta da jornada',
    });
    await postar(request, cookieHeader, `/contabilidade/plano/${conta.codigo}/revisar-competencia`, {
      numero: 1, vigenciaInicio, vigenciaFim: null, justificativa: 'revisa a competência',
    });
    await postar(request, cookieHeader, `/contabilidade/plano/${conta.codigo}/aprovar`, {
      numero: 1, justificativa: 'aprova a conta da jornada',
    });
  }
  return plano;
}
```

`app/frontend/e2e/e09-t02-politicas-contabilizacao.spec.ts` (substitui o arquivo; `login` de L8–L23 fica igual):

```ts
import { expect, test, type Page } from '@playwright/test';
import { competenciaUnica, criarPlanoDaJornada, type PlanoDaJornada } from './helpers/e09-t02-seed';
import { ADMIN_EMAIL, loginBackend } from './helpers/onda6-seed';

const SENHA_DA_JORNADA = 'senha-da-jornada';

test.describe.configure({ mode: 'serial', timeout: 600_000 });

let plano: PlanoDaJornada;
let senhaAdmin: string;

test.beforeAll(async ({ playwright }) => {
  const api = await playwright.request.newContext();
  try {
    // Mesmo e-mail e mesma lista de senhas do seed: a senha que o backend aceitou é a que a tela usa.
    senhaAdmin = (await loginBackend(api)).password;
    plano = await criarPlanoDaJornada(api);
  } finally {
    await api.dispose();
  }
});

const ONTEM = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

async function login(page: Page, email: string, password: string, baseURL: string) {
  const resposta = await page.request.post('/api/auth/login', {
    data: { email, password },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(resposta.ok(), `login falhou: ${resposta.status()}`).toBeTruthy();
  const cookies = resposta
    .headersArray()
    .filter((header) => header.name.toLowerCase() === 'set-cookie')
    .map((header) => {
      const [nomeValor] = header.value.split(';');
      const igual = nomeValor.indexOf('=');
      return { name: nomeValor.slice(0, igual), value: nomeValor.slice(igual + 1), url: baseURL };
    });
  await page.context().addCookies(cookies);
}

interface ItemApi { codigo: string; situacao: string; aprovadorNome: string | null; simulacaoValor: string | null }

async function politicaPelaApi(page: Page, competencia: string): Promise<ItemApi | undefined> {
  const resposta = await page.request.get(`/api/contabilidade/politicas?pagina=1&q=${encodeURIComponent(plano.debitoNome)}`);
  expect(resposta.ok(), `GET politicas: ${resposta.status()}`).toBeTruthy();
  const corpo = await resposta.json() as { itens: ItemApi[] };
  return corpo.itens.find((item) => item.codigo === `LIQUIDACAO-${competencia}`);
}

function postDaAcao(page: Page, acao: 'simular' | 'aprovar') {
  return page.waitForResponse((resposta) => resposta.request().method() === 'POST'
    && new RegExp(`/api/contabilidade/politicas/[^/]+/${acao}$`).test(new URL(resposta.url()).pathname));
}

async function configurarPolitica(page: Page, competencia: string) {
  await page.getByRole('button', { name: 'Configurar mappings' }).first().click();
  const debito = page.getByLabel('Conta de débito', { exact: true });
  await expect(debito.locator('option', { hasText: plano.debitoNome })).toHaveCount(1);
  await debito.selectOption({ label: plano.debitoNome });
  await page.getByLabel('Conta de crédito', { exact: true }).selectOption({ label: plano.creditoNome });
  await page.getByLabel('Centro de custo', { exact: true }).selectOption({ label: plano.centroNome });
  await page.getByLabel('Tipo de ocorrência', { exact: true }).selectOption({ label: 'Liquidação' });
  await page.getByLabel('Competência', { exact: true }).fill(competencia);
  await page.getByLabel('Início de vigência', { exact: true }).fill(ONTEM);
  await page.getByLabel('Justificativa auditável', { exact: true }).fill('abre a regra');
  await page.getByRole('button', { name: 'Configurar mappings' }).last().click();
}

test('administrador configura, simula e outra pessoa aprova', async ({ browser, baseURL }) => {
  const competencia = competenciaUnica();
  const admin = await browser.newContext({ baseURL });
  const page = await admin.newPage();
  await login(page, ADMIN_EMAIL, senhaAdmin, baseURL!);

  // O seed foi feito direto no backend; o BFF da tela precisa enxergar o mesmo sistema.
  const opcoes = await page.request.get('/api/contabilidade/politicas/opcoes');
  expect(opcoes.ok()).toBeTruthy();
  expect(JSON.stringify(await opcoes.json()), 'a tela e o seed falam com backends diferentes').toContain(plano.debitoNome);

  await page.goto('/erp/contabilidade/politicas-de-contabilizacao');
  await expect(page).not.toHaveURL(/e\d{2}-t\d{2}/i);
  await expect(page.getByRole('heading', { name: 'Políticas de contabilização' })).toBeVisible();
  await expect(page.getByText('Provisório')).toBeVisible();
  await configurarPolitica(page, competencia);
  await expect(page.getByRole('cell', { name: 'Liquidação', exact: true })).toBeVisible();
  await expect(page.getByText('LIQUIDACAO')).toHaveCount(0);

  const simulada = postDaAcao(page, 'simular');
  await page.getByRole('button', { name: 'Simular evento' }).click();
  await page.getByLabel('Valor', { exact: true }).fill('10,10');
  await page.getByLabel('Justificativa / observação', { exact: true }).fill('simula o evento');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  expect((await simulada).ok()).toBeTruthy();
  expect((await politicaPelaApi(page, competencia))?.simulacaoValor).toBe('10.10');

  const negada = postDaAcao(page, 'aprovar');
  await page.getByRole('button', { name: 'Aprovar regra' }).click();
  await page.getByLabel('Justificativa / observação', { exact: true }).fill('o autor tenta aprovar');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  expect((await negada).status()).toBe(422);
  await expect(page.getByText('aprovador diferente do autor', { exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Aprovado', exact: true })).toHaveCount(0);
  await expect(page.getByText('concluído com evidência', { exact: true })).toHaveCount(0);
  expect((await politicaPelaApi(page, competencia))?.situacao).toBe('DRAFT');

  await page.getByRole('tab', { name: 'Regras e validações' }).click();
  await expect(page.getByText('origem imutável, não lançar sem mapeamento correto, balanceamento exato')).toBeVisible();
  await page.getByRole('tab', { name: 'Exceções' }).click();
  await expect(page.locator('p', { hasText: /^Bloqueio \/ exceção: Mapeamento ausente\.$/ })).toHaveCount(1);
  await expect(page.locator('p', { hasText: /^Bloqueio \/ exceção: Evento duplicado\.$/ })).toHaveCount(1);

  const emailOutra = `contador.${plano.sufixo}@alphacarnes.local`;
  const criado = await page.request.post('/api/admin/usuarios', {
    data: { nome: 'Contador provisório', email: emailOutra, password: SENHA_DA_JORNADA, perfis: ['administrador'] },
  });
  expect(criado.ok(), `criar administrador: ${criado.status()}`).toBeTruthy();
  const outra = await browser.newContext({ baseURL });
  const paginaOutra = await outra.newPage();
  await login(paginaOutra, emailOutra, SENHA_DA_JORNADA, baseURL!);
  await paginaOutra.goto('/erp/contabilidade/politicas-de-contabilizacao');
  await paginaOutra.getByLabel('Buscar registros da lista').fill(plano.debitoNome);
  await paginaOutra.getByRole('cell', { name: 'Liquidação', exact: true }).click();
  const aprovada = postDaAcao(paginaOutra, 'aprovar');
  await paginaOutra.getByRole('button', { name: 'Aprovar regra' }).click();
  await paginaOutra.getByLabel('Justificativa / observação', { exact: true }).fill('outra pessoa aprova');
  await paginaOutra.getByRole('button', { name: 'Confirmar' }).click();
  expect((await aprovada).ok()).toBeTruthy();
  await expect(paginaOutra.getByRole('cell', { name: 'Aprovado', exact: true })).toBeVisible();
  await expect(paginaOutra.getByText('concluído com evidência', { exact: true })).toBeVisible();
  const confirmada = await politicaPelaApi(paginaOutra, competencia);
  expect(confirmada?.situacao).toBe('APPROVED');
  expect(confirmada?.aprovadorNome).toBe('Contador provisório');
  await paginaOutra.reload();
  await paginaOutra.getByLabel('Buscar registros da lista').fill(plano.debitoNome);
  await expect(paginaOutra.getByRole('cell', { name: 'Aprovado', exact: true })).toBeVisible();
  await admin.close();
  await outra.close();
});

test('competência repetida mostra evento duplicado e não grava a segunda', async ({ browser, baseURL }) => {
  const competencia = competenciaUnica();
  const admin = await browser.newContext({ baseURL });
  const page = await admin.newPage();
  await login(page, ADMIN_EMAIL, senhaAdmin, baseURL!);
  await page.goto('/erp/contabilidade/politicas-de-contabilizacao');
  await configurarPolitica(page, competencia);
  await expect(page.getByRole('heading', { name: 'Dados principais' })).toBeHidden();
  await configurarPolitica(page, competencia);
  await expect(page.getByText('evento duplicado', { exact: true })).toBeVisible();
  expect((await politicaPelaApi(page, competencia))?.codigo).toBe(`LIQUIDACAO-${competencia}`);
  await admin.close();
});
```

- [ ] **Step 3: Adjust only unstable selectors**

Ajustar só seletores que o componente renderizado exija (por exemplo, o `Confirmar` do modal), sem trocar rótulo da fonte. Não adicionar `retries`, `waitForTimeout`, `docker`, `psql` nem `delete`.

- [ ] **Step 4: Run test to verify it passes, duas vezes seguidas**

```powershell
npx playwright test e2e/e09-t02-politicas-contabilizacao.spec.ts
npx playwright test e2e/e09-t02-politicas-contabilizacao.spec.ts
```

Expected: 2 passed nas duas execuções, no mesmo banco, sem limpeza entre elas. Em seguida `npm test` e `npm run lint` em `app/frontend`.

- [ ] **Step 5: Commit**

A mensagem leva **uma única frase** de causa, a que a evidência do trace do Step 1 sustenta. Antes do `git commit`, deixar exatamente uma destas atribuições no terminal (apagar as outras duas, nada de rótulo H1 ou H3 na mensagem):

```powershell
$causa = 'A tela falou com um Next ou backend reaproveitado de outra worktree, com banco diferente do inspecionado.'
# ou: $causa = 'A leitura do screenshot confundiu a opção Aprovado do filtro de situação com a célula da grade.'
# ou: $causa = 'A anomalia de Aprovado exibido com o banco em DRAFT não reapareceu na execução limpa.'
```

```powershell
git add app/frontend/e2e/helpers/e09-t02-seed.ts app/frontend/e2e/e09-t02-politicas-contabilizacao.spec.ts
git commit -m @"
test(contabilidade): torna determinística a jornada das políticas e confere o estado pela API

### Descrição Detalhada:
O spec cria o próprio plano de contas por HTTP com sufixo único, sorteia as competências, usa e-mail único para o segundo administrador, as credenciais do administrador vindas de ADMIN_EMAIL e loginBackend (as mesmas do seed), espera cada resposta de simular e aprovar antes de seguir e confere situação, simulação e aprovador pela API por trás do BFF. Um teste compara a tela com o backend do seed e o outro cobre o evento duplicado sem depender do primeiro.

### Motivo da Mudança:
O Playwright da T02 não ficou verde por dados fixos entre execuções, clique antes da resposta e dependência entre testes. A anomalia de Aprovado exibido com o banco em DRAFT precisa de prova de que a tela e o banco consultado são o mesmo sistema. $causa

### Impacto:
Só testes e helper de teste. Sem docker exec, sem nome de banco fixo, sem limpeza de dados. Duas execuções seguidas no mesmo banco passam.
"@
```

## Task 15: Paginação server-side com controle na tela (B2 do Portão 1 r3)

Causa lida: o backend já pagina em `PAGINA = 20` (`politicas.service.ts` L36, `listar` L403–L421) e devolve `total`, mas `page.tsx` (L8–L12) descarta o `total` e o cliente da Task 13 fixa `pagina: '1'`. Da 21ª política em diante o registro é inalcançável pela tela (Princípio II; kiro §5: "filtros/sort/paginação do grid devem funcionar com API/dados reais"; `MATRIZ-UX` E09-T02, paginação 20, `componentes.js` L5950).

**Files:**
- Modify: `app/frontend/src/app/(admin)/erp/contabilidade/politicas-de-contabilizacao/page.tsx` (L8–L12)
- Modify: `app/frontend/src/app/(admin)/erp/contabilidade/politicas-de-contabilizacao/politicas-contabilizacao-client.tsx` (props L133–L139, estado L152–L158, restauração L160–L172, gravação L174–L176, efeito da Task 13, controles L388–L393 e L404, depois do bloco de cartões L445)
- Modify: `app/frontend/__tests__/politicas-contabilizacao-apresentacao.test.tsx`
- Modify: `app/frontend/e2e/helpers/e09-t02-seed.ts` (acrescenta `criarPoliticas`)
- Modify: `app/frontend/e2e/e09-t02-politicas-contabilizacao.spec.ts` (acrescenta um teste)

**Interfaces:**
- Consumes: `GET /api/contabilidade/politicas?pagina=N&...` com `{ itens, total }`; o efeito de consulta da Task 13 (com `ultimaConsulta`); `Pagination`, `PaginationContent`, `PaginationItem` e `PaginationLink` de `app/frontend/src/components/ui/pagination.tsx`. Observação sobre o componente: nenhuma tela importa `ui/pagination.tsx` hoje, e `plano-contas-client.tsx` (L531–L533) usa dois `<button>` `Anterior` e `Próxima`. O veredito pede o componente do DS, então esta Task usa `PaginationLink` com texto e `aria-label` em português; `PaginationPrevious` e `PaginationNext` não servem porque trazem `Previous` e `Next` fixos no filho.
- Produces: `page.tsx` repassa `total`; o cliente guarda `pagina` e `total`; qualquer mudança de busca, competência, situação ou ordenação volta à página 1; a página persiste no `sessionStorage` junto dos outros filtros; resposta de página antiga é descartada.

- [ ] **Step 1: Write the failing tests**

Em `politicas-contabilizacao-apresentacao.test.tsx`:

```tsx
function muitas(quantidade: number) {
  return Array.from({ length: quantidade }, (_, i) => linha(`LIQUIDACAO-2026-${i}`, `Liquidação ${i}`));
}
const URL_PAGINA_2 = '/api/contabilidade/politicas?pagina=2&q=&competencia=&situacao=&ordenar=competencia&direcao=asc';

it('mostra a posição na lista e desabilita Anterior na primeira página', () => {
  render(<PoliticasContabilizacaoClient inicial={muitas(20)} totalInicial={45} />);
  expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
  expect(screen.getByText('Exibindo 20 de 45')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Página anterior' })).toHaveAttribute('aria-disabled', 'true');
  expect(screen.getByRole('link', { name: 'Próxima página' })).toHaveAttribute('aria-disabled', 'false');
});

it('Próxima página consulta pagina=2 e Anterior volta para a 1', async () => {
  const user = userEvent.setup();
  const fetchMock = jest.fn()
    .mockResolvedValueOnce(corpoOk({ itens: [linha('TARIFA-2026-10', 'Tarifa')], total: 45 }))
    .mockResolvedValueOnce(corpoOk({ itens: muitas(20), total: 45 }));
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={muitas(20)} totalInicial={45} />);
  await user.click(screen.getByRole('link', { name: 'Próxima página' }));
  expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenNthCalledWith(1, URL_PAGINA_2);
  expect(screen.getByRole('cell', { name: 'Tarifa' })).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'Página anterior' }));
  expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining('pagina=1'));
});

it('não passa da última página', async () => {
  const user = userEvent.setup();
  const fetchMock = jest.fn().mockResolvedValue(corpoOk({ itens: muitas(5), total: 25 }));
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={muitas(20)} totalInicial={25} />);
  await user.click(screen.getByRole('link', { name: 'Próxima página' }));
  expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'Próxima página' }));
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it.each([
  ['a busca', async (user: ReturnType<typeof userEvent.setup>) => { await user.type(screen.getByLabelText('Buscar registros da lista'), 'x'); }, 'q=x'],
  ['a situação', async (user: ReturnType<typeof userEvent.setup>) => { await user.selectOptions(screen.getByLabelText('Filtrar situação'), 'DRAFT'); }, 'situacao=DRAFT'],
  ['a ordenação', async (user: ReturnType<typeof userEvent.setup>) => { await user.click(screen.getByRole('button', { name: 'Ordenar por Conta de débito' })); }, 'ordenar=contaDebito'],
])('mudar %s volta à página 1', async (_rotulo, agir, trecho) => {
  const user = userEvent.setup();
  const fetchMock = jest.fn().mockResolvedValue(corpoOk({ itens: muitas(20), total: 45 }));
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={muitas(20)} totalInicial={45} />);
  await user.click(screen.getByRole('link', { name: 'Próxima página' }));
  expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument();
  await agir(user);
  await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining(`pagina=1&`)));
  expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining(trecho));
  expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument();
});

it('descarta a resposta antiga da página 2 quando o usuário já voltou para a 1', async () => {
  const user = userEvent.setup();
  const lenta = adiavel();
  global.fetch = jest.fn()
    .mockReturnValueOnce(lenta.promessa)
    .mockResolvedValueOnce(corpoOk({ itens: muitas(20), total: 45 })) as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={muitas(20)} totalInicial={45} />);
  await user.click(screen.getByRole('link', { name: 'Próxima página' }));
  await user.click(screen.getByRole('link', { name: 'Página anterior' }));
  expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument();
  await act(async () => { lenta.resolver(corpoOk({ itens: [linha('TARIFA-2026-10', 'Tarifa')], total: 45 })); });
  expect(screen.queryByRole('cell', { name: 'Tarifa' })).not.toBeInTheDocument();
  expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
});

it('restaura a página do sessionStorage com uma única consulta', async () => {
  sessionStorage.setItem('politicas-de-contabilizacao', JSON.stringify({ pagina: 2 }));
  const fetchMock = jest.fn().mockResolvedValue(corpoOk({ itens: [linha('TARIFA-2026-10', 'Tarifa')], total: 45 }));
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={muitas(20)} totalInicial={45} />);
  expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(URL_PAGINA_2);
});

it('página restaurada além do total volta para a última página existente', async () => {
  sessionStorage.setItem('politicas-de-contabilizacao', JSON.stringify({ pagina: 9 }));
  const fetchMock = jest.fn()
    .mockResolvedValueOnce(corpoOk({ itens: [], total: 25 }))
    .mockResolvedValueOnce(corpoOk({ itens: muitas(5), total: 25 }));
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={muitas(20)} totalInicial={25} />);
  expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenLastCalledWith(URL_PAGINA_2);
});
```

(`corpoOk`, `adiavel` e o `beforeEach` que limpa o `sessionStorage` vêm das Tasks 12 e 13; `waitFor` e `act` já estão no import.)

Em `e2e/helpers/e09-t02-seed.ts`, acrescentar (reaproveita `postar`, `ontemIso`, `competenciaUnica` e `loginBackend` do próprio arquivo):

```ts
/** Cria `quantidade` políticas de Liquidação, cada uma numa competência sorteada, sobre as contas do plano da jornada. */
export async function criarPoliticas(request: APIRequestContext, plano: PlanoDaJornada, quantidade: number): Promise<void> {
  const { cookieHeader } = await loginBackend(request);
  for (let i = 0; i < quantidade; i += 1) {
    await postar(request, cookieHeader, '/contabilidade/politicas', {
      tipoEvento: 'LIQUIDACAO',
      competencia: competenciaUnica(),
      contaDebitoCodigo: `A${plano.sufixo}.1`,
      contaCreditoCodigo: `P${plano.sufixo}.1`,
      centroCodigo: plano.centroCodigo,
      vigenciaInicio: ontemIso(),
      justificativa: 'cria política para paginar',
    });
  }
}
```

Em `e2e/e09-t02-politicas-contabilizacao.spec.ts`, ajustar o import (`criarPoliticas`) e acrescentar o teste, que cria o próprio plano para que o filtro por nome de conta devolva exatamente 21 políticas:

```ts
test('com mais de 20 políticas a página 2 é alcançada pela tela e a posição sobrevive ao reload', async ({ browser, baseURL, playwright }) => {
  const api = await playwright.request.newContext();
  let propria: PlanoDaJornada;
  try {
    propria = await criarPlanoDaJornada(api);
    await criarPoliticas(api, propria, 21);
  } finally {
    await api.dispose();
  }
  const admin = await browser.newContext({ baseURL });
  const page = await admin.newPage();
  await login(page, ADMIN_EMAIL, senhaAdmin, baseURL!);
  await page.goto('/erp/contabilidade/politicas-de-contabilizacao');
  const linhas = page.locator('.politicas-grade tbody tr');
  const listaDaBusca = (pagina: string) => page.waitForResponse((resposta) => {
    const url = new URL(resposta.url());
    return resposta.request().method() === 'GET' && url.pathname === '/api/contabilidade/politicas'
      && url.searchParams.get('pagina') === pagina && url.searchParams.get('q') === propria.debitoNome;
  });
  const primeira = listaDaBusca('1');
  await page.getByLabel('Buscar registros da lista').fill(propria.debitoNome);
  expect((await primeira).ok()).toBeTruthy();
  await expect(linhas).toHaveCount(20);
  await expect(page.getByText('Página 1 de 2', { exact: true })).toBeVisible();
  await expect(page.getByText('Exibindo 20 de 21', { exact: true })).toBeVisible();

  const segunda = listaDaBusca('2');
  await page.getByRole('link', { name: 'Próxima página' }).click();
  expect((await segunda).ok()).toBeTruthy();
  await expect(linhas).toHaveCount(1);
  await expect(page.getByText('Página 2 de 2', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('Página 2 de 2', { exact: true })).toBeVisible();
  await expect(linhas).toHaveCount(1);
  await admin.close();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```powershell
Set-Location app/frontend
npx jest __tests__/politicas-contabilizacao-apresentacao.test.tsx --runInBand
```

Expected: FAIL nos sete testes novos: não há prop `totalInicial`, controle de página nem texto `Página 1 de 3`. Os testes das Tasks 12 e 13 seguem verdes. O Playwright novo só roda no Step 4, com a tela pronta; antes disso ele falharia em `Próxima página`, que não existe.

- [ ] **Step 3: Write minimal implementation**

`page.tsx`:

```tsx
  const corpo = await resposta.json() as { itens?: PoliticaApresentada[]; total?: number };
  const itens = corpo.itens ?? [];
  return <PoliticasContabilizacaoClient inicial={itens} totalInicial={corpo.total ?? itens.length} />;
```

Cliente. Imports: `Pagination`, `PaginationContent`, `PaginationItem`, `PaginationLink` de `@/components/ui/pagination`. Constante `const POR_PAGINA = 20; // mesmo valor de PAGINA em politicas.service.ts`. Props: `totalInicial = inicial.length` (opcional, ao lado de `semAcesso`). Estado (junto de L152–L158): `const [pagina, setPagina] = useState(1);` e `const [total, setTotal] = useState(totalInicial);`. Derivado: `const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));`.

Restauração (efeito de L160–L172, já com `ordenar` e `direcao` da Task 13): acrescentar `pagina?: number` ao tipo do rascunho e `if (Number.isInteger(rascunho.pagina) && rascunho.pagina! >= 1 && rascunho.pagina! <= 100000) setPagina(rascunho.pagina!);`. Gravação (L174–L176): acrescentar `pagina` ao objeto e à lista de dependências.

Efeito de consulta da Task 13: `pagina: String(pagina)` no lugar de `'1'`, `pagina` nas dependências e, depois de validar o corpo:

```tsx
      const novoTotal = typeof corpo.total === 'number' ? corpo.total : corpo.itens.length;
      setLinhas(corpo.itens);
      setTotal(novoTotal);
      setMarcadas([]);
      setAviso('');
      const ultima = Math.max(1, Math.ceil(novoTotal / POR_PAGINA));
      if (pagina > ultima) setPagina(ultima);
```

(o tipo de `corpo` passa a `{ itens?: PoliticaApresentada[]; total?: number } | null`).

Os quatro pontos que mudam a visão voltam à página 1 no mesmo lote de estado, para a consulta sair uma vez só: no `onChange` da busca (L388), da competência (L389) e da situação (L390) acrescentar `setPagina(1);` depois do `setBusca`/`setFiltroCompetencia`/`setFiltroSituacao`, e em `ordenarPor` (L360–L364) acrescentar `setPagina(1);`.

Controle, logo depois do bloco `politicas-cartoes` (L445):

```tsx
      <p>Exibindo {linhas.length} de {total}</p>
      <Pagination aria-label="Paginação da lista">
        <PaginationContent>
          <PaginationItem>
            <PaginationLink
              href="#"
              size="default"
              aria-label="Página anterior"
              aria-disabled={pagina <= 1}
              onClick={(evento) => { evento.preventDefault(); if (pagina > 1) setPagina(pagina - 1); }}
            >Anterior</PaginationLink>
          </PaginationItem>
          <PaginationItem><span>Página {pagina} de {totalPaginas}</span></PaginationItem>
          <PaginationItem>
            <PaginationLink
              href="#"
              size="default"
              aria-label="Próxima página"
              aria-disabled={pagina >= totalPaginas}
              onClick={(evento) => { evento.preventDefault(); if (pagina < totalPaginas) setPagina(pagina + 1); }}
            >Próxima</PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
```

Nenhum rótulo do protótipo muda: `Anterior`, `Próxima` e `Página N de M` são rótulos novos de controle que a fonte não nomeia (o protótipo declara só `pagination: 20`), e ficam registrados em "Decisões em aberto" item 7.

- [ ] **Step 4: Run tests to verify they pass**

```powershell
npx jest __tests__/politicas-contabilizacao-apresentacao.test.tsx --runInBand
npm run lint
npm run type-check
npx playwright test e2e/e09-t02-politicas-contabilizacao.spec.ts
npx playwright test e2e/e09-t02-politicas-contabilizacao.spec.ts
```

Expected: Jest PASS; Playwright com todos os testes do arquivo passando nas duas execuções seguidas no mesmo banco.

- [ ] **Step 5: Commit**

```powershell
git add "app/frontend/src/app/(admin)/erp/contabilidade/politicas-de-contabilizacao" app/frontend/__tests__/politicas-contabilizacao-apresentacao.test.tsx app/frontend/e2e/helpers/e09-t02-seed.ts app/frontend/e2e/e09-t02-politicas-contabilizacao.spec.ts
git commit -m @"
feat(contabilidade): pagina a lista das políticas pelo servidor com controle na tela

### Descrição Detalhada:
A página inicial repassa o total, o cliente guarda a página e o total, e o controle Anterior, Próxima e Página N de M consulta o BFF com pagina=N. Mudar a busca, a competência, a situação ou a ordenação volta à página 1. A página persiste no sessionStorage com os demais filtros e uma resposta de página antiga é descartada.

### Motivo da Mudança:
O Portão 1 r3 (B2) apontou que, com a lista vinda do servidor em 20 linhas, a 21ª política era inalcançável pela tela, contra o Princípio II e a regra de que filtros, ordenação e paginação do grid funcionem com dados reais.

### Impacto:
Só frontend e teste. Nenhum contrato do backend muda. O Playwright cria 21 políticas por HTTP e alcança a página 2 pela tela, inclusive depois do reload.
"@
```

## Task 16: Exportar e Exportar visão baixam o arquivo, com a visão inteira e sem fórmula (B3 do Portão 1 r3)

Causas lidas: os dois botões fazem `void fetch(...)` e descartam a resposta (`politicas-contabilizacao-client.tsx` L380 e L393), então nada é baixado, e o primeiro nem envia `competencia`, `situacao`, `ordenar` e `direcao`. `repassar` (`app/frontend/src/lib/bff.ts` L11–L22) força `Content-Type: application/json` e descarta `Content-Disposition`. `exportarCsv` (`politicas.service.ts` L376–L390) chama `listar`, que pagina em 20, e `escapar` (L387) não neutraliza célula iniciada por fórmula; o nome da conta e do centro de custo é texto livre. A tabela de ações do plano (L126) promete CSV.

**Files:**
- Create: `app/backend/src/modules/contabilidade/politicas/csv.ts`
- Modify: `app/backend/src/modules/contabilidade/politicas/politicas.service.ts` (`exportarCsv` L376–L390; `listar` L403–L407 passa a usar um helper de ordem compartilhado)
- Modify: `app/backend/src/modules/contabilidade/politicas/politicas.controller.ts` (`exportar`, L36–L41)
- Modify: `app/frontend/src/lib/bff.ts` (nova função `repassarArquivo`; `repassar` não muda)
- Modify: `app/frontend/src/app/api/contabilidade/politicas/exportar/route.ts`
- Modify: `app/frontend/src/app/(admin)/erp/contabilidade/politicas-de-contabilizacao/politicas-contabilizacao-client.tsx` (L380 e L393)
- Create: `app/frontend/__tests__/bff-politicas-exportar.test.ts`
- Test: `app/backend/test/integration/politicas-contabilizacao.e2e-spec.ts`, `app/backend/src/modules/contabilidade/politicas/politicas.service.spec.ts`, `app/frontend/__tests__/politicas-contabilizacao-apresentacao.test.tsx`, `app/frontend/e2e/e09-t02-politicas-contabilizacao.spec.ts`

**Interfaces:**
- Consumes: `listarPoliticasSchema` (`pagina` é aceita e ignorada na exportação); o `consulta(extra)` da Task 11; o estado de busca, competência, situação, ordenação e direção da Task 13.
- Produces: `celulaCsv(valor)` (cita e neutraliza); `GET /contabilidade/politicas/exportar` com `Content-Type: text/csv; charset=utf-8` e `Content-Disposition: attachment; filename="politicas-de-contabilizacao.csv"` (sem id nem código no nome); `repassarArquivo(caminho)` no BFF; um `exportar()` no cliente que baixa o arquivo (blob + `a[download]`) com `q`, `competencia`, `situacao`, `ordenar` e `direcao` da lista e nunca `pagina`.

- [ ] **Step 1: Write the failing tests**

`politicas.service.spec.ts` (importa `celulaCsv` de `./csv`):

```ts
describe('celulaCsv', () => {
  it.each([
    ['=1+1', "'=1+1"],
    ['+SUM(A1)', "'+SUM(A1)"],
    ['-2', "'-2"],
    ['@cmd', "'@cmd"],
    ['\t=tab', `"'\t=tab"`],
    ['\r=cr', `"'\r=cr"`],
    ['Caixa', 'Caixa'],
    ['a;b', '"a;b"'],
    ['diz "oi"', '"diz ""oi"""'],
    ['linha\nnova', '"linha\nnova"'],
  ])('%j vira %j', (entrada, esperado) => {
    expect(celulaCsv(entrada)).toBe(esperado);
  });
});
```

`politicas-contabilizacao.e2e-spec.ts`, dentro do `describe` principal:

```ts
describe('exportação da visão', () => {
  const visao = { pagina: 1, q: '', situacao: '', competencia: '', ordenar: 'competencia', direcao: 'asc' } as const;

  async function criarVinteEUma() {
    for (let i = 0; i < 21; i += 1) {
      const mes = String((i % 12) + 1).padStart(2, '0');
      await service.configurar(dtoConfigurar({ competencia: `${2026 + Math.floor(i / 12)}-${mes}` }), autorId);
    }
  }

  it('exporta a visão inteira e não só a página, e respeita o filtro', async () => {
    await prepararContasAnaliticas();
    await criarVinteEUma();
    expect((await service.listar(visao)).itens).toHaveLength(20);
    const csv = await service.exportarCsv({ ...visao, pagina: 2 });
    expect(csv.replace('\uFEFF', '').split('\n')).toHaveLength(22);
    const uma = await service.exportarCsv({ ...visao, competencia: '2026-03' });
    expect(uma.replace('\uFEFF', '').split('\n')).toHaveLength(2);
  });

  it('neutraliza célula que começa como fórmula', async () => {
    await prepararContasAnaliticas();
    await plano.criar(dtoConta({ codigo: '1.1.02', classificacao: 'analitica', contaPaiCodigo: '1', nome: '=1+1' }), autorId);
    await aprovarDireto('1.1.02');
    await service.configurar(dtoConfigurar({ contaDebitoCodigo: '1.1.02' }), autorId);
    const csv = await service.exportarCsv(visao);
    expect(csv).toContain(";'=1+1;");
    expect(csv).not.toContain(';=1+1;');
  });

  it('o endpoint devolve text/csv com o nome do arquivo e as 21 linhas, sem pagina', async () => {
    await prepararContasAnaliticas();
    await criarVinteEUma();
    const res = await request(srv()).get('/contabilidade/politicas/exportar?pagina=2&ordenar=competencia&direcao=desc')
      .set('Cookie', adminCookies);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toBe('attachment; filename="politicas-de-contabilizacao.csv"');
    expect(res.text.replace('\uFEFF', '').split('\n')).toHaveLength(22);
    expect(res.text).not.toMatch(/LIQUIDACAO-|[0-9a-f]{8}-[0-9a-f]{4}-/);
  });
});
```

`app/frontend/__tests__/bff-politicas-exportar.test.ts` (novo; mocks no padrão de `bff-onda6.test.ts` L1–L30):

```ts
const mockApiFetch = jest.fn();

jest.mock('next/server', () => ({
  NextRequest: class {
    nextUrl: URL;
    constructor(url: string) {
      this.nextUrl = new URL(url);
    }
  },
  NextResponse: class {
    status: number;
    headers: Headers;
    body: string | null;
    constructor(body: string | null, init?: { status?: number; headers?: HeadersInit }) {
      this.body = body;
      this.status = init?.status ?? 200;
      this.headers = new Headers(init?.headers);
    }
  },
}));
jest.mock('@/lib/api', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/contabilidade/politicas/exportar/route';

const csv = '\uFEFFCompetência;Situação\nOutubro de 2026;Rascunho';

beforeEach(() => mockApiFetch.mockReset());

it('repassa o filtro, o text/csv e o Content-Disposition do backend', async () => {
  mockApiFetch.mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => csv,
    headers: new Headers({
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="politicas-de-contabilizacao.csv"',
    }),
  });
  const resposta = await GET(new NextRequest('http://interno/api/contabilidade/politicas/exportar?q=a&ordenar=competencia') as never);
  expect(mockApiFetch).toHaveBeenCalledWith('/contabilidade/politicas/exportar?q=a&ordenar=competencia', { method: 'GET' });
  expect(resposta.status).toBe(200);
  expect(resposta.headers.get('content-type')).toBe('text/csv; charset=utf-8');
  expect(resposta.headers.get('content-disposition')).toBe('attachment; filename="politicas-de-contabilizacao.csv"');
  expect((resposta as unknown as { body: string }).body).toBe(csv);
});

it('erro do backend segue como JSON com o status original', async () => {
  mockApiFetch.mockResolvedValue({
    ok: false,
    status: 400,
    text: async () => '{"message":"Validação falhou"}',
    headers: new Headers({ 'content-type': 'application/json' }),
  });
  const resposta = await GET(new NextRequest('http://interno/api/contabilidade/politicas/exportar?pagina=0') as never);
  expect(resposta.status).toBe(400);
  expect(resposta.headers.get('content-type')).toBe('application/json');
  expect(resposta.headers.get('content-disposition')).toBeNull();
});
```

`politicas-contabilizacao-apresentacao.test.tsx` (usa `corpoOk` e o `beforeEach` das Tasks 12 e 13):

```tsx
function respostaCsv(conteudo: string) {
  return { ok: true, status: 200, blob: async () => new Blob([conteudo], { type: 'text/csv' }), text: async () => conteudo };
}

describe('exportação', () => {
  let cliques: HTMLAnchorElement[];

  beforeEach(() => {
    cliques = [];
    URL.createObjectURL = jest.fn(() => 'blob:politicas');
    URL.revokeObjectURL = jest.fn();
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
      cliques.push(this);
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('Exportar visão baixa o arquivo com os mesmos parâmetros da lista e sem pagina', async () => {
    const user = userEvent.setup();
    const fetchMock = jest.fn((url: string) => Promise.resolve(
      url.includes('/exportar') ? respostaCsv('\uFEFFCompetência') : corpoOk({ itens: [linha('TARIFA-2026-10', 'Tarifa')], total: 1 }),
    ));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
    await user.type(screen.getByLabelText('Buscar registros da lista'), 'x');
    await user.selectOptions(screen.getByLabelText('Filtrar situação'), 'DRAFT');
    await user.click(screen.getByRole('button', { name: 'Ordenar por Conta de débito' }));
    await user.click(screen.getByRole('button', { name: 'Exportar visão' }));
    await waitFor(() => expect(cliques).toHaveLength(1));
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/contabilidade/politicas/exportar?q=x&competencia=&situacao=DRAFT&ordenar=contaDebito&direcao=asc',
    );
    expect(cliques[0]?.download).toBe('politicas-de-contabilizacao.csv');
    expect(cliques[0]?.href).toBe('blob:politicas');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:politicas');
  });

  it('Exportar usa a mesma visão que Exportar visão', async () => {
    const user = userEvent.setup();
    const fetchMock = jest.fn().mockResolvedValue(respostaCsv('\uFEFFCompetência'));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
    await user.click(screen.getByRole('button', { name: 'Exportar', exact: true }));
    await waitFor(() => expect(cliques).toHaveLength(1));
    expect(fetchMock).toHaveBeenCalledWith('/api/contabilidade/politicas/exportar?q=&competencia=&situacao=&ordenar=competencia&direcao=asc');
  });

  it('falha na exportação mostra a mensagem, não baixa nada e não afirma sucesso', async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ message: 'Validação falhou' }),
    }) as unknown as typeof fetch;
    render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
    await user.click(screen.getByRole('button', { name: 'Exportar visão' }));
    expect(await screen.findByText('Validação falhou')).toBeInTheDocument();
    expect(cliques).toHaveLength(0);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(screen.queryByText(/exportad/i)).not.toBeInTheDocument();
  });
});
```

Em `e2e/e09-t02-politicas-contabilizacao.spec.ts` (imports `readFile` de `node:fs/promises`), um teste com plano próprio para que a visão filtrada tenha exatamente 21 políticas, mais que a página de 20:

```ts
test('Exportar visão baixa o CSV com todas as linhas da visão, sem id e sem fórmula', async ({ browser, baseURL, playwright }) => {
  const api = await playwright.request.newContext();
  let propria: PlanoDaJornada;
  try {
    propria = await criarPlanoDaJornada(api);
    await criarPoliticas(api, propria, 21);
  } finally {
    await api.dispose();
  }
  const admin = await browser.newContext({ baseURL });
  const page = await admin.newPage();
  await login(page, ADMIN_EMAIL, senhaAdmin, baseURL!);
  await page.goto('/erp/contabilidade/politicas-de-contabilizacao');
  const lista = page.waitForResponse((resposta) => {
    const url = new URL(resposta.url());
    return url.pathname === '/api/contabilidade/politicas' && url.searchParams.get('q') === propria.debitoNome;
  });
  await page.getByLabel('Buscar registros da lista').fill(propria.debitoNome);
  expect((await lista).ok()).toBeTruthy();
  await expect(page.locator('.politicas-grade tbody tr')).toHaveCount(20);

  const baixando = page.waitForEvent('download');
  const exportacao = page.waitForResponse((resposta) => {
    const url = new URL(resposta.url());
    return url.pathname === '/api/contabilidade/politicas/exportar' && url.searchParams.get('q') === propria.debitoNome
      && !url.searchParams.has('pagina');
  });
  await page.getByRole('button', { name: 'Exportar visão' }).click();
  expect((await exportacao).headers()['content-type']).toContain('text/csv');
  const download = await baixando;
  expect(download.suggestedFilename()).toBe('politicas-de-contabilizacao.csv');
  const bytes = await readFile(await download.path());
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const linhas = bytes.toString('utf8').replace('\uFEFF', '').split('\n');
  expect(linhas).toHaveLength(22);
  expect(linhas[0]).toBe('Competência;Situação;Conta de débito;Conta de crédito;Centro de custo;Tipo de ocorrência');
  expect(bytes.toString('utf8')).not.toMatch(/LIQUIDACAO-|[0-9a-f]{8}-[0-9a-f]{4}-/);
  await admin.close();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```powershell
Set-Location app/backend
npx jest test/integration/politicas-contabilizacao.e2e-spec.ts src/modules/contabilidade/politicas/politicas.service.spec.ts --runInBand -t "exportação da visão|celulaCsv"
Set-Location ../frontend
npx jest __tests__/politicas-contabilizacao-apresentacao.test.tsx __tests__/bff-politicas-exportar.test.ts --runInBand
```

Expected: FAIL. Backend: `csv.ts` não existe (o spec de serviço não compila); `exportarCsv` devolve 21 linhas em vez de 22; sem prefixo de fórmula; sem `Content-Disposition`. Frontend: `repassarArquivo` não existe e a rota ainda força JSON; os botões não chamam `createObjectURL` nem clicam em `a[download]`. Se algum teste que não é guarda passar antes, parar (critério 1).

- [ ] **Step 3: Write minimal implementation**

`politicas/csv.ts`:

```ts
/** Célula do CSV: neutraliza o que o Excel ou o Calc leria como fórmula (prefixo ') e cita o que precisa de aspas. */
export function celulaCsv(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[",;\r\n\t]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}
```

`politicas.service.ts`: o cálculo da ordem sai de `listar` (L405–L406) para `private ordemDe(query: ListarPoliticasQuery) { const coluna = this.colunaOrdem(query.ordenar); return query.direcao === 'desc' ? desc(coluna) : asc(coluna); }`, e `listar` passa a usar `const ordem = this.ordemDe(query);`. `exportarCsv` (importar `celulaCsv` de `./csv`):

```ts
  async exportarCsv(query: ListarPoliticasQuery): Promise<string> {
    const bruto = await this.consulta(this.filtro(query)).orderBy(this.ordemDe(query));
    const itens = bruto.map((linha) => this.apresentar(linha));
    const cabecalho = ['Competência', 'Situação', 'Conta de débito', 'Conta de crédito', 'Centro de custo', 'Tipo de ocorrência'];
    const linhas = itens.map((item) => [
      item.competenciaRotulo,
      item.situacaoRotulo,
      item.contaDebitoNome,
      item.contaCreditoNome,
      item.centroNome,
      item.tipoEventoRotulo,
    ]);
    const corpo = [cabecalho, ...linhas].map((linha) => linha.map(celulaCsv).join(';')).join('\n');
    return `\uFEFF${corpo}`;
  }
```

`politicas.controller.ts`, no `exportar` (L36–L41), acrescentar abaixo do `@Header('Content-Type', ...)`: `@Header('Content-Disposition', 'attachment; filename="politicas-de-contabilizacao.csv"')`.

`app/frontend/src/lib/bff.ts`, nova função ao lado de `repassar` (que não muda):

```ts
/** Como `repassar`, mas para arquivo: no sucesso preserva Content-Type e Content-Disposition do backend; no erro segue como JSON. */
export async function repassarArquivo(caminho: string): Promise<NextResponse> {
  const resposta = await apiFetch(caminho, { method: 'GET' });
  const texto = await resposta.text();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (resposta.ok) {
    headers['Content-Type'] = resposta.headers.get('content-type') ?? 'text/csv; charset=utf-8';
    const disposicao = resposta.headers.get('content-disposition');
    if (disposicao) headers['Content-Disposition'] = disposicao;
  }
  return new NextResponse(texto === '' ? null : texto, { status: resposta.status, headers });
}
```

`exportar/route.ts`: `import { repassarArquivo } from '@/lib/bff';` e `return repassarArquivo(\`/contabilidade/politicas/exportar${req.nextUrl.search}\`);`.

Cliente. Uma função, chamada pelos dois botões (L380 e L393 viram `onClick={() => void exportar()}`), junto de `validar()`:

```tsx
  async function exportar() {
    const consulta = new URLSearchParams({ q: busca, competencia: filtroCompetencia, situacao: filtroSituacao, ordenar, direcao });
    try {
      const resposta = await fetch(`/api/contabilidade/politicas/exportar?${consulta.toString()}`);
      if (!resposta.ok) {
        setAviso((await lerMensagem(resposta)) || 'Não foi possível exportar. Tente novamente.');
        return;
      }
      // blob, não text(): text() descarta o BOM e o Excel perde os acentos.
      const url = URL.createObjectURL(await resposta.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'politicas-de-contabilizacao.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setAviso('');
    } catch {
      setAviso('Não foi possível exportar. Tente novamente.');
    }
  }
```

Nenhum rótulo muda: os botões continuam `Exportar` e `Exportar visão`.

- [ ] **Step 4: Run tests to verify they pass**

```powershell
Set-Location app/backend
npx jest test/integration/politicas-contabilizacao.e2e-spec.ts src/modules/contabilidade/politicas/politicas.service.spec.ts --runInBand
npm run lint
npm run type-check
npm run test:cov
Set-Location ../frontend
npx jest __tests__/politicas-contabilizacao-apresentacao.test.tsx __tests__/bff-politicas-exportar.test.ts --runInBand
npm run lint
npm run type-check
npx playwright test e2e/e09-t02-politicas-contabilizacao.spec.ts
npx playwright test e2e/e09-t02-politicas-contabilizacao.spec.ts
```

Expected: PASS, cobertura do backend ≥ 80% de linha e de branch, Playwright passando nas duas execuções seguidas no mesmo banco.

- [ ] **Step 5: Commit**

```powershell
git add app/backend/src/modules/contabilidade/politicas app/backend/test/integration/politicas-contabilizacao.e2e-spec.ts app/frontend/src/lib/bff.ts app/frontend/src/app/api/contabilidade/politicas/exportar/route.ts "app/frontend/src/app/(admin)/erp/contabilidade/politicas-de-contabilizacao" app/frontend/__tests__/politicas-contabilizacao-apresentacao.test.tsx app/frontend/__tests__/bff-politicas-exportar.test.ts app/frontend/e2e/e09-t02-politicas-contabilizacao.spec.ts
git commit -m @"
fix(contabilidade): exporta de verdade o CSV da visão inteira das políticas e neutraliza fórmula

### Descrição Detalhada:
Exportar e Exportar visão baixam o arquivo (blob e link de download) com q, competência, situação, ordenação e direção da lista, e mostram o erro sem afirmar sucesso. O BFF repassa text/csv e Content-Disposition. O backend exporta a visão inteira, sem paginação, com nome de arquivo sem identificador, e prefixa com apóstrofo a célula iniciada por =, +, -, @, tab ou CR.

### Motivo da Mudança:
O Portão 1 r3 (B3) mostrou que os botões descartavam a resposta, que o CSV saía com 20 linhas e que o nome de uma conta podia executar fórmula no Excel.

### Impacto:
Só a exportação muda. Nenhum contrato de listagem, rota ou migration. O BFF ganha repassarArquivo e repassar segue igual.
"@
```

## Task 17: Renumeração da migration da T02 (executar só quando o coordenador indicar)

**Pré-condição explícita.** Esta Task **não** roda com as Tasks 8–16. Só roda quando o coordenador disser, e só depois de: (1) a E09-T01 renumerada para `0049` e a trilha E01 (`0044`..`0048`) estarem integradas na branch por merge normal; (2) nenhum desvio de prefixo no `_journal.json`. Verificação:

```powershell
Set-Location app/backend
(Get-Content src/database/migrations/meta/_journal.json -Raw | ConvertFrom-Json).entries | Select-Object -Last 8 idx, tag | Format-Table
```

Expected: entradas `0044` a `0048` da trilha E01, depois uma entrada `0049_*` da E09-T01 (tag que contém `e09_t01`), e por último `0049_e09_t02_politicas_contabilizacao`. **Parada:** se o último prefixo da T01 não for `0049`, se a trilha E01 não terminar em `0048`, ou se existir um prefixo `0050` já ocupado, parar e devolver ao coordenador. Não renumerar a T01 nem a E01 aqui. O merge pode ter produzido conflito add/add em `meta/0049_snapshot.json` e em `_journal.json` (a T01 renumerada e a T02 antiga disputam o `0049`): a resolução ficou com o coordenador e deixa nesses dois arquivos a versão da T01; esta Task só começa com o merge concluído.

**Files:**
- Delete: `app/backend/src/database/migrations/0049_e09_t02_politicas_contabilizacao.sql`, `app/backend/src/database/migrations/meta/0049_snapshot.json` **da T02** (o `0049_snapshot.json` que existir depois do merge pode ser o da T01: conferir pelo conteúdo, `git log --follow`, antes de apagar)
- Modify: `app/backend/src/database/migrations/meta/_journal.json` (remove só a entrada da T02)
- Create (gerados): `0050_e09_t02_politicas_contabilizacao.sql`, `meta/0050_snapshot.json`
- Create: `app/backend/test/unit/e09-t02-migration-tag.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS = path.resolve(__dirname, '../../src/database/migrations');
const META = path.join(MIGRATIONS, 'meta');

type Journal = { entries: { idx: number; tag: string }[] };
type Snapshot = { id: string; prevId: string };

const ler = <T>(arquivo: string): T => JSON.parse(fs.readFileSync(arquivo, 'utf8')) as T;

describe('E09-T02: migration das políticas de contabilização', () => {
  const journal = ler<Journal>(path.join(META, '_journal.json'));
  const politica = journal.entries.filter((entrada) => entrada.tag.includes('e09_t02'));
  const plano = journal.entries.filter((entrada) => entrada.tag.includes('e09_t01'));

  it('tem uma única entrada, com a tag 0050, logo depois da T01', () => {
    expect(politica).toHaveLength(1);
    expect(politica[0]?.tag).toBe('0050_e09_t02_politicas_contabilizacao');
    expect(plano).toHaveLength(1);
    expect(plano[0]?.tag.startsWith('0049_')).toBe(true);
    expect(politica[0]!.idx).toBe(plano[0]!.idx + 1);
  });

  it('os arquivos existem com o prefixo novo e o antigo sumiu', () => {
    expect(fs.existsSync(path.join(MIGRATIONS, '0050_e09_t02_politicas_contabilizacao.sql'))).toBe(true);
    expect(fs.existsSync(path.join(META, '0050_snapshot.json'))).toBe(true);
    expect(fs.existsSync(path.join(MIGRATIONS, '0049_e09_t02_politicas_contabilizacao.sql'))).toBe(false);
  });

  it('o snapshot 0050 encadeia no snapshot 0049 da T01', () => {
    const t01 = ler<Snapshot>(path.join(META, '0049_snapshot.json'));
    const t02 = ler<Snapshot>(path.join(META, '0050_snapshot.json'));
    expect(t02.prevId).toBe(t01.id);
  });

  it('cria só as três tabelas da política', () => {
    const sql = fs.readFileSync(path.join(MIGRATIONS, '0050_e09_t02_politicas_contabilizacao.sql'), 'utf8');
    const criadas = [...sql.matchAll(/CREATE TABLE "([a-z_]+)"/g)].map((m) => m[1]).sort();
    expect(criadas).toEqual(['politica_simulacoes', 'politica_versoes', 'politicas_contabilizacao']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
npx jest test/unit/e09-t02-migration-tag.spec.ts --runInBand
```

Expected: FAIL (a tag ainda é `0049_e09_t02_...`).

- [ ] **Step 3: Write minimal implementation**

1. Guardar o SQL atual para comparar: `git show HEAD:app/backend/src/database/migrations/0049_e09_t02_politicas_contabilizacao.sql > $env:TEMP/t02-antigo.sql` (pasta fora do repositório).
2. `git rm` do `.sql` da T02 e do snapshot que pertence a ela; editar o `_journal.json` removendo **somente** a entrada `0049_e09_t02_politicas_contabilizacao`.
3. Regenerar: `npx drizzle-kit generate --name e09_t02_politicas_contabilizacao` em `app/backend`. Conferir que nasceram `0050_e09_t02_politicas_contabilizacao.sql` e `meta/0050_snapshot.json` e que a tag do journal é exatamente essa. Se o prefixo gerado for outro: **parar** (critério 7); não renomear à mão.
4. Comparar o SQL novo com `t02-antigo.sql`: só pode diferir em comentários e ordem de statements. DDL fora das três tabelas da T02, ou qualquer `ALTER` de tabela da T01/E01, é desvio da base: **parar**.
5. Se o generate não emitir os três `CREATE TRIGGER ... set_updated_at()` da D8, acrescentá-los ao final do arquivo novo, iguais aos da D8.

- [ ] **Step 4: Run tests to verify they pass**

Em um Postgres 18 descartável (nunca um banco com dados que importem):

```powershell
docker compose up -d postgres
npm run db:migrate
npx jest test/unit/e09-t02-migration-tag.spec.ts test/integration/politicas-contabilizacao.e2e-spec.ts --runInBand
npm run test:cov
```

Expected: `db:migrate` aplica do zero sem erro, os testes passam, cobertura ≥ 80%.

- [ ] **Step 5: Commit**

```powershell
git add app/backend/src/database/migrations app/backend/test/unit/e09-t02-migration-tag.spec.ts
git commit -m @"
chore(contabilidade): renumera a migration das políticas para 0050

### Descrição Detalhada:
A migration da T02 sai de 0049 e é regenerada pelo drizzle-kit como 0050_e09_t02_politicas_contabilizacao, depois da 0049 da E09-T01 renumerada e da trilha E01 0044 a 0048. Um teste confere a tag, o encadeamento dos snapshots e que só as três tabelas da política são criadas.

### Motivo da Mudança:
A E09-T01 passou a ocupar o 0049 na integração com a trilha E01.

### Impacto:
Vale para bancos descartáveis (local, CI, e2e) que ainda não aplicaram a 0049 da T02. O DDL é o mesmo.
"@
```

- [ ] **Step 6: Rollback e restrição de banco**

O `drizzle-kit` registra a migration aplicada por hash e data (`when`), não por tag; a entrada regenerada tem `when` novo. Um banco que já aplicou a `0049_e09_t02` antiga tentaria criar as tabelas de novo e falharia com "relation already exists". Por isso a Task só vale se nenhum banco persistente aplicou a antiga. **Parada:** se o coordenador ou o ambiente indicar um banco compartilhado ou de homologação com a `0049` da T02 aplicada, não executar a Task; devolver ao coordenador, que decide entre recriar o banco ou uma migration de reconciliação. Rollback da Task: `git revert` do commit dela (volta a `0049_e09_t02`), seguido de recriar o banco descartável.

## Fora desta fatia

- E09-T03 diário, razão e lançamentos. Não criar `lancamentos_contabeis`, `diario_contabil`, `razao_contabil` nem `partidas_contabeis`.
- E09-T04 a E09-T09, SPED, apuração, fechamento e exportação contábil ampla.
- Módulo fiscal, NFS-e, empresa, estabelecimento e período contábil.
- Recriar plano de contas ou centro de custo. A rota `/erp/contabilidade/plano-de-contas` permanece.
- 12º perfil, concessão da permissão nova aos dez slugs que não são `administrador`, item no array do gestor, reordenação dos snapshots dos outros perfis.
- Quórum numérico, segundo voto, colunas `data_comercial`, `data_fiscal` e `data_efetiva`.
- Botão `Revisar competência`, ação `versionar`, `bloquear` e `rejeitar`.
- Migration `0048` e qualquer renumeração dela.
- Seed dos nomes de demonstração do protótipo. A tela nasce vazia com o texto de `sem registros`. As contas da jornada E2E são criadas pela tela do plano, não por seed.

## Decisões em aberto

A fonte não decide os pontos abaixo. O plano não inventa a regra de produto; deixa o comportamento conservador citado e para no que está escrito.

1. **Imposto e Enquadramento fiscal.** O Caderno B L447 diz `imposto`. O widget desta tela (`componentes.js` L310–L320 e matriz UX L966) diz `Enquadramento fiscal` e aponta o catálogo `regrasFiscais`, que não existe nesta ponta e cairia no módulo fiscal. As ações, regras e exceções não divergem. O plano mostra o rótulo literal, desabilitado, com `—` e `Provisório`, sem coluna e sem FK. Qual cadastro fiscal o ocupará fica para o Quality Owner.
2. **H-E01-10.** O Caderno B L449 repete “separar datas comercial/fiscal/efetiva”. A hipótese segue aberta. O plano não cria as três colunas. Competência e início de vigência são as datas que o protótipo já desenha. Qual coluna receberá cada data quando a hipótese fechar não está decidido.
3. **H-E01-11.** O DoD L451 diz “dupla aprovação quando exigida”. `aplicacao.js` L198 desenha Autor, Revisor e Aprovação, sem número. O plano exige uma pessoa diferente do autor e não grava segundo voto nem quórum. Se a aprovação exigir um revisor além dessa pessoa, a fonte não diz quantos.
4. **Eventos fora do enum.** O Caderno diz “evento fonte” e não lista os eventos. O protótipo fecha o combo em Liquidação, Registro de cobrança, Cancelamento, Estorno e Tarifa. O plano usa só esse enum. Eventos da operação de carnes não estão nomeados.
5. **Versão 2 de uma regra aprovada.** O dado “versão” existe. A lista de ações não tem “versionar”. O plano só edita rascunho e não abre a versão seguinte. Como nasce a versão 2 fica para o Quality Owner.
6. **A mesma conta nos dois lados (M7) e o valor zero.** A fonte não proíbe débito e crédito na mesma conta, e o plano não acrescenta essa recusa. Quanto ao valor zero, a r3 **supera** a primeira versão desta frase: o AD-25 item 2 (2026-10-15, Quality Owner) exige valor simulado maior que 0,00, aplicado na Task 10. Exigir contas diferentes continuaria sendo decisão nova.
7. **Rótulos de paginação e nome do arquivo CSV.** A fonte declara só `pagination: 20` (`componentes.js` L5950) e as ações `Exportar` e `Exportar visão`. Os textos `Anterior`, `Próxima`, `Página N de M`, `Exibindo X de Y` e o nome `politicas-de-contabilizacao.csv` não vêm da fonte (os dois primeiros e o terceiro acompanham a tela do plano da T01). O plano os usa como estão, sem selo; qual rótulo o Quality Owner prefere fica aberto.

## Self-review

- Caderno B L448: configurar, simular e aprovar estão nas tasks 3, 4 e 6. Revisar competência não vira botão (D1).
- Caderno B L449: origem imutável está na Task 3; mapeamento ausente e balanceamento exato estão na Task 4; as três datas não viram coluna (D5).
- Caderno B L450: evento duplicado está na Task 3; mapeamento ausente está nas tasks 3 e 4. A exceção carrega `{ message, codigo }`. O teste HTTP da Task 5 afirma o envelope do `AllExceptionsFilter`. A Task 6 mostra o texto interno com `textoMensagem`.
- Matriz UX L949–L971: grade, filtros, abas, estados e a seleção múltipla com lote estão na Task 6. `Situação` não tem botão de ordenar. `Início de vigência` fica na ficha, em `dd/MM/yyyy`, e não é coluna. O estado de serviço externo não é fabricado (D6). `Enquadramento fiscal` fica visível e sem FK.
- `politicas.service.spec.ts` nasce na Task 4. O Step 4 da Task 3 roda só o e2e de configurar e editar.
- Enum `tipoEvento` (`componentes.js` L2168–L2189) e enum `status` (L1688–L1708) estão no CHECK da Task 2 e nos rótulos da Task 6.
- Review Focus 1–5 têm teste nas tasks 3 e 4.
- `apresentar` da Task 3 é o contrato que as tasks 5 e 6 consomem, com os mesmos nomes de campo.
- Nenhum passo usa `.omit()` em schema com `.refine()`. Nenhum `Button` usa `outline`. A Task 1 cria o `page.tsx` mínimo. A migration citada é `0049` e a `0048` não é renumerada.
- Rótulos de botão estão inteiros: `Configurar mappings`, `Simular evento`, `Aprovar regra`. Não há forma abreviada.
- r4: cada item do veredito do Portão 1 r3 está na tabela "Achados do Portão 1 r3 (r4)" com Task e teste. A renumeração condicional é a Task 17, a última; as Tasks 15 e 16 não criam migration.
