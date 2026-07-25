import { RegrasDesdobramentoService } from '../../src/modules/cadastros/regras-desdobramento/regras-desdobramento.service';

function criarServiceCom(
  regras: Array<{ itemComercialId: string; descricao: string; fator: string }>,
) {
  const db = {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        innerJoin: jest.fn(() => ({
          where: jest.fn(() => ({
            orderBy: jest.fn(() => Promise.resolve(regras)),
          })),
        })),
      })),
    })),
  };
  return new RegrasDesdobramentoService({ db } as never, {} as never);
}

describe('simulador-desdobramento', () => {
  it('simulador de desdobramento multiplica fatores e soma partes', async () => {
    const service = criarServiceCom([
      { itemComercialId: 'c1', descricao: 'Traseiro', fator: '2' },
      { itemComercialId: 'c2', descricao: 'Dianteiro', fator: '2' },
      { itemComercialId: 'c3', descricao: 'Ponta de agulha', fator: '2' },
    ]);
    const r = await service.simular('compra-1', 100);
    expect(r.itens.map((i) => i.total)).toEqual([200, 200, 200]);
    expect(r.somaFatores).toBe(6);
    expect(r.totalPartes).toBe(600);
  });
});
