# F4c — Corte / Transformação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a sub-fase F4c (Corte/Transformação) — transformar uma peça em subitens rastreáveis (pesar, associar, reetiquetar) preservando a peça original, conservando o saldo operacional e a conservação de peso, fechando a Operação Física (gate F4).

**Architecture:** Backend NestJS modular monolith — novo `@Module()` `corte` em `src/modules/operacao/corte`, reusando os contratos da F4b (captura ADR-009, UPDATE atômico anti-overbooking, etiqueta best-effort, eventos pós-commit, auditoria transacional). Frontend Next.js (BFF + tela de corte no padrão F4b). Migration Drizzle 0005 (delta + ALTERs). Um PR para `develop`.

**Tech Stack:** NestJS 11 + TypeScript 5 strict, Drizzle ORM (PostgreSQL 18, `uuidv7()`), Zod 4, WebSocket nativo + `@nestjs/event-emitter`, Jest (e2e com Postgres efêmero + fakes de hardware), Next.js 16 (App Router) + React 19 + Jest/RTL.

---

## Decisões de design (fixadas — só reabrir se houver quebra)

1. **Contabilidade de unidade (RT-007-06):** ao **iniciar** o corte, se a peça original estava `associada`, a unidade é **liberada** (`quantidade_atendida − 1` no item de origem, UPDATE atômico) e a peça tem `pedido_venda_id`/`pedido_venda_item_id` zerados. Cada **subitem associado** consome a sua unidade via o **mesmo** `consumirSaldo` da F4b (bloqueio de item completo → 409).
2. **Peça original imortal (RF-CT-02/03):** nunca apagada. `associada`/`pesada`/`para_corte` → `em_transformacao` → `transformada`. Peso e histórico preservados.
3. **Invalidação lógica da etiqueta original (RF-CT-17 / RT-007-04):** o status `transformada` da peça **é** a invalidação lógica para expedição (peça transformada não é unidade expedível; F5 a bloqueia). `pecas.etiqueta_atual` é **preservado** (coexiste no histórico). Não se adiciona coluna nova.
4. **Conservação de peso (RF-CT-09/10) — regra testável:** `diferenca = peso_original − Σ pesos subitens`. `Σ == original` → conclui sem justificativa. Qualquer **diferença ≠ 0** (perda OU excesso) exige `justificativa_diferenca`, senão **409**. Evento `corte_concluido` carrega `diferencaPeso` (alerta observável).
5. **Reclassificação:** subitem tem `item_comercial_id` próprio (pode diferir do `item_comercial_base_id` da peça) → preenche a linha do pedido do **seu** item.
6. **Estrutura de serviços:** `CorteService` (ciclo da transformação) + `SubitemService` (operações de subitem). DRY via helpers extraídos de F4b: `captura.ts`, `saldo.ts`, `compatibilidade.ts`; `EtiquetaService` ganha `emitirSubitem`/`reimprimirSubitem`. Refatorações de F4b mantêm comportamento idêntico (testes F4b continuam verdes).
7. **Identificador de QR do subitem:** `QR-SUB-<subitemId>` (distingue de `QR-<pecaId>`).

**FORA DE ESCOPO:** expedição/caminhão/fechamento (F5), faturamento/NFS-e (F6). `caminhao_id` nullable, sem regra.

---

## Estrutura de arquivos

**Criar (backend):**
- `app/backend/src/database/schema/transformacoes.schema.ts` — schema do domínio corte (transformacoes + subitens + relations).
- `app/backend/src/modules/operacao/pesagem/captura.ts` — helper de captura ADR-009 (extraído de PesagemService).
- `app/backend/src/modules/operacao/pesagem/saldo.ts` — `consumirSaldo`/`devolverSaldo` (extraídos de AssociacaoService).
- `app/backend/src/modules/operacao/pesagem/compatibilidade.ts` — `calcularCompativeisItem` (extraído de AssociacaoService).
- `app/backend/src/modules/operacao/corte/corte.module.ts`
- `app/backend/src/modules/operacao/corte/corte.controller.ts`
- `app/backend/src/modules/operacao/corte/corte.service.ts`
- `app/backend/src/modules/operacao/corte/subitem.service.ts`
- `app/backend/src/modules/operacao/corte/dto/corte.dto.ts`
- `app/backend/src/modules/operacao/corte/dto/subitem.dto.ts`
- `app/backend/test/helpers/corte-fixtures.ts`
- `app/backend/test/integration/corte.e2e-spec.ts`
- `app/backend/test/integration/subitens.e2e-spec.ts`
- `app/backend/test/integration/corte-concorrencia.e2e-spec.ts`
- `app/backend/test/integration/reetiqueta-subitem.e2e-spec.ts`
- `app/backend/test/integration/rastreabilidade-corte.e2e-spec.ts`
- `app/backend/test/unit/corte-eventos.spec.ts`
- `app/backend/src/database/migrations/0005_*.sql` (gerado por drizzle-kit + ajustes manuais)

**Modificar (backend):**
- `app/backend/src/database/schema/pesagem.schema.ts` — CHECK de `status_peca` (+`em_transformacao`,`transformada`); coluna `subitem_id` em `etiquetas_impressoes` + CHECK "um de peca/subitem".
- `app/backend/src/database/schema/index.ts` — exportar `transformacoes.schema`.
- `app/backend/src/common/crud/decimal.ts` — `somarQtd`.
- `app/backend/src/common/rbac/permissoes.ts` — `CORTE_GERENCIAR` + mapa + descrição.
- `app/backend/src/realtime/events/eventos.ts` — eventos + payloads F4c.
- `app/backend/src/realtime/realtime.gateway.ts` — handlers F4c.
- `app/backend/src/modules/operacao/pesagem/pesagem.service.ts` — usar `resolverCaptura`.
- `app/backend/src/modules/operacao/pesagem/associacao.service.ts` — usar `consumirSaldo`/`devolverSaldo`/`calcularCompativeisItem`.
- `app/backend/src/modules/operacao/pesagem/etiqueta.service.ts` — `emitirSubitem`/`reimprimirSubitem` + `resolverQr` resolve subitem.
- `app/backend/src/modules/operacao/operacao.module.ts` — importar `CorteModule`.
- `app/backend/test/helpers/test-app.ts` — `cleanupDb` inclui `subitens`,`transformacoes`.

**Criar/Modificar (frontend):**
- `app/frontend/src/lib/operacao.ts` — tipos F4c.
- `app/frontend/src/app/api/operacao/corte/**/route.ts` — BFF routes.
- `app/frontend/src/app/(admin)/operacao/corte/page.tsx` + `corte-client.tsx`.
- `app/frontend/src/app/(admin)/layout.tsx` — link de menu gated por `CORTE_GERENCIAR`.
- `app/frontend/__tests__/corte.test.tsx`.

---

## Mapa DoD → teste (1:1, preencher no PR)

| Invariante (quality-gates F4c) | Teste |
|---|---|
| Peça original imortal (`em_transformacao`→`transformada`, consultável) | `corte.e2e` › "origem permanece consultável e vira transformada" |
| Elegibilidade (409 em peça transformada/inelegível) | `corte.e2e` › "peça transformada → 409" |
| Contabilidade: iniciar libera unidade (atendida −1) | `corte.e2e` › "iniciar libera a unidade da origem" |
| Conservação de peso (Σ>orig sem justificativa→409; com→ok; perda exige justificativa) | `corte.e2e` › "conservação de peso" |
| Destino obrigatório (subitem sem peso/destino/etiqueta → 409) | `corte.e2e` › "concluir com subitem incompleto → 409" |
| Captura subitem ADR-009 (indisponível→manual; sem PESO_MANUAL→403; sem motivo→400) | `subitens.e2e` › "pesar subitem ADR-009" |
| Associação subitem reclassificado consome item correto; redirecionar; sem cobertura | `subitens.e2e` › "associar/redirecionar/sem-cobertura" |
| Concorrência: N subitens no mesmo item, atendida nunca excede pedida | `corte-concorrencia.e2e` |
| Reetiqueta: etiqueta nova ref. origem; QR resolve subitem; impressora down não trava; reimpressão auditada | `reetiqueta-subitem.e2e` |
| Invalidação etiqueta original + coexistência no histórico | `corte.e2e` › "etiqueta original coexiste; peça transformada" |
| Idempotência da conclusão | `corte.e2e` › "concluir 2× é idempotente" |
| Rastreabilidade ponta a ponta | `rastreabilidade-corte.e2e` |
| Tempo real: commit→emit + no-emit em rollback | `corte-eventos.spec` (unit) |
| RBAC CORTE_GERENCIAR (403 por ausência) | `corte.e2e` › "403 sem CORTE_GERENCIAR" + `seed.spec` |

---

## Task 1: Permissão CORTE_GERENCIAR (RBAC)

**Files:**
- Modify: `app/backend/src/common/rbac/permissoes.ts`

- [ ] **Step 1: Adicionar a permissão ao catálogo, ao mapa de perfis e às descrições**

No bloco `PERMISSOES`, após o bloco F4b (depois de `ETIQUETA_GERENCIAR: 'ETIQUETA_GERENCIAR',`), adicionar:

```ts
  // ── F4c — Corte / Transformação ───────────────────────────────────────────
  CORTE_GERENCIAR: 'CORTE_GERENCIAR', // iniciar/gerar/pesar/associar/reetiquetar/concluir corte
```

No mapa `MAPA_PERFIL_PERMISSOES`:
- Em `administrador`, após `'ETIQUETA_GERENCIAR',` adicionar `'CORTE_GERENCIAR',`.
- Em `gestor`, após `'ETIQUETA_GERENCIAR',` adicionar `'CORTE_GERENCIAR',`.
- Trocar a linha do perfil `corte` para conceder a permissão completa do corte e os contratos reusados (ADR-009/etiqueta):

```ts
  corte: [
    ...LEITURA_CADASTROS,
    'DISPONIBILIDADE_LER',
    // F4b reusados pelo corte: pesar subitem (manual), associar, ler/digitar QR, etiquetar.
    'PESAGEM_LER',
    'PESO_MANUAL',
    'ASSOCIACAO_GERENCIAR',
    'LEITURA_MANUAL',
    'ETIQUETA_GERENCIAR',
    // F4c:
    'CORTE_GERENCIAR',
  ],
```

Em `DESCRICOES_PERMISSOES`, após `ETIQUETA_GERENCIAR: '...',` adicionar:

```ts
  CORTE_GERENCIAR: 'Iniciar, executar e concluir cortes/transformações de peças',
```

- [ ] **Step 2: Type-check**

Run: `cd app/backend && npm run type-check`
Expected: PASS (sem erros — `Permissao` agora inclui `CORTE_GERENCIAR`).

- [ ] **Step 3: Commit**

```bash
git add app/backend/src/common/rbac/permissoes.ts
git commit -m "feat(f4c): permissão CORTE_GERENCIAR e mapa do perfil corte"
```

---

## Task 2: Catálogo de eventos F4c (realtime)

**Files:**
- Modify: `app/backend/src/realtime/events/eventos.ts`
- Modify: `app/backend/src/realtime/realtime.gateway.ts`

- [ ] **Step 1: Adicionar nomes de eventos e payloads**

Em `eventos.ts`, dentro do objeto `EVENTOS`, após o bloco F4b (depois de `DISPOSITIVO_STATUS_ALTERADO: 'dispositivo_status_alterado',`) adicionar:

```ts
  // ── F4c — Corte / Transformação ───────────────────────────────────────────
  CORTE_INICIADO: 'corte_iniciado',
  SUBITEM_GERADO: 'subitem_gerado',
  SUBITEM_PESADO: 'subitem_pesado',
  SUBITEM_ASSOCIADO: 'subitem_associado',
  CORTE_CONCLUIDO: 'corte_concluido',
```

No fim do arquivo, após `DispositivoStatusPayload`, adicionar:

```ts
// ── F4c ───────────────────────────────────────────────────────────────────────

export interface CorteIniciadoPayload {
  transformacaoId: string;
  pecaOrigemId: string;
  dataOperacao: string;
}

export interface SubitemGeradoPayload {
  transformacaoId: string;
  subitemId: string;
  dataOperacao: string;
}

export interface SubitemPesadoPayload {
  transformacaoId: string;
  subitemId: string;
  dataOperacao: string;
  modoCaptura: 'automatico' | 'manual_assistido';
  peso: string;
}

export interface SubitemAssociadoPayload {
  transformacaoId: string;
  subitemId: string;
  dataOperacao: string;
  pedidoVendaId: string | null;
  pedidoVendaItemId: string | null;
  statusSubitem: string;
}

export interface CorteConcluidoPayload {
  transformacaoId: string;
  pecaOrigemId: string;
  dataOperacao: string;
  pesoOriginal: string;
  pesoSubitensTotal: string;
  diferencaPeso: string;
}
```

- [ ] **Step 2: Adicionar handlers no gateway**

Em `realtime.gateway.ts`, no bloco de imports de tipos de `./events/eventos`, adicionar (antes do fechamento `} from './events/eventos';`):

```ts
  type CorteIniciadoPayload,
  type SubitemGeradoPayload,
  type SubitemPesadoPayload,
  type SubitemAssociadoPayload,
  type CorteConcluidoPayload,
```

Após o handler `handleDispositivoStatus(...)` (antes do `private broadcast`), adicionar:

```ts
  // ── F4c — Corte / Transformação ───────────────────────────────────────────

  @OnEvent(EVENTOS.CORTE_INICIADO)
  handleCorteIniciado(payload: CorteIniciadoPayload): void {
    this.broadcast(EVENTOS.CORTE_INICIADO, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.SUBITEM_GERADO)
  handleSubitemGerado(payload: SubitemGeradoPayload): void {
    this.broadcast(EVENTOS.SUBITEM_GERADO, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.SUBITEM_PESADO)
  handleSubitemPesado(payload: SubitemPesadoPayload): void {
    this.broadcast(EVENTOS.SUBITEM_PESADO, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.SUBITEM_ASSOCIADO)
  handleSubitemAssociado(payload: SubitemAssociadoPayload): void {
    this.broadcast(EVENTOS.SUBITEM_ASSOCIADO, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.CORTE_CONCLUIDO)
  handleCorteConcluido(payload: CorteConcluidoPayload): void {
    this.broadcast(EVENTOS.CORTE_CONCLUIDO, payload, payload.dataOperacao);
  }
```

- [ ] **Step 3: Type-check**

Run: `cd app/backend && npm run type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/backend/src/realtime/events/eventos.ts app/backend/src/realtime/realtime.gateway.ts
git commit -m "feat(f4c): catálogo de eventos de tempo real do corte"
```

---

## Task 3: Helper decimal `somarQtd`

**Files:**
- Modify: `app/backend/src/common/crud/decimal.ts`
- Test: `app/backend/test/unit/decimal.spec.ts`

- [ ] **Step 1: Escrever o teste (some 3 casas exatas)**

Em `decimal.spec.ts`, adicionar dentro do describe existente um caso (seguir o estilo do arquivo):

```ts
  it('somarQtd soma com 3 casas exatas, sem drift de float', () => {
    expect(somarQtd('0.1', '0.2')).toBe('0.300');
    expect(somarQtd('12.500', '1.250')).toBe('13.750');
    expect(somarQtd(0, '0')).toBe('0.000');
  });
```

