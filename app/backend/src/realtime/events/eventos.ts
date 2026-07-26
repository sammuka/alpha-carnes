// Catálogo de eventos de domínio de tempo real (F3).
// Emitidos SEMPRE após o COMMIT da transação (ver ADR-004 / doc 014).

export const EVENTOS = {
  COMPRA_CONFIRMADA: 'compra_programada_confirmada',
  DISPONIBILIDADE_GERADA: 'disponibilidade_virtual_gerada',
  RESERVA_ATUALIZADA: 'reserva_disponibilidade_atualizada',
  PEDIDO_SEM_COBERTURA: 'pedido_sem_cobertura',
  // Onda 1 — Operação pivô / overbooking / fornecedor
  OPERACAO_CRIADA: 'operacao_criada',
  OVERBOOKING_CONFIRMADO: 'overbooking_confirmado',
  PENDENCIA_OVERBOOKING_ABERTA: 'pendencia_overbooking_aberta',
  PENDENCIA_OVERBOOKING_ATUALIZADA: 'pendencia_overbooking_atualizada',
  PENDENCIA_OVERBOOKING_RESOLVIDA: 'pendencia_overbooking_resolvida',
  PEDIDO_FINALIZADO: 'pedido_finalizado',
  PEDIDO_VENDA_ITEM_CRIADO: 'pedido_venda_item_criado',
  PEDIDO_FORNECEDOR_CRIADO: 'pedido_fornecedor_criado',
  NF_FORNECEDOR_REGISTRADA: 'nf_fornecedor_registrada',
  CONFERENCIA_TRIPLA_CONCLUIDA: 'conferencia_tripla_concluida',
  RECEBIMENTO_ESTADO_ALTERADO: 'recebimento_estado_alterado',
  // ── F4a — Recebimento + Divergências ──────────────────────────────────────
  RECEBIMENTO_INICIADO: 'recebimento_iniciado',
  RECEBIMENTO_REGISTRADO: 'recebimento_registrado',
  DIVERGENCIA_RECEBIMENTO_ABERTA: 'divergencia_recebimento_aberta',
  DIVERGENCIA_RECEBIMENTO_ATUALIZADA: 'divergencia_recebimento_atualizada',
  OCORRENCIA_FORNECEDOR_ABERTA: 'ocorrencia_fornecedor_aberta',
  OCORRENCIA_FORNECEDOR_ATUALIZADA: 'ocorrencia_fornecedor_atualizada',
  PEDIDO_EM_RISCO: 'pedido_em_risco',
  // ── F4b — Pesagem + Associação + Etiquetagem ──────────────────────────────
  PECA_PESADA: 'peca_pesada',
  PECA_ASSOCIADA: 'peca_associada',
  PECA_REDIRECIONADA: 'peca_redirecionada',
  DISPOSITIVO_STATUS_ALTERADO: 'dispositivo_status_alterado',
  // ── F4c — Corte / Transformação ───────────────────────────────────────────
  CORTE_INICIADO: 'corte_iniciado',
  SUBITEM_GERADO: 'subitem_gerado',
  SUBITEM_PESADO: 'subitem_pesado',
  SUBITEM_ASSOCIADO: 'subitem_associado',
  CORTE_CONCLUIDO: 'corte_concluido',
  // ── F5 — Expedição ────────────────────────────────────────────────────────
  CARGA_ITEM_ADICIONADO: 'carga_item_adicionado',
  CARGA_ITEM_TRANSFERIDO: 'carga_item_transferido',
  CARGA_ITEM_REMOVIDO: 'carga_item_removido',
  CONFERENCIA_CONCLUIDA: 'conferencia_concluida',
  EXPEDICAO_FECHADA: 'expedicao_fechada',
  EXPEDICAO_REABERTA: 'expedicao_reaberta',
  EXPEDICAO_LIBERADA_FATURAMENTO: 'expedicao_liberada_faturamento',
  EXPEDICAO_LIBERADA_SAIDA: 'expedicao_liberada_saida',
  // ── F6a — Faturamento / NFS-e ─────────────────────────────────────────────
  NFSE_EMITIDA: 'nfse_emitida',
  NFSE_CANCELADA: 'nfse_cancelada',
  NFSE_ERRO_EMISSAO: 'nfse_erro_emissao',
  // ── Onda 4 — Comercial ────────────────────────────────────────────────────
  ADENDO_REGISTRADO: 'adendo_registrado',
  RESERVA_LIBERADA_ADMIN: 'reserva_liberada_admin',
  TABELA_PRECO_PUBLICADA: 'tabela_preco_publicada',
} as const;

