import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AssociacaoService } from '../../src/modules/operacao/pesagem/associacao.service';
import { calcularCompativeisItem } from '../../src/modules/operacao/pesagem/compatibilidade';
import { consumirSaldo, devolverSaldo } from '../../src/modules/operacao/pesagem/saldo';

jest.mock('../../src/modules/operacao/pesagem/compatibilidade', () => ({
  calcularCompativeisItem: jest.fn(),
}));

jest.mock('../../src/modules/operacao/pesagem/saldo', () => ({
  consumirSaldo: jest.fn(),
  devolverSaldo: jest.fn(),
}));

const calcularMock = calcularCompativeisItem as jest.MockedFunction<typeof calcularCompativeisItem>;
const consumirMock = consumirSaldo as jest.MockedFunction<typeof consumirSaldo>;
const devolverMock = devolverSaldo as jest.MockedFunction<typeof devolverSaldo>;

function pecaBase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pec-1',
    statusPeca: 'pesada',
    compraProgramadaId: 'cp-1',
    itemComercialBaseId: 'ic-1',
    pesoOriginal: '10.000',
    recebimentoId: 'rec-1',
    pedidoVendaId: null,
    pedidoVendaItemId: null,
    observacoes: null,
    deletedAt: null,
    ...overrides,
  };
}

function dbComPeca(peca: ReturnType<typeof pecaBase> | null) {
  const selectFn = jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => Promise.resolve(peca ? [peca] : [])),
      innerJoin: jest.fn(() => ({
        where: jest.fn(() => Promise.resolve([])),
      })),
    })),
  }));
  return {
    select: selectFn,
    transaction: jest.fn(async (cb: (tx: { select: typeof selectFn }) => Promise<unknown>) =>
      cb({ select: selectFn }),
    ),
  };
}

