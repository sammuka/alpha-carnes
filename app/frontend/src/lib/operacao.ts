// Tipos compartilhados do domínio operacional (F4a — Recebimento + Divergências).

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
  quantidadeEsperada: string;
  quantidadeRecebida: string;
  pesoTotalApurado: string | null;
  statusApuracao: 'aguardando' | 'conforme' | 'divergente';
  observacoes: string | null;
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
  compraProgramadaId: string;
  fornecedorId: string;
  dataOperacao: string;
  status: 'em_andamento' | 'com_divergencia' | 'concluido';
  notaFiscalFornecedor: string | null;
  itens: RecebimentoItem[];
  divergencias: DivergenciaRecebimento[];
}

export interface RecebimentoResumo {
  id: string;
  compraProgramadaId: string;
  dataOperacao: string;
  status: string;
}

export interface IniciarRecebimentoResultado {
  recebimento: RecebimentoResumo;
  jaIniciado: boolean;
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
}

export interface ResultadoSugestao {
  pecaId: string;
  sugestao: SugestaoScored | null;
  compativeis: SugestaoScored[];
}
