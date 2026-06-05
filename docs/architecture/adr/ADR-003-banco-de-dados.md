# ADR-003 — Banco de Dados: PostgreSQL 18 + JSONB

**Data:** 2026-06-04
**Status:** Aceita

## Contexto
O sistema requer: consistência transacional forte (ACID) para operações críticas (associação de peça, fechamento de expedição, faturamento), rastreabilidade de auditoria, suporte a dados semiestruturados (preferências de cliente, parâmetros de peça, payload fiscal), e operação on-premises.

## Decisão
Usaremos **PostgreSQL 18** como banco transacional único com **JSONB habilitado**.

### Uso de JSONB
JSONB será usado para dados que variam por tipo ou têm estrutura flexível:
- `clientes.preferencias` — peso mínimo/máximo, perfil de gordura, preferências por item
- `pecas.atributos` — dados específicos do tipo de corte (ex: peso de osso, rendimento)
- `notas_fiscais.payload_eiss` — XML/JSON da requisição e resposta EISS para auditoria
- `eventos_dominio.payload` — payload de cada evento de domínio
- `auditoria.dados_anteriores` / `auditoria.dados_novos` — snapshot de estado para auditoria

### Campos estruturados permanecem como colunas tipadas
Tudo que tem cardinalidade fixa e é indexado ou filtrado é coluna tipada. JSONB é para extensibilidade, não para substituir o modelo relacional.

### Convenções
- UUIDs v7 como PKs (ordenáveis por tempo)
- `created_at TIMESTAMPTZ DEFAULT now()` em todas as tabelas
- `updated_at TIMESTAMPTZ` com trigger de atualização automática
- Soft delete com `deleted_at TIMESTAMPTZ` (nunca DELETE físico em entidades de negócio)
- Auditoria via tabela `auditoria` com trigger em tabelas críticas

## Consequências

### Positivas
- ACID completo para operações transacionais críticas
- JSONB com índices GIN: queries eficientes em dados semiestruturados
- PostgreSQL 18 tem performance excelente para o volume previsto (operação local)
- Drizzle ORM suporta JSONB nativamente com tipagem TypeScript

### Negativas / Trade-offs
- Banco único = ponto único de falha; mitigação: backup contínuo + réplica de leitura local
- JSONB não tem schema enforcement no banco; mitigação: validação via Zod no backend antes de persistir

### Riscos
- **Performance em queries JSONB sem índice:** mitigação: índices GIN obrigatórios em colunas JSONB que participam de filtros
- **Migração de schema:** mitigação: Drizzle Kit para migrations versionadas, nunca ALTER TABLE manual em produção

## Alternativas Consideradas

### MySQL 8
Suporte a JSON inferior ao PostgreSQL. JSONB do PostgreSQL é indexável com GIN; JSON do MySQL não tem o mesmo nível de suporte. Descartado.

### MongoDB
Sem ACID completo em transações multi-documento até versão recente. Operações de fechamento de expedição e faturamento exigem garantias transacionais fortes. Descartado.

## Referências
- docs/010-modelo-de-dados-conceitual-e-entidades-principais-do-sistema.md
- docs/011-modelo-logico-inicial-banco-de-dados-tabelas-e-relacionamentos.md
