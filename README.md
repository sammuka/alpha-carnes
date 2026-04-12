# AlphaCarnes — Landing Page Interativa

Proposta tecnica e comercial interativa para o sistema de gestao operacional da AlphaCarnes, distribuidora de carnes em Osasco/SP.

Substitui uma apresentacao estatica (PowerPoint) por uma experiencia navegavel, com diagramas interativos, dashboards animados e toda a documentacao tecnica embutida.

## Requisitos

- **Node.js** 18+
- **npm** 9+

## Inicio Rapido

```bash
cd landing
npm install
npm run dev
```

Acesse `http://localhost:5173` no navegador (Chrome ou Edge recomendados).

## Build de Producao

```bash
npm run build
npm run preview   # preview local do build
```

Os arquivos estaticos sao gerados em `dist/`. Podem ser servidos por qualquer servidor estatico ou abertos diretamente no navegador.

## Stack

| Tecnologia | Uso |
|------------|-----|
| **Vite** | Bundler e dev server |
| **Vanilla JS (ES Modules)** | Sem framework — acesso direto ao DOM para D3/Cytoscape/GSAP |
| **Cytoscape.js + dagre** | Fluxogramas interativos (fluxo macro, maquinas de estado) |
| **D3.js** | Diagrama ER force-directed, topologia de rede animada |
| **GSAP + ScrollTrigger** (CDN) | Animacoes de scroll, contadores, parallax, typewriter |
| **tsParticles** (CDN) | Particulas animadas no hero |
| **marked** | Markdown para HTML (18 documentos) |
| **Mermaid.js** | Renderizacao de diagramas mermaid dentro dos docs |
| **Lenis** | Smooth scrolling |
| **Vanilla Tilt** (CDN) | Efeito 3D tilt nos cards |

## Estrutura do Projeto

```
landing/
├── index.html                  # Esqueleto HTML com 13 secoes
├── vite.config.js              # Configuracao Vite (base relativa, manual chunks)
├── package.json
│
├── css/
│   ├── variables.css           # Design tokens: cores, espacamento, tipografia
│   ├── base.css                # Reset, scrollbar, estilos globais
│   ├── layout.css              # Sidebar nav, grid, containers
│   ├── components.css          # Cards, botoes, accordions, tooltips, toolbar
│   ├── animations.css          # Keyframes, reveal, glow, typewriter
│   ├── sections.css            # Estilos por secao (hero, timeline, arch stack)
│   ├── diagrams.css            # Containers Cytoscape/D3, paineis de info
│   ├── dashboard.css           # Preview de dashboard (tabs, KPIs, alertas)
│   └── responsive.css          # Breakpoints tablet/mobile
│
├── js/
│   ├── main.js                 # Entry point — inicializa todas as secoes
│   │
│   ├── core/
│   │   ├── navigation.js       # Sidebar nav, scroll progress, section tracking
│   │   ├── scroll-engine.js    # IntersectionObserver para .reveal e .stagger
│   │   ├── animations.js       # GSAP: contadores animados, scroll reveals
│   │   └── doc-loader.js       # Import ?raw dos 18 .md, parse, mermaid lazy
│   │
│   ├── data/
│   │   ├── flow-nodes.js       # 29 nos + 29 arestas do fluxo macro
│   │   ├── er-entities.js      # 31 entidades, 7 dominios, 47 relacionamentos
│   │   ├── topology-nodes.js   # 27 dispositivos de rede, 26 conexoes
│   │   ├── state-definitions.js # 5 maquinas de estado (41 estados, 44 transicoes)
│   │   ├── module-definitions.js # 9 modulos funcionais
│   │   ├── kpi-definitions.js  # KPIs mock para preview de dashboard
│   │   ├── roadmap-phases.js   # 6 fases de implantacao
│   │   └── doc-mapping.js      # Mapeamento dos 18 docs por grupo/secao
│   │
│   ├── diagrams/
│   │   ├── macro-flow.js       # Cytoscape: fluxo macro interativo (29 nos)
│   │   ├── er-diagram.js       # D3: diagrama ER force-directed (31 entidades)
│   │   ├── topology-diagram.js # D3: topologia de rede com pacotes animados
│   │   └── state-machine.js    # Cytoscape: 5 maquinas de estado com tabs
│   │
│   └── sections/
│       ├── section-hero.js         # Particulas, typewriter, contadores
│       ├── section-business.js     # O Negocio — cross-docking explicado
│       ├── section-challenges.js   # Os Desafios — problemas sem sistema
│       ├── section-solution.js     # A Solucao — visao geral
│       ├── section-modules.js      # 9 modulos com docs expandiveis
│       ├── section-flow.js         # Fluxo operacional (macro-flow diagram)
│       ├── section-intelligence.js # Dashboard preview com KPIs
│       ├── section-architecture.js # Camadas + ER diagram + state machines
│       ├── section-infrastructure.js # Equipamentos + topologia de rede
│       ├── section-security.js     # Matriz de permissoes (11 perfis)
│       ├── section-roadmap.js      # Timeline interativa (6 fases)
│       ├── section-docs.js         # 18 docs organizados por tema
│       └── section-cta.js          # Call to action
│
└── docs/                       # 18 documentos de especificacao (.md)
    ├── 001-visao-geral-operacao-e-fluxo-macro.md
    ├── 002-compra-programada-disponibilidade-virtual-e-vendas.md
    ├── ...
    └── 018-arquitetura-onpremises-e-topologia-de-equipamentos-minimos.md
```

