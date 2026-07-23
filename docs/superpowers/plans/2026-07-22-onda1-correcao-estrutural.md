# Onda 1 — Correção Estrutural — Plano de Implementação

> **Para workers agênticos:** SUB-SKILL OBRIGATÓRIA: usar `superpowers:subagent-driven-development` ou `superpowers:executing-plans`. Executar as Tasks na ordem, com TDD. Se um trecho literal não casar com o código, um teste continuar falhando após uma correção ou uma pré-condição não existir, parar e reportar ao Executor.
> **Pré-condição processual:** a Onda 0 deve estar concluída em `docs/execucao/EXECUCAO-STATUS.md`. Este plano não autoriza o Worker a alterar esse arquivo.

**Goal:** Corrigir integralmente D2 (Operação como pivô), D1 (overbooking v1.1 conforme AD-05), D3 (Pedido ao Fornecedor, NF própria e conferência Pedido×NF×Pesagem), D5 (terminologia) e absorver as decisões AD-03..AD-06 sem alterar visualmente as telas.

> **Escopo — D9 fora desta onda (concluído):** a divergência **D9 (instruções canônicas em `AGENTS.md` + `CLAUDE.md` de compatibilidade)** já foi **entregue antes da Onda 1** pelo **PR [#11](https://github.com/sammuka/alpha-carnes/pull/11)** (squash `8b2958ef992e1243015cd7f0507310dbac9706e0`). Não há Task de implementação de D9 neste plano e nenhuma será criada; a linha da Onda 1 em `EXECUCAO-STATUS.md` e no roadmap §8 é reescopada para refletir D9 como concluída por PR #11. As Tasks abaixo cobrem apenas D1, D2, D3 e D5.

**Architecture:** Monólito modular NestJS. `operacoes` passa a ser a única referência persistida do dia operacional. A migração é exatamente `0012 expand → 0013 custom backfill → 0014 contract`; o contract remove `data_operacao` das seis tabelas de fato, remove o cache `nfe_*` de `recebimentos` e torna as novas FKs obrigatórias. APIs que ainda expõem `dataOperacao` derivam `operacoes.data`. Challenge de overbooking é consulta transacional com lock e resposta 409 sem escrita; confirmação é comando explícito e atômico. Eventos são emitidos somente após commit.

**Tech Stack:** Node 22, NestJS 11, TypeScript strict, Drizzle ORM 0.45 + drizzle-kit 0.31, PostgreSQL 18, Zod 4, Jest com PostgreSQL real e `maxWorkers: 1`, Next.js 16 BFF.

**Branch:** `feature/onda1-correcao-estrutural`

## Global Constraints

- Constituição I–X, com ênfase em II, III, IV, VI, VIII, IX e X.
- AD-03: unicidade do pedido aberto será `(cliente, produto, operação)` na Onda 4; nesta onda o catálogo registra a decisão sem badge.
- AD-04: permanecem 11 perfis; esta onda não cria perfil.
- AD-05: tentativa deficitária retorna `409 OVERBOOKING_CONFIRMACAO_NECESSARIA` e não persiste pedido, item, reserva, saldo ou pendência; confirmação retorna `201` na criação ou `200` na inclusão/aumento e nunca bloqueia `finalizar`.
- AD-06: não existe TTL, cron ou job para liberar reserva. Remoção/cancelamento continua explícito; a ação administrativa entra na Onda 4.
- P1 permanece aberta: `operacao.cadencia_dias_semana` carrega `{ provisorio: true, ref: 'P1/v1.1 §16.2' }`.
- Nenhuma alteração visual além de `"Buscar cliente / marca…"` → `"Buscar cliente"`. BFFs preservam a forma de apresentação.
- Cobertura dos services tocados ≥80% em linhas e branches.
- Nenhum hex, token ou componente visual é criado nesta onda.

## Decisões de design fixadas

1. `operacoes.data` é única entre registros ativos. `ON CONFLICT` deve respeitar o índice parcial: Drizzle usa `.onConflictDoNothing()` sem target; SQL usa `ON CONFLICT (data) WHERE deleted_at IS NULL DO NOTHING`.
2. `operacao_id` é nullable somente em `0012`; o backfill preenche todos os registros; `0014` aplica `NOT NULL` e remove `data_operacao`.
3. Cada writer das seis tabelas resolve uma Operação na mesma transação e grava `operacao_id`: compra, disponibilidade, pedido, recebimento, caminhão e faturamento.
4. APIs/eventos que precisam da data obtêm `operacoes.data AS data_operacao`; nenhuma tabela de fato mantém cópia.
5. O challenge de overbooking bloqueia as linhas de disponibilidade com `FOR UPDATE`, calcula a alocação, não executa INSERT/UPDATE e lança `OverbookingChallengeException`. A transação termina por rollback.
6. A confirmação reavalia o saldo corrente sob o mesmo lock. Parcela coberta gera reserva `virtual`; déficit gera reserva `overbooking` sem `disponibilidade_virtual_id` e pendência na mesma transação.
7. Redução consome primeiro a parcela overbooking. Só a redução excedente devolve saldo real. Remoção/cancelamento libera as duas reservas, mas apenas `fisico|virtual` credita disponibilidade; a pendência é cancelada com histórico.
8. `finalizar` aceita item `overbooking_confirmado`; só rejeita challenge legado ainda não confirmado.
9. Pedido ao Fornecedor materializa uma compra confirmada e usa os itens comerciais gerados pelo desdobramento. O modelo aceita várias NFs e vários recebimentos por pedido, sem decidir P7.
10. NF legada sem itens não ganha valores inferidos. `0013` migra o cabeçalho e marca `payload_json.migracao='legado_sem_itens_nf'`; uma conferência ainda aberta exige carga explícita dos itens da NF.
11. Caixaria/entrada direta usa `recebimentos_itens.quantidade_recebida`; item com `requer_balanca=true` usa `COUNT(pecas)` e `SUM(pecas.peso_original)`, agrupando por `pecas.item_comercial_base_id` e filtrando `pecas.deleted_at IS NULL` (nomes reais em `pesagem.schema.ts`; não existem `pecas.item_comercial_id` nem `pecas.peso_liquido`).
12. Divergências novas usam `falta | excesso | peso_divergente | produto_nao_previsto | outro`, sempre referenciam a conclusão e referenciam uma NF quando a diferença é atribuível a uma única nota; `conclusoes_conferencia_nfs` preserva o conjunto completo.
13. `conclusoes_conferencia` é append-only: não possui rota de edição, e segunda conclusão retorna 409.
14. As migrations são criadas apenas pelos três comandos definidos neste plano. É proibido renomear SQL ou editar `meta/_journal.json` à mão.

## Referências do protótipo

| Contrato/tela tocada | Arquivo-fonte no protótipo `feature/completude-v1.1` | Uso nesta onda |
|---|---|---|
| Operações | `src/app/data/operacoes.ts` | campos e status da entidade |
| Pedidos / modal de overbooking | `src/app/pages/PedidoVenda.tsx` | payload e microcopy do challenge |
| Recebimento | `src/app/pages/RecebimentoCarga.tsx` | quadro triplo, caixarias por unidade e estados |
| Aprovações | `src/app/pages/Aprovacoes.tsx` | ocorrência imutável e vínculo administrativo |
| Pesagem e Destinação | `src/app/pages/PesagemDestinacao.tsx` | string validada `placeholder="Buscar cliente"` |

## Estrutura de arquivos

```text
app/backend/src/
  database/schema/
    operacoes.schema.ts
    pedidos.schema.ts
    pendencias-overbooking.schema.ts
    pedidos-fornecedor.schema.ts
    notas-fiscais-fornecedor.schema.ts
    conclusoes-conferencia.schema.ts
    compras-programadas.schema.ts
    disponibilidades-virtuais.schema.ts
    recebimentos.schema.ts
    expedicao.schema.ts
    faturamento.schema.ts
    index.ts
  database/migrations/
    0012_onda1_expand.sql
    0013_onda1_backfill.sql
    0014_onda1_contract.sql
    meta/_journal.json
    meta/0012_snapshot.json
    meta/0014_snapshot.json
    ROLLBACK.md
  modules/operacoes/{operacoes.module.ts,operacoes.controller.ts,operacoes.service.ts,dto/operacao.dto.ts}
  modules/comercial/compras-programadas/compras-programadas.service.ts
  modules/comercial/disponibilidade/disponibilidade.service.ts
  modules/comercial/pedidos/{pedidos.service.ts,pedidos.controller.ts,pedidos.module.ts,dto/pedido.dto.ts,overbooking-challenge.exception.ts}
  modules/comercial/overbooking/{overbooking.module.ts,overbooking.controller.ts,overbooking.service.ts,dto/pendencia.dto.ts}
  modules/operacao/recebimento/{recebimento.service.ts,recebimento.controller.ts,recebimento.module.ts,pedido-fornecedor.service.ts,pedido-fornecedor.controller.ts,conferencia.service.ts}
  modules/operacao/recebimento/dto/{recebimento.dto.ts,pedido-fornecedor.dto.ts,conferencia.dto.ts}
  modules/operacao/expedicao/caminhao.service.ts
  modules/operacao/faturamento/consolidacao.service.ts
  modules/gestao/dashboard/dashboard.service.ts
  modules/operacao/corte/{corte.service.ts,subitem.service.ts}
  modules/operacao/pesagem/{pesagem.service.ts,associacao.service.ts}
  modules/operacao/expedicao/{caminhao.service.ts,carga.service.ts,conferencia.service.ts,fechamento.service.ts,liberacao.service.ts}
  modules/operacao/faturamento/{consolidacao.service.ts,faturamento.service.ts}
  common/rbac/permissoes.ts
  common/crud/decimal.ts
  database/seed.ts
  realtime/events/eventos.ts
  realtime/realtime.gateway.ts
app/backend/test/
  integration/{operacoes,operacoes-writers,onda1-migrations,pedidos-v11,overbooking,overbooking-lifecycle,overbooking-concorrencia,pedido-fornecedor,conferencia-tripla}.e2e-spec.ts
  unit/{operacoes.service,pedidos-eventos-onda1,conferencia.calc,decimal-onda1}.spec.ts
app/frontend/src/
  app/api/comercial/pedidos/route.ts
  app/api/comercial/pedidos/confirmar-overbooking/route.ts
  app/api/comercial/pedidos/[id]/itens/route.ts
  app/api/comercial/pedidos/[id]/itens/confirmar-overbooking/route.ts
  app/api/comercial/pedidos/[id]/finalizar/route.ts
  app/api/comercial/overbooking/{route.ts,[id]/route.ts,[id]/decisao/route.ts}
  app/api/operacao/pedidos-fornecedor/{route.ts,[id]/route.ts}
  app/api/operacao/recebimentos/[id]/{nf,concluir-pesagem,conferencia,conferencia/concluir}/route.ts
  lib/{comercial,operacao}.ts
  app/(admin)/recebimento/pesagem-destinacao/pesagem-destinacao-client.tsx
app/frontend/__tests__/{api,terminologia}.test.ts
```

## Mapa DoD → teste

| Invariante | Teste exato |
|---|---|
| Operação única por data e cadência idempotente | `operacoes.e2e-spec.ts` — `unique ativa; gerar duas vezes cria zero na segunda execução` |
| `0012→0013→0014` em banco limpo e legado | `onda1-migrations.e2e-spec.ts` — `journal aplica os três arquivos em ordem` |
| `0012` amplia CHECKs de status ao superset antes do backfill (aceita legado e novo) | `onda1-migrations.e2e-spec.ts` — `0012 amplia CHECKs de status para o superset` |
| Microcopy do challenge idêntica ao protótipo (`PedidoVenda.tsx:229`) | `pedidos-v11.e2e-spec.ts` — payload 409 contém `"A venda poderá ser concluída, mas a gestão deverá tratar a falta."` |
| Seis writers gravam `operacao_id` | `operacoes-writers.e2e-spec.ts` — seis casos nomeados por tabela |
| `data_operacao` e cache `nfe_*` não existem após contract | `onda1-migrations.e2e-spec.ts` — consulta `information_schema.columns` |
| Challenge 409 não executa escrita nem muta seis agregados | `pedidos-v11.e2e-spec.ts` — spy de SQL sem `INSERT/UPDATE/DELETE` + snapshot antes/depois de operação, pedido, item, reserva, saldo, pendência |
| Confirmação 201/200 cria reserva+pendência atomicamente | `overbooking.e2e-spec.ts` — criação e inclusão, com falha injetada |
| Concorrência nunca negativiza/reutiliza saldo; payload duplicado é rejeitado | `overbooking-concorrencia.e2e-spec.ts` + `pedidos-v11.e2e-spec.ts` |
| Reduzir/remover/cancelar não credita overbooking ao saldo | `overbooking-lifecycle.e2e-spec.ts` |
| Pedido confirmado com falta finaliza | `pedidos-v11.e2e-spec.ts` — `finalizar overbooking_confirmado retorna 200` |
| Recebimento exige Pedido ao Fornecedor | `pedido-fornecedor.e2e-spec.ts` |
| Migração não inventa itens de NF legada | `onda1-migrations.e2e-spec.ts` |
| Caixaria usa quantidade; pesável usa peças/peso | `conferencia-tripla.e2e-spec.ts` |
| Conclusão imutável e divergência transacional | `conferencia-tripla.e2e-spec.ts` |
| RBAC das permissões novas | um caso 403 em cada suíte de endpoint |
| Eventos somente pós-commit | `pedidos-eventos-onda1.spec.ts` e suítes de integração com rollback |
| Zero rótulo banido | `app/frontend/__tests__/terminologia.test.ts` via AST |

---

## Task 1 — Expand completo e migration 0012

**Files:** todos os schemas listados na estrutura, `schema/index.ts`, migration e snapshot gerados.

- [ ] Escrever primeiro os testes de schema em `onda1-migrations.e2e-spec.ts`:

```typescript
it('0012 cria estruturas sem remover colunas legadas', async () => {
  await migrarAte('0012_onda1_expand');
  await expectColuna('pedidos_venda', 'operacao_id', { nullable: true });
  await expectColuna('recebimentos', 'pedido_fornecedor_id', { nullable: true });
  await expectTabela('pendencias_overbooking');
  await expectTabela('pedidos_fornecedor');
  await expectTabela('notas_fiscais_fornecedor');
  await expectTabela('conclusoes_conferencia');
  await expectTabela('conclusoes_conferencia_nfs');
  await expectColuna('recebimentos', 'data_operacao', { nullable: false });
});
```

- [ ] Criar `operacoes.schema.ts`:

```typescript
export const operacoes = pgTable('operacoes', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  data: date('data').notNull(),
  diaSemana: integer('dia_semana').notNull(),
  rotulo: text('rotulo').notNull(),
  status: text('status').notNull().default('aberta'),
  extraordinaria: boolean('extraordinaria').notNull().default(false),
  criadaPorId: uuid('criada_por_id').references(() => usuarios.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  check('chk_operacoes_status', sql`${t.status} IN ('aberta','em_andamento','fechada')`),
  check('chk_operacoes_dia_semana', sql`${t.diaSemana} BETWEEN 0 AND 6`),
  uniqueIndex('uq_operacoes_data').on(t.data).where(sql`${t.deletedAt} IS NULL`),
  index('idx_operacoes_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
]);
```

- [ ] Adicionar a FK nullable nos seis schemas:

```typescript
// Mesmo campo em compras_programadas, disponibilidades_virtuais, pedidos_venda,
// recebimentos, caminhoes e faturamentos durante o expand.
operacaoId: uuid('operacao_id').references(() => operacoes.id),

// recebimentos, nullable apenas no expand:
pedidoFornecedorId: uuid('pedido_fornecedor_id').references(() => pedidosFornecedor.id),
```

- [ ] Alterar `pedidos.schema.ts` e criar as pendências:

```typescript
// pedidos_venda_itens
quantidadeOverbooking: numeric('quantidade_overbooking', { precision: 15, scale: 3 }).notNull().default('0'),
deletedAt: timestamp('deleted_at', { withTimezone: true }),
// No callback de índices de pedidos_venda_itens:
uniqueIndex('uq_pedido_venda_item_comercial_ativo')
  .on(t.pedidoVendaId, t.itemComercialId)
  .where(sql`${t.deletedAt} IS NULL`),

// pedidos_venda
motivoCancelamento: text('motivo_cancelamento'),

// reservas_disponibilidade
disponibilidadeVirtualId: uuid('disponibilidade_virtual_id').references(() => disponibilidadesVirtuais.id),
tipoConsumo: text('tipo_consumo').notNull().default('virtual'),
// CHECK: tipo_consumo IN ('fisico','virtual','overbooking')
// CHECK: tipo_consumo='overbooking' OR disponibilidade_virtual_id IS NOT NULL
```

**Sequência de CHECKs (expand → backfill → contract), decisiva para a executabilidade.** O backfill `0013` grava status que os CHECKs legados rejeitam (`em_elaboracao_reserva_ativa`, `aguardando_confirmacao_overbooking` em `pedidos_venda`; `aguardando_confirmacao_overbooking` em `pedidos_venda_itens`; `pesagem_em_andamento`, `conferido_sem_divergencia`, `tratativa_administrativa_concluida` em `recebimentos`). Por isso, em `0012` os três CHECKs de status são **ampliados para um superset (valores legados ∪ valores finais)** antes de qualquer backfill; o contract `0014` os aperta ao conjunto final. As definições de CHECK nos arquivos de schema permanecem **legadas** durante as Tasks 1–6 (o snapshot do `0012` reflete o estado legado); a ampliação transitória do `0012` é **anexada à mão ao SQL gerado**, exatamente pelo idioma nomeado já provado em `0011_recebimento_simplificado.sql` (`DROP CONSTRAINT IF EXISTS "<nome>"` → `ADD CONSTRAINT "<nome>" CHECK (...)`), o que dispensa depender do diff de CHECK do drizzle-kit e é robusto a nome (os nomes reais são `chk_pedidos_venda_status`, `chk_pedidos_itens_status`, `chk_recebimentos_status`). O SQL literal está no bloco da Task 1. Somente em `0014`, os CHECKs do schema são trocados pelos finais e o `db:generate` emite o aperto; se o generate não o emitir, o mesmo idioma nomeado é anexado à mão (Task 7). Nenhum CHECK novo sobre `reservas_disponibilidade.tipo_consumo` é exigido no backfill: a coluna nasce com `DEFAULT 'virtual'` e seu CHECK entra apenas no contract.

```typescript
export const pendenciasOverbooking = pgTable('pendencias_overbooking', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  pedidoVendaId: uuid('pedido_venda_id').notNull().references(() => pedidosVenda.id),
  pedidoVendaItemId: uuid('pedido_venda_item_id').notNull().references(() => pedidosVendaItens.id),
  itemComercialId: uuid('item_comercial_id').notNull().references(() => itensComerciais.id),
  clienteId: uuid('cliente_id').notNull().references(() => clientes.id),
  vendedorUsuarioId: uuid('vendedor_usuario_id').notNull().references(() => usuarios.id),
  operacaoId: uuid('operacao_id').notNull().references(() => operacoes.id),
  quantidadeDeficit: numeric('quantidade_deficit', { precision: 15, scale: 3 }).notNull(),
  status: text('status').notNull().default('aberta'),
  decisaoJson: jsonb('decisao_json').notNull().default(sql`'{}'::jsonb`),
  responsavelId: uuid('responsavel_id').references(() => usuarios.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  check('chk_pend_ovb_deficit', sql`${t.quantidadeDeficit} > 0`),
  check('chk_pend_ovb_status', sql`${t.status} IN ('aberta','em_analise','compra_complementar_programada','redistribuicao_decidida','novo_pedido_criado','resolvida','cancelada')`),
  index('idx_pend_ovb_item').on(t.pedidoVendaItemId),
  index('idx_pend_ovb_operacao').on(t.operacaoId),
]);
```

- [ ] Criar Pedido ao Fornecedor, NF e conclusão com estas colunas vinculantes:

```typescript
export const pedidosFornecedor = pgTable('pedidos_fornecedor', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  numero: text('numero').notNull(),
  fornecedorId: uuid('fornecedor_id').notNull().references(() => fornecedores.id),
  operacaoId: uuid('operacao_id').notNull().references(() => operacoes.id),
  compraProgramadaId: uuid('compra_programada_id').notNull().references(() => comprasProgramadas.id),
  status: text('status').notNull().default('rascunho'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  check('chk_pedidos_fornecedor_status', sql`${t.status} IN ('rascunho','enviado','aguardando_recebimento','recebido','encerrado','cancelado')`),
  uniqueIndex('uq_pedidos_fornecedor_numero').on(t.numero).where(sql`${t.deletedAt} IS NULL`),
  index('idx_pedidos_fornecedor_fornecedor').on(t.fornecedorId),
  index('idx_pedidos_fornecedor_operacao').on(t.operacaoId),
  index('idx_pedidos_fornecedor_compra').on(t.compraProgramadaId),
]);

export const pedidosFornecedorItens = pgTable('pedidos_fornecedor_itens', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  pedidoFornecedorId: uuid('pedido_fornecedor_id').notNull().references(() => pedidosFornecedor.id),
  itemComercialId: uuid('item_comercial_id').notNull().references(() => itensComerciais.id),
  quantidadePrevista: numeric('quantidade_prevista', { precision: 15, scale: 3 }).notNull(),
  pesoPrevisto: numeric('peso_previsto', { precision: 10, scale: 3 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('uq_pedido_fornecedor_item').on(t.pedidoFornecedorId, t.itemComercialId)
    .where(sql`${t.deletedAt} IS NULL`),
  index('idx_pedido_fornecedor_item_comercial').on(t.itemComercialId),
]);
```

```typescript
export const notasFiscaisFornecedor = pgTable('notas_fiscais_fornecedor', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  pedidoFornecedorId: uuid('pedido_fornecedor_id').notNull().references(() => pedidosFornecedor.id),
  recebimentoId: uuid('recebimento_id').notNull().references(() => recebimentos.id),
  numero: text('numero').notNull(),
  serie: text('serie'),
  chave: text('chave'),
  dataEmissao: date('data_emissao'),
  pesoTotalDeclarado: numeric('peso_total_declarado', { precision: 10, scale: 3 }),
  payloadJson: jsonb('payload_json').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  index('idx_nf_fornecedor_pedido').on(t.pedidoFornecedorId),
  index('idx_nf_fornecedor_recebimento').on(t.recebimentoId),
  uniqueIndex('uq_nf_fornecedor_chave').on(t.chave).where(sql`${t.deletedAt} IS NULL AND ${t.chave} IS NOT NULL`),
]);

export const notasFiscaisFornecedorItens = pgTable('notas_fiscais_fornecedor_itens', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  nfId: uuid('nf_id').notNull().references(() => notasFiscaisFornecedor.id),
  itemComercialId: uuid('item_comercial_id').notNull().references(() => itensComerciais.id),
  quantidadeDeclarada: numeric('quantidade_declarada', { precision: 15, scale: 3 }).notNull(),
  pesoDeclarado: numeric('peso_declarado', { precision: 10, scale: 3 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('uq_nf_fornecedor_item').on(t.nfId, t.itemComercialId).where(sql`${t.deletedAt} IS NULL`),
  index('idx_nf_fornecedor_item_comercial').on(t.itemComercialId),
]);

export const conclusoesConferencia = pgTable('conclusoes_conferencia', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  recebimentoId: uuid('recebimento_id').notNull().references(() => recebimentos.id),
  quadroJson: jsonb('quadro_json').notNull(),
  resultado: text('resultado').notNull(),
  observacao: text('observacao'),
  concluidaPorId: uuid('concluida_por_id').notNull().references(() => usuarios.id),
  concluidaEm: timestamp('concluida_em', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_conclusao_recebimento').on(t.recebimentoId),
  check('chk_conclusao_resultado', sql`${t.resultado} IN ('sem_divergencia','com_divergencia')`),
]);

export const conclusoesConferenciaNfs = pgTable('conclusoes_conferencia_nfs', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  conclusaoId: uuid('conclusao_id').notNull().references(() => conclusoesConferencia.id),
  nfFornecedorId: uuid('nf_fornecedor_id').notNull().references(() => notasFiscaisFornecedor.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_conclusao_nf').on(t.conclusaoId, t.nfFornecedorId),
  index('idx_conclusao_nf_fornecedor').on(t.nfFornecedorId),
]);

// Append-only por contrato: conclusoes_conferencia não possui updated_at/deleted_at.
// A tabela de junção preserva N NFs por recebimento sem decidir o P7.
// divergencias_recebimento e ocorrencias_fornecedor ganham, nullable no expand:
conclusaoConferenciaId: uuid('conclusao_conferencia_id').references(() => conclusoesConferencia.id),
nfFornecedorId: uuid('nf_fornecedor_id').references(() => notasFiscaisFornecedor.id),
// divergencias_recebimento também ganha item_comercial_id nullable no expand;
// recebimento_item_id passa a nullable para representar produto não previsto.
itemComercialId: uuid('item_comercial_id').references(() => itensComerciais.id),
recebimentoItemId: uuid('recebimento_item_id').references(() => recebimentosItens.id),
```

```typescript
export const pendenciasOverbookingHistorico = pgTable('pendencias_overbooking_historico', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  pendenciaId: uuid('pendencia_id').notNull().references(() => pendenciasOverbooking.id),
  acao: text('acao').notNull(),
  autorId: uuid('autor_id').notNull().references(() => usuarios.id),
  detalheJson: jsonb('detalhe_json').notNull().default(sql`'{}'::jsonb`),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('idx_pend_ovb_hist_pendencia').on(t.pendenciaId)]);
```

- [ ] Gerar somente após todos os schemas expand estarem prontos:

```bash
cd app/backend
npm run db:generate -- --name onda1_expand
```

Expected: `0012_onda1_expand.sql`, `meta/0012_snapshot.json` e entrada `idx: 12` no journal; nenhuma coluna removida e nenhum `SET NOT NULL`.

- [ ] Anexar à mão, ao final do `0012_onda1_expand.sql` gerado, a **ampliação transitória dos três CHECKs de status** para o superset (legado ∪ final), pelo idioma nomeado de `0011` (não editar `meta/_journal.json` nem renomear o arquivo — apenas completar o corpo SQL, exatamente como o `0013` é completado):

```sql
-- 0012 (append): ampliar CHECKs de status para o superset antes do backfill 0013.
-- Superset = valores legados ∪ valores finais; o aperto ao conjunto final é feito no 0014.
ALTER TABLE "pedidos_venda" DROP CONSTRAINT IF EXISTS "chk_pedidos_venda_status";--> statement-breakpoint
ALTER TABLE "pedidos_venda" ADD CONSTRAINT "chk_pedidos_venda_status" CHECK ("pedidos_venda"."status" IN (
  'reservado','parcialmente_reservado',
  'rascunho','em_elaboracao_reserva_ativa','aguardando_confirmacao_overbooking',
  'finalizado','parcialmente_atendido','atendido','faturado','cancelado'
));--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" DROP CONSTRAINT IF EXISTS "chk_pedidos_itens_status";--> statement-breakpoint
ALTER TABLE "pedidos_venda_itens" ADD CONSTRAINT "chk_pedidos_itens_status" CHECK ("pedidos_venda_itens"."status" IN (
  'totalmente_reservado','parcialmente_reservado','sem_cobertura',
  'aguardando_confirmacao_overbooking','overbooking_confirmado','cancelado'
));--> statement-breakpoint
ALTER TABLE "recebimentos" DROP CONSTRAINT IF EXISTS "chk_recebimentos_status";--> statement-breakpoint
ALTER TABLE "recebimentos" ADD CONSTRAINT "chk_recebimentos_status" CHECK ("recebimentos"."status" IN (
  'aguardando_conferencia','em_conferencia','finalizado',
  'pesagem_em_andamento','aguardando_conclusao_pesagem','aguardando_conferencia_final',
  'conferido_sem_divergencia','conferido_com_divergencia',
  'ocorrencia_administrativa_aberta','tratativa_administrativa_concluida','cancelado'
));--> statement-breakpoint
```

- [ ] Ampliar o teste do 0012 para provar que o superset aceita os status novos e que os legados seguem válidos (o aperto é verificado na Task 7):

```typescript
it('0012 amplia CHECKs de status para o superset (aceita legado e novo)', async () => {
  await migrarAte('0012_onda1_expand');
  // valores novos que o backfill 0013 gravará passam a ser aceitos:
  await expectCheckAceita('pedidos_venda', 'status', 'aguardando_confirmacao_overbooking');
  await expectCheckAceita('pedidos_venda_itens', 'status', 'aguardando_confirmacao_overbooking');
  await expectCheckAceita('recebimentos', 'status', 'pesagem_em_andamento');
  // valores legados continuam aceitos durante a janela expand:
  await expectCheckAceita('pedidos_venda', 'status', 'reservado');
  await expectCheckAceita('recebimentos', 'status', 'finalizado');
});
```

- [ ] Run: `npm run test -- onda1-migrations` → FAIL apenas porque 0013/0014 ainda não existem.
- [ ] Commit previsto: `feat(onda1): expand estrutural completo e migration 0012`

## Task 2 — Operações e todos os writers

**Files:** módulo `operacoes`, cinco módulos consumidores, eventos, seed e permissões.

- [ ] Escrever os casos de `operacoes.e2e-spec.ts` e `operacoes-writers.e2e-spec.ts`.

```typescript
it.each([
  'compras_programadas', 'disponibilidades_virtuais', 'pedidos_venda',
  'recebimentos', 'caminhoes', 'faturamentos',
])('%s recebe operacao_id no fluxo público', async (tabela) => {
  await executarFluxoPublico(tabela);
  expect(await contarSemOperacao(tabela)).toBe(0);
});
```

- [ ] Implementar resolução concorrente sem target incompatível com índice parcial:

```typescript
async garantirOperacao(tx: Tx, data: string, usuarioId?: string) {
  const atual = await tx.select({ id: operacoes.id, data: operacoes.data })
    .from(operacoes)
    .where(and(eq(operacoes.data, data), isNull(operacoes.deletedAt)))
    .then((r) => r[0]);
  if (atual) return { operacao: atual, criada: false };

  const diaSemana = new Date(`${data}T12:00:00Z`).getUTCDay();
  const [criada] = await tx.insert(operacoes).values({
    data, diaSemana, rotulo: `Operação de ${DIAS_SEMANA_PT[diaSemana]}`,
    criadaPorId: usuarioId ?? null,
  }).onConflictDoNothing().returning({ id: operacoes.id, data: operacoes.data });
  if (criada) return { operacao: criada, criada: true };

  const concorrente = primeiroOuFalha(await tx.select({ id: operacoes.id, data: operacoes.data })
    .from(operacoes).where(and(eq(operacoes.data, data), isNull(operacoes.deletedAt))));
  return { operacao: concorrente, criada: false };
}

async encontrarAtivaPorData(tx: Tx, data: string) {
  return tx.select({ id: operacoes.id, data: operacoes.data })
    .from(operacoes)
    .where(and(eq(operacoes.data, data), isNull(operacoes.deletedAt)))
    .then((rows) => rows[0] ?? null);
}
```

- [ ] DTOs e controller de Operações:

```typescript
const statusOperacaoSchema = z.enum(['aberta', 'em_andamento', 'fechada']);
export const listarOperacoesSchema = z.object({
  de: z.string().date().optional(),
  ate: z.string().date().optional(),
  status: statusOperacaoSchema.optional(),
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
}).refine(({ de, ate }) => !de || !ate || de <= ate, {
  message: 'de deve ser anterior ou igual a ate',
});
export const criarExtraordinariaSchema = z.object({
  data: z.string().date(),
  rotulo: z.string().trim().min(1).max(120),
});
export const gerarCadenciaSchema = z.object({
  de: z.string().date(),
  ate: z.string().date(),
}).refine(({ de, ate }) => de <= ate, { message: 'de deve ser anterior ou igual a ate' });
export const alterarStatusOperacaoSchema = z.object({
  status: statusOperacaoSchema,
});
export type StatusOperacao = z.infer<typeof statusOperacaoSchema>;
export type ListarOperacoesDto = z.infer<typeof listarOperacoesSchema>;
export type CriarExtraordinariaDto = z.infer<typeof criarExtraordinariaSchema>;
export type GerarCadenciaDto = z.infer<typeof gerarCadenciaSchema>;
export type AlterarStatusOperacaoDto =
  z.infer<typeof alterarStatusOperacaoSchema>;

const DIAS_SEMANA_PT = [
  'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
  'quinta-feira', 'sexta-feira', 'sábado',
] as const;

function datasInclusivas(de: string, ate: string): string[] {
  const datas: string[] = [];
  for (
    let atual = new Date(`${de}T12:00:00Z`);
    atual <= new Date(`${ate}T12:00:00Z`);
    atual = new Date(atual.getTime() + 86_400_000)
  ) {
    datas.push(atual.toISOString().slice(0, 10));
  }
  return datas;
}
```

```typescript
@Controller('operacoes')
@UseGuards(JwtAuthGuard, RbacGuard)
export class OperacoesController {
  constructor(private readonly service: OperacoesService) {}

  @Get()
  async listar(@Query(new ZodValidationPipe(listarOperacoesSchema)) query: ListarOperacoesDto) {
    return this.service.listar(query);
  }

  @Get(':id')
  async detalhar(@Param('id') id: string) { return this.service.detalhar(id); }

  @Post('extraordinaria')
  @RequirePermissoes('OPERACOES_GERENCIAR')
  async criarExtraordinaria(
    @Body(new ZodValidationPipe(criarExtraordinariaSchema)) dto: CriarExtraordinariaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) { return this.service.criarExtraordinaria(dto, user.sub); }

  @Post('gerar-cadencia')
  @RequirePermissoes('OPERACOES_GERENCIAR')
  async gerarCadencia(
    @Body(new ZodValidationPipe(gerarCadenciaSchema)) dto: GerarCadenciaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) { return this.service.gerarCadencia(dto, user.sub); }

  @Patch(':id/status')
  @RequirePermissoes('OPERACOES_GERENCIAR')
  async alterarStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(alterarStatusOperacaoSchema)) dto: AlterarStatusOperacaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) { return this.service.alterarStatus(id, dto.status, user.sub); }
}
```

- [ ] `alterarStatus` aceita somente `aberta→em_andamento→fechada`:

```typescript
const TRANSICOES_OPERACAO: Record<StatusOperacao, readonly StatusOperacao[]> = {
  aberta: ['em_andamento'],
  em_andamento: ['fechada'],
  fechada: [],
};
if (!TRANSICOES_OPERACAO[atual.status].includes(novoStatus)) {
  throw new ConflictException(`Transição ${atual.status} → ${novoStatus} inválida`);
}
```

- [ ] Implementar cadência e extraordinária com auditoria:

```typescript
async gerarCadencia(dto: GerarCadenciaDto, usuarioId: string) {
  const resultado = await this.db.transaction(async (tx) => {
    const parametro = primeiroOuFalha(await tx.select({ valor: parametros.valorJson })
      .from(parametros)
      .where(and(eq(parametros.chave, 'operacao.cadencia_dias_semana'), isNull(parametros.deletedAt))));
    const dias = z.object({ dias: z.array(z.number().int().min(0).max(6)) }).parse(parametro.valor).dias;
    const criadas: Array<{ id: string; data: string }> = [];
    for (const data of datasInclusivas(dto.de, dto.ate)) {
      if (!dias.includes(new Date(`${data}T12:00:00Z`).getUTCDay())) continue;
      const resultadoData = await this.garantirOperacao(tx, data, usuarioId);
      if (resultadoData.criada) {
        criadas.push(resultadoData.operacao);
        await this.auditoria.registrar(tx, {
          tabela: 'operacoes', registroId: resultadoData.operacao.id, operacao: 'INSERT',
          modulo: 'operacoes', usuarioId, dadosAnteriores: {}, dadosNovos: resultadoData.operacao,
        });
      }
    }
    return criadas;
  });
  for (const operacao of resultado) {
    this.eventEmitter.emit(EVENTOS.OPERACAO_CRIADA, {
      operacaoId: operacao.id,
      data: operacao.data,
    });
  }
  return { criadas: resultado.length, operacoes: resultado };
}

async criarExtraordinaria(dto: CriarExtraordinariaDto, usuarioId: string) {
  const operacao = await this.db.transaction(async (tx) => {
    const diaSemana = new Date(`${dto.data}T12:00:00Z`).getUTCDay();
    const [criada] = await tx.insert(operacoes).values({
      data: dto.data, diaSemana, rotulo: dto.rotulo,
      status: 'aberta', extraordinaria: true, criadaPorId: usuarioId,
    }).onConflictDoNothing().returning();
    if (!criada) throw new ConflictException('Já existe operação ativa nesta data');
    await this.auditoria.registrar(tx, {
      tabela: 'operacoes', registroId: criada.id, operacao: 'INSERT',
      modulo: 'operacoes', usuarioId, dadosAnteriores: {}, dadosNovos: criada,
    });
    return criada;
  });
  this.eventEmitter.emit(EVENTOS.OPERACAO_CRIADA, {
    operacaoId: operacao.id,
    data: operacao.data,
  });
  return operacao;
}
```

- [ ] Em cada comando, resolver e gravar na mesma transação:

```typescript
// ComprasProgramadasService.criar
const { operacao } = await this.operacoes.garantirOperacao(tx, dto.dataOperacao, usuarioId);
await tx.insert(comprasProgramadas).values({ ...valores, operacaoId: operacao.id });

// DisponibilidadeService.gerarParaCompra — SQL literal
INSERT INTO disponibilidades_virtuais
  (compra_programada_id, operacao_id, data_operacao, item_comercial_id,
   quantidade_total_gerada, quantidade_reservada, quantidade_disponivel, status)
SELECT ${compra.id}, ${compra.operacaoId}, ${operacao.data}, r.item_comercial_id,
       SUM(r.fator_quantidade * cpi.quantidade_comprada), 0,
       SUM(r.fator_quantidade * cpi.quantidade_comprada), 'gerada'
FROM compras_programadas_itens cpi
JOIN regras_desdobramento_comercial r
  ON r.item_compra_id = cpi.item_compra_id
 AND r.deleted_at IS NULL
 AND r.status = 'ativo'
WHERE cpi.compra_programada_id = ${compra.id}
  AND cpi.deleted_at IS NULL
GROUP BY r.item_comercial_id
ON CONFLICT (compra_programada_id, item_comercial_id) DO NOTHING

// CaminhaoService.criar
const { operacao } = await this.operacoes.garantirOperacao(tx, dto.dataOperacao, operadorId);
await tx.insert(caminhoes).values({ ...valores, operacaoId: operacao.id });

// ConsolidacaoService
await tx.insert(faturamentos).values({
  caminhaoId, operacaoId: caminhao.operacaoId,
  dataOperacao: operacao.data, statusFaturamento: 'em_consolidacao', responsavelId: usuarioId,
});
```

- [ ] Recebimentos chamam `garantirOperacao` no início do writer. Pedidos fazem primeiro `encontrarAtivaPorData` + planejamento read-only e só chamam `garantirOperacao` depois de superar/confirmar o challenge; ambos gravam `operacaoId: operacao.id` nos blocos literais das Tasks 3 e 4.
- [ ] Registrar `OperacoesModule` e importá-lo em `ComprasProgramadasModule`, `PedidosModule`, `RecebimentoModule`, `ExpedicaoModule` e `FaturamentoModule`.
- [ ] Seed literal:

```typescript
const PARAMETROS_ONDA1 = [
  { chave: 'operacao.cadencia_dias_semana', valorJson: { dias: [1, 3, 5], provisorio: true, ref: 'P1/v1.1 §16.2' } },
];
```

AD-03, AD-05 e AD-06 são regras confirmadas, não toggles administrativos: não criar parâmetros capazes de desativá-las.

- [ ] Catálogo e mapa de permissões:

```typescript
Object.assign(DESCRICOES_PERMISSOES, {
  OPERACOES_GERENCIAR: 'Criar, iniciar e fechar operações',
  PEDIDO_OVERBOOKING_CONFIRMAR: 'Confirmar inclusão com overbooking',
  OVERBOOKING_RESOLVER: 'Tratar pendências de overbooking',
  PEDIDO_FORNECEDOR_GERENCIAR: 'Gerenciar pedidos ao fornecedor',
  CONFERENCIA_CONCLUIR: 'Concluir conferência Pedido×NF×Pesagem',
  PEDIDO_FINALIZAR: 'Finalizar pedido de venda',
});

MAPA_PERFIL_PERMISSOES.gestor.push(
  'OPERACOES_GERENCIAR', 'PEDIDO_OVERBOOKING_CONFIRMAR', 'OVERBOOKING_RESOLVER',
  'PEDIDO_FORNECEDOR_GERENCIAR', 'CONFERENCIA_CONCLUIR', 'PEDIDO_FINALIZAR',
);
MAPA_PERFIL_PERMISSOES.compras.push('OPERACOES_GERENCIAR', 'PEDIDO_FORNECEDOR_GERENCIAR');
MAPA_PERFIL_PERMISSOES.comercial.push('PEDIDO_OVERBOOKING_CONFIRMAR', 'PEDIDO_FINALIZAR');
MAPA_PERFIL_PERMISSOES.recebimento_pesagem.push('CONFERENCIA_CONCLUIR');
MAPA_PERFIL_PERMISSOES.administrador.push(
  'OPERACOES_GERENCIAR', 'PEDIDO_OVERBOOKING_CONFIRMAR', 'OVERBOOKING_RESOLVER',
  'PEDIDO_FORNECEDOR_GERENCIAR', 'CONFERENCIA_CONCLUIR', 'PEDIDO_FINALIZAR',
);
```

- [ ] Eventos de operação são acumulados durante a transação e emitidos após a resolução da Promise:

```typescript
const resultado = await this.db.transaction((tx) => this.executar(tx, dto, usuarioId));
for (const evento of resultado.eventos) this.eventEmitter.emit(evento.nome, evento.payload);
return resultado.valor;
```

- [ ] Run: `npm run test -- "operacoes|operacoes-writers"` → PASS.
- [ ] Commit previsto: `feat(onda1): operacoes e operacao_id em todos os writers`

## Task 3 — Overbooking AD-05 e lifecycle

**Files:** pedidos schema/service/controller/DTO/module, módulo overbooking, eventos e testes.

- [ ] DTOs e rotas são exatamente:

```typescript
export const incluirItemSchema = z.object({
  itemComercialId: z.string().uuid(),
  quantidade: z.coerce.number().positive(),
  observacoes: z.string().max(1000).optional(),
});
const itensCriacaoPedidoSchema = z.array(itemPedidoSchema)
  .min(1, 'pedido precisa de ao menos um item')
  .superRefine((itens, ctx) => {
    const vistos = new Set<string>();
    itens.forEach((item, index) => {
      if (vistos.has(item.itemComercialId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'itemComercialId'],
          message: 'item comercial duplicado no mesmo pedido',
        });
      }
      vistos.add(item.itemComercialId);
    });
  });
// createPedidoSchema usa `itens: itensCriacaoPedidoSchema`.
export const confirmarCriacaoOverbookingSchema = createPedidoSchema;
// Inclusão sempre cria uma nova linha. Aumento/redução de linha existente usa
// os endpoints explícitos de alteração de item; não há itemId ambíguo aqui.
export const confirmarInclusaoOverbookingSchema = incluirItemSchema;
export type IncluirItemDto = z.infer<typeof incluirItemSchema>;
export type ConfirmarInclusaoOverbookingDto =
  z.infer<typeof confirmarInclusaoOverbookingSchema>;

interface ItemSolicitado {
  itemComercialId: string;
  quantidade: number;
  observacoes?: string;
}
interface CoberturaPlanejada {
  disponibilidadeId: string;
  quantidade: string;
}
interface PlanoItem {
  itemComercialId: string;
  quantidadeSolicitada: string;
  disponivelAntes: string;
  coberturas: CoberturaPlanejada[];
  deficit: string;
}
export interface OverbookingChallengeItem {
  itemComercialId: string;
  disponivelAntes: string;
  quantidadeSolicitada: string;
  overbookingGerado: string;
  mensagem: string;
}
```

```typescript
@Post()
@RequirePermissoes('PEDIDOS_GERENCIAR')
async criar(
  @Body(new ZodValidationPipe(createPedidoSchema)) dto: CreatePedidoDto,
  @CurrentUser() user: CurrentUserPayload,
) { return this.service.criar(dto, user.sub, false); }

@Post('confirmar-overbooking')
@HttpCode(HttpStatus.CREATED)
@RequirePermissoes('PEDIDO_OVERBOOKING_CONFIRMAR')
async confirmarCriacao(
  @Body(new ZodValidationPipe(confirmarCriacaoOverbookingSchema)) dto: CreatePedidoDto,
  @CurrentUser() user: CurrentUserPayload,
) { return this.service.criar(dto, user.sub, true); }

@Post(':id/itens')
@HttpCode(HttpStatus.OK)
@RequirePermissoes('PEDIDOS_GERENCIAR')
async incluir(
  @Param('id') id: string,
  @Body(new ZodValidationPipe(incluirItemSchema)) dto: IncluirItemDto,
  @CurrentUser() user: CurrentUserPayload,
) { return this.service.incluirItem(id, dto, user.sub, false); }

@Post(':id/itens/confirmar-overbooking')
@HttpCode(HttpStatus.OK)
@RequirePermissoes('PEDIDO_OVERBOOKING_CONFIRMAR')
async confirmarInclusao(
  @Param('id') id: string,
  @Body(new ZodValidationPipe(confirmarInclusaoOverbookingSchema)) dto: ConfirmarInclusaoOverbookingDto,
  @CurrentUser() user: CurrentUserPayload,
) { return this.service.incluirItem(id, dto, user.sub, true); }

@Post(':id/finalizar')
@HttpCode(HttpStatus.OK)
@RequirePermissoes('PEDIDO_FINALIZAR')
async finalizar(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
  return this.service.finalizar(id, user.sub);
}
```

- [ ] Challenge tipado:

```typescript
export class OverbookingChallengeException extends ConflictException {
  constructor(itens: OverbookingChallengeItem[]) {
    super({
      code: 'OVERBOOKING_CONFIRMACAO_NECESSARIA',
      message: 'Disponibilidade insuficiente',
      itens,
    });
  }
}
```

- [ ] O primeiro teste de integração prova zero mutação:

```typescript
it('409 challenge não executa escrita e não persiste mutação', async () => {
  const antes = await snapshotOverbooking(db, { disponibilidadeId });
  const escritas: string[] = [];
  const removerSpy = observarSql(db, (sql) => {
    if (/^\s*(insert|update|delete)\b/i.test(sql)) escritas.push(sql);
  });
  const response = await api.post('/comercial/pedidos')
    .send(pedidoComQuantidadeAcimaDoSaldo)
    .expect(409);
  expect(response.body.code).toBe('OVERBOOKING_CONFIRMACAO_NECESSARIA');
  expect(response.body.itens[0]).toMatchObject({
    disponivelAntes: '2.000',
    quantidadeSolicitada: '5.000',
    overbookingGerado: '3.000',
    // Microcopy idêntica ao protótipo PedidoVenda.tsx:229 (Princípio I).
    mensagem: 'A venda poderá ser concluída, mas a gestão deverá tratar a falta.',
  });
  removerSpy();
  expect(escritas).toEqual([]);
  const depois = await snapshotOverbooking(db, { disponibilidadeId });
  expect(depois).toEqual(antes);
});
```

- [ ] Separar planejamento de mutação:

```typescript
const resultado = await this.db.transaction(async (tx) => {
  const solicitados: ItemSolicitado[] = dto.itens.map((item) => ({
    itemComercialId: item.itemComercialId,
    quantidade: item.quantidadePedida,
    observacoes: item.observacoes,
  }));
  // O challenge é estritamente read-only: não chame garantirOperacao antes
  // de decidir se a confirmação é necessária.
  const operacaoExistente = await this.operacoes.encontrarAtivaPorData(
    tx, dto.dataOperacao,
  );
  const plano = await this.planejarSobLock(
    tx, operacaoExistente?.id ?? null, solicitados,
  );
  const desafios = plano.filter((p) => compararQtd(p.deficit, '0') > 0);
  if (desafios.length && !confirmado) {
    throw new OverbookingChallengeException(desafios.map((p) => ({
      itemComercialId: p.itemComercialId,
      disponivelAntes: p.disponivelAntes,
      quantidadeSolicitada: p.quantidadeSolicitada,
      overbookingGerado: p.deficit,
      mensagem: 'A venda poderá ser concluída, mas a gestão deverá tratar a falta.',
    })));
  }

  const operacao = operacaoExistente
    ?? (await this.operacoes.garantirOperacao(
      tx, dto.dataOperacao, usuarioId,
    )).operacao;
  const pedido = primeiroOuFalha(await tx.insert(pedidosVenda).values({
    compraProgramadaId: dto.compraProgramadaId,
    clienteId: dto.clienteId,
    operacaoId: operacao.id,
    dataEntrega: dto.dataEntrega,
    rotaPrevista: dto.rotaPrevista,
    prioridade: dto.prioridade,
    status: 'em_elaboracao_reserva_ativa',
    observacoesGerais: dto.observacoesGerais,
    usuarioCriacaoId: usuarioId,
  }).returning());
  return this.persistirItensPlanejados(tx, pedido, solicitados, plano, usuarioId);
});
this.emitirEventosPosCommit(resultado.eventos);
return resultado.pedido;
```

O mesmo núcleo é chamado por `incluirItem`; nesse caso o pedido existente já fornece `operacaoId` e `clienteId`:

```typescript
const itemExistente = await tx.select({ id: pedidosVendaItens.id })
  .from(pedidosVendaItens)
  .where(and(
    eq(pedidosVendaItens.pedidoVendaId, pedido.id),
    eq(pedidosVendaItens.itemComercialId, dto.itemComercialId),
    isNull(pedidosVendaItens.deletedAt),
  )).limit(1);
if (itemExistente.length) {
  throw new ConflictException('Item comercial já existe neste pedido');
}
const solicitado = {
  itemComercialId: dto.itemComercialId,
  quantidade: dto.quantidade,
  observacoes: dto.observacoes,
};
const plano = await this.planejarSobLock(tx, pedido.operacaoId, [solicitado]);
const desafios = plano.filter((p) => compararQtd(p.deficit, '0') > 0);
if (desafios.length && !confirmado) {
  throw new OverbookingChallengeException(desafios.map((p) => ({
    itemComercialId: p.itemComercialId,
    disponivelAntes: p.disponivelAntes,
    quantidadeSolicitada: p.quantidadeSolicitada,
    overbookingGerado: p.deficit,
    mensagem: 'A venda poderá ser concluída, mas a gestão deverá tratar a falta.',
  })));
}
// Nenhum INSERT/UPDATE pode existir antes deste ponto.
```

A unicidade do banco também é traduzida para `409` no race entre requisições:

```typescript
function ehDuplicidadeDeItemNoPedido(error: unknown): boolean {
  const pg = error as { code?: string; constraint?: string };
  return pg.code === '23505'
    && pg.constraint === 'uq_pedido_venda_item_comercial_ativo';
}

let resultadoInclusao: { pedido: PedidoVenda; eventos: EventoDominio[] };
try {
  resultadoInclusao = await this.db.transaction((tx) =>
    this.incluirItemTransacional(tx, pedidoId, dto, usuarioId, confirmado),
  );
} catch (error) {
  if (ehDuplicidadeDeItemNoPedido(error)) {
    throw new ConflictException('Item comercial já existe neste pedido');
  }
  throw error;
}
this.emitirEventosPosCommit(resultadoInclusao.eventos);
return resultadoInclusao.pedido;
```

- [ ] `planejarSobLock` distribui o saldo de todas as linhas da Operação sem escrever:

```typescript
// common/crud/decimal.ts — reutiliza a aritmética BigInt já existente.
export function minimoQtd(
  a: number | string,
  b: number | string,
): string {
  return compararQtd(a, b) <= 0 ? formatarQtd(a) : formatarQtd(b);
}

export function somarListaQtd(
  valores: readonly (number | string)[],
): string {
  return valores.reduce((total, valor) => somarQtd(total, valor), '0.000');
}

async planejarSobLock(tx: Tx, operacaoId: string | null, itens: ItemSolicitado[]): Promise<PlanoItem[]> {
  const ids = itens.map((item) => item.itemComercialId);
  if (new Set(ids).size !== ids.length) {
    throw new BadRequestException('item comercial duplicado no mesmo pedido');
  }
  const resultado = operacaoId === null
    ? { rows: [] }
    : await tx.execute<{
    id: string;
    item_comercial_id: string;
    quantidade_disponivel: string;
  }>(sql`
    SELECT id, item_comercial_id, quantidade_disponivel
    FROM disponibilidades_virtuais
    WHERE operacao_id=${operacaoId}
      AND item_comercial_id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})
      AND quantidade_disponivel > 0
    ORDER BY created_at, id
    FOR UPDATE
  `);

  return itens.map((item) => {
    let restante = formatarQtd(item.quantidade);
    const linhas = resultado.rows.filter((row) => row.item_comercial_id === item.itemComercialId);
    const disponivelAntes = somarListaQtd(linhas.map((row) => row.quantidade_disponivel));
    const coberturas: CoberturaPlanejada[] = [];
    for (const row of linhas) {
      if (ehZero(restante)) break;
      const quantidade = minimoQtd(restante, row.quantidade_disponivel);
      coberturas.push({ disponibilidadeId: row.id, quantidade });
      restante = subtrairQtd(restante, quantidade);
    }
    return {
      itemComercialId: item.itemComercialId,
      quantidadeSolicitada: formatarQtd(item.quantidade),
      disponivelAntes,
      coberturas,
      deficit: restante,
    };
  });
}
```

