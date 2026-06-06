/**
 * Maps doc keys to metadata: title, short description, theme group, section.
 */
export const docMapping = [
  {
    key: '001',
    title: 'Visao Geral, Operacao e Fluxo Macro',
    shortTitle: 'Visao Geral & Fluxo',
    description: 'Modelo de cross-docking, fluxo macro em 12 macroetapas, principios fundamentais da operacao.',
    group: 'operacao',
    groupLabel: 'Operacao & Processos',
    section: 'negocio',
  },
  {
    key: '002',
    title: 'Compra Programada, Disponibilidade Virtual e Vendas',
    shortTitle: 'Compra & Vendas',
    description: 'Logica compra programada → disponibilidade virtual → venda por peca. Nucleo estrutural do sistema.',
    group: 'operacao',
    groupLabel: 'Operacao & Processos',
    section: 'negocio',
  },
  {
    key: '003',
    title: 'Regras Funcionais por Tela — Bloco Estrutural',
    shortTitle: 'Regras Funcionais',
    description: '8 telas com regras funcionais detalhadas, regras transversais e validacoes.',
    group: 'funcional',
    groupLabel: 'Detalhamento Funcional',
    section: 'modulos',
  },
  {
    key: '004',
    title: 'Campos e Acoes — Compra Programada e Pedido de Venda',
    shortTitle: 'Tela Compra & Pedido',
    description: 'Campos, blocos, acoes e comportamentos das telas de compra e pedido de venda.',
    group: 'funcional',
    groupLabel: 'Detalhamento Funcional',
    section: 'modulos',
  },
  {
    key: '005',
    title: 'Campos e Acoes — Disponibilidade Virtual e Recebimento',
    shortTitle: 'Tela Disponibilidade & Recebimento',
    description: 'Campos, acoes e divergencias nas telas de disponibilidade e recebimento.',
    group: 'funcional',
    groupLabel: 'Detalhamento Funcional',
    section: 'modulos',
  },
  {
    key: '006',
    title: 'Campos e Acoes — Pesagem/Associacao e Expedicao',
    shortTitle: 'Tela Pesagem & Expedicao',
    description: 'Telas de pesagem com sugestao inteligente e expedicao/caminhao.',
    group: 'funcional',
    groupLabel: 'Detalhamento Funcional',
    section: 'modulos',
  },
  {
    key: '007',
    title: 'Corte, Transformacao, Rastreabilidade e Reetiquetagem',
    shortTitle: 'Corte & Transformacao',
    description: 'Modulo de corte: transformacao de pecas, subitens, rastreabilidade ponta a ponta.',
    group: 'funcional',
    groupLabel: 'Detalhamento Funcional',
    section: 'modulos',
  },
  {
    key: '008',
    title: 'Faturamento, Documentos Fiscais, Seguro e Liberacao',
    shortTitle: 'Faturamento & Liberacao',
    description: 'Consolidacao fiscal, emissao de NF, seguro de carga, liberacao do caminhao.',
    group: 'funcional',
    groupLabel: 'Detalhamento Funcional',
    section: 'modulos',
  },
  {
    key: '009',
    title: 'Dashboards, KPIs, Alertas e Monitoramento em Tempo Real',
    shortTitle: 'Dashboards & KPIs',
    description: '5 dashboards, dezenas de KPIs, sistema de alertas multinivel, atualizacao em tempo real.',
    group: 'inteligencia',
    groupLabel: 'Inteligencia & Monitoramento',
    section: 'inteligencia',
  },
  {
    key: '010',
    title: 'Modelo de Dados Conceitual e Entidades Principais',
    shortTitle: 'Modelo Conceitual',
    description: '11 macrodominios, 31 entidades, estados, eventos de dominio.',
    group: 'tecnico',
    groupLabel: 'Arquitetura Tecnica',
    section: 'arquitetura',
  },
  {
    key: '011',
    title: 'Modelo Logico do Banco de Dados',
    shortTitle: 'Schema do Banco',
    description: 'Tabelas, campos, indices, constraints, transacoes criticas.',
    group: 'tecnico',
    groupLabel: 'Arquitetura Tecnica',
    section: 'arquitetura',
  },
  {
    key: '012',
    title: 'Arquitetura Aplicacional, Modulos e Servicos',
    shortTitle: 'Arquitetura Aplicacional',
    description: '5 camadas, servicos especializados, estrategia V1 monolito modular.',
    group: 'tecnico',
    groupLabel: 'Arquitetura Tecnica',
    section: 'arquitetura',
  },
  {
    key: '013',
    title: 'Perfis de Acesso e Segregacao de Funcoes',
    shortTitle: 'Perfis & Seguranca',
    description: '11 perfis operacionais, matriz de permissoes, acoes de auditoria obrigatoria.',
    group: 'seguranca',
    groupLabel: 'Seguranca & Governanca',
    section: 'seguranca',
  },
  {
    key: '014',
    title: 'Eventos de Dominio e Tempo Real',
    shortTitle: 'Eventos & Tempo Real',
    description: 'Arquitetura de eventos, canais real-time, workflows assincrono.',
    group: 'tecnico',
    groupLabel: 'Arquitetura Tecnica',
    section: 'arquitetura',
  },
  {
    key: '015',
    title: 'Roadmap de Implantacao e Faseamento',
    shortTitle: 'Roadmap 6 Fases',
    description: '6 fases incrementais, dependencias, riscos, criterios de sucesso por fase.',
    group: 'implantacao',
    groupLabel: 'Implantacao & Infraestrutura',
    section: 'roadmap',
  },
  {
    key: '016',
    title: 'Wireframes e Fluxos por Tela',
    shortTitle: 'Wireframes & Fluxos',
    description: 'Wireframes das 10 telas principais, fluxos de navegacao, jornada master.',
    group: 'funcional',
    groupLabel: 'Detalhamento Funcional',
    section: 'modulos',
  },
  {
    key: '017',
    title: 'Infraestrutura e Equipamentos',
    shortTitle: 'Equipamentos',
    description: 'Inventario de equipamentos, especificacoes, postos de trabalho, contingencia.',
    group: 'implantacao',
    groupLabel: 'Implantacao & Infraestrutura',
    section: 'infraestrutura',
  },
  {
    key: '018',
    title: 'Arquitetura On-Premises e Topologia',
    shortTitle: 'Topologia On-Premises',
    description: 'Topologia de rede, servidor local, estacoes Linux, acesso externo seguro.',
    group: 'implantacao',
    groupLabel: 'Implantacao & Infraestrutura',
    section: 'infraestrutura',
  },
];

/**
 * Get docs by group
 */
export function getDocsByGroup(group) {
  return docMapping.filter((d) => d.group === group);
}

/**
 * Get docs by section
 */
export function getDocsBySection(section) {
  return docMapping.filter((d) => d.section === section);
}

/**
 * Get unique groups with labels
 */
export function getGroups() {
  const seen = new Map();
  docMapping.forEach((d) => {
    if (!seen.has(d.group)) seen.set(d.group, d.groupLabel);
  });
  return [...seen.entries()].map(([key, label]) => ({ key, label }));
}
