# Onda 7 — Desossa e Transformação — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Workers: papel `worker` em `.codex/agents/worker.toml`. Executar task a task sem reabrir decisões.

**Goal:** Fechar as três rotas de Desossa (matriz linhas 17–19) com backend transacional (bind de regra + exclusividade, checklist esperado×registrado, divergência formal), painel aeroporto/Modo TV por eventos WebSocket (zero poll), seed das regras A/B provisórias com Badge Provisório, e UIs idênticas ao protótipo — sem inventar AD para P6/P12.

**Architecture:** Extensão do módulo F4c já existente (`modules/operacao/corte` + `modules/operacao/desossa`). Não nasce módulo paralelo: `transformacoes` ganha `regra_transformacao_id`; nasce `divergencias_transformacao`; painel novo em `GET /desossa/painel`; eventos novos no catálogo RA-04 e no gateway WS. Frontend substitui PlaceholderPage e remove o `setInterval(60s)` do dashboard. Seed idempotente das regras TZ A/B no `db:seed`.

**Tech Stack:** NestJS 11 + TypeScript 5 strict, Drizzle ORM (PostgreSQL 18, `uuidv7()`), Zod 4, WebSocket nativo + `@nestjs/event-emitter`, Jest (unit/integration com Postgres efêmero + fakes), Next.js 16 App Router (BFF) + React 19 + Playwright e2e.

**Base tip:** `origin/develop` @ `fc2c6da` (Onda 6 mergeada). Próxima migration: `0023`. Protótipo pinado: `F:\Projetos\alpha-carnes-prototipo` @ `feature/completude-v1.1` `8d32aa4c`. PR `#38` (`feature/onda7-desossa`) foi CLOSED — este plano é do zero; não reabrir.

---

## Global Constraints

- Constituição: Princípio I (fidelidade absoluta ao protótipo), II (completude E2E), V (gateways/fakes), VIII (não inventar pendência), RA-01..06.
- Regras de negócio só no backend (RA-01); mutações críticas em transação + auditoria (RA-02); hardware via gateways + fake (RA-03); tempo real por eventos pós-commit, **sem poll** (RA-04); sem falha silenciosa / sem inventar peso (RA-05/06).
- Terminologia: zero "Marca" em UI/código (v1.1 §6.8).
- P6 (§16.7 momento da escolha da regra) e P12 (§16.15 outras transformações além do TZ) permanecem abertos → **parâmetro + Badge Provisório**. Proibido gravar AD-xx em `DECISOES.md` nesta onda.
- AD-01 (boi casado 2+2+2) já seedado em desdobramento comercial — fora do badge Provisório; não reabrir.
- Coverage backend ≥80% linha **e** branch nos services tocados; CI 8/8 verde.
- Migrations: expand gerado por drizzle-kit; never ALTER TABLE manual fora da cadeia.

---

## Escopo

| # | Entrega | Matriz |
|---|---|---|
| E7.1 | `GET /desossa/painel?modoTv=` (payload aeroporto + visão por regra) + evento `FALTAS_DESOSSA_ATUALIZADAS` | 17 |
| E7.2 | Dashboard `/desossa/dashboard` fiel ao protótipo, Modo TV, **WS sem poll** | 17 |
| E7.3 | Bind `POST /operacao/corte/:id/regra` com exclusividade por unidade de TZ | 18 |
| E7.4 | `GET /operacao/corte/:id/checklist` (esperado × registrado) | 18 |
| E7.5 | `POST /operacao/corte/:id/divergencia` + tabela `divergencias_transformacao` + fila de aprovações | 18 |
| E7.6 | Gate: gerar subitem exige regra; saídas fora da regra → 409 | 18 |
| E7.7 | UI `/desossa/pesagem-destinacao` fiel (`DesossaPesagem.tsx`) | 18 |
| E7.8 | UI `/desossa/etiquetas` fiel (`DesossaEtiquetas.tsx`) + listagem com peça mãe e `invalidada_por_troca` | 19 |
| E7.9 | Seed idempotente regras A/B provisórias + Badge Provisório (P12) + parâmetro P6 | 18 / dívida O3 |
| E7.10 | RBAC + testes DoD O7 (exclusividade, checklist, divergência, painel TV por eventos) | — |

## Fora de escopo

- Onda 8 (estoque FIFO/ajustes), Onda 9 (carga/expedição UI), Onda 10 (EISS real).
- Produção de bandejas, embalagem, custos, etiquetas de varejo (v1.1 §6.14.5).
- Fechar P6/P12 com AD em `DECISOES.md`.
- Reabrir PR `#38` ou PRs fictícios `#37`–`#41`.
- Alterar contrato Onda 6 de `GET /operacao/etiquetas` que exige `recebimentoId`. Desossa ganha `GET /desossa/etiquetas` que **reusa** a lógica de `EtiquetaService`.
- Refatoração ampla do F4c além do mínimo para bind/checklist/divergência.

---

## Rotas da onda (matriz de rastreabilidade v1.1)

| Rota FE | Tela real (alvo) | Protótipo |
|---|---|---|
| `/desossa/dashboard` | `app/frontend/src/app/(admin)/desossa/dashboard/desossa-dashboard-client.tsx` | `src/app/pages/DesossaDashboard.tsx` |
| `/desossa/pesagem-destinacao` | `app/frontend/src/app/(admin)/desossa/pesagem-destinacao/desossa-pesagem-client.tsx` (**criar**) | `src/app/pages/DesossaPesagem.tsx` |
| `/desossa/etiquetas` | `app/frontend/src/app/(admin)/desossa/etiquetas/desossa-etiquetas-client.tsx` (**criar**) | `src/app/pages/DesossaEtiquetas.tsx` |

## Reconciliação matriz → plano (bloqueante Portão 1)

| Linha matriz | Endpoint / entrega no plano | Task |
|---|---|---|
| 17 | `GET /desossa/painel?modoTv=` + evento `FALTAS_DESOSSA_ATUALIZADAS` + UI dashboard/TV sem poll | T3, T7, T8, T11 |
| 18 | `POST /operacao/corte/:id/regra`, `GET .../checklist`, `POST .../divergencia` + UI pesagem + seed A/B | T1–T6, T9, T12 |
| 19 | `GET /desossa/etiquetas` + UI com peça mãe e `invalidada_por_troca` | T10, T13 |
| (dívida O3 seed) | Seed regras A/B em `regras_transformacao` (+ saídas) com `provisorio=true` | T2 |
| (não-escopo) | Linha 36 cadastro regras — CRUD/simulador já existem; O7 só garante seed + badge na operação | — |

## Contrato de rotas — path literal

