# Execução — Status por Onda

> **Escritor único: Executor.** Vocabulário de status: `aguardando_inicio → planejando → aguardando_portao1 → plano_aprovado → implementando → aguardando_portao2 → mergeada` | `bloqueada`.
> Roadmap e grafo de dependências: [`roadmap-canonico.md`](../governance/roadmap-canonico.md) §8. Rito: [`pipeline-execucao.md`](../governance/pipeline-execucao.md).

| Onda | Escopo resumido | Depende de | Status | Plano tático | PR | SHA merge | Observações |
|---|---|---|---|---|---|---|---|
| 0 | Pipeline de governança (constituição, gates, skills, workflows, estado vivo) | — | aguardando_portao2 | (plano mestre §6) | — | — | Entregáveis versionados; PR e SHA serão registrados pelo Executor quando existirem |
| 1 | Correção estrutural: Operação (D2), overbooking v1.1 (D1), Pedido ao Fornecedor + conferência tripla (D3), terminologia (D5), CLAUDE.md (D9) | 0 | aguardando_portao1 | [`2026-07-22-onda1-correcao-estrutural.md`](../superpowers/plans/2026-07-22-onda1-correcao-estrutural.md) | — | — | Plano tático entregue junto do mestre |
| 2 | Shell + DS fiel ao protótipo (layout, menu 9 grupos, tokens, componentes compartilhados) | 1 | aguardando_inicio | just-in-time | — | — | — |
| 3 | Cadastros & Regras completos + Admin | 2 | aguardando_inicio | just-in-time | — | — | P13 fechada por AD-04: 11 perfis com recorte `ESTOQUE_*` |
| 4 | Comercial (Clientes, Pedidos, Preços, Disponibilidade-mapa, Espelho) | 3 | aguardando_inicio | just-in-time | — | — | P2 fechada por AD-06: sem expiração automática; liberação explícita e auditada |
| 5 | Gestão (Painel, Operações UI, Compras, Overbooking, Aprovações, SIF) | 3 | aguardando_inicio | just-in-time | — | — | — |
| 6 | Recebimento & Balança (recebimento §6.10, pesagem + Troca de Peça, etiquetas) | 4, 5 | aguardando_inicio | just-in-time | — | — | — |
| 7 | Desossa (painel aeroporto/TV, pesagem c/ exclusividade, etiquetas) | 6 | aguardando_inicio | just-in-time | — | — | — |
| 8 | Estoque (consulta FIFO, entrada, ajustes) | 7 | aguardando_inicio | just-in-time | — | — | — |
| 9 | Carga (planejamento, conferência, enviar p/ faturamento) | 7 | aguardando_inicio | just-in-time | — | — | — |
| 10 | Faturamento (adapter EISS real + RTC, Notas/XML, Seguro F6b, Liberação c/ checklist) | 8, 9 | aguardando_inicio | just-in-time | — | — | Pendência externa: credenciais homologação EISS |

## Histórico pré-pipeline (fases F1–F6a — concluídas sob o framework anterior)

F1 (PR#1) · F2 (PR#2) · F3 (PR#3) · F4a (PR#4) · F4b (PR#5) · F4c (PR#6, gate F4 emitido 2026-06-07) · F5 (PR#7, 2026-06-08) · F6a (PR#8) · F7 cadastros (migration 0009) · absorção protótipo v2 (`540abea`) · recebimento simplificado (`d4e55c1`).
