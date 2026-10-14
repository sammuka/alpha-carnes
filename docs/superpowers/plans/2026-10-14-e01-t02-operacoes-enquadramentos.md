# E01-T02 — Operações fiscais e enquadramentos — Plano de Implementação (fatia E2E, rito AD-22)

> Para workers agênticos: papel `worker` (AGENTS.md "Papéis"). Worktree `.worktrees/e01-t02`, branch
> `feature/erp-e01-t02-operacoes-enquadramentos`, já posicionada sobre a E01-T01 (PR #164, ainda fora da
> `develop`). Não rebase, não faça checkout da branch da T01, não cherry-pick para ela, não dê `git push`
> e não abra PR. Estado do git é lido por comando no momento do uso; este plano não afirma HEAD, contagem
> de commits nem SHAs (AD-22 (4)).

## Histórico de revisões

| Rev. | Data | Autor | Motivo |
|---|---|---|---|
| r1 | 2026-10-14 | planner | versão inicial da fatia E01-T02 (ALP-111) |

**Goal:** persistir o enquadramento fiscal — vínculo temporal de um estabelecimento já aprovado a uma operação
comercial existente, CFOP, tpNF, finNFe, abrangência, tipo de produto, produto, NCM, CEST, cliente, vigência e
prioridade, com duplicação de perfil — na página `/fiscal/enquadramentos` (DS v3, grupo Fiscal já criado pela
T01) → BFF `/api/erp/fiscal` → NestJS → PostgreSQL → evento pós-commit; e recusar resolver tributo.

**Architecture:** módulo Nest `EnquadramentosFiscaisModule` em `app/backend/src/modules/erp/fiscal/enquadramentos/`
(Caderno B L70), ao lado de `EmpresasFiscaisModule` (não o substitui). Schema Drizzle
`fiscal-enquadramentos.schema.ts`. Catálogos manuais `cfops` e `ncms` vazios (formato, sem tabela nacional).
FKs para `estabelecimentos`, `operacoes`, `produtos` e `clientes` já existentes. Serviço transacional com
auditoria na mesma transação e `EventEmitter2.emit` depois do commit. A consulta de enquadramento devolve erro
explícito e não calcula tributo. Página App Router `app/frontend/src/app/(admin)/fiscal/enquadramentos/page.tsx`.

**Tech Stack (constituição L60):** NestJS 11 + TypeScript 5 strict, Next.js 16 App Router, PostgreSQL 18 +
Drizzle ORM 0.45 / drizzle-kit 0.31, Zod 4, WebSocket `ws`, JWT + RBAC 11 perfis, Jest, Playwright. Nenhuma
dependência nova.

**Classe de risco: ALTO** (AD-22 (6)): (1) permissão nova e item de menu — "RBAC/autorização"; (2) o
enquadramento é insumo fiscal de E01-T03/T04 e E02 — "fiscal". Rito completo: revisão crítica por commit,
Portão 2 e Portão A. CI dos oito jobs fica para o fim do lote; o gate local desta fatia não inclui push nem PR.

**Spec:** Caderno B §E01-T02 (`docs/expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md` L62–L70); matrizes
`docs/prototipos/erp-integrado-v1/MATRIZ-UX-COMPONENTES-61-TELAS.md` L46–L72 e
`MATRIZ-INTEGRAL-INTERFACES.md` L31–L37; protótipo `index.html#E01-T02`.

---

## 0. Escopo da fatia

Entra:
- Enquadramento fiscal: estabelecimento `APPROVED` da T01, operação comercial existente, tpNF, finNFe, CFOP
  manual, abrangência, tipo de produto, produto existente, NCM manual, CEST (texto com formato), cliente
  existente, início/fim de vigência, prioridade gravada, código de negócio, situação Ativa/Inativa, duplicar
  perfil, histórico por auditoria.
- Catálogos manuais `cfops` e `ncms` (código + descrição, sem semente da tabela nacional).
- API REST, auditoria, evento pós-commit, room WS `fiscal-enquadramentos`, exportação CSV, pré-condições.
- Consulta que localiza 0/1/N enquadramentos e **sempre recusa resolver tributo**.
- Página `/fiscal/enquadramentos`, item novo no grupo `FISCAL` já existente, BFF, Jest/RTL, Playwright,
  screenshots contra `index.html#E01-T02`.

Sai (com dono, sem inventar):
- Editor de regras (CST, alíquota, cBenef, IBS/CBS, cClassTrib, submeter/aprovar/aposentar) → E01-T03.
- Simulador, memória de cálculo, comparar versões de tributo, exportar memória → E01-T04.
- Painel de homologação, diff, publicar regra, dupla aprovação de regra → E01-T05.
- Recriar empresa, estabelecimento, regime, CNAE, produto, cliente ou operação comercial.
- Emissão NF-e, SEFAZ, XML, DANFE → E02.

## 1. Global Constraints

- Constituição: Princípios I (L9), II (L20), III (L24), IV (L28), VI (L36), VII (L40), VIII (L44), IX (L48),
  X (L52); stack fixa (L60); sem over-engineering (L61); cobertura backend ≥ 80% linha e branch (L63).
- AGENTS.md: pwsh 7, nunca bash; worker não edita `docs/execucao/`; esta fatia não integra em `develop`.
- AD-04 (11 perfis); AD-10 (DS v3); AD-12 (400 Zod); AD-13 (código de negócio imutável; "Marca" banida);
  AD-15 (39 rotas operacionais); AD-18 (2) protótipo integral e (5) personas não viram perfis; AD-22; AD-24
  (grupo Fiscal e estabelecimento já entregues — não recriar).
- `docs/data/convencoes-schema.md`: uuidv7, TIMESTAMPTZ, VARCHAR(n), status TEXT+CHECK, soft delete, índice em
  toda FK. `updated_at` pelo serviço, sem trigger e sem SQL manual (padrão da migration 0044).
- UI nunca exibe UUID, PK, código E##/ALP nem nome de tabela (Caderno B L601; MATRIZ-UX L5). A palavra
  "Marca" não aparece como rótulo, entidade ou texto de busca (Princípio IX). O rótulo do cliente é "Cliente".

## Review Focus

Cinco entradas que a spec deixa fáceis de errar, e o teste que as prende:

1. Consulta só com CFOP devolve um perfil — o esperado é 400, sem perfil escolhido (Task 7, `e01-t02-consulta`).
2. Duas vigências sobrepostas que diferem só na prioridade — o segundo POST é 409; se as duas linhas existirem,
   a consulta é 422 `EMPATE_ENQUADRAMENTO` e não escolhe a prioridade menor (Tasks 6 e 7).
3. Consulta com um único enquadramento devolve CST, alíquota, IBS ou CBS — o esperado é 422
   `REGRA_APROVADA_AUSENTE` sem nenhuma dessas chaves (Task 7).
4. Estabelecimento que não está `APPROVED` entra no enquadramento — o esperado é 422
   `ESTABELECIMENTO_NAO_APROVADO` e zero linhas (Task 6).
5. A migration semeia CFOP/NCM da tabela nacional, ou grava data comercial/fiscal/efetiva além de início e fim —
   o esperado é catálogo vazio e só `vigencia_inicio`/`vigencia_fim` (Task 2).

---

## 2. Decisões fixadas (com fonte)

