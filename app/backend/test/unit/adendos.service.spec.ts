import { EventEmitter2 } from '@nestjs/event-emitter';
import { AdendosService } from '../../src/modules/comercial/pedidos/adendos.service';
import { EVENTOS } from '../../src/realtime/events/eventos';

const pedidoBase = { id: 'p1', operacaoId: 'op1', clienteId: 'c1', status: 'em_elaboracao' };
const itemBase = {
  id: 'pi1',
  quantidadePedida: '10.000',
  quantidadeReservada: '10.000',
  quantidadeOverbooking: '0.000',
  itemComercialId: 'ic1',
};

function montar(alocacao: { coberturas: { disponibilidadeId: string; quantidade: string }[]; deficit: string }) {
  const ordem: string[] = [];
  const emitter = new EventEmitter2();
  const emitSpy = jest.spyOn(emitter, 'emit').mockImplementation(((event: unknown) => {
    ordem.push(`emit:${String(event)}`);
    return true;
  }) as never);

  const itemAtualizado = { ...itemBase };
  const tx = {
    update: jest.fn(() => ({
      set: () => ({
        where: () => ({ returning: () => Promise.resolve([itemAtualizado]) }),
      }),
    })),
    insert: jest.fn(() => ({
      values: () => ({ returning: () => Promise.resolve([{ id: 'adendo1', quantidadeAdicionada: '5.000' }]) }),
    })),
  };

  const db = {
    transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => {
      const r = await cb(tx);
      ordem.push('commit');
      return r;
    }),
  };

  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };

  const pedidos = {
    carregarAbertoParaAdendo: jest.fn().mockResolvedValue(pedidoBase),
    exigirItemDoPedido: jest.fn().mockResolvedValue(itemBase),
    planejarSobLock: jest.fn().mockResolvedValue([alocacao]),
    aplicarAlocacaoNoItem: jest.fn().mockResolvedValue([]),
  };

  const service = new AdendosService({ db } as never, auditoria as never, emitter, pedidos as never);
  return { service, emitSpy, ordem, tx, pedidos, auditoria };
}

describe('AdendosService — origem do consumo (D27)', () => {
  it('origem do adendo e virtual sem deficit e overbooking com deficit', async () => {
    const semDeficit = montar({
      coberturas: [{ disponibilidadeId: 'd1', quantidade: '5.000' }],
      deficit: '0.000',
    });
    await semDeficit.service.registrar('p1', {
      itemComercialId: 'ic1', quantidadeAdicionada: 5, motivo: 'ajuste de pedido',
    }, 'user-1', false);
    expect(semDeficit.emitSpy).toHaveBeenCalledWith(
      EVENTOS.ADENDO_REGISTRADO,
      expect.objectContaining({ origemConsumo: 'virtual' }),
    );

    const comDeficit = montar({ coberturas: [], deficit: '5.000' });
    await comDeficit.service.registrar('p1', {
      itemComercialId: 'ic1', quantidadeAdicionada: 5, motivo: 'ajuste de pedido',
    }, 'user-1', true);
    expect(comDeficit.emitSpy).toHaveBeenCalledWith(
      EVENTOS.ADENDO_REGISTRADO,
      expect.objectContaining({ origemConsumo: 'overbooking' }),
    );
  });
});

describe('AdendosService — ordem commit→emit (RA-04)', () => {
  it('emite adendo_registrado APÓS o commit da transação', async () => {
    const { service, emitSpy, ordem } = montar({
      coberturas: [{ disponibilidadeId: 'd1', quantidade: '5.000' }],
      deficit: '0.000',
    });

    await service.registrar('p1', {
      itemComercialId: 'ic1', quantidadeAdicionada: 5, motivo: 'ajuste de pedido',
    }, 'user-1', false);

    expect(emitSpy).toHaveBeenCalledWith(
      EVENTOS.ADENDO_REGISTRADO,
      expect.objectContaining({ pedidoVendaId: 'p1', itemComercialId: 'ic1' }),
    );
    expect(ordem.indexOf('commit')).toBeLessThan(ordem.indexOf(`emit:${EVENTOS.ADENDO_REGISTRADO}`));
  });

  it('NÃO emite quando a transação rejeita (rollback)', async () => {
    const { service, emitSpy, pedidos } = montar({ coberturas: [], deficit: '0.000' });
    pedidos.exigirItemDoPedido.mockRejectedValueOnce(new Error('falha simulada na tx'));

    await expect(service.registrar('p1', {
      itemComercialId: 'ic1', quantidadeAdicionada: 5, motivo: 'ajuste de pedido',
    }, 'user-1', false)).rejects.toThrow('falha simulada');
    expect(emitSpy).not.toHaveBeenCalled();
  });
});
