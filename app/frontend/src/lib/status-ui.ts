import type { StatusPillVariant } from '@/components/ui/status-pill';

/** Mapeia status de recebimento para StatusPill. */
export function statusRecebimentoVariant(status: string): StatusPillVariant {
  switch (status) {
    case 'em_conferencia':
      return 'recebido';
    case 'finalizado':
      return 'expedido';
    case 'cancelado':
      return 'bloqueado';
    default:
      return 'pendente';
  }
}

/** Mapeia status de peça para StatusPill. */
export function statusPecaVariant(status: string): StatusPillVariant {
  switch (status) {
    case 'pesada':
      return 'pendente';
    case 'associada':
      return 'expedido';
    case 'em_sobra':
      return 'recebido';
    case 'para_corte':
      return 'pesado';
    case 'divergente':
      return 'divergencia';
    case 'em_analise':
      return 'divergencia';
    case 'em_transformacao':
    case 'transformada':
      return 'pesado';
    default:
      return 'pendente';
  }
}

/** Mapeia status de caminhão para StatusPill. */
export function statusCaminhaoVariant(status: string): StatusPillVariant {
  switch (status) {
    case 'aberto':
    case 'em_conferencia':
      return 'recebido';
    case 'fechado':
      return 'pesado';
    case 'liberado_faturamento':
    case 'faturado':
      return 'expedido';
    case 'liberado':
      return 'expedido';
    default:
      return 'pendente';
  }
}

/** Mapeia status de pedido para StatusPill. */
export function statusPedidoVariant(status: string): StatusPillVariant {
  switch (status) {
    case 'reservado':
      return 'recebido';
    case 'parcialmente_reservado':
      return 'divergencia';
    case 'cancelado':
      return 'bloqueado';
    default:
      return 'pendente';
  }
}

/** Mapeia status NFS-e para StatusPill. */
export function statusNfseVariant(status: string): StatusPillVariant {
  switch (status) {
    case 'emitida':
      return 'expedido';
    case 'pendente':
      return 'pendente';
    case 'erro_emissao':
    case 'erro_cancelamento':
      return 'divergencia';
    case 'cancelada':
      return 'bloqueado';
    default:
      return 'pendente';
  }
}

/** Mapeia status de apuração de item de recebimento. */
export function statusApuracaoVariant(status: string): StatusPillVariant {
  switch (status) {
    case 'conferido':
      return 'expedido';
    case 'divergente':
      return 'divergencia';
    case 'em_conferencia':
      return 'recebido';
    case 'entrada_direta':
      return 'pesado';
    default:
      return 'pendente';
  }
}

/** Rótulo legível para destino de peça. */
export function rotuloDestinoPeca(statusPeca: string): string {
  switch (statusPeca) {
    case 'associada':
      return 'Pedido';
    case 'em_sobra':
      return 'Estoque';
    case 'para_corte':
      return 'Desossa';
    case 'pesada':
      return 'Aguardando destino';
    case 'em_analise':
      return 'Análise';
    case 'divergente':
      return 'Divergência';
    default:
      return statusPeca.replace(/_/g, ' ');
  }
}
