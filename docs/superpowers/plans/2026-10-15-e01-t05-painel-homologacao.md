# E01-T05 — Painel de alterações e homologação de regras — Plano de Implementação (fatia E2E, rito AD-22)

> Para workers agênticos: papel `worker` (AGENTS.md "Papéis"). Worktree
> `F:\Projetos\AlphaCarnes\.worktrees\e01-t05`, branch `feature/erp-e01-t05-painel-homologacao`,
> já posicionada sobre a ponta da E01-T04 (ainda fora da `develop`). Não rebase em `develop`, não faça
> checkout da branch da T01, da T02, da T03 nem da T04, não cherry-pick para elas, não dê `git push` e não abra PR.
> Estado do git é lido por comando no momento do uso; este plano não afirma HEAD, contagem de commits
> nem SHAs (AD-22 (4)).

## Histórico de revisões

| Rev. | Data | Autor | Motivo |
|---|---|---|---|
| r1 | 2026-10-15 | planner | versão inicial da fatia E01-T05 |
| r2 | 2026-10-15 | planner | Portão 1 r1 pediu ajuste no commit `f056b2e`: literais do hero e da toolbar, botão da ficha, asserção das colunas e da tag `0048`, handler do BFF e um só literal de cenário |

**Goal:** homologar a publicação de uma versão de regra que a T03 já sabe submeter e aprovar — revisar o diff,
aprovar ou rejeitar, publicar e auditar — exigindo ao menos um cenário de regressão já calculado na T04, na
página `/fiscal/homologacao` (DS v3, grupo Fiscal já existente) → BFF `/api/erp/fiscal` → NestJS → PostgreSQL
→ evento pós-commit. A situação da regra não muda. Nenhum documento fiscal nasce aqui.

**Architecture:** módulo Nest `HomologacoesRegrasModule` em `app/backend/src/modules/erp/fiscal/homologacoes/`
(Caderno B L100), ao lado de `RegrasTributariasModule` e `SimulacoesFiscaisModule`. Não os substitui e não
edita o service, o schema nem a migration deles. Schema Drizzle novo `fiscal-homologacoes.schema.ts`: uma
homologação por versão `APROVADA` e os cenários que apontam para `simulacoes_fiscais` já gravadas. O diff
com origem chama `RegrasTributariasService.comparar`, já exportado. `AuditoriaService.registrar` na mesma
transação. `EventEmitter2.emit` só depois do commit. Página App Router
`app/frontend/src/app/(admin)/fiscal/homologacao/page.tsx`.

**Tech Stack (constituição L60):** NestJS 11 + TypeScript 5 strict, Next.js 16 App Router, PostgreSQL 18 +
Drizzle ORM 0.45 / drizzle-kit 0.31, Zod 4, WebSocket `ws`, JWT + RBAC 11 perfis, Jest, Playwright. Nenhuma
dependência nova.

**Classe de risco: ALTO** (AD-22 (6)): (1) permissão nova e item de menu — "RBAC/autorização"; (2) a decisão
publica uma alteração de regra tributária — "fiscal". Rito completo: revisão crítica por commit, Portão 2 e
Portão A. CI dos oito jobs, push e PR ficam fora desta fatia.

**Spec:** Caderno B §E01-T05 (`docs/expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md` L92–L100); matrizes
`docs/prototipos/erp-integrado-v1/MATRIZ-UX-COMPONENTES-61-TELAS.md` L131–L152 e
`MATRIZ-INTEGRAL-INTERFACES.md` L55–L61; protótipo `docs/prototipos/erp-integrado-v1/index.html#E01-T05`
(o HTML só carrega `catalogo.js`, `componentes.js` e `aplicacao.js`).

---

## 0. Escopo da fatia

Entra:

- Painel que abre uma revisão sobre uma versão de regra `APROVADA` (a T03 já submeteu e aprovou essa versão).
- Revisar o diff contra a versão de origem, quando houver. Aprovar ou rejeitar essa revisão. Publicar.
  A auditoria da publicação nasce na mesma transação.
- Cenário de regressão obrigatório para publicar: vínculo com uma memória `CALCULADA` da T04 cuja `regra_id`
  é essa versão. Esta fatia não recalcula tributo.
- Aprovador diferente de quem submeteu a regra: uma pessoa, `exigirSegregacao`, código `SEGREGACAO_FUNCAO`.
  Sem quórum numérico (`H-E01-11`).
- Página nova no grupo Fiscal, BFF, Jest, Playwright e screenshots descritos nas Tasks 10 e 11.
- Permissões novas só no `administrador`, com selo Provisório `H-E01-12`. Persona não é perfil (AD-18 (5)).

Sai, com dono:

- Recriar empresa, estabelecimento, regime, operação, enquadramento, CFOP, NCM, benefício, classificação,
  editor de regra ou simulador. Essas tabelas, módulos e rotas permanecem como a T01–T04 os deixaram.
  Não há `POST` de regra, de enquadramento nem de simulação nesta fatia. Não se edita
  `fiscal-regras.schema.ts`, `fiscal-simulacoes.schema.ts`, `fiscal-enquadramentos.schema.ts` nem
  `fiscal-empresas.schema.ts`.
- Chamar de novo `POST /fiscal/regras/:id/aprovar` ou mudar `regras_tributarias.situacao`. Aprovar no painel
  é a decisão da homologação, não uma segunda aprovação da regra.
- NF-e, SEFAZ, XML, DANFE, chave, protocolo e nota emitida → E02 (Caderno B L103–L153). Não criar tabela de
  nota e não acrescentar coluna nem FK em `notas_fiscais` nem em `notas_fiscais_fornecedor`.
- Colunas `data_comercial`, `data_fiscal` e `data_efetiva` (`H-E01-10`).
- Quórum numérico, segundo aprovador obrigatório e permissão fora do `administrador` (`H-E01-11`, `H-E01-12`).
- A palavra "Marca" como rótulo, entidade, coluna ou texto de busca (Princípio IX).

## 1. Global Constraints

- Constituição: Princípios I (L9), II (L20), III (L24), IV (L28), VI (L36), VII (L40), VIII (L44), IX (L48),
  X (L52); stack fixa (L60); sem over-engineering (L61); cobertura backend ≥ 80% linha e branch (L63).
- AGENTS.md: pwsh 7, nunca bash; worker não edita `docs/execucao/`; esta fatia não integra em `develop`.
- AD-04 (L11, 11 perfis); AD-10 (L17, DS v3); AD-12 (L19, Zod é 400); AD-13 (L20, código de negócio
  imutável; a palavra "Marca" continua banida); AD-15 (L22, 39 rotas operacionais); AD-18 (L25 (2) protótipo
  integral e (5) personas não viram perfis); AD-22 (L29); AD-24 (L31, grupo Fiscal já entregue — não recriar).
- `docs/data/convencoes-schema.md` L14–L16: uuidv7, TIMESTAMPTZ, status TEXT+CHECK, soft delete, índice em
  toda FK. `p_red_bc` e `p_icms` continuam na regra como `NUMERIC(5,4)` em razão (`0.0500` = 5%). Esta fatia
  não grava percentual e não altera a escala. Nunca `double precision` e nunca `float` no TypeScript.
  `updated_at` pelo serviço, sem trigger e sem SQL manual (padrão das migrations 0044–0047).
- UI nunca exibe UUID, PK, código E##/ALP nem nome de tabela (MATRIZ-UX L152). A rota da UI não contém
  `/E\d{2}-T\d{2}/`. A palavra "Marca" não aparece. O cliente visível, se algum texto de regra o exigir no
  diff, não é desta tela: o diff usa os rótulos já devolvidos por `comparar`.
- Zod 4: não chamar `.omit()` nem `.pick()` em schema nenhum desta fatia. Schema com `.refine()` ou
  `.superRefine()` não aceita `.omit()`. Cada corpo é um `z.object(...).strict()` próprio, montado com
  peças sem refine (`justificativaSchema` já é `z.string().trim().min(3).max(500)`).
- Erro de domínio é 422 e conflito é 409, os dois com `{ message, codigo }` via `regraViolada` e `conflito`
  (`fiscal-comum.ts` L23–L29). Não criar outra família de erro.
- Evento só depois de `db.transaction` resolver. 409 e 422 não emitem.
- `Button` do DS não tem variante `outline`. Cancelar e Verificar dados usam `variant="secondary"`.
  Rejeitar usa `destructive`, que existe. Não usar `outline` nem `destructiveOutline`.
- A Task 2 cria `page.tsx` mínimo (`getMe`, `redirect('/login')`, a frase de permissão e o título) porque
  `menu-v2.test.ts` L140 exige o arquivo. A Task 9 substitui o miolo e conserva essa frase.
- A próxima migration desta branch é `0048`. O diretório termina em `0047_e01_t04_simulacoes_fiscais.sql`
  e o journal tem a tag `0047_e01_t04_simulacoes_fiscais`. A E09-T01, noutra branch ainda não mergeada,
  também usou o prefixo `0048`. Esta fatia não pula para `0049` e não renumerá a outra branch. A colisão
  fica para o merge futuro: quem integrar por último renumerá o próprio arquivo. Se o `drizzle-kit` gerar
  outro prefixo, parar (seção 17).
- Playwright futuro sobe o Next com `npx next dev --webpack --port 3100` (já em
  `app/frontend/playwright.config.ts`). Nunca Turbopack e nunca a porta 4000. Banco dedicado
  `alphacarnes_e01_t05` em `localhost:15433`. Não subir o container `alphacarnes-backend-1`.
- Não editar `app/frontend/e2e/shell-ds.spec.ts`. O grupo Fiscal já existe; só entra o item novo.
- `H-E01-10` continua só início e fim de vigência da regra (colunas já existentes). A tela mostra essas
  duas datas em leitura. Não são coluna nova da homologação.

## Review Focus

Cinco entradas que a spec deixa fáceis de errar, e o teste que as prende:

1. O mesmo administrador que submeteu a regra, com `FISCAL_HOMOLOGACOES_APROVAR`, decide a homologação —
   o esperado é 422 `SEGREGACAO_FUNCAO`, corpo `{ message, codigo }`, `regras_tributarias.situacao` continua
   `APROVADA`, zero eventos. Um segundo administrador, que não submeteu, recebe 200. Não se exige uma
   terceira pessoa (Task 5, `e01-t05-homologacoes` · "autor da regra não homologa").
2. Publicar sem cenário — o esperado é 422 `CENARIO_REGRESSAO_AUSENTE`, situação permanece "Aprovada" e
   não há evento. Uma memória `CALCULADA` dessa versão permite 200 "Publicada". Memória de outra versão
   responde 422 `CENARIO_REGRA_DIVERGENTE` e não grava vínculo (Task 6, `e01-t05-homologacoes` ·
   "publicar sem cenário não publica"; "cenário de outra regra não vincula").
3. Publicar uma homologação válida — o esperado é nenhuma linha nova em `notas_fiscais` nem em
   `notas_fiscais_fornecedor`, `regras_tributarias.situacao` e `updated_at` iguais aos de antes, e
   `information_schema.columns` de `homologacoes_regras` sem `data_comercial`, `data_fiscal` e
   `data_efetiva`. `p_red_bc` e `p_icms` continuam `numeric(5,4)` (Task 1, `e01-t05-migrations`; Task 6).
4. Corpo com `descricao` numérica, `dataComercial` ou `regraId` omitido por derivação — o esperado é 400
   e zero linhas. O fonte dos DTOs não contém `.omit(` nem `.pick(` (Task 3, `fiscal-homologacoes-dto`).
5. A ficha e o drawer — o esperado é os rótulos literais da seção 4, botões sem `outline`, e o texto
   visível sem UUID, sem `E01-T05` e sem `Marca` (Task 9, `homologacoes-client` · "rótulos literais do protótipo").

---

## 2. Decisões fixadas (com fonte)