Garantir o import no topo do arquivo: adicionar `somarQtd` à lista importada de `'../../src/common/crud/decimal'`.

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd app/backend && npx jest test/unit/decimal.spec.ts -t somarQtd`
Expected: FAIL (`somarQtd is not a function`).

- [ ] **Step 3: Implementar**

Em `decimal.ts`, após `subtrairQtd`, adicionar:

```ts
/** a + b (ambos quantidades), resultado como string NUMERIC(.,3). */
export function somarQtd(a: number | string, b: number | string): string {
  return paraString(paraEscalado(a) + paraEscalado(b));
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `cd app/backend && npx jest test/unit/decimal.spec.ts -t somarQtd`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/backend/src/common/crud/decimal.ts app/backend/test/unit/decimal.spec.ts
git commit -m "feat(f4c): somarQtd para conservação de peso"
```

---

## Task 4: Schema do domínio + alterações em pesagem

**Files:**
- Create: `app/backend/src/database/schema/transformacoes.schema.ts`
- Modify: `app/backend/src/database/schema/pesagem.schema.ts`
- Modify: `app/backend/src/database/schema/index.ts`

- [ ] **Step 1: Criar `transformacoes.schema.ts`**

```ts
import { relations, sql } from 'drizzle-orm';
import { check, index, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { pecas } from './pesagem.schema';
import { itensComerciais } from './itens-comerciais.schema';
import { pedidosVenda, pedidosVendaItens } from './pedidos.schema';
import { usuarios } from './auth.schema';

// ── transformacoes ─────────────────────────────────────────────────────────
// Evento de corte (doc 007 §3.2, doc 010 §3.18). A peça original NUNCA é apagada
// (RF-CT-02/03): vira 'em_transformacao' → 'transformada'. peso_original é copiado
// para preservar o histórico mesmo se a peça mudar de estado. caminhao_id é F5.
export const transformacoes = pgTable(
  'transformacoes',
  {
    id:                     uuid('id').primaryKey().default(sql`uuidv7()`),
    pecaOrigemId:           uuid('peca_origem_id').notNull().references(() => pecas.id),
    tipoTransformacao:      text('tipo_transformacao').notNull(),
    motivo:                 text('motivo').notNull(),
    motivoDetalhe:          text('motivo_detalhe'),
    operadorResponsavelId:  uuid('operador_responsavel_id').notNull().references(() => usuarios.id),
    statusTransformacao:    text('status_transformacao').notNull().default('aberta'),
    dataHoraAbertura:       timestamp('data_hora_abertura', { withTimezone: true }).notNull().defaultNow(),
    dataHoraEncerramento:   timestamp('data_hora_encerramento', { withTimezone: true }),
    pesoOriginal:           numeric('peso_original', { precision: 10, scale: 3 }).notNull(),
    pesoSubitensTotal:      numeric('peso_subitens_total', { precision: 10, scale: 3 }),
    diferencaPeso:          numeric('diferenca_peso', { precision: 10, scale: 3 }),
    justificativaDiferenca: text('justificativa_diferenca'),
    observacoes:            text('observacoes'),
    createdAt:              timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:              timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:              timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check(
      'chk_transf_tipo',
      sql`${t.tipoTransformacao} IN ('simples','subdivisao','reclassificacao','destinacao_mista')`,
    ),
    check(
      'chk_transf_motivo',
      sql`${t.motivo} IN ('preferencia_cliente','necessidade_operacional','divergencia','decisao_humana')`,
    ),
    check(
      'chk_transf_status',
      sql`${t.statusTransformacao} IN ('aberta','em_execucao','aguardando_pesagem','aguardando_associacao','aguardando_etiquetagem','concluida','cancelada')`,
    ),
    index('idx_transf_peca_origem').on(t.pecaOrigemId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_transf_status').on(t.statusTransformacao).where(sql`${t.deletedAt} IS NULL`),
  ],
);

// ── subitens ───────────────────────────────────────────────────────────────
// Item derivado do corte (doc 010 §3.19). Identidade própria (RF-CT-06), vínculo
// obrigatório com a peça de origem (RN-07/RF-CT-02). item_comercial_id pode diferir
// do item base da peça (reclassificação). Pesado pelo contrato ADR-009.
export const subitens = pgTable(
  'subitens',
  {
    id:                 uuid('id').primaryKey().default(sql`uuidv7()`),
    transformacaoId:    uuid('transformacao_id').notNull().references(() => transformacoes.id),
    pecaOrigemId:       uuid('peca_origem_id').notNull().references(() => pecas.id),
    itemComercialId:    uuid('item_comercial_id').notNull().references(() => itensComerciais.id),
    classificacao:      text('classificacao'),
    peso:               numeric('peso', { precision: 10, scale: 3 }),
    quantidade:         numeric('quantidade', { precision: 10, scale: 3 }).notNull().default('1'),
    modoCapturaPeso:    text('modo_captura_peso'),
    capturaMeta:        jsonb('captura_meta').notNull().default(sql`'{}'::jsonb`),
    statusSubitem:      text('status_subitem').notNull().default('gerado'),
    etiquetaAtual:      text('etiqueta_atual'),
    pedidoVendaId:      uuid('pedido_venda_id').references(() => pedidosVenda.id),
    pedidoVendaItemId:  uuid('pedido_venda_item_id').references(() => pedidosVendaItens.id),
    caminhaoId:         uuid('caminhao_id'),
    observacoes:        text('observacoes'),
    createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:          timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:          timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_subitens_modo_captura', sql`${t.modoCapturaPeso} IS NULL OR ${t.modoCapturaPeso} IN ('automatico','manual_assistido')`),
    check('chk_subitens_peso_positivo', sql`${t.peso} IS NULL OR ${t.peso} > 0`),
    check(
      'chk_subitens_status',
      sql`${t.statusSubitem} IN ('gerado','pesado','associado','em_sobra','em_analise')`,
    ),
    index('idx_subitens_transformacao').on(t.transformacaoId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_subitens_peca_origem').on(t.pecaOrigemId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_subitens_pedido_item').on(t.pedidoVendaItemId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_subitens_captura_meta_gin').using('gin', t.capturaMeta),
  ],
);

export const transformacoesRelations = relations(transformacoes, ({ one, many }) => ({
  pecaOrigem: one(pecas, {
    fields: [transformacoes.pecaOrigemId],
    references: [pecas.id],
  }),
  subitens: many(subitens),
}));

export const subitensRelations = relations(subitens, ({ one }) => ({
  transformacao: one(transformacoes, {
    fields: [subitens.transformacaoId],
    references: [transformacoes.id],
  }),
  pecaOrigem: one(pecas, {
    fields: [subitens.pecaOrigemId],
    references: [pecas.id],
  }),
  itemComercial: one(itensComerciais, {
    fields: [subitens.itemComercialId],
    references: [itensComerciais.id],
  }),
}));
```

- [ ] **Step 2: Alterar `pecas.status_peca` (CHECK) e `etiquetas_impressoes` (coluna subitem_id)**

Em `pesagem.schema.ts`:

(a) No CHECK `chk_pecas_status`, trocar a expressão para incluir os dois novos estados:

```ts
    check(
      'chk_pecas_status',
      sql`${t.statusPeca} IN ('pesada','associada','em_sobra','em_analise','para_corte','divergente','em_transformacao','transformada')`,
    ),
```

(b) No `import` do topo, adicionar `subitens`. Como `subitens` está em `transformacoes.schema.ts` e este importa `pecas` de `pesagem.schema.ts`, uma referência direta criaria ciclo. **Evitar o ciclo:** declarar a FK de `subitem_id` sem `.references(...)` (a FK é criada via SQL na migration). Adicionar à tabela `etiquetasImpressoes`, após `pecaId`:

```ts
    subitemId:       uuid('subitem_id'),
```

E adicionar, no array de constraints de `etiquetasImpressoes`, um CHECK garantindo exatamente um alvo, e um índice:

```ts
    check(
      'chk_etiq_um_alvo',
      sql`(${t.pecaId} IS NOT NULL)::int + (${t.subitemId} IS NOT NULL)::int = 1`,
    ),
    index('idx_etiq_subitem').on(t.subitemId),
```

**Importante:** alterar `pecaId` para nullable (`uuid('peca_id').references(() => pecas.id)` — remover `.notNull()`), pois agora a etiqueta pode ser de subitem. O CHECK garante integridade.

- [ ] **Step 3: Exportar o novo schema no index**

Em `index.ts`, adicionar ao final:

```ts
export * from './transformacoes.schema';
```

- [ ] **Step 4: Gerar a migration (delta apenas)**

Run:
```bash
cd app/backend && npm run db:generate
```
Expected: cria `src/database/migrations/0005_*.sql`. **Conferir que o arquivo contém SOMENTE o delta F4c:** `CREATE TABLE transformacoes`, `CREATE TABLE subitens`, `ALTER TABLE etiquetas_impressoes ADD COLUMN subitem_id`, `ALTER`/`DROP` do CHECK de `etiquetas_impressoes.peca_id` (nullable) + novo CHECK, e o redrop+recreate do CHECK `chk_pecas_status`. **NÃO deve** re-emitir tabelas de F1..F4b. Se reescrever tabelas existentes, abortar e investigar o snapshot drizzle.

- [ ] **Step 5: Ajustar a migration manualmente (trigger + FK subitem)**

Abrir `0005_*.sql` e garantir (drizzle-kit não gera triggers nem detecta a FK omitida):

1. Trigger de `updated_at` para as novas tabelas, ao final do arquivo:

```sql
--> statement-breakpoint
CREATE TRIGGER trg_transformacoes_updated_at BEFORE UPDATE ON "transformacoes" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_subitens_updated_at BEFORE UPDATE ON "subitens" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

2. FK de `etiquetas_impressoes.subitem_id → subitens.id` (omitida no schema para evitar ciclo de import):

```sql
--> statement-breakpoint
ALTER TABLE "etiquetas_impressoes" ADD CONSTRAINT "etiquetas_impressoes_subitem_id_subitens_id_fk" FOREIGN KEY ("subitem_id") REFERENCES "public"."subitens"("id") ON DELETE no action ON UPDATE no action;
```

(Garantir que este `ALTER` venha **depois** do `CREATE TABLE subitens`.)

- [ ] **Step 6: Aplicar a migration em banco limpo (Postgres efêmero)**

Subir o Postgres 18 efêmero e aplicar todas as migrations do zero (ver Task 17 para o setup do gate; aqui só validamos a migration):

```bash
docker run -d --name ac-pg-f4c -e POSTGRES_USER=alphacarnes -e POSTGRES_PASSWORD=alphacarnes -e POSTGRES_DB=alphacarnes_test -p 15433:5432 postgres:18
# aguardar healthy
cd app/backend && DATABASE_URL=postgres://alphacarnes:alphacarnes@127.0.0.1:15433/alphacarnes_test npm run db:migrate
```
Expected: "✅ Migrations aplicadas com sucesso" sem erro.

- [ ] **Step 7: Type-check**

Run: `cd app/backend && npm run type-check`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/backend/src/database/schema/ app/backend/src/database/migrations/0005_*.sql
git commit -m "feat(f4c): schema transformacoes+subitens e migration 0005"
```

---

## Task 5: Extrair helpers reusáveis de F4b (saldo, captura, compatibilidade)

Objetivo DRY: o corte reusa a lógica da F4b sem duplicar. Extrair funções puras/independentes de service, refatorar F4b para usá-las, e garantir que os testes F4b **continuam verdes** (comportamento idêntico).

**Files:**
- Create: `app/backend/src/modules/operacao/pesagem/saldo.ts`
- Create: `app/backend/src/modules/operacao/pesagem/captura.ts`
- Create: `app/backend/src/modules/operacao/pesagem/compatibilidade.ts`
- Modify: `app/backend/src/modules/operacao/pesagem/associacao.service.ts`
- Modify: `app/backend/src/modules/operacao/pesagem/pesagem.service.ts`

- [ ] **Step 1: Criar `saldo.ts` (UPDATE atômico anti-overbooking + devolução)**

```ts
import { and, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { pedidosVendaItens } from '../../../database/schema';

type Tx = NodePgDatabase<typeof schema>;

/** Incrementa atendida só enquanto < pedida (anti-overbooking). false = item completo. */
export async function consumirSaldo(tx: Tx, pedidoVendaItemId: string): Promise<boolean> {
  const r = await tx
    .update(pedidosVendaItens)
    .set({ quantidadeAtendida: sql`${pedidosVendaItens.quantidadeAtendida} + 1` })
    .where(
      and(
        eq(pedidosVendaItens.id, pedidoVendaItemId),
        sql`${pedidosVendaItens.quantidadeAtendida} < ${pedidosVendaItens.quantidadePedida}`,
      ),
    )
    .returning({ id: pedidosVendaItens.id });
  return r.length > 0;
}

/** Devolve 1 unidade ao item (CHECK >= 0 é backstop). */
export async function devolverSaldo(tx: Tx, pedidoVendaItemId: string): Promise<void> {
  await tx
    .update(pedidosVendaItens)
    .set({ quantidadeAtendida: sql`${pedidosVendaItens.quantidadeAtendida} - 1` })
    .where(eq(pedidosVendaItens.id, pedidoVendaItemId));
}
```

- [ ] **Step 2: Criar `compatibilidade.ts` (cálculo de compatíveis para um item comercial + compra)**

Extrai a query/score hoje em `AssociacaoService.calcularCompativeis`, parametrizada por `(compraProgramadaId, itemComercialId, peso)` — para reuso pela peça (F4b) e pelo subitem (F4c, que pode ter item reclassificado).

```ts
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { clientes, pedidosVenda, pedidosVendaItens } from '../../../database/schema';
import { subtrairQtd } from '../../../common/crud/decimal';
import { calcularScores, type CandidatoPedido, type SugestaoScored } from './associacao-score';

type Tx = NodePgDatabase<typeof schema>;

/** Itens de pedidos da MESMA compra (RN-02), abertos, do mesmo item comercial, com saldo. */
export async function calcularCompativeisItem(
  tx: Tx,
  params: { compraProgramadaId: string; itemComercialId: string; peso: string },
): Promise<SugestaoScored[]> {
  const linhas = await tx
    .select({
      pedidoVendaId: pedidosVenda.id,
      pedidoVendaItemId: pedidosVendaItens.id,
      itemComercialId: pedidosVendaItens.itemComercialId,
      clienteId: pedidosVenda.clienteId,
      quantidadePedida: pedidosVendaItens.quantidadePedida,
      quantidadeAtendida: pedidosVendaItens.quantidadeAtendida,
      prioridade: pedidosVenda.prioridade,
      rotaPrevista: pedidosVenda.rotaPrevista,
      preferenciasCliente: clientes.preferenciasJson,
    })
    .from(pedidosVendaItens)
    .innerJoin(pedidosVenda, eq(pedidosVendaItens.pedidoVendaId, pedidosVenda.id))
    .innerJoin(clientes, eq(pedidosVenda.clienteId, clientes.id))
    .where(
      and(
        eq(pedidosVenda.compraProgramadaId, params.compraProgramadaId),
        eq(pedidosVendaItens.itemComercialId, params.itemComercialId),
        isNull(pedidosVenda.deletedAt),
        sql`${pedidosVenda.status} <> 'cancelado'`,
        sql`${pedidosVendaItens.status} <> 'cancelado'`,
      ),
    );

  const candidatos: CandidatoPedido[] = linhas.map((l) => {
    const pref = (l.preferenciasCliente ?? {}) as Record<string, unknown>;
    return {
      pedidoVendaId: l.pedidoVendaId,
      pedidoVendaItemId: l.pedidoVendaItemId,
      itemComercialId: l.itemComercialId,
      clienteId: l.clienteId,
      saldoPendente: subtrairQtd(l.quantidadePedida, l.quantidadeAtendida),
      prioridade: l.prioridade,
      rotaPrevista: l.rotaPrevista,
      preferencias: {
        faixaPesoMin: typeof pref.faixaPesoMin === 'number' ? pref.faixaPesoMin : undefined,
        faixaPesoMax: typeof pref.faixaPesoMax === 'number' ? pref.faixaPesoMax : undefined,
        perfilGordura: typeof pref.perfilGordura === 'string' ? pref.perfilGordura : undefined,
      },
    };
  });

  return calcularScores({ itemComercialBaseId: params.itemComercialId, pesoOriginal: params.peso }, candidatos);
}
```

- [ ] **Step 3: Criar `captura.ts` (contrato ADR-009 reutilizável)**

Extrai a decisão automático/manual de `PesagemService.registrarPesagem` numa função pura que devolve `{ peso, capturaMeta }` ou lança a exceção apropriada. Recebe os gateways e o user.

```ts
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { formatarQtd } from '../../../common/crud/decimal';
import { PERMISSOES } from '../../../common/rbac/permissoes';
import type { BalancaGateway, SaudeDispositivo } from '../../../hardware/hardware.types';
import type { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';

export interface EntradaCaptura {
  modoCaptura: 'automatico' | 'manual_assistido';
  pesoManual?: number;
  motivo?: string;
  motivoDetalhe?: string;
}

export interface ResultadoCaptura {
  peso: string;
  capturaMeta: Record<string, unknown>;
}

/**
 * Aplica o contrato ADR-009. Em automático exige leitura estável (senão lança e o
 * caller emite status). Em manual exige PESO_MANUAL (403) + pesoManual+motivo (400).
 * Nunca inventa valor. `onIndisponivel` permite ao caller emitir o evento de status.
 */
export async function resolverCaptura(
  balanca: BalancaGateway,
  dto: EntradaCaptura,
  user: CurrentUserPayload,
  onIndisponivel?: (saude: SaudeDispositivo) => void,
): Promise<ResultadoCaptura> {
  if (dto.modoCaptura === 'automatico') {
    const saude = balanca.status();
    if (saude.status !== 'disponivel') {
      onIndisponivel?.(saude);
      throw new ConflictException(
        'Balança indisponível ou instável: captura automática não disponível, use o modo manual assistido',
      );
    }
    const leitura = await balanca.lerEstavel();
    if (!leitura.estavel) {
      onIndisponivel?.(leitura.saude);
      throw new ConflictException('Leitura instável: confirme via modo manual assistido com motivo');
    }
    return {
      peso: formatarQtd(leitura.peso),
      capturaMeta: { leitura_estavel: true, gateway_status: leitura.saude, operador: user.sub },
    };
  }

  if (!user.permissoes.includes(PERMISSOES.PESO_MANUAL)) {
    throw new ForbiddenException('Sem permissão PESO_MANUAL para captura manual assistida');
  }
  if (dto.pesoManual === undefined || !dto.motivo) {
    throw new BadRequestException('Captura manual exige pesoManual e motivo');
  }
  return {
    peso: formatarQtd(dto.pesoManual),
    capturaMeta: {
      leitura_estavel: false,
      motivo: dto.motivo,
      motivo_detalhe: dto.motivoDetalhe ?? null,
      gateway_status: balanca.status(),
      operador: user.sub,
    },
  };
}
```

- [ ] **Step 4: Refatorar `AssociacaoService` para usar `saldo.ts` e `compatibilidade.ts`**

- Remover o método privado `consumirSaldo` e os `tx.update(...quantidadeAtendida - 1...)` inline, substituindo por `consumirSaldo(tx, ...)` / `devolverSaldo(tx, ...)` importados de `./saldo`.
- Substituir o corpo de `calcularCompativeis(tx, peca)` por: `return calcularCompativeisItem(tx, { compraProgramadaId: peca.compraProgramadaId, itemComercialId: peca.itemComercialBaseId, peso: peca.pesoOriginal });` (importado de `./compatibilidade`). Remover os imports agora não usados (`clientes`, `subtrairQtd`, `calcularScores`, `CandidatoPedido`) conforme o lint apontar.
- Manter assinaturas públicas e comportamento idênticos.

- [ ] **Step 5: Refatorar `PesagemService.registrarPesagem` para usar `resolverCaptura`**

Substituir o bloco `if (dto.modoCaptura === 'automatico') {...} else {...}` (que define `peso`/`capturaMeta`) por:

```ts
    const { peso, capturaMeta } = await resolverCaptura(this.balanca, dto, user, (saude) =>
      this.emitirStatusDispositivo('balanca', saude, recebimento.dataOperacao),
    );
```

Importar `resolverCaptura` de `./captura`. Remover imports que ficarem sem uso (`formatarQtd`, `PERMISSOES`, exceções não mais lançadas diretamente) conforme o lint. Manter o resto (transação, auditoria, emit) idêntico.

- [ ] **Step 6: Rodar os testes de F4b — devem continuar verdes**

Run (com Postgres efêmero ativo e `DATABASE_URL` apontando para ele):
```bash
cd app/backend && npx jest test/integration/pesagem.e2e-spec.ts test/integration/associacao.e2e-spec.ts test/unit/pesagem-eventos.spec.ts
```
Expected: PASS (comportamento inalterado).

- [ ] **Step 7: Commit**

```bash
git add app/backend/src/modules/operacao/pesagem/
git commit -m "refactor(f4b): extrai saldo/captura/compatibilidade para reuso na F4c"
```

---

## Task 6: EtiquetaService — emissão/reimpressão de subitem + QR de subitem

**Files:**
- Modify: `app/backend/src/modules/operacao/pesagem/etiqueta.service.ts`

- [ ] **Step 1: Tornar a inserção em `etiquetas_impressoes` ciente de subitem**

A tabela agora tem `subitemId` e `pecaId` nullable. Adicionar imports `subitens` e `transformacoes` de `../../../database/schema`. Definir tipo `type Subitem = typeof subitens.$inferSelect;`.

Adicionar os métodos abaixo na classe (após `reimprimir`). Best-effort de impressão idêntico ao da peça; payload referencia a peça original (RF-CT-16/RF-RT-02):

```ts
  /** Emite a etiqueta de um subitem (RF-CT-15/16, RF-RT-04). Referencia a peça original. */
  async emitirSubitem(subitemId: string, operadorId: string): Promise<{ subitem: Subitem; etiqueta: Etiqueta }> {
    const subitem = await this.buscarSubitemAtivo(subitemId);
    if (!subitem) throw new NotFoundException('Subitem não encontrado');
    if (subitem.statusSubitem !== 'associado') {
      throw new ConflictException('Etiqueta do subitem só pode ser emitida após a associação');
    }

    const codigoEtiqueta = subitem.etiquetaAtual ?? `QR-SUB-${subitem.id}`;
    const payloadBase = this.montarPayloadSubitem(subitem, codigoEtiqueta);

    const impressao = await this.impressora.imprimir(payloadBase);
    const statusImpressao = impressao.impresso ? 'impressa' : 'falha_impressao';

    return this.db.transaction(async (tx) => {
      const atualizado = primeiroOuFalha(
        await tx.update(subitens).set({ etiquetaAtual: codigoEtiqueta }).where(eq(subitens.id, subitemId)).returning(),
      );
      const etiqueta = primeiroOuFalha(
        await tx
          .insert(etiquetasImpressoes)
          .values({
            subitemId,
            payload: { ...payloadBase, jobId: impressao.jobId, erro: impressao.erro ?? null, gateway_status: impressao.saude },
            statusImpressao,
            reimpressao: false,
            operadorId,
          })
          .returning(),
      );
      await this.auditoria.registrar(tx, {
        tabela: 'etiquetas_impressoes',
        registroId: etiqueta.id,
        operacao: 'INSERT',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: {},
        dadosNovos: etiqueta,
      });
      return { subitem: atualizado, etiqueta };
    });
  }

  /** Reimpressão auditada da etiqueta do subitem (RF-CT-18). */
  async reimprimirSubitem(subitemId: string, operadorId: string): Promise<{ subitem: Subitem; etiqueta: Etiqueta }> {
    const subitem = await this.buscarSubitemAtivo(subitemId);
    if (!subitem) throw new NotFoundException('Subitem não encontrado');
    if (!subitem.etiquetaAtual) throw new ConflictException('Subitem ainda não teve etiqueta emitida');

    const payloadBase = this.montarPayloadSubitem(subitem, subitem.etiquetaAtual);
    const impressao = await this.impressora.imprimir(payloadBase);
    const statusImpressao = impressao.impresso ? 'impressa' : 'falha_impressao';

    return this.db.transaction(async (tx) => {
      const etiqueta = primeiroOuFalha(
        await tx
          .insert(etiquetasImpressoes)
          .values({
            subitemId,
            payload: { ...payloadBase, jobId: impressao.jobId, erro: impressao.erro ?? null, gateway_status: impressao.saude },
            statusImpressao,
            reimpressao: true,
            operadorId,
          })
          .returning(),
      );
      await this.auditoria.registrar(tx, {
        tabela: 'etiquetas_impressoes',
        registroId: etiqueta.id,
        operacao: 'INSERT',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: {},
        dadosNovos: etiqueta,
      });
      return { subitem, etiqueta };
    });
  }

  private montarPayloadSubitem(subitem: Subitem, codigo: string): Record<string, unknown> {
    return {
      subitemId: subitem.id,
      pecaOrigemId: subitem.pecaOrigemId, // referência à peça original (RF-CT-16/RF-RT-02)
      transformacaoId: subitem.transformacaoId,
      itemComercialId: subitem.itemComercialId,
      peso: subitem.peso,
      pedidoVendaId: subitem.pedidoVendaId,
      pedidoVendaItemId: subitem.pedidoVendaItemId,
      qr: codigo,
    };
  }

  private async buscarSubitemAtivo(id: string): Promise<Subitem | null> {
    return this.db
      .select()
      .from(subitens)
      .where(and(eq(subitens.id, id), isNull(subitens.deletedAt)))
      .then((r) => r[0] ?? null);
  }
```

- [ ] **Step 2: `resolverQr` resolve também subitem**

Em `resolverPorCodigo`, antes do `return null` final, adicionar resolução por subitem (etiqueta `QR-SUB-<id>` ou `etiqueta_atual` do subitem). Refatorar para que `resolverQr` retorne uma união `{ tipo: 'peca'; peca } | { tipo: 'subitem'; subitem }`. **Para não quebrar a F4b**, manter `resolverQr` retornando `Peca` e adicionar um novo método `resolverQrSubitem(dto)` no mesmo contrato, usado pela rota de corte. Implementar:

```ts
  /** Resolve um QR num subitem real (ADR-009). Mesmo contrato de resolverQr. */
  async resolverQrSubitem(dto: ResolverQrDto): Promise<Subitem> {
    const codigo = dto.modoCaptura === 'automatico' ? await this.leitor.ler() : dto.codigo!;
    const limpo = codigo.trim();
    if (limpo) {
      const porEtiqueta = await this.db
        .select()
        .from(subitens)
        .where(and(eq(subitens.etiquetaAtual, limpo), isNull(subitens.deletedAt)))
        .then((r) => r[0] ?? null);
      if (porEtiqueta) return porEtiqueta;
      const id = limpo.startsWith('QR-SUB-') ? limpo.slice(7) : limpo;
      if (/^[0-9a-fA-F-]{36}$/.test(id)) {
        const porId = await this.db
          .select()
          .from(subitens)
          .where(and(eq(subitens.id, id), isNull(subitens.deletedAt)))
          .then((r) => r[0] ?? null);
        if (porId) return porId;
      }
    }
    throw new NotFoundException('Código não corresponde a nenhum subitem');
  }
```

- [ ] **Step 3: Type-check + testes de etiqueta F4b verdes**

Run: `cd app/backend && npm run type-check && npx jest test/integration/etiqueta.e2e-spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/backend/src/modules/operacao/pesagem/etiqueta.service.ts
git commit -m "feat(f4c): etiqueta e resolução de QR de subitem (best-effort, ref. origem)"
```

---

## Task 7: DTOs do corte (Zod)

**Files:**
- Create: `app/backend/src/modules/operacao/corte/dto/corte.dto.ts`
- Create: `app/backend/src/modules/operacao/corte/dto/subitem.dto.ts`

- [ ] **Step 1: `corte.dto.ts`**

```ts
import { z } from 'zod';

export const TIPOS_TRANSFORMACAO = ['simples', 'subdivisao', 'reclassificacao', 'destinacao_mista'] as const;
export const MOTIVOS_TRANSFORMACAO = ['preferencia_cliente', 'necessidade_operacional', 'divergencia', 'decisao_humana'] as const;

/** Abertura do corte de uma peça. */
export const iniciarCorteSchema = z
  .object({
    tipoTransformacao: z.enum(TIPOS_TRANSFORMACAO),
    motivo: z.enum(MOTIVOS_TRANSFORMACAO),
    motivoDetalhe: z.string().trim().max(500).optional(),
    observacoes: z.string().trim().max(1000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.motivo === 'decisao_humana' && !v.motivoDetalhe) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motivoDetalhe'], message: 'motivoDetalhe é obrigatório para decisão humana' });
    }
  });
export type IniciarCorteDto = z.infer<typeof iniciarCorteSchema>;

/** Conclusão do corte. justificativaDiferenca exigida quando há diferença de peso (regra dura no service). */
export const concluirCorteSchema = z.object({
  justificativaDiferenca: z.string().trim().max(1000).optional(),
});
export type ConcluirCorteDto = z.infer<typeof concluirCorteSchema>;
```

- [ ] **Step 2: `subitem.dto.ts` (reusa MODOS/MOTIVOS de captura e o contrato de sem-cobertura da F4b)**

```ts
import { z } from 'zod';
import { MODOS_CAPTURA, MOTIVOS_CAPTURA_MANUAL } from '../../pesagem/dto/pesagem.dto';
import { divergenciaInputSchema } from '../../recebimento/divergencia/dto/divergencia-recebimento.dto';

/** Geração de um subitem (antes de pesar). itemComercialId pode reclassificar. */
export const adicionarSubitemSchema = z.object({
  itemComercialId: z.string().uuid(),
  classificacao: z.string().trim().max(200).optional(),
  quantidade: z.number().positive().max(9_999.999).optional(),
  observacoes: z.string().trim().max(1000).optional(),
});
export type AdicionarSubitemDto = z.infer<typeof adicionarSubitemSchema>;

/** Pesagem do subitem — contrato ADR-009 idêntico ao da peça. */
export const pesarSubitemSchema = z
  .object({
    modoCaptura: z.enum(MODOS_CAPTURA),
    pesoManual: z.number().positive().max(9_999_999.999).optional(),
    motivo: z.enum(MOTIVOS_CAPTURA_MANUAL).optional(),
    motivoDetalhe: z.string().trim().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.modoCaptura === 'manual_assistido') {
      if (v.pesoManual === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pesoManual'], message: 'pesoManual é obrigatório no modo manual assistido' });
      if (!v.motivo) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motivo'], message: 'motivo é obrigatório no modo manual assistido' });
      if (v.motivo === 'outro' && !v.motivoDetalhe) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motivoDetalhe'], message: 'motivoDetalhe é obrigatório quando motivo = outro' });
    }
  });
export type PesarSubitemDto = z.infer<typeof pesarSubitemSchema>;

export const associarSubitemSchema = z.object({
  pedidoVendaItemId: z.string().uuid(),
});
export type AssociarSubitemDto = z.infer<typeof associarSubitemSchema>;

export const redirecionarSubitemSchema = z.object({
  pedidoVendaItemId: z.string().uuid(),
  motivo: z.string().trim().min(1, 'motivo é obrigatório').max(500),
});
export type RedirecionarSubitemDto = z.infer<typeof redirecionarSubitemSchema>;

export const DESTINOS_SUBITEM_SEM_COBERTURA = ['sobra', 'analise', 'divergencia'] as const;

export const semCoberturaSubitemSchema = z
  .object({
    destino: z.enum(DESTINOS_SUBITEM_SEM_COBERTURA),
    motivo: z.string().trim().max(500).optional(),
    divergencia: divergenciaInputSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.destino === 'sobra' && !v.motivo) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motivo'], message: 'motivo é obrigatório para destinar à sobra' });
    if (v.destino === 'divergencia' && !v.divergencia) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['divergencia'], message: 'classificação de divergência é obrigatória' });
  });
export type SemCoberturaSubitemDto = z.infer<typeof semCoberturaSubitemSchema>;
```

> Nota: `MODOS_CAPTURA` e `MOTIVOS_CAPTURA_MANUAL` já são exportados de `pesagem/dto/pesagem.dto.ts`. `divergenciaInputSchema` já é importável (usado pela F4b).

- [ ] **Step 3: Type-check**

Run: `cd app/backend && npm run type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/backend/src/modules/operacao/corte/dto/
git commit -m "feat(f4c): DTOs do corte e do subitem"
```

---

## Task 8: SubitemService (gerar/pesar/associar/redirecionar/sem-cobertura/reetiquetar)

**Files:**
- Create: `app/backend/src/modules/operacao/corte/subitem.service.ts`

Regras: cada mutação é transacional + auditada; eventos pós-commit; reusa `resolverCaptura`, `consumirSaldo`/`devolverSaldo`, `calcularCompativeisItem`, `EtiquetaService`, `DivergenciaRecebimentoService`. Todas as operações exigem que a transformação esteja **não concluída/cancelada** (senão 409).

- [ ] **Step 1: Criar o service**

```ts
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { pecas, recebimentos, recebimentosItens, subitens, transformacoes } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { primeiroOuFalha } from '../../../common/crud/paginacao';
import { EVENTOS } from '../../../realtime/events/eventos';
import { BALANCA_GATEWAY, type BalancaGateway } from '../../../hardware/hardware.types';
import type { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { resolverCaptura } from '../pesagem/captura';
import { consumirSaldo, devolverSaldo } from '../pesagem/saldo';
import { calcularCompativeisItem } from '../pesagem/compatibilidade';
import { EtiquetaService } from '../pesagem/etiqueta.service';
import { DivergenciaRecebimentoService } from '../recebimento/divergencia/divergencia-recebimento.service';
import type { AdicionarSubitemDto, AssociarSubitemDto, PesarSubitemDto, RedirecionarSubitemDto, SemCoberturaSubitemDto } from './dto/subitem.dto';

type Tx = NodePgDatabase<typeof schema>;
type Subitem = typeof subitens.$inferSelect;
type Transformacao = typeof transformacoes.$inferSelect;

@Injectable()
export class SubitemService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(BALANCA_GATEWAY) private readonly balanca: BalancaGateway,
    private readonly etiqueta: EtiquetaService,
    private readonly divergencias: DivergenciaRecebimentoService,
  ) {}

  private get db() { return this.drizzle.db; }

  /** Gera um subitem 'gerado' numa transformação aberta (RF-CT-06/07/08). */
  async adicionar(transformacaoId: string, dto: AdicionarSubitemDto, operadorId: string): Promise<Subitem> {
    const resultado = await this.db.transaction(async (tx) => {
      const transf = await this.transformacaoEditavel(tx, transformacaoId);
      const criado = primeiroOuFalha(
        await tx
          .insert(subitens)
          .values({
            transformacaoId,
            pecaOrigemId: transf.pecaOrigemId,
            itemComercialId: dto.itemComercialId,
            classificacao: dto.classificacao,
            quantidade: dto.quantidade !== undefined ? String(dto.quantidade) : '1',
            statusSubitem: 'gerado',
            observacoes: dto.observacoes,
          })
          .returning(),
      );
      await this.auditoria.registrar(tx, { tabela: 'subitens', registroId: criado.id, operacao: 'INSERT', modulo: 'operacao', usuarioId: operadorId, dadosAnteriores: {}, dadosNovos: criado });
      return { subitem: criado, dataOperacao: await this.dataOperacao(tx, transf.pecaOrigemId) };
    });

    this.eventEmitter.emit(EVENTOS.SUBITEM_GERADO, {
      transformacaoId,
      subitemId: resultado.subitem.id,
      dataOperacao: resultado.dataOperacao,
    });
    return resultado.subitem;
  }

  /** Remove (soft) um subitem ainda 'gerado' (antes do encerramento). */
  async remover(subitemId: string, operadorId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const subitem = await this.subitemAtivo(tx, subitemId);
      if (!subitem) throw new NotFoundException('Subitem não encontrado');
      await this.transformacaoEditavel(tx, subitem.transformacaoId);
      if (subitem.statusSubitem !== 'gerado') {
        throw new ConflictException('Só é possível remover subitem ainda não pesado/associado');
      }
      const removido = primeiroOuFalha(
        await tx.update(subitens).set({ deletedAt: new Date() }).where(eq(subitens.id, subitemId)).returning(),
      );
      await this.auditoria.registrar(tx, { tabela: 'subitens', registroId: subitemId, operacao: 'DELETE', modulo: 'operacao', usuarioId: operadorId, dadosAnteriores: subitem, dadosNovos: removido });
    });
  }

  /** Pesa o subitem pelo contrato ADR-009 (reusa resolverCaptura). subitem → 'pesado'. */
  async pesar(subitemId: string, dto: PesarSubitemDto, user: CurrentUserPayload): Promise<Subitem> {
    const subitemAtual = await this.subitemAtivo(this.db, subitemId);
    if (!subitemAtual) throw new NotFoundException('Subitem não encontrado');
    const transf = await this.transformacaoEditavel(this.db, subitemAtual.transformacaoId);
    const dataOperacao = await this.dataOperacao(this.db, transf.pecaOrigemId);

    const { peso, capturaMeta } = await resolverCaptura(this.balanca, dto, user, (saude) =>
      this.eventEmitter.emit(EVENTOS.DISPOSITIVO_STATUS_ALTERADO, {
        dataOperacao,
        dispositivo: 'balanca',
        dispositivoId: saude.dispositivoId,
        status: saude.status,
        heartbeatEm: saude.heartbeatEm,
      }),
    );

    const atualizado = await this.db.transaction(async (tx) => {
      const s = primeiroOuFalha(
        await tx
          .update(subitens)
          .set({ peso, modoCapturaPeso: dto.modoCaptura, capturaMeta, statusSubitem: 'pesado' })
          .where(and(eq(subitens.id, subitemId), isNull(subitens.deletedAt)))
          .returning(),
      );
      await this.auditoria.registrar(tx, { tabela: 'subitens', registroId: subitemId, operacao: 'UPDATE', modulo: 'operacao', usuarioId: user.sub, dadosAnteriores: subitemAtual, dadosNovos: s });
      return s;
    });

    this.eventEmitter.emit(EVENTOS.SUBITEM_PESADO, {
      transformacaoId: subitemAtual.transformacaoId,
      subitemId,
      dataOperacao,
      modoCaptura: dto.modoCaptura,
      peso,
    });
    return atualizado;
  }

  /** Associa o subitem por unidade ao item do SEU item comercial (reclassificável). */
  async associar(subitemId: string, dto: AssociarSubitemDto, operadorId: string): Promise<Subitem> {
    const resultado = await this.db.transaction(async (tx) => {
      const subitem = await this.subitemAtivo(tx, subitemId);
      if (!subitem) throw new NotFoundException('Subitem não encontrado');
      await this.transformacaoEditavel(tx, subitem.transformacaoId);
      if (subitem.statusSubitem !== 'pesado') {
        throw new ConflictException('Subitem precisa estar pesado antes de associar');
      }
      const item = await this.itemCompativel(tx, subitem, dto.pedidoVendaItemId);
      const consumido = await consumirSaldo(tx, dto.pedidoVendaItemId);
      if (!consumido) throw new ConflictException('Item do pedido já está completo');

      const atualizado = primeiroOuFalha(
        await tx
          .update(subitens)
          .set({ statusSubitem: 'associado', pedidoVendaId: item.pedidoVendaId, pedidoVendaItemId: item.id })
          .where(eq(subitens.id, subitemId))
          .returning(),
      );
      await this.auditoria.registrar(tx, { tabela: 'subitens', registroId: subitemId, operacao: 'UPDATE', modulo: 'operacao', usuarioId: operadorId, dadosAnteriores: subitem, dadosNovos: atualizado });
      return { subitem: atualizado, dataOperacao: await this.dataOperacao(tx, subitem.pecaOrigemId) };
    });

    this.emitAssociado(resultado.subitem, resultado.dataOperacao);
    return resultado.subitem;
  }

  /** Redireciona o subitem associado para outro item compatível (devolve+consome). */
  async redirecionar(subitemId: string, dto: RedirecionarSubitemDto, operadorId: string): Promise<Subitem> {
    const resultado = await this.db.transaction(async (tx) => {
      const subitem = await this.subitemAtivo(tx, subitemId);
      if (!subitem) throw new NotFoundException('Subitem não encontrado');
      await this.transformacaoEditavel(tx, subitem.transformacaoId);
      if (subitem.statusSubitem !== 'associado' || !subitem.pedidoVendaItemId) {
        throw new ConflictException('Só é possível redirecionar subitem já associado');
      }
      if (subitem.pedidoVendaItemId === dto.pedidoVendaItemId) {
        throw new ConflictException('Subitem já está neste item do pedido');
      }
      const destino = await this.itemCompativel(tx, subitem, dto.pedidoVendaItemId);
      const consumido = await consumirSaldo(tx, dto.pedidoVendaItemId);
      if (!consumido) throw new ConflictException('Item de destino já está completo');
      await devolverSaldo(tx, subitem.pedidoVendaItemId);

      const atualizado = primeiroOuFalha(
        await tx
          .update(subitens)
          .set({ pedidoVendaId: destino.pedidoVendaId, pedidoVendaItemId: destino.id, observacoes: dto.motivo })
          .where(eq(subitens.id, subitemId))
          .returning(),
      );
      await this.auditoria.registrar(tx, { tabela: 'subitens', registroId: subitemId, operacao: 'UPDATE', modulo: 'operacao', usuarioId: operadorId, dadosAnteriores: subitem, dadosNovos: atualizado });
      return { subitem: atualizado, dataOperacao: await this.dataOperacao(tx, subitem.pecaOrigemId) };
    });

    this.emitAssociado(resultado.subitem, resultado.dataOperacao);
    return resultado.subitem;
  }

  /** Subitem sem cobertura: sobra (motivo)/analise/divergencia (reusa F4a). Devolve saldo se associado. */
  async semCobertura(subitemId: string, dto: SemCoberturaSubitemDto, operadorId: string): Promise<Subitem> {
    const mapaStatus = { sobra: 'em_sobra', analise: 'em_analise', divergencia: 'em_analise' } as const;
    const resultado = await this.db.transaction(async (tx) => {
      const subitem = await this.subitemAtivo(tx, subitemId);
      if (!subitem) throw new NotFoundException('Subitem não encontrado');
      await this.transformacaoEditavel(tx, subitem.transformacaoId);

      if (subitem.pedidoVendaItemId) await devolverSaldo(tx, subitem.pedidoVendaItemId);

      const atualizado = primeiroOuFalha(
        await tx
          .update(subitens)
          .set({ statusSubitem: mapaStatus[dto.destino], pedidoVendaId: null, pedidoVendaItemId: null, observacoes: dto.motivo ?? subitem.observacoes })
          .where(eq(subitens.id, subitemId))
          .returning(),
      );

      if (dto.destino === 'divergencia' && dto.divergencia) {
        const recItem = await this.recebimentoItemDaPeca(tx, subitem.pecaOrigemId);
        await this.divergencias.abrirNaTx(tx, { recebimentoId: recItem.recebimentoId, recebimentoItemId: recItem.id, ...dto.divergencia }, operadorId);
      }

      await this.auditoria.registrar(tx, { tabela: 'subitens', registroId: subitemId, operacao: 'UPDATE', modulo: 'operacao', usuarioId: operadorId, dadosAnteriores: subitem, dadosNovos: atualizado });
      return { subitem: atualizado, dataOperacao: await this.dataOperacao(tx, subitem.pecaOrigemId) };
    });

    this.emitAssociado(resultado.subitem, resultado.dataOperacao);
    return resultado.subitem;
  }

  /** Sugestão de pedidos compatíveis para o subitem (efêmera). */
  async sugerir(subitemId: string) {
    const subitem = await this.subitemAtivo(this.db, subitemId);
    if (!subitem) throw new NotFoundException('Subitem não encontrado');
    const compativeis = await this.compativeis(this.db, subitem);
    return { subitemId, sugestao: compativeis[0] ?? null, compativeis };
  }

  /** Reetiqueta o subitem (best-effort; ref. peça original). */
  async reetiquetar(subitemId: string, operadorId: string) {
    return this.etiqueta.emitirSubitem(subitemId, operadorId);
  }
  async reimprimir(subitemId: string, operadorId: string) {
    return this.etiqueta.reimprimirSubitem(subitemId, operadorId);
  }

  // ── internos ───────────────────────────────────────────────────────────────

  private emitAssociado(subitem: Subitem, dataOperacao: string): void {
    this.eventEmitter.emit(EVENTOS.SUBITEM_ASSOCIADO, {
      transformacaoId: subitem.transformacaoId,
      subitemId: subitem.id,
      dataOperacao,
      pedidoVendaId: subitem.pedidoVendaId,
      pedidoVendaItemId: subitem.pedidoVendaItemId,
      statusSubitem: subitem.statusSubitem,
    });
  }

  private async compativeis(tx: Tx, subitem: Subitem) {
    const peca = await tx.select().from(pecas).where(eq(pecas.id, subitem.pecaOrigemId)).then((r) => r[0]!);
    return calcularCompativeisItem(tx, {
      compraProgramadaId: peca.compraProgramadaId,
      itemComercialId: subitem.itemComercialId,
      peso: subitem.peso ?? '0',
    });
  }

  private async itemCompativel(tx: Tx, subitem: Subitem, pedidoVendaItemId: string) {
    const peca = await tx.select().from(pecas).where(eq(pecas.id, subitem.pecaOrigemId)).then((r) => r[0]!);
    const item = await tx
      .select({
        id: schema.pedidosVendaItens.id,
        pedidoVendaId: schema.pedidosVendaItens.pedidoVendaId,
        itemComercialId: schema.pedidosVendaItens.itemComercialId,
        compraProgramadaId: schema.pedidosVenda.compraProgramadaId,
        statusPedido: schema.pedidosVenda.status,
        deletedAt: schema.pedidosVenda.deletedAt,
      })
      .from(schema.pedidosVendaItens)
      .innerJoin(schema.pedidosVenda, eq(schema.pedidosVendaItens.pedidoVendaId, schema.pedidosVenda.id))
      .where(eq(schema.pedidosVendaItens.id, pedidoVendaItemId))
      .then((r) => r[0] ?? null);
    if (!item || item.deletedAt) throw new NotFoundException('Item de pedido não encontrado');
    if (item.statusPedido === 'cancelado') throw new ConflictException('Pedido cancelado não aceita associação');
    // Reclassificação: compatibilidade é com o item comercial DO SUBITEM, não o da peça.
    if (item.itemComercialId !== subitem.itemComercialId) throw new ConflictException('Item de pedido incompatível com o subitem');
    if (item.compraProgramadaId !== peca.compraProgramadaId) throw new ConflictException('Pedido pertence a outra compra programada');
    return item;
  }

  private async recebimentoItemDaPeca(tx: Tx, pecaId: string) {
    const peca = await tx.select().from(pecas).where(eq(pecas.id, pecaId)).then((r) => r[0]!);
    const item = await tx
      .select()
      .from(recebimentosItens)
      .where(and(eq(recebimentosItens.recebimentoId, peca.recebimentoId), eq(recebimentosItens.itemComercialId, peca.itemComercialBaseId)))
      .then((r) => r[0] ?? null);
    if (!item) throw new ConflictException('Item de recebimento não encontrado para abrir divergência');
    return item;
  }

  private async transformacaoEditavel(tx: Tx, transformacaoId: string): Promise<Transformacao> {
    const transf = await tx
      .select()
      .from(transformacoes)
      .where(and(eq(transformacoes.id, transformacaoId), isNull(transformacoes.deletedAt)))
      .then((r) => r[0] ?? null);
    if (!transf) throw new NotFoundException('Transformação não encontrada');
    if (transf.statusTransformacao === 'concluida' || transf.statusTransformacao === 'cancelada') {
      throw new ConflictException('Transformação encerrada não aceita alterações');
    }
    return transf;
  }

  private async subitemAtivo(tx: Tx, id: string): Promise<Subitem | null> {
    return tx.select().from(subitens).where(and(eq(subitens.id, id), isNull(subitens.deletedAt))).then((r) => r[0] ?? null);
  }

  private async dataOperacao(tx: Tx, pecaId: string): Promise<string> {
    const r = await tx
      .select({ dataOperacao: recebimentos.dataOperacao })
      .from(pecas)
      .innerJoin(recebimentos, eq(pecas.recebimentoId, recebimentos.id))
      .where(eq(pecas.id, pecaId))
      .then((rows) => rows[0] ?? null);
    return r?.dataOperacao ?? '';
  }
}
```

- [ ] **Step 2: Type-check**

Run: `cd app/backend && npm run type-check`
Expected: PASS (depende de CorteModule só na injeção; o type-check de service isolado passa).

- [ ] **Step 3: Commit**

```bash
git add app/backend/src/modules/operacao/corte/subitem.service.ts
git commit -m "feat(f4c): SubitemService (gerar/pesar/associar/redirecionar/sem-cobertura/reetiqueta)"
```

---

## Task 9: CorteService (iniciar/concluir/cancelar/rastrear)

**Files:**
- Create: `app/backend/src/modules/operacao/corte/corte.service.ts`

- [ ] **Step 1: Criar o service**

```ts
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { associacoesPecaHistorico, etiquetasImpressoes, pecas, recebimentos, subitens, transformacoes } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { primeiroOuFalha } from '../../../common/crud/paginacao';
import { somarQtd, subtrairQtd, compararQtd, ehZero } from '../../../common/crud/decimal';
import { EVENTOS } from '../../../realtime/events/eventos';
import { devolverSaldo, consumirSaldo } from '../pesagem/saldo';
import type { IniciarCorteDto, ConcluirCorteDto } from './dto/corte.dto';