| Método | Path | Permissão | Notas |
|---|---|---|---|
| `GET` | `/desossa/painel` | `DESOSSA_PAINEL_LER` | Query: `modoTv` (bool), `operacaoId?`. Perfis leitores recebem essa permissão junto com `DESOSSA_LER` (D7.8). |
| `GET` | `/desossa/faltas` | `DESOSSA_LER` | Mantido (compat); painel é a fonte canônica da tela |
| `GET` | `/desossa/etiquetas` | `DESOSSA_LER` | Query: `operacaoId` obrigatório, `transformacaoId?`, `estado?`, `page`, `pageSize` |
| `POST` | `/operacao/corte/:id/regra` | `CORTE_GERENCIAR` | Body: `{ regraTransformacaoId: uuid }` |
| `GET` | `/operacao/corte/:id/checklist` | `CORTE_GERENCIAR` | Esperado × registrado |
| `POST` | `/operacao/corte/:id/divergencia` | `CORTE_GERENCIAR` | Abre `aprovacoes_operacionais.tipo='divergencia_transformacao'` |
| (F4c existentes) | iniciar / subitens / pesar / associar / concluir | `CORTE_GERENCIAR` | Passam a respeitar regra/checklist |

### Eventos WS (pós-commit, RA-04)

| Constante | String wire | Rooms | Quando |
|---|---|---|---|
| `EVENTOS.FALTAS_DESOSSA_ATUALIZADAS` | `faltas_desossa_atualizadas` | `dashboard`, `desossa`, `operacao:{data}` | Após mutação que altere faltas/painel |
| `EVENTOS.DIVERGENCIA_TRANSFORMACAO_ABERTA` | `divergencia_transformacao_aberta` | `dashboard`, `desossa`, `operacao:{data}` | Após INSERT divergência + aprovação |
| (já existem) | `corte_iniciado`, `subitem_gerado`, `subitem_pesado`, `subitem_associado`, `corte_concluido` | existentes | Dashboard também escuta para refetch |

**Proibido:** `setInterval` / poll HTTP no dashboard ou Modo TV. Reconexão WS chama refetch pontual (`onReconnect`), igual `gestao/dashboard/dashboard-client.tsx`.

---

## Referências do protótipo (`F:\Projetos\alpha-carnes-prototipo` @ `feature/completude-v1.1` `8d32aa4c`)

| Tela app | Arquivo protótipo | Blocos obrigatórios (fidelidade) |
|---|---|---|
| Dashboard | `src/app/pages/DesossaDashboard.tsx` (722 linhas) | Header + KPIs; tabela "Itens a produzir"; seção "Sugestão por regra"; alertas; drawers Item/Regra/TZ; **Modo TV** (`TVMode`); copy "Não representa produção em andamento" |
| Pesagem | `src/app/pages/DesossaPesagem.tsx` (943 linhas) | TZ origem + seletor regra A/B com **Badge Provisório**; exclusividade após 1ª saída; checklist de slots; captura peso; destino pedido/estoque; modal etiqueta (peça mãe); modal finalizar com divergência tipada |
| Etiquetas | `src/app/pages/DesossaEtiquetas.tsx` (742 linhas) | KPIs; filtros; coluna **Peça mãe (TZ)**; drawer `Invalidada por troca`; zero mock seed do protótipo em runtime |

Tokens/cores: reutilizar DS Onda 2. Hex do protótipo só via tokens existentes. Grep de hex avulso nas telas novas = falha do DoD de fidelidade.

---

## Decisões de design (fixadas — só reabrir se houver quebra)

**D7.1 — `transformacoes.regra_transformacao_id` nullable no banco, obrigatória antes de gerar saídas.**
P6 permite escolha na entrada **ou** na saída. Coluna `NULL` ao `iniciar`; enforcement no service antes de `SubitemService.adicionar` → 409 `REGRA_TRANSFORMACAO_OBRIGATORIA`. Sem CHECK SQL `NOT NULL` (quebraria o fluxo "escolher na saída").

**D7.2 — Exclusividade por unidade (v1.1 §6.6).**
`POST /operacao/corte/:id/regra` grava a FK. Troca de regra só com zero subitens ativos. Após 1ª saída → 409 `REGRA_BLOQUEADA_APOS_SAIDA`. `adicionar` só aceita `itemComercialId` presente nas saídas da regra (via `produtos.legado_item_comercial_id`); senão 409 `SAIDA_FORA_DA_REGRA`.

**D7.3 — Checklist = saídas da regra × subitens registrados.**
Para cada `regras_transformacao_saidas`: `esperado = quantidade_fixa`, `registrado = count(subitens ativos do produto/item)`. Status: `pendente | parcial | completo | excedente`. Concluir com checklist divergente **sem** divergência formal aberta → 409 `CHECKLIST_DIVERGENTE`.

**D7.4 — `divergencias_transformacao` + reuso de `aprovacoes_operacionais`.**
Tabela nova (mestre §3.5). Tipos CHECK: `subpeca_faltante | subpeca_excedente | produto_diferente | perda_informada`. Na mesma TX: INSERT divergência + `AprovacoesService.abrirNaTx` com `tipo='divergencia_transformacao'` (já no CHECK Onda 5). Evento `DIVERGENCIA_TRANSFORMACAO_ABERTA` pós-commit.

**D7.5 — P6/P12 sem AD (Princípio VIII).**
- Parâmetro seed `desossa.momento_escolha_regra` = `{ valor: 'ambos', opcoes: ['entrada','saida','ambos'], provisorio: true, pendencia: 'P6' }`.
- Regras A/B seedadas com `provisorio=true`; UI exibe Badge Provisório com `title` citando P12/§16.15.
- Estrutura de regras já genérica (`produto_origem_codigo`); só TZ é seedado (P12).

**D7.6 — Painel vs faltas.**
`GET /desossa/faltas` permanece. `GET /desossa/painel` agrega itens a produzir, sugestões por regra ativa, alertas derivados; `modoTv=true` devolve payload enxuto (protótipo `TVMode` só lista itens). Cálculo puro em `painel.calc.ts`.

**D7.7 — RA-04 no dashboard.**
Remover `setInterval(..., 60_000)` de `desossa-dashboard-client.tsx`. Usar `conectarRealtime` com rooms `['desossa','dashboard']`. Refetch em `faltas_desossa_atualizadas`, eventos de corte e `onReconnect`.

**D7.8 — RBAC telão.**
Nova permissão `DESOSSA_PAINEL_LER`. Atribuída a: `administrador`, `gestor`, `corte`, `comercial`, `diretoria`. Esses perfis também recebem/mantêm `DESOSSA_LER` (matriz: comercial consulta). `@RequirePermissoes('DESOSSA_PAINEL_LER')` no painel.