| # | Decisão | Fonte |
|---|---|---|
| D1 | A fatia persiste enquadramento e recusa resolver tributo. Não há endpoint de simulação, memória, CST, alíquota, cBenef, IBS/CBS ou cClassTrib | Pedido da fatia; Caderno B L72–L100 (T03–T05); aplicacao.js L243–L254 (fixture do épico, "não tabelas normativas") |
| D2 | "Operação" é a operação comercial já existente (`operacoes.id`). Esta tela não cria operação e não cria tabela de natureza | Pedido da fatia; MATRIZ-UX L59 `CADASTRO: operacoes`; componentes.js L190–L201 e catálogo L2356–L2366; `operacoes.schema.ts` |
| D3 | Estabelecimento só `APPROVED` e `deleted_at IS NULL`, da T01. `empresa_id` é copiado da linha travada, nunca do cliente | Pedido da fatia; MATRIZ-UX L7 e L58; `fiscal-empresas.schema.ts` `uq_estabelecimentos_id_empresa` |
| D4 | Produto e cliente são os cadastros atuais (`produtos`, `clientes`), só `status = 'ativo'` e não removidos. O NCM/CFOP/CEST de `produtos.atributos_json` não é catálogo e não preenche o enquadramento | Pedido da fatia; `produtos.schema.ts`; `produto.dto.ts` L31–L39; MATRIZ-UX L65 e L68 |
| D5 | "Contribuinte" do resumo do Caderno é o campo Cliente do contrato de tela. Não há enum `indIEDest` | Caderno B L63 ação "relacionar produto e cliente"; MATRIZ-UX L68; componentes.js L298–L308. Indicador de contribuinte ICMS não está no contrato de campos |
| D6 | tpNF `0` Entrada, `1` Saída. finNFe `1` Normal, `2` Complementar, `3` Ajuste, `4` Devolução. Abrangência `INTERNA`/`INTER`/`EXT`. Tipo de produto `PROPRIA`/`REVENDA`/`SUB` | componentes.js L1746–L1800 |
| D7 | CFOP e NCM são catálogos manuais vazios (código + descrição), no espírito do CNAE da T01: formato e duplicidade, sem Receita, sem IBGE e sem semear a tabela nacional. CEST é texto de 7 dígitos no enquadramento, sem tabela | Pedido da fatia; AD-24 (3) como analogia de formato, não como catálogo; componentes.js L226–L296 e L2666–L2698 (fixtures, não semente) |
| D8 | Critério temporal obrigatório: `vigencia_inicio` obrigatória, `vigencia_fim` opcional e `>= início`. A consulta exige `data`. Não existem colunas comercial/fiscal/efetiva (H-E01-10) | Caderno B L65; MATRIZ-UX L69–L70; componentes.js L154–L176 (`vigenciaFim.required: false`) |
| D9 | CFOP sozinho nunca escolhe perfil. A consulta e o POST exigem a chave inteira. Não existe rota "por CFOP" | Caderno B L65 |
| D10 | Chave de correspondência = estabelecimento + operação + tpNF + finNFe + CFOP + abrangência + tipo de produto + produto + NCM + CEST + cliente. Duas linhas `ATIVA` não removidas com a mesma chave e vigências sobrepostas → 409 `ENQUADRAMENTO_SOBREPOSTO`. Prioridade diferente não separa a chave | Caderno B L65–L66; H-E01-06 e H-E01-07 |
| D11 | Prioridade é inteiro `>= 1`, gravada e exibida com selo Provisório. Não ordena candidato, não desempata e não autoriza sobreposição | Caderno B L64 "controlar prioridade"; ausência de campo no contrato (componentes.js L2982–L3001) e de AD |
| D12 | Empate (2+ linhas `ATIVA` vigentes na chave e na data) → 422 `EMPATE_ENQUADRAMENTO` com a lista de códigos, sem vencedor. 0 ou 1 → 422 `REGRA_APROVADA_AUSENTE`, sem tributo. Um único perfil localizado volta em `enquadramentoLocalizado` só como identificação | Caderno B L66; pedido da fatia ("recusa resolver tributo") |
| D13 | Situação do enquadramento: `ATIVA` (criação e reativação) e `INATIVA` (reversão auditada). Não há submeter/aprovar/rejeitar nesta fatia | Caderno B L63 (tabela mostra situação); pedido da fatia (aprovação de regra é T03/T05); H-E01-11 |
| D14 | Duplicar copia a chave e grava `origem_enquadramento_id` e código novo. O corpo traz vigência nova (e prioridade opcional). Sobreposição com a origem ou com outro `ATIVA` → 409, sem mutação | Caderno B L64; MATRIZ-UX L54 |
| D15 | Identificador natural `codigo` numérico, gerado no backend, imutável, único entre não removidos, exibido na ficha. UUID não é rótulo | Caderno B L65 "identificador natural indexado"; AD-13 (código fora do formulário, imutável) |
| D16 | Zod → 400 (AD-12); regra de domínio → 422; estado, unicidade, versão e sobreposição → 409; sem permissão → 403 | AD-12; Caderno B L66 |
| D17 | Concorrência: `versao` otimista e `SELECT … FOR NO KEY UPDATE` do estabelecimento antes de gravar enquadramento daquele estabelecimento | MATRIZ-UX L10; padrão T01 D14 |
| D18 | Permissões `FISCAL_ENQUADRAMENTOS_LER` e `FISCAL_ENQUADRAMENTOS_GERENCIAR`, só no `administrador`. Sem `APROVAR` nesta fatia. Demais perfis = H-E01-12 | AD-04; AD-18 (5); H-E01-11 |
| D19 | Menu: o grupo `FISCAL` permanece na 8ª posição (T01/AD-24). Novo item "Operações fiscais e enquadramentos" (`catalogo.js` L196), href `/fiscal/enquadramentos`, `permissao: 'FISCAL_ENQUADRAMENTOS_LER'`, `iconKey: 'Scale'` (já em `ICON_MAP`). 39 rotas operacionais intactas; `MENUS_ERP` passa a 2; total 41 | catalogo.js L194–L207; AD-15; AD-24 (1) |
| D20 | API Nest sob `/fiscal`; BFF sob `/api/erp/fiscal`; combos de produto, cliente, operação e estabelecimento usam os BFF já existentes, sem proxy novo | Caderno B L70; `api/cadastros/produtos`, `api/cadastros/clientes`, `api/operacoes`, `api/erp/fiscal/estabelecimentos` |
| D21 | Room WS `fiscal-enquadramentos` exige `FISCAL_ENQUADRAMENTOS_LER`. A room `fiscal-empresas` não muda | E12 §3.13.6; Princípio VI |
| D22 | Histórico de versões = coluna `versao` + `auditoria` na mesma transação (módulo `fiscal.enquadramentos`). Não há segunda tabela de snapshot | Caderno B L65; Princípio IV; padrão T01 §11 |
| D23 | "Hoje" fiscal, quando a tela precisa de data default da consulta, é `(now() AT TIME ZONE 'America/Sao_Paulo')::date`. Vigências são `date` | Caderno B L65; T01 D10 (`fiscal-comum.ts` `HOJE_FISCAL`) |
| D24 | Justificativa trim 3–500 em toda mutação. Falha de validação não apaga o que já estava gravado | MATRIZ-UX L10 e L53; aplicacao.js L436 |

## 3. Conflitos de fonte resolvidos

| # | Conflito | Resolução |
|---|---|---|
| C1 | Caderno L63 "natureza operação" × tabela `operacoes` (dia, rótulo, status) × catálogo do protótipo "Compra e venda outubro" | D2. O resumo do Caderno e o campo "Operação" da matriz são a mesma relação. Não se cria natureza fiscal paralela |
| C2 | Caderno L63 "contribuinte" × matriz/componentes só têm Cliente | D5. Sem enum novo |
| C3 | Caderno L64 "controlar prioridade" × formulário sem campo (componentes.js L2987–L3001) | D11. Coluna + selo H-E01-06. Fora do grid de 6 colunas |
| C4 | Caderno L65 "separar datas comercial/fiscal/efetiva" × matriz só início e fim | D8 e H-E01-10. Só duas colunas. Selo Provisório. Não se inventa a terceira data |
| C5 | Caderno L66 "validação 422" × AD-12 (Zod é 400) | D16 |
| C6 | DoD genérico "dupla aprovação quando exigida" e jornada "simular consequência" × pedido da fatia (aprovação e simulação são T03–T05) | D1, D13, H-E01-11. A consulta recusa tributo; não há quórum |
| C7 | componentes.js L226–L284 CFOP/NCM como relation de catálogo cheio × pedido "não semear a tabela nacional; manual como o CNAE" | D7. Tabelas vazias, preenchidas pelo operador, formato + unicidade |
| C8 | componentes.js L286 CEST `required: true` texto × catálogo fixture `CEST-A` (L2284) "tabela oficial precisa de aprovação" | D7. Texto de 7 dígitos. Sem FK de CEST. Sem validar CEST contra NCM (H-E01-09) |
| C9 | Rota do catálogo `/erp/fiscal/e01-t02` (catalogo.js L201) × proibição de código na UI | D19 `/fiscal/enquadramentos`, no mesmo critério de AD-24 (1) para a T01 |
| C10 | Persona "fiscal" (catalogo.js L202) × 11 perfis | D18, H-E01-12 |
| C11 | Cascata global "NCM → CEST" (MATRIZ-UX L7) × CEST com `dependsOn: []` (componentes.js L291) | Trocar o NCM não apaga o CEST e o backend não exige pertencimento. O estabelecimento depende de empresa no dicionário global (L57–L59), mas o formulário da T02 não tem campo Empresa (L2987–L3001): o combo lista todos os estabelecimentos `APPROVED` |
| C12 | Painel "Matriz de enquadramentos" com CST e botões "Simular cálculo fiscal" (aplicacao.js L243–L254) × escopo da fatia | Remoção autorizada, igual à T01 §4: fixture do épico, não da tela. Botões de simulação não são implementados |

## 4. Referência do protótipo e fidelidade

`index.html` não contém markup da tela: L8 só carrega `catalogo.js`, `componentes.js` e `aplicacao.js`. O hash
`#E01-T02` é resolvido por `aplicacao.js` L4 (`location.hash`). Fonte visual: DS v3 (AD-10) + esse contrato.

| Elemento | Fonte (arquivo:linha) | Implementação real |
|---|---|---|
| Metadados | catalogo.js L194–L207 | título "Operações fiscais e enquadramentos"; subtítulo = ações do catálogo + "Acesso típico" com `BadgeProvisorio codigo="H-E01-12"` |
| Campos do formulário | componentes.js L2982–L3001 | Estabelecimento, Operação, Tipo da nota, Finalidade, CFOP, Abrangência, Origem do produto, Produto, NCM, CEST, Cliente, Início, Fim. Prioridade entra fora dessa lista, com selo (C3) |
| Enums | componentes.js L1746–L1800 | D6 |
| Grid | componentes.js L3004–L3036; MATRIZ-UX L49 | Operação · CFOP · Início de vigência · Estabelecimento · Tipo da nota · Finalidade. Ordenação default Operação. 20/página server-side. Sem coluna técnica |
| Filtros | componentes.js L3038–L3043 | Estabelecimento, CFOP, Produto, Cliente |
| Ações do processo | catalogo.js L204; aplicacao.js `actionNames` L40–L43 e `openWorkflow` L403–L405 | Cadastrar operação, Duplicar perfil, Relacionar produto e cliente, Controlar prioridade |
| Ficha, 7 abas, trilha | aplicacao.js `renderFicha` L179–L192, `renderMov` L194, `renderRules` L197, `renderExceptions` L200–L205, `renderHistory` L207–L210, `integrationInfo` L212–L218, `renderAccept` L220–L236 | §10. Código, situação, responsável, criação e alteração ficam na ficha (Caderno B L63), não no grid |
| Drawer | aplicacao.js `openDrawer` L427–L438, `renderControl` L407–L425, `saveForm` L441 | §10. Justificativa obrigatória mesmo sem o campo na seção (L436) |
| Lookup | aplicacao.js `openLookup` L485–L493 | combos existentes; vazio = "Nenhum cadastro disponível para seleção. Consulte a área responsável." |
| Cascata | aplicacao.js `syncDependentSelectors` L472–L482 | não há pai Empresa no formulário (C11). Trocar estabelecimento não limpa produto/cliente (eles não têm `dependsOn`) |
| Exceções | catalogo.js L206; aplicacao.js L200–L203 | "Empate de enquadramento" e "Operação sem regra aprovada" como erros reais da consulta |

Remoções autorizadas (Princípio I.2(a)/(b)), conferidas no Portão 2: selo "DADOS FICTÍCIOS"; pill "Fixture de
teste"; rodapé "registros fictícios"; eyebrow com código de épico e "Caderno B §E01-T02"; KPI "Ambiente em tela";
botões "Abrir ocorrência" e "Simular erro de validação" (L398–L400); painel de CST/alíquota do épico E01
(L243–L254) e os botões "Simular cálculo fiscal", "Comparar regras por vigência", "Submeter classificação" e
"Exportar memória de cálculo" (C12); "ilustrativo" e "Cadastro demonstrativo em memória" (L437); checkboxes da
aba Aceite (viram leitura). Botões de Integrações para telas inexistentes (L218) desabilitados com
`title="Destino ainda não disponível"`.

