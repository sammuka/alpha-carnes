# Fase 1 — Infra + Auth + RBAC (AlphaCarnes) — Plano de Implementação

> **Para workers agênticos:** SUB-SKILL OBRIGATÓRIA: usar `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar tarefa a tarefa. Passos usam checkbox (`- [ ]`).
>
> **Local definitivo na execução:** copiar este plano para `docs/superpowers/plans/2026-06-05-f1-infra-auth-rbac.md` (este arquivo em `~/.claude/plans/` é o rascunho do plan mode).

**Goal:** Entregar a fundação completa e produtiva do AlphaCarnes — monorepo NestJS 11 + Next.js 16, banco PostgreSQL 18 via Drizzle, autenticação JWT (login/refresh/logout com rotação e revogação), RBAC com 11 perfis e permissões nomeadas, segregação de funções, transversais RA-01..06, CI completo e docker-compose de um comando.

**Architecture:** Modular monolith NestJS (Drizzle direto nos services, sem repositórios genéricos — exceto porta fina de dados de auth onde a testabilidade exige). RBAC **N:N** (`usuarios` ↔ `usuarios_perfis` ↔ `perfis`) com catálogo de **permissões nomeadas** e mapa `perfis_permissoes`. Frontend Next.js como **BFF** (gating de apresentação + proxy server-to-server); backend é a única fonte de verdade de autorização (RA-01). Migrations por domínio via `drizzle-kit generate` (nunca `push`); migrate/seed em script isolado, executados no entrypoint do container (nunca no boot da app). PKs com **`uuidv7()` nativo do PostgreSQL 18** (ADR-003).

> **Gate de revisão do plano:** aprovado com mudanças pelo Quality Owner. Os 9 ajustes obrigatórios estão incorporados nas Tasks 2, 3, 4, 5, 7, 8, 9, 11, 12, 13 e na seção de Verificação. Decisões já confirmadas: RBAC N:N + permissões nomeadas + segregação genérica; **UUID = `uuidv7()` do PG18** (não `gen_random_uuid()`).

**Tech Stack:** Node 22 LTS, NestJS 11, TypeScript 5 strict, Drizzle ORM + `pg`, PostgreSQL 18, Zod 4, `nestjs-pino`, `@nestjs/jwt` + `passport-jwt` + `@nestjs/throttler` (backend) / `jose` (Edge middleware, verifica assinatura), **`@node-rs/argon2`** (prebuilt — evita toolchain nativa no Docker/CI); Next.js 16 App Router + React 19 (camada **BFF** via route handlers/server actions) + Tailwind 4 + Shadcn/ui + TanStack Query; Jest + Testing Library; Docker Compose; GitHub Actions.

---

## Context

O repositório está em Fase 0 (documentação). `app/backend` e `app/frontend` são placeholders `.gitkeep`; não há `package.json` na raiz; `landing/` é uma SPA de documentação independente (Vite, lockfile próprio). A governança (`docs/governance/`) define o contrato de entrega da F1: DoD em `quality-gates.md`, fluxo de PR em `framework-revisao.md`, CI em `ci-spec.md`, e a Tensão A do `roadmap-canonico.md` decide **migration por domínio** com a F1 criando só o schema de auth/RBAC/auditoria.

**Divergências resolvidas (decisões do usuário registradas neste plano):**
1. **RBAC N:N** (`perfis` + `usuarios_perfis`), substituindo a coluna única `usuarios.perfil` do `modelo-logico-postgres.md` §1.6. JWT carrega array de perfis/permissões.
2. **Fonte canônica dos 11 perfis: doc 013**, com slugs técnicos derivados; ADR-005 e modelo lógico são reconciliados via **nova ADR-007**.
3. **Autorização via permissões nomeadas** + mapa perfil→permissões (Guard `@RequirePermissoes('X')`), aderente ao ADR-005.
4. **Segregação de funções via mecanismo genérico** (impede criador==aprovador), provado por teste de 403 sobre gestão de usuários/perfis (única ação existente na F1).

Resultado esperado: ao fim da F1, um único `docker compose up --build` sobe postgres+backend+frontend com seed reproduzível; login/refresh/logout e RBAC funcionam e são provados por teste; CI verde com cobertura ≥80%.

---

## Os 11 perfis canônicos (doc 013 → slugs)

| # | Perfil (doc 013) | slug |
|---|---|---|
| 1 | Administrador do Sistema | `administrador` |
| 2 | Comprador / Operador de Compras | `compras` |
| 3 | Gestor Comercial / Operacional | `gestor` |
| 4 | Operador Comercial | `comercial` |
| 5 | Operador de Recebimento / Pesagem | `recebimento_pesagem` |
| 6 | Operador de Corte | `corte` |
| 7 | Operador de Expedição | `expedicao` |
| 8 | Conferente | `conferente` |
| 9 | Faturamento / Fiscal | `faturamento` |
| 10 | Logística / Liberação | `logistica` |
| 11 | Diretoria / Gestão Executiva | `diretoria` |

**Permissões nomeadas da F1** (mínimo para exercer o mecanismo, sem puxar F2): `USUARIOS_GERENCIAR`, `USUARIOS_APROVAR`, `PERFIS_GERENCIAR`, `AUDITORIA_VISUALIZAR`. Mapa F1: `administrador` → todas; `gestor` → `USUARIOS_APROVAR`, `AUDITORIA_VISUALIZAR`; `diretoria` → `AUDITORIA_VISUALIZAR`. Demais perfis → nenhuma permissão administrativa (base para o teste de 403). Segregação SF-01: quem tem `USUARIOS_GERENCIAR` (cria) não pode ser o aprovador (`USUARIOS_APROVAR`) do mesmo registro.

---

## Estrutura de arquivos (decomposição)

```
/ (raiz)
  package.json                      # workspaces: app/backend, app/frontend (landing FORA)
  package-lock.json                 # único lockfile do produto
  tsconfig.base.json                # strict: true, compartilhado
  .nvmrc                            # 22
  eslint.config.mjs                 # ESLint 9 flat (overrides por workspace)
  .env.example
  docker-compose.yml
  .github/
    workflows/ci.yml
    pull_request_template.md
    CODEOWNERS
    dependabot.yml
  scripts/check-coverage.mjs

