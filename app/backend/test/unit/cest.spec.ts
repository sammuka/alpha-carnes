import { normalizarCest, validarCest } from '../../src/common/validators/cest';

describe('CEST — formato de 7 dígitos', () => {
  it('1708700 válido e 6 dígitos inválido', () => {
    expect(normalizarCest('17.087.00')).toBe('1708700');
    expect(validarCest('1708700')).toBe(true);
    expect(validarCest('170870')).toBe(false);
  });
});
