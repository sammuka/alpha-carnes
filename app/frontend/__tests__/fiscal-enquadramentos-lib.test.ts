import * as lib from '../src/lib/fiscal-enquadramentos';

describe('fiscal-enquadramentos', () => {
  it('traduz os pares de tipo da nota, finalidade, abrangência e origem', () => {
    expect(lib.ROTULOS_TP_NF).toEqual({ '0': 'Entrada', '1': 'Saída' });
    expect(lib.ROTULOS_FIN_NFE).toEqual({
      '1': 'Operação normal',
      '2': 'NF-e complementar',
      '3': 'NF-e de ajuste',
      '4': 'Devolução',
    });
    expect(lib.ROTULOS_ABRANGENCIA).toEqual({
      INTERNA: 'Dentro do estado',
      INTER: 'Outro estado',
      EXT: 'Exterior',
    });
    expect(lib.ROTULOS_TIPO_PRODUTO).toEqual({
      PROPRIA: 'Produção própria',
      REVENDA: 'Revenda',
      SUB: 'Subproduto',
    });
    expect(lib.ROTULOS_SITUACAO_ENQUADRAMENTO.ATIVA).toBe('Ativa');
    expect(lib.ROTULOS_SITUACAO_ENQUADRAMENTO.INATIVA).toBe('Inativa');
  });

  it('normaliza NCM mascarado e CEST só com dígitos', () => {
    expect(lib.normalizarNcm('0201.30.00')).toBe('02013000');
    expect(lib.normalizarNcm('0201 30-00')).toBe('02013000');
    expect(lib.normalizarCest('17.087.00')).toBe('1708700');
  });

  it('não exporta função que calcule tributo', () => {
    expect(Object.keys(lib).join(' ')).not.toMatch(/tributo|aliquota|cst|ibs|cbs/i);
  });
});
