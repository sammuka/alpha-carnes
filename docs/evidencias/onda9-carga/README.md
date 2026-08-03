# Evidências Onda 9 — Carga

Screenshots lado a lado (app × protótipo `feature/completude-v1.1` @ `8d32aa4c`):

| Tela | App | Protótipo |
|---|---|---|
| Planejamento de Expedição | `app-planejamento.png` | `referencia-prototipo/proto-planejamento.png` |
| Conferência de Carga | `app-conferencia.png` | `referencia-prototipo/proto-conferencia.png` |
| Enviar para Faturamento | `app-enviar-faturamento.png` | `referencia-prototipo/proto-enviar-faturamento.png` |

Elementos-chave conferidos nos scripts (fail-hard): "Pedidos do Dia (Sem
Caminhão)"/"Caminhões Montados" (planejamento), "Bipar"/"Placa: {placa}"
(conferência), "Histórico de Envios" (enviar-faturamento); hash sha256
distinto entre as 3 capturas da app.

Captura:

```bash
# App (frontend local :4102 + backend local :4101, HARDWARE_FAKE=1, DB isolada)
cd app/frontend && E2E_FRONTEND_URL=http://localhost:4102 BACKEND_INTERNAL_URL=http://localhost:4101 \
  SEED_ADMIN_PASSWORD=<senha-do-seed> node scripts/capture-onda9-app.mjs

# Protótipo (Vite :5173)
cd app/frontend && PROTOTIPO_URL=http://127.0.0.1:5173 node scripts/capture-onda9-prototipo.mjs
```

Achado real fechado durante a verificação (não é dívida): o rótulo
"{n} Caminhão{ões}" do card "Caminhões Montados" é fiel ao protótipo
(`PlanejamentoExpedicao.tsx:286` usa a mesma concatenação — confirmado no
screenshot do protótipo, que também mostra "2 Caminhãões").
