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

## Onda 4 — rollback de aplicação gerado

A reversão da aplicação segue a ordem lógica `0018` → `0017` → `0016`, mas não
remove `rota_id`, índices nem as quatro tabelas da Onda 4. O objetivo é restaurar
compatibilidade com a revisão anterior sem perder dados:

1. abrir um hotfix no SHA que está em produção;
2. reintroduzir `rotaPadrao: text('rota_padrao')` em
   `clientes.schema.ts` e executar `drizzle-kit generate
   --name=onda4_comercial_rollback_expand`;
3. sem alterar o schema, executar `drizzle-kit generate --custom
   --name=onda4_comercial_rollback_backfill`;
4. preencher somente o SQL custom com o `UPDATE` que restaura
   `clientes.rota_padrao` a partir de `rotas.codigo` via `rota_id`, seguido de
   uma guarda `DO`/`RAISE EXCEPTION` para qualquer associação não restaurada;
5. aplicar as duas migrations geradas e somente então restaurar a revisão
   anterior da aplicação.

Todo DDL desse hotfix nasce do delta do schema pelo Drizzle. O arquivo custom
contém somente DML/PLpgSQL; journal e snapshots não são editados. Essa reversão
preserva `rota_id`, `adendos_pedido`, `tabelas_preco`,
`tabelas_preco_itens` e `tabelas_preco_publicacoes`.
