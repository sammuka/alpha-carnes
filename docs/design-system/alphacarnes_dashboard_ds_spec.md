# AlphaCarnes — Especificação Técnica da Tela e Componentes do Design System

**Documento:** `alphacarnes_dashboard_ds_spec.md`  
**Objetivo:** orientar a reconstrução fiel da tela de dashboard e dos componentes principais do AlphaCarnes DS no Figma.  
**Imagem de referência principal:** `Tela Ideia AlphaCarnes.png`  
**Dimensão da referência:** `1672 × 941 px`  
**Tema correto:** light theme com sidebar azul em gradiente.  
**Importante:** o DS do sistema **não** é dark industrial. O dark industrial pode ser usado na landing page, mas a aplicação operacional AlphaCarnes deve seguir o visual claro da tela de referência.

---

## 1. Direção visual do sistema

A tela de referência representa um dashboard operacional de distribuição de carnes com aparência de ERP moderno. O sistema deve ser claro, legível, objetivo e adequado para uso diário por operadores, supervisores e gestores.

A identidade visual combina:

- **Área principal clara:** fundo quase branco/cinza claro.
- **Cards brancos:** com bordas sutis e sombra mínima.
- **Sidebar forte:** gradiente azul, mantendo presença de marca.
- **Tipografia limpa:** Inter para UI e JetBrains Mono para números críticos.
- **Ícones lineares:** coerentes com a biblioteca de iconografia AlphaCarnes.
- **Estados operacionais:** recebido, pesado, expedido, divergência, bloqueado e pendente.

---

## 2. Canvas e layout macro

### 2.1 Frame base

| Propriedade | Valor |
|---|---:|
| Frame desktop referência | `1672 × 941 px` |
| Background app | `#F8FAFC` |
| Densidade | Média/alta, padrão ERP |
| Layout | Sidebar fixa + topbar + conteúdo + right rail |

### 2.2 Estrutura da tela

```text
Desktop / Dashboard Operacional
├── Sidebar fixa
│   ├── Logo AlphaCarnes
│   ├── Menu principal
│   └── Unidade ativa
├── Topbar
│   ├── Menu icon
│   ├── Título da seção
│   ├── Search input
│   ├── Notificação
│   └── Perfil do usuário
├── Content Area
│   ├── Page Header
│   ├── KPI Cards
│   ├── Pedidos em andamento / Table
│   └── Resumo de performance
└── Right Rail
    ├── Alertas operacionais
    └── Atividades recentes
```

### 2.3 Medidas macro recomendadas

| Região | Valor recomendado |
|---|---:|
| Sidebar width | `240 px` |
| Topbar height | `70 px` |
| Content left padding | `28 px` |
| Content right gap | `24 px` |
| Content max width antes do rail | flexível |
| Right rail width | `316–332 px` |
| Gap entre áreas | `24 px` |
| Card gap | `16–18 px` |
| Page padding bottom | `24 px` |

---

## 3. Design tokens

### 3.1 Cores base

| Token | Valor | Uso |
|---|---:|---|
| `color.bg.app` | `#F8FAFC` | Fundo geral da aplicação |
| `color.bg.card` | `#FFFFFF` | Cards, painéis e tabelas |
| `color.bg.elevated` | `#FFFFFF` | Elementos sobrepostos |
| `color.border.subtle` | `#E2E8F0` | Bordas de cards e inputs |
| `color.border.medium` | `#CBD5E1` | Bordas mais evidentes |
| `color.text.primary` | `#0F172A` | Títulos e dados principais |
| `color.text.secondary` | `#64748B` | Subtítulos e descrições |
| `color.text.muted` | `#94A3B8` | Metadados e placeholders |
| `color.white` | `#FFFFFF` | Texto/ícone sobre sidebar |

### 3.2 Azul de marca e ações

| Token | Valor | Uso |
|---|---:|---|
| `color.accent.primary` | `#2563EB` | Botão primário, link, item ativo |
| `color.accent.primary.hover` | `#1D4ED8` | Hover |
| `color.accent.primary.soft` | `rgba(37,99,235,0.12)` | Fundo suave para ícone/card |
| `color.accent.primary.border` | `rgba(37,99,235,0.28)` | Borda de pill/ativo |

