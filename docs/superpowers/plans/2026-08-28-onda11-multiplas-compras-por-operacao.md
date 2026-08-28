# Onda 11 — Múltiplas compras programadas por operação — Plano de Implementação

> **For agentic workers:** usar o papel `worker` definido em `.codex/agents/worker.toml`.
> Workers seguem o plano LITERALMENTE: não decidem regra de negócio, não improvisam. `old_string` não casa / teste falha após 1 correção / caso não coberto → PARAR e reportar.

**Goal:** Permitir N compras programadas na mesma Operação, numeradas de forma determinística e segura sob concorrência, mantendo a disponibilidade comercial como pool FIFO por `(operacao, item_comercial)` e preservando integralmente a cadeia física por lote. Entregar `/gestao/compras` master-detail DS v3, pedidos de venda desacoplados de lote, associação de peça livre dentro da operação e origem do lote rastreável em pedido, pesagem, recebimento e expedição.

**Architecture:** O schema Drizzle evolui em `0028 expand → 0029 backfill → 0030 contract`. `compras_programadas.numero_sequencial` é serializado sob lock pessimista da linha de `operacoes`; `pedidos_venda.compra_programada_id` vira legado nullable; `pecas.compra_programada_id` permanece `NOT NULL` e imutável. O motor `PedidosService.planejarSobLock` permanece intacto e continua reservando FIFO por `operacao_id`. Leituras de disponibilidade agregam o pool por operação, enquanto geração e recebimento continuam por compra. A rastreabilidade física usa snapshots append-only em `associacoes_peca_historico` e uma composição atual por lote no pedido.

**Tech Stack:** NestJS 11, TypeScript 5 strict, Drizzle ORM 0.45.2 / drizzle-kit 0.31.10, PostgreSQL 18, Zod 4, `@nestjs/event-emitter` + WebSocket nativo, Jest/Supertest, Next.js 16 App Router/BFF, React 19, Tailwind 4, componentes DS v3 e Playwright. Zero dependência nova.

**Base tip:** `origin/develop` @ `037c1160cce0477686a2f91f1378df7a2762242b`.

**Branch:** `feature/onda11-multiplas-compras-por-operacao` → PR para `develop`.

**Linear:** T02–T12 = SAM-110, SAM-111, SAM-112, SAM-113, SAM-114, SAM-115, SAM-116, SAM-117, SAM-118, SAM-119 e SAM-120. T00/AD-14 já está registrada; T01 é este plano; T13 é Portão 2 e não pertence à implementação.

---

## Global Constraints

1. **AD-14 é fechada e não será reaberta.** N compras por operação; pedido de venda pertence à operação; disponibilidade comercial é pool por operação+item; cadeia física permanece por lote.
2. **Invariante físico de reprovação:** `app/backend/src/database/schema/pesagem.schema.ts:18` continua:
   ```ts
   compraProgramadaId: uuid('compra_programada_id').notNull().references(() => comprasProgramadas.id),
   ```
   Nenhuma task remove `.notNull()`, torna o campo opcional ou aceita `null`. A migration 0030 instala `trg_pecas_compra_programada_imutavel`, que rejeita qualquer troca do UUID com a mensagem `pecas.compra_programada_id is immutable (AD-14)`. Nenhum service executa `SET compra_programada_id` em `pecas`.
3. **RN-01/RN-02/RN-03 só são revogadas no lado comercial.** Pedido ao fornecedor, recebimento, NF do fornecedor, conferência tripla e peça continuam vinculados à compra/lote.
4. **RA-01:** operação, saldo, risco, compatibilidade e bloqueios são decididos no backend. BFF apenas repassa contrato.
5. **RA-02:** criação/numeração da compra e associação física permanecem transacionais e auditadas. Snapshots de origem são append-only.
6. **RA-04:** sem `setInterval`, refresh periódico ou polling. `COMPRA_CRIADA`, `COMPRA_ATUALIZADA`, `COMPRA_CANCELADA`, `COMPRA_CONFIRMADA`, `DISPONIBILIDADE_GERADA` e `COMPRA_ALTERADA_IMPACTO` são emitidos somente após commit. Clients reagem por WebSocket ou ação explícita.
7. **RA-05/06:** erro de lock, banco, numeração, incompatibilidade ou rastreabilidade é propagado. Não capturar `23505` para devolver sucesso, não usar fallback inventado e não ocultar falha.
8. **AD-03 intacta:** unicidade de pedido aberto continua `(cliente, item comercial, operação)` em `pedidos.service.ts:233-265`.
9. **AD-05 intacta:** overbooking ilimitado exige challenge 409 read-only e confirmação explícita. Compra complementar da mesma operação passa a compor o saldo disponível.
10. **AD-10 / Princípio I:** a referência visual canônica é DS v3, não `F:\Projetos\alpha-carnes-prototipo`. O protótipo v1.1 inacessível não bloqueia a onda.
11. **Princípio II:** nenhuma tela parcial. `/gestao/compras` entrega lista, seleção, detalhe, criação, edição, confirmação, empty state, deep-link e estados de erro/carregamento.
12. **Princípio IX:** zero rótulo isolado ou busca “Marca”. Fornecedor é exibido por **Nome Fantasia** quando disponível e, como fallback real, Razão Social. Não fabricar nome fantasia.
13. **Princípio X:** todas as migrations nascem de `drizzle-kit generate`. As únicas edições SQL manuais permitidas nesta onda são o DML/guarda de `0029`, criado por `generate --custom`, e a função/trigger de imutabilidade adicionada ao SQL `0030` criado por `generate`; nenhum outro DML/DDL manual é permitido.
14. `disponibilidades_virtuais.uq_disp_compra_item` em `disponibilidades-virtuais.schema.ts:34` permanece inalterado.
15. `gerarParaCompra`, `listarEsperadoDaCompra`, `aplicarRecebimentoDelta`, `projetarImpacto` e `recalcularParaCompra` continuam por compra.
16. `PedidosService.planejarSobLock` em `pedidos.service.ts:427-474` não é alterado: já filtra `operacao_id`, ordena `created_at, id`, trava `FOR UPDATE` e distribui FIFO.
17. Cobertura backend ≥80% de linhas e branches. Testes usam `HARDWARE_FAKE=1` e `NFSE_FAKE=1`.
18. Portas host: frontend `4000`, backend `4001`, PostgreSQL `15433`; portas internas Docker: `3000`, `3001`, `5432`.
19. A migration é serial. Backend só começa após Task 1. Frontend só começa após contratos backend das Tasks 2–6. Tasks 8–10 permanecem seriais porque compartilham tipos e fixtures; nenhuma fatia paralela compartilha arquivo.

---

## Escopo / Fora de escopo

### Escopo

- Três migrations geradas `0028/0029/0030`, schemas e testes de proveniência/invariantes.
- Filtros/enriquecimento/listagem e numeração concorrente de compras.
- Disponibilidade agregada por operação e detalhada por compra.
- Pedido novo por operação; no DTO geral de criação o campo legado `compraProgramadaId` continua aceito e ignorado, enquanto o caminho de overbooking `novo_pedido` o remove do schema e o ignora por strip se vier como chave extra.
- Compatibilidade peça→pedido dentro da operação, bônus de score por cobertura no lote e bloqueio interoperações.
- Snapshot físico e endpoint de composição por lote.
- BFF/tipos sem regra.
- `/gestao/compras` master-detail DS v3.
- Seletor real de operação no pedido e correção do fluxo de overbooking.
- Origem sequencial do lote visível em recebimento, pesagem, pedido e expedição.
- Regressão backend/frontend/Playwright e evidências da onda.

### Fora de escopo

- Tornar `pecas.compra_programada_id` nullable, mutável ou inferida.
- Fundir pedidos ao fornecedor, recebimentos, NFs ou conferências de compras diferentes.
- Reescrever reservas, rebalancear reservas antigas ou alterar o FIFO de `planejarSobLock`.
- Alterar `uq_disp_compra_item`.
- Criar permissão RBAC.
- Alterar layout ou payload impresso da etiqueta: os campos finais continuam pendentes em v1.1 §16.12. A UI pode exibir a origem já presente no contrato; a etiqueta física não recebe campo novo sem nova AD.
- Polling.

---

## Referências visuais (AD-10 / DS v3, NÃO o protótipo v1.1)

AD-10, registrada em `docs/execucao/DECISOES.md:17`, substitui nominalmente o protótipo v1.1 pelo DS v3. Para cada tela:

| Tela | Referência DS v3 obrigatória | Aplicação literal |
|---|---|---|
| `/gestao/compras` | `docs/superpowers/plans/2026-08-05-onda-ds-v3-implementacao.md:2555-2571`, especialmente Task 24 Step 2 `:2567`; `docs/ds-preview/direcao-a/componentes.html:40-70,73-170,208-237`; `tokens.css:8-95,205-214` | `PageHeader`, `Button`, `DatePickerField`, `ComboboxField`, `StatusPill`, controles 32/28px, tabela 36px, dados numéricos `font-data`; master-detail no padrão R3 já aplicado em Overbooking. |
| `/comercial/pedidos` | `docs/ds-preview/direcao-a/pedidos.html:53-129`; plano DS v3 receitas R1/R2/R5/R6 | seletor real de Operação no card do editor; lista e tabela não mudam de geometria. |
| `/recebimento/pesagem-destinacao` | `docs/ds-preview/direcao-a/pesagem.html:78-165`, especialmente contexto do lote `:90-103` e pedidos compatíveis `:140-165` | origem “Lote 001” em `font-data`, sem UUID truncado; lista compatível mantém densidade e busca “Buscar cliente”. |
| `/recebimento/recebimento-carga` | `componentes.html:40-70,208-237` + tokens `:76-89`; plano DS v3 receitas R1/R2/R4 | tabela e card de contexto exibem sequencial do lote. |
| `/carga/planejamento`, `/carga/conferencia`, `/carga/enviar-faturamento` | `pedidos.html:69-129` para tabelas densas e `componentes.html:40-70` para ações | origem aparece como texto secundário `font-data`, sem alterar hierarquia da carga. |

