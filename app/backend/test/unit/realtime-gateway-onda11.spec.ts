import { HttpAdapterHost } from '@nestjs/core';
import { RealtimeGateway } from '../../src/realtime/realtime.gateway';
import { RealtimeHub } from '../../src/realtime/realtime.hub';
import { TokenService } from '../../src/modules/auth/token.service';

describe('RealtimeGateway — Onda 11', () => {
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

  const payload = {
    compraId: 'c1',
    operacaoId: 'op1',
    dataOperacao,
    numeroSequencial: 1,
  };

  it('handleCompraCriada faz broadcast nas rooms corretas', () => {
    gateway.handleCompraCriada(payload);
    expectBroadcast('compra_programada_criada', payload);
  });

  it('handleCompraAtualizada faz broadcast nas rooms corretas', () => {
    gateway.handleCompraAtualizada(payload);
    expectBroadcast('compra_programada_atualizada', payload);
  });

  it('handleCompraCancelada faz broadcast nas rooms corretas', () => {
    gateway.handleCompraCancelada(payload);
    expectBroadcast('compra_programada_cancelada', payload);
  });
});