type Tx = NodePgDatabase<typeof schema>;
type Transformacao = typeof transformacoes.$inferSelect;
type Peca = typeof pecas.$inferSelect;

const ESTADOS_ELEGIVEIS = ['pesada', 'associada', 'para_corte'] as const;

@Injectable()
export class CorteService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private get db() { return this.drizzle.db; }

  /**
   * Abre o corte (RF-CT-01/04). Valida elegibilidade. Se a peça estava 'associada',
   * LIBERA a unidade no item de origem (RT-007-06) e zera o vínculo. Peça → 'em_transformacao'.
   */
  async iniciar(pecaId: string, dto: IniciarCorteDto, operadorId: string): Promise<Transformacao> {
    const resultado = await this.db.transaction(async (tx) => {
      const peca = await this.pecaAtiva(tx, pecaId);
      if (!peca) throw new NotFoundException('Peça não encontrada');
      if (!ESTADOS_ELEGIVEIS.includes(peca.statusPeca as (typeof ESTADOS_ELEGIVEIS)[number])) {
        throw new ConflictException(`Peça em estado '${peca.statusPeca}' não é elegível para corte`);
      }

      // Libera a unidade que a peça consumia (deixa de ser unidade expedível).
      if (peca.statusPeca === 'associada' && peca.pedidoVendaItemId) {
        await devolverSaldo(tx, peca.pedidoVendaItemId);
      }

      const atualizada = primeiroOuFalha(
        await tx
          .update(pecas)
          .set({ statusPeca: 'em_transformacao', pedidoVendaId: null, pedidoVendaItemId: null })
          .where(eq(pecas.id, pecaId))
          .returning(),
      );

      const transf = primeiroOuFalha(
        await tx
          .insert(transformacoes)
          .values({
            pecaOrigemId: pecaId,
            tipoTransformacao: dto.tipoTransformacao,
            motivo: dto.motivo,
            motivoDetalhe: dto.motivoDetalhe,
            operadorResponsavelId: operadorId,
            statusTransformacao: 'aberta',
            pesoOriginal: peca.pesoOriginal,
            observacoes: dto.observacoes,
          })
          .returning(),
      );

      await this.auditoria.registrar(tx, { tabela: 'transformacoes', registroId: transf.id, operacao: 'INSERT', modulo: 'operacao', usuarioId: operadorId, dadosAnteriores: peca, dadosNovos: { transformacao: transf, peca: atualizada } });
      return { transf, dataOperacao: await this.dataOperacao(tx, peca.recebimentoId) };
    });

    this.eventEmitter.emit(EVENTOS.CORTE_INICIADO, {
      transformacaoId: resultado.transf.id,
      pecaOrigemId: pecaId,
      dataOperacao: resultado.dataOperacao,
    });
    return resultado.transf;
  }

  /**
   * Conclui o corte (RF-CT-24, RF-CT-09/10, RF-CT-17). Validações duras:
   * - todo subitem ativo precisa de peso + destino + etiqueta;
   * - Σ pesos ≤ original; diferença ≠ 0 exige justificativa.
   * Idempotente: se já 'concluida', retorna sem efeito.
   */
  async concluir(transformacaoId: string, dto: ConcluirCorteDto, operadorId: string): Promise<Transformacao> {
    const resultado = await this.db.transaction(async (tx) => {
      const transf = await this.transformacaoAtiva(tx, transformacaoId);
      if (!transf) throw new NotFoundException('Transformação não encontrada');
      if (transf.statusTransformacao === 'concluida') return { transf, dataOperacao: '', jaConcluido: true };
      if (transf.statusTransformacao === 'cancelada') throw new ConflictException('Transformação cancelada não pode ser concluída');

      const lista = await tx.select().from(subitens).where(and(eq(subitens.transformacaoId, transformacaoId), isNull(subitens.deletedAt)));
      if (lista.length === 0) throw new ConflictException('Não há subitens para concluir o corte');

      // Destino obrigatório (RF-CT-24, RT-007-05): peso + destino + etiqueta válida.
      const DESTINOS_OK = ['associado', 'em_sobra', 'em_analise'];
      for (const s of lista) {
        if (!s.peso) throw new ConflictException(`Subitem ${s.id} sem peso`);
        if (!DESTINOS_OK.includes(s.statusSubitem)) throw new ConflictException(`Subitem ${s.id} sem destino definido`);
        if (!s.etiquetaAtual) throw new ConflictException(`Subitem ${s.id} sem etiqueta válida`);
      }

      // Conservação de peso (RF-CT-09/10).
      const total = lista.reduce((acc, s) => somarQtd(acc, s.peso ?? '0'), '0.000');
      const diferenca = subtrairQtd(transf.pesoOriginal, total); // positivo = perda; negativo = excesso
      if (!ehZero(diferenca) && !dto.justificativaDiferenca) {
        throw new ConflictException('Diferença de peso entre original e subitens exige justificativa');
      }
      // Σ > original (excesso, diferenca < 0) sempre exige justificativa — coberto acima.

      const atualizada = primeiroOuFalha(
        await tx
          .update(transformacoes)
          .set({
            statusTransformacao: 'concluida',
            dataHoraEncerramento: new Date(),
            pesoSubitensTotal: total,
            diferencaPeso: diferenca,
            justificativaDiferenca: dto.justificativaDiferenca ?? null,
          })
          .where(and(eq(transformacoes.id, transformacaoId), eq(transformacoes.statusTransformacao, transf.statusTransformacao)))
          .returning(),
      );

      // Invalida logicamente a etiqueta original p/ expedição: peça → 'transformada'.
      // etiqueta_atual da peça é PRESERVADA (coexiste no histórico — RT-007-04).
      await tx.update(pecas).set({ statusPeca: 'transformada' }).where(eq(pecas.id, transf.pecaOrigemId));

      await this.auditoria.registrar(tx, { tabela: 'transformacoes', registroId: transformacaoId, operacao: 'UPDATE', modulo: 'operacao', usuarioId: operadorId, dadosAnteriores: transf, dadosNovos: atualizada });
      return { transf: atualizada, dataOperacao: await this.dataOperacao(tx, (await this.pecaAtiva(tx, transf.pecaOrigemId))!.recebimentoId), jaConcluido: false };
    });

    if (!resultado.jaConcluido) {
      this.eventEmitter.emit(EVENTOS.CORTE_CONCLUIDO, {
        transformacaoId,
        pecaOrigemId: resultado.transf.pecaOrigemId,
        dataOperacao: resultado.dataOperacao,
        pesoOriginal: resultado.transf.pesoOriginal,
        pesoSubitensTotal: resultado.transf.pesoSubitensTotal ?? '0.000',
        diferencaPeso: resultado.transf.diferencaPeso ?? '0.000',
      });
    }
    return resultado.transf;
  }

  /** Cancela o corte (antes de concluído): restaura a peça e descarta subitens. */
  async cancelar(transformacaoId: string, operadorId: string): Promise<Transformacao> {
    return this.db.transaction(async (tx) => {
      const transf = await this.transformacaoAtiva(tx, transformacaoId);
      if (!transf) throw new NotFoundException('Transformação não encontrada');
      if (transf.statusTransformacao === 'concluida') throw new ConflictException('Transformação concluída não pode ser cancelada');
      if (transf.statusTransformacao === 'cancelada') return transf;

      // Devolve saldo consumido por subitens associados e descarta os subitens.
      const lista = await tx.select().from(subitens).where(and(eq(subitens.transformacaoId, transformacaoId), isNull(subitens.deletedAt)));
      for (const s of lista) {
        if (s.pedidoVendaItemId) await devolverSaldo(tx, s.pedidoVendaItemId);
        await tx.update(subitens).set({ deletedAt: new Date() }).where(eq(subitens.id, s.id));
      }

      // Restaura a peça original. Se havia vínculo no início, tenta re-consumir a unidade.
      const peca = (await this.pecaAtiva(tx, transf.pecaOrigemId))!;
      let statusRestaurado: string = 'pesada';
      const histAssoc = await tx
        .select()
        .from(associacoesPecaHistorico)
        .where(eq(associacoesPecaHistorico.pecaId, transf.pecaOrigemId))
        .orderBy(asc(associacoesPecaHistorico.createdAt));
      const ultimoDestino = histAssoc.filter((h) => h.acao === 'confirmar' || h.acao === 'redirecionar').at(-1);
      if (ultimoDestino?.pedidoItemDestinoId) {
        const reconsumido = await consumirSaldo(tx, ultimoDestino.pedidoItemDestinoId);
        if (reconsumido) {
          statusRestaurado = 'associada';
          await tx.update(pecas).set({ statusPeca: 'associada', pedidoVendaId: ultimoDestino.pedidoDestinoId, pedidoVendaItemId: ultimoDestino.pedidoItemDestinoId }).where(eq(pecas.id, peca.id));
        }
      }
      if (statusRestaurado === 'pesada') {
        await tx.update(pecas).set({ statusPeca: 'pesada' }).where(eq(pecas.id, peca.id));
      }

      const atualizada = primeiroOuFalha(
        await tx.update(transformacoes).set({ statusTransformacao: 'cancelada', dataHoraEncerramento: new Date() }).where(eq(transformacoes.id, transformacaoId)).returning(),
      );
      await this.auditoria.registrar(tx, { tabela: 'transformacoes', registroId: transformacaoId, operacao: 'UPDATE', modulo: 'operacao', usuarioId: operadorId, dadosAnteriores: transf, dadosNovos: atualizada });
      return atualizada;
    });
  }

  /** Detalhe da transformação + subitens (consulta). */
  async detalhar(transformacaoId: string) {
    const transf = await this.transformacaoAtiva(this.db, transformacaoId);
    if (!transf) throw new NotFoundException('Transformação não encontrada');
    const lista = await this.db.select().from(subitens).where(and(eq(subitens.transformacaoId, transformacaoId), isNull(subitens.deletedAt))).orderBy(asc(subitens.createdAt));
    return { transformacao: transf, subitens: lista };
  }

  /**
   * Rastreabilidade ponta a ponta (RF-CT-19/20): origem → corte → subitens →
   * pesagens (captura_meta) → etiquetas → destino. Consultável por peça ou subitem.
   */
  async rastrear(params: { pecaId?: string; subitemId?: string }) {
    let pecaId = params.pecaId ?? null;
    if (!pecaId && params.subitemId) {
      const s = await this.db.select().from(subitens).where(eq(subitens.id, params.subitemId)).then((r) => r[0] ?? null);
      if (!s) throw new NotFoundException('Subitem não encontrado');
      pecaId = s.pecaOrigemId;
    }
    if (!pecaId) throw new NotFoundException('Informe pecaId ou subitemId');

    const peca = await this.db.select().from(pecas).where(eq(pecas.id, pecaId)).then((r) => r[0] ?? null);
    if (!peca) throw new NotFoundException('Peça não encontrada');

    const transfs = await this.db.select().from(transformacoes).where(eq(transformacoes.pecaOrigemId, pecaId)).orderBy(asc(transformacoes.dataHoraAbertura));
    const subs = await this.db.select().from(subitens).where(eq(subitens.pecaOrigemId, pecaId)).orderBy(asc(subitens.createdAt));
    const etiquetasPeca = await this.db.select().from(etiquetasImpressoes).where(eq(etiquetasImpressoes.pecaId, pecaId));
    const subIds = subs.map((s) => s.id);
    const etiquetasSub = subIds.length
      ? await this.db.select().from(etiquetasImpressoes).where(schema.inArray ? eq(etiquetasImpressoes.subitemId, subIds[0]) : eq(etiquetasImpressoes.subitemId, subIds[0]))
      : [];
    const historico = await this.db.select().from(associacoesPecaHistorico).where(eq(associacoesPecaHistorico.pecaId, pecaId)).orderBy(asc(associacoesPecaHistorico.createdAt));

    return { peca, transformacoes: transfs, subitens: subs, etiquetasPeca, etiquetasSubitens: etiquetasSub, historico };
  }

  // ── internos ───────────────────────────────────────────────────────────────

  private async transformacaoAtiva(tx: Tx, id: string): Promise<Transformacao | null> {
    return tx.select().from(transformacoes).where(and(eq(transformacoes.id, id), isNull(transformacoes.deletedAt))).then((r) => r[0] ?? null);
  }

  private async pecaAtiva(tx: Tx, id: string): Promise<Peca | null> {
    return tx.select().from(pecas).where(and(eq(pecas.id, id), isNull(pecas.deletedAt))).then((r) => r[0] ?? null);
  }

  private async dataOperacao(tx: Tx, recebimentoId: string): Promise<string> {
    const r = await tx.select({ dataOperacao: recebimentos.dataOperacao }).from(recebimentos).where(eq(recebimentos.id, recebimentoId)).then((rows) => rows[0] ?? null);
    return r?.dataOperacao ?? '';
  }
}
```

> **Atenção do implementador:** o método `rastrear` acima contém um placeholder ruim na busca de `etiquetasSub` (uso incorreto de `inArray`). Substituir por `inArray` real de `drizzle-orm`: importar `inArray` e usar `subIds.length ? await this.db.select().from(etiquetasImpressoes).where(inArray(etiquetasImpressoes.subitemId, subIds)) : []`. Corrigir antes de compilar.

- [ ] **Step 2: Type-check**

Run: `cd app/backend && npm run type-check`
Expected: PASS após corrigir o `inArray` (adicionar ao import de `drizzle-orm`). `compararQtd` pode não ser usado — remover do import se o lint apontar.

- [ ] **Step 3: Commit**

```bash
git add app/backend/src/modules/operacao/corte/corte.service.ts
git commit -m "feat(f4c): CorteService (iniciar/concluir/cancelar/rastrear)"
```

---

## Task 10: Controller + Module + registro

**Files:**
- Create: `app/backend/src/modules/operacao/corte/corte.controller.ts`
- Create: `app/backend/src/modules/operacao/corte/corte.module.ts`
- Modify: `app/backend/src/modules/operacao/operacao.module.ts`

- [ ] **Step 1: Criar `corte.controller.ts`**

```ts
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { CorteService } from './corte.service';
import { SubitemService } from './subitem.service';
import { EtiquetaService } from '../pesagem/etiqueta.service';
import { iniciarCorteSchema, concluirCorteSchema, type IniciarCorteDto, type ConcluirCorteDto } from './dto/corte.dto';
import { resolverQrSchema, type ResolverQrDto } from '../pesagem/dto/etiqueta.dto';
import {
  adicionarSubitemSchema, pesarSubitemSchema, associarSubitemSchema, redirecionarSubitemSchema, semCoberturaSubitemSchema,
  type AdicionarSubitemDto, type PesarSubitemDto, type AssociarSubitemDto, type RedirecionarSubitemDto, type SemCoberturaSubitemDto,
} from './dto/subitem.dto';

