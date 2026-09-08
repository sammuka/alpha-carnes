import { UNIDADES_MEDIDA, UFS_BRASIL, rotuloProduto, rotuloCliente } from '../src/lib/dominios';

describe('Domínios compartilhados da UI', () => {
  it('DoD 12.2 unidade é o mesmo enum nas três superfícies', () => {
    expect(UNIDADES_MEDIDA).toEqual(['kg', 'unidade']);
  });

  it('DoD 12.9 expõe exatamente as 27 UFs na ordem canônica', () => {
    expect(UFS_BRASIL).toEqual([
      'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
      'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
      'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
    ]);
    expect(new Set(UFS_BRASIL).size).toBe(27);
  });

  it('rotuloProduto nunca devolve UUID', () => {
    expect(rotuloProduto({ codigo: 'TZ', nome: 'Traseiro' })).toBe('TZ — Traseiro');
    expect(rotuloProduto({ codigo: '01a05a54-d229-7552-b9d0-ddb182915242', nome: 'Traseiro' })).toBe('Traseiro');
    expect(rotuloProduto(undefined)).toBe('—');
  });

  it('rotuloCliente usa nome fantasia e recusa UUID', () => {
    expect(rotuloCliente({ nomeFantasia: 'Friella', razaoSocial: 'Friella Ltda' })).toBe('Friella');
    expect(rotuloCliente({ nomeFantasia: null, razaoSocial: '01a05a54-d229-7552-b9d0-ddb182915242' })).toBe('—');
  });
});
