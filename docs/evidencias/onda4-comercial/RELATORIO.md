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

## D36 — migrations Drizzle geradas

headTestadoD36 = d0d155e010c7377c66ca55117ae45e9fe4445ecb

### Ambiente e proveniência

- Node `v22.17.0`
- npm `10.9.2`
- `drizzle-kit` `0.31.10`
- `drizzle-orm` `0.45.2`
- PostgreSQL `18.4 (Debian 18.4-1.pgdg13+1)`

A cadeia foi reconstruída em worktree descartável a partir do estado 0015. O
wrapper `npm run db:generate -- --name=...` não preservou a opção `--name`
neste npm e produziu um nome aleatório; o probe inteiro foi descartado antes
de qualquer cópia. A reconstrução canônica reiniciou em 0015 com o mesmo
binário local fixado no lockfile:

```text
npx drizzle-kit generate --name onda4_comercial_expand
→ 0016_onda4_comercial_expand.sql + meta/0016_snapshot.json

npx drizzle-kit generate --custom --name onda4_comercial_backfill
→ 0017_onda4_comercial_backfill.sql + meta/0017_snapshot.json

npx drizzle-kit generate --name onda4_comercial_contract
→ 0018_onda4_comercial_contract.sql + meta/0018_snapshot.json
```

O 0016 contém quatro tabelas, FKs, checks, índices, `rota_id` nullable e
`idx_clientes_rota` parcial, todos derivados do schema. O 0017 foi criado por
`--custom` e contém somente dois `UPDATE`, uma CTE e `DO`/`RAISE EXCEPTION`;
não contém `CREATE`, `ALTER`, `DROP` ou `TRUNCATE`. O 0018 contém somente o
`DROP COLUMN rota_padrao` gerado. `git diff --check` terminou sem achados.

Encadeamento gerado:

| Snapshot | id | prevId |
|---|---|---|
| 0015 | `69479d67-08ba-44a9-b6b0-74fd443083d2` | `d7911d91-f225-4076-88dd-40101d983018` |
| 0016 | `69450b9a-8249-412e-91d4-7ac0a748b597` | `69479d67-08ba-44a9-b6b0-74fd443083d2` |
| 0017 | `3a5f6b11-60d1-482a-9e79-a7a2f6e3328f` | `69450b9a-8249-412e-91d4-7ac0a748b597` |
| 0018 | `ea2d4278-a135-49f6-8eb3-832fc028e6fc` | `3a5f6b11-60d1-482a-9e79-a7a2f6e3328f` |

### Provas executadas

- `clean`: banco dedicado vazio executou `npm run db:migrate`, `npm run
  db:seed` e o mesmo par novamente. As duas migrations e os dois seeds
  concluíram com sucesso; cada seed confirmou 11 perfis, 65 permissões e 11
  pares do catálogo.
- `legacy`: banco parado em 0015, com `rotas` e `clientes.rota_padrao` reais,
  avançou por 0016→0018; o backfill preservou os dados e o segundo migrate não
  criou nova entrada.
- `guarda`: legado sem correspondência levantou `backfill incompleto`, manteve
  `rota_padrao` e impediu o contract. Depois da correção da rota, a mesma
  sequência foi reaplicada com sucesso e sem perda.
- Backfill: código teve precedência, nome foi usado apenas quando único, nome
  ambíguo e rota removida não produziram associação; clientes ativos e
  soft-deletados foram cobertos e a reaplicação não mudou os ids já migrados.
- `rollback`: o probe descartável gerou 0019 rollback-expand e 0020
  rollback-backfill custom inverso. Restaurou `rota_padrao` por `rotas.codigo`
  e preservou `rota_id`, `idx_clientes_rota`, as quatro tabelas e o dado O4.
- Metadata/schema/migrations: 3 suites, 7 testes, todos aprovados.
- Integrações O4 relevantes: 10 suites, 101 testes, todos aprovados.
- Frontend Clientes O4: 1 suite, 5 testes, todos aprovados.
- `npm run lint` e `npm run type-check` na raiz: backend e frontend aprovados.

### Drift e hashes

O probe final executou:

```text
npx drizzle-kit generate --name onda4_drift_probe
No schema changes, nothing to migrate
```

Não foi criado 0019, os sete artefatos conservaram seus hashes e o worktree
permaneceu sem diff após o probe.

| Caminho | SHA-256 antes | SHA-256 depois | Resultado |
|---|---|---|---|
| `app/backend/src/database/migrations/0016_onda4_comercial_expand.sql` | `d4a548ec868d6a031cc93ff3a71c8a143bb7cd3fd5a62308f3ebfdcfada99b29` | `d4a548ec868d6a031cc93ff3a71c8a143bb7cd3fd5a62308f3ebfdcfada99b29` | `igual` |
| `app/backend/src/database/migrations/meta/0016_snapshot.json` | `eea35af1b0cf3cf0255eab45b8a1d01068c66ca5be8c583d053144186675e952` | `eea35af1b0cf3cf0255eab45b8a1d01068c66ca5be8c583d053144186675e952` | `igual` |
| `app/backend/src/database/migrations/0017_onda4_comercial_backfill.sql` | `0254ad18c44bcb715a774326265360455e5b6edc8bdda27bc59c2e96505914dd` | `0254ad18c44bcb715a774326265360455e5b6edc8bdda27bc59c2e96505914dd` | `igual` |
| `app/backend/src/database/migrations/meta/0017_snapshot.json` | `13cde55a84834bdb24b1d5d026e7215794571cedea9044d2251c0531432c5ff2` | `13cde55a84834bdb24b1d5d026e7215794571cedea9044d2251c0531432c5ff2` | `igual` |
| `app/backend/src/database/migrations/0018_onda4_comercial_contract.sql` | `977e16d5a8dbb780fcc3fa7de97eb3949fbe0005fb2633d60273fa753167744d` | `977e16d5a8dbb780fcc3fa7de97eb3949fbe0005fb2633d60273fa753167744d` | `igual` |
| `app/backend/src/database/migrations/meta/0018_snapshot.json` | `6eb065cb2165f901616fb6ff91a31ce7b523a1e93411b374eaf865837a0ad185` | `6eb065cb2165f901616fb6ff91a31ce7b523a1e93411b374eaf865837a0ad185` | `igual` |
| `app/backend/src/database/migrations/meta/_journal.json` | `a136d1bad4d724e0cc1a5c1a301cfde38ed5a9e39410c580d93469f978263247` | `a136d1bad4d724e0cc1a5c1a301cfde38ed5a9e39410c580d93469f978263247` | `igual` |
