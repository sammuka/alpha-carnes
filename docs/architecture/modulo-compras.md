# Módulo: Compras — Spec Técnica

> **Módulo NestJS:** `ComprasModule`
> **Domínio de negócio:** Planejamento Comercial (Domínio 2)
> **Escopo:** compra programada do dia, regra de desdobramento, geração automática de disponibilidade virtual, reserva atômica de saldo, tratamento de divergências.
> **Versão:** 1.0 — 2026-06-05

---

## 1. Responsabilidade do módulo

O `ComprasModule` é o ponto de origem de toda a operação diária da AlphaCarnes. Sem ele corretamente implementado, nenhum outro módulo tem base confiável de trabalho.

**Responsabilidades primárias:**

1. **Registrar e ciclar a compra programada do dia** — o "lote do dia" que ancora toda a operação.
2. **Aplicar as regras de desdobramento** e transformar quantidades compradas em disponibilidade virtual por item comercial (dianteiro, central, traseiro etc.).
3. **Gerar a disponibilidade virtual automaticamente** ao confirmar a compra — mesma transação.
4. **Controlar o saldo virtual com reserva atômica** — garantir que jamais exista overbooking.
5. **Processar divergências de recebimento** que alterem o saldo virtual já gerado e notificar os módulos afetados.
6. **Publicar eventos de domínio** para que `PedidosModule`, `PesagemModule` e outros módulos reajam em tempo real.

**Fora do escopo deste módulo:**
- Pedidos de venda (responsabilidade do `PedidosModule` — consome a disponibilidade gerada aqui).
- Recebimento físico e pesagem (responsabilidade do `PesagemModule` — registra divergências que este módulo processa).
- Faturamento e expedição.

---

## 2. Entidades e tabelas

O módulo possui propriedade direta sobre as seguintes tabelas. Nenhum outro módulo escreve nelas diretamente.

| Tabela | Entidade NestJS | Responsável |
|---|---|---|
| `compras_programadas` | `CompraProgramada` | ComprasModule (escrita) |
| `compras_programadas_itens` | `CompraProgramadaItem` | ComprasModule (escrita) |
| `disponibilidades_virtuais` | `DisponibilidadeVirtual` | ComprasModule (escrita) |
| `reservas_disponibilidade` | `ReservaDisponibilidade` | ComprasModule (escrita) |
| `regras_desdobramento` | `RegraDesdobramento` | CadastrosModule (escrita) / ComprasModule (leitura) |

**Tabelas lidas (sem escrita):**

| Tabela | Origem | Motivo da leitura |
|---|---|---|
| `fornecedores` | CadastrosModule | Validação de fornecedor ativo |
| `itens_compra` | CadastrosModule | Validação de item de compra |
| `itens_comerciais` | CadastrosModule | Resolução do item comercial gerado |
| `usuarios` | AuthModule | `createdBy`, `confirmedBy` |

### Schema Drizzle — arquivo de referência

Um arquivo por domínio conforme convenção:
`app/backend/src/compras/compras.schema.ts`

---

## 3. Regra de Desdobramento — estrutura definitiva

### 3.1 Modelo da tabela `regras_desdobramento`

```typescript
// compras_programadas.schema.ts (ou cadastros.schema.ts — lida por ComprasModule)
export const regrasDesdobramento = pgTable(
  'regras_desdobramento',
  {
    id:               uuid('id').primaryKey().defaultRandom(),
    itemCompraId:     uuid('item_compra_id').notNull().references(() => itensCompra.id),
    itemComercialId:  uuid('item_comercial_id').notNull().references(() => itensComerciais.id),
    fatorQuantidade:  numeric('fator_quantidade', { precision: 10, scale: 4 }).notNull(),
    status:           text('status').notNull().default('ativa'),       // 'ativa' | 'inativa'
    vigenciaInicio:   date('vigencia_inicio').notNull(),
    vigenciaFim:      date('vigencia_fim'),                            // NULL = sem vencimento
    createdAt:        timestamptz('created_at').notNull().defaultNow(),
    updatedAt:        timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    // unicidade: par ativo por período — sem duas regras ativas para o mesmo par
    uqParAtivo: uniqueIndex('uq_regra_desbr_par_ativo')
      .on(t.itemCompraId, t.itemComercialId)
      .where(sql`status = 'ativa'`),
    checkFator: check('chk_fator_positivo', sql`fator_quantidade > 0`),
  })
);
```

**Campos críticos:**