- [ ] Na confirmação, persistir parcelas e pendência na mesma transação:

```typescript
type EventoDominio<N extends keyof PayloadPorEvento = keyof PayloadPorEvento> = {
  [K in N]: { nome: K; payload: PayloadPorEvento[K] };
}[N];

async persistirItensPlanejados(
  tx: Tx,
  pedido: PedidoVenda,
  solicitados: ItemSolicitado[],
  plano: PlanoItem[],
  usuarioId: string,
): Promise<{ pedido: PedidoVenda; eventos: EventoDominio[] }> {
  const eventos: EventoDominio[] = [];
  for (const [indice, alocacao] of plano.entries()) {
    const solicitado = solicitados[indice];
    const quantidadeReal = somarListaQtd(alocacao.coberturas.map((c) => c.quantidade));
    const [item] = await tx.insert(pedidosVendaItens).values({
      pedidoVendaId: pedido.id,
      itemComercialId: solicitado.itemComercialId,
      quantidadePedida: alocacao.quantidadeSolicitada,
      quantidadeReservada: quantidadeReal,
      quantidadePendente: '0.000',
      quantidadeOverbooking: alocacao.deficit,
      status: ehZero(alocacao.deficit) ? 'totalmente_reservado' : 'overbooking_confirmado',
      observacoes: solicitado.observacoes,
    }).returning();

    for (const cobertura of alocacao.coberturas) {
      const atualizada = await tx.execute<{ id: string }>(sql`
        UPDATE disponibilidades_virtuais
        SET quantidade_reservada=quantidade_reservada+${cobertura.quantidade}::numeric,
            quantidade_disponivel=quantidade_disponivel-${cobertura.quantidade}::numeric,
            status=CASE
              WHEN quantidade_disponivel-${cobertura.quantidade}::numeric=0 THEN 'esgotada'
              ELSE 'parcialmente_reservada'
            END
        WHERE id=${cobertura.disponibilidadeId}
          AND quantidade_disponivel >= ${cobertura.quantidade}::numeric
        RETURNING id
      `);
      if (atualizada.rows.length !== 1) {
        throw new ConflictException('Saldo mudou durante a confirmação; refaça a operação');
      }
      await tx.insert(reservasDisponibilidade).values({
        disponibilidadeVirtualId: cobertura.disponibilidadeId,
        pedidoVendaItemId: item.id,
        quantidadeReservada: cobertura.quantidade,
        tipoConsumo: 'virtual',
        status: 'ativa',
      });
    }
    if (!ehZero(alocacao.deficit)) {
      await tx.insert(reservasDisponibilidade).values({
        disponibilidadeVirtualId: null,
        pedidoVendaItemId: item.id,
        quantidadeReservada: alocacao.deficit,
        tipoConsumo: 'overbooking',
        status: 'ativa',
      });
      const [pendencia] = await tx.insert(pendenciasOverbooking).values({
        pedidoVendaId: pedido.id, pedidoVendaItemId: item.id,
        itemComercialId: item.itemComercialId, clienteId: pedido.clienteId,
        vendedorUsuarioId: usuarioId, operacaoId: pedido.operacaoId,
        quantidadeDeficit: alocacao.deficit,
      }).returning();
      await tx.insert(pendenciasOverbookingHistorico).values({
        pendenciaId: pendencia.id, acao: 'confirmada_pelo_vendedor', autorId: usuarioId,
      });
      eventos.push({
        nome: EVENTOS.PENDENCIA_OVERBOOKING_ABERTA,
        payload: { pendenciaId: pendencia.id, pedidoVendaId: pedido.id },
      });
      eventos.push({
        nome: EVENTOS.OVERBOOKING_CONFIRMADO,
        payload: {
          pedidoVendaId: pedido.id,
          itemId: item.id,
          quantidadeOverbooking: alocacao.deficit,
        },
      });
    }
    eventos.push({
      nome: EVENTOS.PEDIDO_VENDA_ITEM_CRIADO,
      payload: { pedidoVendaId: pedido.id, itemId: item.id },
    });
  }
  return { pedido, eventos };
}
```

