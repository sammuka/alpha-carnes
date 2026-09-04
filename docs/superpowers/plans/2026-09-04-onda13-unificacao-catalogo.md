# Onda 13 — Unificação do catálogo em Produtos — Plano de Implementação

> Para workers agênticos: usar o papel `worker` definido em `.codex/agents/worker.toml`.
> Seguir o plano **literalmente**. `old_string` não casa / teste falha após 1 correção / caso não coberto → **PARAR e reportar**. Não decidir regra, não improvisar, não abrir PR.

**Goal:** Extinguir `itens_comerciais` e `itens_compra` na mesma onda (AD-15). `produtos` passa a ser a única entidade de catálogo. As 13 colunas de FK nas 12 tabelas operacionais apontam para `produtos.id`. A UI volta a 39 rotas canônicas (Princípio I). Identidade 1:1 é implícita (sem TZ→TZ na tabela). GET `/itens-comerciais` e `/itens-compra` respondem **404** (sem redirect). Nenhum PR é aberto até o Quality Owner validar a jornada (ALP-75).

**Architecture:** Modular monolith NestJS. Evolução de schema em expand → backfill → contract (Princípio X): `0034` ADD nullable + índices novos; `0035` DML fail-closed; `0036` NOT NULL + DROP colunas/tabelas/arquivos. `DisponibilidadeService.gerarParaCompra` / `recalcularParaCompra` / `projetarImpacto` passam a unir regras `produto_origem_id → produto_destino_id` com identidade implícita (`ativo_compra AND ativo_venda`). CRUD de catálogo só em `ProdutosModule`. Frontend DS v3: menu sem as duas entradas; consumidores falam `produtoId` e `GET /api/cadastros/produtos`.

**Tech Stack:** NestJS 11, TypeScript 5 strict, Drizzle ORM + drizzle-kit 0.31.10, PostgreSQL 18, Zod 4, WebSocket nativo + `@nestjs/event-emitter`, Jest/Supertest, Next.js 16 App Router/BFF, React 19, Tailwind 4, DS v3, Playwright. Zero dependência nova.

**Base pinada no momento do plano:** `origin/develop` @ `518547f249a4cfc9e5a7cb8e237f6b5a4bd09682`. Journal em `app/backend/src/database/migrations/meta/_journal.json` termina em `idx: 33` / `0033_onda12_dominio_contract`. Próximos nomes livres: `0034_onda13_catalogo_expand`, `0035_onda13_catalogo_backfill`, `0036_onda13_catalogo_contract`. Se `origin/develop` avançar e o journal ganhar `idx ≥ 34`, **parar e reportar** — não renumerar sozinho.

**Worktree / branch:** `.worktrees/o13` · `feature/onda13-unificacao-catalogo`. HEAD no momento do plano: `9b09034551b4967f3fcd936af1f408b0782b1aa8` (AD-15 já commitada). Nunca implementar no worktree coordenador (`feature/jef`).

