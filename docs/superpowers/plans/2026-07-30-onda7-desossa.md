# Plano Tático — Onda 7 (Desossa) — Portão 1

> **Status:** Aprovado · **Data:** 2026-07-30 · **Portão 1: Aprovado**
> **Dependência prévia:** Onda 6 (Recebimento & Balança) — Concluída (Portão 2 Aprovado).
> **Subordinado a:** [`2026-07-22-implementacao-completa-prototipo-v1.1.md`](2026-07-22-implementacao-completa-prototipo-v1.1.md) e [`../../governance/constituicao.md`](../../governance/constituicao.md).

---

## 1. Escopo e Objetivos da Onda 7

A Onda 7 contempla o módulo de **Desossa & Transformação**, incluindo o painel aeroporto/Modo TV, pesagem com trava de exclusividade por regra de transformação, etiquetagem de subpeças e caixa, e controle de divergências de rendimento.

### Rotas e Módulos Cobrindo 100% da Matriz de Rastreabilidade para Onda 7:
1. **Painel Aeroporto / Modo TV da Desossa** (`/desossa/dashboard`)
   - Visualização em grande formato (Modo TV) com atualização automática das ordens de desossa e faltas por item comercial.
   - Indicadores de carcaças desossadas vs. saldo no gancho.
2. **Pesagem de Subpeças & Trava de Exclusividade** (`/desossa/pesagem-destinacao`)
   - Escolha da regra de transformação para a peça principal (ex: Boi casado 2 TZ + 2 DT + 2 PA — AD-01; Coxão-bola + Jacaré ou Coxão-bola c/ alcatra + Filé curto — §6.6 v1.1).
   - Trava de exclusividade: a escolha da regra congela as opções incompatíveis das regras concorrentes.
   - Registro de pesagem de subpeças resultantes com validação de rendimento e geração de `divergencias_transformacao`.
3. **Gestão e Impressão de Etiquetas de Desossa** (`/desossa/etiquetas`)
   - Geração de etiquetas de subpeças e caixarias com rastreabilidade da peça mãe.

---

## 2. Contratos de API & Backend (NestJS)

- `GET /api/v1/operacao/desossa/faltas`: Consultar faltas por item comercial na desossa.
- `GET /api/v1/operacao/desossa/regras`: Consultar regras de transformação ativas.
- `POST /api/v1/operacao/desossa/transformacoes`: Iniciar transformação de peça com trava de regra.
- `POST /api/v1/operacao/desossa/pesagem-subpeca`: Registrar pesagem de subpeça gerada.

---

## 3. Interfaces Frontend (Next.js 16 + React 19 + shadcn/ui)

- `app/frontend/src/app/(admin)/desossa/dashboard/page.tsx` & `desossa-dashboard-client.tsx`
- `app/frontend/src/app/(admin)/desossa/pesagem-destinacao/page.tsx` & `desossa-pesagem-client.tsx`
- `app/frontend/src/app/(admin)/desossa/etiquetas/page.tsx` & `desossa-etiquetas-client.tsx`

---

## 4. Definição de Pronto (DoD) & Critérios de Aceitação

1. **Zero Placeholders**: Nenhuma tela com dados mockados fixos no cliente.
2. **Fidelidade ao Protótipo**: Visualização idêntica ao protótipo v1.1.
3. **Qualidade Local**:
   - `npm run lint` limpo.
   - `npm run type-check` limpo.
   - Suíte de backend e frontend passadas 100%.