**D7.9 — Etiquetas desossa sem furar contrato O6.**
`GET /operacao/etiquetas` permanece exigindo `recebimentoId`. Novo `GET /desossa/etiquetas?operacaoId=` lista etiquetas de subitens da operação com `pecaMaeCodigo`, `transformacaoId`, `estado`.

**D7.10 — Emissão de `FALTAS_DESOSSA_ATUALIZADAS`.**
Emitir pós-commit em: `SubitemService.associar`, `CorteService.concluir`, bind de regra. Payload: `{ dataOperacao, motivo: string }`. Painel faz refetch completo (sem patch otimista inventado).

**D7.11 — Migration única expand `0023` (sem contract).**
Onda aditiva: coluna FK + `provisorio`/`codigo` em regras + tabela `divergencias_transformacao`. Seed de regras A/B e parâmetro P6 no `db:seed` (idempotente), não na migration DML.

**D7.12 — Fidelidade: zero seed mock do protótipo no FE.**
Nenhum `ITENS_SEED` / `REGRAS_SEED` / `ETQ_SEED` do protótipo como dado de runtime.

**D7.13 — Listagem de peças elegíveis à desossa.**
Se não existir endpoint de listagem de peças `para_corte` / em desossa por operação, Task 12 cria `GET /operacao/corte/pecas-elegiveis?operacaoId=` mínimo (filtra `pecas.status_peca IN ('para_corte','em_transformacao')` da operação) — sem inventar estados fora do CHECK existente.

---

## Cadeia de migrations — `0023` expand gerado

Estado verificado em `fc2c6da`: journal idx 22 = `0022_onda6_etiqueta_estado_backfill`. Próximo: **`0023_onda7_desossa_expand`**.

### Delta de schema (fonte do generate)

**`transformacoes.schema.ts`** — adicionar:
```ts
import { regrasTransformacao } from './regras-transformacao.schema';
// no pgTable:
regraTransformacaoId: uuid('regra_transformacao_id').references(() => regrasTransformacao.id),
// indexes:
index('idx_transf_regra').on(t.regraTransformacaoId).where(sql`${t.deletedAt} IS NULL`),
```

**`regras-transformacao.schema.ts`** — adicionar:
```ts
codigo: text('codigo'),
provisorio: boolean('provisorio').notNull().default(false),
// uniqueIndex parcial codigo WHERE deleted_at IS NULL AND codigo IS NOT NULL
```

**Novo `divergencias-transformacao.schema.ts`:**
```ts
export const divergenciasTransformacao = pgTable(
  'divergencias_transformacao',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    transformacaoId: uuid('transformacao_id').notNull().references(() => transformacoes.id),
    tipo: text('tipo').notNull(),
    detalheJson: jsonb('detalhe_json').notNull().default(sql`'{}'::jsonb`),
    aprovacaoId: uuid('aprovacao_id').references(() => aprovacoesOperacionais.id),
    abertoPorId: uuid('aberto_por_id').notNull().references(() => usuarios.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check(
      'chk_diverg_transf_tipo',
      sql`${t.tipo} IN ('subpeca_faltante','subpeca_excedente','produto_diferente','perda_informada')`,
    ),
    index('idx_diverg_transf_transformacao').on(t.transformacaoId).where(sql`${t.deletedAt} IS NULL`),
  ],
);
```

### Proveniência (gate)

```bash
cd app/backend
npx drizzle-kit generate --name=onda7_desossa_expand
# Esperado: 0023_onda7_desossa_expand.sql + meta/0023_snapshot.json + journal idx 23
# Proibido: editar meta/_journal.json à mão; editar snapshot; CREATE/ALTER manual fora do generate
```

### Rollback

Onda aditiva. Emergência: `DROP TABLE divergencias_transformacao;` + drop das colunas novas. Sem estágio contract.

---

## Estrutura de arquivos

**Criar (backend):**
- `app/backend/src/database/schema/divergencias-transformacao.schema.ts`
- `app/backend/src/database/migrations/0023_onda7_desossa_expand.sql` (+ meta)
- `app/backend/src/database/seed-regras-transformacao-tz.ts`
- `app/backend/src/modules/operacao/desossa/painel.calc.ts`
- `app/backend/src/modules/operacao/desossa/painel.service.ts`
- `app/backend/src/modules/operacao/desossa/etiquetas-desossa.service.ts`
- `app/backend/src/modules/operacao/desossa/dto/painel.dto.ts`
- `app/backend/src/modules/operacao/desossa/dto/divergencia-transformacao.dto.ts`
- `app/backend/src/modules/operacao/corte/regra-corte.service.ts`
- `app/backend/src/modules/operacao/corte/checklist-corte.service.ts`
- `app/backend/src/modules/operacao/corte/dto/regra-corte.dto.ts`
- `app/backend/test/unit/onda7-migration-0023.spec.ts`
- `app/backend/test/unit/painel.calc.spec.ts`
- `app/backend/test/unit/checklist-corte.service.spec.ts`
- `app/backend/test/unit/regra-corte.service.spec.ts`
- `app/backend/test/unit/seed-regras-transformacao-tz.spec.ts`
- `app/backend/test/integration/onda7-desossa.spec.ts`

**Modificar (backend):**
- `transformacoes.schema.ts`, `regras-transformacao.schema.ts`, `schema/index.ts`
- `database/seed.ts`
- `common/rbac/permissoes.ts`, `perfil-permissoes.snapshot.json`
- `realtime/events/eventos.ts`, `realtime/realtime.gateway.ts`
- `desossa.controller.ts`, `desossa.module.ts`
- `corte.controller.ts`, `corte.module.ts`, `corte.service.ts`, `subitem.service.ts`

**Criar (frontend):**
- `desossa/pesagem-destinacao/desossa-pesagem-client.tsx`
- `desossa/etiquetas/desossa-etiquetas-client.tsx`
- `app/api/desossa/painel/route.ts`, `app/api/desossa/etiquetas/route.ts`
- `app/api/operacao/corte/[id]/regra/route.ts`, `.../checklist/route.ts`, `.../divergencia/route.ts`
- `e2e/onda7-desossa.spec.ts`
- `scripts/capture-onda7-app.mjs`, `scripts/capture-onda7-prototipo.mjs`
- `docs/evidencias/onda7-desossa/README.md`

**Modificar (frontend):**
- `desossa/dashboard/desossa-dashboard-client.tsx` — WS, fidelidade, Modo TV
- `desossa/pesagem-destinacao/page.tsx`, `desossa/etiquetas/page.tsx` — sair de PlaceholderPage
- `lib/desossa.ts` — tipos painel/checklist/divergência/etiquetas

