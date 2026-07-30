# Plano Tático — Onda 5 (Gestão) — Portão 1

> **Status:** Elaborado · **Data:** 2026-07-30 · **Portão 1: Submetido a aprovação**
> **Dependência prévia:** Onda 3 (Cadastros & Admin) — Concluída.
> **Subordinado a:** [`2026-07-22-implementacao-completa-prototipo-v1.1.md`](2026-07-22-implementacao-completa-prototipo-v1.1.md) e [`../../governance/constituicao.md`](../../governance/constituicao.md).

---

## 1. Escopo e Objetivos da Onda 5

A Onda 5 contempla o módulo de **Gestão**, responsável pelo controle operacional, financeiro, regulatório e gerencial do frigorífico. Toda a interface deve ser **idêntica ao protótipo v1.1** (Princípio I da Constituição) e sem soluções parciais ou MVPs (Princípio II).

### Rotas e Módulos Cobrindo 100% da Matriz de Rastreabilidade para Onda 5:
1. **Painel Geral / Executive Dashboard** (`/gestao/dashboard`)
   - KPIs de vendas, volume comercializado, carcaças previstas vs. processadas, pendências operacionais e alertas SIF.
2. **Gestão de Operações UI** (`/gestao/operacoes`)
   - Visualização de operações abertas, em andamento e fechadas. Criação de operações extraordinárias.
3. **Painel de Compras & Impacto** (`/gestao/compras`)
   - Painel de compras programadas, acompanhamento de lotes de carcaça e rendimento financeiro/físico.
4. **Pendências de Overbooking** (`/gestao/overbooking`)
   - Resolução de pedidos com overbooking (`pendencias_overbooking`): compra complementar, redistribuição, novo pedido ou cancelamento.
5. **Aprovações & Ocorrências** (`/gestao/aprovacoes`, `/gestao/ocorrencias`)
   - Central unificada de aprovações gerenciais (ajustes de estoque, cancelamentos de pedidos, liberação de exceções) e registro/tratativa de ocorrências.
6. **Relatórios Regulatórios & SIF** (`/gestao/sif`)
   - Relatórios sanitários oficiais, controle de inspeção federal (SIF) e rastreabilidade de lotes.

---

## 2. Contratos de API & Backend (NestJS)

### 2.1 Módulo `gestao` e `operacoes`
- `GET /api/v1/gestao/dashboard`: Retorna indicadores agregados do dia e da operação ativa.
- `GET /api/v1/gestao/compras`: Métricas e comparativos de compras programadas.
- `GET /api/v1/gestao/overbooking`: Lista pendências de overbooking com filtros por status.
- `POST /api/v1/gestao/overbooking/:id/resolver`: Registra a decisão do gestor na pendência.
- `GET /api/v1/gestao/aprovacoes`: Fila de pendências aguardando alçada gerencial.
- `POST /api/v1/gestao/aprovacoes/:id/decidir`: Aprova ou rejeita solicitação.
- `GET /api/v1/gestao/sif`: Dados consolidados para o relatório de inspeção federal SIF.

---

## 3. Interfaces Frontend (Next.js 16 + React 19 + shadcn/ui)

As telas devem consumir os componentes compartilhados da Onda 2 e componentes Shadcn/ui com paleta Navy (`#265389`), fontes Inter e layout idêntico ao protótipo v1.1:
- `app/frontend/src/app/(dashboard)/gestao/dashboard/page.tsx`
- `app/frontend/src/app/(dashboard)/gestao/operacoes/page.tsx`
- `app/frontend/src/app/(dashboard)/gestao/compras/page.tsx`
- `app/frontend/src/app/(dashboard)/gestao/overbooking/page.tsx`
- `app/frontend/src/app/(dashboard)/gestao/aprovacoes/page.tsx`
- `app/frontend/src/app/(dashboard)/gestao/sif/page.tsx`

---

## 4. Definição de Pronto (DoD) & Critérios de Aceitação

1. **Zero Placeholders**: Nenhuma tela com dados mockados fixos no cliente; todas integradas ao BFF/backend.
2. **Fidelidade ao Protótipo**: Rastreamento 1:1 de componentes, tabelas, modais e ações visuais.
3. **Qualidade Local**:
   - `npm run lint` limpo.
   - `npm run type-check` limpo.
   - Testes unitários de backend (cobertura ≥80%).
   - Testes Playwright E2E validando navegação do gestor.

---

## 5. Plano de Verificação

### Automated Tests
- Backend Unit & Integration Tests: `npm --prefix app/backend test`
- Frontend Tests: `npm --prefix app/frontend test`
- Playwright E2E: `npx playwright test e2e/gestao.spec.ts`

### Manual Verification
- Visualização e navegação completa no browser através de todas as 6 rotas do módulo de Gestão.
