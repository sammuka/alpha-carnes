# E01-T04 — Simulador fiscal e memória de cálculo — Plano de Implementação (fatia E2E, rito AD-22)

> Para workers agênticos: papel `worker` (AGENTS.md "Papéis"). Worktree
> `F:\Projetos\AlphaCarnes\.worktrees\e01-t04`, branch `feature/erp-e01-t04-simulador-memoria`,
> já posicionada sobre a ponta da E01-T03 (ainda fora da `develop`). Não rebase em `develop`, não faça
> checkout da branch da T01, da T02 nem da T03, não cherry-pick para elas, não dê `git push` e não abra PR.
> Estado do git é lido por comando no momento do uso; este plano não afirma HEAD, contagem de commits
> nem SHAs (AD-22 (4)).

## Histórico de revisões

| Rev. | Data | Autor | Motivo |
|---|---|---|---|
| r1 | 2026-10-15 | planner | versão inicial da fatia E01-T04 |
| r2 | 2026-10-15 | planner (nova instância) | Portão 1 r1 `ajustar` (4 achados); ajuste cirúrgico: nenhum outro ponto do plano muda |

| Achado r1 | Correção r2 |
|---|---|
| A Task 11 manda o painel afirmar o rótulo "Redução de base" | A asserção usa "Redução de base do ICMS (%)" (componentes.js). "Redução de base" continua só o valor do Tratamento ICMS 20 |
| §10 (KPI "Base diferente") e a Task 12 ("banner da base diferente") abreviam a exceção | KPI e banner dizem "Base tributável difere de valor bruto" (catalogo.js). A aba Exceções não muda |
| §4 troca o rodapé do drawer por "Simular" e retira "Salvar rascunho" | O rodapé é "Salvar rascunho" (aplicacao.js; sai só a palavra ilustrativo). "Simular" continua ação de processo. O clique grava CALCULADA, sem situação rascunho. A Task 12 clica nesse botão |
| §4 e o getByLabelText da Task 11 usam "Justificativa auditável" | O rótulo visível é "Motivo da alteração" (aplicacao.js). A ficha E01-T04 não inclui a chave justificativa. A exigência de 3 a 500 caracteres permanece |

**Goal:** persistir a simulação fiscal de um item e a memória de cálculo que a explica — simular, explicar
tributos, exportar memória e comparar versões de cálculo — usando a regra tributária `APROVADA` já gravada
na T03, com decimal exato, na página `/fiscal/simulador` (DS v3, grupo Fiscal já existente) → BFF
`/api/erp/fiscal` → NestJS → PostgreSQL → evento pós-commit. Nenhum valor simulado vira lançamento fiscal
nem documento.

**Architecture:** módulo Nest `SimulacoesFiscaisModule` em `app/backend/src/modules/erp/fiscal/simulacoes/`
(Caderno B L90), ao lado de `RegrasTributariasModule`. Não o substitui e não edita o service dele. Schema
Drizzle novo `fiscal-simulacoes.schema.ts`, uma linha por versão de memória. O serviço trava o enquadramento,
resolve a única regra `APROVADA` cuja vigência cobre o dia 1º da competência, calcula valor líquido, base e
ICMS com `bigint` e grava a memória. Quantidade e peso ficam registrados e não entram na multiplicação.
`AuditoriaService.registrar` na mesma transação. `EventEmitter2.emit` só depois do commit. Página App Router
`app/frontend/src/app/(admin)/fiscal/simulador/page.tsx`.

**Tech Stack (constituição L60):** NestJS 11 + TypeScript 5 strict, Next.js 16 App Router, PostgreSQL 18 +
Drizzle ORM 0.45 / drizzle-kit 0.31, Zod 4, WebSocket `ws`, JWT + RBAC 11 perfis, Jest, Playwright. Nenhuma
dependência nova.

**Classe de risco: ALTO** (AD-22 (6)): (1) permissão nova e item de menu — "RBAC/autorização"; (2) a memória
calcula tributo a partir de regra aprovada — "fiscal". Rito completo: revisão crítica por commit, Portão 2 e
Portão A. CI dos oito jobs, push e PR ficam fora desta fatia.

**Spec:** Caderno B §E01-T04 (`docs/expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md` L82–L90); matrizes
`docs/prototipos/erp-integrado-v1/MATRIZ-UX-COMPONENTES-61-TELAS.md` L103–L129 e
`MATRIZ-INTEGRAL-INTERFACES.md` L47–L53; protótipo `docs/prototipos/erp-integrado-v1/index.html#E01-T04`
(o HTML só carrega `catalogo.js`, `componentes.js` e `aplicacao.js`).

---

## 0. Escopo da fatia

Entra:

- Simulação de um item e a memória que a explica, ligada a um enquadramento `ATIVA` e à regra `APROVADA`
  já persistida na T03 cuja vigência cobre o dia 1º da competência.
- Campos do contrato de tela: Estabelecimento, Operação, Cliente, Produto, Classificação fiscal (NCM),
  Quantidade, Peso informado na nota (kg), Valor, Desconto, Competência, Enquadramento fiscal,
  Base tributável (calculada), Valor líquido (calculado), Justificativa auditável.
- Ações: simular, explicar tributos, exportar memória, comparar versões de cálculo.
- Decimal exato, sem `float`. Percentual da regra continua razão `NUMERIC(5,4)` (`0.0500` = 5%).
- Página nova no grupo Fiscal, BFF, Jest, Playwright e screenshots descritos nas Tasks 12 e 13.
- Permissões novas só no `administrador`, com selo Provisório `H-E01-12`.

Sai, com dono:

- Painel de homologação, revisar diff de publicação, aprovar/rejeitar publicação, publicar regra, cenários
  de regressão, auditoria de publicação → E01-T05 (Caderno B L92–L100; MATRIZ-UX L131–L139; MATRIZ-INTEGRAL L55–L61).
- NF-e, SEFAZ, XML, DANFE, chave, protocolo, nota emitida como domínio novo → E02 (Caderno B L103–L153).
  Não criar tabela de nota e não acrescentar coluna nem FK em `notas_fiscais` nem em `notas_fiscais_fornecedor`.
- Recriar regra tributária, enquadramento, CFOP, NCM, empresa ou estabelecimento. Essas tabelas e módulos
  permanecem como a T01, a T02 e a T03 os deixaram. Não há `POST` de regra, benefício ou classificação nesta fatia.
- Aprovar ou aposentar regra. O simulador só lê versão `APROVADA`. `H-E01-11` permanece: não há quórum numérico
  e não há permissão `FISCAL_SIMULACOES_APROVAR`.

## 1. Global Constraints

- Constituição: Princípios I (L9), II (L20), III (L24), IV (L28), VI (L36), VII (L40), VIII (L44), IX (L48),
  X (L52); stack fixa (L60); sem over-engineering (L61); cobertura backend ≥ 80% linha e branch (L63).
- AGENTS.md: pwsh 7, nunca bash; worker não edita `docs/execucao/`; esta fatia não integra em `develop`.
- AD-04 (L11, 11 perfis); AD-10 (L17, DS v3); AD-12 (L19, Zod é 400); AD-13 (L20, código de negócio
  imutável; a palavra "Marca" continua banida); AD-15 (L22, 39 rotas operacionais); AD-18 (L25 (2) protótipo
  integral e (5) personas não viram perfis); AD-22 (L29); AD-24 (L31, grupo Fiscal e estabelecimento já
  entregues — não recriar).
- `docs/data/convencoes-schema.md` L14–L16: uuidv7, TIMESTAMPTZ, status TEXT+CHECK, soft delete, índice em
  toda FK. Dinheiro `NUMERIC(15,2)`. Peso `NUMERIC(10,3)`. Quantidade desta tela `NUMERIC(15,3)`, a mesma
  precisão de `pedidos.quantidade_pedida`. Alíquota e redução continuam na regra como `NUMERIC(5,4)` em
  razão (`0.0500` = 5%). Nunca `double precision` e nunca `float` no TypeScript. `updated_at` pelo serviço,
  sem trigger e sem SQL manual (padrão das migrations 0044, 0045 e 0046).
- UI nunca exibe UUID, PK, código E##/ALP nem nome de tabela (MATRIZ-UX L129). A palavra "Marca" não
  aparece como rótulo, entidade, coluna ou texto de busca (Princípio IX). O cliente visível é Nome Fantasia,
  com razão social só quando o nome fantasia está vazio.
- A próxima migration é `0047`. O diretório `app/backend/src/database/migrations/` termina em
  `0046_e01_t03_regras_tributarias.sql` e o journal tem a tag `0046_e01_t03_regras_tributarias`. Se o
  `drizzle-kit` gerar outro prefixo, parar (seção 17).
- Playwright futuro sobe o Next com `npx next dev --webpack --port 3100` (já em
  `app/frontend/playwright.config.ts` L49). Nunca Turbopack e nunca a porta 4000. Banco dedicado
  `alphacarnes_e01_t04` em `localhost:15433`. Não subir o container `alphacarnes-backend-1`.
- Não editar `app/frontend/e2e/shell-ds.spec.ts`. O grupo Fiscal já existe; só entra o item novo.
- `H-E01-10` continua só início e fim de vigência da regra (e do enquadramento, colunas já existentes).
  A competência do filtro da tela não vira coluna comercial, fiscal ou efetiva.

## Review Focus

Cinco entradas que a spec deixa fáceis de errar, e o teste que as prende:

1. Valor `10,05`, desconto `0,00` e regra com redução `0.0000` e alíquota `0.1200` — o esperado é ICMS
   `1.21` (meio para cima no resto 6000), não `1.20` e não um float `1.206`; corpo com valor numérico ou
   `"1e2"` responde 400 e não grava (Task 1, `decimal-memoria` · "10,05 com alíquota 12,00 gera ICMS 1.21";
   Task 4, `fiscal-simulacoes-dto` · "valor numérico é 400").
2. Valor `1.000,00`, desconto `0,00` e redução `0.4167` — o esperado é 201, base `583.30`, ICMS `70.00`,
   situação Calculada e o texto da explicação citando os dois valores; a diferença não é 422 e não apaga
   a memória (Task 5, `e01-t04-simulacoes` · "base tributável diferente do valor bruto grava a memória").
3. Simulação válida com regra aprovada — o esperado é uma linha em `simulacoes_fiscais` e nenhuma linha
   nova em `notas_fiscais` nem em `notas_fiscais_fornecedor`, sem FK para essas tabelas e sem chave, XML,
   protocolo ou DANFE no corpo (Task 5, `e01-t04-simulacoes` · "simulação não grava nota nem documento";
   Task 2, `e01-t04-migrations` · "sem FK para nota").