- [ ] A migration `0012` cria a unicidade ativa entre chamadas e falha com
  diagnóstico se o legado já estiver inconsistente; nunca escolhe silenciosamente
  qual linha preservar:

```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pedidos_venda_itens
    WHERE deleted_at IS NULL
    GROUP BY pedido_venda_id, item_comercial_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'duplicidade ativa em pedidos_venda_itens; saneamento explícito obrigatório';
  END IF;
END $$;

CREATE UNIQUE INDEX uq_pedido_venda_item_comercial_ativo
  ON pedidos_venda_itens (pedido_venda_id, item_comercial_id)
  WHERE deleted_at IS NULL;
```

- [ ] Implementar redução, remoção e cancelamento:

```typescript
async reduzirItem(
  pedidoId: string,
  itemId: string,
  novaQuantidade: string,
  motivo: string,
  usuarioId: string,
): Promise<void> {
  await this.db.transaction(async (tx) => {
    const item = await tx.select().from(pedidosVendaItens)
      .where(and(eq(pedidosVendaItens.id, itemId), eq(pedidosVendaItens.pedidoVendaId, pedidoId)))
      .then((rows) => rows[0]);
    if (!item) throw new NotFoundException('Item do pedido não encontrado');
    if (compararQtd(novaQuantidade, item.quantidadePedida) >= 0) {
      throw new ConflictException('A operação aceita somente redução');
    }
    const reducao = subtrairQtd(item.quantidadePedida, novaQuantidade);
    const tirarOverbooking = minimoQtd(reducao, item.quantidadeOverbooking);
    const devolverReal = subtrairQtd(reducao, tirarOverbooking);
    if (!ehZero(tirarOverbooking)) {
      await this.reduzirReservaOverbooking(tx, item.id, tirarOverbooking);
      await this.atualizarOuCancelarPendencia(tx, item.id, tirarOverbooking, usuarioId);
    }
    if (!ehZero(devolverReal)) {
      await this.liberarReservaReal(tx, item.id, devolverReal);
    }
    const novaOverbooking = subtrairQtd(item.quantidadeOverbooking, tirarOverbooking);
    const novaReservada = subtrairQtd(item.quantidadeReservada, devolverReal);
    const [itemAtualizado] = await tx.update(pedidosVendaItens).set({
      quantidadePedida: novaQuantidade,
      quantidadeReservada: novaReservada,
      quantidadeOverbooking: novaOverbooking,
      status: ehZero(novaOverbooking) ? 'totalmente_reservado' : 'overbooking_confirmado',
      updatedAt: new Date(),
    }).where(eq(pedidosVendaItens.id, itemId)).returning();
    await this.auditoria.registrar(tx, {
      tabela: 'pedidos_venda_itens',
      registroId: itemId,
      operacao: 'UPDATE',
      modulo: 'comercial',
      usuarioId,
      dadosAnteriores: item,
      dadosNovos: { ...itemAtualizado, motivo },
    });
  });
}
```

