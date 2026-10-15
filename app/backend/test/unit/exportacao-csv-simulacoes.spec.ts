import { montarCsvGrade, montarCsvMemoria } from '../../src/modules/erp/fiscal/simulacoes/exportacao-csv';

const grade = { cliente: 'C', produto: 'P', valor: '1,00', valorLiquido: '1,00', estabelecimento: 'E', operacao: 'O' };

describe('exportacao-csv das simulações', () => {
  it.each(['=1+1', '+1', '-1', '@SOMA(A1)', '\tx', '\rx', "=cmd|' /C calc'!A0"])(
    'neutraliza fórmula %j na grade e na memória',
    (texto) => {
      const g = montarCsvGrade([{ ...grade, produto: texto }]);
      expect(g).toMatch(/;"?'[=+\-@\t\r]/);
      expect(g).not.toMatch(/;"?[=+\-@\t\r]/);
      const m = montarCsvMemoria({ linhas: [{ rotulo: 'Produto', valor: texto }], semAliquota: [] });
      expect(m).toMatch(/Produto;"?'[=+\-@\t\r]/);
    },
  );

  it('mantém texto comum e escapa aspas e separador', () => {
    expect(montarCsvGrade([{ ...grade, produto: 'A;"B"' }])).toContain('"A;""B""";');
  });
});
