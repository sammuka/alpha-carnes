import { FaltasService } from '../../src/modules/operacao/desossa/faltas.service';

describe('FaltasService', () => {
  it('retorna vazio quando não há produtos de saída de transformação', async () => {
    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([])),
        })),
      })),
    };
    const service = new FaltasService({ db } as never);
    await expect(service.listarFaltas()).resolves.toEqual([]);
  });

  it('calcula faltas com demanda, estoque e origem da regra', async () => {
    let selectCall = 0;
    const db = {
      select: jest.fn(() => {
        const idx = selectCall++;
        if (idx === 0) {
          return {
            from: jest.fn(() => ({
              where: jest.fn(() =>
                Promise.resolve([
                  {
                    id: 'prod-1',
                    codigo: 'PA',
                    nome: 'Patinho',
                    legadoItemComercialId: 'ic-1',
                  },
                ]),
              ),
            })),
          };
        }
        if (idx === 1) {
          return {
            from: jest.fn(() => ({
              innerJoin: jest.fn(() => ({
                where: jest.fn(() => ({
                  groupBy: jest.fn(() =>
                    Promise.resolve([{ itemComercialId: 'ic-1', total: '5' }]),
                  ),
                })),
              })),
            })),
          };
        }
        if (idx === 2 || idx === 3) {
          return {
            from: jest.fn(() => ({
              where: jest.fn(() => ({
                groupBy: jest.fn(() =>
                  Promise.resolve(
                    idx === 2
                      ? [{ itemComercialId: 'ic-1', total: '1' }]
                      : [{ itemComercialId: 'ic-1', total: '2' }],
                  ),
                ),
              })),
            })),
          };
        }
        return {
          from: jest.fn(() => ({
            innerJoin: jest.fn(() => ({
              where: jest.fn(() => ({
                orderBy: jest.fn(() =>
                  Promise.resolve([
                    { produtoId: 'prod-1', origem: 'TZ', prioridade: 1 },
                  ]),
                ),
              })),
            })),
          })),
        };
      }),
    };

    const service = new FaltasService({ db } as never);
    const faltas = await service.listarFaltas();
    expect(faltas).toHaveLength(1);
    expect(faltas[0]).toMatchObject({
      produto: { codigo: 'PA' },
      quantidadeFaltante: 2,
      quantidadeEstoque: 3,
      origem: 'TZ',
    });
  });

  it('ignora produtos de saída sem item comercial legado vinculado', async () => {
    let selectCall = 0;
    const db = {
      select: jest.fn(() => {
        const idx = selectCall++;
        if (idx === 0) {
          return {
            from: jest.fn(() => ({
              where: jest.fn(() =>
                Promise.resolve([
                  {
                    id: 'prod-x',
                    codigo: 'X',
                    nome: 'Sem legado',
                    legadoItemComercialId: null,
                  },
                ]),
              ),
            })),
          };
        }
        return {
          from: jest.fn(() => ({
            innerJoin: jest.fn(() => ({
              where: jest.fn(() => ({
                orderBy: jest.fn(() => Promise.resolve([])),
              })),
            })),
          })),
        };
      }),
    };

    const service = new FaltasService({ db } as never);
    await expect(service.listarFaltas()).resolves.toEqual([]);
  });
});