### 3.3 Sidebar

| Token | Valor | Uso |
|---|---:|---|
| `color.sidebar.gradient.start` | `#1E3A5F` | Topo da sidebar |
| `color.sidebar.gradient.end` | `#2563EB` | Base da sidebar |
| `color.sidebar.item.active` | `rgba(255,255,255,0.18)` | Item ativo |
| `color.sidebar.item.hover` | `rgba(255,255,255,0.10)` | Hover |
| `color.sidebar.text` | `#FFFFFF` | Texto principal |
| `color.sidebar.text.muted` | `rgba(255,255,255,0.72)` | Texto secundário |
| `color.sidebar.badge` | `#0B74FF` | Badges de contagem |

### 3.4 Estados operacionais

| Estado | Token | Valor | Fundo suave | Uso |
|---|---|---:|---:|---|
| Recebido | `status.recebido` | `#3B82F6` | `rgba(59,130,246,0.12)` | Peças recebidas |
| Pesado | `status.pesado` | `#8B5CF6` | `rgba(139,92,246,0.12)` | Peso total/pesagem |
| Expedido | `status.expedido` | `#10B981` | `rgba(16,185,129,0.12)` | Pedidos expedidos |
| Divergência | `status.divergencia` | `#F59E0B` | `rgba(245,158,11,0.12)` | Divergências abertas |
| Bloqueado | `status.bloqueado` | `#EF4444` | `rgba(239,68,68,0.12)` | Bloqueios/críticos |
| Pendente | `status.pendente` | `#94A3B8` | `rgba(148,163,184,0.14)` | Aguardando ação |
| Success | `status.success` | `#16A34A` | `rgba(22,163,74,0.12)` | Variações positivas |
| Error | `status.error` | `#DC2626` | `rgba(220,38,38,0.12)` | Erro/queda |

### 3.5 Tipografia

| Estilo | Fonte | Tamanho | Peso | Line-height | Uso |
|---|---|---:|---:|---:|---|
| `heading.page` | Inter | 22 | 700 | 30 | Título `Dashboard Operacional` |
| `heading.section` | Inter | 18 | 700 | 26 | Títulos de cards grandes |
| `heading.card` | Inter | 14 | 600 | 20 | Títulos de KPI/cards |
| `body.default` | Inter | 14 | 400 | 20 | Texto padrão |
| `body.medium` | Inter | 14 | 500 | 20 | Labels importantes |
| `body.small` | Inter | 12 | 400 | 16 | Metadados |
| `label` | Inter | 12 | 600 | 16 | Badges/pills/table header |
| `caption` | Inter | 11 | 500 | 14 | Auxiliar |
| `value.kpi` | JetBrains Mono | 26 | 500 | 34 | Valores de KPI |
| `value.table` | JetBrains Mono | 14 | 500 | 20 | Pesos e códigos |
| `value.summary` | JetBrains Mono | 20 | 500 | 28 | Resumo de performance |

### 3.6 Espaçamento

```text
spacing.0 = 0
spacing.xs = 4
spacing.sm = 8
spacing.md = 12
spacing.lg = 16
spacing.xl = 24
spacing.2xl = 32
spacing.3xl = 48
```

### 3.7 Radius

```text
radius.none = 0
radius.sm = 4
radius.md = 8
radius.lg = 12
radius.xl = 16
radius.full = 9999
```

### 3.8 Sombras

| Token | Valor CSS aproximado | Uso |
|---|---|---|
| `shadow.sm` | `0 1px 2px rgba(15,23,42,0.04)` | Inputs, topbar |
| `shadow.md` | `0 2px 6px rgba(15,23,42,0.06)` | Cards |
| `shadow.lg` | `0 8px 24px rgba(15,23,42,0.08)` | Menus/dropdowns |
| `shadow.button` | `0 4px 10px rgba(37,99,235,0.22)` | Botão primário |

---

## 4. Sidebar

A sidebar é a principal área de marca do sistema. Ela deve ter gradiente azul vertical e ícones/textos brancos.

