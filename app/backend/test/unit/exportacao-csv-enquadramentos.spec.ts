import { mascararCest, mascararCfop, mascararNcm, montarCsvEnquadramentos } from '../../src/modules/erp/fiscal/enquadramentos/exportacao-csv';

const base = {
  codigo: '1', operacao: 'Compra', cfop: '5102', vigenciaInicio: '2026-01-01', vigenciaFim: null,
  estabelecimento: 'Filial', tpNf: '1', finNfe: '1', situacao: 'ATIVA', responsavel: 'Ana',
  produto: 'Acém', cliente: 'Cliente', ncm: '02013000', cest: '1708700', prioridade: 1,
  abrangencia: 'INTERNA', tipoProduto: 'REVENDA',
};

describe('montarCsvEnquadramentos', () => {
  it.each(['=1+1', '+1', '-1', '@SOMA(A1)', '\tx', '\rx'])('neutraliza fórmula %j com prefixo apóstrofo', (produto) => {
    const csv = montarCsvEnquadramentos([{ ...base, produto }]);
    const esperado = /[\r\n]/.test(produto) ? `"'${produto}"` : `'${produto}`;
    expect(csv).toContain(`;${esperado};`);
  });

  it('mantém texto comum e escapa aspas e separador', () => {
    const csv = montarCsvEnquadramentos([{ ...base, produto: 'A;"B"' }]);
    expect(csv).toContain(';"A;""B""";');
    expect(montarCsvEnquadramentos([base])).toContain(';Acém;');
  });
});

describe('vigências no CSV', () => {
  it('exporta início e fim como dd/MM/aaaa, como a tela', () => {
    const csv = montarCsvEnquadramentos([{ ...base, vigenciaFim: '2026-12-31' }]);
    expect(csv).toContain(';01/01/2026;31/12/2026;');
    expect(montarCsvEnquadramentos([base])).toContain(';01/01/2026;;');
  });
});

describe('máscara de CFOP, NCM e CEST no CSV', () => {
  it('mascara os três códigos para o Excel preservar os zeros', () => {
    expect(mascararCfop('5102')).toBe('5.102');
    expect(mascararNcm('04011000')).toBe('0401.10.00');
    expect(mascararCest('0100100')).toBe('01.001.00');
    expect(mascararNcm('123')).toBe('123');
    const csv = montarCsvEnquadramentos([{ ...base, ncm: '04011000', cest: '0100100' }]);
    expect(csv).toContain(';5.102;');
    expect(csv).toContain(';0401.10.00;01.001.00;');
  });
});