@SkipThrottle()
@Controller('operacao/corte')
@UseGuards(JwtAuthGuard, RbacGuard)
export class CorteController {
  constructor(
    private readonly corte: CorteService,
    private readonly subitem: SubitemService,
    private readonly etiqueta: EtiquetaService,
  ) {}

  // ── Transformação ───────────────────────────────────────────────────────────
  @Post('pecas/:pecaId/iniciar')
  @RequirePermissoes('CORTE_GERENCIAR')
  iniciar(@Param('pecaId') pecaId: string, @Body(new ZodValidationPipe(iniciarCorteSchema)) dto: IniciarCorteDto, @CurrentUser() user: CurrentUserPayload) {
    return this.corte.iniciar(pecaId, dto, user.sub);
  }

  @Get(':id')
  @RequirePermissoes('PESAGEM_LER')
  detalhar(@Param('id') id: string) {
    return this.corte.detalhar(id);
  }

  @Post(':id/concluir')
  @RequirePermissoes('CORTE_GERENCIAR')
  concluir(@Param('id') id: string, @Body(new ZodValidationPipe(concluirCorteSchema)) dto: ConcluirCorteDto, @CurrentUser() user: CurrentUserPayload) {
    return this.corte.concluir(id, dto, user.sub);
  }

  @Post(':id/cancelar')
  @RequirePermissoes('CORTE_GERENCIAR')
  cancelar(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.corte.cancelar(id, user.sub);
  }

