---
name: AlphaCarnes — DS v3 Evolução
description: Sistema operacional denso para gestão de distribuição de carnes, com dados tabulares em mono e paleta de status re-harmonizada.
colors:
  primary: "#2D6BBE"
  primary-hover: "#24589E"
  primary-active: "#1D4880"
  primary-soft: "#E8F0FA"
  neutral-bg: "#F4F6F9"
  neutral-fg: "#18202C"
  neutral-card: "#FFFFFF"
  neutral-border: "#DDE4EC"
  neutral-border-strong: "#C3CEDB"
  neutral-fg-secondary: "#4A5A6E"
  neutral-fg-faint: "#93A1B3"
  success: "#1B8449"
  warning: "#B87D0E"
  danger: "#C23325"
  status-recebido: "#1D5FAE"
  status-pesado: "#6636B8"
  status-expedido: "#177A43"
  status-divergencia: "#91620B"
  status-bloqueado: "#B3362A"
  status-pendente: "#55657A"
  sidebar-gradient-start: "#1E3A5F"
  sidebar-gradient-end: "#1B4E9B"
  provisorio-text: "#91620B"
typography:
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.04em"
  data:
    fontFamily: "JetBrains Mono, ui-monospace, 'Cascadia Mono', monospace"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "10px"
  full: "9999px"
spacing:
  control-h: "32px"
  control-h-compact: "28px"
  table-row-h: "36px"
  table-header-h: "30px"
  card-header-h: "38px"
  card-padding: "12px"
  page-padding: "16px"
  block-gap: "12px"
  topbar-h: "44px"
  sidebar-w: "232px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    height: "{spacing.control-h}"
    padding: "0 12px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-primary-active:
    backgroundColor: "{colors.primary-active}"
  button-secondary:
    backgroundColor: "{colors.neutral-card}"
    textColor: "{colors.neutral-fg}"
    rounded: "{rounded.md}"
    height: "{spacing.control-h}"
  input:
    backgroundColor: "{colors.neutral-card}"
    textColor: "{colors.neutral-fg}"
    rounded: "{rounded.md}"
    height: "{spacing.control-h}"
    padding: "0 10px"
  card:
    backgroundColor: "{colors.neutral-card}"
    textColor: "{colors.neutral-fg}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card-padding}"
  status-pill-recebido:
    backgroundColor: "#E7F0FB"
    textColor: "{colors.status-recebido}"
    rounded: "{rounded.full}"
  badge-provisorio:
    backgroundColor: "#FCF3DC"
    textColor: "{colors.provisorio-text}"
    rounded: "{rounded.sm}"
---

# Design System: AlphaCarnes — DS v3 Evolução

## Overview

**Creative North Star: "Evolução"**

A identidade original da AlphaCarnes — sidebar azul em gradiente, primária azul institucional, fundo claro — evoluiu, sem ser substituída, para suportar densidade operacional real: telas com 10 KPIs e 16 linhas de pedido cabendo em um viewport HD, colunas numéricas perfeitamente alinhadas, e um vocabulário completo de estados operacionais (recebido, pesado, expedido, divergência, bloqueado, pendente). Não é um redesign estético; é um refinamento funcional da mesma marca, aprovado pelo cliente em 2026-08-05 como referência visual canônica do produto (AD-07), substituindo o protótipo externo antigo nesse papel.

A interface não tenta impressionar — ela tenta caber mais operação por centímetro de tela sem perder legibilidade. Números e dados sensíveis (peso, valor, código) sempre em mono tabular; tudo o mais (rótulos, títulos, texto corrido) em Inter. A paleta é discreta: azul de ação usado com parcimônia, e uma paleta de status separada e re-harmonizada carrega o significado operacional (o que chegou, o que foi pesado, o que tem divergência).

**Key Characteristics:**
- Densidade operacional não-negociável: alturas de controle fixas (32px padrão, 28px compacto, 36px linha de tabela).
- Mono tabular (JetBrains Mono) exclusivamente para dados — nunca para rótulos ou texto corrido.
- Quase plana: 3 níveis de sombra sutis, elevação como sinal discreto, não decoração.
- Paleta de status operacional própria, distinta da paleta semântica genérica (sucesso/alerta/erro).
- Sidebar em gradiente azul-marinho preservada da identidade original.

