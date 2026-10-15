# E09-T02 — Políticas de contabilização

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Histórico de revisões

| Rev. | Data | Autor | Motivo |
|---|---|---|---|
| r1 | 2026-10-15 | planner | versão inicial da fatia E09-T02 |

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
- Regras críticas só no NestJS. Zod do DTO recusa forma (HTTP 400 pelo `ZodValidationPipe`, que não muda). Regra de negócio recusa HTTP 422 e conflito recusa HTTP 409, os dois com corpo `{ message, codigo }`. `codigo` é o código de negócio da política, nunca um UUID.
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

Lote (`componentes.js` L5951) aceita `simular` ou `aprovar`, no máximo 20 códigos, numa transação só. A primeira falha desfaz o lote e devolve 422 ou 409 da primeira política, com o código de negócio no campo `codigo`.

### D5 — Fiscal, empresa, período e as três datas não existem nesta ponta

Não há tabela de período contábil nem de empresa em uso por esta fatia. E09-T08, E01 e o módulo fiscal são de outras fatias. O worker não cria essas tabelas, não declara FK para elas e não edita o módulo fiscal.

O widget `Enquadramento fiscal` permanece visível, desabilitado, com valor `—` e selo `Provisório`. Não há coluna, não há seed de `regrasFiscais` e o POST não envia o campo.

A ficha mostra o rótulo `Empresa` (`aplicacao.js` L190) com valor `—` e o selo `Provisório`. Não preencher `AlphaCarnes Matriz`. Não mostrar o seletor HML/PROD nem o texto `Ambiente`.

H-E01-10: o texto “separar datas comercial/fiscal/efetiva” do Caderno B L449 não vira coluna. As únicas datas de negócio são competência e início de vigência.

### D6 — Abas, estados e o que sai da casca de protótipo

Abas, nesta ordem (`aplicacao.js` L7): `Ficha e campos`, `Movimentações`, `Regras e validações`, `Exceções`, `Histórico`, `Integrações`, `Aceite e testes`.

- Ficha e campos: campos D2 da versão mais recente, `Versão` com o número e a trilha `Responsável` com o nome do usuário (`aplicacao.js` L190). Sem UUID e sem o código de negócio cru.
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

Competência na grade: mês por extenso em pt-BR com a primeira letra maiúscula e o ano, no formato do `fieldVal` de `aplicacao.js` L147 (`Outubro de 2026`). Início de vigência na grade: `dd/MM/yyyy`.

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

Run: o Jest do Step 2 mais `npx jest src/modules/contabilidade/politicas/politicas.service.spec.ts --runInBand`.

Expected: PASS.

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

export const loteSchema = z.object({
  acao: z.enum(['simular', 'aprovar']),
  codigos: z.array(codigo).min(1).max(20),
  justificativa: motivo,
  numeroPorCodigo: z.record(z.string(), z.number().int().positive()),
  valor: dinheiro.optional(),
});
```

`simular` trava a versão, exige situação `DRAFT` ou `APPROVED`, relê as duas contas e o centro, chama `balancear` com duas linhas do mesmo `dto.valor`, insere `politica_simulacoes` e audita. O `emit` de `POLITICA_SIMULADA` fica fora da transação. Não há `insert` em outra tabela.

`aprovar` trava a versão, exige `DRAFT`, exige `usuarioId !== versao.responsavelId` (senão 422 `aprovador diferente do autor`), exige uma `politica_simulacoes` não excluída daquele `politicaId` + `versaoNumero` (senão 422 `mapeamento ausente`), grava `APPROVED` e `aprovadorId`, audita, e só depois emite `POLITICA_APROVADA`. Não insere lançamento.

`validar` executa as checagens de conta, centro e origem e devolve `{ valido, mensagens }` sem `insert` nem `update`. `historico` lê `auditoria` das versões e devolve só `quando`, `quem`, `acontecimento`, `justificativa`. `lote` usa uma transação: a primeira falha desfaz o lote. `exportarCsv` responde `text/csv; charset=utf-8` com BOM `\uFEFF` e cabeçalho `Competência;Situação;Conta de débito;Conta de crédito;Centro de custo;Tipo de ocorrência`. Células são rótulos. Sem coluna de id.

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
  expect(res.body).toEqual({ message: 'mapeamento ausente', codigo: 'LIQUIDACAO-2026-10' });
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

Expected: PASS. Comercial recebe 403. O JSON do administrador não contém UUID. O 422 traz `message` e `codigo`.

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
import { PoliticasContabilizacaoClient } from '../src/app/(admin)/erp/contabilidade/politicas-de-contabilizacao/politicas-contabilizacao-client';

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
  expect(screen.getByText('Provisório')).toBeInTheDocument();
  expect(screen.getByText('Enquadramento fiscal')).toBeInTheDocument();
  const texto = document.body.textContent ?? '';
  expect(texto).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  expect(texto).not.toMatch(/Marca/);
  expect(texto).not.toMatch(/E09/);
  expect(texto).not.toMatch(/e09-t02/i);
  expect(texto).not.toMatch(/LIQUIDACAO/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/politicas-contabilizacao-apresentacao.test.ts --runInBand` em `app/frontend`.