```typescript
async reduzirReservaOverbooking(tx: Tx, itemId: string, quantidade: string) {
  const reserva = await tx.select().from(reservasDisponibilidade)
    .where(and(
      eq(reservasDisponibilidade.pedidoVendaItemId, itemId),
      eq(reservasDisponibilidade.tipoConsumo, 'overbooking'),
      eq(reservasDisponibilidade.status, 'ativa'),
    )).then((rows) => rows[0]);
  if (!reserva) throw new ConflictException('Reserva de overbooking ativa não encontrada');
  const restante = subtrairQtd(reserva.quantidadeReservada, quantidade);
  await tx.update(reservasDisponibilidade).set(
    ehZero(restante) ? { status: 'liberada' } : { quantidadeReservada: restante },
  ).where(eq(reservasDisponibilidade.id, reserva.id));
}

async atualizarOuCancelarPendencia(tx: Tx, itemId: string, reducao: string, usuarioId: string) {
  const pendencia = await tx.select().from(pendenciasOverbooking)
    .where(and(
      eq(pendenciasOverbooking.pedidoVendaItemId, itemId),
      notInArray(pendenciasOverbooking.status, ['resolvida', 'cancelada']),
      isNull(pendenciasOverbooking.deletedAt),
    )).then((rows) => rows[0]);
  if (!pendencia) throw new ConflictException('Pendência ativa não encontrada');
  const restante = subtrairQtd(pendencia.quantidadeDeficit, reducao);
  const status = ehZero(restante) ? 'cancelada' : pendencia.status;
  await tx.update(pendenciasOverbooking)
    .set({ quantidadeDeficit: restante, status, updatedAt: new Date() })
    .where(eq(pendenciasOverbooking.id, pendencia.id));
  await tx.insert(pendenciasOverbookingHistorico).values({
    pendenciaId: pendencia.id,
    acao: ehZero(restante) ? 'cancelada_por_reducao' : 'deficit_reduzido',
    autorId: usuarioId,
    detalheJson: { reducao, restante },
  });
}

async liberarReservaReal(tx: Tx, itemId: string, quantidade: string) {
  let restante = quantidade;
  const reservas = await tx.select().from(reservasDisponibilidade)
    .where(and(
      eq(reservasDisponibilidade.pedidoVendaItemId, itemId),
      inArray(reservasDisponibilidade.tipoConsumo, ['fisico', 'virtual']),
      eq(reservasDisponibilidade.status, 'ativa'),
    )).orderBy(desc(reservasDisponibilidade.createdAt));
  for (const reserva of reservas) {
    if (ehZero(restante)) break;
    if (!reserva.disponibilidadeVirtualId) throw new Error('Reserva real sem disponibilidade');
    const devolver = minimoQtd(restante, reserva.quantidadeReservada);
    await this.devolverSaldo(tx, reserva.disponibilidadeVirtualId, devolver);
    const saldoReserva = subtrairQtd(reserva.quantidadeReservada, devolver);
    await tx.update(reservasDisponibilidade).set(
      ehZero(saldoReserva) ? { status: 'liberada' } : { quantidadeReservada: saldoReserva },
    ).where(eq(reservasDisponibilidade.id, reserva.id));
    restante = subtrairQtd(restante, devolver);
  }
  if (!ehZero(restante)) throw new ConflictException('Reserva real insuficiente para redução');
}
```

