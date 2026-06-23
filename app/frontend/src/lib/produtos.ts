export type StatusCadastro = 'ativo' | 'inativo';

export type TipoOperacional =
  | 'peca_inteira_pesavel'
  | 'derivado_desossa'
  | 'entrada_unidade'
  | 'compra_base';

export type UnidadePreco = 'kg' | 'unidade';

export interface Produto {
  id: string;
  codigo: string;
  nome: string;
  nomeOperacional: string | null;
  categoria: string | null;
  tipoOperacional: TipoOperacional;
  unidadePedido: string;
  unidadePreco: UnidadePreco;
  exigePeso: boolean;
  passaBalanca: boolean;
  passaDesossa: boolean;
  origemTransformacao: boolean;
  saidaTransformacao: boolean;
  podeEstoque: boolean;
  ativoVenda: boolean;
  ativoCompra: boolean;
  status: StatusCadastro;
  observacoesOperacionais: string | null;
  atributosJson: Record<string, unknown>;
  legadoItemComercialId: string | null;
  legadoItemCompraId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CriarProdutoDto {
  codigo: string;
  nome: string;
  nomeOperacional?: string;
  categoria?: string;
  tipoOperacional?: TipoOperacional;
  unidadePedido: string;
  unidadePreco?: UnidadePreco;
  exigePeso?: boolean;
  passaBalanca?: boolean;
  passaDesossa?: boolean;
  origemTransformacao?: boolean;
  saidaTransformacao?: boolean;
  podeEstoque?: boolean;
  ativoVenda?: boolean;
  ativoCompra?: boolean;
  status?: StatusCadastro;
  observacoesOperacionais?: string;
  atributosJson?: Record<string, unknown>;
}

export type AtualizarProdutoDto = Partial<CriarProdutoDto>;

export interface Paginado<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const TIPOS_OPERACIONAIS: { valor: TipoOperacional; rotulo: string }[] = [
  { valor: 'peca_inteira_pesavel', rotulo: 'Peça inteira pesável' },
  { valor: 'derivado_desossa', rotulo: 'Derivado de desossa' },
  { valor: 'entrada_unidade', rotulo: 'Entrada direta por unidade' },
  { valor: 'compra_base', rotulo: 'Produto de compra/base' },
];

export function rotuloTipoOperacional(tipo: TipoOperacional): string {
  return TIPOS_OPERACIONAIS.find((t) => t.valor === tipo)?.rotulo ?? tipo;
}

export function fluxoOperacional(p: Pick<Produto, 'passaBalanca' | 'passaDesossa' | 'tipoOperacional'>): string {
  const partes: string[] = [];
  if (p.passaBalanca) partes.push('Balança');
  if (p.passaDesossa) partes.push('Desossa');
  if (p.tipoOperacional === 'entrada_unidade') partes.push('Entrada direta');
  if (p.tipoOperacional === 'compra_base') partes.push('Compras');
  return partes.length ? partes.join(' / ') : '—';
}