---

## Arquivos de teste (ação por arquivo)

| Arquivo | Prova |
|---|---|
| `test/unit/onda7-migration-0023.spec.ts` | SQL 0023 + journal idx 23 |
| `test/unit/seed-regras-transformacao-tz.spec.ts` | Seed A/B idempotente + provisorio |
| `test/unit/painel.calc.spec.ts` | Shape painel + modoTv + sugestão por regra |
| `test/unit/regra-corte.service.spec.ts` | Bind; bloqueio troca; 409 sem regra |
| `test/unit/checklist-corte.service.spec.ts` | esperado×registrado; A bloqueia B |
| `test/integration/onda7-desossa.spec.ts` | Fluxo API completo + WS emit + RBAC 403 |
| `e2e/onda7-desossa.spec.ts` | 3 rotas + Modo TV + Badge Provisório |
| `docs/evidencias/onda7-desossa/` | Screenshots app×protótipo |

---

## Mapa DoD → teste (1:1)

| DoD | Critério verificável | Teste |
|---|---|---|
| 7.1 | Migration `0023` gerada por drizzle-kit; journal idx 23 | `onda7-migration-0023.spec.ts` |
| 7.2 | `regra_transformacao_id` aceita NULL no iniciar | integration: iniciar sem regra → 201 |
| 7.3 | Seed cria `TZ_A`/`TZ_B` com saídas CB+JAC e CBA+FC; `provisorio=true` | seed spec |
| 7.4 | Parâmetro `desossa.momento_escolha_regra` com `provisorio: true` (P6) | seed spec |
| 7.5 | Bind regra; troca com subitem → 409 `REGRA_BLOQUEADA_APOS_SAIDA` | `regra-corte.service.spec` |
| 7.6 | `adicionar` sem regra → 409 `REGRA_TRANSFORMACAO_OBRIGATORIA` | integration |
| 7.7 | Regra A + item da B → 409 `SAIDA_FORA_DA_REGRA` | checklist/regra spec (**quality-gates O7**) |
| 7.8 | `GET .../checklist` devolve slots esperados | checklist spec |
| 7.9 | Concluir divergente sem divergência → 409 `CHECKLIST_DIVERGENTE` | integration |
| 7.10 | `POST .../divergencia` cria linha + aprovação na mesma TX; evento emitido | integration |
| 7.11 | Tipo de divergência inválido → 400 Zod | unit dto |
| 7.12 | `GET /desossa/painel` itens+regras+alertas; `modoTv=true` enxuto | painel + integration |
| 7.13 | `faltas_desossa_atualizadas` após associar; **não** emitido em rollback | integration spy |
| 7.14 | Sem `DESOSSA_PAINEL_LER` → 403 painel; sem `CORTE_GERENCIAR` → 403 bind | integration RBAC |
| 7.15 | `comercial` tem `DESOSSA_LER` + `DESOSSA_PAINEL_LER` no snapshot | snapshot/seed |
| 7.16 | `rg setInterval` em `desossa/dashboard/**` = 0 | script/e2e gate |
| 7.17 | Dashboard usa `conectarRealtime` e refetch no evento | e2e/RTL |
| 7.18 | UI pesagem exibe Badge Provisório nas regras A/B | e2e |
| 7.19 | UI bloqueia troca de regra após 1ª saída | e2e + integration |
| 7.20 | Pesagem e etiquetas ≠ PlaceholderPage | e2e |
| 7.21 | Etiquetas listam `pecaMaeCodigo` e estado `invalidada_por_troca` | integration + e2e |
| 7.22 | Screenshots 3 rotas + Modo TV em `docs/evidencias/onda7-desossa/` | artefato PR |
| 7.23 | Cobertura ≥80% linha e branch nos services tocados | `npm run test:cov` |
| 7.24 | Zero rótulo `Marca` nas telas da onda | grep |
| 7.25 | Nenhum AD novo em `DECISOES.md` | diff vazio |

---

## Tasks

### Task 1 — Schema declarativo + migration `0023`

**Files:**
- Modify: `app/backend/src/database/schema/transformacoes.schema.ts`
- Modify: `app/backend/src/database/schema/regras-transformacao.schema.ts`
- Create: `app/backend/src/database/schema/divergencias-transformacao.schema.ts`
- Modify: `app/backend/src/database/schema/index.ts`
- Generate: `0023_onda7_desossa_expand.sql` + meta

**Interfaces:** Produz colunas/tabelas D7.1/D7.4/D7.11 para Tasks 2–6.

- [ ] **Step 1: Escrever teste de proveniência (falha sem migration)**

```ts
// test/unit/onda7-migration-0023.spec.ts
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('migration 0023 onda7', () => {
  const root = path.join(__dirname, '../../src/database/migrations');
  it('existe SQL 0023 e entrada no journal', () => {
    const sql = fs.readdirSync(root).find((f) => f.startsWith('0023_') && f.endsWith('.sql'));
    expect(sql).toBeTruthy();
    const journal = JSON.parse(
      fs.readFileSync(path.join(root, 'meta/_journal.json'), 'utf8'),
    ) as { entries: { idx: number; tag: string }[] };
    const e = journal.entries.find((x) => x.idx === 23);
    expect(e?.tag).toMatch(/onda7_desossa/);
  });
});
```

- [ ] **Step 2: Rodar e ver falha**

```bash
cd app/backend && npx jest test/unit/onda7-migration-0023.spec.ts -v
# Expected: FAIL — 0023 não existe
```

- [ ] **Step 3: Alterar schemas** conforme seção "Cadeia de migrations". Exportar em `schema/index.ts`:

```ts
export * from './divergencias-transformacao.schema';
```

- [ ] **Step 4: Gerar migration**

```bash
cd app/backend && npx drizzle-kit generate --name=onda7_desossa_expand
# Expected: 0023_*.sql com ALTER transformacoes, ALTER regras_transformacao, CREATE divergencias_transformacao
```

- [ ] **Step 5: Teste PASS + migrate**

```bash
npx jest test/unit/onda7-migration-0023.spec.ts -v
npm run db:migrate
# Expected: PASS
```

- [ ] **Step 6: Commit**

```bash
git add app/backend/src/database/schema app/backend/src/database/migrations app/backend/test/unit/onda7-migration-0023.spec.ts
git commit -m "$(cat <<'EOF'
feat(onda7): schema e migration 0023 de desossa/transformação

### Descrição Detalhada:
Adiciona regra_transformacao_id, flags provisorio/codigo e tabela divergencias_transformacao.

### Motivo da Mudança:
Base estrutural do bind de regra, checklist e divergência formal (Onda 7).
EOF
)"
```

