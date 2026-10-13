# E01-T01 — Empresas, estabelecimentos, regime e CNAE — Plano de Implementação (fatia E2E, rito AD-22)

> Para workers agênticos: papel `worker` (AGENTS.md "Papéis"). Worktree `.worktrees/e01-t01`, branch
> `feature/erp-e01-t01-empresas-estabelecimentos`, base `origin/develop`. Estado do git é lido por comando no
> momento do uso; este plano não afirma HEAD, contagem de commits nem SHAs (AD-22 (4)).

## Histórico de revisões

| Rev. | Data | Autor | Motivo |
|---|---|---|---|
| r1 | 2026-10-13 | planner | versão inicial; rota, menu e Playwright adiados para E01-T01b (H-E01-01); Município/CNAE/Certificado sem coluna (H-E01-04) |
| r2 | 2026-10-13 | planner (nova instância) | Portão 1 r1 `bloqueado` (3 BLOQUEANTES + 6 MENORES) e decisão do Quality Owner AD-24 (1)–(3) |
| r3 | 2026-10-13 | planner (nova instância) | Portão 1 r2 `ajustar` (2 BLOQUEANTES + 5 MENORES); ajuste cirúrgico (AD-22 (7)): nenhum outro ponto do plano muda |

| Achado r2 | Correção r3 |
|---|---|
| B1 `PerfisService.catalogo()` lança "Permissões sem módulo no catálogo" para `FISCAL_EMPRESAS_*` | `app/backend/src/modules/perfis/perfis.service.ts` entra na §12 e na Task 3: novo módulo `Fiscal` (prefixo `FISCAL_`) em `MODULOS`, após `Expedição e Faturamento`; descrições das 3 permissões em `DESCRICOES_PERMISSOES`; teste de `GET /perfis/catalogo` com o módulo `Fiscal` e as 3 permissões (§9, §13, Task 3) |
| B2 `e2e/shell-ds.spec.ts` fixa 9 grupos do administrador | `shell-ds.spec.ts` entra na lista de testes de contagem da §9, na §12 e na Task 13: `GRUPOS` com `'FISCAL'` na 8ª posição (após `FATURAMENTO`) e título do teste para 10 grupos |
| MENOR 1 comentário de cabeçalho de `menu-v2.ts` | §9: o comentário passa a dizer que item com `permissao` também é filtrado pela permissão |
| MENOR 2 erros do `PUT /cnaes` por estado | §6 (linha "substituir CNAEs") e §13: APPROVED → 409 `ALTERACAO_EXIGIDA`; REVIEW/SUSPENDED → 409 `TRANSICAO_INVALIDA`; teste em `e01-t01-cnaes` |
| MENOR 3 alteração aberta remanescente ao remover estabelecimento | §6 (linha "remover") e §13: soft delete da alteração aberta e dos CNAEs propostos na mesma transação; teste em `e01-t01-alteracoes` |
| MENOR 4 `municipio_ibge_codigo` | §5: `varchar(7)` (a coluna guarda o código IBGE de 7 dígitos; o CHECK de formato permanece) |
| MENOR 5 menu FISCAL atribuído sem a permissão | §9 e §13: teste em `menu-v2` e `menu-rbac` — rota `/fiscal/empresas` em `menus_visiveis` sem `FISCAL_EMPRESAS_LER` não exibe o item nem o grupo |

| Achado r1 | Correção r2 |
|---|---|
| B1 (requires-human) fatia sem rota/menu/Playwright/comparação visual | AD-24 (1): rota `/fiscal/empresas` (page + BFF) nesta fatia; grupo `FISCAL` criado na posição 08 da ADR-ERP-024; item com permissão `FISCAL_EMPRESAS_LER`; 39 rotas preservadas + 1; testes de contagem atualizados; Playwright de jornada e acessibilidade; screenshots app × protótipo (§9, §10, §14 Tasks 12–14). E01-T01b e H-E01-01 removidas |
| B2 (requires-human) Município/CNAE/Certificado sem coluna; aprovação sem eles | AD-24 (2): Município e Certificado opcionais, `BadgeProvisorio`, não bloqueiam aprovação; coluna `municipio_ibge_codigo text null` reservada; certificado sem coluna/FK (E12-T03 acrescenta por expand). AD-24 (3): CNAE manual entregue nesta fatia (§5 `estabelecimento_cnaes`, §6, §7) |
| B3 (corrigível) edição de APPROVED sobrescrevia dados aprovados | Alteração pendente separada (`estabelecimento_alteracoes` + `estabelecimento_alteracao_cnaes`): substitui os valores só na aprovação; rejeição mantém o aprovado; `dadosFiscaisVigentes` continua respondendo durante a revisão (§6, §13) |
| MENOR 1 caminho de `precos.service.ts` | `app/backend/src/modules/comercial/precos/precos.service.ts` (§8, Task 0) |
| MENOR 2 `exp` ausente em `CurrentUserPayload`; API do hub | gateway guarda `AccessTokenPayload` (`token.service.ts`, já tem `exp`); hub ganha `membros(room)` e `remover(socket, room)` (§8) |
| MENOR 3 registrar `onda-e01-t01` no `EXECUCAO-STATUS` | item do Executor (§15); Worker não edita `docs/execucao/` |
| MENOR 4 D15 como contrato proposto | D15 marcada "proposta ao E12-T01 (H-15 do E12-T00)" |
| MENOR 5 regime APPROVED com fim futuro | regra e teste: nunca é encurtado; interseção → 409 `REGIME_SOBREPOSTO` (§6, §13) |
| MENOR 6 checagem expand-only só por `ALTER TABLE` | Task 2 lista todo statement fora da allowlist (`CREATE TABLE`/`CREATE [UNIQUE] INDEX`/`ALTER TABLE <tabela nova> ADD CONSTRAINT`) |

**Goal:** entregar ponta a ponta o cadastro fiscal de empresas e estabelecimentos com CNAE manual, regime
tributário (CRT) versionado por vigência e aprovação segregada: página `/fiscal/empresas` DS v3 no grupo Fiscal →
BFF `/api/erp/fiscal` → NestJS → PostgreSQL → eventos pós-commit em room WS protegida; e cumprir D-E01
(`UNIQUE (id, empresa_id)` em `estabelecimentos` como alvo de FKs compostas de E06/E11/E12).

**Architecture:** módulo Nest `EmpresasFiscaisModule` em `app/backend/src/modules/erp/fiscal/empresas/`
(Caderno B L61); schema Drizzle `fiscal-empresas.schema.ts`; serviços transacionais com auditoria na mesma
transação e `EventEmitter2.emit` depois do commit; mapa room→permissão no gateway (E12 §3.13.6); página App
Router `app/frontend/src/app/(admin)/fiscal/empresas/page.tsx`; BFF `app/frontend/src/app/api/erp/fiscal/**`;
componentes em `app/frontend/src/components/fiscal/empresas/`.

**Tech Stack (constituição L60):** NestJS 11 + TypeScript 5 strict, Next.js 16 App Router, PostgreSQL 18 +
Drizzle ORM 0.45 / drizzle-kit 0.31, Zod 4, WebSocket `ws`, JWT + RBAC 11 perfis, Jest, Playwright. Nenhuma
dependência nova (acessibilidade verificada com APIs nativas do Playwright, sem axe).

**Classe de risco: ALTO** (AD-22 (6)): (1) permissões novas, item de menu novo e autorização de rooms WS —
"RBAC/autorização"; (2) CRT, CNAE e IE vigentes são insumo fiscal direto de E01-T03/T04 e E02 — "fiscal";
(3) `estabelecimentos` é âncora de tenant das FKs compostas (D-E01). Rito completo: revisão crítica por commit,
Portão 2 e Portão A.

---

## 0. Escopo da fatia

Entra:
- Empresas (razão social, CNPJ raiz alfanumérico); estabelecimentos (nome, CNPJ alfanumérico com DV, IE, IM, UF,
  situação com aprovação segregada); CNAEs do estabelecimento (1 principal + 0..n secundárias, manuais);
  alteração pendente de estabelecimento aprovado; versões de regime tributário (CRT, vigência, troca sem
  sobreposição).
- API REST, auditoria, eventos pós-commit, room WS `fiscal-empresas`, exportação CSV, histórico, pré-condições,
  leitura fiscal fail-closed para domínios adjacentes.
- Página `/fiscal/empresas`, grupo de menu `FISCAL` (posição 08 da ADR-ERP-024), item de menu, BFF, componente
  completo (7 abas, estados, diálogos, cascata), Jest/RTL, Playwright de jornada e acessibilidade, screenshots
  comparativos com `docs/prototipos/erp-integrado-v1/index.html#E01-T01`.
- Município e Certificado vinculado: exibidos como opcionais com `BadgeProvisorio`, sem bloquear aprovação
  (AD-24 (2)); coluna `municipio_ibge_codigo` reservada e não gravável pela API nesta fatia.

Sai (com dono, sem inventar):
- Seleção de Município → E12-T08 (catálogo `MUNICIPIOS`) habilita a gravação de `municipio_ibge_codigo`.
- Vínculo de Certificado → E12-T03 acrescenta coluna e FK por expand (não existe tabela de certificados hoje).
- Demais grupos novos da ADR-ERP-024 (Financeiro, Bancos & Tesouraria, Contabilidade) → seus épicos/E10-T04;
  grupo vazio não é criado.
- "Competência bloqueada" → H-E01-05 (não há fechamento de competência; E09-T08).

## 1. Global Constraints

- Constituição: Princípios I (L9), II (L20), III (L24), IV (L28), VI (L36), VII (L40), VIII (L44), X (L52);
  stack fixa (L60); sem over-engineering (L61); cobertura backend ≥ 80% linha e branch (L63).
- AGENTS.md: pwsh 7, nunca bash; worker não edita `docs/execucao/`; integração só por PR com 8 jobs verdes.
- AD-04 (11 perfis); AD-10 (DS v3); AD-12 (validação 400); AD-15 (39 rotas); AD-18 (2) protótipos ERP são
  referência integral e (5) personas não viram perfis; AD-19..AD-22; AD-24 (1)–(3).
- `docs/data/convencoes-schema.md` L11–L34, L62–L73: uuidv7, TIMESTAMPTZ, VARCHAR(n), status TEXT+CHECK, soft
  delete com índices parciais `deleted_at IS NULL`, índice em toda FK. `updated_at` atualizado pelo serviço, sem
  trigger nem SQL manual (padrão da migration 0043).
- UI nunca exibe UUID, PK, código E##/ALP nem nome de tabela (Caderno B L601; MATRIZ-UX L5).

## 2. Decisões fixadas (com fonte)