export type NomeEvento = (typeof EVENTOS)[keyof typeof EVENTOS];

/** Rooms que recebem broadcast de um evento de uma data operacional. */
export function roomsDaData(dataOperacao: string): string[] {
  return ['dashboard', `operacao:${dataOperacao}`];
}

export interface CompraConfirmadaPayload {
  compraId: string;
  dataOperacao: string;
}

export interface DisponibilidadeGeradaPayload {
  compraId: string;
  dataOperacao: string;
  itens: Array<{
    disponibilidadeId: string;
    itemComercialId: string;
    quantidadeTotalGerada: string;
  }>;
}

export interface ReservaAtualizadaPayload {
  disponibilidadeId: string;
  itemComercialId: string;
  dataOperacao: string;
  quantidadeReservada: string;
  quantidadeDisponivel: string;
}

export interface PedidoSemCoberturaPayload {
  pedidoId: string;
  dataOperacao: string;
  itens: Array<{
    pedidoItemId: string;
    itemComercialId: string;
    quantidadePendente: string;
  }>;
}

// ── F4a ─────────────────────────────────────────────────────────────────────

export interface RecebimentoIniciadoPayload {
  recebimentoId: string;
  compraProgramadaId: string;
  dataOperacao: string;
}

export interface RecebimentoRegistradoPayload {
  recebimentoId: string;
  dataOperacao: string;
  /** 'item' = um item conferido; 'conclusao' = recebimento concluído. */
  etapa: 'item' | 'conclusao';
  itemComercialId?: string;
}

export interface DivergenciaRecebimentoPayload {
  divergenciaId: string;
  recebimentoId: string;
  dataOperacao: string;
  tipo: string;
  status: string;
}

export interface OcorrenciaFornecedorPayload {
  ocorrenciaId: string;
  fornecedorId: string;
  dataOperacao: string;
  status: string;
}

export interface PedidoEmRiscoPayload {
  dataOperacao: string;
  origem: 'recebimento' | 'conclusao';
  pedidos: Array<{
    pedidoId: string;
    itemComercialId: string;
    quantidadeReservada: string;
    quantidadeRecebida: string;
  }>;
}

// ── F4b ─────────────────────────────────────────────────────────────────────

export interface PecaPesadaPayload {
  pecaId: string;
  recebimentoId: string;
  dataOperacao: string;
  modoCaptura: 'automatico' | 'manual_assistido';
  pesoOriginal: string;
}

export interface PecaAssociadaPayload {
  pecaId: string;
  dataOperacao: string;
  pedidoVendaId: string;
  pedidoVendaItemId: string;
}

export interface PecaRedirecionadaPayload {
  pecaId: string;
  dataOperacao: string;
  pedidoOrigemId: string | null;
  pedidoDestinoId: string;
}

export interface DispositivoStatusPayload {
  dataOperacao: string;
  dispositivo: 'balanca' | 'leitor' | 'impressora';
  dispositivoId: string;
  status: 'disponivel' | 'instavel' | 'indisponivel';
  heartbeatEm: string;
}

// ── F4c ───────────────────────────────────────────────────────────────────────

export interface CorteIniciadoPayload {
  transformacaoId: string;
  pecaOrigemId: string;
  dataOperacao: string;
}

export interface SubitemGeradoPayload {
  transformacaoId: string;
  subitemId: string;
  dataOperacao: string;
}

export interface SubitemPesadoPayload {
  transformacaoId: string;
  subitemId: string;
  dataOperacao: string;
  modoCaptura: 'automatico' | 'manual_assistido';
  peso: string;
}

