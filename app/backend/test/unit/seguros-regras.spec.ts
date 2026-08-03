import { EventEmitter2 } from '@nestjs/event-emitter';
import { SegurosService } from '../../src/modules/operacao/faturamento/seguros.service';

function chainThen(rows: unknown[]) {
  const obj: Record<string, unknown> = {
    from: () => obj,
    where: () => obj,
    innerJoin: () => obj,
    then: (resolve: (r: unknown[]) => unknown) => resolve(rows),
  };
  return obj;
}

function makeService(selectResults: unknown[][], opts: { updateReturning?: unknown[] } = {}) {
  let call = 0;
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const emitter = new EventEmitter2();
  jest.spyOn(emitter, 'emit').mockReturnValue(true);
  const db = {
    select: jest.fn(() => chainThen(selectResults[call++] ?? [])),
    transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      insert: () => ({
        values: (v: Record<string, unknown>) => ({
          onConflictDoNothing: () => ({
            returning: () => Promise.resolve(opts.updateReturning ?? [{ id: 'seguro-novo', status: 'pendente', ...v }]),
          }),
        }),
      }),
      update: () => ({
        set: (patch: Record<string, unknown>) => ({
          where: () => ({
            returning: () => Promise.resolve([{ id: 'seguro-1', ...patch }]),
          }),
        }),
      }),
    })),
  };
  return { service: new SegurosService({ db } as never, auditoria as never, emitter), db, emitter };
}

describe('Seguros — transições (D10.5)', () => {
  const userId = 'user-1';

  it('DoD 10.10 transicoes de seguro', async () => {
    const seguroPendente = { id: 'seguro-1', caminhaoId: 'cam-1', status: 'pendente', deletedAt: null };
    const { service } = makeService([[seguroPendente], []]);
    await expect(service.alterarStatus('seguro-1', 'enviado', userId)).resolves.toMatchObject({ status: 'enviado' });

    const seguroEnviado = { id: 'seguro-1', caminhaoId: 'cam-1', status: 'enviado', deletedAt: null };
    const { service: service2 } = makeService([[seguroEnviado], []]);
    await expect(service2.alterarStatus('seguro-1', 'confirmado', userId)).resolves.toMatchObject({ status: 'confirmado' });
  });

  it('rejeita transicao invalida pendente->confirmado com 409 TRANSICAO_SEGURO_INVALIDA', async () => {
    const seguroPendente = { id: 'seguro-1', caminhaoId: 'cam-1', status: 'pendente', deletedAt: null };
    const { service } = makeService([[seguroPendente]]);
    await expect(service.alterarStatus('seguro-1', 'confirmado', userId)).rejects.toMatchObject({
      response: { codigo: 'TRANSICAO_SEGURO_INVALIDA' },
    });
  });

  it('confirmado e terminal — rejeita confirmado->enviado', async () => {
    const seguroConfirmado = { id: 'seguro-1', caminhaoId: 'cam-1', status: 'confirmado', deletedAt: null };
    const { service } = makeService([[seguroConfirmado]]);
    await expect(service.alterarStatus('seguro-1', 'enviado', userId)).rejects.toMatchObject({
      response: { codigo: 'TRANSICAO_SEGURO_INVALIDA' },
    });
  });

  it('unicidade parcial — obterOuCriar e idempotente por caminhaoId (2ª chamada acha o existente)', async () => {
    const caminhao = { id: 'cam-1', placa: 'ABC1234', motorista: 'Fulano', deletedAt: null };
    const seguroCriado = { id: 'seguro-1', caminhaoId: 'cam-1', status: 'pendente', deletedAt: null };

    // 1ª chamada: select segurosCarga (vazio) → select caminhoes (existe) → transaction insere
    const { service: serviceA } = makeService([[], [caminhao]], { updateReturning: [seguroCriado] });
    const a = await serviceA.obterOuCriar('cam-1', userId);

    // 2ª chamada: select segurosCarga já encontra o registro criado
    const { service: serviceB } = makeService([[seguroCriado]]);
    const b = await serviceB.obterOuCriar('cam-1', userId);

    expect(a.id).toBe(b.id);
  });
});
