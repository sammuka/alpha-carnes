import { DashboardService } from '../../src/modules/gestao/dashboard/dashboard.service';

describe('DashboardService', () => {
  function montarResumoBase() {
    let selectCall = 0;
    const db = {
      select: jest.fn(() => {
        const idx = selectCall++;
        if (idx === 1) {
          return {
            from: jest.fn(() => ({
              where: jest.fn(() => ({
                groupBy: jest.fn(() => Promise.resolve([])),
              })),
            })),
          };
        }
        if (idx === 2) {
          return {
            from: jest.fn(() => ({
              innerJoin: jest.fn(() => ({
                where: jest.fn(() => Promise.resolve([{ total: 0 }])),
              })),
            })),
          };
        }
        return {
          from: jest.fn(() => ({
            where: jest.fn(() => Promise.resolve([])),
          })),
        };
      }),
    };
    return new DashboardService({ db } as never);
  }

  it('combina agregações com pedidos em andamento e atividades', async () => {
    const service = montarResumoBase();
    jest.spyOn(service as unknown as { listarPedidosEmAndamento: () => Promise<unknown> }, 'listarPedidosEmAndamento').mockResolvedValue([
      {
        pedidoId: 'p1',
        clienteNome: 'Loja',
        produtoResumo: 'DIANT +1',
        pesoTotalKg: '15.500',
        status: 'reservado',
        dataOperacao: '2026-06-23',
      },
    ]);
    jest.spyOn(service as unknown as { listarAtividadesRecentes: () => Promise<unknown> }, 'listarAtividadesRecentes').mockResolvedValue([
      {
        id: 'a1',
        usuarioNome: 'Ana',
        descricao: 'criou registro em pedidos_venda (comercial)',
        createdAt: '2026-06-23T12:00:00Z',
      },
    ]);

    const res = await service.resumoDia('2026-06-23');
    expect(res.pedidosEmAndamento).toHaveLength(1);
    expect(res.atividadesRecentes[0]?.descricao).toContain('criou');
  });
});

describe('DashboardService.listarPedidosEmAndamento', () => {
  it('resume produto, peso e cliente', async () => {
    let selectCall = 0;
    const db = {
      select: jest.fn(() => {
        const idx = selectCall++;
        if (idx === 0) {
          return {
            from: jest.fn(() => ({
              innerJoin: jest.fn(() => ({
                where: jest.fn(() => ({
                  orderBy: jest.fn(() => ({
                    limit: jest.fn(() =>
                      Promise.resolve([
                        {
                          pedidoId: 'p1',
                          status: 'reservado',
                          dataOperacao: '2026-06-23',
                          clienteNome: null,
                          clienteRazao: 'Cliente X',
                        },
                      ]),
                    ),
                  })),
                })),
              })),
            })),
          };
        }
        if (idx === 1) {
          return {
            from: jest.fn(() => ({
              innerJoin: jest.fn(() => ({
                where: jest.fn(() => Promise.resolve([{ codigo: 'PA', quantidade: '3' }])),
              })),
            })),
          };
        }
        return {
          from: jest.fn(() => ({
            where: jest.fn(() => Promise.resolve([{ total: '0' }])),
          })),
        };
      }),
    };
    const service = new DashboardService({ db } as never);
    const pedidos = await (service as unknown as { listarPedidosEmAndamento: (d: string) => Promise<unknown> }).listarPedidosEmAndamento(
      '2026-06-23',
    );
    expect(pedidos).toEqual([
      expect.objectContaining({
        produtoResumo: 'PA (3)',
        pesoTotalKg: null,
        clienteNome: 'Cliente X',
      }),
    ]);
  });

  it('resume múltiplos itens com +N e peso positivo', async () => {
    let selectCall = 0;
    const db = {
      select: jest.fn(() => {
        const idx = selectCall++;
        if (idx === 0) {
          return {
            from: jest.fn(() => ({
              innerJoin: jest.fn(() => ({
                where: jest.fn(() => ({
                  orderBy: jest.fn(() => ({
                    limit: jest.fn(() =>
                      Promise.resolve([
                        {
                          pedidoId: 'p2',
                          status: 'reservado',
                          dataOperacao: '2026-06-23',
                          clienteNome: 'Loja',
                          clienteRazao: null,
                        },
                      ]),
                    ),
                  })),
                })),
              })),
            })),
          };
        }
        if (idx === 1) {
          return {
            from: jest.fn(() => ({
              innerJoin: jest.fn(() => ({
                where: jest.fn(() =>
                  Promise.resolve([
                    { codigo: 'PA', quantidade: '1' },
                    { codigo: 'PB', quantidade: '2' },
                  ]),
                ),
              })),
            })),
          };
        }
        return {
          from: jest.fn(() => ({
            where: jest.fn(() => Promise.resolve([{ total: '25.500' }])),
          })),
        };
      }),
    };
    const service = new DashboardService({ db } as never);
    const pedidos = await (service as unknown as { listarPedidosEmAndamento: (d: string) => Promise<unknown> }).listarPedidosEmAndamento(
      '2026-06-23',
    );
    expect(pedidos).toEqual([
      expect.objectContaining({
        produtoResumo: 'PA +1',
        pesoTotalKg: '25.500',
        clienteNome: 'Loja',
      }),
    ]);
  });

  it('sem itens no pedido usa traço no resumo', async () => {
    let selectCall = 0;
    const db = {
      select: jest.fn(() => {
        const idx = selectCall++;
        if (idx === 0) {
          return {
            from: jest.fn(() => ({
              innerJoin: jest.fn(() => ({
                where: jest.fn(() => ({
                  orderBy: jest.fn(() => ({
                    limit: jest.fn(() =>
                      Promise.resolve([
                        {
                          pedidoId: 'p3',
                          status: 'rascunho',
                          dataOperacao: '2026-06-23',
                          clienteNome: null,
                          clienteRazao: null,
                        },
                      ]),
                    ),
                  })),
                })),
              })),
            })),
          };
        }
        if (idx === 1) {
          return {
            from: jest.fn(() => ({
              innerJoin: jest.fn(() => ({
                where: jest.fn(() => Promise.resolve([])),
              })),
            })),
          };
        }
        return {
          from: jest.fn(() => ({
            where: jest.fn(() => Promise.resolve([{ total: '0' }])),
          })),
        };
      }),
    };
    const service = new DashboardService({ db } as never);
    const pedidos = (await (service as unknown as { listarPedidosEmAndamento: (d: string) => Promise<unknown[]> }).listarPedidosEmAndamento(
      '2026-06-23',
    )) as Array<{ produtoResumo: string; clienteNome: string; pesoTotalKg: string | null }>;
    expect(pedidos[0]).toEqual(
      expect.objectContaining({
        produtoResumo: '—',
        clienteNome: '—',
        pesoTotalKg: null,
      }),
    );
  });
});