### 4.1 Anatomia

```text
Sidebar
├── Logo AlphaCarnes
├── NavGroup/Main
│   ├── SidebarItem Dashboard
│   ├── SidebarItem Recebimento + Badge 8
│   ├── SidebarItem Pesagem + Badge 3
│   ├── SidebarItem Expedição + Badge 12
│   ├── SidebarItem Estoque
│   ├── SidebarItem Pedidos
│   ├── SidebarItem Clientes
│   ├── SidebarItem Financeiro
│   ├── SidebarItem Relatórios
│   └── SidebarItem Configurações
└── UnitSelector
    ├── Icon Unidade/Matriz
    ├── Matriz - São Paulo
    ├── Unidade ativa
    └── Chevron
```

### 4.2 Medidas

| Elemento | Valor |
|---|---:|
| Width | `240 px` |
| Height | `100%` |
| Padding top | `24 px` |
| Padding horizontal | `24 px` |
| Logo height | `48 px` |
| Gap após logo | `36–40 px` |
| Sidebar item height | `52 px` |
| Sidebar item radius | `8 px` |
| Sidebar item padding | `12 px 14 px` |
| Gap icon-text | `12 px` |
| Icon size | `22–24 px` |
| Badge size | `28 × 28 px` ou `24 × 24 px` |
| Unit selector height | `72–84 px` |

### 4.3 Componente SidebarItem

```text
SidebarItem
Properties:
- Label: string
- Icon: instance swap
- State: Default | Hover | Active | Disabled
- Badge: None | Count
```

### 4.4 Menu conforme referência

```text
Dashboard
Recebimento    8
Pesagem        3
Expedição      12
Estoque
Pedidos
Clientes
Financeiro
Relatórios
Configurações
```

---

## 5. Topbar

### 5.1 Anatomia

```text
Topbar
├── Menu button
├── Title: Dashboard Operacional
├── SearchInput
├── NotificationButton
├── UserAvatar MP
├── UserName Marcos Pereira
├── UserRole Gerente Operacional
└── ChevronDown
```

### 5.2 Medidas

| Elemento | Valor |
|---|---:|
| Height | `70 px` |
| Background | `#FFFFFF` |
| Border bottom | `1 px #E2E8F0` |
| Padding horizontal | `28 px` |
| Search width | `460–480 px` |
| Search height | `40 px` |
| Avatar size | `40 px` |
| Notification size | `40 px` |

### 5.3 Search input

Texto de placeholder conforme referência:

```text
Buscar pedidos, clientes, produtos...
```

Shortcut:

```text
Ctrl + K
```

---

## 6. Page Header

### 6.1 Conteúdo

```text
Título: Dashboard Operacional
Subtítulo: Visão geral das operações do dia
```

### 6.2 Ações à direita

- Date selector: `23/05/2025`
- Botão primário: `Atualizar dados`

### 6.3 Medidas

| Elemento | Valor |
|---|---:|
| Header height | `64–72 px` |
| Date selector height | `40 px` |
| Primary button height | `40 px` |
| Gap entre ações | `12 px` |

---

## 7. KPI Cards

A primeira linha de conteúdo possui quatro KPIs.

### 7.1 Estrutura

```text
KPICard
├── IconCircle
├── Label
├── Value
└── Trend
    ├── Arrow
    ├── Percent
    └── Context text
```

### 7.2 Medidas

| Propriedade | Valor |
|---|---:|
| Height | `168 px` aprox. |
| Width | flexível, 4 colunas |
| Background | `#FFFFFF` |
| Border | `1 px #E2E8F0` |
| Radius | `12 px` |
| Padding | `24 px` |
| Gap interno | `16 px` |
| Icon circle | `48 × 48 px` |
| Value top margin | `24–28 px` |

### 7.3 Cards da referência

