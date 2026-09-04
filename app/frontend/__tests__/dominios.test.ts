import { UNIDADES_MEDIDA, UFS_BRASIL } from '../src/lib/dominios';

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
});
