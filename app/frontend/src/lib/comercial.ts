// Tipos compartilhados do domínio comercial (F3) no frontend.

export interface Paginado<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface DisponibilidadeCompra {
  modo: 'compra';
  id: string;
  operacaoId: string;
  compraProgramadaId: string;
  itemComercialId: string;
  quantidadeTotalGerada: string;
  quantidadeReservada: string;
  quantidadeDisponivel: string;
  quantidadeRecebida: string;
  quantidadeComDivergencia: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DisponibilidadeAgregado {
  modo: 'agregado';
  operacaoId: string;
  itemComercialId: string;
  quantidadeTotalGerada: string;
  quantidadeReservada: string;
  quantidadeDisponivel: string;
  quantidadeRecebida: string;
  quantidadeComDivergencia: string;
  status: string;
}

export type DisponibilidadeDia = DisponibilidadeCompra | DisponibilidadeAgregado;

export interface ComposicaoLotePedido {
  compraProgramadaId: string;
  numeroSequencial: number;
  recebimentoId: string;
  quantidadeUnidades: number;
  pesoTotal: string;
}

export interface CompraProgramada {
  id: string;
  operacaoId: string;
  dataOperacao: string;
  fornecedorId: string;
  numeroSequencial: number;
  fornecedorNomeFantasia: string | null;
  fornecedorRazaoSocial: string | null;
  totalItens: number;
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

export interface ConfirmacaoCompraProgramada {
  compra: CompraProgramadaDetalhe;
  jaConfirmada: boolean;
}

export interface ItemImpacto {
  itemComercialId: string;
  codigo: string;
  descricao: string;
  quantidadeGeradaAtual: string;
  quantidadeGeradaProjetada: string;
  delta: string;
  quantidadeReservada: string;
  saldoAtual: string;
  saldoProjetado: string;
  deficitProjetado: string;
}

export interface ImpactoCompra {
  compraId: string;
  operacaoId: string;
  status: string;
  itens: ItemImpacto[];
  deficitTotal: string;
  exigeConfirmacao: boolean;
  resumo: string;
}

export interface HistoricoCompraItem {
  id: string;
  dataHora: string;
  usuarioNome: string | null;
  tabela: string;
  operacao: string;
  dadosAnteriores: unknown;
  dadosNovos: unknown;
}

export interface RespostaEdicaoItem {
  item: CompraProgramadaItem;
  impacto: ImpactoCompra;
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
  compraProgramadaId: string | null;
  clienteId: string;
  operacaoId?: string;
  dataOperacao?: string;
  dataEntrega: string | null;
  rotaPrevista: string | null;
  prioridade: number | null;
  status: string;
  observacoesGerais: string | null;
  createdAt: string;
  representanteId?: string | null;
  representanteNome?: string | null;
  rotaNome?: string | null;
}

export interface PedidoVendaItem {
  id: string;
  pedidoVendaId: string;
  itemComercialId: string;
  quantidadePedida: string;
  quantidadeReservada: string;
  quantidadePendente: string;
  quantidadeAtendida: string;
  quantidadeOverbooking?: string;
  status: string;
  observacoes: string | null;
}

export interface PedidoVendaDetalhe extends PedidoVenda {
  cliente?: {
    id: string;
    razaoSocial: string;
    nomeFantasia?: string | null;
    codigo: string;
  };
  heranca?: {
    representanteId: string | null;
    representanteNome: string | null;
    rotaId: string | null;
    rotaNome: string | null;
  } | null;
  itens: Array<
    PedidoVendaItem & {
      itemComercial?: { id: string; codigo: string; nome?: string; descricao?: string };
      reservas?: Array<{
        id: string;
        status: string;
        origem?: 'fisico' | 'virtual' | 'overbooking';
        tipoConsumo?: 'fisico' | 'virtual' | 'overbooking';
        disponibilidade?: { status?: string };
      }>;
    }
  >;
}

export interface CriarPedidoDto {
  compraProgramadaId?: string | null;
  operacaoId?: string;
  clienteId: string;
  dataOperacao?: string;
  dataEntrega?: string;
  rotaPrevista?: string;
  prioridade?: number;
  observacoesGerais?: string;
  salvarComoRascunho?: boolean;
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

export interface ReduzirItemPedidoBody {
  novaQuantidade: number;
  motivo: string;
}

export interface RemoverItemPedidoBody {
  motivo: string;
}

export interface AdendoPedido {
  id: string;
  pedidoVendaId: string;
  pedidoVendaItemId: string;
  itemComercialId?: string;
  operacaoId?: string;
  quantidadeAnterior: string;
  quantidadeAdicionada: string;
  quantidadeResultante?: string;
  quantidadeNova?: string;
  origemConsumo: 'fisico' | 'virtual' | 'overbooking';
  motivo: string;
  autorId?: string;
  usuarioId?: string;
  criadoEm: string;
}

export interface PedidoAbertoExistente {
  code: 'PEDIDO_ABERTO_EXISTENTE';
  message: string;
  pedidoId: string;
  status: string;
  itemComercialId: string;
  quantidadeAtual: string;
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
