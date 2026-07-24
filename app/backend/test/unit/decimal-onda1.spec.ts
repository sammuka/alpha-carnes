import { minimoQtd, somarListaQtd } from '../../src/common/crud/decimal';

describe('decimal-onda1 (mínimo e soma de lista)', () => {
  it('minimoQtd escolhe o menor sem drift', () => {
    expect(minimoQtd('2.000', '5.000')).toBe('2.000');
    expect(minimoQtd('5', '2.5')).toBe('2.500');
    expect(minimoQtd(0.3, 0.1)).toBe('0.100');
  });

  it('somarListaQtd agrega sem drift de float', () => {
    expect(somarListaQtd([])).toBe('0.000');
    expect(somarListaQtd(['1.000', '2.000', '0.100'])).toBe('3.100');
    expect(somarListaQtd([0.1, 0.2])).toBe('0.300');
  });
});