  // ── Subitens ──────────────────────────────────────────────────────────────
  @Post(':id/subitens')
  @RequirePermissoes('CORTE_GERENCIAR')
  adicionar(@Param('id') id: string, @Body(new ZodValidationPipe(adicionarSubitemSchema)) dto: AdicionarSubitemDto, @CurrentUser() user: CurrentUserPayload) {
    return this.subitem.adicionar(id, dto, user.sub);
  }

  @Post('subitens/:subitemId/remover')
  @RequirePermissoes('CORTE_GERENCIAR')
  remover(@Param('subitemId') subitemId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.subitem.remover(subitemId, user.sub);
  }

  @Post('subitens/:subitemId/pesar')
  @RequirePermissoes('CORTE_GERENCIAR')
  pesar(@Param('subitemId') subitemId: string, @Body(new ZodValidationPipe(pesarSubitemSchema)) dto: PesarSubitemDto, @CurrentUser() user: CurrentUserPayload) {
    return this.subitem.pesar(subitemId, dto, user);
  }

  @Get('subitens/:subitemId/sugestao')
  @RequirePermissoes('PESAGEM_LER')
  sugerir(@Param('subitemId') subitemId: string) {
    return this.subitem.sugerir(subitemId);
  }

  @Post('subitens/:subitemId/associar')
  @RequirePermissoes('CORTE_GERENCIAR')
  associar(@Param('subitemId') subitemId: string, @Body(new ZodValidationPipe(associarSubitemSchema)) dto: AssociarSubitemDto, @CurrentUser() user: CurrentUserPayload) {
    return this.subitem.associar(subitemId, dto, user.sub);
  }

  @Post('subitens/:subitemId/redirecionar')
  @RequirePermissoes('CORTE_GERENCIAR')
  redirecionar(@Param('subitemId') subitemId: string, @Body(new ZodValidationPipe(redirecionarSubitemSchema)) dto: RedirecionarSubitemDto, @CurrentUser() user: CurrentUserPayload) {
    return this.subitem.redirecionar(subitemId, dto, user.sub);
  }

  @Post('subitens/:subitemId/sem-cobertura')
  @RequirePermissoes('CORTE_GERENCIAR')
  semCobertura(@Param('subitemId') subitemId: string, @Body(new ZodValidationPipe(semCoberturaSubitemSchema)) dto: SemCoberturaSubitemDto, @CurrentUser() user: CurrentUserPayload) {
    return this.subitem.semCobertura(subitemId, dto, user.sub);
  }

  // ── Reetiqueta do subitem (RF-RT-04) ──────────────────────────────────────
  @Post('subitens/:subitemId/etiqueta')
  @RequirePermissoes('ETIQUETA_GERENCIAR')
  etiquetar(@Param('subitemId') subitemId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.subitem.reetiquetar(subitemId, user.sub);
  }

  @Post('subitens/:subitemId/etiqueta/reimprimir')
  @RequirePermissoes('ETIQUETA_GERENCIAR')
  reimprimir(@Param('subitemId') subitemId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.subitem.reimprimir(subitemId, user.sub);
  }

  // ── Leitura QR do subitem (manual exige LEITURA_MANUAL) ───────────────────
  @Post('subitens/qr/resolver')
  @RequirePermissoes('LEITURA_MANUAL')
  resolverQr(@Body(new ZodValidationPipe(resolverQrSchema)) dto: ResolverQrDto) {
    return this.etiqueta.resolverQrSubitem(dto);
  }

  // ── Rastreabilidade ───────────────────────────────────────────────────────
  @Get('rastreabilidade/consulta')
  @RequirePermissoes('PESAGEM_LER')
  rastrear(@Query('pecaId') pecaId?: string, @Query('subitemId') subitemId?: string) {
    return this.corte.rastrear({ pecaId, subitemId });
  }
}
```

- [ ] **Step 2: Criar `corte.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PesagemModule } from '../pesagem/pesagem.module';
import { RecebimentoModule } from '../recebimento/recebimento.module';
import { CorteController } from './corte.controller';
import { CorteService } from './corte.service';
import { SubitemService } from './subitem.service';

// F4c — Corte/Transformação. Reusa EtiquetaService + DivergenciaRecebimentoService
// (exportados por PesagemModule/RecebimentoModule). Gateways de hardware vêm do
// HardwareModule (global).
@Module({
  imports: [AuthModule, PesagemModule, RecebimentoModule],
  controllers: [CorteController],
  providers: [CorteService, SubitemService],
  exports: [CorteService, SubitemService],
})
export class CorteModule {}
```

> `PesagemModule` exporta `EtiquetaService`; `RecebimentoModule` exporta `DivergenciaRecebimentoService`. Ambos são injetados em `SubitemService`/`CorteController`.

- [ ] **Step 3: Registrar no `operacao.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { RecebimentoModule } from './recebimento/recebimento.module';
import { PesagemModule } from './pesagem/pesagem.module';
import { CorteModule } from './corte/corte.module';