**Linear:** épico [ALP-62](https://linear.app/alphacarnes/issue/ALP-62). T00 [ALP-63](https://linear.app/alphacarnes/issue/ALP-63) Done. Este arquivo é T01 [ALP-64](https://linear.app/alphacarnes/issue/ALP-64). Worker executa T02–T11 = ALP-65…ALP-74. T12 [ALP-75](https://linear.app/alphacarnes/issue/ALP-75) é o Quality Owner. T13 [ALP-76](https://linear.app/alphacarnes/issue/ALP-76) abre o PR só depois de T12 Done.

---

## Global Constraints

1. **AD-15 é fechada.** Não reabrir catálogo único, identidade implícita, BPORCO, BOI `compra_base`, DROP no contract da mesma onda, nem a proibição de PR antes do QO.
2. **AD-11 permanece visível** (append-only) e está **revogada** pela AD-15. Não reintroduzir as duas rotas.
3. **AD-01 intacta:** 1 boi casado = 2 TZ + 2 DT + 2 PA via regras `BOI → TZ/DT/PA` fator 2.
4. **AD-03 intacta:** unicidade de pedido aberto = `(cliente, produto, operação)` — o “produto” é `produtos.id`.
5. **AD-05 intacta:** overbooking ilimitado com challenge 409 e confirmação explícita.
6. **AD-14 intacta no recorte físico.** Pool comercial passa de `(operacao, item_comercial)` para `(operacao, produto)` como consequência da AD-15, sem reabrir lote físico. `pecas.compra_programada_id` continua `NOT NULL` e imutável.
7. **Princípio I:** a tela `/cadastros/produtos` é a do protótipo / DS v3. A fidelidade das rotas `/cadastros/itens-compra` e `/cadastros/itens-comerciais` é a **ausência** (404, sem redirect).
8. **Princípio II:** UI + modelo + seeds + testes na mesma onda. Não deixar tabelas deprecated.
9. **Princípio III / RA-01:** identidade 1:1, desdobramento e filtros de seletor são backend. Frontend não filtra BOI no cliente.
10. **Princípio IV / RA-02:** backfill e mutações de catálogo em transação + auditoria.
11. **Princípio VII / RA-05/06:** backfill que não resolver correspondente `RAISE EXCEPTION`. Zero UUID inventado. Query string desconhecida não pode silenciar filtro.
12. **Princípio VIII:** P11 (catálogo oficial completo) continua parâmetro + `atributos_json.provisorio`. Não fechar P11.
13. **Princípio IX:** zero rótulo isolado “Marca”.
14. **Princípio X:** `0034` e `0036` nascem de `drizzle-kit generate` a partir do schema. `0035` é DML (`generate --custom` ou SQL literal deste plano). Nenhum `ALTER TABLE` avulso fora desses artefatos. DROP TABLE é a exceção explícita da AD-15; rollback = backup Postgres **antes** da 0036.
15. **FK de compra** vive em `compras_programadas_itens.item_compra_id`. O cabeçalho `compras_programadas` **não** tem essa coluna. Não criar `compras_programadas.produto_id`.
16. Endpoints `/itens-comerciais` e `/itens-compra` **removidos** (404 Nest). Sem alias, sem proxy, sem redirect Next.
17. Campo JSON legado `itemComercialId` / `itemCompraId` / `itemComercialBaseId` é **rejeitado** (`.strict()` nos DTOs de mutação). Strip silencioso é falha RA-05.
18. Cobertura backend ≥80% linha **e** branch nos services tocados. `HARDWARE_FAKE=1`, `NFSE_FAKE=1`.
19. Portas host: frontend `4000`, backend `4001`, PostgreSQL `15433`.
20. Serialidade: T02 → T03 → T04 → T05 → T06 → T07 → T08 → T09 → T10 → T11. T12 é humana. T13 só depois de T12.
21. Sem `gh pr create`, sem push obrigatório, até T13.

---

## Decisões de design (fixadas — só reabrir se houver quebra)

### AD-15 (já em `DECISOES.md` no o13, SHA `9b09034`)

Texto vigente: `produtos` é a entidade única; `itens_comerciais` e `itens_compra` extintos; UI só `/cadastros/produtos`; papéis por `ativoCompra` / `tipoOperacional='compra_base'` e `ativoVenda`; identidade 1:1 implícita; BPORCO único; BOI `compra_base`; `sincronizarLegado` some.

### D1–D7 do Quality Owner (ALP-62) — copiados, não reabertos

1. Catálogo único. Extinção no contract da mesma onda.
2. UI única. 41 → 39 rotas de **menu**. Permissões `ITENS_*` removidas.
3. Papéis por flag.
4. Identidade 1:1 implícita. Backfill descarta TZ→TZ, DT→DT, PA→PA (e qualquer origem=destino).
5. Um produto `codigo=BPORCO` com as duas flags. Código `BANDA DE PORCO` some.
6. `BOI` = `compra_base`, `ativoCompra=true`, `ativoVenda=false`.
7. Sem PR até validação pessoal do Quality Owner.

### D8–D24 — fechadas por este plano (T01)

8. **Ordem expand:** ADD as 13 colunas **no `.schema.ts` mantendo as antigas**; só então `npx drizzle-kit generate` → gravar como `0034_onda13_catalogo_expand.sql` + journal. O Worker **não** escreve o DDL do expand à mão e depois “alinha” o schema.
9. **Backfill 0035:** SQL de dados (este plano é a fonte). `drizzle-kit generate --custom --name=onda13_catalogo_backfill` se o kit exigir entrada no journal; o corpo é o bloco literal da Task 3. Não é generate de schema.
10. **Contract 0036:** Drizzle DROP das colunas/arquivos/índices legados + generate. SQL extra permitido: `SET NOT NULL`, CHECK de origem≠destino **somente em linhas ativas** (`deleted_at IS NOT NULL OR origem <> destino` — as regras identidade soft-deleted da T03 precisam sobreviver), `DO $$` de guarda antes do `DROP TABLE`, e o `COMMENT` de rollback. Sem `.down.sql`. Rollback = backup pré-0036. Sem DELETE físico das regras (Princípio X).
11. **T05 não reescreve schema.** Só `rg` + `drizzle-kit check`. Drift → volta T04.
12. **Índices únicos novos (nomes literais, Worker não inventa):**
    | Nome novo (expand) | Tabela | Colunas | Predicado |
    |---|---|---|---|
    | `uq_disp_compra_produto` | `disponibilidades_virtuais` | `(compra_programada_id, produto_id)` | nenhum |
    | `uq_pedido_venda_produto_ativo` | `pedidos_venda_itens` | `(pedido_venda_id, produto_id)` | `deleted_at IS NULL` |
    | `uq_pedido_fornecedor_produto` | `pedidos_fornecedor_itens` | `(pedido_fornecedor_id, produto_id)` | `deleted_at IS NULL` |
    | `uq_nf_fornecedor_produto` | `notas_fiscais_fornecedor_itens` | `(nf_id, produto_id)` | `deleted_at IS NULL` |
    | `uq_receb_itens_recebimento_produto` | `recebimentos_itens` | `(recebimento_id, produto_id)` | nenhum |
    Índices únicos **antigos** (caem no contract): `uq_disp_compra_item`, `uq_pedido_venda_item_comercial_ativo`, `uq_pedido_fornecedor_item`, `uq_nf_fornecedor_item`, `uq_receb_itens_recebimento_item`. `compras_programadas_itens` **não** tem unique de item — não criar unique novo.
13. **Índices não-únicos novos (expand):**
    | Nome expand | Nome final (contract) | Colunas | Predicado |
    |---|---|---|---|
    | `idx_disp_produto` | permanece | `produto_id` | — |
    | `idx_pedidos_itens_produto` | permanece | `produto_id` | — |
    | `idx_pedido_fornecedor_produto` | permanece | `produto_id` | — |
    | `idx_nf_fornecedor_produto` | permanece | `produto_id` | — |
    | `idx_receb_itens_produto` | permanece | `produto_id` | — |
    | `idx_compras_prog_itens_produto` | permanece | `produto_id` | `deleted_at IS NULL` |
    | `idx_regras_desd_produto_origem` | permanece | `produto_origem_id` | `deleted_at IS NULL` |
    | `idx_regras_desd_produto_destino` | permanece | `produto_destino_id` | `deleted_at IS NULL` |
    | `idx_regras_desd_par_ativo_produto` | **renomear** para `idx_regras_desd_par_ativo` no contract (depois de DROP do índice antigo) | `(produto_origem_id, produto_destino_id)` | `deleted_at IS NULL AND status = 'ativo'` |
14. **Query de produtos:** **não** estender `listarCadastroQuerySchema` (evita `ativoVenda` em outros cadastros). Criar `listarProdutoQuerySchema` em `paginacao.ts`, usado **só** por `produtos.controller.ts`. Booleanos de query **não** usam `z.coerce.boolean()` (`Boolean("false") === true`). Usar o helper literal da Task 6.
15. **Resolução legado→produto:** função SQL temporária no 0035. Ordem: `legado_*` com `deleted_at IS NULL`; se 0 linhas, fallback por `upper(btrim(codigo))` em produto ativo; 0 ou >1 → `RAISE EXCEPTION` com o UUID legado. Preencher **todas** as linhas (inclusive soft-deleted) para o `SET NOT NULL` do contract.
16. **Regras identidade:** preencher `produto_origem_id` / `produto_destino_id` e, se iguais, `deleted_at = now()`, `status = 'inativo'`. Não deixar coluna nova NULL.
17. **Identidade no gerador:** arquivo `disponibilidade.service.ts`, funções `gerarParaCompra`, `recalcularParaCompra`, `projetarImpacto`. Algoritmo = `UNION ALL` de (regras vigentes) + (linha de compra cujo produto tem `ativo_compra AND ativo_venda`), `GROUP BY produto_id`, `SUM`. SQL literal na Task 7.
18. **Seed:** 12 produtos = 11 do `CATALOGO_MVP` + `BOI`. Flags: TZ/DT/PA/BPORCO `ativoVenda=true` e `ativoCompra=true`; BOI só compra; CB/JAC/CBA/FC/CXMIU/CXRABO/CXFIG só venda. Regras seed: só BOI→TZ/DT/PA fator 2. `PARES_IDENTIDADE` apagado.
19. **Backfill também liga flags de compra** em TZ/DT/PA/BPORCO (`UPDATE` explícito) para o gerador funcionar em banco já seedado **antes** de rerodar o seed TS.
20. **Matriz:** o arquivo `2026-07-22-matriz-rastreabilidade-v1.1.md` já tem **41 entradas do protótipo** (39 telas + `/login` + `/`) e **nunca teve** linhas para `/cadastros/itens-compra` nem `/cadastros/itens-comerciais`. T08 **não inventa** linhas para apagar. Atualiza a observação da linha 31 (Produtos) e as menções `item_comercial` nas linhas 10 e 36 + transversal AD-14. O “41 → 39” da AD-15 refere-se a `MENUS_CANONICOS` / `menu-v2.ts` / `ROTAS_CANONICAS`, não ao cabeçalho “41 entradas de rota do protótipo”.
21. **Doc 010:** append-only após §3.4 (texto literal na Task 8). Não reescrever 3.3/3.4.
22. **Permissões RBAC órfãs:** `DELETE` físico nas tabelas `permissoes` / `perfis_permissoes` só para os quatro códigos `ITENS_*` (não são entidade de negócio). Snapshot via `npx tsx scripts/regen-rbac-snapshot.ts` em `app/backend`.
23. **T07 em 6 commits** (um por domínio da Task 7). T02–T06, T08–T11: um commit cada.
24. **Gate local sem abrir PR.** A seção “abertura do PR” deste plano é intencionalmente um no-op. PR = Task 13 após ALP-75 Done.
25. **`rg` de aceite nunca varre `app/backend/src/database/migrations/**`.** SQL e snapshots `0001`–`0033` são história de migrate e **conservam** `item_comercial_id` / `itens_compra`. T05 só varre `src/database/schema`. Seeds (`seed-*.ts`) só precisam ficar limpos **depois** da T06. Comandos literais nas Tasks 5/7 e no Gate local.

---

## Referências do protótipo (Princípio I — por tela)

Protótipo nesta máquina: `$env:ALPHACARNES_PROTOTYPE_PATH` = `D:\Projetos\AlphaCarnes\Projeto\alpha-carnes-prototipo` (o path default `F:\Projetos\alpha-carnes-prototipo` **não** existe aqui). Branch do protótipo: `main`. Se o Monitor estiver noutra máquina, clonar o repo privado e apontar a env.

| Tela / rota da aplicação | Arquivo do protótipo | O que o Worker copia / respeita |
|---|---|---|
| `/cadastros/produtos` (lista, novo, editar, 8 abas) | `src/app/pages/Produtos.tsx` (export `Produtos` ~L633); rota em `src/app/routes.tsx` | DS v3 já absorvido (AD-10). **Não redesenhar.** Não adicionar aba/campo de item comercial/compra. Flags `ativoVenda` / `ativoCompra` já existem no DTO/tela real — manter rótulos atuais, sem a palavra “Marca”. |
| Menu grupo `CADASTROS & REGRAS` | `src/app/components/Layout.tsx` `ALL_NAV_GROUPS` ~L196–207 | **8 itens**, termina em Modelos de Etiqueta. **Não** há Itens de Compra nem Itens Comerciais. Fidelidade = essa ausência. |
| `/cadastros/itens-compra` | **inexistente** no protótipo (menu, `routes.tsx`, breadcrumbs) | 404 App Router. Sem redirect. |
| `/cadastros/itens-comerciais` | **inexistente** | 404. Sem redirect. |
| `/comercial/pedidos` | DS v3 da aplicação + protótipo Pedidos | Rótulo do campo continua **Produto**. Seletor `#produto-novo` permanece. Fonte = `GET /api/cadastros/produtos?status=ativo&ativoVenda=true&pageSize=100`. |
| `/gestao/compras` | DS v3 master-detail (Onda 11) | Seletor = `GET /api/cadastros/produtos?status=ativo&ativoCompra=true&pageSize=100`. |
| `/cadastros/regras-transformacao` (aba desdobramento) | DS v3 da aplicação | Origem/destino são produtos. Grade **sem** linhas TZ→TZ / DT→DT / PA→PA. |
| `/comercial/disponibilidade`, `/comercial/espelho`, `/gestao/overbooking`, `/recebimento/*`, `/recebimento/pesagem-destinacao` | DS v3 já nas telas | Só troca de contrato (`produtoId`). Layout intocado. |

Tokens e cores: paleta DS v3 vigente. Nenhum token novo.

---

## Estrutura de arquivos

### Criar

- `app/backend/src/database/migrations/0034_onda13_catalogo_expand.sql` (+ snapshot/journal)
- `app/backend/src/database/migrations/0035_onda13_catalogo_backfill.sql` (+ journal)
- `app/backend/src/database/migrations/0036_onda13_catalogo_contract.sql` (+ snapshot/journal)
- `app/backend/test/integration/onda13-catalogo-unificacao.e2e-spec.ts`
- `docs/evidencias/onda13-unificacao-catalogo/` (Task 11)

### Apagar (contract T04 / cadastros T06 / shell T09)

- `app/backend/src/database/schema/itens-comerciais.schema.ts`
- `app/backend/src/database/schema/itens-compra.schema.ts`
- `app/backend/src/modules/cadastros/itens-comerciais/` (module, controller, service, dto)
- `app/backend/src/modules/cadastros/itens-compra/` (idem)
- configs `itensCompraConfig` / `itensComerciaisConfig` em `cadastros-config.ts`

### Modificar — schema (T02 ADD, T04 DROP)

- `produtos.schema.ts` — T02 mantém `legado*`; T04 remove `legado*` e os imports de itens
- `disponibilidades-virtuais.schema.ts` — ADD `produtoId`; T04 drop `itemComercialId` + relation
- `pedidos.schema.ts` (`pedidosVendaItens`)
- `adendos-pedido.schema.ts`
- `pendencias-overbooking.schema.ts`
- `pedidos-fornecedor.schema.ts` (`pedidosFornecedorItens`)
- `notas-fiscais-fornecedor.schema.ts` (`notasFiscaisFornecedorItens`)
- `recebimentos.schema.ts` (`recebimentosItens`, `divergenciasRecebimento`)
- `pesagem.schema.ts` (`pecas.itemComercialBaseId` → `produtoBaseId`)
- `transformacoes.schema.ts` (`subitens`)
- `regras-desdobramento.schema.ts` — ADD `produtoOrigemId` / `produtoDestinoId`; T04 drop antigos + CHECK origem≠destino
- `compras-programadas.schema.ts` — **somente** `comprasProgramadasItens`
- `schema/index.ts` — T04 remove exports das duas tabelas

### Modificar — backend cadastros / seed / RBAC

- `produtos.controller.ts`, `produtos.service.ts`, `dto/produto.dto.ts`
- `common/crud/paginacao.ts`
- `app.module.ts`
- `database/seed-catalogo-mvp.ts`, `database/seed-regras-desdobramento-comercial.ts`
- `common/rbac/permissoes.ts`, `menus-canonicos.ts`, `perfil-permissoes.snapshot.json`, `perfil-menus.snapshot.json`
- seed RBAC (`database/seed.ts` ou o arquivo que insere `permissoes`)

### Modificar — backend operacional (T07, 6 commits)

Ver tabela arquivo-a-arquivo na Task 7.

### Modificar — frontend (T09–T10)

Ver tabelas nas Tasks 9 e 10.

### Modificar — docs (T08)

- `docs/superpowers/plans/2026-07-22-matriz-rastreabilidade-v1.1.md` (observações; sem apagar linhas inexistentes)
- `docs/010-modelo-de-dados-conceitual-e-entidades-principais-do-sistema.md` (append)

### Fora de escopo de escrita

- `docs/execucao/DECISOES.md`, `EXECUCAO-STATUS.md`, `GATE-VEREDITOS.md` (Executor/Monitor)
- `landing/**`
- Redesign de Produtos, Pedidos, Compras
- Fechar P11 / campos fiscais NCM
- Convalidar lacuna de Portão 2 da Onda 12

---

## Mapa DoD → teste (1:1)

| # | Invariante (DoD ALP-62) | Teste |
|---|---|---|
| 13.1 | Menu CADASTROS sem Itens Comerciais / Itens de Compra | `menu-v2.test.ts` + `menus-canonicos` `MENUS_CANONICOS.length === 39`; Playwright jornada |
| 13.2 | `/cadastros/itens-comerciais` e `/cadastros/itens-compra` → 404 UI; `POST /itens-comerciais` e `POST /itens-compra` → 404 Nest | `cadastros-diversos.e2e-spec.ts` reduzido a 404; Playwright GET das rotas |
| 13.3 | Pedidos/disponibilidade/pesagem/recebimento/compras/regras usam `produtoId` / `produtoOrigemId` / `produtoDestinoId` | `onda13-catalogo-unificacao.e2e-spec.ts` + type-check; `rg` vazio |
| 13.4 | Seed: BOI `compra_base`; regras BOI→TZ/DT/PA fator 2; zero regra TZ→TZ; um BPORCO com duas flags | `seed-catalogo-mvp.e2e-spec.ts`; `seed-regras-desdobramento-comercial.spec.ts` |
| 13.5 | POST `/produtos` `ativoVenda=true` selecionável em Pedidos sem cadastro paralelo | `produtos.service.spec.ts` + e2e pedido |
| 13.6 | Soft delete / `status=inativo` some dos seletores (filtro GET) | integração 13.6 em `onda13-catalogo-unificacao.e2e-spec.ts` |
| 13.7 | Tabelas `itens_comerciais` / `itens_compra` inexistentes após 0036; `sincronizarLegado` inexistente | e2e `information_schema`; `rg sincronizarLegado` vazio |
| 13.8 | Compra BOI → disp TZ=2, DT=2, PA=2, **sem** linha BOI | `onda13-catalogo-unificacao.e2e-spec.ts` › DoD 13.8 |
| 13.9 | Compra TZ → disp TZ fator 1 (implícita) | idem › DoD 13.9 |
| 13.10 | Compra BPORCO → disp BPORCO fator 1 | idem › DoD 13.10 |
| 13.11 | POST pedido com `itemComercialId` → 400 | `pedidos-onda4.e2e-spec.ts` ou onda13 › DoD 13.11 |
| 13.12 | Pedido TZ reserva a disponibilidade de TZ | onda13 › DoD 13.12 |
| 13.13 | 0034–0036 aplicam em banco seedado sem EXCEPTION | `onda13-catalogo-unificacao.e2e-spec.ts` › migrations |
| 13.14 | Cobertura ≥80% linha e branch nos services tocados | `npm run test:cov` |
| 13.15 | Oito jobs CI verdes **depois** de ALP-75 — não nesta fase de implementação | T13 |
| 13.16 | Nenhum PR aberto antes de ALP-75 Done | Gate local desta onda **não** cria PR |

---

## Task 0 — AD-15 (já feita — não refazer)

[ALP-63](https://linear.app/alphacarnes/issue/ALP-63) Done. Commit `9b09034` no o13. AD-15 na tabela de `DECISOES.md`. Worker **não** toca `docs/execucao/`.

---

## Task 1 — Este plano + Portão 1 (planner / monitor — não é Worker)

Arquivo: este path. Portão 1: skill `$gate-plano` numa **sessão Monitor nova**. Worker só começa T02 com veredito `aprovado` e sha256 pinado.

---

## Task 2 — Migration expand (ALP-65)

**Files:**
- schemas listados em “Modificar — schema” (ADD only)
- `0034_onda13_catalogo_expand.sql` + `meta/_journal.json` + snapshot gerado

**Interfaces:** as 13 colunas abaixo, **NULLABLE**, FK → `produtos.id`. Colunas antigas permanecem `NOT NULL` como hoje.

```
disponibilidades_virtuais.produto_id              uuid NULL REFERENCES produtos(id)
pedidos_venda_itens.produto_id                    uuid NULL REFERENCES produtos(id)
adendos_pedido.produto_id                         uuid NULL REFERENCES produtos(id)
pendencias_overbooking.produto_id                 uuid NULL REFERENCES produtos(id)
pedidos_fornecedor_itens.produto_id               uuid NULL REFERENCES produtos(id)
notas_fiscais_fornecedor_itens.produto_id         uuid NULL REFERENCES produtos(id)
recebimentos_itens.produto_id                     uuid NULL REFERENCES produtos(id)
divergencias_recebimento.produto_id               uuid NULL REFERENCES produtos(id)
pecas.produto_base_id                             uuid NULL REFERENCES produtos(id)
subitens.produto_id                               uuid NULL REFERENCES produtos(id)
regras_desdobramento_comercial.produto_origem_id  uuid NULL REFERENCES produtos(id)
regras_desdobramento_comercial.produto_destino_id uuid NULL REFERENCES produtos(id)
compras_programadas_itens.produto_id              uuid NULL REFERENCES produtos(id)
```

### Steps

- [ ] **TDD:** nenhum teste de serviço nesta task. Aceite = migrate + `drizzle-kit check`.

- [ ] Em cada schema, **adicionar** a coluna nova **ao lado** da antiga. Exemplo literal `disponibilidades-virtuais.schema.ts` (manter `itemComercialId` e `uq_disp_compra_item`):

```ts
produtoId: uuid('produto_id').references(() => produtos.id),
itemComercialId: uuid('item_comercial_id').notNull().references(() => itensComerciais.id),
```

e nos índices do callback, **acrescentar** (não substituir):

```ts
uniqueIndex('uq_disp_compra_produto').on(t.compraProgramadaId, t.produtoId),
index('idx_disp_produto').on(t.produtoId),
```

Importar `produtos` de `./produtos.schema`. Relation nova `produto` pode coexistir com `itemComercial`.

- [ ] `pedidos.schema.ts` (`pedidosVendaItens`): ADD `produtoId` + `uq_pedido_venda_produto_ativo` com `.where(sql`${t.deletedAt} IS NULL`)` + `idx_pedidos_itens_produto`. Manter `uq_pedido_venda_item_comercial_ativo`.

- [ ] `adendos-pedido.schema.ts`: ADD `produtoId` (tabela sem `deleted_at`; sem unique novo).

- [ ] `pendencias-overbooking.schema.ts`: ADD `produtoId` (sem unique novo).

- [ ] `pedidos-fornecedor.schema.ts`: ADD `produtoId` + `uq_pedido_fornecedor_produto` (`deleted_at IS NULL`) + `idx_pedido_fornecedor_produto`.

- [ ] `notas-fiscais-fornecedor.schema.ts`: ADD `produtoId` + `uq_nf_fornecedor_produto` + `idx_nf_fornecedor_produto`.

- [ ] `recebimentos.schema.ts`: ADD `produtoId` em `recebimentosItens` e `divergenciasRecebimento`; `uq_receb_itens_recebimento_produto` + `idx_receb_itens_produto` só em `recebimentosItens`.

- [ ] `pesagem.schema.ts`: ADD `produtoBaseId: uuid('produto_base_id').references(() => produtos.id)` ao lado de `itemComercialBaseId`. Sem unique.

- [ ] `transformacoes.schema.ts`: ADD `produtoId` em `subitens`. Sem unique.

- [ ] `regras-desdobramento.schema.ts`: ADD `produtoOrigemId` / `produtoDestinoId` + os três índices novos da D13. Manter `itemCompraId` / `itemComercialId` e `idx_regras_desd_par_ativo` antigo.

- [ ] `compras-programadas.schema.ts` — **apenas** `comprasProgramadasItens`: ADD `produtoId` + `idx_compras_prog_itens_produto` (`deleted_at IS NULL`). **Não** tocar o cabeçalho.

- [ ] `produtos.schema.ts`: **não alterar** nesta task (`legado*` ficam).

- [ ] Gerar:

```powershell
Set-Location app/backend
npx drizzle-kit generate --name=onda13_catalogo_expand
```

Saída esperada: arquivo novo sob `src/database/migrations/` cujo tag começa com o próximo idx (`0034`). Se o kit emitir outro nome (`0034_xxx.sql`), **renomear** para `0034_onda13_catalogo_expand.sql` e ajustar `_journal.json` `tag` para `0034_onda13_catalogo_expand`. Se o generate criar **DROP** ou remover coluna antiga, **parar e reportar**.

O SQL gerado deve ser equivalente a este esqueleto (nomes de FK do drizzle-kit no padrão `{tabela}_{coluna}_{ref}_id_fk` são aceitos; **nomes de índice** têm de ser os da D12/D13):

```sql
ALTER TABLE "disponibilidades_virtuais" ADD COLUMN "produto_id" uuid;
ALTER TABLE "pedidos_venda_itens" ADD COLUMN "produto_id" uuid;
ALTER TABLE "adendos_pedido" ADD COLUMN "produto_id" uuid;
ALTER TABLE "pendencias_overbooking" ADD COLUMN "produto_id" uuid;
ALTER TABLE "pedidos_fornecedor_itens" ADD COLUMN "produto_id" uuid;
ALTER TABLE "notas_fiscais_fornecedor_itens" ADD COLUMN "produto_id" uuid;
ALTER TABLE "recebimentos_itens" ADD COLUMN "produto_id" uuid;
ALTER TABLE "divergencias_recebimento" ADD COLUMN "produto_id" uuid;
ALTER TABLE "pecas" ADD COLUMN "produto_base_id" uuid;
ALTER TABLE "subitens" ADD COLUMN "produto_id" uuid;
ALTER TABLE "regras_desdobramento_comercial" ADD COLUMN "produto_origem_id" uuid;
ALTER TABLE "regras_desdobramento_comercial" ADD COLUMN "produto_destino_id" uuid;
ALTER TABLE "compras_programadas_itens" ADD COLUMN "produto_id" uuid;
-- + 13 FKs para produtos(id)
-- + 5 unique indexes novos + 9 indexes novos (D12/D13)
```

- [ ] `npx drizzle-kit check` — sem drift.

- [ ] `npm run db:migrate` aplica 0034 em banco vazio e em banco com seed.

- [ ] `rg "item_comercial_id|item_compra_id|item_comercial_base_id" app/backend/src/database/schema` ainda casa (colunas antigas intactas).

**Commit:** `feat(onda13): expand 0034 adiciona 13 FKs produto_id nullable`

---

## Task 3 — Migration backfill (ALP-66)

**Files:** `0035_onda13_catalogo_backfill.sql` (+ journal se `--custom`)

**Serialidade:** só com 0034 aplicada.

### Steps

- [ ] Criar o arquivo (corpo **literal** abaixo). Se o journal exigir entrada: `npx drizzle-kit generate --custom --name=onda13_catalogo_backfill` e substituir o corpo.

```sql
-- 0035_onda13_catalogo_backfill.sql
-- DML fail-closed (AD-15 / Princípio VII). Uma transação (drizzle já envolve).

-- 1) Produto BOI a partir do item de compra BOI, se ainda não existir.
DO $$
DECLARE
  v_count int;
  v_item record;
BEGIN
  SELECT count(*) INTO v_count
  FROM itens_compra
  WHERE deleted_at IS NULL AND upper(btrim(codigo)) = 'BOI';
  IF v_count > 1 THEN
    RAISE EXCEPTION 'Onda 13 backfill: mais de um itens_compra.codigo=BOI ativo';
  END IF;
  IF v_count = 1 THEN
    SELECT * INTO v_item
    FROM itens_compra
    WHERE deleted_at IS NULL AND upper(btrim(codigo)) = 'BOI';
    IF NOT EXISTS (
      SELECT 1 FROM produtos p
      WHERE p.deleted_at IS NULL
        AND (p.legado_item_compra_id = v_item.id OR upper(btrim(p.codigo)) = 'BOI')
    ) THEN
      INSERT INTO produtos (
        codigo, nome, tipo_operacional, unidade_pedido, unidade_preco,
        exige_peso, ativo_venda, ativo_compra, status, legado_item_compra_id,
        atributos_json
      ) VALUES (
        'BOI',
        COALESCE(nullif(btrim(v_item.descricao), ''), 'BOI CASADO'),
        'compra_base',
        v_item.unidade_compra,
        'kg',
        true,
        false,
        true,
        v_item.status,
        v_item.id,
        '{"origemUnificacao":"AD-15","legado":"itens_compra"}'::jsonb
      );
    END IF;
  END IF;
END $$;

-- 2) Merge BANDA DE PORCO → produto BPORCO + flags de compráveis avulsos.
DO $$
DECLARE
  v_banda uuid;
  v_n_banda int;
  v_bporco uuid;
  v_n_bporco int;
BEGIN
  SELECT count(*) INTO v_n_banda
  FROM itens_compra
  WHERE deleted_at IS NULL AND upper(btrim(codigo)) = 'BANDA DE PORCO';
  IF v_n_banda > 1 THEN
    RAISE EXCEPTION 'Onda 13 backfill: mais de um itens_compra BANDA DE PORCO ativo';
  END IF;
  SELECT id INTO v_banda
  FROM itens_compra
  WHERE deleted_at IS NULL AND upper(btrim(codigo)) = 'BANDA DE PORCO';

  SELECT count(*) INTO v_n_bporco
  FROM produtos
  WHERE deleted_at IS NULL AND upper(btrim(codigo)) = 'BPORCO';
  IF v_n_bporco > 1 THEN
    RAISE EXCEPTION 'Onda 13 backfill: mais de um produtos.codigo=BPORCO ativo';
  END IF;
  SELECT id INTO v_bporco
  FROM produtos
  WHERE deleted_at IS NULL AND upper(btrim(codigo)) = 'BPORCO';

  IF v_banda IS NOT NULL AND v_bporco IS NULL THEN
    RAISE EXCEPTION 'Onda 13 backfill: item BANDA DE PORCO=% sem produto BPORCO', v_banda;
  END IF;
  IF v_bporco IS NOT NULL THEN
    UPDATE produtos
    SET ativo_compra = true,
        legado_item_compra_id = COALESCE(legado_item_compra_id, v_banda),
        updated_at = now()
    WHERE id = v_bporco;
  END IF;
END $$;

UPDATE produtos
SET ativo_compra = true, updated_at = now()
WHERE deleted_at IS NULL
  AND upper(btrim(codigo)) IN ('TZ', 'DT', 'PA', 'BPORCO');

-- 3) Funções de resolução (0 ou >1 → EXCEPTION).
CREATE OR REPLACE FUNCTION onda13_resolver_produto_comercial(p_item uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
  v_n int;
  v_codigo text;
BEGIN
  IF p_item IS NULL THEN
    RAISE EXCEPTION 'Onda 13 backfill: item_comercial_id nulo';
  END IF;
  SELECT count(*), min(id) INTO v_n, v_id
  FROM produtos
  WHERE deleted_at IS NULL AND legado_item_comercial_id = p_item;
  IF v_n = 1 THEN
    RETURN v_id;
  END IF;
  IF v_n > 1 THEN
    RAISE EXCEPTION 'Onda 13 backfill: % produtos para legado_item_comercial_id=%', v_n, p_item;
  END IF;
  SELECT codigo INTO v_codigo FROM itens_comerciais WHERE id = p_item;
  IF v_codigo IS NULL THEN
    RAISE EXCEPTION 'Onda 13 backfill: itens_comerciais.id=% inexistente', p_item;
  END IF;
  SELECT count(*), min(id) INTO v_n, v_id
  FROM produtos
  WHERE deleted_at IS NULL AND upper(btrim(codigo)) = upper(btrim(v_codigo));
  IF v_n = 1 THEN
    RETURN v_id;
  END IF;
  RAISE EXCEPTION 'Onda 13 backfill: fallback codigo=% do item comercial % retornou % produtos', v_codigo, p_item, v_n;
END;
$$;

CREATE OR REPLACE FUNCTION onda13_resolver_produto_compra(p_item uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
  v_n int;
  v_codigo text;
BEGIN
  IF p_item IS NULL THEN
    RAISE EXCEPTION 'Onda 13 backfill: item_compra_id nulo';
  END IF;
  SELECT count(*), min(id) INTO v_n, v_id
  FROM produtos
  WHERE deleted_at IS NULL AND legado_item_compra_id = p_item;
  IF v_n = 1 THEN
    RETURN v_id;
  END IF;
  IF v_n > 1 THEN
    RAISE EXCEPTION 'Onda 13 backfill: % produtos para legado_item_compra_id=%', v_n, p_item;
  END IF;
  SELECT codigo INTO v_codigo FROM itens_compra WHERE id = p_item;
  IF v_codigo IS NULL THEN
    RAISE EXCEPTION 'Onda 13 backfill: itens_compra.id=% inexistente', p_item;
  END IF;
  -- BANDA DE PORCO cai em BPORCO pelo passo 2 (legado_item_compra_id). Se ainda
  -- não bateu, tenta o código comercial sobrevivente.
  IF upper(btrim(v_codigo)) = 'BANDA DE PORCO' THEN
    SELECT count(*), min(id) INTO v_n, v_id
    FROM produtos
    WHERE deleted_at IS NULL AND upper(btrim(codigo)) = 'BPORCO';
  ELSE
    SELECT count(*), min(id) INTO v_n, v_id
    FROM produtos
    WHERE deleted_at IS NULL AND upper(btrim(codigo)) = upper(btrim(v_codigo));
  END IF;
  IF v_n = 1 THEN
    RETURN v_id;
  END IF;
  RAISE EXCEPTION 'Onda 13 backfill: fallback codigo=% do item compra % retornou % produtos', v_codigo, p_item, v_n;
END;
$$;

-- 4) Repontar FKs (todas as linhas, inclusive deleted).
UPDATE disponibilidades_virtuais t SET produto_id = onda13_resolver_produto_comercial(t.item_comercial_id);
UPDATE pedidos_venda_itens t SET produto_id = onda13_resolver_produto_comercial(t.item_comercial_id);
UPDATE adendos_pedido t SET produto_id = onda13_resolver_produto_comercial(t.item_comercial_id);
UPDATE pendencias_overbooking t SET produto_id = onda13_resolver_produto_comercial(t.item_comercial_id);
UPDATE pedidos_fornecedor_itens t SET produto_id = onda13_resolver_produto_comercial(t.item_comercial_id);
UPDATE notas_fiscais_fornecedor_itens t SET produto_id = onda13_resolver_produto_comercial(t.item_comercial_id);
UPDATE recebimentos_itens t SET produto_id = onda13_resolver_produto_comercial(t.item_comercial_id);
UPDATE divergencias_recebimento t SET produto_id = onda13_resolver_produto_comercial(t.item_comercial_id);
UPDATE pecas t SET produto_base_id = onda13_resolver_produto_comercial(t.item_comercial_base_id);
UPDATE subitens t SET produto_id = onda13_resolver_produto_comercial(t.item_comercial_id);
UPDATE compras_programadas_itens t SET produto_id = onda13_resolver_produto_compra(t.item_compra_id);
UPDATE regras_desdobramento_comercial t
SET produto_origem_id = onda13_resolver_produto_compra(t.item_compra_id),
    produto_destino_id = onda13_resolver_produto_comercial(t.item_comercial_id);

-- 5) Identidade 1:1: preencher e soft-delete (auditoria).
UPDATE regras_desdobramento_comercial
SET deleted_at = COALESCE(deleted_at, now()),
    status = 'inativo',
    updated_at = now()
WHERE produto_origem_id = produto_destino_id;

-- 6) Asserts — qualquer count > 0 aborta.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM disponibilidades_virtuais WHERE produto_id IS NULL) THEN
    RAISE EXCEPTION 'Onda 13 backfill: disponibilidades_virtuais.produto_id NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM pedidos_venda_itens WHERE produto_id IS NULL) THEN
    RAISE EXCEPTION 'Onda 13 backfill: pedidos_venda_itens.produto_id NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM adendos_pedido WHERE produto_id IS NULL) THEN
    RAISE EXCEPTION 'Onda 13 backfill: adendos_pedido.produto_id NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM pendencias_overbooking WHERE produto_id IS NULL) THEN
    RAISE EXCEPTION 'Onda 13 backfill: pendencias_overbooking.produto_id NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM pedidos_fornecedor_itens WHERE produto_id IS NULL) THEN
    RAISE EXCEPTION 'Onda 13 backfill: pedidos_fornecedor_itens.produto_id NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM notas_fiscais_fornecedor_itens WHERE produto_id IS NULL) THEN
    RAISE EXCEPTION 'Onda 13 backfill: notas_fiscais_fornecedor_itens.produto_id NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM recebimentos_itens WHERE produto_id IS NULL) THEN
    RAISE EXCEPTION 'Onda 13 backfill: recebimentos_itens.produto_id NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM divergencias_recebimento WHERE produto_id IS NULL) THEN
    RAISE EXCEPTION 'Onda 13 backfill: divergencias_recebimento.produto_id NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM pecas WHERE produto_base_id IS NULL) THEN
    RAISE EXCEPTION 'Onda 13 backfill: pecas.produto_base_id NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM subitens WHERE produto_id IS NULL) THEN
    RAISE EXCEPTION 'Onda 13 backfill: subitens.produto_id NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM compras_programadas_itens WHERE produto_id IS NULL) THEN
    RAISE EXCEPTION 'Onda 13 backfill: compras_programadas_itens.produto_id NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM regras_desdobramento_comercial
    WHERE produto_origem_id IS NULL OR produto_destino_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Onda 13 backfill: regras origem/destino NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM regras_desdobramento_comercial
    WHERE deleted_at IS NULL AND produto_origem_id = produto_destino_id
  ) THEN
    RAISE EXCEPTION 'Onda 13 backfill: regra ativa com origem=destino';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM produtos WHERE deleted_at IS NULL AND upper(btrim(codigo)) = 'BOI'
      AND tipo_operacional = 'compra_base' AND ativo_compra AND NOT ativo_venda
  ) AND EXISTS (
    SELECT 1 FROM itens_compra WHERE deleted_at IS NULL AND upper(btrim(codigo)) = 'BOI'
  ) THEN
    RAISE EXCEPTION 'Onda 13 backfill: produto BOI ausente após insert';
  END IF;
END $$;

DROP FUNCTION onda13_resolver_produto_comercial(uuid);
DROP FUNCTION onda13_resolver_produto_compra(uuid);
```

- [ ] `npm run db:migrate` em banco seedado (`db:seed` + catálogo MVP + regras) sem EXCEPTION.
- [ ] Verificar: um `BPORCO`; `BOI` presente se o item existia; `SELECT count(*) FROM regras_desdobramento_comercial WHERE deleted_at IS NULL AND produto_origem_id = produto_destino_id` = 0.

**Commit:** `feat(onda13): backfill 0035 mapeia legado para produtos`

---

## Task 4 — Migration contract (ALP-67)

**Files:** schemas (DROP colunas/arquivos), `0036_onda13_catalogo_contract.sql`, journal/snapshot.

### Steps

- [ ] No Drizzle, **agora** remover colunas antigas e arquivos:

**`produtos.schema.ts`:** apagar `legadoItemComercialId`, `legadoItemCompraId` e os imports de `itens-comerciais.schema` / `itens-compra.schema`.

**Demais schemas:** remover `itemComercialId` / `itemCompraId` / `itemComercialBaseId` e relations para as tabelas extintas. Renomear TS:
- `itemComercialId` → `produtoId` (já adicionado; a coluna antiga some)
- `itemComercialBaseId` → `produtoBaseId`
- `itemCompraId` em `comprasProgramadasItens` → `produtoId`
- regras: `itemCompraId`/`itemComercialId` somem; ficam `produtoOrigemId` / `produtoDestinoId`

Tornar as 13 colunas `.notNull()`.

Unique antigos saem; únicos novos ficam. `idx_disp_item_comercial` e equivalentes antigos saem.

Em `regras-desdobramento.schema.ts` adicionar:

```ts
check(
  'chk_regras_desd_origem_destino_distintos',
  sql`${t.deletedAt} IS NOT NULL OR ${t.produtoOrigemId} <> ${t.produtoDestinoId}`,
),
```

O CHECK **não** pode ser só `origem <> destino`: a T03 preenche `produto_origem_id = produto_destino_id` e só faz soft-delete (`PARES_IDENTIDADE`). O Postgres avalia CHECK também em linhas com `deleted_at`. Sem o predicado `deleted_at IS NOT NULL OR …`, a 0036 aborta em banco seedado (DoD 13.13). **Não** dar DELETE físico nessas regras.

e, no contract SQL **depois** de DROP do índice antigo:

```sql
ALTER INDEX "idx_regras_desd_par_ativo_produto" RENAME TO "idx_regras_desd_par_ativo";
```

(Se o generate já emitir o índice final com o nome antigo porque o schema usa `idx_regras_desd_par_ativo` nas colunas novas, **não** duplicar o rename. Preferência: no schema T04 o índice das colunas novas chama-se `idx_regras_desd_par_ativo` — o generate fará DROP+CREATE. Isso é aceito.)

**`schema/index.ts`:** apagar

```ts
export * from './itens-compra.schema';
export * from './itens-comerciais.schema';
```

**Apagar arquivos:** `itens-comerciais.schema.ts`, `itens-compra.schema.ts`.

- [ ] `npx drizzle-kit generate --name=onda13_catalogo_contract` → renomear para `0036_onda13_catalogo_contract.sql`.

- [ ] No SQL gerado, **inserir no topo** (antes de qualquer DROP TABLE) a guarda e o CHECK se o generate não os emitir:

```sql
ALTER TABLE "regras_desdobramento_comercial"
  ADD CONSTRAINT "chk_regras_desd_origem_destino_distintos"
  CHECK (deleted_at IS NOT NULL OR produto_origem_id <> produto_destino_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name IN ('itens_comerciais', 'itens_compra')
  ) THEN
    RAISE EXCEPTION 'Onda 13 contract: ainda há FK para itens_comerciais/itens_compra';
  END IF;
END $$;
```

Ordem efetiva do arquivo (generate + esses inserts): SET NOT NULL nas 13 → CHECK → DROP índices/FKs/colunas antigas → DROP `produtos.legado_*` → guarda → `DROP TABLE "itens_comerciais"` → `DROP TABLE "itens_compra"`.

- [ ] Anexar no final do SQL, como comentário (não é down):

```sql
-- Rollback desta migration: restaurar backup Postgres capturado ANTES da 0036.
-- Recriar as duas tabelas vazias NÃO é aceitável (perda de dados / AD-15).
```

- [ ] `npx drizzle-kit check` limpo.
- [ ] Após migrate: `\d itens_comerciais` / `\d itens_compra` → não existem.

**Commit:** `feat(onda13): contract 0036 extingue itens comerciais e itens de compra`

---

## Task 5 — Verificação Drizzle (ALP-68)

**Não editar schema.** Se falhar, a correção é T04.

```powershell
Set-Location app/backend
rg "itensComerciais|itensCompra|itens-comerciais|itens-compra|legadoItem" src/database/schema
npx drizzle-kit check
```

Saída esperada: `rg` vazio **só nesses paths** (schema pós-contract). `src/database/migrations/**` **não** entra neste `rg` (D25). `seed-*.ts` ainda podem citar legado — isso é T06, não falha da T05. `check` sem drift. Services quebrados são esperados até T06/T07 — **não corrigir** aqui.

**Commit:** `test(onda13): verifica drizzle sem legado após contract` — só se houver arquivo de evidência/teste de journal. Se o diff for vazio, **não** criar commit vazio; registrar no relatório “T05 ok, diff vazio” e seguir.

---

## Task 6 — Backend cadastros, seeds, `sincronizarLegado` (ALP-69)

**Files:**
- apagar `modules/cadastros/itens-comerciais/**`, `modules/cadastros/itens-compra/**`
- `app.module.ts` — remover imports/registros
- `produtos.service.ts` — apagar `sincronizarLegado`, `sincronizarItemComercial`, `sincronizarItemCompra` e qualquer write em tabelas extintas
- `produtos.controller.ts` + `paginacao.ts`
- `seed-catalogo-mvp.ts`, `seed-regras-desdobramento-comercial.ts`
- `produtos.service.spec.ts`, `cadastros-f7.e2e-spec.ts`, `cadastros-diversos.e2e-spec.ts`, `seed-catalogo-mvp.e2e-spec.ts`, `seed-regras-desdobramento-comercial.spec.ts`

### Query schema (literal)

Em `paginacao.ts`, **depois** de `listarCadastroQuerySchema`:

```ts
const queryFlagOpcional = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === true || v === 'true') return true;
    return false;
  });

export const listarProdutoQuerySchema = listarCadastroQuerySchema.extend({
  ativoVenda: queryFlagOpcional,
  ativoCompra: queryFlagOpcional,
});

export type ListarProdutoQuery = z.infer<typeof listarProdutoQuerySchema>;
```

`produtos.controller.ts` troca `listarCadastroQuerySchema` / `ListarCadastroQuery` por `listarProdutoQuerySchema` / `ListarProdutoQuery`.

`ProdutosService.listar` recebe `ListarProdutoQuery` e, se o flag veio, aplica `eq(produtos.ativoVenda, query.ativoVenda)` / `eq(produtos.ativoCompra, query.ativoCompra)`.

### Seed catálogo — só `produtos`

Apagar todo insert/update em `itensComerciais`. `CATALOGO_MVP` ganha BOI e flags. Substituir o array e o loop:

```ts
const CATALOGO_MVP = [
  { codigo: 'BOI',    nome: 'BOI CASADO',            unidadePedido: UNIDADE_PECA, unidadePreco: 'kg',      tipo: 'compra_base',           origemTransformacao: false, saidaTransformacao: false, passaDesossa: false, ativoVenda: false, ativoCompra: true },
  { codigo: 'TZ',     nome: 'Traseiro Bovino',       unidadePedido: UNIDADE_PECA, unidadePreco: 'kg',      tipo: 'peca_inteira_pesavel',  origemTransformacao: true,  saidaTransformacao: false, passaDesossa: true,  ativoVenda: true,  ativoCompra: true },
  { codigo: 'DT',     nome: 'Dianteiro Bovino',      unidadePedido: UNIDADE_PECA, unidadePreco: 'kg',      tipo: 'peca_inteira_pesavel',  origemTransformacao: false, saidaTransformacao: false, passaDesossa: false, ativoVenda: true,  ativoCompra: true },
  { codigo: 'PA',     nome: 'Ponta de Agulha',       unidadePedido: UNIDADE_PECA, unidadePreco: 'kg',      tipo: 'peca_inteira_pesavel',  origemTransformacao: false, saidaTransformacao: false, passaDesossa: false, ativoVenda: true,  ativoCompra: true },
  { codigo: 'BPORCO', nome: 'Banda de Porco',        unidadePedido: UNIDADE_PECA, unidadePreco: 'kg',      tipo: 'peca_inteira_pesavel',  origemTransformacao: false, saidaTransformacao: false, passaDesossa: false, ativoVenda: true,  ativoCompra: true },
  { codigo: 'CB',     nome: 'Coxão-bola',            unidadePedido: UNIDADE_PECA, unidadePreco: 'kg',      tipo: 'derivado_desossa',      origemTransformacao: false, saidaTransformacao: true,  passaDesossa: true,  ativoVenda: true,  ativoCompra: false },
  { codigo: 'JAC',    nome: 'Jacaré',                unidadePedido: UNIDADE_PECA, unidadePreco: 'kg',      tipo: 'derivado_desossa',      origemTransformacao: false, saidaTransformacao: true,  passaDesossa: true,  ativoVenda: true,  ativoCompra: false },
  { codigo: 'CBA',    nome: 'Coxão-bola c/ alcatra', unidadePedido: UNIDADE_PECA, unidadePreco: 'kg',      tipo: 'derivado_desossa',      origemTransformacao: false, saidaTransformacao: true,  passaDesossa: true,  ativoVenda: true,  ativoCompra: false },
  { codigo: 'FC',     nome: 'Filé curto',            unidadePedido: UNIDADE_PECA, unidadePreco: 'kg',      tipo: 'derivado_desossa',      origemTransformacao: false, saidaTransformacao: true,  passaDesossa: true,  ativoVenda: true,  ativoCompra: false },
  { codigo: 'CXMIU',  nome: 'Caixa de Miúdos',       unidadePedido: UNIDADE_PECA, unidadePreco: 'unidade', tipo: 'entrada_unidade',       origemTransformacao: false, saidaTransformacao: false, passaDesossa: false, ativoVenda: true,  ativoCompra: false },
  { codigo: 'CXRABO', nome: 'Caixa de Rabo',         unidadePedido: UNIDADE_PECA, unidadePreco: 'unidade', tipo: 'entrada_unidade',       origemTransformacao: false, saidaTransformacao: false, passaDesossa: false, ativoVenda: true,  ativoCompra: false },
  { codigo: 'CXFIG',  nome: 'Caixa de Fígado',       unidadePedido: UNIDADE_PECA, unidadePreco: 'unidade', tipo: 'entrada_unidade',       origemTransformacao: false, saidaTransformacao: false, passaDesossa: false, ativoVenda: true,  ativoCompra: false },
] as const;
```

Insert/update **somente** em `produtos`, com `ativoVenda` / `ativoCompra` / `tipoOperacional`. Sem `legado*`. Manter `atributosJson: { provisorio: true, pendencia: 'P11', origem: 'prototipo_v1.1' }` (P11 aberta). BOI pode usar `atributosJson: { origemUnificacao: 'AD-15', legado: 'itens_compra', provisorio: true, pendencia: 'P11' }`.

**12 produtos.** Não 11.

### Seed regras

- Resolver por `produtos.codigo` (`produtos` + `isNull(deletedAt)`).
- Upsert só `DESDOBRAMENTO_BOI` (BOI→TZ/DT/PA fator 2) usando `produtoOrigemId` / `produtoDestinoId`.
- **Apagar** `PARES_IDENTIDADE` e o loop.
- `garantirItemCompraBoi` → `garantirProdutoBoi` idempotente (o catálogo MVP já inseriu; se faltar, insert igual ao do array).
- Soft-delete qualquer regra ativa com origem=destino que ainda exista (`deleted_at = now()`, `status='inativo'`).
- `ITENS_COMPRA_POR_UNIDADE` some; não há mais `itens_compra` para reconciliar.

### Testes desta task

- `produtos.service.spec.ts`: apagar os 4 casos `sincronizarLegado`. Entrar: criar com `ativoVenda` não insere em outra tabela (mock do `tx.insert` só em `produtos`); `listar` com `ativoVenda: true` exclui BOI; `ativoVenda: false` via query string `'false'` **não** vira `true`.
- `cadastros-diversos.e2e-spec.ts`: suítes CRUD itens → um `it` cada `POST /itens-comerciais` e `POST /itens-compra` espera 404.
- `seed-catalogo-mvp.e2e-spec.ts`: 12 códigos; BOI flags; BPORCO duas flags; 1 linha por código.

**Commit:** `feat(onda13): produtos único módulo de catálogo e seed BOI/BPORCO`

---

## Task 7 — Backend operacional (ALP-70)

**Regra de substituição (sem exceção):**

| Antes | Depois |
|---|---|
| `itemComercialId` em DTO/JSON/evento | `produtoId` |
| `itemComercialBaseId` | `produtoBaseId` |
| `itemCompraId` | `produtoId` (compras itens + simulação) |
| `itemCompraId` + `itemComercialId` em regra | `produtoOrigemId` + `produtoDestinoId` |
| join `itensComerciais` | join `produtos` |
| `ic.descricao` | `produtos.nome` |
| `ic.codigo` | `produtos.codigo` |
| `ic.unidadeComercial` | `produtos.unidadePedido` |
| `legadoItemComercialId` / `legadoItemCompraId` | apagar; usar `produtos.id` |

DTOs de mutação que hoje carregam o campo antigo ganham `.strict()` (Zod 4 rejeita chave desconhecida → 400). `createPedidoSchema`, `incluirItemSchema`, `itemCompraSchema` de compras, `create`/`update` de regra, adendo, pesagem (`itemComercialBaseId`→`produtoBaseId`), subitem.

### Identidade 1:1 — SQL literal em `disponibilidade.service.ts`

Substituir o `INSERT` de `gerarParaCompra` (hoje L76–100) por:

```ts
const inseridas = await tx.execute<{
  id: string;
  produto_id: string;
  quantidade_total_gerada: string;
}>(sql`
  INSERT INTO disponibilidades_virtuais
    (compra_programada_id, operacao_id, produto_id,
     quantidade_total_gerada, quantidade_reservada, quantidade_disponivel, status)
  SELECT
    ${compra.id},
    ${compra.operacaoId},
    x.produto_id,
    SUM(x.quantidade),
    0,
    SUM(x.quantidade),
    'gerada'
  FROM (
    SELECT r.produto_destino_id AS produto_id,
           (r.fator_quantidade * cpi.quantidade_comprada) AS quantidade
    FROM compras_programadas_itens cpi
    JOIN regras_desdobramento_comercial r
      ON r.produto_origem_id = cpi.produto_id
     AND r.deleted_at IS NULL
     AND r.status = 'ativo'
     AND r.vigencia_inicio <= now()
     AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= now())
    WHERE cpi.compra_programada_id = ${compra.id}
      AND cpi.deleted_at IS NULL
    UNION ALL
    SELECT cpi.produto_id AS produto_id,
           cpi.quantidade_comprada AS quantidade
    FROM compras_programadas_itens cpi
    JOIN produtos p ON p.id = cpi.produto_id
     AND p.deleted_at IS NULL
     AND p.ativo_venda = true
     AND p.ativo_compra = true
    WHERE cpi.compra_programada_id = ${compra.id}
      AND cpi.deleted_at IS NULL
  ) x
  GROUP BY x.produto_id
  ON CONFLICT (compra_programada_id, produto_id) DO NOTHING
  RETURNING id, produto_id, quantidade_total_gerada
`);
```

Mapear retorno para `{ id, produtoId, quantidadeTotalGerada }`.

`recalcularParaCompra` — substituir a CTE `projecao` + `UPDATE` (hoje L331–356) por:

```ts
    const atualizadas = await tx.execute<{
      id: string; produto_id: string;
      quantidade_total_gerada: string; quantidade_reservada: string;
      quantidade_disponivel: string; status: string;
    }>(sql`
    WITH projecao AS (
      SELECT x.produto_id, SUM(x.quantidade) AS gerada
      FROM (
        SELECT r.produto_destino_id AS produto_id,
               (r.fator_quantidade * cpi.quantidade_comprada) AS quantidade
        FROM compras_programadas_itens cpi
        JOIN regras_desdobramento_comercial r
          ON r.produto_origem_id = cpi.produto_id
         AND r.deleted_at IS NULL AND r.status = 'ativo'
         AND r.vigencia_inicio <= now()
         AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= now())
        WHERE cpi.compra_programada_id = ${compra.id} AND cpi.deleted_at IS NULL
        UNION ALL
        SELECT cpi.produto_id AS produto_id,
               cpi.quantidade_comprada AS quantidade
        FROM compras_programadas_itens cpi
        JOIN produtos p ON p.id = cpi.produto_id
         AND p.deleted_at IS NULL
         AND p.ativo_venda = true
         AND p.ativo_compra = true
        WHERE cpi.compra_programada_id = ${compra.id} AND cpi.deleted_at IS NULL
      ) x
      GROUP BY x.produto_id
    )
    UPDATE disponibilidades_virtuais dv
       SET quantidade_total_gerada = p.gerada,
           quantidade_disponivel   = GREATEST(0, p.gerada - dv.quantidade_reservada),
           status = CASE
             WHEN dv.quantidade_reservada = 0 THEN 'gerada'
             WHEN GREATEST(0, p.gerada - dv.quantidade_reservada) = 0 THEN 'esgotada'
             ELSE 'parcialmente_reservada'
           END
      FROM projecao p
     WHERE dv.compra_programada_id = ${compra.id}
       AND dv.produto_id = p.produto_id
    RETURNING dv.id, dv.produto_id, dv.quantidade_total_gerada,
              dv.quantidade_reservada, dv.quantidade_disponivel, dv.status
  `);
```

