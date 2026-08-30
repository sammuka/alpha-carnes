export type StatusCadastro = 'ativo' | 'inativo';

export interface ParadaRota {
  ordem: number;
  descricao: string;
}

export const DIAS_SEMANA = [
  { valor: 'seg', rotulo: 'Seg' },
  { valor: 'ter', rotulo: 'Ter' },
  { valor: 'qua', rotulo: 'Qua' },
  { valor: 'qui', rotulo: 'Qui' },
  { valor: 'sex', rotulo: 'Sex' },
  { valor: 'sab', rotulo: 'Sáb' },
  { valor: 'dom', rotulo: 'Dom' },
] as const;

export interface Rota {
  id: string;
  codigo: string;
  nome: string;
  regiao: string | null;
  representantePadraoId: string | null;
  representantePadrao: string | null;
  caminhaoPadraoId: string | null;
  caminhaoPadrao: string | null;
  motoristaPadraoId: string | null;
  motoristaPadrao: string | null;
  observacoes: string | null;
  status: StatusCadastro;
  paradas: ParadaRota[];
  diasAtendimento: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CriarRotaDto {
  codigo: string;
  nome: string;
  regiao?: string;
  representantePadraoId?: string | null;
  caminhaoPadraoId?: string | null;
  motoristaPadraoId?: string | null;
  observacoes?: string;
  status?: StatusCadastro;
  paradas: ParadaRota[];
  diasAtendimento: string[];
}

export type AtualizarRotaDto = Partial<CriarRotaDto>;

export interface Paginado<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