Não consultar nem exigir `.tsx` em `F:\Projetos\alpha-carnes-prototipo`; pelo AD-10 isso não viola o Princípio I.

---

## Decisões de design (fixadas)

**D11.1 — Numeração usa `SELECT ... FOR UPDATE` na linha da Operação.** Após `garantirOperacao`, a transação executa:

```ts
await tx
  .select({ id: operacoes.id })
  .from(operacoes)
  .where(eq(operacoes.id, operacao.id))
  .for('update');
```

e calcula `COALESCE(MAX(numero_sequencial), 0) + 1` entre **todas** as compras da operação, inclusive canceladas/soft-deleted, para nunca reutilizar um número já exibido ou auditado. A escolha é lock pessimista, não retry de `23505`, porque há uma linha canônica por operação, a contenção fica restrita à mesma operação, a sequência é calculada e inserida na mesma transação e não há transação abortada para reconstruir. O índice parcial `(operacao_id, numero_sequencial)` exigido para compras vivas não canceladas é backstop. Qualquer erro é propagado; não existe fallback ou sucesso silencioso.

**D11.2 — Sequencial público.** API expõe `numeroSequencial: number`; UI renderiza `Lote 001`, `Lote 002` com `padStart(3, '0')`. UUID não é número de lote.

**D11.3 — Listagem enriquecida.** `GET /comercial/compras-programadas` aceita `operacaoId`, `dataOperacao`, `status`, `fornecedorId`, além de paginação. Cada linha contém `numeroSequencial`, `fornecedorNomeFantasia`, `fornecedorRazaoSocial`, `totalItens`. Quando `operacaoId` ou `dataOperacao` está presente, ordena `numeroSequencial ASC`; sem escopo, ordena `createdAt DESC`.

**D11.4 — Disponibilidade tem dois modos.** Com `compraProgramadaId`, retorna linhas físicas da compra. Sem esse parâmetro e com `operacaoId` ou `dataOperacao`, retorna uma linha agregada por operação+item, somando gerada/reservada/disponível/recebida/divergente e derivando status. `id` e `compraProgramadaId` não existem no shape agregado; o frontend usa união discriminada `modo: 'agregado' | 'compra'`.

**D11.5 — Risco é da operação.** `listarPedidosEmRisco(tx, operacaoId, itemComercialId)` soma recebimento de todas as disponibilidades da operação e reservas ativas dos pedidos da mesma operação. Um lote deficitário não gera falso positivo quando outro lote da operação cobre o total.

**D11.6 — Pedido novo não pertence à compra.** `compraProgramadaId` no DTO fica opcional por compatibilidade e é deliberadamente ignorado. A inserção grava `null`. Operação é resolvida por `operacaoId` quando enviado, validando `dataOperacao` se ambos vierem; caso contrário por `dataOperacao`. AD-03 e AD-05 permanecem.

**D11.7 — Bônus do lote.** Compatibilidade filtra operação por `pecas → compras_programadas.operacao_id`. O score ganha `cobertaPeloLote: boolean` e bônus fixo `PESO_COBERTURA_LOTE = 5` quando existe reserva ativa do item para uma disponibilidade da compra da peça. Reserva overbooking (`disponibilidade_virtual_id IS NULL`) não dá bônus nem penalidade.

**D11.8 — Bloqueio duro interoperações.** Confirmação, redirecionamento, Troca de Peça e transferência de carga comparam `pedido.operacao_id` com `compra da peça.operacao_id`; divergência retorna exatamente `Pedido pertence a outra operação`. Dentro da operação não exige motivo adicional.

**D11.9 — Snapshot e composição.** `associacoes_peca_historico` ganha `compra_programada_origem_id` e `recebimento_origem_id`, ambos `NOT NULL` no contract. Toda gravação deriva os valores da peça de origem na mesma transação. `GET /comercial/pedidos/:id/composicao-lotes` retorna:

```ts
interface ComposicaoLotePedido {
  compraProgramadaId: string;
  numeroSequencial: number;
  recebimentoId: string;
  quantidadeUnidades: number;
  pesoTotal: string;
}
```

e inclui peças e subitens atualmente associados, agrupados por compra+recebimento, sem duplicar histórico redirecionado.

**D11.10 — Etiqueta física não muda.** `EtiquetaService.montarPayload` e modelos não recebem lote nesta onda. Registrar na evidência a pendência explícita “v1.1 §16.12 — inclusão da origem do lote no layout físico exige decisão/AD”; não inventar campo.

---

## Estrutura de arquivos

```text
app/backend/src/database/schema/compras-programadas.schema.ts
app/backend/src/database/schema/pedidos.schema.ts
app/backend/src/database/schema/pesagem.schema.ts
app/backend/src/database/migrations/0028_onda11_multicompra_expand.sql
app/backend/src/database/migrations/0029_onda11_multicompra_backfill.sql
app/backend/src/database/migrations/0030_onda11_multicompra_contract.sql
app/backend/src/database/migrations/meta/{0028,0029,0030}_snapshot.json
app/backend/src/database/migrations/meta/_journal.json
app/backend/test/integration/onda11-migrations.e2e-spec.ts
app/backend/test/unit/onda11-migrations-meta.spec.ts
app/backend/src/modules/comercial/compras-programadas/dto/compra-programada.dto.ts
app/backend/src/modules/comercial/compras-programadas/compras-programadas.controller.ts
app/backend/src/modules/comercial/compras-programadas/compras-programadas.service.ts
app/backend/src/realtime/events/eventos.ts
app/backend/src/modules/comercial/disponibilidade/{dto/disponibilidade.dto.ts,disponibilidade.service.ts,mapa.service.ts}
app/backend/src/modules/comercial/pedidos/{dto/pedido.dto.ts,pedidos.controller.ts,pedidos.service.ts}
app/backend/src/modules/comercial/overbooking/{dto/overbooking.dto.ts,overbooking.service.ts}
app/backend/src/modules/operacao/pesagem/{compatibilidade.ts,associacao-score.ts,associacao.service.ts,troca-peca.service.ts}
app/backend/src/modules/operacao/expedicao/{carga.service.ts,liberacao.service.ts}
app/backend/src/modules/operacao/recebimento/recebimento.service.ts
app/backend/test/integration/{compras-programadas,pedidos-reserva,recebimento,associacao,troca-peca,expedicao}.e2e-spec.ts
app/backend/test/unit/{compatibilidade,associacao-score}.spec.ts
app/backend/test/integration/onda11-multicompra.e2e-spec.ts
app/frontend/src/lib/{comercial,operacao,expedicao-ui}.ts
app/frontend/src/app/api/comercial/disponibilidade/route.ts
app/frontend/src/app/api/comercial/pedidos/[id]/composicao-lotes/route.ts
app/frontend/src/app/(admin)/gestao/compras/{compras-client,compras-edit-modal}.tsx
app/frontend/src/app/(admin)/comercial/pedidos/{pedidos-client,pedido-editor}.tsx
app/frontend/src/app/(admin)/gestao/overbooking/overbooking-client.tsx
app/frontend/src/app/(admin)/recebimento/{recebimento-carga/recebimento-carga-client,pesagem-destinacao/pesagem-destinacao-client}.tsx
app/frontend/src/app/(admin)/carga/{planejamento/planejamento-client,conferencia/conferencia-client,enviar-faturamento/enviar-faturamento-client}.tsx
app/frontend/__tests__/{bff-disponibilidade,compras-client,onda4-pedidos,overbooking-client,recebimento,pesagem,carga-planejamento}.test.tsx
app/frontend/e2e/onda5-gestao.spec.ts
app/frontend/e2e/onda11-multicompra.spec.ts
docs/evidencias/onda11-multicompra/{index.html,01-compras-master-detail.png,02-pedido-operacao.png,03-pesagem-lote.png,04-expedicao-origem.png}
docs/superpowers/plans/2026-07-22-matriz-rastreabilidade-v1.1.md
```

---

## Mapa DoD → teste (1:1)