| Campo | Tipo | Regra |
|---|---|---|
| `item_compra_id` | `UUID NOT NULL FK` | Item comprado (ex.: "Boi Inteiro") |
| `item_comercial_id` | `UUID NOT NULL FK` | Item vendável gerado (ex.: "Dianteiro Bovino") |
| `fator_quantidade` | `NUMERIC(10,4) NOT NULL` | Multiplicador; deve ser `> 0` |
| `status` | `TEXT NOT NULL` | `ativa` \| `inativa`; CHECK constraint |
| `vigencia_inicio` | `DATE NOT NULL` | Data de início da vigência |
| `vigencia_fim` | `DATE NULL` | NULL = sem vencimento |

### 3.2 Cálculo

```
quantidade_virtual = FLOOR(quantidade_comprada × fator_quantidade)
```

- `FLOOR` garante resultado inteiro (unidade comercial é peça/cabeça — sem fração).
- O cálculo é executado em TypeScript no serviço (`Math.floor`) e armazenado em `disponibilidades_virtuais.quantidade_total_gerada` como `NUMERIC(10,0)`.
- A regra aplicada em cada item da compra é registrada em `compras_programadas_itens.regra_desdobramento_id` para rastreabilidade futura.

### 3.3 Exemplo concreto

**Compra programada do dia:**
- Item de compra: "Boi Inteiro" — quantidade: **10 cabeças**

**Regras de desdobramento ativas para "Boi Inteiro":**

| Par `(item_compra × item_comercial)` | `fator_quantidade` | `quantidade_virtual = FLOOR(10 × fator)` |
|---|---|---|
| Boi Inteiro × Dianteiro Bovino | 1.0000 | **10** |
| Boi Inteiro × Central Bovino   | 1.0000 | **10** |
| Boi Inteiro × Traseiro Bovino  | 1.0000 | **10** |

**Resultado:** 3 registros criados em `disponibilidades_virtuais`, cada um com `quantidade_total_gerada = 10` e `quantidade_disponivel = 10`.

**Exemplo com fator fracionário:**
- Item: "Frango Caixa" — quantidade: **7 caixas** — fator para "Coxa Frango": 4.0000
- `FLOOR(7 × 4.0) = 28` unidades de Coxa Frango disponíveis.

### 3.4 Constraints e índices

```sql
-- Índice para busca por item de compra (consulta de regras na confirmação)
CREATE INDEX idx_regras_desbr_item_compra ON regras_desdobramento (item_compra_id)
  WHERE status = 'ativa';

-- Índice para busca por item comercial (verificação de regras inversas)
CREATE INDEX idx_regras_desbr_item_comercial ON regras_desdobramento (item_comercial_id)
  WHERE status = 'ativa';

-- CHECK: fator positivo
ALTER TABLE regras_desdobramento ADD CONSTRAINT chk_fator_positivo
  CHECK (fator_quantidade > 0);

-- CHECK: status válido
ALTER TABLE regras_desdobramento ADD CONSTRAINT chk_regra_status
  CHECK (status IN ('ativa', 'inativa'));

-- CHECK: vigência coerente
ALTER TABLE regras_desdobramento ADD CONSTRAINT chk_vigencia_coerente
  CHECK (vigencia_fim IS NULL OR vigencia_fim >= vigencia_inicio);
```

> **Invariante importante:** A alteração de uma regra de desdobramento ativa nunca retroage — disponibilidades já geradas permanecem inalteradas. A regra em vigor no momento da confirmação é registrada no item da compra (`regra_desdobramento_id`).

---

## 4. Fluxo de confirmação e geração automática de disponibilidade virtual

### 4.1 Visão geral

```
POST /compras/:id/confirmar
        │
        ▼
[1] Validações pré-confirmação (fora da transação)
        │
        ▼
[2] BEGIN TRANSACTION
    ├─ [3] Bloqueia a compra com SELECT FOR UPDATE
    ├─ [4] Muda status → 'confirmada', registra confirmedBy e confirmedAt
    ├─ [5] Para cada CompraProgamadaItem:
    │       ├─ Carrega regra de desdobramento ativa e vigente
    │       ├─ Calcula quantidade_virtual = FLOOR(qtd_comprada × fator)
    │       └─ INSERT em disponibilidades_virtuais
    └─ [6] COMMIT
        │
        ▼
[7] Publica eventos de domínio (pós-commit, fora da transação)
```

### 4.2 Validações pré-confirmação (passo 1)

Executadas antes de abrir a transação. Qualquer falha lança exception e aborta o fluxo.

