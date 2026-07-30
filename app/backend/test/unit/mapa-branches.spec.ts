import { MapaService } from '../../src/modules/comercial/disponibilidade/mapa.service';

function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    groupBy: () => chain,
    orderBy: () => chain,
    then: (cb: (r: unknown[]) => unknown) => cb(rows),
  };
  return chain;
}

describe('MapaService — branches', () => {
  function makeService(executeRows: unknown[][], catalogo: unknown[]) {
    let call = 0;
    const db = {
      execute: jest.fn(async () => ({ rows: executeRows[call++] ?? [] })),
      select: jest.fn(() => makeSelectChain(catalogo)),
    };
    return new MapaService({ db } as never);
  }

  it('consultar sem itemComercialId retorna todo o catálogo ativo', async () => {
    const service = makeService(
      Array(8).fill([]),
      [{ itemComercialId: 'ic1', codigo: 'TZ', descricao: 'Traseiro', provisorio: false }],
    );
    const mapa = await service.consultar('op1');
    expect(mapa).toHaveLength(1);
    expect(mapa[0]?.saldoComercial).toBe('0.000');
  });

  it('consultar com itemComercialId filtra o catálogo', async () => {
    const service = makeService(
      Array(8).fill([]),
      [{ itemComercialId: 'ic1', codigo: 'TZ', descricao: 'Traseiro', provisorio: false }],
    );
    await service.consultar('op1', 'ic1');
    expect((service as unknown as { db: { select: jest.Mock } }).db.select).toHaveBeenCalled();
  });

  it('detalhar delega para o ramo correto de cada estado', async () => {
    const service = makeService([], []);
    const detalharPecas = jest.spyOn(service as never, 'detalharPecas' as never).mockResolvedValue([] as never);
    const detalharVirtual = jest.spyOn(service as never, 'detalharVirtual' as never).mockResolvedValue([] as never);
    const detalharExpedido = jest.spyOn(service as never, 'detalharExpedido' as never).mockResolvedValue([] as never);
    const detalharReservas = jest.spyOn(service as never, 'detalharReservas' as never).mockResolvedValue([] as never);

    await service.detalhar('op1', 'ic1', 'F');
    await service.detalhar('op1', 'ic1', 'D');
    await service.detalhar('op1', 'ic1', '!');
    await service.detalhar('op1', 'ic1', 'V');
    await service.detalhar('op1', 'ic1', 'E');
    await service.detalhar('op1', 'ic1', 'R');
    await service.detalhar('op1', 'ic1', 'C');
    await service.detalhar('op1', 'ic1', 'O');

    expect(detalharPecas).toHaveBeenCalledTimes(3);
    expect(detalharVirtual).toHaveBeenCalledTimes(1);
    expect(detalharExpedido).toHaveBeenCalledTimes(1);
    expect(detalharReservas).toHaveBeenCalledTimes(3);
  });
});