`projetarImpacto` — `simulacao` é `Map<produtoId, qtd>`. Substituir `overrideSql` + query (hoje L251–288) por:

```ts
    const overrideSql = overrides.length
      ? sql`(VALUES ${sql.join(
        overrides.map(([produtoId, qtd]) => sql`(${produtoId}::uuid, ${qtd}::numeric)`),
        sql`, `,
      )}) AS o(produto_id, quantidade)`
      : sql`(SELECT NULL::uuid AS produto_id, NULL::numeric AS quantidade WHERE false) AS o`;

    const linhas = await tx.execute<{
      produto_id: string; codigo: string; nome: string;
      gerada_atual: string; gerada_projetada: string;
      reservada: string; saldo_atual: string;
    }>(sql`
    WITH projecao AS (
      SELECT x.produto_id, SUM(x.quantidade) AS gerada_projetada
      FROM (
        SELECT r.produto_destino_id AS produto_id,
               (r.fator_quantidade * COALESCE(o.quantidade, cpi.quantidade_comprada)) AS quantidade
        FROM compras_programadas_itens cpi
        JOIN regras_desdobramento_comercial r
          ON r.produto_origem_id = cpi.produto_id
         AND r.deleted_at IS NULL AND r.status = 'ativo'
         AND r.vigencia_inicio <= now()
         AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= now())
        LEFT JOIN ${overrideSql} ON o.produto_id = cpi.produto_id
        WHERE cpi.compra_programada_id = ${compraId} AND cpi.deleted_at IS NULL
        UNION ALL
        SELECT cpi.produto_id AS produto_id,
               COALESCE(o.quantidade, cpi.quantidade_comprada) AS quantidade
        FROM compras_programadas_itens cpi
        JOIN produtos p ON p.id = cpi.produto_id
         AND p.deleted_at IS NULL
         AND p.ativo_venda = true
         AND p.ativo_compra = true
        LEFT JOIN ${overrideSql} ON o.produto_id = cpi.produto_id
        WHERE cpi.compra_programada_id = ${compraId} AND cpi.deleted_at IS NULL
      ) x
      GROUP BY x.produto_id
    )
    SELECT p.produto_id,
           pr.codigo, pr.nome AS nome,
           COALESCE(dv.quantidade_total_gerada, 0)::text AS gerada_atual,
           p.gerada_projetada::text                      AS gerada_projetada,
           COALESCE(dv.quantidade_reservada, 0)::text    AS reservada,
           COALESCE(dv.quantidade_disponivel, 0)::text   AS saldo_atual
    FROM projecao p
    JOIN produtos pr ON pr.id = p.produto_id
    LEFT JOIN disponibilidades_virtuais dv
      ON dv.compra_programada_id = ${compraId} AND dv.produto_id = p.produto_id
    ORDER BY pr.codigo
  `);
```

