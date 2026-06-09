// Tipos compartilhados do domínio de faturamento (F6a — Faturamento + NFS-e).

export type StatusFaturamento = 'em_consolidacao' | 'pronto_para_emitir' | 'parcialmente_emitido' | 'concluido';
export type StatusNfse = 'pendente' | 'emitida' | 'erro_emissao' | 'cancelada' | 'erro_cancelamento';

export interface Bloqueio {
  codigo: string;
  causa: string;
  impacto: string;
  acao: string;
}

export interface PedidoConsolidado {
  pedidoVendaId: string;
  clienteId: string;
  clienteRazaoSocial: string;
  clienteDocumentoFiscal: string;
  clienteDadosFiscaisJson: Record<string, unknown>;
  itensCount: number;
  pesoTotalKg: number;
}

export interface NotaFiscal {
  id: string;
  faturamentoId: string;
  caminhaoId: string;
  pedidoVendaId: string;
  clienteId: string;
  numeroNfse: string | null;
  codigoVerificacao: string | null;
  linkNfse: string | null;
  statusNfse: StatusNfse;
  valor: string;
  aliquota: string;
  tentativasEmissao: number;
  ultimoErroNfse: string | null;
  emitidaEm: string | null;
  canceladaEm: string | null;
  createdAt: string;
}

export interface Faturamento {
  id: string;
  caminhaoId: string;
  statusFaturamento: StatusFaturamento;
  dataOperacao: string;
  createdAt: string;
}

export interface ConsolidacaoResposta {
  faturamento: Faturamento;
  caminhao: { id: string; placa: string; motorista: string; statusCaminhao: string; dataOperacao: string };
  pedidos: PedidoConsolidado[];
  notasFiscais: NotaFiscal[];
  bloqueios: Bloqueio[];
  totalItens: number;
}