4. Competência `2026-10` com a única regra aprovada começando em `2026-11-01` — o esperado é 422
   `FALTA_REFERENCIA_LEGAL`, zero linhas, e `information_schema.columns` de `simulacoes_fiscais` sem
   `data_comercial`, `data_fiscal` e `data_efetiva` (Task 5, `e01-t04-simulacoes` · "competência fora da
   vigência não grava"; Task 2, `e01-t04-migrations`).
5. A ficha e o drawer — o esperado é os rótulos literais da seção 4, a linha Tratamento IPI com a frase
   de D7 e sem `0,00`, e o texto visível sem UUID, sem `E01-T04`, sem `Marca`, sem `CST` e sem `pICMS`
   (Task 11, `simulacoes-client` · "rótulos literais do protótipo").

---

## 2. Decisões fixadas (com fonte)

| # | Decisão | Fonte |
|---|---|---|
| D1 | A fatia grava a memória de uma simulação e permite explicar, exportar e comparar versões dessa memória. Não publica regra, não aprova regra e não emite documento | Pedido da fatia; Caderno B L84; catalogo.js L234 |
| D2 | Uma simulação é um item. Não há tabela filha de itens. "Tributos por item" é a linha de ICMS dessa memória | Caderno B L83; componentes.js L3157–L3174 (uma seção, um produto) |
| D3 | O combo "Enquadramento fiscal" lista enquadramentos `ATIVA` pelo código de negócio. O corpo não traz `regraId`. O serviço resolve a regra | componentes.js L310–L320 (rótulo "Enquadramento fiscal", source `regrasFiscais`); MATRIZ-UX L125. O source do protótipo não é um segundo cadastro |
| D4 | Estabelecimento, Operação, Cliente, Produto e Classificação fiscal (NCM) do corpo têm de ser os FKs do enquadramento travado. Divergência → 422 `ENQUADRAMENTO_DIVERGENTE`, mensagem "Estabelecimento, operação, cliente, produto e classificação fiscal (NCM) precisam ser os do enquadramento selecionado." Enquadramento ausente → 404. Enquadramento inativo, removido ou cuja vigência não cobre o dia 1º → 422 `ENQUADRAMENTO_INDISPONIVEL` | MATRIZ-UX L115–L119 e L125; `enquadramentos_fiscais` L54–L71; pedido da fatia (não recriar enquadramento) |
| D5 | Cliente visível: `nome_fantasia` com `btrim` não vazio; senão `razao_social`. Produto visível: `produtos.nome`. Estabelecimento visível: `estabelecimentos.nome`. Operação visível: `operacoes.rotulo`. NCM visível: `"{codigo} — {descricao}"`. Enquadramento visível: `enquadramentos_fiscais.codigo` | componentes.js L51, L190, L262, L274, L298; clientes.schema.ts L13–L14; Princípio IX |
| D6 | Cadastros usados na conta precisam estar disponíveis: estabelecimento `APPROVED` e não removido; cliente `ativo` e não removido; produto `ativo` e não removido; NCM e operação não removidos. Operação `fechada` ainda serve, porque o rótulo é o da linha do enquadramento. Falha → 422 com código `ESTABELECIMENTO_INDISPONIVEL`, `CLIENTE_INDISPONIVEL`, `PRODUTO_INDISPONIVEL`, `NCM_INDISPONIVEL` ou `OPERACAO_INDISPONIVEL` | MATRIZ-UX L115–L119 "cadastro ativo"; fiscal-empresas.schema.ts L65–L66; clientes.schema.ts L29; produtos.schema.ts L31 |
| D7 | A única alíquota persistida é `p_icms`, e a única redução é `p_red_bc`, ambas já na regra como razão. O ICMS é calculado. IPI, PIS/COFINS e IBS/CBS aparecem pelo rótulo do tratamento e pela frase "Esta regra não guarda alíquota deste tributo; nenhum valor é calculado." Não se grava `0.00` para esses tributos e não se cria coluna de valor deles | Caderno B L83 "tributos por item"; fiscal-regras.schema.ts (só `p_red_bc` e `p_icms`); componentes.js L370–L404 |
| D8 | Conta, só com `bigint`, meio para cima no resto `>= 5000` da escala 4. `valor_liquido = valor - desconto`. `base = valor_liquido × (1 - p_red_bc)`. `icms = base × p_icms`. Quantidade e peso não multiplicam. Desconto maior que o valor → 422 `DESCONTO_MAIOR_QUE_VALOR` e zero linhas. Os três exemplos canônicos estão na seção 6 | Caderno B L85 "Decimal exato"; convencoes-schema.md L14–L16; pedido da fatia |
| D9 | "Base tributável difere de valor bruto" não bloqueia. O flag `base_difere_bruto` é verdadeiro quando `base_tributavel <> valor`. A explicação traz o parágrafo de D8. A situação continua `CALCULADA` | Caderno B L86; MATRIZ-UX L110; catalogo.js L236. A fixture do épico usa redução 41,67% (aplicacao.js L245), então a diferença é o caso normal |
| D10 | Competência é `varchar(7)` `YYYY-MM`. O dia de consulta é `YYYY-MM-01`, usado só na comparação com `vigencia_inicio` / `vigencia_fim` da regra e do enquadramento. Não é coluna e não se chama data comercial, fiscal ou efetiva. Regra que começa no dia 15 não cobre a competência daquele mês. Selo `H-E01-10` | componentes.js L478–L488 (type `month`, rótulo "Competência"); Caderno B L85 contra o pedido da fatia; H-E01-10 |
| D11 | Referência legal é a citação da regra `APROVADA` coberta: código, número da versão, início, fim, descrição do benefício e descrição da classificação. Zero regras → 422 `FALTA_REFERENCIA_LEGAL` e zero linhas. Duas ou mais → 422 `REFERENCIA_AMBIGUA` e zero linhas. Rascunho, submetida e aposentada não citam | Caderno B L86 "falta referência legal"; regras com situação `APROVADA` (T03 D9) |
| D12 | Situação da memória: só `CALCULADA`, rótulo "Calculada". Não há rascunho, submissão, aprovação nem publicação. `PATCH` → 409 `VERSAO_IMUTAVEL`, mensagem "A memória calculada não pode ser alterada. Inclua uma versão nova." Não há `DELETE` | Caderno B L84 (as quatro ações); pedido da fatia |
| D13 | Versão nova reusa o `codigo`, soma `numero_versao` e pode alterar quantidade, peso, valor, desconto e competência. O enquadramento permanece o da origem. Outro enquadramento → 422 `LINHAGEM_ENQUADRAMENTO_FIXO`, mensagem "A versão nova permanece no mesmo enquadramento fiscal." A competência nova resolve de novo a regra e pode apontar outra versão de regra | Caderno B L84 "comparar versões"; Caderno B L85 "histórico de versões" |
| D14 | Comparar exige duas memórias do mesmo `codigo`. Diferença de código → 422 `SIMULACOES_DISTINTAS`, mensagem "A comparação exige duas versões da mesma simulação." Não emite evento e não grava auditoria | Caderno B L84. O comparar de regras da T03 permanece em `/fiscal/regras/:id/comparar` e não é reescrito |
| D15 | Permissões novas `FISCAL_SIMULACOES_LER` e `FISCAL_SIMULACOES_GERENCIAR`, só no `administrador`, fora de `LEITURA_CADASTROS`. Não existe `FISCAL_SIMULACOES_APROVAR`. Persona "fiscal/contador" não vira perfil. Selo `H-E01-12`. As permissões `FISCAL_EMPRESAS_*`, `FISCAL_ENQUADRAMENTOS_*` e `FISCAL_REGRAS_*` não mudam de perfil | AD-04 L11; AD-18 L25 (5); catalogo.js L232; H-E01-12; pedido da fatia |
| D16 | Zod → 400 (AD-12 L19). Regra de domínio → 422. Versão imutável e corrida no código → 409. Sem permissão → 403. 5xx sem SQL e sem stack. Não há estado `pending` nem `reconcile`: esta fatia não chama SEFAZ nem banco | AD-12 L19; Caderno B L86; pedido da fatia |
| D17 | `codigo` numérico da linhagem, gerado no backend, imutável, único com `numero_versao` entre não removidos. A coluna `versao` é o lock otimista da linha, distinta de `numero_versao`. UUID não é rótulo | Caderno B L83 "código de negócio"; AD-13 L20 |
| D18 | Justificativa trim 3–500 em simular e em versão nova. O `saveForm` do protótipo recusa justificativa vazia | componentes.js L418–L422 (`required: false`); aplicacao.js L451; MATRIZ-UX L105 |
| D19 | Menu: o grupo `FISCAL` permanece na 8ª posição. Quarto item "Simulador fiscal e memória de cálculo" (catalogo.js L226), href `/fiscal/simulador`, `permissao: 'FISCAL_SIMULACOES_LER'`, `iconKey: 'PieChart'` (já em `ICON_MAP`, `app-sidebar.tsx` L90). A rota do catálogo `/erp/fiscal/e01-t04` (catalogo.js L231) não entra na UI. 39 rotas operacionais intactas. `MENUS_ERP` passa a 4. Total 43. Atribuições `129 + 1 = 130` | catalogo.js L225–L231; AD-15 L22; AD-24 L31 (1); `menus-canonicos.ts` L48; `menu-rbac.test.ts` L73 |
| D20 | API Nest sob `/fiscal`. BFF sob `/api/erp/fiscal`. Combos reusam os GET já existentes. Não há BFF novo de cadastro | Caderno B L90 |
| D21 | Room WS `fiscal-simulacoes` exige `FISCAL_SIMULACOES_LER`. As rooms `fiscal-empresas`, `fiscal-enquadramentos` e `fiscal-regras` não mudam. Evento só depois do commit. 409 e 422 não emitem. O payload não leva valor, base, ICMS nem id de nota | Princípio VI; Caderno B L86 |
| D22 | Dois `POST` iguais criam dois códigos. Não há chave de idempotência: a repetição não é documento fiscal, e um índice único dos insumos esconderia uma segunda memória legítima | Caderno B L85 "nenhum valor gerado vira lançamento"; a frase de integração externa do L86 não cria idempotência de nota |
| D23 | "Hoje" não é coluna. Competência é string `YYYY-MM`. Vigências lidas da regra e do enquadramento continuam `date` em `YYYY-MM-DD` | componentes.js L478; T03 D23 |
| D24 | Concorrência da versão nova: `pg_advisory_xact_lock(hashtext('simulacoes_fiscais.versao.' \|\| codigo))` antes de ler o `MAX(numero_versao)`. As duas requisições concluem 201, com números 2 e 3. Não se devolve 409 para a segunda versão | MATRIZ-UX L108 "conflito concorrente" cabe ao `PATCH`, que é 409 `VERSAO_IMUTAVEL` |
| D25 | A explicação e o CSV da memória leem a regra pelo `regra_id` gravado. Não copiam `p_icms` para a simulação. A versão `APROVADA` já é imutável na T03 | fiscal-regras.schema.ts; T03 D9 |
| D26 | Pré-condição `DUPLA_APROVACAO` continua `atendida: false`, `provisoria: true`, selo `H-E01-11`. Não há botão Aprovar nem Publicar. Um administrador com `GERENCIAR` simula sozinho | H-E01-11; Caderno B L92–L95 são a T05; pedido da fatia |

## 3. Conflitos de fonte resolvidos

| # | Conflito | Resolução |
|---|---|---|
| C1 | Caderno B L83 "data, pesos, vProd" × matriz com Competência, Quantidade, Peso informado na nota (kg) e Valor | D10 e a seção 4. Não há campo com rótulo "vProd" nem uma terceira data. Valor é o vProd |
| C2 | Caderno B L85 "separar datas comercial/fiscal/efetiva" × competência `month` e vigência só início/fim | D10 e H-E01-10. A competência não vira essas colunas |
| C3 | Caderno B L86 "validação 422" × AD-12 (Zod é 400) | D16 |
| C4 | Caderno B L86 "falta referência legal" × regra sem coluna de texto legal | D11. A citação é a versão aprovada. Sem coluna nova de legislação |
| C5 | Caderno B L86 "base tributável difere de valor bruto" como fluxo negativo × redução 41,67% da matriz do épico | D9. A diferença é explicada e gravada. Não é 422 |
| C6 | DoD genérico "dupla aprovação quando exigida" × esta tela não aprova | D26 e H-E01-11. Simular não exige segundo usuário |
| C7 | catalogo.js L232 persona "fiscal/contador" × 11 perfis | D15 e H-E01-12. O subtítulo não imprime a persona como perfil |
| C8 | Rota do catálogo `/erp/fiscal/e01-t04` (catalogo.js L231) × proibição de código na UI | D19 `/fiscal/simulador` |
| C9 | componentes.js L3223 `requiresReason: false` × aplicacao.js L451, que recusa justificativa vazia | D18. Simular e versão nova exigem justificativa 3–500 |
| C10 | aplicacao.js L449 aceita até três casas em dinheiro × máscara `R$ #.##0,00` (componentes.js L463) e `NUMERIC(15,2)` | D8. Terceira casa em Valor ou Desconto é 400. Quantidade e peso aceitam três casas e recusam a quarta |
| C11 | Painel "Matriz de enquadramentos" com "Simular cálculo fiscal", "Comparar regras por vigência", "Submeter classificação" e "Exportar memória de cálculo" (aplicacao.js L243–L254) × as quatro ações desta tela | Remoção autorizada do painel, igual à T03. Os botões reais são os da seção 4, não os do épico. "Comparar regras por vigência" e "Submeter classificação" não entram |
| C12 | Caderno B L86 "pending/reconcile" e "serviço externo indisponível" × ausência de SEFAZ nesta fatia | D16. O estado de tela "serviço externo indisponível" é a falha do próprio backend, com "Tentar novamente". Sem coluna de pendência externa |
| C13 | componentes.js L3155–L3174 inclui base e valor líquido na ficha × campos calculados | São somente leitura, desabilitados no drawer, fora do `POST`. O servidor é a única origem |

## 4. Referência do protótipo e fidelidade

`index.html` não contém markup da tela. O hash `#E01-T04` é resolvido por `aplicacao.js`. Fonte visual: DS v3
(AD-10) + esse contrato.

| Elemento | Fonte (arquivo:linha) | Implementação real |
|---|---|---|
| Metadados | catalogo.js L225–L237 | título "Simulador fiscal e memória de cálculo"; subtítulo = as quatro ações + "Acesso típico" com `BadgeProvisorio codigo="H-E01-12"` |
| Campos | componentes.js L3157–L3174 e o dicionário L51–L513 | os rótulos de D3–D5 e os dois calculados. Empresa não é campo da ficha; entra só na trilha |
| Grid | componentes.js L3177–L3209; MATRIZ-UX L106 | Cliente · Produto · Valor · Valor líquido (calculado) · Estabelecimento · Operação. Ordenação default Cliente. 20 por página, server-side. Sem coluna técnica |
| Filtros | componentes.js L3211–L3216; MATRIZ-UX L107 | Estabelecimento, Cliente, Produto, Competência. A busca da lista permanece (aplicacao.js L170, placeholder "Pesquisar descrição ou referência de negócio") |
| Ações | catalogo.js L234; aplicacao.js L14 | botões "Simular", "Explicar tributos", "Exportar memória", "Comparar versões" (`titleCase` só na primeira letra) |
| Sete abas | aplicacao.js L7 | Ficha e campos, Movimentações, Regras e validações, Exceções, Histórico, Integrações, Aceite e testes |
| Ficha | aplicacao.js L179–L192 | seção "Dados principais". Trilha: Empresa (`empresas.razao_social` via enquadramento), Situação, Responsável. Ambiente fica de fora |
| Drawer | aplicacao.js L427–L438 e L451 | "Cancelar", "Verificar dados", "Salvar rascunho" (sai só a palavra ilustrativo). O clique grava CALCULADA; não há situação rascunho (D12). "Simular" continua ação de processo. Texto obrigatório, 3–500 |
| Exceções | catalogo.js L236 | dois blocos, porque o `split(';')` produz duas partes e o `if (arr.length < 2)` de aplicacao.js L201 não dispara: "Base tributável difere de valor bruto" e "Falta referência legal" |
| Competência exibida | aplicacao.js L147 | "Outubro de 2026" para `2026-10`. Mapa da seção 6 |

Rótulos literais, copiados do dicionário:

| Chave | Rótulo | Linha |
|---|---|---|
| estabelecimento | Estabelecimento | componentes.js L51–L53 |
| operacao | Operação | L190–L192 |
| cliente | Cliente | L298–L300 |
| produto | Produto | L262–L264 |
| ncm | Classificação fiscal (NCM) | L274–L276 |
| quantidade | Quantidade | L430–L432 |
| pesoNF | Peso informado na nota (kg) | L442–L444 |
| valor | Valor | L454–L456 |
| desconto | Desconto | L466–L468 |
| competencia | Competência | L478–L480 |
| regraFiscal | Enquadramento fiscal | L310–L312 |
| baseCalculo | Base tributável (calculada) | L490–L492 |
| valorLiquido | Valor líquido (calculado) | L502–L504 |
| — | Motivo da alteração | aplicacao.js L436. A ficha E01-T04 (componentes.js L3160–L3174) não inclui a chave justificativa. O texto continua obrigatório, de 3 a 500 caracteres (D18) |

Pares já gravados na regra, só leitura na explicação. Importar `ROTULOS_ICMS_CST`, `ROTULOS_IPI_CST`,
`ROTULOS_PIS_CST` e `ROTULOS_IBS_CST` de `fiscal-regras.schema.ts`. Não editar esses mapas.

- Tratamento ICMS: `00` Tributação integral; `20` Redução de base; `40` Isenção; `41` Não tributada; `51` Diferimento.
- Tratamento IPI: `51` Saída tributada à alíquota zero; `53` Saída não tributada; `99` Outras saídas.
- Tratamento PIS/COFINS: `01` Tributação normal; `06` Alíquota zero; `08` Sem incidência; `99` Outras operações.
- Tratamento IBS/CBS: `000` Tributação integral; `200` Alíquota reduzida.

Células do grid, sem UUID:

- Cliente = D5.
- Produto = `produtos.nome`.
- Valor = dinheiro pt-BR (`1.000,00`), prefixo `R$` no campo, não dentro da string ordenada.
- Valor líquido (calculado) = o mesmo formato.
- Estabelecimento = `estabelecimentos.nome`.
- Operação = `operacoes.rotulo`.

Código da linhagem, número da versão, situação, responsável, criação e alteração ficam na ficha (Caderno B L83),
não nas seis colunas.

Remoções autorizadas (Princípio I.2(a)/(b)), conferidas no Portão 2: selo "DADOS FICTÍCIOS"; pill "Fixture de
teste"; rodapé "registros fictícios"; eyebrow com código de épico e "Caderno B §E01-T04"; KPI "Ambiente em
tela"; botões "Abrir ocorrência" e "Simular erro de validação"; o painel do épico e os quatro botões de
aplicacao.js L254 (C11); a palavra "ilustrativo" do botão, que permanece "Salvar rascunho"; "Cadastro demonstrativo em memória"; o `<select>` de situação com os seis
`stateTypes` de aplicacao.js L8; checkboxes da aba Aceite (viram leitura). Botões de Integrações para telas
inexistentes (aplicacao.js L218) desabilitados com `title="Destino ainda não disponível"`.

Ao escolher o enquadramento, o drawer chama o GET já existente `/api/erp/fiscal/enquadramentos/:id` e preenche
Estabelecimento, Operação, Cliente, Produto e Classificação fiscal (NCM) com os textos de negócio dessa linha.
Os combos continuam visíveis. Se o operador trocar um dos cinco, o servidor responde 422
`ENQUADRAMENTO_DIVERGENTE` (D4).

## 5. Modelo de dados (`app/backend/src/database/schema/fiscal-simulacoes.schema.ts`)

Não alterar `fiscal-regras.schema.ts`, `fiscal-enquadramentos.schema.ts`, `fiscal-empresas.schema.ts`,
`operacoes.schema.ts`, `clientes.schema.ts`, `produtos.schema.ts` nem `notas-fiscais*.ts` /
`faturamento.schema.ts`. Reusar `regraViolada`, `conflito`, `conflitoConcorrente` e `exigirVersao` de
`fiscal-comum.ts`. Reusar `travarEnquadramento` exportada em `regras.service.ts` L46. Não editar essa função.
Reusar `formatarPercentualPtBr` de `regras/percentual.ts`. Não editar esse arquivo.

O Worker confirma no Context7 a sintaxe de `numeric`, `uniqueIndex().where()`, `varchar`, `boolean` e `check`
do Drizzle 0.45.

```ts
import { sql } from 'drizzle-orm';
import {
  boolean, check, foreignKey, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid, varchar,
} from 'drizzle-orm/pg-core';
import { usuarios } from './auth.schema';
import { clientes } from './clientes.schema';
import { enquadramentosFiscais, ncms } from './fiscal-enquadramentos.schema';
import { estabelecimentos } from './fiscal-empresas.schema';
import { regrasTributarias } from './fiscal-regras.schema';
import { operacoes } from './operacoes.schema';
import { produtos } from './produtos.schema';

const auditCols = {
  versao: integer('versao').notNull().default(1),
  criadoPorId: uuid('criado_por_id').notNull().references(() => usuarios.id),
  atualizadoPorId: uuid('atualizado_por_id').notNull().references(() => usuarios.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};

export const simulacoesFiscais = pgTable('simulacoes_fiscais', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  codigo: varchar('codigo', { length: 20 }).notNull(),
  numeroVersao: integer('numero_versao').notNull(),
  estabelecimentoId: uuid('estabelecimento_id').notNull().references(() => estabelecimentos.id),
  operacaoId: uuid('operacao_id').notNull().references(() => operacoes.id),
  clienteId: uuid('cliente_id').notNull().references(() => clientes.id),
  produtoId: uuid('produto_id').notNull().references(() => produtos.id),
  ncmId: uuid('ncm_id').notNull().references(() => ncms.id),
  quantidade: numeric('quantidade', { precision: 15, scale: 3 }).notNull(),
  pesoNf: numeric('peso_nf', { precision: 10, scale: 3 }).notNull(),
  valor: numeric('valor', { precision: 15, scale: 2 }).notNull(),
  desconto: numeric('desconto', { precision: 15, scale: 2 }).notNull(),
  competencia: varchar('competencia', { length: 7 }).notNull(),
  enquadramentoId: uuid('enquadramento_id').notNull().references(() => enquadramentosFiscais.id),
  regraId: uuid('regra_id').notNull().references(() => regrasTributarias.id),
  valorLiquido: numeric('valor_liquido', { precision: 15, scale: 2 }).notNull(),
  baseTributavel: numeric('base_tributavel', { precision: 15, scale: 2 }).notNull(),
  icms: numeric('icms', { precision: 15, scale: 2 }).notNull(),
  baseDifereBruto: boolean('base_difere_bruto').notNull(),
  origemVersaoId: uuid('origem_versao_id'),
  situacao: text('situacao').notNull().default('CALCULADA'),
  justificativa: text('justificativa').notNull(),
  ...auditCols,
}, (t) => [
  foreignKey({
    columns: [t.origemVersaoId],
    foreignColumns: [t.id],
    name: 'simulacoes_fiscais_origem_fk',
  }),
  check('simulacoes_codigo_formato_check', sql`${t.codigo} ~ '^[1-9][0-9]{0,17}$'`),
  check('simulacoes_numero_versao_check', sql`${t.numeroVersao} >= 1`),
  check('simulacoes_quantidade_positiva_check', sql`${t.quantidade} > 0`),
  check('simulacoes_peso_positivo_check', sql`${t.pesoNf} > 0`),
  check('simulacoes_valor_positivo_check', sql`${t.valor} > 0`),
  check('simulacoes_desconto_nao_negativo_check', sql`${t.desconto} >= 0`),
  check('simulacoes_desconto_teto_check', sql`${t.desconto} <= ${t.valor}`),
  check('simulacoes_liquido_check', sql`${t.valorLiquido} = ${t.valor} - ${t.desconto}`),
  check('simulacoes_base_flag_check', sql`${t.baseDifereBruto} = (${t.baseTributavel} <> ${t.valor})`),
  check('simulacoes_competencia_check', sql`${t.competencia} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
  check('simulacoes_situacao_check', sql`${t.situacao} = 'CALCULADA'`),
  check('simulacoes_versao_positiva_check', sql`${t.versao} >= 1`),
  uniqueIndex('uq_simulacoes_codigo_versao').on(t.codigo, t.numeroVersao).where(sql`${t.deletedAt} IS NULL`),
  index('idx_simulacoes_estabelecimento').on(t.estabelecimentoId),
  index('idx_simulacoes_operacao').on(t.operacaoId),
  index('idx_simulacoes_cliente').on(t.clienteId),
  index('idx_simulacoes_produto').on(t.produtoId),
  index('idx_simulacoes_ncm').on(t.ncmId),
  index('idx_simulacoes_enquadramento').on(t.enquadramentoId),
  index('idx_simulacoes_regra').on(t.regraId),
  index('idx_simulacoes_origem').on(t.origemVersaoId),
  index('idx_simulacoes_competencia').on(t.competencia).where(sql`${t.deletedAt} IS NULL`),
  index('idx_simulacoes_criado_por').on(t.criadoPorId),
  index('idx_simulacoes_atualizado_por').on(t.atualizadoPorId),
]);
```

`schema/index.ts` ganha uma linha: `export * from './fiscal-simulacoes.schema';`. Não há coluna `p_icms`,
`p_red_bc`, `data_comercial`, `data_fiscal`, `data_efetiva`, `nota_id`, `xml`, `chave` nem `protocolo`.

## 6. Cálculo e regras de serviço

Arquivo puro `app/backend/src/modules/erp/fiscal/simulacoes/decimal-memoria.ts`. Proibido `Number(`,
`parseFloat`, `parseInt` e `Math.` nesse arquivo. O teste da Task 1 lê o fonte e falha se algum aparecer.

```ts
export function normalizarDinheiro(entrada: string): string | null {
  const limpo = entrada.trim().replace(/\s/g, '').replace(/^R\$/i, '');
  if (limpo.includes(',')) {
    if (limpo.split(',').length !== 2) return null;
    const [esq, dir] = limpo.split(',');
    if (!/^(\d{1,3}(\.\d{3})*|\d+)$/.test(esq)) return null;
    if (!/^\d{1,2}$/.test(dir)) return null;
    const inteiro = esq.replaceAll('.', '');
    if (inteiro.length > 13) return null;
    if (inteiro.length > 1 && inteiro.startsWith('0')) return null;
    return `${inteiro}.${dir.padEnd(2, '0')}`;
  }
  if ((limpo.match(/\./g) ?? []).length > 1) return null;
  if (!/^\d{1,13}(\.\d{1,2})?$/.test(limpo)) return null;
  const [inteiro, frac = ''] = limpo.split('.');
  if (inteiro.length > 1 && inteiro.startsWith('0')) return null;
  return `${inteiro}.${frac.padEnd(2, '0')}`;
}

export function normalizarEscala(entrada: string, inteirosMax: number): string | null {
  const limpo = entrada.trim().replace(/\s/g, '');
  let inteiro = '';
  let frac = '';
  if (limpo.includes(',')) {
    if (limpo.split(',').length !== 2) return null;
    const [esq, dir] = limpo.split(',');
    if (!/^(\d{1,3}(\.\d{3})*|\d+)$/.test(esq)) return null;
    if (!/^\d{1,3}$/.test(dir)) return null;
    inteiro = esq.replaceAll('.', '');
    frac = dir;
  } else {
    if ((limpo.match(/\./g) ?? []).length > 1) return null;
    if (!/^\d+(\.\d{1,3})?$/.test(limpo)) return null;
    const partes = limpo.split('.');
    inteiro = partes[0];
    frac = partes[1] ?? '';
  }
  if (inteiro.length > inteirosMax) return null;
  if (inteiro.length > 1 && inteiro.startsWith('0')) return null;
  return `${inteiro}.${frac.padEnd(3, '0')}`;
}

export function centavosDe(canon: string): bigint {
  const encontrado = /^(\d+)\.(\d{2})$/.exec(canon);
  if (!encontrado) throw new Error('dinheiro fora da forma canônica');
  return BigInt(encontrado[1] + encontrado[2]);
}

export function dinheiroDeCentavos(centavos: bigint): string {
  const negativo = centavos < 0n;
  const absoluto = negativo ? -centavos : centavos;
  const texto = absoluto.toString().padStart(3, '0');
  return `${negativo ? '-' : ''}${texto.slice(0, -2)}.${texto.slice(-2)}`;
}

export function complementoRazao(razao: string): string | null {
  const encontrado = /^(\d)\.(\d{4})$/.exec(razao);
  if (!encontrado) return null;
  const unidades = BigInt(encontrado[1] + encontrado[2]);
  if (unidades > 10000n) return null;
  const complemento = (10000n - unidades).toString().padStart(5, '0');
  return `${complemento[0]}.${complemento.slice(1)}`;
}

/** Meio para cima quando o resto da divisão por 10000 é >= 5000. razao é "0.1200". */
export function aplicarRazao(centavos: bigint, razao: string): bigint | null {
  const encontrado = /^(\d)\.(\d{4})$/.exec(razao);
  if (!encontrado) return null;
  const unidades = BigInt(encontrado[1] + encontrado[2]);
  if (unidades > 10000n) return null;
  const produto = centavos * unidades;
  const negativo = produto < 0n;
  const absoluto = negativo ? -produto : produto;
  const quociente = absoluto / 10000n;
  const resto = absoluto % 10000n;
  const arredondado = resto >= 5000n ? quociente + 1n : quociente;
  return negativo ? -arredondado : arredondado;
}

export function calcularMemoria(entrada: {
  valor: string;
  desconto: string;
  pRedBc: string;
  pIcms: string;
}): { valorLiquido: string; baseTributavel: string; icms: string; baseDifereBruto: boolean } | null {
  const valorC = centavosDe(entrada.valor);
  const descontoC = centavosDe(entrada.desconto);
  if (descontoC > valorC) return null;
  const liquidoC = valorC - descontoC;
  const fator = complementoRazao(entrada.pRedBc);
  if (!fator) return null;
  const baseC = aplicarRazao(liquidoC, fator);
  const icmsC = baseC === null ? null : aplicarRazao(baseC, entrada.pIcms);
  if (baseC === null || icmsC === null) return null;
  return {
    valorLiquido: dinheiroDeCentavos(liquidoC),
    baseTributavel: dinheiroDeCentavos(baseC),
    icms: dinheiroDeCentavos(icmsC),
    baseDifereBruto: baseC !== valorC,
  };
}

export function formatarDinheiroPtBr(canon: string): string {
  const [inteiro, frac] = canon.split('.');
  const comMilhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${comMilhar},${frac}`;
}

export function formatarEscalaPtBr(canon: string): string {
  const [inteiro, frac] = canon.split('.');
  const comMilhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${comMilhar},${frac}`;
}

const MESES: Record<string, string> = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
  '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
  '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
};