Mapear retorno: `produtoId` / `codigo` / `descricao: l.nome` (o DTO `ItemImpacto` hoje expõe `descricao`; preencher com `produtos.nome`). Trocar `itemComercialId` no objeto retornado por `produtoId`.

`aplicarRecebimentoDelta` / `listarPedidosEmRisco` / `listarEsperadoDaCompra`: `item_comercial_id` → `produto_id` em SQL e params. `listarPorCompra` / `listarAgregado`: `itemComercialId` → `produtoId` no select/groupBy/orderBy.

`ON CONFLICT` alvo = unique `uq_disp_compra_produto` (colunas `compra_programada_id, produto_id`).

### Arquivo a arquivo (src) — ownership por commit

**Commit 7a — desdobramento / compras**  
`regras-desdobramento.service.ts`, `regras-desdobramento.controller.ts`, `dto/regra-desdobramento.dto.ts`, `compras-programadas.service.ts`, `dto/compra-programada.dto.ts`  
(`itemCompraId` da linha de compra → `produtoId`; simulação `<produtoId>:<qtd>`.)

**Commit 7b — comercial**  
`disponibilidade.service.ts`, `disponibilidade.controller.ts` (param `:itemComercialId` → `:produtoId`), `mapa.service.ts`, `dto/mapa.dto.ts`, `espelho.service.ts`, `dto/espelho.dto.ts`, `overbooking.service.ts`, `pedidos.service.ts`, `dto/pedido.dto.ts`, `adendos.service.ts`, `dto/adendo.dto.ts`, `overbooking-challenge.exception.ts`

