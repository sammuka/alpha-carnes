// Tipos do domínio gestão (dashboard operacional — Onda 5).

import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileText,
  Receipt,
  Scale,
  Scissors,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import type { KpiTone } from '@/components/ui/kpi-strip';

type KpiCardVariant = 'primary' | 'violet' | 'success' | 'warning' | 'muted';

export interface PedidoEmAndamento {
  pedidoId: string;
  clienteNome: string;
  produtoResumo: string;
  pesoTotalKg: string | null;
  status: string;
  dataOperacao: string;
}

export interface AtividadeRecente {
  id: string;
  usuarioNome: string;
  descricao: string;
  createdAt: string;
}

export interface KpiDashboard {
  chave: string;
  valor: string;
  detalhe: string;
}

export interface AlertaOperacional {
  chave: 'overbooking_aberto' | 'divergencia_recebimento' | 'tz_aguardando_desossa' | 'seguro_pendente';
  titulo: string;
  descricao: string;
  severidade: 'critico' | 'atencao' | 'informativo';
  ocorridoEm: string;
}

export interface DashboardOperacao {
  operacao: { id: string; data: string; rotulo: string; status: string; extraordinaria: boolean };
  kpis: KpiDashboard[];
  pedidosEmAndamento: PedidoEmAndamento[];
  alertas: AlertaOperacional[];
  atividadesRecentes: AtividadeRecente[];
}

export const ROTULOS_KPI: Record<string, string> = {
  compras_programadas: 'Compras programadas',
  disponibilidade_total: 'Disponibilidade física + virtual',
  reservas_em_elaboracao: 'Reservas em elaboração',
  pedidos_finalizados: 'Pedidos finalizados',
  overbookings_abertos: 'Overbookings abertos',
  recebimentos_aguardados: 'Recebimentos aguardados',
  divergencias_abertas: 'Divergências abertas',
  pecas_em_desossa: 'Peças em desossa',
  relatorios_sif_pendentes: 'Relatórios SIF pendentes',
  faturamentos_pendentes: 'Faturamentos pendentes',
};

export const MAPA_KPI_UI: Record<
  string,
  { Icon: LucideIcon; variant: KpiCardVariant; destacado?: boolean; tone: KpiTone }
> = {
  compras_programadas: { Icon: ShoppingCart, variant: 'primary', tone: 'default' },
  disponibilidade_total: { Icon: Scale, variant: 'primary', tone: 'default' },
  reservas_em_elaboracao: { Icon: ClipboardList, variant: 'violet', tone: 'default' },
  pedidos_finalizados: { Icon: CheckCircle2, variant: 'success', tone: 'ok' },
  overbookings_abertos: { Icon: AlertTriangle, variant: 'warning', destacado: true, tone: 'alert' },
  recebimentos_aguardados: { Icon: Truck, variant: 'primary', tone: 'default' },
  divergencias_abertas: { Icon: AlertTriangle, variant: 'warning', tone: 'alert' },
  pecas_em_desossa: { Icon: Scissors, variant: 'violet', tone: 'default' },
  relatorios_sif_pendentes: { Icon: FileText, variant: 'warning', tone: 'alert' },
  faturamentos_pendentes: { Icon: Receipt, variant: 'muted', tone: 'danger' },
};

export const ORDEM_KPIS = [
  'compras_programadas',
  'disponibilidade_total',
  'reservas_em_elaboracao',
  'pedidos_finalizados',
  'overbookings_abertos',
  'recebimentos_aguardados',
  'divergencias_abertas',
  'pecas_em_desossa',
  'relatorios_sif_pendentes',
  'faturamentos_pendentes',
] as const;

export function variantAlerta(severidade: AlertaOperacional['severidade']): 'divergencia' | 'pendente' | 'pesado' {
  if (severidade === 'critico') return 'divergencia';
  if (severidade === 'atencao') return 'pendente';
  return 'pesado';
}
