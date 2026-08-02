# Evidências Onda 8 — Estoque

Screenshots reais do app (Docker Desktop, `http://localhost:4000`), autenticado como
perfil `expedicao`, capturados via Playwright (`app/frontend/e2e/capture-onda8-evidencias.spec.ts`)
com asserts fail-hard sobre elementos-chave de cada tela antes da captura.

| Tela | Rota | Arquivo | Elemento-chave verificado |
|---|---|---|---|
| Consulta de Estoque (aba Consulta) | `/estoque/consulta` | `app-consulta-estoque.png` | Heading "Consulta de Estoque" |
| Consulta de Estoque (aba Sobras & Congelamento) | `/estoque/consulta` | `app-consulta-sobras.png` | "Túnel de Congelamento" + badge "Provisório" |
| Entrada de Itens | `/estoque/entrada-itens` | `app-entrada-itens.png` | Nota "Caixarias são vendidas por unidade..." |
| Ajustes de Estoque | `/estoque/ajustes` | `app-ajustes-estoque.png` | "Requer aprovação da gestão" |

Hashes distintos entre as 4 capturas confirmam que cada uma renderiza conteúdo real e
diferente (não é a mesma tela reaproveitada).

Reprodução local:

```bash
cd app/frontend
E2E_FRONTEND_URL=http://localhost:4000 \
E2E_EXPEDICAO_EMAIL=expedicao-e2e@alphacarnes.local \
E2E_EXPEDICAO_PASSWORD='Expedicao@2026!' \
npx playwright test e2e/capture-onda8-evidencias.spec.ts
```
