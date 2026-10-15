# E01-T03 — Editor de regras tributárias — Plano de Implementação (fatia E2E, rito AD-22)

> Para workers agênticos: papel `worker` (AGENTS.md "Papéis"). Worktree
> `F:\Projetos\AlphaCarnes\.worktrees\e01-t03`, branch `feature/erp-e01-t03-editor-regras-tributarias`,
> já posicionada sobre a ponta da E01-T02 (ainda fora da `develop`). Não rebase em `develop`, não faça
> checkout da branch da T01 nem da T02, não cherry-pick para elas, não dê `git push` e não abra PR.
> Estado do git é lido por comando no momento do uso; este plano não afirma HEAD, contagem de commits
> nem SHAs (AD-22 (4)).

## Histórico de revisões

| Rev. | Data | Autor | Motivo |
|---|---|---|---|
| r1 | 2026-10-15 | planner | versão inicial da fatia E01-T03 |

**Goal:** persistir a regra tributária versionada ligada ao enquadramento já gravado na T02 — Tratamento ICMS,
redução de base, alíquota, benefício fiscal, Tratamento IPI, Tratamento PIS/COFINS, Tratamento IBS/CBS,
classificação IBS/CBS, início e fim de vigência e justificativa — com rascunho, versão nova, comparação,
submissão, aprovação por outra pessoa e aposentadoria, na página `/fiscal/regras` (DS v3, grupo Fiscal já
existente) → BFF `/api/erp/fiscal` → NestJS → PostgreSQL → evento pós-commit.

**Architecture:** módulo Nest `RegrasTributariasModule` em `app/backend/src/modules/erp/fiscal/regras/`
(Caderno B L80), ao lado de `EnquadramentosFiscaisModule` e `EmpresasFiscaisModule` (não os substitui).
Schema Drizzle novo `fiscal-regras.schema.ts`. A regra guarda `enquadramento_id` e lê operação e CFOP desse
enquadramento. Catálogos manuais `beneficios_fiscais` e `classificacoes_ibs_cbs` nascem vazios. Serviço
transacional com auditoria na mesma transação e `EventEmitter2.emit` depois do commit. Versão `APROVADA` ou
`APOSENTADA` não é atualizada; a alteração nasce como versão nova. Página App Router
`app/frontend/src/app/(admin)/fiscal/regras/page.tsx`.

**Tech Stack (constituição L60):** NestJS 11 + TypeScript 5 strict, Next.js 16 App Router, PostgreSQL 18 +
Drizzle ORM 0.45 / drizzle-kit 0.31, Zod 4, WebSocket `ws`, JWT + RBAC 11 perfis, Jest, Playwright. Nenhuma
dependência nova.

**Classe de risco: ALTO** (AD-22 (6)): (1) permissão nova e item de menu — "RBAC/autorização"; (2) a regra
tributária é insumo de E01-T04 e da emissão futura — "fiscal". Rito completo: revisão crítica por commit,
Portão 2 e Portão A. CI dos oito jobs, push e PR ficam fora desta fatia.

**Spec:** Caderno B §E01-T03 (`docs/expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md` L72–L80); matrizes
`docs/prototipos/erp-integrado-v1/MATRIZ-UX-COMPONENTES-61-TELAS.md` L74–L101 e
`MATRIZ-INTEGRAL-INTERFACES.md` L39–L45; protótipo `docs/prototipos/erp-integrado-v1/index.html#E01-T03`
(o HTML só carrega `catalogo.js`, `componentes.js` e `aplicacao.js`).

---

## 0. Escopo da fatia

Entra:

- Regra tributária ligada a um enquadramento `ATIVA` já persistido na T02.
- Campos do contrato de tela: Enquadramento fiscal, Operação, Operação fiscal (CFOP), Tratamento ICMS,
  Redução de base do ICMS (%), Alíquota (%), Benefício fiscal, Tratamento IPI, Tratamento PIS/COFINS,
  Tratamento IBS/CBS, Classificação IBS/CBS, Início de vigência, Fim de vigência, Justificativa auditável.
- Ações: criar rascunho, adicionar versão, comparar, submeter, aprovar, aposentar.
- Catálogos manuais vazios de benefício fiscal e de classificação IBS/CBS (formato e unicidade).
- Um aprovador diferente de quem submeteu. Selo H-E01-11 permanece para o quórum numérico.
- Página nova no grupo Fiscal, BFF, Jest, Playwright e screenshots descritos nas Tasks 13 e 14.

Sai, com dono:

- Simulador, explicar tributos, memória de cálculo, exportar memória, lançamento fiscal, comparar versões
  de cálculo → E01-T04 (Caderno B L82–L90; MATRIZ-UX L103–L111; MATRIZ-INTEGRAL L47–L53).
- Painel de homologação, revisar diff de publicação, rejeitar, publicar, cenários de regressão, auditoria
  de publicação → E01-T05 (Caderno B L92–L100; MATRIZ-INTEGRAL L55–L61).
- NF-e, SEFAZ, XML, DANFE, nota emitida como domínio novo → E02 (Caderno B L103–L153). Não criar tabela de
  nota e não acrescentar coluna nem FK em `notas_fiscais`.
- Recriar empresa, estabelecimento, regime, CNAE, enquadramento, CFOP ou NCM. Essas tabelas e módulos
  permanecem como a T01 e a T02 os deixaram.

## 1. Global Constraints

- Constituição: Princípios I (L9), II (L20), III (L24), IV (L28), VI (L36), VII (L40), VIII (L44), IX (L48),
  X (L52); stack fixa (L60); sem over-engineering (L61); cobertura backend ≥ 80% linha e branch (L63).
- AGENTS.md: pwsh 7, nunca bash; worker não edita `docs/execucao/`; esta fatia não integra em `develop`.
- AD-04 (L11, 11 perfis); AD-10 (L17, DS v3); AD-12 (L19, Zod é 400); AD-13 (L20, código de negócio
  imutável; a palavra "Marca" continua banida); AD-15 (L22, 39 rotas operacionais); AD-18 (L25 (2) protótipo
  integral e (5) personas não viram perfis); AD-22 (L29); AD-24 (L31, grupo Fiscal e estabelecimento já
  entregues — não recriar).
- `docs/data/convencoes-schema.md`: uuidv7, TIMESTAMPTZ, status TEXT+CHECK, soft delete, índice em toda FK.
  Dinheiro e peso não entram. Percentual é `NUMERIC(6,3)`, nunca `double precision` e nunca `float` no
  TypeScript (convencoes-schema.md L60). `updated_at` pelo serviço, sem trigger e sem SQL manual (padrão
  das migrations 0044 e 0045).
- UI nunca exibe UUID, PK, código E##/ALP nem nome de tabela (MATRIZ-UX L101). A palavra "Marca" não
  aparece como rótulo, entidade ou texto de busca (Princípio IX). Não há campo de cliente nesta tela.
- A próxima migration é `0046`. O diretório `app/backend/src/database/migrations/` termina em
  `0045_e01_t02_enquadramentos.sql` e o journal tem a tag `0045_e01_t02_enquadramentos`. Se o `drizzle-kit`
  gerar outro prefixo, parar (seção 17).
- Playwright futuro sobe o Next com `npx next dev --webpack --port 3100` (já em
  `app/frontend/playwright.config.ts` L49). Nunca Turbopack e nunca a porta 4000. Banco dedicado
  `alphacarnes_e01_t03` em `localhost:15433`. Não subir o container `alphacarnes-backend-1`.
- Não editar `app/frontend/e2e/shell-ds.spec.ts`. O grupo Fiscal já existe; só entra o item novo.

## Review Focus

Cinco entradas que a spec deixa fáceis de errar, e o teste que as prende:

1. O mesmo administrador que submeteu, e que também tem `FISCAL_REGRAS_APROVAR`, aprova a própria versão —
   o esperado é 422 `SEGREGACAO_FUNCAO`, a linha continua `SUBMETIDA` e o fluxo não exige um segundo
   aprovador (Task 6, `e01-t03-regras` · "autor com APROVAR não aprova a si mesmo").
