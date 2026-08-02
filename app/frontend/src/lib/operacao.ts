// Tipos compartilhados do domínio operacional (F4a — Recebimento + Divergências).

export const STATUS_RECEBIMENTO = [
  'pesagem_em_andamento',
  'aguardando_conclusao_pesagem',
  'aguardando_conferencia_final',
  'conferido_sem_divergencia',
  'conferido_com_divergencia',
  'ocorrencia_administrativa_aberta',
  'tratativa_administrativa_concluida',
  'cancelado',
] as const;

export type StatusRecebimento = (typeof STATUS_RECEBIMENTO)[number];

export const STATUS_APURACAO_ITEM = [
  'aguardando',
  'em_conferencia',
  'conferido',
  'divergente',
  'entrada_direta',
] as const;

export type StatusApuracaoItem = (typeof STATUS_APURACAO_ITEM)[number];

export interface PaginadoRecebimento {
  data: RecebimentoResumoEnriquecido[];
  page: number;
  pageSize: number;
  total: number;
}

export const TIPOS_DIVERGENCIA = [
  'quantidade_menor',
  'quantidade_maior',
  'item_divergente',
  'qualidade_divergente',
  'peso_incompativel',
  'item_ausente',
  'item_excedente',
  'inconsistencia_nf_fisico',
] as const;

export type TipoDivergencia = (typeof TIPOS_DIVERGENCIA)[number];

export interface RecebimentoItem {
  id: string;
  itemComercialId: string;
  origemDescricao: string | null;
  quantidadeEsperada: string;
  quantidadeRecebida: string;
  quantidadeApurada?: string;
  unidadeEsperada: string | null;
  requerBalanca: boolean;
  pesoTotalApurado: string | null;
  pesoApurado?: string | null;
  statusApuracao: StatusApuracaoItem;
  observacoes: string | null;
  itemComercial?: { id: string; codigo: string; descricao: string };
}

export interface DivergenciaRecebimento {
  id: string;
  recebimentoItemId: string;
  tipo: TipoDivergencia;
  descricao: string;
  acaoImediata: string;
  status: 'aberta' | 'em_analise' | 'aguardando_fornecedor' | 'resolvida';
}

export interface RecebimentoDetalhe {
  id: string;
  codigoLote: string;
  /** Pode vir no topo ou aninhado em pedidoFornecedor (API Onda 6). */
  compraProgramadaId?: string;
  pedidoFornecedorId: string;
  fornecedorId: string;
  dataOperacao?: string;
  status: StatusRecebimento;
  tipoCarga: string | null;
  progressoBalanca: number;
  nfeNumero: string | null;
  nfeSerie: string | null;
  nfeChave: string | null;
  nfeDataEmissao: string | null;
  romaneio: string | null;
  nfePesoBruto: string | null;
  nfePesoLiquido: string | null;
  nfeVolumes: number | null;
  notaFiscalFornecedor: string | null;
  placaVeiculo: string | null;
  motorista: string | null;
  doca: string | null;
  dataHoraChegada: string | null;
  observacoes: string | null;
  fornecedor?: { id: string; razaoSocial: string };
  compra?: { id: string; numeroInterno: string | null };
  pedidoFornecedor?: { id: string; compraProgramadaId?: string; numero?: string | null };
  operacao?: { id: string; data?: string };
  itens: RecebimentoItem[];
  divergencias: DivergenciaRecebimento[];
}

export interface RecebimentoResumoEnriquecido {
  id: string;
  codigoLote: string;
  compraProgramadaId: string;
  numeroInternoCompra: string | null;
  fornecedorId: string;
  fornecedorNome: string;
  dataOperacao: string;
  status: StatusRecebimento;
  nfeNumero: string | null;
  romaneio: string | null;
  tipoCarga: string | null;
  progressoBalanca: number;
}

export interface RecebimentoResumo {
  id: string;
  compraProgramadaId: string;
  dataOperacao: string;
  status: string;
  codigoLote?: string;
  progressoBalanca?: number;
}

export interface PrevisaoItemOperacional {
  itemComercialId: string;
  produtoCodigo: string;
  produtoDescricao: string;
  quantidadePrevista: string;
  pesoPrevisto: string | null;
  unidade: string;
  passaBalanca: boolean;
  origemDescricao: string;
}