---

### Task 2 — Seed regras A/B + parâmetro P6

**Files:**
- Create: `app/backend/src/database/seed-regras-transformacao-tz.ts`
- Modify: `app/backend/src/database/seed.ts`
- Test: `app/backend/test/unit/seed-regras-transformacao-tz.spec.ts`

**Interfaces:** `seedRegrasTransformacaoTz(db)` idempotente; consome produtos `CB`, `JAC`, `CBA`, `FC`.

- [ ] **Step 1: Teste falhando**

```ts
describe('seedRegrasTransformacaoTz', () => {
  it('cria TZ_A (CB+JAC) e TZ_B (CBA+FC) com provisorio=true', async () => {
    await seedCatalogoMvp(db);
    await seedRegrasTransformacaoTz(db);
    await seedRegrasTransformacaoTz(db); // idempotente
    const regras = await db.select().from(regrasTransformacao).where(isNull(regrasTransformacao.deletedAt));
    const ativas = regras.filter((r) => r.codigo === 'TZ_A' || r.codigo === 'TZ_B');
    expect(ativas).toHaveLength(2);
    expect(ativas.every((r) => r.provisorio === true)).toBe(true);
  });
});
```

- [ ] **Step 2: Implementar seed**

```ts
// seed-regras-transformacao-tz.ts
export async function seedRegrasTransformacaoTz(db: NodePgDatabase<typeof schema>) {
  const byCodigo = async (codigo: string) => {
    const [p] = await db.select().from(produtos)
      .where(and(eq(produtos.codigo, codigo), isNull(produtos.deletedAt))).limit(1);
    if (!p) throw new Error(`Produto ${codigo} ausente — rode seed catálogo MVP antes`);
    return p;
  };
  const cb = await byCodigo('CB');
  const jac = await byCodigo('JAC');
  const cba = await byCodigo('CBA');
  const fc = await byCodigo('FC');

  async function upsertRegra(
    codigo: string,
    nome: string,
    saidas: { produtoId: string; qtd: string }[],
  ) {
    const [existente] = await db.select().from(regrasTransformacao)
      .where(and(eq(regrasTransformacao.codigo, codigo), isNull(regrasTransformacao.deletedAt)))
      .limit(1);
    let regraId = existente?.id;
    if (!regraId) {
      const [criada] = await db.insert(regrasTransformacao).values({
        codigo,
        nome,
        produtoOrigemCodigo: 'TZ',
        status: 'ativo',
        prioridade: codigo === 'TZ_A' ? 10 : 20,
        provisorio: true,
        observacao: 'Regra provisória v1.1 §6.6 / P12 — validar com cliente',
      }).returning();
      regraId = criada.id;
    } else {
      await db.update(regrasTransformacao)
        .set({ provisorio: true, nome, updatedAt: new Date() })
        .where(eq(regrasTransformacao.id, regraId));
    }
    await db.delete(regrasTransformacaoSaidas).where(eq(regrasTransformacaoSaidas.regraId, regraId));
    await db.insert(regrasTransformacaoSaidas).values(
      saidas.map((s) => ({ regraId: regraId!, produtoId: s.produtoId, quantidadeFixa: s.qtd })),
    );
  }

  await upsertRegra('TZ_A', 'Alternativa A — TZ → Coxão-bola + Jacaré', [
    { produtoId: cb.id, qtd: '1' },
    { produtoId: jac.id, qtd: '1' },
  ]);
  await upsertRegra('TZ_B', 'Alternativa B — TZ → Coxão-bola c/ alcatra + Filé curto', [
    { produtoId: cba.id, qtd: '1' },
    { produtoId: fc.id, qtd: '1' },
  ]);
}
```

Em `seed.ts`, após catálogo MVP, adicionar parâmetro P6 e chamar o seed:

```ts
{
  chave: 'desossa.momento_escolha_regra',
  descricao: 'Momento da escolha da regra de transformação na desossa',
  valor: {
    valor: 'ambos',
    opcoes: ['entrada', 'saida', 'ambos'],
    provisorio: true,
    pendencia: 'P6',
    titulo: 'Momento da escolha da regra (P6)',
    detalhe:
      'v1.1 §16.7 — escolha na entrada ou confirmação na saída; obrigatória antes de gerar produtos.',
  },
},
// ...
await seedRegrasTransformacaoTz(db);
```

- [ ] **Step 3: PASS + commit**

```bash
npx jest test/unit/seed-regras-transformacao-tz.spec.ts -v
# Expected: PASS
```

```bash
git commit -m "$(cat <<'EOF'
feat(onda7): seed regras TZ A/B provisórias e parâmetro P6

### Descrição Detalhada:
Semeia Alternativas A/B com badge Provisório e parâmetro desossa.momento_escolha_regra.

### Motivo da Mudança:
P12/P6 abertos — avançar com parâmetro + badge, sem inventar AD.
EOF
)"
```

---

### Task 3 — RBAC `DESOSSA_PAINEL_LER` + eventos WS

**Files:**
- Modify: `app/backend/src/common/rbac/permissoes.ts`
- Modify: `app/backend/src/common/rbac/perfil-permissoes.snapshot.json`
- Modify: `app/backend/src/realtime/events/eventos.ts`
- Modify: `app/backend/src/realtime/realtime.gateway.ts`

- [ ] **Step 1: Permissão e eventos**

```ts
// permissoes.ts
DESOSSA_PAINEL_LER: 'DESOSSA_PAINEL_LER',
// descrição:
DESOSSA_PAINEL_LER: 'Consultar painel aeroporto/Modo TV da desossa (telão)',
// atribuir a administrador, gestor, corte, comercial, diretoria
// comercial: incluir também DESOSSA_LER (matriz linha 17)
```

```ts
// eventos.ts
FALTAS_DESOSSA_ATUALIZADAS: 'faltas_desossa_atualizadas',
DIVERGENCIA_TRANSFORMACAO_ABERTA: 'divergencia_transformacao_aberta',
```

```ts
// realtime.gateway.ts
@OnEvent(EVENTOS.FALTAS_DESOSSA_ATUALIZADAS)
onFaltasDesossa(payload: { dataOperacao?: string }) {
  this.broadcast(EVENTOS.FALTAS_DESOSSA_ATUALIZADAS, payload, payload.dataOperacao);
  this.server.to('desossa').emit(EVENTOS.FALTAS_DESOSSA_ATUALIZADAS, payload);
}

@OnEvent(EVENTOS.DIVERGENCIA_TRANSFORMACAO_ABERTA)
onDivergTransf(payload: { dataOperacao?: string }) {
  this.broadcast(EVENTOS.DIVERGENCIA_TRANSFORMACAO_ABERTA, payload, payload.dataOperacao);
  this.server.to('desossa').emit(EVENTOS.DIVERGENCIA_TRANSFORMACAO_ABERTA, payload);
}
```

