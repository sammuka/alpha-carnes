import { formatarPercentualPtBr, normalizarPercentual, regrasApi } from '../src/lib/fiscal-regras';

describe('fiscal-regras lib', () => {
  it('repete a razão e o ponto percentual da Task 1', () => {
    expect(normalizarPercentual('41,67')).toBe('0.4167');
    expect(formatarPercentualPtBr('0.1200')).toBe('12,00');
  });

  it('exporta a visão com busca, filtro e ordenação', () => {
    const url = regrasApi.urlExportacao({ search: 'ICMS', cfopId: 'abc', sort: 'icmsCst', dir: 'desc', page: 3 });
    expect(url).toBe('/api/erp/fiscal/regras/exportacao?search=ICMS&cfopId=abc&sort=icmsCst&dir=desc');
  });
});
