import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrecosService } from '../../src/modules/comercial/precos/precos.service';
import { EVENTOS } from '../../src/realtime/events/eventos';

function chain(rows: unknown[]) {
  const obj: Record<string, unknown> = {
    from: () => obj,
    innerJoin: () => obj,
    where: () => obj,
    orderBy: () => obj,
    for: () => obj,
    limit: () => obj,
    offset: () => obj,
    then: (resolve: (r: unknown[]) => unknown) => resolve(rows),
  };
  return obj;
}

// Verifica a ordem commit→emit (RA-04/ADR-004): o evento só sai DEPOIS que a
// Promise de db.transaction resolve, e NÃO sai se a transação rejeita.
describe('PrecosService — emissão de evento pós-commit (DoD-93)', () => {
  const tabelaRow = {
    id: 'tab1', data: '2026-08-10', status: 'publicada',
    observacao: null, publicadaPor: 'u1', publicadaEm: new Date(), deletedAt: null,
  };

  function montar(transactionImpl: (cb: unknown) => Promise<unknown>) {
    const ordem: string[] = [];
    const emitter = new EventEmitter2();
    const emitSpy = jest.spyOn(emitter, 'emit').mockImplementation(((event: unknown) => {
      ordem.push(`emit:${String(event)}`);
      return true;
    }) as never);
    const db = {
      transaction: jest.fn(async (cb: unknown) => {
        const r = await transactionImpl(cb);
        ordem.push('commit');
        return r;
      }),
      select: jest.fn()
        .mockReturnValueOnce(chain([tabelaRow]))
        .mockReturnValueOnce(chain([]))
        .mockReturnValueOnce(chain([])),
    };
    const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    const service = new PrecosService({ db } as never, auditoria as never, emitter);
    return { service, emitSpy, ordem };
  }

  it('publicacao emite tabela_preco_publicada apos o commit', async () => {
    const { service, emitSpy, ordem } = montar(async () => ({ id: 'tab1', data: '2026-08-10' }));

    await service.publicar('tab1', {}, 'u1');

    expect(emitSpy).toHaveBeenCalledWith(
      EVENTOS.TABELA_PRECO_PUBLICADA,
      expect.objectContaining({ tabelaPrecoId: 'tab1', data: '2026-08-10', autorId: 'u1' }),
    );
    expect(ordem.indexOf('commit')).toBeLessThan(ordem.indexOf(`emit:${EVENTOS.TABELA_PRECO_PUBLICADA}`));
  });

  it('NAO emite quando a transacao rejeita (rollback)', async () => {
    const { service, emitSpy } = montar(async () => {
      throw new Error('falha simulada na tx');
    });

    await expect(service.publicar('tab1', {}, 'u1')).rejects.toThrow('falha simulada');
    expect(emitSpy).not.toHaveBeenCalled();
  });
});
