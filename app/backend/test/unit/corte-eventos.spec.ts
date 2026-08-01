import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConflictException } from '@nestjs/common';
import { CorteService } from '../../src/modules/operacao/corte/corte.service';
import { SubitemService } from '../../src/modules/operacao/corte/subitem.service';
import { EVENTOS } from '../../src/realtime/events/eventos';

describe('CorteService — emissão pós-commit', () => {
  /** Emenda 7.2 — CorteService exige ChecklistCorteService no construtor (DoD 7.9). */
  function makeChecklist(
    overrides: Partial<{ divergente: boolean; divergenciaAbertaId: string | null }> = {},
  ) {
    return {
      obterNaTx: jest.fn(async () => ({
        transformacaoId: 't1',
        regraTransformacaoId: null,
        regraNome: null,
        regraProvisoria: false,
        slots: [],
        divergente: false,
        divergenciaAbertaId: null,
        ...overrides,
      })),
      obter: jest.fn(),
      abrirDivergencia: jest.fn(),
    };
  }

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
    const service = new CorteService(
      { db } as never,
      { registrar: jest.fn() } as never,
      emitter,
      makeChecklist() as never,
    );
    return { service, emitSpy, ordem };
  }

  it('corte_iniciado é emitido APÓS o commit', async () => {
    const { service, emitSpy, ordem } = montar(async () => ({
      transf: { id: 't1', pecaOrigemId: 'pc1', pesoOriginal: '12.500' },
      dataOperacao: '2026-10-02',
    }));

    await service.iniciar('pc1', { tipoTransformacao: 'simples', motivo: 'necessidade_operacional' } as never, 'user-1');

    expect(emitSpy).toHaveBeenCalledWith(EVENTOS.CORTE_INICIADO, expect.objectContaining({ transformacaoId: 't1', pecaOrigemId: 'pc1' }));
    expect(ordem.indexOf('commit')).toBeLessThan(ordem.indexOf(`emit:${EVENTOS.CORTE_INICIADO}`));
  });

  it('NÃO emite corte_iniciado quando a transação rejeita (rollback)', async () => {
    const { service, emitSpy } = montar(async () => {
      throw new Error('peça inelegível');
    });

    await expect(
      service.iniciar('pc1', { tipoTransformacao: 'simples', motivo: 'necessidade_operacional' } as never, 'user-1'),
    ).rejects.toThrow('peça inelegível');
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('corte_concluido é emitido APÓS o commit (quando não idempotente)', async () => {
    const { service, emitSpy, ordem } = montar(async () => ({
      transf: {
        id: 't1',
        pecaOrigemId: 'pc1',
        pesoOriginal: '12.500',
        pesoSubitensTotal: '12.500',
        diferencaPeso: '0.000',
        statusTransformacao: 'aberta',
      },
      dataOperacao: '2026-10-06',
      jaConcluido: false,
    }));

    await service.concluir('t1', {} as never, 'user-1');

    expect(emitSpy).toHaveBeenCalledWith(EVENTOS.CORTE_CONCLUIDO, expect.objectContaining({ transformacaoId: 't1' }));
    expect(ordem.indexOf('commit')).toBeLessThan(ordem.indexOf(`emit:${EVENTOS.CORTE_CONCLUIDO}`));
  });

  it('NÃO emite corte_concluido quando jaConcluido=true (idempotência)', async () => {
    const { service, emitSpy } = montar(async () => ({
      transf: { id: 't1', statusTransformacao: 'concluida' },
      dataOperacao: '',
      jaConcluido: true,
    }));

    await service.concluir('t1', {} as never, 'user-1');

    expect(emitSpy).not.toHaveBeenCalledWith(EVENTOS.CORTE_CONCLUIDO, expect.anything());
  });

  it('emite faltas_desossa_atualizadas após concluir com commit', async () => {
    const { service, emitSpy, ordem } = montar(async () => ({
      transf: {
        id: 't1',
        pecaOrigemId: 'pc1',
        pesoOriginal: '12.500',
        pesoSubitensTotal: '12.500',
        diferencaPeso: '0.000',
        statusTransformacao: 'aberta',
      },
      dataOperacao: '2026-10-06',
      jaConcluido: false,
    }));

    await service.concluir('t1', {} as never, 'user-1');

    expect(emitSpy).toHaveBeenCalledWith(
      EVENTOS.FALTAS_DESOSSA_ATUALIZADAS,
      expect.objectContaining({ motivo: 'corte_concluido', dataOperacao: expect.any(String) }),
    );
    expect(ordem.indexOf('commit')).toBeLessThan(
      ordem.indexOf(`emit:${EVENTOS.FALTAS_DESOSSA_ATUALIZADAS}`),
    );
  });
});

describe('SubitemService — FALTAS_DESOSSA_ATUALIZADAS (DoD 7.13 / Task 8)', () => {
  /** Espelha Task 8: transaction mockada (commit/rollback) sem DB real. */
  function montarAssociar(transactionImpl: () => Promise<unknown>) {
    const events = new EventEmitter2();
    const spy = jest.spyOn(events, 'emit').mockImplementation(((..._args: unknown[]) => true) as never);
    const db = {
      transaction: jest.fn(async () => transactionImpl()),
    };
    const service = new SubitemService(
      { db } as never,
      { registrar: jest.fn() } as never,
      events,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, spy };
  }

  it('não emite faltas_desossa_atualizadas em rollback', async () => {
    const { service, spy } = montarAssociar(async () => {
      throw new ConflictException('Subitem precisa estar pesado antes de associar');
    });

    await expect(
      service.associar('s1', { pedidoVendaItemId: 'pvi1' } as never, 'u1'),
    ).rejects.toBeTruthy();
    expect(
      spy.mock.calls.filter((c) => c[0] === EVENTOS.FALTAS_DESOSSA_ATUALIZADAS),
    ).toHaveLength(0);
  });

  it('emite faltas_desossa_atualizadas após associar com commit', async () => {
    const { service, spy } = montarAssociar(async () => ({
      subitem: {
        id: 's1',
        transformacaoId: 't1',
        pecaOrigemId: 'pc1',
        pedidoVendaId: 'pv1',
        pedidoVendaItemId: 'pvi1',
        statusSubitem: 'associado',
      },
      dataOperacao: '2026-07-31',
    }));

    await service.associar('s1', { pedidoVendaItemId: 'pvi1' } as never, 'u1');
    expect(spy).toHaveBeenCalledWith(
      EVENTOS.FALTAS_DESOSSA_ATUALIZADAS,
      expect.objectContaining({
        motivo: 'subitem_associado',
        dataOperacao: expect.any(String),
      }),
    );
  });
});
