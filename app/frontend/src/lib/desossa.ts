export interface FaltaDesossa {
  produto: { id: string; codigo: string; nome: string };
  quantidadeFaltante: number;
  quantidadeEstoque: number;
  origem: string;
}

export interface SaidaRegraTransformacao {
  id: string;
  regraId: string;
  produtoId: string;
  quantidadeFixa: string;
}

export interface RegraTransformacao {
  id: string;
  nome: string;
  codigo?: string | null;
  produtoOrigemCodigo: string;
  status: 'ativo' | 'inativo';
  prioridade: number;
  provisorio?: boolean;
  observacao: string | null;
  saidas: SaidaRegraTransformacao[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginadoRegras {
  data: RegraTransformacao[];
  total: number;
  page: number;
  pageSize: number;
}

export type PainelDesossa = {
  geradoEm: string;
  modoTv: boolean;
  operacaoId: string;
  itens: Array<{
    produtoId: string;
    produtoCodigo: string;
    produtoNome: string;
    faltam: number;
    prontoEstoque: number;
    aProduzir: number;
    origem: string;
    rota: string | null;
    representante: string | null;
    horarioAlvo: string | null;
    prioridade: 'Alta' | 'Média' | 'Baixa';
    status: string;
  }>;
  regras: Array<{
    regraId: string;
    codigo: string | null;
    nome: string;
    provisorio: boolean;
    prioridade: 'Alta' | 'Média' | 'Baixa';
    tzsEstimados: number;
    saidasEsperadas: string;
    atende: string;
    sobras: string;
    impacto: string;
    status: 'Recomendada' | 'Útil' | 'Opcional';
  }>;
  alertas: Array<{ tipo: string; msg: string }>;
  totais: {
    itensFaltantes: number;
    prontoEstoque: number;
    tzsNaDesossa: number;
    pecasAProduzir: number;
  };
};

export type ChecklistSlot = {
  produtoId: string;
  produtoCodigo: string;
  produtoNome: string;
  esperado: number;
  registrado: number;
  status: 'pendente' | 'parcial' | 'completo' | 'excedente';
};

export type ChecklistResponse = {
  transformacaoId: string;
  regraTransformacaoId: string | null;
  regraNome: string | null;
  regraProvisoria: boolean;
  slots: ChecklistSlot[];
  divergente: boolean;
  divergenciaAbertaId: string | null;
};

export type EtiquetaDesossaListada = {
  id: string;
  codigo: string | null;
  parteCodigo: string | null;
  produtoCodigo: string;
  produtoNome: string;
  peso: string | null;
  origemPeso: 'balanca' | 'manual' | string | null;
  destino: 'pedido' | 'estoque' | string;
  clientePedido: string | null;
  pecaMaeCodigo: string | null;
  estado: string;
  transformacaoId: string;
  subitemId: string;
  createdAt: string;
  invalidadaEm: string | null;
  bloqueada: boolean;
  pendenteImpressao: boolean;
};

export type PecaElegivelDesossa = {
  pecaId: string;
  etiquetaAtual: string | null;
  statusPeca: string;
  pesoOriginal: string | null;
  produtoId: string;
  produtoCodigo: string | null;
  recebimentoId: string;
  transformacaoId: string | null;
  lote: string | null;
  origem: string | null;
  entrada: string | null;
  caracteristicas: string;
  situacao: 'Disponível para desossa' | 'Aguardando chegada à desossa' | 'Prioritário';
  obs: string | null;
};
