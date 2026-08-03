// Tipos compartilhados do domínio de faturamento (F6a — Faturamento + NFS-e; Onda 10).

export type StatusFaturamento = 'em_consolidacao' | 'pronto_para_emitir' | 'parcialmente_emitido' | 'concluido';
export type StatusNfse = 'pendente' | 'emitida' | 'erro_emissao' | 'cancelada' | 'erro_cancelamento';

export interface AmbienteFiscal {
  homologacao: boolean;
}

export interface Paginado<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

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

// ── D10.8 — listagem de notas ────────────────────────────────────────────────

/** Linha de `GET /faturamento/notas` — nota + denormalizações do join (cliente/caminhão). */
export interface NotaFiscalListagem extends NotaFiscal {
  clienteNome: string;
  /** D10.4 — trava visual de cancelamento (caminhão já liberado/expedido). */
  caminhaoLiberado: boolean;
}

export interface PecaRastreio {
  etiqueta: string | null;
  produtoNome: string;
  peso: string | number | null;
}

export interface RastreabilidadeNota {
  nota: NotaFiscal;
  pedido: { id: string; clienteNome: string } | null;
  pecas: PecaRastreio[];
  pesoTotalKg: string;
}

// ── D10.5 — seguros de carga (F6b) ───────────────────────────────────────────

export type StatusSeguro = 'pendente' | 'enviado' | 'confirmado';

export interface AnexoSeguro {
  nome: string;
  descricao?: string;
  registradoEm: string;
  registradoPor: string;
}

export interface SeguroCarga {
  id: string;
  caminhaoId: string;
  valorCarga: string | null;
  status: StatusSeguro;
  responsavelId: string | null;
  enviadoEm: string | null;
  confirmadoEm: string | null;
  observacao: string | null;
  anexosJson: AnexoSeguro[];
  createdAt: string;
}

export interface SeguroCargaComCaminhao extends SeguroCarga {
  caminhao: { id: string; placa: string; motorista: string; statusCaminhao: string };
}

// ── D10.6 — checklist de liberação ───────────────────────────────────────────

export interface RequisitoChecklist {
  chave: 'cargaConferida' | 'notasAutorizadas' | 'seguroConfirmado' | 'caminhaoMotorista';
  rotulo: string;
  ok: boolean;
  detalhe: string;
}

export interface ChecklistLiberacao {
  requisitos: RequisitoChecklist[];
  liberavel: boolean;
}
