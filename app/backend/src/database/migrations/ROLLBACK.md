# Rollback de Migrations — F1

## Migration inicial (0000_initial_auth_rbac)

Esta é a primeira migration do sistema. Não há down script — o rollback é feito
recriando o banco do zero:

```bash
docker compose down -v   # remove o volume do postgres
docker compose up --build # sobe tudo do zero (migrate + seed no entrypoint)
```

A partir de F2+, migrations que alterem schema existente incluirão down scripts
explícitos por arquivo de migration.

## Onda 1 — ordem de rollback (contract → backfill → expand)

Rollback estrutural da correção Onda 1 **nesta ordem**:

1. `0014_onda1_contract`
2. `0013_onda1_backfill`
3. `0012_onda1_expand`

### 0014 (contract)

Antes de dropar FKs/`operacao_id` NOT NULL e recriar colunas removidas:

- Restaurar `data_operacao` nas seis tabelas de fato a partir de `operacoes.data`
  (`UPDATE ... SET data_operacao = o.data FROM operacoes o WHERE ...operacao_id = o.id`).
- Restaurar cache `nfe_*` em `recebimentos` a partir de `notas_fiscais_fornecedor`
  (número/série/chave/data/pesos) **antes** de qualquer DROP das tabelas novas no
  rollback do expand.
- Reabrir CHECKs ao superset transitório do `0012` (legado ∪ final) se o banco
  ainda contiver linhas com status/tipos finais.

### 0013 (backfill)

Reverter remapeamentos de status e tipos de divergência somente se houver
necessidade de voltar ao estado pré-backfill; caso contrário, dropar o journal
entry após o contract já ter sido revertido.

### 0012 (expand)

Somente depois de restaurar `data_operacao` e o cache de NF:

- Remover tabelas/colunas introduzidas na expand (`operacoes`, FKs nullable,
  `pedidos_fornecedor`, `notas_fiscais_fornecedor`, `conclusoes_conferencia*`,
  `pendencias_overbooking*`, etc.).

## 0015 — Onda 3

```sql
DROP TRIGGER IF EXISTS "trg_modelos_etiqueta_updated_at" ON "modelos_etiqueta";
DROP TRIGGER IF EXISTS "trg_frota_motoristas_updated_at" ON "frota_motoristas";
DROP TRIGGER IF EXISTS "trg_frota_caminhoes_updated_at" ON "frota_caminhoes";
DROP TABLE IF EXISTS "modelos_etiqueta";
DROP TABLE IF EXISTS "frota_motoristas";
DROP TABLE IF EXISTS "frota_caminhoes";
ALTER TABLE "rotas" DROP COLUMN IF EXISTS "dias_atendimento";
ALTER TABLE "rotas" DROP COLUMN IF EXISTS "paradas";
ALTER TABLE "perfis" DROP COLUMN IF EXISTS "menus_visiveis";
```

## Onda 4 — ordem de rollback (contract → expand)

Rollback estrutural da Onda 4 **nesta ordem**:

1. `0017_onda4_comercial_contract`
2. `0016_onda4_comercial_expand`

### 0017 (contract)

Antes de dropar `clientes.rota_padrao`, restaurar o valor a partir de `rotas.codigo`
via `clientes.rota_id` caso seja necessário reverter:

```sql
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "rota_padrao" text;
UPDATE "clientes" c SET "rota_padrao" = r."codigo"
  FROM "rotas" r WHERE c."rota_id" = r."id";
```

### 0016 (expand)

```sql
ALTER TABLE "clientes" DROP COLUMN IF EXISTS "rota_id";
DROP TABLE IF EXISTS "tabelas_preco_publicacoes";
DROP TABLE IF EXISTS "tabelas_preco_itens";
DROP TABLE IF EXISTS "tabelas_preco";
DROP TABLE IF EXISTS "adendos_pedido";
```