// Agregador do domínio operacional (F4a — Recebimento; F4b — Pesagem; F4c — Corte).
@Module({
  imports: [RecebimentoModule, PesagemModule, CorteModule],
})
export class OperacaoModule {}
```

- [ ] **Step 4: Type-check + build**

Run: `cd app/backend && npm run type-check && npm run build`
Expected: PASS (app inteiro compila; DI resolve `EtiquetaService` e `DivergenciaRecebimentoService` via módulos importados).

- [ ] **Step 5: Commit**

```bash
git add app/backend/src/modules/operacao/corte/corte.controller.ts app/backend/src/modules/operacao/corte/corte.module.ts app/backend/src/modules/operacao/operacao.module.ts
git commit -m "feat(f4c): controller, module e registro do corte no OperacaoModule"
```

---

## Task 11: cleanupDb — incluir transformacoes e subitens

**Files:**
- Modify: `app/backend/test/helpers/test-app.ts`

- [ ] **Step 1: Adicionar as tabelas ao TRUNCATE (ordem: filhas antes das pais)**

No `cleanupDb`, a ordem precisa ter `etiquetas_impressoes` (FK para subitens) e `subitens` antes de `transformacoes`, e todas antes de `pecas`. Trocar a linha das etiquetas/peças por:

```ts
      etiquetas_impressoes, subitens, transformacoes, associacoes_peca_historico, pecas,
```

(As demais linhas permanecem.)

- [ ] **Step 2: Sanity — rodar um teste F4b que usa cleanupDb**

Run (Postgres efêmero ativo): `cd app/backend && npx jest test/integration/etiqueta.e2e-spec.ts`
Expected: PASS (TRUNCATE válido com as novas tabelas; ordem de FK correta).

- [ ] **Step 3: Commit**

```bash
git add app/backend/test/helpers/test-app.ts
git commit -m "test(f4c): cleanupDb inclui transformacoes e subitens"
```

---

## Task 12: Fixtures do corte

**Files:**
- Create: `app/backend/test/helpers/corte-fixtures.ts`

- [ ] **Step 1: Criar helpers reusando o cenário de F4b**

```ts
import type { INestApplication } from '@nestjs/common';

/** Inicia um corte sobre uma peça e retorna o id da transformação. */
export async function iniciarCorte(
  app: INestApplication,
  cookies: string,
  pecaId: string,
  body: Partial<{ tipoTransformacao: string; motivo: string; motivoDetalhe: string }> = {},
): Promise<string> {
  const { default: request } = await import('supertest');
  const res = await request(app.getHttpServer())
    .post(`/operacao/corte/pecas/${pecaId}/iniciar`)
    .set('Cookie', cookies)
    .send({ tipoTransformacao: body.tipoTransformacao ?? 'subdivisao', motivo: body.motivo ?? 'necessidade_operacional', motivoDetalhe: body.motivoDetalhe });
  return res.body.id as string;
}

/** Gera um subitem na transformação; retorna o id. */
export async function adicionarSubitem(
  app: INestApplication,
  cookies: string,
  transformacaoId: string,
  itemComercialId: string,
): Promise<string> {
  const { default: request } = await import('supertest');
  const res = await request(app.getHttpServer())
    .post(`/operacao/corte/${transformacaoId}/subitens`)
    .set('Cookie', cookies)
    .send({ itemComercialId });
  return res.body.id as string;
}

/** Pesa um subitem (automático por padrão). */
export async function pesarSubitem(
  app: INestApplication,
  cookies: string,
  subitemId: string,
  body: Record<string, unknown> = { modoCaptura: 'automatico' },
) {
  const { default: request } = await import('supertest');
  return request(app.getHttpServer()).post(`/operacao/corte/subitens/${subitemId}/pesar`).set('Cookie', cookies).send(body);
}

/** Leva um subitem até 'associado' + etiqueta emitida (destino completo p/ concluir). */
export async function subitemCompleto(
  app: INestApplication,
  cookies: string,
  transformacaoId: string,
  itemComercialId: string,
  pedidoVendaItemId: string,
): Promise<string> {
  const { default: request } = await import('supertest');
  const subitemId = await adicionarSubitem(app, cookies, transformacaoId, itemComercialId);
  await pesarSubitem(app, cookies, subitemId);
  await request(app.getHttpServer()).post(`/operacao/corte/subitens/${subitemId}/associar`).set('Cookie', cookies).send({ pedidoVendaItemId });
  await request(app.getHttpServer()).post(`/operacao/corte/subitens/${subitemId}/etiqueta`).set('Cookie', cookies).send();
  return subitemId;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/backend/test/helpers/corte-fixtures.ts
git commit -m "test(f4c): fixtures do corte"
```

---

## Task 13: corte.e2e (ciclo, elegibilidade, contabilidade, conservação, destino, idempotência, RBAC)

**Files:**
- Create: `app/backend/test/integration/corte.e2e-spec.ts`

Usar o mesmo arcabouço de `associacao.e2e-spec.ts` (createTestApp, createTestUser, loginCookies, seedComercialBase, montarCenarioPesagem, criarPedido, pesarPeca, fakes). Criar um usuário extra com perfil `corte` (tem CORTE_GERENCIAR) e usar `comercialCookies` como ator SEM CORTE_GERENCIAR para o teste de 403. `corte` também tem PESAGEM_GERENCIAR? Não — então pesar a peça original continua via `recebimentoCookies`. Operações de corte usam `corteCookies`.

- [ ] **Step 1: Escrever o spec**

```ts
import type { INestApplication } from '@nestjs/common';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';
import { montarCenarioPesagem, criarPedido, pesarPeca, fakes, type CenarioPesagem } from '../helpers/pesagem-fixtures';
import { iniciarCorte, adicionarSubitem, pesarSubitem, subitemCompleto } from '../helpers/corte-fixtures';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

describe('Corte/Transformação e2e (F4c)', () => {
  let app: INestApplication;
  let recebimentoCookies: string;
  let comprasCookies: string;
  let comercialCookies: string;
  let corteCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const corte = await createTestUser(app, { perfil: 'corte' });
    recebimentoCookies = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    corteCookies = await loginCookies(app, corte.adminEmail, corte.adminPassword);
  }, 60000);

  afterAll(async () => { await cleanupDb(app); await app.close(); });

  const srv = () => app.getHttpServer();
  const db = () => app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;

  async function cenario(dataOperacao: string, quantidade = 10): Promise<CenarioPesagem & { itemComercialId: string }> {
    const base = await seedComercialBase(app, { fator: 1 });
    const c = await montarCenarioPesagem(app, { compras: comprasCookies, recebimento: recebimentoCookies }, base, { dataOperacao, quantidade });
    return c;
  }

  beforeEach(() => {
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).balanca.definirPeso('12.500');
    fakes(app).impressora.definirStatus('disponivel');
  });

  it('403 sem CORTE_GERENCIAR', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-10-01');
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const res = await request(srv()).post(`/operacao/corte/pecas/${pecaId}/iniciar`).set('Cookie', comercialCookies).send({ tipoTransformacao: 'simples', motivo: 'decisao_humana', motivoDetalhe: 'x' });
    expect(res.status).toBe(403);
  });

  it('iniciar libera a unidade da origem (atendida −1) e marca em_transformacao', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-10-02');
    const p = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId, dataOperacao: c.dataOperacao, quantidade: 2 });
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/confirmar`).set('Cookie', recebimentoCookies).send({ pedidoVendaItemId: p.pedidoItemId });

    const antes = await db().select().from(schema.pedidosVendaItens).where(eq(schema.pedidosVendaItens.id, p.pedidoItemId)).then((r) => r[0]!);
    expect(antes.quantidadeAtendida).toBe('1.000');

    await iniciarCorte(app, corteCookies, pecaId);

    const depois = await db().select().from(schema.pedidosVendaItens).where(eq(schema.pedidosVendaItens.id, p.pedidoItemId)).then((r) => r[0]!);
    expect(depois.quantidadeAtendida).toBe('0.000'); // liberou
    const peca = await db().select().from(schema.pecas).where(eq(schema.pecas.id, pecaId)).then((r) => r[0]!);
    expect(peca.statusPeca).toBe('em_transformacao');
    expect(peca.pedidoVendaItemId).toBeNull();
  });

  it('peça inelegível (já transformada) → 409', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-10-03');
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    await db().update(schema.pecas).set({ statusPeca: 'transformada' }).where(eq(schema.pecas.id, pecaId));
    const res = await request(srv()).post(`/operacao/corte/pecas/${pecaId}/iniciar`).set('Cookie', corteCookies).send({ tipoTransformacao: 'simples', motivo: 'necessidade_operacional' });
    expect(res.status).toBe(409);
  });

  it('conservação de peso: Σ>original sem justificativa → 409; com justificativa → ok', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-10-04');
    const p = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId, dataOperacao: c.dataOperacao, quantidade: 5 });
    fakes(app).balanca.definirPeso('12.500');
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId }); // peso original 12.500
    const transfId = await iniciarCorte(app, corteCookies, pecaId);

    // Subitem com peso 13.000 (> original) → diferença ≠ 0.
    fakes(app).balanca.definirPeso('13.000');
    await subitemCompleto(app, corteCookies, transfId, c.itemComercialId, p.pedidoItemId);

    const semJust = await request(srv()).post(`/operacao/corte/${transfId}/concluir`).set('Cookie', corteCookies).send({});
    expect(semJust.status).toBe(409);

    const comJust = await request(srv()).post(`/operacao/corte/${transfId}/concluir`).set('Cookie', corteCookies).send({ justificativaDiferenca: 'ganho por hidratação medido' });
    expect(comJust.status).toBe(201);
    expect(comJust.body.statusTransformacao).toBe('concluida');
  });

  it('concluir com subitem sem destino (só pesado) → 409', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-10-05');
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    const subId = await adicionarSubitem(app, corteCookies, transfId, c.itemComercialId);
    await pesarSubitem(app, corteCookies, subId); // pesado, mas sem destino/etiqueta
    const res = await request(srv()).post(`/operacao/corte/${transfId}/concluir`).set('Cookie', corteCookies).send({});
    expect(res.status).toBe(409);
  });

  it('origem permanece consultável e vira transformada; etiqueta original coexiste; conclusão idempotente', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-10-06');
    const p = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId, dataOperacao: c.dataOperacao, quantidade: 5 });
    fakes(app).balanca.definirPeso('12.500');
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/confirmar`).set('Cookie', recebimentoCookies).send({ pedidoVendaItemId: p.pedidoItemId });
    await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/etiqueta`).set('Cookie', recebimentoCookies).send(); // etiqueta original
    const pecaAntes = await db().select().from(schema.pecas).where(eq(schema.pecas.id, pecaId)).then((r) => r[0]!);
    const etiquetaOriginal = pecaAntes.etiquetaAtual;

    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    // Σ pesos == original (sem diferença) — dois subitens de 6.250.
    fakes(app).balanca.definirPeso('6.250');
    await subitemCompleto(app, corteCookies, transfId, c.itemComercialId, p.pedidoItemId);
    await subitemCompleto(app, corteCookies, transfId, c.itemComercialId, p.pedidoItemId);

    const ok = await request(srv()).post(`/operacao/corte/${transfId}/concluir`).set('Cookie', corteCookies).send({});
    expect(ok.status).toBe(201);

    // Peça original ainda consultável, agora 'transformada', etiqueta preservada.
    const pecaDepois = await request(srv()).get(`/operacao/pesagem/pecas/${pecaId}`).set('Cookie', recebimentoCookies);
    expect(pecaDepois.status).toBe(200);
    expect(pecaDepois.body.statusPeca).toBe('transformada');
    expect(pecaDepois.body.etiquetaAtual).toBe(etiquetaOriginal); // coexiste (RT-007-04)

    // Idempotência: concluir de novo não muda nada e não falha.
    const denovo = await request(srv()).post(`/operacao/corte/${transfId}/concluir`).set('Cookie', corteCookies).send({});
    expect(denovo.status).toBe(201);
    expect(denovo.body.statusTransformacao).toBe('concluida');
  });
});
```

- [ ] **Step 2: Rodar e iterar até passar**

Run (Postgres efêmero ativo): `cd app/backend && npx jest test/integration/corte.e2e-spec.ts`
Expected: PASS. Se falhar, corrigir o service conforme a evidência (NÃO afrouxar o teste).

- [ ] **Step 3: Commit**

```bash
git add app/backend/test/integration/corte.e2e-spec.ts
git commit -m "test(f4c): corte.e2e — elegibilidade, contabilidade, conservação, destino, idempotência, RBAC"
```

---

## Task 14: subitens.e2e (captura ADR-009, associação reclassificada, redirecionar, sem-cobertura)

**Files:**
- Create: `app/backend/test/integration/subitens.e2e-spec.ts`

- [ ] **Step 1: Escrever o spec** (mesmo arcabouço; criar segundo item comercial para reclassificação)

```ts
import type { INestApplication } from '@nestjs/common';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';
import { montarCenarioPesagem, criarPedido, pesarPeca, fakes, type CenarioPesagem } from '../helpers/pesagem-fixtures';
import { iniciarCorte, adicionarSubitem, pesarSubitem } from '../helpers/corte-fixtures';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

describe('Subitens e2e (F4c — pesar/associar/redirecionar/sem-cobertura)', () => {
  let app: INestApplication;
  let recebimentoCookies: string;
  let comprasCookies: string;
  let comercialCookies: string;
  let corteCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const corte = await createTestUser(app, { perfil: 'corte' });
    recebimentoCookies = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    corteCookies = await loginCookies(app, corte.adminEmail, corte.adminPassword);
  }, 60000);

  afterAll(async () => { await cleanupDb(app); await app.close(); });

  const srv = () => app.getHttpServer();
  const db = () => app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;

  async function cenario(dataOperacao: string): Promise<CenarioPesagem> {
    const base = await seedComercialBase(app, { fator: 1 });
    return montarCenarioPesagem(app, { compras: comprasCookies, recebimento: recebimentoCookies }, base, { dataOperacao, quantidade: 10 });
  }

  beforeEach(() => {
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).balanca.definirPeso('6.000');
    fakes(app).impressora.definirStatus('disponivel');
  });

  it('pesar subitem ADR-009: indisponível→409; sem PESO_MANUAL via outro perfil→403; sem motivo→400; manual ok', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-11-01');
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    const subId = await adicionarSubitem(app, corteCookies, transfId, c.itemComercialId);

    // indisponível → automático 409
    fakes(app).balanca.definirStatus('indisponivel');
    const auto = await pesarSubitem(app, corteCookies, subId, { modoCaptura: 'automatico' });
    expect(auto.status).toBe(409);

    // manual sem motivo → 400
    const semMotivo = await pesarSubitem(app, corteCookies, subId, { modoCaptura: 'manual_assistido', pesoManual: 6.0 });
    expect(semMotivo.status).toBe(400);

    // manual com motivo → 201 (perfil corte tem PESO_MANUAL)
    const ok = await pesarSubitem(app, corteCookies, subId, { modoCaptura: 'manual_assistido', pesoManual: 6.0, motivo: 'dispositivo_indisponivel' });
    expect(ok.status).toBe(201);
    expect(ok.body.statusSubitem).toBe('pesado');
    expect(ok.body.capturaMeta.leitura_estavel).toBe(false);
  });

  it('associar subitem reclassificado consome a unidade do item correto (não o item base da peça)', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-11-02');
    // Segundo item comercial + regra de desdobramento adicional na mesma compra, e um pedido nele.
    const [item2] = await db().insert(schema.itensComerciais).values({ codigo: `ICOM2-${Date.now()}`, descricao: 'Traseiro', unidadeComercial: 'parte' }).returning();
    // Pedido no item2 (reclassificação alvo).
    const pedido2 = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: c.clienteId, itemComercialId: item2!.id, dataOperacao: c.dataOperacao, quantidade: 2 });
    // Pedido no item base (não deve ser consumido).
    const pedidoBase = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId, dataOperacao: c.dataOperacao, quantidade: 2 });

    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    const subId = await adicionarSubitem(app, corteCookies, transfId, item2!.id); // reclassifica para item2
    await pesarSubitem(app, corteCookies, subId);

    // associar ao pedido do item base → incompatível (409)
    const incompat = await request(srv()).post(`/operacao/corte/subitens/${subId}/associar`).set('Cookie', corteCookies).send({ pedidoVendaItemId: pedidoBase.pedidoItemId });
    expect(incompat.status).toBe(409);

    // associar ao pedido do item2 → ok, consome item2
    const ok = await request(srv()).post(`/operacao/corte/subitens/${subId}/associar`).set('Cookie', corteCookies).send({ pedidoVendaItemId: pedido2.pedidoItemId });
    expect(ok.status).toBe(201);
    const item2Linha = await db().select().from(schema.pedidosVendaItens).where(eq(schema.pedidosVendaItens.id, pedido2.pedidoItemId)).then((r) => r[0]!);
    expect(item2Linha.quantidadeAtendida).toBe('1.000');
  });

  it('redirecionar subitem entre itens compatíveis (devolve+consome)', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-11-03');
    const pa = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId, dataOperacao: c.dataOperacao, quantidade: 2 });
    const pb = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId, dataOperacao: c.dataOperacao, quantidade: 2 });
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    const subId = await adicionarSubitem(app, corteCookies, transfId, c.itemComercialId);
    await pesarSubitem(app, corteCookies, subId);
    await request(srv()).post(`/operacao/corte/subitens/${subId}/associar`).set('Cookie', corteCookies).send({ pedidoVendaItemId: pa.pedidoItemId });
    const redir = await request(srv()).post(`/operacao/corte/subitens/${subId}/redirecionar`).set('Cookie', corteCookies).send({ pedidoVendaItemId: pb.pedidoItemId, motivo: 'cliente A reduziu' });
    expect(redir.status).toBe(201);
    const itemA = await db().select().from(schema.pedidosVendaItens).where(eq(schema.pedidosVendaItens.id, pa.pedidoItemId)).then((r) => r[0]!);
    const itemB = await db().select().from(schema.pedidosVendaItens).where(eq(schema.pedidosVendaItens.id, pb.pedidoItemId)).then((r) => r[0]!);
    expect(itemA.quantidadeAtendida).toBe('0.000');
    expect(itemB.quantidadeAtendida).toBe('1.000');
  });

  it('sem cobertura: sobra exige motivo (400) e marca em_sobra; divergência abre ocorrência (F4a)', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-11-04');
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    const subId = await adicionarSubitem(app, corteCookies, transfId, c.itemComercialId);
    await pesarSubitem(app, corteCookies, subId);

    const semMotivo = await request(srv()).post(`/operacao/corte/subitens/${subId}/sem-cobertura`).set('Cookie', corteCookies).send({ destino: 'sobra' });
    expect(semMotivo.status).toBe(400);
    const comMotivo = await request(srv()).post(`/operacao/corte/subitens/${subId}/sem-cobertura`).set('Cookie', corteCookies).send({ destino: 'sobra', motivo: 'sem pedido' });
    expect(comMotivo.status).toBe(201);
    expect(comMotivo.body.statusSubitem).toBe('em_sobra');

    const sub2 = await adicionarSubitem(app, corteCookies, transfId, c.itemComercialId);
    await pesarSubitem(app, corteCookies, sub2);
    const div = await request(srv()).post(`/operacao/corte/subitens/${sub2}/sem-cobertura`).set('Cookie', corteCookies).send({ destino: 'divergencia', divergencia: { tipo: 'qualidade_divergente', descricao: 'osso exposto', acaoImediata: 'separar' } });
    expect(div.status).toBe(201);
    const divs = await db().select().from(schema.divergenciasRecebimento).where(eq(schema.divergenciasRecebimento.recebimentoId, c.recebimentoId));
    expect(divs.some((d) => d.tipo === 'qualidade_divergente')).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e iterar**

Run: `cd app/backend && npx jest test/integration/subitens.e2e-spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/backend/test/integration/subitens.e2e-spec.ts
git commit -m "test(f4c): subitens.e2e — ADR-009, reclassificação, redirecionar, sem-cobertura"
```

---

## Task 15: corte-concorrencia.e2e (N subitens no mesmo item, saldo limitado)

**Files:**
- Create: `app/backend/test/integration/corte-concorrencia.e2e-spec.ts`

- [ ] **Step 1: Escrever o spec** (espelha o teste REFINO 2 da F4b, mas com subitens)

```ts
import type { INestApplication } from '@nestjs/common';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';
import { montarCenarioPesagem, criarPedido, pesarPeca, fakes } from '../helpers/pesagem-fixtures';
import { iniciarCorte, adicionarSubitem, pesarSubitem } from '../helpers/corte-fixtures';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

