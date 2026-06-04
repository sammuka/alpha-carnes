/**
 * Entity-Relationship data model for the AlphaCarnes meat distribution system.
 * Covers 7 functional domains with ~27 entities and ~45 relationships.
 */

export const erDomains = {
  comercial: { label: 'Comercial', color: '#06b6d4' },
  estoque: { label: 'Estoque & Pecas', color: '#10b981' },
  recebimento: { label: 'Recebimento', color: '#f59e0b' },
  producao: { label: 'Producao & Corte', color: '#8b5cf6' },
  expedicao: { label: 'Expedicao', color: '#3b82f6' },
  fiscal: { label: 'Fiscal & NF', color: '#ef4444' },
  sistema: { label: 'Sistema & Config', color: '#6b7280' },
};

export const erEntities = [
  // ── Comercial ──────────────────────────────────────────────────────
  {
    id: 'compra_programada',
    name: 'Compra Programada',
    domain: 'comercial',
    attributes: ['id', 'fornecedor_id', 'data_prevista', 'status', 'total_kg', 'numero_lote'],
    states: ['Rascunho', 'Confirmada', 'Recebendo', 'Finalizada', 'Cancelada'],
  },
  {
    id: 'item_compra',
    name: 'Item Compra',
    domain: 'comercial',
    attributes: ['id', 'compra_id', 'produto_id', 'qtd_kg', 'preco_unitario', 'subtotal'],
    states: [],
  },
  {
    id: 'fornecedor',
    name: 'Fornecedor',
    domain: 'comercial',
    attributes: ['id', 'razao_social', 'cnpj', 'inscricao_estadual', 'contato', 'ativo'],
    states: ['Ativo', 'Inativo', 'Bloqueado'],
  },
  {
    id: 'pedido_venda',
    name: 'Pedido Venda',
    domain: 'comercial',
    attributes: ['id', 'cliente_id', 'data_pedido', 'status', 'total_kg', 'total_valor', 'rota_id'],
    states: ['Rascunho', 'Confirmado', 'Em Separacao', 'Expedido', 'Faturado', 'Cancelado'],
  },
  {
    id: 'item_pedido',
    name: 'Item Pedido',
    domain: 'comercial',
    attributes: ['id', 'pedido_id', 'produto_id', 'qtd_kg', 'preco_kg', 'tolerancia_pct'],
    states: [],
  },
  {
    id: 'cliente',
    name: 'Cliente',
    domain: 'comercial',
    attributes: ['id', 'razao_social', 'cnpj', 'endereco', 'rota_padrao', 'limite_credito', 'ativo'],
    states: ['Ativo', 'Inativo', 'Bloqueado'],
  },
  {
    id: 'disponibilidade_virtual',
    name: 'Disponibilidade Virtual',
    domain: 'comercial',
    attributes: ['id', 'produto_id', 'data_referencia', 'qtd_prevista_kg', 'qtd_vendida_kg', 'saldo_kg'],
    states: ['Aberta', 'Esgotada', 'Fechada'],
  },

  // ── Recebimento ────────────────────────────────────────────────────
  {
    id: 'recebimento',
    name: 'Recebimento',
    domain: 'recebimento',
    attributes: ['id', 'compra_id', 'fornecedor_id', 'data_chegada', 'nf_fornecedor', 'status'],
    states: ['Aguardando', 'Em Conferencia', 'Conferido', 'Com Divergencia', 'Finalizado'],
  },
  {
    id: 'item_recebimento',
    name: 'Item Recebimento',
    domain: 'recebimento',
    attributes: ['id', 'recebimento_id', 'produto_id', 'qtd_esperada_kg', 'qtd_recebida_kg', 'divergencia_kg'],
    states: [],
  },
  {
    id: 'divergencia',
    name: 'Divergencia',
    domain: 'recebimento',
    attributes: ['id', 'recebimento_id', 'tipo', 'descricao', 'qtd_diferenca', 'resolucao', 'responsavel_id'],
    states: ['Aberta', 'Em Analise', 'Resolvida', 'Cancelada'],
  },

  // ── Estoque & Pecas ───────────────────────────────────────────────
  {
    id: 'peca',
    name: 'Peca',
    domain: 'estoque',
    attributes: ['id', 'produto_id', 'recebimento_id', 'peso_kg', 'etiqueta_id', 'status', 'peca_origem_id'],
    states: ['Recebida', 'Pesada', 'Associada', 'Em Corte', 'Expedida', 'Cancelada'],
  },
  {
    id: 'movimentacao_peca',
    name: 'Movimentacao Peca',
    domain: 'estoque',
    attributes: ['id', 'peca_id', 'tipo_mov', 'origem', 'destino', 'data_hora', 'usuario_id'],
    states: [],
  },
  {
    id: 'pesagem',
    name: 'Pesagem',
    domain: 'estoque',
    attributes: ['id', 'peca_id', 'balanca_id', 'peso_bruto', 'peso_liquido', 'tara', 'data_hora', 'operador_id'],
    states: [],
  },
  {
    id: 'produto',
    name: 'Produto',
    domain: 'estoque',
    attributes: ['id', 'nome', 'categoria_id', 'unidade', 'peso_medio_kg', 'ativo', 'ncm'],
    states: ['Ativo', 'Inativo'],
  },
  {
    id: 'categoria_produto',
    name: 'Categoria Produto',
    domain: 'estoque',
    attributes: ['id', 'nome', 'descricao', 'ordem'],
    states: [],
  },

  // ── Producao & Corte ──────────────────────────────────────────────
  {
    id: 'ordem_corte',
    name: 'Ordem Corte',
    domain: 'producao',
    attributes: ['id', 'peca_origem_id', 'ficha_tecnica_id', 'status', 'rendimento_real_pct', 'operador_id'],
    states: ['Pendente', 'Em Execucao', 'Finalizada', 'Cancelada'],
  },
  {
    id: 'item_corte',
    name: 'Item Corte',
    domain: 'producao',
    attributes: ['id', 'ordem_corte_id', 'produto_destino_id', 'peso_kg', 'peca_gerada_id'],
    states: [],
  },
  {
    id: 'ficha_tecnica',
    name: 'Ficha Tecnica',
    domain: 'producao',
    attributes: ['id', 'produto_origem_id', 'descricao', 'rendimento_esperado_pct', 'ativa'],
    states: ['Ativa', 'Inativa'],
  },
  {
    id: 'etiqueta',
    name: 'Etiqueta',
    domain: 'producao',
    attributes: ['id', 'peca_id', 'codigo_barras', 'qr_code', 'data_emissao', 'valida', 'tipo'],
    states: ['Ativa', 'Invalidada', 'Reimpressa'],
  },

  // ── Expedicao ─────────────────────────────────────────────────────
  {
    id: 'caminhao_expedicao',
    name: 'Caminhao Expedicao',
    domain: 'expedicao',
    attributes: ['id', 'placa', 'motorista', 'rota_id', 'data_saida', 'status', 'temperatura'],
    states: ['Aguardando', 'Em Carga', 'Conferido', 'Liberado', 'Em Transito'],
  },
  {
    id: 'item_expedicao',
    name: 'Item Expedicao',
    domain: 'expedicao',
    attributes: ['id', 'caminhao_id', 'peca_id', 'pedido_id', 'sequencia_entrega', 'conferido'],
    states: [],
  },
  {
    id: 'rota_entrega',
    name: 'Rota Entrega',
    domain: 'expedicao',
    attributes: ['id', 'nome', 'regiao', 'ordem_padrao', 'ativa'],
    states: ['Ativa', 'Inativa'],
  },

  // ── Fiscal & NF ───────────────────────────────────────────────────
  {
    id: 'nota_fiscal',
    name: 'Nota Fiscal',
    domain: 'fiscal',
    attributes: ['id', 'pedido_id', 'cliente_id', 'numero_nf', 'serie', 'chave_acesso', 'valor_total', 'status_sefaz'],
    states: ['Rascunho', 'Emitida', 'Autorizada', 'Rejeitada', 'Cancelada'],
  },
  {
    id: 'item_nf',
    name: 'Item NF',
    domain: 'fiscal',
    attributes: ['id', 'nota_fiscal_id', 'produto_id', 'qtd_kg', 'valor_unitario', 'cfop', 'icms_pct'],
    states: [],
  },
  {
    id: 'seguro_carga',
    name: 'Seguro Carga',
    domain: 'fiscal',
    attributes: ['id', 'caminhao_id', 'apolice', 'valor_segurado', 'vigencia_inicio', 'vigencia_fim'],
    states: ['Ativo', 'Expirado', 'Cancelado'],
  },

  // ── Sistema & Config ──────────────────────────────────────────────
  {
    id: 'usuario',
    name: 'Usuario',
    domain: 'sistema',
    attributes: ['id', 'nome', 'email', 'perfil_id', 'ativo', 'ultimo_acesso'],
    states: ['Ativo', 'Inativo', 'Bloqueado'],
  },
  {
    id: 'perfil_acesso',
    name: 'Perfil Acesso',
    domain: 'sistema',
    attributes: ['id', 'nome', 'descricao', 'permissoes'],
    states: [],
  },
  {
    id: 'configuracao_sistema',
    name: 'Configuracao Sistema',
    domain: 'sistema',
    attributes: ['id', 'chave', 'valor', 'descricao', 'tipo', 'editavel'],
    states: [],
  },
  {
    id: 'balanca',
    name: 'Balanca',
    domain: 'sistema',
    attributes: ['id', 'nome', 'ip', 'porta', 'modelo', 'status', 'ultima_calibracao'],
    states: ['Online', 'Offline', 'Manutencao'],
  },
  {
    id: 'evento_dominio',
    name: 'Evento Dominio',
    domain: 'sistema',
    attributes: ['id', 'tipo_evento', 'entidade', 'entidade_id', 'payload', 'data_hora', 'usuario_id'],
    states: [],
  },
  {
    id: 'log_auditoria',
    name: 'Log Auditoria',
    domain: 'sistema',
    attributes: ['id', 'acao', 'entidade', 'entidade_id', 'dados_antes', 'dados_depois', 'usuario_id', 'ip', 'data_hora'],
    states: [],
  },
];

