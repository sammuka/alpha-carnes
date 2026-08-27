# AlphaCarnes

Sistema de gestão operacional para a AlphaCarnes — distribuidora de carnes em Osasco/SP.

Monorepo com landing page de proposta, documentação técnica e aplicação principal.

## Estrutura

```
alpha-carnes/
├── docs/         # 18 documentos de especificação funcional e técnica
├── landing/      # Landing page interativa de proposta (Vite + Vanilla JS)
└── app/
    ├── frontend/ # Aplicação web (Next.js 16) — em desenvolvimento
    └── backend/  # API e regras de negócio (NestJS 11) — em desenvolvimento
```

## Documentação

Os 18 documentos em `docs/` cobrem a especificação completa do sistema:

| Arquivo | Conteúdo |
|---------|---------|
| 001 | Visão geral da operação e fluxo macro |
| 002 | Compra programada, disponibilidade virtual e vendas |
| 003 | Regras funcionais por tela/bloco estrutural |
| 004 | Campos e ações — Compra Programada e Pedido de Venda |
| 005 | Campos e ações — Disponibilidade Virtual e Recebimento |
| 006 | Campos e ações — Pesagem, Associação Sugestiva e Expedição |
| 007 | Corte, transformação, reetiquetagem e rastreabilidade |
| 008 | Faturamento, emissão de NF, seguro e liberação do caminhão |
| 009 | Dashboards, KPIs, alertas e monitoramento em tempo real |
| 010 | Modelo de dados conceitual e entidades principais |
| 011 | Modelo lógico inicial — tabelas e relacionamentos |
| 012 | Arquitetura aplicacional — módulos, serviços e integrações |
| 013 | Perfis de acesso, papéis, aprovações e segregação de funções |
| 014 | Eventos de domínio, workflows assíncronos e tempo real |
| 015 | Roadmap de implantação — fases, riscos e dependências |
| 016 | Wireframes e fluxos por tela |
| 017 | Infraestrutura e equipamentos recomendados |
| 018 | Arquitetura on-premises e topologia de equipamentos |

## Executar localmente

### Pré-requisitos
- Node.js 22 (`engines` do monorepo)
- Docker e Docker Compose v2 (Postgres e/ou stack completa)
- Copiar e ajustar o env da raiz: `cp .env.example .env`
- Dependências npm: **sempre na raiz** (`npm ci` ou `npm install`) — o repo é workspace
  (`app/backend` + `app/frontend`); o `node_modules` fica na raiz (hoist). Não espere
  `node_modules` completo dentro de cada pacote.

### Opção A — Um comando (Docker, aceite canônico)

```bash
docker compose up --build
```

Isso irá:
1. Subir o PostgreSQL 18 (aguarda healthcheck)
2. Buildar e subir o backend (aplica migrations + seed automaticamente)
3. Buildar e subir o frontend

