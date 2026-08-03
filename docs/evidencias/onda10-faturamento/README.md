# Evidências Onda 10 — Faturamento

Screenshots da jornada completa (app real, `NFSE_FAKE=1`/`HARDWARE_FAKE=1`),
capturados por `app/frontend/e2e/onda10-faturamento.spec.ts` (Playwright):

| Tela | Arquivo |
|---|---|
| Pré-Faturamento (badge de ambiente EISS + KPIs + emissão unitária) | `app-pre-faturamento.png` |
| Notas / XML (listagem, KPIs, drawer de rastreabilidade) | `app-notas-xml.png` |
| Seguro Manual (KPIs, transições pendente→enviado→confirmado) | `app-seguro-manual.png` |
| Liberação do Caminhão (checklist calculado D10.6, "Já liberado") | `app-liberacao.png` |

Elementos-chave conferidos na jornada Playwright (fail-hard):
"Homologação EISS"/"Produção EISS" (badge de ambiente, D10 Goal item a),
"Vínculo pedido ↔ peças ↔ pesos ↔ item fiscal" (drawer de rastreabilidade,
D10.7), "Marcar como enviado"/"Marcar como confirmado" (D10.5),
"Requisitos para liberação"/"Liberar Caminhão"/"Já liberado" (checklist
D10.6), "Caminhão já liberado — cancelamento bloqueado" (trava D10.4).

Captura (docker local com fakes habilitados para a jornada E2E):

```bash
cd app/backend && npm run build
docker compose build backend frontend
docker compose up -d backend frontend
# variáveis NFSE_FAKE=1 / HARDWARE_FAKE=1 no container do backend durante a captura
cd app/frontend && BACKEND_INTERNAL_URL=http://127.0.0.1:4001 NEXT_PUBLIC_API_URL=http://127.0.0.1:4001 \
  E2E_FRONTEND_URL=http://localhost:3100 npx playwright test e2e/onda10-faturamento.spec.ts
```

Protótipo de referência: `F:\Projetos\alpha-carnes-prototipo` @
`feature/completude-v1.1` `8d32aa4c` — `Faturamento.tsx`, `NotasXml.tsx`,
`SeguroManual.tsx`, `LiberacaoCaminhao.tsx` (ver seção "Referências do
protótipo" do plano tático).