| DoD | Prova |
|---|---|
| DOD11-01 três migrations geradas e contíguas; SQL manual restrito ao backfill 0029 e trigger 0030 | `onda11-migrations-meta.spec.ts` + `npx drizzle-kit check` |
| DOD11-02 backfill `row_number()` por operação/created_at/id | `onda11-migrations.e2e-spec.ts` |
| DOD11-03 `pecas.compra_programada_id` NOT NULL e imutável por trigger | `onda11-migrations.e2e-spec.ts`: `23502` para NULL, trigger rejeita troca de UUID e UPDATE de outro campo passa |
| DOD11-04 N compras e sequenciais sem colisão sob concorrência | `compras-programadas.e2e-spec.ts` |
| DOD11-05 filtros e payload enriquecido | `compras-programadas.e2e-spec.ts` |
| DOD11-06 seis eventos reais e eventos de criar/editar/cancelar pós-commit | `compras-programadas.e2e-spec.ts`: uma emissão por mutação, zero em rollback/no-op |
| DOD11-07 agregado da disponibilidade e detalhe por compra | `onda11-multicompra.e2e-spec.ts` |
| DOD11-08 risco no escopo de operação sem falso positivo | `recebimento.e2e-spec.ts` |
| DOD11-09 mapa V soma múltiplos lotes | `onda11-multicompra.e2e-spec.ts` |
| DOD11-10 pedido novo grava compra legada NULL; overbooking `novo_pedido` independe de compra | `pedidos-reserva.e2e-spec.ts` + POST de decisão sem `compraProgramadaId` e chave extra ignorada por Zod |
| DOD11-11 reserva atravessa lotes FIFO sem alterar motor | `onda11-multicompra.e2e-spec.ts` |
| DOD11-12 AD-03 e AD-05 preservadas | `pedidos-reserva.e2e-spec.ts` + `pedidos-concorrencia.e2e-spec.ts` |
| DOD11-13 score dá bônus apenas à reserva coberta pelo lote | `associacao-score.spec.ts` + `compatibilidade.spec.ts` |
| DOD11-14 peça associa 6 do lote 001 + 4 do 002 ao mesmo pedido | `associacao.e2e-spec.ts` |
| DOD11-15 bloqueio entre operações em associação/troca/carga | `associacao.e2e-spec.ts`, `troca-peca.e2e-spec.ts`, `expedicao.e2e-spec.ts` |
| DOD11-16 snapshots e composição por lote | `onda11-multicompra.e2e-spec.ts` |
| DOD11-17 conferência tripla independente por lote | `recebimento.e2e-spec.ts` |
| DOD11-18 BFF repassa query e composição | `bff-disponibilidade.test.ts` |
| DOD11-19 compras master-detail completa | `compras-client.test.tsx` |
| DOD11-20 pedido seleciona operação e não envia compra | `onda4-pedidos.test.tsx` |
| DOD11-21 overbooking não escolhe compra arbitrária | `overbooking-client.test.tsx` prova payload `novo_pedido` sem `compraProgramadaId`; compra complementar mantém escolha explícita |
| DOD11-22 origem sequencial visível em quatro fluxos | testes React de recebimento/pesagem/carga + Playwright O11 |
| DOD11-23 sem polling; subscriptions usam os seis nomes reais | grep de gate + `compras-client.test.tsx` + teste backend de eventos |
| DOD11-24 evidências DS v3 e emenda da matriz | Playwright + diff documental |

---

## Task 1 — SAM-110 T02 — Migration 0028→0029→0030

**Files:** schemas `compras-programadas.schema.ts:11-38`, `pedidos.schema.ts:13-41`, `pesagem.schema.ts:14-86`; migrations/meta; dois testes novos.

**Interfaces finais:**

```ts
numeroSequencial: integer('numero_sequencial').notNull()
compraProgramadaId: uuid('compra_programada_id').references(() => comprasProgramadas.id)
compraProgramadaOrigemId: uuid('compra_programada_origem_id').notNull().references(() => comprasProgramadas.id)
recebimentoOrigemId: uuid('recebimento_origem_id').notNull().references(() => recebimentos.id)
```

- [ ] **Step 1 — RED:** criar `onda11-migrations-meta.spec.ts` exigindo tags 28/29/30, snapshots encadeados e SQL: 0028 remove `uq_compras_prog_operacao`, adiciona `numero_sequencial`, drop NOT NULL apenas de `pedidos_venda.compra_programada_id`, adiciona snapshots nullable; 0029 contém `row_number() over (partition by operacao_id order by created_at, id)` e não contém `CREATE|ALTER|DROP|TRUNCATE`; 0030 seta NOT NULL em sequencial/snapshots, cria `uq_compras_prog_operacao_sequencial`, a função `pecas_impedir_mutacao_compra_programada` e o trigger `trg_pecas_compra_programada_imutavel`.
- [ ] **Step 2 — expand schema.** Substituir em `compras-programadas.schema.ts:14-17,31-34`:
  ```ts
  // old_string
  operacaoId:           uuid('operacao_id').notNull().references(() => operacoes.id),
  fornecedorId:         uuid('fornecedor_id').notNull().references(() => fornecedores.id),
  numeroInterno:        text('numero_interno'),
  ```
  por:
  ```ts
  // new_string — estado expand
  operacaoId:           uuid('operacao_id').notNull().references(() => operacoes.id),
  numeroSequencial:     integer('numero_sequencial'),
  fornecedorId:         uuid('fornecedor_id').notNull().references(() => fornecedores.id),
  numeroInterno:        text('numero_interno'),
  ```
  e remover somente o bloco `uniqueIndex('uq_compras_prog_operacao')...`; importar `integer`.
- [ ] **Step 3 — expand pedido.** Em `pedidos.schema.ts:17`, trocar:
  ```ts
  compraProgramadaId: uuid('compra_programada_id').notNull().references(() => comprasProgramadas.id),
  ```
  por:
  ```ts
  compraProgramadaId: uuid('compra_programada_id').references(() => comprasProgramadas.id),
  ```
  Preservar índice e relation nullable.
- [ ] **Step 4 — expand histórico.** Após `pedidoItemDestinoId` em `pesagem.schema.ts:65`, adicionar, ainda nullable:
  ```ts
  compraProgramadaOrigemId: uuid('compra_programada_origem_id').references(() => comprasProgramadas.id),
  recebimentoOrigemId:      uuid('recebimento_origem_id').references(() => recebimentos.id),
  ```
  Não tocar `pecas.compraProgramadaId`.
- [ ] **Step 5 — gerar expand**, a partir de diretório limpo:
  ```powershell
  Set-Location app/backend
  npm run db:generate -- --name=onda11_multicompra_expand
  ```
  Saída: `0028_onda11_multicompra_expand.sql`, snapshot 0028 e journal idx 28. Se o nome ou índice gerado divergir, **PARAR E REPORTAR** sem renomear arquivo nem editar journal/snapshot.
- [ ] **Step 6 — gerar custom vazio:**
  ```powershell
  npm run db:generate -- --custom --name=onda11_multicompra_backfill
  ```
  Editar somente `0029` com:
  ```sql
  WITH numeradas AS (
    SELECT id,
           row_number() OVER (
             PARTITION BY operacao_id
             ORDER BY created_at, id
           )::integer AS numero_sequencial
      FROM compras_programadas
  )
  UPDATE compras_programadas cp
     SET numero_sequencial = n.numero_sequencial
    FROM numeradas n
   WHERE n.id = cp.id
     AND cp.numero_sequencial IS NULL;
  --> statement-breakpoint
  UPDATE associacoes_peca_historico h
     SET compra_programada_origem_id = p.compra_programada_id,
         recebimento_origem_id = p.recebimento_id
    FROM pecas p
   WHERE h.peca_id = p.id
     AND (h.compra_programada_origem_id IS NULL OR h.recebimento_origem_id IS NULL);
  --> statement-breakpoint
  UPDATE associacoes_peca_historico h
     SET compra_programada_origem_id = p.compra_programada_id,
         recebimento_origem_id = p.recebimento_id
    FROM subitens s
    JOIN pecas p ON p.id = s.peca_origem_id
   WHERE h.subitem_id = s.id
     AND (h.compra_programada_origem_id IS NULL OR h.recebimento_origem_id IS NULL);
  --> statement-breakpoint
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM compras_programadas WHERE numero_sequencial IS NULL) THEN
      RAISE EXCEPTION 'backfill incompleto: compras_programadas.numero_sequencial';
    END IF;
    IF EXISTS (
      SELECT 1 FROM associacoes_peca_historico
       WHERE compra_programada_origem_id IS NULL OR recebimento_origem_id IS NULL
    ) THEN
      RAISE EXCEPTION 'backfill incompleto: origem física de associacoes_peca_historico';
    END IF;
  END $$;
  ```
- [ ] **Step 7 — contract schema.** Aplicar `.notNull()` aos três campos backfilled e declarar:
  ```ts
  uniqueIndex('uq_compras_prog_operacao_sequencial')
    .on(t.operacaoId, t.numeroSequencial)
    .where(sql`${t.deletedAt} IS NULL AND ${t.status} <> 'cancelada'`),
  ```
  Gerar:
  ```powershell
  npm run db:generate -- --name=onda11_multicompra_contract
  npx drizzle-kit check
  ```
  Saída: `0030_onda11_multicompra_contract.sql`, snapshot 0030 e journal idx 30. Se o nome ou índice gerado divergir, **PARAR E REPORTAR** sem renomear arquivo nem editar journal/snapshot. No final de `0030_onda11_multicompra_contract.sql`, após o DDL gerado, adicionar literalmente o único DDL manual da migration contract:
  ```sql
  CREATE OR REPLACE FUNCTION pecas_impedir_mutacao_compra_programada()
  RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    IF NEW.compra_programada_id IS DISTINCT FROM OLD.compra_programada_id THEN
      RAISE EXCEPTION 'pecas.compra_programada_id is immutable (AD-14)';
    END IF;
    RETURN NEW;
  END;
  $$;
  --> statement-breakpoint
  CREATE TRIGGER trg_pecas_compra_programada_imutavel
    BEFORE UPDATE ON pecas
    FOR EACH ROW
    EXECUTE FUNCTION pecas_impedir_mutacao_compra_programada();
  ```
  PostgreSQL 18 e o projeto aceitam `EXECUTE FUNCTION`; usar essa forma literal. Não criar lógica equivalente em service.
