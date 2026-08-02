import { HttpAdapterHost } from '@nestjs/core';
import { RealtimeGateway } from '../../src/realtime/realtime.gateway';
import { RealtimeHub } from '../../src/realtime/realtime.hub';
import { TokenService } from '../../src/modules/auth/token.service';
import { EVENTOS } from '../../src/realtime/events/eventos';

describe('RealtimeGateway — Onda 8 (Estoque)', () => {
  const hub = new RealtimeHub();
  const broadcastSpy = jest.spyOn(hub, 'broadcast');
  const gateway = new RealtimeGateway(
    {} as HttpAdapterHost,
    {} as TokenService,
    hub,
  );

  const dataOperacao = '2026-08-03';
  const rooms = ['dashboard', 'desossa', `operacao:${dataOperacao}`];

  beforeEach(() => {
    broadcastSpy.mockClear();
  });

  function expectBroadcast(evento: string, payload: unknown) {
    expect(broadcastSpy).toHaveBeenCalledTimes(rooms.length);
    for (const room of rooms) {
      expect(broadcastSpy).toHaveBeenCalledWith(room, evento, payload);
    }
  }

  it('handleEstoqueItemDestinado faz broadcast nas rooms corretas', () => {
    const payload = {
      tipo: 'peca' as const,
      id: 'p1',
      pedidoVendaItemId: 'pvi1',
      dataOperacao,
    };
    gateway.handleEstoqueItemDestinado(payload);
    expectBroadcast(EVENTOS.ESTOQUE_ITEM_DESTINADO, payload);
  });

  it('handleEntradaItensRegistrada faz broadcast nas rooms corretas', () => {
    const payload = {
      entradaId: 'e1',
      produtoId: 'prod1',
      quantidade: 10,
      destino: 'estoque' as const,
      dataOperacao,
    };
    gateway.handleEntradaItensRegistrada(payload);
    expectBroadcast(EVENTOS.ENTRADA_ITENS_REGISTRADA, payload);
  });

  it('handleAjusteEstoqueCriado faz broadcast nas rooms corretas', () => {
    const payload = { ajusteId: 'a1', dataOperacao };
    gateway.handleAjusteEstoqueCriado(payload);
    expectBroadcast(EVENTOS.AJUSTE_ESTOQUE_CRIADO, payload);
  });

  it('handleAjusteEstoqueDecidido faz broadcast nas rooms corretas', () => {
    const payload = { ajusteId: 'a1', decisao: 'aplicado' as const, dataOperacao };
    gateway.handleAjusteEstoqueDecidido(payload);
    expectBroadcast(EVENTOS.AJUSTE_ESTOQUE_DECIDIDO, payload);
  });
});