| # | Decisão | Fonte |
|---|---|---|
| D1 | Nomes físicos `empresas`, `estabelecimentos`, `estabelecimento_cnaes`, `estabelecimento_alteracoes`, `estabelecimento_alteracao_cnaes`, `regimes_tributarios`; `companies`/`establishments` do E12 são conceituais | convencoes-schema L4; E12 §4 L1145 |
| D2 | `estabelecimentos` declara `UNIQUE (id, empresa_id)` não parcial; `id`, `empresa_id`, `cnpj` imutáveis; nunca DELETE físico | E12 D-E01 L1889, §3.13.7; E11 §5.3 L1451, L1470 |
| D3 | CNPJ e CNPJ raiz alfanuméricos (`[0-9A-Z]{12}` + 2 DV numéricos), DV validado no backend | doc 20 L64; doc 22 L37; componentes.js L48 |
| D4 | Raiz do CNPJ do estabelecimento = CNPJ raiz da empresa (422 `CNPJ_RAIZ_DIVERGENTE`) | doc 20 L64; Caderno B L56 |
| D5 | CRT `1` Simples Nacional, `2` Simples Nacional — sublimite, `3` Regime normal, `4` MEI | componentes.js L1710–L1727; Caderno B L11 |
| D6 | Situação do estabelecimento `DRAFT/REVIEW/APPROVED/REJECTED/SUSPENDED`; regime e alteração usam os quatro primeiros | componentes.js L1688–L1709 |
| D7 | Aprovação segregada: quem decide ≠ quem submeteu (422 `SEGREGACAO_FUNCAO`); justificativa obrigatória em toda mutação | MATRIZ-UX L10; aplicacao.js L198, L436, L451, L499 |
| D8 | Regime sem sobreposição entre versões `REVIEW`/`APPROVED`; troca = nova versão com início D posterior ao início da aprovada **aberta** (fim nulo), challenge 409 read-only e, na aprovação, fim da anterior = D − 1; aprovada com fim informado nunca é encurtada | Caderno B L55–L56; AD-05 |
| D9 | Regime só é aprovado com estabelecimento `APPROVED` | Princípio VII |
| D10 | Vigência `date`; decisão `decidido_em` timestamptz; "hoje" fiscal = `(now() AT TIME ZONE 'America/Sao_Paulo')::date` | Caderno B L55; doc 22 L77 |
| D11 | Permissões `FISCAL_EMPRESAS_LER/GERENCIAR/APROVAR` só no `administrador`; demais perfis = H-E01-02 (parâmetro + badge) | AD-04; AD-18 (5); E12 §3.7 |
| D12 | Room WS `fiscal-empresas` exige `FISCAL_EMPRESAS_LER`; `realtime/room-permissoes.ts` criado aqui com a API do E12 §3.13.6 | E12 §3.13.6 L942–L951; Princípio VI |
| D13 | Zod → 400 (AD-12); regra de domínio → 422; estado, unicidade, versão, sobreposição → 409 | AD-12; Caderno B L56 |
| D14 | Concorrência otimista por `versao`; regras de regime, CNAE e alteração serializadas por `SELECT … FOR NO KEY UPDATE` da linha do estabelecimento | MATRIZ-UX L10; E11 §5.3 L1470 |
| D15 | **Contrato proposto ao E12-T01 (H-15 do E12-T00)**, não decisão final: "empresa ativa" = `empresas.deleted_at IS NULL` e ≥ 1 estabelecimento `APPROVED` não removido; o E12-T01 confirma ou ajusta | E12 L938, P5 L724, H-15 L1913 |
| D16 | `dadosFiscaisVigentes` devolve CNPJ/IE/UF/CRT/CNAE principal só com estabelecimento `APPROVED` e regime `APPROVED` vigente; lê os valores aprovados, nunca a alteração pendente; senão `null` | E12 §6.2 L1838; Princípio VII; B3 |
| D17 | Soft delete: estabelecimento só `DRAFT`/`REJECTED` sem regime `REVIEW`/`APPROVED`; empresa só sem estabelecimento; aprovado é suspenso, não removido | convencoes-schema L30–L34; MATRIZ-UX L10 |
| D18 | API Nest sob `/fiscal`; BFF sob `/api/erp/fiscal`; página `/fiscal/empresas` | Caderno B L61; AD-24 (1) |
| D19 | Menu: grupo `FISCAL` na posição 08 (após FATURAMENTO, antes de CADASTROS & REGRAS); item "Empresas, estabelecimentos e regime" (título do catálogo) com `permissao: 'FISCAL_EMPRESAS_LER'`; visível só ao `administrador` (menus_visiveis + permissão) | ADR-ERP-024 §Menu L59 (ordem 01–13); AD-24 (1); catalogo.js L180–L183; D11 |
| D20 | CNAE por **estabelecimento**: o protótipo põe o campo no registro do estabelecimento ("filtrado por empresa/estabelecimento", componentes.js L115–L125) e a RFB registra atividade por CNPJ completo (cada filial tem a sua); empresa sem CNAE próprio | componentes.js L115; AD-24 (3) |
| D21 | CNAE = subclasse 2.x de 7 dígitos; entrada aceita `0000-0/00` ou `0000000`; armazenado só dígitos; exibido com máscara; sem DV e sem consulta externa | AD-24 (3) |
| D22 | Estabelecimento aprovado só é alterado por proposta (`estabelecimento_alteracoes`): no máximo 1 aberta (`DRAFT`/`REVIEW`); aplicada na aprovação; rejeição não toca o aprovado | B3; MATRIZ-UX L10 |
| D23 | Aprovação (do estabelecimento ou da alteração) exige exatamente 1 CNAE principal (422 `CNAE_PRINCIPAL_AUSENTE`); Município e Certificado não são exigidos | AD-24 (2), (3) |

## 3. Conflitos de fonte resolvidos

| # | Conflito | Resolução |
|---|---|---|
| C1 | Grupo FISCAL (protótipo) × "Cadastros & Regras … estabelecimento E01" (ADR-024 L63) | AD-24 (1): grupo Fiscal → D19 |
| C2 | Rota `/erp/fiscal/e01-t01` (catalogo.js L186) × proibição de código na UI | AD-24 (1): `/fiscal/empresas` |
| C3 | 4 UFs demonstrativas (componentes.js L1728) × 27 UFs | dado real (Princípio I.2(b)): `UFS_BRASIL` (`common/dto/dominios.dto.ts` L7; `lib/dominios.ts` L9) |
| C4 | 400 da `ZodValidationPipe` × "validação 422" (Caderno B L56) | D13 |
| C5 | Personas "gestor fiscal, contador" × 11 perfis | AD-04/AD-18 (5) → D11, H-E01-02 |
| C6 | Município/CNAE/Certificado `required: true` no protótipo × AD-24 (2) | AD-24 prevalece (fonte 2 > fonte 4): Município/Certificado opcionais provisórios; CNAE principal exigido na aprovação (D23) |
| C7 | CNAE como `relation` a catálogo (componentes.js L118) × AD-24 (3) sem catálogo | AD-24 prevalece: código + descrição digitados e validados por formato/duplicidade |
| C8 | Menu da `develop` "não muda" (ADR-024 L65) × AD-24 (1) "grupo criado agora" | AD-24 é decisão posterior do QO; 39 rotas intactas |


## 4. Referência do protótipo e fidelidade

Fonte: `docs/prototipos/erp-integrado-v1/` (AD-18 (2)) + DS v3 (AD-10). Uma tela.