- [ ] **Step 8 — integração:** banco descartável chega até 0027; inserir 3 compras na mesma operação com `created_at` fora da ordem de UUID; aplicar 0028/29/30; esperar sequenciais 1/2/3 por `created_at,id`; rerun idempotente; esperar `pedidos_venda.compra_programada_id IS NULL` permitido; tentar `pecas.compra_programada_id=NULL` e esperar `23502`; consultar `information_schema.columns.is_nullable='NO'`. Inserir duas compras e uma peça válida ligada à primeira; executar `UPDATE pecas SET compra_programada_id = '<uuid-da-segunda>' WHERE id = '<peca-id>'` e esperar exceção contendo `pecas.compra_programada_id is immutable (AD-14)`; executar `UPDATE pecas SET peso_original = peso_original WHERE id = '<peca-id>'` e esperar sucesso. A prova de imutabilidade é o trigger, não apenas `.notNull()`.
- [ ] **Step 9 — drift:** `npm run db:generate -- --name=onda11_drift_probe` deve responder `No schema changes, nothing to migrate`, sem criar 0031.
- [ ] **GREEN:** `npm test -- onda11-migrations --runInBand` → 2 suítes verdes; `npx drizzle-kit check` → `Everything's fine`.
- [ ] **Commit do Worker:** `feat(onda11): gerar migrations expand backfill contract multicompra`.

---

## Task 2 — SAM-111 T03 — Compras: sequencial, filtros e eventos

**Files:** `compra-programada.dto.ts:16-26`, controller `:27-31`, `compras-programadas.service.ts:42-49,78-175,177-210,367-459`, `realtime/events/eventos.ts:4-79,129-142,429-500`, `compras-programadas.e2e-spec.ts:202-228`.

- [ ] **Step 1 — RED:** inverter o teste `uma compra ATIVA...` para criar duas compras no mesmo dia e esperar `201`, `numeroSequencial` 1 e 2; adicionar `Promise.all` com 20 POSTs na mesma operação e esperar conjunto exato 1..20 sem erro/duplicata. Espionar `EventEmitter2.emit`: criar, atualizar e cancelar emitem exatamente uma vez, respectivamente, `COMPRA_CRIADA`, `COMPRA_ATUALIZADA` e `COMPRA_CANCELADA`; forçar erro antes do commit em cada mutação e esperar zero emissão.
- [ ] **Step 2 — query DTO:** importar `listarQuerySchema` e adicionar:
  ```ts
  export const listarComprasProgramadasSchema = listarQuerySchema.extend({
    operacaoId: z.string().uuid().optional(),
    dataOperacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    status: z.enum(['rascunho', 'em_negociacao', 'confirmada', 'cancelada']).optional(),
    fornecedorId: z.string().uuid().optional(),
  });
  export type ListarComprasProgramadasDto = z.infer<typeof listarComprasProgramadasSchema>;
  ```
  Controller troca `listarQuerySchema/ListarQuery` pelo DTO novo. Nenhuma permissão nova.
- [ ] **Step 3 — payload:** importar `fornecedores`; o schema real `fornecedores.schema.ts:8-18` não possui coluna de Nome Fantasia, portanto não inventar nem migrar esse dado nesta onda. Ampliar `COMPRA_COM_DATA` e listagem com:
  ```ts
  fornecedorNomeFantasia: sql<string | null>`NULL`,
  fornecedorRazaoSocial: fornecedores.razaoSocial,
  totalItens: sql<number>`(
    SELECT count(*)::int FROM compras_programadas_itens cpi
    WHERE cpi.compra_programada_id = ${comprasProgramadas.id}
      AND cpi.deleted_at IS NULL
  )`,
  ```
  O contrato mantém a chave nullable solicitada e fornece o valor real disponível em `fornecedorRazaoSocial`; UI usa o fallback explícito.
- [ ] **Step 4 — filtros:** construir `filtros` com `isNull(deletedAt)`, igualdade de operação/status/fornecedor e join `operacoes.data`; usar o mesmo `where` em dados e total. Quando escopado, `orderBy(asc(numeroSequencial))`; caso contrário `desc(createdAt)`.
- [ ] **Step 5 — remover 409 e numerar sob lock.** Substituir integralmente `compras-programadas.service.ts:117-132`:
  ```ts
  // old_string
  const compraExistenteNoDia = await tx
    .select({ id: comprasProgramadas.id })
    .from(comprasProgramadas)
    .where(
      and(
        eq(comprasProgramadas.operacaoId, operacao.id),
        isNull(comprasProgramadas.deletedAt),
        ne(comprasProgramadas.status, 'cancelada'),
      ),
    )
    .limit(1)
    .then((r) => r[0] ?? null);

  if (compraExistenteNoDia) {
    throw new ConflictException('Já existe compra programada ativa para esta data');
  }
  ```
  por:
  ```ts
  // new_string
  await tx
    .select({ id: operacoes.id })
    .from(operacoes)
    .where(eq(operacoes.id, operacao.id))
    .for('update');

  const [sequencia] = await tx
    .select({
      proximo: sql<number>`coalesce(max(${comprasProgramadas.numeroSequencial}), 0)::int + 1`,
    })
    .from(comprasProgramadas)
    .where(eq(comprasProgramadas.operacaoId, operacao.id));
  if (!sequencia) throw new Error('Falha ao calcular número sequencial da compra');
  ```
  e inserir `numeroSequencial: sequencia.proximo` em `.values`.
- [ ] **Step 6 — catálogo de eventos:** em `eventos.ts`, imediatamente após `DISPONIBILIDADE_GERADA`, adicionar:
  ```ts
  COMPRA_CRIADA: 'compra_programada_criada',
  COMPRA_ATUALIZADA: 'compra_programada_atualizada',
  COMPRA_CANCELADA: 'compra_programada_cancelada',
  ```
  Adicionar o contrato:
  ```ts
  export interface CompraMutadaPayload {
    compraId: string;
    operacaoId: string;
    dataOperacao: string;
    numeroSequencial?: number;
  }
  ```
  Ampliar literalmente `CompraConfirmadaPayload` e `DisponibilidadeGeradaPayload` com:
  ```ts
  operacaoId: string;
  numeroSequencial?: number;
  ```
  e estas entradas literais em `PayloadPorEvento`:
  ```ts
  compra_programada_criada: CompraMutadaPayload;
  compra_programada_atualizada: CompraMutadaPayload;
  compra_programada_cancelada: CompraMutadaPayload;
  ```
- [ ] **Step 7 — emits pós-commit:** em `criar`, substituir o retorno posterior à transação:
  ```ts
  // old_string
  return this.detalhar(compraId);
  ```
  por:
  ```ts
  // new_string
  const compra = await this.detalhar(compraId);
  this.eventEmitter.emit(EVENTOS.COMPRA_CRIADA, {
    compraId: compra.id,
    operacaoId: compra.operacaoId,
    dataOperacao: compra.dataOperacao,
    numeroSequencial: compra.numeroSequencial,
  });
  return compra;
  ```
  No retorno posterior à transação de `atualizar`, substituir:
  ```ts
  // old_string
  return this.detalhar(compraId);
  ```
  por:
  ```ts
  // new_string
  const compra = await this.detalhar(compraId);
  this.eventEmitter.emit(EVENTOS.COMPRA_ATUALIZADA, {
    compraId: compra.id,
    operacaoId: compra.operacaoId,
    dataOperacao: compra.dataOperacao,
    numeroSequencial: compra.numeroSequencial,
  });
  return compra;
  ```
  No retorno posterior à transação de `cancelar`, substituir:
  ```ts
  // old_string
  return this.detalhar(compraId);
  ```
  por:
  ```ts
  // new_string
  const compra = await this.detalhar(compraId);
  this.eventEmitter.emit(EVENTOS.COMPRA_CANCELADA, {
    compraId: compra.id,
    operacaoId: compra.operacaoId,
    dataOperacao: compra.dataOperacao,
    numeroSequencial: compra.numeroSequencial,
  });
  return compra;
  ```
  Esses três blocos ficam depois de `await this.db.transaction(...)`; nunca emitir dentro da callback transacional. Preservar as emissões pós-commit de `confirmar` e `atualizarItem`; acrescentar literalmente `operacaoId: compra.operacaoId` e `numeroSequencial: compra.numeroSequencial` aos payloads de `COMPRA_CONFIRMADA` e `DISPONIBILIDADE_GERADA`. Testar que confirmação emite uma vez e confirmação idempotente não duplica `COMPRA_CONFIRMADA`/`DISPONIBILIDADE_GERADA`; rollback de qualquer mutação emite zero evento.
- [ ] **GREEN:** `npm test -- compras-programadas --runInBand` → todos verdes, incluindo concorrência.
- [ ] **Commit:** `feat(onda11): numerar e listar multiplas compras por operacao`.

---

## Task 3 — SAM-112 T04 — Pool de disponibilidade e risco por operação

**Files:** DTO `disponibilidade.dto.ts:3-8`, service `:63-400`, `mapa.service.ts:49-58`, `recebimento.service.ts:588-594,674-681`, testes de recebimento e O11.

