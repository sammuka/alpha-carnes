/**
 * Testes de branch (mocks, sem DB) para DestinarEstoqueService cobrindo os 3 tipos
 * (peca/subitem/entrada) e os caminhos de erro que o e2e (DoD 8.3-8.6, só `peca`) não
 * exercita: subitem indisponível/sucesso, entrada com saldo insuficiente/item de pedido
 * ausente/pedido completo/sucesso, e buscarItemPedidoCompativel (pedido cancelado,
 * item comercial incompatível). `consumirSaldo` é mockado (módulo puro sem tx real).
 */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DestinarEstoqueService } from '../../src/modules/operacao/estoque/destinar.service';
import * as saldoModule from '../../src/modules/operacao/pesagem/saldo';

jest.mock('../../src/modules/operacao/pesagem/saldo', () => ({
  consumirSaldo: jest.fn(),
}));

function makeChain(rows: unknown[]) {
  const chain: Record<string, unknown> & PromiseLike<unknown[]> = {
    from: () => chain,
    where: () => chain,
    innerJoin: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    for: () => chain,
    then: (resolve: (v: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
  } as never;
  return chain;
}

function makeUpdateChain(returning: unknown[]) {
  return { set: () => ({ where: () => ({ returning: jest.fn(async () => returning) }) }) };
}

function makeAuditoria() {
  return { registrar: jest.fn() };
}

function makeEmitter() {
  return { emit: jest.fn() };
}

function makeService(tx: unknown) {
  const db = { transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)) };
  return new DestinarEstoqueService({ db } as never, makeAuditoria() as never, makeEmitter() as never);
}

const consumirSaldoMock = saldoModule.consumirSaldo as jest.Mock;

beforeEach(() => {
  consumirSaldoMock.mockReset();
});