describe('DashboardService.listarAtividadesRecentes', () => {
  it('humaniza operações e usa fallback de usuário', async () => {
    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          leftJoin: jest.fn(() => ({
            where: jest.fn(() => ({
              orderBy: jest.fn(() => ({
                limit: jest.fn(() =>
                  Promise.resolve([
                    {
                      id: 'a4',
                      tabela: 'compras_programadas',
                      operacao: 'INSERT',
                      modulo: 'comercial',
                      usuarioNome: 'Dana',
                      createdAt: new Date('2026-06-23T16:00:00Z'),
                    },
                    {
                      id: 'a1',
                      tabela: 'pecas',
                      operacao: 'DELETE',
                      modulo: null,
                      usuarioNome: null,
                      createdAt: new Date('2026-06-23T13:00:00Z'),
                    },
                    {
                      id: 'a2',
                      tabela: 'recebimentos',
                      operacao: 'UPDATE',
                      modulo: 'operacao',
                      usuarioNome: 'Bob',
                      createdAt: new Date('2026-06-23T14:00:00Z'),
                    },
                    {
                      id: 'a3',
                      tabela: 'logs',
                      operacao: 'ACAO_MANUAL',
                      modulo: 'gestao',
                      usuarioNome: 'Carla',
                      createdAt: new Date('2026-06-23T15:00:00Z'),
                    },
                  ]),
                ),
              })),
            })),
          })),
        })),
      })),
    };
    const service = new DashboardService({ db } as never);
    const atividades = await (service as unknown as { listarAtividadesRecentes: (d: string) => Promise<unknown> }).listarAtividadesRecentes(
      '2026-06-23',
    );
    expect(atividades).toEqual([
      expect.objectContaining({ descricao: expect.stringContaining('criou') }),
      expect.objectContaining({ usuarioNome: 'Sistema', descricao: expect.stringContaining('removeu') }),
      expect.objectContaining({ descricao: expect.stringContaining('alterou') }),
      expect.objectContaining({ descricao: expect.stringContaining('acao_manual') }),
    ]);
  });
});
