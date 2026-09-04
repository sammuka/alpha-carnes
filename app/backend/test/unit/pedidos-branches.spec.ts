import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PedidosService } from '../../src/modules/comercial/pedidos/pedidos.service';

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

  function makeService(db: Record<string, unknown>) {
    return new PedidosService({ db } as never, auditoria as never, emitter, operacoesService as never);
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
        .mockImplementationOnce(() => chain([])),
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
    ).rejects.toThrow('Pedido sem operação não pode gerar overbooking');
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
});
