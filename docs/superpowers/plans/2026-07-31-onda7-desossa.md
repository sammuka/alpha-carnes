# Onda 7 — Desossa e Transformação — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Workers: papel `worker` em `.codex/agents/worker.toml`. Executar task a task sem reabrir decisões.

**Goal:** Fechar as três rotas de Desossa (matriz linhas 17–19) com backend transacional (bind de regra + exclusividade, checklist esperado×registrado, divergência formal), painel aeroporto/Modo TV por eventos WebSocket (zero poll), seed das regras A/B provisórias com Badge Provisório, e UIs idênticas ao protótipo — sem inventar AD para P6/P12.

**Architecture:** Extensão do módulo F4c já existente (`modules/operacao/corte` + `modules/operacao/desossa`). Não nasce módulo paralelo: `transformacoes` ganha `regra_transformacao_id`; nasce `divergencias_transformacao`; painel novo em `GET /desossa/painel`; eventos novos no catálogo RA-04 e no gateway WS. Frontend substitui PlaceholderPage e remove o `setInterval(60s)` do dashboard. Seed idempotente das regras TZ A/B no `db:seed`.

**Tech Stack:** NestJS 11 + TypeScript 5 strict, Drizzle ORM (PostgreSQL 18, `uuidv7()`), Zod 4, WebSocket nativo + `@nestjs/event-emitter`, Jest (unit/integration com Postgres efêmero + fakes), Next.js 16 App Router (BFF) + React 19 + Playwright e2e.

**Base tip:** `origin/develop` @ `94fb341` (Onda 6 mergeada + dívidas O6). Próxima migration: `0023`. Protótipo pinado: `F:\Projetos\alpha-carnes-prototipo` @ `feature/completude-v1.1` `8d32aa4c`. PR `#38` (`feature/onda7-desossa`) foi CLOSED — este plano é do zero; não reabrir.

## Emenda 1 — Portão 1 (veredito `ajustar` 2026-07-31T16:45:30-03:00)

Fecha **todos** os bloqueantes e menores do Portão 1, item a item:

| # | Achado | Fechamento nesta emenda |
|---|---|---|
| 1 | Task 3 usava `this.server.to().emit` (Socket.IO) | Handlers só via `private broadcast` → `RealtimeHub.broadcast` + `roomsDaData` estendido com literal `'desossa'` + teste unit |
| 2 | Densidade baixa (Tasks 6/7/8/10/12/13 sem literais) | `painel.calc`, `ChecklistCorteService.obter`, `abrirDivergencia` completo, emissores pós-commit, `listar` etiquetas, JSX Tasks 11–13 |
| 3 | Princípio I — Tasks 11–13 sem JSX fiel | Blocos TVMode/KPIs/tabela/sugestão; seletor A/B+Badge/checklist/modais; KPIs/filtros/Peça mãe/drawer |
| 4 | `abrirNaTx` incompleto | Literal com `operacaoId`, `descricao` (≥10), `impacto` (≥5) + demais campos do DTO real |
| 5 | D7.13/Task 12 contingente (endpoint opcional) | **Decisão: criar** `GET /operacao/corte/pecas-elegiveis` — handler+serviço literais (endpoint ausente no tip) |
| 6 | RBAC sem literal MAPA/push; page sem `DESOSSA_PAINEL_LER` | `MAPA_PERFIL_PERMISSOES` + `pushPermissoes` para `comercial`/`diretoria`; `page.tsx` com `DESOSSA_PAINEL_LER` |
| 7 | Códigos `code`/`message` vs backend | Padronizado `codigo`/`mensagem`; testes assertam `response.codigo` |
| 8 | DoD 7.11 sem arquivo/step | `test/unit/divergencia-transformacao.dto.spec.ts` na estrutura + Step na Task 6 |

**Base tip atualizado:** `origin/develop` @ `94fb341` (Onda 6 merge + dívidas). Próxima migration permanece `0023`.

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
- Refatoração ampla do F4c além do necessário para bind/checklist/divergência.

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

**D7.13 — Listagem de peças elegíveis à desossa (criar endpoint — ausente no tip `94fb341`).**
`corte.controller.ts` hoje não expõe listagem de peças `para_corte`/`em_transformacao` por operação. Task 12 **cria** `GET /operacao/corte/pecas-elegiveis?operacaoId=` com handler+serviço literais: filtra `pecas.status_peca IN ('para_corte','em_transformacao')` da operação (join `recebimentos.operacao_id`), soft-delete nulo, ordenação por `created_at`. Zero contingência.

---

## Cadeia de migrations — `0023` expand gerado

Estado verificado em `94fb341`: journal idx 22 = `0022_onda6_etiqueta_estado_backfill`. Próximo: **`0023_onda7_desossa_expand`**.

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
- `app/backend/src/modules/operacao/corte/regra-corte.service.ts`
- `app/backend/src/modules/operacao/corte/checklist-corte.service.ts`
- `app/backend/src/modules/operacao/corte/dto/regra-corte.dto.ts`
- `app/backend/src/modules/operacao/corte/dto/divergencia-transformacao.dto.ts`
- `app/backend/src/modules/operacao/corte/pecas-elegiveis.service.ts`
- `app/backend/src/modules/operacao/corte/dto/pecas-elegiveis.dto.ts`
- `app/backend/test/unit/onda7-migration-0023.spec.ts`
- `app/backend/test/unit/painel.calc.spec.ts`
- `app/backend/test/unit/checklist-corte.service.spec.ts`
- `app/backend/test/unit/regra-corte.service.spec.ts`
- `app/backend/test/unit/seed-regras-transformacao-tz.spec.ts`
- `app/backend/test/unit/divergencia-transformacao.dto.spec.ts`
- `app/backend/test/unit/rooms-da-data.spec.ts`
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
- `app/api/operacao/corte/pecas-elegiveis/route.ts`
- `app/api/operacao/corte/[id]/regra/route.ts`, `.../checklist/route.ts`, `.../divergencia/route.ts`
- `e2e/onda7-desossa.spec.ts`
- `scripts/capture-onda7-app.mjs`, `scripts/capture-onda7-prototipo.mjs`
- `docs/evidencias/onda7-desossa/README.md`

**Modificar (frontend):**
- `desossa/dashboard/desossa-dashboard-client.tsx` — WS, fidelidade, Modo TV
- `desossa/dashboard/page.tsx` — gate `DESOSSA_PAINEL_LER`
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
| `test/unit/divergencia-transformacao.dto.spec.ts` | DoD 7.11 — tipo inválido → Zod 400 |
| `test/unit/rooms-da-data.spec.ts` | `roomsDaData` inclui `desossa` |
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
| 7.11 | Tipo de divergência inválido → 400 Zod | `divergencia-transformacao.dto.spec.ts` |
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

### Task 3 — RBAC `DESOSSA_PAINEL_LER` + eventos WS (hub nativo)

**Files:**
- Modify: `app/backend/src/common/rbac/permissoes.ts`
- Modify: `app/backend/src/common/rbac/perfil-permissoes.snapshot.json`
- Modify: `app/backend/src/realtime/events/eventos.ts`
- Modify: `app/backend/src/realtime/realtime.gateway.ts`
- Modify: `app/frontend/src/app/(admin)/desossa/dashboard/page.tsx`
- Create: `app/backend/test/unit/rooms-da-data.spec.ts`

**Âncoras tip `94fb341`:** `realtime.gateway.ts` — `this.server` é `http.Server` (ws nativo); broadcast real = `private broadcast` → `this.hub.broadcast(room, evento, payload)` via `roomsDaData`. **Proibido** Socket.IO (`this.server.to().emit`).

- [ ] **Step 1: Declaração canônica + mapa de perfis**