**Commit 7c — recebimento**  
`recebimento.service.ts`, `recebimento-metadados.helper.ts` (corpo literal abaixo), `conferencia.service.ts`, `pedido-fornecedor.service.ts`, `nota-fiscal-fornecedor.persistence.ts`, `divergencia-recebimento.service.ts`, `dto/recebimento.dto.ts`, `dto/pedido-fornecedor.dto.ts`

#### `recebimento-metadados.helper.ts` — substituição literal

Apagar imports de `itensComerciais` / `itensCompra`. Importar `alias` de `drizzle-orm/pg-core`. `calcularProgressoBalanca` **não muda**. As três funções abaixo substituem as atuais por completo. **Proibido** `?? true` / default silencioso de `passaBalanca`.

```ts
export interface MetadadoItemPrevisto {
  produtoId: string;
  origemDescricao: string;
  unidadeEsperada: string;
  requerBalanca: boolean;
}

export async function resolverMetadadosItensPrevistos(
  tx: Tx,
  compraProgramadaId: string,
  numeroInterno: string | null,
  produtoIds: string[],
): Promise<Map<string, MetadadoItemPrevisto>> {
  const mapa = new Map<string, MetadadoItemPrevisto>();
  if (produtoIds.length === 0) return mapa;

  const pc = numeroInterno ?? 'Compra';

  const encontrados = await tx
    .select({
      id: produtos.id,
      codigo: produtos.codigo,
      nome: produtos.nome,
      unidadePedido: produtos.unidadePedido,
      passaBalanca: produtos.passaBalanca,
    })
    .from(produtos)
    .where(inArray(produtos.id, produtoIds));

  const faltando = produtoIds.filter((id) => !encontrados.some((p) => p.id === id));
  if (faltando.length > 0) {
    throw new Error(
      `Onda 13: produto(s) inexistente(s) ao resolver metadados de recebimento: ${faltando.join(',')}`,
    );
  }

  const origem = alias(produtos, 'produto_origem');
  const destino = alias(produtos, 'produto_destino');
  const regras = await tx
    .select({
      produtoDestinoId: regrasDesdobramentoComercial.produtoDestinoId,
      produtoDestinoCodigo: destino.codigo,
      produtoOrigemNome: origem.nome,
    })
    .from(disponibilidadesVirtuais)
    .innerJoin(
      regrasDesdobramentoComercial,
      and(
        eq(regrasDesdobramentoComercial.produtoDestinoId, disponibilidadesVirtuais.produtoId),
        eq(regrasDesdobramentoComercial.status, 'ativo'),
        isNull(regrasDesdobramentoComercial.deletedAt),
      ),
    )
    .innerJoin(destino, eq(destino.id, regrasDesdobramentoComercial.produtoDestinoId))
    .innerJoin(
      comprasProgramadasItens,
      and(
        eq(comprasProgramadasItens.compraProgramadaId, compraProgramadaId),
        eq(comprasProgramadasItens.produtoId, regrasDesdobramentoComercial.produtoOrigemId),
        isNull(comprasProgramadasItens.deletedAt),
      ),
    )
    .innerJoin(origem, eq(origem.id, regrasDesdobramentoComercial.produtoOrigemId))
    .where(eq(disponibilidadesVirtuais.compraProgramadaId, compraProgramadaId));

  const origemPorItem = new Map<string, string>();
  const regrasPorCompra = new Map<string, Set<string>>();
  for (const r of regras) {
    const chave = r.produtoOrigemNome;
    const set = regrasPorCompra.get(chave) ?? new Set<string>();
    set.add(r.produtoDestinoCodigo);
    regrasPorCompra.set(chave, set);
  }
  for (const r of regras) {
    const codigos = [...(regrasPorCompra.get(r.produtoOrigemNome) ?? [])].sort().join('/');
    origemPorItem.set(
      r.produtoDestinoId,
      `${pc} / Regra ${r.produtoOrigemNome} → ${codigos}`,
    );
  }

  for (const p of encontrados) {
    mapa.set(p.id, {
      produtoId: p.id,
      origemDescricao: origemPorItem.get(p.id) ?? pc,
      unidadeEsperada: p.unidadePedido,
      requerBalanca: p.passaBalanca,
    });
  }

  return mapa;
}

export async function derivarTipoCarga(tx: Tx, compraProgramadaId: string): Promise<string | null> {
  const linha = await tx
    .select({ categoria: produtos.categoria })
    .from(comprasProgramadasItens)
    .innerJoin(produtos, eq(produtos.id, comprasProgramadasItens.produtoId))
    .where(
      and(
        eq(comprasProgramadasItens.compraProgramadaId, compraProgramadaId),
        isNull(comprasProgramadasItens.deletedAt),
      ),
    )
    .limit(1)
    .then((r) => r[0] ?? null);
  return linha?.categoria ?? null;
}

export async function contarPecasPorItem(
  tx: Tx,
  recebimentoId: string,
): Promise<Map<string, { quantidade: number; pesoTotal: string }>> {
  const linhas = await tx.execute<{
    produto_base_id: string;
    quantidade: string;
    peso_total: string;
  }>(sql`
    SELECT
      produto_base_id,
      count(*)::text AS quantidade,
      COALESCE(SUM(peso_original), 0)::text AS peso_total
    FROM pecas
    WHERE recebimento_id = ${recebimentoId}
      AND deleted_at IS NULL
    GROUP BY produto_base_id
  `);
  const mapa = new Map<string, { quantidade: number; pesoTotal: string }>();
  for (const row of linhas.rows) {
    mapa.set(row.produto_base_id, {
      quantidade: Number(row.quantidade),
      pesoTotal: row.peso_total,
    });
  }
  return mapa;
}
```

