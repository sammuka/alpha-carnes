# Evidências Onda 7 — Desossa

Screenshots lado a lado (app × protótipo `feature/completude-v1.1` @ `8d32aa4c`):

| Tela | App | Protótipo |
|---|---|---|
| Dashboard | `app-dashboard.png` | `referencia-prototipo/proto-dashboard.png` |
| Modo TV | `app-modo-tv.png` | `referencia-prototipo/proto-modo-tv.png` |
| Pesagem | `app-pesagem.png` | `referencia-prototipo/proto-pesagem.png` |
| Etiquetas | `app-etiquetas.png` | `referencia-prototipo/proto-etiquetas.png` |

Captura:

```bash
# App (frontend :3100 + backend autenticável)
cd app/frontend && node scripts/capture-onda7-app.mjs

# Protótipo (Vite :5173)
cd app/frontend && node scripts/capture-onda7-prototipo.mjs
```
