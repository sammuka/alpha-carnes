import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  desafiosParaChallenge,
  enriquecerDesafiosComProdutos,
  PedidosService,
} from '../../src/modules/comercial/pedidos/pedidos.service';

function chain(rows: unknown[]) {
  const obj: Record<string, unknown> = {
    from: () => obj,
    leftJoin: () => obj,
    innerJoin: () => obj,
    where: () => obj,
    orderBy: () => obj,
    for: () => obj,
    limit: () => obj,
    offset: () => obj,
    then: (resolve: (r: unknown[]) => unknown) => resolve(rows),
  };
  return obj;
}

describe('PedidosService — branches', () => {
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const emitter = new EventEmitter2();
  jest.spyOn(emitter, 'emit').mockReturnValue(true);
  const operacoesService = { encontrarAtivaPorData: jest.fn(), garantirOperacao: jest.fn() };
  const precos = {
    resolverPrecoVigente: jest.fn().mockResolvedValue({
      preco: '18.50',
      unidadePreco: 'kg',
      tabelaPrecoId: 't1',
    }),
  };

  function makeService(db: Record<string, unknown>) {
    return new PedidosService(
      { db } as never,
      auditoria as never,
      emitter,
      operacoesService as never,
      precos as never,
    );
  }

  beforeEach(() => jest.clearAllMocks());

  it('listar → incluirRemovidos=true e sem total usa 0', async () => {
    const db = { select: jest.fn(() => chain([])) };
    const service = makeService(db);
    const result = await service.listar(
      { page: 1, pageSize: 20, incluirRemovidos: true } as never,
      'user-1',
    );
    expect(result.total).toBe(0);
    expect(result.data).toEqual([]);
  });

  it('planejarSobLock → lança 400 se item comercial duplicado', async () => {
    const tx = { execute: jest.fn() };
    const service = makeService({});
    await expect(
      service.planejarSobLock(tx as never, null, [
        { produtoId: 'ic1', quantidade: 5 },
        { produtoId: 'ic1', quantidade: 3 },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('incluirItem → lança 409 se pedido cancelado', async () => {
    const pedido = { id: 'p1', status: 'cancelado', operacaoId: 'op1', deletedAt: null };
    const tx = { select: jest.fn(() => chain([pedido])) };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    await expect(
      service.incluirItem('p1', { produtoId: 'ic1', quantidade: 5 } as never, 'u1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('reduzirReservaOverbooking → lança 409 se reserva de overbooking ativa não encontrada', async () => {
    const tx = { select: jest.fn(() => chain([])) };
    const service = makeService({});
    await expect(service.reduzirReservaOverbooking(tx as never, 'item1', '1.000')).rejects.toBeInstanceOf(ConflictException);
  });

  it('atualizarOuCancelarPendencia → lança 409 se pendência ativa não encontrada', async () => {
    const tx = { select: jest.fn(() => chain([])) };
    const service = makeService({});
    await expect(
      service.atualizarOuCancelarPendencia(tx as never, 'item1', '1.000', 'u1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('liberarReservaReal → lança Error se reserva real está sem disponibilidade vinculada', async () => {
    const reservaSemVinculo = { id: 'res1', disponibilidadeVirtualId: null, quantidadeReservada: '5.000' };
    const tx = { select: jest.fn(() => chain([reservaSemVinculo])) };
    const service = makeService({});
    await expect(service.liberarReservaReal(tx as never, 'item1', '5.000')).rejects.toThrow('sem disponibilidade');
  });

  it('liberarReservaReal → lança 409 se reserva real é insuficiente para a redução', async () => {
    const reserva = { id: 'res1', disponibilidadeVirtualId: 'd1', quantidadeReservada: '2.000' };
    const tx = {
      select: jest.fn(() => chain([reserva])),
      execute: jest.fn().mockResolvedValue({ rows: [{ quantidade_reservada: '0.000', quantidade_disponivel: '2.000' }] }),
      update: jest.fn(() => ({ set: () => ({ where: () => Promise.resolve(undefined) }) })),
    };
    const service = makeService({});
    await expect(service.liberarReservaReal(tx as never, 'item1', '5.000')).rejects.toBeInstanceOf(ConflictException);
  });

  it('liberarReservaReal → interrompe o laço quando o restante zera antes de esgotar as reservas', async () => {
    const reservaGrande = { id: 'res1', disponibilidadeVirtualId: 'd1', quantidadeReservada: '10.000' };
    const reservaExtra = { id: 'res2', disponibilidadeVirtualId: 'd2', quantidadeReservada: '3.000' };
    const tx = {
      select: jest.fn(() => chain([reservaGrande, reservaExtra])),
      execute: jest.fn().mockResolvedValue({ rows: [{ quantidade_reservada: '5.000', quantidade_disponivel: '5.000' }] }),
      update: jest.fn(() => ({ set: () => ({ where: () => Promise.resolve(undefined) }) })),
    };
    const service = makeService({});
    await expect(service.liberarReservaReal(tx as never, 'item1', '5.000')).resolves.toBeUndefined();
    // apenas 1 update de reserva (a segunda nunca é processada — laço interrompido)
    expect(tx.update).toHaveBeenCalledTimes(1);
  });

  it('cancelarPedido → lança 409 se já cancelado', async () => {
    const pedido = { id: 'p1', status: 'cancelado', deletedAt: null };
    const tx = { select: jest.fn(() => chain([pedido])) };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    await expect(service.cancelarPedido('p1', 'motivo', 'u1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('finalizar → lança 409 se pedido cancelado', async () => {
    const pedido = { id: 'p1', status: 'cancelado', deletedAt: null };
    const tx = { select: jest.fn(() => chain([pedido])) };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    await expect(service.finalizar('p1', 'u1')).rejects.toThrow('Pedido cancelado');
  });

  it('finalizar → lança 409 se pedido já finalizado', async () => {
    const pedido = { id: 'p1', status: 'finalizado', deletedAt: null };
    const tx = { select: jest.fn(() => chain([pedido])) };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    await expect(service.finalizar('p1', 'u1')).rejects.toThrow('Pedido já finalizado');
  });

  it('cancelarPedido → lança 404 se pedido não encontrado (obterPedidoAtivoSobLock)', async () => {
    const tx = { select: jest.fn(() => chain([])) };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    await expect(service.cancelarPedido('p-x', 'motivo', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removerItem → lança 404 se item não encontrado (obterItemAtivoSobLock)', async () => {
    const tx = { select: jest.fn(() => chain([])) };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    await expect(
      service.removerItem('p1', 'item-x', { motivo: 'x' } as never, 'u1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('criar → reutiliza operação já existente na data (não chama garantirOperacao)', async () => {
    operacoesService.encontrarAtivaPorData.mockResolvedValue({ id: 'op-existente' });
    const pedidoInserido = { id: 'p1', operacaoId: 'op-existente', clienteId: 'c1', status: 'em_elaboracao_reserva_ativa' };
    const tx = {
      execute: jest.fn().mockResolvedValue({ rows: [] }),
      // 1ª: exigirClienteNoEscopo; 2ª: exigirUnicidadeAd03. rotaId omitido + cliente sem rota → sem SELECT extra.
      select: jest.fn()
        .mockImplementationOnce(() => chain([{ id: 'c1', representanteId: null, rotaId: null }]))
        .mockImplementationOnce(() => chain([]))
        .mockImplementation(() => chain([{ faixaPreco: 'A', data: '2026-06-23' }])),
      insert: jest.fn(() => ({ values: () => ({ returning: jest.fn(async () => [pedidoInserido]) }) })),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    const result = await service.criar({ itens: [], dataOperacao: '2026-06-23' } as never, 'u1');
    expect(result).toEqual(pedidoInserido);
    expect(operacoesService.garantirOperacao).not.toHaveBeenCalled();
  });

  it('persistirItensPlanejados → lança 409 se overbooking exige operação e pedido não tem uma', async () => {
    const pedido = { id: 'p1', operacaoId: null, clienteId: 'c1' };
    const tx = {
      insert: jest.fn(() => ({ values: () => ({ returning: jest.fn(async () => [{ id: 'item1' }]) }) })),
      select: jest.fn(() => chain([{ faixaPreco: 'A' }])),
    };
    const plano = [{
      produtoId: 'ic1',
      quantidadeSolicitada: '5.000',
      disponivelAntes: '0.000',
      coberturas: [],
      deficit: '5.000',
    }];
    const service = makeService({});
    await expect(
      service.persistirItensPlanejados(
        tx as never,
        pedido as never,
        [{ produtoId: 'ic1', quantidade: 5 }],
        plano,
        'u1',
      ),
    ).rejects.toThrow('Pedido sem operação');
  });

  it('detalhar → 404 quando pedido some após escopo; heranca null quando select vazio', async () => {
    const pedidoEscopo = { id: 'p1', clienteId: 'c1', status: 'em_elaboracao_reserva_ativa', deletedAt: null };
    const tx = { select: jest.fn(() => chain([pedidoEscopo])) };
    const db404 = {
      transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)),
      query: { pedidosVenda: { findFirst: jest.fn().mockResolvedValue(undefined) } },
    };
    await expect(makeService(db404).detalhar('p1', 'u1')).rejects.toBeInstanceOf(NotFoundException);

    const pedido = { id: 'p1', clienteId: 'c1', status: 'em_elaboracao_reserva_ativa', itens: [] };
    const dbHeranca = {
      transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)),
      query: { pedidosVenda: { findFirst: jest.fn().mockResolvedValue(pedido) } },
      select: jest.fn(() => chain([])),
    };
    await expect(makeService(dbHeranca).detalhar('p1', 'u1')).resolves.toMatchObject({
      id: 'p1',
      heranca: null,
    });
  });

  it('buscarAberto → null quando não há pedido aberto no escopo', async () => {
    operacoesService.encontrarAtivaPorData.mockResolvedValue({ id: 'op1' });
    const tx = { select: jest.fn(() => chain([])) };
    const db = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)) };
    const service = makeService(db);
    await expect(service.buscarAberto({
      clienteId: 'c1',
      produtoId: 'ic1',
      dataOperacao: '2026-08-01',
    }, 'u1')).resolves.toBeNull();
  });

  it('criar → 404 se cliente fora do escopo (exigirClienteNoEscopo)', async () => {
    const tx = { select: jest.fn(() => chain([])) };
    const db = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)) };
    await expect(
      makeService(db).criar({ itens: [], dataOperacao: '2026-06-23', clienteId: 'c-x' } as never, 'u1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('carregarAbertoParaAdendo → 409 se status não é aberto', async () => {
    const pedidoFechado = { id: 'p1', status: 'finalizado', deletedAt: null, clienteId: 'c1' };
    const tx = { select: jest.fn(() => chain([pedidoFechado])) };
    const service = makeService({});
    await expect(
      service.carregarAbertoParaAdendo(tx as never, 'p1', 'u1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('exigirItemDoPedido → 404 se item comercial não está no pedido', async () => {
    const pedido = { id: 'p1', status: 'em_elaboracao_reserva_ativa', deletedAt: null, clienteId: 'c1' };
    const tx = {
      select: jest.fn()
        .mockImplementationOnce(() => chain([pedido]))
        .mockImplementationOnce(() => chain([])),
    };
    const service = makeService({});
    await expect(
      service.exigirItemDoPedido(tx as never, 'p1', 'ic-x', 'u1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('finalizar → 409 quando unique uq_ocorr_ajuste_preco_pedido (via cause)', async () => {
    const db = {
      transaction: jest.fn().mockRejectedValue({
        cause: { code: '23505', constraint: 'uq_ocorr_ajuste_preco_pedido' },
      }),
    };
    await expect(makeService(db).finalizar('p1', 'u1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('persistirItensPlanejados → 409 se cliente sem faixa de preço', async () => {
    const pedido = { id: 'p1', operacaoId: 'op1', clienteId: 'c1' };
    const tx = { select: jest.fn(() => chain([{ faixaPreco: null }])) };
    const service = makeService({});
    await expect(
      service.persistirItensPlanejados(
        tx as never,
        pedido as never,
        [{ produtoId: 'ic1', quantidade: 1 }],
        [{ produtoId: 'ic1', quantidadeSolicitada: '1.000', disponivelAntes: '1.000', coberturas: [], deficit: '0.000' }],
        'u1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('desafiosParaChallenge e enriquecerDesafiosComProdutos cobrem filtro e match', async () => {
    expect(desafiosParaChallenge([
      { produtoId: 'p1', quantidadeSolicitada: '1', disponivelAntes: '1', coberturas: [], deficit: '0' },
      { produtoId: 'p2', quantidadeSolicitada: '2', disponivelAntes: '0', coberturas: [], deficit: '2.000' },
    ])).toHaveLength(1);

    await expect(enriquecerDesafiosComProdutos({} as never, [])).resolves.toEqual([]);

    const tx = {
      select: jest.fn(() => chain([{ id: 'p2', codigo: 'TZ', nome: 'Traseiro' }])),
    };
    const enriquecido = await enriquecerDesafiosComProdutos(tx as never, [
      { produtoId: 'p2', produtoCodigo: null, produtoNome: null, disponivelAntes: '0', quantidadeSolicitada: '2', overbookingGerado: '2', mensagem: 'x' },
      { produtoId: 'p-miss', produtoCodigo: null, produtoNome: null, disponivelAntes: '0', quantidadeSolicitada: '1', overbookingGerado: '1', mensagem: 'x' },
    ]);
    expect(enriquecido[0]).toMatchObject({ produtoCodigo: 'TZ', produtoNome: 'Traseiro' });
    expect(enriquecido[1]).toMatchObject({ produtoCodigo: null, produtoNome: null });
  });

  it('persistirItensPlanejados → 404 operação/produto; 400 preço; plano sem solicitado', async () => {
    const pedido = { id: 'p1', operacaoId: 'op1', clienteId: 'c1' };
    const service = makeService({});
    const txOp = {
      select: jest.fn()
        .mockImplementationOnce(() => chain([{ faixaPreco: 'A' }]))
        .mockImplementationOnce(() => chain([])),
    };
    await expect(
      service.persistirItensPlanejados(txOp as never, pedido as never, [], [], 'u1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    const txProd = {
      select: jest.fn()
        .mockImplementationOnce(() => chain([{ faixaPreco: 'A' }]))
        .mockImplementationOnce(() => chain([{ data: '2026-08-01' }]))
        .mockImplementationOnce(() => chain([])),
    };
    await expect(
      service.persistirItensPlanejados(
        txProd as never,
        pedido as never,
        [{ produtoId: 'ic1', quantidade: 1 }],
        [{ produtoId: 'ic1', quantidadeSolicitada: '1.000', disponivelAntes: '1.000', coberturas: [], deficit: '0.000' }],
        'u1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    precos.resolverPrecoVigente.mockResolvedValueOnce(null);
    const txPreco = {
      select: jest.fn()
        .mockImplementationOnce(() => chain([{ faixaPreco: 'A' }]))
        .mockImplementationOnce(() => chain([{ data: '2026-08-01' }]))
        .mockImplementationOnce(() => chain([{ codigo: 'TZ', nome: 'Traseiro', unidadePreco: 'kg' }])),
    };
    await expect(
      service.persistirItensPlanejados(
        txPreco as never,
        pedido as never,
        [{ produtoId: 'ic1', quantidade: 1 }],
        [{ produtoId: 'ic1', quantidadeSolicitada: '1.000', disponivelAntes: '1.000', coberturas: [], deficit: '0.000' }],
        'u1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const txPlano = {
      select: jest.fn()
        .mockImplementationOnce(() => chain([{ faixaPreco: 'A' }]))
        .mockImplementationOnce(() => chain([{ data: '2026-08-01' }])),
    };
    await expect(
      service.persistirItensPlanejados(
        txPlano as never,
        pedido as never,
        [],
        [{ produtoId: 'ic1', quantidadeSolicitada: '1.000', disponivelAntes: '1.000', coberturas: [], deficit: '0.000' }],
        'u1',
      ),
    ).rejects.toThrow('Plano sem item solicitado correspondente');
  });

  it('persistirItensPlanejados persiste item sem overbooking', async () => {
    const pedido = { id: 'p1', operacaoId: 'op1', clienteId: 'c1' };
    const item = { id: 'item1', produtoId: 'ic1' };
    const tx = {
      select: jest.fn()
        .mockImplementationOnce(() => chain([{ faixaPreco: 'A' }]))
        .mockImplementationOnce(() => chain([{ data: '2026-08-01' }]))
        .mockImplementationOnce(() => chain([{ codigo: 'TZ', nome: 'Traseiro', unidadePreco: 'kg' }])),
      execute: jest.fn().mockResolvedValue({ rows: [{ eq: false }] }),
      insert: jest.fn(() => ({ values: () => ({ returning: async () => [item] }) })),
    };
    const result = await makeService({}).persistirItensPlanejados(
      tx as never,
      pedido as never,
      [{ produtoId: 'ic1', quantidade: 1, precoAplicado: '18.50' }],
      [{ produtoId: 'ic1', quantidadeSolicitada: '1.000', disponivelAntes: '1.000', coberturas: [], deficit: '0.000' }],
      'u1',
    );
    expect(result.pedido).toEqual(pedido);
    expect(result.eventos).toHaveLength(1);
  });

  it('finalizar → 409 overbooking pendente, item sem preço, e cria ocorrência', async () => {
    const pedidoAberto = {
      id: 'p1',
      status: 'em_elaboracao_reserva_ativa',
      deletedAt: null,
      clienteId: 'c1',
      operacaoId: 'op1',
    };

    const txOb = { select: jest.fn()
      .mockImplementationOnce(() => chain([pedidoAberto]))
      .mockImplementationOnce(() => chain([{ id: 'item-ob' }])) };
    await expect(
      makeService({ transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(txOb)) })
        .finalizar('p1', 'u1'),
    ).rejects.toThrow('OVERBOOKING_CONFIRMACAO_NECESSARIA');

    const txSem = { select: jest.fn()
      .mockImplementationOnce(() => chain([pedidoAberto]))
      .mockImplementationOnce(() => chain([]))
      .mockImplementationOnce(() => chain([{ id: 'i1', produtoId: 'p1' }])) };
    await expect(
      makeService({ transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(txSem)) })
        .finalizar('p1', 'u1'),
    ).rejects.toMatchObject({ response: { code: 'PEDIDO_ITEM_SEM_PRECO' } });

    const finalizado = { ...pedidoAberto, status: 'finalizado' };
    const ocorrencia = { id: 'oc1', pedidoVendaId: 'p1', clienteId: 'c1' };
    const txOk = {
      select: jest.fn()
        .mockImplementationOnce(() => chain([pedidoAberto]))
        .mockImplementationOnce(() => chain([]))
        .mockImplementationOnce(() => chain([]))
        .mockImplementationOnce(() => chain([
          { id: 'i1', produtoId: 'pr1', precoTabelaOriginal: '18.50', precoAplicado: '17.00', usuarioAjusteId: 'u1' },
          { id: 'i2', produtoId: 'pr2', precoTabelaOriginal: null, precoAplicado: '10.00', usuarioAjusteId: null },
        ]))
        .mockImplementationOnce(() => chain([])),
      update: jest.fn(() => ({
        set: () => ({ where: () => ({ returning: async () => [finalizado] }) }),
      })),
      insert: jest.fn()
        .mockReturnValueOnce({ values: () => ({ returning: async () => [ocorrencia] }) })
        .mockReturnValue({ values: () => Promise.resolve() }),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(txOk)) };
    await expect(makeService(db).finalizar('p1', 'u1')).resolves.toEqual(finalizado);
  });

  it('finalizar → 409 unique constraint no próprio error (sem cause)', async () => {
    const db = {
      transaction: jest.fn().mockRejectedValue({
        code: '23505',
        constraint: 'uq_ocorr_ajuste_preco_pedido',
      }),
    };
    await expect(makeService(db).finalizar('p1', 'u1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('detalhar mapeia nome de quem ajustou o preço', async () => {
    const pedidoEscopo = { id: 'p1', clienteId: 'c1', status: 'em_elaboracao_reserva_ativa', deletedAt: null };
    const pedido = {
      id: 'p1',
      clienteId: 'c1',
      status: 'em_elaboracao_reserva_ativa',
      itens: [
        { id: 'i1', precoTabelaOriginal: '10.00', precoAplicado: '12.00', usuarioAjusteId: 'u-aj' },
        { id: 'i2', precoTabelaOriginal: '10.00', precoAplicado: '10.00', usuarioAjusteId: null },
      ],
    };
    const tx = {
      select: jest.fn()
        .mockImplementationOnce(() => chain([pedidoEscopo]))
        .mockImplementationOnce(() => chain([{ id: 'u-aj', nome: 'Ajustador' }])),
    };
    const db = {
      transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)),
      query: { pedidosVenda: { findFirst: jest.fn().mockResolvedValue(pedido) } },
      select: jest.fn(() => chain([])),
    };
    const detalhe = await makeService(db).detalhar('p1', 'u1');
    expect(detalhe.itens[0]).toMatchObject({ precoAjustado: true, usuarioAjusteNome: 'Ajustador' });
    expect(detalhe.itens[1]).toMatchObject({ precoAjustado: false, usuarioAjusteNome: null });
  });
});