| # | Validação | Exception lançada |
|---|---|---|
| V-01 | Status atual da compra deve ser `rascunho` ou `em_negociacao` | `InvalidStatusTransitionException` |
| V-02 | `data_operacao` obrigatória | `ValidationException` |
| V-03 | `fornecedor_id` deve referenciar fornecedor com `status = 'ativo'` | `ValidationException` |
| V-04 | Compra deve ter ao menos um item | `ValidationException` |
| V-05 | Não pode existir outra compra com `status = 'confirmada'` e mesma `data_operacao` | `DuplicateLoteDiaException` |
| V-06 | Todos os itens devem ter `quantidade_comprada > 0` | `ValidationException` |
| V-07 | Todos os itens devem ter `regra_desdobramento_id` vinculado a uma regra `ativa` e vigente na `data_operacao` | `RegraDesdobramentoAusenteException` |
| V-08 | Para cada item, `FLOOR(qtd × fator) > 0` (evitar disponibilidade zero) | `ValidationException` |

### 4.3 Passos dentro da transação (passo 2–6)

```typescript
async confirmarCompra(id: string, usuarioId: string): Promise<void> {
  // Validações pré-transação (passo 1)
  await this.validarPreConfirmacao(id);

  await db.transaction(async (tx) => {
    // [3] Lock da compra
    const compra = await tx
      .select()
      .from(comprasProgramadas)
      .where(eq(comprasProgramadas.id, id))
      .for('update')           // SELECT FOR UPDATE
      .execute()
      .then((rows) => rows[0]);

    if (!compra) throw new NotFoundException('Compra não encontrada');

    // Revalida status dentro da transação (proteção contra race condition)
    if (!['rascunho', 'em_negociacao'].includes(compra.statusCompra)) {
      throw new InvalidStatusTransitionException(compra.statusCompra, 'confirmada');
    }

    // [4] Atualiza status da compra
    await tx
      .update(comprasProgramadas)
      .set({
        statusCompra: 'confirmada',
        confirmedBy: usuarioId,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(comprasProgramadas.id, id));

    // [5] Carrega itens e gera disponibilidades
    const itens = await tx
      .select()
      .from(comprasProgramadasItens)
      .innerJoin(
        regrasDesdobramento,
        eq(comprasProgramadasItens.regraDesdobramentoId, regrasDesdobramento.id)
      )
      .where(eq(comprasProgramadasItens.compraProgramadaId, id));

    const disponibilidades = itens.map((item) => {
      const quantidadeVirtual = Math.floor(
        Number(item.quantidadeComprada) * Number(item.regraDesdobramento.fatorQuantidade)
      );
      return {
        id: crypto.randomUUID(),
        compraProgramadaId: id,
        dataOperacao: compra.dataOperacao,
        itemComercialId: item.regraDesdobramento.itemComercialId,
        quantidadeTotalGerada: quantidadeVirtual,
        quantidadeReservada: 0,
        quantidadeDisponivel: quantidadeVirtual,
        quantidadeRecebida: 0,
        quantidadeExpedida: 0,
        quantidadeSobra: 0,
        statusDisponibilidade: 'gerada',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    await tx.insert(disponibilidadesVirtuais).values(disponibilidades);
    // [6] COMMIT implícito ao sair do callback sem erro
  });

  // [7] Publica eventos pós-commit
  await this.eventBus.publish(new CompraProgramadaConfirmadaEvent(id));
}
```

### 4.4 O que é criado em `disponibilidades_virtuais`

Para cada `CompraProgamadaItem` que possui uma regra de desdobramento ativa, é criado **um registro** em `disponibilidades_virtuais` com:

| Campo | Valor inicial |
|---|---|
| `compra_programada_id` | ID da compra confirmada |
| `data_operacao` | `compra.data_operacao` |
| `item_comercial_id` | `regra.item_comercial_id` |
| `quantidade_total_gerada` | `FLOOR(qtd_comprada × fator)` |
| `quantidade_reservada` | `0` |
| `quantidade_disponivel` | `= quantidade_total_gerada` |
| `quantidade_recebida` | `0` |
| `quantidade_expedida` | `0` |
| `quantidade_sobra` | `0` |
| `status_disponibilidade` | `'gerada'` |

**Constraint de unicidade:** `UNIQUE (compra_programada_id, item_comercial_id)` — um saldo por item por lote.

### 4.5 Evento de domínio publicado (pós-commit)

Após o commit bem-sucedido, dois tipos de evento são publicados:

1. **`compra_programada_confirmada`** — um evento por confirmação.
2. **`disponibilidade_virtual_gerada`** — um evento por cada `DisponibilidadeVirtual` criada.

Detalhes completos na seção 8.

---

## 5. Transação atômica de reserva de saldo

A reserva é executada pelo `ComprasModule` ao receber a chamada do `PedidosModule` via injeção de serviço (chamada interna — não há HTTP entre módulos no monólito).

### 5.1 Fluxo de reserva

