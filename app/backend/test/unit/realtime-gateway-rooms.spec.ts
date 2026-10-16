import { HttpAdapterHost } from '@nestjs/core';
import type { AccessTokenPayload } from '../../src/modules/auth/token.service';
import { TokenService } from '../../src/modules/auth/token.service';
import { EVENTOS } from '../../src/realtime/events/eventos';
import { RealtimeGateway } from '../../src/realtime/realtime.gateway';
import { RealtimeHub, type RealtimeSocket } from '../../src/realtime/realtime.hub';

function usuario(permissoes: string[], exp = Math.floor(Date.now() / 1000) + 600): AccessTokenPayload {
  return { sub: 'u1', nome: 'Admin', perfis: ['administrador'], permissoes, iat: 1, exp };
}

function socket(user: AccessTokenPayload) {
  const handlers = new Map<string, (data?: Buffer) => void>();
  return {
    readyState: 1,
    user,
    send: jest.fn(),
    on(evento: string, fn: (data?: Buffer) => void) {
      handlers.set(evento, fn);
    },
    receber(raw: string) {
      handlers.get('message')?.(Buffer.from(raw));
    },
  };
}

describe('RealtimeGateway rooms fiscais', () => {
  function montar() {
    const hub = new RealtimeHub();
    const gateway = new RealtimeGateway({} as HttpAdapterHost, {} as TokenService, hub);
    return { hub, gateway };
  }

  function assinar(gateway: RealtimeGateway, ws: ReturnType<typeof socket>, room: string) {
    (gateway as unknown as { registrar(socket: RealtimeSocket): void }).registrar(ws);
    ws.receber(JSON.stringify({ type: 'subscribe', room }));
  }

  it('assina com permissão', () => {
    const { hub, gateway } = montar();
    const ws = socket(usuario(['FISCAL_EMPRESAS_LER']));
    assinar(gateway, ws, 'fiscal-empresas');
    expect(hub.membros('fiscal-empresas')).toEqual([ws]);
  });

  it('sem permissão não entra', () => {
    const { hub, gateway } = montar();
    const ws = socket(usuario(['DISPONIBILIDADE_LER']));
    assinar(gateway, ws, 'fiscal-empresas');
    expect(hub.membros('fiscal-empresas')).toEqual([]);
  });

  it('rooms legadas inalteradas', () => {
    const { hub, gateway } = montar();
    const comDisponibilidade = socket(usuario(['DISPONIBILIDADE_LER']));
    const soFiscal = socket(usuario(['FISCAL_EMPRESAS_LER']));
    assinar(gateway, comDisponibilidade, 'dashboard');
    assinar(gateway, soFiscal, 'dashboard');
    expect(hub.membros('dashboard')).toEqual([comDisponibilidade]);
  });

  it('broadcastRoom de room não registrada lança', () => {
    const { gateway } = montar();
    expect(() => gateway.broadcastRoom('dashboard', 'evt', {})).toThrow(/não registrada/);
  });

  it('socket com exp vencido removido antes do envio', () => {
    const { hub, gateway } = montar();
    const vencido = socket(usuario(['FISCAL_EMPRESAS_LER'], 1));
    const valido = socket(usuario(['FISCAL_EMPRESAS_LER']));
    hub.join(vencido, 'fiscal-empresas');
    hub.join(valido, 'fiscal-empresas');
    gateway.broadcastRoom('fiscal-empresas', EVENTOS.EMPRESA_FISCAL_ALTERADA, { empresaId: 'e1', acao: 'criado' });
    expect(vencido.send).not.toHaveBeenCalled();
    expect(valido.send).toHaveBeenCalledTimes(1);
    expect(hub.membros('fiscal-empresas')).toEqual([valido]);
  });

  it('hub.membros/remover', () => {
    const hub = new RealtimeHub();
    expect(hub.membros('fiscal-empresas')).toEqual([]);
    const ws = socket(usuario(['FISCAL_EMPRESAS_LER']));
    hub.join(ws, 'fiscal-empresas');
    const copia = hub.membros('fiscal-empresas');
    expect(copia).toEqual([ws]);
    hub.remover(ws, 'fiscal-empresas');
    expect(hub.membros('fiscal-empresas')).toEqual([]);
    expect(copia).toEqual([ws]);
  });
});
