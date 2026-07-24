import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OcorrenciaFornecedorService } from '../../src/modules/operacao/recebimento/ocorrencia/ocorrencia-fornecedor.service';

describe('OcorrenciaFornecedorService — branches', () => {
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const emitter = new EventEmitter2();
  const emitSpy = jest.spyOn(emitter, 'emit').mockReturnValue(true);

  beforeEach(() => jest.clearAllMocks());

  function makeSelectChain(rows: unknown[]) {
    const chain: {
      where: (...args: unknown[]) => typeof chain;
      then: (cb: (r: unknown[]) => unknown) => unknown;
    } = {
      where: () => chain,
      then: (cb) => cb(rows),
    };
    return { from: () => chain };
  }

  it('listar → total ausente (totalRow vazio) usa 0', async () => {
    const db = {
      select: jest.fn((sel?: unknown) => {
        if (sel) {
          // segunda chamada (count) — retorna array vazio, sem linha de total
          return { from: () => Promise.resolve([]) };
        }
        return {
          from: () => ({
            orderBy: () => ({
              limit: () => ({
                offset: () => Promise.resolve([{ id: 'oc1' }]),
              }),
            }),
          }),
        };
      }),
    };
    const service = new OcorrenciaFornecedorService({ db } as never, auditoria as never, emitter);
    const result = await service.listar({ page: 1, pageSize: 20 } as never);
    expect(result.total).toBe(0);
    expect(result.data).toEqual([{ id: 'oc1' }]);
  });

  it('atualizar → sem status/impacto no dto preserva valores anteriores', async () => {
    const anterior = { id: 'oc1', status: 'aberta', impacto: 'baixo', deletedAt: null };
    const atualizada = { id: 'oc1', status: 'aberta', impacto: 'baixo' };
    let selectCall = 0;
    const tx = {
      select: jest.fn(() => {
        selectCall++;
        return makeSelectChain([anterior]);
      }),
      update: jest.fn(() => ({
        set: (setArgs: Record<string, unknown>) => {
          expect(setArgs.status).toBe('aberta');
          expect(setArgs.impacto).toBe('baixo');
          return {
            where: () => ({
              returning: jest.fn(async () => [atualizada]),
            }),
          };
        },
      })),
      insert: jest.fn(() => ({ values: jest.fn(async () => undefined) })),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = new OcorrenciaFornecedorService({ db } as never, auditoria as never, emitter);

    const result = await service.atualizar('oc1', {} as never, 'u1');
    expect(result).toEqual(atualizada);
    expect(emitSpy).toHaveBeenCalled();
  });

  it('atualizar → lança 404 se ocorrência não encontrada', async () => {
    const tx = { select: jest.fn(() => makeSelectChain([])) };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = new OcorrenciaFornecedorService({ db } as never, auditoria as never, emitter);
    await expect(service.atualizar('oc-inexistente', {} as never, 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('atualizar → lança 409 se ocorrência já resolvida', async () => {
    const anterior = { id: 'oc1', status: 'resolvida', deletedAt: null };
    const tx = { select: jest.fn(() => makeSelectChain([anterior])) };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = new OcorrenciaFornecedorService({ db } as never, auditoria as never, emitter);
    await expect(service.atualizar('oc1', {} as never, 'u1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('emitirAbertura/emitirAtualizacao → sem dataOperacao emite string vazia', async () => {
    const ocorrencia = { id: 'oc1', fornecedorId: 'f1', status: 'aberta' } as never;
    const service = new OcorrenciaFornecedorService({} as never, auditoria as never, emitter);
    service.emitirAbertura(ocorrencia);
    expect(emitSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ dataOperacao: '' }));
    service.emitirAtualizacao(ocorrencia);
    expect(emitSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ dataOperacao: '' }));
  });

  it('resolverDataOperacao → sem compraProgramadaId retorna string vazia', async () => {
    const service = new OcorrenciaFornecedorService({} as never, auditoria as never, emitter);
    await expect(service.resolverDataOperacao(undefined)).resolves.toBe('');
    await expect(service.resolverDataOperacao(null)).resolves.toBe('');
  });

  it('resolverDataOperacao → compra encontrada retorna a data', async () => {
    const db = {
      select: jest.fn(() => ({
        from: () => ({
          innerJoin: () => ({
            where: () => Promise.resolve([{ dataOperacao: '2026-06-23' }]),
          }),
        }),
      })),
    };
    const service = new OcorrenciaFornecedorService({ db } as never, auditoria as never, emitter);
    await expect(service.resolverDataOperacao('cp1')).resolves.toBe('2026-06-23');
  });

  it('resolverDataOperacao → compra não encontrada retorna string vazia', async () => {
    const db = {
      select: jest.fn(() => ({
        from: () => ({
          innerJoin: () => ({
            where: () => Promise.resolve([]),
          }),
        }),
      })),
    };
    const service = new OcorrenciaFornecedorService({ db } as never, auditoria as never, emitter);
    await expect(service.resolverDataOperacao('cp1')).resolves.toBe('');
  });
});
