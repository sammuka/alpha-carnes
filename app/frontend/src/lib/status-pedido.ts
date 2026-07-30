// Rótulos de status do pedido de venda (D11) — derivação centralizada para toda a Onda 4.

export const ROTULOS_STATUS_PEDIDO = {
  rascunho: 'Rascunho',
  rascunho_com_reserva: 'Rascunho com reserva ativa',
  em_elaboracao_reserva_ativa: 'Em elaboração com reserva ativa',
  aguardando_confirmacao_overbooking: 'Aguardando confirmação de overbooking',
  finalizado: 'Finalizado',
  parcialmente_atendido: 'Parcialmente atendido',
  atendido: 'Atendido',
  faturado: 'Faturado',
  cancelado: 'Cancelado',
} as const;

export function rotuloStatusPedido(status: string, temReservaAtiva: boolean): string {
  if (status === 'rascunho' && temReservaAtiva) {
    return ROTULOS_STATUS_PEDIDO.rascunho_com_reserva;
  }
  return ROTULOS_STATUS_PEDIDO[status as keyof typeof ROTULOS_STATUS_PEDIDO] ?? status;
}
