# Especificação de CI/CD — AlphaCarnes

> **Status:** Implementado e ativo em `.github/workflows/ci.yml`; reconciliado com `develop` em 2026-07-23.
> Esta spec materializa os [`quality-gates.md`](quality-gates.md#gates-transversais) como verificação automática e o fluxo do [`framework-revisao.md`](framework-revisao.md).

## 1. Visão geral

- **Plataforma:** GitHub Actions (repo `sammuka/alpha-carnes`).
- **Gatilhos:** `pull_request` para `develop` e `main`; `push` em `develop` e `main`.
- **Monorepo:** comandos raiz orquestram os workspaces (`app/backend`, `app/frontend`); todos os oito jobs rodam em cada evento, sem filtro de path.
- **Bloqueio de merge:** os checks abaixo são **status checks obrigatórios** na branch protection (seção 5).

## 2. Pipeline `.github/workflows/ci.yml`

Jobs (cada um é um status check obrigatório):

- **`lint`** — ESLint em backend e frontend. Falha em qualquer erro de lint.
- **`type-check`** — `tsc --noEmit` com TS strict em backend e frontend. Falha com qualquer `any` implícito ou erro de tipo.
- **`test-backend`** — testes unitários + integração do NestJS, com **PostgreSQL 18 como service container**. Sobe banco efêmero, aplica migrations Drizzle, roda testes, coleta cobertura.
- **`coverage`** — valida cobertura backend global e de cada `*.service.ts` tocado pelo PR ≥ 80% (linha + branch). Service tocado ausente do relatório também falha.
- **`test-frontend`** — testes de componente/smoke do Next.js.
- **`build`** — build de produção de backend, frontend e landing; isso não muda o limite de deploy: Vercel continua exclusivo da landing.
- **`audit`** — `npm audit --audit-level=high` no monorepo da aplicação e separadamente em `landing`; falha com vuln high/critical.
- **`secret-scan`** — histórico Git completo com `gitleaks git . --log-opts=--all`; o binário v8.24.3 só é executado após validação fail-closed do SHA-256 oficial. Nenhum caminho versionado é excluído: falsos positivos revisados entram por fingerprint exato em `.gitleaksignore`.

Referência do pipeline vigente:

```yaml
name: CI
on:
  pull_request:
    branches: [develop, main]
  push:
    branches: [develop, main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run test:ci-scripts
      - run: npm install --global @openai/codex@0.145.0
      - name: governance PowerShell harness
        shell: pwsh
        run: ./.codex/scripts/test-governance-port.ps1

  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run type-check

  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:18
        env:
          POSTGRES_USER: alphacarnes
          POSTGRES_PASSWORD: alphacarnes
          POSTGRES_DB: alphacarnes_test
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U alphacarnes -d alphacarnes_test"
          --health-interval 10s --health-timeout 5s --health-retries 5
    env:
      DATABASE_URL: postgres://alphacarnes:alphacarnes@localhost:5432/alphacarnes_test
      JWT_ACCESS_SECRET: ci-access-secret-min-32-chars-for-tests
      JWT_REFRESH_SECRET: ci-refresh-secret-min-32-chars-for-tests
      JWT_ACCESS_TTL: 8h
      JWT_REFRESH_TTL: 8h
      COOKIE_SECURE: 'false'
      THROTTLE_LOGIN_LIMIT: '5'
      THROTTLE_LOGIN_TTL: '60000'
      SEED_ADMIN_EMAIL: admin@alphacarnes.local
      SEED_ADMIN_PASSWORD: Admin@CiTest123456
      CORS_ORIGIN: http://localhost:3000
      LOG_LEVEL: error
      PORT: '3001'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run db:migrate
        working-directory: app/backend
      - run: npm run test:cov
        working-directory: app/backend
      - uses: actions/upload-artifact@v4
        with:
          name: backend-coverage
          path: app/backend/coverage

  coverage:
    needs: test-backend
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - uses: actions/download-artifact@v4
        with: { name: backend-coverage, path: coverage }
      - run: node scripts/check-coverage.mjs --min 80
        env:
          COVERAGE_BASE_SHA: ${{ github.event.pull_request.base.sha || github.event.before }}

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run test
        working-directory: app/frontend

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run build
      - run: npm ci
        working-directory: landing
      - run: npm run build
        working-directory: landing

  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm audit --audit-level=high
      - run: npm ci
        working-directory: landing
      - run: npm audit --audit-level=high
        working-directory: landing

  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: gitleaks
        run: |
          GLV=8.24.3
          GL_SHA256=9991e0b2903da4c8f6122b5c3186448b927a5da4deef1fe45271c3793f4ee29c
          curl --fail --silent --show-error --location \
            --output /tmp/gitleaks.tar.gz \
            "https://github.com/gitleaks/gitleaks/releases/download/v${GLV}/gitleaks_${GLV}_linux_x64.tar.gz"
          echo "${GL_SHA256}  /tmp/gitleaks.tar.gz" | sha256sum --check --strict
          tar -xzf /tmp/gitleaks.tar.gz -C /tmp gitleaks
          /tmp/gitleaks git . --log-opts=--all --no-banner --redact --verbose --exit-code 1 --config .gitleaks.toml
```

Notas:
- Os comandos da aplicação são os scripts versionados no `package.json` raiz e nos workspaces; `db:migrate` e `test:cov` rodam em `app/backend`. A landing tem lockfile independente, portanto `npm ci`, build e audit rodam com `working-directory: landing`.
- `scripts/check-coverage.mjs` valida o total do `coverage-summary.json` e cada service adicionado, copiado, modificado ou renomeado no diff contra o SHA exato da base (linhas e branches ≥ 80%); services removidos não exigem entrada de cobertura. O workflow injeta `COVERAGE_BASE_SHA` e o histórico completo no checkout é obrigatório para o cálculo fail-closed.
- Node 22 LTS conforme ADR-001.

## 3. `.github/pull_request_template.md`

Reproduz o checklist da seção 7 de [`framework-revisao.md`](framework-revisao.md):

```markdown
## Fase / Sub-gate
- Fase: <F1..F9 / F4a..F4c>
- Dependências (DP) satisfeitas:

## O que entrega

## Gates transversais
- [ ] lint
- [ ] type-check (TS strict)
- [ ] testes unit + integração
- [ ] cobertura backend >= 80%
- [ ] build (backend e frontend)
- [ ] npm audit sem high/critical
- [ ] sem segredos commitados
- [ ] migrations via drizzle-kit, reversíveis

## Regras arquiteturais
- [ ] RA-01 sem regra de negócio no frontend
- [ ] RA-02 etapas críticas transacionais + auditadas
- [ ] RA-03 hardware como gateway isolado
- [ ] RA-04 tempo real por eventos
- [ ] RA-05 nenhuma falha de integração silenciosa
- [ ] RA-06 exceções observáveis

## DoD da fase
- [ ] <invariante + link do teste>

## Evidências
```

## 4. `.github/CODEOWNERS`

O revisor é owner do código, da documentação e dos workflows, garantindo revisão obrigatória:

```text
# Revisor / Quality Owner do AlphaCarnes
*                 @sammuka
/app/             @sammuka
/docs/            @sammuka
/.github/         @sammuka
```

> `CODEOWNERS` mantém a responsabilidade explícita. Enquanto o repositório tiver um único colaborador elegível, a independência é comprovada pelos papéis Codex Monitor/Executor/Worker e pelos dois pareceres de Portão 2, sem fingir uma aprovação humana impossível do próprio autor.

## 5. Branch protection (configurar no GitHub)

Para `main` e `develop`:
- Exigir Pull Request antes do merge (sem push direto).
- Proteger também administradores; exigir resolução de conversas e histórico linear.
- Exigir **status checks obrigatórios**: `lint`, `type-check`, `test-backend`, `coverage`, `test-frontend`, `build`, `audit`, `secret-scan`.
- Exigir branch atualizada com a base antes do merge.
- Bloquear force-push e deleção das branches protegidas.

`develop` já tem essas regras ativas. `main` recebe apenas release proveniente de `develop`; a proteção equivalente deve ser verificada/reconciliada antes do primeiro release.

## 6. Dependabot (opcional, recomendado)

`.github/dependabot.yml` para atualizações de segurança de `npm` em `app/backend`, `app/frontend` e `landing`, e de `github-actions`. Reduz o risco de vuln high/critical acumulada e mantém o gate `audit` verde.

## 7. Estado da implementação

- `.github/workflows/ci.yml`, `.github/pull_request_template.md`, `.github/CODEOWNERS` e Dependabot estão versionados.
- Os oito checks são obrigatórios em `develop` e foram provados verdes no PR-base.
- Antes do release em `main`, o Executor deve consultar a configuração remota e aplicar a mesma política fail-closed; divergência de proteção bloqueia o gate.
