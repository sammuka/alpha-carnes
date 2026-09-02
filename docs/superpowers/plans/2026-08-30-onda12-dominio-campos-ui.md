# Onda 12 — Domínio de campos controlados na UI — Plano de Implementação

## Emenda 5 — T6 ComboboxField disabled

Esta emenda fecha exclusivamente o achado do Worker na Task 6: depois do empty state, o
popover do `cmdk` ainda está aberto e tanto o trigger quanto o `CommandInput` possuem
`role="combobox"`. Em caso de conflito, esta seção prevalece sobre o `it` literal
`combobox-field.test.tsx › 'DoD 12.4 filtra por label e sublabel, seleciona por teclado e
limpa opcional'` e sobre a Task 6. Não reabre SAM-166, migrations, FKs, PR nem qualquer
outro ponto já fechado. O botão “Limpar seleção” permanece irmão do `PopoverTrigger`, sem
aninhamento, e a seleção filtrada de Norte permanece por `await user.keyboard('{Enter}')`.

No `it` literal, imediatamente antes do `rerender(<ComboboxControl disabled />)`, usar uma
única sequência, sem alternativa por `data-slot`:

```ts
await user.keyboard('{Escape}');
expect(screen.queryByPlaceholderText('Buscar rota')).not.toBeInTheDocument();
rerender(<ComboboxControl disabled />);
expect(screen.getByRole('combobox')).toBeDisabled();
```

`Escape` fecha o popover antes do `rerender`; assim, resta um único elemento com o papel
`combobox`, o trigger desabilitado. Não alterar `ComboboxField` além do que a Task 6 já pede.

**Estado da Emenda 5:** `ok`. O teste fecha explicitamente o popover antes de consultar o
único `combobox`, sem decisão ou alternativa residual para o Worker.

## Emenda 1 — Portão 1

Esta emenda incorpora a decisão do Quality Owner Jefferson em 2026-08-30 e responde ao veredito de Portão 1 de `2026-08-30T14:30:46Z` (plano anterior SHA-256 iniciado por `1721180B`). Em caso de conflito, esta seção prevalece sobre o texto remanescente do plano.

1. **Terminologia / SAM-166:** fechado pela Constituição v1.1.0, Princípio IX, e AD-13. SAM-166 sai do escopo e o assessment correspondente fica recusado pelo QO. O campo `nomeFantasia` mantém o rótulo composto literal `Nome Fantasia/Marca` em toda tela tocada. “Marca” continua proibida como rótulo isolado, placeholder, termo de busca ou entidade. Os testes não procuram ausência da substring no rótulo composto. `docs/governance/quality-gates.md` não será alterado nesta onda.
2. **Numeração de migrations:** a inspeção literal de `origin/develop` e do commit pinado `000f946112aebc7eaf60c79dfad8ea7aad93f702` contradiz a premissa do achado: `app/backend/src/database/migrations/meta/_journal.json` contém entradas até `idx: 30`, e o tree contém `0028_onda11_multicompra_expand.sql`, `0029_onda11_multicompra_backfill.sql` e `0030_onda11_multicompra_contract.sql`, além dos snapshots `0028–0030`. Logo, os próximos nomes livres que o drizzle-kit emitirá são, de forma determinística, `0031_onda12_dominio_expand.sql`, `0032_onda12_dominio_backfill.sql` e `0033_onda12_dominio_contract.sql`. O plano mantém `0031–0033`; usar `0028–0030` sobrescreveria a Onda 11. Este é o único ponto que exige reconciliação humana do veredito antes de nova execução.
3. **DTOs de frota:** fechado com paths verificados por `git show origin/develop:<path>`. Não existe `app/backend/src/modules/frota/dto/frota.dto.ts`; os contratos reais são `app/backend/src/modules/frota/dto/caminhao-cadastro.dto.ts` e `app/backend/src/modules/frota/dto/motorista.dto.ts`. Rotas usam `app/backend/src/modules/cadastros/rotas/dto/rota.dto.ts`.
4. **Commit por task:** fechado. T0–T14 terminam com mensagem de commit explícita e própria. Cada task adiciona somente seus arquivos; não há commit único acumulado no gate.
5. **Vínculo inativo / RA-01:** fechado no backend. Criação aceita somente vínculo ativo e não removido. Em edição, o ID já persistido é aceito mesmo inativo; qualquer outro ID inativo é rejeitado com HTTP 400. Registro removido nunca é aceito. DTOs Zod continuam validando UUID/nullabilidade; a decisão de atividade, que depende do estado persistido, fica literalmente nos services e é coberta 1:1 por testes de criação, manutenção do vínculo atual e troca para outro inativo.

**Estado desta emenda:** `requires-human` exclusivamente porque a solicitação de renumerar para `0028–0030` conflita com o conteúdo verificável da base pinada. Os demais quatro achados estão fechados sem pendência.

## Emenda 2 — Portão 1 (`ajustar`)

Esta emenda responde ao veredito de `2026-08-30T14:38:54Z`. Ela foi escrita contra
`origin/develop @ 000f946112aebc7eaf60c79dfad8ea7aad93f702` e contra o WIP de
`feature/jef @ 1a3df836005bd33b04bf486fc61fdc409667eb52`, lidos por `git show` e pelo
checkout de trabalho. Em caso de conflito, esta seção prevalece sobre Tasks 2, 4 e 7–13.
Permanecem fechados e não são reabertos: AD-13/`Nome Fantasia/Marca`, SAM-166 fora,
migrations `0031–0033`, DTOs reais `caminhao-cadastro.dto.ts`/`motorista.dto.ts`, commit
por task, regra de vínculo inativo, ausência de PR, `feature/jef` + `.worktrees/o12` e
protótipo `main @ 8d32aa4c`.

### E2.1 — Task 2: SQL literal de todos os backfills de FK

O Worker deve copiar o bloco abaixo integralmente para
`app/backend/src/database/migrations/0032_onda12_dominio_backfill.sql`, depois dos três
`UPDATE` de normalização de unidade já especificados. Todos os alvos são zerados antes da
tentativa de conciliação; portanto snapshot nulo/vazio, cadastro removido/inativo,
ambiguidade ou ausência de correspondência termina literalmente em `NULL`.

```sql
-- rotas.representante_padrao -> rotas.representante_padrao_id
UPDATE rotas SET representante_padrao_id = NULL;
WITH correspondencias AS (
  SELECT
    r.id AS rota_id,
    min(rep.id::text)::uuid AS representante_id
  FROM rotas r
  JOIN representantes rep
    ON rep.deleted_at IS NULL
   AND rep.status = 'ativo'
   AND (
     lower(btrim(rep.codigo)) = lower(btrim(r.representante_padrao))
     OR lower(btrim(rep.nome)) = lower(btrim(r.representante_padrao))
   )
  WHERE r.deleted_at IS NULL
    AND nullif(btrim(r.representante_padrao), '') IS NOT NULL
  GROUP BY r.id
  HAVING count(DISTINCT rep.id) = 1
)
UPDATE rotas r
SET representante_padrao_id = c.representante_id
FROM correspondencias c
WHERE r.id = c.rota_id;

-- rotas.caminhao_padrao -> rotas.caminhao_padrao_id
UPDATE rotas SET caminhao_padrao_id = NULL;
WITH correspondencias AS (
  SELECT
    r.id AS rota_id,
    min(fc.id::text)::uuid AS caminhao_id
  FROM rotas r
  JOIN frota_caminhoes fc
    ON fc.deleted_at IS NULL
   AND fc.status = 'ativo'
   AND lower(btrim(fc.placa)) = lower(btrim(r.caminhao_padrao))
  WHERE r.deleted_at IS NULL
    AND nullif(btrim(r.caminhao_padrao), '') IS NOT NULL
  GROUP BY r.id
  HAVING count(DISTINCT fc.id) = 1
)
UPDATE rotas r
SET caminhao_padrao_id = c.caminhao_id
FROM correspondencias c
WHERE r.id = c.rota_id;

-- rotas.motorista_padrao -> rotas.motorista_padrao_id
UPDATE rotas SET motorista_padrao_id = NULL;
WITH correspondencias AS (
  SELECT
    r.id AS rota_id,
    min(fm.id::text)::uuid AS motorista_id
  FROM rotas r
  JOIN frota_motoristas fm
    ON fm.deleted_at IS NULL
   AND fm.status = 'ativo'
   AND lower(btrim(fm.nome)) = lower(btrim(r.motorista_padrao))
  WHERE r.deleted_at IS NULL
    AND nullif(btrim(r.motorista_padrao), '') IS NOT NULL
  GROUP BY r.id
  HAVING count(DISTINCT fm.id) = 1
)
UPDATE rotas r
SET motorista_padrao_id = c.motorista_id
FROM correspondencias c
WHERE r.id = c.rota_id;

-- pedidos_venda.rota_prevista -> pedidos_venda.rota_id
UPDATE pedidos_venda SET rota_id = NULL;
WITH correspondencias AS (
  SELECT
    p.id AS pedido_id,
    min(r.id::text)::uuid AS rota_id
  FROM pedidos_venda p
  JOIN rotas r
    ON r.deleted_at IS NULL
   AND r.status = 'ativo'
   AND (
     lower(btrim(r.codigo)) = lower(btrim(p.rota_prevista))
     OR lower(btrim(r.nome)) = lower(btrim(p.rota_prevista))
   )
  WHERE p.deleted_at IS NULL
    AND nullif(btrim(p.rota_prevista), '') IS NOT NULL
  GROUP BY p.id
  HAVING count(DISTINCT r.id) = 1
)
UPDATE pedidos_venda p
SET rota_id = c.rota_id
FROM correspondencias c
WHERE p.id = c.pedido_id;

-- caminhoes.motorista -> caminhoes.motorista_id
UPDATE caminhoes SET motorista_id = NULL;
WITH correspondencias AS (
  SELECT
    c.id AS caminhao_operacional_id,
    min(fm.id::text)::uuid AS motorista_id
  FROM caminhoes c
  JOIN frota_motoristas fm
    ON fm.deleted_at IS NULL
   AND fm.status = 'ativo'
   AND lower(btrim(fm.nome)) = lower(btrim(c.motorista))
  WHERE c.deleted_at IS NULL
    AND nullif(btrim(c.motorista), '') IS NOT NULL
  GROUP BY c.id
  HAVING count(DISTINCT fm.id) = 1
)
UPDATE caminhoes c
SET motorista_id = x.motorista_id
FROM correspondencias x
WHERE c.id = x.caminhao_operacional_id;

-- caminhoes.rota -> caminhoes.rota_id
UPDATE caminhoes SET rota_id = NULL;
WITH correspondencias AS (
  SELECT
    c.id AS caminhao_operacional_id,
    min(r.id::text)::uuid AS rota_id
  FROM caminhoes c
  JOIN rotas r
    ON r.deleted_at IS NULL
   AND r.status = 'ativo'
   AND (
     lower(btrim(r.codigo)) = lower(btrim(c.rota))
     OR lower(btrim(r.nome)) = lower(btrim(c.rota))
   )
  WHERE c.deleted_at IS NULL
    AND nullif(btrim(c.rota), '') IS NOT NULL
  GROUP BY c.id
  HAVING count(DISTINCT r.id) = 1
)
UPDATE caminhoes c
SET rota_id = x.rota_id
FROM correspondencias x
WHERE c.id = x.caminhao_operacional_id;

-- entradas_itens.fornecedor_nome -> entradas_itens.fornecedor_id
UPDATE entradas_itens SET fornecedor_id = NULL;
WITH correspondencias AS (
  SELECT
    e.id AS entrada_id,
    min(f.id::text)::uuid AS fornecedor_id
  FROM entradas_itens e
  JOIN fornecedores f
    ON f.deleted_at IS NULL
   AND f.status = 'ativo'
   AND (
     lower(btrim(f.codigo)) = lower(btrim(e.fornecedor_nome))
     OR lower(btrim(f.razao_social)) = lower(btrim(e.fornecedor_nome))
   )
  WHERE e.deleted_at IS NULL
    AND nullif(btrim(e.fornecedor_nome), '') IS NOT NULL
  GROUP BY e.id
  HAVING count(DISTINCT f.id) = 1
)
UPDATE entradas_itens e
SET fornecedor_id = c.fornecedor_id
FROM correspondencias c
WHERE e.id = c.entrada_id;

-- As duas FKs abaixo já armazenam UUID em origin/develop; não há snapshot textual
-- correspondente. O contract falha, em vez de apagar ou inventar vínculo órfão.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM frota_caminhoes fc
    LEFT JOIN rotas r ON r.id = fc.rota_padrao_id
    WHERE fc.rota_padrao_id IS NOT NULL AND r.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Onda 12: frota_caminhoes.rota_padrao_id órfão';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM frota_motoristas fm
    LEFT JOIN frota_caminhoes fc ON fc.id = fm.caminhao_padrao_id
    WHERE fm.caminhao_padrao_id IS NOT NULL AND fc.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Onda 12: frota_motoristas.caminhao_padrao_id órfão';
  END IF;
END $$;
```

Colunas criadas por `0031`: `rotas.representante_padrao_id`,
`rotas.caminhao_padrao_id`, `rotas.motorista_padrao_id`,
`pedidos_venda.rota_id`, `caminhoes.motorista_id`, `caminhoes.rota_id` e
`entradas_itens.fornecedor_id`. `caminhoes.motorista_id` permanece nullable no banco para
preservar históricos sem match; o DTO o exige para toda nova escrita. As sete FKs apontam,
respectivamente, para `representantes(id)`, `frota_caminhoes(id)`,
`frota_motoristas(id)`, `rotas(id)`, `frota_motoristas(id)`, `rotas(id)` e
`fornecedores(id)`.

Verificação literal da Task 2:

```powershell
Set-Location D:\Projetos\AlphaCarnes\Projeto\alpha-carnes\.worktrees\o12\app\backend
npx jest test/integration/onda12-migrations.e2e-spec.ts test/unit/onda12-migrations-meta.spec.ts --runInBand
```

Saída esperada: `PASS test/integration/onda12-migrations.e2e-spec.ts`,
`PASS test/unit/onda12-migrations-meta.spec.ts`, `Test Suites: 2 passed, 2 total` e
`Tests: 3 passed, 3 total`.

### E2.2 — Task 4: implementação literal dos resolvers

Todos os resolvers abaixo são métodos privados. Os services devem importar
`BadRequestException`, `and`, `eq`, `isNull`, `NodePgDatabase`, `schema` e as tabelas
citadas. Cada campo persistido é nomeado literalmente.

Em `app/backend/src/modules/cadastros/rotas/rotas.service.ts`:

```ts
type VinculoRota = { id: string; snapshot: string };

private async resolverRepresentantePadrao(
  tx: NodePgDatabase<typeof schema>,
  id: string | null | undefined,
  idPersistidoAtual: string | null,
): Promise<VinculoRota | null> {
  if (id == null) return null;
  const vinculo = await tx.select({
    id: representantes.id,
    snapshot: representantes.nome,
    status: representantes.status,
  }).from(representantes)
    .where(and(eq(representantes.id, id), isNull(representantes.deletedAt)))
    .then((rows) => rows[0] ?? null);
  if (!vinculo || (vinculo.status !== 'ativo' && vinculo.id !== idPersistidoAtual)) {
    throw new BadRequestException({ codigo: 'VINCULO_CADASTRO_INVALIDO', message: 'Representante não encontrado, removido ou inativo' });
  }
  return { id: vinculo.id, snapshot: vinculo.snapshot };
}

private async resolverCaminhaoPadrao(
  tx: NodePgDatabase<typeof schema>,
  id: string | null | undefined,
  idPersistidoAtual: string | null,
): Promise<VinculoRota | null> {
  if (id == null) return null;
  const vinculo = await tx.select({
    id: frotaCaminhoes.id,
    snapshot: frotaCaminhoes.placa,
    status: frotaCaminhoes.status,
  }).from(frotaCaminhoes)
    .where(and(eq(frotaCaminhoes.id, id), isNull(frotaCaminhoes.deletedAt)))
    .then((rows) => rows[0] ?? null);
  if (!vinculo || (vinculo.status !== 'ativo' && vinculo.id !== idPersistidoAtual)) {
    throw new BadRequestException({ codigo: 'VINCULO_CADASTRO_INVALIDO', message: 'Caminhão não encontrado, removido ou inativo' });
  }
  return { id: vinculo.id, snapshot: vinculo.snapshot };
}

private async resolverMotoristaPadrao(
  tx: NodePgDatabase<typeof schema>,
  id: string | null | undefined,
  idPersistidoAtual: string | null,
): Promise<VinculoRota | null> {
  if (id == null) return null;
  const vinculo = await tx.select({
    id: frotaMotoristas.id,
    snapshot: frotaMotoristas.nome,
    status: frotaMotoristas.status,
  }).from(frotaMotoristas)
    .where(and(eq(frotaMotoristas.id, id), isNull(frotaMotoristas.deletedAt)))
    .then((rows) => rows[0] ?? null);
  if (!vinculo || (vinculo.status !== 'ativo' && vinculo.id !== idPersistidoAtual)) {
    throw new BadRequestException({ codigo: 'VINCULO_CADASTRO_INVALIDO', message: 'Motorista não encontrado, removido ou inativo' });
  }
  return { id: vinculo.id, snapshot: vinculo.snapshot };
}
```

