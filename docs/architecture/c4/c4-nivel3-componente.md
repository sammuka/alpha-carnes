# C4 Nível 3 — Componentes do Backend

```mermaid
C4Component
    title AlphaCarnes — Componentes do Backend API (NestJS 11)

    Container_Boundary(backend, "Backend API — NestJS 11") {
        Component(mod_compras, "ComprasModule", "NestJS Module", "ComprasController + ComprasService: compra programada e disponibilidade virtual")
        Component(mod_pedidos, "PedidosModule", "NestJS Module", "PedidosController + PedidosService: pedidos, reservas de disponibilidade")
        Component(mod_pesagem, "PesagemModule", "NestJS Module", "PesagemController + PesagemService: peso, associação sugestiva, rastreabilidade")
        Component(mod_expedicao, "ExpedicaoModule", "NestJS Module", "ExpedicaoController + ExpedicaoService: caminhão, conferência, fechamento")
        Component(mod_faturamento, "FaturamentoModule", "NestJS Module", "FaturamentoController + FaturamentoService + NfseService: NFS-e EISS")
        Component(mod_cadastros, "CadastrosModule", "NestJS Module", "Clientes, fornecedores, itens, usuários, parâmetros")
        Component(mod_dashboards, "DashboardsModule", "NestJS Module", "KPIs, alertas, histórico operacional")

        Component(auth_module, "AuthModule", "NestJS Module + Passport", "JwtAuthGuard, RbacGuard — declarativos em cada controller")
        Component(auditoria_interceptor, "AuditoriaInterceptor", "NestJS Interceptor", "Registra operações críticas automaticamente — sem código nos services")
        Component(ws_gateway, "OperacaoGateway", "NestJS WebSocket Gateway", "Rooms por contexto: pesagem, caminhao:{id}, dashboard")

        Component(db_layer, "DatabaseModule", "Drizzle ORM + PostgreSQL 18", "Schemas tipados por domínio, migrations, transactions")
    }

    Rel(mod_compras, mod_pedidos, "DisponibilidadeService compartilhado via DI")
    Rel(mod_pesagem, ws_gateway, "Emite evento após associar peça")
    Rel(mod_expedicao, ws_gateway, "Emite evento ao fechar expedição")
    Rel(mod_faturamento, ws_gateway, "Emite evento após NFS-e emitida")
    Rel(auth_module, mod_compras, "JwtAuthGuard + RbacGuard aplicados")
    Rel(auditoria_interceptor, db_layer, "Persiste log em tabela auditoria")
```

## Estrutura de diretórios do backend (NestJS — clean)

```
app/backend/src/
├── app.module.ts               ← importa todos os módulos de domínio
│
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts     ← login, refresh, validação JWT
│   │   ├── jwt.strategy.ts
│   │   └── guards/
│   │       ├── jwt-auth.guard.ts
│   │       └── rbac.guard.ts
│   │
│   ├── compras/
│   │   ├── compras.module.ts
│   │   ├── compras.controller.ts
│   │   └── compras.service.ts  ← inclui lógica de disponibilidade virtual
│   │
│   ├── pedidos/
│   │   ├── pedidos.module.ts
│   │   ├── pedidos.controller.ts
│   │   └── pedidos.service.ts
│   │
│   ├── pesagem/
│   │   ├── pesagem.module.ts
│   │   ├── pesagem.controller.ts
│   │   └── pesagem.service.ts  ← associação sugestiva + rastreabilidade
│   │
│   ├── expedicao/
│   │   ├── expedicao.module.ts
│   │   ├── expedicao.controller.ts
│   │   └── expedicao.service.ts
│   │
│   ├── faturamento/
│   │   ├── faturamento.module.ts
│   │   ├── faturamento.controller.ts
│   │   ├── faturamento.service.ts
│   │   └── nfse/
│   │       ├── nfse.service.ts       ← orquestra emissão/cancelamento
│   │       ├── eiss-client.ts        ← cliente SOAP node-soap
│   │       └── payload-builder.ts    ← monta NotaFiscalDTO
│   │
│   ├── cadastros/
│   │   ├── cadastros.module.ts
│   │   ├── cadastros.controller.ts
│   │   └── cadastros.service.ts
│   │
│   └── dashboards/
│       ├── dashboards.module.ts
│       ├── dashboards.controller.ts
│       └── dashboards.service.ts
│
├── common/
│   ├── interceptors/
│   │   └── auditoria.interceptor.ts
│   ├── pipes/
│   │   └── zod-validation.pipe.ts
│   └── websocket/
│       └── operacao.gateway.ts       ← @WebSocketGateway NestJS
│
├── database/
│   ├── database.module.ts
│   ├── schema/
│   │   ├── cadastros.schema.ts
│   │   ├── compras.schema.ts
│   │   ├── pedidos.schema.ts
│   │   ├── pesagem.schema.ts
│   │   ├── expedicao.schema.ts
│   │   ├── fiscal.schema.ts
│   │   └── auditoria.schema.ts
│   └── migrations/
│
└── main.ts
```
