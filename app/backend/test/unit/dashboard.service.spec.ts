import { DashboardService } from '../../src/modules/gestao/dashboard/dashboard.service';

function chain(result: unknown) {
  const terminal: Record<string, unknown> = {};
  const self = () => terminal;
  terminal.then = (cb: (r: unknown) => unknown) => Promise.resolve(result).then(cb as never);
  terminal.where = self;
  terminal.groupBy = self;
  terminal.orderBy = self;
  terminal.limit = () => Promise.resolve(result);
  terminal.innerJoin = self;
  // Promise-like for await of query builders that end without explicit then
  Object.defineProperty(terminal, Symbol.toStringTag, { value: 'Promise' });
  // Make awaitable: if awaited directly after where/groupBy
  (terminal as { then?: unknown }).then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return {
    from: () => terminal,
  };
}

describe('DashboardService', () => {
  function montarResumoBase() {
    let selectCall = 0;
    const db = {
      select: jest.fn(() => {
        const idx = selectCall++;
        if (idx === 1) return chain([]);
        if (idx === 2) return chain([{ total: 0 }]);
        return chain([]);
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
        status: 'em_elaboracao_reserva_ativa',
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
          return chain([
            {
              pedidoId: 'p1',
              status: 'em_elaboracao_reserva_ativa',
              dataOperacao: '2026-06-23',
              clienteNome: null,
              clienteRazao: 'Cliente X',
            },
          ]);
        }
        if (idx === 1) return chain([{ codigo: 'PA', quantidade: '3' }]);
        return chain([{ total: '12.500' }]);
      }),
    };
    const service = new DashboardService({ db } as never);
    const pedidos = await (service as unknown as { listarPedidosEmAndamento: (d: string) => Promise<Array<{ produtoResumo: string; pesoTotalKg: string; clienteNome: string }>> }).listarPedidosEmAndamento(
      '2026-06-23',
    );
    expect(pedidos[0]?.produtoResumo).toContain('PA');
    expect(pedidos[0]?.clienteNome).toBe('Cliente X');
    expect(pedidos[0]?.pesoTotalKg).toBe('12.500');
  });

  it('resume múltiplos itens com +N e peso positivo', async () => {
    let selectCall = 0;
    const db = {
      select: jest.fn(() => {
        const idx = selectCall++;
        if (idx === 0) {
          return chain([
            {
              pedidoId: 'p1',
              status: 'em_elaboracao_reserva_ativa',
              dataOperacao: '2026-06-23',
              clienteNome: 'Loja',
              clienteRazao: 'Loja LTDA',
            },
          ]);
        }
        if (idx === 1) {
          return chain([
            { codigo: 'PA', quantidade: '2' },
            { codigo: 'TZ', quantidade: '1' },
          ]);
        }
        return chain([{ total: '8.000' }]);
      }),
    };
    const service = new DashboardService({ db } as never);
    const pedidos = await (service as unknown as { listarPedidosEmAndamento: (d: string) => Promise<Array<{ produtoResumo: string; pesoTotalKg: string }>> }).listarPedidosEmAndamento(
      '2026-06-23',
    );
    expect(pedidos[0]?.produtoResumo).toMatch(/\+/);
    expect(pedidos[0]?.pesoTotalKg).toBe('8.000');
  });

  it('sem itens no pedido usa traço no resumo', async () => {
    let selectCall = 0;
    const db = {
      select: jest.fn(() => {
        const idx = selectCall++;
        if (idx === 0) {
          return chain([
            {
              pedidoId: 'p1',
              status: 'em_elaboracao_reserva_ativa',
              dataOperacao: '2026-06-23',
              clienteNome: 'Loja',
              clienteRazao: 'Loja',
            },
          ]);
        }
        if (idx === 1) return chain([]);
        return chain([{ total: '0' }]);
      }),
    };
    const service = new DashboardService({ db } as never);
    const pedidos = await (service as unknown as { listarPedidosEmAndamento: (d: string) => Promise<Array<{ produtoResumo: string }>> }).listarPedidosEmAndamento(
      '2026-06-23',
    );
    expect(pedidos[0]?.produtoResumo).toBe('—');
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