2. `PATCH` numa versão `APROVADA` ou `APOSENTADA` altera `p_icms`, ou a resposta traz código de nota
   emitida — o esperado é 409 `VERSAO_IMUTAVEL`, os percentuais iguais aos gravados, e o `information_schema`
   sem FK de `regras_tributarias` para `notas_fiscais` (Task 6, `e01-t03-regras` · "versão aprovada e
   aposentada recusam PATCH").
3. Aprovar uma segunda regra do mesmo enquadramento com vigência que cruza a de outra `APROVADA` — o
   esperado é 422 `VIGENCIA_AMBIGUA` e a segunda linha permanece `SUBMETIDA` (Task 6, `e01-t03-regras` ·
   "vigências aprovadas sobrepostas no mesmo enquadramento").
4. A migration semeia os três benefícios ou as três classificações da fixture, ou cria coluna CSOSN, IS,
   `versao_nt`, `data_comercial`, `data_fiscal` ou `data_efetiva` — o esperado é `COUNT(*) = 0` nos dois
   catálogos e só `vigencia_inicio`/`vigencia_fim` (Task 2, `e01-t03-migrations`).
5. O combo visível diz "CST", "CSOSN" ou "pICMS", ou o JSON manda `pIcms` como número — o esperado é o
   rótulo "Tratamento ICMS", a opção "Tributação integral" para o valor `00`, o rótulo "Alíquota (%)", e
   400 quando `pIcms` é número (Task 12, `regras-client` · "rótulos literais do protótipo"; Task 4,
   `fiscal-regras-dto` · "pIcms numérico é 400").

---

## 2. Decisões fixadas (com fonte)

| # | Decisão | Fonte |
|---|---|---|
| D1 | A fatia grava a regra e o ciclo rascunho → submetida → aprovada → aposentada, mais versão nova e comparação de campos. Não há endpoint de simulação, memória, exportação de memória nem publicação | Pedido da fatia; Caderno B L74 e L82–L100; aplicacao.js L243–L254 (painel do épico, fora da tela) |
| D2 | A regra aponta para `enquadramentos_fiscais.id` com `situacao = 'ATIVA'` e `deleted_at` nulo. Operação e CFOP do corpo têm de ser os da linha travada. Divergência → 422 `ENQUADRAMENTO_DIVERGENTE`. Enquadramento ausente → 404. Enquadramento inativo ou removido → 422 `ENQUADRAMENTO_INDISPONIVEL`. Não se cria enquadramento, CFOP nem NCM | Pedido da fatia; MATRIZ-UX L86–L88; componentes.js L310–L320, L190–L201 e L226–L236; `fiscal-enquadramentos.schema.ts` L54–L62 |
| D3 | Rótulos e pares visíveis são os de D4–D6, copiados sem abreviar. O valor gravado é o código da primeira coluna; a tela mostra a segunda | componentes.js L322–L416 e L1802–L1864; MATRIZ-UX L89–L96. O Portão 1 da T02 reprovou rótulo abreviado |
| D4 | Tratamento ICMS, e somente estes pares: `00` Tributação integral; `20` Redução de base; `40` Isenção; `41` Não tributada; `51` Diferimento. Não há par CSOSN no enum. Não há coluna `csosn` | componentes.js L322–L332 (rótulo "Tratamento ICMS") e L1802–L1822. O resumo "CST/CSOSN ICMS" do Caderno B L73 não acrescenta código |
| D5 | Tratamento IPI: `51` Saída tributada à alíquota zero; `53` Saída não tributada; `99` Outras saídas. Tratamento PIS/COFINS: `01` Tributação normal; `06` Alíquota zero; `08` Sem incidência; `99` Outras operações. Tratamento IBS/CBS: `000` Tributação integral; `200` Alíquota reduzida. Um único enum. Não há coluna de IS, nem alíquota separada de IBS, CBS ou IS | componentes.js L370–L404 e L1824–L1864; MATRIZ-UX L93–L95. Caderno B L73 cita "IBS/CBS/IS" no resumo e o contrato de tela não tem o campo |
| D6 | Benefício fiscal e Classificação IBS/CBS são catálogos manuais vazios, no espírito de `cfops`/`ncms` da T02. Formato do benefício: `^[A-Z]{2}[0-9]{6}$` (os exemplos SP020450, SP020740 e SP020100 medem isso). Formato da classificação: `^[0-9]{6}$` (000001, 200003, 200036). A migration não insere essas linhas. Não se cunha id de hipótese: a fonte não tem id para a tabela nacional de CST, cBenef ou cClassTrib | componentes.js L358–L368, L406–L416, L2700–L2732; pedido da fatia; T02 D7 como analogia de formato, não como id novo |
| D7 | `p_red_bc` e `p_icms` são `NUMERIC(6,3)`, obrigatórios, de `0.000` a `100.000`. O JSON aceita string com vírgula ou ponto e no máximo 3 casas; o serviço grava a forma canônica com ponto e 3 casas (`41,67` → `41.670`). `z.number()` e `parseFloat` não entram. Fora da faixa ou com 4 casas → 400 | componentes.js L334–L356 (`inputMask` `0,00%`, tipo `percent`); aplicacao.js L420 e L449; convencoes-schema.md L60; pedido da fatia |
| D8 | `vigencia_inicio` obrigatória, `vigencia_fim` opcional e `>= inicio`. Não existem colunas comercial, fiscal ou efetiva. Selo `H-E01-10` | Caderno B L75 contra MATRIZ-UX L97–L98 e componentes.js L154–L176 (`vigenciaFim.required: false`); H-E01-10 já aberto na T02 |
| D9 | Situação da versão: `RASCUNHO`, `SUBMETIDA`, `APROVADA`, `APOSENTADA`. Rótulos na tela: Rascunho, Submetida, Aprovada, Aposentada. Editar só `RASCUNHO`. `SUBMETIDA` não edita campos (409 `TRANSICAO_INVALIDA`). `APROVADA` e `APOSENTADA` não editam campos (409 `VERSAO_IMUTAVEL`) | Caderno B L74; pedido da fatia ("versão aprovada ou aposentada é imutável") |
| D10 | Aprovar e aposentar exigem `FISCAL_REGRAS_APROVAR` e usuário diferente de `submetido_por_id`. Reusar `exigirSegregacao` (`fiscal-comum.ts` L77–L84), código `SEGREGACAO_FUNCAO`, 422. Um aprovador basta para ir a `APROVADA`. Não há coluna de quórum nem segunda aprovação. A pré-condição `DUPLA_APROVACAO` continua `atendida: false`, `provisoria: true`, selo `H-E01-11` | Caderno B L75 "aprovação segregada"; Caderno B L95 "aprovador diferente do autor"; H-E01-11; pedido da fatia. O protótipo não diz quantos aprovadores formam quórum |
| D11 | Permissões novas `FISCAL_REGRAS_LER`, `FISCAL_REGRAS_GERENCIAR` e `FISCAL_REGRAS_APROVAR`, só no `administrador`, fora de `LEITURA_CADASTROS`. Persona "fiscal/contador" não vira perfil. Selo `H-E01-12` no acesso típico e no parâmetro novo. As permissões `FISCAL_EMPRESAS_*` e `FISCAL_ENQUADRAMENTOS_*` não mudam de perfil | AD-04 L11; AD-18 L25 (5); catalogo.js L217; H-E01-12; pedido da fatia |
| D12 | Zod → 400 (AD-12 L19). Regra de domínio → 422. Estado, unicidade, versão otimista e versão imutável → 409. Sem permissão → 403. 5xx sem SQL e sem stack | AD-12 L19; Caderno B L76 |
| D13 | "Não editar retroativamente em nota emitida" nesta fatia é a imutabilidade de `APROVADA` e `APOSENTADA` mais a versão nova. O protótipo não tem código de erro literal para nota emitida (catalogo.js L220, MATRIZ-UX L80 e aplicacao.js L398 só dizem "Erro 422 simulado"). Não se cria código `NOTA_EMITIDA` e não se liga `regras_tributarias` a `notas_fiscais` | Caderno B L75; pedido da fatia; busca no protótipo sem código literal |
| D14 | Benefício que não é linha ativa do catálogo manual → 422 `BENEFICIO_NAO_ELEGIVEL`. Isso é "cadastro ativo", não tabela legal da UF. A terceira coluna da fixture ("Elegibilidade a aprovar", componentes.js L2704) não vira status | Caderno B L76; MATRIZ-UX L92; componentes.js L2700–L2715 |
| D15 | Duas versões `APROVADA`, não removidas, do mesmo `enquadramento_id`, com intervalos que `intervalosSobrepoem` cruza → 422 `VIGENCIA_AMBIGUA` na aprovação, e a linha submetida não muda. Rascunhos podem ter datas que se cruzam. Fim aberto casa com qualquer data posterior | Caderno B L76; `enquadramento-criterio.ts` L3–L7 (sentinela `9999-12-31` só na comparação, nunca gravada) |
| D16 | "Versão NT inválida" aparece na aba Exceções com esse título. Não há campo de NT em componentes.js L3069–L3092 nem código de erro no protótipo. Não há coluna `versao_nt`, não há 422 com NT no nome e não há id de hipótese novo | catalogo.js L221; MATRIZ-UX L81; MATRIZ-INTEGRAL L44; pedido da fatia ("se não houver id, não cunhe hipótese") |
| D17 | `codigo` numérico da linhagem, gerado no backend, imutável, único entre não removidos no par (`codigo`, `numero_versao`). Versão nova reusa o `codigo` e soma `numero_versao`. A coluna `versao` continua sendo o lock otimista, distinta de `numero_versao`. UUID não é rótulo | Caderno B L73 "código de negócio" e L75 "histórico de versões"; AD-13 L20; padrão T02 `enquadramentos.service.ts` L702–L709 |
| D18 | Justificativa trim 3–500 em toda mutação, mesmo com `required: false` no dicionário. O `saveForm` do protótipo recusa justificativa vazia | componentes.js L418–L422; aplicacao.js L451; MATRIZ-UX L76 e L99; T02 D24 |
| D19 | Menu: o grupo `FISCAL` permanece na 8ª posição. Terceiro item "Editor de regras tributárias" (catalogo.js L211), href `/fiscal/regras`, `permissao: 'FISCAL_REGRAS_LER'`, `iconKey: 'FileSpreadsheet'` (já em `ICON_MAP`, `app-sidebar.tsx` L88). A rota do catálogo `/erp/fiscal/e01-t03` (catalogo.js L216) não entra na UI. 39 rotas operacionais intactas. `MENUS_ERP` passa a 3. Total 42. Atribuições `128 + 1 = 129` | catalogo.js L210–L216; AD-15 L22; AD-24 L31 (1); `menus-canonicos.ts` L48; `menu-rbac.test.ts` L72 |
| D20 | API Nest sob `/fiscal`. BFF sob `/api/erp/fiscal`. Combos de enquadramento, operação e CFOP usam os BFF já existentes de enquadramentos, operações e CFOP. Benefício e classificação ganham BFF novo | Caderno B L80 |
| D21 | Room WS `fiscal-regras` exige `FISCAL_REGRAS_LER`. As rooms `fiscal-empresas` e `fiscal-enquadramentos` não mudam. Evento só depois do commit. 409 e 422 não emitem | Princípio VI; padrão T02 §8; Caderno B L76 |
| D22 | Comparar devolve diferenças de campo entre duas versões do mesmo `codigo`, com rótulos de D3–D6 e percentuais em pt-BR. Códigos de linhagem diferentes → 422 `REGRAS_DISTINTAS`. Não calcula tributo | Caderno B L74 "comparar"; Caderno B L84 reserva "comparar versões" do simulador à T04 |
| D23 | "Hoje" não é coluna. Datas do formulário são `date` em `YYYY-MM-DD`, modo string, sem deslocar fuso | componentes.js L417 (input `type="date"`); T02 D23 |
| D24 | Concorrência: `versao` otimista e `SELECT … FOR NO KEY UPDATE` do enquadramento antes de gravar regra dele. Duas aprovações simultâneas do mesmo enquadramento serializam nessa trava | MATRIZ-UX L79 "conflito concorrente"; padrão T01/T02 |
| D25 | Já existe versão `RASCUNHO` ou `SUBMETIDA` do mesmo `codigo` → 409 `VERSAO_ABERTA` ao adicionar versão. Índice único parcial garante o mesmo no banco | Caderno B L75 "histórico de versões"; D9 |
| D26 | Não há `DELETE` desta fatia. A reversão da versão aprovada é aposentar, que conserva a linha e a auditoria | Caderno B L74 (as ações não incluem excluir); Princípio IV |

## 3. Conflitos de fonte resolvidos

| # | Conflito | Resolução |
|---|---|---|
| C1 | Caderno B L73 "CST/CSOSN ICMS" × enum `icmsCst` só com 00, 20, 40, 41 e 51 | D4. Rótulo "Tratamento ICMS". Sem coluna CSOSN |
| C2 | Caderno B L73 "IBS/CBS/IS" × um enum "Tratamento IBS/CBS" com `000` e `200` | D5. Sem coluna IS |
| C3 | Caderno B L75 "separar datas comercial/fiscal/efetiva" × matriz só início e fim | D8 e H-E01-10 |
| C4 | Caderno B L75 "não permite edição retroativa em nota emitida" × ausência de tabela de nota nesta fatia e de código de erro no protótipo | D13. Imutabilidade + versão nova. Sem FK |
| C5 | Caderno B L76 "validação 422" × AD-12 (Zod é 400) | D12 |
| C6 | DoD genérico "dupla aprovação quando exigida" e Caderno B L95 "aprovador diferente do autor" × silêncio sobre o número do quórum | D10. Um aprovador diferente do autor. H-E01-11 segue aberto |
| C7 | componentos.js L2700–L2732 traz três benefícios e três classificações × pedido de não semear fixture | D6. Tabelas vazias. O operador grava pelo diálogo. Os códigos da fixture só servem de exemplo de formato no teste de validador, não de `INSERT` |
| C8 | catalogo.js L221 "versão NT inválida" × formulário sem campo de NT (componentes.js L3069–L3092) | D16. A aba nomeia o fluxo e declara que não há bloqueio. Sem coluna e sem 422 |
| C9 | Rota do catálogo `/erp/fiscal/e01-t03` (catalogo.js L216) × proibição de código na UI | D19 `/fiscal/regras` |
| C10 | Persona "fiscal/contador" (catalogo.js L217) × 11 perfis | D11 e H-E01-12. O subtítulo não imprime a persona como perfil |
| C11 | componentes.js L3139 `requiresReason: false` × aplicacao.js L451, que recusa justificativa vazia, e MATRIZ-UX L76, que pede justificativa em operação crítica | D18. Toda mutação exige justificativa 3–500 |
| C12 | Painel "Matriz de enquadramentos" com botões "Simular cálculo fiscal" e "Exportar memória de cálculo" (aplicacao.js L243–L254) × T04 | Remoção autorizada, igual à T02 §4. O painel é do épico E01, não da ficha desta tela |

## 4. Referência do protótipo e fidelidade

`index.html` não contém markup da tela. O hash `#E01-T03` é resolvido por `aplicacao.js`. Fonte visual: DS v3
(AD-10) + esse contrato.

| Elemento | Fonte (arquivo:linha) | Implementação real |
|---|---|---|
| Metadados | catalogo.js L210–L222 | título "Editor de regras tributárias"; subtítulo = as seis ações + "Acesso típico" com `BadgeProvisorio codigo="H-E01-12"` |
| Campos | componentes.js L3069–L3092 e L310–L428 | os 14 campos de D2–D8, com os rótulos literais. Prioridade não entra (não está na seção) |
| Enums | componentes.js L1802–L1864 | D4 e D5, texto da segunda coluna no combo |
| Catálogos | componentes.js L2700–L2732 | D6. O combo mostra a `descricao` gravada pelo operador. Vazio = "Nenhum cadastro disponível para seleção. Consulte a área responsável." (aplicacao.js L487) |
| Grid | componentes.js L3096–L3127; MATRIZ-UX L77 | Enquadramento fiscal · Operação fiscal (CFOP) · Benefício fiscal · Classificação IBS/CBS · Operação · Tratamento ICMS. Ordenação default Enquadramento fiscal. 20 por página, server-side. Sem coluna técnica |
| Filtros | componentes.js L3129–L3131 | só Operação fiscal (CFOP). A busca da lista permanece (aplicacao.js L170, placeholder "Pesquisar descrição ou referência de negócio") |
| Ações | catalogo.js L219; aplicacao.js L14 e L40–L43 | botões "Criar rascunho", "Adicionar versão", "Comparar", "Submeter", "Aprovar", "Aposentar" (`titleCase` só na primeira letra) |
| Sete abas | aplicacao.js L7 | Ficha e campos, Movimentações, Regras e validações, Exceções, Histórico, Integrações, Aceite e testes |
| Ficha | aplicacao.js L179–L192 | seções "Dados principais" e "Segurança, auditoria e aprovação". Trilha: Empresa (`empresas.razao_social` via enquadramento), Situação, Responsável. Ambiente fica de fora |
| Drawer | aplicacao.js L427–L438 e L451 | "Cancelar", "Verificar dados", "Salvar rascunho". Justificativa obrigatória |
| Exceções | catalogo.js L221 | três blocos: "Benefício não elegível", "Vigência ambígua", "Versão NT inválida". O `if (arr.length < 2)` de aplicacao.js L201 não dispara, porque há três partes separadas por `;` |

Células do grid, sem UUID:

- Enquadramento fiscal = `enquadramentos_fiscais.codigo`.
- Operação fiscal (CFOP) = `cfops.codigo`.
- Benefício fiscal = `beneficios_fiscais.descricao`.
- Classificação IBS/CBS = `classificacoes_ibs_cbs.descricao`.
- Operação = `operacoes.rotulo`.
- Tratamento ICMS = rótulo de D4 (`20` aparece como "Redução de base").

Código da linhagem, número da versão, situação, responsável, criação e alteração ficam na ficha (Caderno B L73),
não nas seis colunas.

Remoções autorizadas (Princípio I.2(a)/(b)), conferidas no Portão 2: selo "DADOS FICTÍCIOS"; pill "Fixture de
teste"; rodapé "registros fictícios"; eyebrow com código de épico e "Caderno B §E01-T03"; KPI "Ambiente em
tela"; botões "Abrir ocorrência" e "Simular erro de validação"; o painel do épico e os botões "Simular cálculo
fiscal", "Comparar regras por vigência", "Submeter classificação" e "Exportar memória de cálculo" (C12); a
palavra "ilustrativo" do botão, que permanece "Salvar rascunho"; "Cadastro demonstrativo em memória"; o
`<select>` de situação com os seis `stateTypes` de aplicacao.js L8 (Pendente de validação, Em revisão,
Aprovado, Bloqueado, Concluído, Rejeitado), que não são as situações de D9; checkboxes da aba Aceite (viram
leitura). Botões de Integrações para telas inexistentes (aplicacao.js L218) desabilitados com
`title="Destino ainda não disponível"`.

Ao escolher o enquadramento, o drawer preenche Operação e Operação fiscal (CFOP) com os valores dessa linha
e mantém os combos visíveis. Se o operador trocar um dos dois, o servidor responde 422
`ENQUADRAMENTO_DIVERGENTE` (D2). O texto do alerta é "A operação e a operação fiscal (CFOP) precisam ser as do enquadramento selecionado."

## 5. Modelo de dados (`app/backend/src/database/schema/fiscal-regras.schema.ts`)

Não alterar `fiscal-empresas.schema.ts`, `fiscal-enquadramentos.schema.ts`, `operacoes.schema.ts` nem
`notas-fiscais*.ts`. Reusar `usuarios`, `enquadramentosFiscais` e as funções `regraViolada`, `conflito`,
`conflitoConcorrente`, `transicaoInvalida`, `exigirSegregacao` e `exigirVersao` de `fiscal-comum.ts`.
Reusar `intervalosSobrepoem` de `enquadramento-criterio.ts`. Não editar esse arquivo.

O Worker confirma no Context7 a sintaxe de `numeric`, `uniqueIndex().where()`, `date({ mode: 'string' })` e
`check` do Drizzle 0.45.

```ts
import { sql } from 'drizzle-orm';
import {
  check, date, foreignKey, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid, varchar,
} from 'drizzle-orm/pg-core';
import { usuarios } from './auth.schema';
import { enquadramentosFiscais } from './fiscal-enquadramentos.schema';

export const ICMS_CST = ['00', '20', '40', '41', '51'] as const;
export const IPI_CST = ['51', '53', '99'] as const;
export const PIS_CST = ['01', '06', '08', '99'] as const;
export const IBS_CST = ['000', '200'] as const;
export const SITUACOES_REGRA = ['RASCUNHO', 'SUBMETIDA', 'APROVADA', 'APOSENTADA'] as const;

export const ROTULOS_ICMS_CST: Record<(typeof ICMS_CST)[number], string> = {
  '00': 'Tributação integral',
  '20': 'Redução de base',
  '40': 'Isenção',
  '41': 'Não tributada',
  '51': 'Diferimento',
};
export const ROTULOS_IPI_CST: Record<(typeof IPI_CST)[number], string> = {
  '51': 'Saída tributada à alíquota zero',
  '53': 'Saída não tributada',
  '99': 'Outras saídas',
};
export const ROTULOS_PIS_CST: Record<(typeof PIS_CST)[number], string> = {
  '01': 'Tributação normal',
  '06': 'Alíquota zero',
  '08': 'Sem incidência',
  '99': 'Outras operações',
};
export const ROTULOS_IBS_CST: Record<(typeof IBS_CST)[number], string> = {
  '000': 'Tributação integral',
  '200': 'Alíquota reduzida',
};
export const ROTULOS_SITUACAO_REGRA: Record<(typeof SITUACOES_REGRA)[number], string> = {
  RASCUNHO: 'Rascunho',
  SUBMETIDA: 'Submetida',
  APROVADA: 'Aprovada',
  APOSENTADA: 'Aposentada',
};

const auditCols = {
  versao: integer('versao').notNull().default(1),
  criadoPorId: uuid('criado_por_id').notNull().references(() => usuarios.id),
  atualizadoPorId: uuid('atualizado_por_id').notNull().references(() => usuarios.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};

export const beneficiosFiscais = pgTable('beneficios_fiscais', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  codigo: varchar('codigo', { length: 8 }).notNull(),
  descricao: varchar('descricao', { length: 255 }).notNull(),
  ...auditCols,
}, (t) => [
  check('beneficios_codigo_formato_check', sql`${t.codigo} ~ '^[A-Z]{2}[0-9]{6}$'`),
  check('beneficios_descricao_preenchida_check', sql`btrim(${t.descricao}) <> ''`),
  check('beneficios_versao_positiva_check', sql`${t.versao} >= 1`),
  uniqueIndex('uq_beneficios_codigo').on(t.codigo).where(sql`${t.deletedAt} IS NULL`),
  index('idx_beneficios_criado_por').on(t.criadoPorId),
  index('idx_beneficios_atualizado_por').on(t.atualizadoPorId),
]);

export const classificacoesIbsCbs = pgTable('classificacoes_ibs_cbs', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  codigo: varchar('codigo', { length: 6 }).notNull(),
  descricao: varchar('descricao', { length: 255 }).notNull(),
  ...auditCols,
}, (t) => [
  check('classificacoes_codigo_formato_check', sql`${t.codigo} ~ '^[0-9]{6}$'`),
  check('classificacoes_descricao_preenchida_check', sql`btrim(${t.descricao}) <> ''`),
  check('classificacoes_versao_positiva_check', sql`${t.versao} >= 1`),
  uniqueIndex('uq_classificacoes_codigo').on(t.codigo).where(sql`${t.deletedAt} IS NULL`),
  index('idx_classificacoes_criado_por').on(t.criadoPorId),
  index('idx_classificacoes_atualizado_por').on(t.atualizadoPorId),
]);

export const regrasTributarias = pgTable('regras_tributarias', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  codigo: varchar('codigo', { length: 20 }).notNull(),
  numeroVersao: integer('numero_versao').notNull(),
  enquadramentoId: uuid('enquadramento_id').notNull().references(() => enquadramentosFiscais.id),
  icmsCst: varchar('icms_cst', { length: 2 }).notNull(),
  pRedBc: numeric('p_red_bc', { precision: 6, scale: 3 }).notNull(),
  pIcms: numeric('p_icms', { precision: 6, scale: 3 }).notNull(),
  beneficioFiscalId: uuid('beneficio_fiscal_id').notNull().references(() => beneficiosFiscais.id),
  ipiCst: varchar('ipi_cst', { length: 2 }).notNull(),
  pisCst: varchar('pis_cst', { length: 2 }).notNull(),
  ibsCst: varchar('ibs_cst', { length: 3 }).notNull(),
  classificacaoIbsCbsId: uuid('classificacao_ibs_cbs_id').notNull().references(() => classificacoesIbsCbs.id),
  vigenciaInicio: date('vigencia_inicio', { mode: 'string' }).notNull(),
  vigenciaFim: date('vigencia_fim', { mode: 'string' }),
  situacao: text('situacao').notNull().default('RASCUNHO'),
  origemVersaoId: uuid('origem_versao_id'),
  justificativa: text('justificativa').notNull(),
  submetidoPorId: uuid('submetido_por_id').references(() => usuarios.id),
  submetidoEm: timestamp('submetido_em', { withTimezone: true }),
  aprovadoPorId: uuid('aprovado_por_id').references(() => usuarios.id),
  aprovadoEm: timestamp('aprovado_em', { withTimezone: true }),
  aposentadoPorId: uuid('aposentado_por_id').references(() => usuarios.id),
  aposentadoEm: timestamp('aposentado_em', { withTimezone: true }),
  ...auditCols,
}, (t) => [
  foreignKey({
    columns: [t.origemVersaoId],
    foreignColumns: [t.id],
    name: 'regras_tributarias_origem_fk',
  }),
  check('regras_codigo_formato_check', sql`${t.codigo} ~ '^[1-9][0-9]{0,17}$'`),
  check('regras_numero_versao_check', sql`${t.numeroVersao} >= 1`),
  check('regras_icms_cst_check', sql`${t.icmsCst} IN ('00','20','40','41','51')`),
  check('regras_ipi_cst_check', sql`${t.ipiCst} IN ('51','53','99')`),
  check('regras_pis_cst_check', sql`${t.pisCst} IN ('01','06','08','99')`),
  check('regras_ibs_cst_check', sql`${t.ibsCst} IN ('000','200')`),
  check('regras_p_red_bc_faixa_check', sql`${t.pRedBc} >= 0 AND ${t.pRedBc} <= 100`),
  check('regras_p_icms_faixa_check', sql`${t.pIcms} >= 0 AND ${t.pIcms} <= 100`),
  check('regras_vigencia_ordem_check', sql`${t.vigenciaFim} IS NULL OR ${t.vigenciaFim} >= ${t.vigenciaInicio}`),
  check('regras_situacao_check', sql`${t.situacao} IN ('RASCUNHO','SUBMETIDA','APROVADA','APOSENTADA')`),
  check('regras_versao_positiva_check', sql`${t.versao} >= 1`),
  check('regras_submetida_autor_check', sql`${t.situacao} = 'RASCUNHO' OR ${t.submetidoPorId} IS NOT NULL`),
  check('regras_aprovada_check', sql`${t.situacao} NOT IN ('APROVADA','APOSENTADA') OR (${t.aprovadoPorId} IS NOT NULL AND ${t.aprovadoEm} IS NOT NULL)`),
  check('regras_aposentada_check', sql`${t.situacao} <> 'APOSENTADA' OR (${t.aposentadoPorId} IS NOT NULL AND ${t.aposentadoEm} IS NOT NULL)`),
  check('regras_aprovador_diferente_check', sql`${t.aprovadoPorId} IS NULL OR ${t.aprovadoPorId} <> ${t.submetidoPorId}`),
  check('regras_aposentador_diferente_check', sql`${t.aposentadoPorId} IS NULL OR ${t.aposentadoPorId} <> ${t.submetidoPorId}`),
  uniqueIndex('uq_regras_codigo_versao').on(t.codigo, t.numeroVersao).where(sql`${t.deletedAt} IS NULL`),
  uniqueIndex('uq_regras_abertas_codigo').on(t.codigo).where(sql`${t.deletedAt} IS NULL AND ${t.situacao} IN ('RASCUNHO','SUBMETIDA')`),
  index('idx_regras_enquadramento').on(t.enquadramentoId),
  index('idx_regras_beneficio').on(t.beneficioFiscalId),
  index('idx_regras_classificacao').on(t.classificacaoIbsCbsId),
  index('idx_regras_origem').on(t.origemVersaoId),
  index('idx_regras_situacao').on(t.situacao).where(sql`${t.deletedAt} IS NULL`),
  index('idx_regras_criado_por').on(t.criadoPorId),
  index('idx_regras_atualizado_por').on(t.atualizadoPorId),
  index('idx_regras_submetido_por').on(t.submetidoPorId),
  index('idx_regras_aprovado_por').on(t.aprovadoPorId),
  index('idx_regras_aposentado_por').on(t.aposentadoPorId),
]);
```

`schema/index.ts` ganha uma linha: `export * from './fiscal-regras.schema';`. Operação e CFOP não são colunas
desta tabela: vêm do enquadramento na leitura (D2).

## 6. Máquinas de estado e regras de serviço

Arquivo puro `app/backend/src/modules/erp/fiscal/regras/percentual.ts`:

```ts
const FAIXA = /^\d{1,3}(\.\d{1,3})?$/;

/** Aceita "41,67", "41.670" ou "100". Devolve "41.670" ou null. Sem parseFloat. */
export function normalizarPercentual(entrada: string): string | null {
  const limpo = entrada.trim().replace('%', '').replace(/\s/g, '').replace(',', '.');
  if (!FAIXA.test(limpo)) return null;
  const [inteiroBruto, frac = ''] = limpo.split('.');
  if (inteiroBruto.length > 1 && inteiroBruto.startsWith('0')) return null;
  const frac3 = (frac + '000').slice(0, 3);
  const canon = `${inteiroBruto}.${frac3}`;
  if (canon.split('.')[0].length === 3 && canon > '100.000') return null;
  if (inteiroBruto.length === 3 && inteiroBruto !== '100') return null;
  if (inteiroBruto === '100' && frac3 !== '000') return null;
  return canon;
}

/** "41.670" → "41,670". Não usa Number. */
export function formatarPercentualPtBr(canon: string): string {
  const [inteiro, frac] = canon.split('.');
  return `${inteiro},${frac}`;
}
```

Transições (`regra-transicao.ts`):

| Ação | De | Permissão | Efeito |
|---|---|---|---|
| criar rascunho | — | GERENCIAR | `RASCUNHO`, `numero_versao = 1`, `codigo` novo |
| atualizar | `RASCUNHO` | GERENCIAR | mesmos campos tributários; `versao` otimista + 1 |
| atualizar | `SUBMETIDA` | — | 409 `TRANSICAO_INVALIDA` |
| atualizar | `APROVADA` ou `APOSENTADA` | — | 409 `VERSAO_IMUTAVEL`, mensagem "Versão aprovada ou aposentada não pode ser alterada. Inclua uma versão nova." |
| adicionar versão | `APROVADA` ou `APOSENTADA` | GERENCIAR | nova linha `RASCUNHO`, mesmo `codigo`, `numero_versao + 1`, `origem_versao_id` = a origem, mesmo `enquadramento_id`. Outro enquadramento no corpo → 422 `LINHAGEM_ENQUADRAMENTO_FIXO`, mensagem "A versão nova permanece no mesmo enquadramento fiscal." |
| adicionar versão | já existe aberta do código | — | 409 `VERSAO_ABERTA`, mensagem "Já existe versão em rascunho ou submetida para este código." |
| submeter | `RASCUNHO` | GERENCIAR | `SUBMETIDA`, `submetido_por_id` = usuário atual, `submetido_em` = `now()` |
| aprovar | `SUBMETIDA` | APROVAR | `exigirSegregacao`; depois a checagem de vigência; então `APROVADA`, `aprovado_por_id`, `aprovado_em` |
| aposentar | `APROVADA` | APROVAR | `exigirSegregacao` contra `submetido_por_id`; `APOSENTADA`, `aposentado_por_id`, `aposentado_em`. Quem aprovou pode aposentar, desde que não seja quem submeteu |
| comparar | duas linhas | LER | D22. Sem escrita e sem evento |

Mensagens fechadas:

- `SEGREGACAO_FUNCAO`: "A aprovação deve ser feita por usuário diferente de quem submeteu." (já em `fiscal-comum.ts` L82).
- `VIGENCIA_AMBIGUA`: "Já existe versão aprovada deste enquadramento com vigência sobreposta. Nenhuma foi escolhida." Corpo `{ codigo, message, conflito: { codigo, numeroVersao, vigenciaInicio, vigenciaFim } }`.
- `BENEFICIO_NAO_ELEGIVEL`: "O benefício fiscal selecionado não está ativo."
- `CLASSIFICACAO_NAO_ATIVA`: "A classificação IBS/CBS selecionada não está ativa."
- `ENQUADRAMENTO_DIVERGENTE`: "A operação e a operação fiscal (CFOP) precisam ser as do enquadramento selecionado."
- `ENQUADRAMENTO_INDISPONIVEL`: "O enquadramento fiscal não está ativo."
- `REGRAS_DISTINTAS`: "A comparação exige duas versões do mesmo código."
- `CONFLITO_CONCORRENTE`: a mensagem já existente em `fiscal-comum.ts` L35.

`AuditoriaService.registrar(tx, …)` na mesma transação: `modulo: 'fiscal.regras'`, tabela física
`regras_tributarias` (ou a do catálogo), `dadosAnteriores`/`dadosNovos`, `justificativa`. O histórico
exposto não devolve o nome da tabela. `EventEmitter2.emit` só depois do `db.transaction` resolver.

Código novo da linhagem, só em criar rascunho:

```ts
await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('regras_tributarias.codigo'))`);
const gerado = await tx.execute(sql`
  SELECT (COALESCE(MAX(codigo::bigint), 0) + 1)::text AS proximo FROM regras_tributarias
`);
```

O laço de savepoint segue o de `enquadramentos.service.ts` L702–L714, com savepoint `regra_codigo`.
Violação de `uq_regras_abertas_codigo` ou `uq_regras_codigo_versao` vira 409 `VERSAO_ABERTA`. Violação de
`uq_beneficios_codigo` ou `uq_classificacoes_codigo` vira 409 com mensagem "Código já cadastrado."

## 7. Endpoints (`@Controller('fiscal')`, `JwtAuthGuard` + `RbacGuard`)

Rotas estáticas `contagens` e `exportacao` declaradas antes de `:id`.

| Verbo e caminho | Permissão | DTO (Zod, `.strict()`) | Resposta |
|---|---|---|---|
| GET `/fiscal/beneficios-fiscais` | LER | {search?, page, pageSize ≤ 100} | `{ codigo, descricao }` por item. `id` só no objeto que o combo reenvia, nunca como texto |
| POST `/fiscal/beneficios-fiscais` | GERENCIAR | {codigo, descricao, justificativa} | 201 |
| GET `/fiscal/classificacoes-ibs-cbs` | LER | igual | igual |
| POST `/fiscal/classificacoes-ibs-cbs` | GERENCIAR | {codigo, descricao, justificativa} | 201 |
| GET `/fiscal/regras` | LER | {cfopId?, search?, sort ∈ enquadramento·cfop·cBenef·cClassTrib·operacao·icmsCst, dir ∈ asc·desc, page, pageSize=20} | página com as seis células da seção 4. Sem UUID no objeto de célula |
| GET `/fiscal/regras/contagens` | LER | mesmo filtro | {total, rascunhos, submetidas, aprovadas, aposentadas} |
| GET `/fiscal/regras/exportacao` | LER | mesmo filtro | `text/csv; charset=utf-8`, separador `;`, BOM, cabeçalho "Enquadramento fiscal;Operação fiscal (CFOP);Benefício fiscal;Classificação IBS/CBS;Operação;Tratamento ICMS" |
| GET `/fiscal/regras/:id` | LER | uuid | detalhe com rótulos de D3–D6, `codigo`, `numeroVersao`, `empresaNome` (`empresas.razao_social`), situação no rótulo de D9, responsável (nome), `criadoEm`, `atualizadoEm`, autor (nome de quem submeteu, ou null), aprovador (nome, ou null). Ambiente não entra |
| GET `/fiscal/regras/:id/historico` | LER | uuid | {operacao, situacaoAnterior, situacaoNova, usuarioNome, criadoEm, justificativa, resumo, versao, numeroVersao}. Sem nome de tabela e sem uuid |
| GET `/fiscal/regras/:id/pre-condicoes` | LER | uuid | itens abaixo |
| GET `/fiscal/regras/:id/comparar?com=` | LER | dois uuid | `{ codigo, numeroVersaoAntes, numeroVersaoDepois, diferencas: [{ campo, antes, depois }] }`. `campo` é o rótulo. Percentual com `formatarPercentualPtBr`. Enum com o rótulo de D4/D5 |
| POST `/fiscal/regras` | GERENCIAR | corpo da seção 6 | 201 |
| PATCH `/fiscal/regras/:id` | GERENCIAR | campos editáveis + versao + justificativa, sem codigo e sem numeroVersao | 200, ou 409 |
| POST `/fiscal/regras/:id/versoes` | GERENCIAR | campos da versão nova + versao da origem + justificativa | 201 |
| POST `/fiscal/regras/:id/submeter` | GERENCIAR | {versao, justificativa} | 200 |
| POST `/fiscal/regras/:id/aprovar` | APROVAR | {versao, justificativa} | 200 ou 422 |
| POST `/fiscal/regras/:id/aposentar` | APROVAR | {versao, justificativa} | 200 ou 422 |

Corpo de criar e de atualizar rascunho, todos obrigatórios exceto `vigenciaFim`:

`enquadramentoId`, `operacaoId`, `cfopId`, `icmsCst`, `pRedBc`, `pIcms`, `beneficioFiscalId`, `ipiCst`,
`pisCst`, `ibsCst`, `classificacaoIbsCbsId`, `vigenciaInicio`, `vigenciaFim?`, `justificativa`, e no PATCH
também `versao`. `.strict()` recusa `codigo`, `empresaId`, `csosn`, `is`, `versaoNt`, `dataComercial`,
`dataFiscal`, `dataEfetiva`, `notaId`.

Pré-condições do detalhe (leitura, não bloqueiam o POST):

| codigo | atendida | provisoria |
|---|---|---|
| ENQUADRAMENTO_ATIVO | enquadramento `ATIVA` e não removido | false |
| VIGENCIA_INFORMADA | início gravado | false |
| CAMPOS_TRIBUTARIOS | os quatro enums, os dois percentuais e os dois catálogos preenchidos | false |
| DATAS_COMERCIAL_FISCAL_EFETIVA | false | true (H-E01-10) |
| DUPLA_APROVACAO | false | true (H-E01-11) |
| PERFIS_ALEM_ADMINISTRADOR | false | true (H-E01-12) |

`DUPLA_APROVACAO` provisória convive com o botão Aprovar: o texto da pré-condição é "Um aprovador diferente
de quem submeteu registra a aprovação. Quantos aprovadores formam quórum ainda não foi decidido."

Erro HTTP `{ message, codigo, ...dados }` via `regraViolada` / `conflito`. Não criar outra família de erro.
`:id` inexistente → 404 "Regra tributária não encontrada".

## 8. Eventos pós-commit e tempo real

- `realtime/events/eventos.ts`: `REGRA_TRIBUTARIA_ALTERADA: 'regra_tributaria_alterada'`.
  Payload `{ regraId: string; enquadramentoId: string; codigo: string; numeroVersao: number; acao: 'rascunho_criado'|'rascunho_atualizado'|'versao_adicionada'|'submetida'|'aprovada'|'aposentada'|'beneficio_criado'|'classificacao_criada'; situacao: string }`, registrado em `PayloadPorEvento`. Sem percentual, sem CST e sem id de nota.
- Emitir só depois de `db.transaction` resolver.
- `room-permissoes.ts`: acrescentar `'fiscal-regras': PERMISSOES.FISCAL_REGRAS_LER`. Não alterar `fiscal-empresas` nem `fiscal-enquadramentos`.
- `realtime.gateway.ts`: novo `@OnEvent(EVENTOS.REGRA_TRIBUTARIA_ALTERADA)` chama `broadcastRoom('fiscal-regras', evento, payload)`. Não passar por `publicarFiscal` (room `fiscal-empresas`) nem pelo handler de enquadramento.

## 9. RBAC, seed, parâmetro provisório e menu

`common/rbac/permissoes.ts`, depois do bloco `FISCAL_ENQUADRAMENTOS_*` (L418). Descrições:

- `FISCAL_REGRAS_LER`: "Consultar regras tributárias, benefícios fiscais e classificações IBS/CBS manuais".
- `FISCAL_REGRAS_GERENCIAR`: "Criar rascunho, editar rascunho, adicionar versão, submeter e cadastrar benefício fiscal e classificação IBS/CBS".
- `FISCAL_REGRAS_APROVAR`: "Aprovar e aposentar versão de regra tributária submetida por outro usuário".

```ts
// AD-04 / AD-18 (5) / H-E01-12. Persona fiscal/contador não é perfil.
pushPermissoes('administrador', 'FISCAL_REGRAS_LER', 'FISCAL_REGRAS_GERENCIAR', 'FISCAL_REGRAS_APROVAR');
```

Fora de `LEITURA_CADASTROS`. Não criar `FISCAL_ENQUADRAMENTOS_APROVAR`. O módulo `Fiscal` de
`perfis.service.ts` L67 já usa o prefixo `FISCAL_`. Não acrescentar módulo. O catálogo ordena por
`Object.keys(DESCRICOES_PERMISSOES).sort()` (`perfis.service.ts` L70). O teste de
`perfis-menus.e2e-spec.ts` L83–L94 passa a esperar oito permissões, nesta ordem:

1. `FISCAL_EMPRESAS_APROVAR`
2. `FISCAL_EMPRESAS_GERENCIAR`
3. `FISCAL_EMPRESAS_LER`
4. `FISCAL_ENQUADRAMENTOS_GERENCIAR`
5. `FISCAL_ENQUADRAMENTOS_LER`
6. `FISCAL_REGRAS_APROVAR`
7. `FISCAL_REGRAS_GERENCIAR`
8. `FISCAL_REGRAS_LER`

O teste "catalogo de permissoes cobre todo o mapa de descricoes" continua sem afrouxar.
`MENUS_OPERACIONAIS` continua 39. `MENUS_CANONICOS` e `res.body.menus` passam a 42.

Parâmetro novo em `seed.ts` `PARAMETROS_SEED`, sem alterar `fiscal.enquadramentos_perfis_autorizados`:

```ts
{
  chave: 'fiscal.regras_perfis_autorizados',
  descricao: 'Perfis com acesso ao editor de regras tributárias',
  valorJson: {
    grupo: 'Fiscal',
    tipo: 'info',
    titulo: 'Perfis do editor de regras tributárias',
    texto: 'Somente administrador até decisão sobre os demais perfis.',
    valor: ['administrador'],
    provisorio: true,
    pendencia: 'H-E01-12',
  },
}
```

A tela lê o BFF já existente `/api/admin/parametros/chave/[chave]` e mostra `BadgeProvisorio` enquanto
`provisorio === true`.

Menu — `MENUS_ERP = ['/fiscal/empresas', '/fiscal/enquadramentos', '/fiscal/regras']`.
`perfil.dto.ts` já usa `.max(MENUS_CANONICOS.length)` — não hardcodar 42. Snapshots regenerados por
`npx tsx scripts/gerar-snapshot-perfis.ts`; só a chave `administrador` ganha a rota e as três permissões.

Frontend `lib/menu-v2.ts`: terceiro item do grupo `FISCAL`, sem criar grupo e sem mudar a posição 08.
`shell-ds.spec.ts` não é editado.

Contagens, sem afrouxar:

- `menu-v2.test.ts`: `ITENS_ERP` ganha `['FISCAL', 'Editor de regras tributárias', '/fiscal/regras']`; total `toHaveLength(42)`; os 39 itens sem o grupo FISCAL continuam `toEqual(ITENS_PROTOTIPO)`. Caso novo: permissão só `FISCAL_EMPRESAS_LER` mostra empresas e esconde regras e enquadramentos.
- `menu-rbac.test.ts`: `MATRIZ_ERP` ganha `'/fiscal/regras': ['administrador']`. Rotas sem `/fiscal/` continuam 39. Total de rotas 42. Atribuições `128 + 1 = 129`. `MATRIZ_ERP` soma 3. Atualizar o comentário da L72.
- `perfis-menus.e2e-spec.ts`: `MENUS_CANONICOS` e `res.body.menus` 42; catálogo Fiscal com as oito permissões.

## 10. Página e componentes DS v3

Página `app/frontend/src/app/(admin)/fiscal/regras/page.tsx` (padrão
`(admin)/fiscal/enquadramentos/page.tsx`): `getMe()`; sem usuário → `redirect('/login')`; sem
`FISCAL_REGRAS_LER` → "Você não tem permissão para visualizar o editor de regras tributárias." sem
renderizar o cliente; senão `<RegrasClient podeGerenciar podeAprovar />`.

Componentes em `components/fiscal/regras/`: `regras-client.tsx`, `regra-drawer.tsx`, `versao-dialog.tsx`,
`comparar-dialog.tsx`, `codigo-tributario-dialog.tsx` (benefício e classificação), `abas-detalhe.tsx`.
DS existente: `PageHeader`, `KpiStrip`/`Kpi`, `Table`, `Tabs`, `ComboboxField`, `DatePickerField`, `Sheet`,
`AlertDialog`, `StatusPill`, `EmptyState`, `Skeleton`, `BadgeProvisorio`, `sonner`. Sem hex avulso.

- Hero: título "Editor de regras tributárias"; subtítulo com as seis ações e o selo H-E01-12; "Exportar";
  "+ Novo registro" (só `podeGerenciar`); "Ações do processo ▾" com os seis comandos, cada um abrindo o fluxo real.
- KPIs: "Regras", "Em rascunho", "Submetidas", "Aprovadas".
- Lista: busca; filtro Operação fiscal (CFOP); "Exportar visão"; grid da seção 4; clique ou Enter seleciona;
  paginação server-side; filtros e ordenação em `sessionStorage` na chave `fiscal.regras.lista`; vazio com o
  texto de aplicacao.js L172 ("Nenhum resultado para o período, filtro ou situação escolhidos. Limpe os filtros ou cadastre um novo registro.").
- Ficha: os 14 campos, Código, Versão (`numeroVersao`), Situação no rótulo de D9, Responsável, Criado em,
  Alterado em. Selo `H-E01-10` junto de Início de vigência e Fim de vigência. Trilha: Empresa, Situação,
  Responsável. Botões "Editar versão" (só rascunho e `podeGerenciar`), "Validar pré-condições", "Consultar histórico".
- Movimentações: trilha em leitura Preparação → Verificação → Autorização → Conclusão (o protótipo não
  transmite). Ações reais conforme D9 e a permissão: Submeter, Aprovar, Aposentar, Adicionar versão, Comparar.
  O botão Aprovar permanece visível na `SUBMETIDA` para quem tem `podeAprovar`; o 422 de segregação aparece
  no alerta, não some o botão.
- Regras e validações: o texto de catalogo.js L220 ("motor de regras não permite edição retroativa em nota
  emitida; aprovação segregada") mais "Versão aprovada ou aposentada não é alterada; a alteração é uma versão
  nova." O caminho de aprovação de aplicacao.js L198 fica com os três passos e `BadgeProvisorio codigo="H-E01-11"`.
  O passo 03 diz: "Um aprovador diferente de quem submeteu libera a versão. O quórum numérico permanece provisório."
- Exceções: os três títulos da seção 4. Os dois primeiros mostram a mensagem do último 422, se houver. O
  terceiro diz: "Esta tela não tem campo de versão de NT e o protótipo não traz código de erro. Nenhuma gravação é recusada por esse motivo."
- Histórico, Integrações e Aceite: o mesmo recorte da T02 §10, com os oito critérios de aplicacao.js L223–L231
  em leitura e a frase de L236 de que checkbox não é aceite.
- Drawer: combos e enums com os rótulos literais. Percentual com prefixo `%` (aplicacao.js L420), `inputMode="decimal"`,
  valor digitado em pt-BR. "Novo código" no benefício e na classificação abre `codigo-tributario-dialog`.
  O diálogo avisa "Cadastro manual. A tabela oficial completa não está carregada; confira o código na documentação fiscal."
  Sem lista pronta e sem selo de id novo (D6). Erros por campo via `useErrosCampo` / `extrairErrosPorCampo` (AD-12).
  Sair com pendência pede confirmação.
- Diálogo de versão nova: os campos tributários preenchidos com a origem, enquadramento travado no mesmo código
  de negócio, vigência editável, motivo. 409 `VERSAO_ABERTA` não fecha como sucesso.
- Diálogo comparar: escolhe a outra versão do mesmo código e lista `campo`, `antes`, `depois`. Não mostra UUID.
- Estados: inicial, carregando (skeleton), sem registros, validação inválida, sem acesso (página), conflito
  concorrente (409 `CONFLITO_CONCORRENTE`), serviço indisponível ("Tentar novamente"), revisão pendente
  (situação Submetida, com o selo H-E01-11), concluído (toast "Regra tributária salva.").
- Tempo real: `conectarRealtime({ rooms: ['fiscal-regras'], onMessage, onReconnect })` refaz lista e detalhe. Sem polling.
- `lib/fiscal-regras.ts`: os mapas de rótulo iguais aos do schema (D4, D5, D9), `normalizarPercentual`,
  `formatarPercentualPtBr`, cliente HTTP do BFF. Não exportar função que calcule tributo, base ou valor de imposto.

Combos de apoio já existentes: `GET /api/erp/fiscal/enquadramentos`, `GET /api/erp/fiscal/cfops`,
`GET /api/operacoes`. O valor submetido é o id; o texto visível é código ou rótulo de negócio.

## 11. Auditoria (Princípio IV)

Cada mutação chama `AuditoriaService.registrar` na mesma transação, com `usuarioId` e `justificativa`.
O histórico lê `auditoria` por `(tabela, registro_id)` da versão e, na versão nova, também da origem.
`resumo` em português, fechado: "Rascunho criado", "Rascunho atualizado", "Versão nova do código {codigo}",
"Versão submetida", "Versão aprovada", "Versão aposentada", "Benefício fiscal cadastrado",
"Classificação IBS/CBS cadastrada". Nunca o nome da tabela nem UUID.

## 12. Estrutura de arquivos (ownership exclusivo)

Backend (`app/backend/`):

- Criar: `src/database/schema/fiscal-regras.schema.ts`.
- Criar: `src/common/validators/percentual.ts` (reexporta o normalizador, ou o módulo de regras exporta e o validator importa — um só módulo, `src/modules/erp/fiscal/regras/percentual.ts`, importado pelo DTO).
- Criar: `src/modules/erp/fiscal/regras/regras-tributarias.module.ts`.
- Criar: `src/modules/erp/fiscal/regras/beneficios-fiscais.controller.ts`.
- Criar: `src/modules/erp/fiscal/regras/beneficios-fiscais.service.ts`.
- Criar: `src/modules/erp/fiscal/regras/classificacoes-ibs-cbs.controller.ts`.
- Criar: `src/modules/erp/fiscal/regras/classificacoes-ibs-cbs.service.ts`.
- Criar: `src/modules/erp/fiscal/regras/regras.controller.ts`.
- Criar: `src/modules/erp/fiscal/regras/regras.service.ts`.
- Criar: `src/modules/erp/fiscal/regras/regra-transicao.ts`.
- Criar: `src/modules/erp/fiscal/regras/exportacao-csv.ts`.
- Criar: `src/modules/erp/fiscal/regras/dto/comum.dto.ts`.
- Criar: `src/modules/erp/fiscal/regras/dto/beneficio-fiscal.dto.ts`.
- Criar: `src/modules/erp/fiscal/regras/dto/classificacao-ibs-cbs.dto.ts`.
- Criar: `src/modules/erp/fiscal/regras/dto/regra.dto.ts`.
- Criar: `src/database/migrations/0046_e01_t03_regras_tributarias.sql` e o snapshot `meta/0046_snapshot.json` gerados pelo drizzle-kit; o journal `meta/_journal.json` ganha a tag `0046_e01_t03_regras_tributarias`.
- Criar testes: `test/unit/percentual.spec.ts`, `test/unit/fiscal-regras-dto.spec.ts`, `test/unit/regra-transicao.spec.ts`.
- Criar testes: `test/integration/e01-t03-migrations.e2e-spec.ts`, `e01-t03-catalogos.e2e-spec.ts`, `e01-t03-regras.e2e-spec.ts`, `e01-t03-comparar.e2e-spec.ts`, `e01-t03-concorrencia.e2e-spec.ts`, `e01-t03-eventos.e2e-spec.ts`.
- Modificar: `src/database/schema/index.ts` (uma linha de export).
- Modificar: `src/database/migrations/ROLLBACK.md` (seção E01-T03).
- Modificar: `src/database/seed.ts` (só o parâmetro novo).
- Modificar: `src/common/rbac/permissoes.ts`, `menus-canonicos.ts`, `perfil-permissoes.snapshot.json`, `perfil-menus.snapshot.json`.
- Modificar: `src/app.module.ts` (import de `RegrasTributariasModule`).
- Modificar: `src/realtime/room-permissoes.ts`, `src/realtime/realtime.gateway.ts`, `src/realtime/events/eventos.ts`.
- Modificar: `test/helpers/test-app.ts` — no `TRUNCATE`, incluir `regras_tributarias, classificacoes_ibs_cbs, beneficios_fiscais` antes de `enquadramentos_fiscais`.
- Modificar: `test/unit/room-permissoes.spec.ts` (caso novo, sem apagar os anteriores).
- Modificar: `test/integration/perfis-menus.e2e-spec.ts` (contagens e as oito permissões).

Frontend (`app/frontend/`):

- Criar: `src/app/(admin)/fiscal/regras/page.tsx`.
- Criar: `src/components/fiscal/regras/regras-client.tsx`, `regra-drawer.tsx`, `versao-dialog.tsx`, `comparar-dialog.tsx`, `codigo-tributario-dialog.tsx`, `abas-detalhe.tsx`.
- Criar: `src/lib/fiscal-regras.ts`.
- Criar BFF: `src/app/api/erp/fiscal/beneficios-fiscais/route.ts`.
- Criar BFF: `src/app/api/erp/fiscal/classificacoes-ibs-cbs/route.ts`.
- Criar BFF: `src/app/api/erp/fiscal/regras/route.ts`, `regras/contagens/route.ts`, `regras/exportacao/route.ts`.
- Criar BFF: `src/app/api/erp/fiscal/regras/[id]/route.ts`, `regras/[id]/comparar/route.ts`, `regras/[id]/[acao]/route.ts` com allowlist `versoes` · `submeter` · `aprovar` · `aposentar` · `historico` · `pre-condicoes`.
- Criar testes: `__tests__/fiscal-regras-lib.test.ts`, `__tests__/bff-e01-t03.test.ts`, `__tests__/regras-client.test.tsx`.
- Modificar: `src/lib/menu-v2.ts`, `__tests__/menu-v2.test.ts`, `__tests__/menu-rbac.test.ts`.
- Criar: `e2e/e01-t03-regras.spec.ts`, `e2e/capture-e01-t03-evidencias.spec.ts`, `e2e/helpers/e01-t03-seed.ts`.
- Criar evidências: `docs/evidencias/e01-t03/*.png` (Task 14).

Proibido nesta fatia: `docs/execucao/**`, `GATE-VEREDITOS.md`, `e2e/shell-ds.spec.ts`,
`fiscal-empresas.schema.ts`, `fiscal-enquadramentos.schema.ts`, services de empresas e de enquadramentos,
`notas-fiscais*.ts`, simulador, memória de cálculo, painel de publicação, seed dos códigos da fixture,
coluna CSOSN, coluna IS, coluna de NT, colunas de data comercial/fiscal/efetiva, tabela nova de nota.

## 13. Mapa DoD → teste

| Critério (fonte) | Teste (arquivo · nome) |
|---|---|
| DoD (1) ações do Caderno B L77 | e01-t03-regras · "criar rascunho, editar, submeter, aprovar e aposentar"; "adicionar versão grava o mesmo código e numero_versao 2" |
| DoD (2) campos | fiscal-regras-dto · "icmsCst 101", "ipiCst 00", "pisCst 07", "ibsCst 100", "fim < início", "strict rejeita csosn, is, versaoNt e notaId"; percentual · "41,67 → 41.670", "100,001 é null", "41,6789 é null" |
| DoD (3) recarregar | e01-t03-regras · "GET detalhe após aprovar devolve código, versão, rótulo Redução de base e pIcms 12.000" |
| DoD (4) autorização | e01-t03-regras · "gestor sem FISCAL_REGRAS_* → 403 em toda rota"; "GERENCIAR sem APROVAR → 403 em aprovar" |
| DoD (4) aprovação segregada | e01-t03-regras · "autor com APROVAR não aprova a si mesmo"; pre-condicoes · "DUPLA_APROVACAO provisoria=true e atendida=false" |
| DoD (5) falha externa | não se aplica: sem SEFAZ. e01-t03-regras · "aprovar não abre socket HTTP" (fetch do serviço espionado com 0 chamadas) |
| DoD (6) auditoria e reversão | e01-t03-regras · "cada mutação grava 1 auditoria"; "aposentar conserva a linha e o histórico não tem nome de tabela nem uuid" |
| DoD (7) Playwright | e01-t03-regras.spec · jornada, 403, teclado e rótulos (Task 13) |
| DoD (8) 39 rotas | menu-rbac · "sem /fiscal/ = 39"; "total 42"; "atribuições 129"; e01-t03-regras · "POST não altera enquadramentos_fiscais, cfops, ncms nem notas_fiscais" |
| Benefício não elegível (L76) | e01-t03-regras · "beneficio removido → 422 BENEFICIO_NAO_ELEGIVEL e zero regras" |
| Vigência ambígua (L76) | e01-t03-regras · "vigências aprovadas sobrepostas no mesmo enquadramento" |
| Versão NT (L76) | e01-t03-migrations · "coluna versao_nt ausente"; e01-t03-regras · "POST válido não devolve código contendo NT" |
| Imutabilidade (L75) | e01-t03-regras · "versão aprovada e aposentada recusam PATCH" |
| Catálogo manual (D6) | e01-t03-migrations · "COUNT(*) = 0"; e01-t03-catalogos · "benefício duplicado → 409"; "não há chamada HTTP externa" |
| Três datas (H-E01-10) | e01-t03-migrations · "information_schema.columns de regras_tributarias não contém data_comercial, data_fiscal nem data_efetiva" |
| Percentual sem float | fiscal-regras-dto · "pIcms numérico é 400"; e01-t03-regras · "p_icms gravado é string 12.000" |
| Rótulos literais | regras-client · "rótulos literais do protótipo" |
| Menu | menu-v2 · "42 itens"; perfis-menus.e2e · "42" e "oito permissões no módulo Fiscal" |
| Concorrência | e01-t03-concorrencia · "2 PATCH do mesmo rascunho → [200,409]"; "2 aprovações sobrepostas → [200,422]" |
| Eventos | e01-t03-eventos · "1 evento depois do commit"; "422 de segregação não emite" |
| Room | room-permissoes · "fiscal-regras exige FISCAL_REGRAS_LER"; "fiscal-empresas e fiscal-enquadramentos inalteradas" |
| Comparar | e01-t03-comparar · "mesmo código lista Alíquota (%)"; "códigos distintos → 422 REGRAS_DISTINTAS e o corpo não tem chave valor, base ou tributo" |
| BFF | bff-e01-t03 · "repassa 409 e 422"; "CSV mantém text/csv"; "ação fora da allowlist → 404 sem backend" |
| Cobertura ≥ 80% | `npm run test:cov` e `node scripts/check-coverage.mjs --min 80` |

## 14. Tasks

Comandos a partir de `F:\Projetos\AlphaCarnes\.worktrees\e01-t03`. Banco de teste dedicado (os testes truncam):

```powershell
docker compose up -d postgres
docker compose exec postgres psql -U alphacarnes -d alphacarnes -c "CREATE DATABASE alphacarnes_e01_t03"
$env:DATABASE_URL = 'postgres://alphacarnes:alphacarnes@localhost:15433/alphacarnes_e01_t03'
```

Não executar `docker compose up` do serviço `backend`. Saída esperada do `CREATE DATABASE`: `CREATE DATABASE`
ou "already exists". Cada task de código: teste, ver falhar, implementar, ver passar, commitar só os paths da
task (`git add` explícito). Não usar `git add -A`. Não commitar em outra branch.

### Task 0 — Context7 e leitura obrigatória (sem commit)

1. Context7 (`resolve-library-id` + `get-library-docs`): Drizzle 0.45 "pgTable numeric check uniqueIndex where date mode string"; NestJS 11 "ConflictException e UnprocessableEntityException com objeto"; Zod 4 "strict object enum string transform"; Next 16 route handlers. Registrar as APIs no relatório do PR (o PR não é desta sessão).
2. Ler: este plano §4–§7; `fiscal-regras` ainda não existe; `fiscal-enquadramentos.schema.ts`; `fiscal-comum.ts` L22–L90; `enquadramento-criterio.ts` L1–L7; `enquadramentos.service.ts` L702–L714; `permissoes.ts` L415–L418; `menus-canonicos.ts` L48; `menu-v2.ts` L85–L100; `room-permissoes.ts`; `realtime.gateway.ts` L173–L199; `eventos.ts` L84–L90; `test-app.ts` `cleanupDb`; `(admin)/fiscal/enquadramentos/page.tsx`.

### Task 1 — Validador de percentual

**Files:** criar `app/backend/src/modules/erp/fiscal/regras/percentual.ts`; teste `app/backend/test/unit/percentual.spec.ts`.

**Produces:** `normalizarPercentual(entrada: string): string | null` e `formatarPercentualPtBr(canon: string): string`.

Teste que falha antes da implementação:

```ts
import { formatarPercentualPtBr, normalizarPercentual } from '../../src/modules/erp/fiscal/regras/percentual';

describe('percentual', () => {
  it('normaliza vírgula para três casas e recusa faixa e float disfarçado', () => {
    expect(normalizarPercentual('41,67')).toBe('41.670');
    expect(normalizarPercentual('0')).toBe('0.000');
    expect(normalizarPercentual('100')).toBe('100.000');
    expect(normalizarPercentual('100,000')).toBe('100.000');
    expect(normalizarPercentual('100,001')).toBeNull();
    expect(normalizarPercentual('41,6789')).toBeNull();
    expect(normalizarPercentual('-1')).toBeNull();
    expect(normalizarPercentual('1e2')).toBeNull();
    expect(formatarPercentualPtBr('12.000')).toBe('12,000');
  });
});
```

```powershell
Set-Location app/backend
npx jest test/unit/percentual.spec.ts
```

Esperado antes do código: FAIL "Cannot find module". Depois: PASS. Implementar com o bloco da seção 6, sem `Number` e sem `parseFloat`.

```powershell
git add app/backend/src/modules/erp/fiscal/regras/percentual.ts app/backend/test/unit/percentual.spec.ts
git commit -m @"
feat(e01-t03): validar percentual com três casas decimais

### Descrição Detalhada:
Inclui normalização de percentual em string, de 0,000 a 100,000, com vírgula ou ponto na entrada e três casas na forma canônica.

### Motivo da Mudança:
A tela usa máscara pt-BR e o servidor precisa gravar NUMERIC sem converter para float.

### Impacto:
O DTO e a tela passam a importar estas duas funções. Nenhuma rota existe ainda.
"@
```

### Task 2 — Schema, migration 0046 e testes de banco

**Files:** o schema da seção 5, `schema/index.ts`, migration gerada, `ROLLBACK.md`, `test-app.ts`, `test/integration/e01-t03-migrations.e2e-spec.ts`.

**Consumes:** nada de rota. **Produces:** tabelas `beneficios_fiscais`, `classificacoes_ibs_cbs`, `regras_tributarias`.

O teste consulta `information_schema` e `pg_indexes` e falha enquanto as tabelas não existem:

```ts
it('catálogos nascem vazios e a regra não ganha coluna fora do contrato', async () => {
  const tabelas = await db.execute(sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('beneficios_fiscais','classificacoes_ibs_cbs','regras_tributarias')
  `);
  expect(tabelas.rows).toHaveLength(3);
  const beneficios = await db.execute(sql`SELECT COUNT(*)::int AS n FROM beneficios_fiscais`);
  const classes = await db.execute(sql`SELECT COUNT(*)::int AS n FROM classificacoes_ibs_cbs`);
  expect(beneficios.rows[0]).toMatchObject({ n: 0 });
  expect(classes.rows[0]).toMatchObject({ n: 0 });
  const colunas = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'regras_tributarias'
  `);
  const nomes = colunas.rows.map((r) => String((r as { column_name: string }).column_name));
  for (const proibida of ['csosn', 'is', 'versao_nt', 'data_comercial', 'data_fiscal', 'data_efetiva', 'nota_id', 'operacao_id', 'cfop_id']) {
    expect(nomes).not.toContain(proibida);
  }
  expect(nomes).toEqual(expect.arrayContaining(['vigencia_inicio', 'vigencia_fim', 'p_red_bc', 'p_icms', 'icms_cst', 'ibs_cst']));
});
```

Acrescentar no mesmo arquivo: insert de `icms_cst = '101'` viola `regras_icms_cst_check`; insert de benefício `SP1` viola o formato; `uq_beneficios_codigo` e `uq_regras_abertas_codigo` são parciais (`WHERE deleted_at IS NULL`); não há FK de `regras_tributarias` para `notas_fiscais` em `information_schema.referential_constraints` / `key_column_usage`.

```powershell
Set-Location app/backend
npx drizzle-kit generate --name e01_t03_regras_tributarias
$arquivo = Get-ChildItem src/database/migrations/*e01_t03*.sql
if ($arquivo.Name -notlike '0046_*') { throw "migration fora do 0046: $($arquivo.Name)" }
$novas = 'beneficios_fiscais|classificacoes_ibs_cbs|regras_tributarias'
$permitido = "^(CREATE TABLE ""($novas)""|CREATE (UNIQUE )?INDEX ""\w+"" ON ""($novas)""|ALTER TABLE ""($novas)"" ADD CONSTRAINT)"
Get-Content $arquivo.FullName -Raw |
  ForEach-Object { $_ -split '--> statement-breakpoint' } | ForEach-Object { $_.Trim() } |
  Where-Object { $_ -and $_ -notmatch $permitido }
npm run db:migrate
npx jest test/integration/e01-t03-migrations.e2e-spec.ts
```

Esperado: um SQL `0046_e01_t03_regras_tributarias.sql`; o pipeline de allowlist sem saída; migrate sem erro; testes passam. `ROLLBACK.md` ganha a seção "E01-T03" com a ordem `regras_tributarias`, `classificacoes_ibs_cbs`, `beneficios_fiscais`. `test-app.ts` trunca essas três antes de `enquadramentos_fiscais`.

```powershell
git add app/backend/src/database/schema/fiscal-regras.schema.ts app/backend/src/database/schema/index.ts app/backend/src/database/migrations/0046_e01_t03_regras_tributarias.sql app/backend/src/database/migrations/meta/_journal.json app/backend/src/database/migrations/meta/0046_snapshot.json app/backend/src/database/migrations/ROLLBACK.md app/backend/test/helpers/test-app.ts app/backend/test/integration/e01-t03-migrations.e2e-spec.ts
git commit -m @"
feat(e01-t03): schema das regras tributárias e catálogos manuais

### Descrição Detalhada:
Cria a migration 0046 com a regra versionada, o benefício fiscal e a classificação IBS/CBS, sem semente e sem colunas de nota, CSOSN, IS ou NT.

### Motivo da Mudança:
O editor precisa persistir a versão tributária ligada ao enquadramento, com percentual NUMERIC e vigência só de início e fim.

### Impacto:
O truncate dos testes passa a limpar as três tabelas antes dos enquadramentos. Nenhuma rota HTTP nova.
"@
```

### Task 3 — Permissões, parâmetro, menu canônico e snapshots

**Files:** seção 9. Inclui o teste de catálogo Fiscal com oito permissões, as cinco anteriores preservadas na ordem.

```powershell
Set-Location app/backend
npx tsx scripts/gerar-snapshot-perfis.ts
git diff -U0 -- src/common/rbac/perfil-menus.snapshot.json src/common/rbac/perfil-permissoes.snapshot.json
git diff -U0 -- src/common/rbac/menus-canonicos.ts | Select-String "^-\s+'/"
npx jest test/unit/perfil-permissoes-snapshot.spec.ts test/integration/perfis-menus.e2e-spec.ts
npm run db:seed
```

Esperado: diffs dos snapshots só sob `administrador` (+ `/fiscal/regras`, + três permissões); `Select-String` sem saída (nenhuma rota removida); testes passam com 42 menus e oito permissões Fiscais; seed sem erro. No frontend, atualizar `menu-v2.ts`, `menu-v2.test.ts` e `menu-rbac.test.ts` para 42 itens, 129 atribuições e o terceiro item do grupo. Jest desses dois arquivos no `app/frontend`.

```powershell
git add app/backend/src/common/rbac/permissoes.ts app/backend/src/common/rbac/menus-canonicos.ts app/backend/src/common/rbac/perfil-permissoes.snapshot.json app/backend/src/common/rbac/perfil-menus.snapshot.json app/backend/src/database/seed.ts app/backend/test/integration/perfis-menus.e2e-spec.ts app/frontend/src/lib/menu-v2.ts app/frontend/__tests__/menu-v2.test.ts app/frontend/__tests__/menu-rbac.test.ts
git commit -m @"
feat(e01-t03): permissões FISCAL_REGRAS_* e item no menu Fiscal

### Descrição Detalhada:
Entrega leitura, gestão e aprovação da regra só ao administrador, o parâmetro provisório H-E01-12 e o item Editor de regras tributárias em /fiscal/regras.

### Motivo da Mudança:
A aprovação segregada precisa da permissão APROVAR, e a persona do protótipo não pode virar um 12º perfil.

### Impacto:
O catálogo Fiscal passa de cinco para oito permissões. As 39 rotas operacionais e os dois itens fiscais já existentes permanecem.
"@
```

### Task 4 — DTOs Zod

**Files:** `dto/comum.dto.ts`, `dto/beneficio-fiscal.dto.ts`, `dto/classificacao-ibs-cbs.dto.ts`, `dto/regra.dto.ts`, `test/unit/fiscal-regras-dto.spec.ts`.

**Consumes:** `normalizarPercentual`. **Produces:** `criarRegraSchema`, `atualizarRegraSchema`, `acaoRegraSchema`, `novaVersaoSchema`, `beneficioFiscalSchema`, `classificacaoIbsCbsSchema`, `listarRegrasSchema`.

`comum.dto.ts` reexporta `justificativaSchema`, `versaoSchema` e `uuidSchema` com os mesmos limites de `enquadramentos/dto/comum.dto.ts` (`trim` 3–500, `versao` inteiro `>= 1`, `z.uuid()`). Percentual:

```ts
export const percentualSchema = z.string().trim().transform((valor, ctx) => {
  const canon = normalizarPercentual(valor);
  if (!canon) {
    ctx.addIssue({ code: 'custom', message: 'Informe um percentual de 0,000 a 100,000.' });
    return z.NEVER;
  }
  return canon;
});
```

Enums = as constantes do schema. Datas `z.iso.date()`. `vigenciaFim` omitido ou `>= vigenciaInicio` em `.superRefine`. Benefício: `codigo` regex `^[A-Z]{2}[0-9]{6}$`. Classificação: `^[0-9]{6}$`.

Review Focus 5, o teste do número:

```ts
it('pIcms numérico é 400', () => {
  const parsed = criarRegraSchema.safeParse({ ...corpoValido, pIcms: 12.5 });
  expect(parsed.success).toBe(false);
});

it('strict rejeita csosn, is, versaoNt e notaId', () => {
  const parsed = criarRegraSchema.safeParse({ ...corpoValido, csosn: '101', is: '00', versaoNt: '1.52', notaId: crypto.randomUUID() });
  expect(parsed.success).toBe(false);
});
```

`corpoValido` usa `pRedBc: '41,67'`, `pIcms: '12,00'`, `icmsCst: '20'`, `ipiCst: '53'`, `pisCst: '06'`, `ibsCst: '000'`. Sucesso devolve `pRedBc === '41.670'` e `pIcms === '12.000'`.

```powershell
Set-Location app/backend
npx jest test/unit/fiscal-regras-dto.spec.ts
```

Esperado: PASS, incluindo "icmsCst 101", "ipiCst 00", "pisCst 07", "ibsCst 100" e "fim < início".

```powershell
git add app/backend/src/modules/erp/fiscal/regras/dto app/backend/test/unit/fiscal-regras-dto.spec.ts
git commit -m @"
feat(e01-t03): DTOs Zod do editor de regras tributárias

### Descrição Detalhada:
Fecha os corpos de rascunho, versão, catálogo e ação com enum literal, percentual em string e strict que recusa nota, CSOSN, IS e NT.

### Motivo da Mudança:
Campo fora do contrato precisa falhar com 400 antes de qualquer regra de domínio.

### Impacto:
Os services da task seguinte passam a receber só a forma canônica do percentual.
"@
```

### Task 5 — Catálogos manuais de benefício e classificação

**Files:** controllers e services dos dois catálogos, `regras-tributarias.module.ts`, `app.module.ts`, `test/integration/e01-t03-catalogos.e2e-spec.ts`.

**Produces:** `BeneficiosFiscaisService.listar` e `.criar`; `ClassificacoesIbsCbsService.listar` e `.criar`.

O teste sobe o app, autentica administrador e:

- POST benefício `{ codigo: 'SP020450', descricao: 'Redução de base — São Paulo (SP020450)', justificativa: 'Cadastro manual de formato.' }` → 201, e a lista devolve a descrição sem uuid no texto serializado da página (o `id` pode existir na chave `id` do JSON de combo).
- Segundo POST do mesmo código → 409 e uma linha só.
- POST `{ codigo: 'SP1', ... }` → 400.
- POST classificação `000001` / "Tributação integral (000001)" → 201; duplicata → 409.
- `fetch` global do processo não é chamado (0 chamadas). O teste troca `global.fetch` por um contador.

Auditoria uma linha por POST, módulo `fiscal.regras`. Evento só depois do commit (a Task 8 afirma a ordem; aqui basta a linha existir).

```powershell
Set-Location app/backend
npx jest test/integration/e01-t03-catalogos.e2e-spec.ts
```

Esperado: PASS. Não inserir os outros códigos da fixture (SP020740, SP020100, 200003, 200036) em seed nem no teste de migration.

```powershell
git add app/backend/src/modules/erp/fiscal/regras/beneficios-fiscais.controller.ts app/backend/src/modules/erp/fiscal/regras/beneficios-fiscais.service.ts app/backend/src/modules/erp/fiscal/regras/classificacoes-ibs-cbs.controller.ts app/backend/src/modules/erp/fiscal/regras/classificacoes-ibs-cbs.service.ts app/backend/src/modules/erp/fiscal/regras/regras-tributarias.module.ts app/backend/src/app.module.ts app/backend/test/integration/e01-t03-catalogos.e2e-spec.ts
git commit -m @"
feat(e01-t03): catálogos manuais de benefício e classificação

### Descrição Detalhada:
Abre o cadastro manual de benefício fiscal e de classificação IBS/CBS, com formato, unicidade e auditoria, sem carregar a tabela nacional.

### Motivo da Mudança:
A regra só pode apontar para código que o operador conferiu, no mesmo espírito do CFOP e do NCM.

### Impacto:
O módulo passa a existir no AppModule. A tabela continua vazia até o primeiro POST.
"@
```

### Task 6 — Rascunho, versão, submissão, aprovação e aposentadoria

**Files:** `regras.controller.ts`, `regras.service.ts`, `regra-transicao.ts`, `test/unit/regra-transicao.spec.ts`, `test/integration/e01-t03-regras.e2e-spec.ts`.

**Consumes:** DTOs da Task 4, catálogos da Task 5, `exigirSegregacao`, `intervalosSobrepoem`. **Produces:** `RegrasTributariasService` com `criarRascunho`, `atualizarRascunho`, `adicionarVersao`, `submeter`, `aprovar`, `aposentar`, `listar`, `detalhar`.

`travarEnquadramento`:

```ts
export async function travarEnquadramento(tx: Tx, id: string) {
  const [linha] = await tx
    .select()
    .from(enquadramentosFiscais)
    .where(and(eq(enquadramentosFiscais.id, id), isNull(enquadramentosFiscais.deletedAt)))
    .for('no key update');
  if (!linha) throw new NotFoundException('Enquadramento fiscal não encontrado');
  if (linha.situacao !== 'ATIVA') {
    regraViolada('ENQUADRAMENTO_INDISPONIVEL', 'O enquadramento fiscal não está ativo.');
  }
  return linha;
}
```

`aprovar`, dentro da transação, depois de reler a regra com `FOR NO KEY UPDATE`:

```ts
if (linha.situacao !== 'SUBMETIDA') transicaoInvalida(linha.situacao);
exigirVersao(linha.versao, corpo.versao);
exigirSegregacao(linha.submetidoPorId, usuarioId);
const outras = await tx.select({
  codigo: regrasTributarias.codigo,
  numeroVersao: regrasTributarias.numeroVersao,
  vigenciaInicio: regrasTributarias.vigenciaInicio,
  vigenciaFim: regrasTributarias.vigenciaFim,
}).from(regrasTributarias).where(and(
  eq(regrasTributarias.enquadramentoId, linha.enquadramentoId),
  eq(regrasTributarias.situacao, 'APROVADA'),
  isNull(regrasTributarias.deletedAt),
  ne(regrasTributarias.id, linha.id),
));
for (const outra of outras) {
  if (intervalosSobrepoem(
    { inicio: linha.vigenciaInicio, fim: linha.vigenciaFim },
    { inicio: outra.vigenciaInicio, fim: outra.vigenciaFim },
  )) {
    regraViolada(
      'VIGENCIA_AMBIGUA',
      'Já existe versão aprovada deste enquadramento com vigência sobreposta. Nenhuma foi escolhida.',
      { conflito: outra },
    );
  }
}
```

O `UPDATE` só corre se o laço não lançou. `pRedBc` e `pIcms` são gravados com a string canônica do DTO.

Review Focus 1, 2 e 3, no `e01-t03-regras.e2e-spec.ts`, com dois usuários administradores (o seed de teste cria o segundo pela API de usuários, os dois com as três permissões):

```ts
it('autor com APROVAR não aprova a si mesmo', async () => {
  const criada = await criarComo(adminA);
  await submeterComo(adminA, criada.id);
  const res = await aprovarComo(adminA, criada.id);
  expect(res.status).toBe(422);
  expect(res.body.codigo).toBe('SEGREGACAO_FUNCAO');
  const detalhe = await detalharComo(adminA, criada.id);
  expect(detalhe.body.situacao).toBe('Submetida');
});

it('versão aprovada e aposentada recusam PATCH', async () => {
  const aprovada = await aprovarFluxo(adminA, adminB);
  const patch = await patchComo(adminB, aprovada.id, { pIcms: '8,000', versao: aprovada.versao });
  expect(patch.status).toBe(409);
  expect(patch.body.codigo).toBe('VERSAO_IMUTAVEL');
  expect(patch.body.codigo).not.toMatch(/NOTA/);
  const lida = await detalharComo(adminA, aprovada.id);
  expect(lida.body.pIcms).toBe('12.000');
});

it('vigências aprovadas sobrepostas no mesmo enquadramento', async () => {
  const primeira = await aprovarFluxo(adminA, adminB, { vigenciaInicio: '2026-01-01', vigenciaFim: '2026-12-31' });
  const segunda = await criarSubmeter(adminA, { enquadramentoId: primeira.enquadramentoId, vigenciaInicio: '2026-06-01', vigenciaFim: null });
  const res = await aprovarComo(adminB, segunda.id);
  expect(res.status).toBe(422);
  expect(res.body.codigo).toBe('VIGENCIA_AMBIGUA');
  const detalhe = await detalharComo(adminA, segunda.id);
  expect(detalhe.body.situacao).toBe('Submetida');
});
```

Também no mesmo arquivo: benefício com `deleted_at` → 422 `BENEFICIO_NAO_ELEGIVEL` e `COUNT(*)` de regras permanece 0; gestor → 403; quem só tem GERENCIAR → 403 no aprovar; POST não muda `enquadramentos_fiscais`, `cfops`, `ncms` nem `notas_fiscais` (comparar `updated_at` e `COUNT(*)`); GET depois de aprovar traz situação "Aprovada", Tratamento ICMS "Redução de base" quando o valor é `20`, e `pIcms` `"12.000"`; adicionar versão na aprovada cria `numeroVersao` 2 em Rascunho com o mesmo `codigo`; POST válido não devolve código que contenha `NT`; cada mutação grava uma auditoria; aposentar conserva a linha; histórico sem o texto `regras_tributarias` e sem uuid; aprovar não chama `global.fetch`.

`regra-transicao.spec.ts` cobre a tabela da seção 6 sem banco: de `APROVADA` o nome do erro de edição é `VERSAO_IMUTAVEL`; de `SUBMETIDA` é `TRANSICAO_INVALIDA`; de `RASCUNHO` a ação `aprovar` é `TRANSICAO_INVALIDA`.

```powershell
Set-Location app/backend
npx jest test/unit/regra-transicao.spec.ts test/integration/e01-t03-regras.e2e-spec.ts
```

Esperado: PASS.

```powershell
git add app/backend/src/modules/erp/fiscal/regras/regras.controller.ts app/backend/src/modules/erp/fiscal/regras/regras.service.ts app/backend/src/modules/erp/fiscal/regras/regra-transicao.ts app/backend/test/unit/regra-transicao.spec.ts app/backend/test/integration/e01-t03-regras.e2e-spec.ts
git commit -m @"
feat(e01-t03): rascunho, versão, submissão, aprovação e aposentadoria

### Descrição Detalhada:
Implementa o ciclo da regra ligada ao enquadramento, com um aprovador diferente de quem submeteu, vigência sem sobreposição entre aprovadas e versão imutável depois de aprovar ou aposentar.

### Motivo da Mudança:
O caderno exige aprovação segregada e proíbe reescrever a versão já decidida; o quórum numérico continua provisório.

### Impacto:
Dois administradores conseguem aprovar. O autor da submissão recebe 422 mesmo tendo a permissão APROVAR.
"@
```

### Task 7 — Comparação de versões

**Files:** método `comparar` no service, rota GET `regras/:id/comparar`, `test/integration/e01-t03-comparar.e2e-spec.ts`.

**Consumes:** duas linhas do mesmo `codigo`. **Produces:** `ComparacaoRegras` da seção 7.

Ordem fixa dos `campo`: Tratamento ICMS, Redução de base do ICMS (%), Alíquota (%), Benefício fiscal, Tratamento IPI, Tratamento PIS/COFINS, Tratamento IBS/CBS, Classificação IBS/CBS, Início de vigência, Fim de vigência. Valor de enum é o rótulo. Percentual passa por `formatarPercentualPtBr`. Benefício e classificação mostram `descricao`. Fim nulo aparece como "Sem fim de vigência".

```ts
it('mesmo código lista Alíquota (%)', async () => {
  const res = await comparar(versao1.id, versao2.id);
  expect(res.status).toBe(200);
  const aliquota = res.body.diferencas.find((d: { campo: string }) => d.campo === 'Alíquota (%)');
  expect(aliquota).toMatchObject({ antes: '12,000', depois: '7,000' });
  expect(JSON.stringify(res.body)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
});

it('códigos distintos → 422 REGRAS_DISTINTAS e o corpo não tem chave valor, base ou tributo', async () => {
  const res = await comparar(linhaA.id, linhaB.id);
  expect(res.status).toBe(422);
  expect(res.body.codigo).toBe('REGRAS_DISTINTAS');
  expect(res.body).not.toHaveProperty('valor');
  expect(res.body).not.toHaveProperty('base');
  expect(res.body).not.toHaveProperty('tributo');
});
```

A comparação não emite evento e não grava auditoria.

```powershell
Set-Location app/backend
npx jest test/integration/e01-t03-comparar.e2e-spec.ts
```

```powershell
git add app/backend/src/modules/erp/fiscal/regras/regras.controller.ts app/backend/src/modules/erp/fiscal/regras/regras.service.ts app/backend/test/integration/e01-t03-comparar.e2e-spec.ts
git commit -m @"
feat(e01-t03): comparação de versões da mesma regra

### Descrição Detalhada:
Compara duas versões do mesmo código campo a campo, com rótulo e percentual em pt-BR, e recusa linhagens diferentes.

### Motivo da Mudança:
A ação comparar desta tela é diferença de cadastro, distinta da memória de cálculo da fatia seguinte.

### Impacto:
A resposta não calcula imposto e não grava linha nova.
"@
```

### Task 8 — Concorrência e eventos

**Files:** o `emit` depois do commit em regras e catálogos; `eventos.ts`; `test/integration/e01-t03-concorrencia.e2e-spec.ts` e `e01-t03-eventos.e2e-spec.ts`.

Dois PATCH do mesmo rascunho com a mesma `versao`: um 200 e um 409 `CONFLITO_CONCORRENTE`. Duas aprovações de duas submetidas sobrepostas no mesmo enquadramento, em `Promise.all`: um 200 e um 422 `VIGENCIA_AMBIGUA`. O evento `regra_tributaria_alterada` chega uma vez, depois do commit, com `acao: 'aprovada'`. O 422 `SEGREGACAO_FUNCAO` não emite. O payload não contém `pIcms`, `icmsCst` nem `notaId`.

```powershell
Set-Location app/backend
npx jest test/integration/e01-t03-concorrencia.e2e-spec.ts test/integration/e01-t03-eventos.e2e-spec.ts
```

```powershell
git add app/backend/src/modules/erp/fiscal/regras/regras.service.ts app/backend/src/modules/erp/fiscal/regras/beneficios-fiscais.service.ts app/backend/src/modules/erp/fiscal/regras/classificacoes-ibs-cbs.service.ts app/backend/src/realtime/events/eventos.ts app/backend/test/integration/e01-t03-concorrencia.e2e-spec.ts app/backend/test/integration/e01-t03-eventos.e2e-spec.ts
git commit -m @"
feat(e01-t03): concorrência e evento pós-commit da regra

### Descrição Detalhada:
Serializa a aprovação no enquadramento travado e publica regra_tributaria_alterada só depois do commit, sem percentual no payload.

### Motivo da Mudança:
Duas aprovações simultâneas não podem gravar vigência ambígua, e a falha de domínio não pode parecer sucesso no tempo real.

### Impacto:
A room ainda não está protegida; a task seguinte fecha a autorização do socket.
"@
```

### Task 9 — Room protegida

**Files:** `room-permissoes.ts`, `realtime.gateway.ts`, caso novo em `room-permissoes.spec.ts`.

```ts
it('fiscal-regras exige FISCAL_REGRAS_LER e não altera as rooms anteriores', () => {
  expect(ROOMS_PROTEGIDAS['fiscal-regras']).toBe(PERMISSOES.FISCAL_REGRAS_LER);
  expect(ROOMS_PROTEGIDAS['fiscal-empresas']).toBe(PERMISSOES.FISCAL_EMPRESAS_LER);
  expect(ROOMS_PROTEGIDAS['fiscal-enquadramentos']).toBe(PERMISSOES.FISCAL_ENQUADRAMENTOS_LER);
});
```

O handler novo chama `broadcastRoom('fiscal-regras', ...)`. Não editar `publicarFiscal`.

```powershell
Set-Location app/backend
npx jest test/unit/room-permissoes.spec.ts
```

```powershell
git add app/backend/src/realtime/room-permissoes.ts app/backend/src/realtime/realtime.gateway.ts app/backend/test/unit/room-permissoes.spec.ts
git commit -m @"
feat(e01-t03): room fiscal-regras protegida por leitura

### Descrição Detalhada:
Registra a room fiscal-regras na permissão de leitura e o handler do evento, sem mexer nas rooms de empresas e enquadramentos.

### Motivo da Mudança:
O tempo real da regra não pode vazar para quem não consulta o editor nem deslocar o broadcast das fatias anteriores.

### Impacto:
Quem não tem FISCAL_REGRAS_LER não entra na room.
"@
```

### Task 10 — Histórico, exportação e pré-condições

**Files:** `exportacao-csv.ts`, rotas `historico`, `pre-condicoes`, `exportacao`, `contagens` no controller, testes acrescentados em `e01-t03-regras.e2e-spec.ts`.

CSV com BOM, `;`, e o cabeçalho exato da seção 7. Uma linha com ICMS `20` exporta a célula "Redução de base", não "20" e não "CST". Pré-condições com os seis códigos da seção 7; `DUPLA_APROVACAO` e `DATAS_COMERCIAL_FISCAL_EFETIVA` e `PERFIS_ALEM_ADMINISTRADOR` vêm `atendida: false` e `provisoria: true`. Histórico usa os resumos da seção 11.

```powershell
Set-Location app/backend
npx jest test/integration/e01-t03-regras.e2e-spec.ts
```

```powershell
git add app/backend/src/modules/erp/fiscal/regras/exportacao-csv.ts app/backend/src/modules/erp/fiscal/regras/regras.controller.ts app/backend/src/modules/erp/fiscal/regras/regras.service.ts app/backend/test/integration/e01-t03-regras.e2e-spec.ts
git commit -m @"
feat(e01-t03): histórico, exportação e pré-condições da regra

### Descrição Detalhada:
Expõe o histórico auditável, o CSV com os rótulos do grid e as pré-condições, mantendo dupla aprovação, três datas e demais perfis como provisórios.

### Motivo da Mudança:
A ficha precisa mostrar a trilha e o que ainda depende de decisão, sem tratar o selo como bloqueio de gravação.

### Impacto:
O CSV não leva identificador técnico. A pré-condição provisória não impede aprovar com um usuário diferente.
"@
```

### Task 11 — BFF `/api/erp/fiscal`

**Files:** as rotas da seção 12 e `__tests__/bff-e01-t03.test.ts`. Padrão de `app/frontend/src/app/api/erp/fiscal/cfops/route.ts`: `repassar`.

Allowlist de `[acao]`: `versoes`, `submeter`, `aprovar`, `aposentar`, `historico`, `pre-condicoes`. Fora dela, 404 e o backend não é chamado. `exportacao` repassa o `Content-Type` `text/csv; charset=utf-8`. 409 e 422 atravessam com o `codigo` do corpo.

```powershell
Set-Location app/frontend
npx jest __tests__/bff-e01-t03.test.ts
```

```powershell
git add app/frontend/src/app/api/erp/fiscal/beneficios-fiscais/route.ts app/frontend/src/app/api/erp/fiscal/classificacoes-ibs-cbs/route.ts app/frontend/src/app/api/erp/fiscal/regras app/frontend/__tests__/bff-e01-t03.test.ts
git commit -m @"
feat(e01-t03): BFF /api/erp/fiscal das regras tributárias

### Descrição Detalhada:
Encaminha lista, detalhe, catálogos, comparação, CSV e as ações do ciclo, com allowlist que barra caminho desconhecido.

### Motivo da Mudança:
A página não conversa direto com o Nest; o BFF conserva o status 400, 403, 409 e 422.

### Impacto:
Ação fora da lista responde 404 sem chegar ao backend.
"@
```

### Task 12 — Página, componentes e rótulos

**Files:** página, componentes e `lib/fiscal-regras.ts` da seção 10; `__tests__/fiscal-regras-lib.test.ts`; `__tests__/regras-client.test.tsx`.

Review Focus 5, no teste do cliente. Renderizar o drawer com os enums e afirmar:

```tsx
it('rótulos literais do protótipo', () => {
  render(<RegraDrawer aberto enquadramentos={[]} beneficios={[]} classificacoes={[]} />);
  expect(screen.getByLabelText('Tratamento ICMS')).toBeInTheDocument();
  expect(screen.getAllByRole('option', { name: 'Tributação integral' })).toHaveLength(2);
  expect(screen.getByRole('option', { name: 'Redução de base' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Isenção' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Não tributada' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Diferimento' })).toBeInTheDocument();
  expect(screen.getByLabelText('Redução de base do ICMS (%)')).toBeInTheDocument();
  expect(screen.getByLabelText('Alíquota (%)')).toBeInTheDocument();
  expect(screen.getByLabelText('Tratamento IPI')).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Saída tributada à alíquota zero' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Saída não tributada' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Outras saídas' })).toBeInTheDocument();
  expect(screen.getByLabelText('Tratamento PIS/COFINS')).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Tributação normal' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Alíquota zero' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Sem incidência' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Outras operações' })).toBeInTheDocument();
  expect(screen.getByLabelText('Tratamento IBS/CBS')).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Alíquota reduzida' })).toBeInTheDocument();
  expect(screen.getByLabelText('Benefício fiscal')).toBeInTheDocument();
  expect(screen.getByLabelText('Classificação IBS/CBS')).toBeInTheDocument();
  expect(screen.getByLabelText('Justificativa auditável')).toBeInTheDocument();
  const texto = document.body.textContent ?? '';
  expect(texto).not.toMatch(/CSOSN/);
  expect(texto).not.toMatch(/\bpICMS\b/);
  expect(texto).not.toMatch(/E01-T03/);
  expect(texto).not.toMatch(/Marca/);
});
```

O combo Tratamento IBS/CBS tem duas opções com o nome "Tributação integral" (ICMS `00` e IBS `000`). O teste acima encontra a de ICMS no primeiro combo; no de IBS, buscar também "Alíquota reduzida", que é exclusiva. Não fundir os dois combos.

O teste da lib repete `normalizarPercentual('41,67') === '41.670'` no frontend (a função é duplicada em `lib/fiscal-regras.ts` com o mesmo corpo da Task 1, para o cliente não importar código do Nest).

Também cobrir: lista vazia com a frase da seção 10; alerta do 409 `VERSAO_IMUTAVEL`; alerta do 422 `VIGENCIA_AMBIGUA`; alerta do 422 `SEGREGACAO_FUNCAO`; grade sem uuid; selos `H-E01-10`, `H-E01-11` e `H-E01-12`.

```powershell
Set-Location app/frontend
npx jest __tests__/regras-client.test.tsx __tests__/fiscal-regras-lib.test.ts __tests__/menu-v2.test.ts
```

```powershell
git add app/frontend/src/app/(admin)/fiscal/regras/page.tsx app/frontend/src/components/fiscal/regras app/frontend/src/lib/fiscal-regras.ts app/frontend/__tests__/regras-client.test.tsx app/frontend/__tests__/fiscal-regras-lib.test.ts
git commit -m @"
feat(e01-t03): página do editor de regras no grupo Fiscal

### Descrição Detalhada:
Publica /fiscal/regras com os rótulos e as opções literais do protótipo, o ciclo de versão e os selos provisórios já abertos.

### Motivo da Mudança:
A tela precisa ser operável no DS v3 sem abreviar CST, alíquota ou classificação e sem mostrar código de épico.

### Impacto:
O grupo Fiscal ganha o terceiro item. Nenhuma rota operacional sai do menu.
"@
```

### Task 13 — Playwright: jornada, acesso e rótulos

**Files:** `e2e/helpers/e01-t03-seed.ts`, `e2e/e01-t03-regras.spec.ts`.

O seed cria, pela API: dois administradores; um estabelecimento aprovado pela API da T01; produto, cliente e operação pelas APIs existentes; CFOP `5102` e NCM `02013000` pela API da T02; um enquadramento `ATIVA` pela API da T02; benefício `SP020450` e classificação `000001` pela API desta fatia. Esses códigos são entrada do operador no teste, não `INSERT` da migration.

Backend no host, não no container `alphacarnes-backend-1`:

```powershell
$env:DATABASE_URL = 'postgres://alphacarnes:alphacarnes@localhost:15433/alphacarnes_e01_t03'
$env:PORT = '4001'
Set-Location app/backend
npm run start
```

Frontend: o `webServer` de `playwright.config.ts` (`npx next dev --webpack --port 3100`). Não apontar `E2E_FRONTEND_URL` para a porta 4000. Não usar Turbopack.

Jornada (admin A e admin B):

1. Menu FISCAL → "Editor de regras tributárias". Os itens "Empresas, estabelecimentos e regime" e "Operações fiscais e enquadramentos" continuam visíveis.
2. Novo benefício e nova classificação pelo diálogo, com o aviso "Cadastro manual. A tabela oficial completa não está carregada; confira o código na documentação fiscal."
3. Criar rascunho: Enquadramento fiscal do seed, Operação e Operação fiscal (CFOP) preenchidos por ele, Tratamento ICMS "Redução de base", Redução de base do ICMS (%) `41,67`, Alíquota (%) `12,00`, Benefício fiscal da descrição gravada, Tratamento IPI "Saída não tributada", Tratamento PIS/COFINS "Alíquota zero", Tratamento IBS/CBS "Tributação integral", Classificação IBS/CBS da descrição gravada, Início de vigência `2026-01-01`, justificativa "Regra inicial da vigência de 2026."
4. A ficha mostra o código numérico, situação Rascunho e os selos H-E01-10, H-E01-11 e H-E01-12.
5. Admin A submete. Admin A aprova e vê "A aprovação deve ser feita por usuário diferente de quem submeteu." A situação permanece Submetida.
6. Admin B aprova. Situação Aprovada. PATCH visual não existe: "Editar versão" não está na ficha aprovada.
7. Adicionar versão com Alíquota (%) `7,00` e início `2027-01-01`. Comparar mostra "Alíquota (%)" com antes `12,000` e depois `7,000`.
8. Trocar o CFOP do drawer para outro código e salvar → alerta `ENQUADRAMENTO_DIVERGENTE` e a grade não ganha linha.
9. Gestor: o item não aparece; `goto('/fiscal/regras')` mostra "Você não tem permissão para visualizar o editor de regras tributárias."

Acessibilidade, sem dependência nova: todo `textbox`, `combobox` e `button` visível tem nome acessível não vazio; Tab até a linha e Enter seleciona; diálogos fecham com Escape e devolvem o foco; `innerText` do `body` sem UUID (`/[0-9a-f]{8}-[0-9a-f]{4}-/i`), sem `/E\d{2}-T\d{2}/` e sem a palavra `Marca`.

```powershell
Set-Location app/frontend
npx playwright test e2e/e01-t03-regras.spec.ts
```

Esperado: todos passam. Playwright não é job do `ci.yml`.

```powershell
git add app/frontend/e2e/e01-t03-regras.spec.ts app/frontend/e2e/helpers/e01-t03-seed.ts
git commit -m @"
test(e01-t03): Playwright da jornada, acesso e rótulos

### Descrição Detalhada:
Cobre a jornada de dois administradores, a recusa do autor, a comparação da alíquota e a ausência do item para quem não tem a permissão.

### Motivo da Mudança:
O aceite da fatia exige a tela no webpack da porta 3100, com os rótulos do protótipo e sem código de épico.

### Impacto:
O spec não altera shell-ds e não sobe o backend em container.
"@
```

### Task 14 — Screenshots comparativos

**File:** `e2e/capture-e01-t03-evidencias.spec.ts`, no padrão de `capture-e01-t02-evidencias.spec.ts`: elemento-chave antes de cada captura, fail-hard. Viewport 1280×800, `fullPage`.

Pares em `docs/evidencias/e01-t03/` (`app-<estado>.png` e `prototipo-<estado>.png`), protótipo em
`file:///<worktree>/docs/prototipos/erp-integrado-v1/index.html#E01-T03`:

1. lista
2. ficha
3. movimentacoes
4. regras
5. excecoes
6. historico
7. integracoes
8. aceite
9. drawer

Só app: `vazio`, `erro-retry`, `403`, `comparar`, `beneficio-nao-elegivel`, `vigencia-ambigua`, `segregacao`, `dialogo-beneficio`.

```powershell
Set-Location app/frontend
npx playwright test e2e/capture-e01-t03-evidencias.spec.ts
(Get-ChildItem ../../docs/evidencias/e01-t03 -Filter *.png).Count
```

Esperado: 26 arquivos (9 pares + 8).

```powershell
git add app/frontend/e2e/capture-e01-t03-evidencias.spec.ts docs/evidencias/e01-t03
git commit -m @"
test(e01-t03): evidências visuais do editor de regras

### Descrição Detalhada:
Grava os pares da tela contra o protótipo e os estados só da aplicação: vazio, erro, acesso negado, comparação e os três alertas de domínio.

### Motivo da Mudança:
O Portão 2 precisa comparar a tela real com o hash E01-T03 sem executar o simulador.

### Impacto:
São 26 PNG. Eles não substituem o Playwright da task anterior.
"@
```

### Task 15 — Gate local, sem push e sem PR

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

Esperado: comandos verdes; cobertura ≥ 80% linha e branch; o diff contra `develop` contém a E01-T01 e a E01-T02 já presentes na branch e os arquivos desta fatia; nenhum path fora da seção 12 foi modificado por commit desta fatia (T01 e T02 não são revertidas); `git status` limpo. Não executar `git push` nem `gh pr create`. Não editar `docs/execucao/**`. Não editar `e2e/shell-ds.spec.ts`.

## 15. Gate e evidências para o Portão 2/A

- Relatório no formato `pipeline-execucao.md` §7: task a task, saídas de teste e Playwright, cobertura, APIs do Context7. O Executor registra a onda em `EXECUCAO-STATUS.md` ao disparar (AD-22 (5)); o Worker não edita esse arquivo.
- Portão 2 compara os pares `app-*`/`prototipo-*` (Task 14), confere as remoções da seção 4 e reexecuta Playwright e os testes de menu (39 operacionais + 3 do Fiscal).
- Portão A obrigatório (classe alto).
- CI dos oito jobs e o PR ficam para o fim do lote, fora deste plano.

## 16. Rollback

Seção "E01-T03" de `ROLLBACK.md`, nesta ordem:

```sql
DROP TABLE IF EXISTS regras_tributarias;
DROP TABLE IF EXISTS classificacoes_ibs_cbs;
DROP TABLE IF EXISTS beneficios_fiscais;
```

Não derrubar `enquadramentos_fiscais`, `cfops`, `ncms`, `estabelecimentos` nem `empresas`. Reverter o parâmetro `fiscal.regras_perfis_autorizados`, as três permissões e o item de menu no mesmo revert da fatia. O parâmetro `fiscal.enquadramentos_perfis_autorizados` fica.

## 17. Critérios de parada (PARAR e reportar ao coordenador)

- `drizzle-kit` gerar migration com prefixo diferente de `0046`.
- O allowlist da Task 2 imprimir algum statement.
- Necessidade de coluna CSOSN, IS, NT, data comercial/fiscal/efetiva, quórum numérico ou FK para nota para fazer um teste passar.
- Necessidade de editar `shell-ds.spec.ts`, `docs/execucao/` ou schema da T01/T02.
- Fonte ausente, ambígua ou contraditória que este plano não tenha resolvido na seção 3.

## 18. Pendências e dependências (nenhuma decisão inventada)

| Id | O que falta decidir | Quem decide | O que não fazer até lá | O que esta fatia faz |
|---|---|---|---|---|
| H-E01-10 | Três datas comercial, fiscal e efetiva | Quality Owner | colunas extras de data | só `vigencia_inicio` e `vigencia_fim`; selo Provisório |
| H-E01-11 | Quantos aprovadores formam quórum | Quality Owner | exigir dois aprovadores ou um número | um aprovador diferente de quem submeteu; pré-condição provisória; sem permissão nova de quórum |
| H-E01-12 | Quais dos 11 perfis, além do administrador, recebem `FISCAL_REGRAS_*` | Quality Owner | atribuir a outros perfis ou criar perfil fiscal/contador | seed só administrador; parâmetro `provisorio: true`; edição em `/admin/perfis` |

Não há id de hipótese na fonte para a tabela nacional de CST, para o cBenef da UF nem para o cClassTrib oficial. Por isso esta fatia não cunha id. O diálogo do código manual avisa que a tabela oficial não está carregada.

E01-T04 recebe simulador, memória, exportar memória e lançamento fiscal. E01-T05 recebe painel, rejeitar, publicar e cenários de regressão. E02 recebe a nota.

## 19. Self-review

- Cobertura do Caderno B L72–L80: campos em D3–D8 e na Task 12; ações em D9, D10 e na Task 6; exceções em D14, D15 e D16; DoD na seção 13. T04, T05 e E02 estão na seção 0 como fora.
- Lacunas: cada task traz o teste, o comando e a saída esperada. Nenhuma task delega o código a outra.
- Tipos: `normalizarPercentual` devolve `string | null` na Task 1 e o DTO da Task 4 consome essa string canônica. `ComparacaoRegras.diferencas[].campo` usa os rótulos da Task 7, os mesmos da Task 12. Situações do schema são as de D9.
- Review Focus: as cinco entradas têm teste na Task 6 (1, 2 e 3), na Task 2 (4) e nas Tasks 12 e 4 (5).
- Rótulos conferidos em componentes.js L324, L336, L347, L360, L372, L384, L396, L408, L420 e nos pares L1802–L1864 e L2700–L2732.
