# Convenções de Schema — AlphaCarnes

## Nomenclatura
- Tabelas: `snake_case` plural (ex: `pedidos_venda`, `disponibilidades_virtuais`)
- Colunas: `snake_case` (ex: `created_at`, `pedido_id`)
- PKs: sempre `id UUID`
- FKs: `{entidade_referenciada}_id` (ex: `pedido_id`, `cliente_id`)
- Índices: `idx_{tabela}_{coluna(s)}`
- Constraints: `{tabela}_{descricao}_{tipo}` (ex: `pecas_status_valido_check`)

## Tipos de dado obrigatórios por categoria
- PKs: `UUID DEFAULT uuidv7()` (PostgreSQL 18 nativo — ordenável por tempo, conforme ADR-003 e ADR-007)
- Datas/horas: sempre `TIMESTAMPTZ` (com timezone)
- Valores monetários: `NUMERIC(15,2)` — nunca FLOAT
- Pesos: `NUMERIC(10,3)` — 3 casas decimais (gramas como unidade mínima)
- Alíquotas/percentuais: `NUMERIC(5,4)` (ex: 0.0500 = 5%)
- Textos curtos: `VARCHAR(n)` com limite explícito
- Textos longos/livres: `TEXT`
- Flags: `BOOLEAN NOT NULL DEFAULT false`
- Status/enums: `TEXT` com CHECK constraint (não usar pg ENUM — difícil de migrar)
- Dados semiestruturados: `JSONB DEFAULT '{}'`

## Colunas obrigatórias em todas as tabelas de negócio
```sql
created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()  -- atualizado por trigger
deleted_at   TIMESTAMPTZ  -- NULL = ativo; NOT NULL = soft deleted
```

## Regras de soft delete
- Nunca DELETE físico em entidades de negócio
- Todas as queries filtram `WHERE deleted_at IS NULL`
- Índices parciais com `WHERE deleted_at IS NULL`
- Apenas dados de sessão/cache podem ser deletados fisicamente

## Auditoria
Tabelas críticas têm trigger que registra em `auditoria`:
- `compras_programadas`, `pedidos_venda`, `disponibilidades_virtuais`
- `pecas`, `pesagens`, `associacoes`
- `expedicoes`, `fechamentos_expedicao`
- `notas_fiscais`

## Drizzle ORM — convenções de schema TypeScript
- Um arquivo de schema por domínio em `backend/src/database/schema/`
- Tipos inferidos com `$inferSelect` e `$inferInsert`
- Relações declaradas com `relations()` do Drizzle
- Migrations geradas com `drizzle-kit generate`; nunca ALTER TABLE manual em produção

## JSONB — quando usar e quando não usar
**Usar JSONB para:**
- Dados que variam por tipo de entidade (atributos de peça, preferências de cliente)
- Payloads de integração externa (payload EISS para auditoria)
- Dados de snapshot/auditoria (estado antes/depois)
- Configurações e parâmetros que mudam pouco

**NÃO usar JSONB para:**
- Campos com cardinalidade fixa que são filtrados frequentemente
- Campos que participam de JOINs
- Campos que precisam de constraint de integridade referencial
- Valores monetários ou de peso (usar tipos NUMERIC tipados)

## Índices obrigatórios
- Todo campo FK tem índice: `CREATE INDEX idx_{tabela}_{campo} ON {tabela}({campo})`
- Todo campo `status` tem índice parcial: `WHERE deleted_at IS NULL`
- Todo campo JSONB filtrado tem índice GIN: `USING GIN({campo})`
- Campos de data em tabelas de transação: `idx_{tabela}_created_at`

## Migrações
- Sempre usar `drizzle-kit generate` para gerar migrations
- Nunca `ALTER TABLE` manual em produção
- Migrations são commitadas no repositório em `app/backend/src/database/migrations/`
- Nome da migration: `{timestamp}_{descricao_snake_case}.sql`
- Toda migration é testada em homologação antes de produção

## Checklist de nova tabela
- [ ] PK `id UUID`
- [ ] `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- [ ] `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- [ ] `deleted_at TIMESTAMPTZ` (se entidade de negócio)
- [ ] Status como `TEXT` com CHECK constraint (se aplicável)
- [ ] Índices em todas as FKs
- [ ] Índice GIN se tiver coluna JSONB filtrada
- [ ] Trigger `set_updated_at` aplicado
- [ ] Schema Drizzle correspondente criado
