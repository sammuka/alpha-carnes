# Plano Tático — Onda 8 (Estoque) — Portão 1

> **Status:** Aprovado · **Data:** 2026-07-30 · **Portão 1: Aprovado**
> **Dependência prévia:** Onda 7 (Desossa) — Concluída (Portão 2 Aprovado).
> **Subordinado a:** [`2026-07-22-implementacao-completa-prototipo-v1.1.md`](2026-07-22-implementacao-completa-prototipo-v1.1.md) e [`../../governance/constituicao.md`](../../governance/constituicao.md).

---

## 1. Escopo e Objetivos da Onda 8

A Onda 8 contempla o módulo de **Estoque**, responsável pelo controle FIFO de peças/lotes, destinação de caixarias, entrada de itens avulsos e solicitação/aprovação de ajustes de estoque com segregação de alçada.

### Rotas e Módulos Cobrindo 100% da Matriz de Rastreabilidade para Onda 8:
1. **Consulta FIFO & Destinação de Estoque** (`/estoque/consulta`)
   - Visualização de peças e lotes ordenados por data de entrada (FIFO).
   - Ação de destinar peça/lote para desossa ou pedido de venda.
2. **Entrada de Caixarias e Itens Avulsos** (`/estoque/entrada-itens`)
   - Registro de entrada de caixarias com fornecedor, lote da NF e destinação direta para estoque ou pedido.
3. **Ajustes de Estoque com Aprovação** (`/estoque/ajustes`)
   - Solicitação de ajuste (quebra, perda, erro de contagem, vencimento).
   - Segregação de função: criador do ajuste ≠ aprovador (aprovado na fila gerencial de aprovações).

---

## 2. Contratos de API & Backend (NestJS)

- `GET /api/v1/operacao/estoque/consulta`: Listagem paginada FIFO.
- `POST /api/v1/operacao/estoque/destinar`: Destinar item para desossa ou pedido.
- `POST /api/v1/operacao/estoque/entradas`: Registrar entrada de caixarias/itens.
- `POST /api/v1/operacao/estoque/ajustes`: Solicitar ajuste de quantidade/peso.

---

## 3. Interfaces Frontend (Next.js 16 + React 19 + shadcn/ui)

- `app/frontend/src/app/(admin)/estoque/consulta/page.tsx` & `estoque-consulta-client.tsx`
- `app/frontend/src/app/(admin)/estoque/entrada-itens/page.tsx` & `entrada-itens-client.tsx`
- `app/frontend/src/app/(admin)/estoque/ajustes/page.tsx` & `ajustes-client.tsx`

---

## 4. Definição de Pronto (DoD) & Critérios de Aceitação

1. **Zero Placeholders**: Nenhuma tela com dados mockados no cliente.
2. **Fidelidade ao Protótipo**: Visualização idêntica ao protótipo v1.1.
3. **Qualidade Local**:
   - `npm run lint` limpo.
   - `npm run type-check` limpo.
   - Suíte de backend e frontend passadas 100%.
