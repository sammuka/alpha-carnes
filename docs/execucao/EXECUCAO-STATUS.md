# Execução — Status por Onda

> **Escritor único: Executor.** Vocabulário de status: `aguardando_inicio → planejando → aguardando_portao1 → plano_aprovado → implementando → aguardando_portao2 → mergeada` | `bloqueada`.
> Roadmap e grafo de dependências: [`roadmap-canonico.md`](../governance/roadmap-canonico.md) §8. Rito: [`pipeline-execucao.md`](../governance/pipeline-execucao.md).

| Onda | Escopo resumido | Depende de | Status | Plano tático | PR | SHA merge | Observações |
|---|---|---|---|---|---|---|---|
| 0 | Pipeline de governança (constituição, gates, skills, workflows, estado vivo) | — | implementando | (plano mestre §6) | — | — | Este ciclo de planejamento 2026-07-23 |
| 1 | Correção estrutural: Operação (D2), overbooking v1.1 (D1), Pedido ao Fornecedor + conferência tripla (D3), terminologia (D5), CLAUDE.md (D9) | 0 | aguardando_portao1 | [`2026-07-22-onda1-correcao-estrutural.md`](../superpowers/plans/2026-07-22-onda1-correcao-estrutural.md) | — | — | Plano tático entregue junto do mestre |
| 2 | Shell + DS fiel ao protótipo (layout, menu 9 grupos, tokens, componentes compartilhados) | 1 | aguardando_inicio | just-in-time | — | — | — |
| 3 | Cadastros & Regras completos + Admin | 2 | aguardando_inicio | just-in-time | — | — | Bloqueio parcial: P13 (perfil estoque) |
| 4 | Comercial (Clientes, Pedidos, Preços, Disponibilidade-mapa, Espelho) | 3 | aprovado_portao2 | [`2026-07-27-onda4-comercial.md`](../superpowers/plans/2026-07-27-onda4-comercial.md) | [#35](https://github.com/sammuka/alpha-carnes/pull/35) | `3390f29` | Portão 2 aprovado (SHA `3390f29`), suíte local 100% verde |
| 5 | Gestão (Painel, Operações UI, Compras, Overbooking, Aprovações, SIF) | 3 | aprovado_portao2 | [`2026-07-30-onda5-gestao.md`](../superpowers/plans/2026-07-30-onda5-gestao.md) | [#36](https://github.com/sammuka/alpha-carnes/pull/36) | `b5ed772` | Portão 2 aprovado (SHA `b5ed772`), CI GitHub Actions 8/8 verde |
| 6 | Recebimento & Balança (recebimento §6.10, pesagem + Troca de Peça, etiquetas) | 4, 5 | aprovado_portao2 | [`2026-07-30-onda6-recebimento-balanca.md`](../superpowers/plans/2026-07-30-onda6-recebimento-balanca.md) | [#37](https://github.com/sammuka/alpha-carnes/pull/37) | `eda7320` | Portão 2 aprovado (SHA `eda7320`), CI GitHub Actions 8/8 verde |
| 7 | Desossa (painel aeroporto/TV, pesagem c/ exclusividade, etiquetas) | 6 | aprovado_portao2 | [`2026-07-30-onda7-desossa.md`](../superpowers/plans/2026-07-30-onda7-desossa.md) | [#38](https://github.com/sammuka/alpha-carnes/pull/38) | `e73aa82` | Portão 2 aprovado (SHA `e73aa82`), CI GitHub Actions 8/8 verde |
| 8 | Estoque (consulta FIFO, entrada, ajustes) | 7 | aprovado_portao2 | [`2026-07-30-onda8-estoque.md`](../superpowers/plans/2026-07-30-onda8-estoque.md) | [#39](https://github.com/sammuka/alpha-carnes/pull/39) | `8b6cbe4` | Portão 2 aprovado (SHA `8b6cbe4`), CI GitHub Actions 8/8 verde |
| 9 | Carga (planejamento, conferência, enviar p/ faturamento) | 7 | planejando | just-in-time | — | — | Elaborando plano tático (Portão 1) |
| 10 | Faturamento (adapter EISS real + RTC, Notas/XML, Seguro F6b, Liberação c/ checklist) | 8, 9 | aguardando_inicio | just-in-time | — | — | Pendência externa: credenciais homologação EISS |

## Histórico pré-pipeline (fases F1–F6a — concluídas sob o framework anterior)

F1 (PR#1) · F2 (PR#2) · F3 (PR#3) · F4a (PR#4) · F4b (PR#5) · F4c (PR#6, gate F4 emitido 2026-06-07) · F5 (PR#7, 2026-06-08) · F6a (PR#8) · F7 cadastros (migration 0009) · absorção protótipo v2 (`540abea`) · recebimento simplificado (`d4e55c1`).
