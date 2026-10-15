import { montarCsvRegras } from '../../src/modules/erp/fiscal/regras/exportacao-csv';

const linha = {
  enquadramentoFiscal: 'ENQ', operacaoFiscal: '5102', beneficioFiscal: 'b', classificacaoIbsCbs: 'c', operacao: 'o', icmsCst: '20',
};

describe('montarCsvRegras neutraliza fórmula', () => {
  it.each(['=1+1', '+1', '-1', '@SOMA(A1)', '\tx', '\rx'])('benefício e classificação %j recebem apóstrofo', (texto) => {
    const corpo = montarCsvRegras([{ ...linha, beneficioFiscal: texto, classificacaoIbsCbs: texto }]).split('\r\n').slice(1).join('\r\n');
    const sem = corpo.replace(/"/g, '');
    expect(sem.startsWith(`ENQ;5102;'`)).toBe(true);
    expect(sem).toContain(`;'${texto}`);
    expect(sem.match(/;'/g)?.length).toBe(2);
  });
  it('mantém texto comum', () => {
    expect(montarCsvRegras([linha])).toContain('\r\nENQ;5102;b;c;o;');
  });
});
