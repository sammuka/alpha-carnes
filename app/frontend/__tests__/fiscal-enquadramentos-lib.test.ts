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

  it('máscara remove só ponto, hífen e espaço comum', () => {
    expect(lib.normalizarNcm('0201\n3000')).toBe('0201\n3000');
    expect(lib.codigoFiscalValido('ncms', lib.normalizarNcm('0201\n3000'))).toBe(false);
    expect(lib.codigoFiscalValido('cfops', lib.normalizarCfop('5.102'))).toBe(true);
    expect(lib.codigoFiscalValido('cfops', lib.normalizarCfop('51\t02'))).toBe(false);
  });

  it('formata data e data/hora no fuso de São Paulo', () => {
    expect(lib.rotuloDataHora('2026-10-15T21:02:08.105Z')).toBe('15/10/2026 18:02');
    expect(lib.rotuloDataHora('2026-10-15T02:30:00.000Z')).toBe('14/10/2026 23:30');
    expect(lib.rotuloData('2026-10-15')).toBe('15/10/2026');
  });

  it('não exporta função que calcule tributo', () => {
    expect(Object.keys(lib).join(' ')).not.toMatch(/tributo|aliquota|cst|ibs|cbs/i);
  });
});
