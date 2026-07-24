import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PedidoFornecedorService } from '../../src/modules/operacao/recebimento/pedido-fornecedor.service';

describe('PedidoFornecedorService — branches', () => {
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const emitter = { emit: jest.fn() } as unknown as EventEmitter2;

  function service(db: object) {
    return new PedidoFornecedorService({ db } as never, auditoria as never, emitter);
  }

  it('detalhar 404 quando pedido inexistente', async () => {
    const db = {
      select: jest.fn().mockReturnValue({
        from: () => ({ where: () => Promise.resolve([]) }),
      }),
    };
    await expect(service(db).detalhar('019ea000-0000-7000-8000-0000000000cc'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('listar aplica filtro de status', async () => {
    const db = {
      select: jest.fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => ({
                  offset: () => Promise.resolve([{ id: 'pf1' }]),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => Promise.resolve([{ total: 1 }]),
          }),
        }),
    };
    const result = await service(db).listar({
      operacaoId: '019ea000-0000-7000-8000-0000000000op',
      status: 'rascunho',
      pagina: 1,
      limite: 20,
    });
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('listar usa total 0 quando count vem vazio', async () => {
    const db = {
      select: jest.fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => ({
                  offset: () => Promise.resolve([]),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => Promise.resolve([]),
          }),
        }),
    };
    const result = await service(db).listar({
      operacaoId: '019ea000-0000-7000-8000-0000000000op',
      pagina: 1,
      limite: 20,
    });
    expect(result.total).toBe(0);
  });

  it('criar 404 quando compra não existe', async () => {
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        query: {
          comprasProgramadas: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
        },
      })),
    };
    await expect(service(db).criar(
      { compraProgramadaId: '019ea000-0000-7000-8000-0000000000cp' },
      'user-1',
    )).rejects.toBeInstanceOf(NotFoundException);
  });

  it('criar 409 quando compra não confirmada', async () => {
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        query: {
          comprasProgramadas: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'c1', status: 'rascunho', operacaoId: 'op-1',
            }),
          },
        },
      })),
    };
    await expect(service(db).criar(
      { compraProgramadaId: '019ea000-0000-7000-8000-0000000000cp' },
      'user-1',
    )).rejects.toBeInstanceOf(ConflictException);
  });

  it('criar 409 quando compra confirmada sem operação', async () => {
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        query: {
          comprasProgramadas: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'c1', status: 'confirmada', operacaoId: null, numeroInterno: 'CP-1',
            }),
          },
        },
      })),
    };
    await expect(service(db).criar(
      { compraProgramadaId: '019ea000-0000-7000-8000-0000000000cp' },
      'user-1',
    )).rejects.toBeInstanceOf(ConflictException);
  });

  it('criar 409 quando compra sem disponibilidade gerada', async () => {
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        query: {
          comprasProgramadas: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'c1', status: 'confirmada', operacaoId: 'op-1',
              numeroInterno: 'CP-1', fornecedorId: 'f1',
            }),
          },
        },
        select: jest.fn().mockReturnValue({
          from: () => ({ where: () => Promise.resolve([]) }),
        }),
      })),
    };
    await expect(service(db).criar(
      { compraProgramadaId: '019ea000-0000-7000-8000-0000000000cp' },
      'user-1',
    )).rejects.toBeInstanceOf(ConflictException);
  });

  it('enviar 404 quando pedido inexistente', async () => {
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        select: jest.fn().mockReturnValue({
          from: () => ({ where: () => Promise.resolve([]) }),
        }),
      })),
    };
    await expect(service(db).enviar('pf-1', 'user-1'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('enviar 409 em status inválido', async () => {
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        select: jest.fn().mockReturnValue({
          from: () => ({
            where: () => Promise.resolve([{ id: 'pf-1', status: 'cancelado' }]),
          }),
        }),
      })),
    };
    await expect(service(db).enviar('pf-1', 'user-1'))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('registrarNf 404 quando pedido inexistente', async () => {
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        select: jest.fn().mockReturnValue({
          from: () => ({ where: () => Promise.resolve([]) }),
        }),
      })),
    };
    const nfBase = {
      numero: '1',
      serie: '1',
      dataEmissao: '2026-07-01',
      itens: [{ itemComercialId: '019ea000-0000-7000-8000-0000000000ic', quantidadeDeclarada: 1 }],
    };
    await expect(service(db).registrarNf('pf-1', nfBase, 'user-1'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('registrarNf 404 quando recebimentoId não pertence ao pedido', async () => {
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        select: jest.fn()
          .mockReturnValueOnce({
            from: () => ({
              where: () => Promise.resolve([{ id: 'pf-1', status: 'aguardando_recebimento' }]),
            }),
          })
          .mockReturnValueOnce({
            from: () => ({
              where: () => Promise.resolve([]),
            }),
          }),
      })),
    };
    await expect(service(db).registrarNf('pf-1', {
      numero: '1',
      serie: '1',
      dataEmissao: '2026-07-01',
      recebimentoId: '019ea000-0000-7000-8000-0000000000rc',
      itens: [{ itemComercialId: '019ea000-0000-7000-8000-0000000000ic', quantidadeDeclarada: 1 }],
    }, 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('detalhar retorna pedido com itens', async () => {
    const db = {
      select: jest.fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => Promise.resolve([{ id: 'pf-1', status: 'rascunho' }]),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => Promise.resolve([{ id: 'item-1' }]),
          }),
        }),
    };
    const result = await service(db).detalhar('pf-1');
    expect(result.id).toBe('pf-1');
    expect(result.itens).toHaveLength(1);
  });

  it('criar persiste pedido e itens a partir da disponibilidade', async () => {
    const pedido = { id: 'pf-new', operacaoId: 'op-1', numero: 'PF-1' };
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        query: {
          comprasProgramadas: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'c1',
              status: 'confirmada',
              operacaoId: 'op-1',
              numeroInterno: 'CP-1',
              fornecedorId: 'f1',
            }),
          },
        },
        select: jest.fn().mockReturnValue({
          from: () => ({
            where: () => Promise.resolve([
              { itemComercialId: 'ic-1', quantidadePrevista: '10.000' },
            ]),
          }),
        }),
        insert: jest.fn()
          .mockReturnValueOnce({
            values: () => ({
              returning: () => Promise.resolve([pedido]),
            }),
          })
          .mockReturnValueOnce({
            values: () => Promise.resolve(undefined),
          }),
      })),
    };
    const result = await service(db).criar(
      { compraProgramadaId: '019ea000-0000-7000-8000-0000000000cp' },
      'user-1',
    );
    expect(result.id).toBe('pf-new');
    expect(emitter.emit).toHaveBeenCalled();
  });

  it('enviar promove rascunho para aguardando_recebimento', async () => {
    const atualizado = { id: 'pf-1', status: 'aguardando_recebimento' };
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        select: jest.fn().mockReturnValue({
          from: () => ({
            where: () => Promise.resolve([{ id: 'pf-1', status: 'rascunho' }]),
          }),
        }),
        update: jest.fn(() => ({
          set: () => ({
            where: () => ({
              returning: () => Promise.resolve([atualizado]),
            }),
          }),
        })),
      })),
    };
    const result = await service(db).enviar('pf-1', 'user-1');
    expect(result.status).toBe('aguardando_recebimento');
  });

  it('registrarNf resolve recebimento implícito e persiste NF', async () => {
    const nf = { id: 'nf-1', numero: '1' };
    const chainSelect = (rows: unknown[]) => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve(rows),
            then: (cb: (r: unknown[]) => unknown) => cb(rows),
          }),
          then: (cb: (r: unknown[]) => unknown) => cb(rows),
        }),
      }),
    });
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        select: jest.fn()
          .mockReturnValueOnce(chainSelect([{ id: 'pf-1', status: 'aguardando_recebimento' }]))
          .mockReturnValueOnce(chainSelect([{ id: 'rec-1' }]))
          .mockReturnValueOnce(chainSelect([{ id: 'pf-1', status: 'aguardando_recebimento' }]))
          .mockReturnValueOnce(chainSelect([{ id: 'rec-1', pedidoFornecedorId: 'pf-1' }]))
          // buscarCabecalhoParaCompletar: por número + por recebimento (sem órfão)
          .mockReturnValueOnce(chainSelect([]))
          .mockReturnValueOnce(chainSelect([])),
        insert: jest.fn()
          .mockReturnValueOnce({
            values: () => ({
              returning: () => Promise.resolve([nf]),
            }),
          })
          .mockReturnValueOnce({
            values: () => Promise.resolve(undefined),
          }),
      })),
    };
    const result = await service(db).registrarNf('pf-1', {
      numero: '1',
      serie: '1',
      dataEmissao: '2026-07-01',
      pesoTotalDeclarado: 100,
      payload: { origem: 'teste' },
      itens: [{
        itemComercialId: '019ea000-0000-7000-8000-0000000000ic',
        quantidadeDeclarada: 1,
        pesoDeclarado: 10,
      }],
    }, 'user-1');
    expect(result.id).toBe('nf-1');
    expect(emitter.emit).toHaveBeenCalled();
  });

  it('registrarNf 409 quando não há recebimento iniciado', async () => {
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        select: jest.fn()
          .mockReturnValueOnce({
            from: () => ({
              where: () => Promise.resolve([{ id: 'pf-1', status: 'aguardando_recebimento' }]),
            }),
          })
          .mockReturnValueOnce({
            from: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => Promise.resolve([]),
                }),
              }),
            }),
          }),
      })),
    };
    await expect(service(db).registrarNf('pf-1', {
      numero: '1',
      serie: '1',
      dataEmissao: '2026-07-01',
      itens: [{ itemComercialId: '019ea000-0000-7000-8000-0000000000ic', quantidadeDeclarada: 1 }],
    }, 'user-1')).rejects.toBeInstanceOf(ConflictException);
  });
});