| Elemento | Fonte (arquivo:linha) | Implementação real |
|---|---|---|
| Metadados | catalogo.js L180–L193 | título "Empresas, estabelecimentos e regime"; subtítulo = ações + "Acesso típico" com `BadgeProvisorio codigo="H-E01-02"` |
| Campos | componentes.js L15–L189 (empresa L15, razaoSocial L27, cnpj L39/L48, estabelecimento L51, ie L65, im L77, uf L89, municipio L101, cnae L115, crt L127, certificado L139, vigenciaInicio L154, vigenciaFim L166, status L178) | §10 |
| Grid, filtros, estados | componentes.js L2898–L2970; MATRIZ-UX L17–L45 | colunas Estabelecimento · CNPJ · Regime tributário · Estado · Situação · Empresa; ordenação, padrão Estabelecimento; 20/página server-side |
| Cascata empresa → estabelecimento | componentes.js L7899–L7905; MATRIZ-UX L7 | filtro e formulário limpam o filho ao trocar o pai |
| Layout (hero, KPIs, work-grid, 7 abas, ações) | aplicacao.js `renderScreen` L353 | §10 |
| Grid e toolbar | aplicacao.js `renderTable` L164 | busca, filtro de situação, "Exportar visão" |
| Abas | aplicacao.js L7, `renderFicha` L179, `renderMov` L194, `renderRules` L197, `renderExceptions` L200, `renderHistory` L207, `integrationInfo` L212, `renderAccept` L220 | §10 |
| Drawer, controles, validação | aplicacao.js `renderControl` L407, `openDrawer` L427, `saveForm` L441, `syncDependentSelectors` L472 | §10 |
| Lookup vazio | aplicacao.js `openLookup` L485 (texto L487) | texto do combo de Município/Certificado |
| Workflow / decisão | aplicacao.js `openWorkflow` L403, `openConfirm` L495 | diálogos reais |
| Sidebar | aplicacao.js L5 (`sidebar` com FISCAL) | grupo `FISCAL` do `MENU_V2` (sem subnav por épico: código E## proibido na UI) |

Remoções autorizadas (Princípio I.2(a)/(b), L14), conferidas no Portão 2: selo "DADOS FICTÍCIOS"; pill "Fixture de
teste"; rodapé "registros fictícios"; eyebrow com código de épico e "Caderno B §E01-T01"; KPI "Ambiente em tela" e
campo "Ambiente"; botões "Abrir ocorrência" e "Simular erro de validação" (toasts fictícios L398/L400); painel de
enquadramentos de NF-e (L243–L255, "apenas fixtures", L253); "ilustrativo" e "Cadastro demonstrativo em memória"
(L437); checkboxes sem persistência da aba Aceite (vira leitura). Botões de Integrações para telas inexistentes
(L218) desabilitados com `title="Destino ainda não disponível"`.

## 5. Modelo de dados (`app/backend/src/database/schema/fiscal-empresas.schema.ts`)

Transcrever; o Worker confirma a sintaxe de `foreignKey`, `unique`, `uniqueIndex().where()` e
`date({ mode: 'string' })` no Context7 (Task 0). `usuarios` de `./auth.schema`.

```ts
import { sql } from 'drizzle-orm';
import {
  check, date, foreignKey, index, integer, pgTable, text, timestamp, unique, uniqueIndex, uuid, varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { usuarios } from './auth.schema';

export const SITUACOES_ESTABELECIMENTO = ['DRAFT', 'REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;
export const SITUACOES_DECISAO = ['DRAFT', 'REVIEW', 'APPROVED', 'REJECTED'] as const; // regime e alteração
export const CODIGOS_CRT = ['1', '2', '3', '4'] as const;
export const TIPOS_CNAE = ['PRINCIPAL', 'SECUNDARIA'] as const;
const UFS_SQL = sql.raw(`'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'`);

const auditCols = {
  versao:          integer('versao').notNull().default(1),
  criadoPorId:     uuid('criado_por_id').notNull().references(() => usuarios.id),
  atualizadoPorId: uuid('atualizado_por_id').notNull().references(() => usuarios.id),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:       timestamp('deleted_at', { withTimezone: true }),
};
const decisaoCols = {
  submetidoPorId: uuid('submetido_por_id').references(() => usuarios.id),
  decididoPorId:  uuid('decidido_por_id').references(() => usuarios.id),
  decididoEm:     timestamp('decidido_em', { withTimezone: true }),
};

export const empresas = pgTable('empresas', {
  id:          uuid('id').primaryKey().default(sql`uuidv7()`),
  razaoSocial: varchar('razao_social', { length: 150 }).notNull(),
  cnpjRaiz:    varchar('cnpj_raiz', { length: 8 }).notNull(),                          // imutável
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
  empresaId:             uuid('empresa_id').notNull().references(() => empresas.id),  // imutável
  nome:                  varchar('nome', { length: 120 }).notNull(),
  cnpj:                  varchar('cnpj', { length: 14 }).notNull(),                    // imutável
  inscricaoEstadual:     varchar('inscricao_estadual', { length: 20 }).notNull(),
  inscricaoMunicipal:    varchar('inscricao_municipal', { length: 20 }).notNull(),
  uf:                    varchar('uf', { length: 2 }).notNull(),
  municipioIbgeCodigo:   varchar('municipio_ibge_codigo', { length: 7 }),  // reservado (AD-24 (2)); gravado a partir do E12-T08
  situacao:              text('situacao').notNull().default('DRAFT'),
  justificativaSituacao: text('justificativa_situacao'),
  ...decisaoCols,
  ...auditCols,
}, (t) => [
  unique('uq_estabelecimentos_id_empresa').on(t.id, t.empresaId),                    // D-E01 (não parcial)
  uniqueIndex('uq_estabelecimentos_cnpj').on(t.cnpj).where(sql`${t.deletedAt} IS NULL`),
  check('estabelecimentos_cnpj_formato_check', sql`${t.cnpj} ~ '^[0-9A-Z]{12}[0-9]{2}$'`),
  check('estabelecimentos_ie_formato_check', sql`${t.inscricaoEstadual} ~ '^[0-9A-Z]{1,20}$'`),
  check('estabelecimentos_im_formato_check', sql`${t.inscricaoMunicipal} ~ '^[0-9A-Z]{1,20}$'`),
  check('estabelecimentos_nome_preenchido_check', sql`btrim(${t.nome}) <> ''`),
  check('estabelecimentos_uf_valida_check', sql`${t.uf} IN (${UFS_SQL})`),
  check('estabelecimentos_municipio_formato_check',
    sql`${t.municipioIbgeCodigo} IS NULL OR ${t.municipioIbgeCodigo} ~ '^[0-9]{7}$'`),
  check('estabelecimentos_situacao_valida_check',
    sql`${t.situacao} IN ('DRAFT','REVIEW','APPROVED','REJECTED','SUSPENDED')`),
  check('estabelecimentos_review_submetido_check', sql`${t.situacao} <> 'REVIEW' OR ${t.submetidoPorId} IS NOT NULL`),
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

/** CNAEs vigentes (aprovados ou do rascunho) do estabelecimento — D20/D21. */
export const estabelecimentoCnaes = pgTable('estabelecimento_cnaes', {
  id:                uuid('id').primaryKey().default(sql`uuidv7()`),
  estabelecimentoId: uuid('estabelecimento_id').notNull(),
  empresaId:         uuid('empresa_id').notNull(),            // derivado do estabelecimento
  codigo:            varchar('codigo', { length: 7 }).notNull(),
  descricao:         varchar('descricao', { length: 255 }).notNull(),
  tipo:              text('tipo').notNull(),
  ...auditCols,
}, (t) => [
  foreignKey({ name: 'fk_estab_cnaes_estabelecimento_empresa',
    columns: [t.estabelecimentoId, t.empresaId],
    foreignColumns: [estabelecimentos.id, estabelecimentos.empresaId] }),
  check('estab_cnaes_codigo_formato_check', sql`${t.codigo} ~ '^[0-9]{7}$'`),
  check('estab_cnaes_tipo_valido_check', sql`${t.tipo} IN ('PRINCIPAL','SECUNDARIA')`),
  check('estab_cnaes_descricao_preenchida_check', sql`btrim(${t.descricao}) <> ''`),
  uniqueIndex('uq_estab_cnaes_principal').on(t.estabelecimentoId)
    .where(sql`${t.tipo} = 'PRINCIPAL' AND ${t.deletedAt} IS NULL`),
  uniqueIndex('uq_estab_cnaes_codigo').on(t.estabelecimentoId, t.codigo).where(sql`${t.deletedAt} IS NULL`),
  index('idx_estab_cnaes_estabelecimento').on(t.estabelecimentoId),
  index('idx_estab_cnaes_empresa').on(t.empresaId),
  index('idx_estab_cnaes_criado_por').on(t.criadoPorId),
  index('idx_estab_cnaes_atualizado_por').on(t.atualizadoPorId),
]);

/** Proposta de alteração de estabelecimento APPROVED (B3/D22): valores completos propostos. */
export const estabelecimentoAlteracoes = pgTable('estabelecimento_alteracoes', {
  id:                 uuid('id').primaryKey().default(sql`uuidv7()`),
  estabelecimentoId:  uuid('estabelecimento_id').notNull(),
  empresaId:          uuid('empresa_id').notNull(),
  nome:               varchar('nome', { length: 120 }).notNull(),
  inscricaoEstadual:  varchar('inscricao_estadual', { length: 20 }).notNull(),
  inscricaoMunicipal: varchar('inscricao_municipal', { length: 20 }).notNull(),
  uf:                 varchar('uf', { length: 2 }).notNull(),
  versaoBase:         integer('versao_base').notNull(),       // estabelecimentos.versao na criação
  situacao:           text('situacao').notNull().default('DRAFT'),
  justificativa:      text('justificativa').notNull(),
  motivoRejeicao:     text('motivo_rejeicao'),
  ...decisaoCols,
  ...auditCols,
}, (t) => [
  foreignKey({ name: 'fk_estab_alteracoes_estabelecimento_empresa',
    columns: [t.estabelecimentoId, t.empresaId],
    foreignColumns: [estabelecimentos.id, estabelecimentos.empresaId] }),
  check('estab_alteracoes_ie_formato_check', sql`${t.inscricaoEstadual} ~ '^[0-9A-Z]{1,20}$'`),
  check('estab_alteracoes_im_formato_check', sql`${t.inscricaoMunicipal} ~ '^[0-9A-Z]{1,20}$'`),
  check('estab_alteracoes_nome_preenchido_check', sql`btrim(${t.nome}) <> ''`),
  check('estab_alteracoes_uf_valida_check', sql`${t.uf} IN (${UFS_SQL})`),
  check('estab_alteracoes_situacao_valida_check', sql`${t.situacao} IN ('DRAFT','REVIEW','APPROVED','REJECTED')`),
  check('estab_alteracoes_justificativa_preenchida_check', sql`btrim(${t.justificativa}) <> ''`),
  check('estab_alteracoes_review_submetido_check', sql`${t.situacao} <> 'REVIEW' OR ${t.submetidoPorId} IS NOT NULL`),
  check('estab_alteracoes_decidido_check',
    sql`${t.situacao} NOT IN ('APPROVED','REJECTED') OR (${t.decididoPorId} IS NOT NULL AND ${t.decididoEm} IS NOT NULL)`),
  check('estab_alteracoes_rejeitada_motivo_check', sql`${t.situacao} <> 'REJECTED' OR ${t.motivoRejeicao} IS NOT NULL`),
  uniqueIndex('uq_estab_alteracoes_aberta').on(t.estabelecimentoId)
    .where(sql`${t.situacao} IN ('DRAFT','REVIEW') AND ${t.deletedAt} IS NULL`),
  index('idx_estab_alteracoes_estabelecimento').on(t.estabelecimentoId),
  index('idx_estab_alteracoes_empresa').on(t.empresaId),
  index('idx_estab_alteracoes_situacao').on(t.situacao).where(sql`${t.deletedAt} IS NULL`),
  index('idx_estab_alteracoes_submetido_por').on(t.submetidoPorId),
  index('idx_estab_alteracoes_decidido_por').on(t.decididoPorId),
  index('idx_estab_alteracoes_criado_por').on(t.criadoPorId),
  index('idx_estab_alteracoes_atualizado_por').on(t.atualizadoPorId),
]);

/** CNAEs propostos na alteração — mesmas regras de estabelecimento_cnaes, por alteração. */
export const estabelecimentoAlteracaoCnaes = pgTable('estabelecimento_alteracao_cnaes', {
  id:          uuid('id').primaryKey().default(sql`uuidv7()`),
  alteracaoId: uuid('alteracao_id').notNull().references(() => estabelecimentoAlteracoes.id),
  codigo:      varchar('codigo', { length: 7 }).notNull(),
  descricao:   varchar('descricao', { length: 255 }).notNull(),
  tipo:        text('tipo').notNull(),
  ...auditCols,
}, (t) => [
  check('estab_alt_cnaes_codigo_formato_check', sql`${t.codigo} ~ '^[0-9]{7}$'`),
  check('estab_alt_cnaes_tipo_valido_check', sql`${t.tipo} IN ('PRINCIPAL','SECUNDARIA')`),
  check('estab_alt_cnaes_descricao_preenchida_check', sql`btrim(${t.descricao}) <> ''`),
  uniqueIndex('uq_estab_alt_cnaes_principal').on(t.alteracaoId)
    .where(sql`${t.tipo} = 'PRINCIPAL' AND ${t.deletedAt} IS NULL`),
  uniqueIndex('uq_estab_alt_cnaes_codigo').on(t.alteracaoId, t.codigo).where(sql`${t.deletedAt} IS NULL`),
  index('idx_estab_alt_cnaes_alteracao').on(t.alteracaoId),
  index('idx_estab_alt_cnaes_criado_por').on(t.criadoPorId),
  index('idx_estab_alt_cnaes_atualizado_por').on(t.atualizadoPorId),
]);

export const regimesTributarios = pgTable('regimes_tributarios', {
  id:                uuid('id').primaryKey().default(sql`uuidv7()`),
  estabelecimentoId: uuid('estabelecimento_id').notNull(),
  empresaId:         uuid('empresa_id').notNull(),            // derivado do estabelecimento, nunca do cliente
  crt:               text('crt').notNull(),
  vigenciaInicio:    date('vigencia_inicio', { mode: 'string' }).notNull(),
  vigenciaFim:       date('vigencia_fim', { mode: 'string' }),
  situacao:          text('situacao').notNull().default('DRAFT'),
  justificativa:     text('justificativa').notNull(),
  motivoRejeicao:    text('motivo_rejeicao'),
  substituiRegimeId: uuid('substitui_regime_id'),
  ...decisaoCols,
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

Certificado vinculado: **nenhuma coluna nem FK** nesta fatia (não existe tabela de certificados). O E12-T03
acrescenta `estabelecimentos.certificado_id` (nullable) e a FK por migration expand; até lá a ficha mostra o
campo vazio com `BadgeProvisorio`. Migration: só `drizzle-kit generate --name e01_t01_empresas_estabelecimentos`;
expand-only (seis `CREATE TABLE` + índices/constraints).


## 6. Máquinas de estado e regras de serviço

Toda operação sobre estabelecimento, CNAE, alteração ou regime abre `db.transaction` e, como primeira trava,
executa `SELECT id, empresa_id, situacao, versao FROM estabelecimentos WHERE id = $1 AND deleted_at IS NULL FOR NO
KEY UPDATE` (D14); `empresa_id` das tabelas filhas vem dessa linha, nunca do cliente.

Estabelecimento (`EstabelecimentosService`):

| Ação | De → Para | Permissão | Regras |
|---|---|---|---|
| criar | — → DRAFT | GERENCIAR | empresa não removida; DV; raiz = `empresas.cnpj_raiz` (422 `CNPJ_RAIZ_DIVERGENTE`); CNPJ único (409 `CNPJ_DUPLICADO`, `23505` de `uq_estabelecimentos_cnpj`); `cnaes` opcional no corpo, validado como em "substituir CNAEs" |
| editar (nome, IE, IM, UF) | DRAFT→DRAFT; REJECTED→DRAFT | GERENCIAR | `versao` (409 `CONFLITO_CONCORRENTE`); APPROVED → 409 `ALTERACAO_EXIGIDA` (usar alteração); REVIEW/SUSPENDED → 409 `TRANSICAO_INVALIDA`; DTO `.strict()` rejeita `empresaId`/`cnpj`/`municipioIbgeCodigo` |
| substituir CNAEs | DRAFT/REJECTED → DRAFT | GERENCIAR | ver "CNAE" abaixo; incrementa `estabelecimentos.versao`; APPROVED → 409 `ALTERACAO_EXIGIDA` (usar alteração); REVIEW/SUSPENDED → 409 `TRANSICAO_INVALIDA`; nenhuma escrita nesses casos |
| submeter | DRAFT → REVIEW | GERENCIAR | grava `submetido_por_id` |
| aprovar | REVIEW → APPROVED | APROVAR | segregação (422 `SEGREGACAO_FUNCAO`); exatamente 1 CNAE principal vigente (422 `CNAE_PRINCIPAL_AUSENTE`); Município/Certificado não exigidos (D23); grava `decidido_*`; limpa `justificativa_situacao` |
| rejeitar | REVIEW → REJECTED | APROVAR | segregação; `justificativa_situacao` |
| suspender | APPROVED → SUSPENDED | APROVAR | `justificativa_situacao` |
| reativar | SUSPENDED → REVIEW | GERENCIAR | `submetido_por_id` = solicitante |
| remover | DRAFT/REJECTED → soft delete | GERENCIAR | sem regime `REVIEW`/`APPROVED` (409 `ESTABELECIMENTO_COM_REGIME_ATIVO`); regimes `DRAFT`/`REJECTED` e CNAEs recebem `deleted_at` na mesma transação; alteração aberta remanescente (`DRAFT`/`REVIEW`, criada quando o estabelecimento era `APPROVED`) e seus CNAEs propostos também recebem `deleted_at` na mesma transação (auditoria `DELETE` por linha), de modo que não resta alteração aberta de estabelecimento removido |

CNAE (função `substituirCnaes(tx, alvo, lista)` em `cnaes.service.ts`, usada no rascunho e na aplicação da
alteração):
- Entrada `{ codigo, descricao, tipo }[]` (0..50). Zod: `codigo` normalizado por `normalizarCnae` (remove `-`, `/`,
  `.`, espaços) e `^[0-9]{7}$` (400, mensagem "CNAE deve ter 7 dígitos (0000-0/00)."); `descricao` trim 1–255;
  `tipo ∈ TIPOS_CNAE`.
- Serviço (422, antes de escrever): mais de um `PRINCIPAL` → `CNAE_PRINCIPAL_UNICO`; código repetido →
  `CNAE_DUPLICADO` com `{ codigo }`. O `UNIQUE` parcial é a barreira final (`23505` → 409 `CONFLITO_CONCORRENTE`).
- Aplicação por diferença, nesta ordem: (1) soft delete de toda linha vigente cujo `(codigo, tipo, descricao)` não
  está na lista (auditoria `DELETE`); (2) INSERT das entradas novas (auditoria `INSERT`); linhas idênticas ficam
  intactas. Assim a troca de principal nunca viola `uq_estab_cnaes_principal`. Histórico = linhas soft-deleted +
  auditoria com usuário e justificativa.
- Nenhuma chamada externa (Receita/IBGE); a UI avisa que o operador confere com a documentação (AD-24 (3)).

Alteração de estabelecimento aprovado (`AlteracoesService`, D22):

| Ação | De → Para | Permissão | Regras |
|---|---|---|---|
| criar | — → DRAFT | GERENCIAR | estabelecimento `APPROVED` (senão 409 `TRANSICAO_INVALIDA`); `versao` do estabelecimento igual (409 `CONFLITO_CONCORRENTE`); valores completos propostos + lista de CNAEs (regras de CNAE); `versao_base` = `estabelecimentos.versao`; 1 aberta por estabelecimento (`23505` de `uq_estab_alteracoes_aberta` → 409 `ALTERACAO_EM_ABERTO`) |
| editar | DRAFT → DRAFT | GERENCIAR | `versao` da alteração; campos e/ou CNAEs (CNAEs da proposta substituídos pela mesma diferença) |
| submeter | DRAFT → REVIEW | GERENCIAR | proposta com 1 principal (422 `CNAE_PRINCIPAL_AUSENTE`) |
| aprovar | REVIEW → APPROVED | APROVAR | segregação; estabelecimento ainda `APPROVED` e `versao = versao_base` (senão 409 `ALTERACAO_DESATUALIZADA`); na mesma transação: UPDATE de `nome/IE/IM/UF` do estabelecimento (`versao + 1`, auditoria `UPDATE`), `substituirCnaes` com a lista proposta, alteração `APPROVED` |
| rejeitar | REVIEW → REJECTED | APROVAR | segregação; `motivo_rejeicao`; **nenhuma escrita** em `estabelecimentos`/`estabelecimento_cnaes` |
| descartar | DRAFT → soft delete | GERENCIAR | CNAEs propostos soft-deleted junto |

Enquanto a alteração está `DRAFT`/`REVIEW`, o estabelecimento continua `APPROVED` com os valores aprovados;
`dadosFiscaisVigentes`, o grid e a ficha mostram o aprovado; a ficha mostra a proposta em bloco separado
"Alteração aguardando revisão".

Empresa (`EmpresasService`): criar (`razaoSocial`, `cnpjRaiz`; 409 `CNPJ_RAIZ_DUPLICADO`); editar razão social
(`versao`); remover só sem estabelecimento não removido (409 `EMPRESA_COM_ESTABELECIMENTOS`). `cnpj_raiz` imutável.

Regime (`RegimesService`):

| Ação | De → Para | Permissão | Regras |
|---|---|---|---|
| criar | — → DRAFT | GERENCIAR | estabelecimento não removido e não SUSPENDED (409 `TRANSICAO_INVALIDA`) |
| editar | DRAFT/REJECTED → DRAFT | GERENCIAR | `versao` |
| submeter | DRAFT → REVIEW | GERENCIAR | `classificarSobreposicao`: `sobreposto` → 409 `REGIME_SOBREPOSTO` `{ conflito: { crt, vigenciaInicio, vigenciaFim, situacao } }`; `troca` sem `confirmarTroca` → 409 `TROCA_REGIME_CONFIRMACAO_NECESSARIA` `{ regimeAtual: { crt, vigenciaInicio }, fimProposto }`, sem mutação; `troca` confirmada → REVIEW e `substitui_regime_id` |
| aprovar | REVIEW → APPROVED | APROVAR | segregação; estabelecimento `APPROVED` (422 `ESTABELECIMENTO_NAO_APROVADO`); reclassifica sob a trava; se `troca`, a anterior continua `APPROVED`, aberta e com início < D e recebe `vigencia_fim = D − 1` (auditado); divergência → 409 `REGIME_SOBREPOSTO` |
| rejeitar | REVIEW → REJECTED | APROVAR | segregação; `motivo_rejeicao` |
| remover | DRAFT/REJECTED → soft delete | GERENCIAR | — |

Regime `APPROVED` é imutável, exceto `vigencia_fim` `NULL → valor` pela troca. Regime `APPROVED` com
`vigencia_fim` informada (inclusive futura) **nunca é encurtado**: nova versão que o intercepta é `sobreposto`
(MENOR 5).

`classificarSobreposicao(nova, existentes)` (função pura, `regimes-vigencia.ts`; existentes = não removidas
`REVIEW`/`APPROVED` do estabelecimento, exceto a própria): intervalos fechados `[inicio, fim ?? +∞]`. Sem interseção
→ `{ tipo: 'livre' }`. Interseção única com uma `APPROVED` de `fim = null` e `inicio < nova.inicio` →
`{ tipo: 'troca', regimeAtual, fimProposto: diaAnterior(nova.inicio) }`. Qualquer outra → `{ tipo: 'sobreposto',
conflito }`. `diaAnterior` em aritmética UTC sobre `YYYY-MM-DD`.

Exportados para domínios adjacentes: `EmpresasService.empresaAtiva(db, empresaId)`,
`EmpresasService.listarEmpresasAtivasIds(db)` (D15, proposta), `EstabelecimentosService.dadosFiscaisVigentes(db,
estabelecimentoId, dataIso)` → `{ cnpj, inscricaoEstadual, uf, crt, cnaePrincipal } | null` (D16).

## 7. Endpoints (`@Controller('fiscal')`, `JwtAuthGuard` + `RbacGuard`, padrão `fornecedores.controller.ts`)

| Verbo e caminho | Permissão | DTO (Zod) | Resposta |
|---|---|---|---|
| GET `/fiscal/empresas` | LER | {search?, page, pageSize ≤ 100} | paginado |
| POST `/fiscal/empresas` | GERENCIAR | {razaoSocial 1–150, cnpjRaiz `^[0-9A-Z]{8}$` normalizado, justificativa} | 201 |
| PATCH `/fiscal/empresas/:id` | GERENCIAR | {razaoSocial, versao, justificativa}.strict() | 200 |
| DELETE `/fiscal/empresas/:id` | GERENCIAR | {justificativa} | 200 |
| GET `/fiscal/estabelecimentos` | LER | {empresaId?, estabelecimentoId?, situacao?, search?, sort ∈ estabelecimento·cnpj·regime·uf·empresa, dir, page, pageSize=20} | paginado com regime vigente |
| GET `/fiscal/estabelecimentos/contagens` | LER | mesmo filtro | {total, emRevisao, suspensos} |
| GET `/fiscal/estabelecimentos/exportacao` | LER | mesmo filtro | `text/csv; charset=utf-8`, `;`, BOM, rótulos, sem ids |
| GET `/fiscal/estabelecimentos/:id` | LER | uuid | detalhe aprovado + empresa + cnaes vigentes + regimes + `alteracaoAberta` (proposta + cnaes) + responsável (nome) |
| GET `/fiscal/estabelecimentos/:id/historico` | LER | uuid | {objeto: empresa·estabelecimento·cnae·alteracao·regime, operacao, situacaoAnterior, situacaoNova, usuarioNome, criadoEm, justificativa, resumo} |
| GET `/fiscal/estabelecimentos/:id/pre-condicoes` | LER | uuid | {codigo, atendida, provisoria}: ESTABELECIMENTO_APROVADO, REGIME_VIGENTE_APROVADO, CNAE_PRINCIPAL_INFORMADO, MUNICIPIO_INFORMADO (provisoria), CERTIFICADO_VINCULADO (provisoria) |
| POST `/fiscal/estabelecimentos` | GERENCIAR | {empresaId, nome 1–120, cnpj (normalizado + DV), inscricaoEstadual, inscricaoMunicipal (`^[0-9A-Z]{1,20}$`), uf ∈ `UFS_BRASIL`, cnaes?, justificativa}.strict() | 201 |
| PATCH `/fiscal/estabelecimentos/:id` | GERENCIAR | {nome?, inscricaoEstadual?, inscricaoMunicipal?, uf?, versao, justificativa}.strict() | 200 |
| PUT `/fiscal/estabelecimentos/:id/cnaes` | GERENCIAR | {cnaes: cnae[] 0..50, versao, justificativa}.strict() | 200 |
| POST `/fiscal/estabelecimentos/:id/{submeter·reativar}` | GERENCIAR | {versao, justificativa} | 200 |
| POST `/fiscal/estabelecimentos/:id/{aprovar·rejeitar·suspender}` | APROVAR | {versao, justificativa} | 200 |
| DELETE `/fiscal/estabelecimentos/:id` | GERENCIAR | {justificativa} | 200 |
| POST `/fiscal/estabelecimentos/:id/alteracoes` | GERENCIAR | {nome, inscricaoEstadual, inscricaoMunicipal, uf, cnaes, versao (do estabelecimento), justificativa}.strict() | 201 |
| PATCH `/fiscal/estabelecimentos/:id/alteracoes/:altId` | GERENCIAR | {nome?, inscricaoEstadual?, inscricaoMunicipal?, uf?, cnaes?, versao, justificativa}.strict() | 200 |
| POST `/fiscal/estabelecimentos/:id/alteracoes/:altId/submeter` | GERENCIAR | {versao, justificativa} | 200 |
| POST `/fiscal/estabelecimentos/:id/alteracoes/:altId/{aprovar·rejeitar}` | APROVAR | {versao, justificativa} | 200 |
| DELETE `/fiscal/estabelecimentos/:id/alteracoes/:altId` | GERENCIAR | {justificativa} | 200 |
| POST `/fiscal/estabelecimentos/:id/regimes` | GERENCIAR | {crt ∈ CODIGOS_CRT, vigenciaInicio, vigenciaFim? ≥ início, justificativa}.strict() | 201 |
| PATCH `/fiscal/estabelecimentos/:id/regimes/:regimeId` | GERENCIAR | {crt?, vigenciaInicio?, vigenciaFim?, versao, justificativa}.strict() | 200 |
| POST `/fiscal/estabelecimentos/:id/regimes/:regimeId/submeter` | GERENCIAR | {versao, justificativa, confirmarTroca?} | 200 / 409 challenge |
| POST `/fiscal/estabelecimentos/:id/regimes/:regimeId/{aprovar·rejeitar}` | APROVAR | {versao, justificativa} | 200 |
| DELETE `/fiscal/estabelecimentos/:id/regimes/:regimeId` | GERENCIAR | {justificativa} | 200 |

Regras comuns: `justificativa` trim 3–500; `:regimeId`/`:altId` de outro estabelecimento → 404; filtro
`estabelecimentoId` de outra `empresaId` → 422 `ESTABELECIMENTO_DE_OUTRA_EMPRESA`; erro `{ message, codigo,
...dados }` lançado como objeto nas exceptions Nest (padrão AD-05); nenhum 5xx expõe SQL ou stack.


## 8. Eventos pós-commit e tempo real

- `realtime/events/eventos.ts`: `EMPRESA_FISCAL_ALTERADA: 'empresa_fiscal_alterada'`,
  `ESTABELECIMENTO_FISCAL_ALTERADO: 'estabelecimento_fiscal_alterado'`, `REGIME_TRIBUTARIO_ALTERADO:
  'regime_tributario_alterado'`; payload `CadastroFiscalAlteradoPayload = { empresaId: string; estabelecimentoId?:
  string; regimeId?: string; acao: 'criado'|'atualizado'|'cnaes_atualizados'|'submetido'|'aprovado'|'rejeitado'|
  'suspenso'|'reativado'|'removido'|'alteracao_criada'|'alteracao_submetida'|'alteracao_aprovada'|
  'alteracao_rejeitada'|'alteracao_descartada'; situacao?: string }`, registrado em `PayloadPorEvento`.
- Emissão só depois de `db.transaction(...)` resolver (padrão
  `app/backend/src/modules/comercial/precos/precos.service.ts` L282–L284). Troca de regime emite dois
  `regime_tributario_alterado` (anterior `atualizado`, nova `aprovado`).
- `realtime/room-permissoes.ts` (novo): `ROOMS_PROTEGIDAS: Readonly<Record<string, Permissao>> =
  { 'fiscal-empresas': 'FISCAL_EMPRESAS_LER' }`; `permissaoParaRoom(room)` = entrada protegida ou
  `'DISPONIBILIDADE_LER'` (legado inalterado).
- `realtime.hub.ts` (MENOR 2): novos `membros(room): readonly RealtimeSocket[]` (cópia; vazio se a room não existe) e
  `remover(socket, room)` (apaga a room quando esvazia). `join`, `leaveAll`, `broadcast` inalterados.
- `realtime.gateway.ts` (MENOR 2): `AuthSocket = WebSocket & { user?: AccessTokenPayload }` (tipo de
  `modules/auth/token.service.ts`, que já traz `exp` em segundos); `autenticar` retorna `AccessTokenPayload | null`
  (`verifyAccessToken` já devolve esse tipo); `podeAssinar(ws, room)` checa `permissaoParaRoom(room)`; novo
  `broadcastRoom(room, evento, payload)` lança erro se `room ∉ ROOMS_PROTEGIDAS` e, antes de enviar, chama
  `hub.remover` para todo socket de `hub.membros(room)` com `user.exp * 1000 <= Date.now()`; três `@OnEvent`
  publicam em `fiscal-empresas` via `broadcastRoom`. `broadcast` por `roomsDaData` inalterado.
  `CurrentUserPayload` não muda.

## 9. RBAC, seed, parâmetro provisório e menu

Permissões (`common/rbac/permissoes.ts`): três chaves em `PERMISSOES` após `OCORRENCIA_PRECO_CIENTE`; descrições
("Consultar empresas, estabelecimentos, CNAEs e regimes", "Cadastrar, editar, submeter e remover empresas,
estabelecimentos, CNAEs, alterações e regimes", "Aprovar, rejeitar e suspender cadastros, alterações e regimes
fiscais"); `pushPermissoes('administrador', …)` com comentário AD-04/AD-18 (5)/H-E01-02. Fora de
`LEITURA_CADASTROS`.

Catálogo de permissões (B1): `DESCRICOES_PERMISSOES` é `Record<Permissao, string>` e
`PerfisService.catalogo()` (`app/backend/src/modules/perfis/perfis.service.ts`, `MODULOS` em L58–L85) lança
`Permissões sem módulo no catálogo` para permissão sem prefixo mapeado, o que quebraria `GET /perfis/catalogo` e a
tela `/admin/perfis`. Em `MODULOS` entra `{ modulo: 'Fiscal', prefixos: ['FISCAL_'] }` depois de `Expedição e
Faturamento`; nenhum prefixo existente é alterado. Teste novo em `perfis-menus.e2e-spec.ts`: `GET /perfis/catalogo`
devolve o módulo `Fiscal` com exatamente `FISCAL_EMPRESAS_APROVAR`, `FISCAL_EMPRESAS_GERENCIAR` e
`FISCAL_EMPRESAS_LER`, cada uma com a descrição de `DESCRICOES_PERMISSOES`; o teste existente "catalogo de permissoes
cobre todo o mapa de descricoes" e `test/unit/onda3-cadastros-branches.spec.ts` (L772, `service.catalogo()`)
continuam passando sem afrouxar.

Parâmetro (`database/seed.ts` `PARAMETROS_SEED`): `{ chave: 'fiscal.empresas_perfis_autorizados', descricao:
'Perfis com acesso ao cadastro fiscal de empresas', valorJson: { grupo: 'Fiscal', tipo: 'info', titulo: 'Perfis do
cadastro fiscal de empresas', texto: 'Somente administrador até decisão sobre os demais perfis.', valor:
['administrador'], provisorio: true, pendencia: 'H-E01-02' } }`. A tela mostra `BadgeProvisorio codigo="H-E01-02"`
enquanto `provisorio === true` (BFF existente `/api/admin/parametros/chave/[chave]`).

Menu (AD-24 (1), D19) — 39 rotas originais intactas, total 39 + 1 = 40:
- Backend `common/rbac/menus-canonicos.ts`: a lista atual vira `MENUS_OPERACIONAIS` (mesmas 39 linhas, mesma
  ordem, comentário AD-15 mantido); novo `MENUS_ERP = ['/fiscal/empresas'] as const` (comentário AD-24 (1));
  `MENUS_CANONICOS = [...MENUS_OPERACIONAIS, ...MENUS_ERP] as const`. `administrador: [...MENUS_CANONICOS]` passa a
  incluir a rota; demais perfis inalterados (D11). Comentário "126 pares" vira "126 pares da matriz v1.1 + 1 ERP".
- `perfil-menus.snapshot.json` e `perfil-permissoes.snapshot.json` regenerados por
  `npx tsx scripts/gerar-snapshot-perfis.ts`; só a chave `administrador` muda em cada um.
- `modules/perfis/dto/perfil.dto.ts`: `.max(39)` → `.max(MENUS_CANONICOS.length)`.
- `seedMenusVisiveis` (existente) reconcilia `menus_visiveis` no próximo seed: banco existente recebe a rota.
- Frontend `lib/menu-v2.ts`: `MenuItemDef` ganha `permissao?: string`; grupo novo inserido entre `FATURAMENTO` e
  `CADASTROS & REGRAS`: `{ title: 'FISCAL', items: [{ href: '/fiscal/empresas', label: 'Empresas,
  estabelecimentos e regime', iconKey: 'Landmark', permissao: 'FISCAL_EMPRESAS_LER' }] }`.
  `filtrarMenuPorMenusVisiveis(menusVisiveis, permissoes: string[] = [])`: item com `permissao` só aparece se a
  permissão estiver em `permissoes` (fail-closed); itens sem `permissao` inalterados. `(admin)/layout.tsx` passa
  `user.permissoes`. `rotaDeEntrada` inalterada (ROTA_ENTRADA_POR_PERFIL não muda). O comentário de cabeçalho do
  arquivo (hoje "Permissão de API é assunto do backend (RbacGuard) e não filtra menu") é reescrito: a visibilidade
  continua vindo de `perfis.menus_visiveis`, e item que declara `permissao` só aparece se o usuário também a tiver;
  os demais itens não são filtrados por permissão (MENOR 1).
- `components/ui/app-sidebar.tsx`: importa `Landmark` de `lucide-react` e registra em `ICON_MAP`.
- Testes que fixam contagem (atualizar, sem afrouxar):
  - `frontend/__tests__/menu-v2.test.ts`: `GRUPOS` com `'FISCAL'` na 8ª posição (10 grupos; ordem relativa dos 9
    originais preservada); `ITENS_PROTOTIPO` (39) intacto + `ITENS_ERP = [['FISCAL', 'Empresas, estabelecimentos e
    regime', '/fiscal/empresas']]`; asserções: itens sem FISCAL `toEqual(ITENS_PROTOTIPO)` e `toHaveLength(39)`;
    total `toHaveLength(40)`; teste de `page.tsx` cobre a rota nova; caso novo (MENOR 5): perfil cujo
    `menusVisiveis` contém `/fiscal/empresas` (atribuído em `/admin/perfis`) e cujas `permissoes` não contêm
    `FISCAL_EMPRESAS_LER` → `filtrarMenuPorMenusVisiveis` não devolve o item nem o grupo `FISCAL`.
  - `frontend/__tests__/menu-rbac.test.ts`: `MATRIZ_RASTREABILIDADE` (39, v1.1) intacta + `MATRIZ_ERP =
    { '/fiscal/empresas': ['administrador'] }` (fonte AD-24 (1) + D11); `menusDaMatriz` usa a união; "39 rotas"
    passa a conferir `ROTAS_CANONICAS` sem `/fiscal/` = chaves da v1.1 (39) e total 40; 126 → `126 + 1 = 127`;
    `TODOS` com `'FISCAL'` após `'FATURAMENTO'`; `GRUPOS_ESPERADOS.gestor` = `TODOS` sem `'FISCAL'`;
    `rotasVisiveis(perfil)` passa `PERMISSOES_POR_PERFIL[perfil]`; novos casos "item com permissão some sem a
    permissão", "administrador vê FISCAL" e (MENOR 5) "menu FISCAL atribuído a um perfil sem `FISCAL_EMPRESAS_LER`
    não aparece".
  - `backend/test/integration/perfis-menus.e2e-spec.ts` L78–L79: `MENUS_OPERACIONAIS` 39 e `MENUS_CANONICOS`/
    `res.body.menus` 40; caso novo do módulo `Fiscal` no catálogo (B1, parágrafo "Catálogo de permissões").
  - `frontend/e2e/shell-ds.spec.ts` (B2): `GRUPOS` (L28–L38) ganha `'FISCAL'` na 8ª posição, entre `'FATURAMENTO'`
    e `'CADASTROS & REGRAS'` (ordem dos 9 originais preservada); o título do teste de L86 passa de "menu do
    administrador tem os 9 grupos na ordem do prototipo" para "menu do administrador tem os 10 grupos na ordem do
    prototipo" (a asserção `toEqual(GRUPOS)` não é afrouxada). Executado na Task 13.

## 10. Página e componentes DS v3

Página `app/frontend/src/app/(admin)/fiscal/empresas/page.tsx` (server component, padrão
`(admin)/cadastros/fornecedores/page.tsx`): `getMe()`; sem usuário → `redirect('/login')`; sem
`FISCAL_EMPRESAS_LER` → "Você não tem permissão para visualizar empresas e estabelecimentos." sem renderizar o
cliente; senão `<EmpresasEstabelecimentosClient podeGerenciar podeAprovar />`.

Componentes em `components/fiscal/empresas/`: `empresas-estabelecimentos-client.tsx`, `estabelecimento-drawer.tsx`,
`cnaes-editor.tsx`, `alteracao-drawer.tsx`, `empresa-dialog.tsx`, `regime-dialog.tsx`, `decisao-dialog.tsx`,
`abas-detalhe.tsx`. DS existente: `PageHeader`, `KpiStrip`/`Kpi`, `Table`, `Tabs` (`temErro`, AD-12),
`ComboboxField`, `DatePickerField`, `Sheet`, `AlertDialog`, `StatusPill`, `EmptyState`, `Skeleton`,
`BadgeProvisorio` (`components/ui/badge-provisorio.tsx`, selo "Provisório" do DS), `sonner`. Sem hex avulso.

- Hero: título; subtítulo do catálogo; "Exportar", "+ Novo registro" (só `podeGerenciar`), "Ações do processo ▾"
  (cadastrar empresa e filial, ativar regime por vigência, aprovar alteração, cada um com "Abrir decisão →").
- KPIs: "Estabelecimentos", "Em revisão" (inclui alterações em revisão; hint "Exigem decisão humana"), "Suspensos".
- "Registros e consultas": busca, filtros Empresa (combo), Estabelecimento (dependente, limpo ao trocar a
  empresa), Situação; "Exportar visão"; grid §4; clique/Enter seleciona; paginação server-side; filtros e ordenação
  em `sessionStorage`; vazio com texto de renderTable L172.
- "Detalhamento e execução" — 7 abas:
  1. Ficha e campos: Empresa, Razão social, CNPJ (máscara `AA.AAA.AAA/AAAA-DD`), Estabelecimento, IE, IM, Estado,
     Município (vazio, combo desabilitado com `emptyText` de L487 e `BadgeProvisorio`), **Atividades econômicas
     (CNAE)** (principal + secundárias, máscara `0000-0/00` e descrição), Certificado vinculado (vazio +
     `BadgeProvisorio`), Regime tributário, Início/Fim de vigência, Situação; bloco "Alteração aguardando revisão"
     (valores propostos lado a lado com os aprovados) quando houver; "Trilha e responsabilização"; botões
     "Editar versão" (rascunho → drawer; aprovado → drawer de alteração), "Validar pré-condições" (atendida,
     pendente ou provisória — provisória não bloqueia), "Consultar histórico".
  2. Movimentações: trilha Preparação → Verificação → Autorização → Conclusão; tabela de versões de regime
     (Regime tributário, Início, Fim, Situação, Responsável) com Nova versão/Submeter/Aprovar/Rejeitar/Remover; ações
     da alteração (Submeter/Aprovar/Rejeitar/Descartar) conforme situação e permissão.
  3. Regras e validações: regras do catálogo + caminho de aprovação (L198) + "CNAE: 1 principal, sem repetição,
     conferido com a documentação".
  4. Exceções: "CNPJ rejeitado", "Troca de regime", "Competência bloqueada" (L203).
  5. Histórico: linha do tempo (objeto, ação, quando, quem, justificativa, resumo); rótulos no frontend.
  6. Integrações: blocos L214–L217; botões desabilitados (§4).
  7. Aceite e testes: critérios L224–L231 em leitura.
- Drawer de estabelecimento (L427): Empresa (combo + "Nova empresa"), Razão social (leitura), CNPJ (`maxLength` 18),
  Nome, IE, IM, Estado (27 UFs), Município e Certificado desabilitados com `BadgeProvisorio` e texto "Opcional; não
  impede a aprovação", `cnaes-editor`, "Motivo da alteração *"; "Cancelar", "Verificar dados" (local, sem gravar),
  "Salvar rascunho". Salvar chama POST/PATCH e, se a lista mudou, PUT CNAEs. Erros por campo via
  `useErrosCampo`/`extrairErrosPorCampo` (AD-12). Sair com pendência pede confirmação.
- `cnaes-editor`: lista editável (linha = Código com máscara `0000-0/00`, Descrição, Tipo Principal/Secundária,
  remover); "Adicionar atividade"; marcar uma linha como principal desmarca a anterior; erros 422
  `CNAE_DUPLICADO`/`CNAE_PRINCIPAL_UNICO`/`CNAE_PRINCIPAL_AUSENTE` na linha/lista; aviso fixo "Confira os códigos e
  descrições com a documentação da empresa (cartão CNPJ). O sistema não consulta a Receita Federal."
- Drawer de alteração: mesmos campos editáveis (sem CNPJ/Empresa), pré-preenchidos com o aprovado; "Salvar
  proposta" e "Submeter para revisão".
- Diálogo de regime: CRT (rótulos D5), Início, Fim, "Motivo da alteração *"; challenge 409 abre "Encerrar o regime
  atual em <fimProposto> e submeter a troca?" e reenvia `confirmarTroca: true`; `REGIME_SOBREPOSTO` mostra o conflito.
- Diálogo de decisão (L495): título, detalhe, "Justificativa *"; `SEGREGACAO_FUNCAO` → "A aprovação deve ser feita
  por usuário diferente de quem submeteu."; `ALTERACAO_DESATUALIZADA` → "O cadastro mudou depois desta proposta.
  Descarte e crie uma nova."
- Estados: inicial, carregando (skeleton), sem registros, validação inválida, conflito concorrente (409
  `CONFLITO_CONCORRENTE` → "O registro foi alterado por outro usuário. Recarregue para continuar."), serviço
  indisponível ("Tentar novamente"), revisão pendente (pill "Aguardando revisão"), concluído (toast).
- Tempo real: `conectarRealtime({ rooms: ['fiscal-empresas'], onMessage, onReconnect })` refaz lista e detalhe;
  sem polling.
- `lib/fiscal-empresas.ts`: `ROTULOS_CRT`, `ROTULOS_SITUACAO`, `ROTULOS_TIPO_CNAE`, `ROTULOS_ACAO_HISTORICO`,
  `mascararCnpjAlfanumerico`, `normalizarCnpj`, `mascararCnae`, `normalizarCnae`, cliente HTTP do BFF.

## 11. Auditoria (Princípio IV)

Cada mutação chama `AuditoriaService.registrar(tx, …)` na mesma transação: `tabela` física, `registroId`,
`operacao` (`INSERT`; `UPDATE` em edição, aplicação de alteração e encerramento de vigência; `ACAO_MANUAL` em
submeter/aprovar/rejeitar/suspender/reativar; `DELETE` em soft delete), `modulo: 'fiscal.empresas'`, `usuarioId`,
`dadosAnteriores`/`dadosNovos` (linhas completas; sem segredo) e `justificativa`. O histórico do estabelecimento lê
`auditoria` por `(tabela, registro_id)` do estabelecimento, da empresa, de todos os seus CNAEs (inclusive
removidos), alterações, CNAEs propostos e regimes, com join em `usuarios`, e devolve `objeto`, nunca nome de tabela.

## 12. Estrutura de arquivos (ownership exclusivo)

Backend (`app/backend/`): `src/database/schema/fiscal-empresas.schema.ts` (novo) e `index.ts`;
`src/database/migrations/<gerada>.sql` + `meta/*`; `src/database/migrations/ROLLBACK.md` (seção E01-T01);
`src/database/seed.ts` (parâmetro); `src/common/validators/{cnpj-alfanumerico,cnae}.ts` (novos);
`src/common/rbac/{permissoes.ts,menus-canonicos.ts,perfil-permissoes.snapshot.json,perfil-menus.snapshot.json}`;
`src/modules/perfis/dto/perfil.dto.ts`; `src/modules/perfis/perfis.service.ts` (módulo `Fiscal` em `catalogo()`); `src/modules/erp/fiscal/empresas/**` (module, `empresas.controller.ts`,
`estabelecimentos.controller.ts`, `empresas.service.ts`, `estabelecimentos.service.ts`, `cnaes.service.ts`,
`alteracoes.service.ts`, `regimes.service.ts`, `regimes-vigencia.ts`, `exportacao-csv.ts`, `dto/*.ts`);
`src/app.module.ts`; `src/realtime/{room-permissoes.ts,realtime.gateway.ts,realtime.hub.ts,events/eventos.ts}`;
`test/helpers/test-app.ts` (TRUNCATE das seis tabelas antes de `auditoria`, filhas primeiro);
`test/unit/{cnpj-alfanumerico,cnae,fiscal-empresas-dto,regimes-vigencia,room-permissoes,realtime-gateway-rooms}.spec.ts`;
`test/integration/e01-t01-{migrations,empresas,cnaes,alteracoes,regimes,concorrencia,eventos}.e2e-spec.ts`;
`test/integration/perfis-menus.e2e-spec.ts`.
Frontend (`app/frontend/`): `src/app/(admin)/fiscal/empresas/page.tsx`; `src/app/(admin)/layout.tsx`;
`src/lib/{fiscal-empresas.ts,menu-v2.ts}`; `src/components/ui/app-sidebar.tsx`; `src/components/fiscal/empresas/*.tsx`;
`src/app/api/erp/fiscal/**/route.ts`; `__tests__/{fiscal-empresas-lib,bff-e01-t01,empresas-estabelecimentos-client,
menu-v2,menu-rbac}.test.ts(x)`; `e2e/e01-t01-empresas.spec.ts`; `e2e/shell-ds.spec.ts`; `e2e/capture-e01-t01-evidencias.spec.ts`;
`e2e/helpers/e01-t01-seed.ts`. Evidências: `docs/evidencias/e01-t01/*.png`.
Proibido tocar fora desta lista.


## 13. Mapa DoD → teste

| Critério (fonte) | Teste (arquivo · nome) |
|---|---|
| DoD (1) CRUD/ações (Caderno B L57) | e01-t01-empresas · "empresa: criar, editar, listar, remover"; "estabelecimento DRAFT→REVIEW→APPROVED→SUSPENDED→REVIEW"; "rejeitar e editar volta a DRAFT"; e01-t01-regimes · "criar, editar, submeter, aprovar, rejeitar, remover" |
| DoD (2) campos e validações | cnpj-alfanumerico · vetores numéricos, vetor alfanumérico oficial RFB (Task 0), minúsculas; fiscal-empresas-dto · "IE/IM normalizados", "UF inválida", "CRT 5", "fim < início", "strict rejeita empresaId/cnpj/municipioIbgeCodigo", "justificativa vazia"; e01-t01-empresas · "raiz divergente → 422", "CNPJ duplicado → 409", "raiz duplicada → 409" |
| CNAE formato (AD-24 (3)) | cnae · "`6201-5/01` e `6201501` → `6201501`", "6 ou 8 dígitos, letras → inválido", "mascararCnae"; fiscal-empresas-dto · "código fora do formato → 400" |
| CNAE duplicidade e principal único | e01-t01-cnaes · "código repetido → 422 CNAE_DUPLICADO"; "dois principais → 422 CNAE_PRINCIPAL_UNICO"; "aprovar sem principal → 422 CNAE_PRINCIPAL_AUSENTE"; "trocar principal na mesma lista → 200"; "PUT cnaes com estabelecimento APPROVED → 409 ALTERACAO_EXIGIDA, REVIEW → 409 TRANSICAO_INVALIDA, SUSPENDED → 409 TRANSICAO_INVALIDA, sem escrita em estabelecimento_cnaes nem em auditoria" (MENOR 2); e01-t01-migrations · "uq_estab_cnaes_principal e uq_estab_cnaes_codigo parciais (pg_indexes)"; "INSERT direto de 2º principal → 23505" |
| CNAE 403 e histórico | e01-t01-cnaes · "gestor → 403 em PUT cnaes"; "substituição grava DELETE/INSERT na auditoria com usuário e justificativa; linha removida mantém deleted_at"; "histórico lista objeto cnae com usuarioNome"; "nenhuma chamada HTTP externa (fetch espionado)" |
| Município/Certificado provisórios (AD-24 (2)) | e01-t01-empresas · "aprova com municipio_ibge_codigo nulo"; "pré-condições MUNICIPIO_INFORMADO/CERTIFICADO_VINCULADO provisoria=true"; client · "campos com selo Provisório e sem bloqueio"; e01-t01-migrations · "coluna municipio_ibge_codigo nullable; nenhuma coluna certificado" |
| B3 alteração pendente | e01-t01-alteracoes · "PATCH em APPROVED → 409 ALTERACAO_EXIGIDA"; "criar alteração: estabelecimento continua APPROVED com valores antigos"; "dadosFiscaisVigentes durante REVIEW = valores aprovados"; "aprovar aplica nome/IE/IM/UF e CNAEs e incrementa versao"; "rejeitar mantém linha e CNAEs aprovados idênticos (comparação campo a campo)"; "segunda alteração aberta → 409 ALTERACAO_EM_ABERTO"; "versao_base desatualizada → 409 ALTERACAO_DESATUALIZADA"; "segregação → 422"; "gestor → 403"; "remover estabelecimento (APPROVED → SUSPENDED → REVIEW → REJECTED) com alteração DRAFT/REVIEW aberta: alteração e CNAEs propostos ficam com deleted_at na mesma transação, 1 auditoria DELETE por linha, e nenhuma alteração aberta resta (uq_estab_alteracoes_aberta livre)" (MENOR 3) |
| DoD (3) recarregar | e01-t01-empresas · "GET detalhe após cada transição devolve situação, responsável, CNAEs e regime persistidos" |
| DoD (4) autorização | e01-t01-empresas · "gestor sem FISCAL_* → 403 em toda rota"; "mesmo usuário aprova → 422 SEGREGACAO_FUNCAO"; "segundo administrador → 200"; perfil-permissoes-snapshot |
| DoD (5) falha externa | não se aplica: sem serviço externo (certificado/catálogos fora; CNAE sem consulta) |
| DoD (6) auditoria/reversão | e01-t01-empresas · "cada mutação grava 1 auditoria"; "histórico sem nome de tabela nem id"; "aprovado não removível → 409; suspender é a reversão" |
| DoD (7) Playwright e acessibilidade | e01-t01-empresas.spec · jornada, 403, teclado e nomes acessíveis (Task 13); capture-e01-t01-evidencias.spec (Task 14) |
| DoD (8) interoperabilidade | e01-t01-empresas · "dadosFiscaisVigentes null sem aprovação; valor com cnaePrincipal"; "empresaAtiva/listarEmpresasAtivasIds"; suítes completas verdes |
| Menu 39 + 1 (AD-24 (1)) | menu-v2 · "10 grupos com FISCAL na 8ª posição", "39 itens originais idênticos", "40 no total", "page.tsx existe"; menu-rbac · "matriz v1.1 + ERP = 127", "gestor sem FISCAL", "item com permissão some sem permissão", "menu FISCAL atribuído sem FISCAL_EMPRESAS_LER não aparece" (MENOR 5); perfis-menus.e2e · 39/40; shell-ds.spec (Playwright) · "menu do administrador tem os 10 grupos na ordem do prototipo" com `FISCAL` na 8ª posição (B2) |
| Catálogo de permissões (B1) | perfis-menus.e2e · "GET /perfis/catalogo devolve o módulo Fiscal com FISCAL_EMPRESAS_APROVAR, FISCAL_EMPRESAS_GERENCIAR e FISCAL_EMPRESAS_LER e suas descrições" e "catalogo de permissoes cobre todo o mapa de descricoes" (existente, verde); onda3-cadastros-branches.spec · `service.catalogo()` sem lançar (existente, verde) |
| Regra: sem identificação | fiscal-empresas-dto · "sem CNPJ/razão social"; e01-t01-migrations · "CHECKs de formato e preenchimento" |
| Regra: regime sobreposto (L55) | regimes-vigencia · livre/troca/sobreposto/limites; e01-t01-regimes · "sobreposição com REVIEW → 409"; "APPROVED com fim futuro interceptado → 409 REGIME_SOBREPOSTO e vigencia_fim inalterada" (MENOR 5) |
| Negativo: troca (L56) | e01-t01-regimes · "sem confirmação → 409 sem mutação"; "confirmada e aprovada fecha anterior em D−1 na mesma transação"; "estabelecimento não aprovado → 422" |
| Negativo: competência bloqueada | H-E01-05 |
| D-E01 / tenant | e01-t01-migrations · "uq_estabelecimentos_id_empresa não parcial (pg_constraint)"; "regime/CNAE/alteração com empresa_id divergente → 23503"; "substitui_regime_id de outro estabelecimento → 23503"; e01-t01-empresas · "filtro de outra empresa → 422"; "regimeId/altId de outro estabelecimento → 404" |
| Imutabilidade | e01-t01-empresas · "PATCH com id/empresaId/cnpj/cnpjRaiz → 400; linha inalterada" |
| Concorrência | e01-t01-concorrencia · "2 POST mesmo CNPJ → [201,409]"; "2 PATCH mesma versao → [200,409]"; "2 PUT cnaes mesma versao → [200,409]"; "2 POST alteracoes → [201,409]"; "2 submissões sobrepostas → [200,409]"; "2 aprovações sobrepostas → 1 APPROVED"; "aprovar alteração × suspender → um vence, outro 409" |
| Eventos (Princípio VI) | e01-t01-eventos · "1 evento depois do commit"; "409/422 não emitem"; "troca emite dois"; "aprovar alteração emite alteracao_aprovada" |
| Room protegida | room-permissoes · mapeamento; realtime-gateway-rooms · "assina com permissão", "sem permissão não entra", "rooms legadas inalteradas", "broadcastRoom de room não registrada lança", "socket com exp vencido removido antes do envio", "hub.membros/remover" |
| UX estados e cascata | client · "carregando/vazio/erro com retry"; "trocar empresa limpa estabelecimento"; "409 CONFLITO_CONCORRENTE"; "challenge de troca reenvia"; "cnaes-editor: máscara, principal único na UI, erros 422 na linha, aviso de conferência"; "alteração pendente exibida ao lado do aprovado"; "nenhum UUID renderizado"; "mensagem WS refaz a lista" |
| BFF | bff-e01-t01 · "repassa 409/422"; "CSV mantém text/csv"; "ação fora da allowlist → 404 sem backend" |
| Cobertura ≥ 80% | `npm run test:cov` + `node scripts/check-coverage.mjs --min 80` |


## 14. Tasks

Comandos a partir de `F:\Projetos\AlphaCarnes\.worktrees\e01-t01`. Banco de teste dedicado (os testes truncam):

```powershell
docker compose up -d postgres
docker compose exec postgres psql -U alphacarnes -d alphacarnes -c "CREATE DATABASE alphacarnes_e01"
$env:DATABASE_URL = 'postgres://alphacarnes:alphacarnes@localhost:15433/alphacarnes_e01'
```
Saída esperada: `CREATE DATABASE` (ou "already exists"). Cada task: teste, ver falhar, implementar, ver passar,
commitar só os paths da task (`git add <paths>`).

### Task 0 — Context7 e leitura obrigatória (sem commit)
1. Context7 (`resolve-library-id` + `get-library-docs`): NestJS 11 "HttpException object response"; Drizzle 0.45
   "foreignKey composite, unique, uniqueIndex where, date mode string, for no key update, transactions"; Next 16
   "route handlers, NextResponse text/csv, server components redirect"; Playwright "getByRole, keyboard,
   screenshot fullPage". Registrar as APIs usadas no relatório do PR.
2. Ler: linhas de §4; `fornecedores.controller.ts`/`.service.ts`;
   `app/backend/src/modules/comercial/precos/precos.service.ts` L240–L300; `realtime.gateway.ts`, `realtime.hub.ts`,
   `modules/auth/token.service.ts`; `modules/usuarios/usuarios.controller.ts` (criação de usuário para o e2e);
   `lib/bff.ts`, `fornecedores-client.tsx`, `badge-provisorio.tsx`, `combobox-field.tsx`, `date-picker-field.tsx`,
   `use-erros-campo.ts`; `e2e/capture-onda8-evidencias.spec.ts`, `e2e/helpers/onda10-seed.ts`,
   `playwright.config.ts`; challenge 409:
   `Get-ChildItem app/backend/src -Recurse -Filter *.ts | Select-String 'OVERBOOKING_CONFIRMACAO_NECESSARIA'`.
3. `web_fetch` da página RFB de doc 20 L64: algoritmo de DV alfanumérico e exemplo oficial para a Task 1.

### Task 1 — Validadores de CNPJ alfanumérico e CNAE
Files: `common/validators/{cnpj-alfanumerico,cnae}.ts`, `test/unit/{cnpj-alfanumerico,cnae}.spec.ts`.
CNPJ: `normalizarCnpj` (remove `.`, `/`, `-`, espaços; maiúsculas); `validarCnpjAlfanumerico` (`^[0-9A-Z]{12}[0-9]{2}$`,
rejeita 14 caracteres iguais, valor = ASCII − 48, pesos 2..9 cíclicos da direita, DV = resto < 2 ? 0 : 11 − resto,
conferido com a RFB); `raizCnpj` = 8 primeiros. CNAE: `normalizarCnae`, `validarFormatoCnae` (`^[0-9]{7}$`),
`mascararCnae` (`0000-0/00`).
```powershell
Set-Location app/backend; npx jest test/unit/cnpj-alfanumerico.spec.ts test/unit/cnae.spec.ts
```
Commit: `feat(e01-t01): validadores de CNPJ alfanumérico e formato CNAE`.

### Task 2 — Schema, migration e testes de banco
Files: schema §5, `index.ts`, migration, `ROLLBACK.md`, `test/helpers/test-app.ts`, `e01-t01-migrations.e2e-spec.ts`.
```powershell
Set-Location app/backend
npx drizzle-kit generate --name e01_t01_empresas_estabelecimentos
$novas = 'empresas|estabelecimentos|estabelecimento_cnaes|estabelecimento_alteracoes|estabelecimento_alteracao_cnaes|regimes_tributarios'
$permitido = "^(CREATE TABLE ""($novas)""|CREATE (UNIQUE )?INDEX ""\w+"" ON ""($novas)""|ALTER TABLE ""($novas)"" ADD CONSTRAINT)"
Get-Content (Get-ChildItem src/database/migrations/*e01_t01*.sql) -Raw |
  ForEach-Object { $_ -split '--> statement-breakpoint' } | ForEach-Object { $_.Trim() } |
  Where-Object { $_ -and $_ -notmatch $permitido }
npm run db:migrate
npx jest test/integration/e01-t01-migrations.e2e-spec.ts
```
Esperado: um SQL novo; o pipeline de allowlist (MENOR 6) **sem saída** — qualquer statement listado (ALTER/DROP/
RENAME/UPDATE/DELETE/TRUNCATE/CREATE EXTENSION/TRIGGER ou sobre tabela existente) é critério de parada; migrate sem
erro; testes passam. `ROLLBACK.md`: seção "E01-T01" com as seis tabelas e §16. Commit:
`feat(e01-t01): schema fiscal de empresas, estabelecimentos, CNAEs, alterações e regimes (expand-only)`.

### Task 3 — Permissões, parâmetro, menu canônico e snapshots
Files: `permissoes.ts`, `menus-canonicos.ts`, os dois snapshots, `perfil.dto.ts`, `perfis.service.ts` (módulo
`Fiscal` em `catalogo()`, B1), `seed.ts`, `perfis-menus.e2e-spec.ts`.
```powershell
Set-Location app/backend
npx tsx scripts/gerar-snapshot-perfis.ts
git diff -U0 -- src/common/rbac/perfil-menus.snapshot.json src/common/rbac/perfil-permissoes.snapshot.json
git diff -U0 -- src/common/rbac/menus-canonicos.ts | Select-String "^-\s+'/"
npx jest test/unit/perfil-permissoes-snapshot.spec.ts test/unit/onda3-cadastros-branches.spec.ts test/integration/perfis-menus.e2e-spec.ts
npm run db:seed
```
Esperado: diffs dos snapshots só sob `administrador` (+ `/fiscal/empresas`, + três permissões); `Select-String` sem
saída (nenhuma das 39 rotas removida); testes passam, inclusive o caso novo de `GET /perfis/catalogo` com o módulo
`Fiscal` e o `onda3-cadastros-branches.spec.ts` sem alteração; seed sem erro. Commit:
`feat(e01-t01): permissões FISCAL_EMPRESAS_*, rota /fiscal/empresas no menu canônico e parâmetro H-E01-02`.

### Task 4 — DTOs Zod
Files: `dto/{empresa,estabelecimento,cnae,alteracao,regime,comum}.dto.ts`, `test/unit/fiscal-empresas-dto.spec.ts`.
Regras §6/§7; `cnpj` com `.transform(normalizarCnpj).refine(validarCnpjAlfanumerico, { message: 'CNPJ inválido:
confira os dígitos verificadores.' })`; `uf` com `ufBrasilSchema` (`dominios.dto.ts` L12); datas `z.iso.date()`.
```powershell
Set-Location app/backend; npx jest test/unit/fiscal-empresas-dto.spec.ts
```
Commit: `feat(e01-t01): DTOs Zod do cadastro fiscal`.

### Task 5 — Empresas, estabelecimentos e CNAEs
Files: `empresas.service.ts`, `estabelecimentos.service.ts`, `cnaes.service.ts`, os dois controllers,
`empresas-fiscais.module.ts`, `app.module.ts`, `events/eventos.ts`, `e01-t01-empresas.e2e-spec.ts`,
`e01-t01-cnaes.e2e-spec.ts`. `23505` capturado pelo nome da constraint (padrão `clientes.service.ts` L33); UPDATE com
`WHERE id = $1 AND versao = $2 AND deleted_at IS NULL`, `versao = versao + 1`, `updated_at = now()`; zero linhas →
409 `CONFLITO_CONCORRENTE` (ou 404). Listagem com `LEFT JOIN LATERAL` do regime vigente (D10). Usuários:
`createTestUser(app, { perfil: 'administrador' })` ×2 e `{ perfil: 'gestor' }`.
```powershell
Set-Location app/backend; npx jest test/integration/e01-t01-empresas.e2e-spec.ts test/integration/e01-t01-cnaes.e2e-spec.ts
```
Commit: `feat(e01-t01): API de empresas, estabelecimentos e CNAEs com aprovação segregada e auditoria`.

### Task 6 — Alteração pendente (B3)
Files: `alteracoes.service.ts`, rotas em `estabelecimentos.controller.ts`, `e01-t01-alteracoes.e2e-spec.ts`.
O `remover` de `estabelecimentos.service.ts` passa a soft-deletar também a alteração aberta e seus CNAEs propostos na
mesma transação (MENOR 3, §6); caso coberto em `e01-t01-alteracoes.e2e-spec.ts`.
```powershell
Set-Location app/backend; npx jest test/integration/e01-t01-alteracoes.e2e-spec.ts
```
Commit: `feat(e01-t01): alteração pendente de estabelecimento aprovado`.

### Task 7 — Regimes tributários
Files: `regimes-vigencia.ts`, `regimes.service.ts`, rotas de regime, `test/unit/regimes-vigencia.spec.ts`,
`e01-t01-regimes.e2e-spec.ts`. Trava `.for('no key update')`; challenge sem escrita; troca na aprovação.
```powershell
Set-Location app/backend; npx jest test/unit/regimes-vigencia.spec.ts test/integration/e01-t01-regimes.e2e-spec.ts
```
Commit: `feat(e01-t01): regimes tributários por vigência com troca confirmada e sem sobreposição`.

### Task 8 — Concorrência e eventos
Files: `e01-t01-concorrencia.e2e-spec.ts`, `e01-t01-eventos.e2e-spec.ts` (`Promise.all` de `supertest`; espião em
`EventEmitter2.emit`). Correções de serviço ficam nos arquivos das Tasks 5–7.
```powershell
Set-Location app/backend; npx jest test/integration/e01-t01-concorrencia.e2e-spec.ts test/integration/e01-t01-eventos.e2e-spec.ts
```
Commit: `test(e01-t01): concorrência e eventos pós-commit do cadastro fiscal`.

### Task 9 — Room protegida
Files: `room-permissoes.ts`, `realtime.gateway.ts`, `realtime.hub.ts`, `test/unit/{room-permissoes,realtime-gateway-rooms}.spec.ts`.
```powershell
Set-Location app/backend; npx jest test/unit/room-permissoes.spec.ts test/unit/realtime-gateway-rooms.spec.ts
npx jest test/unit --testPathPattern realtime
```
Commit: `feat(e01-t01): room fiscal-empresas protegida por permissão (contrato E12 §3.13.6)`.

### Task 10 — Exportação, histórico, pré-condições e leitura fiscal
Files: `exportacao-csv.ts`, funções e rotas; casos em `e01-t01-empresas.e2e-spec.ts`.
```powershell
Set-Location app/backend; npx jest test/integration/e01-t01-empresas.e2e-spec.ts
```
Commit: `feat(e01-t01): exportação, histórico, pré-condições e leitura fiscal fail-closed`.

### Task 11 — BFF `/api/erp/fiscal`
Files em `app/frontend/src/app/api/erp/fiscal/`: `empresas/route.ts`, `empresas/[id]/route.ts`,
`estabelecimentos/{route,contagens/route,exportacao/route}.ts`, `estabelecimentos/[id]/route.ts`,
`estabelecimentos/[id]/[acao]/route.ts` (allowlist submeter·aprovar·rejeitar·suspender·reativar·historico·
pre-condicoes), `estabelecimentos/[id]/cnaes/route.ts` (PUT), `estabelecimentos/[id]/alteracoes/route.ts`,
`.../alteracoes/[altId]/route.ts`, `.../alteracoes/[altId]/[acao]/route.ts` (submeter·aprovar·rejeitar),
`estabelecimentos/[id]/regimes/route.ts`, `.../regimes/[regimeId]/route.ts`, `.../regimes/[regimeId]/[acao]/route.ts`
(submeter·aprovar·rejeitar); `__tests__/bff-e01-t01.test.ts`. JSON via `repassar` (`lib/bff.ts`); CSV via
`apiFetch` preservando `Content-Type`/`Content-Disposition`; fora da allowlist → 404.
```powershell
Set-Location app/frontend; npx jest __tests__/bff-e01-t01.test.ts
```
Commit: `feat(e01-t01): rotas BFF /api/erp/fiscal`.

### Task 12 — Página, componentes e menu no frontend
Files: `page.tsx`, `(admin)/layout.tsx`, `lib/{fiscal-empresas,menu-v2}.ts`, `app-sidebar.tsx`,
`components/fiscal/empresas/*.tsx`, `__tests__/{fiscal-empresas-lib,empresas-estabelecimentos-client,menu-v2,menu-rbac}.test.ts(x)`.
```powershell
Set-Location app/frontend
npx jest __tests__/fiscal-empresas-lib.test.ts __tests__/empresas-estabelecimentos-client.test.tsx __tests__/menu-v2.test.ts __tests__/menu-rbac.test.ts __tests__/entrada.test.tsx
```
Commit: `feat(e01-t01): página /fiscal/empresas DS v3 e grupo Fiscal no menu`.

### Task 13 — Playwright: jornada e acessibilidade
Files: `e2e/helpers/e01-t01-seed.ts` (padrão `onda10-seed.ts`: `request.fetch` ao backend; cria um segundo
administrador e um usuário `gestor` pela API de usuários; CNPJs com DV válido gerados pelo validador da Task 1),
`e2e/e01-t01-empresas.spec.ts`; `e2e/shell-ds.spec.ts` ajustado conforme §9 (B2: `GRUPOS` com `'FISCAL'` na 8ª posição e título do
teste para 10 grupos). Stack: backend em `:4001` com seed; frontend pelo `webServer` do
`playwright.config.ts`.
- Jornada (admin A): menu FISCAL → "Empresas, estabelecimentos e regime"; nova empresa; estabelecimento com CNAE
  principal digitado `6201-5/01` e secundário `6202300`; submeter. Admin B: aprovar. A: regime CRT 3; B: aprova.
  A: nova versão com início posterior → confirmação de troca → B aprova → anterior com fim D−1 na aba
  Movimentações. A: alteração (nome + novo CNAE secundário) → submeter; ficha mostra aprovado + "Alteração aguardando
  revisão"; B rejeita → ficha inalterada; nova alteração aprovada → valores novos. Município/Certificado com
  "Provisório" visível. Mesmo usuário aprovando → mensagem de segregação.
- Autorização: `gestor` não vê o grupo FISCAL; `goto('/fiscal/empresas')` mostra a mensagem sem permissão.
- Acessibilidade (sem dependência nova): todo `textbox`/`combobox`/`button` visível da tela e dos drawers tem nome
  acessível não vazio (`getByRole` + `evaluate` do nome computado via `aria-label`/`labels`); grid operável só por
  teclado (Tab até a linha, Enter seleciona, foco visível); drawers/diálogos fecham com Escape e devolvem o foco;
  `innerText` do `body` sem UUID (`/[0-9a-f]{8}-[0-9a-f]{4}-/i`) e sem código `/E\d{2}-T\d{2}/`.
```powershell
Set-Location app/frontend; npx playwright test e2e/e01-t01-empresas.spec.ts e2e/shell-ds.spec.ts
```
Esperado: todos os testes passam (saída anexada ao PR; Playwright não é job do `ci.yml`, o Monitor reexecuta).
Commit: `test(e01-t01): Playwright de jornada, autorização e acessibilidade`.

### Task 14 — Screenshots comparativos
File: `e2e/capture-e01-t01-evidencias.spec.ts` (padrão `capture-onda8-evidencias.spec.ts`: assert de elemento-chave
antes de cada captura, fail-hard). Viewport 1280×800, `fullPage`. Pares em `docs/evidencias/e01-t01/`:
`app-<estado>.png` (página real) e `prototipo-<estado>.png` (`file:///<worktree>/docs/prototipos/erp-integrado-v1/index.html#E01-T01`,
mesma aba/drawer) para: lista, ficha, movimentações, regras, exceções, histórico, integrações, aceite, drawer de
cadastro, diálogo de regime, diálogo de decisão; só app: vazio, erro com retry, 403, alteração pendente, editor de
CNAE com erro de duplicidade.
```powershell
Set-Location app/frontend; npx playwright test e2e/capture-e01-t01-evidencias.spec.ts
Get-ChildItem ../../docs/evidencias/e01-t01 -Filter *.png | Measure-Object
```
Esperado: 27 arquivos (11 pares + 5). Commit: `docs(e01-t01): evidências visuais app × protótipo`.

### Task 15 — Gate local completo e PR
```powershell
npm ci; npm run lint; npm run type-check; npm run test; npm run build
Set-Location app/backend; npm run test:cov
Set-Location ../frontend; npm run test
Set-Location ../..; node scripts/check-coverage.mjs --min 80
git diff --name-only origin/develop...HEAD
```
Esperado: verdes; cobertura ≥ 80% linha e branch (passo do `ci.yml` L97); arquivos ⊆ §12 (sem `docs/execucao/**`).
`git push -u origin feature/erp-e01-t01-empresas-estabelecimentos`; PR para `develop`: `feat(e01-t01): empresas,
estabelecimentos, CNAE e regime tributário`; corpo com resumo, comandos/saídas (inclusive Playwright), mapa §13,
remoções autorizadas §4, tabela de screenshots, pendências §18 e "classe de risco: alto (Portão A obrigatório)".


## 15. Gate e evidências para o Portão 2/A
- Relatório no formato `pipeline-execucao.md` §7: task a task (desvios listados), saídas de teste e Playwright,
  cobertura, APIs do Context7.
- Portão 2 compara os pares `app-*`/`prototipo-*` (Task 14), confere as remoções autorizadas (§4) e reexecuta
  Playwright e os testes de menu (39 + 1). Portão A obrigatório (classe alto).
- Executor (MENOR 3): registra `onda-e01-t01` com link para este plano em `docs/execucao/EXECUCAO-STATUS.md` ao
  disparar a onda (coordenação neutra AD-22 (5)); o Worker não toca `docs/execucao/`.

## 16. Rollback
- Código: revert dos commits da fatia por PR (sem force-push); o revert devolve `MENUS_CANONICOS` às 39 rotas e o
  próximo seed reconcilia `menus_visiveis`.
- Banco: só tabelas folha (nenhuma FK externa aponta para elas até E12-T01/E06-T01). Dev/CI sem dados: remover o
  schema e gerar a migration de remoção com `drizzle-kit generate` (nunca SQL manual). Com linhas: não remover;
  tabelas ficam inertes e abre-se decisão do QO. Seed: chave `fiscal.empresas_perfis_autorizados` e permissões saem
  só junto do revert.

## 17. Critérios de parada (PARAR e reportar ao coordenador)
- Allowlist da Task 2 lista algum statement; migration exige SQL manual, trigger ou extensão.
- Drizzle-kit não gera a FK composta autorreferente, os índices únicos parciais ou o `UNIQUE (id, empresa_id)`
  não parcial.
- Página RFB sem algoritmo ou exemplo oficial de DV alfanumérico.
- Qualquer das 39 rotas originais muda de href, rótulo, grupo ou ordem relativa.
- Teste falha após uma correção; caso não coberto; regra que exija decidir produto (CRT por empresa, quórum,
  perfis, obrigatoriedade de Município/Certificado, fechamento de competência).
- Alteração necessária fora de §12 (inclusive `LEITURA_CADASTROS`, `documento-fiscal.ts`, outra room).
- `room-permissoes.ts` já existente em `develop` com API diferente da §3.13.6 (se igual, adotar).

## 18. Pendências e dependências (nenhuma decisão inventada)

| ID | Pendência | Dono | Bloqueia | Tratamento até a decisão |
|---|---|---|---|---|
| H-E01-02 | Quais dos 11 perfis, além do administrador, recebem `FISCAL_EMPRESAS_*` (e o item de menu) | Quality Owner | atribuição a outros perfis | seed só administrador; parâmetro `provisorio: true` + badge; edição runtime em `/admin/perfis` |
| H-E01-03 | Dados reais (CNPJ, IE, IM, CNAEs, CRT, vigências); confirmação do domínio CRT/código 4; validação de IE por UF | Titular + contador | carga real | nenhum seed de dado real; IE/IM só normalizados |
| H-E01-05 | Regra de competência bloqueada | Contador + planner E09-T08 | exceção "competência bloqueada" | sem bloqueio; E09-T08 acrescenta a verificação no `RegimesService` |
| DEP-E12-T08 | Catálogo de municípios para gravar `municipio_ibge_codigo` | planner E12-T08 | seleção de Município | coluna reservada nula; campo com `BadgeProvisorio`; não bloqueia aprovação (AD-24 (2)) |
| DEP-E12-T03 | Tabela de certificados; coluna `certificado_id` + FK por expand | planner E12-T03 | vínculo de certificado | sem coluna; campo com `BadgeProvisorio`; não bloqueia aprovação (AD-24 (2)) |
| H-15 (E12-T00) | Confirmação do critério "empresa ativa" (D15) | planner E12-T01 | consumo pela porta P5 | contrato proposto exportado e testado |

## 19. Self-review
- Uma fatia E2E (página → BFF → API → PostgreSQL → eventos/WS), classe alto justificada; sem HEAD, contagem ou SHAs.
- AD-24 (1) rota/grupo/item/Playwright/screenshots; (2) Município/Certificado provisórios sem bloqueio; (3) CNAE
  manual com formato, duplicidade, principal único, histórico e responsável — todos com teste (§13).
- B3: aprovado só muda na aprovação da alteração; rejeição preserva; leitura fiscal estável (§6, §13).
- D-E01 (D2, §5) e E11 §5.3 (D2, D14) atendidas; 39 rotas preservadas com verificação (Task 3, §17).
- Nenhuma regra fiscal, perfil ou obrigatoriedade decidida sem fonte; lacunas em §18.