## 5. Modelo de dados (`app/backend/src/database/schema/fiscal-enquadramentos.schema.ts`)

Não alterar `fiscal-empresas.schema.ts`, `produtos.schema.ts`, `clientes.schema.ts` nem `operacoes.schema.ts`.
O Worker confirma no Context7 a sintaxe de `foreignKey`, `uniqueIndex().where()` e `date({ mode: 'string' })`.
Reusar `usuarios` de `./auth.schema` e as tabelas `estabelecimentos`, `operacoes`, `produtos`, `clientes`.

```ts
import { sql } from 'drizzle-orm';
import {
  check, date, foreignKey, index, integer, pgTable, text, timestamp, uniqueIndex, uuid, varchar,
} from 'drizzle-orm/pg-core';
import { usuarios } from './auth.schema';
import { clientes } from './clientes.schema';
import { estabelecimentos } from './fiscal-empresas.schema';
import { operacoes } from './operacoes.schema';
import { produtos } from './produtos.schema';

export const TP_NF = ['0', '1'] as const;
export const FIN_NFE = ['1', '2', '3', '4'] as const;
export const ABRANGENCIAS_FISCAIS = ['INTERNA', 'INTER', 'EXT'] as const;
export const TIPOS_PRODUTO_FISCAL = ['PROPRIA', 'REVENDA', 'SUB'] as const;
export const SITUACOES_ENQUADRAMENTO = ['ATIVA', 'INATIVA'] as const;

const auditCols = {
  versao: integer('versao').notNull().default(1),
  criadoPorId: uuid('criado_por_id').notNull().references(() => usuarios.id),
  atualizadoPorId: uuid('atualizado_por_id').notNull().references(() => usuarios.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};

export const cfops = pgTable('cfops', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  codigo: varchar('codigo', { length: 4 }).notNull(),
  descricao: varchar('descricao', { length: 255 }).notNull(),
  ...auditCols,
}, (t) => [
  check('cfops_codigo_formato_check', sql`${t.codigo} ~ '^[0-9]{4}$'`),
  check('cfops_descricao_preenchida_check', sql`btrim(${t.descricao}) <> ''`),
  check('cfops_versao_positiva_check', sql`${t.versao} >= 1`),
  uniqueIndex('uq_cfops_codigo').on(t.codigo).where(sql`${t.deletedAt} IS NULL`),
  index('idx_cfops_criado_por').on(t.criadoPorId),
  index('idx_cfops_atualizado_por').on(t.atualizadoPorId),
]);

export const ncms = pgTable('ncms', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  codigo: varchar('codigo', { length: 8 }).notNull(),
  descricao: varchar('descricao', { length: 255 }).notNull(),
  ...auditCols,
}, (t) => [
  check('ncms_codigo_formato_check', sql`${t.codigo} ~ '^[0-9]{8}$'`),
  check('ncms_descricao_preenchida_check', sql`btrim(${t.descricao}) <> ''`),
  check('ncms_versao_positiva_check', sql`${t.versao} >= 1`),
  uniqueIndex('uq_ncms_codigo').on(t.codigo).where(sql`${t.deletedAt} IS NULL`),
  index('idx_ncms_criado_por').on(t.criadoPorId),
  index('idx_ncms_atualizado_por').on(t.atualizadoPorId),
]);

export const enquadramentosFiscais = pgTable('enquadramentos_fiscais', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  codigo: varchar('codigo', { length: 20 }).notNull(),
  empresaId: uuid('empresa_id').notNull(),
  estabelecimentoId: uuid('estabelecimento_id').notNull(),
  operacaoId: uuid('operacao_id').notNull().references(() => operacoes.id),
  tpNf: varchar('tp_nf', { length: 1 }).notNull(),
  finNfe: varchar('fin_nfe', { length: 1 }).notNull(),
  cfopId: uuid('cfop_id').notNull().references(() => cfops.id),
  abrangencia: text('abrangencia').notNull(),
  tipoProduto: text('tipo_produto').notNull(),
  produtoId: uuid('produto_id').notNull().references(() => produtos.id),
  ncmId: uuid('ncm_id').notNull().references(() => ncms.id),
  cest: varchar('cest', { length: 7 }).notNull(),
  clienteId: uuid('cliente_id').notNull().references(() => clientes.id),
  vigenciaInicio: date('vigencia_inicio', { mode: 'string' }).notNull(),
  vigenciaFim: date('vigencia_fim', { mode: 'string' }),
  prioridade: integer('prioridade').notNull(),
  situacao: text('situacao').notNull().default('ATIVA'),
  origemEnquadramentoId: uuid('origem_enquadramento_id'),
  justificativaSituacao: text('justificativa_situacao'),
  ...auditCols,
}, (t) => [
  foreignKey({
    columns: [t.estabelecimentoId, t.empresaId],
    foreignColumns: [estabelecimentos.id, estabelecimentos.empresaId],
    name: 'enquadramentos_fiscais_estabelecimento_empresa_fk',
  }),
  foreignKey({
    columns: [t.origemEnquadramentoId],
    foreignColumns: [t.id],
    name: 'enquadramentos_fiscais_origem_fk',
  }),
  check('enquadramentos_codigo_formato_check', sql`${t.codigo} ~ '^[1-9][0-9]{0,17}$'`),
  check('enquadramentos_tp_nf_check', sql`${t.tpNf} IN ('0','1')`),
  check('enquadramentos_fin_nfe_check', sql`${t.finNfe} IN ('1','2','3','4')`),
  check('enquadramentos_abrangencia_check', sql`${t.abrangencia} IN ('INTERNA','INTER','EXT')`),
  check('enquadramentos_tipo_produto_check', sql`${t.tipoProduto} IN ('PROPRIA','REVENDA','SUB')`),
  check('enquadramentos_cest_formato_check', sql`${t.cest} ~ '^[0-9]{7}$'`),
  check('enquadramentos_vigencia_ordem_check', sql`${t.vigenciaFim} IS NULL OR ${t.vigenciaFim} >= ${t.vigenciaInicio}`),
  check('enquadramentos_prioridade_check', sql`${t.prioridade} >= 1`),
  check('enquadramentos_situacao_check', sql`${t.situacao} IN ('ATIVA','INATIVA')`),
  check('enquadramentos_versao_positiva_check', sql`${t.versao} >= 1`),
  check('enquadramentos_inativa_justificativa_check', sql`${t.situacao} <> 'INATIVA' OR ${t.justificativaSituacao} IS NOT NULL`),
  uniqueIndex('uq_enquadramentos_codigo').on(t.codigo).where(sql`${t.deletedAt} IS NULL`),
  index('idx_enquadramentos_estabelecimento').on(t.estabelecimentoId),
  index('idx_enquadramentos_operacao').on(t.operacaoId),
  index('idx_enquadramentos_cfop').on(t.cfopId),
  index('idx_enquadramentos_produto').on(t.produtoId),
  index('idx_enquadramentos_ncm').on(t.ncmId),
  index('idx_enquadramentos_cliente').on(t.clienteId),
  index('idx_enquadramentos_origem').on(t.origemEnquadramentoId),
  index('idx_enquadramentos_vigencia').on(t.estabelecimentoId, t.vigenciaInicio),
  index('idx_enquadramentos_criado_por').on(t.criadoPorId),
  index('idx_enquadramentos_atualizado_por').on(t.atualizadoPorId),
]);
```

Exportar o schema em `app/backend/src/database/schema/index.ts`. Não criar `CREATE EXTENSION`, trigger, nem
constraint de exclusão (`gist`): sobreposição é regra do serviço sob a trava do estabelecimento (D10, D17).
Nenhuma dessas tabelas recebe `INSERT` de semente na migration nem em `seed.ts`.

## 6. Máquinas de estado e regras de serviço

Toda mutação de enquadramento abre `db.transaction` e, como primeira trava, executa
`SELECT id, empresa_id, situacao, versao FROM estabelecimentos WHERE id = $1 AND deleted_at IS NULL FOR NO KEY UPDATE`.
`empresa_id` gravado é o dessa linha. Estabelecimento ausente → 404. Situação diferente de `APPROVED` → 422
`ESTABELECIMENTO_NAO_APROVADO` e nenhuma escrita.

Funções puras em `enquadramento-criterio.ts`:

```ts
export type Intervalo = { inicio: string; fim: string | null };

export function intervalosSobrepoem(a: Intervalo, b: Intervalo): boolean {
  const fimA = a.fim ?? '9999-12-31';
  const fimB = b.fim ?? '9999-12-31';
  return a.inicio <= fimB && b.inicio <= fimA;
}

export type Candidato = { codigo: string; prioridade: number };

export type Classificacao =
  | { tipo: 'ausente' }
  | { tipo: 'unico'; codigo: string }
  | { tipo: 'empate'; codigos: string[] };

/** H-E01-07: não lê prioridade e não elege vencedor. */
export function classificarEnquadramentos(candidatos: readonly Candidato[]): Classificacao {
  if (candidatos.length === 0) return { tipo: 'ausente' };
  if (candidatos.length === 1) return { tipo: 'unico', codigo: candidatos[0]!.codigo };
  return { tipo: 'empate', codigos: candidatos.map((c) => c.codigo) };
}
```

Chave (D10), comparada no serviço entre o candidato e as linhas `ATIVA` não removidas do mesmo estabelecimento,
exceto a própria no PATCH:

```ts
function mesmaChave(a: Chave, b: Chave): boolean {
  return a.operacaoId === b.operacaoId
    && a.tpNf === b.tpNf
    && a.finNfe === b.finNfe
    && a.cfopId === b.cfopId
    && a.abrangencia === b.abrangencia
    && a.tipoProduto === b.tipoProduto
    && a.produtoId === b.produtoId
    && a.ncmId === b.ncmId
    && a.cest === b.cest
    && a.clienteId === b.clienteId;
}
```

Se `mesmaChave` e `intervalosSobrepoem` → 409 `ENQUADRAMENTO_SOBREPOSTO` com
`{ conflito: { codigo, vigenciaInicio, vigenciaFim, prioridade } }`. A prioridade do conflito é informativa; não
desempata.

