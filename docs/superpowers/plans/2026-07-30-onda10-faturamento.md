# Plano Tático — Onda 10 (Faturamento) — Portão 1

> **Status:** Aprovado · **Data:** 2026-07-30 · **Portão 1: Aprovado**
> **Dependência prévia:** Ondas 8 (Estoque) e 9 (Carga) — Concluídas (Portão 2 Aprovado).
> **Subordinado a:** [`2026-07-22-implementacao-completa-prototipo-v1.1.md`](2026-07-22-implementacao-completa-prototipo-v1.1.md) e [`../../governance/constituicao.md`](../../governance/constituicao.md).

---

## 1. Escopo e Objetivos da Onda 10

A Onda 10 contempla o módulo final de **Faturamento**, responsável pela pré-fatoração, emissão de NFS-e via adapter EISS + RTC, geração de XML/PDF, seguro manual (F6b) e liberação com checklist.

### Rotas e Módulos Cobrindo 100% da Matriz de Rastreabilidade para Onda 10:
1. **Pré-Faturamento** (`/faturamento/pre-faturamento`)
   - Visualização de cargas embarcadas prontas para faturamento.
   - Conferência de dados tributários e alíquotas (RTC).
2. **Emissão de Notas & XML** (`/faturamento/notas-xml`)
   - Integração via Adapter EISS (real + fallback mockado de homologação).
   - Emissão de NFS-e, geração de DANFE e download de XML.
3. **Seguro Manual F6b** (`/faturamento/seguro-manual`)
   - Lançamento e auditoria de apólices e averbações de seguro de carga.
4. **Liberação Final com Checklist** (`/faturamento/liberacao`)
   - Checklist de liberação de saída do veículo com verificação de lacre, temperatura e documentação fiscal.

---

## 2. Contratos de API & Backend (NestJS)

- `GET /api/v1/operacao/faturamento/pre-faturamento`: Listar pedidos expedidos.
- `POST /api/v1/operacao/faturamento/nfse/emitir`: Processar emissão de NFS-e via EISS/RTC.
- `GET /api/v1/operacao/faturamento/seguro`: Listar e registrar seguro manual F6b.
- `POST /api/v1/operacao/faturamento/liberacao/checklist`: Registrar liberação do veículo com checklist.

---

## 3. Interfaces Frontend (Next.js 16 + React 19 + shadcn/ui)

- `app/frontend/src/app/(admin)/faturamento/pre-faturamento/page.tsx` & `pre-faturamento-client.tsx`
- `app/frontend/src/app/(admin)/faturamento/notas-xml/page.tsx` & `notas-xml-client.tsx`
- `app/frontend/src/app/(admin)/faturamento/seguro-manual/page.tsx` & `seguro-manual-client.tsx`
- `app/frontend/src/app/(admin)/faturamento/liberacao/page.tsx` & `liberacao-client.tsx`

---

## 4. Definição de Pronto (DoD) & Critérios de Aceitação

1. **Zero Placeholders**: Nenhuma tela com dados mockados no cliente.
2. **Fidelidade ao Protótipo**: Visualização idêntica ao protótipo v1.1.
3. **Qualidade Local**:
   - `npm run lint` limpo.
   - `npm run type-check` limpo.
   - Suíte de backend e frontend passadas 100%.
