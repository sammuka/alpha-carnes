# ADR-005 — Autenticação e Autorização: JWT + RBAC

**Data:** 2026-06-04
**Status:** Aceita

> **Nota (2026-06-05):** Supersedida parcialmente pela **ADR-007**. O vínculo usuário↔perfil passa a ser N:N (`usuarios_perfis`) e a autorização usa permissões nomeadas resolvidas a partir dos perfis do usuário. Os slugs canônicos dos 11 perfis estão na ADR-007. O mecanismo JWT (access/refresh, TTLs, revogação) permanece como decidido aqui.

## Contexto
O sistema tem 11 perfis de acesso distintos (conforme doc 013): Administrador, Compras, Comercial, Operador de Pesagem, Operador de Corte, Operador de Expedição, Conferente, Faturamento, Gestor, Diretoria, Auditoria. Cada perfil tem capacidades específicas e algumas ações exigem aprovação de outro perfil (segregação de funções).

## Decisão
Usaremos **JWT (access + refresh token)** com **RBAC (Role-Based Access Control)** implementado no backend.

### Estrutura do JWT
```json
{
  "sub": "uuid-do-usuario",
  "perfil": "operador_pesagem",
  "nome": "João Silva",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### Access token: 15 minutos. Refresh token: 8 horas (turno de trabalho).
### Refresh tokens armazenados no banco (revogáveis).

### RBAC
- Permissões definidas em `docs/013-perfis-acesso-papeis-aprovacoes-e-segregacao-de-funcoes.md`
- Middleware `requirePermissao('FECHAR_EXPEDICAO')` em cada endpoint crítico
- Segregação de funções: ações que exigem dois perfis distintos (ex: aprovar divergência)

## Consequências

### Positivas
- Stateless no access token: backend horizontal se necessário
- Refresh token revogável: logout forçado em caso de comprometimento
- RBAC declarativo: fácil auditar quem pode fazer o quê

### Negativas / Trade-offs
- JWT não revogável imediatamente (access token válido por 15min mesmo após logout)
- Mitigação: access token curto (15min) + refresh token revogável no banco

## Alternativas Consideradas

### Sessão no servidor (session cookie)
Stateful, requer Redis para multi-instância. Mais simples mas acoplado. Descartado em favor de JWT para facilitar futuras integrações mobile/tablet.

### OAuth2 / OpenID Connect
Over-engineering para operação interna. Descartado.

## Referências
- docs/013-perfis-acesso-papeis-aprovacoes-e-segregacao-de-funcoes.md