| # | Decisão | Fonte |
|---|---|---|
| D1 | A fatia grava a homologação de uma versão já `APROVADA`: abrir revisão, revisar diff, aprovar ou rejeitar, publicar e auditar. Não submete regra, não chama o aprovar da T03 e não emite documento | Pedido da fatia; Caderno B L94; catalogo.js L249; T03 D1 e T03 §18 |
| D2 | A homologação aponta para `regras_tributarias.id` com `situacao = 'APROVADA'` e `deleted_at` nulo. Regra ausente → 404 "Regra tributária não encontrada". Outra situação → 422 `REGRA_NAO_APROVADA`, mensagem "A homologação exige uma versão de regra já aprovada." Não se cria regra | Pedido da fatia ("a T03 já sabe submeter e aprovar"); `fiscal-regras.schema.ts` L12 e L95 |
| D3 | O combo "Enquadramento fiscal" lista versões `APROVADA`. O texto visível é `{codigo do enquadramento} · versão {numeroVersao}`. O corpo manda `regraId`, que não é rótulo. O source `regrasFiscais` não é um segundo cadastro | componentes.js L310–L320; MATRIZ-UX L143. O rótulo não vira "Regra" nem "Identificador" |
| D4 | "Usuário" é o nome de quem submeteu a regra (`submetido_por_id`). "Responsável pela aprovação" é o nome de quem aprovou a homologação, ou vazio enquanto ninguém aprovou. Quem rejeitou não ocupa esse campo. Os dois são leitura. O corpo não traz `usuarioId` nem `aprovadorId` | componentes.js L515–L536; Caderno B L95 "aprovador diferente do autor"; `regras.service.ts` L150 (`autor.nome`) |
| D5 | "Descrição" é texto da homologação, trim 3–500, o mesmo teto de `justificativaSchema`. O dicionário não fixa outro teto. "Início de vigência" e "Fim de vigência" são as datas da regra, desabilitadas. Fim nulo aparece como "Sem fim de vigência". Não entram no `POST` | componentes.js L154–L176 e L539–L548; `regras.service.ts` L188; `enquadramentos/dto/comum.dto.ts` L4 |
| D6 | "Justificativa auditável" é trim 3–500 em abrir, vincular, aprovar, rejeitar e publicar. O `saveForm` recusa justificativa vazia mesmo com `required: false` | componentes.js L418–L422; aplicacao.js L451; MATRIZ-UX L133 e L150 |
| D7 | Situação da homologação: `EM_REVISAO` "Em revisão", `APROVADA` "Aprovada", `REJEITADA` "Rejeitada", `PUBLICADA` "Publicada". O filtro é esse conjunto mais "Todos". Os seis `stateTypes` de aplicacao.js L8 não entram | Caderno B L94; componentes.js L178–L188 e L3295–L3297. "Publicada" é o particípio de "publicar", no mesmo molde de "Aprovada" |
| D8 | Aprovar e rejeitar só saem de `EM_REVISAO`. Publicar só sai de `APROVADA` da homologação e exige ao menos um cenário. Vincular cenário é permitido em `EM_REVISAO` e `APROVADA`. Fora disso → 409 `TRANSICAO_INVALIDA`, mensagem "Ação não permitida na situação atual." Não há `DELETE` | Caderno B L94–L95; `fiscal-comum.ts` L39–L40 |
| D9 | O aprovador, o rejeitador e quem publica são uma pessoa diferente de `regras_tributarias.submetido_por_id`. Reusar `exigirSegregacao` (`fiscal-comum.ts` L77–L84). Código `SEGREGACAO_FUNCAO`. Mensagem já existente: "A aprovação deve ser feita por usuário diferente de quem submeteu." Quem aprovou a regra na T03 pode homologar, se não for quem submeteu. Não há terceira pessoa nem coluna de quórum. `DUPLA_APROVACAO` continua `atendida: false`, `provisorio: true`, selo `H-E01-11` | Caderno B L95; pedido da fatia; H-E01-11; T03 D10 |
| D10 | Publicar não altera `regras_tributarias` (situação, `updated_at`, percentuais) e não insere simulação nem nota. O simulador continua lendo versão `APROVADA` | Pedido da fatia (não recriar o editor nem o simulador); T04 D11 |
| D11 | Cenário é uma linha que aponta a homologação e uma `simulacoes_fiscais` `CALCULADA` com o mesmo `regra_id`. Outra regra ou simulação removida → 422 `CENARIO_REGRA_DIVERGENTE`, mensagem "O cenário de regressão precisa ser uma memória calculada desta versão da regra." Zero cenários na publicação → 422 `CENARIO_REGRESSAO_AUSENTE`, mensagem "A publicação exige ao menos um cenário de regressão." Não se recalcula ICMS e não se exige valor esperado | Caderno B L95 "cenários de regressão obrigatórios"; catalogo.js L248 "cenários aprovados"; `fiscal-simulacoes.schema.ts` L37 e L62. Quantidade acima de um não está na fonte (seção 18) |
| D12 | Diff com `origem_versao_id`: `RegrasTributariasService.comparar(origemId, regraId)`. Sem origem: `numeroVersaoAntes: null` e cada diferença com `antes: null`. A UI deixa a célula vazia. Não se cunha frase para a ausência. Não se edita `regras.service.ts` | Caderno B L94 "revisar diff"; `regras.service.ts` L172–L197 |
| D13 | "Publicar e auditar" é um comando. O `POST` publica e `AuditoriaService.registrar` grava na mesma transação. Não há `POST /auditar`. A leitura da trilha é o histórico | catalogo.js L249 (o `split(',')` de aplicacao.js L40 produz três comandos, e o terceiro permanece "publicar e auditar"); Princípio IV |
| D14 | Permissões novas `FISCAL_HOMOLOGACOES_LER`, `FISCAL_HOMOLOGACOES_GERENCIAR` e `FISCAL_HOMOLOGACOES_APROVAR`, só no `administrador`, fora de `LEITURA_CADASTROS`. Persona "contador e auditor" não vira perfil. Selo `H-E01-12`. As permissões `FISCAL_EMPRESAS_*`, `FISCAL_ENQUADRAMENTOS_*`, `FISCAL_REGRAS_*` e `FISCAL_SIMULACOES_*` não mudam de perfil | AD-04 L11; AD-18 L25 (5); catalogo.js L247; H-E01-12; pedido da fatia |
| D15 | Zod → 400 (AD-12 L19). Regra de domínio → 422. Estado, unicidade e versão otimista → 409. Sem permissão → 403. 5xx sem SQL e sem stack. Não há estado `pending` nem `reconcile`: esta fatia não chama SEFAZ nem banco. Os dois erros de negócio usam `{ message, codigo }` | AD-12 L19; Caderno B L96; `fiscal-comum.ts` L23–L29; pedido da fatia |
| D16 | `codigo` numérico da homologação, gerado no backend, imutável, único entre não removidos. A coluna `versao` é o lock otimista, distinta do `numero_versao` da regra. UUID não é rótulo | Caderno B L93 "código de negócio"; AD-13 L20 |
| D17 | Já existe homologação não removida da mesma regra em `EM_REVISAO`, `APROVADA` ou `PUBLICADA` → 409 `HOMOLOGACAO_ABERTA`, mensagem "Já existe homologação em aberto ou publicada para esta versão." Uma `REJEITADA` não impede outra revisão da mesma versão | Caderno B L95 "histórico de versões"; D7 |
| D18 | Menu: o grupo `FISCAL` permanece na 8ª posição. Quinto item "Painel de alterações e homologação de regras" (catalogo.js L241), href `/fiscal/homologacao`, `permissao: 'FISCAL_HOMOLOGACOES_LER'`, `iconKey: 'ClipboardCheck'` (já em `ICON_MAP`, `app-sidebar.tsx` L95). A rota do catálogo `/erp/fiscal/e01-t05` (catalogo.js L246) não entra na UI. 39 rotas operacionais intactas. `MENUS_ERP` passa a 5. Total 44. Atribuições `130 + 1 = 131` | catalogo.js L240–L246; AD-15 L22; AD-24 L31 (1); `menus-canonicos.ts` L48; `menu-rbac.test.ts` L74 |
| D19 | API Nest sob `/fiscal/homologacoes`. BFF sob `/api/erp/fiscal/homologacoes`. O diff não ganha BFF de regra. Não há BFF novo de cadastro | Caderno B L100 |
| D20 | Room WS `fiscal-homologacoes` exige `FISCAL_HOMOLOGACOES_LER`. As rooms `fiscal-empresas`, `fiscal-enquadramentos`, `fiscal-regras` e `fiscal-simulacoes` não mudam. Evento só depois do commit. 409 e 422 não emitem. O payload não leva percentual, XML, chave nem id de nota | Princípio VI; Caderno B L96 |
| D21 | "Atualização normativa em meio à operação" é o título da aba Exceções. O protótipo não traz código de erro para essa frase. Não há coluna de NT, não há 422 com esse nome e publicar não consulta operação comercial. Selo não novo: a pendência fica na seção 18, sem id cunhado | catalogo.js L251; MATRIZ-UX L138; aplicacao.js L201. O predicado não está na fonte |
| D22 | "Hoje" não é coluna. Vigências lidas da regra continuam `date` em `YYYY-MM-DD`, modo string. A grade mostra essa string, como a grade de enquadramentos | componentes.js L154–L176; T03 D23; `enquadramentos-client.tsx` L280 |
| D23 | Concorrência: `versao` otimista e `SELECT … FOR NO KEY UPDATE` da homologação. Duas decisões simultâneas: uma 200 e a outra 409 `CONFLITO_CONCORRENTE`. O código novo usa `pg_advisory_xact_lock(hashtext('homologacoes_regras.codigo'))` | MATRIZ-UX L136 "conflito concorrente"; padrão T03 D24 |
| D24 | Zod 4 nesta fatia: quatro objetos `strict` separados (`criarHomologacaoSchema`, `corpoDecisaoSchema`, `vincularCenarioSchema`, `listarHomologacoesSchema`). Nenhum `.omit()`, nenhum `.pick()` e nenhum `.extend()`. O par `versao` + `justificativa` é um objeto plano reusado por espalhamento, não um schema derivado. `corpoDecisaoSchema` serve a aprovar, rejeitar e publicar | Pedido da fatia; Zod 4; `comum.dto.ts` L4–L9 |
| D25 | A Task 2 grava o `page.tsx` mínimo. A Task 9 troca o `h1` pelo cliente e mantém `getMe`, o redirect e a frase "Você não tem permissão para visualizar o painel de alterações e homologação de regras." | `menu-v2.test.ts` L140–L145; `(admin)/fiscal/simulador/page.tsx` L5–L13; pedido da fatia |

## 3. Conflitos de fonte resolvidos

| # | Conflito | Resolução |
|---|---|---|
| C1 | Caderno B L93 e catalogo.js L248 ("identificador regra, autor, motivo, legislação, cenários aprovados, vigência") × dicionário e MATRIZ-UX L143–L150 | Os rótulos visíveis são os da seção 4, copiados do dicionário. "Usuário" mostra o autor da submissão (D4). "Descrição" guarda o motivo da revisão (D5). Vigência é o par início/fim da regra. O bloco da ficha usa o literal "cenários aprovados", os mesmos caracteres de catalogo.js L248, e lista os vínculos (D11). `aplicacao.js` L235 imprime `sc.fields` com `escapeHtml` e não chama `titleCase` (L14 só capitaliza ação e exceção). Não se escreve "Cenários aprovados". "Legislação" não tem rótulo no dicionário nem coluna na regra: não se cria campo (seção 18) |
| C2 | Caderno B L95 "separar datas comercial/fiscal/efetiva" × matriz só início e fim | D5 e H-E01-10. A homologação não tem coluna de data de vigência. Selo Provisório junto das duas datas da regra |
| C3 | Caderno B L96 "validação 422" × AD-12 (Zod é 400) | D15 |
| C4 | DoD genérico "dupla aprovação quando exigida" e o silêncio sobre o número do quórum × "aprovador diferente do autor" | D9. Uma pessoa, `SEGREGACAO_FUNCAO`. H-E01-11 segue aberto |
| C5 | catalogo.js L247 persona "contador e auditor" × 11 perfis | D14 e H-E01-12. O subtítulo não imprime a persona como perfil |
| C6 | Rota do catálogo `/erp/fiscal/e01-t05` (catalogo.js L246) × proibição de código na UI | D18 `/fiscal/homologacao` |
| C7 | componentes.js L3305 `requiresReason: false` × aplicacao.js L451, que recusa justificativa vazia, e MATRIZ-UX L133 | D6. Toda mutação exige justificativa 3–500 |
| C8 | catalogo.js L249 "publicar e auditar" como um só token depois da vírgula × quatro verbos no pedido da fatia | D13. Três botões, os de D28 na seção 4. Auditar é a trilha da publicação, não um quarto POST |
| C9 | aplicacao.js L201 completa uma exceção solitária com três frases genéricas × Caderno B L96, que só nomeia "atualização normativa em meio à operação" | A aba fica com essa única exceção (D21). As três frases injetadas saem, no mesmo corte da T02 |
| C10 | Caderno B L96 "pending/reconcile" e "serviço externo indisponível" × ausência de SEFAZ nesta fatia | D15. O estado de tela é a falha do próprio backend, com "Tentar novamente". Sem coluna de pendência externa |
| C11 | Aprovar no painel × `POST /fiscal/regras/:id/aprovar` já entregue na T03 | D1 e D10. A situação da regra permanece `APROVADA`. O painel não reescreve o editor |
| C12 | "cenários de regressão" × simulador da T04 | D11. O cenário aponta uma memória existente. Não há segundo cálculo e não se edita `simulacoes.service.ts` |
| C13 | Filtro genérico "empresa/período/estado" do Caderno B L93 × `filters: ["status"]` (componentes.js L3295) | O único filtro de combo é "Situação". A busca da lista permanece (aplicacao.js L170). Empresa entra só na trilha |

## 4. Referência do protótipo e fidelidade

`index.html` não contém markup da tela. O hash `#E01-T05` é resolvido por `aplicacao.js`. Fonte visual: DS v3
(AD-10) + esse contrato. Rótulo abreviado reprova o Portão 1.