Código novo, dentro da transação, com `pg_advisory_xact_lock(hashtext('enquadramentos_fiscais.codigo'))` e
`SELECT COALESCE(MAX(codigo::bigint), 0) + 1`. `23505` de `uq_enquadramentos_codigo` → uma nova tentativa; na
segunda, 409 `CONFLITO_CONCORRENTE`. O cliente não envia `codigo`.

Pré-condições de FK, todas antes de escrever (422, código entre parênteses): operação com `deleted_at` nulo
(`OPERACAO_INDISPONIVEL`) — status `aberta`/`em_andamento`/`fechada` é aceito, não há AD para excluir fechada;
produto `ativo` e não removido (`PRODUTO_INATIVO`); cliente `ativo` e não removido (`CLIENTE_INATIVO`); CFOP e
NCM não removidos (`CFOP_INDISPONIVEL`, `NCM_INDISPONIVEL`).

| Ação | Efeito | Permissão | Regras |
|---|---|---|---|
| criar CFOP ou NCM | linha nova | GERENCIAR | formato (400 se o Zod falhar); descrição trim 1–255; código duplicado entre não removidos → 409 `CFOP_DUPLICADO` ou `NCM_DUPLICADO` (`23505`) |
| criar enquadramento | — → `ATIVA` | GERENCIAR | chave + vigência + D3–D10; 201 com `codigo` |
| editar | `ATIVA`→`ATIVA` | GERENCIAR | `versao` (409 `CONFLITO_CONCORRENTE`); DTO `.strict()` rejeita `codigo`, `empresaId`, `estabelecimentoId`; revalida a chave excluindo a própria linha; `INATIVA` → 409 `TRANSICAO_INVALIDA` |
| duplicar | nova linha `ATIVA` | GERENCIAR | copia a chave da origem; corpo `{ vigenciaInicio, vigenciaFim?, prioridade?, versao, justificativa }`; `origem_enquadramento_id` = origem; origem inalterada; sobreposição → 409 sem insert |
| inativar | `ATIVA`→`INATIVA` | GERENCIAR | grava `justificativa_situacao`; deixa de entrar na consulta |
| reativar | `INATIVA`→`ATIVA` | GERENCIAR | revalida sobreposição; senão 409 e a linha continua `INATIVA` |
| remover | soft delete | GERENCIAR | `deleted_at` na mesma transação; auditoria `DELETE`; não entra na consulta nem na unicidade |
| consultar | nenhuma escrita | LER | §7. Não emite evento |

`AuditoriaService.registrar(tx, …)` na mesma transação: `modulo: 'fiscal.enquadramentos'`, tabela física,
`dadosAnteriores`/`dadosNovos` completos, `justificativa`. `EventEmitter2.emit` só depois do commit (padrão
`precos.service.ts`). 409/422 não emitem.

## 7. Endpoints (`@Controller('fiscal')`, `JwtAuthGuard` + `RbacGuard`)

| Verbo e caminho | Permissão | DTO (Zod, `.strict()`) | Resposta |
|---|---|---|---|
| GET `/fiscal/cfops` | LER | {search?, page, pageSize ≤ 100} | paginado `{ codigo, descricao }` sem id no item exibido; `id` só para o combo submeter |
| POST `/fiscal/cfops` | GERENCIAR | {codigo 4 dígitos, descricao, justificativa} | 201 |
| GET `/fiscal/ncms` | LER | igual | igual |
| POST `/fiscal/ncms` | GERENCIAR | {codigo normalizado 8 dígitos, descricao, justificativa} | 201 |
| GET `/fiscal/enquadramentos` | LER | {estabelecimentoId?, cfopId?, produtoId?, clienteId?, search?, sort ∈ operacao·cfop·vigenciaInicio·estabelecimento·tpNF·finNFe, dir, page, pageSize=20} | paginado com rótulos (operação = `rotulo` + data, CFOP = código, estabelecimento = nome, tpNF/finNFe = rótulos D6). Sem UUID no objeto de célula |
| GET `/fiscal/enquadramentos/contagens` | LER | mesmo filtro | {total, ativas, inativas} |
| GET `/fiscal/enquadramentos/exportacao` | LER | mesmo filtro | `text/csv; charset=utf-8`, `;`, BOM, rótulos, sem ids |
| GET `/fiscal/enquadramentos/:id` | LER | uuid | detalhe com rótulos, `codigo`, situação, responsável (nome), `criadoEm`, `atualizadoEm`, `origemCodigo` (código da origem, ou null), prioridade. O `id` não é campo de tela |
| GET `/fiscal/enquadramentos/:id/historico` | LER | uuid | {operacao, situacaoAnterior, situacaoNova, usuarioNome, criadoEm, justificativa, resumo, versao}. Sem nome de tabela e sem id |
| GET `/fiscal/enquadramentos/:id/pre-condicoes` | LER | uuid | itens `{codigo, atendida, provisoria}` abaixo |
| POST `/fiscal/enquadramentos` | GERENCIAR | {estabelecimentoId, operacaoId, tpNf, finNfe, cfopId, abrangencia, tipoProduto, produtoId, ncmId, cest, clienteId, vigenciaInicio, vigenciaFim?, prioridade ≥ 1, justificativa} | 201 |
| PATCH `/fiscal/enquadramentos/:id` | GERENCIAR | os mesmos campos editáveis + versao + justificativa, sem codigo/empresaId/estabelecimentoId | 200 |
| POST `/fiscal/enquadramentos/:id/duplicar` | GERENCIAR | {vigenciaInicio, vigenciaFim?, prioridade?, versao, justificativa} | 201 da cópia |
| POST `/fiscal/enquadramentos/:id/inativar` | GERENCIAR | {versao, justificativa} | 200 |
| POST `/fiscal/enquadramentos/:id/reativar` | GERENCIAR | {versao, justificativa} | 200 |
| DELETE `/fiscal/enquadramentos/:id` | GERENCIAR | {justificativa} | 200 |
| POST `/fiscal/enquadramentos/consulta` | LER | {estabelecimentoId, data, operacaoId, tpNf, finNfe, cfopId, abrangencia, tipoProduto, produtoId, ncmId, cest, clienteId}.strict() | 422 sempre; ver abaixo |

Consulta (`EnquadramentosService.consultar`, sem escrita e sem evento):

- Corpo incompleto (falta qualquer campo da chave ou `data`) → 400. Um corpo `{ cfopId }` ou `{ cfopCodigo }` não escolhe perfil.
- Candidatos = linhas `ATIVA`, não removidas, do estabelecimento, com a chave inteira igual e `vigencia_inicio <= data <= COALESCE(vigencia_fim, data)`.
- `classificarEnquadramentos` = `empate` → 422 `EMPATE_ENQUADRAMENTO`, mensagem "Há mais de um enquadramento vigente para este critério. Nenhum foi escolhido.", corpo `{ codigo, message, candidatos: [{ codigo, prioridade }] }`. `candidatos` ordenados por `codigo` ascendente só para o payload ser estável. Não existe chave `vencedor`, `escolhido` ou `tributo`.
- `ausente` ou `unico` → 422 `REGRA_APROVADA_AUSENTE`. Mensagem do único: "O enquadramento foi localizado, mas o tributo não é resolvido nesta tela." Mensagem da ausência: "Nenhum enquadramento vigente cobre o critério e não há regra tributária aprovada." Corpo `{ codigo, message, enquadramentoLocalizado: null | { codigo, vigenciaInicio, vigenciaFim } }`. Proibido devolver `cst`, `aliquota`, `icms`, `ipi`, `pis`, `cofins`, `ibs`, `cbs`, `cBenef`, `cClassTrib`, `reducaoBc`, `valor`.

Pré-condições do detalhe (leitura, não bloqueiam o POST):

| codigo | atendida | provisoria |
|---|---|---|
| ESTABELECIMENTO_APROVADO | situação atual `APPROVED` | false |
| VIGENCIA_INFORMADA | início gravado | false |
| CHAVE_COMPLETA | os 11 elementos da chave preenchidos | false |
| PRIORIDADE_SEMANTICA | false | true (H-E01-06) |
| DESEMPATE_DEFINIDO | false | true (H-E01-07) |
| TABELA_OFICIAL_CFOP_NCM | false | true (H-E01-08) |
| CEST_VINCULADO_AO_NCM | false | true (H-E01-09) |
| DATAS_COMERCIAL_FISCAL_EFETIVA | false | true (H-E01-10) |
| DUPLA_APROVACAO | false | true (H-E01-11) |

Erro HTTP `{ message, codigo, ...dados }` como objeto nas exceptions Nest (padrão `fiscal-comum.ts`
`regraViolada` / `conflito`). Reusar essas funções; não criar uma terceira família de erro. 5xx sem SQL e sem
stack. `:id` de enquadramento removido → 404.

## 8. Eventos pós-commit e tempo real

- `realtime/events/eventos.ts`: `ENQUADRAMENTO_FISCAL_ALTERADO: 'enquadramento_fiscal_alterado'`.
  Payload `{ enquadramentoId: string; estabelecimentoId: string; empresaId: string; acao: 'criado'|'atualizado'|'duplicado'|'inativado'|'reativado'|'removido'|'cfop_criado'|'ncm_criado'; situacao?: string }`, registrado em `PayloadPorEvento`. Sem campo de tributo.
- Emitir só depois de `db.transaction` resolver. Duplicar emite um evento `duplicado` da linha nova; a origem não emite.
- `room-permissoes.ts`: acrescentar `'fiscal-enquadramentos': PERMISSOES.FISCAL_ENQUADRAMENTOS_LER`. Não alterar a entrada `fiscal-empresas`.
- `realtime.gateway.ts`: novo `@OnEvent(EVENTOS.ENQUADRAMENTO_FISCAL_ALTERADO)` chama `broadcastRoom('fiscal-enquadramentos', evento, payload)`. Não passar pelo `publicarFiscal`, que está fixo em `fiscal-empresas` (gateway L187–L189).

## 9. RBAC, seed, parâmetro provisório e menu

`common/rbac/permissoes.ts`: duas chaves após as `FISCAL_EMPRESAS_*`. Descrições: "Consultar operações fiscais,
enquadramentos, CFOP e NCM manuais"; "Cadastrar, editar, duplicar, inativar, reativar e remover enquadramentos
e códigos manuais de CFOP e NCM". `pushPermissoes('administrador', 'FISCAL_ENQUADRAMENTOS_LER', 'FISCAL_ENQUADRAMENTOS_GERENCIAR')` com comentário AD-04/AD-18 (5)/H-E01-12. Fora de `LEITURA_CADASTROS`. Não criar
`FISCAL_ENQUADRAMENTOS_APROVAR`.

