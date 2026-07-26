export type StatusCadastro = 'ativo' | 'inativo';

export interface Representante {
  id: string;
  codigo: string;
  nome: string;
  tipoCanal: string | null;
  contato: string | null;
  status: StatusCadastro;
  observacao: string | null;
  /** Contagem em `GET /representantes`; lista em `GET /representantes/:id` (decisão 45). */
  clientesVinculados?: number | ClienteVinculado[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ClienteVinculado {
  id: string;
  nomeFantasia: string | null;
  razaoSocial: string;
}

export interface CriarRepresentanteDto {
  codigo: string;
  nome: string;
  tipoCanal?: string;
  contato?: string;
  status?: StatusCadastro;
  observacao?: string;
}

export type AtualizarRepresentanteDto = Partial<CriarRepresentanteDto>;

export interface Paginado<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
