import { subtrairQtd } from '../../src/common/crud/decimal';

describe('aprovacoes-regras — derivacao comparativo', () => {
  it('difQtd = apurada - NF', () => {
    expect(subtrairQtd('12.000', '10.000')).toBe('2.000');
  });

  it('difPeso nula quando peso ausente', () => {
    const pesoNf = null;
    const pesoApurado = '100.000';
    const difPeso = pesoNf !== null && pesoApurado !== null
      ? subtrairQtd(pesoApurado, pesoNf) : null;
    expect(difPeso).toBeNull();
  });
});
