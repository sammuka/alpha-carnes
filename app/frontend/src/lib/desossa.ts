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
  produtoOrigemCodigo: string;
  status: 'ativo' | 'inativo';
  prioridade: number;
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
