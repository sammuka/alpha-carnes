import type { Paginado, PendenciaOverbooking, StatusPendenciaOverbooking } from '@/lib/comercial';
import { mensagemDeErro } from '@/lib/error-message';

export type Pendencia = PendenciaOverbooking;

export interface CoberturaPendencia {
  pendenciaId: string;
  produtoId: string;
  quantidadeDeficit: string;
  comprasComplementares: Array<{
    compraProgramadaId: string;
    operacaoId: string;
    dataOperacao: string;
    status: string;
    quantidadeProjetada: string;
  }>;
  redistribuicoes: Array<{
    pedidoVendaId: string;
    pedidoVendaItemId: string;
    clienteNome: string;
    quantidadeReservada: string;
    reservaId: string;
    disponibilidadeVirtualId: string;
  }>;
  proximaOperacao: { id: string; data: string; rotulo: string } | null;
}

export interface HistoricoPendencia {
  id: string;
  acao: string;
  autorNome: string | null;
  detalheJson: unknown;
  criadoEm: string;
}

export const ROTULO_STATUS_PENDENCIA: Record<StatusPendenciaOverbooking, string> = {
  aberta: 'Aberto',
  em_analise: 'Em análise',
  compra_complementar_programada: 'Compra complementar programada',
  redistribuicao_decidida: 'Redistribuição decidida',
  novo_pedido_criado: 'Novo pedido criado',
  resolvida: 'Resolvido',
  cancelada: 'Cancelado',
};

export async function listarPendencias(params: {
  operacaoId: string;
  status?: StatusPendenciaOverbooking;
  busca?: string;
}): Promise<Paginado<Pendencia>> {
  const qs = new URLSearchParams({ operacaoId: params.operacaoId, limite: '100' });
  if (params.status) qs.set('status', params.status);
  const res = await fetch(`/api/comercial/overbooking?${qs}`);
  if (!res.ok) throw new Error(await mensagemDeErro(res));
  return res.json() as Promise<Paginado<Pendencia>>;
}

export async function buscarCobertura(id: string): Promise<CoberturaPendencia> {
  const res = await fetch(`/api/comercial/overbooking/${id}/cobertura`);
  if (!res.ok) throw new Error(await mensagemDeErro(res));
  return res.json() as Promise<CoberturaPendencia>;
}

export async function buscarHistorico(id: string): Promise<HistoricoPendencia[]> {
  const res = await fetch(`/api/comercial/overbooking/${id}/historico`);
  if (!res.ok) throw new Error(await mensagemDeErro(res));
  return res.json() as Promise<HistoricoPendencia[]>;
}