export function rotuloCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split('-');
  return `${MESES[mes]} de ${ano}`;
}
```

Exemplos que o teste prende:

| Valor | Desconto | p_red_bc | p_icms | Líquido | Base | ICMS | base_difere_bruto |
|---|---|---|---|---|---|---|---|
| 10.05 | 0.00 | 0.0000 | 0.1200 | 10.05 | 10.05 | 1.21 | false |
| 1000.00 | 0.00 | 0.4167 | 0.1200 | 1000.00 | 583.30 | 70.00 | true |
| 1000.00 | 100.00 | 0.0000 | 0.1200 | 900.00 | 900.00 | 108.00 | true |
| 1000.00 | 100.00 | 0.4167 | 0.1200 | 900.00 | 524.97 | 63.00 | true |

`1000.00` com desconto `1000.01` faz `calcularMemoria` devolver `null`. Quantidade `1.000` e `999.000`, com
o mesmo valor, produzem a mesma base e o mesmo ICMS: a função não recebe quantidade nem peso.

Parágrafo quando `baseDifereBruto` é verdadeiro, com os formatadores pt-BR:

"A base tributável difere do valor bruto. Valor: {valor}. Desconto: {desconto}. Valor líquido (calculado): {líquido}. Redução de base do ICMS (%): {percentual}. Base tributável (calculada): {base}."

`formatarPercentualPtBr('0.4167')` devolve `41,67`. O prefixo `%` fica no rótulo, não dentro desse valor.

Dia de consulta: `competencia + '-01'`. A regra entra quando `situacao = 'APROVADA'`, `deleted_at` nulo,
`vigencia_inicio <= dia` e (`vigencia_fim` nulo ou `vigencia_fim >= dia`). O enquadramento usa a mesma
comparação nas colunas que a T02 já gravou.

Mensagens fechadas:

- `FALTA_REFERENCIA_LEGAL`: "Não há regra tributária aprovada vigente nesta competência para o enquadramento selecionado."
- `REFERENCIA_AMBIGUA`: "Há mais de uma regra tributária aprovada vigente nesta competência. Nenhuma foi escolhida."
- `DESCONTO_MAIOR_QUE_VALOR`: "O desconto não pode ser maior que o valor."
- `ENQUADRAMENTO_DIVERGENTE`: "Estabelecimento, operação, cliente, produto e classificação fiscal (NCM) precisam ser os do enquadramento selecionado."
- `ENQUADRAMENTO_INDISPONIVEL`: "O enquadramento fiscal não está ativo." quando a situação não é `ATIVA` (texto já emitido por `travarEnquadramento`); "O enquadramento fiscal não cobre esta competência." quando a vigência não cobre o dia 1º.
- `ESTABELECIMENTO_INDISPONIVEL`: "O estabelecimento selecionado não está aprovado."
- `CLIENTE_INDISPONIVEL`: "O cliente selecionado não está ativo."
- `PRODUTO_INDISPONIVEL`: "O produto selecionado não está ativo."
- `NCM_INDISPONIVEL`: "A classificação fiscal (NCM) selecionada não está ativa."
- `OPERACAO_INDISPONIVEL`: "A operação selecionada não está disponível."
- `LINHAGEM_ENQUADRAMENTO_FIXO`: "A versão nova permanece no mesmo enquadramento fiscal."
- `SIMULACOES_DISTINTAS`: "A comparação exige duas versões da mesma simulação."
- `VERSAO_IMUTAVEL`: "A memória calculada não pode ser alterada. Inclua uma versão nova."

`AuditoriaService.registrar(tx, …)` na mesma transação: `modulo: 'fiscal.simulacoes'`, tabela física
`simulacoes_fiscais`, `dadosAnteriores`/`dadosNovos`, `justificativa`. O histórico exposto não devolve o
nome da tabela. `EventEmitter2.emit` só depois do `db.transaction` resolver.

Código novo da linhagem, só em simular (não na versão nova):

```ts
await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('simulacoes_fiscais.codigo'))`);
const gerado = await tx.execute(sql`
  SELECT (COALESCE(MAX(codigo::bigint), 0) + 1)::text AS proximo FROM simulacoes_fiscais