No `criar`, antes do `insert`, executar:

```ts
const representante = await this.resolverRepresentantePadrao(tx, dto.representantePadraoId, null);
const caminhao = await this.resolverCaminhaoPadrao(tx, dto.caminhaoPadraoId, null);
const motorista = await this.resolverMotoristaPadrao(tx, dto.motoristaPadraoId, null);
```

e gravar literalmente:

```ts
representantePadraoId: representante?.id ?? null,
representantePadrao: representante?.snapshot ?? null,
caminhaoPadraoId: caminhao?.id ?? null,
caminhaoPadrao: caminhao?.snapshot ?? null,
motoristaPadraoId: motorista?.id ?? null,
motoristaPadrao: motorista?.snapshot ?? null,
```

No `atualizar`, resolver apenas campos presentes:

```ts
const representante = dto.representantePadraoId === undefined
  ? null
  : await this.resolverRepresentantePadrao(tx, dto.representantePadraoId, anterior.representantePadraoId);
const caminhao = dto.caminhaoPadraoId === undefined
  ? null
  : await this.resolverCaminhaoPadrao(tx, dto.caminhaoPadraoId, anterior.caminhaoPadraoId);
const motorista = dto.motoristaPadraoId === undefined
  ? null
  : await this.resolverMotoristaPadrao(tx, dto.motoristaPadraoId, anterior.motoristaPadraoId);
```

e gravar:

```ts
representantePadraoId: dto.representantePadraoId === undefined ? anterior.representantePadraoId : representante?.id ?? null,
representantePadrao: dto.representantePadraoId === undefined ? anterior.representantePadrao : representante?.snapshot ?? null,
caminhaoPadraoId: dto.caminhaoPadraoId === undefined ? anterior.caminhaoPadraoId : caminhao?.id ?? null,
caminhaoPadrao: dto.caminhaoPadraoId === undefined ? anterior.caminhaoPadrao : caminhao?.snapshot ?? null,
motoristaPadraoId: dto.motoristaPadraoId === undefined ? anterior.motoristaPadraoId : motorista?.id ?? null,
motoristaPadrao: dto.motoristaPadraoId === undefined ? anterior.motoristaPadrao : motorista?.snapshot ?? null,
```

Em `app/backend/src/modules/frota/caminhoes-cadastro.service.ts`:

```ts
private async resolverRotaPadrao(
  tx: NodePgDatabase<typeof schema>,
  id: string | null | undefined,
  idPersistidoAtual: string | null,
): Promise<{ id: string } | null> {
  if (id == null) return null;
  const vinculo = await tx.select({ id: rotas.id, status: rotas.status })
    .from(rotas)
    .where(and(eq(rotas.id, id), isNull(rotas.deletedAt)))
    .then((rows) => rows[0] ?? null);
  if (!vinculo || (vinculo.status !== 'ativo' && vinculo.id !== idPersistidoAtual)) {
    throw new BadRequestException({ codigo: 'VINCULO_CADASTRO_INVALIDO', message: 'Rota não encontrada, removida ou inativa' });
  }
  return { id: vinculo.id };
}
```

No `criar`: `const rota = await this.resolverRotaPadrao(tx, dto.rotaPadraoId, null);` e
`rotaPadraoId: rota?.id ?? null`. No `atualizar`:

```ts
const rota = dto.rotaPadraoId === undefined
  ? null
  : await this.resolverRotaPadrao(tx, dto.rotaPadraoId, anterior.rotaPadraoId);
// dentro de .set()
rotaPadraoId: dto.rotaPadraoId === undefined ? anterior.rotaPadraoId : rota?.id ?? null,
```

Em `app/backend/src/modules/frota/motoristas.service.ts`:

```ts
private async resolverCaminhaoPadrao(
  tx: NodePgDatabase<typeof schema>,
  id: string | null | undefined,
  idPersistidoAtual: string | null,
): Promise<{ id: string } | null> {
  if (id == null) return null;
  const vinculo = await tx.select({ id: frotaCaminhoes.id, status: frotaCaminhoes.status })
    .from(frotaCaminhoes)
    .where(and(eq(frotaCaminhoes.id, id), isNull(frotaCaminhoes.deletedAt)))
    .then((rows) => rows[0] ?? null);
  if (!vinculo || (vinculo.status !== 'ativo' && vinculo.id !== idPersistidoAtual)) {
    throw new BadRequestException({ codigo: 'VINCULO_CADASTRO_INVALIDO', message: 'Caminhão não encontrado, removido ou inativo' });
  }
  return { id: vinculo.id };
}
```

No `criar`: `const caminhao = await this.resolverCaminhaoPadrao(tx, dto.caminhaoPadraoId, null);`
e `caminhaoPadraoId: caminhao?.id ?? null`. No `atualizar`:

```ts
const caminhao = dto.caminhaoPadraoId === undefined
  ? null
  : await this.resolverCaminhaoPadrao(tx, dto.caminhaoPadraoId, anterior.caminhaoPadraoId);
// dentro de .set()
caminhaoPadraoId: dto.caminhaoPadraoId === undefined ? anterior.caminhaoPadraoId : caminhao?.id ?? null,
```

Em `app/backend/src/modules/comercial/pedidos/pedidos.service.ts`:

```ts
private async resolverRota(
  tx: NodePgDatabase<typeof schema>,
  id: string | null | undefined,
): Promise<{ id: string; nome: string } | null> {
  if (id == null) return null;
  const rota = await tx.select({ id: rotas.id, nome: rotas.nome })
    .from(rotas)
    .where(and(eq(rotas.id, id), eq(rotas.status, 'ativo'), isNull(rotas.deletedAt)))
    .then((rows) => rows[0] ?? null);
  if (!rota) {
    throw new BadRequestException({ codigo: 'ROTA_INVALIDA', message: 'Rota não encontrada, removida ou inativa' });
  }
  return rota;
}
```

Na transação de criação, antes de reserva ou INSERT:

```ts
const rota = await this.resolverRota(tx, dto.rotaId);
// no INSERT de pedidos_venda
rotaId: rota?.id ?? null,
rotaPrevista: rota?.nome ?? null,
```

Em `app/backend/src/modules/operacao/expedicao/caminhao.service.ts`:

```ts
private async resolverMotorista(
  tx: Tx,
  id: string,
): Promise<{ id: string; nome: string }> {
  const motorista = await tx.select({ id: frotaMotoristas.id, nome: frotaMotoristas.nome })
    .from(frotaMotoristas)
    .where(and(eq(frotaMotoristas.id, id), eq(frotaMotoristas.status, 'ativo'), isNull(frotaMotoristas.deletedAt)))
    .then((rows) => rows[0] ?? null);
  if (!motorista) {
    throw new BadRequestException({ codigo: 'MOTORISTA_INVALIDO', message: 'Motorista não encontrado, removido ou inativo' });
  }
  return motorista;
}

private async resolverRota(
  tx: Tx,
  id: string | null | undefined,
): Promise<{ id: string; nome: string } | null> {
  if (id == null) return null;
  const rota = await tx.select({ id: rotas.id, nome: rotas.nome })
    .from(rotas)
    .where(and(eq(rotas.id, id), eq(rotas.status, 'ativo'), isNull(rotas.deletedAt)))
    .then((rows) => rows[0] ?? null);
  if (!rota) {
    throw new BadRequestException({ codigo: 'ROTA_INVALIDA', message: 'Rota não encontrada, removida ou inativa' });
  }
  return rota;
}
```

Antes do `insert(caminhoes)`:

```ts
const motorista = await this.resolverMotorista(tx, dto.motoristaId);
const rota = await this.resolverRota(tx, dto.rotaId);
```

e no INSERT:

```ts
motoristaId: motorista.id,
motorista: motorista.nome,
rotaId: rota?.id ?? null,
rota: rota?.nome ?? null,
```

Em `app/backend/src/modules/operacao/estoque/entradas.service.ts`:

```ts
private async resolverFornecedor(
  tx: Tx,
  id: string,
): Promise<{ id: string; razaoSocial: string }> {
  const fornecedor = await tx.select({ id: fornecedores.id, razaoSocial: fornecedores.razaoSocial })
    .from(fornecedores)
    .where(and(eq(fornecedores.id, id), eq(fornecedores.status, 'ativo'), isNull(fornecedores.deletedAt)))
    .then((rows) => rows[0] ?? null);
  if (!fornecedor) {
    throw new BadRequestException({ codigo: 'FORNECEDOR_INVALIDO', message: 'Fornecedor não encontrado, removido ou inativo' });
  }
  return fornecedor;
}
```

Primeira consulta da transação de `criar`, antes da leitura do produto e antes do
`UPDATE pedidos_venda_itens`:

```ts
const fornecedor = await this.resolverFornecedor(tx, dto.fornecedorId);
```

No INSERT:

```ts
fornecedorId: fornecedor.id,
fornecedorNome: fornecedor.razaoSocial,
```

Em `app/backend/src/modules/cadastros/regras-desdobramento/regras-desdobramento.service.ts`,
`listar` deve usar este select literal; `innerJoin` torna ausência de item uma violação
observável pelo teste de contagem (`linhas.length !== total`), sem fallback:

```ts
const linhas = await this.db.select({
  id: regrasDesdobramentoComercial.id,
  itemCompraId: regrasDesdobramentoComercial.itemCompraId,
  itemComercialId: regrasDesdobramentoComercial.itemComercialId,
  fatorQuantidade: regrasDesdobramentoComercial.fatorQuantidade,
  status: regrasDesdobramentoComercial.status,
  vigenciaInicio: regrasDesdobramentoComercial.vigenciaInicio,
  vigenciaFim: regrasDesdobramentoComercial.vigenciaFim,
  observacoes: regrasDesdobramentoComercial.observacoes,
  createdAt: regrasDesdobramentoComercial.createdAt,
  updatedAt: regrasDesdobramentoComercial.updatedAt,
  deletedAt: regrasDesdobramentoComercial.deletedAt,
  itemCompraCodigo: itensCompra.codigo,
  itemCompraNome: itensCompra.descricao,
  itemComercialCodigo: itensComerciais.codigo,
  itemComercialNome: itensComerciais.descricao,
}).from(regrasDesdobramentoComercial)
  .innerJoin(itensCompra, eq(itensCompra.id, regrasDesdobramentoComercial.itemCompraId))
  .innerJoin(itensComerciais, eq(itensComerciais.id, regrasDesdobramentoComercial.itemComercialId))
  .where(where)
  .orderBy(desc(regrasDesdobramentoComercial.createdAt))
  .limit(limit)
  .offset(offset);
const total = totalRow[0]?.total ?? 0;
if (linhas.length !== Math.min(limit, Math.max(0, total - offset))) {
  throw new ConflictException({ codigo: 'REGRA_REFERENCIA_INVALIDA', message: 'Regra possui item de compra ou comercial ausente' });
}
return montarPaginado(linhas, total, query);
```

Verificação literal da Task 4:

```powershell
Set-Location D:\Projetos\AlphaCarnes\Projeto\alpha-carnes\.worktrees\o12\app\backend
npx jest test/integration/onda12-dominio-campos.e2e-spec.ts --runInBand
npm run type-check
```

Saída esperada: `PASS test/integration/onda12-dominio-campos.e2e-spec.ts`, todos os `it`
12.5–12.8 e 12.11 verdes, `Test Suites: 1 passed, 1 total`; `type-check` termina com
exit code `0`.

### E2.3 — Tasks 7–13: contratos literais de UI

Os blocos seguintes são especificação de implementação, não pseudocódigo. O Worker mantém
o JSX estrutural do protótipo e substitui apenas controles e ligações indicados.

#### Task 7 — clientes

Em `clientes-client.tsx`, manter `DadosFiscais`, `DadosContato`, `Preferencias` e `Cliente`
existentes e usar:

```ts
interface RepresentanteOpcao { id: string; codigo: string; nome: string; status: 'ativo' | 'inativo' }
interface RotaOpcao { id: string; codigo: string; nome: string; status: 'ativo' | 'inativo' }
const [representantes, setRepresentantes] = useState<RepresentanteOpcao[]>([]);
const [rotas, setRotas] = useState<RotaOpcao[]>([]);
// estados form, erro, salvando e abaAtiva permanecem os já existentes
```

No carregamento:

```ts
const [resRepresentantes, resRotas] = await Promise.all([
  fetch('/api/cadastros/representantes?pageSize=100&status=ativo', { cache: 'no-store' }),
  fetch('/api/cadastros/rotas?pageSize=100&status=ativo', { cache: 'no-store' }),
]);
if (!resRepresentantes.ok) throw new Error(await mensagemDeErro(resRepresentantes, 'Erro ao carregar representantes'));
if (!resRotas.ok) throw new Error(await mensagemDeErro(resRotas, 'Erro ao carregar rotas'));
setRepresentantes(((await resRepresentantes.json()) as { data: RepresentanteOpcao[] }).data);
setRotas(((await resRotas.json()) as { data: RotaOpcao[] }).data);
```

Payload de salvar:

```ts
const payload = {
  razaoSocial: form.razaoSocial,
  nomeFantasia: form.nomeFantasia || undefined,
  documentoFiscal: form.documentoFiscal,
  representanteId: form.representanteId || null,
  rotaId: form.rotaId || null,
  prioridade: form.prioridade || undefined,
  dadosFiscaisJson: {
    ...form.dadosFiscaisJson,
    uf: form.dadosFiscaisJson.uf || undefined,
  },
  dadosContatoJson: form.dadosContatoJson,
  preferenciasJson: form.preferenciasJson,
  observacoesOperacionais: form.observacoesOperacionais || undefined,
  status: form.status,
};
const response = await fetch(url, {
  method: novo ? 'POST' : 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
if (!response.ok) {
  const { mensagem, porCampo } = await detalharErro(response, 'Falha ao salvar cliente');
  setErro(mensagem);
  setErros(porCampo);
  return;
}
```

`ComboboxField.items` é
`{ id, label: `${codigo} — ${nome}` }`; UF usa `UFS_BRASIL`; representante/rota usam
`clearable`. `next.config.ts` recebe exatamente o redirect de D12.1 e
`cadastros-config.ts` não contém chave `clientes`.

Verificação:

```powershell
Set-Location D:\Projetos\AlphaCarnes\Projeto\alpha-carnes\.worktrees\o12\app\frontend
npx jest __tests__/next-config-rotas.test.ts src/lib/__tests__/cadastros-config.test.ts __tests__/onda4-clientes.test.tsx __tests__/terminologia.test.ts --runInBand
npx playwright test e2e/onda12-dominio-campos-ui.spec.ts --grep "DoD 12.1|DoD 12.9|DoD 12.10"
if (rg -n --glob "*.tsx" "(label|placeholder|searchPlaceholder)=[\"'][^\"']*\\bMarca\\b" src) { throw "Marca isolada encontrada" }
```

Saída esperada: quatro suites Jest `PASS`, Playwright `3 passed`, comando `rg` sem
match e script com exit code `0`.

#### Task 8 — produto, itens e fornecedor

Produto e cadastros genéricos usam literalmente:

```ts
export type UnidadeMedida = 'kg' | 'unidade';
const [unidadePedido, setUnidadePedido] = useState<UnidadeMedida>('unidade');
const unidadeOptions = [
  { valor: 'kg', rotulo: 'kg' },
  { valor: 'unidade', rotulo: 'Unidade' },
];
```

Nos payloads de produto, item de compra e item comercial, os campos são,
respectivamente, `unidadePedido`, `unidadeCompra` e `unidadeComercial`, sem transformação.
O helper de mutação do formulário genérico deve ser:

```ts
const res = await fetch(endpoint, {
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
if (!res.ok) throw new Error(await mensagemDeErro(res, 'Falha ao salvar cadastro'));
```

Fornecedor usa:

