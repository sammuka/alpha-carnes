# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Operadores internos da AlphaCarnes (distribuidora de carnes em Osasco/SP), em 11 perfis de RBAC com segregação de funções: Administrador do Sistema, Comprador/Operador de Compras, Gestor Comercial/Operacional, Operador Comercial, Operador de Recebimento/Pesagem, Operador de Corte, Operador de Expedição, Conferente, Faturamento/Fiscal, Logística/Liberação, Diretoria/Gestão Executiva. Cada perfil vê só o necessário para sua função; ações críticas dependem de perfil compatível.

## Product Purpose

Sistema de gestão operacional on-premises para uma distribuidora de carnes: cross-docking com compra programada, disponibilidade virtual, recebimento, pesagem/destinação, desossa (transformação), expedição e faturamento NFS-e ponta a ponta. Sucesso = rastreabilidade completa de cada peça, da compra à nota fiscal, sem falha silenciosa e sem dado inventado.

## Positioning

Modela um fluxo que ERP/WMS genéricos não cobrem nativamente: compra programada que gera disponibilidade virtual por produto, reserva inteligente que recalcula possibilidades de venda entre cortes com origem física compartilhada (ex.: 1 TZ vira Jacaré + Coxão Bola OU Jacaré + 2 Alcatras), e overbooking sem limite com confirmação explícita e pendência de gestor.

## Operating Context

Operação on-premises em Osasco/SP. Fluxo físico: compra programada → recebimento (conferência Pedido × NF × Pesagem) → pesagem/destinação (peça → pedido, estoque ou desossa) → desossa (transforma só TZ) → expedição (carga por caminhão) → faturamento (NFS-e via EISS Osasco, SOAP) → liberação do caminhão por checklist. Hardware de chão de fábrica (balança, impressora de etiqueta, leitor) como gateways isolados, com fakes determinísticos em teste.

## Capabilities and Constraints

- Overbooking permitido sem limite, com confirmação explícita e pendência para o gestor.
- Composição do "boi casado" fixada em 2 TZ + 2 DT + 2 PA (AD-01); fiscal = EISS Osasco (AD-02); seguro é manual.
- Terminologia obrigatória: "Nome Fantasia/Marca" e "Razão Social" no cadastro de clientes; "Buscar cliente" nas buscas. A palavra isolada "Marca" é banida como entidade, rótulo ou termo de busca.
- Regras de negócio críticas (saldo, bloqueio, associação, overbooking, fechamento) vivem só no backend; o frontend apresenta e valida formulário.
- Pendências da spec funcional entram como parâmetro configurável + badge "Provisório", nunca como regra fixa.
- Stack já definido pelo código existente: Next.js 16 (App Router/BFF) + React 19 + Tailwind 4 + Shadcn/ui (Radix) + Zod 4; backend NestJS 11 + PostgreSQL 18/Drizzle.

## Brand Commitments

Fidelidade absoluta a um protótipo validado é princípio não negociável do projeto (Princípio I da constituição). Desde a **AD-07** (2026-08-05), esse princípio é satisfeito pela fidelidade ao **DS v3 — Direção A "Evolução"** (com o KPI strip da Direção B), prototipado em `docs/ds-preview/direcao-a/` (hub `docs/ds-preview/index.html`) e especificado em `docs/superpowers/plans/2026-08-05-onda-ds-v3-implementacao.md` — não mais ao protótipo externo `F:\Projetos\alpha-carnes-prototipo`. A mudança foi exclusivamente visual (tokens, componentes, densidade, tipografia com JetBrains Mono para dados); fluxos, textos funcionais, regras de negócio e contratos continuam os do protótipo v1.1/spec funcional. Onde a spec DS v3 e o protótipo HTML divergirem em um detalhe de pixel, a spec vence. Mudanças estruturais no UX/menu ainda exigem emenda constitucional, não decisão de PR. A implementação em `app/frontend/src` já aplica o DS v3 e é a autoridade visual de fato para refinamento.

## Evidence on Hand

Nenhum asset de marca (logo, imagens) encontrado em `app/frontend/public` ou `src` — a UI usa ícones de `lucide-react`. Documentação funcional completa em `docs_v2/`, perfis/permissões em `docs/013-...md`, decisões em `docs/execucao/DECISOES.md`.

## Product Principles

1. Fidelidade ao DS v3 (`docs/ds-preview/direcao-a/`) antes de criatividade visual — não inventar mundo visual novo sem aprovação explícita.
2. Completude E2E: uma tela entra completa (todos os modais/estados/validações) ou não entra na onda.
3. Nenhuma falha silenciosa, nenhum dado inventado.
4. Rastreabilidade ponta a ponta de cada peça, da compra à nota fiscal.
5. Regras de negócio só no backend; frontend é apresentação e validação de formulário.
