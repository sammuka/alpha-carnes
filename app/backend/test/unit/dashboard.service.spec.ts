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
  Object.defineProperty(terminal, Symbol.toStringTag, { value: 'Promise' });
  (terminal as { then?: unknown }).then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return {
    from: () => terminal,
  };
}

function operacoesMock(operacao = {
  id: 'op1',
  data: '2026-06-23',
  rotulo: 'Operação teste',
  status: 'aberta',
  extraordinaria: false,
}) {
  return {
    resolverCorrente: jest.fn().mockResolvedValue(operacao),
    detalhar: jest.fn().mockResolvedValue(operacao),
  };
}

function kpiRow() {
  return {
    compras_programadas: '1',
    disponibilidade_total: '100.000',
    reservas_em_elaboracao: '0',
    pedidos_finalizados: '0',
    overbookings_abertos: '0',
    recebimentos_aguardados: '0',
    divergencias_abertas: '0',
    pecas_em_desossa: '0',
    relatorios_sif_pendentes: '0',
    faturamentos_pendentes: '0',
  };
}

describe('DashboardService.resumo', () => {
  it('combina KPIs com pedidos em andamento e atividades', async () => {
    const db = {
      execute: jest.fn()
        .mockResolvedValueOnce({ rows: [kpiRow()] })
        .mockResolvedValue({ rows: [{ overbooking: 0, divergencias: 0, tz_aguardando: 0, seguro_pendente: 0 }] }),
      select: jest.fn(() => chain([])),
    };
    const service = new DashboardService({ db } as never, operacoesMock() as never);
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

    const res = await service.resumo();
    expect(res.operacao.id).toBe('op1');
    expect(res.kpis).toHaveLength(10);
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
              clienteNome: null,
              clienteRazao: 'Cliente X',
            },
          ]);
        }
        if (idx === 1) return chain([{ codigo: 'PA', quantidade: '3' }]);
        return chain([{ total: '12.500' }]);
      }),
    };
    const service = new DashboardService({ db } as never, operacoesMock() as never);
    const pedidos = await (service as unknown as {
      listarPedidosEmAndamento: (operacaoId: string, dataOperacao: string) => Promise<Array<{ produtoResumo: string; pesoTotalKg: string; clienteNome: string }>>;
    }).listarPedidosEmAndamento('op1', '2026-06-23');
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
    const service = new DashboardService({ db } as never, operacoesMock() as never);
    const pedidos = await (service as unknown as {
      listarPedidosEmAndamento: (operacaoId: string, dataOperacao: string) => Promise<Array<{ produtoResumo: string; pesoTotalKg: string }>>;
    }).listarPedidosEmAndamento('op1', '2026-06-23');
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
              clienteNome: 'Loja',
              clienteRazao: 'Loja',
            },
          ]);
        }
        if (idx === 1) return chain([]);
        return chain([{ total: '0' }]);
      }),
    };
    const service = new DashboardService({ db } as never, operacoesMock() as never);
    const pedidos = await (service as unknown as {
      listarPedidosEmAndamento: (operacaoId: string, dataOperacao: string) => Promise<Array<{ produtoResumo: string }>>;
    }).listarPedidosEmAndamento('op1', '2026-06-23');
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
    const service = new DashboardService({ db } as never, operacoesMock() as never);
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