```ts
// permissoes.ts — em PERMISSOES (após DESOSSA_GERENCIAR):
DESOSSA_PAINEL_LER: 'DESOSSA_PAINEL_LER',

// em DESCRICOES_PERMISSOES:
DESOSSA_PAINEL_LER: 'Consultar painel aeroporto/Modo TV da desossa (telão)',

// pushPermissoes — bloco Onda 7 (após pushes existentes de SIF/APROVACOES):
pushPermissoes(
  'administrador',
  'DESOSSA_PAINEL_LER',
);
pushPermissoes(
  'gestor',
  'DESOSSA_PAINEL_LER',
);
pushPermissoes(
  'corte',
  'DESOSSA_PAINEL_LER',
);
// comercial e diretoria NÃO têm DESOSSA_LER hoje (tip 94fb341) — conceder ambos:
pushPermissoes(
  'comercial',
  'DESOSSA_LER',
  'DESOSSA_PAINEL_LER',
);
pushPermissoes(
  'diretoria',
  'DESOSSA_LER',
  'DESOSSA_PAINEL_LER',
);
```

Regenerar/atualizar `perfil-permissoes.snapshot.json` pelo fluxo já usado nas ondas anteriores (teste de snapshot deve PASS).

- [ ] **Step 2: Eventos + roomsDaData com room canônica `desossa`**

```ts
// eventos.ts — em EVENTOS (após bloco Onda 6):
FALTAS_DESOSSA_ATUALIZADAS: 'faltas_desossa_atualizadas',
DIVERGENCIA_TRANSFORMACAO_ABERTA: 'divergencia_transformacao_aberta',

// roomsDaData — estender literalmente:
export function roomsDaData(dataOperacao: string): string[] {
  return ['dashboard', 'desossa', `operacao:${dataOperacao}`];
}

// payloads tipados:
export interface FaltasDesossaAtualizadasPayload {
  dataOperacao: string;
  motivo: string;
}

export interface DivergenciaTransformacaoAbertaPayload {
  dataOperacao: string;
  transformacaoId: string;
  divergenciaId: string;
  aprovacaoId: string;
  tipo: string;
}
```

```ts
// test/unit/rooms-da-data.spec.ts
import { roomsDaData } from '../../src/realtime/events/eventos';

describe('roomsDaData', () => {
  it('inclui dashboard, desossa e operacao:{data}', () => {
    expect(roomsDaData('2026-07-31')).toEqual([
      'dashboard',
      'desossa',
      'operacao:2026-07-31',
    ]);
  });
});
```

- [ ] **Step 3: Handlers no gateway — padrão hub nativo (sem Socket.IO)**

```ts
// realtime.gateway.ts — imports: adicionar FaltasDesossaAtualizadasPayload, DivergenciaTransformacaoAbertaPayload

@OnEvent(EVENTOS.FALTAS_DESOSSA_ATUALIZADAS)
handleFaltasDesossaAtualizadas(payload: FaltasDesossaAtualizadasPayload): void {
  this.broadcast(EVENTOS.FALTAS_DESOSSA_ATUALIZADAS, payload, payload.dataOperacao);
}

@OnEvent(EVENTOS.DIVERGENCIA_TRANSFORMACAO_ABERTA)
handleDivergenciaTransformacaoAberta(payload: DivergenciaTransformacaoAbertaPayload): void {
  this.broadcast(EVENTOS.DIVERGENCIA_TRANSFORMACAO_ABERTA, payload, payload.dataOperacao);
}

// private broadcast permanece o existente (tip 94fb341 L339-347):
// for (const room of roomsDaData(dataOperacao)) this.hub.broadcast(room, evento, payload);
```

- [ ] **Step 4: Page dashboard considera `DESOSSA_PAINEL_LER`**

```tsx
// app/frontend/src/app/(admin)/desossa/dashboard/page.tsx
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { DesossaDashboardClient } from './desossa-dashboard-client';

export default async function DesossaDashboardPage() {
  const user = await getMe();
  if (!user) redirect('/login');

  const podeVer =
    user.permissoes.includes('DESOSSA_PAINEL_LER') ||
    user.permissoes.includes('DESOSSA_LER') ||
    user.permissoes.includes('CORTE_GERENCIAR');

  if (!podeVer) {
    return (
      <p className="text-sm text-destructive">
        Você não tem permissão para visualizar o dashboard da desossa.
      </p>
    );
  }

  return <DesossaDashboardClient />;
}
```

- [ ] **Step 5: Testes + commit**

```bash
cd app/backend && npx jest test/unit/rooms-da-data.spec.ts -t "perfil-permissoes|permissoes|roomsDaData" -v
# Expected: PASS — comercial/diretoria com DESOSSA_LER + DESOSSA_PAINEL_LER no snapshot
```

```bash
git commit -m "$(cat <<'EOF'
feat(onda7): RBAC do painel TV e eventos WS nativos da desossa

### Descrição Detalhada:
Adiciona DESOSSA_PAINEL_LER, concede DESOSSA_* a comercial/diretoria, estende roomsDaData com room desossa e handlers via RealtimeHub.

### Motivo da Mudança:
Portão 1 — eliminar Socket.IO e fechar lacuna RBAC do telão.
EOF
)"
```

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
```

- [ ] **Step 1: Testes (assertam `codigo`, não `message`/`code`)**

```ts
it('vincula regra A em transformação aberta', async () => {
  const out = await svc.vincular(id, { regraTransformacaoId: regraA }, op);
  expect(out.regraTransformacaoId).toBe(regraA);
});

it('bloqueia troca após subitem ativo', async () => {
  await expect(svc.vincular(id, { regraTransformacaoId: regraB }, op)).rejects.toMatchObject({
    response: {
      codigo: 'REGRA_BLOQUEADA_APOS_SAIDA',
      mensagem: expect.stringMatching(/primeira saída/i),
    },
  });
});