```typescript
async reservarSaldo(
  disponibilidadeId: string,
  pedidoVendaItemId: string,
  quantidade: number
): Promise<void> {
  if (quantidade <= 0) throw new ValidationException('Quantidade deve ser > 0');

  await db.transaction(async (tx) => {
    // SELECT FOR UPDATE — garante exclusividade no saldo
    const dv = await tx
      .select()
      .from(disponibilidadesVirtuais)
      .where(eq(disponibilidadesVirtuais.id, disponibilidadeId))
      .for('update')
      .execute()
      .then((rows) => rows[0]);

    if (!dv) throw new NotFoundException('Disponibilidade virtual não encontrada');

    if (dv.quantidadeDisponivel < quantidade) {
      throw new InsufficientStockException(
        disponibilidadeId,
        dv.itemComercialId,
        quantidade,
        dv.quantidadeDisponivel
      );
    }

    // Decrementa saldo disponível
    await tx
      .update(disponibilidadesVirtuais)
      .set({
        quantidadeReservada: sql`quantidade_reservada + ${quantidade}`,
        quantidadeDisponivel: sql`quantidade_disponivel - ${quantidade}`,
        statusDisponibilidade: sql`
          CASE
            WHEN quantidade_disponivel - ${quantidade} = 0 THEN 'esgotada'
            ELSE 'parcialmente_reservada'
          END
        `,
        updatedAt: new Date(),
      })
      .where(eq(disponibilidadesVirtuais.id, disponibilidadeId));

    // Registra a reserva
    await tx.insert(reservasDisponibilidade).values({
      id: crypto.randomUUID(),
      disponibilidadeVirtualId: disponibilidadeId,
      pedidoVendaItemId,
      quantidadeReservada: quantidade,
      statusReserva: 'ativa',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  // Pós-commit
  await this.eventBus.publish(new SaldoVirtualAtualizadoEvent(disponibilidadeId));
  const dvAtualizada = await this.getDv(disponibilidadeId);
  if (dvAtualizada.quantidadeDisponivel === 0) {
    await this.eventBus.publish(new SaldoVirtualEsgotadoEvent(disponibilidadeId, dvAtualizada.itemComercialId));
  }
}
```

### 5.2 `InsufficientStockException`

```typescript
export class InsufficientStockException extends HttpException {
  constructor(
    disponibilidadeId: string,
    itemComercialId: string,
    quantidadeSolicitada: number,
    quantidadeDisponivel: number
  ) {
    super(
      {
        statusCode: 422,
        error: 'INSUFFICIENT_STOCK',
        message: `Saldo insuficiente para o item. Solicitado: ${quantidadeSolicitada}, disponível: ${quantidadeDisponivel}.`,
        disponibilidadeId,
        itemComercialId,
        quantidadeSolicitada,
        quantidadeDisponivel,
      },
      HttpStatus.UNPROCESSABLE_ENTITY
    );
  }
}
```

### 5.3 `liberarReserva` (cancelamento de pedido)

Chamado pelo `PedidosModule` quando um pedido ou item de pedido é cancelado.

```typescript
async liberarReserva(pedidoVendaItemId: string): Promise<void> {
  await db.transaction(async (tx) => {
    // Localiza reserva ativa
    const reserva = await tx
      .select()
      .from(reservasDisponibilidade)
      .where(
        and(
          eq(reservasDisponibilidade.pedidoVendaItemId, pedidoVendaItemId),
          eq(reservasDisponibilidade.statusReserva, 'ativa')
        )
      )
      .for('update')
      .execute()
      .then((rows) => rows[0]);

    if (!reserva) return; // Reserva já liberada ou inexistente — idempotente

    // Restaura saldo
    await tx
      .update(disponibilidadesVirtuais)
      .set({
        quantidadeReservada: sql`quantidade_reservada - ${reserva.quantidadeReservada}`,
        quantidadeDisponivel: sql`quantidade_disponivel + ${reserva.quantidadeReservada}`,
        statusDisponibilidade: sql`
          CASE
            WHEN quantidade_total_gerada - (quantidade_reservada - ${reserva.quantidadeReservada}) = quantidade_total_gerada THEN 'gerada'
            WHEN quantidade_disponivel + ${reserva.quantidadeReservada} > 0 THEN 'parcialmente_reservada'
            ELSE status_disponibilidade
          END
        `,
        updatedAt: new Date(),
      })
      .where(eq(disponibilidadesVirtuais.id, reserva.disponibilidadeVirtualId));

    // Marca reserva como liberada
    await tx
      .update(reservasDisponibilidade)
      .set({ statusReserva: 'liberada', updatedAt: new Date() })
      .where(eq(reservasDisponibilidade.id, reserva.id));
  });

  await this.eventBus.publish(new SaldoVirtualAtualizadoEvent(/* disponibilidadeId */));
}
```

