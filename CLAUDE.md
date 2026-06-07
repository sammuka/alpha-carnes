# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado atual do projeto (importante)

Este repositório está em **Fase 0 — Fundação (documentação primeiro)**. A especificação
funcional e arquitetural é escrita *antes* do código. Implicações práticas:

- O único projeto com código executável hoje é `landing/` (landing page Vite + Vanilla JS).
- `app/backend/` e `app/frontend/` são placeholders (`.gitkeep`) — **ainda não há código**,
  build, lint ou testes de aplicação. Não procure por eles; eles serão criados na Fase 1.
- O valor central do repositório agora está em `docs/` (18 docs de especificação E2E) e nos
  artefatos de arquitetura sendo produzidos (`docs/architecture/`, `docs/data/`, `docs/integrações/`).

## Comandos

### Landing page (`landing/` — único projeto executável)

```bash
cd landing
npm install
npm run dev       # Vite dev server
npm run build     # build de produção -> landing/dist/
npm run preview   # serve o build
```

- Gerenciador de pacotes: **npm** (`package-lock.json`). Não há lockfile pnpm/yarn.
- Não há scripts de lint nem de teste configurados em `landing/`.

### Aplicação (`app/`)

Ainda não inicializada. Quando a Fase 1 começar, o scaffolding será NestJS 11 (backend) e
Next.js 16 (frontend) — ver "Stack decidida" abaixo e os ADRs em `docs/architecture/adr/`.

## Domínio do negócio

AlphaCarnes é um sistema de gestão operacional para uma **distribuidora de carnes em Osasco/SP**.
O modelo operacional é **cross-docking com compra programada e disponibilidade virtual**:

1. **Compra programada** define o que será comprado no dia (ex.: 100 bois).
2. A compra gera **disponibilidade virtual por parte** (dianteiro, central, traseiro…).
3. **Vendas** ocorrem somente sobre o saldo virtual (sem overbooking); o pedido é por
   **parte/unidade**, não por peso — o peso real só é conhecido na balança.
4. **Recebimento**: peças chegam, são pesadas e **associadas a pedidos** com sugestão do sistema.
5. **Expedição**: peças vão para o caminhão; podem ser transferidas entre pedidos enquanto a
   expedição estiver aberta. O fechamento bloqueia alterações.
6. **Faturamento**: emite **NFS-e via EISS da Prefeitura de Osasco-SP** (SOAP); gera DANFE e seguro.
7. **Liberação**: documentos enviados ao motorista por e-mail.

Princípios: rastreabilidade ponta a ponta de cada peça; operação **on-premises** (sem dependência
de internet no core); estoque é exceção (sobra vai para congelamento); **segregação de funções**
em 11 perfis de acesso.

## Stack decidida (ADRs — implementação na Fase 1)

| Camada | Tecnologia |
|--------|-----------|
| Backend | NestJS 11 + TypeScript 5 strict |
| Frontend | Next.js 16 (App Router) + Tailwind CSS + Shadcn/ui |
| Banco | PostgreSQL 18 + JSONB |
| ORM | Drizzle (migrations via `drizzle-kit`, nunca ALTER TABLE manual) |
| Validação | Zod 4 |
| Tempo real | WebSocket nativo + eventos de domínio (sem polling) |
| Auth | JWT (access 15min / refresh 8h) + RBAC (11 perfis) |
| NFS-e | SOAP via node-soap (EISS Osasco-SP) |
| Filas | BullMQ (Redis) — apenas onde há necessidade real |
| Balança | node-serialport (gateway isolado, RS-232) |

A landing page usa: Vite 6, Cytoscape + cytoscape-dagre, D3, Mermaid (diagramas),
Lenis (scroll suave), Marked (parser Markdown).

## Princípios de arquitetura (vinculantes)

Documentados em `docs/architecture/premissas-e-restricoes.md` e nos ADRs:

- **Projeto E2E, não MVP** — diante de escolha entre solução mínima e completa, escolher a
  completa. Não adiar design para "fase 2".
- **Clean, sem over-engineering** — cada camada/serviço/abstração só existe se resolver um
  problema real. Sem CQRS, sem Event Sourcing, sem microserviços. Se pode ser uma função,
  não vira serviço.
- **Modular monolith** — backend NestJS com um `@Module()` por domínio de negócio
  (`compras`, `pedidos`, `pesagem`, `expedicao`, `faturamento`, `cadastros`, `dashboards`, `auth`),
  mapeando 1:1 com os domínios. Drizzle direto nos services (sem repositórios intermediários).
- **Regras de negócio só no backend** — o frontend não decide nada crítico.
- **Auditoria e rastreabilidade** em todas as operações críticas; tempo real via eventos de domínio.
- **Hardware (balança, impressora, leitor QR)** sempre como gateways/serviços isolados.

## Convenções de schema (PostgreSQL / Drizzle)

Ver `docs/data/convencoes-schema.md`:

- PKs `UUID`; datas `TIMESTAMPTZ`; dinheiro `NUMERIC(15,2)` (nunca FLOAT); pesos `NUMERIC(10,3)`.
- Status/enums como `TEXT` + CHECK (não usar pg ENUM).
- Soft delete com `deleted_at`; nunca DELETE físico em entidades de negócio.
- `created_at` / `updated_at` (trigger) em toda tabela de negócio.
- JSONB para dados semiestruturados (preferências, atributos de peça, payload fiscal),
  com índice GIN quando filtrado.
- Um arquivo de schema Drizzle por domínio.

## Documentação de referência

`docs/` contém 18 documentos numerados (001–018) com a especificação E2E. Os mais
consultados ao implementar:

- `docs/001-visao-geral-operacao-e-fluxo-macro.md` — operação e fluxo macro.
- `docs/010-modelo-de-dados-conceitual-e-entidades-principais-do-sistema.md` e
  `docs/011-modelo-logico-inicial-banco-de-dados-tabelas-e-relacionamentos.md` — modelo de dados.
- `docs/012-arquitetura-aplicacional-modulos-servicos-e-integracoes.md` — arquitetura e regras (RA-01 a RA-06).
- `docs/013-perfis-acesso-papeis-aprovacoes-e-segregacao-de-funcoes.md` — os 11 perfis de RBAC e segregação de funções.
- `docs/008-faturamento-emissao-nf-seguro-bloqueios-fiscais-e-liberacao-do-caminhao.md` — faturamento e NFS-e.
- `docs/architecture/adr/` — decisões de stack (ADR-001 a ADR-006).
- `docs/integrações/nfse-osasco/` — integração EISS Osasco-SP (webservice, XML, homologação, erros).

O plano de execução da Fase 0 está em `docs/superpowers/plans/2026-06-04-documentacao-fase1.md`.
