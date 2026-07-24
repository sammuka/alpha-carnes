import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CargaService } from '../../src/modules/operacao/expedicao/carga.service';

function makeSelectChain(rows: unknown[]) {
  const chain: {
    innerJoin: (...args: unknown[]) => typeof chain;
    where: (...args: unknown[]) => typeof chain;
    then: (cb: (r: unknown[]) => unknown) => unknown;
  } = {
    innerJoin: () => chain,
    where: () => chain,
    then: (cb) => cb(rows),
  };
  return { from: () => chain };
}

describe('CargaService — transferir branches', () => {
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const emitter = new EventEmitter2();
  jest.spyOn(emitter, 'emit').mockReturnValue(true);

  const item = {
    id: 'ci1',
    caminhaoId: 'cam-1',
    tipoOrigem: 'peca',
    pecaId: 'pc1',
    subitemId: null,
    pedidoVendaId: 'pv1',
    pedidoVendaItemId: 'pvi1',
    statusCargaItem: 'em_carga',
    deletedAt: null,
  };
  const caminhao = { id: 'cam-1', statusCaminhao: 'em_carga', deletedAt: null };

  function makeService(selectSequence: unknown[][]) {
    let call = 0;
    const tx = {
      select: jest.fn(() => makeSelectChain(selectSequence[call++] ?? [])),
      update: jest.fn(),
      insert: jest.fn(),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const caminhaoService = { caminhaoAtivo: jest.fn().mockResolvedValue(caminhao), dataOperacaoDoCaminhao: jest.fn() };
    const service = new CargaService({ db } as never, auditoria as never, emitter, caminhaoService as never);
    return { service, tx };
  }

  it('transferir → lança 404 se item de pedido destino não encontrado', async () => {
    // sequence: cargaItemAtivo(item), itemDestino([])
    const { service } = makeService([[item], []]);
    await expect(
      service.transferir('ci1', { pedidoVendaItemDestinoId: 'pvi-x', motivo: 'x' } as never, 'u1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('transferir → lança 409 se pedido destino cancelado', async () => {
    const destino = { id: 'pvi2', pedidoVendaId: 'pv2', itemComercialId: 'ic1', statusPedido: 'cancelado', compraProgramadaId: 'cp1', deletedAt: null };
    const { service } = makeService([[item], [destino]]);
    await expect(
      service.transferir('ci1', { pedidoVendaItemDestinoId: 'pvi2', motivo: 'x' } as never, 'u1'),
    ).rejects.toThrow('Pedido destino cancelado');
  });

  it('transferir → lança 409 se destino é o mesmo item atual', async () => {
    const destino = { id: 'pvi1', pedidoVendaId: 'pv1', itemComercialId: 'ic1', statusPedido: 'aberto', compraProgramadaId: 'cp1', deletedAt: null };
    const { service } = makeService([[item], [destino]]);
    await expect(
      service.transferir('ci1', { pedidoVendaItemDestinoId: 'pvi1', motivo: 'x' } as never, 'u1'),
    ).rejects.toThrow('Item já está neste pedido');
  });

  it('transferir (peca) → lança 409 se destino é de outra compra programada', async () => {
    const destino = { id: 'pvi2', pedidoVendaId: 'pv2', itemComercialId: 'ic1', statusPedido: 'aberto', compraProgramadaId: 'cp-OUTRA', deletedAt: null };
    const peca = { itemComercialBaseId: 'ic1', compraProgramadaId: 'cp1' };
    const { service } = makeService([[item], [destino], [peca]]);
    await expect(
      service.transferir('ci1', { pedidoVendaItemDestinoId: 'pvi2', motivo: 'x' } as never, 'u1'),
    ).rejects.toThrow('mesma compra programada');
  });

  it('transferir (subitem) → lança 409 se destino é de outra compra programada', async () => {
    const subItem = { ...item, tipoOrigem: 'subitem', pecaId: null, subitemId: 'sub1' };
    const destino = { id: 'pvi2', pedidoVendaId: 'pv2', itemComercialId: 'ic1', statusPedido: 'aberto', compraProgramadaId: 'cp-OUTRA', deletedAt: null };
    const sub = { itemComercialId: 'ic1', compraProgramadaId: 'cp1' };
    const { service } = makeService([[subItem], [destino], [sub]]);
    await expect(
      service.transferir('ci1', { pedidoVendaItemDestinoId: 'pvi2', motivo: 'x' } as never, 'u1'),
    ).rejects.toThrow('mesma compra programada');
  });

  it('transferir → lança 409 se item comercial incompatível com destino', async () => {
    const destino = { id: 'pvi2', pedidoVendaId: 'pv2', itemComercialId: 'ic-OUTRO', statusPedido: 'aberto', compraProgramadaId: 'cp1', deletedAt: null };
    const peca = { itemComercialBaseId: 'ic1', compraProgramadaId: 'cp1' };
    const { service } = makeService([[item], [destino], [peca]]);
    await expect(
      service.transferir('ci1', { pedidoVendaItemDestinoId: 'pvi2', motivo: 'x' } as never, 'u1'),
    ).rejects.toThrow('incompatível');
  });
});
