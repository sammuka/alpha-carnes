import { mascararCnae, normalizarCnae, validarFormatoCnae } from '../../src/common/validators/cnae';

describe('CNAE — formato da subclasse 2.x (E01-T01, D21)', () => {
  it('`6201-5/01` e `6201501` → `6201501`', () => {
    expect(normalizarCnae('6201-5/01')).toBe('6201501');
    expect(normalizarCnae('6201501')).toBe('6201501');
    expect(normalizarCnae(' 62.01-5/01 ')).toBe('6201501');
    expect(validarFormatoCnae(normalizarCnae('6201-5/01'))).toBe(true);
    expect(validarFormatoCnae('6201501')).toBe(true);
  });

  it('6 ou 8 dígitos, letras → inválido', () => {
    expect(validarFormatoCnae('620150')).toBe(false);
    expect(validarFormatoCnae('62015010')).toBe(false);
    expect(validarFormatoCnae('62O1501')).toBe(false);
    expect(validarFormatoCnae(normalizarCnae('6201-5/0A'))).toBe(false);
    expect(validarFormatoCnae('')).toBe(false);
  });

  it('mascararCnae', () => {
    expect(mascararCnae('6201501')).toBe('6201-5/01');
    expect(mascararCnae('6202300')).toBe('6202-3/00');
    // Valor fora do formato é devolvido sem máscara (nunca inventa dígitos).
    expect(mascararCnae('620150')).toBe('620150');
  });
});