export interface SubitemAssociadoPayload {
  transformacaoId: string;
  subitemId: string;
  dataOperacao: string;
  pedidoVendaId: string | null;
  pedidoVendaItemId: string | null;
  statusSubitem: string;
}

export interface CorteConcluidoPayload {
  transformacaoId: string;
  pecaOrigemId: string;
  dataOperacao: string;
  pesoOriginal: string;
  pesoSubitensTotal: string;
  diferencaPeso: string;
}

// ── F5 — Expedição ────────────────────────────────────────────────────────

export interface CargaItemAdicionadoPayload {
  caminhaoId: string;
  cargaItemId: string;
  tipoOrigem: 'peca' | 'subitem';
  pecaId?: string;
  subitemId?: string;
  pedidoVendaId: string;
  dataOperacao: string;
}

export interface CargaItemTransferidoPayload {
  caminhaoId: string;
  cargaItemId: string;
  tipoOrigem: 'peca' | 'subitem';
  pedidoOrigemId: string;
  pedidoDestinoId: string;
  dataOperacao: string;
}

export interface CargaItemRemovidoPayload {
  caminhaoId: string;
  cargaItemId: string;
  tipoOrigem: 'peca' | 'subitem';
  dataOperacao: string;
}

export interface ConferenciaConcluidaPayload {
  caminhaoId: string;
  conferenciaId: string;
  dataOperacao: string;
}

export interface ExpedicaoFechadaPayload {
  caminhaoId: string;
  dataOperacao: string;
}

export interface ExpedicaoReabertaPayload {
  caminhaoId: string;
  operadorId: string;
  dataOperacao: string;
}

// ── F6a — Faturamento / NFS-e ─────────────────────────────────────────────

export interface NfseEmitidaPayload {
  caminhaoId: string;
  notaFiscalId: string;
  pedidoVendaId: string;
  numeroNfse: string | null | undefined;
  dataOperacao: string;
}

export interface NfseCanceladaPayload {
  caminhaoId: string;
  notaFiscalId: string;
  dataOperacao: string;
}

export interface NfseErroEmissaoPayload {
  caminhaoId: string;
  notaFiscalId: string;
  pedidoVendaId: string;
  ultimoErro: string;
  tentativas: number;
  dataOperacao: string;
}

/** Contratos tipados dos eventos Onda 1 (PayloadPorEvento). */
export interface PayloadPorEvento {
  operacao_criada: { operacaoId: string; data: string };
  overbooking_confirmado: {
    pedidoVendaId: string;
    itemId: string;
    quantidadeOverbooking: string;
  };
  pendencia_overbooking_aberta: {
    pendenciaId: string;
    pedidoVendaId: string;
  };
  pendencia_overbooking_atualizada: {
    pendenciaId: string;
    status: string;
  };
  pendencia_overbooking_resolvida: {
    pendenciaId: string;
    status: 'resolvida';
  };
  pedido_finalizado: { pedidoVendaId: string };
  pedido_venda_item_criado: { pedidoVendaId: string; itemId: string };
  pedido_fornecedor_criado: {
    pedidoFornecedorId: string;
    operacaoId: string;
  };
  nf_fornecedor_registrada: {
    nfId: string;
    pedidoFornecedorId: string;
    recebimentoId: string;
  };
  conferencia_tripla_concluida: {
    conclusaoId: string;
    recebimentoId: string;
    resultado: 'sem_divergencia' | 'com_divergencia';
  };
  recebimento_estado_alterado: {
    recebimentoId: string;
    statusAnterior: string;
    statusAtual: string;
  };
  // ── Onda 4 — Comercial ────────────────────────────────────────────────────
  adendo_registrado: {
    adendoId: string;
    pedidoVendaId: string;
    itemComercialId: string;
    quantidadeAdicionada: string;
    origemConsumo: 'fisico' | 'virtual' | 'overbooking';
  };
  reserva_liberada_admin: {
    pedidoVendaId: string;
    autorId: string;
    justificativa: string;
  };
  tabela_preco_publicada: { tabelaPrecoId: string; data: string; autorId: string };
}