```typescript
async liberarTodasReservasDoItem(tx: Tx, itemId: string): Promise<void> {
  const reservasAtivas = await tx.select().from(reservasDisponibilidade)
    .where(and(
      eq(reservasDisponibilidade.pedidoVendaItemId, itemId),
      eq(reservasDisponibilidade.status, 'ativa'),
    ))
    .orderBy(desc(reservasDisponibilidade.createdAt));

  for (const reserva of reservasAtivas) {
    if (reserva.tipoConsumo === 'overbooking') {
      await tx.update(reservasDisponibilidade).set({ status: 'liberada' })
        .where(eq(reservasDisponibilidade.id, reserva.id));
      continue; // nunca credita disponibilidade
    }
    if (!reserva.disponibilidadeVirtualId) throw new Error('Reserva real sem disponibilidade');
    await this.devolverSaldo(tx, reserva.disponibilidadeVirtualId, reserva.quantidadeReservada);
    await tx.update(reservasDisponibilidade).set({ status: 'liberada' })
      .where(eq(reservasDisponibilidade.id, reserva.id));
  }
}

async cancelarPendenciasDoPedido(tx: Tx, pedidoId: string, usuarioId: string): Promise<void> {
  const pendencias = await tx.select().from(pendenciasOverbooking)
    .where(and(
      eq(pendenciasOverbooking.pedidoVendaId, pedidoId),
      notInArray(pendenciasOverbooking.status, ['resolvida', 'cancelada']),
      isNull(pendenciasOverbooking.deletedAt),
    ));
  for (const pendencia of pendencias) {
    await tx.update(pendenciasOverbooking)
      .set({ status: 'cancelada', responsavelId: usuarioId, updatedAt: new Date() })
      .where(eq(pendenciasOverbooking.id, pendencia.id));
    await tx.insert(pendenciasOverbookingHistorico).values({
      pendenciaId: pendencia.id,
      acao: 'cancelada_com_pedido',
      autorId: usuarioId,
    });
  }
}

async removerItem(pedidoId: string, itemId: string, motivo: string, usuarioId: string): Promise<void> {
  await this.db.transaction(async (tx) => {
    const item = await this.obterItemAtivoSobLock(tx, pedidoId, itemId);
    await this.liberarTodasReservasDoItem(tx, item.id);
    if (!ehZero(item.quantidadeOverbooking)) {
      await this.atualizarOuCancelarPendencia(
        tx,
        item.id,
        item.quantidadeOverbooking,
        usuarioId,
      );
    }
    await tx.update(pedidosVendaItens)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(pedidosVendaItens.id, item.id));
    await this.auditoria.registrar(tx, {
      tabela: 'pedidos_venda_itens',
      registroId: item.id,
      operacao: 'DELETE',
      modulo: 'comercial',
      usuarioId,
      dadosAnteriores: item,
      dadosNovos: { motivo },
    });
  });
}

async cancelarPedido(pedidoId: string, motivo: string, usuarioId: string): Promise<void> {
  await this.db.transaction(async (tx) => {
    const pedido = await this.obterPedidoAtivoSobLock(tx, pedidoId);
    const itens = await tx.select().from(pedidosVendaItens)
      .where(and(
        eq(pedidosVendaItens.pedidoVendaId, pedido.id),
        isNull(pedidosVendaItens.deletedAt),
      ));
    for (const item of itens) await this.liberarTodasReservasDoItem(tx, item.id);
    await this.cancelarPendenciasDoPedido(tx, pedido.id, usuarioId);
    await tx.update(pedidosVenda)
      .set({ status: 'cancelado', motivoCancelamento: motivo, updatedAt: new Date() })
      .where(eq(pedidosVenda.id, pedido.id));
  });
}
```