| Card | Label | Value | Icon | Status/Cor | Trend |
|---|---|---|---|---|---|
| 1 | Peças recebidas hoje | `1.248` | Recebimento/Caixa | Azul | `+12,5% vs ontem` |
| 2 | Peso total recebido | `24.680,50 kg` | Pesagem | Violeta | `+8,3% vs ontem` |
| 3 | Pedidos em expedição | `34` | Caminhão/Expedição | Verde | `+13,6% vs ontem` |
| 4 | Divergências abertas | `7` | Alerta | Âmbar | `-12,0% vs ontem` em vermelho |

### 7.4 Tipografia dos KPIs

| Elemento | Estilo |
|---|---|
| Label | Inter 14/500 `#0F172A` ou `#334155` |
| Value | JetBrains Mono 28/500 `#0F172A` |
| Unidade `kg` | Inter 16/500 `#0F172A` |
| Trend positivo | Inter 12/600 `#10B981` |
| Trend negativo | Inter 12/600 `#EF4444` |
| `vs ontem` | Inter 12/400 `#64748B` |

---

## 8. Tabela Pedidos em andamento

### 8.1 Card da tabela

```text
TableCard
├── TableHeader
│   ├── Icon Documento/Tabela
│   ├── Title: Pedidos em andamento
│   ├── FilterButton
│   └── SearchInput
├── Table
│   ├── HeaderRow
│   ├── DataRows
│   └── RowActions
└── TableFooter
    ├── Result count
    └── Pagination
```

### 8.2 Medidas

| Propriedade | Valor |
|---|---:|
| Card width | ocupa área principal |
| Background | `#FFFFFF` |
| Border | `1 px #E2E8F0` |
| Radius | `12 px` |
| Header height | `56 px` |
| Row height | `39–44 px` |
| Footer height | `52 px` |
| Padding horizontal | `20 px` |

### 8.3 Colunas

```text
Pedido
Cliente
Produto / Corte
Peso
Status
Data
Ações
```

### 8.4 Dados conforme referência

| Pedido | Cliente | Produto / Corte | Peso | Status | Data |
|---|---|---|---:|---|---|
| `PED-000984` | Frigorífico Bom Corte | Contrafilé | `1.256,30 kg` | Recebido | `23/05/2025 08:15` |
| `PED-000983` | Supermercado Alfa | Picanha | `782,40 kg` | Pesado | `23/05/2025 08:10` |
| `PED-000982` | Casa de Carnes São José | Coxão Mole | `543,20 kg` | Expedido | `23/05/2025 07:45` |
| `PED-000981` | Atacadão Carnes | Patinho | `1.034,80 kg` | Divergência | `23/05/2025 07:30` |
| `PED-000980` | Restaurante Grill | Costela Bovina | `612,10 kg` | Bloqueado | `23/05/2025 07:10` |
| `PED-000979` | Mercado Ideal | Acém | `890,00 kg` | Pendente | `23/05/2025 06:55` |

### 8.5 StatusPill

```text
StatusPill
Properties:
- Status: Recebido | Pesado | Expedido | Divergência | Bloqueado | Pendente
- Size: Small | Medium
- Emphasis: Soft | Outline | Solid
```

### 8.6 Cores dos StatusPills

| Status | Texto | Border | Background |
|---|---:|---:|---:|
| Recebido | `#2563EB` | `rgba(37,99,235,0.35)` | `rgba(37,99,235,0.08)` |
| Pesado | `#8B5CF6` | `rgba(139,92,246,0.35)` | `rgba(139,92,246,0.08)` |
| Expedido | `#10B981` | `rgba(16,185,129,0.35)` | `rgba(16,185,129,0.08)` |
| Divergência | `#F59E0B` | `rgba(245,158,11,0.35)` | `rgba(245,158,11,0.10)` |
| Bloqueado | `#EF4444` | `rgba(239,68,68,0.35)` | `rgba(239,68,68,0.08)` |
| Pendente | `#64748B` | `rgba(100,116,139,0.35)` | `rgba(100,116,139,0.08)` |

---

## 9. Right Rail — Alertas operacionais

### 9.1 Estrutura

```text
AlertPanel
├── PanelHeader
│   ├── Icon Bell/Alert
│   ├── Title: Alertas operacionais
│   └── Link: Ver todos
└── AlertList
    ├── AlertItem Pedido bloqueado
    ├── AlertItem Divergências abertas
    ├── AlertItem Pesagem pendente
    └── AlertItem Estoque baixo
```