- [ ] **Step 1 — RED:** criar cenário com compras 001=6 e 002=4 do mesmo item/operação. Esperar listagem agregada total 10 e listagem `compraProgramadaId=002` total 4.
- [ ] **Step 2 — DTO:** adicionar `operacaoId?: uuid`. Exigir via `superRefine` pelo menos um entre `operacaoId`, `dataOperacao`, `compraProgramadaId` para evitar leitura global ambígua.
- [ ] **Step 3 — agregado.** Substituir `listar` por dois helpers:
  ```ts
  private async listarPorCompra(query: { dataOperacao?: string; compraProgramadaId: string }) {
    if (query.dataOperacao) {
      return this.db
        .select({
          modo: sql<'compra'>`'compra'`,
          id: disponibilidadesVirtuais.id,
          compraProgramadaId: disponibilidadesVirtuais.compraProgramadaId,
          operacaoId: disponibilidadesVirtuais.operacaoId,
          itemComercialId: disponibilidadesVirtuais.itemComercialId,
          quantidadeTotalGerada: disponibilidadesVirtuais.quantidadeTotalGerada,
          quantidadeReservada: disponibilidadesVirtuais.quantidadeReservada,
          quantidadeDisponivel: disponibilidadesVirtuais.quantidadeDisponivel,
          quantidadeRecebida: disponibilidadesVirtuais.quantidadeRecebida,
          quantidadeComDivergencia: disponibilidadesVirtuais.quantidadeComDivergencia,
          status: disponibilidadesVirtuais.status,
          createdAt: disponibilidadesVirtuais.createdAt,
          updatedAt: disponibilidadesVirtuais.updatedAt,
        })
        .from(disponibilidadesVirtuais)
        .innerJoin(operacoes, eq(operacoes.id, disponibilidadesVirtuais.operacaoId))
        .where(and(
          eq(operacoes.data, query.dataOperacao),
          eq(disponibilidadesVirtuais.compraProgramadaId, query.compraProgramadaId),
        ))
        .orderBy(disponibilidadesVirtuais.itemComercialId);
    }
    return this.db
      .select({
        modo: sql<'compra'>`'compra'`,
        id: disponibilidadesVirtuais.id,
        compraProgramadaId: disponibilidadesVirtuais.compraProgramadaId,
        operacaoId: disponibilidadesVirtuais.operacaoId,
        itemComercialId: disponibilidadesVirtuais.itemComercialId,
        quantidadeTotalGerada: disponibilidadesVirtuais.quantidadeTotalGerada,
        quantidadeReservada: disponibilidadesVirtuais.quantidadeReservada,
        quantidadeDisponivel: disponibilidadesVirtuais.quantidadeDisponivel,
        quantidadeRecebida: disponibilidadesVirtuais.quantidadeRecebida,
        quantidadeComDivergencia: disponibilidadesVirtuais.quantidadeComDivergencia,
        status: disponibilidadesVirtuais.status,
        createdAt: disponibilidadesVirtuais.createdAt,
        updatedAt: disponibilidadesVirtuais.updatedAt,
      })
      .from(disponibilidadesVirtuais)
      .where(eq(disponibilidadesVirtuais.compraProgramadaId, query.compraProgramadaId))
      .orderBy(disponibilidadesVirtuais.itemComercialId);
  }

  private listarAgregado(query: { operacaoId?: string; dataOperacao?: string }) {
    return this.db
      .select({
        modo: sql<'agregado'>`'agregado'`,
        operacaoId: disponibilidadesVirtuais.operacaoId,
        itemComercialId: disponibilidadesVirtuais.itemComercialId,
        quantidadeTotalGerada: sql<string>`sum(${disponibilidadesVirtuais.quantidadeTotalGerada})`,
        quantidadeReservada: sql<string>`sum(${disponibilidadesVirtuais.quantidadeReservada})`,
        quantidadeDisponivel: sql<string>`sum(${disponibilidadesVirtuais.quantidadeDisponivel})`,
        quantidadeRecebida: sql<string>`sum(${disponibilidadesVirtuais.quantidadeRecebida})`,
        quantidadeComDivergencia: sql<string>`sum(${disponibilidadesVirtuais.quantidadeComDivergencia})`,
        status: sql<string>`CASE
          WHEN sum(${disponibilidadesVirtuais.quantidadeDisponivel}) = 0 THEN 'esgotada'
          WHEN sum(${disponibilidadesVirtuais.quantidadeReservada}) > 0 THEN 'parcialmente_reservada'
          ELSE 'gerada' END`,
      })
      .from(disponibilidadesVirtuais)
      .innerJoin(operacoes, eq(operacoes.id, disponibilidadesVirtuais.operacaoId))
      .where(and(
        query.operacaoId ? eq(disponibilidadesVirtuais.operacaoId, query.operacaoId) : undefined,
        query.dataOperacao ? eq(operacoes.data, query.dataOperacao) : undefined,
      ))
      .groupBy(disponibilidadesVirtuais.operacaoId, disponibilidadesVirtuais.itemComercialId)
      .orderBy(disponibilidadesVirtuais.itemComercialId);
  }
  ```
  `listar()` chama `listarPorCompra({ dataOperacao: query.dataOperacao, compraProgramadaId: query.compraProgramadaId })` quando `compraProgramadaId` existe; caso contrário chama `listarAgregado(query)`.
- [ ] **Step 4 — risco:** trocar assinatura para `(tx, operacaoId, itemComercialId)`. A CTE `disp` filtra `operacao_id`; `reservas_ativas` entra por `pedidos_venda.operacao_id`; `total_recebido` soma todas as linhas da operação. O resultado usa o mesmo total recebido para pedidos da operação.
- [ ] **Step 5 — callers:** em `recebimento.service.ts`, passar `ctx.operacaoId`, não `ctx.compraProgramadaId`, nos dois pontos. `gerarParaCompra` e `aplicarRecebimentoDelta` permanecem byte a byte por compra.
- [ ] **Step 6 — falso positivo:** compra 001 recebe 4 de 6, compra 002 recebe 6 de 4, reserva total 10; `listarPedidosEmRisco` retorna `[]`. Com recebido total 9, retorna pedidos ativos da operação.
- [ ] **Step 7 — mapa:** não alterar SQL de `estadoV` em `mapa.service.ts:49-58`; adicionar teste que prova soma por operação entre duas compras.
- [ ] **GREEN:** `npm test -- recebimento disponibilidade mapa --runInBand` → verde.
- [ ] **Commit:** `feat(onda11): agregar disponibilidade e risco por operacao`.

---

## Task 4 — SAM-113 T05 — Pedido pertence à Operação

**Files:** `pedido.dto.ts:30-42`, `pedidos.service.ts:283-354`, testes `pedidos-reserva`/`pedidos-concorrencia`.

- [ ] **Step 1 — RED:** pedido enviado com `operacaoId` e sem compra cria; pedido enviado com compra legada cria e persiste `NULL`; compra complementar confirmada na mesma operação cobre novo item; compra em outra operação não cobre.
- [ ] **Step 2 — DTO:** substituir:
  ```ts
  compraProgramadaId: z.string().uuid(),
  clienteId: z.string().uuid(),
  dataOperacao: z.string().regex(...),
  ```
  por:
  ```ts
  compraProgramadaId: z.string().uuid().optional(),
  operacaoId: z.string().uuid().optional(),
  clienteId: z.string().uuid(),
  dataOperacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data da operação inválida — use o formato AAAA-MM-DD.').optional(),
  ```
  e `superRefine` exige `operacaoId || dataOperacao`.
- [ ] **Step 3 — resolver operação:** criar helper transacional. Com `operacaoId`, carregar operação ativa e, se `dataOperacao` também vier, exigir igualdade; sem `operacaoId`, usar `encontrarAtivaPorData`/`garantirOperacao` como hoje.
- [ ] **Step 4 — inserção:** substituir em `pedidos.service.ts:331-334`:
  ```ts
  compraProgramadaId: dto.compraProgramadaId,
  clienteId: dto.clienteId,
  operacaoId: operacao.id,
  ```
  por:
  ```ts
  // AD-14: campo legado aceito na borda e ignorado em pedidos novos.
  compraProgramadaId: null,
  clienteId: dto.clienteId,
  operacaoId: operacao.id,
  ```
- [ ] **Step 5 — motor preservado:** nenhum diff em `planejarSobLock:427-474`. O teste deve inspecionar reservas e provar duas `disponibilidade_virtual_id` de compras distintas para um pedido de 10 sobre lotes 6+4.
- [ ] **Step 6 — AD-05:** após esgotar 10, pedir 1 retorna `409 OVERBOOKING_CONFIRMACAO_NECESSARIA` sem mutação; endpoint confirmar persiste overbooking. AD-03 continua bloqueando cliente+item+operação duplicado.
- [ ] **GREEN:** `npm test -- pedidos-reserva pedidos-concorrencia --runInBand` → verde.
- [ ] **Commit:** `feat(onda11): desacoplar pedido de venda do lote`.

---

## Task 5 — SAM-114 T06 — Compatibilidade e bloqueio por Operação

**Files:** `compatibilidade.ts:20-84`, `associacao-score.ts:23-114`, `associacao.service.ts:55-100,374-398`, `troca-peca.service.ts`, `carga.service.ts:180-198`, testes unit/integration.