describe('AssociacaoService — branches de erro', () => {
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const divergencias = { abrirNaTx: jest.fn() };
  const emitter = new EventEmitter2();

  beforeEach(() => {
    jest.clearAllMocks();
    calcularMock.mockResolvedValue([]);
    consumirMock.mockResolvedValue(true);
    devolverMock.mockResolvedValue(undefined);
  });

  it('sugerir → NotFoundException se peça não existe', async () => {
    const service = new AssociacaoService({ db: dbComPeca(null) } as never, auditoria as never, emitter, divergencias as never);
    await expect(service.sugerir('pec-x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('listarCompativeis → NotFoundException se peça não existe', async () => {
    const service = new AssociacaoService({ db: dbComPeca(null) } as never, auditoria as never, emitter, divergencias as never);
    await expect(service.listarCompativeis('pec-x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('confirmar → ConflictException se peça já associada', async () => {
    const service = new AssociacaoService(
      { db: dbComPeca(pecaBase({ statusPeca: 'associada' })) } as never,
      auditoria as never,
      emitter,
      divergencias as never,
    );
    await expect(service.confirmar('pec-1', { pedidoVendaItemId: 'pvi-1' } as never, 'op-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('confirmar → ConflictException se saldo do item esgotado', async () => {
    const txSelect = jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() =>
          Promise.resolve([
            pecaBase(),
          ]),
        ),
        innerJoin: jest.fn(() => ({
          where: jest.fn(() =>
            Promise.resolve([
              {
                id: 'pvi-1',
                pedidoVendaId: 'pv-1',
                itemComercialId: 'ic-1',
                compraProgramadaId: 'cp-1',
                statusPedido: 'em_elaboracao_reserva_ativa',
                deletedAt: null,
              },
            ]),
          ),
        })),
      })),
    }));
    const db = {
      transaction: jest.fn(async (cb: (tx: { select: typeof txSelect }) => Promise<unknown>) =>
        cb({ select: txSelect }),
      ),
    };
    consumirMock.mockResolvedValueOnce(false);
    calcularMock.mockResolvedValueOnce([]);

    const service = new AssociacaoService({ db } as never, auditoria as never, emitter, divergencias as never);
    await expect(service.confirmar('pec-1', { pedidoVendaItemId: 'pvi-1' } as never, 'op-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('redirecionar → ConflictException se peça não está associada', async () => {
    const service = new AssociacaoService(
      { db: dbComPeca(pecaBase({ statusPeca: 'pesada' })) } as never,
      auditoria as never,
      emitter,
      divergencias as never,
    );
    await expect(
      service.redirecionar('pec-1', { pedidoVendaItemId: 'pvi-2', motivo: 'ajuste' } as never, 'op-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('redirecionar → ConflictException se destino esgotado', async () => {
    const txSelect = jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => Promise.resolve([pecaBase({ statusPeca: 'associada', pedidoVendaItemId: 'pvi-1', pedidoVendaId: 'pv-1' })])),
        innerJoin: jest.fn(() => ({
          where: jest.fn(() =>
            Promise.resolve([
              {
                id: 'pvi-2',
                pedidoVendaId: 'pv-2',
                itemComercialId: 'ic-1',
                compraProgramadaId: 'cp-1',
                statusPedido: 'em_elaboracao_reserva_ativa',
                deletedAt: null,
              },
            ]),
          ),
        })),
      })),
    }));
    const db = {
      transaction: jest.fn(async (cb: (tx: { select: typeof txSelect }) => Promise<unknown>) =>
        cb({ select: txSelect }),
      ),
    };
    consumirMock.mockResolvedValueOnce(false);

    const service = new AssociacaoService({ db } as never, auditoria as never, emitter, divergencias as never);
    await expect(
      service.redirecionar('pec-1', { pedidoVendaItemId: 'pvi-2', motivo: 'ajuste' } as never, 'op-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('confirmar → NotFoundException se item de pedido não existe', async () => {
    let call = 0;
    const txSelect = jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => {
          call += 1;
          if (call === 1) return Promise.resolve([pecaBase()]);
          return Promise.resolve([]);
        }),
        innerJoin: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([])),
        })),
      })),
    }));
    const db = {
      transaction: jest.fn(async (cb: (tx: { select: typeof txSelect }) => Promise<unknown>) =>
        cb({ select: txSelect }),
      ),
    };

    const service = new AssociacaoService({ db } as never, auditoria as never, emitter, divergencias as never);
    await expect(service.confirmar('pec-1', { pedidoVendaItemId: 'pvi-x' } as never, 'op-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('confirmar → ConflictException se pedido cancelado', async () => {
    const txSelect = jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => Promise.resolve([pecaBase()])),
        innerJoin: jest.fn(() => ({
          where: jest.fn(() =>
            Promise.resolve([
              {
                id: 'pvi-1',
                pedidoVendaId: 'pv-1',
                itemComercialId: 'ic-1',
                compraProgramadaId: 'cp-1',
                statusPedido: 'cancelado',
                deletedAt: null,
              },
            ]),
          ),
        })),
      })),
    }));
    const db = {
      transaction: jest.fn(async (cb: (tx: { select: typeof txSelect }) => Promise<unknown>) =>
        cb({ select: txSelect }),
      ),
    };

    const service = new AssociacaoService({ db } as never, auditoria as never, emitter, divergencias as never);
    await expect(service.confirmar('pec-1', { pedidoVendaItemId: 'pvi-1' } as never, 'op-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('confirmar → ConflictException se item incompatível', async () => {
    const txSelect = jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => Promise.resolve([pecaBase()])),
        innerJoin: jest.fn(() => ({
          where: jest.fn(() =>
            Promise.resolve([
              {
                id: 'pvi-1',
                pedidoVendaId: 'pv-1',
                itemComercialId: 'ic-outro',
                compraProgramadaId: 'cp-1',
                statusPedido: 'em_elaboracao_reserva_ativa',
                deletedAt: null,
              },
            ]),
          ),
        })),
      })),
    }));
    const db = {
      transaction: jest.fn(async (cb: (tx: { select: typeof txSelect }) => Promise<unknown>) =>
        cb({ select: txSelect }),
      ),
    };

    const service = new AssociacaoService({ db } as never, auditoria as never, emitter, divergencias as never);
    await expect(service.confirmar('pec-1', { pedidoVendaItemId: 'pvi-1' } as never, 'op-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('confirmar → ConflictException se pedido é de outra compra', async () => {
    const txSelect = jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => Promise.resolve([pecaBase()])),
        innerJoin: jest.fn(() => ({
          where: jest.fn(() =>
            Promise.resolve([
              {
                id: 'pvi-1',
                pedidoVendaId: 'pv-1',
                itemComercialId: 'ic-1',
                compraProgramadaId: 'cp-outra',
                statusPedido: 'em_elaboracao_reserva_ativa',
                deletedAt: null,
              },
            ]),
          ),
        })),
      })),
    }));
    const db = {
      transaction: jest.fn(async (cb: (tx: { select: typeof txSelect }) => Promise<unknown>) =>
        cb({ select: txSelect }),
      ),
    };

    const service = new AssociacaoService({ db } as never, auditoria as never, emitter, divergencias as never);
    await expect(service.confirmar('pec-1', { pedidoVendaItemId: 'pvi-1' } as never, 'op-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('semCobertura destina peça para sobra', async () => {
    const peca = pecaBase({
      statusPeca: 'associada',
      pedidoVendaId: 'pv-1',
      pedidoVendaItemId: 'pvi-1',
    });
    const atualizada = { ...peca, statusPeca: 'em_sobra', pedidoVendaId: null, pedidoVendaItemId: null };
    const tx = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([peca])),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([atualizada])),
          })),
        })),
      })),
      insert: jest.fn(() => ({
        values: jest.fn().mockResolvedValue(undefined),
      })),
    };
    const db = {
      transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    };

    const service = new AssociacaoService({ db } as never, auditoria as never, emitter, divergencias as never);
    const res = await service.semCobertura('pec-1', { destino: 'sobra', motivo: 'sem pedido' } as never, 'op-1');
    expect(res.statusPeca).toBe('em_sobra');
    expect(devolverMock).toHaveBeenCalledWith(expect.anything(), 'pvi-1');
  });

  it('semCobertura destina peça para corte mantendo vínculo', async () => {
    const peca = pecaBase({
      statusPeca: 'associada',
      pedidoVendaId: 'pv-1',
      pedidoVendaItemId: 'pvi-1',
    });
    const atualizada = { ...peca, statusPeca: 'para_corte' };
    const tx = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([peca])),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([atualizada])),
          })),
        })),
      })),
      insert: jest.fn(() => ({
        values: jest.fn().mockResolvedValue(undefined),
      })),
    };
    const db = {
      transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    };

    const service = new AssociacaoService({ db } as never, auditoria as never, emitter, divergencias as never);
    const res = await service.semCobertura('pec-1', { destino: 'corte', motivo: 'desossa' } as never, 'op-1');
    expect(res.statusPeca).toBe('para_corte');
    expect(res.pedidoVendaItemId).toBe('pvi-1');
  });
});