**Idempotência:** se a reserva já estiver no status `liberada`, a função retorna sem erro. Isso é importante para reprocessamentos e retentativas.

---

## 6. Impacto de divergência no saldo virtual

Uma divergência de recebimento com `impacto_comercial` não nulo deve ser processada pelo `ComprasModule` para ajustar o saldo virtual correspondente.

### 6.1 Gatilho

O `PesagemModule` (responsável pelo recebimento físico) chama `ComprasService.processarDivergencia(divergenciaDto)` após registrar a `DivergenciaRecebimento`. Isso mantém a regra de negócio no `ComprasModule` e a persistência da divergência no `PesagemModule`.

### 6.2 Cálculo do delta

```
delta = quantidade_recebida_real - quantidade_comprada_esperada
```

- `delta < 0` → **falta**: menos peças recebidas que o esperado → reduz saldo virtual.
- `delta > 0` → **excesso**: mais peças recebidas que o esperado → pode aumentar saldo virtual (caso de negócio incomum; requer aprovação de gestor).

Para redução:

```
novo_disponivel = MAX(0, quantidade_disponivel_atual + delta)
reducao_efetiva = quantidade_disponivel_atual - novo_disponivel
excedente_em_pedidos = |delta| - quantidade_disponivel_atual (quando disponivel < |delta|)
```

### 6.3 Fluxo de ajuste imediato

```typescript
async processarDivergencia(dto: ProcessarDivergenciaDto): Promise<void> {
  const { compraProgramadaId, itemComercialId, deltaQuantidade, divergenciaId, operadorId } = dto;

  await db.transaction(async (tx) => {
    const dv = await tx
      .select()
      .from(disponibilidadesVirtuais)
      .where(
        and(
          eq(disponibilidadesVirtuais.compraProgramadaId, compraProgramadaId),
          eq(disponibilidadesVirtuais.itemComercialId, itemComercialId)
        )
      )
      .for('update')
      .execute()
      .then((rows) => rows[0]);

    if (!dv) throw new NotFoundException('Disponibilidade virtual não localizada para esta divergência');

    const novoDisponivel = Math.max(0, Number(dv.quantidadeDisponivel) + deltaQuantidade);
    const novoTotalGerado = Math.max(0, Number(dv.quantidadeTotalGerada) + deltaQuantidade);

    // Determina pedidos impactados (reservados acima do novo total)
    const excedente = Number(dv.quantidadeReservada) - novoTotalGerado;
    const pedidosAfetados = excedente > 0
      ? await this.identificarPedidosAfetados(tx, dv.id, excedente)
      : [];

    // Atualiza saldo
    await tx
      .update(disponibilidadesVirtuais)
      .set({
        quantidadeTotalGerada: novoTotalGerado,
        quantidadeDisponivel: novoDisponivel,
        quantidadeComDivergencia: sql`quantidade_com_divergencia + ${Math.abs(deltaQuantidade)}`,
        statusDisponibilidade: novoDisponivel === 0 ? 'esgotada' : 'impactada_por_divergencia',
        updatedAt: new Date(),
      })
      .where(eq(disponibilidadesVirtuais.id, dv.id));

    // Marca pedidos excedentes em divergência
    for (const pedidoItemId of pedidosAfetados) {
      await tx
        .update(pedidosVendaItens)
        .set({ statusItemPedido: 'em_divergencia', updatedAt: new Date() })
        .where(eq(pedidosVendaItens.id, pedidoItemId));

      await tx
        .update(pedidosVenda)
        .set({ statusPedido: 'impactado_por_divergencia', updatedAt: new Date() })
        .where(
          eq(pedidosVenda.id,
            tx.select({ id: pedidosVendaItens.pedidoVendaId })
              .from(pedidosVendaItens)
              .where(eq(pedidosVendaItens.id, pedidoItemId))
          )
        );
    }
  });

  // Alertas e eventos pós-commit
  await this.alertasService.criarAlerta({
    tipoAlerta: 'divergencia_recebimento_impacta_comercial',
    nivel: 'critico',
    moduloOrigem: 'compras',
    entidadeOrigem: 'disponibilidade_virtual',
    entidadeOrigemId: /* dvId */,
    descricao: `Divergência no recebimento ajustou o saldo virtual em ${deltaQuantidade} unidades.`,
    impacto: `Pedidos afetados: ${pedidosAfetados.length}`,
  });

  for (const pedidoItemId of pedidosAfetados) {
    await this.eventBus.publish(
      new PedidoItemEmDivergenciaEvent(pedidoItemId, Math.abs(deltaQuantidade), divergenciaId)
    );
  }
}
```

### 6.4 Marcação de pedidos em divergência