Não voltar a `itens_*`. Chamadores (`recebimento.service.ts` etc.) trocam `itemComercialId` / `itemComercialIds` por `produtoId` / `produtoIds` e leem `metadado.produtoId`.

**Commit 7d — pesagem**  
`pesagem.service.ts`, `dto/pesagem.dto.ts`, `associacao.service.ts`, `associacao-score.ts`, `compatibilidade.ts`, `troca-peca.service.ts`, `etiqueta.service.ts`

**Commit 7e — corte / desossa**  
`subitem.service.ts`, `dto/subitem.dto.ts`, `checklist-corte.service.ts`, `pecas-elegiveis.service.ts`, `dto/pecas-elegiveis.dto.ts`, `etiquetas-desossa.service.ts`, `painel.service.ts`, `faltas.service.ts`, `faltas.calc.ts`

**Commit 7f — expedição / faturamento / estoque / prontidão / dashboard / eventos**  
`carga.service.ts`, `fechamento.service.ts`, `liberacao.service.ts`, `notas-consulta.service.ts`, `estoque-consulta.service.ts` (apagar `carregarProdutosPorItemComercial`; ler `produtos` por id), `entradas.service.ts`, `ajustes.service.ts`, `destinar.service.ts`, `prontidao.service.ts` (gate: `≥1 produto` com `ativoVenda=true` e `deleted_at IS NULL` e `status='ativo'`, não contar item comercial), `dashboard.service.ts`, `comparativo.service.ts`, `realtime/events/eventos.ts` (`itemComercialId` → `produtoId` em todos os payloads listados no inventário).