Acesse o frontend em [http://localhost:4000](http://localhost:4000).

Portas publicadas no host:

| Serviço | Host | Container |
|---------|-----:|----------:|
| Frontend | `4000` | `3000` |
| Backend | `4001` | `3001` |
| PostgreSQL | `15433` | `5432` |

O `.env` da **raiz** alimenta o Compose (`BACKEND_INTERNAL_URL=http://backend:3001`,
`NEXT_PUBLIC_API_URL=http://localhost:4001`, `PORT=3001` dentro do container).

### Opção B — Front e back com `npm run` (Postgres no Docker)

Útil para hot-reload. Pare os containers `frontend`/`backend` se estiverem no ar
(`docker compose stop frontend backend`) para não conflitar com as portas do host.

```bash
# 1) Postgres
docker compose up -d postgres

# 2) Env do backend (Nest no host)
cp .env.example app/backend/.env   # se ainda não existir
# Ajuste em app/backend/.env:
#   PORT=4001
#   DATABASE_URL=...@localhost:15433/...
#   CORS_ORIGIN=http://localhost:4000
#   (não precisa de NEXT_PUBLIC_* / BACKEND_INTERNAL_URL no backend)

# 3) Env do frontend (Next no host) — arquivo app/frontend/.env.local
#   NEXT_PUBLIC_API_URL=http://localhost:4001
#   BACKEND_INTERNAL_URL=http://localhost:4001
#   JWT_ACCESS_SECRET=<mesmo valor do backend>   # obrigatório
#   NEXT_PUBLIC_AMBIENTE=Desenvolvimento

# 4) Migrate + seed (do host, apontando ao Postgres publicado)
cd app/backend
npm run db:migrate
npm run db:seed
npm run dev          # Nest em http://localhost:4001

# 5) Outro terminal
cd app/frontend
npm run dev          # Next em http://localhost:4000
```

**Atenção — sessão / login:** o middleware do Next valida o JWT com `JWT_ACCESS_SECRET`.
Se essa variável faltar no `.env.local` (ou divergir do backend), o access token é tratado
como inválido, disparam refreshes concorrentes e a proteção de reuse encerra a sessão
(volta para `/login` logo após um login “bem-sucedido”).

### Credenciais do seed (desenvolvimento)

- **Email:** `admin@alphacarnes.local` (ou `SEED_ADMIN_EMAIL` do `.env`)
- **Senha:** a de `SEED_ADMIN_PASSWORD` no `.env` usado no seed
  (ex. `.env.example` / Compose: `change-me-admin-password`;
  fallback no código se a var estiver ausente: `Admin@AlphaCarnes2026!`)

O `docker compose up --build` já aplica o seed automaticamente. Para executá-lo manualmente
(ex.: repopular após um reset, ou rodando o backend fora do Docker):

```bash
cd app/backend
npm run db:seed
```

### Carga inicial (opcional)

Popula Clientes, Fornecedores, Frota (veículos e motoristas) e um catálogo/tabela de
preços curados a partir de dados reais extraídos do ERP legado, em
`docs/alphacarnes_json_extracoes/`. É uma carga única — não roda automaticamente no
`docker compose up` nem no `npm run db:seed` (que só cuida de RBAC/parâmetros/catálogo
provisório). Rode depois do seed padrão:

```bash
cd app/backend
npm run db:migrate   # garante as colunas novas de frota (onda_frota_dados_legado)
npm run db:seed      # garante o catálogo canônico (TZ/DT/PA/CB/CBA/JAC/FC/BPORCO)
cd ../..
DATABASE_URL=postgres://alphacarnes:alphacarnes@localhost:15433/alphacarnes \
  npx tsx scripts/carga-inicial/carga-inicial.ts
```

Registros com CNPJ/CPF inválido (dígito verificador) ou duplicado são pulados —
não inventamos documento fiscal. A lista completa de excluídos fica em
`docs/alphacarnes_json_extracoes/relatorio-carga-inicial.md` após a execução.

### Rollback de migration (F1)

A migration inicial da F1 não tem down script. Para resetar o banco:

```bash
docker compose down -v   # Remove o volume do PostgreSQL
docker compose up --build  # Recria tudo do zero
```

Migrations de F2+ incluirão down scripts explícitos por arquivo.

### Variáveis de ambiente

Veja `.env.example` para todas as variáveis disponíveis. As principais:

| Variável | Descrição | Padrão / nota |
|----------|-----------|---------------|
| `COOKIE_SECURE` | `true` em HTTPS (produção), `false` em HTTP local | `false` |
| `DATABASE_URL` | URL do PostgreSQL | host `:15433`; no Compose o backend usa `@postgres:5432` |
| `JWT_ACCESS_SECRET` | Segredo do access token (min 32 chars) — **também no frontend** (middleware) | ⚠️ Alterar em produção |
| `JWT_REFRESH_SECRET` | Segredo do refresh token (min 32 chars) | ⚠️ Alterar em produção |
| `PORT` | Porta do Nest | Compose: `3001` (container); npm local: `4001` no host |
| `CORS_ORIGIN` | Origem permitida (não use `*` com cookies) | `http://localhost:4000` |
| `THROTTLE_LOGIN_LIMIT` | Máx. tentativas de login por TTL | `5` |
| `NEXT_PUBLIC_API_URL` | URL da API vista pelo browser / fallback BFF | Compose: `:4001`; npm local: `:4001` |
| `BACKEND_INTERNAL_URL` | BFF server→backend | Compose: `http://backend:3001`; npm local: `http://localhost:4001` |
| `HARDWARE_FAKE` / `NFSE_FAKE` | Gateways fake (dev/CI) | `1` em desenvolvimento |

Arquivos típicos:

- **Raiz `.env`** — Docker Compose
- **`app/backend/.env`** — `npm run dev` do Nest
- **`app/frontend/.env.local`** — `npm run dev` do Next (inclui `JWT_ACCESS_SECRET`)

## Landing Page

Proposta técnica e comercial interativa. Ver `landing/README.md` para instruções de execução.

```bash
cd landing
npm install
npm run dev
```

## Licença

Projeto privado — uso exclusivo AlphaCarnes.