- Pedidos afetados têm `status_pedido → 'impactado_por_divergencia'`.
- Itens afetados têm `status_item_pedido → 'em_divergencia'`.
- Pedido em divergência **não é automaticamente cancelado** — o gestor/comercial decide a ação corretiva (cancelar o item, substituir, ajustar quantidade).
- Ação corretiva requer aprovação de perfil `gestor`.

### 6.5 Evento `pedido_item_em_divergencia`

Publicado uma vez por item de pedido afetado. Permite que o frontend exiba alertas em tempo real para gestor e comercial. Detalhes na seção 8.

### 6.6 Alerta para gestor/comercial

Além do evento, é criado um `AlertaOperacional` com:

| Campo | Valor |
|---|---|
| `tipo_alerta` | `divergencia_recebimento_impacta_comercial` |
| `nivel` | `critico` |
| `modulo_origem` | `compras` |
| `descricao` | Mensagem com item, delta e pedidos afetados |
| `status_alerta` | `aberto` |

O alerta `critico` permanece `aberto` até que o gestor registre uma ação corretiva. Enquanto `aberto`, ele não bloqueia outras operações neste módulo (bloqueia apenas os itens marcados `em_divergencia` no módulo de pedidos).

---

## 7. Contratos de API REST

Todas as rotas estão sob o prefixo `/api/v1`. Autenticação via JWT obrigatória em todos os endpoints.

### 7.1 Compras Programadas

| Método | Path | Descrição | Perfis autorizados |
|---|---|---|---|
| `POST` | `/compras` | Criar nova compra programada (status inicial: `rascunho`) | `compras`, `gestor`, `administrador` |
| `GET` | `/compras?data=&status=` | Listar compras programadas com filtros por data e/ou status | Todos os perfis autenticados |
| `GET` | `/compras/:id` | Obter compra programada por ID com itens | Todos os perfis autenticados |
| `PATCH` | `/compras/:id` | Editar compra (cabeçalho e/ou itens) — bloqueado após `confirmada` | `compras`, `gestor`, `administrador` |
| `POST` | `/compras/:id/confirmar` | Confirmar compra e gerar disponibilidade virtual (transação atômica) | `compras` |
| `POST` | `/compras/:id/cancelar` | Cancelar compra — bloqueado se há pedidos vinculados, exceto perfil `gestor` | `gestor` |

**Request body — `POST /compras`:**
```json
{
  "dataOperacao": "2026-06-05",
  "fornecedorId": "uuid",
  "numeroInterno": "CP-001",
  "referenciaExterna": "NF-FRIG-4521",
  "previsaoEntrega": "2026-06-06T06:00:00-03:00",
  "observacoes": "Bois da fazenda São João",
  "itens": [
    {
      "itemCompraId": "uuid",
      "quantidadeComprada": "10",
      "unidade": "cabeca",
      "regraDesdobramentoId": "uuid",
      "previsaoChegadaItem": null,
      "observacoes": null
    }
  ]
}
```

**Request body — `POST /compras/:id/cancelar`:**
```json
{
  "motivo": "Fornecedor cancelou entrega por problema logístico"
}
```

### 7.2 Disponibilidades Virtuais

| Método | Path | Descrição | Perfis autorizados |
|---|---|---|---|
| `GET` | `/compras/:id/disponibilidades` | Listar todas as disponibilidades virtuais de uma compra com saldos atuais | Todos os perfis autenticados |
| `POST` | `/disponibilidades/:id/reservar` | Reservar saldo (chamado internamente pelo PedidosModule; também exposto para integração direta) | `pedidos`, `comercial`, `gestor` |
| `POST` | `/disponibilidades/:id/liberar` | Liberar reserva (cancelamento de item de pedido) | `pedidos`, `comercial`, `gestor` |

**Request body — `POST /disponibilidades/:id/reservar`:**
```json
{
  "pedidoVendaItemId": "uuid",
  "quantidade": 3
}
```

**Response — `GET /compras/:id/disponibilidades`:**
```json
[
  {
    "id": "uuid",
    "itemComercialId": "uuid",
    "itemComercialDescricao": "Dianteiro Bovino",
    "dataOperacao": "2026-06-05",
    "quantidadeTotalGerada": 10,
    "quantidadeReservada": 4,
    "quantidadeDisponivel": 6,
    "quantidadeRecebida": 0,
    "quantidadeExpedida": 0,
    "statusDisponibilidade": "parcialmente_reservada"
  }
]
```

### 7.3 Códigos de resposta