Mensagens:  
`feat(onda13): desdobramento e compras usam produtoId`  
`feat(onda13): comercial reserva e mapa usam produtoId`  
`feat(onda13): recebimento lê produtoId e passaBalanca direto`  
`feat(onda13): pesagem troca itemComercialBaseId por produtoBaseId`  
`feat(onda13): corte e desossa usam produtoId`  
`feat(onda13): expedicao estoque prontidao e eventos usam produtoId`

### Aceite desta task

```powershell
rg "itemComercial|itensComerciais|itemCompra|itensCompra|item_comercial|itens-comerciais|itens-compra" app/backend/src --glob "!**/database/migrations/**"
```

Vazio **fora** de `database/migrations/**` (D25). Comentários novos com esses termos são proibidos. `npm run type-check` no backend verde.

---

## Task 8 — RBAC, menus, matriz, doc 010 (ALP-71)

**Files:**
- `permissoes.ts` — remover `ITENS_COMERCIAIS_LER`, `ITENS_COMERCIAIS_GERENCIAR`, `ITENS_COMPRA_LER`, `ITENS_COMPRA_GERENCIAR` e o comentário “Itens de compra/comerciais ficam só com o administrador”. Tirar dos mapas de perfil.
- `menus-canonicos.ts` — apagar as duas rotas (hoje L43–44). Comentário do topo volta a:

```ts
/**
 * Catálogo canônico das rotas do menu (protótipo Layout.tsx → ALL_NAV_GROUPS; 39
 * rotas — AD-15 revogou as 2 entradas da AD-11).
 */
```

`administrador: [...MENUS_CANONICOS]` perde as duas sozinho. Nenhum outro perfil as lista hoje — confirmar com `rg itens-compra|itens-comerciais` neste arquivo = vazio.

- Regenerar snapshot:

```powershell
Set-Location app/backend
npx tsx scripts/regen-rbac-snapshot.ts
```

Se existir `gerar-snapshot-perfis.ts` para menus, rodá-lo também. Senão editar `perfil-menus.snapshot.json` removendo os dois hrefs. Não editar o snapshot de permissões à mão se o script rodou.

- Seed RBAC: `DELETE FROM perfis_permissoes WHERE permissao_id IN (SELECT id FROM permissoes WHERE codigo IN ('ITENS_COMERCIAIS_LER','ITENS_COMERCIAIS_GERENCIAR','ITENS_COMPRA_LER','ITENS_COMPRA_GERENCIAR')); DELETE FROM permissoes WHERE codigo IN (...mesmo...);` no seed idempotente (ou o upsert deixa de inseri-las e o DELETE limpa órfãs). DELETE físico **só** nessas linhas de catálogo RBAC.

- Teste: `expect(MENUS_CANONICOS).toHaveLength(39)`.

### Matriz (literal)

Em `docs/superpowers/plans/2026-07-22-matriz-rastreabilidade-v1.1.md`:

1. **Não** apagar linhas 1–41 do protótipo. **Não** criar linhas 42–43 para depois apagar.
2. Linha 31 (`/cadastros/produtos`), coluna Observação — **acrescentar** no fim: ` **AD-15:** catálogo único; \`itens_comerciais\` e \`itens_compra\` extintos; seletores de Pedidos/Compras leem \`GET /produtos\` com \`ativoVenda\`/\`ativoCompra\`.`
3. Linha 10 (`/gestao/compras`) — trocar a frase `pool \`(operacao, item_comercial)\`` por `pool \`(operacao, produto)\`` e mencionar AD-15.
4. Linha 36 — acrescentar: `Desdobramento usa produto_origem_id/produto_destino_id; identidade 1:1 implícita (AD-15); seed só BOI→TZ/DT/PA.`
5. Transversal “Pool comercial multicompra” — `item_comercial` → `produto` na coluna Entidades, com nota AD-15.

### Doc 010 — append **depois** do bloco §3.4 (antes de `## 3.5`)

```markdown
> **Emenda AD-15 (2026-09-03):** as seções 3.3 e 3.4 descrevem o modelo histórico
> pré-unificação. A entidade única de catálogo é `produtos`. `itens_compra` e
> `itens_comerciais` foram extintos no contract da Onda 13. Papel de compra =
> `ativoCompra` e/ou `tipoOperacional = 'compra_base'`; papel de venda = `ativoVenda`.
> A seção 3.5 passa a ligar `produto_origem_id` → `produto_destino_id`. Identidade 1:1
> (mesmo produto comprável e vendável) **não** tem linha em `regras_desdobramento_comercial`.
```

Não reescrever os atributos históricos das seções 3.3/3.4.

**Commit:** `docs(onda13): menus 39 rotas, RBAC sem ITENS_* e emenda AD-15 no doc 010`

---

## Task 9 — Frontend shell (ALP-72)

**Files:**
- `app/frontend/src/lib/menu-v2.ts` — remover L93–94 (`itens-compra` / `itens-comerciais`). `ROTAS_CANONICAS.length === 39`.
- `app-sidebar.tsx` — se `Boxes` / `PackageSearch` ficarem sem uso, remover imports e entradas do mapa de ícones (hoje ~L42–43 e ~L111–112).
- `cadastros-config.ts` — apagar `itensCompraConfig`, `itensComerciaisConfig` e as chaves `'itens-compra'` / `'itens-comerciais'` do mapa `CADASTROS`.
- `next.config.ts` — **não** criar redirect dessas rotas para `/cadastros/produtos`. Se houver redirect AD-11 residual, apagar (404 natural).
- BFF `api/cadastros/[recurso]` — já rejeita recurso fora de `CADASTROS`; sem rota dedicada para apagar (não existem pastas `itens-*`).
- Testes: `menu-v2.test.ts`, `menu-rbac.test.ts`, `cadastros-config.test.ts` — contagem 39; administrador sem os dois hrefs.
- `app/frontend/__tests__/next-config-rotas.test.ts` — manter as asserções (nenhum `source` `/cadastros/itens-*`, nenhum `destination` `/cadastros/produtos`). Trocar o título do `it` para `'não redireciona itens-compra nem itens-comerciais para produtos (AD-15, 404 natural)'` — a menção AD-11 no título some.
- `app/frontend/__tests__/cadastro-form.test.tsx` — **apagar** o `describe('CadastroForm — itens-compra (smoke)')` (L113–121) e o import `itensCompraConfig`. Os describes de clientes/fornecedores ficam.

**Commit:** `feat(onda13): menu e cadastros-config sem itens comerciais/compra`

---

## Task 10 — Frontend consumidores (ALP-73)

Troca mecânica: fetches e tipos. **Não** filtrar BOI no cliente.

| Arquivo | Antes | Depois |
|---|---|---|
| `pedidos-client.tsx` | `GET /api/cadastros/itens-comerciais?page=1&pageSize=100&status=ativo` | `GET /api/cadastros/produtos?page=1&pageSize=100&status=ativo&ativoVenda=true` |
| `pedido-editor.tsx` | `itemComercialId`; query `itemComercialId` em `/api/comercial/pedidos/aberto` | `produtoId`; query `produtoId` |
| `modal-adendo.tsx` / `modal-overbooking.tsx` | `itemComercialId` | `produtoId` |
| `compras-client.tsx` | `GET /api/cadastros/itens-compra?...` | `GET /api/cadastros/produtos?page=1&pageSize=100&status=ativo&ativoCompra=true` |
| `compras-edit-modal.tsx` | simulação itemCompra | `produtoId` |
| `regras-transformacao-client.tsx` | os dois GETs | um GET `/produtos?pageSize=100&status=ativo` (origem = `ativoCompra=true`; destino = `ativoVenda=true` — dois fetches com flags) |
| `simulador-desdobramento.tsx` | ids comerciais/compra | `produtoOrigemId` / `produtoDestinoId` |
| `mapa-teatro.tsx`, `disponibilidade/page.tsx` | path `[itemComercialId]` | pasta BFF `api/comercial/disponibilidade/mapa/[produtoId]/detalhe` (renomear diretório) |
| `recebimento-carga-client.tsx`, `pesagem-destinacao-client.tsx` | nested `itemComercial` | `produto` com `codigo`/`nome` |
| `quadro-comparativo.tsx`, `painel-impacto.tsx`, `overbooking-client.tsx` | `itemComercialId` | `produtoId` |
| `espelho-client.tsx` | `item.itemComercialId` na `key` da `TableRow` (~L309) | `item.produtoId` na mesma `key` |
| `app/frontend/src/app/api/comercial/pedidos/aberto/route.ts` | `PedidoAberto.itemComercialId` | `produtoId` (proxy continua `fetchBackend` + querystring; o backend já troca o nome do campo na T07) |
| `lib/comercial.ts`, `operacao.ts`, `overbooking.ts`, `espelho.ts`, `desossa.ts`, `mapa-disponibilidade.ts`, `produtos.ts` | campos legado | `produtoId` / `produtoBaseId`; apagar `legadoItem*` |

