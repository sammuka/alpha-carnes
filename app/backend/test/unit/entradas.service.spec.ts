/**
 * Testes de branch (mocks, sem DB) para EntradasEstoqueService: listar, compativeis
 * (entrada/produto ausentes, produto sem legadoprodutoId) e compativeisPorProduto
 * (filtros de pedido compatível + cálculo de pendência). `criar` já é exercitado
 * ponta a ponta pelos DoD 8.7/8.8 do e2e; aqui cobrimos os métodos de leitura que o
 * e2e não chama.
 */
import { NotFoundException } from '@nestjs/common';
import { EntradasEstoqueService } from '../../src/modules/operacao/estoque/entradas.service';

function makeChain(rows: unknown[]) {
  const chain: Record<string, unknown> & PromiseLike<unknown[]> = {
    from: () => chain,
    where: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: () => chain,
    then: (resolve: (v: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
  } as never;
  return chain;
}

describe('EntradasEstoqueService — listar/compativeis (branches de leitura)', () => {
  it('listar → monta envelope paginado com total', async () => {
    const linhas = [{ id: 'e1', produtoId: 'p1', produtoNome: 'Caixaria X', quantidade: 5, unidade: 'caixa', destino: 'estoque', operadorNome: 'Op', createdAt: new Date() }];
    let selectCall = 0;
    const responses = [linhas, [{ total: 1 }]];
    const db = { select: jest.fn(() => makeChain(responses[selectCall++] ?? [])) };
    const service = new EntradasEstoqueService({ db } as never, { registrar: jest.fn() } as never, { emit: jest.fn() } as never);

    const resultado = await service.listar({ page: 1, pageSize: 20 } as never);
    expect(resultado.total).toBe(1);
    expect(resultado.data).toEqual(linhas);
  });

  it('compativeis → entrada não encontrada → 404', async () => {
    const db = { select: jest.fn(() => makeChain([])) };
    const service = new EntradasEstoqueService({ db } as never, { registrar: jest.fn() } as never, { emit: jest.fn() } as never);
    await expect(service.compativeis('e-inexistente')).rejects.toThrow(NotFoundException);
  });

  it('compativeis → delega para compativeisPorProduto usando o produtoId da entrada', async () => {
    let selectCall = 0;
    const responses = [
      [{ produtoId: 'prod1' }], // entrada
      [{ legadoprodutoId: null }], // produto sem legado → []
    ];
    const db = { select: jest.fn(() => makeChain(responses[selectCall++] ?? [])) };
    const service = new EntradasEstoqueService({ db } as never, { registrar: jest.fn() } as never, { emit: jest.fn() } as never);

    const resultado = await service.compativeis('e1');
    expect(resultado).toEqual([]);
  });

  it('compativeisPorProduto → produto não encontrado → []', async () => {
    const db = { select: jest.fn(() => makeChain([])) };
    const service = new EntradasEstoqueService({ db } as never, { registrar: jest.fn() } as never, { emit: jest.fn() } as never);
    const resultado = await service.compativeisPorProduto('prod-inexistente');
    expect(resultado).toEqual([]);
  });

  it('compativeisPorProduto → produto sem legadoprodutoId → []', async () => {
    const db = { select: jest.fn(() => makeChain([{ legadoprodutoId: null }])) };
    const service = new EntradasEstoqueService({ db } as never, { registrar: jest.fn() } as never, { emit: jest.fn() } as never);
    const resultado = await service.compativeisPorProduto('prod1');
    expect(resultado).toEqual([]);
  });

  it('compativeisPorProduto → produto compatível retorna pedidos com pendência calculada', async () => {
    let selectCall = 0;
    const responses = [
      [{ legadoprodutoId: 'ic1' }], // produto
      [
        {
          pedidoVendaItemId: 'pvi1', pedidoVendaId: 'pv1', clienteNome: 'Açougue Central',
          quantidadePedida: '10.000', quantidadeAtendida: '4.000',
        },
      ],
    ];
    const db = { select: jest.fn(() => makeChain(responses[selectCall++] ?? [])) };
    const service = new EntradasEstoqueService({ db } as never, { registrar: jest.fn() } as never, { emit: jest.fn() } as never);

    const resultado = await service.compativeisPorProduto('prod1');
    expect(resultado).toEqual([
      { pedidoVendaItemId: 'pvi1', pedidoVendaId: 'pv1', clienteNome: 'Açougue Central', pendencia: '6 pendente(s)' },
    ]);
  });
});
