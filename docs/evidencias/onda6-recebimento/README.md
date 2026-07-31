# Evidências — Onda 6 (Recebimento & Balança)

Comparação lado a lado app × protótipo (`feature/completude-v1.1`), viewport 1280×800.

## Telas

| # | Rota | Protótipo | App |
|---|------|-----------|-----|
| 01 | `/recebimento/recebimento-carga` | `referencia-prototipo/01-recebimento-carga-prototipo.png` | `01-recebimento-carga-app.png` |
| 02 | `/recebimento/pesagem-destinacao` | `referencia-prototipo/02-pesagem-destinacao-prototipo.png` | `02-pesagem-destinacao-app.png` |
| 03 | `/recebimento/etiquetas` | `referencia-prototipo/03-etiquetas-prototipo.png` | `03-etiquetas-app.png` |

## Como regenerar

```bash
# Protótipo
cd F:/Projetos/alpha-carnes-prototipo
npm run dev -- --host 127.0.0.1 --port 5173
# outro terminal, na raiz do monorepo / worktree:
cd app/frontend && node scripts/capture-onda6-prototipo.mjs

# App (frontend :3100 + backend :4001, HARDWARE_FAKE=1)
cd app/frontend && node scripts/capture-onda6-app.mjs
```

## Procedência

- Protótipo: repo `alpha-carnes-prototipo`, branch `feature/completude-v1.1`, Vite `127.0.0.1:5173`.
- **Não** usar `alpha-carnes-prototipo/src/imports/*.png` — são screenshots antigos da app E2E, não do protótipo (ver evidências Onda 2).

## Dívida E2E 6.23

O caso `captura itens da NF e conclui a conferência pela tela` semeia o lote via
`e2e/helpers/onda6-seed.ts` (HTTP no backend). **Não** depende mais de `E2E_ONDA6_SEED`.
