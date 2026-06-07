# Prompt para Claude — Reconstrução do AlphaCarnes Design System no Figma

Use este prompt no Claude/Cursor para conduzir a reconstrução do AlphaCarnes Design System no Figma com base nos três documentos técnicos e nas três imagens corretas de referência.

---

## Prompt

Você é um designer de produto sênior e especialista em construção de Design Systems no Figma com alto rigor visual, componentização, tokens, Auto Layout e bibliotecas reutilizáveis.

Sua tarefa é reconstruir o **AlphaCarnes Design System** no Figma com máxima fidelidade às três imagens corretas de referência e aos três documentos técnicos anexados:

1. `alphacarnes_logo_spec.md`
2. `alphacarnes_iconography_spec.md`
3. `alphacarnes_dashboard_ds_spec.md`

Imagens corretas que devem balizar todo o trabalho:

1. `Logo AlphaCarnes.png`
2. `Iconografia AlphaCarnes.png`
3. `Tela Ideia AlphaCarnes.png`

Essas imagens são a referência visual correta. Ignore imagens anteriores que apresentavam dashboard dark, textos distorcidos ou logo inconsistente. O DS correto é **light theme com sidebar azul em gradiente**.

---

## Objetivo final

Criar no Figma uma página chamada:

```text
AlphaCarnes DS
```

Essa página deve conter:

1. Foundations completas.
2. Logo AlphaCarnes reconstruído como vetor/componentes.
3. Biblioteca de iconografia completa.
4. Componentes principais do sistema.
5. Template fiel do Dashboard Operacional.
6. Página organizada, auditável e pronta para virar biblioteca.

---

## Tese visual obrigatória

O sistema AlphaCarnes deve parecer um **ERP profissional para distribuição de carnes**, com foco em recebimento, pesagem, expedição, estoque, pedidos, clientes, financeiro, relatórios e configurações.

A linguagem visual é:

- Clara.
- Operacional.
- Moderna.
- Corporativa.
- Legível para uso diário.
- Fortemente componentizada.
- Com sidebar azul em gradiente como principal presença de marca.

Não criar uma landing page. Não criar visual dark industrial na aplicação. Não criar dashboard futurista. Não criar interface genérica.

---

## Restrições absolutas

1. **Não usar a imagem PNG como componente final.**  
   O logo e os ícones devem ser reconstruídos em vetor/componentes.

2. **Não reproduzir textos distorcidos das imagens.**  
   Corrija todos os labels conforme os documentos técnicos.

3. **Não criar valores hardcoded nos componentes principais.**  
   Use variables/tokens para cores, spacing, radius, tipografia e estados.

4. **Não alterar páginas de referência existentes.**  
   Se houver uma página base como GLOBO-ADS, ela deve ser somente leitura.

5. **Não iniciar pela tela.**  
   Criar primeiro foundations, depois logo, depois iconografia, depois componentes, depois template.

6. **Não usar Material Icons, SF Symbols ou bibliotecas externas como resultado final sem adaptação.**  
   A iconografia deve seguir a gramática AlphaCarnes.

7. **Não deixar elementos rasterizados dentro dos componentes finais.**

8. **Não deixar o DS escuro.**  
   A aplicação deve ser light theme. A sidebar é azul em gradiente.

---

## Arquivo Figma alvo

Se o arquivo Figma alvo estiver disponível, use-o. Caso exista o arquivo de referência mencionado no projeto:

```text
File key: dtPWIOJWm7CRPp3aiQi7nc
Página de referência: GLOBO-ADS / node 234:2 / somente leitura
Nova página: AlphaCarnes DS
```

Se não houver acesso a esse arquivo, crie a página no arquivo atualmente aberto/conectado e documente essa decisão.

---

## Antes de executar

Leia integralmente os três documentos:

```text
alphacarnes_logo_spec.md
alphacarnes_iconography_spec.md
alphacarnes_dashboard_ds_spec.md
```

Depois, analise visualmente as três imagens:

