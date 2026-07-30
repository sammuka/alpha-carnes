# Evidências — Onda 4 Comercial

Capturas reais das cinco telas comerciais implementadas, após autenticação com o perfil
`administrador`. O objetivo desta pasta é provar que as rotas renderizam telas reais da Onda 4,
sem `PlaceholderPage`, erro de aplicação ou redirecionamento para login.

Viewport: **1280×800** (projeto Chromium do Playwright).

## Artefatos

| Arquivo | Rota | Estado capturado |
|---|---|---|
| `01-clientes.png` | `/comercial/clientes` | master-detail e estado vazio após o carregamento |
| `02-pedidos.png` | `/comercial/pedidos` | indicadores, filtros e estado vazio após o carregamento |
| `03-tabela-precos.png` | `/comercial/tabela-precos` | data diária e ação para criar a tabela |
| `04-disponibilidade.png` | `/comercial/disponibilidade` | mapa, grade, filtros e painel de unidades |
| `05-espelho.png` | `/comercial/espelho` | filtros, agrupamentos, totais, impressão e exportação |

## Execução

Data da captura: **2026-07-28**.

Ambiente local isolado:

- backend Nest em `http://localhost:3001`;
- frontend Next.js em `http://localhost:3100`;
- `HARDWARE_FAKE=true`;
- `NFSE_FAKE=true`;
- `BACKEND_INTERNAL_URL=http://localhost:3001`;
- `NEXT_PUBLIC_API_URL=http://localhost:3001`;
- `NEXT_PUBLIC_WS_URL=ws://localhost:3001`;
- banco migrado e populado pelo seed canônico.

Comando de validação:

```powershell
cd app/frontend
$env:HARDWARE_FAKE='true'
$env:NFSE_FAKE='true'
$env:BACKEND_INTERNAL_URL='http://localhost:3001'
$env:NEXT_PUBLIC_API_URL='http://localhost:3001'
$env:NEXT_PUBLIC_WS_URL='ws://localhost:3001'
npx playwright test e2e/onda4-comercial.spec.ts
```

Resultado: **1 teste aprovado em Chromium**. O teste percorreu as cinco rotas, conferiu o
respectivo `heading`, resposta HTTP abaixo de 400 e ausência dos textos de placeholder.

## Inspeção visual

As cinco imagens foram inspecionadas após o desaparecimento dos indicadores de carregamento.
Todas exibem o shell autenticado, item correto do menu, título e controles próprios da tela, sem
erro de aplicação ou placeholder. O seed usado para a captura não possui transações comerciais,
portanto os estados vazios e totais zerados são esperados.

Na captura local de Disponibilidade, o badge de tempo real permaneceu em `reconectando` mesmo com
`NEXT_PUBLIC_WS_URL` explícita. A renderização da tela e a consulta HTTP passaram; esta evidência
visual não é apresentada como prova da conexão WebSocket.
