import { compararQtd, ehZero, formatarQtd, somarQtd, subtrairQtd } from '../../src/common/crud/decimal';

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

  it('lida com valores negativos (ramo de sinal)', () => {
    expect(subtrairQtd('3.000', '5.000')).toBe('-2.000');
    expect(formatarQtd('-1.5')).toBe('-1.500');
    expect(compararQtd('-1', '1')).toBeLessThan(0);
    expect(ehZero('-0.000')).toBe(true);
  });

  it('lida com número negativo e sem parte fracionária', () => {
    expect(formatarQtd(-2)).toBe('-2.000');
    expect(formatarQtd('7')).toBe('7.000');
    expect(formatarQtd('.5')).toBe('0.500'); // sem parte inteira
  });

  it('trunca frações além de 3 casas', () => {
    expect(formatarQtd('1.23456')).toBe('1.234');
  });

  it('somarQtd soma com 3 casas exatas, sem drift de float', () => {
    expect(somarQtd('0.1', '0.2')).toBe('0.300');
    expect(somarQtd('12.500', '1.250')).toBe('13.750');
    expect(somarQtd(0, '0')).toBe('0.000');
  });
});