## Colors

Paleta discreta: fundo claro neutro, azul de ação usado com parcimônia, e uma paleta de status operacional separada carregando o significado do fluxo físico da mercadoria.

### Primary
- **Azul Operacional** (`#2D6BBE`): cor de ação e marca — botões primários, foco, links, ícone ativo. Hover `#24589E`, active `#1D4880`. Usada com parcimônia fora de CTAs e estados ativos.

### Neutral
- **Névoa Clara** (`#F4F6F9`): fundo de página.
- **Tinta Quase-Preta** (`#18202C`): texto principal, títulos.
- **Branco Cartão** (`#FFFFFF`): superfície de cards, inputs, popovers.
- **Cinza-Azulado Secundário** (`#4A5A6E`): texto secundário (legendas, metadados).
- **Cinza-Azulado Fraco** (`#93A1B3`): placeholder, texto terciário, ícones inativos.
- **Borda Névoa** (`#DDE4EC`): divisores e bordas padrão.
- **Borda Névoa Forte** (`#C3CEDB`): bordas de controle (inputs, botões secundários).

### Paleta de Status Operacional (Named Rules)
Cada status do fluxo físico tem cor própria, com par texto/fundo/ponto — nunca reaproveita a paleta semântica genérica (sucesso/alerta/erro) para status de fluxo:
- **Recebido** — Azul Institucional (`#1D5FAE` sobre `#E7F0FB`).
- **Pesado** — Violeta Desossa (`#6636B8` sobre `#F1EAFB`): única cor violeta do sistema, reservada a este status.
- **Expedido** — Verde Concluído (`#177A43` sobre `#E3F5EA`).
- **Divergência** — Âmbar Atenção (`#91620B` sobre `#FCF3DC`) — mesma família do badge "Provisório", propositalmente, pois ambos sinalizam "precisa de atenção humana".
- **Bloqueado** — Vermelho Bloqueio (`#B3362A` sobre `#FCE9E6`).
- **Pendente** — Cinza Neutro (`#55657A` sobre `#EDF1F6`).

**The Status-Is-Not-Semantic Rule.** Cores de status operacional (StatusPill) nunca compartilham token com sucesso/alerta/erro genéricos, mesmo quando a cor "parece" a mesma família — são vocabulários diferentes (fluxo físico vs. resultado de ação).

### Semantic
- **Sucesso** (`#1B8449`): confirmações, indicador "tempo real".
- **Alerta** (`#B87D0E`): avisos, badge "Provisório".
- **Erro** (`#C23325`): ações destrutivas, validação inválida.

## Typography

**UI Font:** Inter (com `ui-sans-serif, system-ui, sans-serif`)
**Data Font:** JetBrains Mono (com `ui-monospace, 'Cascadia Mono', monospace`)

**Character:** Utilitária e neutra — Inter carrega toda a leitura (rótulos, títulos, texto corrido); JetBrains Mono aparece só onde números precisam se alinhar em coluna ou um código precisa ser inequívoco.

### Hierarchy
- **Title** (700, 1.125rem/18px, tracking -0.015em): título de página (`<h1>`), único por tela.
- **Body** (400, 0.8125rem/13px, line-height 1.45): base de toda a UI — a densidade do sistema vem de manter o corpo pequeno e consistente, não de reduzir espaçamento.
- **Label** (700, 0.6875rem/11px, uppercase, tracking 0.04em): cabeçalhos de tabela, rótulos de KPI.
- **Data** (700, 0.8125rem/13px, tracking -0.01em, `font-variant-numeric: tabular-nums`): valores de KPI, peso, moeda, quantidade em coluna, códigos (UUID curto, `ROM-*`, `CP-*`, `ETQ-*`, `CLI-*`, placas, CNPJ), datas/horas em coluna de tabela.

