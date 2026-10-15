import { balancear, centavos } from './centavos';

describe('centavos da política', () => {
  it('soma 0.10 e 0.20 em centavos, sem float', () => {
    expect(centavos('0.10') + centavos('0.20')).toBe(30n);
    expect(centavos('0.10') + centavos('0.20')).toBe(centavos('0.30'));
  });

  it('recusa soma desbalanceada e não grava lançamento', () => {
    try {
      balancear([
        { lado: 'D', valor: '10.00' },
        { lado: 'C', valor: '10.01' },
      ], 'LIQUIDACAO-2026-10');
      throw new Error('deveria recusar');
    } catch (erro) {
      expect(erro).toMatchObject({
        status: 422,
        response: { message: 'balanceamento exato', codigo: 'LIQUIDACAO-2026-10' },
      });
    }
  });
});
