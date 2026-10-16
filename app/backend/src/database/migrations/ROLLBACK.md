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

## 0019 — Onda 5 (relatorios_sif, aprovacoes_operacionais)

```sql
DROP TRIGGER IF EXISTS "trg_aprovacoes_operacionais_updated_at" ON "aprovacoes_operacionais";
DROP TRIGGER IF EXISTS "trg_relatorios_sif_updated_at" ON "relatorios_sif";
DROP TRIGGER IF EXISTS "trg_conclusoes_conferencia_nfs_imutavel" ON "conclusoes_conferencia_nfs";
DROP TRIGGER IF EXISTS "trg_conclusoes_conferencia_imutavel" ON "conclusoes_conferencia";
DROP FUNCTION IF EXISTS "conclusao_conferencia_imutavel"();
DROP TABLE IF EXISTS "aprovacoes_operacionais";
DROP TABLE IF EXISTS "relatorios_sif_versoes";
DROP TABLE IF EXISTS "relatorios_sif";
```

Os índices e constraints das três tabelas (`uq_relatorios_sif_operacao_tipo`,
`idx_relatorios_sif_status`, `idx_relatorios_sif_pendencias_gin`, `uq_sif_versao`,
`idx_sif_versao_relatorio`, `idx_aprovacoes_operacao`, `idx_aprovacoes_status`,
`idx_aprovacoes_referencia` e as FKs para `operacoes`/`usuarios`/`relatorios_sif`) caem
junto com os `DROP TABLE`, sem passo adicional. Os dois triggers de imutabilidade do
comparativo Pedido × NF × Pesagem (`conclusoes_conferencia*`) precisam ser removidos
**antes** da função `conclusao_conferencia_imutavel()`, pois dependem dela.

## 0020 — Onda 5 E5.1 (usuarios_representantes)

```sql
DROP TABLE IF EXISTS usuarios_representantes;
```

Todo DDL desse hotfix nasce do delta do schema pelo Drizzle. O arquivo custom
contém somente DML/PLpgSQL; journal e snapshots não são editados. Essa reversão
preserva `rota_id`, `adendos_pedido`, `tabelas_preco`,
`tabelas_preco_itens` e `tabelas_preco_publicacoes`.

## 0021 / 0022 — Onda 6 (Recebimento & Balança)

A onda é puramente aditiva. Restaurar a revisão anterior da aplicação **não**
exige desfazer `0021`/`0022` em produção: a app antiga ignora colunas/tabelas
novas. Rollback estrutural (ambiente de desenvolvimento / hotfix) segue o
precedente da Onda 4 — forward-only via `drizzle-kit generate`, sem `ALTER TABLE`
manual colado neste documento.

### Objetos introduzidos em `0021` (expand gerado)

- Tabela `trocas_peca` + CHECKs `chk_trocas_peca_destino`, `chk_trocas_peca_motivo`,
  `chk_trocas_peca_pecas_distintas`, `chk_trocas_peca_pesos_positivos`
- Índices `idx_trocas_peca_recebimento`, `idx_trocas_peca_pedido`,
  `idx_trocas_peca_retirada`, `idx_trocas_peca_inserida`
- Colunas em `etiquetas_impressoes`: `estado`, `motivo_cancelamento`,
  `invalidada_em`, `invalidada_por_id` + CHECKs `chk_etiq_estado`,
  `chk_etiq_cancelada_motivo` + índice `idx_etiq_estado`
- CHECK reescrito `chk_assoc_hist_acao` (ações `estorno`/`troca_saida`/`troca_entrada`)
- CHECK reescrito `chk_aprovacao_tipo` (valor `pendencia_fisica_etiqueta` — D6.21/P10)

### `0022` (custom — só DML)

Backfill determinístico de `etiquetas_impressoes.estado` a partir de
`reimpressao`/`status_impressao`. Reaplicar é idempotente. Nenhum DDL neste arquivo.

```sql
-- Referência do conteúdo versionado em 0022_onda6_etiqueta_estado_backfill.sql
-- (não executar isolado — aplicar via drizzle migrate).
UPDATE "etiquetas_impressoes" SET "estado" = 'reimpressa'
 WHERE "estado" = 'emitida' AND "reimpressao" = true;
UPDATE "etiquetas_impressoes" SET "estado" = 'ativa'
 WHERE "estado" = 'emitida' AND "reimpressao" = false
   AND "status_impressao" = 'impressa';
```

## E01-T01 — `0044_e01_t01_empresas_estabelecimentos` (expand-only)

Migration gerada por `drizzle-kit generate --name e01_t01_empresas_estabelecimentos`, sem SQL manual.
Somente `CREATE TABLE`, `CREATE [UNIQUE] INDEX` e `ALTER TABLE <tabela nova> ADD CONSTRAINT` sobre as
seis tabelas novas:

- `empresas`
- `estabelecimentos` (`UNIQUE (id, empresa_id)` não parcial — D-E01)
- `estabelecimento_cnaes`
- `estabelecimento_alteracoes`
- `estabelecimento_alteracao_cnaes`
- `regimes_tributarios`

Rollback:

- Código: revert dos commits da fatia por PR (sem force-push); o revert devolve `MENUS_CANONICOS` às 39
  rotas e o próximo seed reconcilia `menus_visiveis`.
