# ADR-008 — Resolução de Permissões a partir do Banco e Gestão em Runtime

**Data:** 2026-06-06
**Status:** Aceita
**Estende:** ADR-007 (§3 — modelo de permissões nomeadas)
**Decidida em:** Fase F2 (Cadastros Base)

## Contexto

O ADR-007 definiu o modelo RBAC N:N com a tabela `perfis_permissoes` como "mapa
perfil → conjunto de permissões". Na F1, por simplicidade de bootstrap, a resolução
das permissões efetivas no login foi feita a partir de um **mapa hardcoded em código**
(`MAPA_PERFIL_PERMISSOES`), e a tabela `perfis_permissoes` era populada pelo seed mas
não consultada na resolução.

A F2 entrega a **gestão de usuários/perfis** (DoD F2), incluindo editar quais permissões
cada perfil possui. Isso exige que a fonte da verdade da autorização seja o **banco**
(`perfis_permissoes`), não um mapa estático no código — caso contrário, qualquer alteração
de permissão exigiria deploy.

## Decisão

### 1. A resolução de permissões lê do banco
`RbacService.resolverPermissoes()` passa a resolver as permissões efetivas do usuário a
partir de `perfis_permissoes` (join pelos perfis do usuário), **não** mais do mapa hardcoded.
A resolução acontece no **login/refresh**, e as permissões resultantes são embutidas no
access token (como na F1).

### 2. O mapa em código vira apenas bootstrap
`MAPA_PERFIL_PERMISSOES` (e o seed) passam a ter um único papel: **popular** `perfis_permissoes`
na primeira carga (idempotente, `onConflictDoNothing`). Não participam mais da decisão de
autorização em runtime.

### 3. Gestão de permissões de perfil em runtime
Endpoints protegidos por `PERFIS_GERENCIAR` permitem listar e editar as permissões de cada
perfil (`perfis_permissoes`). Os 11 perfis em si permanecem fixos (catálogo por seed + CHECK);
o que é editável é o **conjunto de permissões** de cada perfil. Toda alteração é auditada.

### 4. Limitação conhecida — propagação no próximo login
A alteração de permissões de um perfil reflete no acesso efetivo **somente no próximo
login/refresh** do usuário afetado, porque as permissões viajam no access token (TTL 15 min).
**Nesta fase não há invalidação ativa de tokens** já emitidos.

- Isso é aceitável: a janela máxima de defasagem é o TTL do access token (15 min).
- Não é falha silenciosa (RA-05): o comportamento é determinístico e documentado.
- Revisão futura (quando houver necessidade real): invalidação ativa via lista de revogação
  por usuário/versão de permissões, ou verificação de permissão contra o banco em rotas de
  alto risco. **Não** será implementado agora para evitar over-engineering.

## Consequências

### Positivas
- Banco como fonte única da verdade da autorização (cumpre o desenho do ADR-007 §1).
- Gestão de permissões sem deploy.
- Caminho de auditoria completo nas alterações de permissão de perfil.

### Negativas / Trade-offs
- Defasagem de até 15 min na propagação de mudança de permissão (mitigada pelo TTL curto).
- Um join a mais no login (desprezível; `perfis_permissoes` é pequeno e indexado).

### Invariantes de teste (exigidos no gate da F2)
- Todos os e2e/unit de auth da F1 permanecem verdes com a resolução vinda do banco
  (o `test-app`/seed popula `perfis_permissoes`).
- Teste novo: editar as permissões de um perfil altera o acesso efetivo **no próximo login**
  (com permissão removida → 403; adicionada → 200).

## Referências
- ADR-007 (modelo RBAC N:N e permissões nomeadas) — §3
- ADR-005 (autenticação JWT — TTL do access token)
- docs/013-perfis-acesso-papeis-aprovacoes-e-segregacao-de-funcoes.md
- docs/governance/quality-gates.md (DoD F2)
