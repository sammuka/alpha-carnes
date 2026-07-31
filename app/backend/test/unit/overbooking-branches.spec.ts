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



  it('historico retorna linhas com autor e ISO date', async () => {

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

              orderBy: () => Promise.resolve([]),

            }),

          }),

        })

        .mockReturnValueOnce({

          from: () => ({

            leftJoin: () => ({

              where: () => ({

                orderBy: () => Promise.resolve([{

                  id: 'h1',

                  acao: 'aberta',

                  autorNome: 'Gestor',

                  detalheJson: {},

                  criadoEm: new Date('2026-08-03T12:00:00Z'),

                }]),

              }),

            }),

          }),

        }),

    };

    const linhas = await service(db).historico('p1');

    expect(linhas[0]?.autorNome).toBe('Gestor');

    expect(linhas[0]?.criadoEm).toBe('2026-08-03T12:00:00.000Z');

  });



  it('cobertura monta compras, redistribuições e próxima operação', async () => {

    const db = {

      select: jest.fn()

        .mockReturnValueOnce({

          from: () => ({

            where: () => Promise.resolve([{

              id: 'p1',

              operacaoId: 'op-1',

              itemComercialId: 'item-1',

              quantidadeDeficit: '2.000',

              pedidoVendaId: 'pv-1',

            }]),

          }),

        })

        .mockReturnValueOnce({

          from: () => ({

            where: () => Promise.resolve([{ id: 'op-1', data: '2026-08-03' }]),

          }),

        })

        .mockReturnValueOnce({

          from: () => ({

            where: () => ({

              orderBy: () => ({

                limit: () => Promise.resolve([{ id: 'op-2', data: '2026-08-04', rotulo: 'D+1' }]),

              }),

            }),

          }),

        }),

      execute: jest.fn()

        .mockResolvedValueOnce({

          rows: [{

            compra_programada_id: 'cp-1',

            operacao_id: 'op-2',

            data: '2026-08-04',

            status: 'planejada',

            quantidade_projetada: '5',

          }],

        })

        .mockResolvedValueOnce({

          rows: [{

            pedido_venda_id: 'pv-2',

            pedido_venda_item_id: 'pvi-2',

            cliente_nome: 'Cliente B',

            quantidade_reservada: '1.500',

            reserva_id: 'res-1',

            disponibilidade_virtual_id: 'dv-1',

          }],

        }),

    };

    const res = await service(db).cobertura('p1');

    expect(res.comprasComplementares).toHaveLength(1);

    expect(res.redistribuicoes[0]?.clienteNome).toBe('Cliente B');

    expect(res.proximaOperacao?.rotulo).toBe('D+1');

  });



  it('cobertura 404 quando operação da pendência não existe', async () => {

    const db = {

      select: jest.fn()

        .mockReturnValueOnce({

          from: () => ({

            where: () => Promise.resolve([{

              id: 'p1',

              operacaoId: 'op-missing',

              itemComercialId: 'item-1',

              quantidadeDeficit: '1.000',

              pedidoVendaId: 'pv-1',

            }]),

          }),

        })

        .mockReturnValueOnce({

          from: () => ({

            where: () => Promise.resolve([]),

          }),

        }),

    };

    await expect(service(db).cobertura('p1')).rejects.toBeInstanceOf(NotFoundException);

  });



  it('decidir rejeita transição inválida', async () => {

    const atual = { id: 'p1', status: 'resolvida', quantidadeDeficit: '1.000' };

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

    await expect(service(db).decidir('p1', {

      caminho: 'compra_complementar',

      compraProgramadaId: 'cp-1',

      quantidade: '1.000',

    }, 'user-1')).rejects.toBeInstanceOf(ConflictException);

  });



  it('decidir rejeita quantidade acima do déficit', async () => {

    const atual = {

      id: 'p1',

      status: 'aberta',

      quantidadeDeficit: '1.000',

      operacaoId: 'op-1',

      pedidoVendaItemId: 'pvi-1',

    };

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

    await expect(service(db).decidir('p1', {

      caminho: 'compra_complementar',

      compraProgramadaId: 'cp-1',

      quantidade: '5.000',

    }, 'user-1')).rejects.toBeInstanceOf(ConflictException);

  });



  it('alterarStatus em_analise emite evento de atualização', async () => {

    const atual = { id: 'p1', status: 'aberta', operacaoId: 'op-1' };

    const atualizada = { id: 'p1', status: 'em_analise', operacaoId: 'op-1' };

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

    await service(db).alterarStatus('p1', 'em_analise', {}, 'user-1');

    expect(emitter.emit).toHaveBeenCalledWith(

      'pendencia_overbooking_atualizada',

      expect.objectContaining({ status: 'em_analise' }),

    );

  });



  function lockRows(rows: unknown[]) {
    const promise = Promise.resolve(rows);
    return Object.assign(promise, {
      limit: () => promise,
    });
  }



  it('decidir redistribuição zera déficit e registra histórico extra', async () => {

    const atual = {

      id: 'p1',

      status: 'aberta',

      operacaoId: 'op-1',

      quantidadeDeficit: '3.000',

      pedidoVendaItemId: 'pvi-def',

      itemComercialId: 'item-1',

      pedidoVendaId: 'pv-1',

      clienteId: 'cli-1',

    };

    const doadora = {

      id: 'res-orig',

      quantidadeReservada: '5.000',

      pedidoVendaItemId: 'pvi-other',

      disponibilidadeVirtualId: 'dv-1',

    };

    const overbooking = {

      id: 'res-ob',

      quantidadeReservada: '3.000',

      pedidoVendaItemId: 'pvi-def',

    };

    const atualizada = { ...atual, status: 'resolvida' };

    let selectN = 0;

    const db = {

      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({

        select: jest.fn(() => ({

          from: () => ({

            where: () => {

              selectN += 1;

              if (selectN === 1) return { for: () => lockRows([atual]) };

              if (selectN === 2) return { for: () => lockRows([doadora]) };

              if (selectN === 3) return { for: () => lockRows([overbooking]) };

              if (selectN === 4) {

                return Promise.resolve([{

                  quantidadeReservada: '2.000',

                  quantidadeDisponivel: '10.000',

                }]);

              }

              return Promise.resolve([{ data: '2026-08-03' }]);

            },

          }),

        })),

        update: jest.fn(() => ({

          set: () => ({

            where: () => ({

              returning: () => Promise.resolve([atualizada]),

            }),

          }),

        })),

        insert: jest.fn(() => ({ values: () => Promise.resolve(undefined) })),

        execute: jest.fn().mockResolvedValue(undefined),

      })),

    };

    const result = await service(db).decidir('p1', {

      caminho: 'redistribuicao',

      reservaOrigemId: 'res-orig',

      quantidade: '3.000',

    }, 'user-1');

    expect(result.status).toBe('resolvida');

    expect(emitter.emit).toHaveBeenCalledWith(

      'pendencia_overbooking_resolvida',

      expect.objectContaining({ pendenciaId: 'p1' }),

    );

  });



  it('decidir novo pedido posterga item e emite eventos do pedido', async () => {

    pedidos.criarNaTx.mockResolvedValue({

      pedido: { id: 'pv-new' },

      eventos: [{ nome: 'pedido_criado', payload: { pedidoId: 'pv-new' } }],

    });

    pedidos.reduzirItemNaTx.mockResolvedValue(undefined);

    const atual = {

      id: 'p1',

      status: 'aberta',

      operacaoId: 'op-1',

      quantidadeDeficit: '2.000',

      pedidoVendaItemId: 'pvi-def',

      itemComercialId: 'item-1',

      pedidoVendaId: 'pv-1',

      clienteId: 'cli-1',

    };

    const atualizada = { ...atual, status: 'resolvida' };

    let selectN = 0;

    const db = {

      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({

        select: jest.fn(() => ({

          from: () => ({

            where: () => {

              selectN += 1;

              if (selectN === 1 || selectN === 6) return { for: () => lockRows([atual]) };

              if (selectN === 2) return Promise.resolve([{ id: 'op-dest', data: '2026-08-10', status: 'aberta' }]);

              if (selectN === 3) return Promise.resolve([{ id: 'op-1', data: '2026-08-03' }]);

              if (selectN === 4) return Promise.resolve([{ id: 'cp-dest' }]);

              if (selectN === 5) return { for: () => lockRows([{ id: 'pvi-def', quantidadePedida: '5.000' }]) };

              return Promise.resolve([{ data: '2026-08-03' }]);

            },

          }),

        })),

        update: jest.fn(() => ({

          set: () => ({

            where: () => ({

              returning: () => Promise.resolve([atualizada]),

            }),

          }),

        })),

        insert: jest.fn(() => ({ values: () => Promise.resolve(undefined) })),

      })),

    };

    const result = await service(db).decidir('p1', {

      caminho: 'novo_pedido',

      operacaoDestinoId: 'op-dest',

      compraProgramadaId: 'cp-dest',

      quantidade: '2.000',

    }, 'user-1');

    expect(result.status).toBe('resolvida');

    expect(pedidos.reduzirItemNaTx).toHaveBeenCalled();

    expect(emitter.emit).toHaveBeenCalledWith('pedido_criado', expect.any(Object));

  });



  it('decidir redistribuição rejeita quantidade acima do saldo da reserva doadora', async () => {

    const atual = {

      id: 'p1', status: 'aberta', operacaoId: 'op-1', quantidadeDeficit: '5.000',

      pedidoVendaItemId: 'pvi-def', itemComercialId: 'item-1', pedidoVendaId: 'pv-1', clienteId: 'c1',

    };

    const doadora = {

      id: 'res-orig', quantidadeReservada: '1.000', pedidoVendaItemId: 'pvi-other',

      disponibilidadeVirtualId: 'dv-1',

    };

    let selectN = 0;

    const db = {

      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({

        select: jest.fn(() => ({

          from: () => ({

            where: () => {

              selectN += 1;

              if (selectN === 1) return { for: () => lockRows([atual]) };

              return { for: () => lockRows([doadora]) };

            },

          }),

        })),

      })),

    };

    await expect(service(db).decidir('p1', {

      caminho: 'redistribuicao', reservaOrigemId: 'res-orig', quantidade: '5.000',

    }, 'user-1')).rejects.toBeInstanceOf(ConflictException);

  });



  it('decidir redistribuição rejeita quantidade acima do overbooking do pedido', async () => {

    const atual = {

      id: 'p1', status: 'aberta', operacaoId: 'op-1', quantidadeDeficit: '5.000',

      pedidoVendaItemId: 'pvi-def', itemComercialId: 'item-1', pedidoVendaId: 'pv-1', clienteId: 'c1',

    };

    const doadora = {

      id: 'res-orig', quantidadeReservada: '10.000', pedidoVendaItemId: 'pvi-other',

      disponibilidadeVirtualId: 'dv-1',

    };

    const overbooking = {

      id: 'res-ob', quantidadeReservada: '2.000', pedidoVendaItemId: 'pvi-def',

    };

    let selectN = 0;

    const db = {

      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({

        select: jest.fn(() => ({

          from: () => ({

            where: () => {

              selectN += 1;

              if (selectN === 1) return { for: () => lockRows([atual]) };

              if (selectN === 2) return { for: () => lockRows([doadora]) };

              return { for: () => lockRows([overbooking]) };

            },

          }),

        })),

      })),

    };

    await expect(service(db).decidir('p1', {

      caminho: 'redistribuicao', reservaOrigemId: 'res-orig', quantidade: '5.000',

    }, 'user-1')).rejects.toBeInstanceOf(ConflictException);

  });



  it('decidir novo pedido rejeita operação de destino anterior à pendência', async () => {

    const atual = {

      id: 'p1', status: 'aberta', operacaoId: 'op-1', quantidadeDeficit: '1.000',

      pedidoVendaItemId: 'pvi-def', itemComercialId: 'item-1', pedidoVendaId: 'pv-1', clienteId: 'c1',

    };

    let selectN = 0;

    const db = {

      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({

        select: jest.fn(() => ({

          from: () => ({

            where: () => {

              selectN += 1;

              if (selectN === 1) return { for: () => lockRows([atual]) };

              if (selectN === 2) return Promise.resolve([{ id: 'op-dest', data: '2026-08-01', status: 'aberta' }]);

              return Promise.resolve([{ id: 'op-1', data: '2026-08-03' }]);

            },

          }),

        })),

      })),

    };

    await expect(service(db).decidir('p1', {

      caminho: 'novo_pedido',

      operacaoDestinoId: 'op-dest',

      compraProgramadaId: 'cp-dest',

      quantidade: '1.000',

    }, 'user-1')).rejects.toBeInstanceOf(ConflictException);

  });



  it('decidir novo pedido rejeita compra inválida na operação de destino', async () => {

    const atual = {

      id: 'p1', status: 'aberta', operacaoId: 'op-1', quantidadeDeficit: '1.000',

      pedidoVendaItemId: 'pvi-def', itemComercialId: 'item-1', pedidoVendaId: 'pv-1', clienteId: 'c1',

    };

    let selectN = 0;

    const db = {

      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({

        select: jest.fn(() => ({

          from: () => ({

            where: () => {

              selectN += 1;

              if (selectN === 1) return { for: () => lockRows([atual]) };

              if (selectN === 2) return Promise.resolve([{ id: 'op-dest', data: '2026-08-10', status: 'aberta' }]);

              if (selectN === 3) return Promise.resolve([{ id: 'op-1', data: '2026-08-03' }]);

              return Promise.resolve([]);

            },

          }),

        })),

      })),

    };

    await expect(service(db).decidir('p1', {

      caminho: 'novo_pedido',

      operacaoDestinoId: 'op-dest',

      compraProgramadaId: 'cp-dest',

      quantidade: '1.000',

    }, 'user-1')).rejects.toBeInstanceOf(ConflictException);

  });



  it('decidir redistribuição rejeita reserva do próprio pedido deficitário', async () => {

    const atual = {

      id: 'p1', status: 'aberta', operacaoId: 'op-1', quantidadeDeficit: '1.000',

      pedidoVendaItemId: 'pvi-def', itemComercialId: 'item-1', pedidoVendaId: 'pv-1', clienteId: 'c1',

    };

    const doadora = {

      id: 'res-orig', quantidadeReservada: '2.000', pedidoVendaItemId: 'pvi-def',

      disponibilidadeVirtualId: 'dv-1',

    };

    let selectN = 0;

    const db = {

      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({

        select: jest.fn(() => ({

          from: () => ({

            where: () => {

              selectN += 1;

              if (selectN === 1) return { for: () => lockRows([atual]) };

              return { for: () => lockRows([doadora]) };

            },

          }),

        })),

      })),

    };

    await expect(service(db).decidir('p1', {

      caminho: 'redistribuicao', reservaOrigemId: 'res-orig', quantidade: '1.000',

    }, 'user-1')).rejects.toBeInstanceOf(ConflictException);

  });



  it('decidir redistribuição rejeita reserva sem disponibilidade virtual', async () => {

    const atual = {

      id: 'p1', status: 'aberta', operacaoId: 'op-1', quantidadeDeficit: '1.000',

      pedidoVendaItemId: 'pvi-def', itemComercialId: 'item-1', pedidoVendaId: 'pv-1', clienteId: 'c1',

    };

    const doadora = {

      id: 'res-orig', quantidadeReservada: '2.000', pedidoVendaItemId: 'pvi-other',

      disponibilidadeVirtualId: null,

    };

    const overbooking = {

      id: 'res-ob', quantidadeReservada: '2.000', pedidoVendaItemId: 'pvi-def',

    };

    let selectN = 0;

    const db = {

      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({

        select: jest.fn(() => ({

          from: () => ({

            where: () => {

              selectN += 1;

              if (selectN === 1) return { for: () => lockRows([atual]) };

              if (selectN === 2) return { for: () => lockRows([doadora]) };

              if (selectN === 3) return { for: () => lockRows([overbooking]) };

              return Promise.resolve([{ quantidadeReservada: '1', quantidadeDisponivel: '1' }]);

            },

          }),

        })),

        update: jest.fn(() => ({ set: () => ({ where: () => Promise.resolve(undefined) }) })),

        insert: jest.fn(() => ({ values: () => Promise.resolve(undefined) })),

        execute: jest.fn().mockResolvedValue(undefined),

      })),

    };

    await expect(service(db).decidir('p1', {

      caminho: 'redistribuicao', reservaOrigemId: 'res-orig', quantidade: '1.000',

    }, 'user-1')).rejects.toBeInstanceOf(ConflictException);

  });



  it('decidir novo pedido remove item quando quantidade zera', async () => {

    pedidos.criarNaTx.mockResolvedValue({ pedido: { id: 'pv-new' }, eventos: [] });

    pedidos.removerItemNaTx.mockResolvedValue(undefined);

    const atual = {

      id: 'p1', status: 'aberta', operacaoId: 'op-1', quantidadeDeficit: '5.000',

      pedidoVendaItemId: 'pvi-def', itemComercialId: 'item-1', pedidoVendaId: 'pv-1', clienteId: 'c1',

    };

    let selectN = 0;

    const db = {

      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({

        select: jest.fn(() => ({

          from: () => ({

            where: () => {

              selectN += 1;

              if (selectN === 1 || selectN === 6) return { for: () => lockRows([atual]) };

              if (selectN === 2) return Promise.resolve([{ id: 'op-dest', data: '2026-08-10', status: 'aberta' }]);

              if (selectN === 3) return Promise.resolve([{ id: 'op-1', data: '2026-08-03' }]);

              if (selectN === 4) return Promise.resolve([{ id: 'cp-dest' }]);

              if (selectN === 5) return { for: () => lockRows([{ id: 'pvi-def', quantidadePedida: '5.000' }]) };

              return Promise.resolve([{ data: '2026-08-03' }]);

            },

          }),

        })),

        update: jest.fn(() => ({

          set: () => ({ where: () => ({ returning: () => Promise.resolve([{ ...atual, status: 'resolvida' }]) }) }),

        })),

        insert: jest.fn(() => ({ values: () => Promise.resolve(undefined) })),

      })),

    };

    await service(db).decidir('p1', {

      caminho: 'novo_pedido',

      operacaoDestinoId: 'op-dest',

      compraProgramadaId: 'cp-dest',

      quantidade: '5.000',

    }, 'user-1');

    expect(pedidos.removerItemNaTx).toHaveBeenCalled();

  });



  it('decidir novo pedido rejeita operação de destino fechada', async () => {

    const atual = {

      id: 'p1', status: 'aberta', operacaoId: 'op-1', quantidadeDeficit: '1.000',

      pedidoVendaItemId: 'pvi-def', itemComercialId: 'item-1', pedidoVendaId: 'pv-1', clienteId: 'c1',

    };

    let selectN = 0;

    const db = {

      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({

        select: jest.fn(() => ({

          from: () => ({

            where: () => {

              selectN += 1;

              if (selectN === 1) return { for: () => lockRows([atual]) };

              return Promise.resolve([{ id: 'op-dest', data: '2026-08-10', status: 'fechada' }]);

            },

          }),

        })),

      })),

    };

    await expect(service(db).decidir('p1', {

      caminho: 'novo_pedido',

      operacaoDestinoId: 'op-dest',

      compraProgramadaId: 'cp-dest',

      quantidade: '1.000',

    }, 'user-1')).rejects.toBeInstanceOf(ConflictException);

  });



  it('decidir compra complementar rejeita compra anterior à operação', async () => {

    const atual = {

      id: 'p1',

      status: 'aberta',

      operacaoId: 'op-1',

      quantidadeDeficit: '1.000',

      itemComercialId: 'item-1',

      pedidoVendaItemId: 'pvi-1',

    };

    const db = {

      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({

        select: jest.fn(() => ({

          from: () => ({

            where: () => ({

              for: () => ({

                limit: () => Promise.resolve([atual]),

              }),

            }),

          }),

        })),

        execute: jest.fn().mockResolvedValue({

          rows: [{

            operacao_id: 'op-0',

            data: '2026-08-01',

            data_pendencia: '2026-08-03',

            gera_item: true,

          }],

        }),

      })),

    };

    await expect(service(db).decidir('p1', {

      caminho: 'compra_complementar',

      compraProgramadaId: 'cp-1',

      quantidade: '1.000',

    }, 'user-1')).rejects.toBeInstanceOf(ConflictException);

  });



  it('decidir compra complementar rejeita compra que não gera o item', async () => {

    const atual = {

      id: 'p1',

      status: 'aberta',

      operacaoId: 'op-1',

      quantidadeDeficit: '1.000',

      itemComercialId: 'item-1',

      pedidoVendaItemId: 'pvi-1',

    };

    const db = {

      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({

        select: jest.fn(() => ({

          from: () => ({

            where: () => ({

              for: () => ({

                limit: () => Promise.resolve([atual]),

              }),

            }),

          }),

        })),

        execute: jest.fn().mockResolvedValue({

          rows: [{

            operacao_id: 'op-2',

            data: '2026-08-04',

            data_pendencia: '2026-08-03',

            gera_item: false,

          }],

        }),

      })),

    };

    await expect(service(db).decidir('p1', {

      caminho: 'compra_complementar',

      compraProgramadaId: 'cp-1',

      quantidade: '1.000',

    }, 'user-1')).rejects.toBeInstanceOf(ConflictException);

  });



  it('cobertura retorna proximaOperacao nula quando não há operação futura', async () => {

    const db = {

      select: jest.fn()

        .mockReturnValueOnce({

          from: () => ({

            where: () => Promise.resolve([{

              id: 'p1',

              operacaoId: 'op-1',

              itemComercialId: 'item-1',

              quantidadeDeficit: '1.000',

              pedidoVendaId: 'pv-1',

            }]),

          }),

        })

        .mockReturnValueOnce({

          from: () => ({

            where: () => Promise.resolve([{ id: 'op-1', data: '2026-08-03' }]),

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

      execute: jest.fn()

        .mockResolvedValueOnce({ rows: [] })

        .mockResolvedValueOnce({ rows: [] }),

    };

    const res = await service(db).cobertura('p1');

    expect(res.proximaOperacao).toBeNull();

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