- Banco: só tabelas folha (nenhuma FK externa aponta para elas até E12-T01/E06-T01). Dev/CI sem dados:
  remover o schema e gerar a migration de remoção com `drizzle-kit generate` (nunca SQL manual). Com linhas:
  não remover; as tabelas ficam inertes e abre-se decisão do Quality Owner.
- Seed: chave `fiscal.empresas_perfis_autorizados` e permissões `FISCAL_EMPRESAS_*` saem só junto do revert.

## E01-T02 — enquadramentos fiscais e catálogos manuais de CFOP e NCM

Migration gerada por `drizzle-kit generate --name e01_t02_enquadramentos`, sem SQL manual.
Somente `CREATE TABLE`, `CREATE [UNIQUE] INDEX` e `ALTER TABLE <tabela nova> ADD CONSTRAINT` sobre as
três tabelas novas, nesta ordem de remoção:

- `enquadramentos_fiscais`
- `ncms`
- `cfops`

Não há `INSERT` de semente de CFOP ou NCM. Não há colunas de data comercial, fiscal ou efetiva.

Rollback:

- Código: revert dos commits da fatia por PR (sem force-push).
- Banco: só tabelas folha. Dev/CI sem dados: remover o schema e gerar a migration de remoção com
  `drizzle-kit generate` (nunca SQL manual), na ordem `enquadramentos_fiscais`, `ncms`, `cfops`.
  Com linhas: não remover; as tabelas ficam inertes e abre-se decisão do Quality Owner.
- Seed: a chave `fiscal.enquadramentos_perfis_autorizados` e as permissões `FISCAL_ENQUADRAMENTOS_*`
  saem só junto do revert.

## E01-T03 — regras tributárias e catálogos manuais de benefício e classificação

Migration gerada por `drizzle-kit generate --name e01_t03_regras_tributarias`, sem SQL manual.
Somente `CREATE TABLE`, `CREATE [UNIQUE] INDEX` e `ALTER TABLE <tabela nova> ADD CONSTRAINT` sobre as
três tabelas novas, nesta ordem de remoção:

```sql
DROP TABLE IF EXISTS regras_tributarias;
DROP TABLE IF EXISTS classificacoes_ibs_cbs;
DROP TABLE IF EXISTS beneficios_fiscais;
```

Não há `INSERT` de semente de benefício ou classificação. Não há coluna CSOSN, IS, versão de NT,
data comercial, fiscal ou efetiva, nem FK para `notas_fiscais`. Não derrubar `enquadramentos_fiscais`,
`cfops`, `ncms`, `estabelecimentos` nem `empresas`.

Rollback:

- Código: revert dos commits da fatia por PR (sem force-push).
- Banco: só tabelas folha. Dev/CI sem dados: remover o schema e gerar a migration de remoção com
  `drizzle-kit generate` (nunca SQL manual), na ordem `regras_tributarias`, `classificacoes_ibs_cbs`,
  `beneficios_fiscais`. Com linhas: não remover; as tabelas ficam inertes e abre-se decisão do Quality Owner.
- Seed: a chave `fiscal.regras_perfis_autorizados`, as permissões `FISCAL_REGRAS_*` e o item de menu
  saem só junto do revert. A chave `fiscal.enquadramentos_perfis_autorizados` fica.

## E01-T04 — simulação fiscal e memória de cálculo

Migration gerada por `drizzle-kit generate --name e01_t04_simulacoes_fiscais`, sem SQL manual.
Somente `CREATE TABLE`, `CREATE [UNIQUE] INDEX` e `ALTER TABLE "simulacoes_fiscais" ADD CONSTRAINT`.

```sql
DROP TABLE IF EXISTS simulacoes_fiscais;
```

Não há coluna de nota nem de data comercial, fiscal ou efetiva. Não derrubar `regras_tributarias`,
`classificacoes_ibs_cbs`, `beneficios_fiscais`, `enquadramentos_fiscais`, `cfops`, `ncms`,
`estabelecimentos` nem `empresas`.

Rollback:

- Código: revert dos commits da fatia por PR (sem force-push).
- Banco: só a tabela folha. Dev/CI sem dados: `DROP TABLE IF EXISTS simulacoes_fiscais;`.
- Seed: a chave `fiscal.simulacoes_perfis_autorizados`, as permissões `FISCAL_SIMULACOES_*` e o item de menu
  saem só junto do revert. As chaves `fiscal.regras_perfis_autorizados` e
  `fiscal.enquadramentos_perfis_autorizados` ficam.

## E01-T05 — painel de homologação de regras tributárias

```sql
DROP TABLE IF EXISTS cenarios_regressao;
DROP TABLE IF EXISTS homologacoes_regras;
```

Não derrubar `simulacoes_fiscais`, `regras_tributarias`, `classificacoes_ibs_cbs`, `beneficios_fiscais`,
`enquadramentos_fiscais`, `cfops`, `ncms`, `estabelecimentos` nem `empresas`. Reverter o parâmetro
`fiscal.homologacoes_perfis_autorizados`, as três permissões e o item de menu no mesmo revert da fatia.
Os parâmetros `fiscal.simulacoes_perfis_autorizados`, `fiscal.regras_perfis_autorizados` e
`fiscal.enquadramentos_perfis_autorizados` ficam.
