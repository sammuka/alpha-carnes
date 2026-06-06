# Roadmap E2E — AlphaCarnes

> **Premissas globais:**
> 1. Este é um projeto E2E (end-to-end), não um MVP. Cada fase entrega funcionalidade completa e produtiva. Não existe "deixar para fase 2" em decisões de design.
> 2. Arquitetura clean, sem over-engineering. Cada abstração existe para resolver um problema real.

## Fase 0 — Fundação (atual)
**Objetivo:** Documentação completa, decisões arquiteturais, modelo de dados e spec de integrações.
**Entregáveis:**
- Roadmap E2E (este documento)
- ADRs (001–006)
- C4 Nível 1, 2 e 3
- Modelo conceitual e lógico PostgreSQL
- Spec completa do módulo NFS-e (EISS Osasco-SP)

## Fase 1 — Infraestrutura e Autenticação
**Objetivo:** Monorepo scaffolding completo, banco inicializado, autenticação funcionando.
**Entregáveis:**
- `app/backend`: NestJS 11 + TypeScript + Drizzle ORM + PostgreSQL 18
- `app/frontend`: Next.js 16 App Router + TypeScript + Tailwind CSS + Shadcn/ui
- Autenticação JWT (login, refresh, logout, perfis de acesso)
- RBAC completo: 11 perfis conforme doc 013
- Migrations iniciais com todas as entidades do modelo lógico
- CI básico (lint, type-check, test)
- Ambiente Docker local (postgres + backend + frontend)

## Fase 2 — Cadastros Base
**Objetivo:** CRUD completo de todas as entidades de suporte.
**Módulos:**
- Clientes (CNPJ/CPF, endereços, preferências de peça, histórico)
- Fornecedores (frigoríficos, contatos, avaliação)
- Itens / Partes (dianteiro, central, traseiro, frango, porco, outros)
- Regras de desdobramento (como a compra se quebra em partes)
- Parâmetros do sistema (tolerâncias de peso, limites, configurações)
- Usuários e perfis

## Fase 3 — Planejamento Comercial
**Objetivo:** Compra programada → disponibilidade virtual → pedidos.
**Módulos:**
- Compra Programada (registro, aprovação, desdobramento em partes)
- Disponibilidade Virtual (geração, saldo em tempo real, bloqueio de overbooking)
- Pedidos de Venda (registro por parte, reserva de disponibilidade, preferências)
- Dashboard de saldo virtual em tempo real (WebSocket)
- Alertas: saldo crítico, item zerado, pedido sem cobertura

## Fase 4 — Operação Física
**Objetivo:** Recebimento, pesagem, associação, corte e divergências.
**Módulos:**
- Recebimento físico (conferência vs NF do fornecedor, registro de divergências)
- Terminal de Pesagem (touch-friendly, integração balança RS-232/serial, associação sugestiva)
- Associação de peça a pedido (sugestão por saldo+preferências+rota, confirmação/redirecionamento)
- Corte e Transformação (subitens, nova pesagem, reetiquetagem, rastreabilidade)
- Impressão de Etiquetas (QR code, payload ZPL/ESC-POS, fila, reimpressão auditada)
- Registro de Divergências (formal, com ação corretiva e responsável)

## Fase 5 — Expedição
**Objetivo:** Carregamento de caminhão, conferência e fechamento.
**Módulos:**
- Terminal de Expedição (posicionamento estratégico por rota, conferência QR)
- Gestão de Caminhões/Rotas (ordem de parada, capacidade, atribuição de peças)
- Transferência entre pedidos (enquanto expedição aberta, com auditoria)
- Fechamento de Expedição (bloqueio de alterações, liberação para faturamento)
- Painel Operacional em tempo real (status geral do dia: recebido, pesado, expedido)

## Fase 6 — Faturamento e NFS-e
**Objetivo:** Emissão de NF-e fiscal e liberação do caminhão.
**Módulos:**
- Montagem do payload fiscal (itens, valores, CFOP, CST)
- Integração NFS-e EISS Osasco-SP (emissão unitária, lote, cancelamento, consulta)
- DANFE geração e armazenamento
- Envio ao motorista (e-mail; WhatsApp como fase futura)
- Seguro da carga (geração de protocolo)
- Liberação do caminhão para saída

## Fase 7 — Dashboards e Observabilidade
**Objetivo:** Inteligência operacional completa.
**Módulos:**
- Dashboard operacional em tempo real (cross-docking: recebido vs vendido vs expedido)
- KPIs de desempenho (tempo médio pesagem, taxa de divergência, aproveitamento de carga)
- Dashboard gerencial (volume por cliente, por fornecedor, por item, por período)
- Alertas automáticos (atraso de caminhão, divergência crítica, item zerado)
- Histórico e rastreabilidade completa de cada peça (do recebimento à entrega)
- Ocorrências com fornecedor (registro, acompanhamento, resolução)
- Auditoria de ações críticas (quem fez o quê, quando)

## Fase 8 — Hardware e Integrações
**Objetivo:** Integração completa com dispositivos físicos.
**Módulos:**
- Gateway de Balança (serial RS-232, estabilização, fallback manual, monitoramento)
- Gateway de Impressoras (ZPL/ESC-POS, fila, status, reimpressão)
- Leitores QR (conferência, expedição, rastreabilidade)
- Monitoramento de dispositivos (status em tempo real no painel)

## Fase 9 — Estoque e Sobras
**Objetivo:** Tratamento completo de exceções de estoque.
**Módulos:**
- Registro de sobras (não vendidas no dia)
- Congelamento (com impacto de peso e qualidade registrado)
- Estoque físico (controle de entradas/saídas, inventário)
- Relatórios de aproveitamento e perdas

## Critérios de qualidade transversais (todas as fases)
- Cobertura de testes ≥ 80% no backend (unitários + integração)
- TypeScript strict em todo o código
- Auditoria em todas as operações críticas (quem, quando, o quê)
- Rastreabilidade de peça ponta a ponta
- Sem acoplamento de regras de negócio no frontend
- Todas as integrações com hardware tratadas como serviços/gateways isolados
- Logs estruturados em todas as operações
