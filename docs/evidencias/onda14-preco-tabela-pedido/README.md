# Onda 14 — Preço de tabela no pedido (AD-16 / ALP-61)

Task 12. Screenshots das 4 telas (cliente campo; editor coluna+borda; fila ocorrência; relatório) ficam para o Quality Owner na T13 — Playwright de captura visual não rodou nesta sessão. Evidência de UI: Jest frontend `onda14-*` **40/40**.

## Ambiente

- Branch: `feature/alissen`
- Postgres `localhost:15433`, `HARDWARE_FAKE=1`, `NFSE_FAKE=1`
- `docker compose ps` (2026-09-08): postgres / backend / frontend Up; postgres healthy

## Regressão T12 (12 arquivos, `--runInBand`)

```
Test Suites: 12 passed, 12 total
Tests:       79 passed, 79 total
Time:        331.447 s
```

Arquivos: `pedidos-onda4`, `pedidos-reserva`, `pedidos-concorrencia`, `adendos`, `overbooking-lifecycle`, `overbooking-decisao`, `overbooking-concorrencia`, `sif`, `aprovacoes`, `ocorrencia-fornecedor`, `perfil-permissoes-snapshot`, `onda13-catalogo-unificacao`.

## Onda 14 e2e + UI

- Backend `onda14-*`: **5 suites / 47 tests** passed (inclui C5, C7, C8, C9, C10, 14.2–14.8).
- Frontend Jest `onda14-*`: **4 suites / 40 tests** passed.

## `rg` (T12)

| Checagem | Resultado |
|---|---|
| `PEDIDO_PRECO_AJUSTAR` em `app/backend/src` e `app/frontend/src` | vazio |
| `item_comercial_id` em schema e modules | vazio |
| `itemComercialId` em `comercial/pedidos` UI | vazio |
| `sem produto vinculado` / `item comercial sem produto` em `app/` | vazio (só o plano) |

Snapshot RBAC: `OCORRENCIA_PRECO_CIENTE` em `administrador` e `gestor`. Ausentes `PEDIDO_PRECO_AJUSTAR`, `ITENS_COMERCIAIS_*`, `ITENS_COMPRA_*`.

## Schema

- `npx drizzle-kit check`: Everything's fine
- `backfill-itens-count.txt`: `onda14-itens-count=0`

## Cobertura dos services tocados

`coverage.txt` — Jest `--coverage` restrito aos 4 services (24 suites / 250 testes, 547.57 s).

| Service | Linhas | Branches |
|---|---:|---:|
| `ClientesService` | 98.90% | 92.63% |
| `PrecosService` | 100% | 98.27% |
| `PedidosService` | 95.74% | 85.54% |
| `OcorrenciasPrecoService` | 100% | 100% |

`npm run test:cov` global (199 suites) falhou na 1ª passagem por POSTs `/clientes` sem `faixaPreco` e pedidos sem tabela publicada; specs/fixtures foram corrigidos. Reexecução pontual dos 10 suites: verde. Suite global completa (~59 min) não foi refeita nesta sessão — 14.9 manda `test:cov` + 8 jobs **depois** de T13.
