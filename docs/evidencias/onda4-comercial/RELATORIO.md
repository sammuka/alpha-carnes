# Relatório — Onda 4 (PR #35)

## O que foi implementado

Plano executado: `docs/superpowers/plans/2026-07-26-onda4-comercial.md`, incluindo as
emendas D33, D34 e D35. Não houve desvio funcional do plano: a implementação entrega a
Onda 4 completa, sem recorte de MVP e sem antecipar Desossa, Carga ou Faturamento.

| Task | Resultado |
|---|---|
| 1 | Migração expand e schemas Drizzle aplicados. |
| 2 | Migração contract removeu o contrato legado `rota_padrao`. |
| 3 | Permissões e matriz de perfis atualizadas; snapshot RBAC reproduzível e sem diff. |
| 4 | Eventos de domínio da Onda 4 implementados. |
| 5 | Catálogo MVP canônico com 11 pares e sinalização Provisório P11 semeado. |
| 6 | Unicidade AD-03, herança do cadastro e contrato canônico da compra implementados. |
| 7 | Adendos e histórico implementados. |
| 8 | Liberação explícita de reserva conforme AD-06 implementada e auditada. |
| 9 | Módulo completo de Tabela de Preços implementado. |
| 10 | Mapa teatro e drill-down da Disponibilidade implementados. |
| 11 | Espelho Comercial implementado. |
| 12 | Clientes com rota, prioridade e preferências implementados no backend. |
| 13 | BFF da Onda 4 implementado, incluindo handlers aninhados de itens. |
| 14 | Tela real `/comercial/clientes` implementada. |
| 15 | Tela real `/comercial/pedidos` implementada com fluxos de adendo, overbooking e reserva. |
| 16 | Cliente e rota legados de pedidos removidos; zero referências residuais no gate. |
| 17 | Tela real `/comercial/tabela-precos` implementada. |
| 18 | Tela real `/comercial/disponibilidade` implementada com Mapa padrão, Grade explícita e realtime. |
| 19 | Tela real `/comercial/espelho` implementada. |
| 20 | Testes transversais das cinco rotas implementados. |
| 21 | E2E visual e evidências das cinco telas comerciais registrados. |
| 22 | Contrato canônico Pedido ao Fornecedor → Recebimento implementado ponta a ponta. |
| 23 | Jornada operacional D35 encerrada na segunda peça em `para_corte`, com releitura pela API e exatamente 11 evidências. |
| 24 | Gate local completo executado e artefatos de fechamento preparados. |

Correções de regressão durante o gate ficaram restritas a testes: doubles herdados de
Pedido ao Fornecedor/Recebimento foram alinhados ao snapshot canônico e a fixture de
conferência tripla passou a atualizar a linha já materializada, sem relaxar a constraint
`uq_receb_itens_recebimento_item`. Nenhum arquivo de produção foi alterado nessas correções.

## Evidências

### Gate automatizado

| Etapa | Resultado |
|---|---|
| `npm ci` | OK — 42,55 s no ciclo final |
| `npm run lint` | OK — 61,43 s |
| `npm run type-check` | OK — 11,76 s |
| Migrações + seed | OK — 28,81 s |
| D33 `compras-programadas.e2e-spec.ts` | OK — 1 suíte, 12/12 testes |
| D34 unitário | OK — 2 suítes, 26/26 testes |
| D34 integração | OK — 2 suítes, 41/41 testes |
| Backend full coverage serial | OK — 125/125 suítes, 936/936 testes, 1.160,543 s |
| Frontend dirigido O4 | OK — 4/4 suítes, 13/13 testes |
| Frontend dirigido D34 | OK — 2/2 suítes, 6/6 testes |
| Frontend completo | OK — 46/46 suítes, 217/217 testes |
| Jornada D35 dirigida | OK — 2/2 testes |
| Playwright completo | OK — 25/25 testes |
| `npm run build` | OK — 65,05 s |
| `npm audit --omit=dev --audit-level=high` | OK — zero achado no nível configurado |
| `npx gitleaks detect --no-banner --redact` | NÃO EXECUTADO — pacote sem executável e binário local ausente |

Cobertura backend global:

