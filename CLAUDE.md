# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado atual do projeto (importante)

O projeto está em **implementação ativa** (fases F1–F6a concluídas; Ciclo v1.1 em execução):

- `app/backend/` — NestJS 11 real e testado: auth/RBAC (11 perfis), cadastros, planejamento
  comercial (reserva atômica), recebimento, pesagem/etiquetas, corte/transformação, expedição,
  faturamento NFS-e (gateway EISS isolado + fake). Migrations 0000+, CI com cobertura ≥80%.
- `app/frontend/` — Next.js 16 App Router (BFF), telas no DS v2 absorvido do protótipo;
  parte das rotas ainda é placeholder (sendo substituídas pelo Ciclo v1.1).
- `landing/` — landing page Vite + Vanilla JS (projeto independente, lockfile próprio).
- **Governança vigente:** [`docs/governance/constituicao.md`](docs/governance/constituicao.md)
  (princípios inegociáveis — fidelidade ao protótipo e completude E2E),
  [`docs/governance/roadmap-canonico.md`](docs/governance/roadmap-canonico.md) §8 (Ciclo v1.1, ondas 0–10),
  [`docs/governance/pipeline-execucao.md`](docs/governance/pipeline-execucao.md) (rito Portão 1/Portão 2),
  estado corrente em [`docs/execucao/EXECUCAO-STATUS.md`](docs/execucao/EXECUCAO-STATUS.md).

## Fontes de verdade (ordem de precedência)

1. Decisões registradas — `docs/execucao/DECISOES.md` (AD-01..AD-06: composição do boi,
   EISS Osasco, unicidade por operação, 11 perfis, overbooking e reserva sem expiração).
2. **Spec funcional v1.1** — `docs_v2/alphacarnes_contexto_funcional_e_recomendacoes_prototipo_v1.1.md`.
3. **Protótipo validado** — `F:\Projetos\alpha-carnes-prototipo`, branch `feature/completude-v1.1`
   (fonte de verdade de UI/UX: telas devem ser idênticas — Princípio I da constituição).
4. `docs_v2/` 00–05 (spec v0.1, onde não contradita pela v1.1).
5. `docs/` 001–018 + `docs/architecture/adr/` (ADR-001..011).

## Comandos

### Aplicação (`app/` — monorepo npm workspaces)

```bash
npm ci                                  # na raiz (workspaces: app/backend, app/frontend)
npm run build                           # build de tudo
cd app/backend && npm run db:migrate    # migrations (drizzle-kit; exige Postgres 18)
cd app/backend && npm run db:seed       # seed RBAC (11 perfis + permissões)
cd app/backend && npm run test:cov      # testes + cobertura (gate ≥80% linha e branch)
cd app/frontend && npm run test         # Jest; e2e Playwright em app/frontend/e2e/
```

CI (`.github/workflows/ci.yml`): lint, type-check, test-backend (Postgres 18 service),
coverage ≥80%, test-frontend, build, audit, secret-scan. Testes usam fakes:
`HARDWARE_FAKE=1`, `NFSE_FAKE=1` (nunca tocam dispositivo/EISS reais).

### Execução local (Docker Desktop)

Toda a aplicação operacional sobe localmente via Docker Desktop. Para não conflitar com
outros projetos, as portas publicadas no host são fixas:

| Serviço | Host | Container |
|---|---:|---:|
| Frontend | `4000` | `3000` |
| Backend | `4001` | `3001` |
| PostgreSQL | `15433` | `5432` |

Containers se comunicam pelas portas internas (`backend:3001`, `postgres:5432`); processos
executados no host usam `http://localhost:4001` e `localhost:15433`. O aceite local exige
`docker compose up --build -d` com `postgres + backend + frontend` saudáveis.

### Landing page (`landing/`)

```bash
cd landing && npm install && npm run dev   # build: npm run build -> landing/dist/
```

A Vercel publica **somente** `landing/` para apresentação ao cliente. O status Vercel é gate
apenas quando o diff do PR toca `landing/**`; PRs da aplicação são avaliados pelos oito jobs
canônicos do CI e pela execução local no Docker Desktop.

## Domínio do negócio

AlphaCarnes é um sistema de gestão operacional para uma **distribuidora de carnes em Osasco/SP**.
Modelo **cross-docking com compra programada e disponibilidade virtual**:

1. **Operação** (entidade pivô, cadência configurável) organiza o dia; **compra programada**
   define o que será comprado (ex.: 100 bois; boi casado = 2 TZ + 2 DT + 2 PA — AD-01).
2. A compra gera **disponibilidade virtual por produto**; pedidos em elaboração **reservam
   imediatamente** (carrinho); prioridade de consumo: físico → virtual → overbooking.