`);
```

O laço de savepoint segue o de `enquadramentos.service.ts` L702–L714, com savepoint `simulacao_codigo`.
Violação de `uq_simulacoes_codigo_versao` na versão nova, depois do lock de D24, não é o caminho esperado:
se ocorrer, vira 409 `CONFLITO_CONCORRENTE`.

Ordem dentro da transação de simular:

1. `travarEnquadramento`.
2. Conferir os cinco FKs, os cadastros de D6 e a vigência do enquadramento.
3. Selecionar as regras `APROVADA` que cobrem o dia. Zero → `FALTA_REFERENCIA_LEGAL`. Duas ou mais → `REFERENCIA_AMBIGUA`.
4. `calcularMemoria`. `null` → `DESCONTO_MAIOR_QUE_VALOR`.
5. Inserir a linha `CALCULADA` com `regra_id` da regra resolvida.
6. Auditar. O evento fica para depois do commit.

A transação não executa `INSERT` em `notas_fiscais`, `notas_fiscais_fornecedor`, `faturamentos` nem em
`regras_tributarias`.

## 7. Endpoints (`@Controller('fiscal')`, `JwtAuthGuard` + `RbacGuard`)

Rotas estáticas `contagens` e `exportacao` declaradas antes de `:id`.

| Verbo e caminho | Permissão | DTO (Zod, `.strict()`) | Resposta |
|---|---|---|---|
| GET `/fiscal/simulacoes` | LER | {estabelecimentoId?, clienteId?, produtoId?, competencia?, search?, sort ∈ cliente·produto·valor·valorLiquido·estabelecimento·operacao, dir ∈ asc·desc, page, pageSize=20} | página com as seis células da seção 4. `id` só para o clique, nunca dentro da célula |
| GET `/fiscal/simulacoes/contagens` | LER | mesmo filtro | {simulacoes, versoes, baseDiferente} |
| GET `/fiscal/simulacoes/exportacao` | LER | mesmo filtro | `text/csv; charset=utf-8`, separador `;`, BOM, cabeçalho "Cliente;Produto;Valor;Valor líquido (calculado);Estabelecimento;Operação" |
| GET `/fiscal/simulacoes/:id` | LER | uuid | detalhe da seção 6, com dinheiro canônico (`"583.30"`), quantidade `"10.000"`, competência `"2026-10"` e `competenciaRotulo`. Sem ambiente |
| GET `/fiscal/simulacoes/:id/explicacao` | LER | uuid | linhas na ordem abaixo. Tributos sem alíquota na lista `semAliquota` |
| GET `/fiscal/simulacoes/:id/memoria` | LER | uuid | CSV da explicação, BOM, `;`, cabeçalho "Campo;Valor" |
| GET `/fiscal/simulacoes/:id/historico` | LER | uuid | {operacao, situacaoAnterior, situacaoNova, usuarioNome, criadoEm, justificativa, resumo, versao, numeroVersao}. Sem nome de tabela e sem uuid |
| GET `/fiscal/simulacoes/:id/pre-condicoes` | LER | uuid | itens abaixo |
| GET `/fiscal/simulacoes/:id/comparar?com=` | LER | dois uuid | `{ codigo, numeroVersaoAntes, numeroVersaoDepois, diferencas: [{ campo, antes, depois }] }`. Só campos cujo texto difere, na ordem de D14 |
| POST `/fiscal/simulacoes` | GERENCIAR | corpo abaixo | 201 |
| POST `/fiscal/simulacoes/:id/versoes` | GERENCIAR | corpo da versão + `versao` da origem + justificativa | 201 ou 422 |
| PATCH `/fiscal/simulacoes/:id` | GERENCIAR | qualquer objeto | 409 `VERSAO_IMUTAVEL` |

Não existem rotas `aprovar`, `publicar`, `rejeitar` nem `submeter`. O BFF devolve 404 para elas e não chama o backend.

Corpo de simular, todos obrigatórios:

`estabelecimentoId`, `operacaoId`, `clienteId`, `produtoId`, `ncmId`, `quantidade`, `pesoNf`, `valor`,
`desconto`, `competencia`, `enquadramentoId`, `justificativa`.

`.strict()` recusa `regraId`, `baseCalculo`, `valorLiquido`, `icms`, `pIcms`, `pRedBc`, `dataComercial`,
`dataFiscal`, `dataEfetiva`, `notaId`, `xml`, `chave`, `protocolo`, `csosn`, `marca`.

Versão nova: os mesmos campos de insumo, mais `versao` da origem. `enquadramentoId` tem de ser o da origem.

Ordem das linhas de explicação, `valor` já em pt-BR:

1. Cliente
2. Produto
3. Estabelecimento
4. Operação
5. Classificação fiscal (NCM)
6. Quantidade
7. Peso informado na nota (kg)
8. Valor
9. Desconto
10. Valor líquido (calculado)
11. Competência (`rotuloCompetencia`)
12. Enquadramento fiscal
13. Código da regra
14. Versão da regra
15. Início de vigência (`DD/MM/AAAA`)
16. Fim de vigência (`DD/MM/AAAA`, ou "Sem fim de vigência")
17. Tratamento ICMS
18. Redução de base do ICMS (%) (`formatarPercentualPtBr`)
19. Base tributável (calculada)
20. Alíquota (%)
21. ICMS (`formatarDinheiroPtBr`)

`semAliquota`, nesta ordem: Tratamento IPI, Tratamento PIS/COFINS, Tratamento IBS/CBS. Cada item:
`{ rotulo, tratamento, texto }` com `texto` igual à frase de D7. Benefício fiscal e Classificação IBS/CBS
entram na referência, não como valor calculado.

`referenciaLegal`: "Regra {codigo} versão {numeroVersao}, vigência de {inicio} a {fim}. Benefício fiscal: {descricao}. Classificação IBS/CBS: {descricao}."

`textoBase`: o parágrafo da seção 6 quando o flag é verdadeiro; `null` quando a base é igual ao valor.

Ordem fixa da comparação, incluída só se o texto mudar: Cliente, Produto, Estabelecimento, Operação,
Classificação fiscal (NCM), Quantidade, Peso informado na nota (kg), Valor, Desconto, Competência,
Enquadramento fiscal, Valor líquido (calculado), Base tributável (calculada), Alíquota (%), ICMS,
Código da regra, Versão da regra. Dinheiro e quantidade no formato pt-BR. Alíquota com `formatarPercentualPtBr`.

Busca: nomes, razão social, rótulo da operação, código do enquadramento e código da regra. Se `search`
casa com `/^[0-9a-f]{8}-[0-9a-f]{4}-/i`, a página volta vazia. Não há `WHERE id =`.

Pré-condições do detalhe (leitura, não bloqueiam o POST):

| codigo | atendida | provisoria |
|---|---|---|
| ENQUADRAMENTO_ATIVO | enquadramento `ATIVA`, não removido, vigência cobre o dia 1º | false |
| REGRA_APROVADA_VIGENTE | a `regra_id` gravada continua `APROVADA` e cobre o dia 1º | false |
| MEMORIA_SEM_DOCUMENTO | true nesta linha (não há FK de nota) | false |
| DATAS_COMERCIAL_FISCAL_EFETIVA | false | true (H-E01-10) |
| DUPLA_APROVACAO | false | true (H-E01-11) |
| PERFIS_ALEM_ADMINISTRADOR | false | true (H-E01-12) |

Texto de `DUPLA_APROVACAO`: "Esta tela não aprova nem publica regra. O quórum numérico permanece provisório."

Erro HTTP `{ message, codigo, ...dados }` via `regraViolada` / `conflito`. Não criar outra família de erro.
`:id` inexistente → 404 "Simulação fiscal não encontrada".

## 8. Eventos pós-commit e tempo real

- `realtime/events/eventos.ts`: `SIMULACAO_FISCAL_ALTERADA: 'simulacao_fiscal_alterada'`.
  Payload `{ simulacaoId: string; codigo: string; numeroVersao: number; acao: 'simulada' | 'versao_adicionada' }`,
  registrado em `PayloadPorEvento`. Sem `valor`, sem `baseTributavel`, sem `icms`, sem `notaId`.
- Emitir só depois de `db.transaction` resolver.
- `room-permissoes.ts`: acrescentar `'fiscal-simulacoes': PERMISSOES.FISCAL_SIMULACOES_LER`. Não alterar
  `fiscal-empresas`, `fiscal-enquadramentos` nem `fiscal-regras`.
- `realtime.gateway.ts`: novo `@OnEvent(EVENTOS.SIMULACAO_FISCAL_ALTERADA)` chama
  `broadcastRoom('fiscal-simulacoes', evento, payload)`. Não passar por `publicarFiscal` nem pelos handlers
  de enquadramento e de regra.

## 9. RBAC, seed, parâmetro provisório e menu

`common/rbac/permissoes.ts`, depois do bloco `FISCAL_REGRAS_*` (L423). Descrições:

- `FISCAL_SIMULACOES_LER`: "Consultar simulações fiscais, memória de cálculo e comparação de versões".
- `FISCAL_SIMULACOES_GERENCIAR`: "Simular tributos e gravar versão nova da memória de cálculo".

```ts
// AD-04 / AD-18 (5) / H-E01-12. Persona fiscal/contador não é perfil.
pushPermissoes('administrador', 'FISCAL_SIMULACOES_LER', 'FISCAL_SIMULACOES_GERENCIAR');
```

Fora de `LEITURA_CADASTROS`. Não criar `FISCAL_SIMULACOES_APROVAR` nem `FISCAL_REGRAS` nova. O módulo
`Fiscal` de `perfis.service.ts` já usa o prefixo `FISCAL_`. Não acrescentar módulo. O catálogo ordena por
`Object.keys(DESCRICOES_PERMISSOES).sort()`. O teste de `perfis-menus.e2e-spec.ts` passa a esperar dez
permissões, nesta ordem:

1. `FISCAL_EMPRESAS_APROVAR`
2. `FISCAL_EMPRESAS_GERENCIAR`
3. `FISCAL_EMPRESAS_LER`
4. `FISCAL_ENQUADRAMENTOS_GERENCIAR`
5. `FISCAL_ENQUADRAMENTOS_LER`
6. `FISCAL_REGRAS_APROVAR`
7. `FISCAL_REGRAS_GERENCIAR`
8. `FISCAL_REGRAS_LER`
9. `FISCAL_SIMULACOES_GERENCIAR`
10. `FISCAL_SIMULACOES_LER`

O teste "catalogo de permissoes cobre todo o mapa de descricoes" continua sem afrouxar.
`MENUS_OPERACIONAIS` continua 39. `MENUS_CANONICOS` e `res.body.menus` passam a 43.

Parâmetro novo em `seed.ts` `PARAMETROS_SEED`, sem alterar `fiscal.regras_perfis_autorizados` nem
`fiscal.enquadramentos_perfis_autorizados`:

```ts
{
  chave: 'fiscal.simulacoes_perfis_autorizados',
  descricao: 'Perfis com acesso ao simulador fiscal e à memória de cálculo',
  valorJson: {
    grupo: 'Fiscal',
    tipo: 'info',
    titulo: 'Perfis do simulador fiscal',
    texto: 'Somente administrador até decisão sobre os demais perfis.',
    valor: ['administrador'],
    provisorio: true,
    pendencia: 'H-E01-12',
  },
}
```

A tela lê o BFF já existente `/api/admin/parametros/chave/[chave]` e mostra `BadgeProvisorio` enquanto
`provisorio === true`.

Menu — `MENUS_ERP = ['/fiscal/empresas', '/fiscal/enquadramentos', '/fiscal/regras', '/fiscal/simulador']`.
`perfil.dto.ts` já usa `.max(MENUS_CANONICOS.length)` — não hardcodar 43. Snapshots regenerados por
`npx tsx scripts/gerar-snapshot-perfis.ts`; só a chave `administrador` ganha a rota e as duas permissões.

Frontend `lib/menu-v2.ts`: quarto item do grupo `FISCAL`, sem criar grupo e sem mudar a posição 08.
`shell-ds.spec.ts` não é editado.

Contagens, sem afrouxar:

- `menu-v2.test.ts`: `ITENS_ERP` ganha `['FISCAL', 'Simulador fiscal e memória de cálculo', '/fiscal/simulador']`; total `toHaveLength(43)`; os 39 itens sem o grupo FISCAL continuam `toEqual(ITENS_PROTOTIPO)`. Caso novo: permissão só `FISCAL_EMPRESAS_LER` mostra empresas e esconde simulador, regras e enquadramentos.
- `menu-rbac.test.ts`: `MATRIZ_ERP` ganha `'/fiscal/simulador': ['administrador']`. Rotas sem `/fiscal/` continuam 39. Total de rotas 43. Atribuições `129 + 1 = 130`. `MATRIZ_ERP` soma 4. Atualizar o comentário da L73.
- `perfis-menus.e2e-spec.ts`: `MENUS_CANONICOS` e `res.body.menus` 43; catálogo Fiscal com as dez permissões.

## 10. Página e componentes DS v3

Página `app/frontend/src/app/(admin)/fiscal/simulador/page.tsx` (padrão
`(admin)/fiscal/regras/page.tsx`): `getMe()`; sem usuário → `redirect('/login')`; sem
`FISCAL_SIMULACOES_LER` → "Você não tem permissão para visualizar o simulador fiscal e a memória de cálculo."
sem renderizar o cliente; senão `<SimulacoesClient podeGerenciar />`.

Componentes em `components/fiscal/simulacoes/`: `simulacoes-client.tsx`, `simulacao-drawer.tsx`,
`explicacao-painel.tsx`, `comparar-dialog.tsx`, `versao-dialog.tsx`, `abas-detalhe.tsx`.
DS existente: `PageHeader`, `KpiStrip`/`Kpi`, `Table`, `Tabs`, `ComboboxField`, `Sheet`,
`AlertDialog`, `StatusPill`, `EmptyState`, `Skeleton`, `BadgeProvisorio`, `sonner`. Sem hex avulso.
Competência é `<input type="month">`. Não criar componente novo de calendário.

