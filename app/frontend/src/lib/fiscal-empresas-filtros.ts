import { FILTROS_PADRAO, type FiltrosGrade, type SituacaoEstabelecimento } from './fiscal-empresas';

/** Chave do `sessionStorage`: os filtros da grade sobrevivem à navegação dentro da sessão. */
export const CHAVE_FILTROS = 'alphacarnes:fiscal-empresas:filtros';

const SITUACOES: SituacaoEstabelecimento[] = ['DRAFT', 'REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'];
const ORDENACOES: FiltrosGrade['sort'][] = ['estabelecimento', 'cnpj', 'regime', 'uf', 'empresa'];

/** Lê os filtros salvos, descartando qualquer valor inválido (nunca confia no conteúdo do storage). */
export function lerFiltrosSalvos(): FiltrosGrade {
  try {
    const bruto = window.sessionStorage.getItem(CHAVE_FILTROS);
    if (!bruto) return FILTROS_PADRAO;
    const v = JSON.parse(bruto) as Partial<FiltrosGrade>;
    return {
      empresaId: typeof v.empresaId === 'string' ? v.empresaId : '',
      estabelecimentoId: typeof v.estabelecimentoId === 'string' ? v.estabelecimentoId : '',
      situacao: SITUACOES.includes(v.situacao as SituacaoEstabelecimento) ? (v.situacao as SituacaoEstabelecimento) : '',
      search: typeof v.search === 'string' ? v.search.slice(0, 100) : '',
      sort: ORDENACOES.includes(v.sort as FiltrosGrade['sort']) ? (v.sort as FiltrosGrade['sort']) : FILTROS_PADRAO.sort,
      dir: v.dir === 'desc' ? 'desc' : 'asc',
      page: Number.isInteger(v.page) && (v.page as number) >= 1 ? (v.page as number) : 1,
    };
  } catch {
    return FILTROS_PADRAO;
  }
}

export function salvarFiltros(filtros: FiltrosGrade): void {
  try {
    window.sessionStorage.setItem(CHAVE_FILTROS, JSON.stringify(filtros));
  } catch {
    // Storage indisponível (modo privado/cheio): a grade segue funcionando sem persistência.
  }
}

/** Há algum filtro além da ordenação e da página? */
export function temFiltroAtivo(f: FiltrosGrade): boolean {
  return f.empresaId !== '' || f.estabelecimentoId !== '' || f.situacao !== '' || f.search.trim() !== '';
}
