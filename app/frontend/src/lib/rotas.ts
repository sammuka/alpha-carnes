export type StatusCadastro = 'ativo' | 'inativo';

export interface Rota {
  id: string;
  codigo: string;
  nome: string;
  regiao: string | null;
  representantePadrao: string | null;
  caminhaoPadrao: string | null;
  motoristaPadrao: string | null;
  observacoes: string | null;
  status: StatusCadastro;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CriarRotaDto {
  codigo: string;
  nome: string;
  regiao?: string;
  representantePadrao?: string;
  caminhaoPadrao?: string;
  motoristaPadrao?: string;
  observacoes?: string;
  status?: StatusCadastro;
}

export type AtualizarRotaDto = Partial<CriarRotaDto>;

export interface Paginado<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
