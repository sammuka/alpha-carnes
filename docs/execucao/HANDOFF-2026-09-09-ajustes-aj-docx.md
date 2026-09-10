# Handoff — Ajustes reportados em `Aj.docx` (2026-09-09)

> Documento de transferência de contexto para um agente novo (sessão limpa) continuar o trabalho.
> Não é um plano tático de onda nem substitui `EXECUCAO-STATUS.md`/`GATE-VEREDITOS.md`/`DECISOES.md`
> (escritores únicos definidos em [`pipeline-execucao.md`](../governance/pipeline-execucao.md)). É só o
> briefing de entrada para quem for planejar e implementar.

## Regra não negociável para quem assumir este trabalho

**Não abra Pull Request até a implementação estar completa e os testes locais terminarem e
passarem.** Trabalhe em branch/worktree dedicado a partir de `develop` (nunca commit direto em
`develop`/`main` — ver `AGENTS.md` §"Regra de branching"), implemente todos os itens abaixo, rode o
gate local completo (comandos na seção "Antes de abrir o PR") e só então abra o PR.

## Contexto

O arquivo `D:\Projetos\AlphaCarnes2\Documentos\Ajustes\Aj.docx` (feedback do cliente, com 5 capturas
de tela) foi lido integralmente e convertido em **14 issues no Linear** (time `AlphaCarnes`), com
hierarquia issue-pai/subissue e a captura de tela correspondente anexada em cada uma. Este handoff
não repete o conteúdo técnico de cada issue — ele existe no Linear e deve ser lido lá antes de
implementar. As issues **não fazem parte de uma onda numerada do roadmap** (não estão em
`roadmap-canonico.md` §8): são ajustes/bugs de feedback direto do cliente sobre telas já
implementadas.

## Fontes de verdade a consultar, em ordem (AGENTS.md)

1. [`docs/governance/constituicao.md`](../governance/constituicao.md) — princípios vinculantes,
   especialmente Princípio I (fidelidade visual — hoje ao DS v3, ver AD-10 em
   [`DECISOES.md`](DECISOES.md)) e RA-01..06 (regra de negócio só no backend, transação+auditoria em
   etapa crítica, tempo real por eventos, nenhuma falha silenciosa).
2. [`docs/execucao/DECISOES.md`](DECISOES.md) — não reabrir AD-01..AD-15 (ex.: AD-05 overbooking,
   AD-14 múltiplas compras por operação/pool comercial, AD-15 unificação do catálogo em `produtos`).
3. `docs_v2/alphacarnes_contexto_funcional_e_recomendacoes_prototipo_v1.1.md` — regras de
   disponibilidade, overbooking, recebimento, pesagem/destinação.
4. Protótipo/DS v3 vigente (Princípio I via AD-10) para qualquer ajuste visual.
5. [`docs/governance/roadmap-canonico.md`](../governance/roadmap-canonico.md) e plano mestre.

## As 14 issues (Linear, time AlphaCarnes)