app/backend/
  package.json  tsconfig.json  nest-cli.json  drizzle.config.ts  Dockerfile  docker-entrypoint.sh
  src/
    main.ts                         # pino, pipes/filters globais, CORS, shutdown hooks
    app.module.ts
    config/                         # env validada por Zod (boot falha se inválida)
    database/
      database.module.ts            # @Global, provê token DRIZZLE (pool pg)
      migrate.ts  seed.ts
      schema/{auth.schema.ts, auditoria.schema.ts, index.ts}
      migrations/                   # saída drizzle-kit generate (commitada)
    common/
      rbac/{permissoes.ts, require-permissoes.decorator.ts}
      guards/{jwt-auth.guard.ts, rbac.guard.ts}
      interceptors/auditoria.interceptor.ts
      pipes/zod-validation.pipe.ts
      filters/all-exceptions.filter.ts
      decorators/{auditar.decorator.ts, current-user.decorator.ts}
    modules/
      auth/{auth.module.ts, auth.controller.ts, auth.service.ts, token.service.ts,
            rbac.service.ts, jwt.strategy.ts, auth.repository.ts, dto/*.ts}
      usuarios/{usuarios.module.ts, usuarios.controller.ts, usuarios.service.ts, dto/*.ts}
    health/health.controller.ts
  test/                             # integração (Postgres real)

app/frontend/
  package.json  tsconfig.json  next.config.ts  Dockerfile  components.json
  middleware.ts                     # gating de presença/validade do token (jose)
  src/app/(auth)/login/page.tsx
  src/app/(admin)/layout.tsx
  src/app/(admin)/page.tsx
  src/lib/{api.ts, auth.ts}         # cliente fetch + refresh; tokens via cookie httpOnly
  src/components/ui/*               # Shadcn
```

---

## Task 1: Scaffold do monorepo (workspaces + tooling base)

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `.nvmrc`, `eslint.config.mjs`, `.env.example`
- Modify: `.gitignore` (garantir `.env*`, `node_modules`, `dist`, `.next`, `coverage`)

- [ ] **Step 1: Criar `package.json` raiz com workspaces**

```json
{
  "name": "alphacarnes",
  "private": true,
  "engines": { "node": ">=22 <23" },
  "workspaces": ["app/backend", "app/frontend"],
  "scripts": {
    "lint": "npm run lint --workspaces --if-present",
    "type-check": "npm run type-check --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "build": "npm run build --workspaces --if-present"
  }
}
```

> `landing/` fica FORA dos workspaces (lockfile e stack próprios). Não tocar em `landing/`.

- [ ] **Step 2: `tsconfig.base.json`** com `"strict": true`, `"noUncheckedIndexedAccess": true`, `"esModuleInterop": true`, `target/module` modernos. Cada workspace estende e ajusta `lib`/`module`/`moduleResolution`.

- [ ] **Step 3: `.nvmrc` = `22`; `eslint.config.mjs`** flat config raiz com overrides por workspace (backend: ambiente Node; frontend: Next plugin). `.env.example` com chaves listadas na Task 12.

- [ ] **Step 4: Commit**

```bash
git checkout -b feature/f1-infra-auth-rbac
git add package.json tsconfig.base.json .nvmrc eslint.config.mjs .env.example .gitignore
git commit -m "chore: scaffold monorepo workspaces (backend, frontend)"
```

---

## Task 2: CI, PR template e CODEOWNERS (1º na ordem — gates verdes desde já)

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/pull_request_template.md`, `.github/CODEOWNERS`, `.github/dependabot.yml`, `scripts/check-coverage.mjs`

- [ ] **Step 1: `ci.yml`** materializando `docs/governance/ci-spec.md` §2 (jobs `lint`, `type-check`, `test-backend` com Postgres 18 service container, `coverage`, `test-frontend`, `build`, `audit`, `secret-scan`). Jobs `lint`/`type-check`/`build`/`test` rodam na raiz (scripts agregadores da Task 1). `test-backend` usa `working-directory: app/backend`, roda `npm run db:migrate` antes de `npm run test:cov`, env `DATABASE_URL` apontando ao service container.

  > **Item 4 (dados de teste no CI):** estratégia adotada = **testes e2e auto-suficientes** — cada spec de integração cria seus próprios fixtures em `beforeAll`/`beforeEach` (usuários, perfis, permissões necessários) e limpa em `afterAll` (`TRUNCATE ... RESTART IDENTITY CASCADE`). O CI **não** depende de `db:seed` implícito. O `seed.ts` (Task 10) é validado por teste próprio, mas os specs de auth/RBAC não pressupõem o seed. Assim o `ci.yml` roda apenas `db:migrate` + `test:cov`, sem `db:seed` entre eles.

- [ ] **Step 2: `pull_request_template.md`** = checklist do `ci-spec.md` §3 / `framework-revisao.md` §7 (gates transversais, RA-01..06, DoD da fase, evidências).

- [ ] **Step 3: `CODEOWNERS`** = `ci-spec.md` §4 (`* @sammuka`, `/app/`, `/docs/`, `/.github/`). `dependabot.yml` para `app/backend`, `app/frontend`, `landing` e `github-actions`.

- [ ] **Step 4: `scripts/check-coverage.mjs`** — lê `coverage/coverage-summary.json` e falha se `lines` ou `branches` < `--min`.

- [ ] **Step 5: Commit**

```bash
git add .github scripts/check-coverage.mjs
git commit -m "ci: add CI workflow, PR template, CODEOWNERS e dependabot"
```

> Após push, ativar branch protection (`ci-spec.md` §5) no GitHub: PR obrigatório, 1 approval CODEOWNERS, status checks obrigatórios.

---

## Task 3: ADR-007 + reconciliação de documentos

**Files:**
- Create: `docs/architecture/adr/ADR-007-rbac-modelo-permissoes.md`
- Modify: `docs/architecture/adr/ADR-005-autenticacao.md` (nota de superseção parcial), `docs/data/modelo-logico-postgres.md` (§1.6: substituir `usuarios.perfil` por N:N), `docs/governance/quality-gates.md` (não alterar DoD; só referenciar ADR-007 se necessário)

- [ ] **Step 1: Escrever ADR-007** (status Aceita, data 2026-06-05). Decide:
  - RBAC N:N (`usuarios`/`perfis`/`usuarios_perfis`), catálogo de **permissões nomeadas** + `perfis_permissoes`, os **11 slugs canônicos** (tabela acima, fonte doc 013), e a regra de segregação SF-01..04 implementada por mecanismo genérico.
  - **§Auditoria (item 2 — fronteira do padrão, RA-02):** documentar explicitamente que (a) na **F1** a auditoria de login e ações admin usa o `AuditoriaInterceptor`, com falha de auditoria **observável e nunca silenciosa** (RA-05/RA-06) e na **mesma unidade lógica** da operação de negócio (a auditoria não fica "verde" se a ação de negócio falhar — ver Task 9); (b) a partir de **F3**, a auditoria de **mutações críticas** (reserva, fechamento de expedição, faturamento) é feita **dentro da transação** do service, não via interceptor. Esta fronteira evita refactor cego em F3.
  - Referencia doc 013, ADR-005, ADR-003, modelo lógico.

- [ ] **Step 2: Atualizar ADR-005** com nota: "Supersedida parcialmente pela ADR-007: o vínculo usuário↔perfil passa a ser N:N e a autorização usa permissões nomeadas resolvidas a partir dos perfis."

- [ ] **Step 3 (item 1 — UUID v7): Reconciliar `docs/data/convencoes-schema.md` e `modelo-logico-postgres.md` para `uuidv7()`.** Hoje as convenções dizem `gen_random_uuid()`; honrando o ADR-003 (UUID v7 ordenável por tempo), atualizar para **`uuidv7()` nativo do PG18** em todas as referências de PK. Registrar a mudança na ADR-007 (ou nota dedicada) — sem contradição silenciosa entre documentos.

- [ ] **Step 4: Atualizar `modelo-logico-postgres.md` §1.6** — substituir a coluna `perfil TEXT CHECK(...)` de `usuarios` pelas tabelas `perfis`, `usuarios_perfis`, `permissoes`, `perfis_permissoes` (DDL coerente com a Task 5, com PK `uuidv7()`). Manter demais convenções.

- [ ] **Step 5: Commit**

```bash
git add docs/architecture/adr/ADR-007-rbac-modelo-permissoes.md docs/architecture/adr/ADR-005-autenticacao.md docs/data/modelo-logico-postgres.md docs/data/convencoes-schema.md
git commit -m "docs: ADR-007 RBAC N:N + permissões nomeadas; uuidv7; reconcilia ADR-005, convenções e modelo lógico"
```

---

## Task 4: Scaffold backend NestJS + config + pino + DatabaseModule

**Files:**
- Create: `app/backend/package.json`, `tsconfig.json`, `nest-cli.json`, `src/main.ts`, `src/app.module.ts`, `src/config/*`, `src/database/database.module.ts`, `src/health/health.controller.ts`, `drizzle.config.ts`

- [ ] **Step 1: `package.json` do backend** com deps fixadas (sem `^` nas de risco): `@nestjs/{common,core,platform-express,jwt,config,throttler}`, `passport`, `passport-jwt`, `drizzle-orm`, `pg`, `zod`, `nestjs-pino`, `pino-http`, **`@node-rs/argon2`** (item 6 — binário prebuilt, sem toolchain nativa no Docker/CI), `cookie-parser`; dev: `drizzle-kit`, `jest`, `ts-jest`, `@types/*`, `typescript`, `supertest`. Scripts: `lint`, `type-check` (`tsc --noEmit`), `test`, `test:cov`, `build` (`nest build`), `start:prod`, `db:generate`, `db:migrate`, `db:seed`.

- [ ] **Step 2: `src/config/env.schema.ts`** — Zod valida `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `CORS_ORIGIN`, `LOG_LEVEL`, `PORT`, **`COOKIE_SECURE`** (boolean — item 3), `THROTTLE_LOGIN_LIMIT`, `THROTTLE_LOGIN_TTL` (item 7). Boot **aborta com erro claro** se inválida (RA-05). Expor via `ConfigModule` tipado. `COOKIE_SECURE` será consumido pelo controller de auth (Task 7) e pelo BFF (Task 12).

- [ ] **Step 3: `DatabaseModule`** `@Global()` — `useFactory` cria `new Pool({ connectionString })` e `drizzle(pool, { schema })`; provê token `DRIZZLE`. `OnModuleDestroy` → `pool.end()`. `main.ts` usa `nestjs-pino` (logger), `app.enableShutdownHooks()`, `cookie-parser`, CORS de `CORS_ORIGIN`, `genReqId` para correlação por request.

- [ ] **Step 4: `drizzle.config.ts`** — `dialect: 'postgresql'`, `schema: './src/database/schema/index.ts'`, `out: './src/database/migrations'`, `dbCredentials.url` de `process.env.DATABASE_URL` (carregar `.env` com dotenv no topo). `GET /health` retorna `{ status: 'ok' }` (usado pelo compose).

- [ ] **Step 5: Verificar e commit**

Run: `cd app/backend && npm run type-check && npm run build`
Expected: sem erros.

```bash
git add app/backend package-lock.json
git commit -m "feat(backend): scaffold NestJS 11 + config Zod + pino + DatabaseModule"
```

---

## Task 5: Schema auth/RBAC + auditoria + migration inicial

**Files:**
- Create: `src/database/schema/auth.schema.ts`, `src/database/schema/auditoria.schema.ts`, `src/database/schema/index.ts`, `src/database/migrate.ts`
- Create (gerado): `src/database/migrations/0000_*.sql` + meta

- [ ] **Step 1: `auth.schema.ts`** — tabelas seguindo `convencoes-schema.md`. **PK (item 1):** `uuid('id').primaryKey().default(sql`uuidv7()`)` — `uuidv7()` nativo do PG18 (não `defaultRandom()`). Demais: `timestamp({ withTimezone: true })`, soft delete onde aplicável:
  - `usuarios` (id, nome, email unique, senha_hash, ativo, ultimo_acesso, created_at, updated_at, deleted_at)
  - `perfis` (id, slug unique CHECK ∈ 11 slugs canônicos, nome, descricao, created_at, updated_at)
  - `usuarios_perfis` (id, usuario_id FK, perfil_id FK, unique(usuario_id, perfil_id), created_at)
  - `permissoes` (id, codigo unique, descricao)
  - `perfis_permissoes` (id, perfil_id FK, permissao_id FK, unique(perfil_id, permissao_id))
  - `refresh_tokens` (id, usuario_id FK, token_hash unique, expires_at, revoked_at nullable, replaced_by_id nullable self-FK, user_agent, ip, created_at) — **guarda hash, nunca o token em claro**.
  - Índices `idx_*` em FKs e colunas filtradas; `relations()` para N:N.

- [ ] **Step 2: `auditoria.schema.ts`** — `auditoria` append-only (sem updated_at/deleted_at): id, tabela, registro_id, operacao CHECK (`INSERT|UPDATE|DELETE|ACAO_MANUAL`), modulo, usuario_id FK, dados_anteriores JSONB, dados_novos JSONB, justificativa, ip, user_agent, created_at. Índices conforme modelo lógico §9.4.

- [ ] **Step 3: `index.ts`** reexporta os schemas (agregador consumido por `drizzle()` e pelo config).

- [ ] **Step 4: `migrate.ts`** — runner: cria pool, `migrate(db, { migrationsFolder })`, fecha pool, `process.exit(0|1)`. `db:migrate` chama-o. **Nunca migrar no boot da app.**

- [ ] **Step 5: Gerar migration e verificar em banco limpo**

Run: `cd app/backend && npm run db:generate`
Expected: cria `migrations/0000_*.sql`.

Run (com Postgres limpo disponível via `DATABASE_URL`): `npm run db:migrate`
Expected: aplica sem erro; tabelas criadas. **Confirmar que `uuidv7()` resolve no PG18 sem extensão** (se a função não existir na imagem usada, registrar e ajustar — fallback documentado, nunca silencioso).

- [ ] **Step 6 (item 5 — reversibilidade): documentar abordagem de rollback.** Para a migration **inicial** da F1, rollback = **recriar a partir do schema limpo** (`drizzle-kit migrate` sobre banco zerado), abordagem aceitável por ser a primeira migration. Registrar isso no plano e no README (Task 13). Migrations subsequentes (F2+) que alterem schema existente incluirão down scripts por migration.

- [ ] **Step 7: Commit**

```bash
git add app/backend/src/database
git commit -m "feat(backend): schema auth/RBAC + auditoria, PK uuidv7 e migration inicial por domínio"
```

---

## Task 6: Transversais — ZodValidationPipe, AllExceptionsFilter, JwtStrategy, Guards

**Files:**
- Create: `src/common/pipes/zod-validation.pipe.ts`, `src/common/filters/all-exceptions.filter.ts`, `src/common/rbac/permissoes.ts`, `src/common/rbac/require-permissoes.decorator.ts`, `src/common/guards/jwt-auth.guard.ts`, `src/common/guards/rbac.guard.ts`, `src/common/decorators/current-user.decorator.ts`, `src/modules/auth/jwt.strategy.ts`
- Test: `test/unit/zod-validation.pipe.spec.ts`, `test/unit/rbac.guard.spec.ts`

- [ ] **Step 1: Escrever testes que falham** — pipe Zod: payload inválido → `BadRequestException` (400) com issues; válido → passa. RbacGuard: usuário sem a permissão exigida → `ForbiddenException` (403); com a permissão → `true`. (Cobre branches negativos para branch coverage.)

```typescript
// rbac.guard.spec.ts (essência)
it('nega 403 quando falta a permissão exigida', () => {
  const ctx = mockExecutionContext({ user: { permissoes: [] } });
  reflector.get.mockReturnValue(['USUARIOS_GERENCIAR']);
  expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
});
it('permite quando o usuário tem a permissão', () => {
  const ctx = mockExecutionContext({ user: { permissoes: ['USUARIOS_GERENCIAR'] } });
  reflector.get.mockReturnValue(['USUARIOS_GERENCIAR']);
  expect(guard.canActivate(ctx)).toBe(true);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd app/backend && npx jest test/unit -v`
Expected: FAIL (símbolos não definidos).

- [ ] **Step 3: Implementar**
  - `permissoes.ts`: catálogo `as const` (`USUARIOS_GERENCIAR`, `USUARIOS_APROVAR`, `PERFIS_GERENCIAR`, `AUDITORIA_VISUALIZAR`) + tipo derivado.
  - `@RequirePermissoes(...codigos)`: `SetMetadata`.
  - `ZodValidationPipe`: recebe schema Zod, `safeParse`, em erro lança `BadRequestException` com `error.issues` (pipe **próprio** — não depender de wrapper incompatível com Zod 4).
  - `JwtAuthGuard` (passport `jwt`) + `JwtStrategy` (valida access, popula `request.user` com `{ sub, perfis, permissoes }`).
  - `RbacGuard`: lê metadata via `Reflector`, compara com `request.user.permissoes`, 403 se faltar.
  - `AllExceptionsFilter`: resposta de erro consistente, loga com contexto/requestId; **sem `success:true` mascarando erro** (RA-05). `@CurrentUser()` extrai `request.user`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest test/unit -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/backend/src/common app/backend/src/modules/auth/jwt.strategy.ts app/backend/test/unit
git commit -m "feat(backend): ZodValidationPipe, exception filter, JWT strategy e RBAC guard"
```

---

## Task 7: AuthService — login/refresh/logout, rotação e revogação

**Files:**
- Create: `src/modules/auth/auth.module.ts`, `auth.controller.ts`, `auth.service.ts`, `token.service.ts`, `auth.repository.ts`, `dto/{login.dto.ts, refresh.dto.ts}`
- Test: `test/unit/token.service.spec.ts`, `test/integration/auth.e2e-spec.ts`

- [ ] **Step 1: Testes que falham** — unit `TokenService`: assina access (TTL 15min) e refresh (TTL 8h); rotação gera novo refresh e marca o anterior `replaced_by`. Integração (**fixtures auto-suficientes, item 4** — `beforeAll` cria usuário/perfis; `afterAll` trunca): `POST /auth/login` (credenciais válidas → 200 + cookies httpOnly; inválidas → 401), `POST /auth/refresh` (token válido → novos tokens + antigo revogado; token revogado → 401), `POST /auth/logout` (revoga refresh; refresh subsequente → 401), **rate limiting (item 7):** N+1 tentativas de login falhas → **429**, com a tentativa registrada/observável (RA-06).

```typescript
// auth.e2e-spec.ts (essência) — Postgres real via DATABASE_URL; fixtures próprios no beforeAll
it('refresh rotaciona e revoga o token anterior', async () => {
  const { refreshCookie } = await login(app, fixtures.admin);
  const r1 = await refresh(app, refreshCookie);          // 200, novo refresh
  const r2 = await refresh(app, refreshCookie);          // 401, token já rotacionado
  expect(r2.status).toBe(401);
});
it('bloqueia brute-force com 429 ao exceder o limite', async () => {
  for (let i = 0; i < THROTTLE_LOGIN_LIMIT; i++) await loginErrado(app);
  const res = await loginErrado(app);
  expect(res.status).toBe(429);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest test/unit/token.service.spec.ts test/integration/auth.e2e-spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**
  - `auth.repository.ts`: porta fina sobre Drizzle (buscar usuário por email + perfis/permissões; CRUD de refresh_tokens). Isola acesso a dados para testabilidade (exceção justificada ao "Drizzle direto", pois mockar query builder é frágil).
  - `TokenService`: `@nestjs/jwt`; assina access/refresh com segredos distintos; persiste **hash** (`@node-rs/argon2`) do refresh em `refresh_tokens`; `rotate()` cria novo e seta `revoked_at`/`replaced_by_id` no antigo; `revoke()` para logout.
  - `AuthService`: valida senha (`argon2.verify`), monta payload (perfis + permissões efetivas via `RbacService`), atualiza `ultimo_acesso`. Falha de credencial → 401 explícito.
  - **Rate limiting (item 7):** `@nestjs/throttler` configurado por env (`THROTTLE_LOGIN_LIMIT`/`THROTTLE_LOGIN_TTL`), aplicado ao `POST /auth/login` (`@Throttle`). Tentativa que excede → 429; a tentativa falha é registrada/observável (RA-06).
  - `auth.controller.ts`: `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me` (retorna usuário + **permissões efetivas** — consumido pelo BFF). **Cookies (item 3):** `httpOnly: true` sempre; `secure: COOKIE_SECURE` (env — true em prod/HTTPS, false em dev/HTTP local); `sameSite` definido. DTOs validados com `ZodValidationPipe`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest test/unit/token.service.spec.ts test/integration/auth.e2e-spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/backend/src/modules/auth app/backend/test
git commit -m "feat(backend): auth login/refresh/logout com rotação e revogação de refresh token"
```

---

## Task 8: RbacService + segregação de funções + gestão mínima de usuários/perfis

**Files:**
- Create: `src/modules/auth/rbac.service.ts`, `src/modules/usuarios/{usuarios.module.ts, usuarios.controller.ts, usuarios.service.ts, dto/*.ts}`
- Test: `test/unit/rbac.service.spec.ts`, `test/integration/rbac.e2e-spec.ts`

- [ ] **Step 1: Testes que falham**
  - `RbacService` unit: resolve permissões efetivas a partir dos perfis (união); `temPermissao()` correto para presença/ausência.
  - Segregação unit: `assertCriadorNaoAprovador(criadorId, aprovadorId)` lança quando iguais.
  - Integração (prova o DoD; **fixtures auto-suficientes, item 4**): perfil incompatível em `POST /usuarios` (ex. `comercial`) → **403**; `administrador` → 201. Aprovar usuário criado por si mesmo → erro de segregação (403/409); aprovado por outro perfil habilitado → ok.

```typescript
// rbac.e2e-spec.ts (essência) — beforeAll cria perfis/permissões/usuários do teste
it('nega 403 para perfil sem permissão administrativa', async () => {
  const token = await loginAs(app, 'comercial');
  const res = await criarUsuario(app, token, novoUsuario);
  expect(res.status).toBe(403);
});
it('bloqueia criador == aprovador (SF-01)', async () => {
  const adminA = await loginAs(app, 'administrador');
  const u = await criarUsuario(app, adminA, novoUsuario); // criado por A
  const res = await aprovarUsuario(app, adminA, u.id);     // A tenta aprovar
  expect([403, 409]).toContain(res.status);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest test/unit/rbac.service.spec.ts test/integration/rbac.e2e-spec.ts` → FAIL.

- [ ] **Step 3: Implementar** `RbacService` (resolução de permissões; mapa carregado de `perfis_permissoes`), mecanismo de segregação genérico (`assertCriadorNaoAprovador`), e `usuarios.controller`/`service` mínimos: `POST /usuarios` (`@RequirePermissoes('USUARIOS_GERENCIAR')`), `POST /usuarios/:id/aprovar` (`USUARIOS_APROVAR` + segregação), `GET /usuarios`. Registrar `JwtAuthGuard`+`RbacGuard`.

- [ ] **Step 4: Rodar e ver passar** — PASS.

- [ ] **Step 5: Commit**

```bash
git add app/backend/src/modules
git commit -m "feat(backend): RbacService, permissões nomeadas e segregação de funções (SF-01)"
```

---

## Task 9: AuditoriaInterceptor (login + ações administrativas)

**Files:**
- Create: `src/common/interceptors/auditoria.interceptor.ts`, `src/common/decorators/auditar.decorator.ts`
- Test: `test/integration/auditoria.e2e-spec.ts`

- [ ] **Step 1: Testes que falham** — após `POST /auth/login` bem-sucedido, existe 1 registro em `auditoria` com `operacao='ACAO_MANUAL'`, `modulo='auth'`, `usuario_id` correto; após `POST /usuarios` existe registro da ação admin com `dados_novos`. **Item 2 (atomicidade):** quando a ação de negócio **falha** (ex. criar usuário com email duplicado → erro), **não** deve restar registro de auditoria de sucesso para essa ação (a auditoria não fica "verde" se a operação falhou). Teste assertando ausência do registro no caminho de erro.

- [ ] **Step 2: Rodar e ver falhar** — FAIL.

- [ ] **Step 3: Implementar** `@Auditar('ACAO', 'modulo')` (SetMetadata) + `AuditoriaInterceptor` que insere em `auditoria` (usuario_id, ip, user_agent, dados) **somente após o sucesso** do handler (a auditoria está na mesma unidade lógica: ação falha ⇒ sem auditoria de sucesso). Aplicar nos endpoints de login e gestão de usuários/perfis (RA-02/RA-06). **Falha da própria auditoria** é observável e nunca silenciosa (logada/propagada — RA-05). Documentar (coerente com ADR-007 §Auditoria, Task 3) que de F3 em diante a auditoria de mutações críticas migra para **dentro da transação** do service.

- [ ] **Step 4: Rodar e ver passar** — PASS.

- [ ] **Step 5: Commit**

```bash
git add app/backend/src/common/interceptors app/backend/src/common/decorators app/backend/test/integration/auditoria.e2e-spec.ts
git commit -m "feat(backend): AuditoriaInterceptor registra login e ações administrativas"
```

---

## Task 10: Seed reproduzível + fechar cobertura ≥80%

**Files:**
- Create: `src/database/seed.ts`
- Modify: `app/backend/jest.config.*` (coverageThreshold), testes adicionais conforme lacunas

- [ ] **Step 1: `seed.ts` idempotente** — insere os **11 perfis** (slugs canônicos), o catálogo de **permissões**, o mapa `perfis_permissoes` da F1, e 1 usuário `administrador` (email/senha de `SEED_ADMIN_*`, senha hasheada). Usar `ON CONFLICT DO NOTHING`/upsert por email/slug; UUIDs fixos para perfis/permissões de sistema (estabilidade entre ambientes). Reexecutável sem duplicar.

- [ ] **Step 2: Teste de seed** — rodar seed 2× e assertar 11 perfis, N permissões e 1 admin (sem duplicatas).

- [ ] **Step 3: Configurar `coverageThreshold`** no Jest (`global: { lines: 80, branches: 80 }`), `coverageReporters: ['json-summary','lcov','text']`. Rodar cobertura e preencher lacunas de branch (casos de erro 400/401/403, token expirado, segregação).

Run: `cd app/backend && npm run test:cov`
Expected: PASS; lines ≥80% e branches ≥80%.

- [ ] **Step 4: Commit**

```bash
git add app/backend/src/database/seed.ts app/backend/jest.config.* app/backend/test
git commit -m "feat(backend): seed reproduzível (11 perfis, permissões, admin) + cobertura ≥80%"
```

---

## Task 11: Scaffold frontend Next.js 16 + Tailwind 4 + Shadcn + login + layout admin

**Files:**
- Create: `app/frontend/package.json`, `tsconfig.json`, `next.config.ts`, `components.json`, `src/app/(auth)/login/page.tsx`, `src/app/(admin)/{layout.tsx, page.tsx}`, `src/components/ui/*`, `src/app/globals.css`
- Test: `app/frontend/__tests__/login.test.tsx`

- [ ] **Step 1: Scaffold** Next 16 (App Router, React 19, TS strict). `next.config.ts` com `outputFileTracingRoot` apontando à raiz do monorepo (evita aviso de múltiplos lockfiles e corrige standalone). Tailwind 4 CSS-first (`@import "tailwindcss"` + `@theme` em `globals.css`). `npx shadcn@latest init` (versão compatível com Tailwind 4).

- [ ] **Step 2: Tela de login** (`(auth)/login/page.tsx`) — formulário Shadcn + React Hook Form + Zod (validação **de formulário apenas**, RA-01); submit chama **route handler/server action** (BFF) que chama `POST /auth/login` no backend **server-to-server** e repassa os cookies httpOnly ao browser. O JS do cliente nunca vê os tokens (item 8).

- [ ] **Step 3: Layout base admin + camada BFF (item 8)** (`(admin)/layout.tsx`) — sidebar/topbar Shadcn, slot de conteúdo; `(admin)/page.tsx` dashboard placeholder (sem telas de domínio). **Padrão BFF explícito:** `client → route handler/server action do Next → backend`. `lib/api.ts` faz fetch **server-side** (lê cookies httpOnly via `cookies()` do Next, encaminha ao backend, trata 401→refresh) — **não** há fetch client-direto ao backend, **sem** CORS com credenciais no browser. `lib/auth.ts` lê `/auth/me` (server-side) e expõe permissões efetivas aos componentes.

- [ ] **Step 4: Smoke test** — render da tela de login (campos presentes); ajustar Jest/RTL ou Vitest. Run: `cd app/frontend && npm run test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add app/frontend package-lock.json
git commit -m "feat(frontend): scaffold Next 16 + Tailwind 4 + Shadcn, login e layout admin"
```

---

## Task 12: Guarda de rota por perfil + cliente API (RA-01 preservado)

**Files:**
- Create: `app/frontend/middleware.ts`
- Modify: `src/lib/api.ts`, `src/lib/auth.ts`, `(admin)/layout.tsx`
- Test: `__tests__/middleware.test.ts`

- [ ] **Step 1: Teste que falha** — middleware: request a rota protegida **sem** cookie → `NextResponse.redirect('/login')`; com cookie de **assinatura inválida** → redirect (item 9); com cookie válido (assinatura + `exp`) → segue. Gating de menu: dado `/auth/me` com permissões sem `AUDITORIA_VISUALIZAR`, o item "Auditoria" não renderiza.

- [ ] **Step 2: Rodar e ver falhar** — FAIL.

- [ ] **Step 3: Implementar** `middleware.ts` (Edge) usando **`jose`** para **verificar a assinatura** do access token com `JWT_ACCESS_SECRET` (disponível no Edge via env) **e** o `exp` (item 9) — não apenas presença. **Sem** decidir regra de negócio: o backend permanece a fonte de verdade de autorização (RA-01). Rotas públicas: `/login`. O gating por perfil/permissão no layout consome **permissões efetivas de `/auth/me`** (resolvidas no backend) — **não** hardcodar matriz perfil→rota no front. `api.ts` (BFF, server-side): em 401, chama `/auth/refresh` e refaz a request.

- [ ] **Step 4: Rodar e ver passar** — PASS.

- [ ] **Step 5: Commit**

```bash
git add app/frontend/middleware.ts app/frontend/src/lib app/frontend/__tests__
git commit -m "feat(frontend): middleware de guarda, gating por permissão e refresh automático"
```

---

## Task 13: docker-compose de um comando (postgres + backend + frontend)

**Files:**
- Create: `docker-compose.yml`, `app/backend/Dockerfile`, `app/backend/docker-entrypoint.sh`, `app/frontend/Dockerfile`, `.env.example` (finalizar)
- Modify: `README.md` (seção "Executar a F1 localmente")

- [ ] **Step 1: Dockerfiles multi-stage com workspaces** — backend: base **`node:22-slim`** (item 6); stage `deps` (`COPY package.json package-lock.json` raiz + `app/backend/package.json` → `npm ci`), `build` (`nest build`), `runtime` (dist + node_modules prod + migrations + entrypoint). Como o hash usa **`@node-rs/argon2` (prebuilt)**, não há toolchain nativa a instalar — `npm ci`/`--build` não quebram no CI nem no compose. frontend: Next `output: 'standalone'`, copiar standalone respeitando `outputFileTracingRoot`.

- [ ] **Step 2: `docker-entrypoint.sh` do backend** — `npm run db:migrate && npm run db:seed && node dist/main.js` (migrate+seed no entrypoint, idempotentes; **não** no boot da app).

- [ ] **Step 3: `docker-compose.yml`** — `postgres:18` com healthcheck `pg_isready`; `backend` com `depends_on: postgres: condition: service_healthy` e `env_file`; `frontend` com `depends_on: backend`, `BACKEND_INTERNAL_URL` (BFF server-to-server) e `JWT_ACCESS_SECRET` (para o middleware `jose` verificar assinatura no Edge — item 9). **Sem Redis** (não necessário na F1). `.env.example` completo: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL=15m`, `JWT_REFRESH_TTL=8h`, **`COOKIE_SECURE=false` (item 3 — true só em prod/HTTPS)**, `THROTTLE_LOGIN_LIMIT`, `THROTTLE_LOGIN_TTL`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `BACKEND_INTERNAL_URL`, `CORS_ORIGIN`, `LOG_LEVEL`, `PORT`.

- [ ] **Step 4: Verificar um comando**

Run: `docker compose up --build -d && docker compose logs -f backend`
Expected: postgres healthy → backend migra+seed (logs) → backend e frontend de pé. **Login via browser em HTTP local funciona** (cookie com `secure=false` por `COOKIE_SECURE`, item 3) com `SEED_ADMIN_*`.

- [ ] **Step 5: Documentar e commit** — README seção de execução: um comando, credenciais de seed, **e abordagem de rollback de migration (item 5):** "a migration inicial da F1 não tem down script; rollback = recriar a partir do banco limpo (`docker compose down -v` + `up`)". Documentar também `COOKIE_SECURE`.

```bash
git add docker-compose.yml app/backend/Dockerfile app/backend/docker-entrypoint.sh app/frontend/Dockerfile .env.example README.md
git commit -m "feat(infra): docker-compose sobe postgres+backend+frontend em um comando (migrate+seed)"
```

---

## Task 14: Abrir PR para `develop`

- [ ] **Step 1: Push e abrir PR** `feature/f1-infra-auth-rbac` → `develop` preenchendo TODO o `pull_request_template.md` (Fase F1; gates transversais; RA-01..06; DoD da F1 com link de cada teste; evidências: saída de `test:cov`, % cobertura, passos do `docker compose up`).

- [ ] **Step 2: Garantir CI verde** — todos os jobs (`lint`, `type-check`, `test-backend`, `coverage`, `test-frontend`, `build`, `audit`, `secret-scan`).

- [ ] **Step 3: NÃO fazer merge** — o revisor roda os gates e integra (`framework-revisao.md`).

---

## Verificação end-to-end (DoD da F1 — `quality-gates.md`)

Cada item provado por teste/execução:

1. **login/refresh/logout; access 15min, refresh 8h revogável** → `test/integration/auth.e2e-spec.ts` (Task 7).
2. **11 perfis aplicados por Guard; 403 para perfil incompatível** → `test/integration/rbac.e2e-spec.ts` (Task 8).
3. **Segregação de funções (criador≠aprovador)** → `rbac.e2e-spec.ts` SF-01 (Task 8).
4. **Seed reproduzível** → teste de seed 2× (Task 10).
5. **docker-compose um comando** → `docker compose up --build` sobe os 3 serviços, migra+seed (Task 13).
6. **Migration base por domínio em banco limpo** → `npm run db:migrate` em CI (Postgres service container) e local.
7. **Auditoria registra login e ações admin** → `auditoria.e2e-spec.ts` (Task 9).
8. **Cobertura backend ≥80% (linha + branch)** → `npm run test:cov` + `check-coverage.mjs` (Task 10).
9. **Rate limiting / anti-brute-force no `/auth/login` (DoD de segurança — item 7)** → teste de 429 ao exceder o limite, tentativa observável (Task 7).
10. **Auditoria atômica e observável (item 2)** → ação de negócio que falha não deixa auditoria de sucesso; falha da auditoria nunca silenciosa (`auditoria.e2e-spec.ts`, Task 9).
11. **Cookie `secure` condicional (item 3)** → login via browser em HTTP local funciona com `COOKIE_SECURE=false`; `httpOnly` sempre (Task 13).
12. **BFF + middleware verifica assinatura (itens 8/9)** → tokens nunca expostos ao JS do cliente (BFF server-to-server); cookie com assinatura inválida é rejeitado pelo middleware (`middleware.test.ts`, Task 12).
13. **UUID v7 (item 1)** → PKs com `uuidv7()` do PG18; migration aplica em banco limpo (Task 5).
14. **Reversibilidade de migration (item 5)** → abordagem de rollback declarada no README (recriar de banco limpo na F1) (Task 13).
15. **RA-01..06** → RA-01 (front sem regra de negócio; permissões vêm de `/auth/me`; BFF); RA-02 (auth/admin auditado na mesma unidade lógica; fronteira para transação em F3 documentada); RA-03 (n/a na F1 — sem hardware); RA-04 (n/a — sem domínio tempo-real na F1); RA-05 (exception filter + config Zod que aborta boot + falha de auditoria/integração nunca silenciosa); RA-06 (auditoria e tentativas de login observáveis).

**Comandos de verificação local:**
```bash
# Backend (com Postgres do compose ou DATABASE_URL apontando a um PG 18 limpo)
# Specs e2e são auto-suficientes (criam fixtures); db:seed não é pré-requisito dos testes.
cd app/backend && npm run db:migrate && npm run test:cov
# Frontend
cd app/frontend && npm run test
# E2E de infra
docker compose up --build
```

---

## Notas de risco (do agente Plan)

- **Versões novas:** usar `jose` no middleware (não `@nestjs/jwt` no Edge); **pipe Zod próprio** (compat Zod 4); ESLint 9 flat; Tailwind 4 CSS-first + Shadcn CLI atual; Express 5 routing (evitar curingas exóticos). **Fixar versões exatas** das deps de risco no 1º PR.
- **UUID v7 (item 1):** PKs usam `sql`uuidv7()`` (função nativa do PG18). Confirmar no `db:migrate` que a função existe na imagem `postgres:18` sem extensão; se ausente, registrar e ajustar explicitamente (sem fallback silencioso). Atualizar `convencoes-schema.md` na Task 3.
- **argon2 (item 6):** `@node-rs/argon2` (prebuilt) + base `node:22-slim` — evita compilar binário nativo no `--build`/CI.
- **Auditoria (item 2):** interceptor só na F1 (login + ações admin), pós-sucesso, mesma unidade lógica; de F3 em diante, auditoria de mutações críticas vai para dentro da transação do service (documentado na ADR-007).
- **Testabilidade vs ADR-001:** `auth.repository.ts` é uma porta fina justificada (mockar query builder do Drizzle é frágil) — não é camada genérica por padrão.
- **`landing/` intocado** (fora dos workspaces, lockfile próprio).
- **Fora de escopo (confirmado):** sem WebSocket/event bus (RA-04 n/a na F1), sem hardware (RA-03 n/a), sem domínios de F2+.
