import { balancear, centavos } from './centavos';
import { celulaCsv } from './csv';
import { acontecimentoDe } from './politicas.service';

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

describe('acontecimento do histórico da política', () => {
  it('sem ação conhecida cai na operação da auditoria', () => {
    expect(acontecimentoDe({}, null, 'UPDATE')).toBe('UPDATE');
    expect(acontecimentoDe({}, { numero: 1 }, 'INSERT')).toBe('INSERT');
    expect(acontecimentoDe({}, { acao: 'outra' }, 'ACAO_MANUAL')).toBe('ACAO_MANUAL');
  });

  it('mostra só os campos trocados, com rótulos e sem o que falta de um dos lados', () => {
    const antes = { tipoEvento: 'LIQUIDACAO', competencia: '2026-10', vigenciaInicio: '2026-10-01', contaDebito: '1.1.01', centroCusto: null, situacao: 'DRAFT', numero: 1 };
    const novos = { acao: 'editar', tipoEvento: 'TARIFA', competencia: '2026-11', vigenciaInicio: '2026-10-02', contaDebito: '1.9', centroCusto: 'C2', situacao: 'X', numero: 2, contaCredito: '2.1.01' };
    expect(acontecimentoDe(antes, novos, 'UPDATE')).toBe(
      'Editar versão — Tipo de ocorrência: Liquidação → Tarifa; Competência: Outubro de 2026 → Novembro de 2026; '
      + 'Início de vigência: 01/10/2026 → 02/10/2026; Conta de débito: 1.1.01 → 1.9; Centro de custo: — → C2; '
      + 'Situação: Rascunho → X; Versão: 1 → 2',
    );
    expect(acontecimentoDe('não é objeto', { acao: 'configurar', contaDebito: '1' }, 'INSERT')).toBe('Configurar mappings');
    expect(acontecimentoDe({ tipoEvento: 'NOVO' }, { acao: 'aprovar', tipoEvento: 'LIQUIDACAO' }, 'UPDATE'))
      .toBe('Aprovar regra — Tipo de ocorrência: NOVO → Liquidação');
  });

  it('a simulação mostra o valor em reais sem passar por float', () => {
    expect(acontecimentoDe({}, { acao: 'simular', valor: '9999999999999.99' }, 'INSERT'))
      .toBe('Simular evento — Valor: R$ 9.999.999.999.999,99');
    expect(acontecimentoDe({}, { acao: 'simular', valor: '10' }, 'INSERT')).toBe('Simular evento — Valor: R$ 10,00');
    expect(acontecimentoDe({}, { acao: 'simular', valor: 10 }, 'INSERT')).toBe('Simular evento');
  });
});