O módulo `Fiscal` já existe em `perfis.service.ts` (`prefixos: ['FISCAL_']`). Não acrescentar outro módulo. O
teste de catálogo da T01 (`perfis-menus.e2e-spec.ts` L83–L92) passa a esperar as cinco permissões, em ordem de
código: `FISCAL_EMPRESAS_APROVAR`, `FISCAL_EMPRESAS_GERENCIAR`, `FISCAL_EMPRESAS_LER`,
`FISCAL_ENQUADRAMENTOS_GERENCIAR`, `FISCAL_ENQUADRAMENTOS_LER`, cada uma com a descrição do mapa. O teste
"catalogo de permissoes cobre todo o mapa de descricoes" continua sem afrouxar.

Parâmetro em `seed.ts` `PARAMETROS_SEED`: `{ chave: 'fiscal.enquadramentos_perfis_autorizados', descricao:
'Perfis com acesso a operações fiscais e enquadramentos', valorJson: { grupo: 'Fiscal', tipo: 'info', titulo:
'Perfis de operações fiscais e enquadramentos', texto: 'Somente administrador até decisão sobre os demais perfis.',
valor: ['administrador'], provisorio: true, pendencia: 'H-E01-12' } }`. A tela lê o BFF já existente
`/api/admin/parametros/chave/[chave]` e mostra `BadgeProvisorio` enquanto `provisorio === true`.

Menu — 39 rotas operacionais intactas; `MENUS_ERP` = `['/fiscal/empresas', '/fiscal/enquadramentos']`;
`MENUS_CANONICOS` soma 41. `perfil.dto.ts` já usa `.max(MENUS_CANONICOS.length)` — não hardcodar. Snapshots
regenerados por `npx tsx scripts/gerar-snapshot-perfis.ts`; só a chave `administrador` ganha a rota e as duas
permissões.

Frontend `lib/menu-v2.ts`: segundo item do grupo `FISCAL`, sem criar grupo e sem mudar a posição 08.
`filtrarMenuPorMenusVisiveis` já esconde item com `permissao` ausente no usuário. `(admin)/layout.tsx` já passa
`user.permissoes`. `shell-ds.spec.ts` permanece com 10 grupos e `FISCAL` na 8ª posição; não editar esse arquivo
se a asserção for só de grupos.

Contagens a atualizar, sem afrouxar:

- `menu-v2.test.ts`: `ITENS_ERP` ganha `['FISCAL', 'Operações fiscais e enquadramentos', '/fiscal/enquadramentos']`; total `toHaveLength(41)`; os 39 itens sem o grupo FISCAL continuam `toEqual(ITENS_PROTOTIPO)`. Caso novo: `menusVisiveis` com as duas rotas fiscais e permissões só `FISCAL_EMPRESAS_LER` → o item de enquadramentos não aparece; o de empresas aparece.
- `menu-rbac.test.ts`: `MATRIZ_ERP` ganha `'/fiscal/enquadramentos': ['administrador']`. Rotas sem `/fiscal/` continuam 39. Total de rotas 41. Atribuições `126 + 2 = 128`. `MATRIZ_ERP` soma 2.
- `perfis-menus.e2e-spec.ts`: `MENUS_OPERACIONAIS` 39; `MENUS_CANONICOS` e `res.body.menus` 41; catálogo Fiscal com as cinco permissões.

## 10. Página e componentes DS v3

Página `app/frontend/src/app/(admin)/fiscal/enquadramentos/page.tsx` (padrão
`(admin)/fiscal/empresas/page.tsx`): `getMe()`; sem usuário → `redirect('/login')`; sem
`FISCAL_ENQUADRAMENTOS_LER` → "Você não tem permissão para visualizar operações fiscais e enquadramentos." sem
renderizar o cliente; senão `<EnquadramentosClient podeGerenciar />`. Não há `podeAprovar`.

Componentes em `components/fiscal/enquadramentos/`: `enquadramentos-client.tsx`, `enquadramento-drawer.tsx`,
`duplicar-dialog.tsx`, `codigo-fiscal-dialog.tsx` (CFOP e NCM), `abas-detalhe.tsx`. DS existente: `PageHeader`,
`KpiStrip`/`Kpi`, `Table`, `Tabs`, `ComboboxField`, `DatePickerField`, `Sheet`, `AlertDialog`, `StatusPill`,
`EmptyState`, `Skeleton`, `BadgeProvisorio`, `sonner`. Sem hex avulso.

- Hero: título do catálogo; subtítulo; "Exportar"; "+ Novo registro" (só `podeGerenciar`); "Ações do processo ▾"
  com os quatro comandos do catálogo (L204), cada um abrindo o fluxo real (cadastrar → drawer; duplicar →
  diálogo da linha selecionada; relacionar produto e cliente → foco nos dois combos do drawer; controlar
  prioridade → campo Prioridade do drawer).
- KPIs: "Enquadramentos", "Ativos", "Inativos".
- "Registros e consultas": busca; filtros Estabelecimento, CFOP, Produto e Cliente (combos dos BFF existentes e
  dos GET novos de CFOP); "Exportar visão"; grid §4; clique/Enter seleciona; paginação server-side; filtros e
  ordenação em `sessionStorage` na chave `fiscal.enquadramentos.lista`; vazio com o texto de `renderTable` L172
  ("Nenhum resultado para o período, filtro ou situação escolhidos. Limpe os filtros ou cadastre um novo registro.").
