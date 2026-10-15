import { balancear, centavos } from './centavos';
import { celulaCsv } from './csv';

describe('centavos da política', () => {
  it('soma 0.10 e 0.20 em centavos, sem float', () => {
    expect(centavos('0.10', 'X') + centavos('0.20', 'X')).toBe(30n);
    expect(centavos('0.10', 'X') + centavos('0.20', 'X')).toBe(centavos('0.30', 'X'));
  });

  it.each(['-1.00', '1.005', '10.5', '10', '10,50', '12345678901234.00', 'abc', ''])(
    'recusa %p como valor monetário inválido, com o código da política',
    (valor) => {
      try {
        centavos(valor, 'LIQUIDACAO-2026-10');
        throw new Error('deveria recusar');
      } catch (erro) {
        expect(erro).toMatchObject({
          status: 422,
          response: { message: 'valor monetário inválido', codigo: 'LIQUIDACAO-2026-10' },
        });
      }
    },
  );

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

describe('celulaCsv', () => {
  it.each([
    ['=1+1', "'=1+1"],
    ['+SUM(A1)', "'+SUM(A1)"],
    // Comportamento aceito: número negativo legítimo também recebe o apóstrofo; a célula do CSV é texto e nenhuma coluna é numérica.
    ['-2', "'-2"],
    ['@cmd', "'@cmd"],
    ['\t=tab', `"'\t=tab"`],
    ['\r=cr', `"'\r=cr"`],
    ['Caixa', 'Caixa'],
    ['a;b', '"a;b"'],
    ['diz "oi"', '"diz ""oi"""'],
    ['linha\nnova', '"linha\nnova"'],
  ])('%j vira %j', (entrada, esperado) => {
    expect(celulaCsv(entrada)).toBe(esperado);
  });
});
