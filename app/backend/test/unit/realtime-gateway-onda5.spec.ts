import { HttpAdapterHost } from '@nestjs/core';
import { RealtimeGateway } from '../../src/realtime/realtime.gateway';
import { RealtimeHub } from '../../src/realtime/realtime.hub';
import { TokenService } from '../../src/modules/auth/token.service';
import { EVENTOS } from '../../src/realtime/events/eventos';

describe('RealtimeGateway — Onda 5', () => {
  const hub = new RealtimeHub();
  const broadcastSpy = jest.spyOn(hub, 'broadcast');
  const gateway = new RealtimeGateway(
    {} as HttpAdapterHost,
    {} as TokenService,
    hub,
  );

  const dataOperacao = '2026-08-03';
  const rooms = ['dashboard', `operacao:${dataOperacao}`];

  beforeEach(() => {
    broadcastSpy.mockClear();
  });

  function expectBroadcast(evento: string, payload: unknown) {
    expect(broadcastSpy).toHaveBeenCalledTimes(rooms.length);
    for (const room of rooms) {
      expect(broadcastSpy).toHaveBeenCalledWith(room, evento, payload);
    }
  }

  it('handleCompraAlteradaImpacto faz broadcast nas rooms corretas', () => {
    const payload = {
      compraId: 'c1',
      operacaoId: 'op1',
      dataOperacao,
      deficitTotal: '0.000',
      itens: [],
    };
    gateway.handleCompraAlteradaImpacto(payload);
    expectBroadcast(EVENTOS.COMPRA_ALTERADA_IMPACTO, payload);
  });

  it('handleAprovacaoRegistrada faz broadcast nas rooms corretas', () => {
    const payload = {
      aprovacaoId: 'a1',
      operacaoId: 'op1',
      dataOperacao,
      tipo: 'teste',
      status: 'pendente' as const,
    };
    gateway.handleAprovacaoRegistrada(payload);
    expectBroadcast(EVENTOS.APROVACAO_REGISTRADA, payload);
  });

  it('handleAprovacaoDecidida faz broadcast nas rooms corretas', () => {
    const payload = {
      aprovacaoId: 'a1',
      operacaoId: 'op1',
      dataOperacao,
      tipo: 'teste',
      status: 'aprovada' as const,
    };
    gateway.handleAprovacaoDecidida(payload);
    expectBroadcast(EVENTOS.APROVACAO_DECIDIDA, payload);
  });

  it('handleRelatorioSifGerado faz broadcast nas rooms corretas', () => {
    const payload = {
      relatorioId: 'r1',
      operacaoId: 'op1',
      dataOperacao,
      versao: 1,
      tipoGeracao: 'gerado' as const,
    };
    gateway.handleRelatorioSifGerado(payload);
    expectBroadcast(EVENTOS.RELATORIO_SIF_GERADO, payload);
  });

  it('handlePendenciaAberta faz broadcast nas rooms corretas', () => {
    const payload = {
      pendenciaId: 'p1',
      pedidoVendaId: 'pv1',
      operacaoId: 'op1',
      dataOperacao,
      status: 'aberta',
    };
    gateway.handlePendenciaAberta(payload);
    expectBroadcast(EVENTOS.PENDENCIA_OVERBOOKING_ABERTA, payload);
  });

  it('handlePendenciaAtualizada faz broadcast nas rooms corretas', () => {
    const payload = {
      pendenciaId: 'p1',
      operacaoId: 'op1',
      dataOperacao,
      status: 'em_analise',
    };
    gateway.handlePendenciaAtualizada(payload);
    expectBroadcast(EVENTOS.PENDENCIA_OVERBOOKING_ATUALIZADA, payload);
  });

  it('handlePendenciaResolvida faz broadcast nas rooms corretas', () => {
    const payload = {
      pendenciaId: 'p1',
      operacaoId: 'op1',
      dataOperacao,
      status: 'resolvida',
    };
    gateway.handlePendenciaResolvida(payload);
    expectBroadcast(EVENTOS.PENDENCIA_OVERBOOKING_RESOLVIDA, payload);
  });
});