| Elemento | Fonte (arquivo:linha) | Implementação real |
|---|---|---|
| Metadados | catalogo.js L240–L252; aplicacao.js L356 | título "Painel de alterações e homologação de regras". O subtítulo visível começa em minúscula, o valor de `sc.actions` (catalogo.js L249): "revisar diff, aprovar/rejeitar, publicar e auditar". L356 concatena um ponto e o texto "Acesso típico: ". O selo é `BadgeProvisorio codigo="H-E01-12"`. A persona "contador e auditor" (catalogo.js L247) não é impressa como perfil |
| Hero | aplicacao.js L356 | "Exportar"; "+ Novo registro" (`data-action="new"`, só `podeGerenciar`; L388 abre o drawer); "Ações do processo ▾" |
| Toolbar da grade | aplicacao.js L170 | busca, filtro de situação e o botão "Exportar visão". "Exportar" do hero e "Exportar visão" baixam o mesmo CSV da seção 7 |
| Campos | componentes.js L3243–L3260 e o dicionário | os oito rótulos abaixo. Empresa não é campo da ficha; entra só na trilha |
| Grid | componentes.js L3262–L3278; MATRIZ-UX L134 | Enquadramento fiscal · Início de vigência · Situação · Usuário · Responsável pela aprovação · Descrição. Ordenação default Enquadramento fiscal. 20 por página, server-side. Sem coluna técnica |
| Filtros | componentes.js L3295–L3297; MATRIZ-UX L135 | Situação. A busca da lista permanece (placeholder "Pesquisar descrição ou referência de negócio") |
| Ações | catalogo.js L249; aplicacao.js L14 e L40–L43 | "Revisar diff", "Aprovar/rejeitar", "Publicar e auditar" (`titleCase` só na primeira letra de cada token separado por vírgula) |
| Primária do spec | componentes.js L3304 | `actions.primary` é "Cadastrar / revisar". Essa string não é botão do hero nem da toolbar: `renderScreen` não a pinta. Quem abre o drawer é "+ Novo registro" (aplicacao.js L356 e L388) |
| Sete abas | aplicacao.js L7 | Ficha e campos, Movimentações, Regras e validações, Exceções, Histórico, Integrações, Aceite e testes |
| Ficha | aplicacao.js L179–L192 | seções "Dados principais" e "Segurança, auditoria e aprovação". Trilha: Empresa (`empresas.razao_social` via enquadramento da regra), Situação, Responsável (nome de `atualizado_por_id`). Ambiente fica de fora. De L191 entram "Validar pré-condições" e "Consultar histórico". "Editar versão" está na lista de remoções desta seção |
| Drawer | aplicacao.js L427–L438 e L451 | "Cancelar", "Verificar dados", "Salvar rascunho" (sai só a palavra ilustrativo). O clique grava `EM_REVISAO`. Não há situação rascunho (D7). Justificativa 3–500. O rótulo do campo é "Justificativa auditável", porque a ficha inclui a chave (componentes.js L3258). O fallback "Motivo da alteração" de aplicacao.js L436 não se aplica |
| Exceções | catalogo.js L251; aplicacao.js L201 | um bloco: "Atualização normativa em meio à operação". As três frases injetadas não entram (C9) |
| Cenários | catalogo.js L248; aplicacao.js L221 e L235 | bloco cujo texto visível é exatamente "cenários aprovados". L235 faz `escapeHtml(sc.fields)` e não aplica `titleCase`. O botão do bloco usa esse literal, sem abreviar para "cenários" e sem capitalizar a inicial. Lista código e versão da memória e o rótulo da competência já definido na T04 ("Outubro de 2026"). Sem UUID |

Rótulos literais, copiados do dicionário. Não abreviar.

| Chave | Rótulo | Linha |
|---|---|---|
| regraFiscal | Enquadramento fiscal | componentes.js L311–L313 |
| usuario | Usuário | L515–L517 |
| aprovador | Responsável pela aprovação | L527–L529 |
| descricao | Descrição | L539–L541 |
| vigenciaInicio | Início de vigência | L155–L157 |
| vigenciaFim | Fim de vigência | L167–L169 |
| status | Situação | L179–L181 |
| justificativa | Justificativa auditável | L419–L421 |

O diff reusa os rótulos já emitidos por `comparar` (`regras.service.ts` L178–L189), sem reescrever o mapa:
"Tratamento ICMS", "Redução de base do ICMS (%)", "Alíquota (%)", "Benefício fiscal", "Tratamento IPI",
"Tratamento PIS/COFINS", "Tratamento IBS/CBS", "Classificação IBS/CBS", "Início de vigência", "Fim de vigência".
A linha é `{campo}: {antes} → {depois}`, como `comparar-dialog.tsx` L36. `antes` nulo não renderiza texto.

Células do grid, sem UUID:

- Enquadramento fiscal = `enquadramentos_fiscais.codigo`.
- Início de vigência = `regras_tributarias.vigencia_inicio` (`YYYY-MM-DD`).
- Situação = rótulo de D7.
- Usuário = `usuarios.nome` de quem submeteu a regra.
- Responsável pela aprovação = `usuarios.nome` de `aprovado_por_id` da homologação, ou célula vazia.
- Descrição = `homologacoes_regras.descricao`.

Código da homologação, número da versão da regra, código da regra, responsável, criação e alteração ficam
na ficha (Caderno B L93), com os rótulos já usados na ficha da T03: "Código", "Versão", "Criado em",
"Alterado em". "Versão" é `regras_tributarias.numero_versao`. O lock `versao` não aparece.

Remoções autorizadas (Princípio I.2(a)/(b)), conferidas no Portão 2: selo "DADOS FICTÍCIOS"; pill "Fixture de
teste"; rodapé "registros fictícios"; eyebrow com código de épico e "Caderno B §E01-T05"; KPI "Ambiente em
tela"; botões "Abrir ocorrência" e "Simular erro de validação"; as três exceções injetadas por aplicacao.js
L201 (C9); a palavra "ilustrativo" do botão, que permanece "Salvar rascunho"; "Cadastro demonstrativo em
memória"; o `<select>` de situação com os seis `stateTypes` de aplicacao.js L8; checkboxes da aba Aceite
(viram leitura); botão "Editar versão" (aplicacao.js L191, `data-action="edit"`). `actionMain` L388 manda
esse clique a `openDrawer(sc,'edit')` e `saveForm` L459 só altera a fixture em memória. A seção 7 não tem
`PATCH`; abrir a revisão é "+ Novo registro". Botões de Integrações para telas inexistentes (aplicacao.js L218)
desabilitados com `title="Destino ainda não disponível"`.

Ao escolher o enquadramento no drawer, o cliente chama o GET já existente `/api/erp/fiscal/regras/:id` e
preenche Usuário, Início de vigência e Fim de vigência em leitura. Se o operador não manda `regraId`, o
servidor responde 400. Regra que não está aprovada responde 422 `REGRA_NAO_APROVADA` (D2).

## 5. Modelo de dados (`app/backend/src/database/schema/fiscal-homologacoes.schema.ts`)

Não alterar `fiscal-regras.schema.ts`, `fiscal-simulacoes.schema.ts`, `fiscal-enquadramentos.schema.ts`,
`fiscal-empresas.schema.ts` nem as migrations 0000–0047.

```ts
export const SITUACOES_HOMOLOGACAO = ['EM_REVISAO', 'APROVADA', 'REJEITADA', 'PUBLICADA'] as const;

export const ROTULOS_SITUACAO_HOMOLOGACAO: Record<(typeof SITUACOES_HOMOLOGACAO)[number], string> = {
  EM_REVISAO: 'Em revisão',
  APROVADA: 'Aprovada',
  REJEITADA: 'Rejeitada',
  PUBLICADA: 'Publicada',
};
```

`homologacoes_regras`: `id` uuidv7; `codigo` varchar(20); `regra_id` uuid NOT NULL → `regras_tributarias.id`;
`descricao` text NOT NULL; `situacao` text NOT NULL default `EM_REVISAO`; `justificativa` text NOT NULL;
`aprovado_por_id` uuid NULL → `usuarios.id`; `aprovado_em` timestamptz NULL; `rejeitado_por_id` uuid NULL;
`rejeitado_em` timestamptz NULL; `publicado_por_id` uuid NULL; `publicado_em` timestamptz NULL; `versao`
integer NOT NULL default 1; `criado_por_id`; `atualizado_por_id`; `created_at`; `updated_at`; `deleted_at`.

Checks: código `^[1-9][0-9]{0,17}$`; situação no conjunto de D7; `versao >= 1`; `btrim(descricao) <> ''`;
`char_length(btrim(descricao)) BETWEEN 3 AND 500`; aprovada exige `aprovado_por_id` e `aprovado_em`;
rejeitada exige `rejeitado_por_id` e `rejeitado_em`; publicada exige `aprovado_por_id`, `aprovado_em`,
`publicado_por_id` e `publicado_em`; rejeitada não tem `aprovado_por_id`. Não há check de quórum. Não há
coluna de vigência, de percentual nem de data comercial, fiscal ou efetiva.

Índices: único `(codigo)` onde `deleted_at` é nulo; único `(regra_id)` onde `deleted_at` é nulo e situação
está em `('EM_REVISAO','APROVADA','PUBLICADA')` (D17); índice em `regra_id`, `situacao`, `criado_por_id`,
`atualizado_por_id`, `aprovado_por_id`, `rejeitado_por_id`, `publicado_por_id`.

`cenarios_regressao`: `id` uuidv7; `homologacao_id` uuid NOT NULL → `homologacoes_regras.id`;
`simulacao_id` uuid NOT NULL → `simulacoes_fiscais.id`; as colunas de auditoria do mesmo bloco. Check
`versao >= 1`. Único `(homologacao_id, simulacao_id)` onde `deleted_at` é nulo. Índice nas duas FKs e em
`criado_por_id` e `atualizado_por_id`. Sem coluna de aprovação própria do cenário (isso seria um segundo
quórum).

`schema/index.ts` ganha `export * from './fiscal-homologacoes.schema';`.

Migration `0048_e01_t05_homologacoes_regras.sql` + `meta/0048_snapshot.json` + entrada no `_journal.json`
com tag `0048_e01_t05_homologacoes_regras`. Sem `CREATE TYPE`. Sem trigger. Sem `INSERT` de fixture.

## 6. Máquinas de estado e regras de serviço

Transições (`homologacao-transicao.ts` puro, sem I/O):

| Ação | De | Permissão | Efeito |
|---|---|---|---|
| abrir revisão | — | GERENCIAR | `EM_REVISAO`, `codigo` novo, `regra_id` da versão aprovada |
| abrir revisão | já há aberta ou publicada da regra | — | 409 `HOMOLOGACAO_ABERTA` |
| vincular cenário | `EM_REVISAO` ou `APROVADA` | GERENCIAR | linha em `cenarios_regressao`; não muda a situação |
| aprovar | `EM_REVISAO` | APROVAR | `exigirSegregacao(submetido_por_id, usuario)`; `APROVADA`, `aprovado_por_id`, `aprovado_em` |
| rejeitar | `EM_REVISAO` | APROVAR | a mesma segregação; `REJEITADA`, `rejeitado_por_id`, `rejeitado_em`; `aprovado_por_id` continua nulo |
| publicar | `APROVADA` e ao menos um cenário | APROVAR | a mesma segregação; `PUBLICADA`, `publicado_por_id`, `publicado_em` |
| publicar | `APROVADA` e zero cenários | — | 422 `CENARIO_REGRESSAO_AUSENTE`; a linha não muda |
| qualquer ação fora da linha | — | — | 409 `TRANSICAO_INVALIDA` |

Quem tem as três permissões e é o autor da submissão recebe 422, não 403. O 403 é só a falta da permissão.

`AuditoriaService.registrar(tx, …)` na mesma transação: `modulo: 'fiscal.homologacoes'`, tabela física
`homologacoes_regras` (ou `cenarios_regressao` no vínculo), `dadosAnteriores`/`dadosNovos`, `justificativa`.
O histórico exposto não devolve o nome da tabela. `EventEmitter2.emit` só depois do `db.transaction` resolver.

```ts
const resultado = await this.db.transaction(async (tx) => {
  const gravado = await this.aplicar(tx, comando);
  await this.auditoria.registrar(tx, gravado.auditoria);
  return gravado;
});
this.eventos.emit(EVENTOS.HOMOLOGACAO_REGRA_ALTERADA, resultado.payload);
return resultado.corpo;
```

Código novo, só em abrir revisão:

```ts
await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('homologacoes_regras.codigo'))`);
const gerado = await tx.execute(sql`
  SELECT (COALESCE(MAX(codigo::bigint), 0) + 1)::text AS proximo FROM homologacoes_regras
`);
```

O laço de savepoint segue o de `enquadramentos.service.ts`, com savepoint `homologacao_codigo`.
Violação de `uq_homologacoes_regra_aberta` vira 409 `HOMOLOGACAO_ABERTA`.

Mensagens fechadas, além das já citadas:

- `CONFLITO_CONCORRENTE`: "O registro foi alterado por outro usuário. Recarregue para continuar." (`fiscal-comum.ts` L32–L36).
- `TRANSICAO_INVALIDA`: "Ação não permitida na situação atual."

Nenhuma dessas mensagens leva UUID, SQL nem nome de tabela.

## 7. Endpoints (`@Controller('fiscal/homologacoes')`, `JwtAuthGuard` + `RbacGuard`)

Rotas estáticas `contagens` e `exportacao` declaradas antes de `:id`.

| Verbo e caminho | Permissão | DTO (Zod, `.strict()`, sem `.omit()`) | Resposta |
|---|---|---|---|
| GET `/fiscal/homologacoes` | LER | {search?, situacao?, sort ∈ enquadramento·vigenciaInicio·usuario·aprovador·descricao, dir ∈ asc·desc, page, pageSize=20} | página com as seis células da seção 4. Sem UUID no objeto de célula |
| GET `/fiscal/homologacoes/contagens` | LER | mesmo filtro | {total, emRevisao, aprovadas, rejeitadas, publicadas} |
| GET `/fiscal/homologacoes/exportacao` | LER | mesmo filtro | `text/csv; charset=utf-8`, separador `;`, BOM, cabeçalho "Enquadramento fiscal;Início de vigência;Situação;Usuário;Responsável pela aprovação;Descrição" |
| GET `/fiscal/homologacoes/:id` | LER | uuid | detalhe com os rótulos de D3–D7, `codigo`, `numeroVersao` da regra, `codigoRegra`, `empresaNome`, situação no rótulo de D7, cenários `{ codigo, numeroVersao, competenciaRotulo }`. Ambiente não entra |
| GET `/fiscal/homologacoes/:id/diff` | LER | uuid | o retorno de D12. Sem escrita e sem evento |
| GET `/fiscal/homologacoes/:id/historico` | LER | uuid | {operacao, situacaoAnterior, situacaoNova, usuarioNome, criadoEm, justificativa, resumo, versao}. Sem nome de tabela e sem uuid |
| GET `/fiscal/homologacoes/:id/pre-condicoes` | LER | uuid | itens abaixo |
| POST `/fiscal/homologacoes` | GERENCIAR | {regraId, descricao, justificativa} | 201 |
| POST `/fiscal/homologacoes/:id/cenarios` | GERENCIAR | {simulacaoId, versao, justificativa} | 201 ou 422 |
| POST `/fiscal/homologacoes/:id/aprovar` | APROVAR | {versao, justificativa} | 200 ou 422 |
| POST `/fiscal/homologacoes/:id/rejeitar` | APROVAR | {versao, justificativa} | 200 ou 422 |
| POST `/fiscal/homologacoes/:id/publicar` | APROVAR | {versao, justificativa} | 200 ou 422 |

`.strict()` recusa `usuarioId`, `aprovadorId`, `vigenciaInicio`, `vigenciaFim`, `dataComercial`,
`dataFiscal`, `dataEfetiva`, `pRedBc`, `pIcms`, `notaId`, `xml`, `situacao`.

Pré-condições do detalhe (leitura, não bloqueiam o POST de abrir):

| codigo | atendida | provisoria |
|---|---|---|
| REGRA_APROVADA | a regra está `APROVADA` e não removida | false |
| AUTOR_IDENTIFICADO | `submetido_por_id` preenchido | false |
| CENARIO_REGRESSAO | ao menos um vínculo não removido | false |
| DATAS_COMERCIAL_FISCAL_EFETIVA | false | true (H-E01-10) |
| DUPLA_APROVACAO | false | true (H-E01-11) |
| PERFIS_ALEM_ADMINISTRADOR | false | true (H-E01-12) |

Texto de `DUPLA_APROVACAO`: "Um aprovador diferente de quem submeteu a regra registra a decisão. O quórum numérico permanece provisório."

`:id` inexistente → 404 "Homologação não encontrada". O JSON de escrita devolve `id` e `regraId` para o cliente recolocar a ficha. A tela não imprime nenhum dos dois.

## 8. Eventos pós-commit e tempo real

- `realtime/events/eventos.ts`: `HOMOLOGACAO_REGRA_ALTERADA: 'homologacao_regra_alterada'`.
  Payload `{ homologacaoId: string; regraId: string; codigo: string; acao: 'revisao_aberta'|'cenario_vinculado'|'aprovada'|'rejeitada'|'publicada'; situacao: string }`, registrado em `PayloadPorEvento`. Sem percentual, sem XML e sem id de nota.
- Emitir só depois de `db.transaction` resolver (seção 6).
- `room-permissoes.ts`: acrescentar `'fiscal-homologacoes': PERMISSOES.FISCAL_HOMOLOGACOES_LER`. Não alterar as quatro rooms fiscais já existentes.
- `realtime.gateway.ts`: novo `@OnEvent(EVENTOS.HOMOLOGACAO_REGRA_ALTERADA)` chama `broadcastRoom('fiscal-homologacoes', evento, payload)`.

## 9. RBAC, seed, parâmetro provisório e menu

`common/rbac/permissoes.ts`, depois do bloco `FISCAL_SIMULACOES_*`. Descrições:

- `FISCAL_HOMOLOGACOES_LER`: "Consultar o painel de alterações e homologação de regras".
- `FISCAL_HOMOLOGACOES_GERENCIAR`: "Abrir revisão de regra aprovada e vincular cenário de regressão".
- `FISCAL_HOMOLOGACOES_APROVAR`: "Aprovar, rejeitar e publicar homologação de regra submetida por outro usuário".

```ts
// AD-04 / AD-18 (5) / H-E01-12. Persona contador e auditor não é perfil.
pushPermissoes(
  'administrador',
  'FISCAL_HOMOLOGACOES_LER',
  'FISCAL_HOMOLOGACOES_GERENCIAR',
  'FISCAL_HOMOLOGACOES_APROVAR',
);
```

Fora de `LEITURA_CADASTROS`. Não criar perfil. O módulo `Fiscal` de `perfis.service.ts` já usa o prefixo
`FISCAL_`. Não acrescentar módulo. O catálogo ordena por `Object.keys(DESCRICOES_PERMISSOES).sort()`.
O teste de `perfis-menus.e2e-spec.ts` passa a esperar treze permissões, nesta ordem:

1. `FISCAL_EMPRESAS_APROVAR`
2. `FISCAL_EMPRESAS_GERENCIAR`
3. `FISCAL_EMPRESAS_LER`
4. `FISCAL_ENQUADRAMENTOS_GERENCIAR`
5. `FISCAL_ENQUADRAMENTOS_LER`
6. `FISCAL_HOMOLOGACOES_APROVAR`
7. `FISCAL_HOMOLOGACOES_GERENCIAR`
8. `FISCAL_HOMOLOGACOES_LER`
9. `FISCAL_REGRAS_APROVAR`
10. `FISCAL_REGRAS_GERENCIAR`
11. `FISCAL_REGRAS_LER`
12. `FISCAL_SIMULACOES_GERENCIAR`
13. `FISCAL_SIMULACOES_LER`

O teste "catalogo de permissoes cobre todo o mapa de descricoes" continua sem afrouxar.
`MENUS_OPERACIONAIS` continua 39. `MENUS_CANONICOS` e `res.body.menus` passam a 44.

Parâmetro novo em `seed.ts` `PARAMETROS_SEED`, sem alterar os parâmetros fiscais já existentes:

```ts
{
  chave: 'fiscal.homologacoes_perfis_autorizados',
  descricao: 'Perfis com acesso ao painel de alterações e homologação de regras',
  valorJson: {
    grupo: 'Fiscal',
    tipo: 'info',
    titulo: 'Perfis do painel de alterações e homologação de regras',
    texto: 'Somente administrador até decisão sobre os demais perfis.',
    valor: ['administrador'],
    provisorio: true,
    pendencia: 'H-E01-12',
  },
}
```

A tela lê o BFF já existente `/api/admin/parametros/chave/[chave]` e mostra `BadgeProvisorio` enquanto
`provisorio === true`.

Menu — `MENUS_ERP` ganha `'/fiscal/homologacao'` no fim. `perfil.dto.ts` já usa `.max(MENUS_CANONICOS.length)`
— não hardcodar 44. Snapshots regenerados por `npx tsx scripts/gerar-snapshot-perfis.ts`; só a chave
`administrador` ganha a rota e as três permissões.

Frontend `lib/menu-v2.ts`: quinto item do grupo `FISCAL`, sem criar grupo e sem mudar a posição 08.
`shell-ds.spec.ts` não é editado.

`page.tsx` mínimo desta task (a Task 9 substitui o miolo):

```tsx
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';