```ts
interface ParametrosFornecedorForm {
  romaneioAntecipado: boolean;
  horarioLimiteRecebimento: string;
  capacidadeMaximaKg: string;
  toleranciaDivergenciaPercentual: string;
  notaQualidade: '' | 'A' | 'B' | 'C';
}
const [parametros, setParametros] = useState<ParametrosFornecedorForm>({
  romaneioAntecipado: false,
  horarioLimiteRecebimento: '',
  capacidadeMaximaKg: '',
  toleranciaDivergenciaPercentual: '',
  notaQualidade: '',
});
const parametrosOperacionaisJson = {
  romaneioAntecipado: parametros.romaneioAntecipado,
  ...(parametros.horarioLimiteRecebimento ? { horarioLimiteRecebimento: parametros.horarioLimiteRecebimento } : {}),
  ...(parametros.capacidadeMaximaKg === '' ? {} : { capacidadeMaximaKg: Number(parametros.capacidadeMaximaKg) }),
  ...(parametros.toleranciaDivergenciaPercentual === '' ? {} : { toleranciaDivergenciaPercentual: Number(parametros.toleranciaDivergenciaPercentual) }),
  ...(parametros.notaQualidade ? { notaQualidade: parametros.notaQualidade } : {}),
};
const payload = { ...dadosBasicosFornecedor, parametrosOperacionaisJson };
const res = await fetch(url, {
  method: editando ? 'PATCH' : 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
if (!res.ok) {
  setErro(await mensagemDeErro(res, 'Falha ao salvar fornecedor'));
  return;
}
```

Verificação:

```powershell
Set-Location D:\Projetos\AlphaCarnes\Projeto\alpha-carnes\.worktrees\o12\app\frontend
npx jest __tests__/produtos-client.test.tsx __tests__/cadastro-form.test.tsx src/lib/__tests__/cadastros-config.test.ts --runInBand
npx playwright test e2e/onda12-dominio-campos-ui.spec.ts --grep "DoD 12.2|DoD 12.12"
if (rg -n "tipo:\\s*'texto'.*unidade(Pedido|Compra|Comercial)" src/lib/cadastros-config.ts) { throw "Unidade livre encontrada" }
```

Saída esperada: três suites Jest `PASS`, Playwright `2 passed`, `rg` sem match e exit
code `0`.

#### Task 9 — rotas, caminhões e motoristas

`rotas.ts`:

```ts
export interface Rota {
  id: string; codigo: string; nome: string; regiao: string | null;
  representantePadraoId: string | null; representantePadrao: string | null;
  caminhaoPadraoId: string | null; caminhaoPadrao: string | null;
  motoristaPadraoId: string | null; motoristaPadrao: string | null;
  observacoes: string | null; status: StatusCadastro;
  paradas: ParadaRota[]; diasAtendimento: string[];
  createdAt: string; updatedAt: string; deletedAt: string | null;
}
export interface CriarRotaDto {
  codigo: string; nome: string; regiao?: string;
  representantePadraoId?: string | null;
  caminhaoPadraoId?: string | null;
  motoristaPadraoId?: string | null;
  observacoes?: string; status?: StatusCadastro;
  paradas: ParadaRota[]; diasAtendimento: string[];
}
```

`rotas-client.tsx`:

```ts
interface RepresentanteOpcao { id: string; codigo: string; nome: string; status: 'ativo' | 'inativo' }
interface CaminhaoOpcao { id: string; placa: string; descricao: string | null; status: 'ativo' | 'inativo' }
interface MotoristaOpcao { id: string; nome: string; documento: string; status: 'ativo' | 'inativo' }
const [representantes, setRepresentantes] = useState<RepresentanteOpcao[]>([]);
const [caminhoes, setCaminhoes] = useState<CaminhaoOpcao[]>([]);
const [motoristas, setMotoristas] = useState<MotoristaOpcao[]>([]);
const FORM_VAZIO: FormRota = {
  codigo: '', nome: '', regiao: '', representantePadraoId: '',
  caminhaoPadraoId: '', motoristaPadraoId: '', observacoes: '',
  status: 'ativo', paradas: [], diasAtendimento: [],
};
const payload: CriarRotaDto = {
  codigo: form.codigo.trim(), nome: form.nome.trim(),
  regiao: form.regiao?.trim() || undefined,
  representantePadraoId: form.representantePadraoId || null,
  caminhaoPadraoId: form.caminhaoPadraoId || null,
  motoristaPadraoId: form.motoristaPadraoId || null,
  observacoes: form.observacoes?.trim() || undefined,
  status: form.status, paradas: form.paradas, diasAtendimento: form.diasAtendimento,
};
const res = await fetch(form.id ? `/api/cadastros/rotas/${form.id}` : '/api/cadastros/rotas', {
  method: form.id ? 'PATCH' : 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
if (!res.ok) {
  const { mensagem, porCampo } = await detalharErro(res, 'Falha ao salvar rota');
  setErro(mensagem); setErros(porCampo); return;
}
```

O loader usa `Promise.all` nos endpoints ativos e cada `Response` tem `if (!res.ok) throw
new Error(await mensagemDeErro(...))`. Edição acrescenta somente o vínculo atual ausente
da lista, com `status: 'inativo'`; options são `codigo — nome`, placa/descrição e
nome/documento, com `(inativo)`.

`caminhoes-client.tsx` mantém `Caminhao` e usa:

```ts
interface RotaOpcao { id: string; codigo: string; nome: string; status: 'ativo' | 'inativo' }
const [rotas, setRotas] = useState<RotaOpcao[]>([]);
const payload = {
  ...camposExistentes,
  rotaPadraoId: (f.rotaPadraoId ?? '').trim() || null,
  certificadoUf: (f.certificadoUf ?? '').trim() || undefined,
};
// CadastroTabelaDrawer já executa fetch; seu caminho de erro obrigatório é:
if (!res.ok) throw new Error(await mensagemDeErro(res, `Falha ao salvar ${substantivoSingular}`));
```

`motoristas-client.tsx` mantém `Motorista` e usa:

```ts
const [caminhoes, setCaminhoes] = useState<Caminhao[]>([]);
const payload = {
  ...camposExistentes,
  caminhaoPadraoId: (f.caminhaoPadraoId ?? '').trim() || null,
};
if (!res.ok) throw new Error(await mensagemDeErro(res, 'Falha ao salvar motorista'));
```

Verificação:

```powershell
Set-Location D:\Projetos\AlphaCarnes\Projeto\alpha-carnes\.worktrees\o12\app\frontend
npx jest __tests__/rotas-paradas.test.tsx __tests__/cadastro-tabela-drawer.test.tsx __tests__/dominios.test.ts --runInBand
npx playwright test e2e/onda12-dominio-campos-ui.spec.ts --grep "DoD 12.6|DoD 12.9"
if (rg -n "(representantePadrao|caminhaoPadrao|motoristaPadrao):\\s*form\\." src/app/\(admin\)/cadastros/rotas/rotas-client.tsx) { throw "Snapshot enviado pela UI" }
```

Saída esperada: três suites Jest `PASS`, Playwright `2 passed`, `rg` sem match e exit
code `0`.

#### Task 10 — pedido, compras e espelho

`comercial.ts` altera `PedidoVenda`/`CriarPedidoDto` para `rotaId`:

```ts
export interface PedidoVenda {
  id: string; compraProgramadaId: string; clienteId: string;
  operacaoId?: string; dataOperacao?: string; dataEntrega: string | null;
  rotaId: string | null; rotaPrevista: string | null; prioridade: number | null;
  status: string; observacoesGerais: string | null; createdAt: string;
}
export interface CriarPedidoDto {
  compraProgramadaId: string; clienteId: string; dataOperacao: string;
  dataEntrega?: string; rotaId?: string | null; prioridade?: number;
  observacoesGerais?: string; salvarComoRascunho?: boolean;
  itens: Array<{ itemComercialId: string; quantidadePedida: number; observacoes?: string }>;
}
```

`pedido-editor.tsx`:

```ts
export interface ClientePedido {
  id: string; codigo: string; razaoSocial: string; nomeFantasia?: string | null;
  representanteId?: string | null; rotaId?: string | null;
}
export interface ProdutoPedido { id: string; codigo: string; descricao: string; status: string }
export interface RotaPedido { id: string; codigo: string; nome: string; status: string }
const [rotaId, setRotaId] = useState(pedido?.rotaId ?? pedido?.heranca?.rotaId ?? '');
const [produtoNovo, setProdutoNovo] = useState('');
const payload: CriarPedidoDto = {
  compraProgramadaId, clienteId, dataOperacao,
  dataEntrega: pedido?.dataEntrega ?? undefined,
  rotaId: rotaId || null,
  prioridade: Number(prioridade),
  observacoesGerais: observacoes.trim() || undefined,
  salvarComoRascunho,
  itens: itensNovos,
};
const response = await fetch('/api/comercial/pedidos', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
});
if (!response.ok) {
  setErro((await corpoDeErro(response)).texto);
  return;
}
```

Ao trocar cliente: `setRotaId(cliente?.rotaId ?? '')`. Produto e rota usam
`ComboboxField` com `codigo — descricao` e `codigo — nome`.

`compras-client.tsx` mantém `LinhaItem` e `CriarCompraProgramadaDto`; substitui apenas o
select do item:

```ts
interface CadastroItem { id: string; codigo: string; descricao?: string; nome?: string; razaoSocial?: string }
const [itensCompra, setItensCompra] = useState<CadastroItem[]>([]);
const payload: CriarCompraProgramadaDto = {
  dataOperacao, fornecedorId,
  referenciaExterna: referenciaExterna || undefined,
  observacoes: observacoes || undefined,
  itens: linhas.filter((l) => l.itemCompraId && Number(l.quantidadeComprada) > 0).map((l) => ({
    itemCompraId: l.itemCompraId,
    quantidadeComprada: Number(l.quantidadeComprada),
    observacoes: l.observacoes || undefined,
  })),
};
const res = await fetch('/api/comercial/compras-programadas', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
if (!res.ok) { setErro(await mensagemDeErro(res, 'Erro ao salvar compra')); return; }
```

`espelho-client.tsx`:

```ts
interface RepresentanteResumo { id: string; codigo: string; nome: string }
interface RotaResumo { id: string; codigo: string; nome: string }
const [representanteId, setRepresentanteId] = useState('');
const [rotaId, setRotaId] = useState('');
const response = await fetch(`/api/comercial/espelho?${query.toString()}`, { cache: 'no-store' });
if (!response.ok) {
  setErro(await mensagemDeErro(response, 'Falha ao carregar o espelho.'));
  return;
}
setEspelho((await response.json()) as EspelhoResposta);
```

Filtros usam `ComboboxField clearable`, vazio significa “Todos”, labels `codigo — nome`.

Verificação:

```powershell
Set-Location D:\Projetos\AlphaCarnes\Projeto\alpha-carnes\.worktrees\o12\app\frontend
npx jest __tests__/onda4-pedidos.test.tsx __tests__/compras-client.test.tsx __tests__/onda4-espelho.test.tsx --runInBand
npx playwright test e2e/onda12-dominio-campos-ui.spec.ts --grep "DoD 12.4|DoD 12.5"
if (rg -n "rotaPrevista\\s*:" src/app/\(admin\)/comercial/pedidos/pedido-editor.tsx) { throw "rotaPrevista enviado" }
Set-Location ..\backend
npx jest test/unit/pedidos.service.spec.ts test/unit/pedidos-branches.spec.ts test/unit/compras-programadas-branches.spec.ts test/unit/impacto-compra.spec.ts --runInBand
```

Saída esperada: três suites Jest de frontend `PASS`, Playwright `2 passed`, `rg` sem
match e exit code `0`, quatro suites Jest de backend `PASS`.

#### Task 11 — carga e entrada

`operacao.ts`:

```ts
export interface Caminhao {
  id: string; placa: string; motoristaId: string | null; motorista: string;
  rotaId: string | null; rota: string | null; dataOperacao: string;
  frotaCaminhaoId: string | null; capacidadeKg: number | null;
  statusCaminhao: StatusCaminhao; horaAberturaCarga: string | null;
  horaFechamentoCarga: string | null; observacoes: string | null; createdAt: string;
}
```

`planejamento-client.tsx`:

```ts
interface FrotaCaminhaoOpcao {
  id: string; placa: string; descricao: string | null; capacidadeKg: number;
  rotaPadraoId: string | null; status: 'ativo' | 'inativo';
}
interface MotoristaOpcao {
  id: string; nome: string; documento: string; caminhaoPadraoId: string | null;
  status: 'ativo' | 'inativo';
}
interface RotaOpcao { id: string; codigo: string; nome: string; status: 'ativo' | 'inativo' }
interface NovoCaminhaoForm {
  frotaCaminhaoId: string; placa: string; motoristaId: string; rotaId: string;
}
const [motoristas, setMotoristas] = useState<MotoristaOpcao[]>([]);
const [rotas, setRotas] = useState<RotaOpcao[]>([]);
const [novoCaminhao, setNovoCaminhao] = useState<NovoCaminhaoForm>({
  frotaCaminhaoId: '', placa: '', motoristaId: '', rotaId: '',
});
const candidatos = motoristas.filter((m) => m.caminhaoPadraoId === frotaId);
setNovoCaminhao((atual) => ({
  ...atual,
  frotaCaminhaoId: frotaId,
  motoristaId: candidatos.length === 1 ? candidatos[0]!.id : '',
  rotaId: frotaOpcoes.find((f) => f.id === frotaId)?.rotaPadraoId ?? '',
}));
const payload = {
  frotaCaminhaoId: novoCaminhao.frotaCaminhaoId || null,
  placa: novoCaminhao.frotaCaminhaoId ? undefined : novoCaminhao.placa.trim(),
  motoristaId: novoCaminhao.motoristaId,
  rotaId: novoCaminhao.rotaId || null,
  dataOperacao,
};
const res = await fetch('/api/operacao/expedicao/caminhoes', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
if (!res.ok) { setErro(await mensagemDeErro(res, 'Falha ao criar caminhão')); return; }
```

O `Promise.all` inclui caminhões operacionais, pedidos, clientes, frota ativa, motoristas
ativos e rotas ativas. Para cada uma das seis responses: `if (!res.ok) { setErro(await
mensagemDeErro(res, 'Falha ao carregar dados')); return; }`.

`estoque.ts` e `entrada-itens-client.tsx`:

```ts
export interface FornecedorOpcao {
  id: string; codigo: string; razaoSocial: string; status: 'ativo' | 'inativo';
}
export interface CriarEntradaPayload {
  produtoId: string; quantidade: number; unidade: 'caixa' | 'unidade';
  fornecedorId: string; loteNf?: string; local?: string;
  destino: 'estoque' | 'pedido'; pedidoVendaItemId?: string; observacao?: string;
}
const [fornecedores, setFornecedores] = useState<FornecedorOpcao[]>([]);
const [fornecedorId, setFornecedorId] = useState('');
const payload: CriarEntradaPayload = {
  produtoId, quantidade: qtdNumerica, unidade, fornecedorId,
  loteNf: loteNf.trim() || undefined, local, destino,
  pedidoVendaItemId: destino === 'pedido' ? pedidoSelecionado?.pedidoVendaItemId ?? null : null,
  observacao: observacao.trim() || undefined,
};
const res = await fetch('/api/operacao/estoque/entradas', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
if (!res.ok) throw new Error(await mensagemDeErro(res, 'Falha ao registrar entrada'));
```

Loader de fornecedor:

```ts
const res = await fetch('/api/cadastros/fornecedores?page=1&pageSize=100&status=ativo', { cache: 'no-store' });
if (!res.ok) { setErro(await mensagemDeErro(res, 'Falha ao carregar fornecedores')); return; }
setFornecedores(((await res.json()) as { data: FornecedorOpcao[] }).data);
```

Verificação:

```powershell
Set-Location D:\Projetos\AlphaCarnes\Projeto\alpha-carnes\.worktrees\o12\app\frontend
npx jest __tests__/carga-planejamento.test.tsx __tests__/entrada-itens.test.tsx --runInBand
npx playwright test e2e/onda12-dominio-campos-ui.spec.ts --grep "DoD 12.7|DoD 12.8"
if (rg -n "(motorista|rota|fornecedorNome)\\s*:" src/app/\(admin\)/carga/planejamento/planejamento-client.tsx src/app/\(admin\)/estoque/entrada-itens/entrada-itens-client.tsx) { throw "Snapshot enviado" }
```

Saída esperada: duas suites Jest `PASS`, Playwright `2 passed`, `rg` sem match e exit
code `0`.

#### Task 12 — pré-faturamento, auditoria e etiquetas

`pre-faturamento-client.tsx` mantém `Caminhao` de `operacao.ts` e estados:

```ts
const [caminhaoId, setCaminhaoId] = useState('');
const [caminhoesDia, setCaminhoesDia] = useState<Caminhao[]>([]);
const [consolidacao, setConsolidacao] = useState<ConsolidacaoResposta | null>(null);
const [erro, setErro] = useState<string | null>(null);
const res = await fetch(`/api/operacao/expedicao/caminhoes?dataOperacao=${encodeURIComponent(hoje)}`);
if (!res.ok) { setErro(await mensagemDeErro(res, 'Falha ao carregar caminhões')); setCaminhoesDia([]); return; }
setCaminhoesDia((await res.json()) as Caminhao[]);
const consolidacaoRes = await fetch(`/api/operacao/faturamento/caminhoes/${caminhaoId}/consolidacao`, { cache: 'no-store' });
if (!consolidacaoRes.ok) { setErro(await mensagemDeErro(consolidacaoRes, 'Falha ao consolidar')); return; }
setConsolidacao((await consolidacaoRes.json()) as ConsolidacaoResposta);
```

