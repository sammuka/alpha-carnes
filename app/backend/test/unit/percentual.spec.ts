import { formatarPercentualPtBr, normalizarPercentual } from '../../src/modules/erp/fiscal/regras/percentual';

describe('percentual', () => {
  it('normaliza ponto percentual para razão e recusa terceira casa e float disfarçado', () => {
    expect(normalizarPercentual('41,67')).toBe('0.4167');
    expect(normalizarPercentual('12,00')).toBe('0.1200');
    expect(normalizarPercentual('7,00')).toBe('0.0700');
    expect(normalizarPercentual('0')).toBe('0.0000');
    expect(normalizarPercentual('100')).toBe('1.0000');
    expect(normalizarPercentual('100,00')).toBe('1.0000');
    expect(normalizarPercentual('100,000')).toBeNull();
    expect(normalizarPercentual('100,001')).toBeNull();
    expect(normalizarPercentual('41,678')).toBeNull();
    expect(normalizarPercentual('41,6789')).toBeNull();
    expect(normalizarPercentual('-1')).toBeNull();
    expect(normalizarPercentual('1e2')).toBeNull();
    expect(formatarPercentualPtBr('0.4167')).toBe('41,67');
    expect(formatarPercentualPtBr('0.1200')).toBe('12,00');
    expect(formatarPercentualPtBr('0.0700')).toBe('7,00');
    expect(formatarPercentualPtBr('1.0000')).toBe('100,00');
  });
});