| Issue | Título | Label | Pai |
|---|---|---|---|
| [ALP-87](https://linear.app/alphacarnes/issue/ALP-87) | Pedidos de Venda — grid agrupado por data com filtro | Feature | — |
| [ALP-88](https://linear.app/alphacarnes/issue/ALP-88) | Overbooking não é resolvido corretamente após pedido complementar (guarda-chuva) | Bug | — |
| [ALP-89](https://linear.app/alphacarnes/issue/ALP-89) | Pedido de venda editado/excluído continua exibido na tela | Bug | ALP-88 |
| [ALP-90](https://linear.app/alphacarnes/issue/ALP-90) | Coluna Overbooking (O) não zera ao suprir o déficit com pedido complementar | Bug | ALP-88 |
| [ALP-91](https://linear.app/alphacarnes/issue/ALP-91) | Recebimento de Carga — ajustes de tela (guarda-chuva) | Improvement | — |
| [ALP-92](https://linear.app/alphacarnes/issue/ALP-92) | Filtrar pela data de operação (recebimento) corrente e impedir alteração indevida dessa data | Bug | ALP-91 |
| [ALP-93](https://linear.app/alphacarnes/issue/ALP-93) | Modal de recebimento centralizado com cabeçalho + grid de itens do pedido de compra | Improvement | ALP-91 |
| [ALP-94](https://linear.app/alphacarnes/issue/ALP-94) | Pesagem e Destinação — ajustes de tela (guarda-chuva) | Improvement | — |
| [ALP-95](https://linear.app/alphacarnes/issue/ALP-95) | Exibir a Data da Operação na tela de Pesagem e Destinação | Feature | ALP-94 |
| [ALP-96](https://linear.app/alphacarnes/issue/ALP-96) | Bug — nome dos produtos exibindo "undefined" | Bug | ALP-94 |
| [ALP-97](https://linear.app/alphacarnes/issue/ALP-97) | Remover os chips de características do componente da balança | Improvement | ALP-94 |
| [ALP-98](https://linear.app/alphacarnes/issue/ALP-98) | Bug — campo "Buscar cliente" não filtra pelo Nome Fantasia digitado | Bug | ALP-94 |
| [ALP-99](https://linear.app/alphacarnes/issue/ALP-99) | Botão "Estoque" deve destinar a peça pesada para o controle de estoque | Feature | ALP-94 |

## Pontos de partida no código, por área

Levantados por busca de arquivo (não confirmados por leitura profunda — o agente que implementar
deve ler o código real antes de alterar):

- **ALP-87 (Pedidos de Venda — grid por data):**
  `app/frontend/src/app/(admin)/comercial/pedidos/pedidos-client.tsx`,
  `app/frontend/src/app/(admin)/comercial/pedidos/page.tsx`,
  `app/frontend/src/app/api/comercial/pedidos/route.ts`.
- **ALP-88/89 (pedido editado/excluído continua na tela):**
  `app/frontend/src/app/(admin)/comercial/pedidos/pedidos-client.tsx`,
  `app/frontend/src/app/(admin)/comercial/pedidos/pedido-editor.tsx`,
  `app/backend/src/modules/comercial/pedidos/pedidos.service.ts`.
- **ALP-90 (coluna Overbooking não zera):**
  `app/backend/src/modules/comercial/disponibilidade/disponibilidade.service.ts`,
  `app/backend/src/modules/comercial/overbooking/overbooking.service.ts`,
  `app/frontend/src/app/(admin)/comercial/disponibilidade/mapa-teatro.tsx`,
  `app/frontend/src/app/(admin)/comercial/disponibilidade/detalhe-unidade.tsx`. Ver AD-05 e AD-14 em
  `DECISOES.md` antes de tocar na regra de cálculo — a causa raiz pode estar na forma como a compra
  complementar é somada ao pool vs. à reserva de overbooking (pool comercial por operação, AD-14).
- **ALP-91/92/93 (Recebimento de Carga):**
  `app/frontend/src/app/(admin)/recebimento/recebimento-carga/recebimento-carga-client.tsx`,
  `app/backend/src/modules/operacao/recebimento/recebimento.module.ts`,
  `app/backend/src/modules/operacao/recebimento/dto/pedido-fornecedor.dto.ts`.
- **ALP-94/95/96/97/98/99 (Pesagem e Destinação):**
  `app/frontend/src/app/(admin)/recebimento/pesagem-destinacao/pesagem-destinacao-client.tsx`,
  `app/backend/src/modules/operacao/pesagem/pesagem.controller.ts`,
  `app/backend/src/modules/operacao/pesagem/captura.ts`,
  `app/backend/src/modules/operacao/pesagem/compatibilidade.ts`,
  `app/backend/src/modules/operacao/pesagem/associacao-score.ts`. Campo "Buscar cliente" (ALP-98)
  provavelmente reaproveita o componente de busca de cliente já usado em Pedidos de Venda — verificar
  se o filtro por Nome Fantasia já existe lá (`app/backend/src/modules/cadastros/clientes/clientes.service.ts`)
  e não está sendo repassado/usado neste contexto.

## Processo recomendado para quem assumir

1. Ler cada issue no Linear (descrição + captura de tela anexada) antes de tocar em código.
2. Decidir, por grupo de issues, se o escopo justifica um plano tático formal em
   `docs/superpowers/plans/` seguindo o formato de `pipeline-execucao.md` §6 (recomendado ao menos
   para o grupo ALP-88/89/90, que exige investigação de causa raiz) ou se é ajuste mecânico direto
   (ex.: ALP-95, ALP-96, ALP-97).
3. Branch/worktree dedicado a partir de `develop` (nunca implementar no worktree coordenador nem
   commitar direto em `develop`/`main`).
4. Implementar respeitando a constituição (regra de negócio só no backend, transação+auditoria,
   tempo real por eventos, fidelidade visual ao DS v3, nenhuma falha silenciosa nem dado inventado).
5. Se a investigação de causa raiz (ALP-88/89/90) revelar uma decisão de produto não coberta pela
   constituição/`DECISOES.md`, **parar e reportar** — não inventar regra nova sem uma AD-xx do
   Quality Owner.
6. **Antes de abrir o PR**, rodar o gate local completo e só abrir o PR depois de tudo verde:

```powershell
npm ci
npm run lint
npm run type-check
npm run test
npm run build
Set-Location app/backend; npm run test:cov   # cobertura ≥80% linha e branch
Set-Location ../frontend; npm run test
```

7. Atualizar o status de cada issue no Linear (`In Progress` → `Done`) conforme o progresso, com
   comentário linkando commit/PR e evidência (prints antes/depois quando for ajuste visual).
8. Só então abrir o PR contra `develop`, com CI (oito jobs canônicos) verde — Portão 2 se o grupo
   seguiu o rito formal de onda.