| Statements | Branches | Functions | Lines |
|---:|---:|---:|---:|
| 96,77% | 86,65% | 97,08% | 98,08% |

### Pré-condições operacionais reproduzíveis

O full backend limpa os usuários das suítes de integração. Por isso, antes do Playwright,
o seed canônico deve ser reaplicado e o login admin deve retornar HTTP 200.

Quando o Next.js roda no host e o backend no container publicado em `4001`, o processo do
Playwright deve receber:

```powershell
$env:BACKEND_INTERNAL_URL='http://127.0.0.1:4001'
$env:NEXT_PUBLIC_API_URL='http://127.0.0.1:4001'
$env:E2E_BACKEND_URL='http://127.0.0.1:4001'
$env:HARDWARE_FAKE='true'
$env:NFSE_FAKE='true'
```

O conjunto completo realiza mais de cinco logins por minuto. O container descartável do
harness foi executado com `THROTTLE_LOGIN_LIMIT=100`, preservando a mesma imagem, rede,
porta, demais variáveis e o Postgres seedado. Essa alteração foi somente de runtime de
teste; código, `.env` e configuração versionada permaneceram intactos.

### Jornada D35 — limite real da Onda 4

Artefato navegável: `docs/evidencias/alpha-jornada-e2e/index.html`.

| Evidência | Marco |
|---|---|
| `01-login.png` | Login admin |
| `02-dashboard.png` | Painel geral |
| `03-clientes.png` | Cliente persistido |
| `04-fornecedores.png` | Fornecedor persistido |
| `05-itens-compra.png` | Item de compra persistido |
| `06-itens-comerciais.png` | Item comercial persistido |
| `07-disponibilidade.png` | Disponibilidade comercial |
| `08-pedido.png` | Pedido comercial |
| `09-recebimento.png` | Recebimento canônico |
| `10-pesagem-associada.png` | Primeira peça associada |
| `11-pesagem-para-corte.png` | Segunda peça relida pela API em `para_corte` |

O artefato contém 11 passos e 11 PNGs. Não existem evidências 12–19, `subitemId`,
`caminhaoId` ou navegação para rotas futuras. Os próximos handoffs permanecem atribuídos
às ondas donas: Desossa/O7, Carga/O9 e Faturamento/O10.

### Evidências das cinco telas comerciais

As capturas em `docs/evidencias/onda4-comercial/` mostram Clientes, Pedidos, Tabela de
Preços, Disponibilidade e Espelho renderizados sem placeholder. O Playwright completo
revalidou as cinco rotas com os adaptadores fake obrigatórios.

## Critérios de aceite

| Critério | Estado | Prova |
|---|---|---|
| Cinco telas comerciais reais, sem placeholder | OK | `onda4-comercial.spec.ts` e capturas 01–05 |
| Contratos backend/BFF completos | OK | 936 testes backend e testes `bff-onda4`/`bff-recebimento` |
| Disponibilidade Mapa + Grade + realtime | OK | `disponibilidade.test.tsx` e `onda4-disponibilidade.test.tsx` |
| Pedido completo, adendo, overbooking e reserva | OK | `onda4-pedidos.test.tsx` e integrações backend |
| Pedido ao Fornecedor → Recebimento canônico | OK | D34 unitário, integração e frontend dirigidos |
| Fronteira da Onda 4 em `para_corte` | OK | D35 2/2, evidência 11 e teste estático de fronteira |
| RBAC e quatro permissões novas | OK | snapshot regerado sem diff |
| Termo banido, placeholders e legado eliminados | OK | greps manuais com zero linhas |
| Build e dependências de produção | OK | build e audit verdes |
| Secret scan | PENDENTE DE FERRAMENTA | gitleaks não está instalado nem disponível via `npx` |

## Pendências/dívidas propostas

1. Disponibilizar um binário oficial do Gitleaks no ambiente/CI e repetir
   `gitleaks detect --no-banner --redact` antes do Portão 2. O resultado não foi
   presumido nem substituído por outro scanner.
2. Automatizar no harness o reseed pós-backend-full, os URLs explícitos do host e um
   limite de throttle próprio para E2E. Isso evita tentativas operacionais sem alterar
   o limite de produção.

Não há pendência funcional conhecida da Onda 4 nem entrega parcial postergada como MVP.
