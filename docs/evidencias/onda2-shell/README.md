# Evidências — Onda 2 Shell + Design System

Comparação **estrutural lado a lado** entre a aplicação Next.js e o protótipo Vite/React Router (`feature/completude-v1.1`). **Não é pixel-perfect** (decisão 21): stacks, dados mockados e renderização diferem; o critério é fidelidade de layout, tokens, menu e microcopy.

Viewport: **1280×800** (Playwright default do projeto).

## Artefatos

| Arquivo (app) | Origem | Comando |
|---|---|---|
| `01-login.png` | Playwright `e2e/shell-ds.spec.ts` — teste "login exibe painel institucional…" | `npm run e2e:shell` |
| `02-shell-dashboard.png` | Playwright — teste "captura evidencias do shell…" | `npm run e2e:shell` |
| `03-shell-sidebar-9-grupos.png` | Playwright — screenshot da sidebar no dashboard | `npm run e2e:shell` |
| `referencia-prototipo/01-login-prototipo.png` | `alpha-carnes-prototipo/src/imports/01-login.png` | cópia versionada |
| `referencia-prototipo/02-shell-prototipo.png` | `alpha-carnes-prototipo/src/imports/02-dashboard.png` | cópia versionada |

## Divergências autorizadas (plano Onda 2)

- **Decisão 11** — `gestor`/`diretoria` veem `ADMINISTRAÇÃO` restrita a `Auditoria`; `conferente`/`logistica` sem grupo até Onda 3.
- **Decisão 16** — chip "Escopo" removido enquanto `/auth/me` não expõe representante.
- **Decisão 20** — login sem foto CDN, sem credencial pré-preenchida, sem "Esqueci a senha"/"Lembrar minhas credenciais", sem rodapé de protótipo.
- **Decisão 25** — 26 rotas que a matriz atribui e o gate de grupo retira do menu (reconciliação Onda 3).
- **Decisão 26** — rota de entrada `/` resolvida pelo grupo de trabalho do perfil.
- **Decisão 30** — `faturamento` vê `GESTÃO` só com `Relatórios & SIF`; `compras` recupera `Pendências de Overbooking`.
- **Decisão 31** — itens visíveis sem atribuição na matriz (`compras`: 11; `diretoria`: 3).

## Como regenerar

```bash
docker compose up -d postgres
cd app/backend && npm run db:migrate && npm run db:seed && cd ../..
docker compose up -d --build backend
curl -fsS http://localhost:4001/health

cd app/frontend
JWT_ACCESS_SECRET="$(grep '^JWT_ACCESS_SECRET=' ../../.env | cut -d= -f2-)" \
BACKEND_INTERNAL_URL=http://localhost:4001 \
NEXT_PUBLIC_AMBIENTE=Desenvolvimento \
npm run e2e:shell
```
