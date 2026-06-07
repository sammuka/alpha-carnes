import { compararQtd, ehZero, formatarQtd, subtrairQtd } from '../../src/common/crud/decimal';

describe('decimal (aritmética NUMERIC exata, S4)', () => {
  it('formata número e string com 3 casas', () => {
    expect(formatarQtd(10)).toBe('10.000');
    expect(formatarQtd('5.5')).toBe('5.500');
    expect(formatarQtd('0.1')).toBe('0.100');
  });

  it('subtrai sem drift de float', () => {
    expect(subtrairQtd('10.000', '3.000')).toBe('7.000');
    expect(subtrairQtd('0.3', '0.1')).toBe('0.200'); // 0.3-0.1 != 0.2 em float
    expect(subtrairQtd('40.000', '40.000')).toBe('0.000');
  });

  it('compara quantidades', () => {
    expect(compararQtd('10', '3')).toBeGreaterThan(0);
    expect(compararQtd('3', '10')).toBeLessThan(0);
    expect(compararQtd('5.000', '5')).toBe(0);
  });

  it('detecta zero', () => {
    expect(ehZero('0.000')).toBe(true);
    expect(ehZero('0')).toBe(true);
    expect(ehZero('0.001')).toBe(false);
  });
});
