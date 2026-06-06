export const dashboardTabs = [
  {
    id: 'executivo',
    label: 'Executivo',
    kpis: [
      { label: '% Lote Vendido', value: 87, suffix: '%', color: 'cyan' },
      { label: 'Pecas Expedidas', value: 342, color: 'emerald' },
      { label: 'Caminhoes Liberados', value: 4, suffix: '/6', color: 'blue' },
      { label: 'Divergencias Abertas', value: 2, color: 'amber' },
    ],
    alerts: [
      { text: 'Item "Dianteiro" esgotado', level: 'warning' },
      { text: 'Caminhao RT-03 aguardando faturamento', level: 'info' },
      { text: 'Divergencia critica: recebimento Lote #1247', level: 'critical' },
    ],
    progress: [
      { label: 'Recebimento do dia', value: 92 },
      { label: 'Pesagem concluida', value: 78 },
      { label: 'Expedicao finalizada', value: 65 },
    ],
  },
  {
    id: 'operacional',
    label: 'Operacional',
    kpis: [
      { label: 'Pecas Pesadas/h', value: 48, color: 'emerald' },
      { label: 'Fila de Pesagem', value: 12, color: 'amber' },
      { label: 'Tempo Medio Peca', value: 45, suffix: 's', color: 'cyan' },
      { label: 'Balancas Ativas', value: 3, suffix: '/4', color: 'blue' },
    ],
    alerts: [
      { text: 'Balanca #2 offline ha 15 minutos', level: 'critical' },
      { text: 'Fila de pesagem acima do normal', level: 'warning' },
      { text: 'Operador Marcos atingiu meta diaria', level: 'info' },
    ],
    progress: [
      { label: 'Lote Fornecedor A pesado', value: 100 },
      { label: 'Lote Fornecedor B pesado', value: 56 },
      { label: 'Lote Fornecedor C pesado', value: 23 },
    ],
  },
  {
    id: 'comercial',
    label: 'Comercial',
    kpis: [
      { label: 'Pedidos do Dia', value: 38, color: 'blue' },
      { label: 'Itens Esgotados', value: 3, color: 'red' },
      { label: 'Ticket Medio', value: 4850, prefix: 'R$', color: 'emerald' },
      { label: 'Clientes Atendidos', value: 22, color: 'cyan' },
    ],
    alerts: [
      { text: 'Picanha esgotada — 5 clientes em fila', level: 'critical' },
      { text: 'Cliente VIP Premium Carnes sem pedido hoje', level: 'warning' },
      { text: '3 pedidos aguardando aprovacao de credito', level: 'warning' },
    ],
    progress: [
      { label: 'Meta diaria de vendas', value: 87 },
      { label: 'Cobertura de clientes', value: 73 },
      { label: 'Saldo disponivel consumido', value: 91 },
    ],
  },
  {
    id: 'expedicao',
    label: 'Expedicao',
    kpis: [
      { label: 'Caminhoes em Carga', value: 2, color: 'amber' },
      { label: 'Pecas na Doca', value: 89, color: 'emerald' },
      { label: 'Conferencias OK', value: 3, suffix: '/6', color: 'blue' },
      { label: 'Transferencias Hoje', value: 7, color: 'cyan' },
    ],
    alerts: [
      { text: 'Caminhao RT-01 pronto para conferencia final', level: 'info' },
      { text: 'Pedido #2847 com peca pendente de pesagem', level: 'warning' },
      { text: 'Rota Centro atrasada — previsao 14:30', level: 'critical' },
    ],
    progress: [
      { label: 'Rota Norte carregada', value: 100 },
      { label: 'Rota Centro carregada', value: 72 },
      { label: 'Rota Sul carregada', value: 45 },
    ],
  },
  {
    id: 'faturamento',
    label: 'Faturamento',
    kpis: [
      { label: 'NFs Emitidas', value: 18, color: 'emerald' },
      { label: 'NFs Pendentes', value: 5, color: 'amber' },
      { label: 'Valor Faturado', value: 127, suffix: 'k', color: 'cyan' },
      { label: 'Rejeicoes SEFAZ', value: 0, color: 'emerald' },
    ],
    alerts: [
      { text: 'Certificado digital vence em 15 dias', level: 'warning' },
      { text: 'NF #4521 autorizada com sucesso', level: 'info' },
      { text: 'Seguro obrigatorio pendente para RT-05', level: 'warning' },
    ],
    progress: [
      { label: 'Faturamento Rota Norte', value: 100 },
      { label: 'Faturamento Rota Centro', value: 60 },
      { label: 'Faturamento Rota Sul', value: 0 },
    ],
  },
];