- [ ] Implementar a fila com transições fechadas:

```typescript
const statusPendenciaSchema = z.enum([
  'aberta', 'em_analise', 'compra_complementar_programada',
  'redistribuicao_decidida', 'novo_pedido_criado', 'resolvida', 'cancelada',
]);
type StatusPendencia = z.infer<typeof statusPendenciaSchema>;
export const listarPendenciasSchema = z.object({
  operacaoId: z.string().uuid(),
  status: statusPendenciaSchema.optional(),
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});
export const decidirPendenciaSchema = z.object({
  caminho: z.enum(['compra_complementar', 'redistribuicao', 'novo_pedido']),
  detalhe: z.record(z.string(), z.unknown()).default({}),
});
export const alterarPendenciaSchema = z.object({
  status: statusPendenciaSchema,
  detalhe: z.record(z.string(), z.unknown()).default({}),
});
export type ListarPendenciasDto = z.infer<typeof listarPendenciasSchema>;
export type DecidirPendenciaDto = z.infer<typeof decidirPendenciaSchema>;
export type AlterarPendenciaDto = z.infer<typeof alterarPendenciaSchema>;

const STATUS_POR_CAMINHO = {
  compra_complementar: 'compra_complementar_programada',
  redistribuicao: 'redistribuicao_decidida',
  novo_pedido: 'novo_pedido_criado',
} as const;
function statusDoCaminho(
  caminho: DecidirPendenciaDto['caminho'],
): StatusPendencia {
  return STATUS_POR_CAMINHO[caminho];
}

const TRANSICOES_PENDENCIA: Record<StatusPendencia, readonly StatusPendencia[]> = {
  aberta: [
    'em_analise',
    'compra_complementar_programada',
    'redistribuicao_decidida',
    'novo_pedido_criado',
    'cancelada',
  ],
  em_analise: [
    'compra_complementar_programada',
    'redistribuicao_decidida',
    'novo_pedido_criado',
    'cancelada',
  ],
  compra_complementar_programada: ['resolvida'],
  redistribuicao_decidida: ['resolvida'],
  novo_pedido_criado: ['resolvida'],
  resolvida: [],
  cancelada: [],
};

async alterarStatus(id: string, novoStatus: StatusPendencia, detalhe: unknown, usuarioId: string) {
  const resultado = await this.db.transaction(async (tx) => {
    const atual = await this.obterAtivaSobLock(tx, id);
    if (!TRANSICOES_PENDENCIA[atual.status].includes(novoStatus)) {
      throw new ConflictException(`Transição ${atual.status} → ${novoStatus} inválida`);
    }
    const [pendencia] = await tx.update(pendenciasOverbooking)
      .set({ status: novoStatus, decisaoJson: detalhe, responsavelId: usuarioId, updatedAt: new Date() })
      .where(eq(pendenciasOverbooking.id, id)).returning();
    await tx.insert(pendenciasOverbookingHistorico).values({
      pendenciaId: id, acao: novoStatus, autorId: usuarioId, detalheJson: detalhe,
    });
    await this.auditoria.registrar(tx, {
      tabela: 'pendencias_overbooking', registroId: id, operacao: 'UPDATE',
      modulo: 'comercial', usuarioId, dadosAnteriores: atual, dadosNovos: pendencia,
    });
    return pendencia;
  });
  this.eventEmitter.emit(
    resultado.status === 'resolvida'
      ? EVENTOS.PENDENCIA_OVERBOOKING_RESOLVIDA
      : EVENTOS.PENDENCIA_OVERBOOKING_ATUALIZADA,
    { pendenciaId: resultado.id, status: resultado.status },
  );
  return resultado;
}
```

```typescript
@Controller('comercial/overbooking')
@UseGuards(JwtAuthGuard, RbacGuard)
export class OverbookingController {
  @Get()
  @RequirePermissoes('PEDIDOS_LER')
  listar(@Query(new ZodValidationPipe(listarPendenciasSchema)) query: ListarPendenciasDto) {
    return this.service.listar(query);
  }

  @Get(':id')
  @RequirePermissoes('PEDIDOS_LER')
  detalhar(@Param('id') id: string) { return this.service.detalhar(id); }

  @Post(':id/decisao')
  @RequirePermissoes('OVERBOOKING_RESOLVER')
  decidir(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(decidirPendenciaSchema)) dto: DecidirPendenciaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) { return this.service.alterarStatus(id, statusDoCaminho(dto.caminho), dto.detalhe, user.sub); }

  @Patch(':id/status')
  @RequirePermissoes('OVERBOOKING_RESOLVER')
  alterar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(alterarPendenciaSchema)) dto: AlterarPendenciaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) { return this.service.alterarStatus(id, dto.status, dto.detalhe, user.sub); }
}
```

- [ ] `finalizar` valida apenas estados persistidos:

```typescript
const pendenteLegado = await tx.select({ id: pedidosVendaItens.id }).from(pedidosVendaItens)
  .where(and(eq(pedidosVendaItens.pedidoVendaId, pedidoId),
    eq(pedidosVendaItens.status, 'aguardando_confirmacao_overbooking'))).limit(1);
if (pendenteLegado.length) throw new ConflictException('OVERBOOKING_CONFIRMACAO_NECESSARIA');
// overbooking_confirmado é aceito; não tocar no saldo.
```

- [ ] Testes obrigatórios: `decimal-onda1.spec.ts` cobre mínimo e soma de lista sem drift; challenge prova zero comando de escrita e compara operação + cinco agregados antes/depois; confirmação 201 e 200; item comercial duplicado no mesmo payload retorna 400/zero mutação; duas inclusões sequenciais e duas concorrentes do mesmo `itemComercialId` no mesmo pedido retornam conflito e deixam uma linha; UPDATE condicional retornando zero aborta toda a transação; falha injetada; concorrência; redução somente déficit; redução além do déficit; remoção; cancelamento; finalização.
- [ ] Run: `npm run test -- "pedidos-v11|overbooking"` → PASS.
- [ ] Commit previsto: `feat(onda1): challenge e lifecycle completo de overbooking`

## Task 4 — Pedido ao Fornecedor e NF própria

**Files:** schemas já expandidos, services/controllers/DTOs, recebimento e testes.

- [ ] Criar Pedido ao Fornecedor somente de compra confirmada e espelhar a disponibilidade gerada:

```typescript
const compra = await tx.query.comprasProgramadas.findFirst({
  where: and(eq(comprasProgramadas.id, dto.compraProgramadaId), isNull(comprasProgramadas.deletedAt)),
});
if (!compra) throw new NotFoundException('Compra programada não encontrada');
if (compra.status !== 'confirmada') throw new ConflictException('Compra programada não confirmada');

const itens = await tx.select({
  itemComercialId: disponibilidadesVirtuais.itemComercialId,
  quantidadePrevista: disponibilidadesVirtuais.quantidadeTotalGerada,
}).from(disponibilidadesVirtuais)
  .where(eq(disponibilidadesVirtuais.compraProgramadaId, compra.id));
if (!itens.length) throw new ConflictException('Compra confirmada sem disponibilidade gerada');
```

- [ ] DTO e controller do Pedido ao Fornecedor:

```typescript
export const criarPedidoFornecedorSchema = z.object({
  compraProgramadaId: z.string().uuid(),
});
export const listarPedidosFornecedorSchema = z.object({
  status: z.enum(['rascunho', 'enviado', 'aguardando_recebimento', 'recebido', 'encerrado', 'cancelado']).optional(),
  operacaoId: z.string().uuid(), // obrigatório: nenhuma consulta operacional cruza Operações implicitamente
});
export const registrarNfSchema = z.object({
  numero: z.string().trim().min(1).max(60),
  serie: z.string().trim().max(30).optional(),
  chave: z.string().trim().max(60).optional(),
  dataEmissao: z.string().date().optional(),
  pesoTotalDeclarado: z.coerce.number().positive().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  itens: z.array(z.object({
    itemComercialId: z.string().uuid(),
    quantidadeDeclarada: z.coerce.number().positive(),
    pesoDeclarado: z.coerce.number().positive().optional(),
  })).min(1),
});
export type CriarPedidoFornecedorDto =
  z.infer<typeof criarPedidoFornecedorSchema>;
export type ListarPedidosFornecedorDto =
  z.infer<typeof listarPedidosFornecedorSchema>;
export type RegistrarNfDto = z.infer<typeof registrarNfSchema>;
```

```typescript
@Controller('operacao/pedidos-fornecedor')
@UseGuards(JwtAuthGuard, RbacGuard)
export class PedidoFornecedorController {
  @Get()
  @RequirePermissoes('RECEBIMENTO_LER')
  listar(@Query(new ZodValidationPipe(listarPedidosFornecedorSchema)) query: ListarPedidosFornecedorDto) {
    return this.service.listar(query);
  }

  @Get(':id')
  @RequirePermissoes('RECEBIMENTO_LER')
  detalhar(@Param('id') id: string) { return this.service.detalhar(id); }

  @Post()
  @RequirePermissoes('PEDIDO_FORNECEDOR_GERENCIAR')
  criar(
    @Body(new ZodValidationPipe(criarPedidoFornecedorSchema)) dto: CriarPedidoFornecedorDto,
    @CurrentUser() user: CurrentUserPayload,
  ) { return this.service.criar(dto, user.sub); }
}
```

- [ ] Endpoint de NF substitui o cache:

```typescript
@Post(':id/nf')
@RequirePermissoes('RECEBIMENTO_GERENCIAR')
async registrarNf(
  @Param('id') id: string,
  @Body(new ZodValidationPipe(registrarNfSchema)) dto: RegistrarNfDto,
  @CurrentUser() user: CurrentUserPayload,
) {
  return this.service.registrarNf(id, dto, user.sub);
}
```

```typescript
const nf = primeiroOuFalha(await tx.insert(notasFiscaisFornecedor).values({
  pedidoFornecedorId: recebimento.pedidoFornecedorId,
  recebimentoId, numero: dto.numero, serie: dto.serie,
  chave: dto.chave, dataEmissao: dto.dataEmissao,
  pesoTotalDeclarado: dto.pesoTotalDeclarado,
  payloadJson: dto.payload ?? {},
}).returning());
await tx.insert(notasFiscaisFornecedorItens).values(dto.itens.map((item) => ({
  nfId: nf.id, itemComercialId: item.itemComercialId,
  quantidadeDeclarada: formatarQtd(item.quantidadeDeclarada),
  pesoDeclarado: item.pesoDeclarado === undefined ? null : formatarQtd(item.pesoDeclarado),
})));
```

- [ ] Iniciar recebimento exclusivamente pelo pedido:

```typescript
const pedidoFornecedor = await tx.query.pedidosFornecedor.findFirst({
  where: and(eq(pedidosFornecedor.id, dto.pedidoFornecedorId), isNull(pedidosFornecedor.deletedAt)),
});
if (!pedidoFornecedor) throw new NotFoundException('Pedido ao fornecedor não encontrado');
if (!['enviado', 'aguardando_recebimento'].includes(pedidoFornecedor.status)) {
  throw new ConflictException('Pedido ao fornecedor não está aguardando recebimento');
}
await tx.insert(recebimentos).values({
  pedidoFornecedorId: pedidoFornecedor.id,
  operacaoId: pedidoFornecedor.operacaoId,
  fornecedorId: pedidoFornecedor.fornecedorId,
  status: 'pesagem_em_andamento',
  usuarioCriacaoId: usuarioId,
});
```

- [ ] Não criar unicidade que impeça N NFs ou N recebimentos. Testar duas NFs e dois recebimentos no mesmo pedido.
- [ ] Run: `npm run test -- pedido-fornecedor` → PASS.
- [ ] Commit previsto: `feat(onda1): pedido ao fornecedor e NF com itens`

## Task 5 — Conferência tripla e caixarias

**Files:** `conferencia.service.ts`, schema de conclusão/divergência/ocorrência, controller/DTO, testes.

- [ ] Calcular o quadro por modalidade:

```sql
WITH nf_itens AS (
  SELECT nf.recebimento_id, nfi.item_comercial_id,
         SUM(nfi.quantidade_declarada) AS qtd_nf,
         SUM(nfi.peso_declarado)
           FILTER (WHERE nfi.peso_declarado IS NOT NULL) AS peso_nf
  FROM notas_fiscais_fornecedor nf
  JOIN notas_fiscais_fornecedor_itens nfi
    ON nfi.nf_id=nf.id AND nfi.deleted_at IS NULL
  WHERE nf.recebimento_id=${recebimentoId} AND nf.deleted_at IS NULL
  GROUP BY nf.recebimento_id, nfi.item_comercial_id
), pecas_apuradas AS (
  -- Schema real de `pecas` (pesagem.schema.ts): a FK do item é
  -- `item_comercial_base_id` e o peso capturado é `peso_original`.
  -- Aliasamos para `item_comercial_id` para manter os JOINs a jusante.
  SELECT recebimento_id, item_comercial_base_id AS item_comercial_id,
         COUNT(id)::numeric AS qtd_pecas,
         COALESCE(SUM(peso_original), 0) AS peso_apurado
  FROM pecas
  WHERE recebimento_id=${recebimentoId} AND deleted_at IS NULL
  GROUP BY recebimento_id, item_comercial_base_id
), item_ids AS (
  SELECT pfi.item_comercial_id
  FROM recebimentos r
  JOIN pedidos_fornecedor_itens pfi
    ON pfi.pedido_fornecedor_id=r.pedido_fornecedor_id AND pfi.deleted_at IS NULL
  WHERE r.id=${recebimentoId}
  UNION
  SELECT item_comercial_id FROM nf_itens
  UNION
  SELECT item_comercial_id
  FROM recebimentos_itens
  WHERE recebimento_id=${recebimentoId}
)
SELECT ids.item_comercial_id,
       pfi.quantidade_prevista AS qtd_pedido,
       COALESCE(nfi.qtd_nf, 0) AS qtd_nf,
       CASE WHEN COALESCE(ri.requer_balanca, false)
            THEN COALESCE(pa.qtd_pecas, 0)
            ELSE COALESCE(ri.quantidade_recebida, 0)
       END AS qtd_apurada,
       nfi.peso_nf,
       CASE WHEN COALESCE(ri.requer_balanca, false)
            THEN COALESCE(pa.peso_apurado, 0)
            ELSE NULL
       END AS peso_apurado,
       (pfi.id IS NOT NULL) AS previsto_no_pedido
FROM recebimentos r
JOIN item_ids ids ON true
LEFT JOIN pedidos_fornecedor_itens pfi
  ON pfi.pedido_fornecedor_id=r.pedido_fornecedor_id
 AND pfi.item_comercial_id=ids.item_comercial_id
 AND pfi.deleted_at IS NULL
LEFT JOIN recebimentos_itens ri
  ON ri.recebimento_id=r.id AND ri.item_comercial_id=ids.item_comercial_id
LEFT JOIN nf_itens nfi
  ON nfi.recebimento_id=r.id AND nfi.item_comercial_id=ids.item_comercial_id
LEFT JOIN pecas_apuradas pa
  ON pa.recebimento_id=r.id AND pa.item_comercial_id=ids.item_comercial_id
WHERE r.id=${recebimentoId};
```

- [ ] Bloquear NF legada sem itens:

```typescript
if (nf.payloadJson?.migracao === 'legado_sem_itens_nf' && nfItens.length === 0) {
  throw new ConflictException({
    code: 'NF_ITENS_OBRIGATORIOS',
    message: 'Carregue os itens da NF antes de concluir a conferência',
  });
}
```

- [ ] DTO e rotas de conferência:

```typescript
export const concluirConferenciaSchema = z.object({
  resultado: z.enum(['sem_divergencia', 'com_divergencia']),
  observacao: z.string().trim().max(2000).optional(),
});
export type ConcluirConferenciaDto = z.infer<typeof concluirConferenciaSchema>;
```

```typescript
@Get(':id/conferencia')
@RequirePermissoes('RECEBIMENTO_LER')
quadro(@Param('id') id: string) { return this.conferencia.calcularQuadro(this.db, id); }

@Post(':id/concluir-pesagem')
@RequirePermissoes('CONFERENCIA_CONCLUIR')
concluirPesagem(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
  return this.conferencia.concluirPesagem(id, user.sub);
}

@Post(':id/conferencia/concluir')
@RequirePermissoes('CONFERENCIA_CONCLUIR')
concluirConferencia(
  @Param('id') id: string,
  @Body(new ZodValidationPipe(concluirConferenciaSchema)) dto: ConcluirConferenciaDto,
  @CurrentUser() user: CurrentUserPayload,
) { return this.conferencia.concluirConferencia(id, dto, user.sub); }
```

- [ ] Concluir numa transação:

```typescript
const nfs = await tx.select().from(notasFiscaisFornecedor)
  .where(and(
    eq(notasFiscaisFornecedor.recebimentoId, recebimentoId),
    isNull(notasFiscaisFornecedor.deletedAt),
  ));
if (nfs.length === 0) throw new ConflictException('NF do fornecedor obrigatória');

const [conclusao] = await tx.insert(conclusoesConferencia).values({
  recebimentoId, quadroJson: quadro,
  resultado: dto.resultado, observacao: dto.observacao,
  concluidaPorId: usuarioId, concluidaEm: new Date(),
}).onConflictDoNothing().returning();
if (!conclusao) throw new ConflictException('Conferência já concluída');

await tx.insert(conclusoesConferenciaNfs).values(nfs.map((nf) => ({
  conclusaoId: conclusao.id,
  nfFornecedorId: nf.id,
})));

for (const item of quadro.filter((q) => q.situacao === 'divergente')) {
  await tx.insert(divergenciasRecebimento).values({
    recebimentoId,
    recebimentoItemId: item.recebimentoItemId,
    itemComercialId: item.itemComercialId,
    conclusaoConferenciaId: conclusao.id,
    nfFornecedorId: nfs.length === 1 ? nfs[0].id : null,
    tipo: classificarTipoV11(item),
    descricao: descreverDiferenca(item),
    acaoImediata: 'Tratar divergência da conferência com o fornecedor',
    responsavelRegistroId: usuarioId,
  });
}
await this.ocorrencias.abrirDaConclusao(
  tx,
  conclusao.id,
  nfs.map((nf) => nf.id),
  usuarioId,
);
```

- [ ] `classificarTipoV11` é literal:

```typescript
type TipoDivergenciaV11 =
  | 'falta'
  | 'excesso'
  | 'produto_nao_previsto'
  | 'peso_divergente'
  | 'outro';

interface QuadroItem {
  recebimentoItemId: string | null;
  itemComercialId: string;
  previstoNoPedido: boolean;
  qtdNf: string;
  qtdApurada: string;
  pesoNf: string | null;
  pesoApurado: string | null;
  situacao: 'conforme' | 'divergente';
}

function classificarTipoV11(item: QuadroItem): TipoDivergenciaV11 {
  if (!item.previstoNoPedido) return 'produto_nao_previsto';
  if (compararQtd(item.qtdApurada, item.qtdNf) < 0) return 'falta';
  if (compararQtd(item.qtdApurada, item.qtdNf) > 0) return 'excesso';
  if (
    item.pesoNf !== null
    && item.pesoApurado !== null
    && compararQtd(item.pesoNf, item.pesoApurado) !== 0
  ) {
    return 'peso_divergente';
  }
  return 'outro';
}

function descreverDiferenca(item: QuadroItem): string {
  return [
    `item=${item.itemComercialId}`,
    `qtd_nf=${item.qtdNf}`,
    `qtd_apurada=${item.qtdApurada}`,
    `peso_nf=${item.pesoNf ?? 'n/a'}`,
    `peso_apurado=${item.pesoApurado ?? 'n/a'}`,
  ].join('; ');
}
```

- [ ] Testar TZ pesável e Caixa de Rabo `requerBalanca=false`, segunda conclusão 409, resultado falso 409, rollback sem conclusão órfã, vínculo conclusão+NF.
- [ ] Run: `npm run test -- conferencia-tripla` → PASS.
- [ ] Commit previsto: `feat(onda1): conferencia tripla imutavel com caixarias por unidade`

## Task 6 — Migration 0013 custom e backfill

**Files:** migration gerada, journal gerado, teste de migration.

- [ ] Gerar o arquivo custom, sem criar/renomear manualmente:

```bash
cd app/backend
npm run db:generate -- --custom --name onda1_backfill
```

Expected: `0013_onda1_backfill.sql` e entrada `idx: 13` no journal.

- [ ] Preencher o SQL gerado:

```sql
INSERT INTO operacoes (data, dia_semana, rotulo, status, extraordinaria)
SELECT d.data,
       EXTRACT(DOW FROM d.data)::int,
       'Operação ' || to_char(d.data, 'DD/MM/YYYY'),
       CASE WHEN d.data < CURRENT_DATE THEN 'fechada' ELSE 'aberta' END,
       false
FROM (
  SELECT data_operacao AS data FROM compras_programadas
  UNION SELECT data_operacao FROM disponibilidades_virtuais
  UNION SELECT data_operacao FROM pedidos_venda
  UNION SELECT data_operacao FROM recebimentos
  UNION SELECT data_operacao FROM caminhoes
  UNION SELECT data_operacao FROM faturamentos
) d
WHERE d.data IS NOT NULL
ON CONFLICT (data) WHERE deleted_at IS NULL DO NOTHING;

UPDATE compras_programadas t SET operacao_id=o.id FROM operacoes o
 WHERE t.operacao_id IS NULL AND o.data=t.data_operacao AND o.deleted_at IS NULL;
UPDATE disponibilidades_virtuais t SET operacao_id=o.id FROM operacoes o
 WHERE t.operacao_id IS NULL AND o.data=t.data_operacao AND o.deleted_at IS NULL;
UPDATE pedidos_venda t SET operacao_id=o.id FROM operacoes o
 WHERE t.operacao_id IS NULL AND o.data=t.data_operacao AND o.deleted_at IS NULL;
UPDATE recebimentos t SET operacao_id=o.id FROM operacoes o
 WHERE t.operacao_id IS NULL AND o.data=t.data_operacao AND o.deleted_at IS NULL;
UPDATE caminhoes t SET operacao_id=o.id FROM operacoes o
 WHERE t.operacao_id IS NULL AND o.data=t.data_operacao AND o.deleted_at IS NULL;
UPDATE faturamentos t SET operacao_id=o.id FROM operacoes o
 WHERE t.operacao_id IS NULL AND o.data=t.data_operacao AND o.deleted_at IS NULL;

UPDATE divergencias_recebimento d
SET item_comercial_id=ri.item_comercial_id
FROM recebimentos_itens ri
WHERE d.item_comercial_id IS NULL
  AND d.recebimento_item_id=ri.id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM divergencias_recebimento
    WHERE item_comercial_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'divergencia legada sem item comercial; saneamento explícito obrigatório';
  END IF;
END $$;
```

```sql
INSERT INTO pedidos_fornecedor
  (numero, fornecedor_id, operacao_id, compra_programada_id, status)
SELECT 'PF-RETRO-' || substr(cp.id::text, 1, 8), cp.fornecedor_id,
       cp.operacao_id, cp.id,
       CASE WHEN EXISTS (
         SELECT 1 FROM recebimentos r2
         WHERE r2.compra_programada_id=cp.id
           AND r2.status NOT IN ('finalizado','cancelado')
       ) THEN 'recebido' ELSE 'encerrado' END
FROM compras_programadas cp
WHERE EXISTS (SELECT 1 FROM recebimentos r WHERE r.compra_programada_id=cp.id)
  AND NOT EXISTS (SELECT 1 FROM pedidos_fornecedor pf WHERE pf.compra_programada_id=cp.id);

INSERT INTO pedidos_fornecedor_itens
  (pedido_fornecedor_id, item_comercial_id, quantidade_prevista)
SELECT pf.id, dv.item_comercial_id, dv.quantidade_total_gerada
FROM pedidos_fornecedor pf
JOIN disponibilidades_virtuais dv ON dv.compra_programada_id=pf.compra_programada_id
WHERE NOT EXISTS (
  SELECT 1 FROM pedidos_fornecedor_itens pfi
  WHERE pfi.pedido_fornecedor_id=pf.id AND pfi.item_comercial_id=dv.item_comercial_id
);

UPDATE recebimentos r SET pedido_fornecedor_id=pf.id
FROM pedidos_fornecedor pf
WHERE r.pedido_fornecedor_id IS NULL AND pf.compra_programada_id=r.compra_programada_id;
```

```sql
INSERT INTO notas_fiscais_fornecedor
  (pedido_fornecedor_id, recebimento_id, numero, serie, chave, data_emissao,
   peso_total_declarado, payload_json)
SELECT r.pedido_fornecedor_id, r.id, r.nfe_numero, r.nfe_serie, r.nfe_chave,
       r.nfe_data_emissao, r.nfe_peso_bruto,
       jsonb_build_object('migracao','legado_sem_itens_nf','nfe_peso_liquido',r.nfe_peso_liquido,'nfe_volumes',r.nfe_volumes)
FROM recebimentos r
WHERE r.nfe_numero IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM notas_fiscais_fornecedor nf WHERE nf.recebimento_id=r.id);
-- Não inserir notas_fiscais_fornecedor_itens: o legado não contém essa fonte.
```

- [ ] Incluir os mapeamentos sem converter pendência antiga em confirmação:

```sql
UPDATE reservas_disponibilidade
SET tipo_consumo='virtual'
WHERE tipo_consumo IS NULL;

UPDATE pedidos_venda
SET status = CASE
  WHEN status='reservado' THEN 'em_elaboracao_reserva_ativa'
  WHEN status='parcialmente_reservado' THEN 'aguardando_confirmacao_overbooking'
  ELSE status
END
WHERE status IN ('reservado','parcialmente_reservado');

UPDATE pedidos_venda_itens
SET status = CASE
  WHEN quantidade_pendente > 0 THEN 'aguardando_confirmacao_overbooking'
  ELSE 'totalmente_reservado'
END
WHERE status IN ('totalmente_reservado','parcialmente_reservado','sem_cobertura');

UPDATE recebimentos
SET status = CASE
  WHEN status IN ('aguardando_conferencia','em_conferencia') THEN 'pesagem_em_andamento'
  WHEN status='finalizado' AND EXISTS (
    SELECT 1 FROM divergencias_recebimento d
    WHERE d.recebimento_id=recebimentos.id
  ) THEN 'tratativa_administrativa_concluida'
  WHEN status='finalizado' THEN 'conferido_sem_divergencia'
  ELSE status
END
WHERE status IN ('aguardando_conferencia','em_conferencia','finalizado');
```
- [ ] Testar fixture 0011 com seis tabelas, recebimento, caixaria e NF header; afirmar FKs preenchidas e zero item de NF inventado.
- [ ] Run: `npm run test -- onda1-migrations` → FAIL apenas na expectativa do contract ainda ausente.
- [ ] Commit previsto: `feat(onda1): migration custom 0013 com backfill preservador`

