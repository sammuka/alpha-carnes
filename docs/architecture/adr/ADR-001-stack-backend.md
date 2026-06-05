# ADR-001 — Stack Backend: NestJS 11 + TypeScript

**Data:** 2026-06-04
**Status:** Aceita

## Contexto
O backend precisa suportar: API REST para operações transacionais críticas, WebSocket/SSE para tempo real, integração com hardware serial (balança), integração SOAP com EISS NFS-e, e operação on-premises. O sistema tem domínios bem definidos (compras, pedidos, pesagem, expedição, faturamento) com regras de negócio próprias e necessidade de isolamento entre eles.

A premissa de **arquitetura clean sem over-engineering** se aplica diretamente aqui: NestJS oferece estrutura modular por injeção de dependência, o que organiza o código naturalmente sem exigir padrões arquiteturais extras (sem CQRS, sem event sourcing, sem camadas desnecessárias).

## Decisão
Usaremos **NestJS 11** (Node.js LTS v22+) com **TypeScript 5 strict**.

### Por que NestJS e não Express puro
NestJS resolve três problemas reais deste projeto sem adicionar complexidade desnecessária:
1. **Módulos isolados por domínio** — cada domínio (compras, pedidos, pesagem...) é um `@Module()` com seus próprios controllers, services e dependências. Sem acoplamento acidental.
2. **Injeção de dependência nativa** — services são injetáveis, testáveis isoladamente, sem precisar de fábricas manuais.
3. **Pipes, Guards e Interceptors** — validação (Zod/class-validator), autenticação (JWT Guard) e auditoria (Interceptor) são declarativos e reutilizáveis, sem middleware espalhado.

### O que NÃO vamos usar do NestJS
Para manter a arquitetura clean e evitar over-engineering, **não vamos usar**:
- CQRS module (`@nestjs/cqrs`) — desnecessário para este volume
- Event Sourcing — payload JSONB no PostgreSQL é suficiente para auditoria
- Microservices transport (`@nestjs/microservices`) — monolito modular é o suficiente
- GraphQL — REST é simples e suficiente para todas as telas

### Bibliotecas complementares
| Biblioteca | Uso | Justificativa |
|-----------|-----|---------------|
| **Drizzle ORM** | PostgreSQL type-safe | SQL previsível, JSONB nativo, sem magia |
| **Zod 4** | Validação de input/output | Type-safe em runtime, integra com DTOs |
| **@nestjs/jwt + passport** | Autenticação JWT | Padrão NestJS, Guards declarativos |
| **@nestjs/websockets + ws** | WebSocket tempo real | Nativo NestJS, sem Socket.io desnecessário |
| **@nestjs/bull (BullMQ)** | Filas assíncronas | Impressão, retry NFS-e — só onde há necessidade real |
| **node-serialport** | Balança RS-232 | Única opção para serial no Node.js |
| **node-soap** | Cliente SOAP EISS | Necessário para NFS-e |
| **pino + nestjs-pino** | Logging estruturado | Zero overhead, JSON nativo |

### Estrutura de módulos (limpa, sem camadas extras)
```
app/backend/src/
├── app.module.ts
├── modules/
│   ├── auth/           ← AuthModule (JWT, Guards, RBAC)
│   ├── cadastros/      ← CadastrosModule (clientes, fornecedores, itens)
│   ├── compras/        ← ComprasModule (compra programada, disponibilidade)
│   ├── pedidos/        ← PedidosModule (pedidos, reservas)
│   ├── pesagem/        ← PesagemModule (pesagem, associação sugestiva)
│   ├── expedicao/      ← ExpedicaoModule (caminhão, conferência, fechamento)
│   ├── faturamento/    ← FaturamentoModule (NFS-e, DANFE, liberação)
│   └── dashboards/     ← DashboardsModule (KPIs, alertas, histórico)
├── common/
│   ├── guards/         ← RbacGuard, JwtAuthGuard
│   ├── interceptors/   ← AuditoriaInterceptor
│   └── pipes/          ← ZodValidationPipe
├── database/
│   ├── schema/         ← Drizzle schemas por domínio
│   └── migrations/
└── main.ts
```

Cada módulo tem: `controller.ts`, `service.ts`, `module.ts`. Sem repositórios separados (Drizzle já é a camada de dados).

## Consequências

### Positivas
- Módulos NestJS mapeiam 1:1 com os domínios do negócio — fácil de navegar e manter
- DI nativa facilita testes unitários de cada service em isolamento
- Guards/Interceptors declarativos mantêm auth e auditoria fora da lógica de negócio
- TypeScript strict end-to-end com inferência de tipos do Drizzle

### Negativas / Trade-offs
- NestJS tem mais boilerplate que Express para rotas simples (controller + service + module para cada domínio)
- Curva de aprendizado inicial para quem não conhece NestJS
- Mitigação: a estrutura modular paga o custo inicial ao crescer — Express ficaria desorganizado no mesmo ponto

### Riscos
- **Integração serial (balança):** node-serialport requer drivers nativos; mitigação: processo separado (gateway) no host, não containerizado
- **SOAP legado (EISS):** WSDL pode mudar; mitigação: encapsular em `NfseModule` com testes de contrato

## Alternativas Consideradas

### Express 5
Mais simples para começar, mas exige disciplina arquitetural manual. Com 8 domínios de negócio, a falta de estrutura nativa levaria a inconsistências. NestJS resolve isso com módulos.

### Fastify
Performance superior, mas sem o sistema de módulos/DI do NestJS. Não justifica o ganho de performance para operação local on-premises.

## Referências
- docs/001-visao-geral-operacao-e-fluxo-macro.md
- docs/012-arquitetura-aplicacional-modulos-servicos-e-integracoes.md (RA-01 a RA-06)