export interface PrevisaoRecebimento {
  pedidoFornecedorId: string;
  numeroPedidoFornecedor: string;
  statusPedidoFornecedor: 'enviado' | 'aguardando_recebimento';
  operacaoId: string;
  dataOperacao: string;
  compraProgramadaId: string;
  numeroInternoCompra: string | null;
  fornecedorId: string;
  fornecedorNome: string;
  tipoCarga: string | null;
  observacoesCompra: string | null;
  resumoCompra: string;
  itensOperacionais: PrevisaoItemOperacional[];
}

export interface IniciarRecebimentoPayload {
  pedidoFornecedorId: string;
  nfeNumero: string;
  nfeSerie?: string;
  nfeChave?: string;
  nfeDataEmissao?: string;
  romaneio?: string;
  nfePesoBruto?: number;
  nfePesoLiquido?: number;
  nfeVolumes?: number;
  observacoes?: string;
  placaVeiculo?: string;
  motorista?: string;
  doca?: string;
}

export interface IniciarRecebimentoResultado {
  recebimento: RecebimentoResumo;
  jaIniciado: false;
}

// ── F4b — Pesagem + Associação + Etiquetagem ──────────────────────────────────

export const MODOS_CAPTURA = ['automatico', 'manual_assistido'] as const;
export type ModoCaptura = (typeof MODOS_CAPTURA)[number];

export const MOTIVOS_CAPTURA_MANUAL = [
  'dispositivo_indisponivel',
  'leitura_instavel',
  'divergencia_balanca',
  'outro',
] as const;
export type MotivoCapturaManual = (typeof MOTIVOS_CAPTURA_MANUAL)[number];

export const DESTINOS_SEM_COBERTURA = ['sobra', 'analise', 'corte', 'divergencia'] as const;
export type DestinoSemCobertura = (typeof DESTINOS_SEM_COBERTURA)[number];

export type StatusDispositivo = 'disponivel' | 'instavel' | 'indisponivel';

export interface SaudeDispositivo {
  status: StatusDispositivo;
  dispositivoId: string;
  heartbeatEm: string;
}

export interface StatusDispositivos {
  balanca: SaudeDispositivo;
  leitor: SaudeDispositivo;
  impressora: SaudeDispositivo;
}

export type StatusPeca = 'pesada' | 'associada' | 'em_sobra' | 'em_analise' | 'para_corte' | 'divergente';

export interface Peca {
  id: string;
  recebimentoId: string;
  itemComercialBaseId: string;
  pesoOriginal: string;
  modoCapturaPeso: ModoCaptura;
  statusPeca: StatusPeca;
  etiquetaAtual: string | null;
  pedidoVendaId: string | null;
  pedidoVendaItemId: string | null;
  capturaMeta: Record<string, unknown>;
}

export interface SugestaoScored {
  pedidoVendaId: string;
  pedidoVendaItemId: string;
  itemComercialId: string;
  clienteId: string;
  saldoPendente: string;
  prioridade: number | null;
  rotaPrevista: string | null;
  score: number;
  justificativa: string;
  /** D6.5 — selo; não altera score. */
  prefCompativel?: boolean;
}

export interface ResultadoSugestao {
  pecaId: string;
  sugestao: SugestaoScored | null;
  compativeis: SugestaoScored[];
}

export interface AcaoLote {
  id: string;
  hora: string;
  produtoCodigo: string | null;
  produtoDescricao: string | null;
  peso: string | null;
  destino: string;
  clientePedido: string | null;
  etiqueta: string | null;
  operadorNome: string | null;
  statusPeca: string | null;
  acao: string;
}

export interface FaltaDesossa {
  produto: { id: string; codigo: string; nome: string };
  quantidadeFaltante: number;
  quantidadeEstoque: number;
  origem: string;
}

// ── F4c — Corte / Transformação ───────────────────────────────────────────────

export const TIPOS_TRANSFORMACAO = ['simples', 'subdivisao', 'reclassificacao', 'destinacao_mista'] as const;
export type TipoTransformacao = (typeof TIPOS_TRANSFORMACAO)[number];

export const MOTIVOS_TRANSFORMACAO = ['preferencia_cliente', 'necessidade_operacional', 'divergencia', 'decisao_humana'] as const;
export type MotivoTransformacao = (typeof MOTIVOS_TRANSFORMACAO)[number];