### 9.2 Dados conforme referência

| Alerta | Descrição | Hora | Badge |
|---|---|---:|---|
| Pedido bloqueado | `PED-000981 está bloqueado por divergência de peso.` | `07:10` | Bloqueado |
| Divergências abertas | `7 divergências aguardando conferência.` | `08:20` | Divergência |
| Pesagem pendente | `3 lotes aguardando pesagem.` | `08:05` | Pendente |
| Estoque baixo | `2 produtos com estoque abaixo do mínimo.` | `07:50` | Pendente |

### 9.3 Medidas

| Elemento | Valor |
|---|---:|
| Panel width | `316–332 px` |
| Panel background | `#FFFFFF` |
| Panel radius | `12 px` |
| Panel border | `1 px #E2E8F0` |
| Header height | `56 px` |
| Alert item min height | `78–88 px` |
| Icon circle | `44 × 44 px` |
| Gap item | `12 px` |

---

## 10. Right Rail — Atividades recentes

### 10.1 Estrutura

```text
ActivityPanel
├── PanelHeader
│   ├── Icon Documento/Tabela
│   ├── Title: Atividades recentes
│   └── Link: Ver todas
└── ActivityList
    ├── ActivityItem João Santos
    ├── ActivityItem Ana Clara
    ├── ActivityItem Rafael Pereira
    └── ActivityItem Lucas Silva
```

### 10.2 Dados conforme referência

| Usuário | Iniciais | Atividade | Hora |
|---|---|---|---:|
| João Santos | JS | Confirmou recebimento do pedido `PED-000984` | `08:15` |
| Ana Clara | AC | Registrou divergência no pedido `PED-000981` | `07:42` |
| Rafael Pereira | RP | Expediu o pedido `PED-000982` | `07:45` |
| Lucas Silva | LS | Cadastrou novo lote `LOTE-7845` | `07:20` |

### 10.3 Avatar initials

| Iniciais | Fundo | Texto |
|---|---:|---:|
| JS | `rgba(59,130,246,0.14)` | `#2563EB` |
| AC | `rgba(139,92,246,0.14)` | `#8B5CF6` |
| RP | `rgba(16,185,129,0.14)` | `#10B981` |
| LS | `rgba(245,158,11,0.14)` | `#F59E0B` |

---

## 11. Resumo de performance

### 11.1 Estrutura

```text
PerformanceSummaryCard
├── Header
│   ├── Icon gráfico de barras
│   └── Title: Resumo de performance
└── MetricsRow
    ├── MetricItem Rendimento médio
    ├── MetricItem Quebras registradas
    ├── MetricItem Tickets emitidos
    ├── MetricItem Clientes atendidos
    └── MetricItem Receita do dia
```

### 11.2 Dados conforme referência

| Métrica | Valor | Trend |
|---|---:|---:|
| Rendimento médio | `78,6%` | `+2,4% vs ontem` |
| Quebras registradas | `152,30 kg` | `-5,1% vs ontem` |
| Tickets emitidos | `86` | `+10,3% vs ontem` |
| Clientes atendidos | `28` | `+7,7% vs ontem` |
| Receita do dia | `R$ 132.450,00` | `+15,8% vs ontem` |

### 11.3 Medidas

| Propriedade | Valor |
|---|---:|
| Card height | `128–144 px` |
| Header height | `40 px` |
| Metric item width | flexível |
| Separador vertical | `1 px #E2E8F0` |
| Padding | `20–24 px` |

---

## 12. Botões

### 12.1 Primary Button

Usado em `Atualizar dados`.

| Propriedade | Valor |
|---|---:|
| Height | `40 px` |
| Padding | `0 16 px` |
| Radius | `8 px` |
| Background | `#2563EB` |
| Hover | `#1D4ED8` |
| Text | `#FFFFFF`, Inter 14/600 |
| Icon | `16–18 px`, branco |
| Shadow | `0 4px 10px rgba(37,99,235,0.22)` |

### 12.2 Secondary/Filter Button

