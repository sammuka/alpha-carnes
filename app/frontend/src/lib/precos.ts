// Tipos da tabela de preços (D14/D16/D30) — espelham `tabela-preco.dto.ts` e o retorno
// de `PrecosService` no backend.

export interface TabelaPreco {
  id: string;
  data: string;
  status: 'rascunho' | 'publicada';
  observacao: string | null;
  publicadaPor: string | null;
  publicadaEm: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TabelaPrecoItem {
  produtoId: string;
  codigo: string;
  nome: string;
  unidadePreco: string;
  provisorio: boolean;
  precoA: string | null;
  precoB: string | null;
  precoC: string | null;
  precoD: string | null;
}

export interface TabelaPrecoPublicacao {
  id: string;
  tabelaPrecoId: string;
  acao: string;
  autorId: string;
  observacao: string | null;
  criadoEm: string;
}

export interface TabelaPrecoDetalhe extends TabelaPreco {
  itens: TabelaPrecoItem[];
  historico: TabelaPrecoPublicacao[];
}

export interface CriarTabelaPrecoDto {
  data: string;
  observacao?: string;
}

export interface SalvarItensTabelaPrecoDto {
  itens: Array<{
    produtoId: string;
    precoA?: number | null;
    precoB?: number | null;
    precoC?: number | null;
    precoD?: number | null;
  }>;
}

export interface CopiarTabelaPrecoDto {
  origemId?: string;
}

export interface PublicarTabelaPrecoDto {
  observacao?: string;
}

export interface PrecosIncompletosErro {
  code: 'PRECOS_INCOMPLETOS';
  message: string;
  produtos: Array<{ codigo: string; nome: string }>;
}