export type StatusTransformacao =
  | 'aberta'
  | 'em_execucao'
  | 'aguardando_pesagem'
  | 'aguardando_associacao'
  | 'aguardando_etiquetagem'
  | 'concluida'
  | 'cancelada';

export type StatusSubitem = 'gerado' | 'pesado' | 'associado' | 'em_sobra' | 'em_analise';

export interface Transformacao {
  id: string;
  pecaOrigemId: string;
  tipoTransformacao: TipoTransformacao;
  motivo: MotivoTransformacao;
  statusTransformacao: StatusTransformacao;
  pesoOriginal: string;
  pesoSubitensTotal: string | null;
  diferencaPeso: string | null;
  justificativaDiferenca: string | null;
}

export interface Subitem {
  id: string;
  transformacaoId: string;
  pecaOrigemId: string;
  itemComercialId: string;
  peso: string | null;
  quantidade: string;
  statusSubitem: StatusSubitem;
  etiquetaAtual: string | null;
  pedidoVendaId: string | null;
  pedidoVendaItemId: string | null;
}

export interface CorteDetalhe {
  transformacao: Transformacao;
  subitens: Subitem[];
}

// ── F5 — Expedição ────────────────────────────────────────────────────────

export type StatusCaminhao =
  | 'planejado' | 'aguardando_carga' | 'em_carga' | 'em_conferencia'
  | 'fechado' | 'liberado_faturamento' | 'faturado' | 'liberado_saida' | 'expedido';

export interface Caminhao {
  id: string;
  placa: string;
  motorista: string;
  rota: string | null;
  dataOperacao: string;
  frotaCaminhaoId: string | null;
  capacidadeKg: number | null;
  statusCaminhao: StatusCaminhao;
  horaAberturaCarga: string | null;
  horaFechamentoCarga: string | null;
  observacoes: string | null;
  createdAt: string;
}

export interface CaminhaoDetalhe {
  caminhao: Caminhao & { pesoCarregadoKg: string };
  pedidos: Array<{
    pedidoVendaId: string;
    ordemNaCarga: number | null;
    previsto: number;
    carregado: number;
  }>;
}

export type MotivoDivergenciaCarga =
  | 'peca_ausente' | 'peca_errada' | 'peso_divergente' | 'etiqueta_ilegivel' | 'avaria' | 'outro';

export interface CargaItem {
  id: string;
  caminhaoId: string;
  tipoOrigem: 'peca' | 'subitem';
  pecaId: string | null;
  subitemId: string | null;
  pedidoVendaId: string;
  pedidoVendaItemId: string;
  statusCargaItem: 'em_carga' | 'conferido' | 'divergente' | 'removido';
  divergenciaMotivo: MotivoDivergenciaCarga | null;
  divergenciaObservacao: string | null;
  conferido: boolean;
  dataHoraEntradaCarga: string;
}

// ── Romaneio (F5 + D9.6: itens por pedido com etiqueta/produto/peso/status) ───

export interface RomaneioItem {
  cargaItemId: string;
  pedidoVendaId: string;
  statusCargaItem: 'em_carga' | 'conferido' | 'divergente' | 'removido';
  divergenciaMotivo: MotivoDivergenciaCarga | null;
  etiqueta: string | null;
  produtoNome: string;
  peso: string | null;
}

export interface RomaneioPedido {
  pedidoVendaId: string;
  clienteId: string | null;
  ordemNaCarga: number | null;
  previsto: number;
  carregado: number;
  itens: RomaneioItem[];
}

export interface Romaneio {
  caminhao: Caminhao;
  pedidos: RomaneioPedido[];
}

// ── Pedido ao Fornecedor (onda1) ──────────────────────────────────────────────

export type StatusPedidoFornecedor =
  | 'rascunho'
  | 'enviado'
  | 'aguardando_recebimento'
  | 'recebido'
  | 'encerrado'
  | 'cancelado';

export interface PedidoFornecedor {
  id: string;
  numero: string;
  fornecedorId: string;
  operacaoId: string;
  compraProgramadaId: string;
  status: StatusPedidoFornecedor;
  createdAt: string;
  updatedAt: string;
}

export interface PedidoFornecedorItem {
  id: string;
  pedidoFornecedorId: string;
  itemComercialId: string;
  quantidadePrevista: string;
  pesoPrevisto: string | null;
}

export interface PedidoFornecedorDetalhe extends PedidoFornecedor {
  itens: PedidoFornecedorItem[];
}

