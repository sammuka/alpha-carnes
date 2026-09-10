# Assessment funcional do AlphaCarnes

Roteiro completo de homologação assistida. Produzido por análise do repositório no estado de 30/08/2026.
**Nenhum código da aplicação foi alterado.**

---

## Por onde começar

| Se você é… | Leia nesta ordem |
|---|---|
| **Patrocinador / gestor** | [`00`](00-sumario-executivo.md) → [`06`](06-gaps-identificados.md) §gaps críticos |
| **Homologador** | [`00`](00-sumario-executivo.md) → [`07`](07-roadmap-homologacao.md) → fichas do [`03`](03-jornadas-operacionais.md) na ordem do roadmap |
| **Product / BA** | [`01`](01-visao-geral.md) → [`06`](06-gaps-identificados.md) §regras a confirmar |
| **Desenvolvedor** | [`09`](09-rastreabilidade-tecnica.md) → [`08`](08-matriz-estados-transicoes.md) |
| **QA / automação** | [`04`](04-matriz-testes.md) → [`05`](05-jornada-e2e.md) |

---

## Documentos

| Arquivo | Conteúdo |
|---|---|
| [`00-sumario-executivo.md`](00-sumario-executivo.md) | Números, cinco achados principais, riscos, top 10 e recomendação |
| [`01-visao-geral.md`](01-visao-geral.md) | 23 módulos, 11 personas, mapa de processos, dependências, arquitetura funcional |
| [`02-inventario-telas.md`](02-inventario-telas.md) | 50 telas com rota, ações e permissões; matrizes de cobertura de tela e de ação |
| [`03-jornadas-operacionais.md`](03-jornadas-operacionais.md) | Convenções + M01 a M04 (autenticação, administração, cadastros, operações) — 29 fichas |
| [`03b-jornadas-comercial.md`](03b-jornadas-comercial.md) | M05 a M10 (compra programada, disponibilidade, pedidos, overbooking, preços, espelho) — 29 fichas |
| [`03c-jornadas-recebimento-producao.md`](03c-jornadas-recebimento-producao.md) | M11 a M17 (pedido ao fornecedor, recebimento, pesagem, etiquetas, desossa, estoque, aprovações) — 22 fichas |
| [`03d-jornadas-expedicao-faturamento.md`](03d-jornadas-expedicao-faturamento.md) | M18 a M23 (expedição, faturamento/NFS-e, seguro, liberação, painel, SIF) — 13 fichas |
| [`04-matriz-testes.md`](04-matriz-testes.md) | Matriz mestre: 644 cenários com tipo, prioridade, dependências e status |
| [`05-jornada-e2e.md`](05-jornada-e2e.md) | E2E-001 — operação completa em 7 blocos, mais 5 variantes |
| [`06-gaps-identificados.md`](06-gaps-identificados.md) | 59 gaps, 25 regras a confirmar e as 7 pendências já reconhecidas |
| [`07-roadmap-homologacao.md`](07-roadmap-homologacao.md) | 11 fases (0 a 10) com esforço, dependências e checkpoints |
| [`08-matriz-estados-transicoes.md`](08-matriz-estados-transicoes.md) | Status e transições de 26 entidades |
| [`09-rastreabilidade-tecnica.md`](09-rastreabilidade-tecnica.md) | Ligação jornada ↔ rota ↔ endpoint ↔ tabela ↔ permissão |

---

## Convenções usadas em todo o assessment

| Marcador | Significado |
|---|---|
| ⚠️ **REGRA A CONFIRMAR COM NEGÓCIO** | O código não decide e a especificação não fecha. Não é defeito |
| 🔎 **POSSÍVEL GAP IDENTIFICADO** | Comportamento aparentemente incorreto ou ausente, com evidência |
| **Badge "Provisório" (P1…P15)** | Pendência consciente sinalizada na própria UI. **Não reportar como bug** |

**Numeração de cenários:** `JRN-XXX-000` é o caminho feliz; `-A1`, `-A2`… são alternativos; `-N1`, `-N2`…
são negativos; `-P1`, `-P2`… são de permissão.

**Status inicial de todo cenário:** `Não executado`.

---

## Como registrar o resultado

Cada cenário executado deve receber: status (Aprovado · Reprovado · Bloqueado · N/A), evidência
(screenshot ou resposta de API), e — quando reprovado — a referência ao gap correspondente ou a abertura
de um novo. O formato sugerido de planilha está no fim de [`04-matriz-testes.md`](04-matriz-testes.md).

---

## Ambiente

```powershell
docker compose up --build -d   # postgres + backend + frontend
```

| Serviço | URL |
|---|---|
| Frontend | http://localhost:4000 |
| Backend | http://localhost:4001 |
| PostgreSQL | localhost:15433 |

O seed cria **apenas o usuário `admin`**. Os outros 10 usuários de perfil precisam ser criados na Fase 1
(JRN-ADM-001) — sem eles, toda a validação de RBAC fica bloqueada.

Os testes usam `HARDWARE_FAKE=1` e `NFSE_FAKE=1`: balança, impressora, leitor e o webservice EISS Osasco
respondem por fakes determinísticos. Nenhum dispositivo ou serviço externo real é acionado.
