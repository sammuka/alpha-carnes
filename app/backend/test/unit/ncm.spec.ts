import { validarCest } from '../../src/common/validators/cest';
import { validarCfop } from '../../src/common/validators/cfop';
import { normalizarNcm, validarNcm } from '../../src/common/validators/ncm';

describe('NCM — formato de 8 dígitos', () => {
  it('normaliza NCM mascarado', () => {
    expect(normalizarNcm('0201.30.00')).toBe('02013000');
    expect(validarNcm('0201300')).toBe(false);
    expect(validarCfop('5101')).toBe(true);
    expect(validarCfop('51A1')).toBe(false);
    expect(validarCest('1708700')).toBe(true);
    expect(validarCest('170870')).toBe(false);
  });

  it('`0201.30.00` → `02013000`', () => {
    expect(normalizarNcm('0201.30.00')).toBe('02013000');
    expect(normalizarNcm('0201 30-00')).toBe('02013000');
  });

  it('7 dígitos inválido', () => {
    expect(validarNcm('0201300')).toBe(false);
    expect(validarNcm(normalizarNcm('0201.30.0'))).toBe(false);
  });
});
