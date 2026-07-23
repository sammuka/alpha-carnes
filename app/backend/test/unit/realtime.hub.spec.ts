import { RealtimeHub, type RealtimeSocket } from '../../src/realtime/realtime.hub';

function fakeSocket(): RealtimeSocket & { send: jest.Mock } {
  return { readyState: 1, send: jest.fn() };
}

describe('RealtimeHub', () => {
  let hub: RealtimeHub;

  beforeEach(() => {
    hub = new RealtimeHub();
  });

  it('faz broadcast apenas para sockets da room', () => {
    const a = fakeSocket();
    const b = fakeSocket();
    hub.join(a, 'dashboard');
    hub.join(b, 'operacao:2026-06-06');

    hub.broadcast('dashboard', 'evt', { x: 1 });

    expect(a.send).toHaveBeenCalledWith(JSON.stringify({ type: 'evt', payload: { x: 1 } }));
    expect(b.send).not.toHaveBeenCalled();
  });

  it('o mesmo socket pode entrar em múltiplas rooms', () => {
    const a = fakeSocket();
    hub.join(a, 'dashboard');
    hub.join(a, 'operacao:2026-06-06');

    hub.broadcast('dashboard', 'e1', {});
    hub.broadcast('operacao:2026-06-06', 'e2', {});

    expect(a.send).toHaveBeenCalledTimes(2);
  });

  it('leaveAll remove o socket de todas as rooms', () => {
    const a = fakeSocket();
    hub.join(a, 'dashboard');
    hub.join(a, 'operacao:2026-06-06');

    hub.leaveAll(a);
    hub.broadcast('dashboard', 'e', {});
    hub.broadcast('operacao:2026-06-06', 'e', {});

    expect(a.send).not.toHaveBeenCalled();
  });

  it('não envia para socket fechado e o remove da room', () => {
    const aberto = fakeSocket();
    const fechado = fakeSocket();
    fechado.readyState = 3; // CLOSED
    hub.join(aberto, 'dashboard');
    hub.join(fechado, 'dashboard');

    hub.broadcast('dashboard', 'e', { n: 1 });

    expect(aberto.send).toHaveBeenCalledTimes(1);
    expect(fechado.send).not.toHaveBeenCalled();

    // socket fechado foi removido: novo broadcast não tenta enviar de novo
    hub.broadcast('dashboard', 'e', { n: 2 });
    expect(fechado.send).not.toHaveBeenCalled();
    expect(aberto.send).toHaveBeenCalledTimes(2);
  });

  it('broadcast em room inexistente é no-op', () => {
    expect(() => hub.broadcast('inexistente', 'e', {})).not.toThrow();
  });

  it('remove room vazia após limpar sockets fechados', () => {
    const fechado = fakeSocket();
    fechado.readyState = 3;
    hub.join(fechado, 'solo');

    hub.broadcast('solo', 'e', { ok: true });

    expect(fechado.send).not.toHaveBeenCalled();
    expect(() => hub.broadcast('solo', 'e2', {})).not.toThrow();
  });
});