export interface PedidoFornecedorResumoRecebivel {
  id: string;
  numero: string;
  status: 'enviado' | 'aguardando_recebimento';
  fornecedorId: string;
  fornecedorNome: string;
  operacaoId: string;
  dataOperacao: string;
  compraProgramadaId: string;
  numeroInternoCompra: string | null;
}

export interface CriarPedidoFornecedorDto {
  compraProgramadaId: string;
}

// ── Conferência tripla recebimento (onda1) ────────────────────────────────────

export interface QuadroConferenciaItem {
  recebimentoItemId: string | null;
  itemComercialId: string;
  previstoNoPedido: boolean;
  qtdPedido: string | null;
  qtdNf: string;
  qtdApurada: string;
  pesoNf: string | null;
  pesoApurado: string | null;
  situacao: 'conforme' | 'divergente';
}

export interface ConcluirConferenciaDto {
  resultado: 'sem_divergencia' | 'com_divergencia';
  observacao?: string;
}

// ── Onda 6 — troca, estorno e ciclo da etiqueta ───────────────────────────────

export type DestinoRetirada = 'estoque' | 'desossa';

export const MOTIVOS_TROCA_PECA = [
  'peca_mais_adequada',
  'peso_fora_preferencia',
  'qualidade',
  'erro_associacao',
  'outro',
] as const;
export type MotivoTrocaPeca = (typeof MOTIVOS_TROCA_PECA)[number];

export const ROTULOS_MOTIVO_TROCA_PECA: Record<MotivoTrocaPeca, string> = {
  peca_mais_adequada: 'Peça mais adequada ao cliente',
  peso_fora_preferencia: 'Peso fora da preferência',
  qualidade: 'Qualidade',
  erro_associacao: 'Erro de associação',
  outro: 'Outro',
};

export const MOTIVOS_ESTORNO = [
  'peso_incorreto',
  'pedido_incorreto',
  'destino_incorreto',
  'etiqueta_incorreta',
  'outro',
] as const;
export type MotivoEstorno = (typeof MOTIVOS_ESTORNO)[number];

export const ROTULOS_MOTIVO_ESTORNO: Record<MotivoEstorno, string> = {
  peso_incorreto: 'Peso informado incorretamente',
  pedido_incorreto: 'Pedido selecionado incorretamente',
  destino_incorreto: 'Destino selecionado incorretamente',
  etiqueta_incorreta: 'Etiqueta impressa incorretamente',
  outro: 'Outro',
};

export interface ExecutarTrocaPayload {
  pecaRetiradaId: string;
  pecaInseridaId: string;
  pedidoVendaItemId: string;
  destinoRetirada: DestinoRetirada;
  motivo: MotivoTrocaPeca;
  observacoes?: string;
}

export interface ResultadoTroca {
  troca: { id: string; createdAt: string };
  pecaRetirada: Peca;
  pecaInserida: Peca;
  etiquetaInvalidada: { id: string; motivoCancelamento: string | null } | null;
  etiquetaEmitida: { id: string; statusImpressao: string };
}

export type EstadoEtiqueta =
  | 'emitida'
  | 'ativa'
  | 'invalidada_por_troca'
  | 'reimpressa'
  | 'cancelada';

export interface EtiquetaListada {
  id: string;
  pecaId: string;
  codigo: string | null;
  estado: EstadoEtiqueta;
  statusImpressao: 'impressa' | 'falha_impressao' | 'pendente';
  reimpressao: boolean;
  motivoCancelamento: string | null;
  invalidadaEm: string | null;
  bloqueada: boolean;
  pesoOriginal: string;
  statusPeca: string;
  recebimentoId: string;
  pedidoVendaId: string | null;
  operadorId: string;
  operadorNome: string;
  createdAt: string;
  produtoCodigo: string;
  produtoDescricao: string;
  caracteristicas: string[];
  nfNumero: string | null;
  frigorifico: string;
  romaneio: string | null;
  placaVeiculo: string | null;
  motorista: string | null;
  clienteNome: string | null;
  representanteNome: string | null;
  rotaPrevista: string | null;
  localEstoquePrevisto: { valor: string | null; provisorio: true } | null;
  historico: Array<{
    id: string;
    estado: EstadoEtiqueta;
    statusImpressao: string;
    reimpressao: boolean;
    motivoCancelamento: string | null;
    operadorId: string;
    createdAt: string;
  }>;
}