export const erRelationships = [
  // ── Comercial ──────────────────────────────────────────────────────
  { source: 'compra_programada', target: 'item_compra', cardinality: '1:N', label: 'contem' },
  { source: 'compra_programada', target: 'fornecedor', cardinality: 'N:1', label: 'pertence a' },
  { source: 'compra_programada', target: 'disponibilidade_virtual', cardinality: '1:N', label: 'gera' },
  { source: 'item_compra', target: 'produto', cardinality: 'N:1', label: 'referencia' },
  { source: 'pedido_venda', target: 'item_pedido', cardinality: '1:N', label: 'contem' },
  { source: 'pedido_venda', target: 'cliente', cardinality: 'N:1', label: 'pertence a' },
  { source: 'pedido_venda', target: 'rota_entrega', cardinality: 'N:1', label: 'usa rota' },
  { source: 'item_pedido', target: 'produto', cardinality: 'N:1', label: 'referencia' },
  { source: 'item_pedido', target: 'disponibilidade_virtual', cardinality: 'N:1', label: 'consome saldo' },
  { source: 'disponibilidade_virtual', target: 'produto', cardinality: 'N:1', label: 'referencia' },

  // ── Recebimento ────────────────────────────────────────────────────
  { source: 'recebimento', target: 'compra_programada', cardinality: 'N:1', label: 'vinculado a' },
  { source: 'recebimento', target: 'fornecedor', cardinality: 'N:1', label: 'de fornecedor' },
  { source: 'recebimento', target: 'item_recebimento', cardinality: '1:N', label: 'contem' },
  { source: 'item_recebimento', target: 'produto', cardinality: 'N:1', label: 'referencia' },
  { source: 'item_recebimento', target: 'item_compra', cardinality: 'N:1', label: 'confere contra' },
  { source: 'divergencia', target: 'recebimento', cardinality: 'N:1', label: 'originada em' },
  { source: 'divergencia', target: 'usuario', cardinality: 'N:1', label: 'responsavel' },

  // ── Estoque & Pecas ───────────────────────────────────────────────
  { source: 'peca', target: 'produto', cardinality: 'N:1', label: 'eh do tipo' },
  { source: 'peca', target: 'recebimento', cardinality: 'N:1', label: 'originada em' },
  { source: 'peca', target: 'etiqueta', cardinality: '1:1', label: 'identificada por' },
  { source: 'peca', target: 'item_pedido', cardinality: 'N:1', label: 'associada a' },
  { source: 'movimentacao_peca', target: 'peca', cardinality: 'N:1', label: 'movimenta' },
  { source: 'movimentacao_peca', target: 'usuario', cardinality: 'N:1', label: 'realizada por' },
  { source: 'pesagem', target: 'peca', cardinality: 'N:1', label: 'pesa' },
  { source: 'pesagem', target: 'balanca', cardinality: 'N:1', label: 'usa balanca' },
  { source: 'pesagem', target: 'usuario', cardinality: 'N:1', label: 'operador' },
  { source: 'produto', target: 'categoria_produto', cardinality: 'N:1', label: 'classificado em' },

  // ── Producao & Corte ──────────────────────────────────────────────
  { source: 'ordem_corte', target: 'peca', cardinality: 'N:1', label: 'transforma' },
  { source: 'ordem_corte', target: 'ficha_tecnica', cardinality: 'N:1', label: 'segue' },
  { source: 'ordem_corte', target: 'usuario', cardinality: 'N:1', label: 'executada por' },
  { source: 'ordem_corte', target: 'item_corte', cardinality: '1:N', label: 'gera' },
  { source: 'item_corte', target: 'produto', cardinality: 'N:1', label: 'produto destino' },
  { source: 'item_corte', target: 'peca', cardinality: '1:1', label: 'gera peca' },
  { source: 'ficha_tecnica', target: 'produto', cardinality: 'N:1', label: 'para produto' },
  { source: 'etiqueta', target: 'peca', cardinality: '1:1', label: 'identifica' },

  // ── Expedicao ─────────────────────────────────────────────────────
  { source: 'caminhao_expedicao', target: 'rota_entrega', cardinality: 'N:1', label: 'segue rota' },
  { source: 'caminhao_expedicao', target: 'item_expedicao', cardinality: '1:N', label: 'carrega' },
  { source: 'item_expedicao', target: 'peca', cardinality: 'N:1', label: 'contem peca' },
  { source: 'item_expedicao', target: 'pedido_venda', cardinality: 'N:1', label: 'para pedido' },

  // ── Fiscal & NF ───────────────────────────────────────────────────
  { source: 'nota_fiscal', target: 'pedido_venda', cardinality: 'N:1', label: 'fatura' },
  { source: 'nota_fiscal', target: 'cliente', cardinality: 'N:1', label: 'destinada a' },
  { source: 'nota_fiscal', target: 'item_nf', cardinality: '1:N', label: 'contem' },
  { source: 'item_nf', target: 'produto', cardinality: 'N:1', label: 'referencia' },
  { source: 'seguro_carga', target: 'caminhao_expedicao', cardinality: 'N:1', label: 'cobre' },

  // ── Sistema & Config ──────────────────────────────────────────────
  { source: 'usuario', target: 'perfil_acesso', cardinality: 'N:1', label: 'possui perfil' },
  { source: 'evento_dominio', target: 'usuario', cardinality: 'N:1', label: 'disparado por' },
  { source: 'log_auditoria', target: 'usuario', cardinality: 'N:1', label: 'registrado por' },
];