```text
Logo AlphaCarnes.png
Iconografia AlphaCarnes.png
Tela Ideia AlphaCarnes.png
```

Antes de qualquer alteração no Figma, produza um resumo do entendimento com:

1. Tema correto.
2. Cores principais.
3. Componentes a criar.
4. Ordem de execução.
5. Riscos de fidelidade visual.
6. Pontos que exigem validação humana.

Pare e solicite aprovação antes de criar elementos se o workflow exigir checkpoint.

---

## Fase 0 — Discovery

Execute uma análise do arquivo Figma e do contexto disponível.

Se MCP Figma estiver disponível, use ferramentas equivalentes a:

```text
whoami
get_metadata
get_variable_defs
get_libraries
get_design_context
get_screenshot
```

Objetivo:

- Confirmar arquivo ativo.
- Confirmar páginas existentes.
- Confirmar se há página de referência somente leitura.
- Identificar tokens existentes reutilizáveis.
- Identificar padrões de sidebar, spacing, radius e tipografia aproveitáveis.

Entregável da fase:

```text
Discovery Report
├── Arquivo ativo
├── Páginas encontradas
├── Bibliotecas disponíveis
├── Tokens existentes
├── Componentes reaproveitáveis
└── Plano final de criação
```

---

## Fase 1 — Criar página e Foundations

Crie a página:

```text
AlphaCarnes DS
```

Crie as seguintes seções:

```text
Cover / Identidade
Foundations
Logo
Iconografia
Components
Templates
QA / Audit
```

### 1.1 Color variables

Criar coleções de variáveis conforme os documentos.

#### Core colors

```text
color.bg.app = #F8FAFC
color.bg.card = #FFFFFF
color.bg.elevated = #FFFFFF
color.border.subtle = #E2E8F0
color.border.medium = #CBD5E1
color.text.primary = #0F172A
color.text.secondary = #64748B
color.text.muted = #94A3B8
color.white = #FFFFFF
```

#### Brand/accent

```text
color.accent.primary = #2563EB
color.accent.primary.hover = #1D4ED8
color.accent.primary.soft = rgba(37,99,235,0.12)
color.accent.primary.border = rgba(37,99,235,0.28)
```

#### Sidebar

```text
color.sidebar.gradient.start = #1E3A5F
color.sidebar.gradient.end = #2563EB
color.sidebar.item.active = rgba(255,255,255,0.18)
color.sidebar.item.hover = rgba(255,255,255,0.10)
color.sidebar.text = #FFFFFF
color.sidebar.text.muted = rgba(255,255,255,0.72)
color.sidebar.badge = #0B74FF
```

#### Status

```text
status.recebido = #3B82F6
status.pesado = #8B5CF6
status.expedido = #10B981
status.divergencia = #F59E0B
status.bloqueado = #EF4444
status.pendente = #94A3B8
status.success = #16A34A
status.error = #DC2626
```

#### Icon colors

```text
icon.primary = #2563EB
icon.neutral = #64748B
icon.success = #16A34A
icon.warning = #F59E0B
icon.error = #DC2626
icon.info = #2563EB
icon.white = #FFFFFF
icon.disabled = #CBD5E1
```

### 1.2 Spacing variables

```text
spacing.xs = 4
spacing.sm = 8
spacing.md = 12
spacing.lg = 16
spacing.xl = 24
spacing.2xl = 32
spacing.3xl = 48
```

### 1.3 Radius variables

```text
radius.sm = 4
radius.md = 8
radius.lg = 12
radius.xl = 16
radius.full = 9999
```

### 1.4 Type styles

Criar estilos:

```text
heading.page: Inter 22/700/30
heading.section: Inter 18/700/26
heading.card: Inter 14/600/20
body.default: Inter 14/400/20
body.medium: Inter 14/500/20
body.small: Inter 12/400/16
label: Inter 12/600/16
caption: Inter 11/500/14
value.kpi: JetBrains Mono 26/500/34
value.table: JetBrains Mono 14/500/20
value.summary: JetBrains Mono 20/500/28
```

