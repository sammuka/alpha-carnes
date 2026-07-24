# Execução — Status por Onda

> **Escritor único: Executor.** Vocabulário de status: `aguardando_inicio → planejando → aguardando_portao1 → plano_aprovado → implementando → aguardando_portao2 → mergeada` | `bloqueada`.
> Roadmap e grafo de dependências: [`roadmap-canonico.md`](../governance/roadmap-canonico.md) §8. Rito: [`pipeline-execucao.md`](../governance/pipeline-execucao.md).

| Onda | Escopo resumido | Depende de | Status | Plano tático | PR | SHA merge | Observações |
|---|---|---|---|---|---|---|---|
| 0 | Pipeline de governança (constituição, gates, skills, workflows, estado vivo) | — | mergeada | (plano mestre §6) | [#10](https://github.com/sammuka/alpha-carnes/pull/10) | `0f8491ff2141473b5b7e3cf784b9c878fce35549` | CI completo no head `72e2ac961b59e47ae1737b2d287f2134df53a7e4`; dois Monitores independentes aprovaram o mesmo objeto |
| 1 | Correção estrutural: Operação (D2), overbooking v1.1 (D1), Pedido ao Fornecedor + conferência tripla (D3), terminologia (D5) | 0 | mergeada | [`2026-07-22-onda1-correcao-estrutural.md`](../superpowers/plans/2026-07-22-onda1-correcao-estrutural.md) | [#13](https://github.com/sammuka/alpha-carnes/pull/13) | `231f6843d29296d0b87ff69f1246cb54b2a6bc7e` | Portão 2 aprovado no head `22d3f51` (veredito `3c220de`); CI verde no head do veredito (run `30134001208`). Plano sha256 `2d52f9df…`. AD-07/AD-08. Plano tático integrado antes pelo PR [#12](https://github.com/sammuka/alpha-carnes/pull/12); D9 pelo PR [#11](https://github.com/sammuka/alpha-carnes/pull/11) |
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
