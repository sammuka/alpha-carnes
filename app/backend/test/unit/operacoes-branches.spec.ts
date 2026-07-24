import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OperacoesService } from '../../src/modules/operacoes/operacoes.service';

describe('OperacoesService — branches', () => {
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const emitter = { emit: jest.fn() } as unknown as EventEmitter2;

  function service(db: object) {
    return new OperacoesService({ db } as never, auditoria as never, emitter);
  }

  it('garantirOperacao reconsulta após unique_violation (23505)', async () => {
    const concorrente = { id: 'op-1', data: '2026-09-01' };
    const tx = {
      select: jest.fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => Promise.resolve([]),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => Promise.resolve([concorrente]),
          }),
        }),
      insert: jest.fn(() => ({
        values: () => ({
          returning: () => Promise.reject(Object.assign(new Error('dup'), { code: '23505' })),
        }),
      })),
    };

    const result = await service({}).garantirOperacao(tx as never, '2026-09-01', 'user-1');
    expect(result).toEqual({ operacao: concorrente, criada: false });
  });

  it('garantirOperacao propaga erro que não é 23505', async () => {
    const tx = {
      select: jest.fn().mockReturnValue({
        from: () => ({ where: () => Promise.resolve([]) }),
      }),
      insert: jest.fn(() => ({
        values: () => ({
          returning: () => Promise.reject(Object.assign(new Error('boom'), { code: '23503' })),
        }),
      })),
    };

    await expect(service({}).garantirOperacao(tx as never, '2026-09-02', 'user-1'))
      .rejects.toThrow('boom');
  });

  it('garantirOperacao lê code em cause quando o wrapper não expõe code', async () => {
    const concorrente = { id: 'op-2', data: '2026-09-08' };
    const tx = {
      select: jest.fn()
        .mockReturnValueOnce({
          from: () => ({ where: () => Promise.resolve([]) }),
        })
        .mockReturnValueOnce({
          from: () => ({ where: () => Promise.resolve([concorrente]) }),
        }),
      insert: jest.fn(() => ({
        values: () => ({
          returning: () => Promise.reject(Object.assign(new Error('wrapped'), {
            cause: { code: '23505' },
          })),
        }),
      })),
    };
    await expect(service({}).garantirOperacao(tx as never, '2026-09-08', 'user-1'))
      .resolves.toEqual({ operacao: concorrente, criada: false });
  });

  it('detalhar 404 quando operação inexistente', async () => {
    const db = {
      select: jest.fn().mockReturnValue({
        from: () => ({ where: () => Promise.resolve([]) }),
      }),
    };
    await expect(service(db).detalhar('019ea000-0000-7000-8000-0000000000aa'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('alterarStatus rejeita transição inválida', async () => {
    const atual = { id: 'op-1', status: 'fechada', data: '2026-09-03' };
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        select: jest.fn().mockReturnValue({
          from: () => ({ where: () => Promise.resolve([atual]) }),
        }),
      })),
    };
    await expect(service(db).alterarStatus('op-1', 'aberta', 'user-1'))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('criarExtraordinaria 409 quando já existe operação na data', async () => {
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        insert: jest.fn(() => ({
          values: () => ({
            onConflictDoNothing: () => ({
              returning: () => Promise.resolve([]),
            }),
          }),
        })),
      })),
    };
    await expect(service(db).criarExtraordinaria(
      { data: '2026-09-04', rotulo: 'Extra' },
      'user-1',
    )).rejects.toBeInstanceOf(ConflictException);
  });

  it('garantirOperacao reusa operação já existente', async () => {
    const atual = { id: 'op-existente', data: '2026-09-05' };
    const tx = {
      select: jest.fn().mockReturnValue({
        from: () => ({ where: () => Promise.resolve([atual]) }),
      }),
    };
    const result = await service({}).garantirOperacao(tx as never, '2026-09-05');
    expect(result).toEqual({ operacao: atual, criada: false });
  });

  it('garantirOperacao cria quando insert retorna linha', async () => {
    const criada = { id: 'op-nova', data: '2026-09-06' };
    const values = jest.fn(() => ({
      returning: () => Promise.resolve([criada]),
    }));
    const tx = {
      select: jest.fn().mockReturnValue({
        from: () => ({ where: () => Promise.resolve([]) }),
      }),
      insert: jest.fn(() => ({ values })),
    };
    // Sem usuarioId → criadaPorId null (branch usuarioId ?? null).
    const result = await service({}).garantirOperacao(tx as never, '2026-09-06');
    expect(result).toEqual({ operacao: criada, criada: true });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ criadaPorId: null }));
  });

  it('encontrarAtivaPorData retorna null quando não há linha', async () => {
    const tx = {
      select: jest.fn().mockReturnValue({
        from: () => ({ where: () => Promise.resolve([]) }),
      }),
    };
    await expect(service({}).encontrarAtivaPorData(tx as never, '2026-09-07'))
      .resolves.toBeNull();
  });

  it('listar aplica filtros de e status com total zerado', async () => {
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
            where: () => Promise.resolve([{}]),
          }),
        }),
    };
    const result = await service(db).listar({
      de: '2026-09-01',
      ate: '2026-09-30',
      status: 'aberta',
      pagina: 1,
      limite: 10,
    });
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('alterarStatus 404 quando operação inexistente', async () => {
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        select: jest.fn().mockReturnValue({
          from: () => ({ where: () => Promise.resolve([]) }),
        }),
      })),
    };
    await expect(service(db).alterarStatus('op-x', 'em_andamento', 'user-1'))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
