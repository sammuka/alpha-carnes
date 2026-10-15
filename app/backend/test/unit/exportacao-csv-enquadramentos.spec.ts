import { montarCsvEnquadramentos } from '../../src/modules/erp/fiscal/enquadramentos/exportacao-csv';

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