Se JetBrains Mono não estiver disponível, use uma mono equivalente e registre isso no relatório.

Checkpoint: gerar screenshot das Foundations e validar antes de avançar.

---

## Fase 2 — Logo AlphaCarnes

Reconstruir o logo conforme `alphacarnes_logo_spec.md` e a imagem `Logo AlphaCarnes.png`.

### 2.1 Criar símbolo vetorial

Criar frame mestre:

```text
Logo Construction / Symbol / 512x512
```

Camadas sugeridas:

```text
LogoSymbol/AlphaCarnes
├── Arc/OuterBlue
├── Head/LeftHorn
├── Head/RightHorn
├── Head/CenterFace
├── Head/LeftFacePlane
├── Head/RightFacePlane
├── Cutout/LeftEyeNegative
├── Cutout/RightEyeNegative
├── Cutout/CenterNegative
└── Highlights/OptionalGradientOverlay
```

Instruções:

- Construir metade esquerda.
- Espelhar metade direita.
- Garantir simetria.
- Criar círculo parcial externo.
- Criar recortes internos limpos.
- Usar paths editáveis.
- Não usar o PNG como final.

### 2.2 Criar wordmark

Texto:

```text
AlphaCarnes
```

- `Alpha` em `#05224E`.
- `Carnes` em `#2563EB`.
- Usar fonte geométrica próxima: Exo 2, Rajdhani, Chakra Petch ou vetor customizado.
- Se o texto não ficar fiel, converter para vetor e ajustar manualmente.

Subtítulo:

```text
DISTRIBUIÇÃO DE CARNES
```

- Caixa alta.
- Tracking alto.
- Azul-marinho.
- Centralizado sob wordmark.

### 2.3 Criar componentes

```text
Brand / Logo / Horizontal / Full Color
Brand / Logo / Horizontal / White
Brand / Logo / Horizontal / Navy
Brand / Logo / Horizontal / No Tagline
Brand / Logo / Symbol / Full Color
Brand / Logo / Symbol / White
Brand / Logo / Symbol / Navy
Brand / Logo / Sidebar
Brand / Logo / App Icon
Brand / Logo / Favicon Simplified
```

Checkpoint: gerar screenshot do logo horizontal e símbolo isolado. Comparar com a imagem de referência.

---

## Fase 3 — Iconografia

Reconstruir a biblioteca de ícones conforme `alphacarnes_iconography_spec.md` e a imagem `Iconografia AlphaCarnes.png`.

### 3.1 Grid obrigatório

Cada ícone deve usar:

```text
Canvas: 24x24 px
Stroke padrão: 2 px
Cap: Round
Join: Round
Padding interno: 2 px
Bounding box preservado: 24x24 px
```

### 3.2 Ícones a criar

Criar os componentes:

```text
Icon/Dashboard
Icon/Recebimento
Icon/Pesagem
Icon/Expedicao
Icon/Estoque
Icon/Pedidos
Icon/Clientes
Icon/Financeiro
Icon/Relatorios
Icon/Configuracoes
Icon/Busca
Icon/Notificacoes
Icon/Usuario
Icon/Calendario
Icon/Filtro
Icon/Tabela
Icon/Caminhao
Icon/Caixa
Icon/Etiqueta
Icon/Balanca
Icon/CarneCorte
Icon/Frigorifico
Icon/Alerta
Icon/Check
Icon/Bloqueado
Icon/Pendente
Icon/Divergencia
Icon/Recebido
Icon/Pesado
Icon/Expedido
Icon/GraficoBarras
Icon/GraficoLinha
Icon/Documento
Icon/Impressao
Icon/Upload
Icon/Download
Icon/Menu
Icon/MaisAcoes
Icon/Avatar
Icon/Localizacao
Icon/UnidadeMatriz
```

### 3.3 Variantes

Cada ícone deve suportar:

