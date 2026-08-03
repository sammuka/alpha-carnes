import type { StatusPillVariant } from '@/components/ui/status-pill';
import type { StatusCaminhao } from '@/lib/operacao';

// D9.1 — Mapa de status caminhão → rótulos do protótipo (fonte única no frontend).
export const ROTULO_STATUS_CARGA: Record<StatusCaminhao, string> = {
  planejado: 'Montando',
  aguardando_carga: 'Montando',
  em_carga: 'Montando',
  em_conferencia: 'Em Conferência',
  fechado: 'Conferida',
  liberado_faturamento: 'Enviada para Faturamento',
  faturado: 'Faturada',
  liberado_saida: 'Liberada para Saída',
  expedido: 'Expedida',
};

/** Variante do StatusPill para o status de caminhão/carga (D9.1). */
export function variantStatusCarga(status: StatusCaminhao): StatusPillVariant {
  switch (status) {
    case 'planejado':
    case 'aguardando_carga':
    case 'em_carga':
      return 'pendente';
    case 'em_conferencia':
      return 'recebido';
    case 'fechado':
      return 'pesado';
    case 'liberado_faturamento':
      return 'expedido';
    case 'faturado':
    case 'liberado_saida':
    case 'expedido':
      return 'expedido';
    default:
      return 'pendente';
  }
}

// Emenda 1 — Mapeamento de prioridade fixado (D9.7).
export type RotuloPrioridade = 'ALTA' | 'MÉDIA' | 'BAIXA';

/** `prioridade >= 3` → ALTA; `=== 2` → MÉDIA; `<= 1` → BAIXA; null/undefined → sem badge. */
export function rotuloPrioridade(prioridade: number | null | undefined): RotuloPrioridade | null {
  if (prioridade === null || prioridade === undefined) return null;
  if (prioridade >= 3) return 'ALTA';
  if (prioridade === 2) return 'MÉDIA';
  return 'BAIXA';
}

// ── D9.5 — Enviar para Faturamento ────────────────────────────────────────────

export interface CargaEnvioPeca {
  etiqueta: string | null;
  produtoNome: string;
  peso: string;
}

export interface CargaEnvioPedido {
  pedidoVendaId: string;
  clienteNome: string | null;
  pecas: CargaEnvioPeca[];
}

export interface CargaEnvio {
  id: string;
  placa: string;
  motorista: string;
  rota: string | null;
  statusCaminhao: StatusCaminhao;
  pedidos: CargaEnvioPedido[];
  totalClientes: number;
  totalPecas: number;
  pesoTotal: string;
  envio: { dataHora: string; responsavelNome: string | null } | null;
}
