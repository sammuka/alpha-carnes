import { ConflictException, NotFoundException } from '@nestjs/common';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { OverbookingService } from '../../src/modules/comercial/overbooking/overbooking.service';



describe('OverbookingService — branches', () => {

  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };

  const emitter = { emit: jest.fn() } as unknown as EventEmitter2;

  const pedidos = {

    criarNaTx: jest.fn(),

    reduzirItemNaTx: jest.fn(),

    removerItemNaTx: jest.fn(),

  };



  function service(db: object) {

    return new OverbookingService({ db } as never, auditoria as never, emitter, pedidos as never);

  }



  it('detalhar 404 quando pendência inexistente', async () => {

    const db = {

      select: jest.fn().mockReturnValue({

        from: () => ({ where: () => Promise.resolve([]) }),

      }),

    };

    await expect(service(db).detalhar('019ea000-0000-7000-8000-0000000000bb'))

      .rejects.toBeInstanceOf(NotFoundException);

  });



  it('detalhar retorna histórico ordenado', async () => {

    const db = {

      select: jest.fn()

        .mockReturnValueOnce({

          from: () => ({

            where: () => Promise.resolve([{ id: 'p1', status: 'aberta' }]),

          }),

        })

        .mockReturnValueOnce({

          from: () => ({

            where: () => ({

              orderBy: () => Promise.resolve([{ id: 'h1', acao: 'aberta' }]),

            }),

          }),

        }),

    };

    const result = await service(db).detalhar('p1');

    expect(result.historico).toHaveLength(1);

  });



  it('alterarStatus 404 quando update não retorna linha', async () => {

    const atual = { id: 'p1', status: 'aberta', operacaoId: 'op-1' };

    const db = {

      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({

        select: jest.fn()

          .mockReturnValueOnce({

            from: () => ({

              where: () => ({

                for: () => ({

                  limit: () => Promise.resolve([atual]),

                }),

              }),

            }),

          })

          .mockReturnValueOnce({

            from: () => ({

              where: () => Promise.resolve([{ data: '2026-08-03' }]),

            }),

          }),

        update: jest.fn(() => ({

          set: () => ({

            where: () => ({

              returning: () => Promise.resolve([]),

            }),

          }),

        })),

      })),

    };

    await expect(service(db).alterarStatus('p1', 'em_analise', {}, 'user-1'))

      .rejects.toBeInstanceOf(NotFoundException);

  });



  it('obterAtivaSobLock 404 via decidir em pendência inexistente', async () => {

    const db = {

      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({

        select: jest.fn().mockReturnValue({

          from: () => ({

            where: () => ({

              for: () => ({

                limit: () => Promise.resolve([]),

              }),

            }),

          }),

        }),

      })),

    };

    await expect(service(db).decidir('p-missing', {

      caminho: 'compra_complementar',

      compraProgramadaId: '019ea000-0000-7000-8000-000000000001',

      quantidade: '1.000',

    }, 'user-1'))

      .rejects.toBeInstanceOf(NotFoundException);

  });



  it('listar aplica filtro de status quando informado', async () => {

    const db = {

      select: jest.fn()

        .mockReturnValueOnce({

          from: () => ({

            where: () => ({

              orderBy: () => ({

                limit: () => ({

                  offset: () => Promise.resolve([{ id: 'p1', status: 'aberta' }]),

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

      operacaoId: 'op-1',

      status: 'aberta',

      pagina: 1,

      limite: 20,

    });

    expect(result.data).toHaveLength(1);

    expect(result.total).toBe(1);

  });



  it('listar usa total 0 quando count não retorna linha', async () => {

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

      operacaoId: 'op-1',

      pagina: 1,

      limite: 20,

    });

    expect(result.total).toBe(0);

  });



  it('alterarStatus rejeita transição inválida', async () => {

    const atual = { id: 'p1', status: 'resolvida' };

    const db = {

      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({

        select: jest.fn().mockReturnValue({

          from: () => ({

            where: () => ({

              for: () => ({

                limit: () => Promise.resolve([atual]),

              }),

            }),

          }),

        }),

      })),

    };

    await expect(service(db).alterarStatus('p1', 'aberta', {}, 'user-1'))

      .rejects.toBeInstanceOf(ConflictException);

  });



  it('decidir compra complementar emite evento de atualização', async () => {

    const atual = {

      id: 'p1',

      status: 'aberta',

      operacaoId: 'op-1',

      quantidadeDeficit: '3.000',

      itemComercialId: 'item-1',

      pedidoVendaId: 'pv-1',

      pedidoVendaItemId: 'pvi-1',

      clienteId: 'cli-1',

    };

    const atualizada = {

      ...atual,

      status: 'compra_complementar_programada',

      decisaoJson: { caminho: 'compra_complementar' },

    };

    const db = {

      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({

        select: jest.fn()

          .mockReturnValueOnce({

            from: () => ({

              where: () => ({

                for: () => ({

                  limit: () => Promise.resolve([atual]),

                }),

              }),

            }),

          })

          .mockReturnValueOnce({

            from: () => ({

              where: () => Promise.resolve([{ data: '2026-08-03' }]),

            }),

          }),

        execute: jest.fn().mockResolvedValue({

          rows: [{

            operacao_id: 'op-2',

            data: '2026-08-04',

            data_pendencia: '2026-08-03',

            gera_item: true,

          }],

        }),

        update: jest.fn(() => ({

          set: () => ({

            where: () => ({

              returning: () => Promise.resolve([atualizada]),

            }),

          }),

        })),

        insert: jest.fn(() => ({

          values: () => Promise.resolve(undefined),

        })),

      })),

    };

    const result = await service(db).decidir('p1', {

      caminho: 'compra_complementar',

      compraProgramadaId: '019ea000-0000-7000-8000-000000000002',

      quantidade: '3.000',

    }, 'user-1');

    expect(result.status).toBe('compra_complementar_programada');

    expect(emitter.emit).toHaveBeenCalledWith(

      'pendencia_overbooking_atualizada',

      expect.objectContaining({

        pendenciaId: 'p1',

        operacaoId: 'op-1',

        status: 'compra_complementar_programada',

      }),

    );

  });



  it.each([

    { statusTerminal: 'resolvida' as const, statusAtual: 'compra_complementar_programada' },

    { statusTerminal: 'cancelada' as const, statusAtual: 'em_analise' },

  ])(

    'alterarStatus emite RESOLVIDA no status terminal $statusTerminal com operacaoId e dataOperacao',

    async ({ statusTerminal, statusAtual }) => {

      const atual = { id: 'p1', status: statusAtual, operacaoId: 'op-1' };

      const atualizada = { id: 'p1', status: statusTerminal, operacaoId: 'op-1' };

      const db = {

        transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({

          select: jest.fn()

            .mockReturnValueOnce({

              from: () => ({

                where: () => ({

                  for: () => ({

                    limit: () => Promise.resolve([atual]),

                  }),

                }),

              }),

            })

            .mockReturnValueOnce({

              from: () => ({

                where: () => Promise.resolve([{ data: '2026-08-03' }]),

              }),

            }),

          update: jest.fn(() => ({

            set: () => ({

              where: () => ({

                returning: () => Promise.resolve([atualizada]),

              }),

            }),

          })),

          insert: jest.fn(() => ({

            values: () => Promise.resolve(undefined),

          })),

        })),

      };

      await service(db).alterarStatus('p1', statusTerminal, {}, 'user-1');

      expect(emitter.emit).toHaveBeenCalledWith(

        'pendencia_overbooking_resolvida',

        expect.objectContaining({

          pendenciaId: 'p1',

          operacaoId: 'op-1',

          dataOperacao: '2026-08-03',

          status: statusTerminal,

        }),

      );

    },

  );

});

