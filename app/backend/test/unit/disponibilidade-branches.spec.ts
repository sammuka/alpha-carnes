import { DisponibilidadeService } from '../../src/modules/comercial/disponibilidade/disponibilidade.service';

describe('DisponibilidadeService — branches', () => {
  function makeChain(rows: unknown[]) {
    const chain: {
      innerJoin: (...args: unknown[]) => typeof chain;
      where: (...args: unknown[]) => typeof chain;
      orderBy: (...args: unknown[]) => Promise<unknown[]>;
      from: (...args: unknown[]) => typeof chain;
    } = {
      innerJoin: () => chain,
      where: () => chain,
      orderBy: () => Promise.resolve(rows),
      from: () => chain,
    };
    return chain;
  }

  it('listar → com dataOperacao e compraProgramadaId aplica os dois filtros', async () => {
    const chain = makeChain([{ id: 'd1' }]);
    const db = { select: jest.fn(() => chain) };
    const service = new DisponibilidadeService({ db } as never, { registrar: jest.fn() } as never);

    const result = await service.listar({ dataOperacao: '2026-06-23', compraProgramadaId: 'cp1' } as never);
    expect(result).toEqual([{ id: 'd1' }]);
  });

  it('listar → sem dataOperacao mas com compraProgramadaId filtra por compra', async () => {
    const chain = makeChain([{ id: 'd2' }]);
    const db = {
      select: jest.fn(() => ({
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve([{ id: 'd2' }]),
          }),
        }),
      })),
    };
    const service = new DisponibilidadeService({ db } as never, { registrar: jest.fn() } as never);

    const result = await service.listar({ compraProgramadaId: 'cp1' } as never);
    expect(result).toEqual([{ id: 'd2' }]);
    expect(db.select).toHaveBeenCalled();
  });

  it('listar → sem dataOperacao e sem compraProgramadaId não filtra', async () => {
    const db = {
      select: jest.fn(() => ({
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve([]),
          }),
        }),
      })),
    };
    const service = new DisponibilidadeService({ db } as never, { registrar: jest.fn() } as never);

    const result = await service.listar({} as never);
    expect(result).toEqual([]);
  });
});
