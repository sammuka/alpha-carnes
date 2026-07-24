// Tipos compartilhados do domínio comercial (F3) no frontend.

export interface Paginado<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface DisponibilidadeDia {
  id: string;
  itemComercialId: string;
  dataOperacao: string;
  quantidadeTotalGerada: string;
  quantidadeReservada: string;
  quantidadeDisponivel: string;
  quantidadeRecebida: string;
  quantidadeComDivergencia: string;
  status: string;
}

export interface CompraProgramada {
  id: string;
  dataOperacao: string;
  fornecedorId: string;
  numeroInterno: string | null;
  referenciaExterna: string | null;
  previsaoEntrega: string | null;
  status: 'rascunho' | 'em_negociacao' | 'confirmada' | 'cancelada';
  observacoes: string | null;
  createdAt: string;
}

export interface CompraProgramadaItem {
  id: string;
  compraProgramadaId: string;
  itemCompraId: string;
  quantidadeComprada: string;
  observacoes: string | null;
}

export interface CompraProgramadaDetalhe extends CompraProgramada {
  itens: CompraProgramadaItem[];
}

export interface CriarCompraProgramadaDto {
  dataOperacao: string;
  fornecedorId: string;
  numeroInterno?: string;
  referenciaExterna?: string;
  previsaoEntrega?: string;
  observacoes?: string;
  itens: Array<{ itemCompraId: string; quantidadeComprada: number; observacoes?: string }>;
}

export interface PedidoVenda {
  id: string;
  compraProgramadaId: string;
  clienteId: string;
  dataOperacao: string;
  dataEntrega: string | null;
  rotaPrevista: string | null;
  prioridade: number | null;
  status: string;
  observacoesGerais: string | null;
  createdAt: string;
}

export interface PedidoVendaItem {
  id: string;
  pedidoVendaId: string;
  itemComercialId: string;
  quantidadePedida: string;
  quantidadeReservada: string;
  quantidadePendente: string;
  quantidadeAtendida: string;
  status: string;
  observacoes: string | null;
}

export interface PedidoVendaDetalhe extends PedidoVenda {
  cliente?: { id: string; razaoSocial: string; codigo: string };
  itens: Array<
    PedidoVendaItem & {
      itemComercial?: { id: string; codigo: string; nome: string };
    }
  >;
}

export interface CriarPedidoDto {
  compraProgramadaId: string;
  clienteId: string;
  dataOperacao: string;
  dataEntrega?: string;
  rotaPrevista?: string;
  prioridade?: number;
  observacoesGerais?: string;
  itens: Array<{ itemComercialId: string; quantidadePedida: number; observacoes?: string }>;
}

export interface ResultadoPedido {
  id: string;
  status: string;
}

// ── Overbooking (onda1 / AD-05) ─────────────────────────────────────────────

export interface OverbookingChallengeItem {
  itemComercialId: string;
  disponivelAntes: string;
  quantidadeSolicitada: string;
  overbookingGerado: string;
  mensagem: string;
}

export interface OverbookingChallenge {
  code: 'OVERBOOKING_CONFIRMACAO_NECESSARIA';
  message: string;
  itens: OverbookingChallengeItem[];
}

export type StatusPendenciaOverbooking =
  | 'aberta'
  | 'em_analise'
  | 'compra_complementar_programada'
  | 'redistribuicao_decidida'
  | 'novo_pedido_criado'
  | 'resolvida'
  | 'cancelada';

export interface PendenciaOverbooking {
  id: string;
  pedidoVendaId: string;
  pedidoVendaItemId: string;
  itemComercialId: string;
  clienteId: string;
  vendedorUsuarioId: string;
  operacaoId: string;
  quantidadeDeficit: string;
  status: StatusPendenciaOverbooking;
  decisaoJson: Record<string, unknown>;
  responsavelId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PendenciaOverbookingHistorico {
  id: string;
  pendenciaId: string;
  acao: string;
  autorId: string;
  detalheJson: Record<string, unknown>;
  criadoEm: string;
}

export interface PendenciaOverbookingDetalhe extends PendenciaOverbooking {
  historico: PendenciaOverbookingHistorico[];
}

export interface IncluirItemPedidoDto {
  itemComercialId: string;
  quantidade: number;
  observacoes?: string;
}

export type ConfirmarCriacaoOverbookingDto = CriarPedidoDto;
export type ConfirmarInclusaoOverbookingDto = IncluirItemPedidoDto;

export interface DecidirPendenciaOverbookingDto {
  caminho: 'compra_complementar' | 'redistribuicao' | 'novo_pedido';
  detalhe?: Record<string, unknown>;
}

export interface AlterarPendenciaOverbookingDto {
  status: StatusPendenciaOverbooking;
  detalhe?: Record<string, unknown>;
}