| Código | Situação |
|---|---|
| `200 OK` | Leitura bem-sucedida |
| `201 Created` | Compra ou reserva criada |
| `204 No Content` | Cancelamento sem conteúdo de retorno |
| `400 Bad Request` | Validação de campos |
| `403 Forbidden` | Perfil sem permissão para a ação |
| `404 Not Found` | Entidade não localizada |
| `409 Conflict` | Compra duplicada para a data (`DuplicateLoteDiaException`) |
| `422 Unprocessable Entity` | Saldo insuficiente (`InsufficientStockException`), regra ausente, status incompatível |

---

## 8. Eventos de domínio publicados

Todos os eventos são publicados via `EventBus` (NestJS CQRS) **após o commit da transação**. O `DashboardsModule` persiste cada evento como `EventoDominio` (append-only). O módulo de WebSocket escuta e faz broadcast para os clientes conectados.

| Evento | Quando é publicado | Payload mínimo |
|---|---|---|
| `compra_programada_confirmada` | Após confirmação bem-sucedida (1 evento por confirmação) | `{ compraProgramadaId, dataOperacao, fornecedorId, totalItens, confirmedBy, timestamp }` |
| `disponibilidade_virtual_gerada` | Uma vez por `DisponibilidadeVirtual` criada na confirmação | `{ disponibilidadeId, compraProgramadaId, dataOperacao, itemComercialId, itemComercialDescricao, quantidadeTotal, timestamp }` |
| `saldo_virtual_atualizado` | A cada reserva ou liberação de saldo | `{ disponibilidadeId, itemComercialId, quantidadeDisponivel, quantidadeReservada, statusDisponibilidade, timestamp }` |
| `saldo_virtual_esgotado` | Quando `quantidade_disponivel` chega a zero após reserva | `{ disponibilidadeId, itemComercialId, dataOperacao, timestamp }` |
| `pedido_item_em_divergencia` | Quando divergência de recebimento afeta um item de pedido reservado | `{ pedidoId, pedidoVendaItemId, itemComercialId, quantidadeAfetada, divergenciaId, timestamp }` |

**Classe base de evento:**
```typescript
export abstract class DomainEvent {
  readonly aggregateId: string;
  readonly occurredAt: Date = new Date();
  abstract readonly eventType: string;
}

export class CompraProgramadaConfirmadaEvent extends DomainEvent {
  readonly eventType = 'compra_programada_confirmada';
  constructor(
    readonly compraProgramadaId: string,
    readonly dataOperacao: string,
    readonly fornecedorId: string,
    readonly totalItens: number,
    readonly confirmedBy: string,
  ) {
    super();
    this.aggregateId = compraProgramadaId;
  }
}
```

---

## 9. Segregação de funções

| Ação | Perfil mínimo exigido | Justificativa |
|---|---|---|
| Criar compra programada | `compras` | Operação rotineira do comprador |
| Editar compra (antes da confirmação) | `compras` | Idem |
| **Confirmar compra** | `compras` | Ação crítica — gera saldo virtual; restrita ao comprador |
| **Cancelar compra sem pedidos vinculados** | `compras` | Rotineiro enquanto sem impacto comercial |
| **Cancelar compra com pedidos vinculados** | `gestor` | Impacto comercial: requer autoridade de gestor |
| Consultar compras e disponibilidades | Todos os perfis autenticados | Consulta não modifica estado |
| Reservar saldo (via pedido de venda) | `comercial`, `gestor` | Ação de venda — perfil comercial natural |
| Liberar reserva (cancelar item de pedido) | `comercial`, `gestor` | Idem |
| **Alterar regra de desdobramento** | `administrador` | Impacta cálculo de disponibilidade; restrita ao administrador |
| **Registrar divergência no recebimento** | `operador_recebimento` | Operador físico que apura o recebimento |
| **Aprovar ação corretiva após divergência** | `gestor` | Decisão com impacto comercial; segregada do operador |
| Visualizar alertas de divergência | `gestor`, `comercial` | Ambos precisam tomar ciência |
| Exportar resumo / espelho operacional | `compras`, `gestor`, `administrador` | Relatórios não críticos |

**Regra de segregação crítica:** A confirmação da compra e a aprovação de ação corretiva de divergência **não podem ser feitas pelo mesmo usuário** que criou a compra, quando aplicável por política interna. Essa restrição é aplicada na camada de serviço com base nos campos `created_by` e `confirmed_by`.

---

## 10. Casos de teste obrigatórios

Os testes abaixo são obrigatórios (cobertura mínima de funcionalidade crítica). Devem ser implementados como testes de integração com banco PostgreSQL real (não mock) para garantir semântica transacional.

### TC-01 — Overbooking bloqueado (reserva simultânea)