## Task 7 — Contract 0014 e remoção das duplicações

**Files:** seis schemas, recebimento schema, os services explicitados na estrutura, eventos/gateway e migration gerada.

- [ ] Atualizar schemas:

```typescript
operacaoId: uuid('operacao_id').notNull().references(() => operacoes.id),
// Remover dataOperacao dos seis schemas.

pedidoFornecedorId: uuid('pedido_fornecedor_id').notNull().references(() => pedidosFornecedor.id),
// Remover de recebimentos: compraProgramadaId, nfeNumero, nfeSerie, nfeChave,
// nfeDataEmissao, nfePesoBruto, nfePesoLiquido e nfeVolumes.
// Remover uq_recebimentos_compra; criar índices não-únicos:
index('idx_recebimentos_pedido_fornecedor').on(t.pedidoFornecedorId);
index('idx_recebimentos_operacao').on(t.operacaoId);

// divergencias_recebimento: produto não previsto pode não ter linha física,
// mas toda divergência fica ancorada no item comercial.
itemComercialId: uuid('item_comercial_id').notNull().references(() => itensComerciais.id),
recebimentoItemId: uuid('recebimento_item_id').references(() => recebimentosItens.id),
```

- [ ] Substituir os CHECKs legados pelos finais somente nesta Task:

```typescript
check('chk_pedidos_venda_status', sql`${t.status} IN (
  'rascunho','em_elaboracao_reserva_ativa','aguardando_confirmacao_overbooking',
  'finalizado','parcialmente_atendido','atendido','faturado','cancelado'
)`);
check('chk_pedidos_itens_status', sql`${t.status} IN (
  'totalmente_reservado','aguardando_confirmacao_overbooking',
  'overbooking_confirmado','cancelado'
)`);
check('chk_reservas_tipo_consumo', sql`${t.tipoConsumo} IN ('fisico','virtual','overbooking')`);
check('chk_reservas_origem', sql`
  ${t.tipoConsumo} = 'overbooking' OR ${t.disponibilidadeVirtualId} IS NOT NULL
`);
check('chk_recebimentos_status', sql`${t.status} IN (
  'pesagem_em_andamento','aguardando_conclusao_pesagem','aguardando_conferencia_final',
  'conferido_sem_divergencia','conferido_com_divergencia',
  'ocorrencia_administrativa_aberta','tratativa_administrativa_concluida','cancelado'
)`);
```

- [ ] Após `db:generate`, inspecionar `0014_onda1_contract.sql`: ele **precisa** conter o aperto dos três CHECKs de status (do superset transitório do `0012` para o conjunto final acima) além das duas novas constraints de `reservas_disponibilidade`. Se o generate não emitir a troca de algum CHECK preexistente (drizzle-kit nem sempre diffa alteração de expressão de CHECK), anexar à mão ao SQL gerado o mesmo idioma nomeado de `0011` (`DROP CONSTRAINT IF EXISTS "<nome>"` → `ADD CONSTRAINT "<nome>" CHECK (...)`) para `chk_pedidos_venda_status`, `chk_pedidos_itens_status` e `chk_recebimentos_status`. O aperto é seguro porque o `0013` já migrou 100% das linhas legadas: nenhum registro carrega `reservado`, `parcialmente_reservado`, `sem_cobertura`, `aguardando_conferencia`, `em_conferencia` ou `finalizado` ao chegar no contract.

- [ ] Atualizar consultas para derivar data:

```typescript
const [linha] = await tx.select({
  entidade: pedidosVenda,
  dataOperacao: operacoes.data,
}).from(pedidosVenda)
  .innerJoin(operacoes, eq(operacoes.id, pedidosVenda.operacaoId))
  .where(eq(pedidosVenda.id, id));
```

- [ ] O INSERT final de disponibilidade não referencia a coluna removida:

```sql
INSERT INTO disponibilidades_virtuais
  (compra_programada_id, operacao_id, item_comercial_id,
   quantidade_total_gerada, quantidade_reservada, quantidade_disponivel, status)
SELECT ${compra.id}, ${compra.operacaoId}, r.item_comercial_id,
       SUM(r.fator_quantidade * cpi.quantidade_comprada), 0,
       SUM(r.fator_quantidade * cpi.quantidade_comprada), 'gerada'
FROM compras_programadas_itens cpi
JOIN regras_desdobramento_comercial r
  ON r.item_compra_id=cpi.item_compra_id
 AND r.deleted_at IS NULL
 AND r.status='ativo'
WHERE cpi.compra_programada_id=${compra.id}
  AND cpi.deleted_at IS NULL
GROUP BY r.item_comercial_id
ON CONFLICT (compra_programada_id, item_comercial_id) DO NOTHING;
```

- [ ] Aplicar a mesma junção nos consumidores:

```text
compras-programadas, disponibilidade, pedidos, dashboard, recebimento,
divergencia, ocorrencia, pesagem, corte, expedicao, faturamento,
eventos e realtime.gateway.
```

- [ ] As respostas BFF continuam expondo `dataOperacao`; a origem agora é a junção. NF vem de `notas_fiscais_fornecedor`.
- [ ] Gerar:

```bash
cd app/backend
npm run db:generate -- --name onda1_contract
```

Expected: `0014_onda1_contract.sql`, `meta/0014_snapshot.json`, journal `idx: 14`; apenas `SET NOT NULL`, troca de CHECK/FK/índice e DROP das colunas duplicadas já backfilladas.

- [ ] Atualizar `ROLLBACK.md` com rollback em ordem `0014 → 0013 → 0012`; restauração de `data_operacao` deriva `operacoes.data`, e cache de NF deriva a entidade antes de remover as tabelas novas.
- [ ] Run: `npm run test -- "onda1-migrations|operacoes-writers"` → PASS.
- [ ] Commit previsto: `feat(onda1): contract 0014 remove duplicacoes e fecha FKs`

## Task 8 — BFF, eventos e terminologia fiel

**Files:** BFFs, libs tipadas, gateway/eventos, tela tocada e testes frontend.

- [ ] BFF preserva status e body do challenge:

```typescript
const response = await apiFetch('/comercial/pedidos', {
  method: 'POST',
  body: JSON.stringify(body),
});
const payload = await response.json();
return NextResponse.json(payload, { status: response.status }); // mantém 409/201
```

- [ ] Adicionar estas propriedades dentro do objeto `EVENTOS` existente:

```typescript
OPERACAO_CRIADA: 'operacao_criada',
OVERBOOKING_CONFIRMADO: 'overbooking_confirmado',
PENDENCIA_OVERBOOKING_ABERTA: 'pendencia_overbooking_aberta',
PENDENCIA_OVERBOOKING_ATUALIZADA: 'pendencia_overbooking_atualizada',
PENDENCIA_OVERBOOKING_RESOLVIDA: 'pendencia_overbooking_resolvida',
PEDIDO_FINALIZADO: 'pedido_finalizado',
PEDIDO_VENDA_ITEM_CRIADO: 'pedido_venda_item_criado',
PEDIDO_FORNECEDOR_CRIADO: 'pedido_fornecedor_criado',
NF_FORNECEDOR_REGISTRADA: 'nf_fornecedor_registrada',
CONFERENCIA_TRIPLA_CONCLUIDA: 'conferencia_tripla_concluida',
RECEBIMENTO_ESTADO_ALTERADO: 'recebimento_estado_alterado',
```

- [ ] No mesmo `eventos.ts`, adicionar os contratos de payload completos:

```typescript
export interface PayloadPorEvento {
  operacao_criada: { operacaoId: string; data: string };
  overbooking_confirmado: {
    pedidoVendaId: string;
    itemId: string;
    quantidadeOverbooking: string;
  };
  pendencia_overbooking_aberta: {
    pendenciaId: string;
    pedidoVendaId: string;
  };
  pendencia_overbooking_atualizada: {
    pendenciaId: string;
    status: string;
  };
  pendencia_overbooking_resolvida: {
    pendenciaId: string;
    status: 'resolvida';
  };
  pedido_finalizado: { pedidoVendaId: string };
  pedido_venda_item_criado: { pedidoVendaId: string; itemId: string };
  pedido_fornecedor_criado: {
    pedidoFornecedorId: string;
    operacaoId: string;
  };
  nf_fornecedor_registrada: {
    nfId: string;
    pedidoFornecedorId: string;
    recebimentoId: string;
  };
  conferencia_tripla_concluida: {
    conclusaoId: string;
    recebimentoId: string;
    resultado: 'sem_divergencia' | 'com_divergencia';
  };
  recebimento_estado_alterado: {
    recebimentoId: string;
    statusAnterior: string;
    statusAtual: string;
  };
}
```

- [ ] Corrigir exatamente a string validada pelo protótipo:

```tsx
<Input
  placeholder="Buscar cliente"
  value={buscaPedido}
  onChange={(event) => setBuscaPedido(event.target.value)}
/>
```

- [ ] Teste AST, sem depender de `grep` do sistema operacional:

```typescript
import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function fontes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return fontes(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

it('strings de UI não contêm o rótulo banido', () => {
  const hits: string[] = [];
  for (const file of fontes('src')) {
    const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true,
      file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (node: ts.Node): void => {
      if ((ts.isStringLiteralLike(node) || ts.isJsxText(node)) && /\bmarcas?\b/i.test(node.getText(sf))) {
        hits.push(`${file}:${sf.getLineAndCharacterOfPosition(node.pos).line + 1}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  expect(hits).toEqual([]);
});
```

- [ ] Run: `cd app/frontend && npm run test -- "api|terminologia"` → PASS.
- [ ] Commit previsto: `fix(onda1): BFFs, eventos e terminologia fiel ao prototipo`

## Task 9 — Regressão, cobertura e documentação de migration

- [ ] Atualizar fixtures antigas para `operacao_id`, Pedido ao Fornecedor e estados novos.
- [ ] Rodar suítes por domínio:

```bash
cd app/backend
npm run test -- "compras|disponibilidade|pedidos|recebimento|pesagem|corte|expedicao|faturamento"
npm run test:cov
```

- [ ] Run: bloco de regressão/cobertura acima.
Expected: todas PASS; global e services tocados com linhas/branches ≥80%.

- [ ] Validar schema final:

```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE (table_name IN ('compras_programadas','disponibilidades_virtuais','pedidos_venda','recebimentos','caminhoes','faturamentos')
       AND column_name='data_operacao')
   OR (table_name='recebimentos' AND column_name LIKE 'nfe_%');
```

Expected: zero linhas.

- [ ] Validar integridade:

```sql
SELECT 'compras_programadas' AS tabela, count(*) FROM compras_programadas WHERE operacao_id IS NULL
UNION ALL SELECT 'disponibilidades_virtuais', count(*) FROM disponibilidades_virtuais WHERE operacao_id IS NULL
UNION ALL SELECT 'pedidos_venda', count(*) FROM pedidos_venda WHERE operacao_id IS NULL
UNION ALL SELECT 'recebimentos', count(*) FROM recebimentos WHERE operacao_id IS NULL OR pedido_fornecedor_id IS NULL
UNION ALL SELECT 'caminhoes', count(*) FROM caminhoes WHERE operacao_id IS NULL
UNION ALL SELECT 'faturamentos', count(*) FROM faturamentos WHERE operacao_id IS NULL;
```

Expected: seis contagens iguais a zero.

- [ ] Commit previsto: `test(onda1): regressao e cobertura da correcao estrutural`

## Task 10 — Gate local e PR

- [ ] Em checkout limpo da branch, instalar e executar as mesmas categorias do CI:

```bash
npm ci
npm run lint
npm run type-check
docker compose up -d postgres
cd app/backend
npm run db:migrate
npm run db:seed
npm run test:cov
cd ../frontend
npm run test
cd ../..
npm run build
npm audit --audit-level=high
gitleaks git . --no-banner --redact --verbose --exit-code 1 --config .gitleaks.toml
```

- [ ] Run: bloco do gate local acima.
Expected: todos os comandos com exit code 0; migration log mostra `0012`, `0013`, `0014`; cobertura ≥80% em linhas e branches; gitleaks sem achados.

- [ ] Abrir PR `feature/onda1-correcao-estrutural → develop` com relatório task a task, links dos testes do mapa, saída da consulta de integridade e saída do gitleaks.
- [ ] Solicitar `/gate-pr onda1 <PR>`.

## Self-Review obrigatório do Worker

```bash
rg -n -i '\bT[B]D\b|\bT[O]DO\b|a[ ]definir|implementar[ ]depois|similar[ ]à[ ]Task' \
  docs/superpowers/plans/2026-07-22-onda1-correcao-estrutural.md
rg -n '0012|0013|0014' app/backend/src/database/migrations/meta/_journal.json
rg -n 'dataOperacao|data_operacao' app/backend/src/database/schema
rg -n -i '\bmarcas?\b' app/backend/src app/frontend/src -g '*.ts' -g '*.tsx'
```

Expected:

```text
primeiro comando: zero ocorrências
journal: exatamente as três entradas da onda em ordem
schemas: zero ocorrências de dataOperacao/data_operacao nas seis tabelas de fato
terminologia: zero strings de UI; nomes de testes de correção são analisados separadamente
```

O Worker encerra o relatório declarando:

```text
Desvios do plano: NENHUM
Decisões improvisadas: NENHUMA
Migrations renomeadas manualmente: NÃO
Challenge 409 com mutação persistida: NÃO
Overbooking creditado no saldo durante lifecycle: NÃO
```
