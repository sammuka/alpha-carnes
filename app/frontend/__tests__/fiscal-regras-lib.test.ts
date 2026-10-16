import { formatarPercentualPtBr, normalizarPercentual } from '../src/lib/fiscal-regras';

describe('fiscal-regras lib', () => {
  it('repete a razão e o ponto percentual da Task 1', () => {
    expect(normalizarPercentual('41,67')).toBe('0.4167');
    expect(formatarPercentualPtBr('0.1200')).toBe('12,00');
  });
});
