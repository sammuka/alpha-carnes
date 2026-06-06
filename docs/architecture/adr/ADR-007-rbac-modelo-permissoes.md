# ADR-007 — RBAC N:N, Permissões Nomeadas e Modelo de Autorização

**Data:** 2026-06-05
**Status:** Aceita
**Supersede parcialmente:** ADR-005 (autenticação JWT + RBAC)

## Contexto

O modelo lógico inicial (modelo-logico-postgres.md §1.6) definia `usuarios.perfil` como uma coluna TEXT com CHECK constraint de 11 valores — um modelo mono-perfil. Ao implementar a F1, identificamos que:

1. O sistema tem 11 perfis distintos (doc 013) com responsabilidades bem delimitadas.
2. A autorização por "perfil" direto não é granular o suficiente para as regras de segregação de funções (SF-01..SF-04 do doc 013).
3. Um usuário pode precisar de múltiplos perfis em operações futuras (ex.: gestor que também é aprovador).
4. O ADR-005 já previa `requirePermissao('FECHAR_EXPEDICAO')` — ou seja, permissões nomeadas, não apenas perfis.

Adicionalmente, o ADR-003 decidiu usar UUID v7 (`uuidv7()`) como PK (ordenável por tempo), mas as convenções de schema (`convencoes-schema.md`) ainda referenciavam `gen_random_uuid()`. Esta ADR reconcilia ambos.

## Decisão

### 1. RBAC N:N — substituição da coluna única por modelo relacional

Substituir `usuarios.perfil TEXT CHECK(...)` pelo modelo:

- `perfis` — catálogo dos 11 perfis do sistema (slug canônico + nome + descrição)
- `usuarios_perfis` — N:N entre usuários e perfis (um usuário pode ter múltiplos perfis)
- `permissoes` — catálogo de permissões nomeadas do sistema
- `perfis_permissoes` — N:N entre perfis e permissões (mapa perfil → conjunto de permissões)

O Guard de autorização (`RbacGuard`) usa o decorator `@RequirePermissoes('CODIGO_PERMISSAO')` e resolve as permissões efetivas do usuário a partir da união das permissões de todos os seus perfis.

### 2. Os 11 slugs canônicos (fonte: doc 013)

| Slug | Perfil |
|------|--------|
| `administrador` | Administrador do Sistema |
| `compras` | Comprador / Operador de Compras |
| `gestor` | Gestor Comercial / Operacional |
| `comercial` | Operador Comercial |
| `recebimento_pesagem` | Operador de Recebimento / Pesagem |
| `corte` | Operador de Corte |
| `expedicao` | Operador de Expedição |
| `conferente` | Conferente |
| `faturamento` | Faturamento / Fiscal |
| `logistica` | Logística / Liberação |
| `diretoria` | Diretoria / Gestão Executiva |

### 3. Permissões nomeadas da F1

| Código | Descrição |
|--------|-----------|
| `USUARIOS_GERENCIAR` | Criar e editar usuários |
| `USUARIOS_APROVAR` | Aprovar novos usuários (não pode ser o criador — SF-01) |
| `PERFIS_GERENCIAR` | Gerenciar o catálogo de perfis |
| `AUDITORIA_VISUALIZAR` | Consultar log de auditoria |

**Mapa F1:**
- `administrador` → `USUARIOS_GERENCIAR`, `USUARIOS_APROVAR`, `PERFIS_GERENCIAR`, `AUDITORIA_VISUALIZAR`
- `gestor` → `USUARIOS_APROVAR`, `AUDITORIA_VISUALIZAR`
- `diretoria` → `AUDITORIA_VISUALIZAR`
- Demais perfis → sem permissões administrativas na F1

Novas permissões serão adicionadas nas fases F2+ conforme os domínios forem implementados.

### 4. Segregação de funções — mecanismo genérico (SF-01)

O backend implementa `assertCriadorNaoAprovador(criadorId: string, aprovadorId: string)` — lança exceção se os IDs forem iguais. Aplicado em F1 na aprovação de usuários. Em F2+, o mesmo mecanismo cobre SF-02 (carga/exceção fiscal), SF-03 (NF/carga), SF-04 (liberação/composição).

### 5. UUID v7 como PK padrão

Conforme ADR-003 (UUIDs v7 ordenáveis por tempo), **todas as PKs usam `uuidv7()` nativo do PostgreSQL 18**, não `gen_random_uuid()`. No Drizzle ORM: `.primaryKey().default(sql\`uuidv7()\`)`.

> **Verificação necessária no db:migrate:** confirmar que a função `uuidv7()` existe na imagem `postgres:18` sem extensão adicional. Se ausente, registrar e ajustar explicitamente — nunca degradar silenciosamente (RA-05).

### 6. Fronteira do padrão de auditoria (RA-02)

**F1:** A auditoria de login e ações administrativas é implementada via `AuditoriaInterceptor`. O interceptor insere o registro em `auditoria` **somente após o sucesso** do handler (ação falha ⇒ sem registro de auditoria de sucesso). Falha do próprio interceptor é observável e nunca silenciosa (RA-05/RA-06).

**F3 em diante:** A auditoria de **mutações críticas** (reserva de saldo, fechamento de expedição, faturamento) é feita **dentro da transação do service** — não via interceptor. Isso garante atomicidade: se a transação de negócio fizer rollback, o registro de auditoria também desfaz. Esta fronteira evita refactor não planejado em F3.

## Consequências

### Positivas
- Autorização granular por permissão nomeada, extensível sem refactor do Guard
- Segregação de funções implementável declarativamente em qualquer domínio de F2+
- Slugs canônicos elimnam ambiguidade entre doc 013, ADR-005 e modelo lógico
- UUID v7 melhora localidade de cache e debuggability (PKs ordenadas por tempo)
- Fronteira de auditoria explícita evita débito técnico silencioso em F3

### Negativas / Trade-offs
- Maior complexidade no schema de auth (5 tabelas vs 1 coluna)
- Mitigação: as 5 tabelas são simples e bem indexadas; a complexidade é justificada pela escala de 11 perfis e permissões futuras

## Referências
- docs/013-perfis-acesso-papeis-aprovacoes-e-segregacao-de-funcoes.md
- ADR-003 (banco de dados — UUID v7)
- ADR-005 (autenticação JWT + RBAC — supersedida parcialmente)
- docs/data/modelo-logico-postgres.md §1.6 (substituído por este ADR)
- docs/data/convencoes-schema.md (atualizado para uuidv7)