`ComboboxField` recebe todos `caminhoesDia`, `label: placa`,
`sublabel: `${motorista} — ${statusCaminhao}``; não existe formulário manual.

`auditoria-client.tsx`:

```ts
interface UsuarioAuditoriaOpcao { id: string; nome: string; email: string }
const [usuarios, setUsuarios] = useState<UsuarioAuditoriaOpcao[]>([]);
const [filtros, setFiltros] = useState<FiltrosAuditoria>({ page: 1, pageSize: 20 });
const resUsuarios = await fetch('/api/usuarios?page=1&pageSize=100&status=ativo', { cache: 'no-store' });
if (!resUsuarios.ok) { setErro(await mensagemDeErro(resUsuarios, 'Falha ao carregar usuários')); return; }
setUsuarios(((await resUsuarios.json()) as { data: UsuarioAuditoriaOpcao[] }).data);
const res = await fetch(`/api/admin/auditoria?${params.toString()}`);
if (!res.ok) { setErro(await mensagemDeErro(res)); return; }
setResultado((await res.json()) as PaginadoAuditoria);
```

`ComboboxField clearable` usa `label: nome`, `sublabel: email`; `onChange` grava
`usuarioId: id || undefined`.

`operacao.ts` amplia `RecebimentoResumo`:

```ts
export interface RecebimentoResumo {
  id: string; compraProgramadaId: string; dataOperacao: string; status: string;
  codigoLote?: string; fornecedorNome: string; progressoBalanca?: number;
}
```

`etiquetas-client.tsx`:

```ts
const [recebimentos, setRecebimentos] = useState<RecebimentoResumo[]>([]);
const [recebimentoId, setRecebimentoId] = useState('');
const res = await fetch('/api/operacao/recebimentos?pageSize=30', { cache: 'no-store' });
if (!res.ok) { setErro(await mensagemDeErro(res, 'Erro ao carregar recebimentos')); return; }
const pag = (await res.json()) as PaginadoRecebimento;
setRecebimentos(pag.data);
if (pag.data[0] && !recebimentoId) setRecebimentoId(pag.data[0].id);
```

Combobox: `label: `#${codigoLote} — ${fornecedorNome}``, `sublabel: status`.

Verificação:

```powershell
Set-Location D:\Projetos\AlphaCarnes\Projeto\alpha-carnes\.worktrees\o12\app\frontend
npx jest __tests__/pre-faturamento.test.tsx __tests__/auditoria-filtros.test.tsx __tests__/etiquetas-recebimento.test.tsx --runInBand
npx playwright test e2e/onda12-dominio-campos-ui.spec.ts --grep "DoD 12.3|DoD 12.4"
if (rg -n "(UUID do caminhão|ID do Caminhão|id\\.slice\\(0, 8\\))" src/app/\(admin\)/faturamento/pre-faturamento src/app/\(admin\)/recebimento/etiquetas) { throw "UUID visível encontrado" }
```

Saída esperada: três suites Jest `PASS`, Playwright `2 passed`, `rg` sem match e exit
code `0`.

#### Task 13 — regra de desdobramento

`regras-transformacao-client.tsx`:

```ts
interface RegraDesdobramento {
  id: string; itemCompraId: string; itemComercialId: string;
  fatorQuantidade: string; status: 'ativo' | 'inativo';
  vigenciaInicio: string; vigenciaFim: string | null; observacoes: string | null;
  itemCompraCodigo: string; itemCompraNome: string;
  itemComercialCodigo: string; itemComercialNome: string;
}
interface ItemCompraOpcao { id: string; codigo: string; descricao: string }
interface ItemComercialOpcao { id: string; codigo: string; descricao: string }
interface NovaRegraForm {
  itemCompraId: string; itemComercialId: string; fator: string;
  vigenciaInicio: string; vigenciaFim: string;
  status: 'ativo' | 'inativo'; observacoes: string;
}
const [dialogAberto, setDialogAberto] = useState(false);
const [itensCompra, setItensCompra] = useState<ItemCompraOpcao[]>([]);
const [itensComerciais, setItensComerciais] = useState<ItemComercialOpcao[]>([]);
const [formRegra, setFormRegra] = useState<NovaRegraForm>({
  itemCompraId: '', itemComercialId: '', fator: '1.000',
  vigenciaInicio: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()),
  vigenciaFim: '', status: 'ativo', observacoes: '',
});
const [salvandoRegra, setSalvandoRegra] = useState(false);
const [erroRegra, setErroRegra] = useState<string | null>(null);
const payload = {
  itemCompraId: formRegra.itemCompraId,
  itemComercialId: formRegra.itemComercialId,
  fatorQuantidade: Number(formRegra.fator),
  vigenciaInicio: formRegra.vigenciaInicio,
  ...(formRegra.vigenciaFim ? { vigenciaFim: formRegra.vigenciaFim } : {}),
  status: formRegra.status,
  ...(formRegra.observacoes.trim() ? { observacoes: formRegra.observacoes.trim() } : {}),
};
const res = await fetch('/api/cadastros/regras-desdobramento', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
if (!res.ok) {
  setErroRegra(await mensagemDeErro(res, 'Falha ao criar regra'));
  return;
}
setDialogAberto(false);
setFormRegra({
  itemCompraId: '', itemComercialId: '', fator: '1.000',
  vigenciaInicio: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()),
  vigenciaFim: '', status: 'ativo', observacoes: '',
});
await carregar();
```

Loader dos dois catálogos:

```ts
const [compraRes, comercialRes] = await Promise.all([
  fetch('/api/cadastros/itens-compra?pageSize=100&status=ativo', { cache: 'no-store' }),
  fetch('/api/cadastros/itens-comerciais?pageSize=100&status=ativo', { cache: 'no-store' }),
]);
if (!compraRes.ok) { setErroRegra(await mensagemDeErro(compraRes, 'Falha ao carregar itens de compra')); return; }
if (!comercialRes.ok) { setErroRegra(await mensagemDeErro(comercialRes, 'Falha ao carregar itens comerciais')); return; }
setItensCompra(((await compraRes.json()) as { data: ItemCompraOpcao[] }).data);
setItensComerciais(((await comercialRes.json()) as { data: ItemComercialOpcao[] }).data);
```

Ambos os botões executam `setDialogAberto(true)`. Os dois comboboxes usam
`codigo — descricao`. A grid renderiza somente `itemCompraCodigo — itemCompraNome` e
`itemComercialCodigo — itemComercialNome`. `Trash2` e botão de remoção não são importados
nem renderizados.

Verificação:

```powershell
Set-Location D:\Projetos\AlphaCarnes\Projeto\alpha-carnes\.worktrees\o12\app\frontend
npx jest __tests__/simuladores-transformacao.test.tsx --runInBand
npx playwright test e2e/onda12-dominio-campos-ui.spec.ts --grep "DoD 12.11"
if (rg -n "(itemCompraId\\.slice|itemComercialId\\.slice|Trash2)" src/app/\(admin\)/cadastros/regras-transformacao/regras-transformacao-client.tsx) { throw "Fallback UUID ou ação inerte encontrada" }
Set-Location ..\backend
npx jest test/unit/seed-regras-desdobramento-comercial.spec.ts test/unit/seed-regras-transformacao-tz.spec.ts --runInBand
```

Saída esperada: suite Jest de frontend `PASS`, Playwright `1 passed`, `rg` sem match e
exit code `0`, duas suites Jest de backend `PASS`.

**Estado da Emenda 2:** `ok`. Os quatro achados do Portão 1 estão fechados sem escolha
de produto ou desenho de componente deixado ao Worker.

## Emenda 3 — Portão 1 (`ajustar`)

Esta emenda responde ao Portão 1 de `2026-08-30`, emitido sobre o plano de SHA-256
`6f7dc4c0afbfa95fcc8a063c63cb12b21c18d66eaea8f0929338486352293273`. A leitura de
`origin/develop` confirmou que `listarQuerySchema` não declara `status`, enquanto
`listarCadastroQuerySchema` já declara `status: z.enum(['ativo', 'inativo']).optional()`.
Rotas, produtos, fornecedores, itens de compra e itens comerciais usam hoje o primeiro
schema nos controllers e não acrescentam `status` ao `WHERE` dos services. Em caso de
conflito, esta seção prevalece sobre as restrições globais e sobre as Tasks 3, 4 e 7–13.
Não são reabertos AD-13/`Nome Fantasia/Marca`, SAM-166, migrations `0031–0033` nem
qualquer outro fechamento das Emendas 1–2.

### E3.1 — Catálogos de criação aceitam e honram `status=ativo`

Não criar query param novo e não filtrar arrays no frontend. O contrato existente
`listarCadastroQuerySchema` é a única fonte do filtro. Nos cinco controllers abaixo,
substituir o import, o pipe e o tipo literalmente:

```ts
import {
  listarCadastroQuerySchema,
  type ListarCadastroQuery,
} from '../../../common/crud/paginacao';

// RotasController
async listar(@Query(new ZodValidationPipe(listarCadastroQuerySchema)) query: ListarCadastroQuery) {
  return this.rotasService.listar(query);
}

// ProdutosController
async listar(@Query(new ZodValidationPipe(listarCadastroQuerySchema)) query: ListarCadastroQuery) {
  return this.produtosService.listar(query);
}

// FornecedoresController
async listar(@Query(new ZodValidationPipe(listarCadastroQuerySchema)) query: ListarCadastroQuery) {
  return this.fornecedoresService.listar(query);
}

// ItensCompraController
async listar(@Query(new ZodValidationPipe(listarCadastroQuerySchema)) query: ListarCadastroQuery) {
  return this.itensCompraService.listar(query);
}

// ItensComerciaisController
async listar(@Query(new ZodValidationPipe(listarCadastroQuerySchema)) query: ListarCadastroQuery) {
  return this.itensComerciaisService.listar(query);
}
```

Aplicar o bloco em:

- `app/backend/src/modules/cadastros/rotas/rotas.controller.ts`;
- `app/backend/src/modules/cadastros/produtos/produtos.controller.ts`;
- `app/backend/src/modules/cadastros/fornecedores/fornecedores.controller.ts`;
- `app/backend/src/modules/cadastros/itens-compra/itens-compra.controller.ts`;
- `app/backend/src/modules/cadastros/itens-comerciais/itens-comerciais.controller.ts`.

Em cada service correspondente, trocar o tipo de `listar` para
`ListarCadastroQuery`, importar esse tipo de `common/crud/paginacao` e acrescentar
imediatamente após a inicialização de `filtros`:

```ts
// rotas.service.ts
if (query.status) filtros.push(eq(rotas.status, query.status));

// produtos.service.ts
if (query.status) filtros.push(eq(produtos.status, query.status));

// fornecedores.service.ts
if (query.status) filtros.push(eq(fornecedores.status, query.status));

// itens-compra.service.ts
if (query.status) filtros.push(eq(itensCompra.status, query.status));

// itens-comerciais.service.ts
if (query.status) filtros.push(eq(itensComerciais.status, query.status));
```

As queries de `linhas` e `count(*)` continuam compartilhando o mesmo `where`; portanto,
`total` também exclui inativos quando `status=ativo`. `incluirRemovidos` continua
independente: `status=ativo` não autoriza registro removido sem
`incluirRemovidos=true`.

Os loaders de criação das Tasks 7–13 usam obrigatoriamente estas URLs literais:

```ts
const catalogosAtivos = {
  rotas: '/api/cadastros/rotas?page=1&pageSize=100&status=ativo',
  produtos: '/api/cadastros/produtos?page=1&pageSize=100&status=ativo',
  fornecedores: '/api/cadastros/fornecedores?page=1&pageSize=100&status=ativo',
  itensCompra: '/api/cadastros/itens-compra?page=1&pageSize=100&status=ativo',
  itensComerciais: '/api/cadastros/itens-comerciais?page=1&pageSize=100&status=ativo',
} as const;
```

Representantes, frota e motoristas mantêm seus endpoints já capazes de honrar
`status=ativo`; a Task 9 usa o mesmo parâmetro. Edição continua anexando somente o vínculo
inativo atual retornado pelo registro editado, com `(inativo)`, conforme regra já fechada.
Nenhum loader geral passa a buscar todos os inativos.

Adicionar em `app/backend/test/integration/onda12-dominio-campos.e2e-spec.ts` o teste
parametrizado `DoD 12.4a catálogos de criação excluem inativos`, com fixtures ativa e
inativa para cada um dos cinco recursos. A asserção literal por caso é:

```ts
const response = await request(app.getHttpServer())
  .get(`${caso.endpoint}?page=1&pageSize=100&status=ativo&search=${caso.buscaUnica}`)
  .set('Authorization', `Bearer ${token}`)
  .expect(200);

const ids = (response.body.data as Array<{ id: string }>).map(({ id }) => id);
expect(ids).toContain(caso.ativoId);
expect(ids).not.toContain(caso.inativoId);
expect(response.body.total).toBe(1);
```

Adicionar também em `app/frontend/e2e/onda12-dominio-campos-ui.spec.ts` o cenário
`DoD 12.4b criação nunca oferece cadastro inativo`: criar via API uma rota, um produto,
um fornecedor, um item de compra e um item comercial com `status: 'inativo'`; abrir,
respectivamente, criação de cliente/pedido, entrada de estoque, compra e regra de
desdobramento; abrir cada combobox e executar a asserção literal:

```ts
await expect(page.getByRole('option', { name: labelInativo, exact: true })).toHaveCount(0);
```

O mesmo cenário cria uma fixture ativa por catálogo e exige:

```ts
await expect(page.getByRole('option', { name: labelAtivo, exact: true })).toBeVisible();
```

Esse par de testes falha se o query param voltar a ser descartado, se o service deixar de
filtrar ou se um inativo aparecer em qualquer fluxo de criação da onda.

### E3.2 — Limpeza de FK opcional usa somente JSON `null`

A única representação de limpeza de FK opcional é `null`. No estado visual,
`ComboboxField` continua emitindo `''`; na serialização de mutação, `''` vira `null` e a
chave é enviada. `undefined`/chave omitida significa exclusivamente “não alterar” em PATCH
e nunca representa limpeza. Filtros de consulta, como `usuarioId` da auditoria, não são
FKs persistidas por mutação e continuam omitidos quando vazios.

Todos os schemas Zod de FKs opcionais tocadas usam o contrato literal:

```ts
const fkOpcionalSchema = z.string().uuid().nullable().optional();
```

Aplicar `fkOpcionalSchema` a `representanteId` e `rotaId` de cliente;
`representantePadraoId`, `caminhaoPadraoId` e `motoristaPadraoId` de rota;
`rotaPadraoId` de caminhão cadastral; `caminhaoPadraoId` de motorista;
`rotaId` de pedido; `frotaCaminhaoId` e `rotaId` do caminhão operacional; e
`pedidoVendaItemId` da entrada de estoque. FKs obrigatórias — inclusive `motoristaId`,
`fornecedorId`, `produtoId`, `itemCompraId` e `itemComercialId` — permanecem
`z.string().uuid()` e nunca recebem `null`.

Os tipos frontend correspondentes usam `campo?: string | null`. Os payloads literais das
Tasks 7–13 ficam fechados assim:

```ts
// Task 7 — cliente
representanteId: form.representanteId || null,
rotaId: form.rotaId || null,

// Task 9 — rota
representantePadraoId: form.representantePadraoId || null,
caminhaoPadraoId: form.caminhaoPadraoId || null,
motoristaPadraoId: form.motoristaPadraoId || null,

// Task 9 — caminhão cadastral
rotaPadraoId: (f.rotaPadraoId ?? '').trim() || null,

// Task 9 — motorista
caminhaoPadraoId: (f.caminhaoPadraoId ?? '').trim() || null,

// Task 10 — pedido
rotaId: rotaId || null,

// Task 11 — caminhão operacional
frotaCaminhaoId: novoCaminhao.frotaCaminhaoId || null,
rotaId: novoCaminhao.rotaId || null,

// Task 11 — entrada de estoque
pedidoVendaItemId:
  destino === 'pedido' ? pedidoSelecionado?.pedidoVendaItemId ?? null : null,
```

Tasks 8, 12 e 13 não têm limpeza de FK persistida em seus payloads. Não converter
`vigenciaFim`, campos escalares opcionais nem filtros GET para esta regra.

Nos services de atualização, preservar a distinção já especificada:

```ts
const representante = dto.representantePadraoId === undefined
  ? null
  : await this.resolverRepresentantePadrao(
      tx,
      dto.representantePadraoId,
      anterior.representantePadraoId,
    );

const patch = {
  representantePadraoId:
    dto.representantePadraoId === undefined
      ? anterior.representantePadraoId
      : representante?.id ?? null,
  representantePadrao:
    dto.representantePadraoId === undefined
      ? anterior.representantePadrao
      : representante?.snapshot ?? null,
};
```