export default async function HomologacaoPage() {
  const user = await getMe();
  if (!user) redirect('/login');
  if (!user.permissoes.includes('FISCAL_HOMOLOGACOES_LER')) {
    return (
      <p className="text-sm text-destructive">
        Você não tem permissão para visualizar o painel de alterações e homologação de regras.
      </p>
    );
  }
  return <h1>Painel de alterações e homologação de regras</h1>;
}
```

Contagens, sem afrouxar:

- `menu-v2.test.ts`: `ITENS_ERP` ganha `['FISCAL', 'Painel de alterações e homologação de regras', '/fiscal/homologacao']`; total `toHaveLength(44)`; os 39 itens sem o grupo FISCAL continuam `toEqual(ITENS_PROTOTIPO)`. Caso novo: permissão só `FISCAL_EMPRESAS_LER` mostra empresas e esconde o painel. O teste de `page.tsx` (L140) passa porque o arquivo acima existe.
- `menu-rbac.test.ts`: `MATRIZ_ERP` ganha `'/fiscal/homologacao': ['administrador']`. Rotas sem `/fiscal/` continuam 39. Total de rotas 44. Atribuições `130 + 1 = 131`. `MATRIZ_ERP` soma 5. Atualizar o comentário da L74.
- `perfis-menus.e2e-spec.ts`: `MENUS_CANONICOS` e `res.body.menus` 44; catálogo Fiscal com as treze permissões.

## 10. Página e componentes DS v3

A Task 9 substitui o retorno do `page.tsx`. Permanecem `getMe()`, `redirect('/login')` e a frase da seção 9.
Com permissão: `<HomologacoesClient podeGerenciar podeAprovar />`.

Componentes em `components/fiscal/homologacoes/`: `homologacoes-client.tsx`, `homologacao-drawer.tsx`,
`diff-dialog.tsx`, `decisao-dialog.tsx`, `cenario-dialog.tsx`, `abas-detalhe.tsx`.
DS existente: `PageHeader`, `KpiStrip`/`Kpi`, `Table`, `Tabs`, `ComboboxField`, `Sheet`, `AlertDialog`,
`StatusPill`, `EmptyState`, `Skeleton`, `BadgeProvisorio`, `sonner`, `Button`. Sem hex avulso. Nenhum
`variant="outline"`.

- Hero: título "Painel de alterações e homologação de regras"; subtítulo "revisar diff, aprovar/rejeitar, publicar e auditar."
  e, em seguida, "Acesso típico" com o selo H-E01-12. A persona "contador e auditor" não aparece. Botões
  "Exportar" (a visão da grade), "+ Novo registro" (só `podeGerenciar`, abre o drawer) e "Ações do processo ▾"
  com os três comandos. Não há botão "Cadastrar / revisar".
- KPIs: "Em revisão", "Aprovadas", "Rejeitadas", "Publicadas".
- Lista: busca; filtro Situação; "Exportar visão"; grade da seção 4; clique ou Enter seleciona; paginação server-side; filtros
  e ordenação em `sessionStorage` na chave `fiscal.homologacoes.lista`; vazio com o texto de aplicacao.js
  L172 ("Nenhum resultado para o período, filtro ou situação escolhidos. Limpe os filtros ou cadastre um novo registro.").
- Ficha: os oito rótulos, Código, Versão, Criado em, Alterado em, bloco "cenários aprovados". Selo
  `H-E01-10` junto de Início de vigência e Fim de vigência. Trilha da seção 4. Botões "Validar pré-condições"
  e "Consultar histórico". Não há "Editar versão": a remoção da seção 4 cita aplicacao.js L191.
- Movimentações: trilha em leitura Preparação → Verificação → Autorização → Conclusão. Ações reais conforme
  D8 e a permissão. "Aprovar/rejeitar" abre `decisao-dialog` com os botões "Aprovar" e "Rejeitar" e o campo
  "Justificativa auditável". "Publicar e auditar" pede a mesma justificativa. "Revisar diff" abre o diálogo
  do diff. O 422 de segregação aparece no alerta; o botão não some.
- Regras e validações: o texto de catalogo.js L250 ("aprovador diferente do autor; cenários de regressão obrigatórios").
  O caminho de aprovação de aplicacao.js L198 fica com os três passos e `BadgeProvisorio codigo="H-E01-11"`.
  O passo 03 diz o texto de `DUPLA_APROVACAO` da seção 7.
- Exceções: o único título da seção 4. O texto explica que esta tela não bloqueia a publicação por atualização
  normativa, porque o protótipo não traz código de erro (D21).
- Histórico, Integrações e Aceite: o mesmo recorte da T04 §10, com os oito critérios em leitura e a frase de
  que checkbox não é aceite.
- Drawer: "Enquadramento fiscal", "Descrição", "Justificativa auditável" editáveis. Usuário, Início de
  vigência, Fim de vigência e Situação em leitura. "Responsável pela aprovação" vazio. "Cancelar" e
  "Verificar dados" com `variant="secondary"`. "Salvar rascunho" com a variante default. Erros por campo via
  `useErrosCampo` / `extrairErrosPorCampo` (AD-12). Sair com pendência pede confirmação.
- Diálogo do cenário: lista memórias `CALCULADA` da versão, texto `{codigo} · versão {numeroVersao} · {competenciaRotulo}`. O botão do bloco é "cenários aprovados", o literal de catalogo.js L248, sem capitalizar a inicial.
- Estados: inicial, carregando (skeleton), sem registros, validação inválida, sem acesso (página), conflito
  concorrente (409 `CONFLITO_CONCORRENTE`), serviço indisponível ("Tentar novamente"), revisão pendente
  (situação Em revisão, com o selo H-E01-11), concluído (toast "Homologação publicada.").
- Tempo real: `conectarRealtime({ rooms: ['fiscal-homologacoes'], onMessage, onReconnect })` refaz lista e detalhe. Sem polling.
- `lib/fiscal-homologacoes.ts`: os rótulos de D7 e o cliente HTTP do BFF. Não exportar função que calcule tributo.

## 11. Auditoria (Princípio IV)

Cada mutação chama `AuditoriaService.registrar` na mesma transação, com `usuarioId` e `justificativa`.
O histórico lê `auditoria` por `(tabela, registro_id)` da homologação e, no vínculo, também do cenário.
`resumo` em português, fechado: "Revisão aberta", "Cenário de regressão vinculado", "Alteração aprovada",
"Alteração rejeitada", "Alteração publicada". Nunca o nome da tabela nem UUID.

## 12. Estrutura de arquivos (ownership exclusivo)

Backend (`app/backend/`):

- Criar: `src/database/schema/fiscal-homologacoes.schema.ts`.
- Criar: `src/database/migrations/0048_e01_t05_homologacoes_regras.sql` e o meta `0048_snapshot.json`.
- Modificar: `src/database/migrations/meta/_journal.json` (uma entrada `0048_e01_t05_homologacoes_regras`).
- Modificar: `src/database/schema/index.ts` (um export).
- Criar: `src/modules/erp/fiscal/homologacoes/homologacoes-regras.module.ts`.
- Criar: `src/modules/erp/fiscal/homologacoes/homologacoes.controller.ts`.
- Criar: `src/modules/erp/fiscal/homologacoes/homologacoes.service.ts`.
- Criar: `src/modules/erp/fiscal/homologacoes/homologacao-transicao.ts`.
- Criar: `src/modules/erp/fiscal/homologacoes/dto/homologacao.dto.ts`.
- Modificar: `src/app.module.ts` (um import).
- Modificar: `src/common/rbac/permissoes.ts`, `menus-canonicos.ts`, os dois snapshots.
- Modificar: `src/database/seed.ts` (um parâmetro).
- Modificar: `src/realtime/events/eventos.ts`, `room-permissoes.ts`, `realtime.gateway.ts`.
- Modificar: `test/helpers/test-app.ts` (`cenarios_regressao` e `homologacoes_regras` antes de `simulacoes_fiscais` no `TRUNCATE`).
- Criar testes: `test/integration/e01-t05-migrations.e2e-spec.ts`, `test/unit/fiscal-homologacoes-dto.spec.ts`, `test/integration/e01-t05-homologacoes.e2e-spec.ts`, `test/unit/fiscal-homologacoes-ramos.spec.ts`.
- Modificar: `test/integration/perfis-menus.e2e-spec.ts` (44 menus e treze permissões).

Não modificar arquivos de `regras/`, `simulacoes/`, `enquadramentos/` nem `empresas/`, exceto o import do
módulo no `app.module.ts` e o `TRUNCATE`.

Frontend (`app/frontend/`):

- Criar: `src/app/(admin)/fiscal/homologacao/page.tsx` (mínimo na Task 2, miolo na Task 9).
- Criar: `src/components/fiscal/homologacoes/` (os seis arquivos da seção 10).
- Criar: `src/lib/fiscal-homologacoes.ts`.
- Criar BFF: `src/app/api/erp/fiscal/homologacoes/route.ts`, `contagens/route.ts`, `exportacao/route.ts`, `[id]/route.ts`, `[id]/diff/route.ts`, `[id]/[acao]/route.ts`.
- Modificar: `src/lib/menu-v2.ts`, `__tests__/menu-v2.test.ts`, `__tests__/menu-rbac.test.ts`.
- Criar testes: `__tests__/bff-e01-t05.test.ts`, `__tests__/homologacoes-client.test.tsx`, `__tests__/fiscal-homologacoes-lib.test.ts`.
- Criar: `e2e/e01-t05-homologacao.spec.ts`, `e2e/helpers/e01-t05-seed.ts`, `e2e/capture-e01-t05-evidencias.spec.ts`.
- Criar PNG: `docs/evidencias/e01-t05/`.

Não editar `e2e/shell-ds.spec.ts` nem `docs/execucao/**`.

## 13. Mapa DoD → teste

| DoD (Caderno B L97) | Teste que o prende |
|---|---|
| (1) consultar e agir | e01-t05-homologacoes · abrir, diff, aprovar, rejeitar, publicar, listar, detalhe |
| (2) campos e validação | fiscal-homologacoes-dto · "descrição numérica é 400", "strict rejeita dataComercial, vigenciaInicio e aprovadorId", "o fonte não usa omit nem pick" |
| (3) recarregar | e01-t05-homologacoes · "detalhe depois do publicar devolve Publicada e o cenário" |
| (4) autorização e dupla aprovação | e01-t05-homologacoes · "gestor → 403", "autor da regra não homologa", "segundo administrador aprova"; precondição `DUPLA_APROVACAO` provisória |
| (5) falha externa sintética | homologacoes-client · estado "Tentar novamente"; o serviço não chama `global.fetch` |
| (6) auditoria | e01-t05-homologacoes · "publicar grava Alteração publicada"; histórico sem nome de tabela |
| (7) Playwright e acesso | e01-t05-homologacao.spec.ts |
| (8) domínios adjacentes | e01-t05-homologacoes · "publicar não muda a regra nem grava nota"; menu · 39 rotas operacionais intactas |

## 14. Tasks

Cada task de código: teste, ver falhar, implementar, ver passar, commitar só os paths da task (`git add`
explícito). Não usar `git add -A`. Não commitar em outra branch. Não rebase. Não push.

Banco local, uma vez, antes da Task 1:

```powershell
docker compose up -d postgres
docker compose exec postgres psql -U alphacarnes -d alphacarnes -c "CREATE DATABASE alphacarnes_e01_t05"
$env:DATABASE_URL = 'postgres://alphacarnes:alphacarnes@localhost:15433/alphacarnes_e01_t05'
```

Não executar `docker compose up` do serviço `backend`. Saída esperada do `CREATE DATABASE`: `CREATE DATABASE`
ou "already exists".

### Task 0 — Leitura obrigatória (sem commit)

1. Ler: este plano §4–§7; `fiscal-regras.schema.ts`; `regras.service.ts` `comparar` (L172–L197); `fiscal-comum.ts` L22–L90; `permissoes.ts` no bloco `FISCAL_SIMULACOES_*`; `menus-canonicos.ts` L48; `menu-v2.ts` no grupo FISCAL; `menu-v2.test.ts` L140; `room-permissoes.ts`; `realtime.gateway.ts`; `eventos.ts`; `test-app.ts` `cleanupDb`; `(admin)/fiscal/simulador/page.tsx`; `enquadramentos/dto/comum.dto.ts`.
2. Se o Context7 estiver disponível (`resolve-library-id` + `get-library-docs`): Drizzle 0.45 "pgTable check uniqueIndex where"; NestJS 11 "ConflictException e UnprocessableEntityException com objeto"; Zod 4 "strict object, sem omit em schema com refine"; Next 16 route handlers. Registrar as APIs no relatório do PR (o PR não é desta sessão). A ausência do Context7 não autoriza pular a leitura do item 1.

### Task 1 — Schema, migration 0048 e testes de banco

**Files:** seção 5; `schema/index.ts`; `test/helpers/test-app.ts`; `test/integration/e01-t05-migrations.e2e-spec.ts`.

**Produces:** tabelas `homologacoes_regras` e `cenarios_regressao`. **Consumes:** `regras_tributarias.id` e `simulacoes_fiscais.id` já existentes.

Review Focus 3, a parte de colunas:

```ts
it('homologação não cria data comercial nem percentual', async () => {
  const cols = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'homologacoes_regras'
  `);
  const nomes = cols.rows.map((r) => r.column_name);
  expect(nomes).toEqual(expect.not.arrayContaining(['data_comercial', 'data_fiscal', 'data_efetiva', 'p_red_bc', 'p_icms']));
  const escala = await db.execute(sql`
    SELECT column_name, numeric_precision, numeric_scale
    FROM information_schema.columns
    WHERE table_name = 'regras_tributarias' AND column_name IN ('p_red_bc', 'p_icms')
  `);
  expect(escala.rows).toEqual(expect.arrayContaining([
    expect.objectContaining({ column_name: 'p_red_bc', numeric_precision: 5, numeric_scale: 4 }),
    expect.objectContaining({ column_name: 'p_icms', numeric_precision: 5, numeric_scale: 4 }),
  ]));
});

it('sem FK para nota', async () => {
  const fks = await db.execute(sql`
    SELECT confrelid::regclass::text AS destino
    FROM pg_constraint
    WHERE conrelid IN ('homologacoes_regras'::regclass, 'cenarios_regressao'::regclass)
      AND contype = 'f'
  `);
  const destinos = fks.rows.map((r) => r.destino);
  expect(destinos.join(' ')).not.toMatch(/notas_fiscais/);
});
```

No mesmo spec, com `readFileSync` de `node:fs` e `join` de `node:path`. O processo roda em `app/backend`:

```ts
it('a última tag do journal é 0048_e01_t05_homologacoes_regras', () => {
  const journal = JSON.parse(
    readFileSync(join(process.cwd(), 'src/database/migrations/meta/_journal.json'), 'utf8'),
  ) as { entries: Array<{ tag: string }> };
  expect(journal.entries.at(-1)?.tag).toBe('0048_e01_t05_homologacoes_regras');
});
```

```powershell
Set-Location app/backend
npx drizzle-kit generate
npx jest test/integration/e01-t05-migrations.e2e-spec.ts
```

Esperado: o arquivo gerado começa com `0048_`. Se o prefixo for outro, parar (seção 17). Não renomear para `0049`. PASS no Jest.

```powershell
git add app/backend/src/database/schema/fiscal-homologacoes.schema.ts app/backend/src/database/schema/index.ts app/backend/src/database/migrations/0048_e01_t05_homologacoes_regras.sql app/backend/src/database/migrations/meta/0048_snapshot.json app/backend/src/database/migrations/meta/_journal.json app/backend/test/helpers/test-app.ts app/backend/test/integration/e01-t05-migrations.e2e-spec.ts
git commit -m @"
feat(e01-t05): tabelas da homologação de regras

### Descrição Detalhada:
Cria homologacoes_regras e cenarios_regressao na migration 0048, sem data comercial, fiscal ou efetiva e sem mudar a escala do percentual da regra.

### Motivo da Mudança:
O painel precisa persistir a revisão e o cenário sem reabrir o editor nem o simulador.

### Impacto:
O truncate dos testes passa a limpar as duas tabelas antes das simulações. Nenhuma rota HTTP nova. A colisão de prefixo com a E09-T01 fica para o merge futuro.
"@
```

### Task 2 — Permissões, parâmetro, menu canônico, page mínimo e snapshots

**Files:** seção 9, inclusive o `page.tsx` mínimo.

```powershell
Set-Location app/backend
npx tsx scripts/gerar-snapshot-perfis.ts
git diff -U0 -- src/common/rbac/perfil-menus.snapshot.json src/common/rbac/perfil-permissoes.snapshot.json
git diff -U0 -- src/common/rbac/menus-canonicos.ts | Select-String "^-\s+'/"
npx jest test/unit/perfil-permissoes-snapshot.spec.ts test/integration/perfis-menus.e2e-spec.ts
npm run db:seed
```

Esperado: diffs dos snapshots só sob `administrador` (+ `/fiscal/homologacao`, + três permissões); `Select-String` sem saída (nenhuma rota removida); testes passam com 44 menus e treze permissões Fiscais; seed sem erro. No frontend, atualizar `menu-v2.ts`, `menu-v2.test.ts` e `menu-rbac.test.ts` para 44 itens, 131 atribuições e o quinto item do grupo. O `page.tsx` mínimo entra neste commit. Jest desses dois arquivos no `app/frontend`.

```powershell
git add app/backend/src/common/rbac/permissoes.ts app/backend/src/common/rbac/menus-canonicos.ts app/backend/src/common/rbac/perfil-permissoes.snapshot.json app/backend/src/common/rbac/perfil-menus.snapshot.json app/backend/src/database/seed.ts app/backend/test/integration/perfis-menus.e2e-spec.ts app/frontend/src/lib/menu-v2.ts app/frontend/__tests__/menu-v2.test.ts app/frontend/__tests__/menu-rbac.test.ts app/frontend/src/app/(admin)/fiscal/homologacao/page.tsx
git commit -m @"
feat(e01-t05): permissões FISCAL_HOMOLOGACOES_* e item no menu Fiscal

### Descrição Detalhada:
Entrega leitura, gestão e aprovação da homologação só ao administrador, o parâmetro provisório H-E01-12, o item do painel em /fiscal/homologacao e a página mínima que o teste do menu exige.

### Motivo da Mudança:
A persona do protótipo não pode virar um 12º perfil, e a tela nova precisa de permissão própria e de page.tsx para o menu passar.

### Impacto:
O catálogo Fiscal passa de dez para treze permissões. As 39 rotas operacionais e os quatro itens fiscais já existentes permanecem.
"@
```

### Task 3 — DTOs Zod

**Files:** `dto/homologacao.dto.ts`, `test/unit/fiscal-homologacoes-dto.spec.ts`.

**Consumes:** `justificativaSchema`, `versaoSchema`, `uuidSchema` de `enquadramentos/dto/comum.dto.ts`. **Produces:** `criarHomologacaoSchema`, `corpoDecisaoSchema`, `vincularCenarioSchema`, `listarHomologacoesSchema`.

```ts
export const descricaoSchema = z.string().trim().min(3).max(500);

const camposDecisao = {
  versao: versaoSchema,
  justificativa: justificativaSchema,
};

export const criarHomologacaoSchema = z.object({
  regraId: uuidSchema,
  descricao: descricaoSchema,
  justificativa: justificativaSchema,
}).strict();

export const corpoDecisaoSchema = z.object(camposDecisao).strict();

export const vincularCenarioSchema = z.object({
  ...camposDecisao,
  simulacaoId: uuidSchema,
}).strict();
```

`camposDecisao` é um objeto plano, não um schema. É proibido trocar isso por `.omit()`, `.pick()` ou `.extend()`. `listarHomologacoesSchema` é outro `z.object().strict()` com `situacao` opcional em `z.enum(SITUACOES_HOMOLOGACAO)`.

Review Focus 4:

```ts
it('descrição numérica é 400', () => {
  const parsed = criarHomologacaoSchema.safeParse({
    regraId: crypto.randomUUID(),
    descricao: 10,
    justificativa: 'Revisão da versão aprovada.',
  });
  expect(parsed.success).toBe(false);
});

it('strict rejeita dataComercial, vigenciaInicio e aprovadorId', () => {
  const parsed = criarHomologacaoSchema.safeParse({
    regraId: crypto.randomUUID(),
    descricao: 'Revisão da alíquota desta versão.',
    justificativa: 'Revisão da versão aprovada.',
    dataComercial: '2026-10-01',
    vigenciaInicio: '2026-10-01',
    aprovadorId: crypto.randomUUID(),
  });
  expect(parsed.success).toBe(false);
});

it('o fonte não usa omit nem pick', () => {
  const fonte = readFileSync(join('src/modules/erp/fiscal/homologacoes/dto/homologacao.dto.ts'), 'utf8');
  expect(fonte).not.toMatch(/\.omit\(/);
  expect(fonte).not.toMatch(/\.pick\(/);
});
```

Também falham: `descricao: 'ab'`, `descricao: '  ab  '`, `justificativa: 'ok'`, `situacao: 'RASCUNHO'` na lista.

```powershell
Set-Location app/backend
npx jest test/unit/fiscal-homologacoes-dto.spec.ts
```

Esperado: PASS.

```powershell
git add app/backend/src/modules/erp/fiscal/homologacoes/dto/homologacao.dto.ts app/backend/test/unit/fiscal-homologacoes-dto.spec.ts
git commit -m @"
feat(e01-t05): DTOs Zod da homologação de regras

### Descrição Detalhada:
Fecha os corpos de abrir, decidir e vincular com objetos strict separados, e o teste recusa data comercial, vigência e aprovador vindos do cliente.

### Motivo da Mudança:
Campo fora do contrato precisa falhar com 400, e o Zod 4 não aceita omit em schema refinado.

### Impacto:
O serviço da task seguinte recebe só regra, descrição, justificativa e, na decisão, a versão.
"@
```

### Task 4 — Abrir revisão, listar e diff

**Files:** `homologacoes.controller.ts`, `homologacoes.service.ts`, `homologacoes-regras.module.ts`, `app.module.ts`, `test/integration/e01-t05-homologacoes.e2e-spec.ts` (só esta parte; as tasks seguintes acrescentam casos no mesmo arquivo).

**Consumes:** DTOs da Task 3, `RegrasTributariasModule` (já exporta `RegrasTributariasService`). **Produces:** `abrir`, `listar`, `detalhar`, `diff`.

O módulo importa `RegrasTributariasModule` e injeta o service só para `comparar`. Não edita esse service.
O teste sobe o app, autentica dois administradores e deixa uma regra `APROVADA` pela API da T03 (o segundo
usuário aprova a regra). Não insere regra por SQL.

Casos deste commit: abrir com regra `APROVADA` → 201, situação "Em revisão", descrição gravada; regra
`SUBMETIDA` → 422 `REGRA_NAO_APROVADA` e zero linhas em `homologacoes_regras`; segunda abertura da mesma
versão → 409 `HOMOLOGACAO_ABERTA`; diff com origem devolve os rótulos de `comparar` e não grava auditoria;
diff sem origem devolve `numeroVersaoAntes: null` e `antes: null`; busca pelo uuid da linha devolve
`total: 0`; gestor → 403 no POST; quem só tem LER → 403 no POST.

```powershell
Set-Location app/backend
npx jest test/integration/e01-t05-homologacoes.e2e-spec.ts
```

Esperado: PASS.

```powershell
git add app/backend/src/modules/erp/fiscal/homologacoes/homologacoes.controller.ts app/backend/src/modules/erp/fiscal/homologacoes/homologacoes.service.ts app/backend/src/modules/erp/fiscal/homologacoes/homologacoes-regras.module.ts app/backend/src/app.module.ts app/backend/test/integration/e01-t05-homologacoes.e2e-spec.ts
git commit -m @"
feat(e01-t05): abrir revisão e revisar o diff da regra aprovada

### Descrição Detalhada:
Grava a homologação em revisão sobre uma versão já aprovada e devolve o diff pela comparação existente, sem alterar a regra.

### Motivo da Mudança:
O painel precisa localizar a alteração antes de decidir, e a T03 já sabe comparar duas versões do mesmo código.

### Impacto:
Regra que ainda não foi aprovada não ganha linha. O diff sem versão anterior deixa o valor anterior vazio.
"@
```

### Task 5 — Aprovar, rejeitar e a segregação

**Files:** `homologacao-transicao.ts`, o service, o mesmo e2e.

**Consumes:** `abrir` da Task 4, `exigirSegregacao`. **Produces:** `aprovar`, `rejeitar`.

Review Focus 1:

```ts
it('autor da regra não homologa', async () => {
  const aberta = await abrir(gestorDaRegra, corpo);
  const antes = await situacaoDaRegra(aberta.body.regraId);
  const res = await aprovar(gestorDaRegra, aberta.body.id, { versao: 1, justificativa: 'Decisão do autor da submissão.' });
  expect(res.status).toBe(422);
  expect(res.body).toEqual(expect.objectContaining({
    codigo: 'SEGREGACAO_FUNCAO',
    message: 'A aprovação deve ser feita por usuário diferente de quem submeteu.',
  }));
  expect(await situacaoDaRegra(aberta.body.regraId)).toBe(antes);
  expect(await contarEventos()).toBe(0);
});

it('segundo administrador aprova sem terceira pessoa', async () => {
  const aberta = await abrir(autor, corpo);
  const res = await aprovar(aprovadorDaRegra, aberta.body.id, { versao: 1, justificativa: 'Homologação conferida por outro usuário.' });
  expect(res.status).toBe(200);
  expect(res.body.situacao).toBe('Aprovada');
  const regra = await lerRegra(aberta.body.regraId);
  expect(regra.situacao).toBe('APROVADA');
});
```

`gestorDaRegra` aqui é o administrador que submeteu a regra na T03, não o perfil gestor. O perfil gestor
continua no caso 403. Também: rejeitar grava "Rejeitada" e deixa `aprovadoPor` nulo; aprovar de novo → 409
`TRANSICAO_INVALIDA` com `{ message, codigo }`; versão divergente → 409 `CONFLITO_CONCORRENTE` com a
mensagem de `fiscal-comum.ts` L35; quem só tem GERENCIAR → 403 no aprovar; `updated_at` da regra não muda.

```powershell
Set-Location app/backend
npx jest test/integration/e01-t05-homologacoes.e2e-spec.ts
```

Esperado: PASS.

```powershell
git add app/backend/src/modules/erp/fiscal/homologacoes/homologacao-transicao.ts app/backend/src/modules/erp/fiscal/homologacoes/homologacoes.service.ts app/backend/src/modules/erp/fiscal/homologacoes/homologacoes.controller.ts app/backend/test/integration/e01-t05-homologacoes.e2e-spec.ts
git commit -m @"
feat(e01-t05): aprovar ou rejeitar a homologação com segregação

### Descrição Detalhada:
Registra a decisão de uma pessoa diferente de quem submeteu a regra, sem mudar a situação da versão e sem exigir terceira pessoa.

### Motivo da Mudança:
O caderno pede aprovador diferente do autor, e o quórum numérico continua sem decisão.

### Impacto:
O autor com a permissão de aprovar recebe 422 SEGREGACAO_FUNCAO. A regra aprovada na T03 permanece aprovada.
"@
```

### Task 6 — Cenário obrigatório, publicar e auditoria

**Files:** service, controller, o mesmo e2e.

**Consumes:** homologação `APROVADA`, `POST` de simulação da T04. **Produces:** `vincularCenario`, `publicar`.

O teste cria a memória pela API da T04, com a regra `APROVADA` desta versão. Não insere simulação por SQL.

Review Focus 2 e 3:

```ts
it('publicar sem cenário não publica', async () => {
  const id = await homologacaoAprovada();
  const res = await publicar(aprovador, id, { versao: 2, justificativa: 'Publicação sem memória de regressão.' });
  expect(res.status).toBe(422);
  expect(res.body).toEqual(expect.objectContaining({
    codigo: 'CENARIO_REGRESSAO_AUSENTE',
    message: 'A publicação exige ao menos um cenário de regressão.',
  }));
  expect((await detalhar(aprovador, id)).body.situacao).toBe('Aprovada');
});

it('cenário de outra regra não vincula', async () => {
  const id = await homologacaoAprovada();
  const res = await vincular(aprovador, id, { simulacaoId: memoriaDeOutraVersao, versao: 2, justificativa: 'Memória de outra versão.' });
  expect(res.status).toBe(422);
  expect(res.body.codigo).toBe('CENARIO_REGRA_DIVERGENTE');
  const n = await db.execute(sql`SELECT COUNT(*)::int AS n FROM cenarios_regressao`);
  expect(n.rows[0]).toMatchObject({ n: 0 });
});

it('publicar não muda a regra nem grava nota', async () => {
  const antesNotas = await contarNotas();
  const antesRegra = await lerRegra(regraId);
  const res = await publicar(aprovador, id, { versao: 3, justificativa: 'Publicação com a memória desta versão.' });
  expect(res.status).toBe(200);
  expect(res.body.situacao).toBe('Publicada');
  expect(await contarNotas()).toEqual(antesNotas);
  const regra = await lerRegra(regraId);
  expect(regra.situacao).toBe(antesRegra.situacao);
  expect(regra.updatedAt).toEqual(antesRegra.updatedAt);
  const texto = JSON.stringify(res.body);
  expect(texto).not.toMatch(/xml|protocolo|danfe|"chave"/i);
});
```

Também: o histórico contém "Alteração publicada" e não contém `homologacoes_regras` nem uuid; publicar de
novo → 409; o serviço não chama `global.fetch`; cada publicação grava uma auditoria; o diff não grava
auditoria.

```powershell
Set-Location app/backend
npx jest test/integration/e01-t05-homologacoes.e2e-spec.ts
```

Esperado: PASS.

```powershell
git add app/backend/src/modules/erp/fiscal/homologacoes/homologacoes.service.ts app/backend/src/modules/erp/fiscal/homologacoes/homologacoes.controller.ts app/backend/test/integration/e01-t05-homologacoes.e2e-spec.ts
git commit -m @"
feat(e01-t05): publicar a homologação com cenário de regressão

### Descrição Detalhada:
Exige uma memória já calculada da mesma versão, publica a homologação e grava a auditoria na mesma transação, sem mexer na regra nem em nota.

### Motivo da Mudança:
O caderno torna o cenário de regressão obrigatório e pede a trilha da publicação.

### Impacto:
Sem cenário a situação permanece Aprovada. A memória de outra versão não vira vínculo.
"@
```

### Task 7 — Concorrência, eventos, histórico e pré-condições

**Files:** service, `eventos.ts`, `room-permissoes.ts`, `realtime.gateway.ts`, `test/unit/fiscal-homologacoes-ramos.spec.ts`, o e2e.

**Consumes:** as mutações das Tasks 4–6. **Produces:** evento `homologacao_regra_alterada` e os GET de histórico e pré-condições.

Dois `POST /aprovar` simultâneos com a mesma `versao`: um 200 e um 409 `CONFLITO_CONCORRENTE`. O 422 e o
409 não emitem. O 200 emite depois do commit, com `acao: 'aprovada'`. O payload não contém `p_icms` nem
`xml`. Pré-condição `DUPLA_APROVACAO` vem `atendida: false` e `provisoria: true`. `DATAS_COMERCIAL_FISCAL_EFETIVA`
idem. `CENARIO_REGRESSAO` fica `atendida: true` só depois do vínculo.

O teste de ramos lê `homologacoes.service.ts` e espera a chamada de `emit` depois do `await this.db.transaction`, nunca dentro do callback. Falha se esse arquivo importar `notas_fiscais`.

```powershell
Set-Location app/backend
npx jest test/unit/fiscal-homologacoes-ramos.spec.ts test/integration/e01-t05-homologacoes.e2e-spec.ts
```

Esperado: PASS.

```powershell
git add app/backend/src/modules/erp/fiscal/homologacoes app/backend/src/realtime/events/eventos.ts app/backend/src/realtime/room-permissoes.ts app/backend/src/realtime/realtime.gateway.ts app/backend/test/unit/fiscal-homologacoes-ramos.spec.ts app/backend/test/integration/e01-t05-homologacoes.e2e-spec.ts
git commit -m @"
feat(e01-t05): evento da homologação só depois do commit

### Descrição Detalhada:
Publica o evento na room fiscal-homologacoes depois da transação e cobre conflito de versão, histórico e pré-condições provisórias.

### Motivo da Mudança:
Falha de domínio não pode notificar a tela, e o quórum continua provisório.

### Impacto:
409 e 422 não emitem. As rooms fiscais já existentes não mudam de permissão.
"@
```

### Task 8 — BFF `/api/erp/fiscal/homologacoes`

**Files:** as rotas da seção 12 e `__tests__/bff-e01-t05.test.ts`. Molde de `app/frontend/src/app/api/erp/fiscal/regras/[id]/[acao]/route.ts`. O diff segue `regras/[id]/comparar/route.ts`, em arquivo próprio. A exportação segue `regras/exportacao/route.ts`: `repassar` fixa `Content-Type: application/json` (`lib/bff.ts` L20) e estragaria o CSV.

`src/app/api/erp/fiscal/homologacoes/route.ts`:

```ts
import type { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

export function GET(req: NextRequest) {
  return repassar(`/fiscal/homologacoes${req.nextUrl.search}`);
}

export async function POST(req: NextRequest) {
  return repassar('/fiscal/homologacoes', { method: 'POST', body: await req.text() });
}
```

`src/app/api/erp/fiscal/homologacoes/contagens/route.ts`:

```ts
import type { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

export function GET(req: NextRequest) {
  return repassar(`/fiscal/homologacoes/contagens${req.nextUrl.search}`);
}
```

`src/app/api/erp/fiscal/homologacoes/exportacao/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { apiFetch } from '@/lib/api';

export async function GET(req: NextRequest) {
  const resposta = await apiFetch(`/fiscal/homologacoes/exportacao${req.nextUrl.search}`, { method: 'GET' });
  const bytes = await resposta.arrayBuffer();
  const headers = new Headers();
  const tipo = resposta.headers.get('content-type');
  if (tipo) headers.set('Content-Type', tipo);
  const disposicao = resposta.headers.get('content-disposition');
  if (disposicao) headers.set('Content-Disposition', disposicao);
  return new NextResponse(bytes, { status: resposta.status, headers });
}
```

`src/app/api/erp/fiscal/homologacoes/[id]/route.ts`:

```ts
import type { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return repassar(`/fiscal/homologacoes/${encodeURIComponent(id)}`);
}
```

`src/app/api/erp/fiscal/homologacoes/[id]/diff/route.ts`:

```ts
import type { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return repassar(`/fiscal/homologacoes/${encodeURIComponent(id)}/diff`);
}
```

`src/app/api/erp/fiscal/homologacoes/[id]/[acao]/route.ts`. GET só `historico` e `pre-condicoes`. POST só `cenarios`, `aprovar`, `rejeitar` e `publicar`. Qualquer outra ação, inclusive `diff`, `submeter` e `auditar`, responde 404 e não chama o Nest:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

const POSTS = new Set(['cenarios', 'aprovar', 'rejeitar', 'publicar']);
const GETS = new Set(['historico', 'pre-condicoes']);

type Ctx = { params: Promise<{ id: string; acao: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id, acao } = await ctx.params;
  if (!GETS.has(acao)) return new NextResponse(null, { status: 404 });
  return repassar(`/fiscal/homologacoes/${encodeURIComponent(id)}/${acao}`);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id, acao } = await ctx.params;
  if (!POSTS.has(acao)) return new NextResponse(null, { status: 404 });
  return repassar(`/fiscal/homologacoes/${encodeURIComponent(id)}/${acao}`, {
    method: 'POST',
    body: await req.text(),
  });
}
```

`__tests__/bff-e01-t05.test.ts`:

```ts
/** @jest-environment node */

