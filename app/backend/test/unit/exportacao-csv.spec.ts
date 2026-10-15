import { montarCsvEstabelecimentos } from '../../src/modules/erp/fiscal/empresas/exportacao-csv';

const base = { nome: 'Filial', cnpj: '12345678000195', crt: '3', uf: 'SP', situacao: 'APPROVED', empresa: 'Alpha' };

describe('montarCsvEstabelecimentos', () => {
  it.each(['=1+1', '+1', '-1', '@SOMA(A1)', '\tx', '\rx'])('neutraliza fórmula %j com prefixo apóstrofo', (nome) => {
    const corpo = montarCsvEstabelecimentos([{ ...base, nome }]).split('\r\n')[1] ?? '';
    const primeira = corpo.split(';')[0] ?? '';
    expect(primeira.replace(/^"/, '').startsWith("'")).toBe(true);
  });

  it('mantém texto comum e escapa aspas e separador', () => {
    const corpo = montarCsvEstabelecimentos([{ ...base, nome: 'A;"B"' }]).split('\r\n')[1];
    expect(corpo?.startsWith('"A;""B""";')).toBe(true);
    expect(montarCsvEstabelecimentos([base])).toContain('\r\nFilial;');
  });
});

describe('CNPJ no CSV', () => {
  it('exporta com a máscara da tela para o Excel não perder zeros nem usar notação científica', () => {
    const csv = (cnpj: string) => montarCsvEstabelecimentos([{ ...base, cnpj }]).split('\r\n')[1]?.split(';')[1];
    expect(csv('00123456000195')).toBe('00.123.456/0001-95');
    expect(csv('12345E78000195')).toBe('12.345.E78/0001-95');
  });
});
