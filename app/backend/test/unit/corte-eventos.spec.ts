import { EventEmitter2 } from '@nestjs/event-emitter';
import { CorteService } from '../../src/modules/operacao/corte/corte.service';
import { EVENTOS } from '../../src/realtime/events/eventos';

describe('CorteService — emissão pós-commit', () => {
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
});