```text
Size = 16 | 20 | 24 | 32 | 40
Color = Primary | Neutral | Success | Warning | Error | White | Disabled
State = Default | Hover | Active | Disabled
```

Se for inviável criar todas as variantes manualmente, crie o componente base com binding de cor e documente a estratégia.

### 3.4 Criar board de iconografia

Reproduzir a composição da imagem:

- Header com logo AlphaCarnes.
- Título `ICONOGRAFIA`.
- Subtítulo `Sistema de Design AlphaCarnes`.
- Paleta com `Primária #2563EB` e `Neutra #64748B`.
- Status de referência: Sucesso, Atenção, Erro, Informação.
- Grid de cards de ícones.

Checkpoint: gerar screenshot do board de iconografia e validar fidelidade.

---

## Fase 4 — Componentes principais

Criar componentes a partir dos tokens e da iconografia.

Ordem obrigatória:

1. `StatusPill`
2. `SidebarItem`
3. `Sidebar`
4. `Button`
5. `SearchInput`
6. `DateSelector`
7. `IconButton`
8. `KPICard`
9. `TableRow`
10. `TableCard`
11. `AlertItem`
12. `AlertPanel`
13. `ActivityItem`
14. `ActivityPanel`
15. `PerformanceMetric`
16. `PerformanceSummaryCard`
17. `AvatarInitials`
18. `Topbar`

### 4.1 StatusPill

Criar estados:

```text
Recebido
Pesado
Expedido
Divergência
Bloqueado
Pendente
```

Cada um deve usar as cores documentadas.

### 4.2 Sidebar

Reproduzir com alta fidelidade a sidebar da tela:

- Width `240 px`.
- Gradiente vertical `#1E3A5F → #2563EB`.
- Logo branco no topo.
- Itens com ícones brancos.
- Item ativo com overlay `rgba(255,255,255,0.18)`.
- Badges circulares nos itens Recebimento, Pesagem e Expedição.
- Unit selector no rodapé: `Matriz - São Paulo`, `Unidade ativa`.

### 4.3 Topbar

Reproduzir:

- Menu icon.
- Título `Dashboard Operacional`.
- Search input com placeholder `Buscar pedidos, clientes, produtos...`.
- Shortcut `Ctrl + K`.
- Notification icon com badge vermelho `5`.
- Avatar `MP`.
- Usuário `Marcos Pereira`.
- Cargo `Gerente Operacional`.

### 4.4 KPI Cards

Criar 4 cards:

```text
Peças recebidas hoje — 1.248 — +12,5% vs ontem
Peso total recebido — 24.680,50 kg — +8,3% vs ontem
Pedidos em expedição — 34 — +13,6% vs ontem
Divergências abertas — 7 — -12,0% vs ontem
```

### 4.5 TableCard

Criar tabela `Pedidos em andamento` com colunas:

```text
Pedido | Cliente | Produto / Corte | Peso | Status | Data | Ações
```

Dados:

```text
PED-000984 | Frigorífico Bom Corte | Contrafilé | 1.256,30 kg | Recebido | 23/05/2025 08:15
PED-000983 | Supermercado Alfa | Picanha | 782,40 kg | Pesado | 23/05/2025 08:10
PED-000982 | Casa de Carnes São José | Coxão Mole | 543,20 kg | Expedido | 23/05/2025 07:45
PED-000981 | Atacadão Carnes | Patinho | 1.034,80 kg | Divergência | 23/05/2025 07:30
PED-000980 | Restaurante Grill | Costela Bovina | 612,10 kg | Bloqueado | 23/05/2025 07:10
PED-000979 | Mercado Ideal | Acém | 890,00 kg | Pendente | 23/05/2025 06:55
```

Footer:

```text
Mostrando 1 a 6 de 20 pedidos
Paginação: 1 2 3 4
```

### 4.6 Right Rail

Criar dois painéis:

#### Alertas operacionais