Para `representantePadraoId`, `caminhaoPadraoId`, `motoristaPadraoId` e
`rotaPadraoId`, usar os blocos literais de E2.2, que já aplicam exatamente a mesma
distinção entre `undefined` e `null`. Para `frotaCaminhaoId` e `pedidoVendaItemId`, ambos
presentes somente em criação nesta onda, `null` é persistido como SQL `NULL`.

Adicionar à suite unitária de cada formulário com FK opcional a asserção de payload:

```ts
expect(JSON.parse(String((fetchMock.mock.calls.at(-1)?.[1] as RequestInit).body)))
  .toMatchObject({ [campoFk]: null });
```

O teste executa “Limpar seleção” antes de salvar. No backend, acrescentar ao teste de cada
service de atualização a tríade: chave omitida preserva a FK; chave `null` grava SQL
`NULL` e snapshot `NULL`; UUID válido troca o vínculo. Não existe caso em que
`undefined` limpe vínculo.

**Estado da Emenda 3:** `ok`. O filtro usa um schema já existente e passa a ser honrado
pelos cinco catálogos; a limpeza de toda FK opcional tocada usa exclusivamente JSON
`null`, sem escolha residual para o Worker.

## Emenda 4 — Portão 1 (`ajustar`)

Esta emenda responde ao único achado do Portão 1 emitido sobre a Emenda 3 de SHA-256
`11547c5e9d16526a95a9a2f3ad3db63cebdc2e67fd07adb3fd1a4652f647d442`. O alvo foi
lido literalmente por
`git show origin/develop:app/backend/src/modules/cadastros/clientes/clientes.service.ts`,
em `origin/develop @ 000f946112aebc7eaf60c79dfad8ea7aad93f702`. Esta seção prevalece
somente sobre o PATCH de cliente descrito na Task 4 e sobre a tríade de testes de cliente da
Emenda 3. AD-13/`Nome Fantasia/Marca` e todos os demais pontos já fechados permanecem fora
de discussão.

### E4.1 — PATCH de cliente distingue omissão, limpeza e troca

No arquivo real
`app/backend/src/modules/cadastros/clientes/clientes.service.ts`, o Worker aplica as três
substituições literais abaixo. Não procurar nem alterar “campo equivalente”.

Primeira substituição:

**old_string**

```ts
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
```

**new_string**

```ts
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
```

Segunda substituição:

**old_string**

```ts
      if (dto.representanteId !== undefined) {
        await this.exigirRepresentanteNoEscopo(tx, dto.representanteId, usuarioId);
      }

      await this.assertUnico(tx, anterior.codigo, dto.documentoFiscal ?? anterior.documentoFiscal, id);
```

**new_string**

```ts
      if (typeof dto.representanteId === 'string') {
        await this.exigirRepresentanteNoEscopo(
          tx,
          dto.representanteId,
          usuarioId,
          anterior.representanteId,
        );
      }
      if (typeof dto.rotaId === 'string') {
        await this.exigirRotaAtiva(tx, dto.rotaId, anterior.rotaId);
      }

      await this.assertUnico(tx, anterior.codigo, dto.documentoFiscal ?? anterior.documentoFiscal, id);
```

Ainda na segunda substituição, no mesmo objeto `.set()`, substituir apenas esta ocorrência:

**old_string**

```ts
            representanteId: dto.representanteId ?? anterior.representanteId,
            rotaId: dto.rotaId !== undefined ? dto.rotaId : anterior.rotaId,
```

**new_string**

```ts
            representanteId: dto.representanteId !== undefined
              ? dto.representanteId
              : anterior.representanteId,
            rotaId: dto.rotaId !== undefined ? dto.rotaId : anterior.rotaId,
```

Terceira substituição:

**old_string**

```ts
  private async exigirRepresentanteNoEscopo(
    tx: NodePgDatabase<typeof schema>,
    representanteId: string,
    usuarioId: string,
  ): Promise<void> {
    const permitido = await tx
      .select({ id: representantes.id })
      .from(representantes)
      .where(and(
        eq(representantes.id, representanteId),
        escopoRepresentantes(usuarioId, representantes.id),
      ))
      .limit(1)
      .then((linhas) => linhas[0] ?? null);
    if (!permitido) throw new NotFoundException('Cliente não encontrado');
  }
```

**new_string**

```ts
  private async exigirRepresentanteNoEscopo(
    tx: NodePgDatabase<typeof schema>,
    representanteId: string,
    usuarioId: string,
    representanteIdPersistido: string | null = null,
  ): Promise<void> {
    const permitido = await tx
      .select({ id: representantes.id, status: representantes.status })
      .from(representantes)
      .where(and(
        eq(representantes.id, representanteId),
        isNull(representantes.deletedAt),
        escopoRepresentantes(usuarioId, representantes.id),
      ))
      .limit(1)
      .then((linhas) => linhas[0] ?? null);
    if (
      !permitido
      || (permitido.status !== 'ativo' && permitido.id !== representanteIdPersistido)
    ) {
      throw new BadRequestException({
        codigo: 'VINCULO_CADASTRO_INVALIDO',
        message: 'Representante não encontrado, removido ou inativo',
      });
    }
  }

  private async exigirRotaAtiva(
    tx: NodePgDatabase<typeof schema>,
    rotaId: string,
    rotaIdPersistida: string | null,
  ): Promise<void> {
    const rota = await tx
      .select({ id: rotas.id, status: rotas.status })
      .from(rotas)
      .where(and(eq(rotas.id, rotaId), isNull(rotas.deletedAt)))
      .limit(1)
      .then((linhas) => linhas[0] ?? null);
    if (!rota || (rota.status !== 'ativo' && rota.id !== rotaIdPersistida)) {
      throw new BadRequestException({
        codigo: 'VINCULO_CADASTRO_INVALIDO',
        message: 'Rota não encontrada, removida ou inativa',
      });
    }
  }
```

O argumento default de `representanteIdPersistido` mantém compatível a chamada literal já
existente em `inserirCliente`; nessa criação, somente representante ativo e não removido é
aceito. O contrato do PATCH fica fechado:

- `representanteId === undefined` e `rotaId === undefined`: não executam validação e preservam
  exatamente `anterior.representanteId` e `anterior.rotaId`;
- `representanteId === null` e `rotaId === null`: não executam validação e gravam SQL `NULL`;
- `representanteId` ou `rotaId` como string UUID: executam a validação dentro da transação e
  trocam a FK somente se o cadastro existe, não foi removido e está ativo;
- a única exceção de atividade é reenviar o mesmo UUID já persistido: ele pode estar inativo,
  conforme regra fechada nas Emendas 1–3; removido continua sempre rejeitado.

### E4.2 — Testes literais da tríade

Em `app/backend/test/integration/onda12-dominio-campos.e2e-spec.ts`, adicionar estes seis
casos, consultando a linha de `clientes` após cada PATCH e sem substituir os campos por
aliases:

1. `cliente PATCH preserva representanteId quando a chave é omitida`: omitir
   `representanteId`; esperar o UUID anterior em `clientes.representante_id`;
2. `cliente PATCH preserva rotaId quando a chave é omitida`: omitir `rotaId`; esperar o UUID
   anterior em `clientes.rota_id`;
3. `cliente PATCH limpa representanteId com null`: enviar `{ representanteId: null }`;
   esperar `clientes.representante_id IS NULL`;
4. `cliente PATCH limpa rotaId com null`: enviar `{ rotaId: null }`; esperar
   `clientes.rota_id IS NULL`;
5. `cliente PATCH troca representanteId por UUID ativo`: enviar
   `{ representanteId: representanteAtivoNovo.id }`; esperar esse UUID em
   `clientes.representante_id`;
6. `cliente PATCH troca rotaId por UUID ativo`: enviar `{ rotaId: rotaAtivaNova.id }`;
   esperar esse UUID em `clientes.rota_id`.

Os dois casos de preservação devem partir de FKs não nulas e enviar outro campo escalar no
PATCH para provar que a atualização ocorreu. Os dois casos de troca devem usar UUIDs ativos
distintos dos já persistidos. Os seis casos usam o endpoint literal `PATCH
/api/cadastros/clientes/:id`; `null` nunca é passado aos validadores e `undefined` nunca é
serializado no JSON.

Comando:

```powershell
Set-Location D:\Projetos\AlphaCarnes\Projeto\alpha-carnes\.worktrees\o12\app\backend
npx jest test/integration/onda12-dominio-campos.e2e-spec.ts --runInBand --testNamePattern "cliente PATCH (preserva|limpa|troca)"
```

Saída esperada: `PASS test/integration/onda12-dominio-campos.e2e-spec.ts`; os seis nomes
acima aparecem como `passed`; nenhum teste com esses nomes falha; processo termina com exit
code `0`.

**Estado da Emenda 4:** `ok`. O PATCH de cliente valida `representanteId` e `rotaId` somente
quando o valor presente é uma string UUID, preserva com `undefined`, limpa com `null` e troca
após validação transacional do vínculo ativo, mantendo apenas a exceção já fechada para o
mesmo vínculo persistido inativo.

> **Papel de execução:** este documento é o plano tático da Onda 12. O Worker executa os passos literalmente no worktree indicado; decisões de produto já estão fechadas em D12.1–D12.14.
>
> **Regra de parada:** divergência entre este plano e o código de `origin/develop`, migration gerada com número diferente, teste vermelho após uma correção objetiva ou ausência de contrato citado exige parar e relatar ao Quality Owner. Não improvisar regra.

**Goal:** concluir o épico SAM-156 nas issues SAM-157..SAM-165, SAM-167 e SAM-168, substituindo texto livre/UUID visível por domínios controlados, persistindo FKs reais, tornando pesquisáveis todas as superfícies enumeradas em SAM-160, fazendo a criação de regras de desdobramento funcionar e garantindo persistência dos parâmetros operacionais de fornecedor.

**Architecture:** evolução incremental do monólito modular. As FKs entram em migrations expand → backfill → contract; colunas textuais antigas permanecem como snapshots históricos e deixam de ser aceitas nas bordas de escrita. O backend valida existência + atividade dos cadastros dentro da transação e deriva os snapshots canônicos. O frontend usa `ComboboxField` para FKs, `SelectNative` para listas finitas e nunca exibe UUID como rótulo. Nenhuma regra crítica migra para o cliente.

**Tech Stack:** NestJS 11, TypeScript 5 strict, PostgreSQL 18, Drizzle ORM/drizzle-kit, Zod 4, Next.js 16 App Router/BFF, React 19, DS v3, Jest, Testing Library e Playwright.

**Identidade:** Onda 12, slug `dominio-campos-ui`, épico SAM-156, escopo SAM-157..SAM-165, SAM-167 e SAM-168; SAM-166 recusada pelo QO em favor da AD-13.

**Base obrigatória:** `origin/develop` @ `000f946112aebc7eaf60c79dfad8ea7aad93f702` (`000f946`, Onda 11 mergeada). Dependências: Ondas 0–11 + DS v3. Não executar sobre a base anterior de `feature/jef`.

**Protótipo pinado:** `main` @ `8d32aa4cadff0a91ab155a9d47b019cd3731ce77` (`8d32aa4c`), em `D:\Projetos\AlphaCarnes\Projeto\alpha-carnes-prototipo`. A branch `feature/completude-v1.1` não é requisito e não deve ser recriada nem usada.

**Branch/worktree vinculantes:** branch `feature/jef`; worktree `D:\Projetos\AlphaCarnes\Projeto\alpha-carnes\.worktrees\o12`.

---

## 1. Restrições globais

1. Preservar e completar o WIP existente de cadastros, seeds, regras de transformação/desdobramento, rotas de Next e seus testes; nenhum desses arquivos pode ser descartado.
2. Não transportar para o commit da Onda 12 as três imagens modificadas em `docs/evidencias/onda2-shell/`; elas permanecem preservadas no stash de segurança do Executor.
3. A Onda 12 não abre PR, não muda `docs/execucao/**` e não transiciona estado para `aguardando_portao2`.
4. O Worker encerra no gate local, entrega relatório de teste de usuário e mantém a aplicação disponível em `http://localhost:4000`.
5. UUID é valor de persistência, nunca label, placeholder, título, opção ou fallback visível nas superfícies tocadas. Labels:
   - representante/rota/item/produto/fornecedor: `{codigo} — {nome}`;
   - caminhão: placa;
   - motorista: nome;
   - usuário: `nome — email`;
   - recebimento: `#{codigoLote} — {fornecedorNome}`.
6. FK opcional oferece “Sem vínculo”, limpa para `''` no estado do cliente e serializa a chave como JSON `null`; `undefined` significa chave omitida e preserva o valor em PATCH. FK obrigatória não aceita texto livre, `null` nem opção inexistente.
7. Criação lista e aceita somente registros ativos e não removidos. Edição inclui o item atualmente vinculado, mesmo inativo, com sufixo `(inativo)`; o backend aceita esse mesmo ID persistido, rejeita outro inativo com HTTP 400 e sempre rejeita removidos.
8. Falha de catálogo ou mutação usa mensagem explícita; zero `catch {}` silencioso e zero fallback para UUID.
9. `ComboboxField` é o único componente pesquisável. Não criar outro combobox.
10. `SelectNative` permanece para status, prioridade, unidade e UF.
11. Cidade, categoria, NCM/CFOP/origem fiscal/CEST, perfil de gordura, placa/motorista do recebimento e local/câmara permanecem como estão; são as pendências do assessment §4.
12. SAM-118 e a onda `validacao-ux-formularios` permanecem fora do escopo.
13. Landing permanece fora do escopo.
14. Zero hex novo; usar somente tokens do DS v3.
15. Backend tocado mantém cobertura global e de branches ≥80%.

---

## 2. Escopo e fora de escopo

### Em escopo

- SAM-157: redirecionar toda `/cadastros/clientes*` para `/comercial/clientes`.
- SAM-158: enum único de unidade `kg | unidade` em produto, item de compra e item comercial.
- SAM-159: seleção pesquisável de carga/caminhão por placa no pré-faturamento.
- SAM-160: todas as oito superfícies registradas na issue.
- SAM-161: `rotaId` no pedido, herdado do cliente e persistido como FK.
- SAM-162: FKs de representante, caminhão e motorista padrão em rota.
- SAM-163: FKs de motorista e rota no planejamento de carga, com sugestão derivada da frota.
- SAM-164: `fornecedorId` na entrada de estoque.
- SAM-165: enum estático das 27 UFs nas duas superfícies de cliente e em caminhão.
- SAM-167: labels de negócio e criação funcional da regra de desdobramento.
- SAM-168: persistência real dos quatro parâmetros operacionais já expostos na UI.
- WIP existente: serialização segura do formulário genérico, rotas próprias de itens de compra/comerciais, seed do catálogo MVP, seed AD-01 e alternativas TZ A/B.

### Fora de escopo

- Assessment §4 inteiro.
- SAM-166; assessment recusado pelo QO em favor da Constituição v1.1.0 + AD-13.
- SAM-118.
- Onda `validacao-ux-formularios`.
- Alteração de layout estrutural não exigida pelas issues.
- Catálogo IBGE de cidades.
- Escape “Outro” para motorista, rota ou fornecedor.
- Edição/remoção de regra de desdobramento pela grid; os controles inertes correspondentes serão ocultados.
- Landing e Vercel.
- PR, merge e qualquer edição em `docs/execucao/**`.

---

## 3. Decisões de design fechadas

### D12.1 — Uma única UI de clientes

`/comercial/clientes` é a UI canônica. As fontes `/cadastros/clientes`, `/cadastros/clientes/novo` e `/cadastros/clientes/:id/editar` redirecionam temporariamente para `/comercial/clientes`. `clientesConfig` deixa de integrar `CADASTROS`, impedindo reintrodução acidental do formulário genérico.

```ts
{ source: '/cadastros/clientes/:path*', destination: '/comercial/clientes', permanent: false }
```

### D12.2 — Unidade é enum compartilhado

O domínio fechado é:

```ts
export const UNIDADES_MEDIDA = ['kg', 'unidade'] as const;
export const unidadeMedidaSchema = z.enum(UNIDADES_MEDIDA);
export type UnidadeMedida = z.infer<typeof unidadeMedidaSchema>;
```

`unidadePedido`, `unidadeCompra` e `unidadeComercial` usam esse schema no backend e o mesmo array no frontend. Default novo: `unidade`. Aliases históricos reconhecidos são normalizados em `0032`; valor desconhecido aborta a migration com erro explícito antes do CHECK.

### D12.3 — Pré-faturamento seleciona carga real

