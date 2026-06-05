# C4 Nível 2 — Diagrama de Containers

```mermaid
C4Container
    title AlphaCarnes — Diagrama de Containers

    Person(usuario, "Usuário", "Compras, Comercial, Operadores, Faturamento, Gestor")

    System_Boundary(alphacarnes, "Sistema AlphaCarnes") {
        Container(frontend, "Frontend Web", "Next.js 16, App Router, TypeScript, Tailwind, Shadcn/ui", "Interface administrativa (desktop) e terminais operacionais (touch). Servido pelo Node.js do Next.js.")

        Container(backend, "Backend API", "NestJS 11, TypeScript, Drizzle ORM, Zod", "API REST + WebSocket. Módulos por domínio (compras, pedidos, pesagem, expedição, faturamento). Sem camadas desnecessárias.")

        Container(db, "Banco de Dados", "PostgreSQL 18, JSONB", "Dados transacionais: pedidos, peças, expedição, faturamento, auditoria. JSONB para dados semiestruturados.")

        Container(queue, "Fila de Tarefas", "BullMQ (Redis)", "Processamento assíncrono somente onde necessário: retry NFS-e, impressão de etiquetas, envio de e-mail.")

        Container(gateway_balanca, "Gateway de Balança", "Node.js, node-serialport", "Lê peso da balança via RS-232. Expõe WebSocket local para o backend.")

        Container(gateway_impressora, "Gateway de Impressora", "Node.js, raw-socket", "Recebe payload ZPL do backend e envia para a impressora de etiquetas.")
    }

    System_Ext(eiss, "EISS NFS-e\nOsasco-SP", "SOAP/HTTPS")
    System_Ext(email_server, "Servidor de E-mail", "SMTP")

    Rel(usuario, frontend, "Acessa via browser", "HTTPS")
    Rel(frontend, backend, "Requisições API", "HTTP/WebSocket")
    Rel(backend, db, "Lê e escreve dados", "TCP/PostgreSQL protocol")
    Rel(backend, queue, "Enfileira tarefas", "Redis protocol")
    Rel(queue, backend, "Processa tarefas", "BullMQ worker")
    Rel(backend, eiss, "Emite NFS-e", "SOAP/HTTPS")
    Rel(backend, email_server, "Envia e-mails", "SMTP")
    Rel(gateway_balanca, backend, "Envia leituras de peso", "WebSocket local")
    Rel(backend, gateway_impressora, "Envia payload de impressão", "HTTP local")
```

## Responsabilidades por Container

### Frontend Web (`app/frontend`)
- Renderização de páginas (Server Components para queries, Client Components para interatividade)
- Autenticação (cookie seguro com JWT)
- Layout administrativo (sidebar, filtros, tabelas, formulários)
- Layout operacional (tela cheia, touch-friendly, alto contraste)
- Conexão WebSocket para atualizações em tempo real

### Backend API (`app/backend`)
- Módulos NestJS por domínio de negócio — sem camadas extras
- API REST por módulo (`/compras`, `/pedidos`, `/pesagem`, `/expedicao`, `/faturamento`)
- WebSocket Gateway NestJS para tempo real
- `FaturamentoModule` encapsula toda comunicação SOAP com EISS
- Guards declarativos para auth/RBAC; Interceptor para auditoria
- Drizzle ORM direto nos services — sem repositórios intermediários desnecessários

### PostgreSQL 18
- Dados transacionais com ACID
- JSONB para preferências, atributos de peça, payload fiscal
- Auditoria via tabela de log + trigger `updated_at`

### BullMQ (Redis)
- Usado apenas onde o processamento síncrono não é viável:
  - Retry de emissão NFS-e após falha do EISS
  - Fila de impressão de etiquetas (um job por etiqueta)
  - Envio de e-mail ao motorista

### Gateway de Balança
- Processo separado no servidor on-premises
- Lê serial RS-232 da balança industrial
- Estabiliza leitura (descarta leituras instáveis)
- Expõe WebSocket local para o backend consumir

### Gateway de Impressora
- Processo separado (pode ser o mesmo servidor)
- Recebe payload ZPL/ESC-POS do backend
- Envia para impressora via TCP (porta 9100) ou USB
- Gerencia fila de impressão e confirma sucesso
