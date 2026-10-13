# E01-T01 — Empresas, estabelecimentos e regime — Plano de Implementação (fatia E2E, rito AD-22)

> Para workers agênticos: papel `worker` (AGENTS.md "Papéis"). Worktree `.worktrees/e01-t01`, branch
> `feature/erp-e01-t01-empresas-estabelecimentos`, base `origin/develop`. Estado do git é lido por comando no
> momento do uso; este plano não afirma HEAD, contagem de commits nem SHAs (AD-22 (4), PR #162).

**Goal:** entregar o cadastro fiscal de empresas e estabelecimentos com regime tributário (CRT) versionado por
vigência e aprovação segregada, ponta a ponta: componente de tela DS v3 → BFF `/api/erp/fiscal` → NestJS →
PostgreSQL → eventos pós-commit em room WS protegida; e cumprir as exigências D-E01 dos gates E12-T00/E11-T00
(tabela de estabelecimentos com `UNIQUE (id, empresa_id)` como alvo de FKs compostas).

**Architecture:** módulo Nest `EmpresasFiscaisModule` em `app/backend/src/modules/erp/fiscal/empresas/`
(Caderno B L61), um schema Drizzle de domínio (`fiscal-empresas.schema.ts`), serviços transacionais com
auditoria na mesma transação e `EventEmitter2.emit` depois do commit; gateway WS ganha mapa room→permissão
(contrato E12 §3.13.6); BFF Next em `app/frontend/src/app/api/erp/fiscal/**`; componente cliente em
`app/frontend/src/components/fiscal/empresas/`. A montagem da rota de página, o item de menu e o Playwright
ficam na fatia E01-T01b, bloqueada por H-E01-01 (§0, §18, §19).

**Tech Stack (fixa, constituição L60):** NestJS 11 + TypeScript 5 strict, Next.js 16 App Router (BFF),
PostgreSQL 18 + Drizzle ORM 0.45 / drizzle-kit 0.31, Zod 4, WebSocket nativo (`ws`), JWT + RBAC 11 perfis,
Jest (backend e frontend), Playwright (E01-T01b). Nenhuma dependência nova.

**Classe de risco: ALTO** (AD-22 (6); `pipeline-execucao.md` do PR #162). Justificativa: (1) cria permissões
novas e altera a autorização de assinatura de rooms WS (`podeAssinar` por room) — "RBAC/autorização"; (2) o CRT
vigente é insumo fiscal direto da NF-e 55 (E02) e do motor tributário (E01-T03/T04) — "fiscal"; (3) a tabela de
estabelecimentos é a âncora de tenant das FKs compostas de E06/E11/E12 (D-E01), cujas colunas-alvo são invariantes
de integridade. Consequência: rito completo — revisão crítica por commit, Portão 2 e Portão A.

---

## 0. Escopo da fatia (o que entra, o que sai e por quê)

Entra (decidível pelas fontes):
- Empresas (razão social, CNPJ raiz alfanumérico), estabelecimentos (nome, CNPJ alfanumérico com DV, IE, IM,
  UF, situação com aprovação segregada) e versões de regime tributário (CRT, início/fim de vigência, aprovação,
  troca de regime sem sobreposição).
- API REST completa, auditoria, eventos pós-commit, room WS `fiscal-empresas`, exportação CSV, histórico,
  pré-condições, leitura fiscal fail-closed para domínios adjacentes.
- BFF e componente de tela completo (7 abas, estados, diálogos, cascata empresa → estabelecimento), testado em
  Jest/RTL.

Sai (bloqueado; registrado em §18, sem inventar):
- Rota de página, item de menu e Playwright → H-E01-01 (grupo FISCAL × Cadastros & Regras; slug sem código
  E##; criação do grupo pelo E10-T04). Fatia E01-T01b (§19).
- Combos Município, Atividade econômica (CNAE) e Certificado vinculado: dependem de catálogos que não existem
  (`MUNICIPIOS` do E12-T08; CNAE sem dataset em nenhuma fonte; certificados do E12-T03). Aparecem na ficha e no
  formulário desabilitados, com badge Provisório (Princípio VIII) e sem coluna no banco nesta fatia → H-E01-04.
- "Competência bloqueada": não existe fechamento de competência no sistema (E09-T08). → H-E01-05.

## 1. Global Constraints

- Constituição: Princípios I (L9), II (L20), III (L24), IV (L28), VI (L36), VII (L40), VIII (L44), X (L52);
  stack fixa (L60); sem over-engineering (L61); cobertura backend ≥ 80% linha e branch (L63).
- AGENTS.md: pwsh 7, nunca bash; worker não edita `docs/execucao/`; integração só por PR com 8 jobs verdes.
- AD-04 (DECISOES L11): 11 perfis; AD-18 (L25) itens (2) e (5): protótipos ERP são referência integral e
  personas não viram perfis; AD-10 (L17): DS v3; AD-15 (L22): 39 rotas; AD-19..AD-21 (L26–L28): rito liberado,
  modelo não atestável, merge autorizado só com gates.
- Convenções de schema (`docs/data/convencoes-schema.md` L11–L34, L62–L73): uuidv7, TIMESTAMPTZ, VARCHAR(n) para texto
  curto, status TEXT+CHECK, soft delete, índices em FK e status parcial. `updated_at` atualizado pelo serviço,
  sem trigger nem SQL manual (padrão da migration 0043; E12 §1 item 14).
- UI nunca exibe UUID, PK, código E##/ALP nem nome de tabela (Caderno B L601; MATRIZ-UX L5).

## 2. Decisões fixadas (com fonte)

| # | Decisão | Fonte |
|---|---|---|
| D1 | Nomes físicos `empresas`, `estabelecimentos`, `regimes_tributarios` (convenção PT plural); `companies`/`establishments` do E12 são conceituais e o E12-T01 transcreve | convencoes-schema L4; E12 §4 L1145 |
| D2 | `estabelecimentos` declara `UNIQUE (id, empresa_id)` não parcial (alvo de FK composta); `id`, `empresa_id`, `cnpj` imutáveis após INSERT; nunca DELETE físico | E12 D-E01 L1889, §3.13.7; E11 §5.3 L1451 e L1470 ("Modos de lock") |
| D3 | CNPJ e CNPJ raiz são strings, aceitam alfanumérico (`[0-9A-Z]{12}` + 2 DV numéricos), validação de DV no backend | doc 20 L64; doc 22 L37; componentes.js L48 |
| D4 | Raiz do CNPJ do estabelecimento = CNPJ raiz da empresa (422 `CNPJ_RAIZ_DIVERGENTE`) | estrutura do CNPJ (doc 20 L64, fonte RFB); "CNPJ rejeitado" Caderno B L56 |
| D5 | Domínio CRT = `1` Simples Nacional, `2` Simples Nacional — sublimite, `3` Regime normal, `4` MEI (se aplicável); valor por estabelecimento é dado do titular | componentes.js L1710–L1727; Caderno B L11 |
| D6 | Situação = enum do protótipo `DRAFT/REVIEW/APPROVED/REJECTED/SUSPENDED` (Rascunho, Aguardando revisão, Aprovado, Rejeitado, Suspenso) no estabelecimento; regime usa os quatro primeiros | componentes.js L1688–L1709 |
| D7 | Aprovação segregada: quem aprova/rejeita ≠ quem submeteu (422 `SEGREGACAO_FUNCAO`); justificativa obrigatória em toda mutação | MATRIZ-UX L10; aplicacao.js L198 (Autor → Revisor → Aprovação segregada), L436, L451, L499 |
| D8 | Regime sem sobreposição entre versões `REVIEW`/`APPROVED` do mesmo estabelecimento; troca de regime = nova versão com início D posterior ao início da versão aprovada aberta, com confirmação explícita (challenge 409 read-only) e, na aprovação, fim da anterior = D − 1 dia na mesma transação | Caderno B L55–L56; padrão challenge AD-05 (DECISOES L12) |
| D9 | Regime só é aprovado com estabelecimento `APPROVED` (fail-closed) | Princípio VII; AD-22 "fail-closed" |
| D10 | Datas separadas: vigência (`date`, data fiscal efetiva), decisão (`decidido_em` timestamptz), registro (`created_at`); "hoje" fiscal = `(now() AT TIME ZONE 'America/Sao_Paulo')::date` | Caderno B L55; doc 22 L77 |
| D11 | Permissões `FISCAL_EMPRESAS_LER`, `FISCAL_EMPRESAS_GERENCIAR`, `FISCAL_EMPRESAS_APROVAR`, só no `administrador` na seed; demais perfis = H-E01-02 com parâmetro + badge Provisório | AD-04; AD-18 (5); E12 §3.7 (mesmo tratamento de H-03); permissoes.ts L126 |
| D12 | Room WS `fiscal-empresas` exige `FISCAL_EMPRESAS_LER`; arquivo `realtime/room-permissoes.ts` criado por esta fatia (primeira que o precisa) com a API do contrato E12 §3.13.6; E12-T04/E11-T09 acrescentam as suas entradas | E12 §3.13.6 L942–L951; Princípio VI |
| D13 | Validação de schema Zod segue AD-12 (400, shape inalterado); regra de domínio → 422; conflito de estado, unicidade, versão e sobreposição → 409 | AD-12 (DECISOES L19); Caderno B L56 |
| D14 | Concorrência otimista por coluna `versao`; serialização de regras de regime por `SELECT … FOR NO KEY UPDATE` da linha do estabelecimento (compatível com `FOR KEY SHARE` das FKs futuras) | MATRIZ-UX L10 "conflito concorrente 409"; E11 §5.3 L1470 |
| D15 | Critério "empresa ativa" exportado para E12 (`EmpresaAcessoPort` P5 `TODAS_ATIVAS`): `empresas.deleted_at IS NULL` e ao menos um estabelecimento `APPROVED` não removido | E12 L938, P5 L724, H-15 L1913 |
| D16 | Leitura fiscal para domínios adjacentes (`dadosFiscaisVigentes`) devolve CNPJ/IE/UF/CRT só com estabelecimento `APPROVED` e regime `APPROVED` vigente na data; caso contrário `null` | E12 §6.2 L1838 ("IE/CRT via porta E01"); Princípio VII |
| D17 | Remoção (soft delete): estabelecimento só em `DRAFT`/`REJECTED` sem regime `REVIEW`/`APPROVED`; empresa só sem estabelecimento não removido; aprovado nunca é removido, é suspenso | convencoes-schema L30–L34; MATRIZ-UX L10 "reversão em vez de apagar" |
| D18 | Chave de payload e BFF sob `/api/erp/fiscal` | Caderno B L61 |

## 3. Conflitos de fonte resolvidos (nenhum é decisão de produto)

| # | Conflito | Resolução |
|---|---|---|
| C1 | Grupo de menu: protótipo FISCAL (catalogo.js L183; MATRIZ-INTEGRAL L24; MATRIZ-UX L18) × ADR-ERP-024 L63 "Cadastros & Regras … cadastro estabelecimento E01 mediante aprovação" | Não resolvível sem o QO (estrutura de navegação, Princípio I.6 L18) → H-E01-01; nenhuma entrada de menu nesta fatia |
| C2 | Rota `/erp/fiscal/e01-t01` (catalogo.js L186) × proibição de código de épico/tarefa na UI (Caderno B L601) | Mesmo tratamento do E12 C6/H-05 → H-E01-01 |
| C3 | Enum UF do protótipo com 4 UFs demonstrativas (componentes.js L1728) × 27 UFs reais | Substituição de dado mockado por real (Princípio I.2(b) L14): `UFS_BRASIL` (`common/dto/dominios.dto.ts` L7; frontend `lib/dominios.ts` L9) |
| C4 | Status 400 da `ZodValidationPipe` × "validação 422" do Caderno B L56 | D13 |
| C5 | Personas "gestor fiscal, contador" (catalogo.js L187) × 11 perfis | AD-04/AD-18 (5) prevalecem → D11, H-E01-02 |

## 4. Referência do protótipo (tela → arquivo/linha) e fidelidade

Fonte: `docs/prototipos/erp-integrado-v1/` (AD-18 (2); emenda constitucional L93) + DS v3 (AD-10). Uma tela.

| Elemento | Fonte (arquivo:linha) | Implementação real |
|---|---|---|
| Metadados da tela | catalogo.js L180–L193 | título "Empresas, estabelecimentos e regime"; subtítulo = ações + "Acesso típico" do catálogo, com BadgeProvisorio `H-E01-02` |
| Campos e tipos | componentes.js L15–L189 (empresa L15, razaoSocial L27, cnpj L39/L48, estabelecimento L51, ie L65, im L77, uf L89, municipio L101, cnae L115, crt L127, certificado L139, vigenciaInicio L154, vigenciaFim L166, status L178) | §10 |
| Grid, filtros, estados, navegação | componentes.js L2898–L2970; MATRIZ-UX L17–L45 | colunas Estabelecimento · CNPJ · Regime tributário · Estado · Situação · Empresa; ordenação nas cinco primeiras+Empresa, padrão Estabelecimento; 20/página server-side |
| Cascata empresa → estabelecimento | componentes.js L7899–L7905; MATRIZ-UX L7 | filtro e formulário limpam o filho ao trocar o pai |
| Layout geral (hero, KPIs, work-grid, 7 abas, card de ações do domínio) | aplicacao.js `renderScreen` L353 | §10 |
| Grid e toolbar | aplicacao.js `renderTable` L164 | busca, filtro de situação, "Exportar visão" |
| Abas | aplicacao.js L7 (nomes), `renderFicha` L179, `renderMov` L194, `renderRules` L197, `renderExceptions` L200, `renderHistory` L207, `integrationInfo` L212, `renderAccept` L220 | §10 |
| Drawer de cadastro, controles, validação, cascata | aplicacao.js `renderControl` L407, `openDrawer` L427, `saveForm` L441, `syncDependentSelectors` L472 | §10 |
| Lookup vazio | aplicacao.js `openLookup` L485 (texto L487) | texto dos combos indisponíveis |
| Ações do processo / decisão com justificativa | aplicacao.js `openWorkflow` L403, `openConfirm` L495 | diálogos reais |

Remoções autorizadas (Princípio I.2(a)/(b), L14), cada uma verificada no Portão 2: selo "DADOS FICTÍCIOS";
pill "Fixture de teste"; rodapé "registros fictícios"; eyebrow com código de épico e "Caderno B §E01-T01"
(Caderno B L601); KPI "Ambiente em tela" e campo "Ambiente" da trilha (não há ambiente HML/PROD neste cadastro);
botões "Abrir ocorrência" e "Simular erro de validação" de Exceções (toasts declaram ação fictícia, L400/L398);
painel de enquadramentos das NF-e (aplicacao.js L243–L255, declarado "apenas fixtures para testes", L253);
"ilustrativo" do botão de salvar e o aviso "Cadastro demonstrativo em memória" (L437); checkboxes sem
persistência da aba Aceite (lista vira leitura). Botões de Integrações para telas inexistentes (L218) ficam
desabilitados com `title="Destino ainda não disponível"`.

## 5. Modelo de dados (Drizzle — `app/backend/src/database/schema/fiscal-empresas.schema.ts`)

Transcrever literalmente; o Worker confirma a sintaxe de `foreignKey`, `unique` e `date({ mode: 'string' })` no
Context7 (Task 0). `usuarios` vem de `./auth.schema` (L21).

```ts
import { sql } from 'drizzle-orm';
import {
  check, date, foreignKey, index, integer, pgTable, text, timestamp, unique, uniqueIndex, uuid, varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { usuarios } from './auth.schema';

export const SITUACOES_ESTABELECIMENTO = ['DRAFT', 'REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;
export const SITUACOES_REGIME = ['DRAFT', 'REVIEW', 'APPROVED', 'REJECTED'] as const;
export const CODIGOS_CRT = ['1', '2', '3', '4'] as const;
const UFS_SQL = sql.raw(`'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'`);

const auditCols = {
  versao:          integer('versao').notNull().default(1),
  criadoPorId:     uuid('criado_por_id').notNull().references(() => usuarios.id),
  atualizadoPorId: uuid('atualizado_por_id').notNull().references(() => usuarios.id),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:       timestamp('deleted_at', { withTimezone: true }),
};

export const empresas = pgTable('empresas', {
  id:          uuid('id').primaryKey().default(sql`uuidv7()`),
  razaoSocial: varchar('razao_social', { length: 150 }).notNull(),
  cnpjRaiz:    varchar('cnpj_raiz', { length: 8 }).notNull(),           // imutável
  ...auditCols,
}, (t) => [
  check('empresas_cnpj_raiz_formato_check', sql`${t.cnpjRaiz} ~ '^[0-9A-Z]{8}$'`),
  check('empresas_razao_social_preenchida_check', sql`btrim(${t.razaoSocial}) <> ''`),
  check('empresas_versao_positiva_check', sql`${t.versao} >= 1`),
  uniqueIndex('uq_empresas_cnpj_raiz').on(t.cnpjRaiz).where(sql`${t.deletedAt} IS NULL`),
  index('idx_empresas_criado_por').on(t.criadoPorId),
  index('idx_empresas_atualizado_por').on(t.atualizadoPorId),
]);

export const estabelecimentos = pgTable('estabelecimentos', {
  id:                    uuid('id').primaryKey().default(sql`uuidv7()`),
  empresaId:             uuid('empresa_id').notNull().references(() => empresas.id),   // imutável
  nome:                  varchar('nome', { length: 120 }).notNull(),
  cnpj:                  varchar('cnpj', { length: 14 }).notNull(),                     // imutável
  inscricaoEstadual:     varchar('inscricao_estadual', { length: 20 }).notNull(),
  inscricaoMunicipal:    varchar('inscricao_municipal', { length: 20 }).notNull(),
  uf:                    varchar('uf', { length: 2 }).notNull(),
  situacao:              text('situacao').notNull().default('DRAFT'),
  justificativaSituacao: text('justificativa_situacao'),
  submetidoPorId:        uuid('submetido_por_id').references(() => usuarios.id),
  decididoPorId:         uuid('decidido_por_id').references(() => usuarios.id),
  decididoEm:            timestamp('decidido_em', { withTimezone: true }),
  ...auditCols,
}, (t) => [
  unique('uq_estabelecimentos_id_empresa').on(t.id, t.empresaId),                 // D-E01 (não parcial)
  uniqueIndex('uq_estabelecimentos_cnpj').on(t.cnpj).where(sql`${t.deletedAt} IS NULL`),
  check('estabelecimentos_cnpj_formato_check', sql`${t.cnpj} ~ '^[0-9A-Z]{12}[0-9]{2}$'`),
  check('estabelecimentos_ie_formato_check', sql`${t.inscricaoEstadual} ~ '^[0-9A-Z]{1,20}$'`),
  check('estabelecimentos_im_formato_check', sql`${t.inscricaoMunicipal} ~ '^[0-9A-Z]{1,20}$'`),
  check('estabelecimentos_nome_preenchido_check', sql`btrim(${t.nome}) <> ''`),
  check('estabelecimentos_uf_valida_check', sql`${t.uf} IN (${UFS_SQL})`),
  check('estabelecimentos_situacao_valida_check',
    sql`${t.situacao} IN ('DRAFT','REVIEW','APPROVED','REJECTED','SUSPENDED')`),
  check('estabelecimentos_review_submetido_check',
    sql`${t.situacao} <> 'REVIEW' OR ${t.submetidoPorId} IS NOT NULL`),
  check('estabelecimentos_aprovado_decidido_check',
    sql`${t.situacao} <> 'APPROVED' OR (${t.decididoPorId} IS NOT NULL AND ${t.decididoEm} IS NOT NULL)`),
  check('estabelecimentos_justificativa_situacao_check',
    sql`${t.situacao} NOT IN ('REJECTED','SUSPENDED') OR ${t.justificativaSituacao} IS NOT NULL`),
  index('idx_estabelecimentos_empresa').on(t.empresaId),
  index('idx_estabelecimentos_situacao').on(t.situacao).where(sql`${t.deletedAt} IS NULL`),
  index('idx_estabelecimentos_submetido_por').on(t.submetidoPorId),
  index('idx_estabelecimentos_decidido_por').on(t.decididoPorId),
  index('idx_estabelecimentos_criado_por').on(t.criadoPorId),
  index('idx_estabelecimentos_atualizado_por').on(t.atualizadoPorId),
]);

export const regimesTributarios = pgTable('regimes_tributarios', {
  id:                uuid('id').primaryKey().default(sql`uuidv7()`),
  estabelecimentoId: uuid('estabelecimento_id').notNull(),
  empresaId:         uuid('empresa_id').notNull(),                 // derivado do estabelecimento, nunca do cliente
  crt:               text('crt').notNull(),
  vigenciaInicio:    date('vigencia_inicio', { mode: 'string' }).notNull(),
  vigenciaFim:       date('vigencia_fim', { mode: 'string' }),
  situacao:          text('situacao').notNull().default('DRAFT'),
  justificativa:     text('justificativa').notNull(),
  motivoRejeicao:    text('motivo_rejeicao'),
  substituiRegimeId: uuid('substitui_regime_id'),
  submetidoPorId:    uuid('submetido_por_id').references(() => usuarios.id),
  decididoPorId:     uuid('decidido_por_id').references(() => usuarios.id),
  decididoEm:        timestamp('decidido_em', { withTimezone: true }),
  ...auditCols,
}, (t) => [
  foreignKey({ name: 'fk_regimes_estabelecimento_empresa',
    columns: [t.estabelecimentoId, t.empresaId],
    foreignColumns: [estabelecimentos.id, estabelecimentos.empresaId] }),
  unique('uq_regimes_id_estabelecimento').on(t.id, t.estabelecimentoId),
  foreignKey({ name: 'fk_regimes_substitui_mesmo_estabelecimento',
    columns: [t.substituiRegimeId, t.estabelecimentoId],
    foreignColumns: [(t.id as AnyPgColumn), (t.estabelecimentoId as AnyPgColumn)] }),
  check('regimes_crt_valido_check', sql`${t.crt} IN ('1','2','3','4')`),
  check('regimes_situacao_valida_check', sql`${t.situacao} IN ('DRAFT','REVIEW','APPROVED','REJECTED')`),
  check('regimes_vigencia_ordenada_check', sql`${t.vigenciaFim} IS NULL OR ${t.vigenciaFim} >= ${t.vigenciaInicio}`),
  check('regimes_justificativa_preenchida_check', sql`btrim(${t.justificativa}) <> ''`),
  check('regimes_review_submetido_check', sql`${t.situacao} <> 'REVIEW' OR ${t.submetidoPorId} IS NOT NULL`),
  check('regimes_aprovado_decidido_check',
    sql`${t.situacao} <> 'APPROVED' OR (${t.decididoPorId} IS NOT NULL AND ${t.decididoEm} IS NOT NULL)`),
  check('regimes_rejeitado_motivo_check', sql`${t.situacao} <> 'REJECTED' OR ${t.motivoRejeicao} IS NOT NULL`),
  index('idx_regimes_estabelecimento').on(t.estabelecimentoId),
  index('idx_regimes_empresa').on(t.empresaId),
  index('idx_regimes_estab_situacao').on(t.estabelecimentoId, t.situacao).where(sql`${t.deletedAt} IS NULL`),
  index('idx_regimes_substitui').on(t.substituiRegimeId),
  index('idx_regimes_submetido_por').on(t.submetidoPorId),
  index('idx_regimes_decidido_por').on(t.decididoPorId),
  index('idx_regimes_criado_por').on(t.criadoPorId),
  index('idx_regimes_atualizado_por').on(t.atualizadoPorId),
]);
```

Migration: só `drizzle-kit generate --name e01_t01_empresas_estabelecimentos` (índice = próximo do
`meta/_journal.json`); expand-only (três `CREATE TABLE` + índices/constraints, nenhum `ALTER` de tabela
existente). Se o SQL gerado contiver qualquer comando sobre tabela existente → critério de parada.

## 6. Máquinas de estado e regras de serviço

Estabelecimento (`EstabelecimentosService`):

| Ação | De → Para | Permissão | Regras |
|---|---|---|---|
| criar | — → DRAFT | GERENCIAR | empresa não removida; DV; raiz = `empresas.cnpj_raiz` (422 `CNPJ_RAIZ_DIVERGENTE`); CNPJ único (409 `CNPJ_DUPLICADO`, via `23505` de `uq_estabelecimentos_cnpj`) |
| editar (nome, IE, IM, UF) | DRAFT→DRAFT; REJECTED→DRAFT; APPROVED→REVIEW (`submetido_por` = editor) | GERENCIAR | `versao` igual (409 `CONFLITO_CONCORRENTE`); REVIEW/SUSPENDED → 409 `TRANSICAO_INVALIDA`; DTO `.strict()` rejeita `empresaId`/`cnpj` |
| submeter | DRAFT → REVIEW | GERENCIAR | grava `submetido_por_id` |
| aprovar | REVIEW → APPROVED | APROVAR | usuário ≠ `submetido_por_id` (422 `SEGREGACAO_FUNCAO`); grava `decidido_*`; limpa `justificativa_situacao` |
| rejeitar | REVIEW → REJECTED | APROVAR | segregação; `justificativa_situacao` = justificativa |
| suspender | APPROVED → SUSPENDED | APROVAR | `justificativa_situacao` |
| reativar | SUSPENDED → REVIEW | GERENCIAR | `submetido_por_id` = solicitante |
| remover | DRAFT/REJECTED → soft delete | GERENCIAR | sem regime `REVIEW`/`APPROVED` (409 `ESTABELECIMENTO_COM_REGIME_ATIVO`); regimes `DRAFT`/`REJECTED` recebem `deleted_at` na mesma transação |

Empresa (`EmpresasService`): criar (`razaoSocial`, `cnpjRaiz`; 409 `CNPJ_RAIZ_DUPLICADO`); editar razão social
(`versao`); remover só sem estabelecimento não removido (409 `EMPRESA_COM_ESTABELECIMENTOS`). `cnpj_raiz`
imutável.

Regime (`RegimesService`; todas as operações fazem, como primeira instrução de trava, `SELECT id FROM
estabelecimentos WHERE id = $1 AND deleted_at IS NULL FOR NO KEY UPDATE`; `empresa_id` vem dessa linha):

| Ação | De → Para | Permissão | Regras |
|---|---|---|---|
| criar | — → DRAFT | GERENCIAR | estabelecimento não removido e não SUSPENDED (409 `TRANSICAO_INVALIDA`) |
| editar (crt, vigências, justificativa) | DRAFT/REJECTED → DRAFT | GERENCIAR | `versao` |
| submeter | DRAFT → REVIEW | GERENCIAR | `classificarSobreposicao` (abaixo): `sobreposto` → 409 `REGIME_SOBREPOSTO` com `{ conflito: { crt, vigenciaInicio, vigenciaFim, situacao } }`; `troca` sem `confirmarTroca` → 409 `TROCA_REGIME_CONFIRMACAO_NECESSARIA` com `{ regimeAtual: { crt, vigenciaInicio }, fimProposto }`, sem mutação; `troca` com `confirmarTroca: true` → REVIEW e `substitui_regime_id` |
| aprovar | REVIEW → APPROVED | APROVAR | segregação; estabelecimento `APPROVED` (422 `ESTABELECIMENTO_NAO_APROVADO`); reclassifica sob a trava; se `troca`, a anterior deve continuar `APPROVED` e aberta com início < D, recebe `vigencia_fim = D − 1` (UPDATE `NULL → valor`, auditado); divergência → 409 `REGIME_SOBREPOSTO` |
| rejeitar | REVIEW → REJECTED | APROVAR | segregação; `motivo_rejeicao` |
| remover | DRAFT/REJECTED → soft delete | GERENCIAR | — |

Regime `APPROVED` é imutável, exceto `vigencia_fim` `NULL → valor` pela troca.

Função pura `classificarSobreposicao(nova, existentes)` em `regimes-vigencia.ts` (existentes = versões não
removidas `REVIEW`/`APPROVED` do estabelecimento, exceto a própria): intervalos fechados `[inicio, fim ?? +∞]`.
Sem interseção → `{ tipo: 'livre' }`. Interseção única com uma `APPROVED` de `fim = null` e `inicio <
nova.inicio` → `{ tipo: 'troca', regimeAtual, fimProposto: diaAnterior(nova.inicio) }`. Qualquer outra
interseção → `{ tipo: 'sobreposto', conflito }`. `diaAnterior` usa aritmética UTC sobre `YYYY-MM-DD`.

Exportados pelo módulo para domínios adjacentes (D15/D16): `EmpresasService.empresaAtiva(db, empresaId)`,
`EmpresasService.listarEmpresasAtivasIds(db)`, `EstabelecimentosService.dadosFiscaisVigentes(db,
estabelecimentoId, dataIso)` → `{ cnpj, inscricaoEstadual, uf, crt } | null`.

## 7. Endpoints (controllers `@Controller('fiscal')`, `JwtAuthGuard` + `RbacGuard`, padrão `fornecedores.controller.ts`)

| Verbo e caminho | Permissão | DTO (Zod) | Resposta |
|---|---|---|---|
| GET `/fiscal/empresas` | LER | `listarEmpresasQuery` {search?, page, pageSize ≤ 100} | paginado |
| POST `/fiscal/empresas` | GERENCIAR | `criarEmpresaSchema` {razaoSocial 1–150, cnpjRaiz `^[0-9A-Z]{8}$` após normalizar, justificativa} | 201 |
| PATCH `/fiscal/empresas/:id` | GERENCIAR | `editarEmpresaSchema` {razaoSocial, versao, justificativa}.strict() | 200 |
| DELETE `/fiscal/empresas/:id` | GERENCIAR | `justificativaSchema` (body) | 200 |
| GET `/fiscal/estabelecimentos` | LER | `listarEstabelecimentosQuery` {empresaId?, estabelecimentoId?, situacao?, search?, sort ∈ estabelecimento·cnpj·regime·uf·empresa, dir, page, pageSize=20} | paginado com regime vigente |
| GET `/fiscal/estabelecimentos/contagens` | LER | mesmo filtro | {total, emRevisao, suspensos} |
| GET `/fiscal/estabelecimentos/exportacao` | LER | mesmo filtro | `text/csv; charset=utf-8`, `;`, BOM, colunas do grid com rótulos, sem ids |
| GET `/fiscal/estabelecimentos/:id` | LER | uuid | detalhe + empresa + regimes + responsável (nome) |
| GET `/fiscal/estabelecimentos/:id/historico` | LER | uuid | lista {objeto: empresa·estabelecimento·regime, operacao, situacaoAnterior, situacaoNova, usuarioNome, criadoEm, justificativa} |
| GET `/fiscal/estabelecimentos/:id/pre-condicoes` | LER | uuid | lista {codigo, atendida} (ESTABELECIMENTO_APROVADO, REGIME_VIGENTE_APROVADO, MUNICIPIO_DISPONIVEL=false, CNAE_DISPONIVEL=false, CERTIFICADO_DISPONIVEL=false) |
| POST `/fiscal/estabelecimentos` | GERENCIAR | `criarEstabelecimentoSchema` {empresaId uuid, nome 1–120, cnpj (normalizado + DV), inscricaoEstadual, inscricaoMunicipal (normalizados `^[0-9A-Z]{1,20}$`), uf ∈ `UFS_BRASIL`, justificativa} | 201 |
| PATCH `/fiscal/estabelecimentos/:id` | GERENCIAR | `editarEstabelecimentoSchema` {nome?, inscricaoEstadual?, inscricaoMunicipal?, uf?, versao, justificativa}.strict() | 200 |
| POST `/fiscal/estabelecimentos/:id/{submeter·reativar}` | GERENCIAR | `acaoSchema` {versao, justificativa} | 200 |
| POST `/fiscal/estabelecimentos/:id/{aprovar·rejeitar·suspender}` | APROVAR | `acaoSchema` | 200 |
| DELETE `/fiscal/estabelecimentos/:id` | GERENCIAR | `justificativaSchema` | 200 |
| POST `/fiscal/estabelecimentos/:id/regimes` | GERENCIAR | `criarRegimeSchema` {crt ∈ CODIGOS_CRT, vigenciaInicio ISO, vigenciaFim? ISO ≥ início, justificativa}.strict() | 201 |
| PATCH `/fiscal/estabelecimentos/:id/regimes/:regimeId` | GERENCIAR | `editarRegimeSchema` {crt?, vigenciaInicio?, vigenciaFim?, versao, justificativa}.strict() | 200 |
| POST `/fiscal/estabelecimentos/:id/regimes/:regimeId/submeter` | GERENCIAR | `submeterRegimeSchema` {versao, justificativa, confirmarTroca?: boolean} | 200 / 409 challenge |
| POST `/fiscal/estabelecimentos/:id/regimes/:regimeId/{aprovar·rejeitar}` | APROVAR | `acaoSchema` | 200 |
| DELETE `/fiscal/estabelecimentos/:id/regimes/:regimeId` | GERENCIAR | `justificativaSchema` | 200 |

Regras comuns: `justificativa` = string `trim` 3–500; `:regimeId` de outro estabelecimento → 404; filtro
`estabelecimentoId` de empresa diferente de `empresaId` → 422 `ESTABELECIMENTO_DE_OUTRA_EMPRESA` (MATRIZ-UX L7);
corpo de erro `{ message, codigo, ...dados }` lançado como objeto nas exceptions Nest (padrão do challenge AD-05);
nenhum 5xx expõe SQL ou stack.

## 8. Eventos pós-commit e tempo real

- `realtime/events/eventos.ts`: `EMPRESA_FISCAL_ALTERADA: 'empresa_fiscal_alterada'`,
  `ESTABELECIMENTO_FISCAL_ALTERADO: 'estabelecimento_fiscal_alterado'`,
  `REGIME_TRIBUTARIO_ALTERADO: 'regime_tributario_alterado'`; payload `CadastroFiscalAlteradoPayload =
  { empresaId: string; estabelecimentoId?: string; regimeId?: string; acao: 'criado'|'atualizado'|'submetido'|
  'aprovado'|'rejeitado'|'suspenso'|'reativado'|'removido'; situacao?: string }`, registrado em `PayloadPorEvento`.
- Emissão: `this.eventEmitter.emit(...)` somente depois de `db.transaction(...)` resolver (padrão
  `precos.service.ts` L282–L284). Troca de regime emite dois `regime_tributario_alterado` (anterior `atualizado`,
  nova `aprovado`).
- `realtime/room-permissoes.ts` (novo): `ROOMS_PROTEGIDAS: Readonly<Record<string, Permissao>> =
  { 'fiscal-empresas': 'FISCAL_EMPRESAS_LER' }`; `permissaoParaRoom(room)` = entrada protegida ou
  `'DISPONIBILIDADE_LER'` (legado inalterado).
- `realtime.gateway.ts`: `podeAssinar(ws, room)` usa `permissaoParaRoom(room)`; novo `broadcastRoom(room, evento,
  payload)` lança erro se `room ∉ ROOMS_PROTEGIDAS` e, antes de enviar, remove da room socket cujo `user.exp`
  (segundos) já passou; três `@OnEvent` publicam em `fiscal-empresas` via `broadcastRoom`. `broadcast` por
  `roomsDaData` permanece inalterado. `RealtimeHub` ganha `remover(socket, room)`.

## 9. RBAC, seed e parâmetro provisório

- `common/rbac/permissoes.ts`: três chaves em `PERMISSOES` (após `OCORRENCIA_PRECO_CIENTE`, L100), descrições em
  `DESCRICOES_PERMISSOES` ("Consultar empresas, estabelecimentos e regimes", "Cadastrar, editar, submeter e
  remover empresas, estabelecimentos e regimes", "Aprovar, rejeitar e suspender cadastros e regimes fiscais") e
  `pushPermissoes('administrador', 'FISCAL_EMPRESAS_LER', 'FISCAL_EMPRESAS_GERENCIAR', 'FISCAL_EMPRESAS_APROVAR')`
  com comentário citando AD-04/AD-18 (5)/H-E01-02. Não entram em `LEITURA_CADASTROS`.
- `perfil-permissoes.snapshot.json` regenerado (somente a lista do administrador muda).
- `database/seed.ts` `PARAMETROS_SEED`: `{ chave: 'fiscal.empresas_perfis_autorizados', descricao: 'Perfis com
  acesso ao cadastro fiscal de empresas', valorJson: { grupo: 'Fiscal', tipo: 'info', titulo: 'Perfis do
  cadastro fiscal de empresas', texto: 'Somente administrador até decisão sobre os demais perfis.', valor:
  ['administrador'], provisorio: true, pendencia: 'H-E01-02' } }`. A tela mostra `BadgeProvisorio codigo="H-E01-02"`
  enquanto `provisorio === true` (leitura via BFF existente `/api/admin/parametros/chave/[chave]`).
- Menus: nenhuma alteração em `menus-canonicos.ts`, `perfil-menus.snapshot.json`, `menu-v2.ts` ou
  `app-sidebar.tsx` (39 rotas preservadas).

## 10. Componente de tela DS v3 (`components/fiscal/empresas/`)

Arquivos: `empresas-estabelecimentos-client.tsx` (página-cliente; props `podeLer`, `podeGerenciar`, `podeAprovar`),
`estabelecimento-drawer.tsx`, `empresa-dialog.tsx`, `regime-dialog.tsx`, `decisao-dialog.tsx`,
`abas-detalhe.tsx`. Componentes DS existentes: `PageHeader`, `KpiStrip`/`Kpi`, `Table`, `Tabs` (com `temErro`,
AD-12), `ComboboxField`, `DatePickerField`, `Sheet`/`Drawer`, `AlertDialog`, `StatusPill`, `EmptyState`,
`Skeleton`, `BadgeProvisorio`, `sonner`. Sem hex avulso (Princípio I.4).

- Hero: título; subtítulo do catálogo; ações "Exportar", "+ Novo registro" (drawer de estabelecimento, só
  `podeGerenciar`), "Ações do processo ▾" (drawer com os três comandos — cadastrar empresa e filial, ativar regime
  por vigência, aprovar alteração — cada um com "Abrir decisão →" para o diálogo real).
- KPIs: "Estabelecimentos" (total), "Em revisão" (hint "Exigem decisão humana"), "Suspensos".
- Card "Registros e consultas": toolbar com busca ("Pesquisar descrição ou referência de negócio"), filtros
  Empresa (combo com busca), Estabelecimento (combo dependente, desabilitado sem empresa, limpo ao trocar),
  Situação (enum), "Exportar visão"; grid conforme §4; clique/Enter na linha seleciona; paginação server-side;
  filtros/ordenação preservados no `sessionStorage`; estado vazio com texto de renderTable L172.
- Card "Detalhamento e execução" — 7 abas:
  1. Ficha e campos: Empresa, Razão social, CNPJ (máscara `AA.AAA.AAA/AAAA-DD`), Estabelecimento, Inscrição
     estadual, Inscrição municipal, Estado, Município · CNAE · Certificado vinculado (combos desabilitados,
     `emptyText` = aplicacao.js L487, `BadgeProvisorio codigo="H-E01-04"`), Regime tributário, Início/Fim de
     vigência (do regime vigente), Situação; seção "Trilha e responsabilização" (Empresa, Situação, Responsável);
     botões "Editar versão", "Validar pré-condições" (GET pré-condições, lista atendida/pendente), "Consultar
     histórico".
  2. Movimentações: trilha Preparação → Verificação → Autorização → Conclusão destacada pela situação; tabela de
     versões de regime (Regime tributário, Início de vigência, Fim de vigência, Situação, Responsável) com ações
     "Nova versão de regime", "Submeter", "Aprovar", "Rejeitar", "Remover" conforme situação e permissão.
  3. Regras e validações: texto de regras do catálogo + caminho de aprovação (aplicacao.js L198).
  4. Exceções: "CNPJ rejeitado", "Troca de regime", "Competência bloqueada" com a ação descrita em L203.
  5. Histórico: linha do tempo do GET histórico (ação, quando, quem, justificativa); rótulos no frontend.
  6. Integrações: blocos de L214–L217; botões desabilitados (§4).
  7. Aceite e testes: lista de critérios L224–L231 em leitura + referência Campos/Ações/Regras/Exceções.
- Drawer de estabelecimento (L427): Empresa (combo + "Nova empresa" só com `podeGerenciar`, abre
  `empresa-dialog`), Razão social (leitura da empresa), CNPJ (máscara alfanumérica, `maxLength` 18), Nome do
  estabelecimento, IE, IM, Estado (27 UFs), Município/CNAE/Certificado desabilitados, "Motivo da alteração *";
  botões "Cancelar", "Verificar dados" (valida localmente obrigatórios e formato, sem gravar), "Salvar rascunho".
  Erros por campo via `useErrosCampo`/`extrairErrosPorCampo` (AD-12). Voltar com alteração pendente pede
  confirmação.
- Diálogo de regime: Regime tributário (enum CRT com rótulos D5), Início de vigência, Fim de vigência,
  "Motivo da alteração *"; ao submeter, 409 `TROCA_REGIME_CONFIRMACAO_NECESSARIA` abre confirmação "Encerrar o
  regime atual em <fimProposto> e submeter a troca?" e reenvia com `confirmarTroca: true`; 409
  `REGIME_SOBREPOSTO` mostra o conflito.
- Diálogo de decisão (L495): título da ação, detalhe, "Justificativa *", confirmar; 422 `SEGREGACAO_FUNCAO` →
  "A aprovação deve ser feita por usuário diferente de quem submeteu."
- Estados: inicial, carregando (skeleton), sem registros, validação inválida, sem acesso (sem `podeLer`: mensagem
  e nenhuma chamada), conflito concorrente (409 `CONFLITO_CONCORRENTE` → "O registro foi alterado por outro
  usuário. Recarregue para continuar." + recarregar), serviço indisponível (erro de rede/5xx com "Tentar
  novamente"), revisão pendente (pill "Aguardando revisão"), concluído (toast com a ação).
- Tempo real: `conectarRealtime({ rooms: ['fiscal-empresas'], onMessage, onReconnect })`; mensagens dos três
  eventos refazem a lista e o detalhe selecionado; sem polling.
- Rótulos: `lib/fiscal-empresas.ts` (`ROTULOS_CRT`, `ROTULOS_SITUACAO`, `ROTULOS_ACAO_HISTORICO`,
  `mascararCnpjAlfanumerico`, `normalizarCnpj`, cliente HTTP das rotas BFF).

## 11. Auditoria (Princípio IV)

Cada mutação chama `AuditoriaService.registrar(tx, …)` na mesma transação: `tabela` física, `registroId`,
`operacao` (`INSERT` criação; `UPDATE` edição e encerramento de vigência na troca; `ACAO_MANUAL` submeter,
aprovar, rejeitar, suspender, reativar; `DELETE` soft delete), `modulo: 'fiscal.empresas'`, `usuarioId`,
`dadosAnteriores`/`dadosNovos` (linhas completas; não há segredo nestas tabelas) e `justificativa`. O histórico
lê `auditoria` por `(tabela, registro_id)` do estabelecimento, da empresa e dos regimes, com join em `usuarios`
para o nome, e devolve `objeto` (empresa·estabelecimento·regime), nunca o nome da tabela.

## 12. Estrutura de arquivos (ownership exclusivo desta fatia)

Backend (`app/backend/`): `src/database/schema/fiscal-empresas.schema.ts` (novo); `src/database/schema/index.ts`
(export); `src/database/migrations/<gerada>.sql` + `meta/*` (gerados); `src/database/migrations/ROLLBACK.md`
(seção E01-T01); `src/database/seed.ts` (parâmetro); `src/common/validators/cnpj-alfanumerico.ts` (novo);
`src/common/rbac/permissoes.ts` e `perfil-permissoes.snapshot.json`; `src/modules/erp/fiscal/empresas/**`
(module, `empresas.controller.ts`, `estabelecimentos.controller.ts`, `empresas.service.ts`,
`estabelecimentos.service.ts`, `regimes.service.ts`, `regimes-vigencia.ts`, `exportacao-csv.ts`, `dto/*.ts`);
`src/app.module.ts` (import); `src/realtime/room-permissoes.ts` (novo), `realtime.gateway.ts`, `realtime.hub.ts`,
`events/eventos.ts`; `test/helpers/test-app.ts` (TRUNCATE das três tabelas antes de `auditoria`);
`test/unit/{cnpj-alfanumerico,fiscal-empresas-dto,regimes-vigencia,room-permissoes,realtime-gateway-rooms}.spec.ts`;
`test/integration/e01-t01-{migrations,empresas,regimes,concorrencia,eventos}.e2e-spec.ts`.
Frontend (`app/frontend/`): `src/lib/fiscal-empresas.ts`; `src/components/fiscal/empresas/*.tsx`;
`src/app/api/erp/fiscal/**/route.ts`; `__tests__/{fiscal-empresas-lib,bff-e01-t01,empresas-estabelecimentos-client}.test.ts(x)`.
Proibido tocar fora desta lista.

## 13. Mapa DoD → teste (1:1)

| Critério (fonte) | Teste (arquivo · nome) |
|---|---|
| DoD (1) CRUD/consultas/ações (Caderno B L57) | e01-t01-empresas · "empresa: criar, editar, listar, remover sem estabelecimentos"; "estabelecimento: ciclo DRAFT→REVIEW→APPROVED→REVIEW(edição)→APPROVED→SUSPENDED→REVIEW"; "rejeitar e editar volta a DRAFT"; e01-t01-regimes · "regime: criar, editar, submeter, aprovar, rejeitar, remover" |
| DoD (2) campos e validações | cnpj-alfanumerico · tabela com vetores numéricos válidos/inválidos, vetor alfanumérico oficial da RFB (Task 1) e minúsculas normalizadas; fiscal-empresas-dto · "IE/IM normalizados", "UF fora das 27 → erro", "CRT 5 → erro", "fim < início → erro", "strict rejeita empresaId/cnpj no PATCH", "justificativa vazia → erro"; e01-t01-empresas · "raiz divergente → 422 CNPJ_RAIZ_DIVERGENTE"; "CNPJ duplicado → 409"; "CNPJ raiz duplicado → 409" |
| DoD (3) dados corretos ao recarregar | e01-t01-empresas · "GET detalhe após cada transição devolve situação, responsável e regime vigente persistidos" |
| DoD (4) autorização e aprovação | e01-t01-empresas · "perfil gestor sem FISCAL_* → 403 em GET/POST/PATCH/DELETE e ações"; "aprovar pelo mesmo usuário que submeteu → 422 SEGREGACAO_FUNCAO"; "segundo administrador aprova → 200"; perfil-permissoes-snapshot (existente) |
| DoD (5) falha externa sintética | não se aplica: a fatia não chama serviço externo (certificado e catálogos fora, §0); registrado no relatório |
| DoD (6) trilha de auditoria/reversão | e01-t01-empresas · "cada mutação grava 1 linha de auditoria com justificativa e usuário"; "histórico não expõe nome de tabela nem id"; "aprovado não é removível → 409; suspender é a reversão" |
| DoD (7) Playwright e acessibilidade | E01-T01b (bloqueada por H-E01-01); nesta fatia: empresas-estabelecimentos-client · "controles com nome acessível (getByRole/getByLabelText)", "navegação por teclado seleciona linha com Enter" |
| DoD (8) interoperabilidade sem regressão | e01-t01-empresas · "dadosFiscaisVigentes: null sem aprovação; valor com estabelecimento e regime aprovados"; "empresaAtiva/listarEmpresasAtivasIds"; suíte completa backend/frontend verde; `git diff` sem `menus-canonicos.ts` |
| Regra: não admitir empresa sem identificação | fiscal-empresas-dto · "sem CNPJ/razão social → erro"; e01-t01-migrations · "CHECK de formato e preenchimento" |
| Regra: regime sobreposto (L55) | regimes-vigencia · tabela livre/troca/sobreposto/limites inclusivos; e01-t01-regimes · "sobreposição com REVIEW → 409 REGIME_SOBREPOSTO" |
| Negativo: troca de regime (L56) | e01-t01-regimes · "troca sem confirmação → 409 sem mutação (contagem e versao inalteradas)"; "troca confirmada aprovada fecha anterior em D−1 na mesma transação"; "aprovar regime com estabelecimento não aprovado → 422" |
| Negativo: competência bloqueada | H-E01-05 (sem fonte de fechamento) |
| D-E01 / tenant | e01-t01-migrations · "uq_estabelecimentos_id_empresa existe e é não parcial (pg_constraint)"; "INSERT de regime com empresa_id diferente da do estabelecimento → 23503"; "substitui_regime_id de outro estabelecimento → 23503"; e01-t01-empresas · "filtro estabelecimentoId de outra empresa → 422"; "regimeId de outro estabelecimento → 404" |
| Imutabilidade de colunas-alvo | e01-t01-empresas · "nenhum caminho do serviço altera id/empresa_id/cnpj/cnpj_raiz (PATCH com esses campos → 400; linha inalterada)" |
| Concorrência (Backlog L40) | e01-t01-concorrencia · "2 POST mesmo CNPJ → [201,409]"; "2 PATCH mesma versao → [200,409 CONFLITO_CONCORRENTE]"; "2 submissões sobrepostas → [200,409]"; "2 aprovações de versões sobrepostas → exatamente 1 APPROVED e nenhum par APPROVED sobreposto"; "aprovar × suspender estabelecimento → um vence, outro 409" |
| Eventos pós-commit (Princípio VI) | e01-t01-eventos · "evento emitido 1 vez depois do commit"; "409/422 não emitem evento"; "troca emite dois eventos" |
| Room protegida | room-permissoes · "fiscal-empresas → FISCAL_EMPRESAS_LER; outra room → DISPONIBILIDADE_LER"; realtime-gateway-rooms · "assina com permissão", "sem permissão não entra", "rooms legadas inalteradas", "broadcastRoom de room não registrada lança erro", "socket com exp vencido é removido antes do envio", "toda room passada a broadcastRoom está em ROOMS_PROTEGIDAS" |
| UX: estados e cascata (MATRIZ-UX L7, L10) | empresas-estabelecimentos-client · "carregando/vazio/erro com retry/sem acesso"; "trocar empresa limpa estabelecimento"; "409 CONFLITO_CONCORRENTE mostra mensagem e recarrega"; "challenge de troca abre confirmação e reenvia com confirmarTroca"; "Município/CNAE/Certificado desabilitados com badge"; "nenhum UUID renderizado (regex no container)"; "mensagem WS refaz a lista" |
| BFF | bff-e01-t01 · "repassa status e corpo de 409/422"; "exportação mantém text/csv"; "ação fora da allowlist → 404 sem chamar backend" |
| Cobertura ≥ 80% (constituição L63) | `npm run test:cov` + `scripts/check-coverage.mjs --min 80` |

## 14. Tasks

Comandos a partir de `F:\Projetos\AlphaCarnes\.worktrees\e01-t01`. Banco de teste dedicado (os testes truncam):

```powershell
docker compose up -d postgres
docker compose exec postgres psql -U alphacarnes -d alphacarnes -c "CREATE DATABASE alphacarnes_e01"
$env:DATABASE_URL = 'postgres://alphacarnes:alphacarnes@localhost:15433/alphacarnes_e01'
```
Saída esperada: `CREATE DATABASE` (ou erro "already exists", aceitável). Cada task segue TDD: escrever o teste,
ver falhar, implementar, ver passar, commitar só os paths da task (`git add <paths>`).

### Task 0 — Context7 e leitura obrigatória (sem commit)
1. Context7: `resolve-library-id` para "NestJS", "Drizzle ORM" e "Next.js"; `get-library-docs` com os tópicos
   "exception filters and HttpException object response" (NestJS 11), "foreignKey composite, unique, date mode
   string, select for no key update, transactions" (Drizzle 0.45) e "route handlers, NextResponse streaming
   text/csv" (Next 16). Anotar no relatório do PR as APIs usadas.
2. Ler: §4 (cada linha citada do protótipo), `fornecedores.controller.ts`/`.service.ts`, `precos.service.ts`
   L240–L300, `realtime.gateway.ts`, `bff.ts`, `fornecedores-client.tsx`, `badge-provisorio.tsx`,
   `combobox-field.tsx`, `date-picker-field.tsx`, `use-erros-campo.ts` e o challenge 409 de overbooking:
   `Get-ChildItem app/backend/src -Recurse -Filter *.ts | Select-String 'OVERBOOKING_CONFIRMACAO_NECESSARIA'`.
3. `web_fetch` da página RFB de doc 20 L64; extrair o algoritmo de DV alfanumérico e um exemplo oficial para a
   Task 1. Sem exemplo oficial acessível → critério de parada §17.

### Task 1 — Validador de CNPJ alfanumérico
Files: `app/backend/src/common/validators/cnpj-alfanumerico.ts`, `app/backend/test/unit/cnpj-alfanumerico.spec.ts`.
Interface: `normalizarCnpj(v: string): string` (remove `.`, `/`, `-`, espaços; maiúsculas);
`validarCnpjAlfanumerico(v: string): boolean` (14 chars `^[0-9A-Z]{12}[0-9]{2}$`, rejeita 14 caracteres iguais,
valor do caractere = código ASCII − 48, pesos 2..9 cíclicos da direita, DV = resto < 2 ? 0 : 11 − resto —
conferir com a página RFB da Task 0); `raizCnpj(v)` = 8 primeiros. `documento-fiscal.ts` não muda.
```powershell
Set-Location app/backend; npx jest test/unit/cnpj-alfanumerico.spec.ts
```
Esperado: `Tests: N passed, N total`. Commit: `feat(e01-t01): validador de CNPJ alfanumérico com DV`.

### Task 2 — Schema, migration e testes de banco
Files: schema §5, `index.ts`, migration gerada, `ROLLBACK.md`, `test/helpers/test-app.ts`,
`test/integration/e01-t01-migrations.e2e-spec.ts`.
```powershell
Set-Location app/backend
npx drizzle-kit generate --name e01_t01_empresas_estabelecimentos
Select-String -Path src/database/migrations/*e01_t01*.sql -Pattern 'ALTER TABLE "(?!empresas|estabelecimentos|regimes_tributarios)'
npm run db:migrate
npx jest test/integration/e01-t01-migrations.e2e-spec.ts
```
Esperado: um arquivo SQL novo; `Select-String` sem saída; migrate sem erro; testes passam (constraints de §13).
`ROLLBACK.md`: seção "E01-T01" listando os três objetos e o procedimento de §16. Commit:
`feat(e01-t01): schema de empresas, estabelecimentos e regimes tributários (expand-only)`.

### Task 3 — Permissões, snapshot e parâmetro provisório
Files: `permissoes.ts`, `perfil-permissoes.snapshot.json`, `seed.ts`.
Regenerar o snapshot a partir de `MAPA_PERFIL_PERMISSOES` (lista ordenada e sem duplicatas, formato do arquivo
atual) e conferir que só a chave `administrador` mudou:
```powershell
Set-Location app/backend; git diff --stat -- src/common/rbac/perfil-permissoes.snapshot.json
npx jest test/unit/perfil-permissoes-snapshot.spec.ts
npm run db:seed
```
Esperado: 1 arquivo de snapshot alterado; testes passam; seed sem erro. Commit:
`feat(e01-t01): permissões FISCAL_EMPRESAS_* (administrador) e parâmetro provisório H-E01-02`.

### Task 4 — DTOs Zod
Files: `src/modules/erp/fiscal/empresas/dto/{empresa,estabelecimento,regime,comum}.dto.ts`,
`test/unit/fiscal-empresas-dto.spec.ts`. Regras de §7; `cnpj` com `.transform(normalizarCnpj).refine(
validarCnpjAlfanumerico, { message: 'CNPJ inválido: confira os dígitos verificadores.' })`; `uf` com
`ufBrasilSchema` (`dominios.dto.ts` L12); datas `z.iso.date()`.
```powershell
Set-Location app/backend; npx jest test/unit/fiscal-empresas-dto.spec.ts
```
Commit: `feat(e01-t01): DTOs Zod de empresas, estabelecimentos e regimes`.

### Task 5 — Empresas e estabelecimentos (service, controller, módulo, auditoria, eventos)
Files: `empresas.service.ts`, `estabelecimentos.service.ts`, `empresas.controller.ts`,
`estabelecimentos.controller.ts`, `empresas-fiscais.module.ts`, `app.module.ts`, `events/eventos.ts`,
`test/integration/e01-t01-empresas.e2e-spec.ts`. Regras de §6, §7, §11; captura de `23505` pelo nome da
constraint (padrão `clientes.service.ts` L33); UPDATE com `WHERE id = $1 AND versao = $2 AND deleted_at IS NULL`
e `versao = versao + 1`, `updated_at = now()`; zero linhas → 409 `CONFLITO_CONCORRENTE` (ou 404 se não existe).
Listagem com `LEFT JOIN LATERAL` do regime vigente (D10). Usuários de teste: `createTestUser(app, { perfil:
'administrador' })` duas vezes (segregação) e `{ perfil: 'gestor' }` (403).
```powershell
Set-Location app/backend; npx jest test/integration/e01-t01-empresas.e2e-spec.ts
```
Commit: `feat(e01-t01): API de empresas e estabelecimentos com aprovação segregada e auditoria`.

### Task 6 — Regimes tributários
Files: `regimes-vigencia.ts`, `regimes.service.ts`, rotas de regime em `estabelecimentos.controller.ts`,
`test/unit/regimes-vigencia.spec.ts`, `test/integration/e01-t01-regimes.e2e-spec.ts`. Trava `.for('no key
update')` como primeira instrução; challenge 409 sem nenhuma escrita; troca na aprovação.
```powershell
Set-Location app/backend; npx jest test/unit/regimes-vigencia.spec.ts test/integration/e01-t01-regimes.e2e-spec.ts
```
Commit: `feat(e01-t01): regimes tributários por vigência com troca confirmada e sem sobreposição`.

### Task 7 — Concorrência e eventos
Files: `test/integration/e01-t01-concorrencia.e2e-spec.ts`, `test/integration/e01-t01-eventos.e2e-spec.ts`
(requisições simultâneas com `Promise.all` de `supertest`; espião em `EventEmitter2.emit` resolvido do app).
Correções de serviço que os testes exigirem ficam nos arquivos da Task 5/6.
```powershell
Set-Location app/backend; npx jest test/integration/e01-t01-concorrencia.e2e-spec.ts test/integration/e01-t01-eventos.e2e-spec.ts
```
Commit: `test(e01-t01): concorrência e eventos pós-commit do cadastro fiscal`.

### Task 8 — Room protegida no gateway
Files: `room-permissoes.ts`, `realtime.gateway.ts`, `realtime.hub.ts`, `test/unit/room-permissoes.spec.ts`,
`test/unit/realtime-gateway-rooms.spec.ts` (sockets falsos `RealtimeSocket` com `user`).
```powershell
Set-Location app/backend; npx jest test/unit/room-permissoes.spec.ts test/unit/realtime-gateway-rooms.spec.ts
npx jest test/unit --testPathPattern realtime
```
Esperado: novos e existentes de realtime passam. Commit:
`feat(e01-t01): room fiscal-empresas protegida por permissão (contrato E12 §3.13.6)`.

### Task 9 — Exportação, histórico, pré-condições e leitura fiscal
Files: `exportacao-csv.ts`, funções e rotas correspondentes, casos novos em `e01-t01-empresas.e2e-spec.ts`.
```powershell
Set-Location app/backend; npx jest test/integration/e01-t01-empresas.e2e-spec.ts
```
Commit: `feat(e01-t01): exportação, histórico, pré-condições e leitura fiscal fail-closed`.

### Task 10 — BFF `/api/erp/fiscal`
Files: `app/frontend/src/app/api/erp/fiscal/empresas/route.ts`, `empresas/[id]/route.ts`,
`estabelecimentos/route.ts`, `estabelecimentos/contagens/route.ts`, `estabelecimentos/exportacao/route.ts`,
`estabelecimentos/[id]/route.ts`, `estabelecimentos/[id]/[acao]/route.ts` (allowlist submeter·aprovar·
rejeitar·suspender·reativar·historico·pre-condicoes; demais → 404), `estabelecimentos/[id]/regimes/route.ts`,
`estabelecimentos/[id]/regimes/[regimeId]/route.ts`, `estabelecimentos/[id]/regimes/[regimeId]/[acao]/route.ts`
(allowlist submeter·aprovar·rejeitar); `__tests__/bff-e01-t01.test.ts`. JSON via `repassar` (`lib/bff.ts`);
CSV via `apiFetch` preservando `Content-Type` e `Content-Disposition`.
```powershell
Set-Location app/frontend; npx jest __tests__/bff-e01-t01.test.ts
```
Commit: `feat(e01-t01): rotas BFF /api/erp/fiscal`.

### Task 11 — Componente de tela
Files: `src/lib/fiscal-empresas.ts`, `src/components/fiscal/empresas/*.tsx`,
`__tests__/fiscal-empresas-lib.test.ts`, `__tests__/empresas-estabelecimentos-client.test.tsx` (fetch e
`conectarRealtime` mockados). Fidelidade §4/§10.
```powershell
Set-Location app/frontend; npx jest __tests__/fiscal-empresas-lib.test.ts __tests__/empresas-estabelecimentos-client.test.tsx
```
Commit: `feat(e01-t01): tela DS v3 de empresas, estabelecimentos e regime (componente)`.

### Task 12 — Gate local completo e PR
```powershell
npm ci; npm run lint; npm run type-check; npm run test; npm run build
Set-Location app/backend; npm run test:cov
Set-Location ../frontend; npm run test
Set-Location ../..; node scripts/check-coverage.mjs --min 80
git diff --name-only origin/develop...HEAD
```
Esperado: comandos verdes; cobertura ≥ 80% linha e branch (`scripts/check-coverage.mjs`, mesmo passo do
`ci.yml` L97; se o script exigir o resumo em outro caminho, seguir o que o `ci.yml` faz antes dele); lista de
arquivos ⊆ §12 (sem `menus-canonicos.ts`, `menu-v2.ts`, `app-sidebar.tsx`, `docs/execucao/**`). Push com `git push -u origin
feature/erp-e01-t01-empresas-estabelecimentos`; PR para `develop` com título `feat(e01-t01): empresas,
estabelecimentos e regime tributário`, corpo com resumo, comandos/saídas, mapa §13, divergências autorizadas §4,
pendências §18 e "classe de risco: alto (Portão A obrigatório)".

## 15. Gate e evidências para o Portão 2/A
Relatório no formato `pipeline-execucao.md` §7: task a task (desvios = nenhum ou listados), saídas de teste,
cobertura e APIs do Context7 consultadas. Sem rota montada não há screenshot de página nesta fatia: o Portão 2
compara o código do componente com as linhas de §4 e confere a lista de remoções autorizadas; a comparação
visual lado a lado com `index.html#E01-T01` é critério da E01-T01b. Portão A obrigatório (classe alto).

## 16. Rollback
- Código: revert dos commits da fatia por PR (sem force-push).
- Banco: a migration só cria tabelas folha (nenhuma FK de outra tabela aponta para elas até o E12-T01/E06-T01).
  Em desenvolvimento/CI sem dados: remover o schema e gerar a migration de remoção com `drizzle-kit generate`
  (nunca SQL manual). Em ambiente com linhas, não remover: manter as tabelas (expand permanece inerte) e abrir
  decisão do QO. Seed: remover a chave `fiscal.empresas_perfis_autorizados` e as três permissões só junto do
  revert; `perfis_permissoes` é reconstruída pelo seed idempotente.

## 17. Critérios de parada (qualquer um → PARAR e reportar ao coordenador)
- Migration gerada altera tabela existente, exige SQL manual, trigger ou extensão.
- Drizzle-kit não gera a FK composta autorreferente de `regimes_tributarios` ou o `UNIQUE (id, empresa_id)` não
  parcial.
- Página RFB sem algoritmo ou exemplo oficial verificável de DV alfanumérico.
- Teste falha após uma correção; caso não coberto pelo plano; regra que exija decidir produto (CRT por empresa,
  quórum, perfis, rota/menu, fechamento de competência).
- Alteração necessária fora de §12, inclusive menus, `LEITURA_CADASTROS`, `documento-fiscal.ts` ou outra room.
- Conflito com plano E12/E11 aprovado em `develop` (por exemplo, `room-permissoes.ts` já existente com API
  diferente): adotar o arquivo existente se a API for a de §3.13.6; senão parar.

## 18. Pendências humanas (nenhuma decisão inventada)

| ID | Pendência | Dono | Bloqueia | Tratamento até a decisão |
|---|---|---|---|---|
| H-E01-01 | Grupo do item (FISCAL, protótipo, × Cadastros & Regras, ADR-024 L63), slug da rota sem código E## e se a E01-T01b pode criar o grupo FISCAL antes do E10-T04 (B-ESCOPO E10-T04 L559–L562) | Quality Owner | E01-T01b (rota, menu, Playwright) | componente pronto sem rota; 39 rotas intactas |
| H-E01-02 | Quais dos 11 perfis, além do administrador, recebem `FISCAL_EMPRESAS_LER/GERENCIAR/APROVAR` | Quality Owner | atribuição a outros perfis | seed só administrador; parâmetro `provisorio: true` + badge; edição runtime em `/admin/perfis` |
| H-E01-03 | Dados reais (CNPJ, IE, IM, CRT, vigências) dos estabelecimentos; confirmação do domínio CRT e do código 4; regra de validação de IE por UF | Titular + contador | carga real (nenhuma task) | nenhum seed de dado real; IE/IM só normalizados |
| H-E01-04 | Fonte dos catálogos de Município (dataset `MUNICIPIOS` do E12-T08), CNAE (sem dataset em fonte alguma) e vínculo de certificado (E12-T03) | QO + TI (planners E12-T03/T08) | combos Município, CNAE, Certificado | campos desabilitados + badge; sem coluna |
| H-E01-05 | Regra de competência bloqueada (fechamento fiscal) | Contador + planner E09-T08 | exceção "competência bloqueada" | sem bloqueio; E09-T08 acrescenta a verificação no `RegimesService` |

## 19. Fatia seguinte E01-T01b (só após AD de H-E01-01)
Montar `page.tsx` na rota decidida (server component com `getMe()` e permissões, padrão
`cadastros/fornecedores/page.tsx`), entrada de menu conforme a AD (ou pelo E10-T04), e Playwright
`e2e/e01-t01-empresas.spec.ts`: jornada criar empresa → estabelecimento → submeter → aprovar por segundo
administrador → regime → troca confirmada; 403 visual; nenhum UUID ou código E## visível; teclado; screenshots lado
a lado com `index.html#E01-T01`. Plano e Portão 1 próprios.

## 20. Self-review
- Uma fatia, classe alto justificada; nenhuma referência a HEAD, contagem ou lista de SHAs.
- D-E01 atendida (D2, §5, §13); exigências E11 §5.3 (imutabilidade, modos de lock) atendidas (D2, D14).
- Nenhuma regra fiscal, CRT por empresa, perfil, rota ou menu decidido sem fonte; lacunas em §18.
- Cada DoD do Caderno B L57 tem teste ou pendência nomeada (§13).