Payload de item de pedido:

```json
{ "produtoId": "<uuid>", "quantidadePedida": 1 }
```

`#produto-novo` permanece. Opções = `` `${codigo} ${nome}` ``. BOI não vem do GET com `ativoVenda=true`.

Jest mínimo a atualizar (mocks `/api/cadastros/produtos?...` + `produtoId`):  
`onda4-pedidos.test.tsx`, `disponibilidade.test.tsx`, `onda4-disponibilidade.test.tsx`, `onda4-espelho.test.tsx`, `recebimento.test.tsx`, `pesagem.test.tsx`, `compras-client.test.tsx`, `overbooking-client.test.tsx`, `painel-impacto.test.tsx`, `quadro-comparativo.test.tsx`, `simuladores-transformacao.test.tsx`, `aprovacoes-client.test.tsx` (`COMPARATIVO.itens[0].itemComercialId` → `produtoId`; `descricao` permanece se o comparativo ainda expõe esse campo, senão `nome`), `api.test.ts` (`desafios: [{ produtoId: 'i1', quantidadeDeficit: '1.000' }]`).

```powershell
rg "itens-comerciais|itens-compra|itemComercial|itemCompra" app/frontend/src
```

Vazio.

**Commit:** `feat(onda13): pedidos compras e operacao consomem produtos`

---

## Task 11 — Testes, regressão, evidências (ALP-74)

**Criar** `app/backend/test/integration/onda13-catalogo-unificacao.e2e-spec.ts` com os `it` literais:

1. `'DoD 13.8 compra BOI gera TZ=2 DT=2 PA=2 sem linha BOI'`
2. `'DoD 13.9 compra TZ gera disponibilidade TZ fator 1'`
3. `'DoD 13.10 compra BPORCO gera disponibilidade BPORCO fator 1'`
4. `'DoD 13.12 pedido TZ reserva disponibilidade TZ'`
5. `'DoD 13.11 POST pedido com itemComercialId retorna 400'`
6. `'DoD 13.13 migrations 0034-0036 aplicam em banco seedado'`
7. `'DoD 13.7 information_schema sem itens_comerciais nem itens_compra'`
8. `'DoD 13.6 soft-delete some do GET ativoVenda=true'`

Inverter fixtures e2e que hoje fazem `POST /itens-comerciais` ou `POST /itens-compra`:

- `app/frontend/e2e/helpers/onda6-seed.ts`, `onda9-seed.ts`, `onda10-seed.ts`
- `app/frontend/e2e/onda5-gestao.spec.ts`, `onda5-usuarios-representantes.spec.ts`, `onda7.5-gestao.spec.ts`, `onda11-multicompra.spec.ts`, `onda12-dominio-campos-ui.spec.ts`, `jornada-operacional.spec.ts`

Substituição: `POST /produtos` (ou `/api/cadastros/produtos` no BFF) com `{ codigo, nome, unidadePedido, unidadePreco, tipoOperacional, ativoVenda, ativoCompra }`. Jornada operacional cria produto em `/cadastros/produtos`, não em `/cadastros/itens-comerciais/novo`.

Helpers backend `test/helpers/*-fixtures.ts`: trocar inserts em `itensComerciais`/`itensCompra` por `produtos`. Fixtures `*.schema.pre-onda*` de ondas passadas **não** se atualizam (são snapshots históricos de migrate) — só se algum teste da Onda 13 as importar para o schema atual; nesse caso parar e reportar.

**Regra mecânica — todo `app/backend/test/**` exceto `**/helpers/fixtures/*.schema.pre-onda*`:** aplicar a tabela Before/Depois da Task 7 em fixtures, mocks, selects e asserções (`itemComercialId`→`produtoId`, `itemComercialBaseId`→`produtoBaseId`, `itemCompraId`→`produtoId` em compra/simulação, `itemCompraId`+`itemComercialId` de regra → `produtoOrigemId`+`produtoDestinoId`, join `itensComerciais`→`produtos`, `ic.descricao`→`produtos.nome`). Chamadas `POST /itens-comerciais` e `POST /itens-compra` viram 404 (cadastros-diversos) ou `POST /produtos` com o payload desta task. Não deixar spec de fora: se `npm run test` falhar, corrigir o spec — não pular. Aceite:

```powershell
rg "itemComercial|itensComerciais|itemCompra|itensCompra|itens-comerciais|itens-compra" app/backend/test --glob "!**/*.schema.pre-onda*"
```

Vazio. Inclui `pedidos-onda4.e2e-spec.ts`, `disponibilidade.e2e-spec.ts`, `regras-desdobramento.e2e-spec.ts`, `seed.spec.ts` e os unitários listados pelo `rg` atual.

`prontidao.e2e-spec.ts`: gate ≥1 produto `ativoVenda`.

Cobertura: `Set-Location app/backend; npm run test:cov` ≥80% linha e branch. Prioridade de buracos: `disponibilidade.service.ts`, `compras-programadas.service.ts`, `produtos.service.ts`.

Frontend: `npm run test`. Playwright `jornada-operacional.spec.ts` contra Docker `4000`/`4001`/`15433`.

Evidências em `docs/evidencias/onda13-unificacao-catalogo/`:

1. `01-menu-cadastros.png` — grupo sem as duas entradas
2. `02-produtos-boi-bporco.png`
3. `03-pedidos-seletor-sem-boi.png`
4. `04-compras-seletor-com-boi.png`
5. `05-regras-so-boi.png`

Relatório desta task fica no comentário da issue ALP-74 (PR ainda não existe).

**Commit:** `test(onda13): invariantes de unificacao e regressao sem legado`

---

## Task 12 — Validação do Quality Owner (ALP-75) — não é Worker de código

O Worker **sobe** `docker compose up --build -d`, aplica migrate+seed, e **para**. Não abre PR.

Roteiro do QO (Jefferson), localhost:4000:

1. Login administrador. Menu CADASTROS & REGRAS: só Produtos no catálogo de mercadoria.
2. `/cadastros/itens-comerciais` → 404.
3. Produtos lista BOI (`compra_base`, só compra), BPORCO (duas flags), TZ/DT/PA.
4. Novo pedido: seletor sem BOI; TZ reserva imediatamente.
5. Gestão → Compras: compra BOI confirmada → disponibilidade 2 TZ + 2 DT + 2 PA, sem BOI.
6. Compra TZ avulso gera TZ no pool da operação.
7. Regras: só BOI→TZ/DT/PA; sem TZ→TZ.
8. Inativar vendável → some do seletor de Pedidos.
9. Pesagem de peça TZ associa a pedido TZ.

Done nesta issue = desbloqueia T13. Falha = volta ao Worker na task correspondente.

---

## Task 13 — PR, Portão 2, Portão A, merge (ALP-76)

Só com ALP-75 Done.

1. `git fetch origin`. Se `origin/develop` avançou, rebase **só** a branch da onda no o13.
2. `gh auth status` — se deslogado, parar.
3. Título do PR: `Onda 13 — Unificação do catálogo em Produtos (AD-15)`.
4. Portão 2: Monitor **novo** (`$gate-pr`). Portão A: outro Monitor, conclusão antes de ler o Portão 2.
5. Executor squash-merge `--match-head-commit <head>` e atualiza `EXECUCAO-STATUS` para `mergeada`.
6. Vercel não é gate (diff não toca `landing/**`).
7. Não incluir dependabot nem DS. Não convalidar a lacuna de Portão 2 da Onda 12.

---

## Gate local completo (comandos = CI) — **sem abertura de PR**

Rodar no o13 após T11, **antes** de chamar o QO:

```powershell
npm ci
npm run lint
npm run type-check
npm run test
npm run build
Set-Location app/backend
npm run test:cov
Set-Location ../frontend
npm run test
```

Playwright jornada contra a stack Docker (`4000` / `4001` / `15433`).

```powershell
rg "itemComercial|itensComerciais|itemCompra|itensCompra|ITENS_COMERCIAIS_|ITENS_COMPRA_|itens-comerciais|itens-compra" app/backend/src app/frontend/src --glob "!**/database/migrations/**"
```

Saída esperada: vazio **fora** de `database/migrations/**` (D25). Exceções permitidas **somente** em `docs/execucao/DECISOES.md`, planos históricos já mergeados, este plano e os snapshots `*.schema.pre-onda*` (fora de `src`). Testes em `app/frontend/__tests__` já foram reescritos nas Tasks 9–10 — se algum ainda casar, corrigir ali, não no `rg` do gate.

**Proibido nesta seção:** `gh pr create`, `git push` para abrir PR, merge, edição de `GATE-VEREDITOS.md`.

---

## Self-Review

- [x] Goal / Architecture / Tech Stack / Global Constraints / decisões fixadas / referências por tela / estrutura / DoD→teste 1:1 / tasks com código literal / gate local / este Self-Review.
- [x] Zero `TBD`, `TODO`, “a definir”, “implementar depois”, “similar à Task”.
- [x] FK de compra = `compras_programadas_itens` (não o cabeçalho).
- [x] Expand = schema ADD + `drizzle-kit generate` → 0034; backfill 0035 = SQL de dados; contract = Drizzle DROP + 0036.
- [x] T05 só verifica.
- [x] Todos os `uniqueIndex`/`uq_*` sobre FKs antigas listados (D12) + índices não-únicos (D13).
- [x] `listarProdutoQuerySchema` dedicado; `?ativoVenda=false` não vira `true`.
- [x] Matriz: 41 entradas do protótipo permanecem; o 41→39 é de **menu**.
- [x] Emenda append-only do doc 010 na Task 8 (Worker, não Executor).
- [x] Gate local **sem** abrir PR.
- [x] Identidade 1:1 no `DisponibilidadeService` com SQL literal.
- [x] Algoritmo legado→produto fail-closed.
- [x] GET `/itens-*` = 404, sem alias.
- [x] Journal confirmado até 0033; próximos = 0034/0035/0036.
- [x] Seed = 12 produtos.
- [x] Rollback 0036 = backup, sem `.down.sql` vazio.
- [x] Nenhuma pendência §16 fechada (P11 permanece provisório).
- [x] Palavra “Marca” não entra como rótulo/campo/entidade.
- [x] Worker não escreve `docs/execucao/`.
- [x] Emenda Portão 1 (2026-09-04): D25 + `rg` sem migrations; Task 10 inclui `espelho-client.tsx` e BFF `aberto/route.ts`; Jest `cadastro-form` / `next-config-rotas` / `aprovacoes-client` / `api.test`; helper de recebimento com corpo literal e sem default silencioso de `passaBalanca`.
- [x] Emenda Portão 1 recheck: CHECK origem≠destino tolera `deleted_at`; SQL literal de `recalcularParaCompra` e `projetarImpacto`; regra mecânica para `app/backend/test/**`.

**Próximo passo humano/orquestração:** Executor commita este plano no o13, aponta `EXECUCAO-STATUS` Onda 13 para este path e marca `aguardando_portao1`. Monitor **novo** roda `$gate-plano`. Worker só depois de `aprovado`.