### Named Rules
**The Data-Mono Rule.** JetBrains Mono é usada exclusivamente para dados tabulares e códigos — nunca em rótulos, títulos ou texto corrido. Um número que não precisa alinhar em coluna com outros números não precisa ser mono.

## Layout

Grade de densidade não-negociável (núcleo do DS v3): controle padrão `32px` de altura, controle compacto (filtros, ações de linha) `28px`; linha de tabela `36px`, cabeçalho de tabela `30px`; cabeçalho de card `38px`, padding interno de card `12px`; padding de página `16px` com `12px` de espaçamento vertical entre blocos. Cabeçalho de página é sempre uma única linha (título + subtítulo + ações à direita), com `12px` de margem inferior. Topbar `44px`; sidebar `232px` (redimensionável entre 200–320px, largura persistida por usuário).

### Named Rules
**The One-Line Page Header Rule.** Título, subtítulo e ações de página cabem em uma única linha flexível — nunca em duas linhas ou um bloco de cabeçalho alto.

## Elevation & Depth

Sistema quase plano por padrão. Apenas três tokens de sombra (`--shadow-1/2/3`), todos sutis e de baixa opacidade sobre a tinta neutra do texto (não preto puro). A KPI strip e cards planos não usam sombra além de `shadow-1` (cards) ou nenhuma (KPI strip) — a separação visual vem de borda + fundo, não de profundidade. Sombra é reservada para o estado de repouso do card (`shadow-1`) e para camadas flutuantes reais: popovers/dropdowns (`shadow-2`) e modais (`shadow-3`).

### Shadow Vocabulary
- **shadow-1** (`0 1px 2px rgba(24, 32, 44, 0.06)`): repouso de cards, botões.
- **shadow-2** (`0 2px 6px rgba(24, 32, 44, 0.08), 0 1px 2px rgba(24, 32, 44, 0.05)`): popovers, menus flutuantes, menu de usuário da sidebar.
- **shadow-3** (`0 8px 24px rgba(24, 32, 44, 0.14), 0 2px 6px rgba(24, 32, 44, 0.08)`): modais/dialogs.

### Named Rules
**The Flat-By-Default Rule.** Elevação é sinal discreto de camada, nunca decoração. Nenhum componente novo recebe sombra além do token que corresponde à sua camada real (superfície, flutuante ou modal).

## Shapes

Três raios com papel fixo: `6px` (`rounded-md`) para todo controle interativo (botão, input, chip retangular); `8px` (`rounded-lg`) para cards e superfícies de conteúdo; `10px` (`rounded-xl`) reservado a modais/dialogs. Pills (StatusPill, FilterChip) usam `rounded-full`. Bordas são finas (1px), na cor neutra `#DDE4EC` (padrão) ou `#C3CEDB` (controles e ênfase).

### Named Rules
**The No New Radius Rule.** `rounded-xl` (10px) é exclusivo de modais. Nenhum card novo usa `rounded-xl`; cards são sempre `rounded-lg` (8px).

## Components

Todo componente segue a grade de densidade: altura de controle fixa, estados completos (default, hover, focus-visible com anel de 3px em `--color-ring` a 35% de opacidade, active, disabled, erro via `aria-invalid`, readonly, loading quando aplicável).

### Buttons
- **Shape:** `rounded-md` (6px), altura `32px` padrão / `28px` compacto (`sm`) / `36px` (`lg`).
- **Primary:** fundo Azul Operacional, texto branco, `shadow-1`; hover escurece para `#24589E`, active para `#1D4880`.
- **Secondary:** fundo branco, borda `#C3CEDB`, texto neutro; hover clareia a superfície de fundo.
- **Ghost:** sem fundo nem borda; hover aplica superfície neutra sutil.
- **Destructive / Destructive Outline:** vermelho sólido ou contorno vermelho sobre fundo claro danger.
- **Estado de loading:** ícone de spinner substitui o espaço à esquerda do rótulo, botão permanece com a largura estável.

### Chips (Filter Chip)
- **Style:** pill (`rounded-full`), altura `28px`, borda + fundo branco quando inativo.
- **State:** ativo usa `primary-soft` de fundo, borda `primary-soft-border` e texto `primary-fg` semibold; inativo tem hover que escurece levemente a borda e o fundo.