Garantir que o handler `subscribe` aceite a room `desossa` (whitelist ou rooms abertas — seguir padrão atual do gateway).

- [ ] **Step 2: Atualizar snapshot e testes**

```bash
cd app/backend && npx jest -t "perfil-permissoes|permissoes" -v
# Expected: PASS
```

- [ ] **Step 3: Commit** `feat(onda7): RBAC do painel TV e eventos WS da desossa`

---

### Task 4 — `RegraCorteService` + `POST /operacao/corte/:id/regra`

**Files:**
- Create: `regra-corte.service.ts`, `dto/regra-corte.dto.ts`
- Modify: `corte.controller.ts`, `corte.module.ts`
- Test: `test/unit/regra-corte.service.spec.ts`

**Interfaces:**
```ts
export const vincularRegraSchema = z.object({
  regraTransformacaoId: z.string().uuid(),
});
export type VincularRegraDto = z.infer<typeof vincularRegraSchema>;
// service: vincular(transformacaoId, dto, operadorId): Promise<Transformacao>
```

- [ ] **Step 1: Testes**

```ts
it('vincula regra A em transformação aberta', async () => { /* expect regraTransformacaoId */ });
it('bloqueia troca após subitem ativo', async () => {
  await expect(svc.vincular(id, { regraTransformacaoId: regraB }, op)).rejects.toMatchObject({
    response: { message: expect.stringContaining('REGRA_BLOQUEADA_APOS_SAIDA') },
  });
});
it('rejeita regra inativa/inexistente', async () => { /* 404 */ });
```

- [ ] **Step 2: Implementação**

```ts
@Injectable()
export class RegraCorteService {
  async vincular(transformacaoId: string, dto: VincularRegraDto, operadorId: string) {
    const row = await this.db.transaction(async (tx) => {
      const [transf] = await tx.select().from(transformacoes)
        .where(and(eq(transformacoes.id, transformacaoId), isNull(transformacoes.deletedAt)))
        .for('update');
      if (!transf) throw new NotFoundException('Transformação não encontrada');
      if (['concluida', 'cancelada'].includes(transf.statusTransformacao)) {
        throw new ConflictException('TRANSFORMACAO_FECHADA');
      }
      const [regra] = await tx.select().from(regrasTransformacao).where(and(
        eq(regrasTransformacao.id, dto.regraTransformacaoId),
        eq(regrasTransformacao.status, 'ativo'),
        isNull(regrasTransformacao.deletedAt),
      ));
      if (!regra) throw new NotFoundException('Regra não encontrada');
      if (regra.produtoOrigemCodigo !== 'TZ') {
        throw new ConflictException('REGRA_ORIGEM_NAO_SUPORTADA_MVP');
      }
      const [{ c }] = await tx.select({ c: sql<number>`count(*)::int` }).from(subitens)
        .where(and(eq(subitens.transformacaoId, transformacaoId), isNull(subitens.deletedAt)));
      if (
        c > 0 &&
        transf.regraTransformacaoId &&
        transf.regraTransformacaoId !== dto.regraTransformacaoId
      ) {
        throw new ConflictException({
          code: 'REGRA_BLOQUEADA_APOS_SAIDA',
          message: 'A regra não pode ser alterada após registrar a primeira saída',
        });
      }
      const [upd] = await tx.update(transformacoes)
        .set({ regraTransformacaoId: dto.regraTransformacaoId, updatedAt: new Date() })
        .where(eq(transformacoes.id, transformacaoId))
        .returning();
      await this.auditoria.registrar(tx, {
        tabela: 'transformacoes',
        registroId: transformacaoId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: transf,
        dadosNovos: upd,
      });
      return { upd, dataOperacao: await this.dataOperacao(tx, transf.pecaOrigemId) };
    });
    this.events.emit(EVENTOS.FALTAS_DESOSSA_ATUALIZADAS, {
      dataOperacao: row.dataOperacao,
      motivo: 'regra_vinculada',
    });
    return row.upd;
  }
}
```

```ts
@Post(':id/regra')
@RequirePermissoes('CORTE_GERENCIAR')
vincularRegra(
  @Param('id') id: string,
  @Body(new ZodValidationPipe(vincularRegraSchema)) dto: VincularRegraDto,
  @CurrentUser() user: CurrentUserPayload,
) {
  return this.regraCorte.vincular(id, dto, user.sub);
}
```

- [ ] **Step 3: PASS + commit** `feat(onda7): bind de regra de transformação no corte`

---

### Task 5 — Enforcement em `SubitemService.adicionar`

**Files:** Modify `subitem.service.ts`; testes integration/unit.

- [ ] **Step 1: Testes 7.6 e 7.7**

```ts
it('409 REGRA_TRANSFORMACAO_OBRIGATORIA sem regra', async () => { /* iniciar; adicionar → 409 */ });
it('409 SAIDA_FORA_DA_REGRA quando item é da alternativa B com regra A', async () => { /* ... */ });
it('permite saídas da regra A (CB e JAC)', async () => { /* 201 */ });
```

- [ ] **Step 2: Guard no início de `adicionar` (dentro da TX)**

```ts
if (!transf.regraTransformacaoId) {
  throw new ConflictException({
    code: 'REGRA_TRANSFORMACAO_OBRIGATORIA',
    message: 'Defina a regra de transformação antes de gerar produtos',
  });
}
const saidas = await tx.select({
  legado: produtos.legadoItemComercialId,
}).from(regrasTransformacaoSaidas)
  .innerJoin(produtos, eq(produtos.id, regrasTransformacaoSaidas.produtoId))
  .where(eq(regrasTransformacaoSaidas.regraId, transf.regraTransformacaoId));
const permitido = new Set(saidas.map((s) => s.legado).filter(Boolean) as string[]);
if (!permitido.has(dto.itemComercialId)) {
  throw new ConflictException({
    code: 'SAIDA_FORA_DA_REGRA',
    message: 'Produto incompatível com a regra escolhida para este TZ',
  });
}
```

- [ ] **Step 3: Commit** `feat(onda7): exclusividade de saídas por regra no corte`

---

### Task 6 — Checklist + divergência formal + gate no concluir

**Files:**
- Create: `checklist-corte.service.ts`, `dto/divergencia-transformacao.dto.ts`
- Modify: `corte.service.ts`, `corte.controller.ts`; import `AprovacoesModule` se necessário

