# Plano Tático — Onda 6 (Recebimento & Balança) — Portão 1

> **Status:** Aprovado · **Data:** 2026-07-30 · **Portão 1: Aprovado**
> **Dependência prévia:** Onda 4 (Comercial) e Onda 5 (Gestão) — Concluídas (Portão 2 Aprovados).
> **Subordinado a:** [`2026-07-22-implementacao-completa-prototipo-v1.1.md`](2026-07-22-implementacao-completa-prototipo-v1.1.md) e [`../../governance/constituicao.md`](../../governance/constituicao.md).

---

## 1. Escopo e Objetivos da Onda 6

 A Onda 6 contempla os módulos de **Recebimento Físico**, **Terminal de Pesagem & Destinação**, **Troca de Peça** e **Etiquetas (5 Estados)**. Toda a interface segue o protótipo v1.1 sem dados mockados no cliente e com suíte automatizada completa.

### Rotas e Módulos Cobrindo 100% da Matriz de Rastreabilidade para Onda 6:
1. **Recebimento de Carga & Conferência Tripla** (`/recebimento/recebimento-carga`)
   - Recebimentos vinculados aos Pedidos ao Fornecedor.
   - Registro de NF do fornecedor (chave, série, emissão, peso e valor declarado).
   - Acumuladores de pesagem de peças em tempo real.
   - Quadro de conferência tripla (Pedido × NF × Pesagem Real) com encerramento `conferido_sem_divergencia` ou `conferido_com_divergencia` (com abertura de ocorrência).
2. **Terminal de Pesagem & Destinação** (`/recebimento/pesagem-destinacao`)
   - Interface touch para pesagem na recepção.
   - Sugestão de associação e captura de peso via gateway de balança com fallback de captura manual assistida com motivo auditado (`MOTIVOS_CAPTURA_MANUAL`).
   - Operação atômica de **Troca de Peça** (`trocas_peca`): substituição de peça em pedido com destinação da peça retirada para estoque ou desossa, sem perda de histórico de peso.
   - Estorno de pesagem e invalidação de etiqueta.
3. **Gestão e Impressão de Etiquetas em 5 Estados** (`/recebimento/etiquetas`)
   - Controle do ciclo de vida da etiqueta: `emitida`, `ativa`, `invalidada_por_troca`, `reimpressa`, `cancelada`.
   - Reimpressão com motivo e log de auditoria.

---

## 2. Contratos de API & Backend (NestJS)

- `GET /api/v1/operacao/recebimentos`: Listagem paginada de recebimentos.
- `POST /api/v1/operacao/recebimentos/:id/iniciar`: Iniciar conferência física.
- `POST /api/v1/operacao/recebimentos/:id/nfe`: Registrar NF do fornecedor.
- `POST /api/v1/operacao/recebimentos/:id/concluir`: Registrar conclusão da conferência tripla.
- `POST /api/v1/operacao/pesagem/pecas`: Registrar pesagem de peça com captura de peso.
- `POST /api/v1/operacao/pesagem/pecas/:id/trocar`: Executar troca atômica de peça.
- `POST /api/v1/operacao/pesagem/pecas/:id/estornar`: Estornar pesagem e invalidar etiqueta.
- `GET /api/v1/operacao/etiquetas`: Consultar etiquetas com filtro por status.
- `POST /api/v1/operacao/etiquetas/:id/reimprimir`: Reimprimir etiqueta com motivo.

---

## 3. Interfaces Frontend (Next.js 16 + React 19 + shadcn/ui)

- `app/frontend/src/app/(admin)/recebimento/recebimento-carga/page.tsx` & `recebimento-carga-client.tsx`
- `app/frontend/src/app/(admin)/recebimento/pesagem-destinacao/page.tsx` & `pesagem-destinacao-client.tsx`
- `app/frontend/src/app/(admin)/recebimento/etiquetas/page.tsx` & `etiquetas-client.tsx`

---

## 4. Definição de Pronto (DoD) & Critérios de Aceitação

1. **Zero Placeholders**: Nenhuma tela com dados mockados fixos no cliente.
2. **Fidelidade ao Protótipo**: Visualização idêntica ao protótipo v1.1.
3. **Qualidade Local**:
   - `npm run lint` limpo.
   - `npm run type-check` limpo.
   - Suíte de backend (26+ test suites) verde.
   - Suíte de frontend (50+ test suites) verde.
   - Testes Playwright E2E.
