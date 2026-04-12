export const flowNodes = [
  // GROUP: planejamento
  { data: { id: 'compra', label: 'Compra Programada', group: 'planejamento', description: 'Comprador define e confirma a compra do dia com fornecedor.' }},
  { data: { id: 'desdobramento', label: 'Desdobramento Comercial', group: 'planejamento', description: 'Compra desdobrada em itens comerciais via regras configuradas.' }},
  { data: { id: 'disponibilidade', label: 'Disponibilidade Virtual', group: 'planejamento', description: 'Saldo virtual gerado por item comercial para o dia.' }},

  // GROUP: comercial
  { data: { id: 'venda', label: 'Pedido de Venda', group: 'comercial', description: 'Comercial vende por peca/unidade contra saldo virtual.' }},
  { data: { id: 'reserva', label: 'Reserva de Saldo', group: 'comercial', description: 'Saldo reservado imediatamente ao salvar pedido.' }},
  { data: { id: 'esgotamento', label: 'Esgotamento do Item', group: 'comercial', description: 'Quando saldo zera, vendas sao bloqueadas automaticamente.' }},

  // GROUP: recebimento
  { data: { id: 'chegada', label: 'Chegada do Lote', group: 'recebimento', description: 'Fornecedor entrega mercadoria no dock.' }},
  { data: { id: 'conferencia_nf', label: 'Conferencia NF', group: 'recebimento', description: 'NF do fornecedor comparada com compra programada.' }},
  { data: { id: 'apuracao', label: 'Apuracao Fisica', group: 'recebimento', description: 'Quantidade e qualidade conferidas fisicamente.' }},
  { data: { id: 'divergencia', label: 'Divergencia?', group: 'recebimento', description: 'Se ha diferenca entre esperado e recebido, abre ocorrencia formal.', type: 'decision' }},
  { data: { id: 'tratamento_div', label: 'Tratamento de Divergencia', group: 'recebimento', description: 'Classificacao, acao imediata, impacto nos pedidos, ocorrencia com fornecedor.' }},

  // GROUP: pesagem
  { data: { id: 'pesagem', label: 'Pesagem da Peca', group: 'pesagem', description: 'Peca identificada, classificada e pesada na balanca.' }},
  { data: { id: 'sugestao', label: 'Sugestao Inteligente', group: 'pesagem', description: 'Sistema sugere pedido mais compativel com base em preferencias do cliente.' }},
  { data: { id: 'decisao_op', label: 'Decisao do Operador', group: 'pesagem', description: 'Operador confirma sugestao ou redireciona por expertise.', type: 'decision' }},
  { data: { id: 'associacao', label: 'Associacao Peca-Pedido', group: 'pesagem', description: 'Peca vinculada ao pedido com rastreabilidade completa.' }},
  { data: { id: 'etiqueta', label: 'Emissao de Etiqueta', group: 'pesagem', description: 'Etiqueta com QR impressa: peca, cliente, pedido, peso, rota.' }},

  // GROUP: corte
  { data: { id: 'corte_necessario', label: 'Corte Necessario?', group: 'corte', description: 'Peca precisa de transformacao (corte, subdivisao)?', type: 'decision' }},
  { data: { id: 'transformacao', label: 'Transformacao/Corte', group: 'corte', description: 'Peca cortada em subitens, cada um pesado e classificado.' }},
  { data: { id: 'reetiquetagem', label: 'Reetiquetagem', group: 'corte', description: 'Novos subitens recebem etiquetas proprias, original invalidada.' }},

  // GROUP: expedicao
  { data: { id: 'carga', label: 'Montagem de Carga', group: 'expedicao', description: 'Pecas carregadas no caminhao por pedido/cliente.' }},
  { data: { id: 'transferencia', label: 'Transferencia entre Pedidos', group: 'expedicao', description: 'Enquanto expedicao aberta, pecas podem trocar de pedido.' }},
  { data: { id: 'conferencia_carga', label: 'Conferencia de Carga', group: 'expedicao', description: 'Checklist final da carga: previsto vs carregado.' }},
  { data: { id: 'fechamento', label: 'Fechamento da Expedicao', group: 'expedicao', description: 'Carga fechada. A partir daqui, nenhuma alteracao de destino.' }},

  // GROUP: faturamento
  { data: { id: 'consolidacao', label: 'Consolidacao Fiscal', group: 'faturamento', description: 'Dados da carga real consolidados para emissao.' }},
  { data: { id: 'emissao_nf', label: 'Emissao de NF', group: 'faturamento', description: 'Nota fiscal emitida e autorizada na SEFAZ.' }},
  { data: { id: 'seguro', label: 'Seguro de Carga', group: 'faturamento', description: 'Seguro gerado conforme obrigatoriedade.' }},
  { data: { id: 'docs_motorista', label: 'Docs para Motorista', group: 'faturamento', description: 'DANFE, romaneio, rota enviados ao motorista.' }},
  { data: { id: 'liberacao', label: 'Liberacao do Caminhao', group: 'faturamento', description: 'Checklist final OK — caminhao liberado para entrega.' }},
];