**Cenário:** Dois pedidos tentam reservar o mesmo saldo de `DisponibilidadeVirtual` com `quantidade_disponivel = 5` ao mesmo tempo.
**Pré-condição:** DV com `quantidade_disponivel = 5`.
**Ação:** Duas requisições `POST /disponibilidades/:id/reservar` com `quantidade = 5` em concorrência.
**Resultado esperado:** Exatamente uma reserva bem-sucedida (201) e uma falha com `InsufficientStockException` (422). `quantidade_disponivel` final = 0, `quantidade_reservada` = 5. Nenhum saldo negativo.

### TC-02 — Divergência com pedidos afetados

**Cenário:** DV com `quantidade_total_gerada = 10`, `quantidade_reservada = 8`, `quantidade_disponivel = 2`. Uma divergência reduz a quantidade comprada em 3 unidades.
**Ação:** `processarDivergencia({ deltaQuantidade: -3 })`.
**Resultado esperado:**
- `quantidade_total_gerada` → 7
- `quantidade_disponivel` → MAX(0, 2 - 3) = 0 (saldo zerado)
- `quantidade_reservada` ainda 8 (as reservas existem mas excedem o novo total em 1)
- Pedidos com reserva excedente marcados `impactado_por_divergencia`
- 1 evento `pedido_item_em_divergencia` publicado para o item afetado
- 1 `AlertaOperacional` nível `critico` criado

### TC-03 — Reserva concorrente com SELECT FOR UPDATE

**Cenário:** 10 pedidos simultâneos, cada um tentando reservar 1 unidade de uma DV com `quantidade_disponivel = 5`.
**Ação:** 10 chamadas paralelas a `reservarSaldo`.
**Resultado esperado:** Exatamente 5 reservas bem-sucedidas e 5 falhas `InsufficientStockException`. Contagem de reservas ativas = 5. `quantidade_disponivel` = 0. Nenhuma condição de corrida produz saldo negativo.

### TC-04 — Confirmação duplicada no mesmo dia

**Cenário:** Já existe uma compra `status = 'confirmada'` para `data_operacao = '2026-06-05'`. Tenta-se confirmar outra compra para a mesma data.
**Resultado esperado:** `DuplicateLoteDiaException` (409). A segunda compra permanece em seu status anterior.

### TC-05 — Confirmação sem regra de desdobramento

**Cenário:** Compra com item `boi_inteiro_id` onde não existe `RegraDesdobramento` ativa e vigente.
**Resultado esperado:** `RegraDesdobramentoAusenteException` (422). Nenhuma DV criada. Status da compra inalterado.

### TC-06 — Liberação de reserva ao cancelar pedido

**Cenário:** DV com `quantidade_disponivel = 3`, `quantidade_reservada = 7`. Pedido com reserva de 3 unidades é cancelado.
**Ação:** `liberarReserva(pedidoVendaItemId)`.
**Resultado esperado:** `quantidade_disponivel` → 6, `quantidade_reservada` → 4. Reserva marcada `liberada`. Evento `saldo_virtual_atualizado` publicado.

### TC-07 — Geração correta de múltiplas disponibilidades na confirmação

**Cenário:** Compra com 1 item "Boi Inteiro" (quantidade = 10) com 3 regras: dianteiro (fator 1.0), central (fator 1.0), traseiro (fator 1.0).
**Resultado esperado:** 3 registros em `disponibilidades_virtuais`, cada um com `quantidade_total_gerada = 10`. 3 eventos `disponibilidade_virtual_gerada` publicados. 1 evento `compra_programada_confirmada` publicado.

### TC-08 — Cancelamento de compra com pedidos vinculados por perfil insuficiente

**Cenário:** Compra confirmada com 2 pedidos de venda vinculados. Usuário com perfil `compras` tenta cancelar.
**Resultado esperado:** `ForbiddenException` (403). Compra permanece no status atual. Nenhum pedido afetado.

### TC-09 — Divergência com delta positivo (excesso)

**Cenário:** Recebimento com 2 unidades a mais que o comprado.
**Ação:** `processarDivergencia({ deltaQuantidade: +2 })`.
**Resultado esperado:** Aumento de `quantidade_total_gerada` e `quantidade_disponivel` em 2. Nenhum pedido marcado em divergência. Evento `saldo_virtual_atualizado` publicado.

### TC-10 — Cálculo FLOOR com fator fracionário

**Cenário:** Item "Frango Caixa" × "Coxa Frango", fator = 4.0, quantidade = 7.
**Resultado esperado:** `quantidade_total_gerada = FLOOR(7 × 4.0) = 28`. Item "Frango Caixa" × "Peito Frango", fator = 3.5, quantidade = 3 → `FLOOR(3 × 3.5) = FLOOR(10.5) = 10`.

---

*Spec criada em 2026-06-05. Próxima revisão obrigatória antes do início da Fase 1 (scaffolding do backend).*
