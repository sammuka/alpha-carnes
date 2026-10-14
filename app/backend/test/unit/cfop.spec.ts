import { normalizarCfop, validarCfop } from '../../src/common/validators/cfop';

describe('CFOP — formato de 4 dígitos', () => {
  it('5101 válido', () => {
    expect(normalizarCfop('5101')).toBe('5101');
    expect(validarCfop('5101')).toBe(true);
  });

  it('ABC inválido', () => {
    expect(validarCfop('ABC')).toBe(false);
    expect(validarCfop('51A1')).toBe(false);
  });
});