**Interfaces:**
```ts
export const abrirDivergenciaTransformacaoSchema = z.object({
  tipo: z.enum([
    'subpeca_faltante',
    'subpeca_excedente',
    'produto_diferente',
    'perda_informada',
  ]),
  detalhe: z.record(z.string(), z.unknown()).default({}),
  observacao: z.string().trim().min(3).max(1000).optional(),
});

type ChecklistSlot = {
  produtoId: string;
  produtoCodigo: string;
  produtoNome: string;
  esperado: number;
  registrado: number;
  status: 'pendente' | 'parcial' | 'completo' | 'excedente';
};

type ChecklistResponse = {
  transformacaoId: string;
  regraTransformacaoId: string | null;
  regraNome: string | null;
  regraProvisoria: boolean;
  slots: ChecklistSlot[];
  divergente: boolean;
  divergenciaAbertaId: string | null;
};
```

- [ ] **Step 1: Testes 7.8–7.11**

```ts
it('checklist A espera CB=1 e JAC=1', async () => { /* ... */ });
it('concluir divergente sem divergência → 409 CHECKLIST_DIVERGENTE', async () => { /* ... */ });
it('abrir divergência cria aprovação na mesma TX', async () => {
  const d = await svc.abrirDivergencia(
    id,
    { tipo: 'subpeca_faltante', detalhe: { slot: 'JAC' } },
    op,
  );
  const [ap] = await db.select().from(aprovacoesOperacionais)
    .where(eq(aprovacoesOperacionais.id, d.aprovacaoId));
  expect(ap.tipo).toBe('divergencia_transformacao');
});
```

- [ ] **Step 2: Implementar**

`ChecklistCorteService.obter` calcula slots. `abrirDivergencia`: INSERT + `aprovacoes.abrirNaTx({ tipo: 'divergencia_transformacao', origem: 'desossa', referenciaTabela: 'divergencias_transformacao', referenciaId, ... })` + auditoria; pós-commit emit `DIVERGENCIA_TRANSFORMACAO_ABERTA` e `FALTAS_DESOSSA_ATUALIZADAS`.

No `CorteService.concluir`, antes de fechar:

```ts
const checklist = await this.checklist.obterNaTx(tx, transformacaoId);
if (checklist.divergente && !checklist.divergenciaAbertaId) {
  throw new ConflictException({
    code: 'CHECKLIST_DIVERGENTE',
    message: 'Registre a divergência de transformação antes de concluir',
  });
}
```

Endpoints:
```ts
@Get(':id/checklist')
@RequirePermissoes('CORTE_GERENCIAR')
checklist(@Param('id') id: string) {
  return this.checklist.obter(id);
}

@Post(':id/divergencia')
@RequirePermissoes('CORTE_GERENCIAR')
divergencia(
  @Param('id') id: string,
  @Body(new ZodValidationPipe(abrirDivergenciaTransformacaoSchema)) dto: AbrirDivergenciaDto,
  @CurrentUser() user: CurrentUserPayload,
) {
  return this.checklist.abrirDivergencia(id, dto, user.sub);
}
```

- [ ] **Step 3: Commit** `feat(onda7): checklist e divergência formal de transformação`

---

### Task 7 — `GET /desossa/painel?modoTv=`

**Files:** `painel.calc.ts`, `painel.service.ts`, `dto/painel.dto.ts`; modificar controller/module; testes.

**Query DTO:**
```ts
export const painelQuerySchema = z.object({
  modoTv: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => v === true || v === 'true'),
  operacaoId: z.string().uuid().optional(),
});
```

**Shape (modo normal):**
```ts
type PainelDesossa = {
  geradoEm: string;
  modoTv: boolean;
  itens: Array<{
    produtoId: string;
    produtoCodigo: string;
    produtoNome: string;
    faltam: number;
    prontoEstoque: number;
    aProduzir: number;
    origem: 'TZ';
    prioridade: 'Alta' | 'Média' | 'Baixa';
    status: string;
  }>;
  regras: Array<{
    regraId: string;
    codigo: string | null;
    nome: string;
    provisorio: boolean;
    tzsEstimados: number;
    saidasEsperadas: string;
    status: string;
  }>;
  alertas: Array<{ tipo: string; msg: string }>;
  totais: { itensFaltantes: number; pecasFaltantes: number; prontoEstoque: number };
};
```

Modo TV: `itens` + `totais` + `geradoEm` (protótipo `TVMode` não lista regras detalhadas).

```ts
@Get('painel')
@RequirePermissoes('DESOSSA_PAINEL_LER')
async painel(@Query(new ZodValidationPipe(painelQuerySchema)) q: PainelQuery) {
  return this.painel.obter(q);
}
```

Reutilizar `calcularFaltasDesossa` / `FaltasService` como fonte dos itens; enriquecer com prioridade/status derivados (não inventar "em produção").

- [ ] Testes unitários de `painel.calc` + integration 200/403.
- [ ] Commit: `feat(onda7): endpoint GET /desossa/painel com modo TV`

---

### Task 8 — Emissores de `FALTAS_DESOSSA_ATUALIZADAS`

**Files:** `subitem.service.ts` (associar), `corte.service.ts` (concluir); T4 já emite no bind.

- [ ] Emit **somente após commit** (padrão F4c).
- [ ] Teste spy: rollback → emit 0×; commit → 1×.
- [ ] Commit: `feat(onda7): broadcast faltas_desossa_atualizadas pós-commit`

---

### Task 9 — BFF Next.js

**Files:** routes API listadas; tipos em `lib/desossa.ts`.

Padrão (espelho de `api/desossa/faltas/route.ts`):

```ts
// app/frontend/src/app/api/desossa/painel/route.ts
export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const { data, error, status } = await fetchBackend(
    `/desossa/painel${qs ? `?${qs}` : ''}`,
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data);
}
```

Idem para etiquetas (GET), regra (POST), checklist (GET), divergência (POST).

- [ ] Commit: `feat(onda7): BFF painel, etiquetas e bind/checklist/divergência`

---

### Task 10 — `GET /desossa/etiquetas`

**Files:** `etiquetas-desossa.service.ts`, controller GET, testes.

```ts
async listar(filtros: {
  operacaoId: string;
  transformacaoId?: string;
  estado?: string;
  page: number;
  pageSize: number;
}) {
  // join etiquetas_impressoes ↔ subitens ↔ transformacoes ↔ pecas origem
  // filtrar pela operação (mesmo caminho dataOperacao/operacaoId usado em corte/SIF)
  // mapear pecaMaeCodigo, transformacaoId, estado, peso, produto
}
```