O formulário manual por UUID é removido. A tela continua carregando caminhões da operação do dia e renderiza `ComboboxField` com todos os caminhões retornados, pesquisável por placa, motorista e status; o botão Consolidar habilita somente com ID selecionado. Cargas elegíveis continuam em cards. Carga não elegível selecionada recebe o erro real do backend; a UI não inventa elegibilidade.

### D12.4 — SAM-160 cobre todas as superfícies

Conversões obrigatórias:

1. Pedido → produto/item comercial.
2. Compras → item de compra.
3. Clientes comercial → representante e rota.
4. Espelho comercial → representante e rota.
5. Caminhões → rota padrão.
6. Motoristas → caminhão padrão.
7. Auditoria → usuário.
8. Etiquetas de recebimento → recebimento.

Todas usam `ComboboxField`, suportam teclado, filtro textual e limpeza quando opcionais.

### D12.5 — Pedido persiste `rotaId`

`pedidos_venda.rota_id` referencia `rotas.id`. `rota_prevista` permanece como snapshot histórico/canônico para compatibilidade de leitura, mas deixa de ser entrada de API. O payload de criação usa `rotaId?: uuid | null`; a limpeza envia JSON `null`. Ao selecionar cliente, o editor define `rotaId = cliente.rotaId`; o usuário pode trocar por outra rota ativa.

O service valida a rota ativa dentro da transação e grava:

```ts
rotaId: rota?.id ?? null,
rotaPrevista: rota?.nome ?? null,
```

### D12.6 — Rota possui três FKs opcionais

Adicionar:

```ts
representantePadraoId: uuid('representante_padrao_id').references(() => representantes.id),
caminhaoPadraoId: uuid('caminhao_padrao_id').references(() => frotaCaminhoes.id),
motoristaPadraoId: uuid('motorista_padrao_id').references(() => frotaMotoristas.id),
```

As colunas textuais existentes permanecem como snapshots. DTOs recebem somente os IDs. Na criação, o service aceita apenas registros ativos/não removidos. Na edição, aceita o ID já persistido mesmo se tiver ficado inativo, mas rejeita outro inativo com 400 e sempre rejeita removidos; nome/placa dos snapshots são derivados na mesma transação.

### D12.7 — Carga possui motorista e rota cadastrados

Adicionar `motorista_id` obrigatório para novas escritas e `rota_id` opcional em `caminhoes`. As colunas `motorista` e `rota` permanecem snapshots canônicos. Não existe escape de texto livre nesta onda. Placa avulsa continua permitida.

Ao selecionar frota:

- `rotaId` recebe `frotaCaminhoes.rotaPadraoId` quando presente;
- `motoristaId` é sugerido somente quando há exatamente um motorista ativo com `caminhaoPadraoId` igual ao caminhão;
- zero ou mais de um motorista deixam o campo sem seleção;
- o operador confirma/troca ambos antes de salvar.

### D12.8 — Entrada de estoque persiste fornecedor

Adicionar `entradas_itens.fornecedor_id` FK nullable para preservar linhas históricas não conciliáveis. O DTO de criação exige `fornecedorId: uuid`; `fornecedorNome` é removido da entrada. O service bloqueia fornecedor inexistente/inativo/removido e grava o ID + snapshot `razaoSocial`.

### D12.9 — UF é enum brasileiro

Lista canônica, em ordem alfabética de sigla:

```ts
export const UFS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;
```

`dadosFiscaisJson.uf` e `certificadoUf` aceitam somente `z.enum(UFS_BRASIL)`. Campo opcional vazio não integra o payload.

### D12.10 — Terminologia desta onda

O rótulo de `nomeFantasia` permanece `Nome Fantasia/Marca` nas telas, testes e jornada Playwright, conforme Constituição v1.1.0, Princípio IX, e AD-13. SAM-166 não é implementada. “Marca” isolada continua proibida como rótulo, placeholder, termo de busca ou entidade; verbos como “Marcar” não são o termo isolado. O teste deve permitir explicitamente o rótulo composto e falhar para ocorrências proibidas fora dele. Não editar `docs/governance/quality-gates.md` nesta onda.

### D12.11 — Regra de desdobramento tem label e criação real

`GET /regras-desdobramento` passa a fazer joins e retorna:

```ts
{
  ...regra,
  itemCompraCodigo,
  itemCompraNome,
  itemComercialCodigo,
  itemComercialNome,
}
```

Não existe fallback para ID. Ausência de cadastro relacionado é erro de integridade explícito. “Nova regra” e “Adicionar linha” abrem o mesmo Dialog com dois `ComboboxField`, fator, vigência inicial, vigência final, status e observações. Salvar chama o POST existente. O botão de remoção inerte é ocultado.

### D12.12 — Parâmetros de fornecedor permanecem e persistem

Os quatro campos existentes entram em `parametrosOperacionaisJsonSchema`:

```ts
horarioLimiteRecebimento: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
capacidadeMaximaKg: z.number().int().nonnegative().optional(),
toleranciaDivergenciaPercentual: z.number().min(0).max(100).optional(),
notaQualidade: z.enum(['A', 'B', 'C']).optional(),
```

Campos vazios são removidos antes do envio; zero e `false` são preservados. Create, detalhe e update reexibem os mesmos valores.

### D12.13 — Backfill é conservador e observável

`0032_onda12_dominio_backfill.sql`:

- normaliza aliases conhecidos de unidade;
- preenche FKs somente quando há exatamente uma correspondência ativa por código/nome/placa;
- não cria cadastros artificiais;
- mantém snapshots não conciliados;
- aborta antes do contract se qualquer unidade continuar fora de `kg | unidade`.

### D12.14 — Compatibilidade da Onda 11

O Worker parte de `000f946`; não restaura arquivos pré-Onda 11. Alterações em pedido, carga e compras são aplicadas sobre contratos de múltiplas compras por operação já mergeados. Nenhum arquivo da Onda 11 é removido.

---

## 4. Referências do protótipo por tela

Todos os arquivos abaixo existem em `D:\Projetos\AlphaCarnes\Projeto\alpha-carnes-prototipo`, branch `main`, commit `8d32aa4c`.

| Tela app | Arquivo-fonte real | Estrutura preservada / divergência autorizada |
|---|---|---|
| `/comercial/clientes` | `src/app/pages/Cadastros.tsx` | master-detail, abas, representante e rota; selects viram comboboxes reais; UF vira select; `Nome Fantasia/Marca` é preservado por Constituição v1.1.0 + AD-13 |
| `/cadastros/clientes*` | `src/app/pages/Cadastros.tsx` | redireciona para a tela canônica, sem segunda UI |
| `/cadastros/produtos` | `src/app/pages/Produtos.tsx` | drawer/abas preservados; somente Unidade do pedido vira select |
| `/cadastros/itens-compra*` | `src/app/pages/RegraDesdobramento.tsx` | item de compra do domínio de desdobramento; formulário genérico DS v3 preservado |
| `/cadastros/itens-comerciais*` | `src/app/pages/RegraDesdobramento.tsx` | item comercial do domínio de desdobramento; formulário genérico DS v3 preservado |
| `/faturamento/pre-faturamento` | `src/app/pages/Faturamento.tsx` | seleção de carga por placa/motorista e restante da tela intacto |
| `/comercial/pedidos` | `src/app/pages/PedidoVenda.tsx` | editor de pedido; produto e rota passam a combobox sem mudar seções |
| `/gestao/compras` | `src/app/pages/CompraProgramada.tsx` | grade de itens; item de compra passa a combobox |
| `/comercial/espelho` | `src/app/pages/EspelhoComercial.tsx` | filtros existentes; representante e rota passam a combobox |
| `/cadastros/rotas` | `src/app/pages/Itinerarios.tsx` | master-detail, sequência de paradas e dias preservados; três padrões entram no mesmo formulário |
| `/carga/planejamento` | `src/app/pages/PlanejamentoExpedicao.tsx` | duas colunas e modal de alocação preservados; formulário de caminhão usa catálogos reais |
| `/estoque/entrada-itens` | `src/app/pages/EntradaItens.tsx` | card “Nova entrada” intacto; fornecedor vira combobox |
| `/cadastros/caminhoes` | `src/app/pages/Caminhoes.tsx` | tabela/drawer preservados; rota e UF controladas |
| `/cadastros/motoristas` | `src/app/pages/Motoristas.tsx` | tabela/drawer preservados; caminhão padrão pesquisável |
| `/admin/auditoria` | `src/app/pages/Auditoria.tsx` | filtros preservados; usuário pesquisável |
| `/recebimento/etiquetas` | `src/app/pages/EtiquetasRecebimento.tsx` | seletor de recebimento preservado com label de negócio |
| `/cadastros/regras-transformacao` | `src/app/pages/RegraDesdobramento.tsx` | abas, grid e simuladores preservados; criação conectada ao backend |
| `/cadastros/fornecedores*` | `src/app/pages/Fornecedores.tsx` | master-detail/formulário e parâmetros operacionais preservados; persistência real |

---

## 5. Estrutura de arquivos

### Backend — migrations/schema/DTO/services

```text
app/backend/src/common/dto/dominios.dto.ts                                  [novo: unidade + UF]
app/backend/src/common/dto/json-cadastros.dto.ts                            [UF + parâmetros fornecedor]
app/backend/src/database/schema/rotas.schema.ts                             [3 FKs]
app/backend/src/database/schema/pedidos.schema.ts                           [rotaId]
app/backend/src/database/schema/expedicao.schema.ts                         [motoristaId + rotaId]
app/backend/src/database/schema/estoque.schema.ts                           [fornecedorId]
app/backend/src/database/schema/produtos.schema.ts                          [CHECK unidade]
app/backend/src/database/schema/itens-compra.schema.ts                      [CHECK unidade]
app/backend/src/database/schema/itens-comerciais.schema.ts                  [CHECK unidade]
app/backend/src/database/migrations/0031_onda12_dominio_expand.sql
app/backend/src/database/migrations/0032_onda12_dominio_backfill.sql
app/backend/src/database/migrations/0033_onda12_dominio_contract.sql
app/backend/src/database/migrations/meta/0031_snapshot.json
app/backend/src/database/migrations/meta/0032_snapshot.json
app/backend/src/database/migrations/meta/0033_snapshot.json
app/backend/src/database/migrations/meta/_journal.json
app/backend/src/modules/cadastros/produtos/dto/produto.dto.ts
app/backend/src/modules/cadastros/itens-compra/dto/item-compra.dto.ts
app/backend/src/modules/cadastros/itens-comerciais/dto/item-comercial.dto.ts
app/backend/src/modules/cadastros/rotas/dto/rota.dto.ts
app/backend/src/modules/cadastros/rotas/rotas.service.ts
app/backend/src/modules/cadastros/regras-desdobramento/regras-desdobramento.service.ts
app/backend/src/modules/comercial/pedidos/dto/pedido.dto.ts
app/backend/src/modules/comercial/pedidos/pedidos.service.ts
app/backend/src/modules/operacao/expedicao/dto/expedicao.dto.ts
app/backend/src/modules/operacao/expedicao/caminhao.service.ts
app/backend/src/modules/operacao/estoque/dto/estoque.dto.ts
app/backend/src/modules/operacao/estoque/entradas.service.ts
app/backend/src/modules/frota/dto/caminhao-cadastro.dto.ts
app/backend/src/modules/frota/dto/motorista.dto.ts
app/backend/src/modules/frota/caminhoes-cadastro.service.ts
app/backend/src/modules/frota/motoristas.service.ts
```

### Backend — WIP preservado

```text
app/backend/src/database/seed-catalogo-mvp.ts
app/backend/src/database/seed-regras-desdobramento-comercial.ts
app/backend/src/database/seed-regras-transformacao-tz.ts
app/backend/src/database/seed.ts
app/backend/test/integration/seed-catalogo-mvp.e2e-spec.ts
app/backend/test/integration/seed.spec.ts
app/backend/test/unit/seed-regras-desdobramento-comercial.spec.ts
app/backend/test/unit/seed-regras-transformacao-tz.spec.ts
```

### Frontend — domínio/componentes/telas

```text
app/frontend/src/lib/dominios.ts                                             [novo: unidade + UF + builders]
app/frontend/src/components/ui/combobox-field.tsx                            [clear/ARIA]
app/frontend/next.config.ts                                                  [redirect cliente + rotas WIP]
app/frontend/src/lib/cadastros-config.ts
app/frontend/src/components/cadastro-form.tsx
app/frontend/src/app/(admin)/cadastros/_components/cadastro-form-page.tsx
app/frontend/src/app/(admin)/cadastros/[recurso]/novo/page.tsx
app/frontend/src/app/(admin)/cadastros/[recurso]/[id]/editar/page.tsx
app/frontend/src/app/(admin)/cadastros/fornecedores/novo/page.tsx
app/frontend/src/app/(admin)/cadastros/produtos/produtos-client.tsx
app/frontend/src/app/(admin)/cadastros/caminhoes/caminhoes-client.tsx
app/frontend/src/app/(admin)/cadastros/motoristas/motoristas-client.tsx
app/frontend/src/app/(admin)/cadastros/rotas/rotas-client.tsx
app/frontend/src/app/(admin)/cadastros/regras-transformacao/regras-transformacao-client.tsx
app/frontend/src/app/(admin)/cadastros/regras-transformacao/simulador-desossa.tsx
app/frontend/src/app/(admin)/comercial/clientes/clientes-client.tsx
app/frontend/src/app/(admin)/comercial/pedidos/pedido-editor.tsx
app/frontend/src/app/(admin)/comercial/espelho/espelho-client.tsx
app/frontend/src/app/(admin)/gestao/compras/compras-client.tsx
app/frontend/src/app/(admin)/carga/planejamento/planejamento-client.tsx
app/frontend/src/app/(admin)/estoque/entrada-itens/entrada-itens-client.tsx
app/frontend/src/app/(admin)/faturamento/pre-faturamento/pre-faturamento-client.tsx
app/frontend/src/app/(admin)/admin/auditoria/auditoria-client.tsx
app/frontend/src/app/(admin)/recebimento/etiquetas/etiquetas-client.tsx
app/frontend/src/lib/comercial.ts
app/frontend/src/lib/rotas.ts
app/frontend/src/lib/estoque.ts
app/frontend/src/lib/operacao.ts
```

### Testes/evidências

```text
app/backend/test/integration/onda12-dominio-campos.e2e-spec.ts               [novo]
app/backend/test/integration/onda12-migrations.e2e-spec.ts                    [novo]
app/backend/test/unit/onda12-migrations-meta.spec.ts                          [novo]
app/frontend/__tests__/dominios.test.ts                                      [novo]
app/frontend/__tests__/combobox-field.test.tsx                               [novo]
app/frontend/__tests__/next-config-rotas.test.ts
app/frontend/__tests__/cadastro-form.test.tsx
app/frontend/src/lib/__tests__/cadastros-config.test.ts
app/frontend/__tests__/produtos-client.test.tsx
app/frontend/__tests__/onda4-clientes.test.tsx
app/frontend/__tests__/onda4-pedidos.test.tsx
app/frontend/__tests__/compras-client.test.tsx
app/frontend/__tests__/onda4-espelho.test.tsx
app/frontend/__tests__/carga-planejamento.test.tsx
app/frontend/__tests__/entrada-itens.test.tsx
app/frontend/__tests__/pre-faturamento.test.tsx
app/frontend/__tests__/auditoria-filtros.test.tsx
app/frontend/__tests__/etiquetas-recebimento.test.tsx
app/frontend/__tests__/cadastro-tabela-drawer.test.tsx
app/frontend/__tests__/rotas-paradas.test.tsx
app/frontend/__tests__/simuladores-transformacao.test.tsx
app/frontend/__tests__/terminologia.test.ts
app/frontend/e2e/onda12-dominio-campos-ui.spec.ts                             [novo]
docs/evidencias/onda12-dominio-campos-ui/                                   [novo]
```

---

## 6. Mapa DoD → teste 1:1