- [ ] **Step 1 — RED:** candidatos de compras 001/002 da mesma operação aparecem; candidato de outra operação não aparece. Associação explícita interoperação retorna mensagem exata. Overbooking não altera score.
- [ ] **Step 2 — params:** trocar `compraProgramadaId` por `operacaoId` e `compraProgramadaOrigemId`. Em `compatibilidade.ts`, importar `comprasProgramadas`, `reservasDisponibilidade`, `disponibilidadesVirtuais`; filtrar:
  ```ts
  eq(comprasProgramadas.operacaoId, params.operacaoId)
  ```
  com join `pedidosVenda.operacaoId` ou comparação direta, e projetar `cobertaPeloLote` por `EXISTS` de reserva ativa cuja disponibilidade pertence à compra de origem.
- [ ] **Step 3 — score:** ampliar `CandidatoPedido`:
  ```ts
  cobertaPeloLote: boolean;
  ```
  adicionar:
  ```ts
  const PESO_COBERTURA_LOTE = 5;
  if (c.cobertaPeloLote) {
    score += PESO_COBERTURA_LOTE;
    motivos.push('reserva coberta pelo lote de origem');
  }
  ```
  Fixtures recebem default `false`. Reserva overbooking não satisfaz o `EXISTS`.
- [ ] **Step 4 — associação:** obter operação da peça por join `comprasProgramadas`; passar operação+compra aos três cálculos. Em `buscarItemCompativel`, substituir:
  ```ts
  if (item.compraProgramadaId !== peca.compraProgramadaId) {
    throw new ConflictException('Pedido pertence a outra compra programada');
  }
  ```
  por comparação de operações e:
  ```ts
  throw new ConflictException('Pedido pertence a outra operação');
  ```
- [ ] **Step 5 — troca/carga:** Troca de Peça usa a mesma comparação de operação. Em `carga.service.ts:182-198`, substituir comparação `compraProgramadaId` por operação derivada e a mensagem pela literal acima. Não exigir motivo extra por cruzar lotes.
- [ ] **GREEN:** `npm test -- compatibilidade associacao-score associacao troca-peca expedicao --runInBand`.
- [ ] **Commit:** `feat(onda11): associar pecas livremente dentro da operacao`.

---

## Task 6 — SAM-115 T07 — Snapshot físico e composição por lote

**Files:** `pesagem.schema.ts:53-86`, todos os inserts localizados em `associacao.service.ts:417-444`, `troca-peca.service.ts:160-178`, `carga.service.ts:234-245`, `estoque/destinar.service.ts:84-138`; `pedidos.controller.ts`; `pedidos.service.ts`.

- [ ] **Step 1 — RED:** após confirmar/redirecionar/trocar/destinar, toda linha de histórico tem compra e recebimento de origem. Reusar a prova da Task 1: schema rejeita NULL e `trg_pecas_compra_programada_imutavel` rejeita troca do UUID; UPDATE de outro campo passa. Confirmar por busca estática que nenhum service contém `SET compra_programada_id` ou `.set({ compraProgramadaId:` para `pecas`.
- [ ] **Step 2 — helper obrigatório:** criar em `associacao.service.ts` helper que recebe `pecaId` e carrega `{ compraProgramadaId, recebimentoId }`; `gravarHistorico` sempre inclui ambos. Nos inserts diretos de troca/carga/estoque, carregar origem da peça ou `subitem→peca`.
- [ ] **Step 3 — endpoint:** em `PedidosController`, antes de `@Get(':id')`, adicionar:
  ```ts
  @Get(':id/composicao-lotes')
  @RequirePermissoes('PEDIDOS_LER')
  composicaoLotes(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.service.composicaoLotes(id, user.sub);
  }
  ```
- [ ] **Step 4 — service:** validar escopo do pedido e executar duas pernas (`pecas` atuais + `subitens` atuais via peça origem), unir por `UNION ALL`, agrupar por compra/recebimento, join `compras_programadas.numero_sequencial`, `count(*)`, `sum(peso)`, ordenar sequencial/recebimento. Não usar `pedidos_venda.compra_programada_id`.
- [ ] **Step 5 — prova 6+4:** associar seis peças da compra 001 e quatro da 002 ao mesmo pedido; endpoint retorna dois grupos `{numeroSequencial:1, quantidadeUnidades:6}` e `{numeroSequencial:2, quantidadeUnidades:4}`.
- [ ] **GREEN:** `npm test -- onda11-multicompra associacao troca-peca expedicao --runInBand`.
- [ ] **Commit:** `feat(onda11): carimbar e consultar origem fisica por lote`.

---

## Task 7 — SAM-116 T08 — BFF e contratos frontend

**Files:** `comercial.ts:10-169`, `operacao.ts:72-149,208-216`, `expedicao-ui.ts`; disponibilidade BFF `:1-12`; rota nova composição; teste BFF.

- [ ] **Step 1 — RED:** `GET /api/comercial/disponibilidade?dataOperacao=...&compraProgramadaId=...` deve chamar backend com ambos. Composição repassa status/body.
- [ ] **Step 2 — repasse:** substituir disponibilidade BFF:
  ```ts
  const dataOperacao = req.nextUrl.searchParams.get('dataOperacao');
  const qs = dataOperacao ? `?dataOperacao=${encodeURIComponent(dataOperacao)}` : '';
  ```
  por:
  ```ts
  const qs = req.nextUrl.searchParams.toString();
  const suffix = qs ? `?${qs}` : '';
  ```
- [ ] **Step 3 — tipos:** `CompraProgramada` ganha `numeroSequencial`, nomes do fornecedor e `totalItens`; `PedidoVenda.compraProgramadaId` e `CriarPedidoDto.compraProgramadaId` viram opcionais/nullables; `CriarPedidoDto` ganha `operacaoId`; criar união de disponibilidade D11.4 e `ComposicaoLotePedido`.
- [ ] **Step 4 — origem operacional:** acrescentar `numeroSequencialCompra`/`loteOrigem` aos tipos de recebimento, peça e item de expedição, espelhando respostas reais.
- [ ] **Step 5 — rota nova:** `src/app/api/comercial/pedidos/[id]/composicao-lotes/route.ts` usa `fetchBackend<ComposicaoLotePedido[]>` e não calcula agrupamento.
- [ ] **GREEN:** `npm test -- bff-disponibilidade --runInBand` no frontend.
- [ ] **Commit:** `feat(onda11): expor contratos multicompra no bff`.

---

## Task 8 — SAM-117 T09 — `/gestao/compras` master-detail DS v3

**Files:** `compras-client.tsx:78-558`, `compras-edit-modal.tsx`, `compras-client.test.tsx`.

- [ ] **Step 1 — RED:** testar duas compras do mesmo dia na lista, seleção por `?compraId=`, filtro backend `?dataOperacao=`, empty state, botão “Novo pedido de compra”, DatePicker habilitado e envelope de confirmação.
- [ ] **Step 2 — URL:** trocar leitura `searchParams.get('data')` por `dataOperacao`; ler `compraId`; ao selecionar compra, `router.replace('?dataOperacao=...&compraId=...')`.
- [ ] **Step 3 — fetch servidor:** substituir `carregarCompraDia` que busca 10 e usa `.find` (`:119-145`) por `carregarComprasDia`, chamando:
  ```ts
  /api/comercial/compras-programadas?dataOperacao=${dataOperacao}&pageSize=100
  ```
  armazenando a lista completa e selecionando apenas o deep-link ou primeiro item.
- [ ] **Step 4 — master-detail:** layout `lg:grid-cols-[320px_1fr]`; master com `Lote NNN`, Nome Fantasia/Razão Social, status, totalItens; detail conserva card cabeçalho, itens, disponibilidade e modal. Empty state literal:
  ```tsx
  <p>Nenhum pedido de compra para esta operação.</p>
  ```
  com ação “Novo pedido de compra”.
- [ ] **Step 5 — criação:** ação limpa seleção/formulário sem mudar data. DatePicker remove `disabled={Boolean(compra)}` e permanece habilitado. Remover qualquer tratamento do 409 de unicidade; manter apenas 409 de impacto na edição.
- [ ] **Step 6 — confirmar envelope:** substituir:
  ```ts
  setCompra(body as CompraProgramadaDetalhe);
  ```
  por:
  ```ts
  const confirmacao = body as ConfirmacaoCompraProgramada;
  setCompra(confirmacao.compra);
  ```
- [ ] **Step 7 — detalhe de disponibilidade:** carregar `?compraProgramadaId=${compra.id}` para o painel do detalhe; o master não mistura saldo de outros lotes.
- [ ] **Step 8 — realtime:** conectar à room da operação e refazer lista/detalhe ao receber qualquer um dos seis nomes reais: `compra_programada_criada`, `compra_programada_atualizada`, `compra_programada_cancelada`, `compra_programada_confirmada`, `disponibilidade_virtual_gerada`, `compra_programada_alterada_impacto`. Sem timer. O teste dispara cada nome e comprova a atualização; nomes abreviados não são usados.
- [ ] **Step 9 — terminologia:** fornecedor exibe `fornecedorNomeFantasia ?? fornecedorRazaoSocial`; grep de rótulo isolado “Marca” vazio.
- [ ] **GREEN:** `npm test -- compras-client --runInBand`.
- [ ] **Commit:** `feat(onda11): transformar compras em master detail multicompra`.

---

## Task 9 — SAM-118 T10 — Editor de pedido e overbooking