## Secoes da Landing Page

| # | Secao | Conteudo |
|---|-------|---------|
| 1 | **Hero** | Logo animado, particulas, typewriter, estatisticas |
| 2 | **O Negocio** | Cross-docking explicado em 6 etapas |
| 3 | **Os Desafios** | 6 problemas sem sistema integrado |
| 4 | **A Solucao** | Visao geral com 9 cards de modulos |
| 5 | **Modulos** | 9 modulos detalhados com docs expandiveis |
| 6 | **Fluxo Operacional** | Diagrama Cytoscape interativo (29 nos, 7 grupos) |
| 7 | **Inteligencia** | Preview de dashboard: 5 tabs, KPIs, alertas, semaforos |
| 8 | **Arquitetura** | 5 camadas + diagrama ER (31 entidades) + 5 maquinas de estado |
| 9 | **Infraestrutura** | Grid de equipamentos + topologia de rede animada (27 dispositivos) |
| 10 | **Seguranca** | Matriz de permissoes: 11 perfis x 10 capacidades |
| 11 | **Roadmap** | Timeline alternada com 6 fases expandiveis |
| 12 | **Documentacao** | Todos os 18 docs organizados por tema, com mermaid renderizado |
| 13 | **CTA** | Proximos passos e encerramento |

## Diagramas Interativos

### Fluxo Macro Operacional (Cytoscape + dagre)
- 29 nos em 7 grupos (planejamento, comercial, recebimento, pesagem, corte, expedicao, faturamento)
- Click em um no: BFS upstream/downstream com highlight de caminho
- Nos de decisao estilizados como losangos
- Zoom, pan, toolbar, legenda por grupo

### Diagrama ER (D3 force-directed)
- 31 entidades em 7 dominios de negocio
- 47 relacionamentos com cardinalidade (1:N, N:1)
- Drag nos, click para ver atributos e estados
- Toggle de dominios, zoom/pan

### Maquinas de Estado (Cytoscape + dagre)
- 5 entidades: Compra Programada, Peca, Caminhao, Nota Fiscal, Ordem de Corte
- 41 estados, 44 transicoes
- Tabs para navegar entre maquinas
- Click em estado: highlight transicoes de saida

### Topologia de Rede (D3 custom)
- 27 dispositivos: servidor, firewall, switch, APs, estacoes, balanças, impressoras, tablets, TVs, leitores QR
- 26 conexoes (ethernet, Wi-Fi, serial, USB)
- Pacotes de dados animados trafegando pela rede
- Toggle de camadas por tipo de conexao

## Identidade Visual

| Propriedade | Valor |
|-------------|-------|
| Fundo principal | `#0a0f1e` |
| Fundo alternado | `#0f172a` |
| Accent primario | `#06b6d4` (cyan) |
| Accent secundario | `#10b981` (emerald) |
| Cards | Glassmorphism: `rgba(15,23,42,0.7)` + `backdrop-filter: blur(12px)` |
| Tipografia | Inter (corpo), JetBrains Mono (codigo) |

## Documentacao Tecnica

Os 18 documentos em `docs/` cobrem a especificacao completa:

- **001-002**: Visao geral, compra programada, disponibilidade virtual
- **003-008**: Regras funcionais, campos por tela, corte, faturamento
- **009**: Dashboards, KPIs, alertas
- **010-011**: Modelo de dados conceitual e logico
- **012**: Arquitetura aplicacional
- **013**: Perfis de acesso e segregacao de funcoes
- **014**: Eventos de dominio e tempo real
- **015**: Roadmap de implantacao (6 fases)
- **016**: Wireframes e fluxos por tela
- **017-018**: Infraestrutura fisica e topologia de rede

Todos sao importados via `?raw` pelo Vite e renderizados com marked + mermaid dentro de accordions expandiveis.

## Decisoes Tecnicas

- **Cytoscape para fluxogramas, D3 para diagramas de dados/rede** — cada lib no que faz melhor
- **Dados pre-extraidos dos mermaid** — controle total sobre tooltips, interacoes, styling
- **Lazy init via IntersectionObserver** — hero carrega instantaneo, diagramas so quando visiveis
- **Docs bundled como strings JS (`?raw`)** — sem fetch em runtime, sem CORS, funciona offline
- **Manual chunks no Vite** — diagrams (cytoscape+d3) e content (marked+mermaid) separados
- **CDN para GSAP, tsParticles, VanillaTilt** — carregam globalmente sem aumentar o bundle

## Licenca

Projeto privado — uso exclusivo para proposta comercial AlphaCarnes.
