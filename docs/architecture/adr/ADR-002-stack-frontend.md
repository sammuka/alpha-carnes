# ADR-002 — Stack Frontend: Next.js 16 + TypeScript + Tailwind + Shadcn/ui

**Data:** 2026-06-04
**Status:** Aceita

## Contexto
O sistema tem dois perfis de interface distintos:
1. **Frontend Administrativo:** desktop-first, formulários ricos, dashboards, filtros complexos.
2. **Frontend Operacional (Terminais):** touch-friendly, alto contraste, baixo número de cliques, atualização em tempo real.

Ambos precisam de TypeScript strict, autenticação por perfil e acesso ao backend NestJS via HTTP/WebSocket.

## Decisão
Usaremos **Next.js 16 App Router** com **TypeScript 5 strict**, **Tailwind CSS 4** e **Shadcn/ui** para ambos os frontends (admin e operacional) dentro do mesmo projeto Next.js, separados por rotas e layouts.

Bibliotecas complementares:
- **Shadcn/ui** — componentes acessíveis e customizáveis sobre Radix UI
- **React Hook Form** + **Zod 4** — formulários com validação type-safe
- **TanStack Query v5** — cache e sincronização de estado servidor
- **Recharts** — gráficos para dashboards
- **Socket.io-client** ou **EventSource** — tempo real nos terminais e painéis

## Consequências

### Positivas
- App Router + React Server Components: carregamento otimizado, dados fetchados no servidor
- Shadcn/ui: componentes acessíveis prontos para os formulários complexos do admin
- Uma única codebase para admin e operacional: componentes compartilhados, autenticação unificada
- TypeScript end-to-end: tipos do backend (Drizzle + Zod) podem ser exportados e usados no frontend

### Negativas / Trade-offs
- App Router tem curva de aprendizado (Server vs Client Components)
- Terminais operacionais touch-friendly precisam de cuidado especial no design (Shadcn/ui não é otimizado para touch por padrão)

### Riscos
- **Terminais em ambiente de fábrica:** conexão instável; mitigação: offline-first para operações críticas de terminal (pesagem armazena localmente e sincroniza)
- **Versão Next.js:** usar sempre a versão estável mais recente e não versões canary

## Alternativas Consideradas

### React + Vite (SPA pura)
Sem SSR. Descartado porque o dashboard administrativo se beneficia de Server Components para queries pesadas, e o App Router oferece estrutura de rotas mais organizada para um sistema complexo.

### Separar admin e operacional em projetos distintos
Mais isolamento, mas duplicação de código e autenticação. Descartado: a complexidade de manter dois projetos frontend não justifica o benefício neste estágio.

## Referências
- docs/012-arquitetura-aplicacional-modulos-servicos-e-integracoes.md (seções 3 e 4)
- docs/016-wireframes-fluxos-por-tela.md