describe('Corte — concorrência de associação de subitens (F4c)', () => {
  let app: INestApplication;
  let recebimentoCookies: string;
  let comprasCookies: string;
  let comercialCookies: string;
  let corteCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const corte = await createTestUser(app, { perfil: 'corte' });
    recebimentoCookies = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    corteCookies = await loginCookies(app, corte.adminEmail, corte.adminPassword);
  }, 60000);

  afterAll(async () => { await cleanupDb(app); await app.close(); });

  const srv = () => app.getHttpServer();
  const db = () => app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;

  it('N subitens no mesmo item com saldo limitado: atendida nunca excede pedida', async () => {
    const { default: request } = await import('supertest');
    const base = await seedComercialBase(app, { fator: 1 });
    const c = await montarCenarioPesagem(app, { compras: comprasCookies, recebimento: recebimentoCookies }, base, { dataOperacao: '2026-11-10', quantidade: 10 });
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).balanca.definirPeso('1.000');

    const saldo = 3;
    const total = 6;
    const { pedidoItemId } = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId, dataOperacao: c.dataOperacao, quantidade: saldo });

    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);

    const subIds: string[] = [];
    for (let i = 0; i < total; i++) {
      const s = await adicionarSubitem(app, corteCookies, transfId, c.itemComercialId);
      await pesarSubitem(app, corteCookies, s);
      subIds.push(s);
    }

    const resultados = await Promise.all(
      subIds.map((id) => request(srv()).post(`/operacao/corte/subitens/${id}/associar`).set('Cookie', corteCookies).send({ pedidoVendaItemId: pedidoItemId })),
    );

    const sucessos = resultados.filter((r) => r.status === 201).length;
    const conflitos = resultados.filter((r) => r.status === 409).length;
    expect(sucessos).toBe(saldo);
    expect(conflitos).toBe(total - saldo);

    const item = await db().select().from(schema.pedidosVendaItens).where(eq(schema.pedidosVendaItens.id, pedidoItemId)).then((r) => r[0]!);
    expect(item.quantidadeAtendida).toBe('3.000'); // nunca excede a pedida
  }, 60000);
});
```

- [ ] **Step 2: Rodar**

Run: `cd app/backend && npx jest test/integration/corte-concorrencia.e2e-spec.ts`
Expected: PASS (sucessos == saldo, atendida == 3.000).

- [ ] **Step 3: Commit**

```bash
git add app/backend/test/integration/corte-concorrencia.e2e-spec.ts
git commit -m "test(f4c): concorrência de associação de subitens (anti-overbooking)"
```

---

## Task 16: reetiqueta + rastreabilidade + eventos unit + seed

**Files:**
- Create: `app/backend/test/integration/reetiqueta-subitem.e2e-spec.ts`
- Create: `app/backend/test/integration/rastreabilidade-corte.e2e-spec.ts`
- Create: `app/backend/test/unit/corte-eventos.spec.ts`
- Modify: `app/backend/test/integration/seed.spec.ts`

- [ ] **Step 1: `reetiqueta-subitem.e2e-spec.ts`** (mesmo arcabouço; usa corteCookies)

```ts
import type { INestApplication } from '@nestjs/common';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';
import { montarCenarioPesagem, criarPedido, pesarPeca, fakes, type CenarioPesagem } from '../helpers/pesagem-fixtures';
import { iniciarCorte, adicionarSubitem, pesarSubitem } from '../helpers/corte-fixtures';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