**Files:** `pedidos-client.tsx:92-132,241-249`, `pedido-editor.tsx:52-61,104-138,319-333,486-498`, `overbooking-client.tsx:302-316,350-363,440-488`, backend `overbooking/dto/overbooking.dto.ts:17-37`, `overbooking/overbooking.service.ts:516-584`; `pedidos-reserva.e2e-spec.ts`, testes frontend `onda4-pedidos` e `overbooking-client`.

- [ ] **Step 1 — RED:** catálogo passa a buscar `/api/operacoes`; selector usa `operacao.id`; payload do editor contém `operacaoId/dataOperacao` e não contém `compraProgramadaId`. No backend, `POST` de decisão `novo_pedido` sem `compraProgramadaId` retorna `200/201`, cria pedido com `compra_programada_id IS NULL` e `operacao_id` igual à operação destino. Repetir com `compraProgramadaId` extra no body e esperar o mesmo resultado: `z.object` faz strip da chave não declarada. No frontend, postergar envia exatamente `{ caminho: 'novo_pedido', operacaoDestinoId, quantidade }`; compra complementar continua enviando `compraProgramadaId` explicitamente.
- [ ] **Step 2 — parent:** trocar estado/prop `compras` por `operacoes: Operacao[]`; usar `listarOperacoes()` ou `/api/operacoes?limite=100`; não filtrar compras.
- [ ] **Step 3 — editor:** substituir estado `compraProgramadaId`/`compraSelecionada` por `operacaoId`/`operacaoSelecionada`. Substituir o bloco `pedido-editor.tsx:486-498` por:
  ```tsx
  <FormField label="Operação" htmlFor="pedido-operacao">
    <SelectNative
      id="pedido-operacao"
      value={operacaoId}
      disabled={Boolean(pedido) || !podeGerenciar}
      onChange={(event) => setOperacaoId(event.target.value)}
    >
      <option value="">Selecione</option>
      {operacoes.map((operacao) => (
        <option key={operacao.id} value={operacao.id}>
          {operacao.rotulo} — {operacao.data}
        </option>
      ))}
    </SelectNative>
  </FormField>
  ```
- [ ] **Step 4 — payload:** trocar:
  ```ts
  compraProgramadaId: compraSelecionada.id,
  clienteId,
  dataOperacao: compraSelecionada.dataOperacao,
  ```
  por:
  ```ts
  operacaoId: operacaoSelecionada.id,
  clienteId,
  dataOperacao: operacaoSelecionada.data,
  ```
- [ ] **Step 5 — DTO overbooking literal:** em `overbooking.dto.ts`, substituir:
  ```ts
  // old_string
  z.object({
    caminho: z.literal('novo_pedido'),
    operacaoDestinoId: z.string().uuid(),
    compraProgramadaId: z.string().uuid(),
    quantidade: z.string().regex(/^\d+(\.\d{1,3})?$/),
    observacao: z.string().trim().max(500).optional(),
  }),
  ```
  por:
  ```ts
  // new_string
  z.object({
    caminho: z.literal('novo_pedido'),
    operacaoDestinoId: z.string().uuid(),
    quantidade: z.string().regex(/^\d+(\.\d{1,3})?$/),
    observacao: z.string().trim().max(500).optional(),
  }),
  ```
  Não aplicar `.strict()`: Zod 4 mantém o comportamento padrão de strip, portanto `compraProgramadaId` extra é ignorado e não chega ao service.
- [ ] **Step 6 — service overbooking literal:** em `aplicarNovoPedido`, remover integralmente:
  ```ts
  // old_string
  const compra = await tx.select({ id: comprasProgramadas.id }).from(comprasProgramadas)
    .where(and(
      eq(comprasProgramadas.id, dto.compraProgramadaId),
      eq(comprasProgramadas.operacaoId, destino.id),
      ne(comprasProgramadas.status, 'cancelada'),
      isNull(comprasProgramadas.deletedAt),
    )).then((r) => r[0]);
  if (!compra) {
    throw new ConflictException('Compra programada não pertence à operação de destino ou está cancelada');
  }
  ```
  Substituir a chamada:
  ```ts
  // old_string
  const novoPedido = await this.pedidos.criarNaTx(tx, {
    compraProgramadaId: compra.id,
    clienteId: pendencia.clienteId,
    dataOperacao: destino.data,
    observacoesGerais: motivo,
    salvarComoRascunho: false,
  ```
  por:
  ```ts
  // new_string
  const novoPedido = await this.pedidos.criarNaTx(tx, {
    operacaoId: destino.id,
    clienteId: pendencia.clienteId,
    dataOperacao: destino.data,
    observacoesGerais: motivo,
    salvarComoRascunho: false,
  ```
  preservando literalmente o array `itens` e os argumentos finais existentes. Na Task 4, `criarNaTx` grava `compraProgramadaId: null`; não passar essa propriedade neste call site. Em `detalhe`, substituir:
  ```ts
  // old_string
  operacaoDestinoId: destino.id,
  compraProgramadaId: compra.id,
  itemOrigemRemovido: ehZero(novaQuantidade),
  novoPedidoId: novoPedido.pedido.id,
  ```
  por:
  ```ts
  // new_string
  operacaoDestinoId: destino.id,
  itemOrigemRemovido: ehZero(novaQuantidade),
  novoPedidoId: novoPedido.pedido.id,
  ```
  Remover `comprasProgramadas` do import de schema; manter `ne` porque ele continua usado em outros métodos do mesmo service.
- [ ] **Step 7 — frontend overbooking literal:** “Compra complementar” conserva o payload atual com `compraProgramadaId: c.compraProgramadaId`. No card de “Postergar”, substituir:
  ```tsx
  // old_string
  {cobertura?.proximaOperacao && cobertura.comprasComplementares[0] ? (
  ```
  por:
  ```tsx
  // new_string
  {cobertura?.proximaOperacao ? (
  ```
  No conteúdo do modal, substituir:
  ```tsx
  // old_string
  {selecionada && cobertura?.proximaOperacao && cobertura.comprasComplementares[0] && (
  ```
  por:
  ```tsx
  // new_string
  {selecionada && cobertura?.proximaOperacao && (
  ```
  No handler, substituir:
  ```ts
  // old_string
  if (!selecionada || !cobertura?.proximaOperacao || !cobertura.comprasComplementares[0]) return;
  void decidir({
    caminho: 'novo_pedido',
    operacaoDestinoId: cobertura.proximaOperacao.id,
    compraProgramadaId: cobertura.comprasComplementares[0].compraProgramadaId,
    quantidade: Number(qtdPostergar).toFixed(3),
  });
  ```
  por:
  ```ts
  // new_string
  if (!selecionada || !cobertura?.proximaOperacao) return;
  void decidir({
    caminho: 'novo_pedido',
    operacaoDestinoId: cobertura.proximaOperacao.id,
    quantidade: Number(qtdPostergar).toFixed(3),
  });
  ```
- [ ] **GREEN:** `npm test -- onda4-pedidos overbooking-client --runInBand`.
- [ ] **Commit:** `feat(onda11): selecionar operacao real em pedidos`.

---

## Task 10 — SAM-119 T11 — Origem visível em quatro fluxos

**Files:** backend `recebimento.service.ts:57-70,165-218,240-284`, `liberacao.service.ts:300-423`; frontend recebimento/pesagem/pedido/carga e testes.

- [ ] **Step 1 — backend recebimento:** incluir `comprasProgramadas.numeroSequencial` nos selects e respostas `RecebimentoResumoEnriquecido`, previsão e detalhe. `codigoLote` público passa a `Lote ${NNN}`; `id` continua UUID técnico.
- [ ] **Step 2 — pesagem:** `RecebimentoDetalhe` expõe `numeroSequencialCompra`; lote bar em `pesagem-destinacao-client.tsx:516-595` mostra `Lote 001`, e o selector lista `Lote 001 — fornecedor`.
- [ ] **Step 3 — pedido:** consumir composição e renderizar card “Origem do atendimento” com linhas `Lote 001 · 6 peças · X kg`; estado vazio “Nenhuma peça associada”.
- [ ] **Step 4 — expedição:** em `liberacao.service.ts:300-340`, projetar `numeroSequencial` em peças/subitens via compra da peça; resposta inclui `loteOrigem`. Renderizar `Lote 001` sob cada peça nas telas planejamento, conferência e enviar faturamento.
- [ ] **Step 5 — recebimento:** substituir fallback UUID em `recebimento-carga-client.tsx:859-865` por `Lote ${String(numeroSequencialCompra).padStart(3,'0')}`. Não usar `slice(0,8)` como lote.
- [ ] **Step 6 — etiqueta:** não alterar `EtiquetaService.montarPayload`, `etiquetas_impressoes.payload` ou layout. Criar `docs/evidencias/onda11-multicompra/PENDENCIA-ETIQUETA.md` com: “v1.1 §16.12: o payload/layout físico não possui campo canônico de lote; inclusão exige decisão registrada. Onda 11 preserva o layout.”
- [ ] **GREEN:** testes React de recebimento/pesagem/carga/pedido verdes.
- [ ] **Commit:** `feat(onda11): exibir origem sequencial do lote nos fluxos`.

---

## Task 11 — SAM-120 T12 — Regressão, Playwright, evidências e matriz

**Files:** testes integration existentes, novo `onda11-multicompra.e2e-spec.ts`, `onda5-gestao.spec.ts:211-223`, Playwright O11, evidências e matriz.