3. **Overbooking é permitido, sem limite, com confirmação explícita** (v1.1 §6.4 — revogou o
   bloqueio antigo); confirmação gera pendência para o gestor resolver.
4. **Recebimento** nasce do **Pedido ao Fornecedor**; NF do fornecedor é referência complementar;
   conclusão exige revisão obrigatória **Pedido × NF × Pesagem** com acumuladores por produto;
   divergência gera ocorrência administrativa auditável.
5. **Pesagem/destinação**: peça → pedido, estoque ou desossa; **Troca de Peça** é atômica e
   preserva pesos. **Desossa** transforma só TZ (2 regras provisórias, exclusivas por unidade).
6. **Expedição**: carga por caminhão; fechamento bloqueia alterações.
7. **Faturamento**: NFS-e via **EISS Osasco** (SOAP, `docs/integrações/nfse-osasco/`); seguro
   manual; liberação do caminhão por checklist calculado.

Terminologia: **"Nome Fantasia"** e **"Buscar cliente"** — a palavra **"Marca" é banida** de
telas, entidades e código (v1.1 §6.8). Rastreabilidade ponta a ponta; operação on-premises;
**11 perfis** de RBAC com segregação de funções (doc 013).

## Stack (ADRs)

| Camada | Tecnologia |
|--------|-----------|
| Backend | NestJS 11 + TypeScript 5 strict |
| Frontend | Next.js 16 (App Router, BFF) + React 19 + Tailwind 4 + Shadcn/ui |
| Banco | PostgreSQL 18 + JSONB |
| ORM | Drizzle (migrations via `drizzle-kit`, nunca ALTER TABLE manual) |
| Validação | Zod 4 |
| Tempo real | WebSocket nativo + eventos de domínio pós-commit (sem polling) |
| Auth | JWT (access 15min / refresh 8h) + RBAC (11 perfis, permissões nomeadas) |
| NFS-e | SOAP via node-soap (EISS Osasco-SP), porta + fake determinístico (ADR-011) |
| Balança/impressora/leitor | gateways isolados + fakes (ADR-009/010) |

## Princípios de arquitetura (vinculantes — ver constituição)

- **Fidelidade absoluta ao protótipo** (Princípio I, NÃO-NEGOCIÁVEL): telas idênticas ao
  protótipo validado — componentes, layout, fontes, cores, menu, fluxo. Ler o `.tsx` do
  protótipo antes de escrever qualquer tela.
- **Completude E2E, não MVP** (Princípio II): feature entra completa ou não entra na onda.
- **Regras de negócio só no backend** (RA-01); **transação + auditoria** em etapa crítica (RA-02);
  **hardware/integrações como gateways isolados** (RA-03/V); **tempo real por eventos** (RA-04);
  **nenhuma falha silenciosa nem dado inventado** (RA-05/06).
- **Não inventar o que está pendente** (Princípio VIII): pendências v1.1 §16 viram parâmetro +
  badge "Provisório"; remoção do badge exige AD-xx em `docs/execucao/DECISOES.md`.
- **Modular monolith** — um `@Module()` por domínio; Drizzle direto nos services; sem CQRS,
  Event Sourcing ou microserviços.

## Convenções de schema (PostgreSQL / Drizzle)

Ver `docs/data/convencoes-schema.md`:

- PKs `UUID` (uuidv7); datas `TIMESTAMPTZ`; dinheiro `NUMERIC(15,2)`; pesos `NUMERIC(10,3)`.
- Status/enums como `TEXT` + CHECK (não usar pg ENUM).
- Soft delete com `deleted_at`; nunca DELETE físico em entidades de negócio.
- `created_at` / `updated_at` (trigger) em toda tabela de negócio.
- JSONB para dados semiestruturados, com índice GIN quando filtrado.
- Um arquivo de schema Drizzle por domínio; migrações estruturais em expand → backfill → contract.

## Documentação de referência

- **Plano mestre do Ciclo v1.1** — `docs/superpowers/plans/2026-07-22-implementacao-completa-prototipo-v1.1.md`
  (modelo de dados, contratos, RBAC, ondas) + matriz de rastreabilidade (39/39 rotas) —
  `docs/superpowers/plans/2026-07-22-matriz-rastreabilidade-v1.1.md`.
- `docs/013-...md` — os 11 perfis de RBAC e segregação de funções.
- `docs/integrações/nfse-osasco/` — integração EISS Osasco-SP (webservice, XML, homologação, erros).
- `docs/governance/quality-gates.md` — gates transversais + DoD por fase/onda.
- `docs/governance/pipeline-reproduzivel.md` — como replicar a pipeline em outros projetos.