### Cards / Containers
- **Corner Style:** `rounded-lg` (8px).
- **Background:** branco (`#FFFFFF`) sobre fundo de página névoa (`#F4F6F9`).
- **Shadow Strategy:** `shadow-1` em repouso; ver Elevation & Depth.
- **Border:** 1px `#DDE4EC`.
- **Header:** altura fixa `38px`, borda inferior, título 13px bold.
- **Internal Padding:** `12px` (conteúdo), `8px`/`12px` (rodapé).

### Inputs / Fields
- **Style:** altura `32px`, `rounded-md`, borda `#C3CEDB`, fundo branco, texto 13px.
- **Focus:** borda muda para Azul Operacional + anel de 3px a 35% de opacidade.
- **Error / Disabled / Readonly:** borda vermelha com anel vermelho (erro); fundo cinza claro e texto apagado (disabled); fundo `surface-2` com texto secundário (readonly).
- **Adornos:** ícone à esquerda (padding extra) ou sufixo textual à direita (alinhado à direita, mono).

### Navigation (Sidebar)
- **Style:** gradiente azul-marinho preservado da identidade (`#1E3A5F` → `#1B4E9B`), texto branco em três níveis de opacidade (92% / 60% / 42%), largura `232px` redimensionável (200–320px) e persistida por usuário.
- **Estrutura:** logo + nome do produto no topo, grupos de navegação colapsáveis, menu de usuário fixo no rodapé com popover de logout (`shadow-2`).
- **Hover/Active:** item de navegação recebe overlay branco translúcido (8% hover, 16% ativo) sobre o gradiente — nunca uma cor sólida nova.

### Status Pill (Signature Component)
Pill de 20px de altura com ponto colorido de 5px + rótulo 11px semibold, uma cor dedicada por status operacional (ver Colors → Paleta de Status). É o principal veículo de significado operacional no sistema — toda tela de acompanhamento de fluxo usa a mesma pill, nunca uma variação ad-hoc.

### Badge Provisório (Signature Component)
Badge âmbar com ícone de alerta triangular, 18px de altura, usado exclusivamente para marcar decisões de produto ainda pendentes (Princípio VIII da constituição). Remover este badge de uma tela exige uma decisão registrada em `docs/execucao/DECISOES.md` — nunca é uma escolha de estilo.

### KPI Strip (Signature Component)
Faixa horizontal de KPIs dividida por bordas verticais finas, sem sombra própria (a moldura da strip já é `rounded-lg` + borda). Valor em mono tabular 20px bold, rótulo 11px acima, hint opcional 10px abaixo. Tom de cor do valor (`default`/`ok`/`alert`/`danger`) comunica severidade sem precisar de ícone.

## Do's and Don'ts

### Do:
- **Do** usar JetBrains Mono exclusivamente para peso, moeda, quantidade em coluna, códigos e datas/horas em coluna de tabela.
- **Do** manter todo controle interativo em `32px` (padrão) ou `28px` (compacto) — nunca introduzir uma terceira altura.
- **Do** aplicar os seis estados completos (default, hover, focus-visible, active, disabled, erro) em todo controle novo.
- **Do** usar a paleta de status operacional (StatusPill) só para o fluxo físico da mercadoria, nunca para resultado genérico de ação.
- **Do** preservar o gradiente azul-marinho da sidebar — é o elemento mais reconhecível da identidade herdada.

### Don't:
- **Don't** usar JetBrains Mono em rótulos, títulos ou texto corrido.
- **Don't** aplicar `rounded-xl` (10px) fora de modais/dialogs.
- **Don't** adicionar sombra além do token da camada real do componente (superfície/flutuante/modal); KPI strip e cards planos não ganham sombra extra.
- **Don't** reaproveitar cores de status operacional para badges de sucesso/alerta/erro genéricos, mesmo quando a cor "parece" a mesma família.
- **Don't** dividir um cabeçalho de página em duas linhas — título, subtítulo e ações cabem em uma linha flexível.
