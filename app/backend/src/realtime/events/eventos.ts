// Catálogo de eventos de domínio de tempo real (F3).
// Emitidos SEMPRE após o COMMIT da transação (ver ADR-004 / doc 014).

export const EVENTOS = {
  COMPRA_CONFIRMADA: 'compra_programada_confirmada',
  DISPONIBILIDADE_GERADA: 'disponibilidade_virtual_gerada',
  RESERVA_ATUALIZADA: 'reserva_disponibilidade_atualizada',
  PEDIDO_SEM_COBERTURA: 'pedido_sem_cobertura',
  // ── F4a — Recebimento + Divergências ──────────────────────────────────────
  RECEBIMENTO_INICIADO: 'recebimento_iniciado',
  RECEBIMENTO_REGISTRADO: 'recebimento_registrado',
  DIVERGENCIA_RECEBIMENTO_ABERTA: 'divergencia_recebimento_aberta',
  DIVERGENCIA_RECEBIMENTO_ATUALIZADA: 'divergencia_recebimento_atualizada',
  OCORRENCIA_FORNECEDOR_ABERTA: 'ocorrencia_fornecedor_aberta',
  OCORRENCIA_FORNECEDOR_ATUALIZADA: 'ocorrencia_fornecedor_atualizada',
  PEDIDO_EM_RISCO: 'pedido_em_risco',
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