DoD 7.21: fixture com `estado='invalidada_por_troca'` aparece quando aplicável.

- [ ] Commit: `feat(onda7): listagem de etiquetas da desossa com peça mãe`

---

### Task 11 — UI Dashboard fiel + WS (remove poll)

**Files:** `desossa-dashboard-client.tsx` (+ extrair `TVMode` se necessário).

**Blocos protótipo:** header/KPIs (~374–480), tabela itens (~490–560), sugestão por regra (~560–600), alertas, drawers, `TVMode` (~280–370).

```tsx
const EVENTOS_REFETCH = new Set([
  'faltas_desossa_atualizadas',
  'divergencia_transformacao_aberta',
  'corte_iniciado',
  'subitem_associado',
  'corte_concluido',
]);

useEffect(() => {
  void carregar(); // GET /api/desossa/painel
  const off = conectarRealtime({
    rooms: ['desossa', 'dashboard'],
    onMessage: (msg) => {
      if (EVENTOS_REFETCH.has(msg.type)) void carregar();
    },
    onReconnect: () => void carregar(),
    onStatus: setWsStatus,
  });
  return off;
}, [carregar]);
// PROIBIDO: setInterval
```

Badge Provisório quando `regra.provisorio === true`.

```bash
rg -n "setInterval" "app/frontend/src/app/(admin)/desossa/dashboard" && echo FAIL || echo OK
# Expected: OK
```

- [ ] Commit: `feat(onda7): dashboard desossa fiel com Modo TV e WebSocket`

---

### Task 12 — UI Pesagem/Destinação fiel

**Files:** criar `desossa-pesagem-client.tsx`; atualizar `page.tsx`.

Fluxo API:
1. `GET /operacao/corte/pecas-elegiveis?operacaoId=` (criar se ausente — D7.13)
2. `POST /operacao/corte/pecas/:id/iniciar`
3. `POST /operacao/corte/:id/regra`
4. Por slot: `POST .../subitens` → `pesar` → `associar`
5. Se divergente: `POST .../divergencia` → `POST .../concluir`

UI: layout do protótipo **sem** seeds; Badge Provisório no seletor A/B; disabled na regra não selecionada após 1ª saída.

- [ ] Commit: `feat(onda7): tela pesagem e destinação da desossa fiel ao protótipo`

---

### Task 13 — UI Etiquetas desossa fiel

**Files:** `desossa-etiquetas-client.tsx`; page; consome `/api/desossa/etiquetas`.

Coluna Peça mãe (TZ); filtros; KPIs; drawer invalidada por troca — fidelidade a `DesossaEtiquetas.tsx`.

- [ ] Commit: `feat(onda7): tela etiquetas da desossa fiel ao protótipo`

---

### Task 14 — Testes DoD, e2e, evidências, grep Marca

**Files:** `test/integration/onda7-desossa.spec.ts`, `e2e/onda7-desossa.spec.ts`, scripts capture, `docs/evidencias/onda7-desossa/README.md`.

E2E mínimo:
1. Login perfil `corte`
2. `/desossa/dashboard` — KPIs + copy anti-"em produção"; status WS
3. Modo TV acionável
4. `/desossa/pesagem-destinacao` — não placeholder; Badge Provisório
5. `/desossa/etiquetas` — coluna Peça mãe

```bash
cd app/backend && npm run test:cov
cd app/frontend && npm run test && npx playwright test e2e/onda7-desossa.spec.ts
rg -n "\bMarca\b" "app/frontend/src/app/(admin)/desossa" && echo FAIL || echo OK
# Expected: coverage ≥80%; e2e PASS; grep OK
```

- [ ] Commit: `test(onda7): DoD exclusividade, checklist, divergência, e2e e evidências`

---

### Task 15 — Gate local (= CI) + PR de implementação

> Task do **Executor/Worker na implementação**, não deste PR de plano.

```bash
npm ci
cd app/backend && npm run lint && npm run test:cov && npm run build
cd app/frontend && npm run lint && npm run test && npm run build
gh pr create --base develop --title "feat(onda7): Desossa e Transformação" --body "..."
```

Atualizar `EXECUCAO-STATUS.md` para `implementando` / `aguardando_portao2` conforme rito.

---

## Ordem de execução

```
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11 → T12 → T13 → T14 → T15
```

Paralelismo seguro após deps de API: T11 ∥ T12 ∥ T13.

---

## Critérios Portão 1 (Monitor)

1. Princípio I: 3 telas mapeadas a `.tsx` do protótipo com SHA pinado.
2. Princípio II: zero "parcial/depois"; linhas 17–19 cobertas na reconciliação.
3. Princípio VIII: P6/P12 → parâmetro + badge; `DECISOES.md` intocado.
4. Autossuficiência: Goal/Architecture/Tech Stack, decisões D7.x, estrutura, mapa DoD 7.1–7.25, tasks com código literal.
5. RA-04 explícito: remoção do poll + eventos nomeados.
6. Quality-gates O7: exclusividade A↔B, checklist, divergência formal, painel TV por eventos — cada um com DoD→teste.
7. Grep plano: zero `TBD` / `TODO` / `implementar depois` / `similar à Task`.
8. Dep O6 = `mergeada` em `EXECUCAO-STATUS.md`.

## Critérios Portão 2 (Monitor — implementação futura)

1. CI 8/8 verde no head.
2. Diff ⊆ plano; nada de O8/O9/O10.
3. DoD 7.1–7.25 demonstrados por teste/artefato.
4. Screenshots 3 rotas + Modo TV vs protótipo.
5. `rg setInterval` limpo em `desossa/dashboard`.
6. `DECISOES.md` sem AD novo.
7. Cobertura ≥80% linha e branch.

---

## Self-Review (Planejador)

1. **Spec coverage:** §6.6 exclusividade → T4/T5/7.7; §6.14 fluxo → D7.1/D7.5; telas §8.9 → T11–T13; §16.7/§16.15 → parâmetro+badge; matriz 17–19 → reconciliação; quality-gates O7 → DoD 7.7/7.8/7.10/7.13/7.16.
2. **Placeholder scan:** nenhum TBD/TODO/a definir/implementar depois.
3. **Type consistency:** `regraTransformacaoId`, wires `faltas_desossa_atualizadas` / `divergencia_transformacao_aberta`, tipos de divergência alinhados ao CHECK.
4. **PR #38:** não reutilizado; branch de plano `feature/onda7-plano-desossa`.

---

## Fora de escopo (resto)

Qualquer cadastro admin além do seed; mudanças em Troca de Peça (O6); adapter de balança real; relatórios SIF novos.