- "Detalhamento e execução" — 7 abas:
  1. Ficha e campos: os 13 campos do formulário mais Código, Situação ("Ativa"/"Inativa"), Responsável,
     Criado em, Alterado em, "Duplicado do código …" quando houver origem, Prioridade com
     `BadgeProvisorio codigo="H-E01-06"`. Selos também em CFOP, NCM (`H-E01-08`), CEST (`H-E01-09`) e vigência
     (`H-E01-10`). "Trilha e responsabilização". Botões "Editar versão", "Validar pré-condições", "Consultar
     histórico". Validar pré-condições mostra atendida/pendente/provisória; provisória não bloqueia. O botão
     não chama simulação.
  2. Movimentações: trilha Preparação → Verificação → Autorização → Conclusão em leitura (o protótipo não
     transmite). Ações reais da linha: Duplicar, Inativar ou Reativar, Remover, conforme situação e
     `podeGerenciar`.
  3. Regras e validações: texto do catálogo L205 ("perfil nunca usa CFOP global como único determinante;
     critério temporal obrigatório") + "A prioridade é registrada e não escolhe enquadramento" + "Esta tela não
     calcula tributo".
  4. Exceções: dois blocos reais — "Empate de enquadramento" e "Operação sem regra aprovada" — com a mensagem
     do último 422 da consulta, se houver. Sem botão de ocorrência fictícia.
  5. Histórico: linha do tempo (ação, quando, quem, justificativa, resumo, versão).
  6. Integrações: blocos de `integrationInfo` para E01 (L214); botões desabilitados (§4).
  7. Aceite e testes: os oito critérios de L223–L231 em leitura, mais a frase de L236 de que checkbox não é
     aceite.
- Drawer (L427–L438): combos Estabelecimento (somente aprovados; rótulo = nome), Operação (rótulo + data
  `dd/MM/yyyy`, nunca UUID), Tipo da nota, Finalidade, CFOP (código + descrição; "Novo código" abre
  `codigo-fiscal-dialog` e só então seleciona), Abrangência, Origem do produto, Produto (nome), NCM (igual ao
  CFOP), CEST (máscara 7 dígitos), Cliente (nome fantasia ou razão social — o rótulo do campo é "Cliente"),
  Início, Fim, Prioridade (inteiro ≥ 1, selo H-E01-06), "Motivo da alteração *". "Cancelar", "Verificar dados"
  (só valida o formulário local, sem POST), "Salvar". Erros por campo via `useErrosCampo` /
  `extrairErrosPorCampo` (AD-12). 409 `ENQUADRAMENTO_SOBREPOSTO` mostra o código e a vigência do conflito.
  Sair com pendência pede confirmação.
- Diálogo duplicar: Início, Fim, Prioridade (preenchida com a da origem), Motivo. 409 mostra o conflito e não
  fecha como sucesso.
- Diálogo de código: Código, Descrição, Motivo, aviso "Cadastro manual. A tabela oficial completa não está
  carregada; confira o código na documentação fiscal." Sem lista pronta de CFOP ou NCM.
- Consulta da aba Exceções / ação "Validar": POST `consulta` com a chave da ficha e a data início da vigência.
  422 `EMPATE_ENQUADRAMENTO` e `REGRA_APROVADA_AUSENTE` aparecem como alerta, não como toast de sucesso. O
  alerta não mostra UUID.
- Estados: inicial, carregando (skeleton), sem registros, validação inválida, sem acesso (página), conflito
  concorrente (409 `CONFLITO_CONCORRENTE` → "O registro foi alterado por outro usuário. Recarregue para
  continuar."), serviço indisponível ("Tentar novamente"), revisão pendente não se aplica (não há fila de
  aprovação; o selo H-E01-11 ocupa esse lugar na ficha), concluído (toast "Enquadramento salvo.").
- Tempo real: `conectarRealtime({ rooms: ['fiscal-enquadramentos'], onMessage, onReconnect })` refaz lista e
  detalhe. Sem polling.
- `lib/fiscal-enquadramentos.ts`: `ROTULOS_TP_NF`, `ROTULOS_FIN_NFE`, `ROTULOS_ABRANGENCIA`,
  `ROTULOS_TIPO_PRODUTO`, `ROTULOS_SITUACAO_ENQUADRAMENTO`, `normalizarNcm` (remove `.` e espaços),
  `normalizarCest` (só dígitos), cliente HTTP do BFF. Não exportar função que calcule tributo.

Combos de apoio (não criar BFF novo): `GET /api/erp/fiscal/estabelecimentos?situacao=APPROVED`,
`GET /api/cadastros/produtos`, `GET /api/cadastros/clientes`, `GET /api/operacoes`. Opção inativa ou removida
não entra na lista. O valor submetido é o id; o texto visível é o nome de negócio.

## 11. Auditoria (Princípio IV)

Cada mutação chama `AuditoriaService.registrar` na mesma transação, com `usuarioId` e `justificativa`.
Histórico do enquadramento lê `auditoria` por `(tabela, registro_id)` da linha e da origem quando o evento for
da cópia, com join em `usuarios`. A resposta usa `resumo` em português ("CFOP alterado", "Perfil duplicado do
código 12", "Inativado"), nunca o nome da tabela nem UUID.

## 12. Estrutura de arquivos (ownership exclusivo)

Backend (`app/backend/`): `src/database/schema/fiscal-enquadramentos.schema.ts` (novo) e `index.ts` (só o
export); `src/database/migrations/<gerada>.sql` + `meta/*`; `src/database/migrations/ROLLBACK.md` (seção
E01-T02); `src/database/seed.ts` (só o parâmetro); `src/common/validators/{cfop,ncm,cest}.ts` (novos);
`src/common/rbac/{permissoes.ts,menus-canonicos.ts,perfil-permissoes.snapshot.json,perfil-menus.snapshot.json}`;
`src/modules/erp/fiscal/enquadramentos/**` (`enquadramentos-fiscais.module.ts`, `cfops.controller.ts`,
`ncms.controller.ts`, `enquadramentos.controller.ts`, `cfops.service.ts`, `ncms.service.ts`,
`enquadramentos.service.ts`, `enquadramento-criterio.ts`, `exportacao-csv.ts`, `dto/*.ts`);
`src/app.module.ts` (import do módulo); `src/realtime/{room-permissoes.ts,realtime.gateway.ts,events/eventos.ts}`;
`test/helpers/test-app.ts` (TRUNCATE de `enquadramentos_fiscais`, `ncms`, `cfops` no mesmo comando, antes de
`estabelecimentos`/`operacoes`/`produtos`/`clientes`); `test/unit/{cfop,ncm,cest,enquadramento-criterio,fiscal-enquadramentos-dto}.spec.ts`;
`test/unit/room-permissoes.spec.ts` (caso novo, sem apagar o da T01);
`test/integration/e01-t02-{migrations,catalogos,enquadramentos,consulta,concorrencia,eventos}.e2e-spec.ts`;
`test/integration/perfis-menus.e2e-spec.ts` (contagens e catálogo Fiscal).

Frontend (`app/frontend/`): `src/app/(admin)/fiscal/enquadramentos/page.tsx`;
`src/lib/{fiscal-enquadramentos.ts,menu-v2.ts}`; `src/components/fiscal/enquadramentos/*.tsx`;
`src/app/api/erp/fiscal/{cfops,ncms}/route.ts`; `src/app/api/erp/fiscal/enquadramentos/route.ts`;
`enquadramentos/contagens/route.ts`; `enquadramentos/exportacao/route.ts`; `enquadramentos/consulta/route.ts`;
`enquadramentos/[id]/route.ts`; `enquadramentos/[id]/[acao]/route.ts` (allowlist
`duplicar`·`inativar`·`reativar`·`historico`·`pre-condicoes`);
`__tests__/{fiscal-enquadramentos-lib,bff-e01-t02,enquadramentos-client,menu-v2,menu-rbac}.test.ts(x)`;
`e2e/e01-t02-enquadramentos.spec.ts`; `e2e/capture-e01-t02-evidencias.spec.ts`; `e2e/helpers/e01-t02-seed.ts`.
Não editar `e2e/shell-ds.spec.ts` (grupos continuam 10). Evidências: `docs/evidencias/e01-t02/*.png`.

Proibido: `docs/execucao/**`, `GATE-VEREDITOS.md`, módulos de empresas da T01 (salvo o export de schema já
citado e o TRUNCATE), `produtos.schema.ts`, `clientes.schema.ts`, `operacoes.schema.ts`, editor de regras,
simulador, seed de CFOP/NCM.

## 13. Mapa DoD → teste

| Critério (fonte) | Teste (arquivo · nome) |
|---|---|
| DoD (1) CRUD e ações (Caderno B L67) | e01-t02-enquadramentos · "criar, editar, listar, inativar, reativar, remover"; "duplicar grava origem e código novo" |
| DoD (2) campos e validações | fiscal-enquadramentos-dto · "tpNF 2", "finNFe 5", "abrangência livre", "tipo SUB aceito", "CEST com 6 dígitos", "fim < início", "prioridade 0", "strict rejeita codigo e empresaId"; cfop · "5101 válido", "ABC inválido"; ncm · "`0201.30.00` → `02013000`", "7 dígitos inválido" |
| DoD (3) recarregar | e01-t02-enquadramentos · "GET detalhe após cada mutação devolve código, situação, vigência, CFOP e cliente" |
| DoD (4) autorização | e01-t02-enquadramentos · "gestor sem FISCAL_ENQUADRAMENTOS_* → 403 em toda rota"; "não existe rota aprovar"; perfil-permissoes-snapshot |
| DoD (4) dupla aprovação | H-E01-11; pre-condicoes · "DUPLA_APROVACAO provisoria=true e atendida=false" |
| DoD (5) falha externa | não se aplica: sem SEFAZ e sem serviço externo. e01-t02-consulta · "consulta não abre socket HTTP" (fetch do serviço espionado com 0 chamadas) |
| DoD (6) auditoria e reversão | e01-t02-enquadramentos · "cada mutação grava 1 auditoria"; "inativar é a reversão e a consulta deixa de localizar"; "histórico sem nome de tabela nem uuid" |
| DoD (7) Playwright e acessibilidade | e01-t02-enquadramentos.spec · jornada, 403, teclado e nomes acessíveis (Task 13) |
| DoD (8) 39 rotas e domínios adjacentes | menu-rbac · "sem /fiscal/ = 39"; "total 41"; "atribuições 128"; e01-t02-enquadramentos · "POST não altera produtos.atributos_json, operacoes nem estabelecimentos" |
| CFOP sozinho (L65) | e01-t02-consulta · "corpo { cfopId } → 400 e nenhuma linha lida como escolhida"; "dois perfis com o mesmo CFOP e produtos diferentes: a consulta da chave de A localiza só o código de A" |
| Critério temporal (L65) | e01-t02-enquadramentos · "sem vigenciaInicio → 400"; e01-t02-consulta · "data anterior ao início → REGRA_APROVADA_AUSENTE com enquadramentoLocalizado null" |
| Empate (L66) | enquadramento-criterio · "2 candidatos não elege o de menor prioridade"; e01-t02-consulta · "duas linhas sobrepostas inseridas → 422 EMPATE_ENQUADRAMENTO sem vencedor" |
| Sem regra aprovada (L66) | e01-t02-consulta · "0 linhas → 422 REGRA_APROVADA_AUSENTE"; "1 linha → 422 REGRA_APROVADA_AUSENTE com enquadramentoLocalizado.codigo e sem cst/aliquota/ibs/cbs" |
| Sobreposição na escrita (D10) | e01-t02-enquadramentos · "mesma chave e vigência sobreposta, prioridade diferente → 409 ENQUADRAMENTO_SOBREPOSTO e uma linha só" |
| Estabelecimento não aprovado | e01-t02-enquadramentos · "DRAFT e SUSPENDED → 422 ESTABELECIMENTO_NAO_APROVADO e zero linhas" |
| Catálogo manual (D7) | e01-t02-migrations · "cfops e ncms existem e COUNT(*) = 0 depois do migrate"; e01-t02-catalogos · "CFOP duplicado → 409"; "não há chamada HTTP externa" |
| Três datas (H-E01-10) | e01-t02-migrations · "information_schema.columns de enquadramentos_fiscais não contém comercial, fiscal_em nem efetiva" |
| Menu e catálogo | menu-v2 · "41 itens" e "item sem permissão some"; perfis-menus.e2e · "41" e "cinco permissões no módulo Fiscal" |
| Concorrência | e01-t02-concorrencia · "2 POST mesma chave → [201,409]"; "2 PATCH mesma versao → [200,409]" |
| Eventos | e01-t02-eventos · "1 evento depois do commit"; "422 da consulta não emite"; "duplicar emite um evento da cópia" |
| Room | room-permissoes · "fiscal-enquadramentos exige FISCAL_ENQUADRAMENTOS_LER"; "fiscal-empresas inalterada" |
| UX | enquadramentos-client · "vazio, 409, 422 de empate, 422 sem regra, nenhum UUID, nenhuma ocorrência de Marca, selos H-E01-06/08/09/10/11/12" |
| BFF | bff-e01-t02 · "repassa 409 e 422"; "CSV mantém text/csv"; "ação fora da allowlist → 404 sem backend" |
| Cobertura ≥ 80% | `npm run test:cov` + `node scripts/check-coverage.mjs --min 80` |

## 14. Tasks

Comandos a partir de `F:\Projetos\AlphaCarnes\.worktrees\e01-t02`. Banco de teste dedicado (os testes truncam):

```powershell
docker compose up -d postgres
docker compose exec postgres psql -U alphacarnes -d alphacarnes -c "CREATE DATABASE alphacarnes_e01_t02"
$env:DATABASE_URL = 'postgres://alphacarnes:alphacarnes@localhost:15433/alphacarnes_e01_t02'
```

Saída esperada: `CREATE DATABASE` ou "already exists". Cada task de código: teste, ver falhar, implementar, ver
passar, commitar só os paths da task (`git add` explícito). Não usar `git add -A`.

### Task 0 — Context7 e leitura obrigatória (sem commit)

1. Context7 (`resolve-library-id` + `get-library-docs`): Drizzle 0.45 "pgTable check uniqueIndex where foreignKey
   date mode string for no key update transactions"; NestJS 11 "ConflictException e UnprocessableEntityException
   com objeto"; Zod 4 "strict object enum"; Next 16 route handlers. Registrar as APIs no relatório do PR (o PR
   não é desta sessão).
2. Ler: este plano §4–§7; `fiscal-empresas.schema.ts`; `fiscal-comum.ts`; `operacoes.schema.ts`;
   `produtos.schema.ts`; `clientes.schema.ts`; `permissoes.ts` (bloco `FISCAL_EMPRESAS_*`); `menus-canonicos.ts`;
   `menu-v2.ts` (grupo FISCAL); `room-permissoes.ts`; `realtime.gateway.ts` L160–L189; `eventos.ts` (evento
   fiscal e `PayloadPorEvento`); `test-app.ts` `cleanupDb`; `app/frontend/src/app/(admin)/fiscal/empresas/page.tsx`.

### Task 1 — Validadores de CFOP, NCM e CEST

Files: `src/common/validators/{cfop,ncm,cest}.ts`, `test/unit/{cfop,ncm,cest}.spec.ts`.

- `normalizarCfop`: só dígitos. `validarCfop`: `^[0-9]{4}$`.
- `normalizarNcm`: remove `.`, espaço e `-`. `validarNcm`: `^[0-9]{8}$`.
- `normalizarCest`: só dígitos. `validarCest`: `^[0-9]{7}$`.

Teste que deve falhar antes da implementação:

```ts
it('normaliza NCM mascarado', () => {
  expect(normalizarNcm('0201.30.00')).toBe('02013000');
  expect(validarNcm('0201300')).toBe(false);
  expect(validarCfop('5101')).toBe(true);
  expect(validarCfop('51A1')).toBe(false);
  expect(validarCest('1708700')).toBe(true);
  expect(validarCest('170870')).toBe(false);
});
```

```powershell
Set-Location app/backend
npx jest test/unit/cfop.spec.ts test/unit/ncm.spec.ts test/unit/cest.spec.ts
```

Commit: `feat(e01-t02): validadores de formato de CFOP, NCM e CEST`.

### Task 2 — Schema, migration e testes de banco

Files: schema §5, `schema/index.ts`, migration gerada, `ROLLBACK.md`, `test-app.ts`,
`test/integration/e01-t02-migrations.e2e-spec.ts`.

O teste consulta `information_schema` e `pg_indexes`: existem `cfops`, `ncms`, `enquadramentos_fiscais`;
`uq_cfops_codigo`, `uq_ncms_codigo` e `uq_enquadramentos_codigo` são parciais (`WHERE deleted_at IS NULL`);
a FK `(estabelecimento_id, empresa_id)` existe; `COUNT(*)` nas três tabelas é 0; não há coluna
`data_comercial`, `data_fiscal` nem `data_efetiva`; insert de CFOP `ABCD` viola o CHECK.

```powershell
Set-Location app/backend
npx drizzle-kit generate --name e01_t02_enquadramentos
$novas = 'cfops|ncms|enquadramentos_fiscais'
$permitido = "^(CREATE TABLE ""($novas)""|CREATE (UNIQUE )?INDEX ""\w+"" ON ""($novas)""|ALTER TABLE ""($novas)"" ADD CONSTRAINT)"
Get-Content (Get-ChildItem src/database/migrations/*e01_t02*.sql) -Raw |
  ForEach-Object { $_ -split '--> statement-breakpoint' } | ForEach-Object { $_.Trim() } |
  Where-Object { $_ -and $_ -notmatch $permitido }
npm run db:migrate
npx jest test/integration/e01-t02-migrations.e2e-spec.ts
```

Esperado: um SQL novo; o pipeline de allowlist **sem saída** — qualquer statement listado é critério de parada;
migrate sem erro; testes passam. `ROLLBACK.md`: seção "E01-T02" com as três tabelas e a ordem
`enquadramentos_fiscais`, `ncms`, `cfops`. Commit:
`feat(e01-t02): schema de enquadramentos fiscais e catálogos manuais de CFOP e NCM`.

### Task 3 — Permissões, parâmetro, menu canônico e snapshots

Files: §9. Inclui o ajuste do teste de catálogo Fiscal (cinco permissões, as três da T01 preservadas).

```powershell
Set-Location app/backend
npx tsx scripts/gerar-snapshot-perfis.ts
git diff -U0 -- src/common/rbac/perfil-menus.snapshot.json src/common/rbac/perfil-permissoes.snapshot.json
git diff -U0 -- src/common/rbac/menus-canonicos.ts | Select-String "^-\s+'/"
npx jest test/unit/perfil-permissoes-snapshot.spec.ts test/integration/perfis-menus.e2e-spec.ts
npm run db:seed
```

Esperado: diffs dos snapshots só sob `administrador` (+ `/fiscal/enquadramentos`, + duas permissões);
`Select-String` sem saída (nenhuma rota removida); testes passam; seed sem erro. Commit:
`feat(e01-t02): permissões FISCAL_ENQUADRAMENTOS_* e rota no menu canônico`.

### Task 4 — DTOs Zod

Files: `dto/{cfop,ncm,enquadramento,consulta,comum}.dto.ts`, `test/unit/fiscal-enquadramentos-dto.spec.ts`.

`cest` passa por `normalizarCest` + `validarCest`. Datas `z.iso.date()`. `fim` omitido ou `>= início`
(`.superRefine`). `prioridade` `z.number().int().min(1)`. Enums = as constantes do schema §5. `comum` exporta
`justificativaSchema` = `z.string().trim().min(3).max(500)`. Consulta exige todos os campos da chave e `data`.

```powershell
Set-Location app/backend
npx jest test/unit/fiscal-enquadramentos-dto.spec.ts
```

Commit: `feat(e01-t02): DTOs Zod de enquadramento, CFOP e NCM`.

### Task 5 — Catálogos manuais de CFOP e NCM

Files: `cfops.service.ts`, `ncms.service.ts`, os dois controllers, `enquadramentos-fiscais.module.ts`,
`app.module.ts`, `e01-t02-catalogos.e2e-spec.ts`.

`23505` pelo nome `uq_cfops_codigo` / `uq_ncms_codigo` → 409 `CFOP_DUPLICADO` / `NCM_DUPLICADO`. Listagem não
devolve removidos. Auditoria `INSERT` na mesma transação. Evento `cfop_criado` / `ncm_criado` depois do commit.

```powershell
Set-Location app/backend
npx jest test/integration/e01-t02-catalogos.e2e-spec.ts
```

Commit: `feat(e01-t02): cadastro manual de CFOP e NCM`.

### Task 6 — Enquadramento, duplicar, vigência e auditoria

Files: `enquadramentos.service.ts`, `enquadramentos.controller.ts` (sem a rota `consulta`, que é a Task 7),
`enquadramento-criterio.ts` (só `intervalosSobrepoem` e `mesmaChave` se ainda não estiverem no arquivo),
`e01-t02-enquadramentos.e2e-spec.ts`.

O teste cria empresa/estabelecimento pela API da T01 (dois administradores: um submete, outro aprova) e cria
operação, produto e cliente pelas APIs já existentes. Casos obrigatórios do §13: CRUD, duplicar, sobreposição
com prioridade diferente, estabelecimento `DRAFT` e `SUSPENDED`, produto inativo, cliente inativo, operação
removida, auditoria, histórico sem UUID, GET que não altera `atributos_json` nem a operação.

```powershell
Set-Location app/backend
npx jest test/integration/e01-t02-enquadramentos.e2e-spec.ts
```

Commit: `feat(e01-t02): API de enquadramentos fiscais com vigência, duplicação e auditoria`.

### Task 7 — Consulta que recusa tributo

Files: `classificarEnquadramentos` em `enquadramento-criterio.ts`, rota `POST consulta`,
`test/unit/enquadramento-criterio.spec.ts`, `test/integration/e01-t02-consulta.e2e-spec.ts`.

Teste unitário:

```ts
it('não desempata por prioridade', () => {
  const r = classificarEnquadramentos([
    { codigo: '2', prioridade: 1 },
    { codigo: '10', prioridade: 99 },
  ]);
  expect(r).toEqual({ tipo: 'empate', codigos: ['2', '10'] });
});
```

O e2e da consulta cobre: corpo só com `cfopId` → 400; data fora da vigência → `REGRA_APROVADA_AUSENTE` com
`enquadramentoLocalizado: null`; uma linha → 422 com `enquadramentoLocalizado.codigo` e
`expect(JSON.stringify(res.body)).not.toMatch(/cst|aliquota|icms|ipi|pis|cofins|ibs|cbs|cBenef|cClassTrib/i)`;
dois perfis de mesmo CFOP e produtos diferentes não se misturam; duas linhas da mesma chave (a segunda inserida
por SQL direto, para furar o 409 do serviço) → `EMPATE_ENQUADRAMENTO`, `candidatos` com os dois códigos,
`expect(res.body.vencedor).toBeUndefined()`. A consulta com 422 não deixa linha nova em `auditoria`.

```powershell
Set-Location app/backend
npx jest test/unit/enquadramento-criterio.spec.ts test/integration/e01-t02-consulta.e2e-spec.ts
```

Commit: `feat(e01-t02): consulta de enquadramento sem resolução de tributo`.

### Task 8 — Concorrência e eventos

Files: `e01-t02-concorrencia.e2e-spec.ts`, `e01-t02-eventos.e2e-spec.ts`. `Promise.all` de supertest; espião em
`EventEmitter2.emit`. Correção de serviço fica nos arquivos das Tasks 5–7.

```powershell
Set-Location app/backend
npx jest test/integration/e01-t02-concorrencia.e2e-spec.ts test/integration/e01-t02-eventos.e2e-spec.ts
```

Commit: `test(e01-t02): concorrência e eventos pós-commit do enquadramento`.

### Task 9 — Room protegida

Files: `room-permissoes.ts`, `realtime.gateway.ts`, `eventos.ts` (se o payload ainda não estiver registrado),
`test/unit/room-permissoes.spec.ts`. Acrescentar o caso; não apagar `fiscal-empresas exige FISCAL_EMPRESAS_LER`.

```powershell
Set-Location app/backend
npx jest test/unit/room-permissoes.spec.ts test/unit/realtime-gateway-rooms.spec.ts
```

Commit: `feat(e01-t02): room fiscal-enquadramentos protegida por permissão`.

### Task 10 — Exportação, histórico e pré-condições

Files: `exportacao-csv.ts`, rotas e casos em `e01-t02-enquadramentos.e2e-spec.ts`. CSV com as colunas Código,
Operação, CFOP, Início de vigência, Estabelecimento, Tipo da nota, Finalidade, Situação, Responsável, Produto,
Cliente, NCM, CEST, Prioridade, Abrangência, Origem do produto. Pré-condições do §7, inclusive as provisórias
com `atendida: false`.

```powershell
Set-Location app/backend
npx jest test/integration/e01-t02-enquadramentos.e2e-spec.ts
```

Commit: `feat(e01-t02): exportação, histórico e pré-condições do enquadramento`.

### Task 11 — BFF `/api/erp/fiscal`

Files do §12. JSON via `repassar` (`lib/bff.ts`); CSV via o mesmo padrão da exportação de estabelecimentos
(preservar `Content-Type` e `Content-Disposition`); ação fora da allowlist → 404 sem chamar o backend.
`__tests__/bff-e01-t02.test.ts` cobre 409, 422 e o 404.

```powershell
Set-Location app/frontend
npx jest __tests__/bff-e01-t02.test.ts
```

Commit: `feat(e01-t02): rotas BFF de enquadramentos, CFOP e NCM`.

### Task 12 — Página, componentes e item de menu

Files: §10 e os testes `fiscal-enquadramentos-lib`, `enquadramentos-client`, `menu-v2`, `menu-rbac`. O teste do
client afirma: estado vazio com o texto do protótipo; 409 de concorrência; 409 de sobreposição com o código do
conflito; 422 de empate sem eleger linha; 422 sem regra aprovada sem valor de tributo; `container.textContent`
sem UUID e sem a palavra `Marca`; selos `H-E01-06`, `H-E01-08`, `H-E01-09`, `H-E01-10`, `H-E01-11` e
`H-E01-12`.

```powershell
Set-Location app/frontend
npx jest __tests__/fiscal-enquadramentos-lib.test.ts __tests__/enquadramentos-client.test.tsx __tests__/menu-v2.test.ts __tests__/menu-rbac.test.ts
```

Commit: `feat(e01-t02): página /fiscal/enquadramentos no grupo Fiscal`.

### Task 13 — Playwright: jornada e acessibilidade

Files: `e2e/helpers/e01-t02-seed.ts` (dois administradores pela API de usuários; estabelecimento aprovado pela
API da T01; produto, cliente e operação pelas APIs existentes; CFOP `5102` e NCM `02013000` criados pela API
desta fatia — números de formato, não uma tabela oficial), `e2e/e01-t02-enquadramentos.spec.ts`. Backend em
`:4001` com seed; frontend pelo `webServer` do `playwright.config.ts`.

- Jornada (admin): menu FISCAL → "Operações fiscais e enquadramentos"; novo CFOP e novo NCM pelo diálogo, com
  o aviso de tabela oficial ausente; novo enquadramento com os combos (estabelecimento aprovado, operação,
  produto, cliente), tpNF Saída, finNFe Normal, abrangência Dentro do estado, origem Revenda, CEST `1708700`,
  vigência e prioridade `1`; a ficha mostra o código numérico e os selos provisórios. Duplicar com início
  posterior → segunda linha. Duplicar com a mesma vigência → mensagem de sobreposição e uma linha a mais não
  aparece. Inativar a primeira → situação Inativa. Validar pré-condições da linha inativa mostra a ausência de
  regra aprovada, sem alíquota na tela.
- Autorização: usuário `gestor` não vê o item; `goto('/fiscal/enquadramentos')` mostra a mensagem sem
  permissão. O item "Empresas, estabelecimentos e regime" continua visível para o administrador.
- Acessibilidade (sem dependência nova): todo `textbox`/`combobox`/`button` visível da tela e dos diálogos tem
  nome acessível não vazio; grid por teclado (Tab até a linha, Enter seleciona); diálogos fecham com Escape e
  devolvem o foco; `innerText` do `body` sem UUID (`/[0-9a-f]{8}-[0-9a-f]{4}-/i`), sem `/E\d{2}-T\d{2}/` e sem
  a palavra `Marca`.

```powershell
Set-Location app/frontend
npx playwright test e2e/e01-t02-enquadramentos.spec.ts
```

Esperado: todos passam. Playwright não é job do `ci.yml`. Commit:
`test(e01-t02): Playwright de jornada, autorização e acessibilidade`.

### Task 14 — Screenshots comparativos

File: `e2e/capture-e01-t02-evidencias.spec.ts` (padrão `capture-e01-t01-evidencias.spec.ts`: elemento-chave
antes de cada captura, fail-hard). Viewport 1280×800, `fullPage`. Pares em `docs/evidencias/e01-t02/`:
`app-<estado>.png` e `prototipo-<estado>.png` (`file:///<worktree>/docs/prototipos/erp-integrado-v1/index.html#E01-T02`)
para lista, ficha, movimentações, regras, exceções, histórico, integrações, aceite e drawer. Só app: vazio,
erro com retry, 403, diálogo de duplicar, diálogo de CFOP, alerta de empate, alerta de regra ausente.

```powershell
Set-Location app/frontend
npx playwright test e2e/capture-e01-t02-evidencias.spec.ts
Get-ChildItem ../../docs/evidencias/e01-t02 -Filter *.png | Measure-Object
```

Esperado: 24 arquivos (9 pares + 6). Commit: `docs(e01-t02): evidências visuais app × protótipo`.

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

Esperado: comandos verdes; cobertura ≥ 80% linha e branch; o diff contra `develop` contém a E01-T01 já presente
na branch **e** os arquivos desta fatia; nenhum path fora de §12 foi modificado por commit desta fatia (a T01
não é revertida); `git status` limpo. Não executar `git push` nem `gh pr create`. Não editar
`docs/execucao/**`.

## 15. Gate e evidências para o Portão 2/A

- Relatório no formato `pipeline-execucao.md` §7: task a task, saídas de teste e Playwright, cobertura, APIs
  do Context7. O Executor registra a onda em `EXECUCAO-STATUS.md` ao disparar (AD-22 (5)); o Worker não edita
  esse arquivo.
- Portão 2 compara os pares `app-*`/`prototipo-*` (Task 14), confere as remoções do §4 e reexecuta Playwright
  e os testes de menu (39 operacionais + 2 do Fiscal).
- Portão A obrigatório (classe alto).
- CI dos oito jobs e o PR ficam para o fim do lote, fora deste plano.

## 16. Rollback

- Código: revert dos commits desta fatia por PR futuro, sem force-push. O revert devolve `MENUS_ERP` a
  `['/fiscal/empresas']` e o próximo seed reconcilia `menus_visiveis`. A T01 permanece.
- Banco: as três tabelas são folha (nenhuma FK externa ainda). Dev/CI sem dados: gerar a migration de remoção
  com `drizzle-kit generate`, nunca SQL manual. Com linhas: não remover; abre-se decisão do Quality Owner.
- O parâmetro `fiscal.enquadramentos_perfis_autorizados` e as duas permissões saem só junto do revert.

## 17. Critérios de parada (PARAR e reportar ao coordenador)

- Allowlist da Task 2 lista algum statement, ou a migration pede extensão, trigger ou SQL manual.
- Drizzle-kit não gera a FK composta `(estabelecimento_id, empresa_id)`.
- Alguma das 39 rotas operacionais muda de href, rótulo, grupo ou ordem relativa, ou o grupo FISCAL deixa a
  8ª posição.
- O serviço precisa escolher um enquadramento vencedor, calcular tributo, exigir segundo aprovador, semear
  CFOP/NCM ou gravar três datas — isso é lacuna do §18, não implementação.
- Faz falta alterar produto, cliente, operação ou o schema de empresas além do export já citado.
- Teste da T01 quebra por causa que não seja a contagem 40→41 ou o catálogo Fiscal de 3→5 permissões, e a
  correção não cabe em §12.

## 18. Pendências e dependências (nenhuma decisão inventada)

Nenhuma linha abaixo impede a implementação. A task segue com o tratamento da coluna "Até a decisão".

| ID | Pendência | Dono | Bloqueia | Até a decisão |
|---|---|---|---|---|
| H-E01-06 | O que o inteiro `prioridade` significa (faixa, peso, ordem) | Quality Owner | usar a prioridade como regra | coluna gravada e exibida com `BadgeProvisorio`; a consulta não a lê |
| H-E01-07 | Algoritmo de desempate quando dois enquadramentos cobrem o mesmo critério | Quality Owner | eleger um vencedor | 422 `EMPATE_ENQUADRAMENTO`; a lista não é uma escolha |
| H-E01-08 | Tabela oficial completa de CFOP e de NCM | Contador + catálogo oficial (E12, quando existir) | semear ou consultar a tabela nacional | catálogo manual vazio; formato e duplicidade; selo Provisório |
| H-E01-09 | Vínculo oficial NCM → CEST | Contador | rejeitar CEST incompatível com o NCM | CEST de 7 dígitos, sem FK e sem consulta; selo Provisório |
| H-E01-10 | Três datas comercial, fiscal e efetiva | Quality Owner | colunas extras de data | só `vigencia_inicio` e `vigencia_fim`; selo Provisório |
| H-E01-11 | Quando a dupla aprovação é exigida | Quality Owner | quórum e permissão `APROVAR` | sem fluxo de aprovação; pré-condição provisória; E01-T03/T05 |
| H-E01-12 | Quais dos 11 perfis, além do administrador, recebem `FISCAL_ENQUADRAMENTOS_*` | Quality Owner | atribuir a outros perfis | seed só administrador; parâmetro `provisorio: true`; edição em `/admin/perfis` |

Dependências já entregues e reusadas, sem pendência nova: estabelecimentos aprovados, empresas, grupo e menu
FISCAL, `FISCAL_EMPRESAS_*` (T01); `produtos`, `clientes`, `operacoes` (cadastros atuais).

## 19. Self-review

- Uma fatia E2E (página → BFF → API → PostgreSQL → evento/WS). Classe alto justificada. Sem HEAD, contagem ou SHA.
- T03 (editor), T04 (simulador) e T05 (homologação) não têm task. A consulta não devolve tributo (§7, Task 7).
- CFOP sozinho, vigência, empate e ausência de regra aprovada têm teste nomeado no §13.
- Estabelecimento, produto, cliente e operação comercial são FKs para tabelas existentes. CFOP/NCM manuais não
  semeiam a tabela nacional. Não há três datas. Não há desempate. Não há dupla aprovação.
- 39 rotas operacionais preservadas; o grupo FISCAL não é recriado; o item novo é o segundo do grupo.
- Lacunas do pedido estão no §18 com id, selo e caminho implementável. Nenhuma é bloqueio de implementação.
- Revisão do texto: cada regra de serviço tem código ou tabela própria; nenhuma task delega o comportamento a outra sem repetir o contrato.
