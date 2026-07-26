import { CATALOGO_SIF, derivarStatus } from '../../src/modules/gestao/sif/catalogo-sif';

describe('catalogo-sif', () => {
  it('expõe os 4 tipos do catálogo provisório', () => {
    expect(CATALOGO_SIF).toHaveLength(4);
    expect(CATALOGO_SIF.map((c) => c.codigo)).toEqual(['SIF-01', 'SIF-02', 'SIF-03', 'SIF-04']);
  });

  it('derivarStatus retorna pendente_dados quando há pendências', () => {
    expect(derivarStatus(['falta NF'], 0, null)).toBe('pendente_dados');
  });

  it('derivarStatus retorna pronto_para_gerar sem versão', () => {
    expect(derivarStatus([], 0, null)).toBe('pronto_para_gerar');
  });

  it('derivarStatus retorna gerado ou retificado conforme última geração', () => {
    expect(derivarStatus([], 2, 'gerado')).toBe('gerado');
    expect(derivarStatus([], 3, 'retificado')).toBe('retificado');
  });
});
