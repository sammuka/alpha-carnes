import { calcularCompativeisItem } from '../../src/modules/operacao/pesagem/compatibilidade';

describe('calcularCompativeisItem — preferências', () => {
  it('tolera preferenciasJson nulo e campos com tipos inválidos', async () => {
    const tx = {
      select: jest.fn().mockReturnValue({
        from: () => ({
          innerJoin: () => ({
            innerJoin: () => ({
              where: () => Promise.resolve([
                {
                  pedidoVendaId: 'pv-1',
                  pedidoVendaItemId: 'pvi-1',
                  produtoId: 'ic-1',
                  clienteId: 'cli-1',
                  quantidadePedida: '2.000',
                  quantidadeAtendida: '0.000',
                  prioridade: 1,
                  rotaPrevista: null,
                  preferenciasCliente: null,
                },
                {
                  pedidoVendaId: 'pv-2',
                  pedidoVendaItemId: 'pvi-2',
                  produtoId: 'ic-1',
                  clienteId: 'cli-2',
                  quantidadePedida: '2.000',
                  quantidadeAtendida: '1.000',
                  prioridade: 2,
                  rotaPrevista: 'R1',
                  preferenciasCliente: {
                    faixaPesoMin: '10',
                    faixaPesoMax: '20',
                    perfilGordura: 3,
                  },
                },
              ]),
            }),
          }),
        }),
      }),
    };

    const sugestoes = await calcularCompativeisItem(tx as never, {
      operacaoId: 'op-1',
      compraProgramadaOrigemId: 'cp-1',
      produtoId: 'ic-1',
      peso: '12.500',
    });
    expect(sugestoes.length).toBeGreaterThan(0);
    expect(sugestoes.every((s) => typeof s.score === 'number')).toBe(true);
  });
});
