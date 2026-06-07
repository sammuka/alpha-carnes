// Catálogo de eventos de domínio de tempo real (F3).
// Emitidos SEMPRE após o COMMIT da transação (ver ADR-004 / doc 014).

export const EVENTOS = {
  COMPRA_CONFIRMADA: 'compra_programada_confirmada',
  DISPONIBILIDADE_GERADA: 'disponibilidade_virtual_gerada',
  RESERVA_ATUALIZADA: 'reserva_disponibilidade_atualizada',
  PEDIDO_SEM_COBERTURA: 'pedido_sem_cobertura',
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