describe('Reetiqueta de subitem e2e (F4c — RF-RT-04, best-effort)', () => {
  let app: INestApplication;
  let recebimentoCookies: string; let comprasCookies: string; let comercialCookies: string; let corteCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const corte = await createTestUser(app, { perfil: 'corte' });
    recebimentoCookies = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    corteCookies = await loginCookies(app, corte.adminEmail, corte.adminPassword);
  }, 60000);

  afterAll(async () => { await cleanupDb(app); await app.close(); });
  const srv = () => app.getHttpServer();
  const db = () => app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;

  async function subitemAssociado(dataOp: string): Promise<{ subId: string; pecaId: string; c: CenarioPesagem }> {
    const { default: request } = await import('supertest');
    const base = await seedComercialBase(app, { fator: 1 });
    const c = await montarCenarioPesagem(app, { compras: comprasCookies, recebimento: recebimentoCookies }, base, { dataOperacao: dataOp, quantidade: 10 });
    fakes(app).balanca.definirStatus('disponivel'); fakes(app).balanca.definirPeso('6.000'); fakes(app).impressora.definirStatus('disponivel');
    const p = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId, dataOperacao: c.dataOperacao, quantidade: 5 });
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    const subId = await adicionarSubitem(app, corteCookies, transfId, c.itemComercialId);
    await pesarSubitem(app, corteCookies, subId);
    await request(srv()).post(`/operacao/corte/subitens/${subId}/associar`).set('Cookie', corteCookies).send({ pedidoVendaItemId: p.pedidoItemId });
    return { subId, pecaId, c };
  }

  it('emite etiqueta nova do subitem referenciando a peça original; QR resolve o subitem', async () => {
    const { default: request } = await import('supertest');
    const { subId, pecaId } = await subitemAssociado('2026-12-01');
    const emit = await request(srv()).post(`/operacao/corte/subitens/${subId}/etiqueta`).set('Cookie', corteCookies).send();
    expect(emit.status).toBe(201);
    expect(emit.body.etiqueta.statusImpressao).toBe('impressa');
    const codigo = emit.body.subitem.etiquetaAtual as string;
    expect(codigo).toContain('QR-SUB-');
    expect(emit.body.etiqueta.payload.pecaOrigemId).toBe(pecaId); // referência à origem

    // QR resolve o subitem (manual, leitor indisponível)
    fakes(app).leitor.definirStatus('indisponivel');
    const res = await request(srv()).post('/operacao/corte/subitens/qr/resolver').set('Cookie', corteCookies).send({ modoCaptura: 'manual_assistido', codigo, motivo: 'leitor sem energia' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(subId);
  });

  it('impressora indisponível → falha_impressao sem travar; reimpressão auditada', async () => {
    const { default: request } = await import('supertest');
    const { subId } = await subitemAssociado('2026-12-02');
    fakes(app).impressora.definirStatus('indisponivel');
    const emit = await request(srv()).post(`/operacao/corte/subitens/${subId}/etiqueta`).set('Cookie', corteCookies).send();
    expect(emit.status).toBe(201);
    expect(emit.body.etiqueta.statusImpressao).toBe('falha_impressao');
    expect(emit.body.subitem.etiquetaAtual).toBeTruthy();

    fakes(app).impressora.definirStatus('disponivel');
    const re = await request(srv()).post(`/operacao/corte/subitens/${subId}/etiqueta/reimprimir`).set('Cookie', corteCookies).send();
    expect(re.status).toBe(201);
    expect(re.body.etiqueta.reimpressao).toBe(true);
    const linhas = await db().select().from(schema.etiquetasImpressoes).where(eq(schema.etiquetasImpressoes.subitemId, subId));
    expect(linhas.length).toBe(2);
  });

  it('QR de subitem inválido → 404', async () => {
    const { default: request } = await import('supertest');
    const res = await request(srv()).post('/operacao/corte/subitens/qr/resolver').set('Cookie', corteCookies).send({ modoCaptura: 'manual_assistido', codigo: 'QR-SUB-019ea000-0000-7000-8000-0000000000ff', motivo: 'x' });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: `rastreabilidade-corte.e2e-spec.ts`**

```ts
import type { INestApplication } from '@nestjs/common';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';
import { montarCenarioPesagem, criarPedido, pesarPeca, fakes } from '../helpers/pesagem-fixtures';
import { iniciarCorte, subitemCompleto } from '../helpers/corte-fixtures';

describe('Rastreabilidade do corte e2e (F4c — RF-CT-19/20)', () => {
  let app: INestApplication;
  let recebimentoCookies: string; let comprasCookies: string; let comercialCookies: string; let corteCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const corte = await createTestUser(app, { perfil: 'corte' });
    recebimentoCookies = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    corteCookies = await loginCookies(app, corte.adminEmail, corte.adminPassword);
  }, 60000);

  afterAll(async () => { await cleanupDb(app); await app.close(); });
  const srv = () => app.getHttpServer();

  it('consulta da cadeia origem → corte → subitens → etiquetas → destino', async () => {
    const { default: request } = await import('supertest');
    const base = await seedComercialBase(app, { fator: 1 });
    const c = await montarCenarioPesagem(app, { compras: comprasCookies, recebimento: recebimentoCookies }, base, { dataOperacao: '2026-12-10', quantidade: 10 });
    fakes(app).balanca.definirStatus('disponivel'); fakes(app).balanca.definirPeso('6.250'); fakes(app).impressora.definirStatus('disponivel');
    const p = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId, dataOperacao: c.dataOperacao, quantidade: 5 });
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    const sub1 = await subitemCompleto(app, corteCookies, transfId, c.itemComercialId, p.pedidoItemId);
    const sub2 = await subitemCompleto(app, corteCookies, transfId, c.itemComercialId, p.pedidoItemId);

    // Por peça
    const porPeca = await request(srv()).get(`/operacao/corte/rastreabilidade/consulta?pecaId=${pecaId}`).set('Cookie', corteCookies);
    expect(porPeca.status).toBe(200);
    expect(porPeca.body.peca.id).toBe(pecaId);
    expect(porPeca.body.transformacoes.length).toBe(1);
    expect(porPeca.body.subitens.length).toBe(2);
    expect(porPeca.body.etiquetasSubitens.length).toBeGreaterThanOrEqual(2);

    // Por subitem (resolve a mesma cadeia)
    const porSub = await request(srv()).get(`/operacao/corte/rastreabilidade/consulta?subitemId=${sub1}`).set('Cookie', corteCookies);
    expect(porSub.status).toBe(200);
    expect(porSub.body.peca.id).toBe(pecaId);
    expect(porSub.body.subitens.map((s: { id: string }) => s.id)).toEqual(expect.arrayContaining([sub1, sub2]));
  });
});
```

- [ ] **Step 3: `corte-eventos.spec.ts`** (unit — ordem commit→emit e no-emit em rollback; espelha `pesagem-eventos.spec.ts`)

```ts
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CorteService } from '../../src/modules/operacao/corte/corte.service';
import { EVENTOS } from '../../src/realtime/events/eventos';

describe('CorteService — emissão pós-commit', () => {
  function montar(transactionImpl: () => Promise<unknown>) {
    const ordem: string[] = [];
    const emitter = new EventEmitter2();
    const emitSpy = jest.spyOn(emitter, 'emit').mockImplementation(((event: unknown) => {
      ordem.push(`emit:${String(event)}`);
      return true;
    }) as never);
    const db = {
      transaction: jest.fn(async () => {
        const r = await transactionImpl();
        ordem.push('commit');
        return r;
      }),
    };
    const service = new CorteService({ db } as never, { registrar: jest.fn() } as never, emitter);
    return { service, emitSpy, ordem };
  }

  it('corte_iniciado é emitido APÓS o commit', async () => {
    const { service, emitSpy, ordem } = montar(async () => ({ transf: { id: 't1', pecaOrigemId: 'pc1' }, dataOperacao: '2026-10-02' }));
    await service.iniciar('pc1', { tipoTransformacao: 'simples', motivo: 'necessidade_operacional' } as never, 'user-1');
    expect(emitSpy).toHaveBeenCalledWith(EVENTOS.CORTE_INICIADO, expect.objectContaining({ transformacaoId: 't1', pecaOrigemId: 'pc1' }));
    expect(ordem.indexOf('commit')).toBeLessThan(ordem.indexOf(`emit:${EVENTOS.CORTE_INICIADO}`));
  });

  it('NÃO emite corte_iniciado quando a transação rejeita (rollback)', async () => {
    const { service, emitSpy } = montar(async () => { throw new Error('peça inelegível'); });
    await expect(service.iniciar('pc1', { tipoTransformacao: 'simples', motivo: 'necessidade_operacional' } as never, 'user-1')).rejects.toThrow('peça inelegível');
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('corte_concluido é emitido APÓS o commit (quando não idempotente)', async () => {
    const { service, emitSpy, ordem } = montar(async () => ({ transf: { id: 't1', pecaOrigemId: 'pc1', pesoOriginal: '12.500', pesoSubitensTotal: '12.500', diferencaPeso: '0.000' }, dataOperacao: '2026-10-06', jaConcluido: false }));
    await service.concluir('t1', {} as never, 'user-1');
    expect(emitSpy).toHaveBeenCalledWith(EVENTOS.CORTE_CONCLUIDO, expect.objectContaining({ transformacaoId: 't1' }));
    expect(ordem.indexOf('commit')).toBeLessThan(ordem.indexOf(`emit:${EVENTOS.CORTE_CONCLUIDO}`));
  });
});
```

> Nota: `iniciar`/`concluir` chamam `this.dataOperacao`/`this.pecaAtiva` via `tx`. No teste unit, a `transaction` mock retorna o objeto pronto sem executar o callback real — confirme que o emit usa apenas o que vem do `resultado` (já é o caso no código da Task 9). Se o service chamar `pecaAtiva` fora da transação no caminho de `concluir`, ajuste para que esse acesso ocorra dentro do callback (mockado), mantendo o teste unit independente de DB real.

- [ ] **Step 4: Atualizar `seed.spec.ts` para cobrir CORTE_GERENCIAR**

Adicionar um caso ao describe existente:

```ts
  it('perfil corte tem a permissão CORTE_GERENCIAR após seed', async () => {
    const linhas = await db
      .select({ codigo: schema.permissoes.codigo })
      .from(schema.perfis)
      .innerJoin(schema.perfisPermissoes, eq(schema.perfis.id, schema.perfisPermissoes.perfilId))
      .innerJoin(schema.permissoes, eq(schema.perfisPermissoes.permissaoId, schema.permissoes.id))
      .where(eq(schema.perfis.slug, 'corte'));
    expect(linhas.map((l) => l.codigo)).toContain('CORTE_GERENCIAR');
  });
```

(O teste do "catálogo de permissões" já é dinâmico — conta `Object.keys(DESCRICOES_PERMISSOES).length` — então passa automaticamente com a nova permissão. O seed roda 2× provando idempotência.)

- [ ] **Step 5: Rodar todos os novos testes**

Run: `cd app/backend && npx jest test/integration/reetiqueta-subitem.e2e-spec.ts test/integration/rastreabilidade-corte.e2e-spec.ts test/unit/corte-eventos.spec.ts test/integration/seed.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/backend/test/
git commit -m "test(f4c): reetiqueta, rastreabilidade, eventos pós-commit e seed CORTE_GERENCIAR"
```

---

## Task 17: Frontend — tipos + BFF routes do corte

**Files:**
- Modify: `app/frontend/src/lib/operacao.ts`
- Create: `app/frontend/src/app/api/operacao/corte/pecas/[pecaId]/iniciar/route.ts`
- Create: `app/frontend/src/app/api/operacao/corte/[id]/route.ts`
- Create: `app/frontend/src/app/api/operacao/corte/[id]/concluir/route.ts`
- Create: `app/frontend/src/app/api/operacao/corte/[id]/subitens/route.ts`
- Create: `app/frontend/src/app/api/operacao/corte/subitens/[subitemId]/pesar/route.ts`
- Create: `app/frontend/src/app/api/operacao/corte/subitens/[subitemId]/associar/route.ts`
- Create: `app/frontend/src/app/api/operacao/corte/subitens/[subitemId]/sugestao/route.ts`
- Create: `app/frontend/src/app/api/operacao/corte/subitens/[subitemId]/etiqueta/route.ts`

- [ ] **Step 1: Tipos F4c em `lib/operacao.ts`** (acrescentar ao final)

```ts
// ── F4c — Corte / Transformação ───────────────────────────────────────────────

export const TIPOS_TRANSFORMACAO = ['simples', 'subdivisao', 'reclassificacao', 'destinacao_mista'] as const;
export type TipoTransformacao = (typeof TIPOS_TRANSFORMACAO)[number];

export const MOTIVOS_TRANSFORMACAO = ['preferencia_cliente', 'necessidade_operacional', 'divergencia', 'decisao_humana'] as const;
export type MotivoTransformacao = (typeof MOTIVOS_TRANSFORMACAO)[number];

export type StatusTransformacao =
  | 'aberta' | 'em_execucao' | 'aguardando_pesagem' | 'aguardando_associacao'
  | 'aguardando_etiquetagem' | 'concluida' | 'cancelada';

export type StatusSubitem = 'gerado' | 'pesado' | 'associado' | 'em_sobra' | 'em_analise';

export interface Transformacao {
  id: string;
  pecaOrigemId: string;
  tipoTransformacao: TipoTransformacao;
  motivo: MotivoTransformacao;
  statusTransformacao: StatusTransformacao;
  pesoOriginal: string;
  pesoSubitensTotal: string | null;
  diferencaPeso: string | null;
  justificativaDiferenca: string | null;
}

export interface Subitem {
  id: string;
  transformacaoId: string;
  pecaOrigemId: string;
  itemComercialId: string;
  peso: string | null;
  quantidade: string;
  statusSubitem: StatusSubitem;
  etiquetaAtual: string | null;
  pedidoVendaId: string | null;
  pedidoVendaItemId: string | null;
}

export interface CorteDetalhe {
  transformacao: Transformacao;
  subitens: Subitem[];
}
```

- [ ] **Step 2: BFF routes** — seguir o padrão exato de `app/api/operacao/pesagem/pecas/[id]/confirmar/route.ts` (chamar `fetchBackend`, repassar status). Exemplos:

`corte/pecas/[pecaId]/iniciar/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { Transformacao } from '@/lib/operacao';

export async function POST(req: NextRequest, { params }: { params: Promise<{ pecaId: string }> }) {
  const { pecaId } = await params;
  const body = await req.json();
  const { data, error, status } = await fetchBackend<Transformacao>(`/operacao/corte/pecas/${pecaId}/iniciar`, { method: 'POST', body: JSON.stringify(body) });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 201 });
}
```

`corte/[id]/route.ts` (GET detalhe):
```ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { CorteDetalhe } from '@/lib/operacao';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error, status } = await fetchBackend<CorteDetalhe>(`/operacao/corte/${id}`);
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
```

`corte/[id]/concluir/route.ts` e `corte/[id]/subitens/route.ts` (POST, status 201), `corte/subitens/[subitemId]/pesar|associar|etiqueta/route.ts` (POST, status 201), `corte/subitens/[subitemId]/sugestao/route.ts` (GET, status 200) — mesmos moldes, repassando o path para `/operacao/corte/...` correspondente. Tipo de retorno: `Subitem` para pesar/associar; `{ subitem: Subitem }` para etiqueta; `{ subitemId, sugestao, compativeis }` para sugestão; `Transformacao` para concluir.

- [ ] **Step 3: Type-check do frontend**

Run: `cd app/frontend && npm run type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/frontend/src/lib/operacao.ts app/frontend/src/app/api/operacao/corte/
git commit -m "feat(f4c): tipos e BFF routes do corte (frontend)"
```

---

## Task 18: Frontend — tela de corte + menu + teste

**Files:**
- Create: `app/frontend/src/app/(admin)/operacao/corte/page.tsx`
- Create: `app/frontend/src/app/(admin)/operacao/corte/corte-client.tsx`
- Modify: `app/frontend/src/app/(admin)/layout.tsx`
- Create: `app/frontend/__tests__/corte.test.tsx`

- [ ] **Step 1: `page.tsx`** (server component, padrão da pesagem)

```tsx
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { CorteClient } from './corte-client';

export default async function CortePage() {
  const user = await getMe();
  if (!user) redirect('/login');
  return <CorteClient permissoes={user.permissoes} />;
}
```

- [ ] **Step 2: `corte-client.tsx`** (client component no padrão de `pesagem-client.tsx`)

Requisitos da tela (RA-01 — sem regra de negócio no front; tudo decidido no backend):
- Inputs: id da peça, tipo de transformação (select de `TIPOS_TRANSFORMACAO`), motivo (select de `MOTIVOS_TRANSFORMACAO`), data operação (para a sala WS).
- Botão "Iniciar corte" gated por `pode('CORTE_GERENCIAR')` → POST `/api/operacao/corte/pecas/{pecaId}/iniciar`; guarda `transformacao`.
- Após iniciar, carrega o detalhe (`GET /api/operacao/corte/{id}`) e renderiza:
  - Cabeçalho: peso original × Σ subitens (somar `peso` dos subitens no client apenas para EXIBIÇÃO) × diferença; quando há diferença, campo `justificativaDiferenca`.
  - Lista de subitens com status; ações por subitem (gated): pesar (auto/manual gated por `PESO_MANUAL`), sugerir+associar (gated por `CORTE_GERENCIAR`), reetiqueta (gated por `ETIQUETA_GERENCIAR`).
  - Botão "Concluir corte" gated por `CORTE_GERENCIAR`; desabilitado enquanto houver subitem sem peso/destino/etiqueta (validação de UX; o backend é a autoridade e retorna 409).
- Status de dispositivos sempre visível (reusar o componente Badge como na pesagem) + indicador de tempo real.
- WS: assina `dashboard`/`operacao:{data}`; em `subitem_pesado`/`subitem_associado`/`corte_concluido`/`dispositivo_status_alterado` recarrega o detalhe (sem polling). Sem refetch fora de evento (salvo reconexão).
- Estados `erro`/`submitting` reais; erros do backend exibidos em `role="alert"`.
- `data-testid`: `status-dispositivos`, `corte-atual`, `subitem-status`, e botão "Concluir corte".

> Espelhar a estrutura de `pesagem-client.tsx` (função `chamar<T>`, `conectarRealtime`, `Badge`, gating com `pode(...)`). Não duplicar lógica de negócio — apenas orquestração de chamadas.

- [ ] **Step 3: Link no menu** — em `(admin)/layout.tsx`, após o bloco da Pesagem, adicionar:

```tsx
          {/* Operação (F4c) — gated pela permissão de corte */}
          {user.permissoes.includes('CORTE_GERENCIAR') && (
            <a
              href="/operacao/corte"
              className="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Corte / Transformação
            </a>
          )}
```

- [ ] **Step 4: Teste `corte.test.tsx`** (RTL, padrão de `pesagem.test.tsx` com MockWebSocket + mockFetch)

Casos mínimos:
```tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { CorteClient } from '../src/app/(admin)/operacao/corte/corte-client';

// (Copiar MockWebSocket + statusDispositivos + mockFetch do pesagem.test.tsx, ajustando rotas.)

describe('CorteClient', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    (global as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
    mockFetch();
  });

  it('botão Iniciar corte só aparece com CORTE_GERENCIAR', async () => {
    const { rerender } = render(<CorteClient permissoes={['PESAGEM_LER']} />);
    await waitFor(() => expect(screen.getByTestId('status-dispositivos')).toBeInTheDocument());
    expect(screen.queryByText(/Iniciar corte/i)).not.toBeInTheDocument();
    rerender(<CorteClient permissoes={['PESAGEM_LER', 'CORTE_GERENCIAR']} />);
    expect(screen.getByText(/Iniciar corte/i)).toBeInTheDocument();
  });

  it('inicia corte e exibe o painel da transformação', async () => {
    mockFetch({
      '/iniciar': { id: 't1aaaaaa', pecaOrigemId: 'pc1', tipoTransformacao: 'subdivisao', motivo: 'necessidade_operacional', statusTransformacao: 'aberta', pesoOriginal: '12.500', pesoSubitensTotal: null, diferencaPeso: null, justificativaDiferenca: null },
      '/api/operacao/corte/t1aaaaaa': { transformacao: { id: 't1aaaaaa', statusTransformacao: 'aberta', pesoOriginal: '12.500', pesoSubitensTotal: null, diferencaPeso: null, justificativaDiferenca: null, pecaOrigemId: 'pc1', tipoTransformacao: 'subdivisao', motivo: 'necessidade_operacional' }, subitens: [] },
    });
    render(<CorteClient permissoes={['CORTE_GERENCIAR', 'PESAGEM_LER']} />);
    await waitFor(() => expect(screen.getByTestId('status-dispositivos')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/Peça/i), { target: { value: 'pc1' } });
    fireEvent.click(screen.getByText(/Iniciar corte/i));
    await waitFor(() => expect(screen.getByTestId('corte-atual')).toBeInTheDocument());
  });
});
```

- [ ] **Step 5: Rodar testes + type-check + build do frontend**

Run: `cd app/frontend && npm run type-check && npm run test && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/frontend/src/app/ app/frontend/__tests__/corte.test.tsx
git commit -m "feat(f4c): tela de corte, menu gated e teste de UI"
```

---

## Task 19: Gate local completo (igual ao CI) + abertura do PR

Executar o gate inteiro com Postgres 18 efêmero ANTES do push (sem ping-pong de CI). Dropar AMBOS os schemas (`public` E `drizzle`) ao resetar.

- [ ] **Step 1: Subir Postgres 18 efêmero e resetar schemas**

```bash
docker rm -f ac-pg-f4c 2>/dev/null || true
docker run -d --name ac-pg-f4c -e POSTGRES_USER=alphacarnes -e POSTGRES_PASSWORD=alphacarnes -e POSTGRES_DB=alphacarnes_test -p 15433:5432 postgres:18
# aguardar pg_isready
docker exec ac-pg-f4c sh -c 'until pg_isready -U alphacarnes; do sleep 1; done'
# reset total (public + drizzle)
docker exec ac-pg-f4c psql -U alphacarnes -d alphacarnes_test -c 'DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;'
```

Definir `export DATABASE_URL=postgres://alphacarnes:alphacarnes@127.0.0.1:15433/alphacarnes_test` (e os demais segredos de teste do `.env`, já presentes).

- [ ] **Step 2: Migrar do zero + seed**

```bash
cd app/backend
npm run db:migrate   # aplica 0000..0005 em banco limpo
npm run db:seed
```
Expected: sem erro; 0005 aplica o delta F4c.

- [ ] **Step 3: Backend — lint + type-check + build + cobertura**

```bash
cd app/backend
npm run lint
npm run type-check
npm run build
npm run test:cov
```
Expected: tudo verde; **cobertura ≥ 80% linha E branch** (não pode cair de 80%). Conferir o resumo `text` da cobertura; se branch < 80%, adicionar testes de ramo (caminhos de erro do CorteService/SubitemService: remover subitem não-gerado→409, transformação encerrada→409, cancelar restaura associação, concluir sem subitens→409, etc.).

- [ ] **Step 4: Frontend — lint + type-check + build + test**

```bash
cd app/frontend
npm run lint
npm run type-check
npm run build
npm run test
```
Expected: verde.

- [ ] **Step 5: Segurança — audit + gitleaks**

```bash
# na raiz do repo
npm audit --audit-level=high
GLV=8.24.3
curl -sSL https://github.com/gitleaks/gitleaks/releases/download/v${GLV}/gitleaks_${GLV}_linux_x64.tar.gz | tar -xz -C /tmp gitleaks
/tmp/gitleaks dir . --no-banner --redact --verbose --exit-code 1 --config .gitleaks.toml
```
Expected: sem vulnerabilidade high/critical; gitleaks limpo. (No Windows/Git Bash, se o binário linux não rodar, usar a imagem Docker `zricethezav/gitleaks` ou rodar o gitleaks disponível no ambiente.)

- [ ] **Step 6: Limpar o container efêmero**

```bash
docker rm -f ac-pg-f4c
```

- [ ] **Step 7: Push e abrir o PR único para develop**

```bash
git push -u origin feature/f4c-corte-transformacao
gh pr create --base develop --head feature/f4c-corte-transformacao \
  --title "feat(f4c): Corte / Transformação — subitens rastreáveis, conservação de peso, reetiqueta" \
  --body "<corpo com a tabela DoD→teste preenchida, evidência de cobertura (linha/branch), gitleaks limpo, e achados/decisões>"
```

O corpo do PR deve conter:
- A tabela **DoD→teste** (da seção "Mapa DoD → teste") com cada invariante e o teste que o prova.
- Evidência de cobertura (linha e branch ≥ 80%; comparar com 80,38% anterior).
- `npm audit` e gitleaks limpos.
- Achados/decisões de design tomadas durante a implementação.
- Nota: a revisão final do DoD e a emissão do gate F4 completo (develop→main) são do Quality Owner.

---

## Self-Review (executado na escrita do plano)

**Cobertura do escopo da spec:**
- Schema/migration 0005 (transformacoes, subitens, etiquetas.subitem_id, status_peca, triggers) → Task 4. ✔
- Backend corte (iniciar/adicionar/remover/pesar/associar/redirecionar/semCobertura/reetiquetar/concluir/cancelar/rastrear) → Tasks 7–10. ✔
- Liberação de unidade no iniciar; consumo anti-overbooking por subitem → Tasks 9, 13, 15. ✔
- Conservação de peso com/sem justificativa → Task 13. ✔
- Destino obrigatório no encerramento → Task 13. ✔
- Captura ADR-009 do subitem; reuso sem duplicar → Tasks 5, 8, 14. ✔
- Reetiqueta best-effort + QR do subitem + ref. origem → Tasks 6, 16. ✔
- Invalidação lógica da etiqueta original + coexistência → Tasks 9, 13. ✔
- Rastreabilidade → Tasks 9, 16. ✔
- Eventos pós-commit + no-emit em rollback → Tasks 2, 16. ✔
- RBAC CORTE_GERENCIAR + 403 + seed → Tasks 1, 13, 16. ✔
- Concorrência → Task 15. ✔
- cleanupDb → Task 11. ✔
- Frontend (tipos, BFF, tela, menu, teste) → Tasks 17–18. ✔
- Gate local + PR → Task 19. ✔

**Pontos de atenção sinalizados ao implementador (não são placeholders — são correções a aplicar):**
1. `corte.service.ts` `rastrear`: trocar o pseudo-uso de `inArray` por `inArray(etiquetasImpressoes.subitemId, subIds)` real (import de `drizzle-orm`). Remover `compararQtd` do import se não usado.
2. Migration 0005: drizzle-kit não gera triggers nem detecta a FK de `subitem_id` (omitida no schema p/ evitar ciclo) — adicionar manualmente (Task 4 Step 5).
3. `etiquetas_impressoes.peca_id` passa a nullable; o CHECK `chk_etiq_um_alvo` garante exatamente um alvo. Conferir que nenhum código F4b assume `peca_id NOT NULL`.
4. Cobertura de **branch** é o risco principal (limite 80%, atual 80,38%): priorizar testes dos ramos de erro nos services do corte (Task 19 Step 3).
5. O teste unit de eventos (Task 16) depende de a `transaction` mock retornar o resultado sem executar acesso real a DB — garantir que `iniciar`/`concluir` montem o payload do emit a partir do retorno da transação.