Usado em `Filtrar` e date selector.

| Propriedade | Valor |
|---|---:|
| Height | `40 px` |
| Background | `#FFFFFF` |
| Border | `1 px #E2E8F0` |
| Radius | `8 px` |
| Text | `#334155` |
| Icon | `#64748B` |

---

## 13. Inputs

### 13.1 SearchInput

| Propriedade | Valor |
|---|---:|
| Height | `40 px` |
| Background | `#FFFFFF` |
| Border | `1 px #E2E8F0` |
| Radius | `8 px` |
| Padding | `0 12 px` |
| Icon | `20 px`, `#64748B` |
| Placeholder | `#94A3B8` |
| Focus border | `#2563EB` |
| Focus ring | `0 0 0 3px rgba(37,99,235,0.12)` |

---

## 14. Footer

Na parte inferior da tela existe um footer discreto.

```text
© 2025 AlphaCarnes – Todos os direitos reservados.
Versão 2.1.0
```

| Elemento | Valor |
|---|---:|
| Font | Inter 12/400 |
| Color | `#64748B` |
| Padding bottom | `20–24 px` |

---

## 15. Componentes Figma a criar

```text
Foundations
├── Color tokens
├── Type styles
├── Spacing tokens
├── Radius tokens
└── Shadow tokens

Brand
├── Logo/Horizontal
├── Logo/Symbol
└── Logo/Sidebar

Icons
├── Icon/[Name]
└── IconCard

Navigation
├── Sidebar
├── SidebarItem
├── Topbar
├── NotificationButton
└── UserMenu

Inputs
├── Button
├── SearchInput
├── DateSelector
├── FilterButton
└── IconButton

Data Display
├── KPICard
├── TableCard
├── TableRow
├── StatusPill
├── Badge
├── AvatarInitials
└── PerformanceMetric

Feedback
├── AlertPanel
├── AlertItem
├── ActivityPanel
├── ActivityItem
└── Toast

Templates
└── Dashboard Operacional
```

---

## 16. Responsividade

### 16.1 Desktop amplo

- Sidebar fixa `240 px`.
- Right rail visível.
- KPIs em 4 colunas.
- Tabela ocupa largura principal.

### 16.2 Desktop médio

- Sidebar pode permanecer fixa.
- Right rail pode reduzir para `280 px`.
- KPIs podem ficar em 2×2.

### 16.3 Tablet

- Sidebar vira compacta ou drawer.
- Right rail vai abaixo do conteúdo.
- KPIs em 2 colunas.

### 16.4 Mobile

- Sidebar vira menu lateral oculto.
- KPIs em 1 coluna.
- Tabela deve virar cards ou lista responsiva.

---

## 17. Checklists de qualidade

### 17.1 Fidelidade visual

- [ ] DS está claro, não dark.
- [ ] Sidebar está em gradiente azul `#1E3A5F → #2563EB`.
- [ ] Cards são brancos com borda sutil.
- [ ] Ícones são lineares e consistentes.
- [ ] Textos estão corrigidos e não reproduzem distorções da imagem.
- [ ] KPI values usam fonte mono ou equivalente.
- [ ] StatusPills têm as 6 variações operacionais.
- [ ] Right rail possui alertas e atividades como na referência.
- [ ] Footer discreto está presente.

### 17.2 Figma / Design System

- [ ] Todos os componentes usam Auto Layout.
- [ ] Tokens aplicados via variables.
- [ ] Sem fills hardcoded nos componentes principais.
- [ ] Componentes possuem variantes nomeadas.
- [ ] Ícones são instâncias, não imagens rasterizadas.
- [ ] Logo é vetor, não PNG.
- [ ] Tela final é uma composição de componentes.
- [ ] Tabela usa row component reutilizável.
- [ ] Sidebar usa SidebarItem reutilizável.

---

## 18. Observação crítica

A tela de referência deve balizar layout, hierarquia e aparência, mas a reconstrução deve corrigir textos e microelementos. Não reproduzir artefatos de IA, textos ilegíveis ou distorções. O objetivo é criar um DS profissional, componentizado e pronto para evolução no Figma.
