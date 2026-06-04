# AlphaCarnes

Sistema de gestão operacional para a AlphaCarnes — distribuidora de carnes em Osasco/SP.

Monorepo com landing page de proposta, documentação técnica e aplicação principal.

## Estrutura

```
alpha-carnes/
├── docs/         # 18 documentos de especificação funcional e técnica
├── landing/      # Landing page interativa de proposta (Vite + Vanilla JS)
└── app/
    ├── frontend/ # Aplicação web (Next.js) — em desenvolvimento
    └── backend/  # API e regras de negócio (Node.js/Express) — em desenvolvimento
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

## Landing Page

Proposta técnica e comercial interativa. Ver `landing/README.md` para instruções de execução.

```bash
cd landing
npm install
npm run dev
```

## Licença

Projeto privado — uso exclusivo AlphaCarnes.