```text
Pedido bloqueado — PED-000981 está bloqueado por divergência de peso. — 07:10 — Bloqueado
Divergências abertas — 7 divergências aguardando conferência. — 08:20 — Divergência
Pesagem pendente — 3 lotes aguardando pesagem. — 08:05 — Pendente
Estoque baixo — 2 produtos com estoque abaixo do mínimo. — 07:50 — Pendente
```

#### Atividades recentes

```text
João Santos — Confirmou recebimento do pedido PED-000984 — 08:15
Ana Clara — Registrou divergência no pedido PED-000981 — 07:42
Rafael Pereira — Expediu o pedido PED-000982 — 07:45
Lucas Silva — Cadastrou novo lote LOTE-7845 — 07:20
```

### 4.7 Resumo de performance

Criar card com:

```text
Rendimento médio — 78,6% — +2,4% vs ontem
Quebras registradas — 152,30 kg — -5,1% vs ontem
Tickets emitidos — 86 — +10,3% vs ontem
Clientes atendidos — 28 — +7,7% vs ontem
Receita do dia — R$ 132.450,00 — +15,8% vs ontem
```

Checkpoint: gerar screenshot dos componentes principais antes de montar o template.

---

## Fase 5 — Template Dashboard Operacional

Criar um frame desktop com dimensão da referência:

```text
1672 × 941 px
```

Montar a tela usando somente componentes criados.

### Layout obrigatório

```text
Frame 1672x941
├── Sidebar 240px
├── Topbar 70px
├── Main content
│   ├── PageHeader
│   ├── KPI Grid 4 columns
│   ├── TableCard
│   └── PerformanceSummaryCard
└── RightRail
    ├── AlertPanel
    └── ActivityPanel
```

### Footer

Adicionar:

```text
© 2025 AlphaCarnes – Todos os direitos reservados.
Versão 2.1.0
```

### Validação visual

Comparar com `Tela Ideia AlphaCarnes.png`:

- Sidebar deve parecer praticamente igual.
- Topbar deve manter mesma hierarquia.
- KPI cards devem ter mesma posição e respiro.
- Tabela deve ocupar a área central principal.
- Right rail deve estar à direita, com dois cards empilhados.
- O visual geral deve ser claro, limpo e corporativo.

Checkpoint: gerar screenshot final da tela.

---

## Fase 6 — QA e auditoria

Faça uma auditoria final:

### 6.1 Visual

- A tela está clara, não dark.
- Sidebar usa gradiente correto.
- Logo está fiel e vetorial.
- Ícones estão consistentes.
- Cards têm bordas e sombras sutis.
- Tipografia está coerente.
- Números críticos usam mono.
- Status estão com cores corretas.

### 6.2 Técnica Figma

- Todos os componentes principais usam Auto Layout.
- Variants estão nomeadas corretamente.
- Variables estão aplicadas.
- Não há PNG dentro de componentes finais.
- Não há textos distorcidos oriundos da imagem.
- Não há componentes sem nome semântico.
- A tela template usa instâncias, não desenhos soltos.

### 6.3 Entregáveis finais

Ao final, entregue um relatório com:

```text
1. Página criada
2. Lista de foundations criadas
3. Lista de componentes criados
4. Lista de ícones criados
5. Screenshots gerados
6. Itens que exigem validação humana
7. Diferenças assumidas em relação às imagens
8. Próximos passos recomendados
```

---

## Critério de aceite

A reconstrução será considerada boa se uma pessoa olhando o Figma e as imagens de referência reconhecer claramente que:

1. O logo é o mesmo conceito da imagem.
2. A iconografia segue exatamente a mesma linguagem.
3. A tela final parece uma versão limpa e profissional da referência.
4. O DS está pronto para uso por desenvolvedores e designers.
5. O produto não parece genérico.
6. A sidebar e os estados operacionais estão fiéis ao plano.

---

## Observação final

Priorize fidelidade visual e componentização profissional. Quando houver conflito entre copiar a imagem literalmente e criar um DS utilizável, prefira o DS utilizável, mas mantenha a aparência geral da referência. Corrija apenas distorções de texto e artefatos de geração por IA.
