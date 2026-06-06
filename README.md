# AlphaCarnes

Sistema de gestão operacional para a AlphaCarnes — distribuidora de carnes em Osasco/SP.

Monorepo com landing page de proposta, documentação técnica e aplicação principal.

## Estrutura

```
alpha-carnes/
├── docs/         # 18 documentos de especificação funcional e técnica
├── landing/      # Landing page interativa de proposta (Vite + Vanilla JS)
└── app/
    ├── frontend/ # Aplicação web (Next.js 16) — em desenvolvimento
    └── backend/  # API e regras de negócio (NestJS 11) — em desenvolvimento
```

## Documentação

Os 18 documentos em `docs/` cobrem a especificação completa do sistema:

| Arquivo | Conteúdo |
|---------|---------|
| 001 | Visão geral da operação e fluxo macro |
| 002 | Compra programada, disponibilidade virtual e vendas |
| 003 | Regras funcionais por tela/bloco estrutural |
| 004 | Campos e ações — Compra Programada e Pedido de Venda |
| 005 | Campos e ações — Disponibilidade Virtual e Recebimento |
| 006 | Campos e ações — Pesagem, Associação Sugestiva e Expedição |
| 007 | Corte, transformação, reetiquetagem e rastreabilidade |
| 008 | Faturamento, emissão de NF, seguro e liberação do caminhão |
| 009 | Dashboards, KPIs, alertas e monitoramento em tempo real |
| 010 | Modelo de dados conceitual e entidades principais |
| 011 | Modelo lógico inicial — tabelas e relacionamentos |
| 012 | Arquitetura aplicacional — módulos, serviços e integrações |
| 013 | Perfis de acesso, papéis, aprovações e segregação de funções |
| 014 | Eventos de domínio, workflows assíncronos e tempo real |
| 015 | Roadmap de implantação — fases, riscos e dependências |
| 016 | Wireframes e fluxos por tela |
| 017 | Infraestrutura e equipamentos recomendados |
| 018 | Arquitetura on-premises e topologia de equipamentos |

## Executar a F1 localmente

### Pré-requisitos
- Docker e Docker Compose v2
- Copiar e ajustar o arquivo de env: `cp .env.example .env`

### Um comando para subir tudo

```bash
docker compose up --build
```

Isso irá:
1. Subir o PostgreSQL 18 (aguarda healthcheck)
2. Buildar e subir o backend (aplica migrations + seed automaticamente)
3. Buildar e subir o frontend

Acesse: [http://localhost:3000](http://localhost:3000)

### Credenciais do seed (desenvolvimento)

- **Email:** `admin@alphacarnes.local` (ou `SEED_ADMIN_EMAIL` do `.env`)
- **Senha:** `Admin@AlphaCarnes2026!` (ou `SEED_ADMIN_PASSWORD` do `.env`)

### Rollback de migration (F1)

A migration inicial da F1 não tem down script. Para resetar o banco:

```bash
docker compose down -v   # Remove o volume do PostgreSQL
docker compose up --build  # Recria tudo do zero
```

Migrations de F2+ incluirão down scripts explícitos por arquivo.

### Variáveis de ambiente

Veja `.env.example` para todas as variáveis disponíveis. As principais:

| Variável | Descrição | Padrão dev |
|----------|-----------|------------|
| `COOKIE_SECURE` | `true` em HTTPS (produção), `false` em HTTP local | `false` |
| `DATABASE_URL` | URL do PostgreSQL | (ver .env.example) |
| `JWT_ACCESS_SECRET` | Segredo do access token (min 32 chars) | ⚠️ Alterar em produção |
| `JWT_REFRESH_SECRET` | Segredo do refresh token (min 32 chars) | ⚠️ Alterar em produção |
| `THROTTLE_LOGIN_LIMIT` | Máx. tentativas de login por TTL | `5` |
| `BACKEND_INTERNAL_URL` | URL interna backend→container (BFF) | `http://backend:3001` |

## Landing Page

Proposta técnica e comercial interativa. Ver `landing/README.md` para instruções de execução.

```bash
cd landing
npm install
npm run dev
```

## Licença

Projeto privado — uso exclusivo AlphaCarnes.