- Hero: título "Simulador fiscal e memória de cálculo"; subtítulo com as quatro ações e o selo H-E01-12;
  "Exportar" (a visão da grade); "+ Novo registro" (só `podeGerenciar`) abre o drawer; "Ações do processo ▾"
  com os quatro comandos.
- KPIs: "Simulações" (códigos distintos), "Versões" (linhas), "Base tributável difere de valor bruto".
- Lista: busca; filtros da seção 4; "Exportar visão"; grid da seção 4; clique ou Enter seleciona;
  paginação server-side; filtros e ordenação em `sessionStorage` na chave `fiscal.simulador.lista`; vazio com
  o texto de aplicacao.js L172 ("Nenhum resultado para o período, filtro ou situação escolhidos. Limpe os filtros ou cadastre um novo registro.").
- Ficha: os campos da seção 4 já calculados, Código, Versão (`numeroVersao`), Situação "Calculada",
  Responsável (`usuarios.nome` de `criado_por_id`), Criado em, Alterado em. Selo `H-E01-10` junto de
  Competência e, na explicação, junto de Início de vigência e Fim de vigência da regra citada. Trilha:
  Empresa, Situação, Responsável. Botões "Explicar tributos", "Exportar memória", "Comparar versões",
  "Nova versão" (só `podeGerenciar`), "Validar pré-condições", "Consultar histórico". Não há "Editar versão"
  nem "Aprovar".
- Movimentações: trilha em leitura Preparação → Verificação → Autorização → Conclusão. Aviso visível:
  "Nenhuma simulação gera lançamento fiscal nem documento."
- Regras e validações: o texto de catalogo.js L235 ("nenhum valor gerado vira lançamento fiscal sem documento; Decimal exato")
  mais "Quantidade e peso informado na nota ficam registrados e não multiplicam o valor." e "A base e o ICMS
  saem de conta inteira em centavos, com meio para cima, sem número de ponto flutuante." O caminho de
  aprovação de aplicacao.js L198 fica com os três passos e `BadgeProvisorio codigo="H-E01-11"`. O passo 03
  diz o texto de `DUPLA_APROVACAO` da seção 7.
- Exceções: os dois títulos da seção 4. O primeiro mostra `textoBase` quando o flag é verdadeiro, ou
  "Nesta simulação a base tributável é igual ao valor bruto." O segundo mostra a mensagem do último 422
  `FALTA_REFERENCIA_LEGAL`, se houver, ou "A simulação só grava quando existe uma regra tributária aprovada cuja vigência cobre o dia 1º da competência."
- Histórico: a timeline do GET `historico`, com os resumos da seção 11 e o aviso de aplicacao.js L210
  ("O sistema real preservará evento, ator, empresa, objeto e versão na auditoria. Identificadores técnicos, payloads sigilosos e GUIDs não serão apresentados nesta tela.").
- Integrações: os blocos de aplicacao.js L214–L217 para o épico E01 ("Integração fiscal", "Configuração e segredo", "Execução batch"), em leitura. Os três botões de L218 ficam desabilitados com `title="Destino ainda não disponível"`. A aba não chama SEFAZ.
- Aceite: os oito critérios de aplicacao.js L223–L231 como texto, sem checkbox que grave aceite, mais o aviso de L236 ("A seleção dos checkboxes serve apenas à revisão do protótipo: não registra aceite contratual. O aceite real depende de evidências CI, integração HML, UAT e responsável autorizado.").
- Drawer: combos com os rótulos literais. Base e valor líquido desabilitados, vazios, com o hint
  "Calculado ao simular". Não entram no JSON. Valor e Desconto com prefixo `R$`. Quantidade e peso com
  `inputMode="decimal"`. Erros por campo via `useErrosCampo` / `extrairErrosPorCampo` (AD-12). Sair com
  pendência pede confirmação. O cliente não calcula base nem ICMS: `lib/fiscal-simulacoes.ts` não exporta
  `calcularMemoria` nem `aplicarRazao`.
- Diálogo de versão nova: insumos preenchidos com a origem, enquadramento travado no mesmo código de
  negócio, competência editável, motivo. 422 não fecha como sucesso.
- Diálogo comparar: escolhe a outra versão do mesmo código e lista `campo`, `antes`, `depois`. Não mostra UUID.
- Estados: inicial, carregando (skeleton), sem registros, validação inválida, sem acesso (página), conflito
  (409 `VERSAO_IMUTAVEL`), serviço indisponível ("Tentar novamente"), revisão pendente (banner "Base tributável difere de valor bruto" quando `baseDifereBruto`, situação continua Calculada), concluído (toast "Simulação calculada.").
- Tempo real: `conectarRealtime({ rooms: ['fiscal-simulacoes'], onMessage, onReconnect })` refaz lista e
  detalhe. Sem polling.
- `lib/fiscal-simulacoes.ts`: `formatarDinheiroPtBr`, `formatarEscalaPtBr`, `rotuloCompetencia` e
  `normalizarDinheiro` / `normalizarEscala` com o mesmo corpo da seção 6, para o cliente não importar o Nest.
  Cliente HTTP do BFF. Não exportar função que multiplique tributo.

Combos de apoio já existentes: `GET /api/erp/fiscal/estabelecimentos`, `GET /api/operacoes`,
`GET /api/cadastros/clientes`, `GET /api/cadastros/produtos`, `GET /api/erp/fiscal/ncms`,
`GET /api/erp/fiscal/enquadramentos`. O valor submetido é o id; o texto visível é o de D5.

## 11. Auditoria (Princípio IV)

Cada mutação chama `AuditoriaService.registrar` na mesma transação, com `usuarioId` e `justificativa`.
O histórico lê `auditoria` por `(tabela, registro_id)` da versão e, na versão nova, também da origem.
`resumo` em português, fechado: "Simulação calculada", "Versão nova do código {codigo}". Nunca o nome da
tabela nem UUID. Explicar, exportar e comparar não gravam auditoria e não emitem evento.

## 12. Estrutura de arquivos (ownership exclusivo)

Backend (`app/backend/`):

- Criar: `src/database/schema/fiscal-simulacoes.schema.ts`.
- Criar: `src/modules/erp/fiscal/simulacoes/simulacoes-fiscais.module.ts`.
- Criar: `src/modules/erp/fiscal/simulacoes/simulacoes.controller.ts`.
- Criar: `src/modules/erp/fiscal/simulacoes/simulacoes.service.ts`.
- Criar: `src/modules/erp/fiscal/simulacoes/decimal-memoria.ts`.
- Criar: `src/modules/erp/fiscal/simulacoes/explicacao.ts`.
- Criar: `src/modules/erp/fiscal/simulacoes/exportacao-csv.ts`.
- Criar: `src/modules/erp/fiscal/simulacoes/dto/comum.dto.ts`.
- Criar: `src/modules/erp/fiscal/simulacoes/dto/simulacao.dto.ts`.
- Criar: `src/database/migrations/0047_e01_t04_simulacoes_fiscais.sql` e o snapshot `meta/0047_snapshot.json`
  gerados pelo drizzle-kit; o journal `meta/_journal.json` ganha a tag `0047_e01_t04_simulacoes_fiscais`.
- Criar testes: `test/unit/decimal-memoria.spec.ts`, `test/unit/fiscal-simulacoes-dto.spec.ts`.
- Criar testes: `test/integration/e01-t04-migrations.e2e-spec.ts`, `e01-t04-simulacoes.e2e-spec.ts`,
  `e01-t04-comparar.e2e-spec.ts`, `e01-t04-concorrencia.e2e-spec.ts`, `e01-t04-eventos.e2e-spec.ts`.
- Modificar: `src/database/schema/index.ts` (uma linha de export).
- Modificar: `src/database/migrations/ROLLBACK.md` (seção E01-T04).
- Modificar: `src/database/seed.ts` (só o parâmetro novo).
- Modificar: `src/common/rbac/permissoes.ts`, `menus-canonicos.ts`, `perfil-permissoes.snapshot.json`, `perfil-menus.snapshot.json`.
- Modificar: `src/app.module.ts` (import de `SimulacoesFiscaisModule`).
- Modificar: `src/realtime/room-permissoes.ts`, `src/realtime/realtime.gateway.ts`, `src/realtime/events/eventos.ts`.
- Modificar: `test/helpers/test-app.ts` — no `TRUNCATE`, incluir `simulacoes_fiscais` antes de `regras_tributarias`.
- Modificar: `test/unit/room-permissoes.spec.ts` (caso novo, sem apagar os anteriores).
- Modificar: `test/integration/perfis-menus.e2e-spec.ts` (contagens e as dez permissões).

Frontend (`app/frontend/`):

- Criar: `src/app/(admin)/fiscal/simulador/page.tsx`.
- Criar: `src/components/fiscal/simulacoes/simulacoes-client.tsx`, `simulacao-drawer.tsx`, `explicacao-painel.tsx`, `comparar-dialog.tsx`, `versao-dialog.tsx`, `abas-detalhe.tsx`.
- Criar: `src/lib/fiscal-simulacoes.ts`.
- Criar BFF: `src/app/api/erp/fiscal/simulacoes/route.ts`, `simulacoes/contagens/route.ts`, `simulacoes/exportacao/route.ts`.
- Criar BFF: `src/app/api/erp/fiscal/simulacoes/[id]/route.ts`, `simulacoes/[id]/comparar/route.ts`, `simulacoes/[id]/memoria/route.ts`, `simulacoes/[id]/[acao]/route.ts` com allowlist `versoes` · `explicacao` · `historico` · `pre-condicoes`.
- Criar testes: `__tests__/fiscal-simulacoes-lib.test.ts`, `__tests__/bff-e01-t04.test.ts`, `__tests__/simulacoes-client.test.tsx`.
- Modificar: `src/lib/menu-v2.ts`, `__tests__/menu-v2.test.ts`, `__tests__/menu-rbac.test.ts`.
- Criar: `e2e/e01-t04-simulador.spec.ts`, `e2e/capture-e01-t04-evidencias.spec.ts`, `e2e/helpers/e01-t04-seed.ts`.
- Criar evidências: `docs/evidencias/e01-t04/*.png` (Task 13).

Proibido nesta fatia: `docs/execucao/**`, `GATE-VEREDITOS.md`, `e2e/shell-ds.spec.ts`, schemas e services de
empresas, enquadramentos e regras (exceto o import de `travarEnquadramento` e dos mapas de rótulo),
`notas-fiscais*.ts`, `faturamento.schema.ts`, tabela nova de nota, coluna de XML, publicar, cenários de
regressão, `FISCAL_SIMULACOES_APROVAR`, colunas `data_comercial` / `data_fiscal` / `data_efetiva`,
`parseFloat` no cálculo.

## 13. Mapa DoD → teste

| Critério (fonte) | Teste (arquivo · nome) |
|---|---|
| DoD (1) ações do Caderno B L87 | e01-t04-simulacoes · "simular grava memória e explicação"; "versão nova grava numero_versao 2"; e01-t04-comparar · "mesmo código lista ICMS" |
| DoD (2) campos | fiscal-simulacoes-dto · "terceira casa no valor", "quarta casa no peso", "competência 2026-10-01", "strict rejeita baseCalculo, regraId, dataComercial e notaId" |
| DoD (3) recarregar | e01-t04-simulacoes · "GET detalhe devolve base 583.30, ICMS 70.00 e competência 2026-10" |
| DoD (4) autorização | e01-t04-simulacoes · "gestor sem FISCAL_SIMULACOES_* → 403"; "LER sem GERENCIAR → 403 no POST" |
| DoD (4) dupla aprovação | e01-t04-simulacoes · "um administrador simula sozinho"; pre-condicoes · "DUPLA_APROVACAO provisoria=true e atendida=false"; bff · "aprovar na allowlist → 404" |
| DoD (5) falha externa | e01-t04-simulacoes · "simular não abre socket HTTP" (`global.fetch` com 0 chamadas) |
| DoD (6) auditoria | e01-t04-simulacoes · "simular grava 1 auditoria"; "histórico não tem nome de tabela nem uuid"; "explicar não grava auditoria" |
| DoD (7) Playwright | e01-t04-simulador.spec · jornada, 403, teclado e rótulos (Task 12) |
| DoD (8) 39 rotas | menu-rbac · "sem /fiscal/ = 39"; "total 43"; "atribuições 130"; e01-t04-simulacoes · "POST não altera regras_tributarias, enquadramentos_fiscais, cfops, ncms, empresas nem notas_fiscais" |
| Base difere (L86) | e01-t04-simulacoes · "base tributável diferente do valor bruto grava a memória" |
| Falta referência (L86) | e01-t04-simulacoes · "competência fora da vigência não grava" |
| Decimal exato (L85) | decimal-memoria · "10,05 com alíquota 12,00 gera ICMS 1.21"; "fonte sem float" |
| Sem documento (L85) | e01-t04-simulacoes · "simulação não grava nota nem documento"; e01-t04-migrations · "sem FK para nota" |
| Três datas (H-E01-10) | e01-t04-migrations · "information_schema.columns de simulacoes_fiscais não contém data_comercial, data_fiscal nem data_efetiva" |
| Rótulos literais | simulacoes-client · "rótulos literais do protótipo" |
| Menu | menu-v2 · "43 itens"; perfis-menus.e2e · "43" e "dez permissões no módulo Fiscal" |
| Concorrência | e01-t04-concorrencia · "2 versões simultâneas → numero 2 e 3"; "PATCH → 409 VERSAO_IMUTAVEL" |
| Eventos | e01-t04-eventos · "1 evento depois do commit"; "422 de referência não emite" |
| Room | room-permissoes · "fiscal-simulacoes exige FISCAL_SIMULACOES_LER"; "fiscal-regras inalterada" |
| Comparar | e01-t04-comparar · "mesmo código lista ICMS"; "códigos distintos → 422 SIMULACOES_DISTINTAS" |
| BFF | bff-e01-t04 · "repassa 409 e 422"; "CSV da memória mantém text/csv"; "ação fora da allowlist → 404 sem backend" |
| Cobertura ≥ 80% | `npm run test:cov` e `node scripts/check-coverage.mjs --min 80` |

## 14. Tasks

Comandos a partir de `F:\Projetos\AlphaCarnes\.worktrees\e01-t04`. Banco de teste dedicado (os testes truncam):

```powershell
docker compose up -d postgres
docker compose exec postgres psql -U alphacarnes -d alphacarnes -c "CREATE DATABASE alphacarnes_e01_t04"
$env:DATABASE_URL = 'postgres://alphacarnes:alphacarnes@localhost:15433/alphacarnes_e01_t04'
```