it('rejeita regra inativa/inexistente', async () => {
  await expect(svc.vincular(id, { regraTransformacaoId: uuidInexistente }, op))
    .rejects.toBeInstanceOf(NotFoundException);
});
```

- [ ] **Step 2: Implementação (conflitos com `codigo`/`mensagem`)**

```ts
@Injectable()
export class RegraCorteService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly auditoria: AuditoriaService,
    private readonly events: EventEmitter2,
  ) {}

  async vincular(transformacaoId: string, dto: VincularRegraDto, operadorId: string) {
    const row = await this.db.transaction(async (tx) => {
      const [transf] = await tx.select().from(transformacoes)
        .where(and(eq(transformacoes.id, transformacaoId), isNull(transformacoes.deletedAt)))
        .for('update');
      if (!transf) throw new NotFoundException('Transformação não encontrada');
      if (['concluida', 'cancelada'].includes(transf.statusTransformacao)) {
        throw new ConflictException({
          codigo: 'TRANSFORMACAO_FECHADA',
          mensagem: 'Transformação fechada não aceita vínculo de regra',
        });
      }
      const [regra] = await tx.select().from(regrasTransformacao).where(and(
        eq(regrasTransformacao.id, dto.regraTransformacaoId),
        eq(regrasTransformacao.status, 'ativo'),
        isNull(regrasTransformacao.deletedAt),
      ));
      if (!regra) throw new NotFoundException('Regra não encontrada');
      if (regra.produtoOrigemCodigo !== 'TZ') {
        throw new ConflictException({
          codigo: 'REGRA_ORIGEM_NAO_SUPORTADA_MVP',
          mensagem: 'Somente regras com origem TZ são aceitas nesta versão',
        });
      }
      const [{ c }] = await tx.select({ c: sql<number>`count(*)::int` }).from(subitens)
        .where(and(eq(subitens.transformacaoId, transformacaoId), isNull(subitens.deletedAt)));
      if (
        c > 0 &&
        transf.regraTransformacaoId &&
        transf.regraTransformacaoId !== dto.regraTransformacaoId
      ) {
        throw new ConflictException({
          codigo: 'REGRA_BLOQUEADA_APOS_SAIDA',
          mensagem: 'A regra não pode ser alterada após registrar a primeira saída',
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
      const dataOperacao = await this.dataOperacaoPorPeca(tx, transf.pecaOrigemId);
      return { upd, dataOperacao };
    });
    this.events.emit(EVENTOS.FALTAS_DESOSSA_ATUALIZADAS, {
      dataOperacao: row.dataOperacao,
      motivo: 'regra_vinculada',
    });
    return row.upd;
  }

  private async dataOperacaoPorPeca(tx: Tx, pecaId: string): Promise<string> {
    const [r] = await tx
      .select({ data: operacoes.data })
      .from(pecas)
      .innerJoin(recebimentos, eq(recebimentos.id, pecas.recebimentoId))
      .innerJoin(operacoes, eq(operacoes.id, recebimentos.operacaoId))
      .where(eq(pecas.id, pecaId))
      .limit(1);
    return r?.data ?? '';
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
it('409 REGRA_TRANSFORMACAO_OBRIGATORIA sem regra', async () => {
  const err = await svc.adicionar(transfId, dto, op).catch((e) => e);
  expect(err.getResponse()).toMatchObject({
    codigo: 'REGRA_TRANSFORMACAO_OBRIGATORIA',
  });
});

it('409 SAIDA_FORA_DA_REGRA quando item é da alternativa B com regra A', async () => {
  const err = await svc.adicionar(transfId, { itemComercialId: itemDaB }, op).catch((e) => e);
  expect(err.getResponse()).toMatchObject({ codigo: 'SAIDA_FORA_DA_REGRA' });
});

it('permite saídas da regra A (CB e JAC)', async () => {
  await expect(svc.adicionar(transfId, { itemComercialId: itemCb }, op)).resolves.toBeTruthy();
});
```

- [ ] **Step 2: Guard no início de `adicionar` (dentro da TX)**

```ts
if (!transf.regraTransformacaoId) {
  throw new ConflictException({
    codigo: 'REGRA_TRANSFORMACAO_OBRIGATORIA',
    mensagem: 'Defina a regra de transformação antes de gerar produtos',
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
    codigo: 'SAIDA_FORA_DA_REGRA',
    mensagem: 'Produto incompatível com a regra escolhida para este TZ',
  });
}
```

- [ ] **Step 3: Commit** `feat(onda7): exclusividade de saídas por regra no corte`

---

### Task 6 — Checklist + divergência formal + gate no concluir

**Files:**
- Create: `checklist-corte.service.ts`, `dto/divergencia-transformacao.dto.ts`
- Modify: `corte.service.ts`, `corte.controller.ts`, `corte.module.ts` (import `AprovacoesModule`)
- Create: `test/unit/divergencia-transformacao.dto.spec.ts` (DoD 7.11)
- Create/Modify: `test/unit/checklist-corte.service.spec.ts`

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
export type AbrirDivergenciaTransformacaoDto = z.infer<typeof abrirDivergenciaTransformacaoSchema>;

export type ChecklistSlot = {
  produtoId: string;
  produtoCodigo: string;
  produtoNome: string;
  esperado: number;
  registrado: number;
  status: 'pendente' | 'parcial' | 'completo' | 'excedente';
};

export type ChecklistResponse = {
  transformacaoId: string;
  regraTransformacaoId: string | null;
  regraNome: string | null;
  regraProvisoria: boolean;
  slots: ChecklistSlot[];
  divergente: boolean;
  divergenciaAbertaId: string | null;
};
```

- [ ] **Step 1: DoD 7.11 — teste unit do DTO (tipo inválido)**

```ts
// test/unit/divergencia-transformacao.dto.spec.ts
import { abrirDivergenciaTransformacaoSchema } from '../../src/modules/operacao/corte/dto/divergencia-transformacao.dto';

describe('abrirDivergenciaTransformacaoSchema', () => {
  it('rejeita tipo inválido', () => {
    const r = abrirDivergenciaTransformacaoSchema.safeParse({
      tipo: 'tipo_inventado',
      detalhe: {},
    });
    expect(r.success).toBe(false);
  });

  it('aceita subpeca_faltante com detalhe', () => {
    const r = abrirDivergenciaTransformacaoSchema.safeParse({
      tipo: 'subpeca_faltante',
      detalhe: { slot: 'JAC' },
      observacao: 'Jacaré não saiu da peça',
    });
    expect(r.success).toBe(true);
  });
});
```

```bash
cd app/backend && npx jest test/unit/divergencia-transformacao.dto.spec.ts -v
# Expected: FAIL até o schema existir; depois PASS
```

- [ ] **Step 2: Testes 7.8–7.10**

```ts
it('checklist A espera CB=1 e JAC=1', async () => {
  const c = await svc.obter(transfId);
  expect(c.slots.map((s) => s.produtoCodigo).sort()).toEqual(['CB', 'JAC']);
  expect(c.slots.every((s) => s.esperado === 1)).toBe(true);
});

it('concluir divergente sem divergência → 409 CHECKLIST_DIVERGENTE', async () => {
  const err = await corte.concluir(transfId, op).catch((e) => e);
  expect(err.getResponse()).toMatchObject({ codigo: 'CHECKLIST_DIVERGENTE' });
});

it('abrir divergência cria aprovação na mesma TX', async () => {
  const d = await svc.abrirDivergencia(
    transfId,
    { tipo: 'subpeca_faltante', detalhe: { slot: 'JAC' }, observacao: 'Falta jacaré na peça' },
    op,
  );
  const [ap] = await db.select().from(aprovacoesOperacionais)
    .where(eq(aprovacoesOperacionais.id, d.aprovacaoId));
  expect(ap.tipo).toBe('divergencia_transformacao');
  expect(ap.operacaoId).toBeTruthy();
  expect(ap.descricao.length).toBeGreaterThanOrEqual(10);
  expect(ap.impacto.length).toBeGreaterThanOrEqual(5);
});
```

- [ ] **Step 3: `ChecklistCorteService.obter` completo**

```ts
@Injectable()
export class ChecklistCorteService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly aprovacoes: AprovacoesService,
    private readonly auditoria: AuditoriaService,
    private readonly events: EventEmitter2,
  ) {}

  async obter(transformacaoId: string): Promise<ChecklistResponse> {
    return this.db.transaction((tx) => this.obterNaTx(tx, transformacaoId));
  }

  async obterNaTx(tx: Tx, transformacaoId: string): Promise<ChecklistResponse> {
    const [transf] = await tx.select().from(transformacoes)
      .where(and(eq(transformacoes.id, transformacaoId), isNull(transformacoes.deletedAt)));
    if (!transf) throw new NotFoundException('Transformação não encontrada');

    let regraNome: string | null = null;
    let regraProvisoria = false;
    const slots: ChecklistSlot[] = [];

    if (transf.regraTransformacaoId) {
      const [regra] = await tx.select().from(regrasTransformacao)
        .where(eq(regrasTransformacao.id, transf.regraTransformacaoId));
      regraNome = regra?.nome ?? null;
      regraProvisoria = regra?.provisorio ?? false;

      const saidas = await tx
        .select({
          produtoId: produtos.id,
          produtoCodigo: produtos.codigo,
          produtoNome: produtos.nome,
          esperado: regrasTransformacaoSaidas.quantidadeFixa,
          legado: produtos.legadoItemComercialId,
        })
        .from(regrasTransformacaoSaidas)
        .innerJoin(produtos, eq(produtos.id, regrasTransformacaoSaidas.produtoId))
        .where(eq(regrasTransformacaoSaidas.regraId, transf.regraTransformacaoId));

      const ativos = await tx.select({
        itemComercialId: subitens.itemComercialId,
      }).from(subitens).where(and(
        eq(subitens.transformacaoId, transformacaoId),
        isNull(subitens.deletedAt),
      ));

      const contagem = new Map<string, number>();
      for (const s of ativos) {
        contagem.set(s.itemComercialId, (contagem.get(s.itemComercialId) ?? 0) + 1);
      }

      for (const s of saidas) {
        const esperado = Number.parseInt(String(s.esperado), 10) || 0;
        const registrado = s.legado ? (contagem.get(s.legado) ?? 0) : 0;
        let status: ChecklistSlot['status'] = 'pendente';
        if (registrado === 0) status = 'pendente';
        else if (registrado < esperado) status = 'parcial';
        else if (registrado === esperado) status = 'completo';
        else status = 'excedente';
        slots.push({
          produtoId: s.produtoId,
          produtoCodigo: s.produtoCodigo,
          produtoNome: s.produtoNome,
          esperado,
          registrado,
          status,
        });
      }
    }

    const [divAberta] = await tx.select({ id: divergenciasTransformacao.id })
      .from(divergenciasTransformacao)
      .where(and(
        eq(divergenciasTransformacao.transformacaoId, transformacaoId),
        isNull(divergenciasTransformacao.deletedAt),
      ))
      .limit(1);

    const divergente = slots.some((s) => s.status !== 'completo');
    return {
      transformacaoId,
      regraTransformacaoId: transf.regraTransformacaoId,
      regraNome,
      regraProvisoria,
      slots,
      divergente,
      divergenciaAbertaId: divAberta?.id ?? null,
    };
  }
```

- [ ] **Step 4: `abrirDivergencia` completo (`abrirNaTx` com DTO real)**

```ts
  async abrirDivergencia(
    transformacaoId: string,
    dto: AbrirDivergenciaTransformacaoDto,
    operadorId: string,
  ) {
    const { divergencia, aprovacao, dataOperacao } = await this.db.transaction(async (tx) => {
      const [transf] = await tx.select().from(transformacoes)
        .where(and(eq(transformacoes.id, transformacaoId), isNull(transformacoes.deletedAt)))
        .for('update');
      if (!transf) throw new NotFoundException('Transformação não encontrada');
      if (['concluida', 'cancelada'].includes(transf.statusTransformacao)) {
        throw new ConflictException({
          codigo: 'TRANSFORMACAO_FECHADA',
          mensagem: 'Transformação fechada não aceita divergência',
        });
      }

      const [ctx] = await tx
        .select({
          operacaoId: recebimentos.operacaoId,
          dataOperacao: operacoes.data,
          etiqueta: pecas.etiquetaAtual,
        })
        .from(pecas)
        .innerJoin(recebimentos, eq(recebimentos.id, pecas.recebimentoId))
        .innerJoin(operacoes, eq(operacoes.id, recebimentos.operacaoId))
        .where(eq(pecas.id, transf.pecaOrigemId))
        .limit(1);
      if (!ctx?.operacaoId) {
        throw new NotFoundException('Operação da transformação não encontrada');
      }

      const [divergencia] = await tx.insert(divergenciasTransformacao).values({
        transformacaoId,
        tipo: dto.tipo,
        detalheJson: {
          ...dto.detalhe,
          observacao: dto.observacao ?? null,
        },
        abertoPorId: operadorId,
      }).returning();
      if (!divergencia) throw new Error('Falha ao abrir divergência de transformação');

      const descricao =
        `Divergência de transformação (${dto.tipo}) na peça ` +
        `${ctx.etiqueta ?? transf.pecaOrigemId}: checklist esperado×registrado não fecha. ` +
        (dto.observacao ? dto.observacao : 'Sem observação adicional do operador.');
      const impacto =
        'Conclusão da desossa fica condicionada à aprovação gestora; ' +
        'pedidos/cargas que dependem das saídas podem ficar sem cobertura.';

      const aprovacao = await this.aprovacoes.abrirNaTx(
        tx,
        {
          operacaoId: ctx.operacaoId,
          tipo: 'divergencia_transformacao',
          origem: 'desossa',
          descricao,
          impacto,
          referenciaTabela: 'divergencias_transformacao',
          referenciaId: divergencia.id,
        },
        operadorId,
      );

      const [comAprovacao] = await tx.update(divergenciasTransformacao)
        .set({ aprovacaoId: aprovacao.id, updatedAt: new Date() })
        .where(eq(divergenciasTransformacao.id, divergencia.id))
        .returning();

      await this.auditoria.registrar(tx, {
        tabela: 'divergencias_transformacao',
        registroId: divergencia.id,
        operacao: 'INSERT',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: {},
        dadosNovos: comAprovacao,
      });

      return {
        divergencia: comAprovacao,
        aprovacao,
        dataOperacao: ctx.dataOperacao,
      };
    });

    this.events.emit(EVENTOS.DIVERGENCIA_TRANSFORMACAO_ABERTA, {
      dataOperacao,
      transformacaoId,
      divergenciaId: divergencia.id,
      aprovacaoId: aprovacao.id,
      tipo: dto.tipo,
    });
    this.events.emit(EVENTOS.FALTAS_DESOSSA_ATUALIZADAS, {
      dataOperacao,
      motivo: 'divergencia_transformacao_aberta',
    });

    return divergencia;
  }
}
```

- [ ] **Step 5: Gate no `CorteService.concluir` + endpoints**

```ts
const checklist = await this.checklist.obterNaTx(tx, transformacaoId);
if (checklist.divergente && !checklist.divergenciaAbertaId) {
  throw new ConflictException({
    codigo: 'CHECKLIST_DIVERGENTE',
    mensagem: 'Registre a divergência de transformação antes de concluir',
  });
}
```

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
  @Body(new ZodValidationPipe(abrirDivergenciaTransformacaoSchema)) dto: AbrirDivergenciaTransformacaoDto,
  @CurrentUser() user: CurrentUserPayload,
) {
  return this.checklist.abrirDivergencia(id, dto, user.sub);
}
```

- [ ] **Step 6: Commit** `feat(onda7): checklist e divergência formal de transformação`

---

### Task 7 — `GET /desossa/painel?modoTv=`

**Files:**
- Create: `painel.calc.ts`, `painel.service.ts`, `dto/painel.dto.ts`
- Modify: `desossa.controller.ts`, `desossa.module.ts`
- Create: `test/unit/painel.calc.spec.ts`

**Query DTO:**
```ts
export const painelQuerySchema = z.object({
  modoTv: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => v === true || v === 'true'),
  operacaoId: z.string().uuid().optional(),
});
export type PainelQuery = z.infer<typeof painelQuerySchema>;
```

- [ ] **Step 1: Teste unit de `painel.calc` (falha sem implementação)**

```ts
// test/unit/painel.calc.spec.ts
import { montarPainelDesossa } from '../../src/modules/operacao/desossa/painel.calc';

describe('montarPainelDesossa', () => {
  const faltas = [
    {
      produto: { id: 'p1', codigo: 'CB', nome: 'Coxão-bola' },
      quantidadeFaltante: 5,
      quantidadeEstoque: 1,
      origem: 'TZ',
    },
  ];
  const regras = [
    {
      id: 'r1',
      codigo: 'TZ_A',
      nome: 'Alternativa A — TZ → Coxão-bola + Jacaré',
      provisorio: true,
      saidasLabel: '1× CB + 1× JAC',
      prioridade: 10,
    },
  ];

  it('modo normal inclui itens, regras, alertas e totais', () => {
    const p = montarPainelDesossa({ faltas, regras, modoTv: false, geradoEm: '2026-07-31T12:00:00.000Z' });
    expect(p.modoTv).toBe(false);
    expect(p.itens).toHaveLength(1);
    expect(p.itens[0]).toMatchObject({
      produtoCodigo: 'CB',
      faltam: 5,
      prontoEstoque: 1,
      aProduzir: 4,
      origem: 'TZ',
    });
    expect(p.regras[0].provisorio).toBe(true);
    expect(p.alertas.length).toBeGreaterThanOrEqual(0);
    expect(p.totais.itensFaltantes).toBe(1);
  });

  it('modoTv omit regras detalhadas e mantém itens+totais', () => {
    const p = montarPainelDesossa({ faltas, regras, modoTv: true, geradoEm: '2026-07-31T12:00:00.000Z' });
    expect(p.modoTv).toBe(true);
    expect(p.itens).toHaveLength(1);
    expect(p.regras).toEqual([]);
  });
});
```

- [ ] **Step 2: `painel.calc.ts` literal**

```ts
// app/backend/src/modules/operacao/desossa/painel.calc.ts
import type { FaltaDesossaItem } from './faltas.calc';

export type PainelRegraInput = {
  id: string;
  codigo: string | null;
  nome: string;
  provisorio: boolean;
  saidasLabel: string;
  prioridade: number;
};

export type PainelDesossa = {
  geradoEm: string;
  modoTv: boolean;
  itens: Array<{
    produtoId: string;
    produtoCodigo: string;
    produtoNome: string;
    faltam: number;
    prontoEstoque: number;
    aProduzir: number;
    origem: string;
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

function prioridadeDe(faltam: number): 'Alta' | 'Média' | 'Baixa' {
  if (faltam >= 5) return 'Alta';
  if (faltam >= 2) return 'Média';
  return 'Baixa';
}

function statusDe(faltam: number, estoque: number): string {
  if (faltam <= 0 && estoque > 0) return 'Coberto por estoque';
  if (faltam >= 5) return 'Crítico';
  if (faltam >= 2) return 'Atenção';
  if (faltam > 0) return 'A produzir';
  return 'Aguardando TZ';
}

export function montarPainelDesossa(input: {
  faltas: FaltaDesossaItem[];
  regras: PainelRegraInput[];
  modoTv: boolean;
  geradoEm: string;
}): PainelDesossa {
  const itens = input.faltas.map((f) => {
    const aProduzir = Math.max(0, f.quantidadeFaltante);
    return {
      produtoId: f.produto.id,
      produtoCodigo: f.produto.codigo,
      produtoNome: f.produto.nome,
      faltam: f.quantidadeFaltante,
      prontoEstoque: f.quantidadeEstoque,
      aProduzir,
      origem: f.origem,
      prioridade: prioridadeDe(f.quantidadeFaltante),
      status: statusDe(f.quantidadeFaltante, f.quantidadeEstoque),
    };
  });

  const totais = {
    itensFaltantes: itens.filter((i) => i.faltam > 0).length,
    pecasFaltantes: itens.reduce((acc, i) => acc + i.faltam, 0),
    prontoEstoque: itens.reduce((acc, i) => acc + i.prontoEstoque, 0),
  };

  const alertas: PainelDesossa['alertas'] = [];
  const criticos = itens.filter((i) => i.status === 'Crítico');
  if (criticos.length > 0) {
    alertas.push({
      tipo: 'Crítico',
      msg: `${criticos.length} item(ns) crítico(s) na desossa — priorizar TZ`,
    });
  }

  const regras = input.modoTv
    ? []
    : input.regras.map((r) => ({
        regraId: r.id,
        codigo: r.codigo,
        nome: r.nome,
        provisorio: r.provisorio,
        tzsEstimados: Math.ceil(totais.pecasFaltantes / 2) || 0,
        saidasEsperadas: r.saidasLabel,
        status: r.provisorio ? 'Provisória' : 'Ativa',
      }));

  return {
    geradoEm: input.geradoEm,
    modoTv: input.modoTv,
    itens,
    regras,
    alertas: input.modoTv ? alertas : alertas,
    totais,
  };
}
```

- [ ] **Step 3: Service + controller**

```ts
// painel.service.ts (esqueleto literal)
@Injectable()
export class PainelDesossaService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly faltas: FaltasService,
  ) {}

  async obter(q: PainelQuery) {
    const listaFaltas = await this.faltas.listarFaltas();
    const regrasDb = await this.db.select().from(regrasTransformacao)
      .where(and(eq(regrasTransformacao.status, 'ativo'), isNull(regrasTransformacao.deletedAt)));
    const regras: PainelRegraInput[] = [];
    for (const r of regrasDb) {
      const saidas = await this.db
        .select({ codigo: produtos.codigo, qtd: regrasTransformacaoSaidas.quantidadeFixa })
        .from(regrasTransformacaoSaidas)
        .innerJoin(produtos, eq(produtos.id, regrasTransformacaoSaidas.produtoId))
        .where(eq(regrasTransformacaoSaidas.regraId, r.id));
      regras.push({
        id: r.id,
        codigo: r.codigo,
        nome: r.nome,
        provisorio: r.provisorio,
        prioridade: r.prioridade,
        saidasLabel: saidas.map((s) => `${s.qtd}× ${s.codigo}`).join(' + '),
      });
    }
    return montarPainelDesossa({
      faltas: listaFaltas,
      regras,
      modoTv: q.modoTv === true,
      geradoEm: new Date().toISOString(),
    });
  }
}
```

```ts
@Get('painel')
@RequirePermissoes('DESOSSA_PAINEL_LER')
async painel(@Query(new ZodValidationPipe(painelQuerySchema)) q: PainelQuery) {
  return this.painel.obter(q);
}
```

- [ ] **Step 4: PASS + commit** `feat(onda7): endpoint GET /desossa/painel com modo TV`

---

### Task 8 — Emissores de `FALTAS_DESOSSA_ATUALIZADAS`

**Files:** `subitem.service.ts` (associar), `corte.service.ts` (concluir); T4 já emite no bind.

- [ ] **Step 1: Teste spy (rollback × commit)**

```ts
it('não emite faltas_desossa_atualizadas em rollback', async () => {
  const spy = jest.spyOn(events, 'emit');
  await expect(subitem.associar(subId, dtoQueFalha, op)).rejects.toBeTruthy();
  expect(spy.mock.calls.filter((c) => c[0] === EVENTOS.FALTAS_DESOSSA_ATUALIZADAS)).toHaveLength(0);
});

it('emite faltas_desossa_atualizadas após associar com commit', async () => {
  const spy = jest.spyOn(events, 'emit');
  await subitem.associar(subId, dtoOk, op);
  expect(spy).toHaveBeenCalledWith(
    EVENTOS.FALTAS_DESOSSA_ATUALIZADAS,
    expect.objectContaining({ motivo: 'subitem_associado', dataOperacao: expect.any(String) }),
  );
});
```

- [ ] **Step 2: Literais pós-commit**

```ts
// subitem.service.ts — após commit bem-sucedido de associar (fora do transaction callback):
this.events.emit(EVENTOS.FALTAS_DESOSSA_ATUALIZADAS, {
  dataOperacao: resultado.dataOperacao,
  motivo: 'subitem_associado',
});

// corte.service.ts — após commit bem-sucedido de concluir:
this.events.emit(EVENTOS.FALTAS_DESOSSA_ATUALIZADAS, {
  dataOperacao: resultado.dataOperacao,
  motivo: 'corte_concluido',
});
```

Emit **somente após commit** (padrão F4c / ADR-004). Gateway entrega via `roomsDaData` (inclui `desossa`).

- [ ] **Step 3: Commit** `feat(onda7): broadcast faltas_desossa_atualizadas pós-commit`

---

### Task 9 — BFF Next.js

**Files:** routes API listadas; tipos em `lib/desossa.ts`.

Padrão (espelho de `api/desossa/faltas/route.ts`):

```ts
// app/frontend/src/app/api/desossa/painel/route.ts
import { NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

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

```ts
// app/frontend/src/app/api/desossa/etiquetas/route.ts
export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const { data, error, status } = await fetchBackend(
    `/desossa/etiquetas${qs ? `?${qs}` : ''}`,
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data);
}
```

```ts
// app/frontend/src/app/api/operacao/corte/[id]/regra/route.ts
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  const { data, error, status } = await fetchBackend(`/operacao/corte/${id}/regra`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status });
}
```

Idem checklist (GET) e divergência (POST). Tipos em `lib/desossa.ts`: `PainelDesossa`, `ChecklistResponse`, `EtiquetaDesossaListada`, `PecaElegivelDesossa`.

- [ ] Commit: `feat(onda7): BFF painel, etiquetas e bind/checklist/divergência`

---

### Task 10 — `GET /desossa/etiquetas`

**Files:** `etiquetas-desossa.service.ts`, controller GET, testes.

```ts
// dto
export const listarEtiquetasDesossaSchema = z.object({
  operacaoId: z.string().uuid(),
  transformacaoId: z.string().uuid().optional(),
  estado: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
```

```ts
export type EtiquetaDesossaListada = {
  id: string;
  codigo: string | null;
  estado: string;
  peso: string | null;
  produtoCodigo: string;
  produtoNome: string;
  pecaMaeCodigo: string | null;
  transformacaoId: string;
  subitemId: string;
  destino: 'pedido' | 'estoque' | string;
  clientePedido: string | null;
  createdAt: string;
  invalidadaEm: string | null;
};

@Injectable()
export class EtiquetasDesossaService {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>) {}

  async listar(filtros: z.infer<typeof listarEtiquetasDesossaSchema>): Promise<Paginado<EtiquetaDesossaListada>> {
    // etiquetas_impressoes (tip 94fb341) não tem deleted_at — filtrar por operação + subitem
    const condicoes = [
      eq(recebimentos.operacaoId, filtros.operacaoId),
      isNotNull(etiquetasImpressoes.subitemId),
    ];
    if (filtros.transformacaoId) {
      condicoes.push(eq(transformacoes.id, filtros.transformacaoId));
    }
    if (filtros.estado) {
      // CHECK chk_etiq_estado: emitida|ativa|invalidada_por_troca|reimpressa|cancelada
      condicoes.push(eq(etiquetasImpressoes.estado, filtros.estado));
    }

    const linhas = await this.db
      .select({
        id: etiquetasImpressoes.id,
        codigo: sql<string | null>`${etiquetasImpressoes.payload}->>'qr'`,
        estado: etiquetasImpressoes.estado,
        peso: subitens.peso,
        produtoCodigo: itensComerciais.codigo,
        produtoNome: itensComerciais.descricao,
        pecaMaeCodigo: pecas.etiquetaAtual,
        transformacaoId: transformacoes.id,
        subitemId: subitens.id,
        pedidoVendaId: subitens.pedidoVendaId,
        createdAt: etiquetasImpressoes.createdAt,
        invalidadaEm: etiquetasImpressoes.invalidadaEm,
      })
      .from(etiquetasImpressoes)
      .innerJoin(subitens, eq(subitens.id, etiquetasImpressoes.subitemId))
      .innerJoin(transformacoes, eq(transformacoes.id, subitens.transformacaoId))
      .innerJoin(pecas, eq(pecas.id, transformacoes.pecaOrigemId))
      .innerJoin(recebimentos, eq(recebimentos.id, pecas.recebimentoId))
      .innerJoin(itensComerciais, eq(itensComerciais.id, subitens.itemComercialId))
      .where(and(...condicoes))
      .orderBy(desc(etiquetasImpressoes.createdAt));

    const itens: EtiquetaDesossaListada[] = linhas.map((l) => ({
      id: l.id,
      codigo: l.codigo,
      estado: l.estado,
      peso: l.peso,
      produtoCodigo: l.produtoCodigo,
      produtoNome: l.produtoNome,
      pecaMaeCodigo: l.pecaMaeCodigo,
      transformacaoId: l.transformacaoId,
      subitemId: l.subitemId,
      destino: l.pedidoVendaId ? 'pedido' : 'estoque',
      clientePedido: null,
      createdAt: new Date(l.createdAt as Date).toISOString(),
      invalidadaEm: l.invalidadaEm
        ? new Date(l.invalidadaEm as Date).toISOString()
        : null,
    }));

    const inicio = (filtros.page - 1) * filtros.pageSize;
    return montarPaginado(
      itens.slice(inicio, inicio + filtros.pageSize),
      itens.length,
      { page: filtros.page, pageSize: filtros.pageSize },
    );
  }
}
```

```ts
@Get('etiquetas')
@RequirePermissoes('DESOSSA_LER')
listarEtiquetas(
  @Query(new ZodValidationPipe(listarEtiquetasDesossaSchema)) q: ListarEtiquetasDesossaDto,
) {
  return this.etiquetasDesossa.listar(q);
}
```

DoD 7.21: fixture com `estado='invalidada_por_troca'` aparece quando aplicável.

- [ ] Commit: `feat(onda7): listagem de etiquetas da desossa com peça mãe`

---

### Task 11 — UI Dashboard fiel + WS (remove poll)

**Files:** `desossa-dashboard-client.tsx` (+ extrair `TVMode` no mesmo arquivo).

**Protótipo:** `DesossaDashboard.tsx` @ `8d32aa4c` — TVMode `:280-370`, KPIs `:452-467`, tabela itens `:492-552`, sugestão por regra `:554-600`, copy "Não representa produção em andamento" `:496`.

- [ ] **Step 1: Remover poll e conectar WS**

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
// PROIBIDO: setInterval / poll HTTP
```

- [ ] **Step 2: TVMode fiel (estrutura do protótipo — tokens DS, sem seed)**

```tsx
function TVMode({
  itens,
  hora,
  alertas,
  onExit,
}: {
  itens: PainelDesossa['itens'];
  hora: string;
  alertas: PainelDesossa['alertas'];
  onExit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-login-panel">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-white/10 px-8 py-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/50">ALFA CARNES</p>
          <h1 className="mt-0.5 text-[28px] font-black tracking-wide text-white">
            DESOSSA — PAINEL OPERACIONAL
          </h1>
          <p className="mt-1 text-[13px] text-white/50">
            O que falta produzir para atender pedidos e cargas
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-white/40">Atualizado às</p>
            <p className="font-mono text-[18px] font-black text-white">{hora}</p>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="flex h-9 items-center gap-1.5 rounded-md border border-white/20 px-4 text-[12px] font-medium text-white/70 hover:bg-white/8"
          >
            <X className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-8 py-4">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              {['PRIOR.', 'PRODUTO', 'FALTAM', 'A PRODUZIR', 'ORIGEM', 'STATUS'].map((h) => (
                <th
                  key={h}
                  className="pb-3 text-left text-[11px] font-black tracking-[0.2em] text-white/40"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={item.produtoId} className="border-b border-white/7">
                <td className="py-4 pr-4 text-[11px] font-black text-white">{item.prioridade}</td>
                <td className="py-4 pr-6 text-[22px] font-black text-white">{item.produtoNome}</td>
                <td className="py-4 pr-6 font-mono text-[22px] font-black text-info-ink">{item.faltam}</td>
                <td className="py-4 pr-6 font-mono text-[20px] font-black text-white">
                  {item.aProduzir} <span className="text-[13px] text-white/40">peças</span>
                </td>
                <td className="py-4 pr-6 text-[16px] font-bold text-white/60">{item.origem}</td>
                <td className="py-4 text-[12px] font-black text-white">{item.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-shrink-0 items-center gap-6 border-t border-white/8 px-8 py-3">
        {alertas.map((a, i) => (
          <p key={i} className="text-[11px] text-white/50">{a.msg}</p>
        ))}
        <p className="ml-auto text-[10px] uppercase tracking-widest text-white/30">
          Atualização por eventos em tempo real
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: KPIs + tabela itens + sugestão por regra**

```tsx
{/* KPIs — DesossaDashboard.tsx:452-467 */}
<div className="grid grid-cols-5 gap-3">
  {[
    { label: 'Itens faltantes', value: painel.totais.itensFaltantes, color: 'text-destructive' },
    { label: 'Prontos em estoque', value: painel.totais.prontoEstoque, color: 'text-success-strong' },
    { label: 'Peças faltantes', value: painel.totais.pecasFaltantes, color: 'text-info-ink' },
    { label: 'Regras sugeridas', value: painel.regras.length, color: 'text-violet-700' },
    {
      label: 'Prioridade alta',
      value: painel.itens.filter((i) => i.prioridade === 'Alta').length,
      color: 'text-warning-ink',
    },
  ].map((k) => (
    <div key={k.label} className="rounded-xl border border-border bg-card px-4 py-3.5">
      <p className="mb-1 text-[11px] font-medium text-muted-foreground">{k.label}</p>
      <p className={`text-[32px] font-black leading-none ${k.color}`}>{k.value}</p>
    </div>
  ))}
</div>

{/* Tabela — copy anti-"em produção" literal */}
<div className="overflow-hidden rounded-xl border border-border bg-card">
  <div className="border-b border-border px-5 py-3.5">
    <h2 className="text-[13px] font-bold text-foreground">Painel de Itens a Produzir</h2>
    <p className="mt-0.5 text-[11px] text-muted-foreground">
      Lista orientativa dos produtos que faltam para pedidos e cargas. Não representa produção em
      andamento.
    </p>
  </div>
  <table className="w-full text-[12px]">
    <thead>
      <tr className="border-b border-border bg-muted/40">
        {['Prior.', 'Produto', 'Faltam', 'Estoque pronto', 'A produzir', 'Origem', 'Status'].map((h) => (
          <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {h}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {painel.itens.map((item) => (
        <tr key={item.produtoId} className="border-b border-border/60">
          <td className="px-3 py-2.5">{item.prioridade}</td>
          <td className="px-3 py-2.5 font-bold">{item.produtoNome}</td>
          <td className="px-3 py-2.5 font-mono font-black">{item.faltam}</td>
          <td className="px-3 py-2.5">{item.prontoEstoque || '—'}</td>
          <td className="px-3 py-2.5 font-mono font-black">{item.aProduzir}</td>
          <td className="px-3 py-2.5 font-semibold text-violet-700">{item.origem}</td>
          <td className="px-3 py-2.5">{item.status}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

{/* Sugestão por regra — DesossaDashboard.tsx:554+ */}
<div className="overflow-hidden rounded-xl border border-border bg-card">
  <div className="border-b border-border px-5 py-3.5">
    <h2 className="text-[13px] font-bold text-foreground">Sugestão por Regra de Transformação</h2>
    <p className="mt-0.5 text-[11px] text-muted-foreground">
      Agrupamento orientativo para evitar leitura duplicada de produtos que compartilham o mesmo TZ.
    </p>
  </div>
  <table className="w-full text-[12px]">
    <thead>
      <tr className="border-b border-border bg-muted/40">
        {['Regra sugerida', 'TZs estimados', 'Saídas esperadas', 'Status', 'Provisório'].map((h) => (
          <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {h}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {painel.regras.map((r) => (
        <tr key={r.regraId} className="border-b border-border/60">
          <td className="px-3 py-2.5 font-bold text-violet-700">{r.nome}</td>
          <td className="px-3 py-2.5 font-mono font-black">{r.tzsEstimados}</td>
          <td className="px-3 py-2.5">{r.saidasEsperadas}</td>
          <td className="px-3 py-2.5">{r.status}</td>
          <td className="px-3 py-2.5">
            {r.provisorio ? (
              <Badge variant="outline" title="P12 / v1.1 §16.15 — validar com cliente">
                Provisório
              </Badge>
            ) : null}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

<button type="button" onClick={() => setModoTV(true)} className="...">
  <Tv className="h-3.5 w-3.5" /> Modo TV
</button>
{modoTV && (
  <TVMode
    itens={painel.itens}
    hora={hora}
    alertas={painel.alertas}
    onExit={() => setModoTV(false)}
  />
)}
```

```bash
rg -n "setInterval" "app/frontend/src/app/(admin)/desossa/dashboard" && echo FAIL || echo OK
# Expected: OK
```

- [ ] Commit: `feat(onda7): dashboard desossa fiel com Modo TV e WebSocket`

---

### Task 12 — UI Pesagem/Destinação fiel + `pecas-elegiveis`

**Decisão D7.13 (fechada):** endpoint **não existe** no tip `94fb341` → **criar** nesta task.

**Files:**
- Create: `pecas-elegiveis.service.ts`, `dto/pecas-elegiveis.dto.ts`
- Modify: `corte.controller.ts`, `corte.module.ts`
- Create: `desossa-pesagem-client.tsx`; atualizar `page.tsx`
- BFF: `app/api/operacao/corte/pecas-elegiveis/route.ts`

- [ ] **Step 1: Backend `GET /operacao/corte/pecas-elegiveis` literal**

```ts
// dto/pecas-elegiveis.dto.ts
export const pecasElegiveisQuerySchema = z.object({
  operacaoId: z.string().uuid(),
});
export type PecasElegiveisQuery = z.infer<typeof pecasElegiveisQuerySchema>;

export type PecaElegivelDesossa = {
  pecaId: string;
  etiquetaAtual: string | null;
  statusPeca: string;
  pesoOriginal: string | null;
  itemComercialId: string;
  produtoCodigo: string | null;
  recebimentoId: string;
  transformacaoId: string | null;
};
```

```ts
// pecas-elegiveis.service.ts
@Injectable()
export class PecasElegiveisService {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>) {}

  async listar(q: PecasElegiveisQuery): Promise<PecaElegivelDesossa[]> {
    const linhas = await this.db
      .select({
        pecaId: pecas.id,
        etiquetaAtual: pecas.etiquetaAtual,
        statusPeca: pecas.statusPeca,
        pesoOriginal: pecas.pesoOriginal,
        itemComercialId: pecas.itemComercialBaseId,
        produtoCodigo: itensComerciais.codigo,
        recebimentoId: pecas.recebimentoId,
        transformacaoId: transformacoes.id,
      })
      .from(pecas)
      .innerJoin(recebimentos, eq(recebimentos.id, pecas.recebimentoId))
      .leftJoin(itensComerciais, eq(itensComerciais.id, pecas.itemComercialBaseId))
      .leftJoin(
        transformacoes,
        and(
          eq(transformacoes.pecaOrigemId, pecas.id),
          isNull(transformacoes.deletedAt),
          notInArray(transformacoes.statusTransformacao, ['concluida', 'cancelada']),
        ),
      )
      .where(and(
        eq(recebimentos.operacaoId, q.operacaoId),
        inArray(pecas.statusPeca, ['para_corte', 'em_transformacao']),
        isNull(pecas.deletedAt),
      ))
      .orderBy(asc(pecas.createdAt));

    return linhas.map((l) => ({
      pecaId: l.pecaId,
      etiquetaAtual: l.etiquetaAtual,
      statusPeca: l.statusPeca,
      pesoOriginal: l.pesoOriginal,
      itemComercialId: l.itemComercialId,
      produtoCodigo: l.produtoCodigo,
      recebimentoId: l.recebimentoId,
      transformacaoId: l.transformacaoId,
    }));
  }
}
```

```ts
// corte.controller.ts — ANTES de @Get(':id') para não capturar "pecas-elegiveis" como id
@Get('pecas-elegiveis')
@RequirePermissoes('CORTE_GERENCIAR')
listarPecasElegiveis(
  @Query(new ZodValidationPipe(pecasElegiveisQuerySchema)) q: PecasElegiveisQuery,
) {
  return this.pecasElegiveis.listar(q);
}
```

```ts
// BFF app/api/operacao/corte/pecas-elegiveis/route.ts
export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const { data, error, status } = await fetchBackend(
    `/operacao/corte/pecas-elegiveis${qs ? `?${qs}` : ''}`,
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data);
}
```

- [ ] **Step 2: Fluxo API da tela**

1. `GET /api/operacao/corte/pecas-elegiveis?operacaoId=`
2. `POST /api/operacao/corte/pecas/:id/iniciar`
3. `POST /api/operacao/corte/:id/regra`
4. Por slot: subitens → pesar → associar
5. Se divergente: `POST .../divergencia` → `POST .../concluir`
6. Checklist: `GET .../checklist`

- [ ] **Step 3: JSX fiel — Badge, seletor A/B, checklist, modais** (`DesossaPesagem.tsx` @ `8d32aa4c`)

```tsx
function BadgeProvisorio({ texto }: { texto?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-warning-border bg-warning-surface px-2 py-0.5 text-[10px] font-bold text-warning-ink"
      title="P12 / v1.1 §16.15 — validar com cliente"
    >
      <AlertTriangle className="h-2.5 w-2.5" /> {texto ?? 'Provisório'}
    </span>
  );
}

{/* Seletor de regra A/B — :575-600 */}
{tz && (
  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
    <span className="mr-1 whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      Regra de transformação:
    </span>
    {regras.map((r) => (
      <button
        key={r.id}
        type="button"
        disabled={regraBloqueada && regraId !== r.id}
        onClick={() => void vincularRegra(r.id)}
        title={
          regraBloqueada && regraId !== r.id
            ? 'A regra não pode ser alterada após registrar a primeira saída. Cancele os registros para trocar.'
            : undefined
        }
        className={`h-7 whitespace-nowrap rounded-md border px-3 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
          regraId === r.id
            ? 'border-violet-800 bg-violet-800 text-white'
            : 'border-border bg-card text-muted-foreground'
        }`}
      >
        {r.nome}
      </button>
    ))}
    <BadgeProvisorio texto="Regras provisórias — validar com cliente" />
  </div>
)}

{/* Checklist de saídas — :701-739 */}
<div className="overflow-hidden rounded-xl border border-border bg-card">
  <div className="flex items-center justify-between border-b border-border px-4 py-3">
    <div>
      <p className="text-[12px] font-bold">Saídas da regra</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        {registradas} de {checklist.slots.length} registradas
      </p>
    </div>
    <button type="button" onClick={() => setModalFinalizar(true)} className="...">
      Finalizar
    </button>
  </div>
  <div className="flex flex-col gap-2 p-3">
    {checklist.slots.map((s) => (
      <button
        key={s.produtoId}
        type="button"
        disabled={s.status === 'completo'}
        onClick={() => setSlotAtual(s.produtoId)}
        className="..."
      >
        <p className="text-[12px] font-bold">{s.produtoNome}</p>
        <p className="text-[10px] text-muted-foreground">
          {s.registrado}/{s.esperado} · {s.status}
        </p>
      </button>
    ))}
  </div>
</div>
```

```tsx
{/* Modal finalizar com divergência tipada — estrutura DesossaPesagem ModalFinalizarTransformacao :283+ */}
{modalFinalizar && (
  <Dialog open onOpenChange={setModalFinalizar}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Finalizar transformação</DialogTitle>
      </DialogHeader>
      {checklist.divergente ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Checklist divergente — registre o tipo antes de concluir.
          </p>
          <Select value={tipoDiv} onValueChange={setTipoDiv}>
            <SelectTrigger><SelectValue placeholder="Tipo de divergência" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="subpeca_faltante">Subpeça faltante</SelectItem>
              <SelectItem value="subpeca_excedente">Subpeça excedente</SelectItem>
              <SelectItem value="produto_diferente">Produto diferente</SelectItem>
              <SelectItem value="perda_informada">Perda informada</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            value={obsDiv}
            onChange={(e) => setObsDiv(e.target.value)}
            placeholder="Observação (ao menos 3 caracteres)"
          />
          <Button
            onClick={async () => {
              await fetchBackend(`/operacao/corte/${transfId}/divergencia`, {
                method: 'POST',
                body: JSON.stringify({ tipo: tipoDiv, detalhe: {}, observacao: obsDiv }),
              });
              await fetchBackend(`/operacao/corte/${transfId}/concluir`, { method: 'POST' });
              setModalFinalizar(false);
            }}
          >
            Registrar divergência e concluir
          </Button>
        </div>
      ) : (
        <Button onClick={() => void concluir()}>Concluir</Button>
      )}
    </DialogContent>
  </Dialog>
)}
```

Modais adicionais fiéis ao protótipo: `ModalSelecionarTz` (lista `pecas-elegiveis`), `ModalEtiquetaParte` (mostra **Peça mãe (TZ)**), `ModalCancelarAcao`. Zero `ITENS_SEED`/`REGRAS_SEED` em runtime.

- [ ] **Step 4: Commit** `feat(onda7): tela pesagem desossa fiel e pecas-elegiveis`

---

### Task 13 — UI Etiquetas desossa fiel

**Files:** `desossa-etiquetas-client.tsx`; page; consome `/api/desossa/etiquetas`.

**Protótipo:** `DesossaEtiquetas.tsx` @ `8d32aa4c` — KPIs `:599-603`, filtros `:623`, coluna Peça mãe `:650`, drawer Invalidada por troca `:365-443`.

```tsx
function StatusBadge({ estado }: { estado: string }) {
  const mapa: Record<string, string> = {
    emitida: 'Ativa',
    ativa: 'Ativa',
    reimpressa: 'Reimpressa',
    cancelada: 'Cancelada',
    invalidada_por_troca: 'Invalidada por troca',
  };
  return <Badge variant="outline">{mapa[estado] ?? estado}</Badge>;
}

{/* KPIs */}
<div className="grid grid-cols-5 gap-3">
  {[
    { label: 'Emitidas', value: stats.emitidas },
    { label: 'Reimpressões', value: stats.reimpressoes },
    { label: 'Canceladas', value: stats.canceladas },
    { label: 'Invalidadas por troca', value: stats.invalidadas, color: 'text-destructive' },
    { label: 'Pendentes de impressão', value: stats.pendentes },
  ].map((k) => (
    <div key={k.label} className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-[11px] text-muted-foreground">{k.label}</p>
      <p className={`text-[28px] font-black ${k.color ?? ''}`}>{k.value}</p>
    </div>
  ))}
</div>

{/* Filtros */}
<select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="...">
  {['Todos', 'emitida', 'ativa', 'reimpressa', 'cancelada', 'invalidada_por_troca'].map((o) => (
    <option key={o} value={o}>{o}</option>
  ))}
</select>

{/* Tabela com coluna Peça mãe (TZ) */}
<table className="w-full text-[12px]">
  <thead>
    <tr>
      {['Código', 'Produto', 'Peso', 'Destino', 'Peça mãe (TZ)', 'Emissão', 'Status', ''].map((h) => (
        <th key={h}>{h}</th>
      ))}
    </tr>
  </thead>
  <tbody>
    {etiquetas.map((e) => (
      <tr key={e.id} className={e.estado === 'invalidada_por_troca' ? 'opacity-70' : ''}>
        <td className="font-mono">{e.codigo}</td>
        <td>{e.produtoNome}</td>
        <td className="font-mono">{e.peso}</td>
        <td>{e.destino}</td>
        <td className="font-mono font-bold text-violet-800">{e.pecaMaeCodigo ?? '—'}</td>
        <td>{new Date(e.createdAt).toLocaleString('pt-BR')}</td>
        <td><StatusBadge estado={e.estado} /></td>
        <td>
          <button type="button" onClick={() => setDrawer(e)}><Eye /></button>
        </td>
      </tr>
    ))}
  </tbody>
</table>

{/* Drawer — alerta Invalidada por troca + Peça mãe */}
{drawer && (
  <Sheet open onOpenChange={() => setDrawer(null)}>
    <SheetContent side="right" className="w-[560px] max-w-full p-0">
      <SheetHeader className="border-b px-6 py-4">
        <SheetTitle>Etiqueta {drawer.codigo}</SheetTitle>
        <StatusBadge estado={drawer.estado} />
      </SheetHeader>
      <div className="flex flex-col gap-6 p-6">
        {drawer.estado === 'invalidada_por_troca' && (
          <div className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-surface p-3">
            <RefreshCcw className="mt-0.5 h-4 w-4 text-destructive" />
            <p className="text-[12px] text-danger-rose">
              Esta etiqueta foi invalidada em razão de uma troca de peça (v1.1 §10.4). Uma nova
              etiqueta foi emitida para a peça correta — consulte o histórico.
            </p>
          </div>
        )}
        <div>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Rastreabilidade
          </p>
          <div className="grid grid-cols-2 gap-y-2 rounded-lg border border-violet-200 bg-violet-surface p-4 text-[12px]">
            <div className="col-span-2">
              <span className="text-muted-foreground">Peça mãe (TZ): </span>
              <span className="font-mono font-bold text-violet-800">{drawer.pecaMaeCodigo}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Transformação: </span>
              <span className="font-mono">{drawer.transformacaoId}</span>
            </div>
          </div>
        </div>
      </div>
    </SheetContent>
  </Sheet>
)}
```

Zero mock seed do protótipo (`ETQ_SEED`) em runtime. Stats derivados da resposta de `/api/desossa/etiquetas`.

- [ ] Commit: `feat(onda7): tela etiquetas da desossa fiel ao protótipo`

### Task 14 — Testes DoD, e2e, evidências, grep Marca

**Files:** `test/integration/onda7-desossa.spec.ts`, `e2e/onda7-desossa.spec.ts`, scripts capture, `docs/evidencias/onda7-desossa/README.md`.

E2E obrigatório:
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
2. **Placeholder scan:** nenhum TBD/TODO/a definir/implementar depois/similar à Task/fase 2; zero "mínimo" como compromisso; D7.13 decidido (criar endpoint).
3. **Type consistency:** `regraTransformacaoId`, wires `faltas_desossa_atualizadas` / `divergencia_transformacao_aberta`, tipos de divergência alinhados ao CHECK.
4. **PR #38:** não reutilizado; branch de plano `feature/onda7-plano-desossa`.

---

## Fora de escopo (resto)

Qualquer cadastro admin além do seed; mudanças em Troca de Peça (O6); adapter de balança real; relatórios SIF novos.
