import { montarCsvGrade, montarCsvMemoria } from '../../src/modules/erp/fiscal/simulacoes/exportacao-csv';

const grade = { cliente: 'C', produto: 'P', valor: '1,00', valorLiquido: '1,00', estabelecimento: 'E', operacao: 'O' };

describe('exportacao-csv das simulações', () => {
  it.each(['=1+1', '+1', '-1', '@SOMA(A1)', '\tx', '\rx', "=cmd|' /C calc'!A0"])(
    'neutraliza fórmula %j na grade e na memória',
    (texto) => {
      const g = montarCsvGrade([{ ...grade, produto: texto }]);
      expect(g).toMatch(/;"?'[=+\-@\t\r]/);
      expect(g).not.toMatch(/;"?[=+\-@\t\r]/);
      const m = montarCsvMemoria({ linhas: [{ rotulo: 'Produto', valor: texto }], semAliquota: [], textoBase: null, referenciaLegal: 'Regra 1' });
      expect(m).toMatch(/Produto;"?'[=+\-@\t\r]/);
    },
  );

  it('CSV da memória é o da explicação: tratamento com a frase, base diferente e referência legal', () => {
    const csv = montarCsvMemoria({
      linhas: [{ rotulo: 'ICMS', valor: '70,00' }],
      semAliquota: [{ rotulo: 'Tratamento IPI', tratamento: 'Saída não tributada', texto: 'Esta regra não guarda alíquota deste tributo; nenhum valor é calculado.' }],
      textoBase: 'A base tributável difere do valor bruto. Valor: 1.000,00.',
      referenciaLegal: 'Regra 1 versão 1, vigência de 01/01/2026 a 31/12/2026. Benefício fiscal: Benefício SP. Classificação IBS/CBS: Cl.',
    });
    expect(csv).toBe([
      '\uFEFFCampo;Valor',
      'ICMS;70,00',
      'Tratamento IPI;"Saída não tributada. Esta regra não guarda alíquota deste tributo; nenhum valor é calculado."',
      'Base tributável difere de valor bruto;A base tributável difere do valor bruto. Valor: 1.000,00.',
      'Referência legal;Regra 1 versão 1, vigência de 01/01/2026 a 31/12/2026. Benefício fiscal: Benefício SP. Classificação IBS/CBS: Cl.',
    ].join('\r\n'));
    const semBase = montarCsvMemoria({ linhas: [], semAliquota: [], textoBase: null, referenciaLegal: '=1+1' });
    expect(semBase).toBe("\uFEFFCampo;Valor\r\nReferência legal;'=1+1");
  });

  it('mantém texto comum e escapa aspas e separador', () => {
    expect(montarCsvGrade([{ ...grade, produto: 'A;"B"' }])).toContain('"A;""B""";');
  });
});