Não executar `docker compose up` do serviço `backend`. Saída esperada do `CREATE DATABASE`: `CREATE DATABASE`
ou "already exists". Cada task de código: teste, ver falhar, implementar, ver passar, commitar só os paths da
task (`git add` explícito). Não usar `git add -A`. Não commitar em outra branch.

### Task 0 — Context7 e leitura obrigatória (sem commit)

1. Context7 (`resolve-library-id` + `get-library-docs`): Drizzle 0.45 "pgTable numeric boolean check uniqueIndex where"; NestJS 11 "ConflictException e UnprocessableEntityException com objeto"; Zod 4 "strict object string transform"; Next 16 route handlers. Registrar as APIs no relatório do PR (o PR não é desta sessão).
2. Ler: este plano §4–§7; `fiscal-simulacoes` ainda não existe; `fiscal-regras.schema.ts`; `regras.service.ts` L46 `travarEnquadramento`; `regras/percentual.ts` `formatarPercentualPtBr`; `fiscal-comum.ts` L22–L90; `permissoes.ts` L415–L423; `menus-canonicos.ts` L48; `menu-v2.ts` L85–L106; `room-permissoes.ts`; `realtime.gateway.ts`; `eventos.ts`; `test-app.ts` `cleanupDb` L61–L63; `(admin)/fiscal/regras/page.tsx`.

### Task 1 — Decimal da memória

**Files:** criar `app/backend/src/modules/erp/fiscal/simulacoes/decimal-memoria.ts`; teste `app/backend/test/unit/decimal-memoria.spec.ts`.

**Produces:** `normalizarDinheiro`, `normalizarEscala`, `calcularMemoria`, `formatarDinheiroPtBr`, `formatarEscalaPtBr`, `rotuloCompetencia`, `aplicarRazao`, `complementoRazao`.

Review Focus 1, o teste que falha antes da implementação:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { calcularMemoria, formatarDinheiroPtBr, normalizarDinheiro, rotuloCompetencia } from '../../src/modules/erp/fiscal/simulacoes/decimal-memoria';