| DoD | Invariante | Teste literal |
|---|---|---|
| 12.1 / SAM-157 | todas as rotas genéricas de cliente redirecionam para a UI comercial e `clientes` não integra o cadastro genérico | `next-config-rotas.test.ts › 'DoD 12.1 redireciona todo /cadastros/clientes* para /comercial/clientes'`; `cadastros-config.test.ts › 'DoD 12.1 clientes possui uma única UI canônica'` |
| 12.2 / SAM-158 | três DTOs aceitam apenas `kg/unidade`; três UIs usam select e default `unidade` | `onda12-dominio-campos.e2e-spec.ts › 'DoD 12.2 rejeita unidade livre e aceita o enum nos três cadastros'`; `dominios.test.ts › 'DoD 12.2 unidade é o mesmo enum nas três superfícies'` |
| 12.3 / SAM-159 | pré-faturamento pesquisa placa/motorista e nunca pede UUID | `pre-faturamento.test.tsx › 'DoD 12.3 consolida caminhão selecionado por placa sem campo UUID'` |
| 12.4 / SAM-160 | as oito superfícies usam `ComboboxField`, filtram e limpam opcionais | `combobox-field.test.tsx › 'DoD 12.4 filtra por label e sublabel, seleciona por teclado e limpa opcional'` + `onda12-dominio-campos-ui.spec.ts › 'DoD 12.4 todas as superfícies SAM-160 oferecem pesquisa'` |
| 12.5 / SAM-161 | pedido herda rota do cliente, persiste FK e rejeita rota inativa/inexistente sem mutação | `onda12-dominio-campos.e2e-spec.ts › 'DoD 12.5 pedido persiste rotaId ativa e snapshot canônico'`; `onda12-dominio-campos.e2e-spec.ts › 'DoD 12.5b pedido rejeita rota inválida sem criar pedido ou reserva'` |
| 12.6 / SAM-162 | criação aceita só vínculo ativo; edição mantém o mesmo ID já persistido mesmo inativo e rejeita outro inativo com 400, sem mutação | `onda12-dominio-campos.e2e-spec.ts › 'DoD 12.6a criação de rota rejeita vínculo inativo com 400 sem auditoria'`; `onda12-dominio-campos.e2e-spec.ts › 'DoD 12.6b edição de rota mantém vínculo persistido que ficou inativo'`; `onda12-dominio-campos.e2e-spec.ts › 'DoD 12.6c edição de rota rejeita troca para outro inativo com 400 sem auditoria'` |
| 12.7 / SAM-163 | carga persiste motorista/rota por FK e sugere padrões determinísticos da frota | `onda12-dominio-campos.e2e-spec.ts › 'DoD 12.7 carga persiste motoristaId e rotaId com snapshots canônicos'`; `carga-planejamento.test.tsx › 'DoD 12.7 sugere rota e motorista únicos ao selecionar frota'` |
| 12.8 / SAM-164 | entrada exige fornecedor ativo por ID e deriva nome no servidor | `onda12-dominio-campos.e2e-spec.ts › 'DoD 12.8 entrada de estoque persiste fornecedorId e nome canônico'`; `onda12-dominio-campos.e2e-spec.ts › 'DoD 12.8b fornecedor inativo não cria entrada nem consome pedido'` |
| 12.9 / SAM-165 | 27 UFs, mesma ordem, e backend rejeita valor externo | `dominios.test.ts › 'DoD 12.9 expõe exatamente as 27 UFs na ordem canônica'`; `onda12-dominio-campos.e2e-spec.ts › 'DoD 12.9 rejeita UF fora do enum em cliente e caminhão'` |
| 12.10 / AD-13 | campo `nomeFantasia` mantém `Nome Fantasia/Marca`; “Marca” isolada continua proibida fora da exceção composta | `terminologia.test.ts › 'DoD 12.10 permite Nome Fantasia/Marca e proíbe Marca isolada fora da AD-13'`; `onda4-clientes.test.tsx › 'DoD 12.10 cliente mantém o rótulo Nome Fantasia/Marca'` |
| 12.11 / SAM-167 | grid retorna código+nome e criação via dois comboboxes persiste regra | `onda12-dominio-campos.e2e-spec.ts › 'DoD 12.11 lista regra com labels e cria por FKs ativas'`; `simuladores-transformacao.test.tsx › 'DoD 12.11 cria regra sem exibir UUID ou ação inerte'` |
| 12.12 / SAM-168 | quatro parâmetros sobrevivem create → detail → update, inclusive zero/false | `onda12-dominio-campos.e2e-spec.ts › 'DoD 12.12 fornecedor persiste e reexibe todos os parâmetros operacionais'`; `cadastro-form.test.tsx › 'DoD 12.12 formulário envia zero false horário tolerância e nota'` |
| 12.13 / dados | migrations 0031–0033 aplicam em base O11, backfillam aliases/FKs únicos e abortam unidade desconhecida | `onda12-migrations.e2e-spec.ts › 'DoD 12.13 aplica expand backfill contract sobre snapshot O11'`; `onda12-migrations.e2e-spec.ts › 'DoD 12.13b contract recusa unidade histórica desconhecida'`; `onda12-migrations-meta.spec.ts › 'DoD 12.13c journal 0031 0032 0033 corresponde aos snapshots'` |
| 12.14 / WIP | catálogo/AD-01/TZ A-B e rotas próprias continuam idempotentes e funcionais | suites `seed-catalogo-mvp`, `seed-regras-desdobramento-comercial`, `seed-regras-transformacao-tz`, `seed.spec`, `next-config-rotas` |

---

## 7. Tasks TDD

## Task 0 — Preparar worktree e preservar WIP

**Responsável:** Executor. O Worker só começa depois do checkpoint.

- [ ] Confirmar hashes:

```powershell
git rev-parse origin/develop
git rev-parse feature/jef
git merge-base origin/develop feature/jef
```

Resultados exigidos: `origin/develop = 000f946112aebc7eaf60c79dfad8ea7aad93f702`; `feature/jef = 1a3df836005bd33b04bf486fc61fdc409667eb52`; merge-base = `1a3df836...`.

- [ ] No checkout coordenador, preservar tudo em stash sem apagar a cópia:

```powershell
git stash push -u -m "checkpoint-o12-wip-feature-jef-2026-08-30"
git switch --detach origin/develop
git worktree add ".worktrees/o12" feature/jef
Set-Location ".worktrees/o12"
git merge --ff-only origin/develop
git stash apply "stash^{/checkpoint-o12-wip-feature-jef-2026-08-30}"
```

- [ ] Remover somente as três imagens da cópia de trabalho da Onda 12, mantendo-as recuperáveis no stash:

```powershell
git restore -- "docs/evidencias/onda2-shell/01-login.png" "docs/evidencias/onda2-shell/02-shell-dashboard.png" "docs/evidencias/onda2-shell/03-shell-sidebar-9-grupos.png"
```

- [ ] Confirmar que nenhum `docs/execucao/**` está modificado e registrar o checkpoint:

```powershell
git status --short
git diff --name-only -- "docs/execucao"
git rev-parse HEAD
```

Aceite: HEAD `000f946...`, WIP de código/testes presente, saída de `docs/execucao` vazia. O stash não é removido antes da integração autorizada pelo QO.

**Commit da Task 0:** `chore(onda12): preservar checkpoint inicial`

## Task 1 — Escrever testes vermelhos de domínio e migrations

**Files:** novos testes backend `onda12-dominio-campos.e2e-spec.ts`, `onda12-migrations.e2e-spec.ts`, `onda12-migrations-meta.spec.ts`; `app/frontend/__tests__/dominios.test.ts`.

- [ ] Criar os `it` literais do mapa 12.2, 12.5–12.9, 12.11–12.13 antes da produção.
- [ ] Usar fixture real, cookies reais e consultas Drizzle posteriores. Todo 400/404/409 verifica ausência de linha e ausência de auditoria da mutação rejeitada.
- [ ] Fixar a asserção de unidade/UF:

```ts
expect(UNIDADES_MEDIDA).toEqual(['kg', 'unidade']);
expect(UFS_BRASIL).toEqual([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);
expect(new Set(UFS_BRASIL).size).toBe(27);
```

- [ ] Executar e registrar RED:

```powershell
Set-Location app/backend
npx jest test/integration/onda12-dominio-campos.e2e-spec.ts test/integration/onda12-migrations.e2e-spec.ts test/unit/onda12-migrations-meta.spec.ts --runInBand
Set-Location ../frontend
npx jest __tests__/dominios.test.ts --runInBand
```

**Commit da Task 1:** `test(onda12): fixar contratos de domínio`

## Task 2 — Gerar 0031–0033 e fechar domínios no banco

**Files:** schemas e migrations da seção 5.

- [ ] Adicionar colunas FK nullable + índices nos quatro schemas e gerar expand:

```powershell
Set-Location app/backend
npm run db:generate -- --name onda12_dominio_expand
```

Arquivo exigido: `0031_onda12_dominio_expand.sql`.

- [ ] Gerar migration custom de dados:

```powershell
npm run db:generate -- --custom --name onda12_dominio_backfill
```

Arquivo exigido: `0032_onda12_dominio_backfill.sql`.

- [ ] Implementar no backfill a normalização literal:

```sql
UPDATE produtos
SET unidade_pedido = CASE
  WHEN lower(btrim(unidade_pedido)) IN ('kg', 'quilo', 'quilograma') THEN 'kg'
  WHEN lower(btrim(unidade_pedido)) IN ('peça', 'peca', 'un', 'und', 'unid', 'unidade') THEN 'unidade'
  ELSE unidade_pedido
END;

UPDATE itens_compra
SET unidade_compra = CASE
  WHEN lower(btrim(unidade_compra)) IN ('kg', 'quilo', 'quilograma') THEN 'kg'
  WHEN lower(btrim(unidade_compra)) IN ('peça', 'peca', 'un', 'und', 'unid', 'unidade') THEN 'unidade'
  ELSE unidade_compra
END;

UPDATE itens_comerciais
SET unidade_comercial = CASE
  WHEN lower(btrim(unidade_comercial)) IN ('kg', 'quilo', 'quilograma') THEN 'kg'
  WHEN lower(btrim(unidade_comercial)) IN ('peça', 'peca', 'un', 'und', 'unid', 'unidade') THEN 'unidade'
  ELSE unidade_comercial
END;
```

- [ ] Backfillar IDs somente por correspondência única ativa. Para cada alvo, usar CTE com `GROUP BY snapshot HAVING count(*) = 1`; chaves: rota `codigo/nome`, representante `codigo/nome`, caminhão `placa`, motorista `nome`, fornecedor `codigo/razao_social`.
- [ ] Encerrar 0032 com bloco que lança exceção quando restar unidade externa:

```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM produtos WHERE unidade_pedido NOT IN ('kg', 'unidade')
    UNION ALL
    SELECT 1 FROM itens_compra WHERE unidade_compra NOT IN ('kg', 'unidade')
    UNION ALL
    SELECT 1 FROM itens_comerciais WHERE unidade_comercial NOT IN ('kg', 'unidade')
  ) THEN
    RAISE EXCEPTION 'Onda 12: unidade histórica fora de kg|unidade; corrigir dado de origem antes do contract';
  END IF;
END $$;
```

- [ ] Adicionar CHECKs nos schemas e gerar contract:

```powershell
npm run db:generate -- --name onda12_dominio_contract
```

Arquivo exigido: `0033_onda12_dominio_contract.sql`.

- [ ] Rodar os testes 12.13 até GREEN.

**Commit da Task 2:** `feat(onda12): evoluir domínio persistido`

## Task 3 — Fechar DTOs e validações compartilhadas

**Files:** `dominios.dto.ts`, DTOs de produto/item/rota/pedido/expedição/estoque/frota e JSON de cadastros.

- [ ] Criar os arrays/schemas de D12.2 e D12.9 e importá-los em todas as bordas.
- [ ] Substituir strings:

```ts
unidadePedido: unidadeMedidaSchema,
unidadeCompra: unidadeMedidaSchema,
unidadeComercial: unidadeMedidaSchema,
rotaId: fkOpcionalSchema,
representantePadraoId: fkOpcionalSchema,
caminhaoPadraoId: fkOpcionalSchema,
motoristaPadraoId: fkOpcionalSchema,
motoristaId: z.string().uuid(),
fornecedorId: z.string().uuid(),
```

- [ ] Remover das entradas de criação `rotaPrevista`, `representantePadrao`, `caminhaoPadrao`, `motoristaPadrao`, `motorista`, `rota` e `fornecedorNome`.
- [ ] Aplicar parâmetros de D12.12 sem `.default()` que apague a distinção entre ausente, zero e `false`.
- [ ] Rodar:

```powershell
npx jest test/integration/onda12-dominio-campos.e2e-spec.ts --runInBand
npm run type-check
```

Os testes de services ainda permanecem vermelhos; os erros devem estar restritos à implementação da Task 4.

**Commit da Task 3:** `feat(onda12): fechar contratos de entrada`

## Task 4 — Persistir FKs, snapshots e auditoria no backend

**Files:** `app/backend/src/modules/cadastros/rotas/rotas.service.ts`, `app/backend/src/modules/frota/caminhoes-cadastro.service.ts`, `app/backend/src/modules/frota/motoristas.service.ts`, services de pedido/carga/entrada e regras de desdobramento.

- [ ] Nos DTOs reais, usar os contratos literais abaixo. Zod valida formato e nullabilidade; não tenta decidir atividade:

```ts
// app/backend/src/modules/cadastros/rotas/dto/rota.dto.ts
representantePadraoId: fkOpcionalSchema,
caminhaoPadraoId: fkOpcionalSchema,
motoristaPadraoId: fkOpcionalSchema,

// app/backend/src/modules/frota/dto/caminhao-cadastro.dto.ts
rotaPadraoId: fkOpcionalSchema,

// app/backend/src/modules/frota/dto/motorista.dto.ts
caminhaoPadraoId: fkOpcionalSchema,
```

- [ ] Em `app/backend/src/modules/cadastros/rotas/rotas.service.ts`, importar `BadRequestException`, `representantes`, `frotaCaminhoes` e `frotaMotoristas` e implementar helpers concretos com este corpo literal; `resolverCaminhaoPadrao` e `resolverMotoristaPadrao` repetem o mesmo predicado com a tabela e projeção correspondentes:

```ts
private async resolverRepresentantePadrao(
  tx: NodePgDatabase<typeof schema>,
  id: string | null | undefined,
  idPersistidoAtual: string | null,
): Promise<{ id: string; codigo: string; nome: string; status: string } | null> {
  if (id == null) return null;
  const vinculo = await tx
    .select({
      id: representantes.id,
      codigo: representantes.codigo,
      nome: representantes.nome,
      status: representantes.status,
    })
    .from(representantes)
    .where(and(eq(representantes.id, id), isNull(representantes.deletedAt)))
    .then((rows) => rows[0] ?? null);
  if (!vinculo || (vinculo.status !== 'ativo' && vinculo.id !== idPersistidoAtual)) {
    throw new BadRequestException({
      statusCode: 400,
      codigo: 'VINCULO_CADASTRO_INVALIDO',
      message: 'Representante não encontrado, removido ou inativo',
    });
  }
  return vinculo;
}
```

- [ ] Em `app/backend/src/modules/frota/caminhoes-cadastro.service.ts`, criar `resolverRotaPadrao(tx, id, idPersistidoAtual)` consultando `rotas` por `id` + `deletedAt IS NULL` e aplicando exatamente `!vinculo || (vinculo.status !== 'ativo' && vinculo.id !== idPersistidoAtual)`. Em `app/backend/src/modules/frota/motoristas.service.ts`, criar `resolverCaminhaoPadrao(tx, id, idPersistidoAtual)` com o mesmo predicado sobre `frotaCaminhoes`. Ambos lançam o mesmo `BadRequestException` 400, com rótulo específico.
- [ ] As chamadas e os nomes de campos são os blocos literais de E2.2. Em atualização, `undefined` mantém o vínculo sem revalidação. Se enviar o mesmo ID que ficou inativo, aceitar e manter snapshot canônico; se enviar outro inativo, responder 400 antes de UPDATE/auditoria.
- [ ] Em rota, resolver os três vínculos antes do INSERT/UPDATE e gravar IDs + snapshots. Aplicar a mesma regra em `CaminhoesCadastroService` para `rotaPadraoId` e em `MotoristasService` para `caminhaoPadraoId`.
- [ ] Em pedido, resolver `rotaId` antes de qualquer reserva/INSERT. Falha precisa ocorrer antes de mutar saldo.
- [ ] Em caminhão, resolver motorista obrigatório e rota opcional antes do INSERT; manter validação da frota e placa.
- [ ] Em entrada, validar fornecedor antes de consumir quantidade do pedido:

```ts
const fornecedor = await tx
  .select({ id: fornecedores.id, razaoSocial: fornecedores.razaoSocial })
  .from(fornecedores)
  .where(and(
    eq(fornecedores.id, dto.fornecedorId),
    eq(fornecedores.status, 'ativo'),
    isNull(fornecedores.deletedAt),
  ))
  .then((rows) => rows[0] ?? null);
if (!fornecedor) {
  throw new NotFoundException({
    codigo: 'FORNECEDOR_INVALIDO',
    message: 'Fornecedor não encontrado ou inativo',
  });
}
```

- [ ] Em regras de desdobramento, trocar o select simples por joins com item de compra/comercial e falhar se qualquer label estiver ausente. Retorno usa código+descrição, sem ID como fallback.
- [ ] Manter auditoria no mesmo `db.transaction`; evento de entrada continua somente pós-commit.
- [ ] Rodar todos os testes backend da Onda 12 até GREEN, incluindo os três `it` 12.6a–c. Repetir a matriz criação/edição atual/edição outro inativo para cada vínculo opcional tocado; os testes verificam HTTP 400 e ausência de UPDATE/auditoria na rejeição.