import type { NextRequest } from 'next/server';
import { apiFetch } from '@/lib/api';
import * as lista from '../src/app/api/erp/fiscal/homologacoes/route';
import * as contagens from '../src/app/api/erp/fiscal/homologacoes/contagens/route';
import * as exportacao from '../src/app/api/erp/fiscal/homologacoes/exportacao/route';
import * as detalhe from '../src/app/api/erp/fiscal/homologacoes/[id]/route';
import * as diff from '../src/app/api/erp/fiscal/homologacoes/[id]/diff/route';
import * as acao from '../src/app/api/erp/fiscal/homologacoes/[id]/[acao]/route';

jest.mock('@/lib/api', () => ({ apiFetch: jest.fn() }));

const apiFetchMock = jest.mocked(apiFetch);
const CORPO = JSON.stringify({ versao: 1, justificativa: 'Motivo da alteração' });

function req(url: string, corpo: string = CORPO): NextRequest {
  return {
    nextUrl: new URL(url),
    text: jest.fn().mockResolvedValue(corpo),
  } as unknown as NextRequest;
}

function ctx<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) };
}

function json(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async () => json(200, { ok: true }));
});

describe('BFF /api/erp/fiscal/homologacoes (E01-T05)', () => {
  it('repassa lista, detalhe, diff e mutações', async () => {
    await lista.GET(req('http://localhost/api/erp/fiscal/homologacoes?search=acem&page=2'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/homologacoes?search=acem&page=2', { method: 'GET' });

    await lista.POST(req('http://localhost/x'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/homologacoes', { method: 'POST', body: CORPO });

    await contagens.GET(req('http://localhost/x?situacao=EM_REVISAO'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/homologacoes/contagens?situacao=EM_REVISAO', { method: 'GET' });

    await detalhe.GET(req('http://localhost/x'), ctx({ id: 'h1' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/homologacoes/h1', { method: 'GET' });

    await diff.GET(req('http://localhost/x'), ctx({ id: 'h1' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/homologacoes/h1/diff', { method: 'GET' });
  });

  it('repassa 409 e 422', async () => {
    const aberto = {
      message: 'Já existe homologação em aberto ou publicada para esta versão.',
      codigo: 'HOMOLOGACAO_ABERTA',
    };
    apiFetchMock.mockImplementation(async () => json(409, aberto));
    const r409 = await lista.POST(req('http://localhost/x'));
    expect(r409.status).toBe(409);
    expect(await r409.json()).toEqual(aberto);

    const semCenario = {
      message: 'A publicação exige ao menos um cenário de regressão.',
      codigo: 'CENARIO_REGRESSAO_AUSENTE',
    };
    apiFetchMock.mockImplementation(async () => json(422, semCenario));
    const r422 = await acao.POST(req('http://localhost/x'), ctx({ id: 'h1', acao: 'publicar' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/homologacoes/h1/publicar', { method: 'POST', body: CORPO });
    expect(r422.status).toBe(422);
    expect(await r422.json()).toEqual(semCenario);
  });

  it('CSV mantém text/csv', async () => {
    const csv = '\uFEFFEnquadramento fiscal;Início de vigência;Situação;Usuário;Responsável pela aprovação;Descrição\r\n12;2026-01-01;Em revisão;Maria;;Revisão\r\n';
    apiFetchMock.mockImplementation(async () => new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="homologacoes.csv"',
      },
    }));
    const resposta = await exportacao.GET(req('http://localhost/x?situacao=EM_REVISAO'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/homologacoes/exportacao?situacao=EM_REVISAO', { method: 'GET' });
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(Buffer.from(await resposta.arrayBuffer()).toString('utf8')).toBe(csv);
  });

  it('ação fora da allowlist → 404 sem backend', async () => {
    for (const nome of ['cenarios', 'aprovar', 'rejeitar', 'publicar']) {
      await acao.POST(req('http://localhost/x'), ctx({ id: 'h1', acao: nome }));
      expect(apiFetchMock).toHaveBeenLastCalledWith(`/fiscal/homologacoes/h1/${nome}`, { method: 'POST', body: CORPO });
    }
    for (const nome of ['historico', 'pre-condicoes']) {
      await acao.GET(req('http://localhost/x'), ctx({ id: 'h1', acao: nome }));
      expect(apiFetchMock).toHaveBeenLastCalledWith(`/fiscal/homologacoes/h1/${nome}`, { method: 'GET' });
    }

    apiFetchMock.mockClear();
    const fora: Array<Promise<Response>> = [
      acao.POST(req('http://localhost/x'), ctx({ id: 'h1', acao: 'historico' })),
      acao.POST(req('http://localhost/x'), ctx({ id: 'h1', acao: 'submeter' })),
      acao.POST(req('http://localhost/x'), ctx({ id: 'h1', acao: 'auditar' })),
      acao.GET(req('http://localhost/x'), ctx({ id: 'h1', acao: 'aprovar' })),
      acao.GET(req('http://localhost/x'), ctx({ id: 'h1', acao: 'diff' })),
      acao.POST(req('http://localhost/x'), ctx({ id: 'h1', acao: 'diff' })),
    ];
    for (const resposta of await Promise.all(fora)) {
      expect(resposta.status).toBe(404);
    }
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
```

```powershell
Set-Location app/frontend
npx jest __tests__/bff-e01-t05.test.ts
```

Esperado: PASS.

```powershell
git add app/frontend/src/app/api/erp/fiscal/homologacoes app/frontend/__tests__/bff-e01-t05.test.ts
git commit -m @"
feat(e01-t05): BFF /api/erp/fiscal/homologacoes

### Descrição Detalhada:
Encaminha lista, detalhe, diff, cenário, decisão, publicação, CSV e histórico, com allowlist que barra submeter regra e emitir nota.

### Motivo da Mudança:
A página não conversa direto com o Nest; o BFF conserva o status 400, 403, 409 e 422.

### Impacto:
Ação fora da lista responde 404 sem chegar ao backend. O diff fica em rota própria.
"@
```

### Task 9 — Página, componentes e rótulos

**Files:** seção 10; `__tests__/homologacoes-client.test.tsx`; `__tests__/fiscal-homologacoes-lib.test.ts`.

Esta task substitui o `h1` do `page.tsx` pelo cliente. Não altera a frase de permissão nem o `redirect`.

O arquivo de teste importa `readFileSync` e `readdirSync` de `node:fs`, `join` de `node:path`, `render` e `screen` de `@testing-library/react` e `userEvent` de `@testing-library/user-event`.

Review Focus 5:

```tsx
const ID = '0199aabb-ccdd-7eee-8fff-001122334455';
const REGRA_ID = '0199bbcc-ddee-7fff-8000-112233445566';

const LINHA = {
  id: ID,
  enquadramento: '12',
  vigenciaInicio: '2026-01-01',
  situacao: 'Em revisão',
  usuario: 'Maria Souza',
  aprovador: '',
  descricao: 'Revisão da versão aprovada para publicação.',
};

const DETALHE = {
  id: ID,
  regraId: REGRA_ID,
  codigo: '81',
  numeroVersao: 1,
  enquadramento: '12',
  vigenciaInicio: '2026-01-01',
  vigenciaFim: '2026-12-31',
  situacao: 'Em revisão',
  usuario: 'Maria Souza',
  aprovador: '',
  descricao: 'Revisão da versão aprovada para publicação.',
  empresa: 'Alpha Carnes Ltda',
  criadoEm: '2026-10-15T12:00:00.000Z',
  atualizadoEm: '2026-10-15T12:00:00.000Z',
  cenarios: [{ codigo: '71', numeroVersao: 1, competenciaRotulo: 'Outubro de 2026' }],
};

beforeEach(() => {
  window.sessionStorage.clear();
  global.fetch = jest.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(entrada), 'http://localhost');
    const caminho = url.pathname;
    const metodo = init?.method ?? 'GET';
    const headers = { 'Content-Type': 'application/json' };
    if (metodo === 'GET' && caminho === `/api/erp/fiscal/homologacoes/${ID}`) {
      return new Response(JSON.stringify(DETALHE), { status: 200, headers });
    }
    if (metodo === 'GET' && caminho.startsWith('/api/erp/fiscal/homologacoes/contagens')) {
      return new Response(JSON.stringify({ total: 1, emRevisao: 1, aprovadas: 0, rejeitadas: 0, publicadas: 0 }), { status: 200, headers });
    }
    if (metodo === 'GET' && caminho.startsWith('/api/erp/fiscal/homologacoes') && !caminho.includes(ID)) {
      return new Response(JSON.stringify({ data: [LINHA], total: 1, page: 1, pageSize: 20 }), { status: 200, headers });
    }
    return new Response(JSON.stringify({ data: [] }), { status: 200, headers });
  }) as unknown as typeof fetch;
});

it('rótulos literais do protótipo', async () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  const { container } = render(<HomologacoesClient podeGerenciar podeAprovar />);
  expect(screen.getByRole('button', { name: 'Exportar' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '+ Novo registro' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ações do processo ▾' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Exportar visão' })).toBeInTheDocument();
  expect(screen.getByText(/revisar diff, aprovar\/rejeitar, publicar e auditar\./)).toBeInTheDocument();
  expect(screen.queryByText(/Revisar diff, aprovar\/rejeitar, publicar e auditar/)).not.toBeInTheDocument();
  expect(screen.getByText(/Acesso típico/)).toBeInTheDocument();
  expect(container.textContent ?? '').toContain('H-E01-12');
  expect(screen.queryByRole('button', { name: 'Cadastrar / revisar' })).not.toBeInTheDocument();
  expect(screen.queryByText('contador e auditor')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Editar versão' })).not.toBeInTheDocument();

  const celula = await screen.findByText('Revisão da versão aprovada para publicação.');
  celula.closest('tr')!.focus();
  await user.keyboard('{Enter}');
  expect(await screen.findByRole('button', { name: 'cenários aprovados' })).toBeInTheDocument();
  expect(screen.queryByText('Cenários aprovados')).not.toBeInTheDocument();
  expect(container.textContent ?? '').not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
  expect(container.textContent ?? '').not.toContain(ID);
  expect(container.textContent ?? '').not.toContain(REGRA_ID);

  await user.click(screen.getByRole('button', { name: '+ Novo registro' }));
  expect(screen.getByLabelText('Enquadramento fiscal')).toBeInTheDocument();
  expect(screen.getByLabelText('Descrição')).toBeInTheDocument();
  expect(screen.getByLabelText('Justificativa auditável')).toBeInTheDocument();
  expect(screen.getAllByText('Início de vigência').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Fim de vigência').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Usuário').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Responsável pela aprovação').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Situação').length).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Verificar dados' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeInTheDocument();
  const texto = container.textContent ?? '';
  expect(texto).not.toMatch(/E01-T05/);
  expect(texto).not.toMatch(/Marca/);
  expect(texto).not.toMatch(/identificador regra/i);
});

it('não usa a variante outline', () => {
  const pasta = join('src/components/fiscal/homologacoes');
  const fonte = readdirSync(pasta)
    .filter((nome) => nome.endsWith('.tsx'))
    .map((nome) => readFileSync(join(pasta, nome), 'utf8'))
    .join('\n');
  expect(fonte).not.toMatch(/outline/);
  expect(fonte).toMatch(/variant="secondary"/);
});
```

Cancelar e Verificar dados recebem `variant="secondary"`. Rejeitar recebe `variant="destructive"`.

O `it` acima já afirma o hero, a toolbar, o subtítulo em minúscula, "Acesso típico", o selo H-E01-12,
a ausência de "Cadastrar / revisar", da persona e de "Editar versão", o botão "cenários aprovados" e a
ausência de UUID no texto visível, com `id` e `regraId` presentes no JSON do mock. O mesmo arquivo também
cobre: lista vazia com a frase da seção 10; alerta do 422 `SEGREGACAO_FUNCAO`; alerta do 422
`CENARIO_REGRESSAO_AUSENTE`; alerta do 409 `CONFLITO_CONCORRENTE`; selos `H-E01-10` e `H-E01-11`; botões
"Revisar diff", "Aprovar/rejeitar" e "Publicar e auditar"; ausência de "Abrir ocorrência" e de "Simular erro de validação".

A lib não exporta função de cálculo. O fonte não contém `parseFloat` nem `Number(`.

```powershell
Set-Location app/frontend
npx jest __tests__/homologacoes-client.test.tsx __tests__/fiscal-homologacoes-lib.test.ts __tests__/menu-v2.test.ts
```

Esperado: PASS.

```powershell
git add app/frontend/src/app/(admin)/fiscal/homologacao/page.tsx app/frontend/src/components/fiscal/homologacoes app/frontend/src/lib/fiscal-homologacoes.ts app/frontend/__tests__/homologacoes-client.test.tsx app/frontend/__tests__/fiscal-homologacoes-lib.test.ts
git commit -m @"
feat(e01-t05): página do painel de homologação no grupo Fiscal

### Descrição Detalhada:
Substitui o miolo de /fiscal/homologacao pelos rótulos literais do protótipo, o diff, a decisão e os selos provisórios já abertos.

### Motivo da Mudança:
A tela precisa ser operável no DS v3 sem mostrar código de épico, UUID ou variante de botão que o DS não tem.

### Impacto:
O grupo Fiscal ganha o quinto item. A frase de permissão da página mínima permanece. Nenhuma rota operacional sai do menu.
"@
```

### Task 10 — Playwright: jornada, acesso e rótulos

**Files:** `e2e/helpers/e01-t05-seed.ts`, `e2e/e01-t05-homologacao.spec.ts`.

O seed cria, pela API: dois administradores; um estabelecimento aprovado pela API da T01; produto, cliente
e operação pelas APIs existentes; CFOP `5102` e NCM `02013000` pela API da T02; um enquadramento `ATIVA`
pela API da T02; benefício, classificação e uma regra `APROVADA` (o segundo administrador aprova a regra)
pela API da T03, com redução `41,67`, alíquota `12,00` e vigência `2026-01-01` a `2026-12-31`; uma
simulação `CALCULADA` dessa regra pela API da T04. Esses códigos são entrada do operador no teste, não
`INSERT` da migration.

Backend no host, não no container `alphacarnes-backend-1`:

```powershell
$env:DATABASE_URL = 'postgres://alphacarnes:alphacarnes@localhost:15433/alphacarnes_e01_t05'
$env:PORT = '4001'
Set-Location app/backend
npm run start
```

Frontend: o `webServer` de `playwright.config.ts` (`npx next dev --webpack --port 3100`). Não apontar
`E2E_FRONTEND_URL` para a porta 4000. Não usar Turbopack.

Jornada, com o segundo administrador (não é quem submeteu a regra):

1. Menu FISCAL → "Painel de alterações e homologação de regras". Os quatro itens anteriores do grupo continuam visíveis.
2. "+ Novo registro": Enquadramento fiscal da versão aprovada, Descrição "Revisão da versão aprovada para publicação.", Justificativa auditável "Abertura da revisão desta versão." O clique é no botão "Salvar rascunho" e grava Em revisão. Não há botão "Cadastrar / revisar".
3. "Revisar diff" mostra "Alíquota (%)" com o valor da regra. A ficha mostra Início de vigência, Fim de vigência, Usuário e os selos H-E01-10, H-E01-11 e H-E01-12.
4. O botão "cenários aprovados" vincula a memória do seed. "Aprovar/rejeitar" → "Aprovar", com justificativa "Decisão de usuário diferente de quem submeteu." A situação passa a Aprovada e Responsável pela aprovação mostra o nome do segundo administrador.
5. "Publicar e auditar" grava Publicada. O histórico mostra "Alteração publicada".
6. Repetir a publicação não cria outra linha e mostra o alerta de transição inválida.
7. Com o autor da submissão, "Aprovar" mostra "A aprovação deve ser feita por usuário diferente de quem submeteu."
8. Gestor: o item não aparece; `goto('/fiscal/homologacao')` mostra "Você não tem permissão para visualizar o painel de alterações e homologação de regras."

Acessibilidade, sem dependência nova: todo `textbox`, `combobox` e `button` visível tem nome acessível não
vazio; Tab até a linha e Enter seleciona; diálogos fecham com Escape e devolvem o foco; `innerText` do
`body` sem UUID (`/[0-9a-f]{8}-[0-9a-f]{4}-/i`), sem `/E\d{2}-T\d{2}/` e sem a palavra `Marca`.

```powershell
Set-Location app/frontend
npx playwright test e2e/e01-t05-homologacao.spec.ts
```

Esperado: todos passam. Playwright não é job do `ci.yml`.

```powershell
git add app/frontend/e2e/e01-t05-homologacao.spec.ts app/frontend/e2e/helpers/e01-t05-seed.ts
git commit -m @"
test(e01-t05): Playwright da jornada, acesso e rótulos

### Descrição Detalhada:
Cobre a revisão, o diff, a aprovação por outro usuário, a publicação com cenário e a ausência do item para quem não tem a permissão.

### Motivo da Mudança:
O aceite da fatia exige a tela no webpack da porta 3100, com os rótulos do protótipo e sem código de épico.

### Impacto:
O spec não altera shell-ds e não sobe o backend em container.
"@
```

### Task 11 — Screenshots comparativos

**File:** `e2e/capture-e01-t05-evidencias.spec.ts`, no padrão de `capture-e01-t04-evidencias.spec.ts`: elemento-chave antes de cada captura, fail-hard. Viewport 1280×800, `fullPage`.

Pares em `docs/evidencias/e01-t05/` (`app-<estado>.png` e `prototipo-<estado>.png`), protótipo em
`file:///<worktree>/docs/prototipos/erp-integrado-v1/index.html#E01-T05`:

1. lista
2. ficha
3. movimentacoes
4. regras
5. excecoes
6. historico
7. integracoes
8. aceite
9. drawer

Só app: `vazio`, `erro-retry`, `403`, `diff`, `segregacao`, `cenario-ausente`, `publicada`.

```powershell
Set-Location app/frontend
npx playwright test e2e/capture-e01-t05-evidencias.spec.ts
(Get-ChildItem ../../docs/evidencias/e01-t05 -Filter *.png).Count
```

Esperado: 25 arquivos (9 pares + 7).

```powershell
git add app/frontend/e2e/capture-e01-t05-evidencias.spec.ts docs/evidencias/e01-t05
git commit -m @"
test(e01-t05): evidências visuais do painel de homologação

### Descrição Detalhada:
Grava os pares da tela contra o protótipo e os estados só da aplicação: vazio, erro, acesso negado, diff, segregação, cenário ausente e publicação.

### Motivo da Mudança:
O Portão 2 precisa comparar a tela real com o hash E01-T05 sem emitir nota nem recriar a regra.

### Impacto:
São 25 PNG. Eles não substituem o Playwright da task anterior.
"@
```

### Task 12 — Gate local, sem push e sem PR

```powershell
npm ci
npm run lint
npm run type-check
npm run test
npm run build
Set-Location app/backend
npm run test:cov
Set-Location ../frontend
npm run test
Set-Location ../..
node scripts/check-coverage.mjs --min 80
git diff --name-only $(git merge-base HEAD origin/develop)..HEAD
git status -sb
```

Esperado: comandos verdes; cobertura ≥ 80% linha e branch; o diff contra `develop` contém a E01-T01 até a
E01-T04 já presentes na branch e os arquivos desta fatia; nenhum path fora da seção 12 foi modificado por
commit desta fatia (T01–T04 não são revertidas); `git status` limpo. Não executar `git push` nem
`gh pr create`. Não editar `docs/execucao/**`. Não editar `e2e/shell-ds.spec.ts`. Não rebase em `develop`.

## 15. Gate e evidências para o Portão 2/A

- Relatório no formato `pipeline-execucao.md` §7: task a task, saídas de teste e Playwright, cobertura, APIs do Context7 se usadas. O Executor registra a onda em `EXECUCAO-STATUS.md` ao disparar (AD-22 (5)); o Worker não edita esse arquivo.
- Portão 2 compara os pares `app-*`/`prototipo-*` (Task 11), confere as remoções da seção 4 e reexecuta Playwright e os testes de menu (39 operacionais + 5 do Fiscal).
- Portão A obrigatório (classe alto).
- CI dos oito jobs e o PR ficam para o fim do lote, fora deste plano.

## 16. Rollback

Seção "E01-T05" de `ROLLBACK.md`:

```sql
DROP TABLE IF EXISTS cenarios_regressao;
DROP TABLE IF EXISTS homologacoes_regras;
```

Não derrubar `simulacoes_fiscais`, `regras_tributarias`, `classificacoes_ibs_cbs`, `beneficios_fiscais`,
`enquadramentos_fiscais`, `cfops`, `ncms`, `estabelecimentos` nem `empresas`. Reverter o parâmetro
`fiscal.homologacoes_perfis_autorizados`, as três permissões e o item de menu no mesmo revert da fatia.
Os parâmetros `fiscal.simulacoes_perfis_autorizados`, `fiscal.regras_perfis_autorizados` e
`fiscal.enquadramentos_perfis_autorizados` ficam.

## 17. Critérios de parada (PARAR e reportar ao coordenador)

- `drizzle-kit` gerar migration com prefixo diferente de `0048`.
- Necessidade de pular para `0049` por causa da E09-T01. A colisão está registrada; não se renumerá nesta fatia.
- Necessidade de coluna `data_comercial`, `data_fiscal`, `data_efetiva`, tabela de nota, FK para nota, mudança de escala de `p_red_bc` ou `p_icms`, quórum numérico ou terceira pessoa para fazer um teste passar.
- Necessidade de editar `regras.service.ts`, `simulacoes.service.ts`, `shell-ds.spec.ts`, `docs/execucao/` ou schema da T01, da T02, da T03 ou da T04.
- Necessidade de `.omit()` ou `.pick()` para o DTO compilar.
- Fonte ausente, ambígua ou contraditória que este plano não tenha resolvido na seção 3.

## 18. Pendências e dependências (nenhuma decisão inventada)

| Id | O que falta decidir | Quem decide | O que não fazer até lá | O que esta fatia faz |
|---|---|---|---|---|
| H-E01-10 | Três datas comercial, fiscal e efetiva | Quality Owner | colunas extras de data na homologação ou na regra | mostra início e fim já gravados na regra; selo Provisório |
| H-E01-11 | Quantos aprovadores formam quórum | Quality Owner | exigir dois aprovadores, uma terceira pessoa ou coluna de quórum | uma pessoa diferente de quem submeteu, `SEGREGACAO_FUNCAO`; pré-condição provisória |
| H-E01-12 | Quais dos 11 perfis, além do administrador, recebem `FISCAL_HOMOLOGACOES_*` | Quality Owner | atribuir a outros perfis ou criar perfil contador/auditor | seed só administrador; parâmetro `provisorio: true`; edição em `/admin/perfis` |
| — | O que o resumo chama "legislação" | Quality Owner | criar coluna, rótulo ou cadastro de legislação | não há rótulo no dicionário nem coluna na regra; o diff mostra "Benefício fiscal" e "Classificação IBS/CBS", que já existem |
| — | O predicado de "atualização normativa em meio à operação" | Quality Owner | inventar 422, coluna de NT ou bloqueio por operação aberta | a aba nomeia a exceção e declara que não há bloqueio |
| — | Quantos cenários, além de um, e se a memória precisa bater com um valor esperado | Quality Owner | exigir dois cenários, recalcular ICMS ou gravar gabarito | publicar exige uma memória `CALCULADA` já gravada dessa versão; não há segundo cálculo |

E02 recebe NF-e, SEFAZ, XML e DANFE. A colisão do prefixo `0048` com a branch não mergeada da E09-T01 não é
decisão de produto: esta fatia usa `0048` e não pula número.

## 19. Self-review

- Cobertura do Caderno B L92–L100: campos em D3–D6 e na Task 9; ações em D1, D8, D12 e D13 e nas Tasks 4, 5 e 6; exceção em D21; DoD na seção 13. E02 está na seção 0 como fora.
- Lacunas: cada task traz o teste, o comando e a saída esperada. Nenhuma task delega o código a outra.
- Tipos: `criarHomologacaoSchema` e `vincularCenarioSchema` são `z.object` próprios. O par da decisão é o objeto plano `camposDecisao`, não um schema derivado. Situação do schema é só o conjunto de D7. `comparar` continua com a assinatura `(id, com)` da T03. O 201 devolve `id` e `regraId`; a tela não os imprime.
- Review Focus: as cinco entradas têm teste na Task 5 (1), na Task 6 (2 e 3), na Task 1 (3), na Task 3 (4) e na Task 9 (5).
- Rótulos conferidos em componentes.js L155, L167, L179, L311, L419, L515, L527 e L539, e nos dez rótulos de `regras.service.ts` L178–L189. Nenhum foi abreviado. Hero em aplicacao.js L356 ("Exportar", "+ Novo registro", "Ações do processo ▾"); toolbar em L170 ("Exportar visão"); subtítulo é `sc.actions` em minúscula (catalogo.js L249). "Cadastrar / revisar" (componentes.js L3304) não é botão. "Editar versão" (aplicacao.js L191) está nas remoções da seção 4. O bloco de cenário usa "cenários aprovados", o texto que L235 imprime sem `titleCase`.
- Placeholder: não há "TBD", "TODO", "a definir" nem tarefa que mande copiar outra task.