describe('decimal-memoria', () => {
  it('10,05 com alíquota 12,00 gera ICMS 1.21', () => {
    expect(normalizarDinheiro('10,05')).toBe('10.05');
    expect(normalizarDinheiro('R$ 1.000,00')).toBe('1000.00');
    expect(normalizarDinheiro('10,005')).toBeNull();
    expect(normalizarDinheiro('1e2')).toBeNull();
    const icms = calcularMemoria({ valor: '10.05', desconto: '0.00', pRedBc: '0.0000', pIcms: '0.1200' });
    expect(icms).toEqual({ valorLiquido: '10.05', baseTributavel: '10.05', icms: '1.21', baseDifereBruto: false });
    const reduzida = calcularMemoria({ valor: '1000.00', desconto: '0.00', pRedBc: '0.4167', pIcms: '0.1200' });
    expect(reduzida).toEqual({ valorLiquido: '1000.00', baseTributavel: '583.30', icms: '70.00', baseDifereBruto: true });
    const desconto = calcularMemoria({ valor: '1000.00', desconto: '100.00', pRedBc: '0.0000', pIcms: '0.1200' });
    expect(desconto).toMatchObject({ valorLiquido: '900.00', baseTributavel: '900.00', icms: '108.00', baseDifereBruto: true });
    const descontoEReducao = calcularMemoria({ valor: '1000.00', desconto: '100.00', pRedBc: '0.4167', pIcms: '0.1200' });
    expect(descontoEReducao).toEqual({ valorLiquido: '900.00', baseTributavel: '524.97', icms: '63.00', baseDifereBruto: true });
    expect(calcularMemoria({ valor: '1000.00', desconto: '1000.01', pRedBc: '0.0000', pIcms: '0.1200' })).toBeNull();
    expect(formatarDinheiroPtBr('583.30')).toBe('583,30');
    expect(formatarDinheiroPtBr('1000.00')).toBe('1.000,00');
    expect(rotuloCompetencia('2026-10')).toBe('Outubro de 2026');
  });

  it('fonte sem float', () => {
    const fonte = readFileSync(join(__dirname, '../../src/modules/erp/fiscal/simulacoes/decimal-memoria.ts'), 'utf8');
    expect(fonte).not.toMatch(/parseFloat|parseInt|Number\(|Math\./);
  });
});
```

```powershell
Set-Location app/backend
npx jest test/unit/decimal-memoria.spec.ts
```

Esperado antes do código: FAIL "Cannot find module". Depois: PASS. Implementar com o bloco da seção 6.

```powershell
git add app/backend/src/modules/erp/fiscal/simulacoes/decimal-memoria.ts app/backend/test/unit/decimal-memoria.spec.ts
git commit -m @"
feat(e01-t04): calcular memória fiscal com decimal exato

### Descrição Detalhada:
Inclui a conta de valor líquido, base e ICMS em bigint, com meio para cima, e os normalizadores de dinheiro e de quantidade.

### Motivo da Mudança:
A memória precisa reproduzir 1,21 e 583,30 sem ponto flutuante, e a quantidade não entra na multiplicação.

### Impacto:
O DTO e o serviço passam a importar estas funções. Nenhuma rota existe ainda.
"@
```

### Task 2 — Schema, migration 0047 e testes de banco

**Files:** o schema da seção 5, `schema/index.ts`, migration gerada, `ROLLBACK.md`, `test-app.ts`, `test/integration/e01-t04-migrations.e2e-spec.ts`.

**Consumes:** nada de rota. **Produces:** tabela `simulacoes_fiscais`.

Review Focus 3 e 4, o teste consulta `information_schema` e falha enquanto a tabela não existe:

```ts
it('a simulação não ganha coluna de data fiscal nem FK de nota', async () => {
  const colunas = await db.execute(sql`
    SELECT column_name, data_type, numeric_precision::int AS numeric_precision, numeric_scale::int AS numeric_scale
    FROM information_schema.columns
    WHERE table_name = 'simulacoes_fiscais'
  `);
  const nomes = colunas.rows.map((r) => String((r as { column_name: string }).column_name));
  for (const proibida of ['data_comercial', 'data_fiscal', 'data_efetiva', 'nota_id', 'xml', 'chave', 'protocolo', 'p_icms', 'p_red_bc', 'ipi', 'pis', 'ibs']) {
    expect(nomes).not.toContain(proibida);
  }
  expect(nomes).toEqual(expect.arrayContaining(['competencia', 'valor', 'desconto', 'valor_liquido', 'base_tributavel', 'icms', 'quantidade', 'peso_nf', 'regra_id']));
  const dinheiro = colunas.rows.filter((r) => ['valor', 'desconto', 'valor_liquido', 'base_tributavel', 'icms'].includes(String((r as { column_name: string }).column_name)));
  for (const coluna of dinheiro) {
    expect(coluna).toMatchObject({ data_type: 'numeric', numeric_precision: 15, numeric_scale: 2 });
  }
  const fks = await db.execute(sql`
    SELECT ccu.table_name AS destino
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'simulacoes_fiscais' AND tc.constraint_type = 'FOREIGN KEY'
  `);
  const destinos = fks.rows.map((r) => String((r as { destino: string }).destino));
  expect(destinos).not.toContain('notas_fiscais');
  expect(destinos).not.toContain('notas_fiscais_fornecedor');
  const doubles = colunas.rows.filter((r) => String((r as { data_type: string }).data_type) === 'double precision');
  expect(doubles).toHaveLength(0);
});
```

Acrescentar no mesmo arquivo: `competencia = '2026-13'` viola `simulacoes_competencia_check`; `situacao = 'APROVADA'` viola `simulacoes_situacao_check`; `desconto > valor` viola `simulacoes_desconto_teto_check`; `uq_simulacoes_codigo_versao` é parcial (`WHERE deleted_at IS NULL`).

```powershell
Set-Location app/backend
npx drizzle-kit generate --name e01_t04_simulacoes_fiscais
$arquivo = Get-ChildItem src/database/migrations/*e01_t04*.sql
if ($arquivo.Name -notlike '0047_*') { throw "migration fora do 0047: $($arquivo.Name)" }
$permitido = '^(CREATE TABLE "simulacoes_fiscais"|CREATE (UNIQUE )?INDEX "\w+" ON "simulacoes_fiscais"|ALTER TABLE "simulacoes_fiscais" ADD CONSTRAINT)'
Get-Content $arquivo.FullName -Raw |
  ForEach-Object { $_ -split '--> statement-breakpoint' } | ForEach-Object { $_.Trim() } |
  Where-Object { $_ -and $_ -notmatch $permitido }
npm run db:migrate
npx jest test/integration/e01-t04-migrations.e2e-spec.ts
```

Esperado: um SQL `0047_e01_t04_simulacoes_fiscais.sql`; o pipeline de allowlist sem saída; migrate sem erro; testes passam. `ROLLBACK.md` ganha a seção "E01-T04" com `DROP TABLE IF EXISTS simulacoes_fiscais;`. `test-app.ts` trunca `simulacoes_fiscais` antes de `regras_tributarias`.

```powershell
git add app/backend/src/database/schema/fiscal-simulacoes.schema.ts app/backend/src/database/schema/index.ts app/backend/src/database/migrations/0047_e01_t04_simulacoes_fiscais.sql app/backend/src/database/migrations/meta/_journal.json app/backend/src/database/migrations/meta/0047_snapshot.json app/backend/src/database/migrations/ROLLBACK.md app/backend/test/helpers/test-app.ts app/backend/test/integration/e01-t04-migrations.e2e-spec.ts
git commit -m @"
feat(e01-t04): schema da simulação fiscal e da memória

### Descrição Detalhada:
Cria a migration 0047 com a memória versionada, competência em YYYY-MM e dinheiro NUMERIC(15,2), sem coluna de nota nem de data comercial, fiscal ou efetiva.

### Motivo da Mudança:
A simulação precisa ser recarregada e comparada sem virar lançamento fiscal.

### Impacto:
O truncate dos testes passa a limpar simulacoes_fiscais antes das regras. Nenhuma rota HTTP nova.
"@
```

### Task 3 — Permissões, parâmetro, menu canônico e snapshots

**Files:** seção 9. Inclui o teste de catálogo Fiscal com dez permissões, as oito anteriores preservadas na ordem.

```powershell
Set-Location app/backend
npx tsx scripts/gerar-snapshot-perfis.ts
git diff -U0 -- src/common/rbac/perfil-menus.snapshot.json src/common/rbac/perfil-permissoes.snapshot.json
git diff -U0 -- src/common/rbac/menus-canonicos.ts | Select-String "^-\s+'/"
npx jest test/unit/perfil-permissoes-snapshot.spec.ts test/integration/perfis-menus.e2e-spec.ts
npm run db:seed
```

Esperado: diffs dos snapshots só sob `administrador` (+ `/fiscal/simulador`, + duas permissões); `Select-String` sem saída (nenhuma rota removida); testes passam com 43 menus e dez permissões Fiscais; seed sem erro. No frontend, atualizar `menu-v2.ts`, `menu-v2.test.ts` e `menu-rbac.test.ts` para 43 itens, 130 atribuições e o quarto item do grupo. Jest desses dois arquivos no `app/frontend`.

```powershell
git add app/backend/src/common/rbac/permissoes.ts app/backend/src/common/rbac/menus-canonicos.ts app/backend/src/common/rbac/perfil-permissoes.snapshot.json app/backend/src/common/rbac/perfil-menus.snapshot.json app/backend/src/database/seed.ts app/backend/test/integration/perfis-menus.e2e-spec.ts app/frontend/src/lib/menu-v2.ts app/frontend/__tests__/menu-v2.test.ts app/frontend/__tests__/menu-rbac.test.ts
git commit -m @"
feat(e01-t04): permissões FISCAL_SIMULACOES_* e item no menu Fiscal

### Descrição Detalhada:
Entrega leitura e gestão da simulação só ao administrador, o parâmetro provisório H-E01-12 e o item Simulador fiscal e memória de cálculo em /fiscal/simulador.

### Motivo da Mudança:
A persona do protótipo não pode virar um 12º perfil, e a tela nova precisa de permissão própria.

### Impacto:
O catálogo Fiscal passa de oito para dez permissões. As 39 rotas operacionais e os três itens fiscais já existentes permanecem.
"@
```

### Task 4 — DTOs Zod

**Files:** `dto/comum.dto.ts`, `dto/simulacao.dto.ts`, `test/unit/fiscal-simulacoes-dto.spec.ts`.

**Consumes:** `normalizarDinheiro` e `normalizarEscala`. **Produces:** `criarSimulacaoSchema`, `novaVersaoSchema`, `listarSimulacoesSchema`.

`comum.dto.ts` reexporta `justificativaSchema`, `versaoSchema` e `uuidSchema` com os mesmos limites de `enquadramentos/dto/comum.dto.ts` (`trim` 3–500, `versao` inteiro `>= 1`, `z.uuid()`).

```ts
export const dinheiroSchema = z.string().trim().transform((valor, ctx) => {
  const canon = normalizarDinheiro(valor);
  if (!canon) {
    ctx.addIssue({ code: 'custom', message: 'Informe um valor com até duas casas decimais.' });
    return z.NEVER;
  }
  return canon;
});

export const quantidadeSchema = z.string().trim().transform((valor, ctx) => {
  const canon = normalizarEscala(valor, 12);
  if (!canon || canon === '0.000') {
    ctx.addIssue({ code: 'custom', message: 'Informe uma quantidade maior que zero, com até três casas.' });
    return z.NEVER;
  }
  return canon;
});

export const pesoSchema = z.string().trim().transform((valor, ctx) => {
  const canon = normalizarEscala(valor, 7);
  if (!canon || canon === '0.000') {
    ctx.addIssue({ code: 'custom', message: 'Informe o peso informado na nota (kg) maior que zero, com até três casas.' });
    return z.NEVER;
  }
  return canon;
});

export const competenciaSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Informe a competência como AAAA-MM.');
```

`valor` passa por `dinheiroSchema` e `.refine` de centavos `> 0`, mensagem "Informe um valor maior que zero." `desconto` aceita `0.00`. `.superRefine` não compara desconto com valor: isso é 422 no serviço (D8).

Review Focus 1, o teste do número:

```ts
it('valor numérico é 400', () => {
  const parsed = criarSimulacaoSchema.safeParse({ ...corpoValido, valor: 10.05 });
  expect(parsed.success).toBe(false);
});

it('strict rejeita baseCalculo, regraId, dataComercial e notaId', () => {
  const parsed = criarSimulacaoSchema.safeParse({
    ...corpoValido,
    baseCalculo: '10.00',
    regraId: crypto.randomUUID(),
    dataComercial: '2026-10-01',
    notaId: crypto.randomUUID(),
  });
  expect(parsed.success).toBe(false);
});
```

`corpoValido` usa `valor: '1.000,00'`, `desconto: '0,00'`, `quantidade: '10,000'`, `pesoNf: '982,000'`, `competencia: '2026-10'`. Sucesso devolve `valor === '1000.00'`, `quantidade === '10.000'`, `pesoNf === '982.000'`. Também falham: `valor: '1e2'`, `valor: '10,005'`, `pesoNf: '1,0001'`, `competencia: '2026-10-01'`, `competencia: '2026-13'`.

```powershell
Set-Location app/backend
npx jest test/unit/fiscal-simulacoes-dto.spec.ts
```

Esperado: PASS.

```powershell
git add app/backend/src/modules/erp/fiscal/simulacoes/dto app/backend/test/unit/fiscal-simulacoes-dto.spec.ts
git commit -m @"
feat(e01-t04): DTOs Zod do simulador fiscal

### Descrição Detalhada:
Fecha o corpo da simulação com dinheiro, quantidade e competência em string, e o strict recusa base calculada, regra, data comercial e nota.

### Motivo da Mudança:
Campo fora do contrato precisa falhar com 400 antes de qualquer regra de domínio.

### Impacto:
O serviço da task seguinte recebe só a forma canônica do dinheiro e da quantidade.
"@
```

### Task 5 — Simular, explicar e não lançar

**Files:** `simulacoes.controller.ts`, `simulacoes.service.ts`, `explicacao.ts`, `simulacoes-fiscais.module.ts`, `app.module.ts`, `test/integration/e01-t04-simulacoes.e2e-spec.ts`.

**Consumes:** DTOs da Task 4, `calcularMemoria`, `travarEnquadramento`, mapas de rótulo da regra. **Produces:** `SimulacoesFiscaisService.simular`, `listar`, `detalhar`, `explicar`.

O teste sobe o app, autentica administrador e reusa a API da T03 para deixar uma regra `APROVADA` com `p_red_bc = '0.4167'`, `p_icms = '0.1200'`, vigência `2026-01-01` a `2026-12-31`, no enquadramento do seed. Não insere regra por SQL.

Review Focus 2, 3 e 4:

```ts
it('base tributável diferente do valor bruto grava a memória', async () => {
  const res = await simular(admin, { ...corpo, valor: '1.000,00', desconto: '0,00', competencia: '2026-10' });
  expect(res.status).toBe(201);
  expect(res.body.situacao).toBe('Calculada');
  expect(res.body.baseTributavel).toBe('583.30');
  expect(res.body.icms).toBe('70.00');
  expect(res.body.baseDifereBruto).toBe(true);
  const explicacao = await explicar(admin, res.body.id);
  expect(explicacao.body.textoBase).toContain('1.000,00');
  expect(explicacao.body.textoBase).toContain('583,30');
  expect(explicacao.body.semAliquota.find((l: { rotulo: string }) => l.rotulo === 'Tratamento IPI').texto)
    .toBe('Esta regra não guarda alíquota deste tributo; nenhum valor é calculado.');
  expect(JSON.stringify(explicacao.body.semAliquota)).not.toContain('0,00');
});

it('simulação não grava nota nem documento', async () => {
  const antes = await contarNotas();
  const regrasAntes = Number((await db.execute(sql`SELECT COUNT(*)::int AS n FROM regras_tributarias`)).rows[0].n);
  const res = await simular(admin, corpo);
  expect(res.status).toBe(201);
  expect(await contarNotas()).toEqual(antes);
  const texto = JSON.stringify(res.body);
  expect(texto).not.toMatch(/xml|protocolo|danfe|"chave"/i);
  const regras = await db.execute(sql`SELECT COUNT(*)::int AS n FROM regras_tributarias`);
  expect(regras.rows[0]).toMatchObject({ n: regrasAntes });
});

it('competência fora da vigência não grava', async () => {
  const res = await simular(admin, { ...corpo, competencia: '2027-01' });
  expect(res.status).toBe(422);
  expect(res.body.codigo).toBe('FALTA_REFERENCIA_LEGAL');
  const n = await db.execute(sql`SELECT COUNT(*)::int AS n FROM simulacoes_fiscais`);
  expect(n.rows[0]).toMatchObject({ n: 0 });
});
```

O caso `2027-01` usa a regra cuja vigência termina em `2026-12-31`. Outro caso, no mesmo arquivo: regra com `vigencia_inicio = '2026-11-01'` e competência `2026-10` também devolve 422 `FALTA_REFERENCIA_LEGAL`. Também: desconto `1.000,01` com valor `1.000,00` → 422 `DESCONTO_MAIOR_QUE_VALOR` e zero linhas; troca do produto → 422 `ENQUADRAMENTO_DIVERGENTE`; gestor → 403; quem só tem LER → 403 no POST; um administrador com GERENCIAR recebe 201 sem segundo usuário; POST não muda `updated_at` de `regras_tributarias`, `enquadramentos_fiscais`, `cfops`, `ncms`, `empresas` nem `notas_fiscais`; GET detalhe devolve situação "Calculada", `competencia` `"2026-10"`, `competenciaRotulo` `"Outubro de 2026"`; quantidade `1,000` e `999,000` com o mesmo valor devolvem a mesma base; simular não chama `global.fetch`; cada simulação grava uma auditoria; explicar não grava auditoria; histórico sem o texto `simulacoes_fiscais` e sem uuid; busca pelo uuid da linha devolve `total: 0`.

`contarNotas` faz `COUNT(*)` em `notas_fiscais` e em `notas_fiscais_fornecedor`.

```powershell
Set-Location app/backend
npx jest test/integration/e01-t04-simulacoes.e2e-spec.ts
```

Esperado: PASS.

```powershell
git add app/backend/src/modules/erp/fiscal/simulacoes/simulacoes.controller.ts app/backend/src/modules/erp/fiscal/simulacoes/simulacoes.service.ts app/backend/src/modules/erp/fiscal/simulacoes/explicacao.ts app/backend/src/modules/erp/fiscal/simulacoes/simulacoes-fiscais.module.ts app/backend/src/app.module.ts app/backend/test/integration/e01-t04-simulacoes.e2e-spec.ts
git commit -m @"
feat(e01-t04): simular tributo e explicar a memória

### Descrição Detalhada:
Grava a simulação de um item sobre a regra aprovada vigente, explica o ICMS e registra que IPI, PIS/COFINS e IBS/CBS não têm alíquota nesta regra.

### Motivo da Mudança:
O caderno pede decimal exato e proíbe que o valor simulado vire lançamento sem documento.

### Impacto:
A diferença entre base e valor bruto fica na memória com situação Calculada. Competência fora da vigência não grava linha.
"@
```

### Task 6 — Versão nova e comparação

**Files:** métodos `novaVersao` e `comparar`, rotas da seção 7, `test/integration/e01-t04-comparar.e2e-spec.ts`. Os casos de versão nova que não são comparação entram em `e01-t04-simulacoes.e2e-spec.ts`.

**Consumes:** uma linha `CALCULADA`. **Produces:** `ComparacaoSimulacoes` da seção 7.

```ts
it('mesmo código lista ICMS', async () => {
  const res = await comparar(versao1.id, versao2.id);
  expect(res.status).toBe(200);
  const icms = res.body.diferencas.find((d: { campo: string }) => d.campo === 'ICMS');
  expect(icms).toMatchObject({ antes: '70,00', depois: '63,00' });
  expect(JSON.stringify(res.body)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
});

it('códigos distintos → 422 SIMULACOES_DISTINTAS', async () => {
  const res = await comparar(linhaA.id, linhaB.id);
  expect(res.status).toBe(422);
  expect(res.body.codigo).toBe('SIMULACOES_DISTINTAS');
});
```

A versão 1 é a segunda linha da tabela da seção 6 (ICMS `70,00`). A versão 2 muda só o desconto para `100,00` e cai na quarta linha (base `524.97`, ICMS `63,00` na comparação).

Trocar `enquadramentoId` na versão nova → 422 `LINHAGEM_ENQUADRAMENTO_FIXO` e a linha nova não existe. Competência `2027-01` na versão nova → 422 `FALTA_REFERENCIA_LEGAL` e `numero_versao` 2 não existe. A comparação não emite evento e não grava auditoria.

```powershell
Set-Location app/backend
npx jest test/integration/e01-t04-comparar.e2e-spec.ts test/integration/e01-t04-simulacoes.e2e-spec.ts
```

```powershell
git add app/backend/src/modules/erp/fiscal/simulacoes/simulacoes.controller.ts app/backend/src/modules/erp/fiscal/simulacoes/simulacoes.service.ts app/backend/test/integration/e01-t04-comparar.e2e-spec.ts app/backend/test/integration/e01-t04-simulacoes.e2e-spec.ts
git commit -m @"
feat(e01-t04): versão nova e comparação da memória

### Descrição Detalhada:
Acrescenta versão da mesma simulação e compara os campos calculados em pt-BR, recusando outra linhagem e outro enquadramento.

### Motivo da Mudança:
Comparar versões desta tela é diferença de memória de cálculo, distinta da comparação de cadastro da regra.

### Impacto:
A versão nova resolve de novo a regra da competência e não altera a versão anterior.
"@
```

### Task 7 — Concorrência e eventos

**Files:** o `emit` depois do commit; `eventos.ts`; `test/integration/e01-t04-concorrencia.e2e-spec.ts` e `e01-t04-eventos.e2e-spec.ts`.

`PATCH` de uma memória → 409 `VERSAO_IMUTAVEL` e os centavos de `icms` iguais aos gravados. Duas versões novas em `Promise.all` → ambos 201 e o conjunto de `numeroVersao` igual a `{2, 3}`. O evento `simulacao_fiscal_alterada` chega uma vez, depois do commit, com `acao: 'simulada'`. O 422 `FALTA_REFERENCIA_LEGAL` não emite. O payload não contém `valor`, `baseTributavel`, `icms` nem `notaId`.

```powershell
Set-Location app/backend
npx jest test/integration/e01-t04-concorrencia.e2e-spec.ts test/integration/e01-t04-eventos.e2e-spec.ts
```

```powershell
git add app/backend/src/modules/erp/fiscal/simulacoes/simulacoes.service.ts app/backend/src/realtime/events/eventos.ts app/backend/test/integration/e01-t04-concorrencia.e2e-spec.ts app/backend/test/integration/e01-t04-eventos.e2e-spec.ts
git commit -m @"
feat(e01-t04): concorrência e evento pós-commit da simulação

### Descrição Detalhada:
Serializa a versão nova no código da linhagem e publica simulacao_fiscal_alterada só depois do commit, sem valor no payload.

### Motivo da Mudança:
Duas versões simultâneas não podem gravar o mesmo número, e a falta de referência legal não pode parecer sucesso no tempo real.

### Impacto:
A room ainda não está protegida; a task seguinte fecha a autorização do socket.
"@
```

### Task 8 — Room protegida

**Files:** `room-permissoes.ts`, `realtime.gateway.ts`, caso novo em `room-permissoes.spec.ts`.

```ts
it('fiscal-simulacoes exige FISCAL_SIMULACOES_LER e não altera as rooms anteriores', () => {
  expect(ROOMS_PROTEGIDAS['fiscal-simulacoes']).toBe(PERMISSOES.FISCAL_SIMULACOES_LER);
  expect(ROOMS_PROTEGIDAS['fiscal-regras']).toBe(PERMISSOES.FISCAL_REGRAS_LER);
  expect(ROOMS_PROTEGIDAS['fiscal-empresas']).toBe(PERMISSOES.FISCAL_EMPRESAS_LER);
  expect(ROOMS_PROTEGIDAS['fiscal-enquadramentos']).toBe(PERMISSOES.FISCAL_ENQUADRAMENTOS_LER);
});
```

O handler novo chama `broadcastRoom('fiscal-simulacoes', ...)`. Não editar `publicarFiscal` nem o handler de `regra_tributaria_alterada`.

```powershell
Set-Location app/backend
npx jest test/unit/room-permissoes.spec.ts
```

```powershell
git add app/backend/src/realtime/room-permissoes.ts app/backend/src/realtime/realtime.gateway.ts app/backend/test/unit/room-permissoes.spec.ts
git commit -m @"
feat(e01-t04): room fiscal-simulacoes protegida por leitura

### Descrição Detalhada:
Registra a room fiscal-simulacoes na permissão de leitura e o handler do evento, sem mexer nas rooms de empresas, enquadramentos e regras.

### Motivo da Mudança:
O tempo real da simulação não pode vazar para quem não consulta a memória nem deslocar o broadcast das fatias anteriores.

### Impacto:
Quem não tem FISCAL_SIMULACOES_LER não entra na room.
"@
```

### Task 9 — Histórico, exportação e pré-condições

**Files:** `exportacao-csv.ts`, rotas `historico`, `pre-condicoes`, `memoria`, `exportacao`, `contagens` no controller, testes acrescentados em `e01-t04-simulacoes.e2e-spec.ts`.

CSV da memória com BOM, `;`, cabeçalho "Campo;Valor", linha "ICMS;70,00" no caso da redução, e a linha "Tratamento IPI;" contendo a frase de D7 e não contendo `0,00`. CSV da visão com o cabeçalho da seção 7 e a célula de Cliente igual ao nome fantasia. Pré-condições com os seis códigos da seção 7; `DUPLA_APROVACAO`, `DATAS_COMERCIAL_FISCAL_EFETIVA` e `PERFIS_ALEM_ADMINISTRADOR` vêm `atendida: false` e `provisoria: true`. `MEMORIA_SEM_DOCUMENTO` vem `atendida: true`. Histórico usa os resumos da seção 11.

```powershell
Set-Location app/backend
npx jest test/integration/e01-t04-simulacoes.e2e-spec.ts
```

```powershell
git add app/backend/src/modules/erp/fiscal/simulacoes/exportacao-csv.ts app/backend/src/modules/erp/fiscal/simulacoes/simulacoes.controller.ts app/backend/src/modules/erp/fiscal/simulacoes/simulacoes.service.ts app/backend/test/integration/e01-t04-simulacoes.e2e-spec.ts
git commit -m @"
feat(e01-t04): histórico, exportação e pré-condições da memória

### Descrição Detalhada:
Expõe o histórico auditável, o CSV da memória e o da grade, e as pré-condições, mantendo dupla aprovação, três datas e demais perfis como provisórios.

### Motivo da Mudança:
A ficha precisa mostrar a trilha e o que ainda depende de decisão, sem tratar o selo como bloqueio de simulação.

### Impacto:
O CSV não leva identificador técnico. A pré-condição provisória não exige um segundo usuário para simular.
"@
```

### Task 10 — BFF `/api/erp/fiscal`

**Files:** as rotas da seção 12 e `__tests__/bff-e01-t04.test.ts`. Padrão de `app/frontend/src/app/api/erp/fiscal/regras/route.ts`: `repassar`.

Allowlist de `[acao]`: `versoes`, `explicacao`, `historico`, `pre-condicoes`. Fora dela, inclusive `aprovar` e `publicar`, 404 e o backend não é chamado. `memoria` e `exportacao` repassam o `Content-Type` `text/csv; charset=utf-8`. 409 e 422 atravessam com o `codigo` do corpo. `PATCH` repassa o 409.

```powershell
Set-Location app/frontend
npx jest __tests__/bff-e01-t04.test.ts
```

```powershell
git add app/frontend/src/app/api/erp/fiscal/simulacoes app/frontend/__tests__/bff-e01-t04.test.ts
git commit -m @"
feat(e01-t04): BFF /api/erp/fiscal das simulações

### Descrição Detalhada:
Encaminha lista, detalhe, explicação, comparação, CSV e a versão nova, com allowlist que barra aprovar e publicar.

### Motivo da Mudança:
A página não conversa direto com o Nest; o BFF conserva o status 400, 403, 409 e 422.

### Impacto:
Ação fora da lista responde 404 sem chegar ao backend.
"@
```

### Task 11 — Página, componentes e rótulos

**Files:** página, componentes e `lib/fiscal-simulacoes.ts` da seção 10; `__tests__/fiscal-simulacoes-lib.test.ts`; `__tests__/simulacoes-client.test.tsx`.

Review Focus 5, no teste do cliente. Renderizar o drawer e o painel de explicação:

```tsx
it('rótulos literais do protótipo', () => {
  render(<SimulacaoDrawer aberto estabelecimentos={[]} operacoes={[]} clientes={[]} produtos={[]} ncms={[]} enquadramentos={[]} />);
  expect(screen.getByLabelText('Estabelecimento')).toBeInTheDocument();
  expect(screen.getByLabelText('Operação')).toBeInTheDocument();
  expect(screen.getByLabelText('Cliente')).toBeInTheDocument();
  expect(screen.getByLabelText('Produto')).toBeInTheDocument();
  expect(screen.getByLabelText('Classificação fiscal (NCM)')).toBeInTheDocument();
  expect(screen.getByLabelText('Quantidade')).toBeInTheDocument();
  expect(screen.getByLabelText('Peso informado na nota (kg)')).toBeInTheDocument();
  expect(screen.getByLabelText('Valor')).toBeInTheDocument();
  expect(screen.getByLabelText('Desconto')).toBeInTheDocument();
  expect(screen.getByLabelText('Competência')).toBeInTheDocument();
  expect(screen.getByLabelText('Enquadramento fiscal')).toBeInTheDocument();
  expect(screen.getByLabelText('Motivo da alteração')).toBeInTheDocument();
  expect(screen.getByLabelText('Base tributável (calculada)')).toBeDisabled();
  expect(screen.getByLabelText('Valor líquido (calculado)')).toBeDisabled();
  const texto = document.body.textContent ?? '';
  expect(texto).not.toMatch(/E01-T04/);
  expect(texto).not.toMatch(/Marca/);
  expect(texto).not.toMatch(/\bCST\b/);
  expect(texto).not.toMatch(/\bpICMS\b/);
  expect(texto).not.toMatch(/vProd/);
});
```

O teste do painel, com uma explicação fixture, afirma o rótulo "Tratamento IPI", a frase de D7, a ausência de `0,00` nesse item, e os rótulos "Redução de base do ICMS (%)" e "Alíquota (%)". Também cobre: lista vazia com a frase da seção 10; alerta do 422 `FALTA_REFERENCIA_LEGAL`; alerta do 422 `DESCONTO_MAIOR_QUE_VALOR`; alerta do 409 `VERSAO_IMUTAVEL`; grade sem uuid; selos `H-E01-10`, `H-E01-11` e `H-E01-12`; ausência dos botões "Aprovar" e "Publicar".

O teste da lib repete `formatarDinheiroPtBr('583.30') === '583,30'`, `rotuloCompetencia('2026-10') === 'Outubro de 2026'` e `expect(lib).not.toHaveProperty('calcularMemoria')`. O fonte de `fiscal-simulacoes.ts` não contém `parseFloat` nem `Number(`.

```powershell
Set-Location app/frontend
npx jest __tests__/simulacoes-client.test.tsx __tests__/fiscal-simulacoes-lib.test.ts __tests__/menu-v2.test.ts
```

```powershell
git add app/frontend/src/app/(admin)/fiscal/simulador/page.tsx app/frontend/src/components/fiscal/simulacoes app/frontend/src/lib/fiscal-simulacoes.ts app/frontend/__tests__/simulacoes-client.test.tsx app/frontend/__tests__/fiscal-simulacoes-lib.test.ts
git commit -m @"
feat(e01-t04): página do simulador fiscal no grupo Fiscal

### Descrição Detalhada:
Publica /fiscal/simulador com os rótulos literais do protótipo, a memória calculada no servidor e os selos provisórios já abertos.

### Motivo da Mudança:
A tela precisa ser operável no DS v3 sem mostrar código de épico, UUID ou tributo zerado que a regra não calcula.

### Impacto:
O grupo Fiscal ganha o quarto item. Nenhuma rota operacional sai do menu.
"@
```

### Task 12 — Playwright: jornada, acesso e rótulos

**Files:** `e2e/helpers/e01-t04-seed.ts`, `e2e/e01-t04-simulador.spec.ts`.

O seed cria, pela API: um administrador; um estabelecimento aprovado pela API da T01; produto, cliente e operação pelas APIs existentes; CFOP `5102` e NCM `02013000` pela API da T02; um enquadramento `ATIVA` pela API da T02; benefício, classificação e uma regra `APROVADA` (dois administradores, o segundo só para aprovar a regra) pela API da T03, com redução `41,67`, alíquota `12,00` e vigência `2026-01-01` a `2026-12-31`. Esses códigos são entrada do operador no teste, não `INSERT` da migration.

Backend no host, não no container `alphacarnes-backend-1`:

```powershell
$env:DATABASE_URL = 'postgres://alphacarnes:alphacarnes@localhost:15433/alphacarnes_e01_t04'
$env:PORT = '4001'
Set-Location app/backend
npm run start
```

Frontend: o `webServer` de `playwright.config.ts` (`npx next dev --webpack --port 3100`). Não apontar `E2E_FRONTEND_URL` para a porta 4000. Não usar Turbopack.

Jornada:

1. Menu FISCAL → "Simulador fiscal e memória de cálculo". Os itens "Empresas, estabelecimentos e regime", "Operações fiscais e enquadramentos" e "Editor de regras tributárias" continuam visíveis.
2. Simular: Enquadramento fiscal do seed, os cinco combos preenchidos por ele, Quantidade `10,000`, Peso informado na nota (kg) `982,000`, Valor `1.000,00`, Desconto `0,00`, Competência `2026-10`, justificativa "Simulação da competência de outubro de 2026." O clique é no botão "Salvar rascunho" e grava CALCULADA, sem situação rascunho.
3. A ficha mostra situação Calculada, Valor líquido (calculado) `1.000,00`, Base tributável (calculada) `583,30`, o banner "Base tributável difere de valor bruto" e os selos H-E01-10, H-E01-11 e H-E01-12.
4. Explicar tributos mostra "ICMS" `70,00` e "Tratamento IPI" com a frase de D7, sem `0,00` nessa linha.
5. Exportar memória baixa CSV com cabeçalho "Campo;Valor".
6. Nova versão com Desconto `100,00`. Comparar versões mostra "ICMS" com antes `70,00` e depois `63,00`.
7. Competência `2027-01` → alerta "Não há regra tributária aprovada vigente nesta competência para o enquadramento selecionado." A grade não ganha linha.
8. Não há botão "Aprovar" nem "Publicar".
9. Gestor: o item não aparece; `goto('/fiscal/simulador')` mostra "Você não tem permissão para visualizar o simulador fiscal e a memória de cálculo."

Acessibilidade, sem dependência nova: todo `textbox`, `combobox` e `button` visível tem nome acessível não vazio; Tab até a linha e Enter seleciona; diálogos fecham com Escape e devolvem o foco; `innerText` do `body` sem UUID (`/[0-9a-f]{8}-[0-9a-f]{4}-/i`), sem `/E\d{2}-T\d{2}/` e sem a palavra `Marca`.

```powershell
Set-Location app/frontend
npx playwright test e2e/e01-t04-simulador.spec.ts
```

Esperado: todos passam. Playwright não é job do `ci.yml`.

```powershell
git add app/frontend/e2e/e01-t04-simulador.spec.ts app/frontend/e2e/helpers/e01-t04-seed.ts
git commit -m @"
test(e01-t04): Playwright da jornada, acesso e rótulos

### Descrição Detalhada:
Cobre a simulação de um administrador, a base diferente do valor bruto, a comparação do ICMS e a ausência do item para quem não tem a permissão.

### Motivo da Mudança:
O aceite da fatia exige a tela no webpack da porta 3100, com os rótulos do protótipo e sem código de épico.

### Impacto:
O spec não altera shell-ds e não sobe o backend em container.
"@
```

### Task 13 — Screenshots comparativos

**File:** `e2e/capture-e01-t04-evidencias.spec.ts`, no padrão de `capture-e01-t03-evidencias.spec.ts`: elemento-chave antes de cada captura, fail-hard. Viewport 1280×800, `fullPage`.

Pares em `docs/evidencias/e01-t04/` (`app-<estado>.png` e `prototipo-<estado>.png`), protótipo em
`file:///<worktree>/docs/prototipos/erp-integrado-v1/index.html#E01-T04`:

1. lista
2. ficha
3. movimentacoes
4. regras
5. excecoes
6. historico
7. integracoes
8. aceite
9. drawer

Só app: `vazio`, `erro-retry`, `403`, `comparar`, `base-difere`, `falta-referencia`, `explicacao`.

```powershell
Set-Location app/frontend
npx playwright test e2e/capture-e01-t04-evidencias.spec.ts
(Get-ChildItem ../../docs/evidencias/e01-t04 -Filter *.png).Count
```

Esperado: 25 arquivos (9 pares + 7).

```powershell
git add app/frontend/e2e/capture-e01-t04-evidencias.spec.ts docs/evidencias/e01-t04
git commit -m @"
test(e01-t04): evidências visuais do simulador fiscal

### Descrição Detalhada:
Grava os pares da tela contra o protótipo e os estados só da aplicação: vazio, erro, acesso negado, comparação, base diferente, falta de referência e explicação.

### Motivo da Mudança:
O Portão 2 precisa comparar a tela real com o hash E01-T04 sem publicar regra nem emitir nota.

### Impacto:
São 25 PNG. Eles não substituem o Playwright da task anterior.
"@
```

### Task 14 — Gate local, sem push e sem PR

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

Esperado: comandos verdes; cobertura ≥ 80% linha e branch; o diff contra `develop` contém a E01-T01, a E01-T02 e a E01-T03 já presentes na branch e os arquivos desta fatia; nenhum path fora da seção 12 foi modificado por commit desta fatia (T01, T02 e T03 não são revertidas); `git status` limpo. Não executar `git push` nem `gh pr create`. Não editar `docs/execucao/**`. Não editar `e2e/shell-ds.spec.ts`.

## 15. Gate e evidências para o Portão 2/A

- Relatório no formato `pipeline-execucao.md` §7: task a task, saídas de teste e Playwright, cobertura, APIs do Context7. O Executor registra a onda em `EXECUCAO-STATUS.md` ao disparar (AD-22 (5)); o Worker não edita esse arquivo.
- Portão 2 compara os pares `app-*`/`prototipo-*` (Task 13), confere as remoções da seção 4 e reexecuta Playwright e os testes de menu (39 operacionais + 4 do Fiscal).
- Portão A obrigatório (classe alto).
- CI dos oito jobs e o PR ficam para o fim do lote, fora deste plano.

## 16. Rollback

Seção "E01-T04" de `ROLLBACK.md`:

```sql
DROP TABLE IF EXISTS simulacoes_fiscais;
```

Não derrubar `regras_tributarias`, `classificacoes_ibs_cbs`, `beneficios_fiscais`, `enquadramentos_fiscais`,
`cfops`, `ncms`, `estabelecimentos` nem `empresas`. Reverter o parâmetro `fiscal.simulacoes_perfis_autorizados`,
as duas permissões e o item de menu no mesmo revert da fatia. Os parâmetros
`fiscal.regras_perfis_autorizados` e `fiscal.enquadramentos_perfis_autorizados` ficam.

## 17. Critérios de parada (PARAR e reportar ao coordenador)

- `drizzle-kit` gerar migration com prefixo diferente de `0047`.
- O allowlist da Task 2 imprimir algum statement.
- Necessidade de coluna `data_comercial`, `data_fiscal`, `data_efetiva`, tabela de nota, FK para nota, alíquota de IPI/PIS/IBS, quórum numérico ou publicação para fazer um teste passar.
- Necessidade de editar `shell-ds.spec.ts`, `docs/execucao/` ou schema da T01, da T02 ou da T03.
- Fonte ausente, ambígua ou contraditória que este plano não tenha resolvido na seção 3.

## 18. Pendências e dependências (nenhuma decisão inventada)

| Id | O que falta decidir | Quem decide | O que não fazer até lá | O que esta fatia faz |
|---|---|---|---|---|
| H-E01-10 | Três datas comercial, fiscal e efetiva | Quality Owner | colunas extras de data na regra ou na simulação | competência `YYYY-MM` só como filtro; vigência da regra continua início e fim; selo Provisório |
| H-E01-11 | Quantos aprovadores formam quórum | Quality Owner | exigir dois aprovadores, criar `FISCAL_SIMULACOES_APROVAR` ou aprovar regra nesta tela | simular com um administrador; pré-condição provisória; sem botão Aprovar |
| H-E01-12 | Quais dos 11 perfis, além do administrador, recebem `FISCAL_SIMULACOES_*` | Quality Owner | atribuir a outros perfis ou criar perfil fiscal/contador | seed só administrador; parâmetro `provisorio: true`; edição em `/admin/perfis` |

E01-T05 recebe painel de homologação, publicar regra e cenários de regressão. E02 recebe NF-e, SEFAZ, XML e DANFE.

## 19. Self-review

- Cobertura do Caderno B L82–L90: campos em D3–D10 e na Task 11; ações em D1, D12, D13 e D14 e nas Tasks 5, 6 e 9; exceções em D9 e D11; DoD na seção 13. T05 e E02 estão na seção 0 como fora.
- Lacunas: cada task traz o teste, o comando e a saída esperada. Nenhuma task delega o código a outra.
- Tipos: `calcularMemoria` devolve o objeto da seção 6 ou `null`. O serviço da Task 5 grava `baseTributavel` e `icms` como essas strings. `ComparacaoSimulacoes.diferencas[].campo` usa os rótulos da Task 6, os mesmos da Task 11. Situação do schema é só `CALCULADA`.
- Review Focus: as cinco entradas têm teste na Task 1 e na Task 4 (1), na Task 5 (2, 3 e 4), na Task 2 (3 e 4) e na Task 11 (5).
- Rótulos conferidos em componentes.js L51, L190, L262, L274, L298, L310, L418, L430, L442, L454, L466, L478, L490 e L502, e nos pares de tratamento já exportados por `fiscal-regras.schema.ts`.
- Placeholder: não há "TBD", "TODO", "a definir" nem tarefa que mande copiar outra task.