**Commit da Task 4:** `feat(onda12): validar vínculos no backend`

## Task 5 — Completar WIP de seeds e formulários genéricos

**Files:** inventário “Backend — WIP preservado” e arquivos genéricos de frontend.

- [ ] Manter `seedCatalogoMvp` idempotente com 11 produtos, unidade dentro do enum e flags de transformação.
- [ ] Manter `seedRegrasDesdobramentoComercial` idempotente: BOI → 2 TZ + 2 DT + 2 PA e identidades 1:1 existentes.
- [ ] Manter `seedRegrasTransformacaoTz` com TZ_A/TZ_B, `provisorio=true`, saídas corretas e flags dos produtos.
- [ ] Manter ordem:

```ts
await seedCatalogoMvp(db);
await seedRegrasDesdobramentoComercial(db);
await seedRegrasTransformacaoTz(db);
```

- [ ] Completar `configCadastroParaCliente`, `CadastroFormPage` e a rota dedicada de fornecedor sem serializar Zod, Lucide ou máscaras.
- [ ] Manter itens de compra/comerciais sem redirect para produtos.
- [ ] Atualizar seeds para usar somente `kg | unidade`; nenhum teste injeta valor externo salvo o teste negativo de migration.
- [ ] Rodar as quatro suites de seed + `cadastro-form`, `cadastros-config` e `next-config-rotas`.

**Commit da Task 5:** `feat(onda12): completar cadastros e seeds`

## Task 6 — Evoluir `ComboboxField` e domínios do frontend

**Files:** `src/lib/dominios.ts`, `combobox-field.tsx`, `combobox-field.test.tsx`.

- [ ] Exportar `UNIDADES_MEDIDA`, `UFS_BRASIL`, options e builders de label.
- [ ] Adicionar `clearable?: boolean` ao componente. Quando `clearable && value`, renderizar botão acessível:

```tsx
<button
  type="button"
  aria-label="Limpar seleção"
  onClick={(event) => {
    event.stopPropagation();
    onChange('');
  }}
>
  <X className="size-3.5" aria-hidden="true" />
</button>
```

- [ ] Manter busca pelo `value={`${item.label} ${item.sublabel ?? ''}`}` e seleção por teclado do `cmdk`.
- [ ] Testar label, sublabel, teclado, limpeza, disabled e empty state no `it` literal 12.4. O botão “Limpar seleção” é irmão do `PopoverTrigger`, e a seleção após filtrar Norte usa `await user.keyboard('{Enter}')`.
- [ ] Antes do `rerender` disabled, fechar obrigatoriamente o popover e só então consultar o único `combobox`; usar exatamente esta sequência, sem alternativa por `data-slot`:

```ts
await user.keyboard('{Escape}');
expect(screen.queryByPlaceholderText('Buscar rota')).not.toBeInTheDocument();
rerender(<ComboboxControl disabled />);
expect(screen.getByRole('combobox')).toBeDisabled();
```

**Commit da Task 6:** `feat(onda12): padronizar domínios pesquisáveis`

## Task 7 — Cliente único, UF e terminologia

**Files:** `next.config.ts`, `cadastros-config.ts`, `clientes-client.tsx`, testes de config/cliente/terminologia/jornada.

- [ ] Implementar D12.1 e remover `clientes` do mapa `CADASTROS`.
- [ ] Trocar representante e rota da tela comercial por `ComboboxField`, labels `{codigo} — {nome}`, `clearable`.
- [ ] Trocar somente UF por `SelectNative` usando 27 options; cidade continua `Input`.
- [ ] Preservar todos os rótulos do campo `nomeFantasia` como `Nome Fantasia/Marca`; não trocar para `Nome Fantasia`.
- [ ] Atualizar a jornada Playwright para preencher `Nome Fantasia/Marca`.
- [ ] Teste de terminologia:

```ts
const semExcecaoAd13 = conteudo.replaceAll('Nome Fantasia/Marca', 'Nome Fantasia');
expect(semExcecaoAd13).not.toMatch(/\bmarca\b/i);
```

Aplicar às strings de produção do frontend. O teste também afirma que o label de `nomeFantasia` é exatamente `Nome Fantasia/Marca`; “Marca” isolada como label/placeholder/termo de busca falha. Não editar `quality-gates.md`.

- [ ] Executar os três comandos de verificação e conferir as saídas esperadas em E2.3, Task 7.

**Commit da Task 7:** `feat(onda12): unificar clientes e preservar AD-13`

## Task 8 — Unidade controlada e fornecedor persistente

**Files:** produto, `cadastros-config`, `cadastro-form`, fornecedor e testes.

- [ ] Produto: default `unidade`, `SelectNative`, options `kg`/`Unidade`.
- [ ] Item de compra e item comercial: `tipo: 'select'`, mesmas options e schema frontend `z.enum(['kg', 'unidade'])`.
- [ ] Fornecedor: manter os quatro campos WIP, higienizar vazios sem remover zero/false:

```ts
const parametrosOperacionaisJson = {
  romaneioAntecipado: Boolean(raw.romaneioAntecipado),
  ...(raw.horarioLimiteRecebimento ? { horarioLimiteRecebimento: raw.horarioLimiteRecebimento } : {}),
  ...(raw.capacidadeMaximaKg === '' || raw.capacidadeMaximaKg === undefined
    ? {}
    : { capacidadeMaximaKg: Number(raw.capacidadeMaximaKg) }),
  ...(raw.toleranciaDivergenciaPercentual === '' || raw.toleranciaDivergenciaPercentual === undefined
    ? {}
    : { toleranciaDivergenciaPercentual: Number(raw.toleranciaDivergenciaPercentual) }),
  ...(raw.notaQualidade ? { notaQualidade: raw.notaQualidade } : {}),
};
```

- [ ] Edição usa os valores retornados em `reset`, sem defaults que sobrescrevam zero/false.
- [ ] Executar os três comandos de verificação e conferir as saídas esperadas em E2.3, Task 8.

**Commit da Task 8:** `feat(onda12): persistir parâmetros controlados`

## Task 9 — Rotas, caminhões e motoristas com catálogos

**Files:** clients de rotas/caminhões/motoristas, libs e testes.

- [ ] Rotas carrega em paralelo representantes, frota e motoristas ativos; formulário usa três comboboxes e envia somente IDs.
- [ ] Caminhões troca rota padrão por combobox e Certificado (UF) por select.
- [ ] Motoristas troca caminhão padrão por combobox pesquisável por placa/descrição.
- [ ] Edição inclui vínculo inativo atual com `(inativo)`; criação não lista inativos. O cliente nunca é autoridade: os services aplicam a regra 12.6a–c.
- [ ] Nenhuma lista usa ID truncado como sublabel.
- [ ] Executar os três comandos de verificação e conferir as saídas esperadas em E2.3, Task 9.

**Commit da Task 9:** `feat(onda12): conectar rotas e frota`

## Task 10 — Pedido, compras e espelho pesquisáveis

**Files:** `pedido-editor.tsx`, `compras-client.tsx`, `espelho-client.tsx`, `comercial.ts` e testes.

- [ ] Atualizar sobre `origin/develop @ 000f946`, preservando múltiplas compras por operação.
- [ ] Pedido:
  - produto → combobox `{codigo} — {descricao}`;
  - rota → combobox `{codigo} — {nome}`;
  - cliente selecionado aplica `rotaId`;
  - payload envia `rotaId`, nunca `rotaPrevista`.
- [ ] Compras: item de compra da grade → combobox `{codigo} — {descricao}`.
- [ ] Espelho: filtros representante/rota → comboboxes opcionais com item sintético “Todos” representado por valor vazio.
- [ ] Teste de pedido prova que o ID é enviado e somente o label aparece.
- [ ] Executar os quatro comandos de verificação e conferir as saídas esperadas em E2.3, Task 10.

**Commit da Task 10:** `feat(onda12): tornar comercial pesquisável`

## Task 11 — Carga e estoque com FKs reais

**Files:** planejamento, entrada de itens, libs e testes.

- [ ] Planejamento carrega caminhões, motoristas e rotas ativas em `Promise.all`.
- [ ] Frota, motorista e rota usam comboboxes; placa manual aparece só para frota vazia.
- [ ] Implementar sugestão determinística D12.7:

```ts
const candidatos = motoristas.filter((m) => m.caminhaoPadraoId === frotaId);
setNovoCaminhao((atual) => ({
  ...atual,
  frotaCaminhaoId: frotaId,
  motoristaId: candidatos.length === 1 ? candidatos[0]!.id : '',
  rotaId: frotaSelecionada?.rotaPadraoId ?? '',
}));
```

- [ ] Entrada de itens carrega fornecedores ativos, mostra `{codigo} — {razaoSocial}`, exige seleção e envia `fornecedorId`.
- [ ] Reset limpa IDs; listagens continuam mostrando snapshots canônicos.
- [ ] Executar os três comandos de verificação e conferir as saídas esperadas em E2.3, Task 11.

**Commit da Task 11:** `feat(onda12): persistir vínculos operacionais`

## Task 12 — Pré-faturamento, auditoria e etiquetas

**Files:** três clients e testes.

- [ ] Pré-faturamento remove `Input`/microcopy de UUID e usa `ComboboxField` sobre `caminhoesDia` com `label=placa`, `sublabel="${motorista} — ${status}"`.
- [ ] Empty state passa a dizer “Selecione uma carga abaixo para consultar a consolidação.”, sem instrução de ID.
- [ ] Auditoria troca somente o filtro Usuário por combobox `nome — email`; filtros Módulo/Operação permanecem select.
- [ ] Etiquetas troca recebimento por combobox `#{codigoLote} — {fornecedorNome}`, status como sublabel.
- [ ] Executar os três comandos de verificação e conferir as saídas esperadas em E2.3, Task 12.

**Commit da Task 12:** `feat(onda12): remover UUIDs operacionais`

## Task 13 — Regra de desdobramento legível e criável

**Files:** `regras-transformacao-client.tsx`, testes e WIP do simulador.

- [ ] Remover helpers que retornam ID. Renderizar somente:

```tsx
<p className="text-[13px] font-semibold">
  {regra.itemComercialCodigo} — {regra.itemComercialNome}
</p>
```

e equivalente de item de compra.

- [ ] Criar Dialog compartilhado entre “Nova regra” e “Adicionar linha”; campos:
  - item compra obrigatório, combobox;
  - item comercial obrigatório, combobox;
  - fator obrigatório `number min=0.001 step=0.001`;
  - vigência inicial obrigatória, default data local atual;
  - vigência final opcional;
  - status ativo/inativo;
  - observações opcionais.
- [ ] POST:

```ts
await fetch('/api/cadastros/regras-desdobramento', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    itemCompraId,
    itemComercialId,
    fatorQuantidade: Number(fator),
    vigenciaInicio,
    ...(vigenciaFim ? { vigenciaFim } : {}),
    status,
    ...(observacoes.trim() ? { observacoes: observacoes.trim() } : {}),
  }),
});
```

- [ ] Em sucesso: fechar, limpar e `await carregar()`. Em falha: manter Dialog aberto e mostrar resposta do backend.
- [ ] Ocultar trash inerte. Preservar simuladores e cards TZ do WIP.
- [ ] Executar os quatro comandos de verificação e conferir as saídas esperadas em E2.3, Task 13.

**Commit da Task 13:** `feat(onda12): criar regras por catálogo`

## Task 14 — Playwright, gate local e entrega ao QO

**Files:** `onda12-dominio-campos-ui.spec.ts`, evidências e relatório.

- [ ] Playwright cobre, com dados reais:
  1. redirects de cliente;
  2. cliente comercial: busca representante/rota, UF e `Nome Fantasia/Marca`;
  3. produto/item compra/item comercial: unidade controlada;
  4. pedido: busca produto e rota herdada;
  5. compras e espelho: busca;
  6. rota: três padrões;
  7. caminhão/motorista: rota/caminhão e UF;
  8. carga: sugestão de motorista/rota;
  9. estoque: fornecedor;
  10. pré-faturamento: placa;
  11. auditoria: usuário;
  12. etiquetas: recebimento;
  13. regra: criar e ver código+nome;
  14. fornecedor: salvar, editar e reexibir parâmetros.
- [ ] Cada tela tocada gera screenshot em `docs/evidencias/onda12-dominio-campos-ui/`, comparável ao arquivo de protótipo da seção 4.
- [ ] Subir ambiente limpo:

```powershell
Set-Location D:\Projetos\AlphaCarnes\Projeto\alpha-carnes\.worktrees\o12
docker compose down -v
docker compose up --build -d
docker compose ps
```

- [ ] Gate completo:

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
npx playwright test e2e/onda12-dominio-campos-ui.spec.ts
```

- [ ] Verificações de escopo:

```powershell
Set-Location D:\Projetos\AlphaCarnes\Projeto\alpha-carnes\.worktrees\o12
git diff --check
git diff --name-only -- "docs/execucao" "landing"
git diff --name-only origin/develop...HEAD
git status --short
```

Saída para `docs/execucao` e `landing` deve ser vazia.

- [ ] Entregar relatório ao Quality Owner contendo:
  - branch `feature/jef`;
  - worktree `.worktrees/o12`;
  - HEAD real;
  - migrations 0031–0033;
  - comandos/resultados;
  - cobertura linha/branch;
  - URLs e credenciais locais já canônicas;
  - roteiro das 14 verificações Playwright;
  - paths das evidências;
  - lista de arquivos WIP preservados.

- [ ] Manter Docker saudável e parar. Não executar `gh pr create`, não fazer merge e não editar estado de execução.

**Commit da Task 14:** `test(onda12): registrar aceite local`

---

## 8. Ordem de execução

```text
T0 → T1 → T2 → T3 → T4 → T5 → T6
T6 → T7 → T8 → T9 → T10 → T11 → T12 → T13 → T14
```

T7–T13 têm ownership de arquivos disjunto após T6, mas o gate e a consolidação permanecem seriais em `feature/jef`.

---

## 9. Gate local de aceite

1. `origin/develop` base real `000f946`; nenhuma regressão da Onda 11.
2. Migrations 0031–0033, próximos números livres comprovados no commit pinado, aplicam em banco limpo e snapshot O11 com dados.
3. Unidade desconhecida interrompe contract explicitamente.
4. Todas as novas escritas persistem IDs; snapshots são derivados no backend.
5. Nenhuma superfície tocada exibe/pede UUID.
6. Oito superfícies SAM-160 são pesquisáveis.
7. 27 UFs idênticas nas três superfícies e no backend.
8. Regra de desdobramento é criada pela UI e listada com código+nome.
9. Parâmetros de fornecedor sobrevivem create/detail/update.
10. Seeds são idempotentes e preservam AD-01/P12.
11. Lint, type-check, testes, cobertura, build e Playwright verdes.
12. Docker `postgres + backend + frontend` saudável em 15433/4001/4000.
13. Zero alteração em `docs/execucao/**` e `landing/**`.
14. Zero PR aberto.

---

## 10. Self-Review para Portão 1

1. **Princípio I:** 18 rotas/superfícies têm arquivo `.tsx` real do protótipo `main @ 8d32aa4c` no path confirmado. Alterações de componente são restritas às issues/QO. ✓
2. **Princípio II:** SAM-157..165, 167 e 168 entram completas, incluindo backend, migration, UI, falha, edição e Playwright; SAM-166 está fora por decisão QO/AD-13. ✓
3. **Princípio III / RA-01:** domínio, FK, atividade e snapshots são validados/derivados no backend. ✓
4. **Princípio IV / RA-02:** mutações de rota/pedido/carga/estoque/regra continuam transacionais e auditadas. ✓
5. **Princípio VI:** nenhum polling novo; eventos existentes de entrada/carga continuam pós-commit. ✓
6. **Princípio VII:** catálogo ausente, FK inválida, unidade desconhecida e parâmetros inválidos falham explicitamente. ✓
7. **Princípio VIII:** assessment §4 não foi transformado em regra; zero cadastro inventado no backfill. ✓
8. **Princípio IX / AD-13 / instrução QO:** `Nome Fantasia/Marca` é preservado; “Marca” isolada permanece proibida fora da exceção. ✓
9. **Princípio X:** UUID persistido, migrations via drizzle-kit 0031/0032 custom/0033, sem perda de snapshots históricos. ✓
10. **WIP:** cadastros, seeds, regras e `next.config.ts` estão inventariados em task própria. ✓
11. **DoD→teste:** SAM-157..165, 167 e 168 possuem teste literal 1:1; AD-13, migrations e WIP têm invariantes adicionais. ✓
12. **Processo QO:** branch/worktree fixados; gate termina local; nenhum PR/Portão 2/estado vivo. ✓
13. **Escopo:** assessment §4, SAM-118, validação UX ampla e landing explicitamente excluídos. ✓
14. **Plano fechado:** não há decisão de produto pendente nem alternativa deixada ao Worker. ✓
