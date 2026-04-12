/**
 * Definicoes dos 9 modulos funcionais do sistema AlphaCarnes.
 * Cada modulo mapeia para documentos de especificacao (doc-mapping.js).
 */
export const modules = [
  {
    id: 'compra',
    title: 'Compra Programada',
    icon: '\u{1F4E6}',
    color: 'cyan',
    summary:
      'Planejamento e confirmacao das compras diarias com fornecedores, gerando a base para toda a operacao do dia.',
    features: [
      'Lote unico por dia com controle sequencial',
      'Regras de desdobramento configuraveis por produto',
      'Confirmacao com validacao completa de quantidades e precos',
      'Gera disponibilidade virtual automaticamente apos confirmacao',
    ],
    docs: ['001', '002', '003', '004'],
  },
  {
    id: 'disponibilidade',
    title: 'Disponibilidade Virtual',
    icon: '\u{1F4CA}',
    color: 'emerald',
    summary:
      'Projecao em tempo real do estoque disponivel para venda, calculada a partir das compras confirmadas e regras de desdobramento.',
    features: [
      'Calculo automatico baseado na compra do dia',
      'Desdobramento inteligente de pecas e subitens',
      'Atualizacao em tempo real conforme vendas sao realizadas',
      'Visao consolidada por produto, fornecedor e cliente',
    ],
    docs: ['002', '003', '005'],
  },
  {
    id: 'vendas',
    title: 'Pedidos de Venda',
    icon: '\u{1F4B0}',
    color: 'blue',
    summary:
      'Registro e gestao dos pedidos de venda por peca, vinculados a disponibilidade virtual e com rastreabilidade completa.',
    features: [
      'Venda por peca com vinculo direto a disponibilidade',
      'Controle de limites por cliente e produto',
      'Historico completo de alteracoes e cancelamentos',
      'Validacao automatica de saldo disponivel antes da confirmacao',
    ],
    docs: ['002', '003', '004'],
  },
  {
    id: 'recebimento',
    title: 'Recebimento & Divergencias',
    icon: '\u{1F69A}',
    color: 'amber',
    summary:
      'Conferencia fisica da mercadoria recebida contra a compra programada, com tratamento automatizado de divergencias.',
    features: [
      'Conferencia item a item contra a nota do fornecedor',
      'Deteccao automatica de divergencias de peso, quantidade e preco',
      'Workflow de aprovacao para divergencias criticas',
      'Geracao de pendencias e ajustes automaticos no estoque',
      'Registro fotografico opcional para evidencias',
    ],
    docs: ['003', '005'],
  },
  {
    id: 'pesagem',
    title: 'Pesagem & Associacao Sugestiva',
    icon: '\u{2696}\u{FE0F}',
    color: 'cyan',
    summary:
      'Pesagem individual das pecas recebidas com sugestao inteligente de associacao aos pedidos de venda existentes.',
    features: [
      'Integracao direta com balancas industriais',
      'Algoritmo de sugestao que associa pecas aos pedidos mais adequados',
      'Etiquetagem automatica com codigo de rastreio unico',
      'Tolerancia configuravel por produto e cliente',
    ],
    docs: ['003', '006'],
  },
  {
    id: 'corte',
    title: 'Corte & Transformacao',
    icon: '\u{1FA93}',
    color: 'purple',
    summary:
      'Modulo de transformacao de pecas em subitens, com rastreabilidade ponta a ponta e controle de rendimento.',
    features: [
      'Definicao de fichas tecnicas de corte por produto',
      'Rastreabilidade completa da peca original aos subitens gerados',
      'Controle de rendimento real versus esperado',
      'Reetiquetagem automatica dos subitens com novo codigo',
      'Historico de transformacoes para auditoria',
    ],
    docs: ['007'],
  },
  {
    id: 'expedicao',
    title: 'Expedicao & Caminhao',
    icon: '\u{1F4E4}',
    color: 'emerald',
    summary:
      'Organizacao da carga por caminhao e rota, com conferencia final e controle de embarque.',
    features: [
      'Montagem de carga por caminhao e sequencia de entrega',
      'Conferencia final de volumes e pesos por pedido',
      'Controle de temperatura e lacre do veiculo',
      'Romaneio automatico com detalhamento por cliente',
    ],
    docs: ['006'],
  },
  {
    id: 'faturamento',
    title: 'Faturamento & Liberacao',
    icon: '\u{1F9FE}',
    color: 'blue',
    summary:
      'Consolidacao fiscal dos pedidos expedidos, emissao de NF-e, calculo de seguro e liberacao do caminhao.',
    features: [
      'Consolidacao automatica de pedidos por cliente para faturamento',
      'Emissao de NF-e integrada com SEFAZ',
      'Calculo automatico de seguro de carga',
      'Liberacao do caminhao condicionada a checklist completa',
    ],
    docs: ['008'],
  },
  {
    id: 'dashboards',
    title: 'Dashboards & Alertas',
    icon: '\u{1F4C8}',
    color: 'red',
    summary:
      'Paineis de monitoramento em tempo real com KPIs operacionais, alertas multinivel e visao executiva consolidada.',
    features: [
      'Cinco dashboards especializados por area operacional',
      'Dezenas de KPIs com atualizacao em tempo real',
      'Sistema de alertas multinivel — informativo, atencao e critico',
      'Visao executiva consolidada para diretoria',
      'Exportacao de relatorios e historico de indicadores',
    ],
    docs: ['009'],
  },
];