export const flowEdges = [
  { data: { source: 'compra', target: 'desdobramento' }},
  { data: { source: 'desdobramento', target: 'disponibilidade' }},
  { data: { source: 'disponibilidade', target: 'venda' }},
  { data: { source: 'venda', target: 'reserva' }},
  { data: { source: 'reserva', target: 'esgotamento' }},
  { data: { source: 'disponibilidade', target: 'chegada' }},
  { data: { source: 'chegada', target: 'conferencia_nf' }},
  { data: { source: 'conferencia_nf', target: 'apuracao' }},
  { data: { source: 'apuracao', target: 'divergencia' }},
  { data: { source: 'divergencia', target: 'tratamento_div', label: 'Sim' }},
  { data: { source: 'divergencia', target: 'pesagem', label: 'Nao' }},
  { data: { source: 'tratamento_div', target: 'pesagem' }},
  { data: { source: 'pesagem', target: 'sugestao' }},
  { data: { source: 'sugestao', target: 'decisao_op' }},
  { data: { source: 'decisao_op', target: 'associacao' }},
  { data: { source: 'associacao', target: 'etiqueta' }},
  { data: { source: 'etiqueta', target: 'corte_necessario' }},
  { data: { source: 'corte_necessario', target: 'transformacao', label: 'Sim' }},
  { data: { source: 'corte_necessario', target: 'carga', label: 'Nao' }},
  { data: { source: 'transformacao', target: 'reetiquetagem' }},
  { data: { source: 'reetiquetagem', target: 'carga' }},
  { data: { source: 'carga', target: 'transferencia' }},
  { data: { source: 'transferencia', target: 'conferencia_carga' }},
  { data: { source: 'conferencia_carga', target: 'fechamento' }},
  { data: { source: 'fechamento', target: 'consolidacao' }},
  { data: { source: 'consolidacao', target: 'emissao_nf' }},
  { data: { source: 'emissao_nf', target: 'seguro' }},
  { data: { source: 'seguro', target: 'docs_motorista' }},
  { data: { source: 'docs_motorista', target: 'liberacao' }},
];

export const flowGroups = {
  planejamento: { label: 'Planejamento & Compra', color: '#06b6d4' },
  comercial: { label: 'Comercial & Vendas', color: '#3b82f6' },
  recebimento: { label: 'Recebimento', color: '#f59e0b' },
  pesagem: { label: 'Pesagem & Associacao', color: '#10b981' },
  corte: { label: 'Corte & Transformacao', color: '#a855f7' },
  expedicao: { label: 'Expedicao', color: '#f97316' },
  faturamento: { label: 'Faturamento & Liberacao', color: '#ef4444' },
};
