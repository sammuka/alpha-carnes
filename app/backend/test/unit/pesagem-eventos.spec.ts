import { EventEmitter2 } from '@nestjs/event-emitter';
import { PesagemService } from '../../src/modules/operacao/pesagem/pesagem.service';
import { AssociacaoService } from '../../src/modules/operacao/pesagem/associacao.service';
import { EVENTOS } from '../../src/realtime/events/eventos';
import type { CurrentUserPayload } from '../../src/common/decorators/current-user.decorator';

const user: CurrentUserPayload = { sub: 'user-1', nome: 'Op', perfis: ['recebimento_pesagem'], permissoes: ['PESO_MANUAL'] };

// ── PesagemService: ordem commit→emit e no-emit em rollback ───────────────────
describe('PesagemService — emissão pós-commit', () => {
  function montar(opts: {
    recebimento: unknown;
    balancaStatus: 'disponivel' | 'instavel' | 'indisponivel';
    transactionImpl: () => Promise<unknown>;
  }) {
    const ordem: string[] = [];
    const emitter = new EventEmitter2();
    const emitSpy = jest.spyOn(emitter, 'emit').mockImplementation(((event: unknown) => {
      ordem.push(`emit:${String(event)}`);
      return true;
    }) as never);

    const terminal = {
      then: (cb: (r: unknown[]) => unknown) => cb([opts.recebimento]),
      where: function where() { return terminal; },
      innerJoin: function innerJoin() { return terminal; },
    };
    const db = {
      select: () => ({ from: () => terminal }),
      transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const r = await opts.transactionImpl();
        ordem.push('commit');
        return r ?? (await fn({}).catch(() => undefined));
      }),
    };
    const auditoria = { registrar: jest.fn() };
    const saude = { status: opts.balancaStatus, dispositivoId: 'b1', heartbeatEm: 'now' };
    const balanca = { status: () => saude, lerEstavel: jest.fn(async () => ({ peso: '12.500', estavel: opts.balancaStatus === 'disponivel', saude })) };
    const leitor = { status: () => saude, ler: jest.fn() };
    const impressora = { status: () => saude, imprimir: jest.fn() };

    const service = new PesagemService(
      { db } as never,
      auditoria as never,
      emitter,
      balanca as never,
      leitor as never,
      impressora as never,
    );
    return { service, emitSpy, ordem };
  }

  it('peca_pesada (automático) é emitido APÓS o commit', async () => {
    const peca = { id: 'pc1', recebimentoId: 'r1', modoCapturaPeso: 'automatico', pesoOriginal: '12.500' };
    const { service, emitSpy, ordem } = montar({
      recebimento: { id: 'r1', compraProgramadaId: 'c1', dataOperacao: '2026-07-01' },
      balancaStatus: 'disponivel',
      transactionImpl: async () => peca,
    });

    await service.registrarPesagem(
      { recebimentoId: 'r1', itemComercialBaseId: 'i1', modoCaptura: 'automatico' } as never,
      user,
    );

    expect(emitSpy).toHaveBeenCalledWith(EVENTOS.PECA_PESADA, expect.objectContaining({ pecaId: 'pc1', modoCaptura: 'automatico' }));
    expect(ordem.indexOf('commit')).toBeLessThan(ordem.indexOf(`emit:${EVENTOS.PECA_PESADA}`));
  });

  it('NÃO emite peca_pesada quando a transação rejeita (rollback)', async () => {
    const { service, emitSpy } = montar({
      recebimento: { id: 'r1', compraProgramadaId: 'c1', dataOperacao: '2026-07-01' },
      balancaStatus: 'disponivel',
      transactionImpl: async () => {
        throw new Error('falha na tx');
      },
    });

    await expect(
      service.registrarPesagem({ recebimentoId: 'r1', itemComercialBaseId: 'i1', modoCaptura: 'automatico' } as never, user),
    ).rejects.toThrow('falha na tx');
    expect(emitSpy).not.toHaveBeenCalledWith(EVENTOS.PECA_PESADA, expect.anything());
  });

  it('balança indisponível: não chama transaction e emite status do dispositivo', async () => {
    const { service, emitSpy } = montar({
      recebimento: { id: 'r1', compraProgramadaId: 'c1', dataOperacao: '2026-07-01' },
      balancaStatus: 'indisponivel',
      transactionImpl: async () => ({}),
    });

    await expect(
      service.registrarPesagem({ recebimentoId: 'r1', itemComercialBaseId: 'i1', modoCaptura: 'automatico' } as never, user),
    ).rejects.toThrow(/indispon|instável/i);
    expect(emitSpy).toHaveBeenCalledWith(EVENTOS.DISPOSITIVO_STATUS_ALTERADO, expect.objectContaining({ status: 'indisponivel' }));
    expect(emitSpy).not.toHaveBeenCalledWith(EVENTOS.PECA_PESADA, expect.anything());
  });
});

// ── AssociacaoService: ordem commit→emit e no-emit em rollback ────────────────
describe('AssociacaoService — emissão pós-commit', () => {
  function montar(transactionImpl: () => Promise<unknown>) {
    const ordem: string[] = [];
    const emitter = new EventEmitter2();
    const emitSpy = jest.spyOn(emitter, 'emit').mockImplementation(((event: unknown) => {
      ordem.push(`emit:${String(event)}`);
      return true;
    }) as never);
    const db = {
      transaction: jest.fn(async () => {
        const r = await transactionImpl();
        ordem.push('commit');
        return r;
      }),
    };
    const service = new AssociacaoService({ db } as never, { registrar: jest.fn() } as never, emitter, {} as never);
    return { service, emitSpy, ordem };
  }

  it('peca_associada é emitido APÓS o commit', async () => {
    const { service, emitSpy, ordem } = montar(async () => ({
      peca: { id: 'pc1', pedidoVendaId: 'pv1', pedidoVendaItemId: 'pvi1' },
      dataOperacao: '2026-08-01',
    }));

    await service.confirmar('pc1', { pedidoVendaItemId: 'pvi1' } as never, 'user-1');

    expect(emitSpy).toHaveBeenCalledWith(EVENTOS.PECA_ASSOCIADA, expect.objectContaining({ pecaId: 'pc1', pedidoVendaItemId: 'pvi1' }));
    expect(ordem.indexOf('commit')).toBeLessThan(ordem.indexOf(`emit:${EVENTOS.PECA_ASSOCIADA}`));
  });

  it('NÃO emite peca_associada quando a transação rejeita (rollback)', async () => {
    const { service, emitSpy } = montar(async () => {
      throw new Error('item completo');
    });
    await expect(service.confirmar('pc1', { pedidoVendaItemId: 'pvi1' } as never, 'user-1')).rejects.toThrow('item completo');
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('peca_redirecionada é emitido APÓS o commit', async () => {
    const { service, emitSpy, ordem } = montar(async () => ({
      peca: { id: 'pc1', pedidoVendaId: 'pv2' },
      pedidoOrigemId: 'pv1',
      dataOperacao: '2026-08-04',
    }));

    await service.redirecionar('pc1', { pedidoVendaItemId: 'pvi2', motivo: 'x' } as never, 'user-1');

    expect(emitSpy).toHaveBeenCalledWith(EVENTOS.PECA_REDIRECIONADA, expect.objectContaining({ pecaId: 'pc1', pedidoDestinoId: 'pv2' }));
    expect(ordem.indexOf('commit')).toBeLessThan(ordem.indexOf(`emit:${EVENTOS.PECA_REDIRECIONADA}`));
  });
});