describe('DestinarEstoqueService — destinarPeca (buscarItemPedidoCompativel)', () => {
  const pecaEmSobra = { id: 'p1', statusPeca: 'em_sobra', itemComercialBaseId: 'ic1', recebimentoId: 'r1', deletedAt: null };

  it('item de pedido não encontrado → 404', async () => {
    let call = 0;
    const responses = [[pecaEmSobra], []];
    const tx = { select: jest.fn(() => makeChain(responses[call++] ?? [])) };
    const service = makeService(tx);
    await expect(
      service.destinar({ tipo: 'peca', id: 'p1', pedidoVendaItemId: 'pvi1' }, 'user1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('pedido cancelado → 409 ITEM_INCOMPATIVEL', async () => {
    let call = 0;
    const responses = [
      [pecaEmSobra],
      [{ id: 'pvi1', pedidoVendaId: 'pv1', itemComercialId: 'ic1', statusPedido: 'cancelado', deletedAt: null }],
    ];
    const tx = { select: jest.fn(() => makeChain(responses[call++] ?? [])) };
    const service = makeService(tx);
    await expect(
      service.destinar({ tipo: 'peca', id: 'p1', pedidoVendaItemId: 'pvi1' }, 'user1'),
    ).rejects.toMatchObject({ response: expect.objectContaining({ codigo: 'ITEM_INCOMPATIVEL' }) });
  });

  it('item comercial incompatível → 409 ITEM_INCOMPATIVEL', async () => {
    let call = 0;
    const responses = [
      [pecaEmSobra],
      [{ id: 'pvi1', pedidoVendaId: 'pv1', itemComercialId: 'ic-outro', statusPedido: 'em_elaboracao_reserva_ativa', deletedAt: null }],
    ];
    const tx = { select: jest.fn(() => makeChain(responses[call++] ?? [])) };
    const service = makeService(tx);
    await expect(
      service.destinar({ tipo: 'peca', id: 'p1', pedidoVendaItemId: 'pvi1' }, 'user1'),
    ).rejects.toMatchObject({ response: expect.objectContaining({ codigo: 'ITEM_INCOMPATIVEL' }) });
  });

  it('sucesso → atualiza peça, registra histórico/auditoria e resolve dataOperacao', async () => {
    let call = 0;
    const responses = [
      [pecaEmSobra],
      [{ id: 'pvi1', pedidoVendaId: 'pv1', itemComercialId: 'ic1', statusPedido: 'em_elaboracao_reserva_ativa', deletedAt: null }],
      [{ dataOperacao: '2026-08-01' }], // dataOperacaoDaPeca
    ];
    consumirSaldoMock.mockResolvedValue(true);
    const atualizada = { ...pecaEmSobra, statusPeca: 'associada', pedidoVendaId: 'pv1', pedidoVendaItemId: 'pvi1' };
    const tx = {
      select: jest.fn(() => makeChain(responses[call++] ?? [])),
      update: jest.fn(() => makeUpdateChain([atualizada])),
      insert: jest.fn(() => ({ values: jest.fn(async () => undefined) })),
    };
    const service = makeService(tx);

    const resultado = await service.destinar({ tipo: 'peca', id: 'p1', pedidoVendaItemId: 'pvi1' }, 'user1');
    expect(resultado).toEqual(atualizada);
  });
});

describe('DestinarEstoqueService — destinarSubitem', () => {
  it('subitem não encontrado → 404', async () => {
    const tx = { select: jest.fn(() => makeChain([])) };
    const service = makeService(tx);
    await expect(
      service.destinar({ tipo: 'subitem', id: 's1', pedidoVendaItemId: 'pvi1' }, 'user1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('subitem não em_sobra → 409 ITEM_NAO_DISPONIVEL', async () => {
    const subitemAssociado = { id: 's1', statusSubitem: 'associado', itemComercialId: 'ic1', pecaOrigemId: 'p1', deletedAt: null };
    const tx = { select: jest.fn(() => makeChain([subitemAssociado])) };
    const service = makeService(tx);
    await expect(
      service.destinar({ tipo: 'subitem', id: 's1', pedidoVendaItemId: 'pvi1' }, 'user1'),
    ).rejects.toMatchObject({ response: expect.objectContaining({ codigo: 'ITEM_NAO_DISPONIVEL' }) });
  });

  it('consumirSaldo falha (item do pedido completo) → 409 sem atualizar subitem', async () => {
    const subitemEmSobra = { id: 's1', statusSubitem: 'em_sobra', itemComercialId: 'ic1', pecaOrigemId: 'p1', deletedAt: null };
    let call = 0;
    const responses = [
      [subitemEmSobra],
      [{ id: 'pvi1', pedidoVendaId: 'pv1', itemComercialId: 'ic1', statusPedido: 'em_elaboracao_reserva_ativa', deletedAt: null }],
    ];
    consumirSaldoMock.mockResolvedValue(false);
    const tx = { select: jest.fn(() => makeChain(responses[call++] ?? [])), update: jest.fn() };
    const service = makeService(tx);

    await expect(
      service.destinar({ tipo: 'subitem', id: 's1', pedidoVendaItemId: 'pvi1' }, 'user1'),
    ).rejects.toMatchObject({ response: expect.objectContaining({ codigo: 'ITEM_DO_PEDIDO_COMPLETO' }) });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('sucesso → atualiza subitem e resolve dataOperacao via pecaOrigem', async () => {
    const subitemEmSobra = { id: 's1', statusSubitem: 'em_sobra', itemComercialId: 'ic1', pecaOrigemId: 'p1', deletedAt: null };
    let call = 0;
    const responses = [
      [subitemEmSobra],
      [{ id: 'pvi1', pedidoVendaId: 'pv1', itemComercialId: 'ic1', statusPedido: 'em_elaboracao_reserva_ativa', deletedAt: null }],
      [{ dataOperacao: '2026-08-01' }], // dataOperacaoDoSubitem
    ];
    consumirSaldoMock.mockResolvedValue(true);
    const atualizado = { ...subitemEmSobra, statusSubitem: 'associado', pedidoVendaId: 'pv1', pedidoVendaItemId: 'pvi1' };
    const tx = {
      select: jest.fn(() => makeChain(responses[call++] ?? [])),
      update: jest.fn(() => makeUpdateChain([atualizado])),
      insert: jest.fn(() => ({ values: jest.fn(async () => undefined) })),
    };
    const service = makeService(tx);

    const resultado = await service.destinar({ tipo: 'subitem', id: 's1', pedidoVendaItemId: 'pvi1' }, 'user1');
    expect(resultado).toEqual(atualizado);
  });
});

describe('DestinarEstoqueService — destinarEntrada', () => {
  it('entrada não encontrada → 404', async () => {
    const tx = { select: jest.fn(() => makeChain([])) };
    const service = makeService(tx);
    await expect(
      service.destinar({ tipo: 'entrada', id: 'e1', pedidoVendaItemId: 'pvi1', quantidade: 2 }, 'user1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('saldo da entrada insuficiente → 409 SALDO_INSUFICIENTE', async () => {
    const entrada = { id: 'e1', quantidade: 5, quantidadeDestinada: 4, deletedAt: null };
    const tx = { select: jest.fn(() => makeChain([entrada])) };
    const service = makeService(tx);
    await expect(
      service.destinar({ tipo: 'entrada', id: 'e1', pedidoVendaItemId: 'pvi1', quantidade: 2 }, 'user1'),
    ).rejects.toMatchObject({ response: expect.objectContaining({ codigo: 'SALDO_INSUFICIENTE' }) });
  });

  it('item de pedido não encontrado → 404', async () => {
    const entrada = { id: 'e1', quantidade: 10, quantidadeDestinada: 0, deletedAt: null };
    let call = 0;
    const responses = [[entrada], []];
    const tx = { select: jest.fn(() => makeChain(responses[call++] ?? [])) };
    const service = makeService(tx);
    await expect(
      service.destinar({ tipo: 'entrada', id: 'e1', pedidoVendaItemId: 'pvi1', quantidade: 2 }, 'user1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('UPDATE condicional de saldo do pedido não afeta linha → 409 ITEM_DO_PEDIDO_COMPLETO', async () => {
    const entrada = { id: 'e1', quantidade: 10, quantidadeDestinada: 0, deletedAt: null };
    let call = 0;
    const responses = [[entrada], [{ id: 'pvi1', pedidoVendaId: 'pv1' }]];
    const tx = {
      select: jest.fn(() => makeChain(responses[call++] ?? [])),
      execute: jest.fn(async () => ({ rows: [] })),
    };
    const service = makeService(tx);
    await expect(
      service.destinar({ tipo: 'entrada', id: 'e1', pedidoVendaItemId: 'pvi1', quantidade: 2 }, 'user1'),
    ).rejects.toMatchObject({ response: expect.objectContaining({ codigo: 'ITEM_DO_PEDIDO_COMPLETO' }) });
  });

  it('sucesso → atualiza quantidadeDestinada e resolve dataOperacao via pedido', async () => {
    const entrada = { id: 'e1', quantidade: 10, quantidadeDestinada: 0, deletedAt: null };
    let call = 0;
    const responses = [
      [entrada],
      [{ id: 'pvi1', pedidoVendaId: 'pv1' }],
      [{ dataOperacao: '2026-08-01' }], // dataOperacaoDoPedido
    ];
    const atualizada = { ...entrada, quantidadeDestinada: 2, pedidoId: 'pv1', pedidoVendaItemId: 'pvi1' };
    const tx = {
      select: jest.fn(() => makeChain(responses[call++] ?? [])),
      execute: jest.fn(async () => ({ rows: [{ id: 'pvi1' }] })),
      update: jest.fn(() => makeUpdateChain([atualizada])),
    };
    const service = makeService(tx);

    const resultado = await service.destinar({ tipo: 'entrada', id: 'e1', pedidoVendaItemId: 'pvi1', quantidade: 2 }, 'user1');
    expect(resultado).toEqual(atualizada);
  });
});