- [ ] **Step 1 — inverter teste legado:** o teste `compras-programadas.e2e-spec.ts:202-228` passa a afirmar N compras, não erro.
- [ ] **Step 2 — cenários backend obrigatórios no novo spec:** reserva FIFO 6+4 em duas disponibilidades; pedido legado nullable; continuidade física 6 peças do lote 001 + 4 do 002; composição/snapshots; score; bloqueio interoperações; conferência tripla independente dos dois lotes; risco sem falso positivo; 20 compras concorrentes com sequenciais únicos; tentativa de NULL em `pecas.compra_programada_id` rejeitada por NOT NULL; troca do UUID rejeitada por `trg_pecas_compra_programada_imutavel`; UPDATE de outro campo da peça permitido; overbooking AD-05; decisão `novo_pedido` sem compra cria pedido na operação destino com compra NULL e chave extra `compraProgramadaId` é ignorada.
- [ ] **Step 3 — helper Playwright:** substituir `selecionarDataCompras` em `onda5-gestao.spec.ts:211-223` para navegar:
  ```ts
  await page.goto(`/gestao/compras?dataOperacao=${dataOperacao}&compraId=${compraId}`);
  await expect(page.getByText(/Lote 001/)).toBeVisible();
  ```
  sem escrever no DatePicker para forçar seleção.
- [ ] **Step 4 — Playwright O11:** criar duas compras no mesmo dia, confirmar ambas, abrir master-detail/deep-link, criar pedido pela operação, associar peças dos dois lotes e verificar origem em quatro telas. Capturar os quatro PNGs listados na estrutura.
- [ ] **Step 5 — evidência:** gerar `index.html` com SHA da branch, data, IDs reais, comandos/resultados, links locais aos PNGs, referência AD-10/DS v3 e pendência da etiqueta.
- [ ] **Step 6 — emenda da matriz:** aplicar exatamente a seção “Emenda à matriz de rastreabilidade” ao final deste plano.
- [ ] **Step 7 — estáticos:**
  ```powershell
  rg "planejarSobLock" app/backend/src/modules/comercial/pedidos/pedidos.service.ts
  rg "compraProgramadaId:\s+uuid\('compra_programada_id'\)\.notNull" app/backend/src/database/schema/pesagem.schema.ts
  rg "trg_pecas_compra_programada_imutavel|pecas_impedir_mutacao_compra_programada" app/backend/src/database/migrations/0030_onda11_multicompra_contract.sql
  rg "SET\s+compra_programada_id|\.set\(\{\s*compraProgramadaId" app/backend/src/modules
  rg "setInterval|setTimeout\(.*carregar|poll" app/frontend/src/app app/frontend/src/lib
  rg "\bMarca\b" app/frontend/src/app/(admin)/gestao/compras app/frontend/src/app/(admin)/comercial/pedidos
  ```
  Esperado: motor presente e sem diff; peça NOT NULL presente; função e trigger presentes em 0030; busca por mutação da coluna física vazia; zero polling novo; zero rótulo isolado banido.
- [ ] **GREEN:** todos os cenários e evidências presentes.
- [ ] **Commit:** `test(onda11): cobrir jornada multicompra ponta a ponta`.

---

## Gate local completo + abertura do PR

Executar serialmente no worktree de implementação:

```powershell
$env:HARDWARE_FAKE='1'
$env:NFSE_FAKE='1'
npm ci
npm run lint
npm run type-check
npm run test
Set-Location app/backend
npm run test:cov
npx drizzle-kit check
Set-Location ../frontend
npm run test
npx playwright test e2e/onda5-gestao.spec.ts e2e/onda11-multicompra.spec.ts
Set-Location ../..
docker compose up --build -d
docker compose ps
```

Saída esperada:

- lint/type-check sem erros;
- backend/frontend Jest verdes;
- cobertura backend ≥80% linhas e branches;
- drizzle-kit `Everything's fine`;
- Playwright verde e 4 PNGs + `index.html`;
- `postgres`, `backend`, `frontend` saudáveis;
- `http://localhost:4000`, `http://localhost:4001`, `localhost:15433` acessíveis;
- portas internas continuam `3000/3001/5432`.

Conferir escopo:

```powershell
git status --short
git diff --check
git diff --name-only origin/develop...HEAD
```

Nenhum arquivo fora da estrutura deste plano. Então:

```powershell
git push -u origin feature/onda11-multiplas-compras-por-operacao
gh pr create --base develop --head feature/onda11-multiplas-compras-por-operacao --title "feat: múltiplas compras por operação" --body-file .codex/runtime/onda11-pr-body.md
gh pr checks --watch
```

O body registra AD-14, SHA base/head, migrations/hashes, comandos/resultados, DOD11-01..24, evidências e ausência de mudança em `pecas.compra_programada_id`. Oito jobs canônicos obrigatoriamente verdes. Vercel não é gate porque o diff não toca `landing/**`.

---

## Self-Review

- [ ] AD-14 aplicada sem reabertura.
- [ ] `pecas.compra_programada_id` continua NOT NULL e o trigger contract rejeita troca de UUID; UPDATE de outro campo continua permitido.
- [ ] Cadeia física continua por lote; conferências dos lotes são independentes.
- [ ] `listarPedidosEmRisco` usa operação, não compra.
- [ ] Sequencial concorrente usa lock da operação + índice parcial; zero sucesso silencioso.
- [ ] `planejarSobLock` não tem diff.
- [ ] `uq_disp_compra_item` não tem diff.
- [ ] Os seis eventos usam nomes reais; criar/atualizar/cancelar emitem uma vez pós-commit e rollback não emite; zero polling.
- [ ] AD-03/AD-05 preservadas.
- [ ] BFF sem regra de negócio.
- [ ] DS v3/AD-10 citado por tela; protótipo inacessível não foi usado.
- [ ] `/gestao/compras` entrega master, detalhe, criação, edição, confirmação, deep-link, filtro e empty state.
- [ ] Origem “Lote NNN” aparece em pesagem, pedido, expedição e recebimento.
- [ ] Etiqueta física não foi alterada; pendência explícita registrada.
- [ ] Zero rótulo isolado “Marca”.
- [ ] Matriz atualizada com texto literal abaixo.
- [ ] Gate local, Docker e oito checks concluídos.

---

## Emenda à matriz de rastreabilidade

A matriz atual **não possui linha “Onda 11”**. A linha 10 (`docs/superpowers/plans/2026-07-22-matriz-rastreabilidade-v1.1.md:30`) ainda descreve `/gestao/compras` sob o modelo de uma compra e não menciona pool por operação, sequencial nem composição física por lote.

Na Task 11, substituir a linha 10 inteira pelo texto literal:

```markdown
| 10 | `/gestao/compras` | Compras / Pedidos de Compra em master-detail (N compras por Operação, `numero_sequencial`, desdobramento Boi Casado, edição com painel de impacto) | `comercial/compras-programadas` (+ `operacoes`, `disponibilidade`) | `compras_programadas`, `compras_programadas_itens`, `operacoes`, `regras_desdobramento_comercial`, `disponibilidades_virtuais` | CRUD + `/confirmar`, `GET /:id/impacto`, filtros `operacaoId`/`dataOperacao`/`status`/`fornecedorId`; eventos `COMPRA_CRIADA`, `COMPRA_ATUALIZADA`, `COMPRA_CANCELADA`, `COMPRA_CONFIRMADA`, `DISPONIBILIDADE_GERADA`, `COMPRA_ALTERADA_IMPACTO` pós-commit | `compras`, `gestor`, `administrador`; consulta: `comercial` | **Conforme — Onda 11 / AD-14** | AD-14; AD-10; v1.1 §6.1/§8.3; doc 04 §2.2 | N compras por operação com sequencial concorrente; disponibilidade comercial agregada como pool `(operacao, item_comercial)` e reserva FIFO entre compras. Pedido de venda pertence à operação (`compra_programada_id` legado nullable). Cadeia física permanece por lote: pedido ao fornecedor, recebimento, NF, conferência tripla e `pecas.compra_programada_id` obrigatório/imutável por trigger. UI master-detail fiel ao DS v3 (AD-10). Composição do boi casado permanece AD-01: 2 TZ + 2 DT + 2 PA. |
```

Acrescentar em “Mecânicas transversais”, após “Consumo automático físico → virtual → overbooking”, a linha literal:

```markdown
| Pool comercial multicompra + rastreabilidade física por lote | `comercial/pedidos`, `comercial/disponibilidade`, `operacao/pesagem`, `operacao/recebimento`, `operacao/expedicao` | `pedidos_venda`, `reservas_disponibilidade`, `disponibilidades_virtuais`, `pecas`, `associacoes_peca_historico` | **Conforme — Onda 11 / AD-14** | AD-14 | Reserva comercial por operação pode atravessar lotes; risco é calculado no escopo da operação. Associação peça→pedido é livre dentro da operação, com origem `compra_programada_origem_id` + `recebimento_origem_id`; `pecas.compra_programada_id` permanece NOT NULL e imutável. |
```

Atualizar o cabeçalho “Mecânicas transversais” de 6 para 7 na distribuição/checagem final, sem alterar a contagem de 41 rotas.

---

**requires-human:** nenhum. Todas as decisões funcionais usadas estão cobertas por AD-14, AD-10, AD-03, AD-05 e pelas fontes vigentes.
