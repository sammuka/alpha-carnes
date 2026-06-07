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
