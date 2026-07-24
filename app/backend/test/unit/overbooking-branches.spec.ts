import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OverbookingService } from '../../src/modules/comercial/overbooking/overbooking.service';

describe('OverbookingService — branches', () => {
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const emitter = { emit: jest.fn() } as unknown as EventEmitter2;

  function service(db: object) {
    return new OverbookingService({ db } as never, auditoria as never, emitter);
  }

  it('detalhar 404 quando pendência inexistente', async () => {
    const db = {
      select: jest.fn().mockReturnValue({
        from: () => ({ where: () => Promise.resolve([]) }),
      }),
    };
    await expect(service(db).detalhar('019ea000-0000-7000-8000-0000000000bb'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('detalhar retorna histórico ordenado', async () => {
    const db = {
      select: jest.fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => Promise.resolve([{ id: 'p1', status: 'aberta' }]),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve([{ id: 'h1', acao: 'aberta' }]),
            }),
          }),
        }),
    };
    const result = await service(db).detalhar('p1');
    expect(result.historico).toHaveLength(1);
  });

  it('alterarStatus 404 quando update não retorna linha', async () => {
    const atual = { id: 'p1', status: 'aberta' };
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        select: jest.fn().mockReturnValue({
          from: () => ({
            where: () => ({
              for: () => ({
                limit: () => Promise.resolve([atual]),
              }),
            }),
          }),
        }),
        update: jest.fn(() => ({
          set: () => ({
            where: () => ({
              returning: () => Promise.resolve([]),
            }),
          }),
        })),
      })),
    };
    await expect(service(db).alterarStatus('p1', 'em_analise', {}, 'user-1'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('obterAtivaSobLock 404 via decidir em pendência inexistente', async () => {
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        select: jest.fn().mockReturnValue({
          from: () => ({
            where: () => ({
              for: () => ({
                limit: () => Promise.resolve([]),
              }),
            }),
          }),
        }),
      })),
    };
    await expect(service(db).decidir('p-missing', { status: 'em_analise', detalhe: {} }, 'user-1'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('listar aplica filtro de status quando informado', async () => {
    const db = {
      select: jest.fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => ({
                  offset: () => Promise.resolve([{ id: 'p1', status: 'aberta' }]),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => Promise.resolve([{ total: 1 }]),
          }),
        }),
    };
    const result = await service(db).listar({
      operacaoId: 'op-1',
      status: 'aberta',
      pagina: 1,
      limite: 20,
    });
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('listar usa total 0 quando count não retorna linha', async () => {
    const db = {
      select: jest.fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => ({
                  offset: () => Promise.resolve([]),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => Promise.resolve([]),
          }),
        }),
    };
    const result = await service(db).listar({
      operacaoId: 'op-1',
      pagina: 1,
      limite: 20,
    });
    expect(result.total).toBe(0);
  });

  it('alterarStatus rejeita transição inválida', async () => {
    const atual = { id: 'p1', status: 'resolvida' };
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        select: jest.fn().mockReturnValue({
          from: () => ({
            where: () => ({
              for: () => ({
                limit: () => Promise.resolve([atual]),
              }),
            }),
          }),
        }),
      })),
    };
    await expect(service(db).alterarStatus('p1', 'aberta', {}, 'user-1'))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('decidir emite evento de resolvida', async () => {
    const atual = { id: 'p1', status: 'compra_complementar_programada' };
    const atualizada = { id: 'p1', status: 'resolvida' };
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        select: jest.fn().mockReturnValue({
          from: () => ({
            where: () => ({
              for: () => ({
                limit: () => Promise.resolve([atual]),
              }),
            }),
          }),
        }),
        update: jest.fn(() => ({
          set: () => ({
            where: () => ({
              returning: () => Promise.resolve([atualizada]),
            }),
          }),
        })),
        insert: jest.fn(() => ({
          values: () => Promise.resolve(undefined),
        })),
      })),
    };
    const result = await service(db).decidir('p1', { status: 'resolvida', detalhe: { ok: true } }, 'user-1');
    expect(result.status).toBe('resolvida');
    expect(emitter.emit).toHaveBeenCalled();
  });
});
