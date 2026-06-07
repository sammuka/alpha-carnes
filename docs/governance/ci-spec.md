# Especificação de CI/CD — AlphaCarnes

> **Status:** Especificação. **Não implementar agora.** Os arquivos `.github/**` descritos aqui devem ser criados **quando a Fase 1 (scaffolding) iniciar**, junto com o primeiro código de `app/`. Enquanto `app/backend` e `app/frontend` forem placeholders, não há o que o pipeline rodar.
> Esta spec materializa os [`quality-gates.md`](quality-gates.md#gates-transversais) como verificação automática e o fluxo do [`framework-revisao.md`](framework-revisao.md).

## 1. Visão geral

- **Plataforma:** GitHub Actions (repo `sammuka/alpha-carnes`).
- **Gatilhos:** `pull_request` para `develop` e `main`; `push` em `develop` e `main`.
- **Monorepo:** jobs separados por workspace (`app/backend`, `app/frontend`), acionados por mudança de path quando possível.
- **Bloqueio de merge:** os checks abaixo são **status checks obrigatórios** na branch protection (seção 5).

## 2. Pipeline `.github/workflows/ci.yml`

Jobs (cada um é um status check obrigatório):

- **`lint`** — ESLint em backend e frontend. Falha em qualquer erro de lint.
- **`type-check`** — `tsc --noEmit` com TS strict em backend e frontend. Falha com qualquer `any` implícito ou erro de tipo.
- **`test-backend`** — testes unitários + integração do NestJS, com **PostgreSQL 18 como service container**. Sobe banco efêmero, aplica migrations Drizzle, roda testes, coleta cobertura.
- **`coverage`** — valida cobertura backend ≥ 80% (linha + branch). Falha abaixo do limiar.
- **`test-frontend`** — testes de componente/smoke do Next.js.
- **`build`** — build de produção de backend e frontend.
- **`audit`** — `npm audit --audit-level=high` em backend e frontend; falha com vuln high/critical.
- **`secret-scan`** — varredura de segredos com o binário **gitleaks** em modo diretório (`gitleaks dir`), determinístico e sem dependência da API de PR do GitHub.

Esqueleto de referência (a ajustar quando o `app/` existir):

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
          --health-cmd "pg_isready -U alphacarnes"
          --health-interval 10s --health-timeout 5s --health-retries 5
    env:
      DATABASE_URL: postgres://alphacarnes:alphacarnes@localhost:5432/alphacarnes_test
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
      - uses: actions/download-artifact@v4
        with: { name: backend-coverage, path: coverage }
      # Falha se cobertura (linha/branch) < 80%.
      # Implementar com checker do relatório lcov/json-summary.
      - run: node scripts/check-coverage.mjs --min 80

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

  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm audit --audit-level=high

  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: gitleaks
        run: |
          GLV=8.24.3
          curl -sSL https://github.com/gitleaks/gitleaks/releases/download/v${GLV}/gitleaks_${GLV}_linux_x64.tar.gz | tar -xz -C /tmp gitleaks
          /tmp/gitleaks dir . --no-banner --redact -v --exit-code 1 --config .gitleaks.toml
```

Notas:
- O comando exato (`npm run lint`, `test:cov`, `db:migrate`) será fixado no scaffolding da Fase 1; o esqueleto assume scripts npm por workspace.
- `check-coverage.mjs` é um pequeno checker do `coverage-summary.json` (linhas e branches ≥ 80%). Alternativa: limiar no próprio Jest (`coverageThreshold`).
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

> Ajustar o handle do revisor conforme o time. Com branch protection exigindo review de CODEOWNERS, todo PR depende da aprovação do revisor.

## 5. Branch protection (configurar no GitHub)

Para `main` e `develop`:
- Exigir Pull Request antes do merge (sem push direto).
- Exigir **1 approval**; exigir review de **CODEOWNERS**.
- Exigir **status checks obrigatórios**: `lint`, `type-check`, `test-backend`, `coverage`, `test-frontend`, `build`, `audit`, `secret-scan`.
- Exigir branch atualizada com a base antes do merge.
- Descartar approvals obsoletos ao novo push.
- Bloquear force-push e deleção das branches protegidas.

`main` é mais restrita: recebe apenas PR vindo de `develop` (release de fase), com relatório de gate anexado.

## 6. Dependabot (opcional, recomendado)

`.github/dependabot.yml` para atualizações de segurança de `npm` em `app/backend`, `app/frontend` e `landing`, e de `github-actions`. Reduz o risco de vuln high/critical acumulada e mantém o gate `audit` verde.

## 7. Quando implementar

- **Pré-requisito:** início da Fase 1 (scaffolding de `app/backend` e `app/frontend`).
- **Primeiro PR da Fase 1** deve incluir: `ci.yml`, `pull_request_template.md`, `CODEOWNERS` e a ativação da branch protection — para que o restante da Fase 1 já passe pelos gates.
- Até lá, esta spec é a referência; nenhum arquivo `.github/**` é criado.