Expected: FAIL com módulo ausente.

- [ ] **Step 3: Write minimal implementation**

`page.tsx` substitui o mínimo da Task 1. É server component que lê a primeira página em `/api/contabilidade/politicas` e renderiza `PoliticasContabilizacaoClient`. Sem cookie de sessão, o BFF já redireciona pelo fluxo `(admin)` existente.

O client implementa D2, D4 e D6. A chave `politicas-de-contabilizacao` só entra em `sessionStorage.getItem` / `setItem`.

```tsx
import { Button } from '@/components/ui/button';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';

const CHAVE_RASCUNHO = 'politicas-de-contabilizacao';
const ABAS = ['Ficha e campos', 'Movimentações', 'Regras e validações', 'Exceções', 'Histórico', 'Integrações', 'Aceite e testes'] as const;
const EXCECOES = ['Mapeamento ausente', 'Evento duplicado'];
const COLUNAS = ['Competência', 'Situação', 'Conta de débito', 'Conta de crédito', 'Centro de custo', 'Tipo de ocorrência'];

export function PoliticasContabilizacaoClient({ inicial, semAcesso = false }: { inicial: PoliticaApresentada[]; semAcesso?: boolean }) {
  if (semAcesso) return <p>Acesso não permitido</p>;
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
            {COLUNAS.map((rotulo) => (
              <th key={rotulo}><button type="button" aria-label={`Ordenar por ${rotulo}`}>{rotulo}</button></th>
            ))}
          </tr>
        </thead>
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

O snippet acima é o contrato dos rótulos que o teste enxerga. A implementação completa acrescenta, sem trocar esses textos:

- `Configurar mappings` e `+ Novo registro` abrem o drawer `Dados principais` e o POST vai para `/api/contabilidade/politicas`. O botão de confirmar o drawer repete `Configurar mappings`. Não usar `Salvar rascunho ilustrativo` nem `Criar`.
- `Editar versão` faz `POST /api/contabilidade/politicas/{codigo}/editar`.
- `Simular evento` abre o modal com `Valor` e `Justificativa / observação`. O valor pt-BR `10,10` sai no JSON como `"10.10"`. O POST é `.../simular`.
- `Aprovar regra` abre o modal só com `Justificativa / observação` e faz `POST .../aprovar`.
- `Ações do processo` abre o drawer com os três comandos e `Abrir decisão →`. Cada um dispara a mesma ação do botão de mesmo rótulo. Não fundir os três num botão só.
- Drawer: label `Justificativa auditável`. Não renderizar `Motivo da alteração`.
- `Verificar dados` chama `POST /api/contabilidade/politicas/validar`.
- Filtro `aria-label="Filtrar competência"` (`input type="month"`) e `aria-label="Filtrar situação"` com `Todos`, `Rascunho`, `Aguardando revisão`, `Aprovado`, `Rejeitado`, `Suspenso`.
- Busca `aria-label="Buscar registros da lista"`.
- Lookup `Pesquisar`. Lista vazia: toast `Nenhum cadastro disponível para seleção. Consulte a área responsável.`
- 403 mostra `Acesso não permitido`. 409 mostra `message` (`evento duplicado` ou `conflito concorrente`). 422 mostra `message` (`mapeamento ausente`, `origem imutável`, `balanceamento exato`, `aprovador diferente do autor`). Depois de aprovar, toast `concluído com evidência`.
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
6. **A mesma conta nos dois lados e o valor zero.** A fonte não proíbe débito e crédito na mesma conta, nem proíbe `0.00` quando as somas são iguais. O plano não acrescenta essas recusas. Um valor mínimo, ou a exigência de contas diferentes, seria decisão nova.

## Self-review

- Caderno B L448: configurar, simular e aprovar estão nas tasks 3, 4 e 6. Revisar competência não vira botão (D1).
- Caderno B L449: origem imutável está na Task 3; mapeamento ausente e balanceamento exato estão na Task 4; as três datas não viram coluna (D5).
- Caderno B L450: evento duplicado está na Task 3; mapeamento ausente está nas tasks 3 e 4. HTTP 422/409 usam `{ message, codigo }`.
- Matriz UX L949–L971: grade, filtros, abas e estados estão na Task 6. O estado de serviço externo não é fabricado (D6). `Enquadramento fiscal` fica visível e sem FK.
- Enum `tipoEvento` (`componentes.js` L2168–L2189) e enum `status` (L1688–L1708) estão no CHECK da Task 2 e nos rótulos da Task 6.
- Review Focus 1–5 têm teste nas tasks 3 e 4.
- `apresentar` da Task 3 é o contrato que as tasks 5 e 6 consomem, com os mesmos nomes de campo.
- Nenhum passo usa `.omit()` em schema com `.refine()`. Nenhum `Button` usa `outline`. A Task 1 cria o `page.tsx` mínimo. A migration citada é `0049` e a `0048` não é renumerada.
- Rótulos de botão estão inteiros: `Configurar mappings`, `Simular evento`, `Aprovar regra`. Não há forma abreviada.
