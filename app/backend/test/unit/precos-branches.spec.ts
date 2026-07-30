import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrecosService } from '../../src/modules/comercial/precos/precos.service';

function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: () => chain,
    for: () => chain,
    then: (cb: (r: unknown[]) => unknown) => cb(rows),
  };
  return chain;
}

describe('PrecosService — branches', () => {
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const emitter = new EventEmitter2();
  jest.spyOn(emitter, 'emit').mockReturnValue(true);

  function makeService(db: Record<string, unknown>) {
    return new PrecosService({ db } as never, auditoria as never, emitter);
  }

  beforeEach(() => jest.clearAllMocks());

  it('listar sem total retorna zero', async () => {
    const db = { select: jest.fn(() => makeSelectChain([])) };
    const service = makeService(db);
    const result = await service.listar({ page: 1, pageSize: 20 } as never);
    expect(result.total).toBe(0);
  });

  it('historico lança 404 quando tabela não existe', async () => {
    const db = { select: jest.fn(() => makeSelectChain([])) };
    const service = makeService(db);
    await expect(service.historico('tab-x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('detalhar lança 404 quando tabela não existe', async () => {
    const db = { select: jest.fn(() => makeSelectChain([])) };
    const service = makeService(db);
    await expect(service.detalhar('tab-x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('copiar recusa origem igual ao destino', async () => {
    const tx = {
      select: jest.fn(() => makeSelectChain([{ id: 'tab1', status: 'rascunho', data: '2026-08-01' }])),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    await expect(service.copiar('tab1', { origemId: 'tab1' }, 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('copiar com origemId sem linhas lança 409', async () => {
    const tx = {
      select: jest.fn()
        .mockReturnValueOnce(makeSelectChain([{ id: 'dest', status: 'rascunho', data: '2026-08-02' }]))
        .mockReturnValueOnce(makeSelectChain([{ id: 'origem-vazia' }]))
        .mockReturnValueOnce(makeSelectChain([])),
      update: jest.fn(() => ({ set: () => ({ where: () => Promise.resolve() }) })),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    await expect(service.copiar('dest', { origemId: 'origem-vazia' }, 'u1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('salvarItens em rascunho não registra reversão de publicada', async () => {
    const tx = {
      select: jest.fn(() => makeSelectChain([{ id: 'tab1', status: 'rascunho', data: '2026-08-01' }])),
      insert: jest.fn(() => ({ values: () => ({ onConflictDoUpdate: () => Promise.resolve() }) })),
      update: jest.fn(() => ({ set: () => ({ where: () => Promise.resolve() }) })),
    };
    const db = {
      transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)),
      select: jest.fn()
        .mockReturnValueOnce(makeSelectChain([{ id: 'tab1', status: 'rascunho', data: '2026-08-01' }]))
        .mockReturnValueOnce(makeSelectChain([]))
        .mockReturnValueOnce(makeSelectChain([])),
    };
    const service = makeService(db);
    await service.salvarItens('tab1', { itens: [{ produtoId: 'p1', precoA: 1, precoB: 2, precoC: 3, precoD: 4 }] }, 'u1');
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('criar duplicada lança 409', async () => {
    const tx = {
      select: jest.fn(() => makeSelectChain([{ id: 'tab-dup' }])),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    await expect(service.criar({ data: '2026-08-01' } as never, 'u1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('copiar sem origemId usa última publicada anterior', async () => {
    const tx = {
      select: jest.fn()
        .mockReturnValueOnce(makeSelectChain([{ id: 'dest', status: 'rascunho', data: '2026-08-10' }]))
        .mockReturnValueOnce(makeSelectChain([{ id: 'ultima' }]))
        .mockReturnValueOnce(makeSelectChain([{ id: 'ultima' }]))
        .mockReturnValueOnce(makeSelectChain([{
          produtoId: 'p1', precoA: '10.00', precoB: '11.00', precoC: '12.00', precoD: '13.00',
        }])),
      update: jest.fn(() => ({ set: () => ({ where: () => Promise.resolve() }) })),
    };
    const db = {
      transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)),
      select: jest.fn()
        .mockReturnValueOnce(makeSelectChain([{ id: 'dest', status: 'rascunho', data: '2026-08-10' }]))
        .mockReturnValueOnce(makeSelectChain([]))
        .mockReturnValueOnce(makeSelectChain([])),
    };
    const service = makeService(db);
    await service.copiar('dest', {}, 'u1');
    expect(tx.update).toHaveBeenCalled();
  });

  it('copiar em tabela publicada registra reversão para rascunho', async () => {
    const tx = {
      select: jest.fn()
        .mockReturnValueOnce(makeSelectChain([{ id: 'dest', status: 'publicada', data: '2026-08-11' }]))
        .mockReturnValueOnce(makeSelectChain([{ id: 'origem' }]))
        .mockReturnValueOnce(makeSelectChain([{
          produtoId: 'p1', precoA: '10.00', precoB: '11.00', precoC: '12.00', precoD: '13.00',
        }])),
      update: jest.fn(() => ({ set: () => ({ where: () => Promise.resolve() }) })),
      insert: jest.fn(() => ({ values: () => Promise.resolve() })),
    };
    const db = {
      transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)),
      select: jest.fn()
        .mockReturnValueOnce(makeSelectChain([{ id: 'dest', status: 'rascunho', data: '2026-08-11' }]))
        .mockReturnValueOnce(makeSelectChain([]))
        .mockReturnValueOnce(makeSelectChain([])),
    };
    const service = makeService(db);
    await service.copiar('dest', { origemId: 'origem' }, 'u1');
    expect(tx.insert).toHaveBeenCalled();
  });

  it('publicar com preços incompletos lança 400', async () => {
    const tx = {
      select: jest.fn()
        .mockReturnValueOnce(makeSelectChain([{ id: 'tab1', status: 'rascunho', data: '2026-08-01' }]))
        .mockReturnValueOnce(makeSelectChain([{ codigo: 'TZ', nome: 'Traseiro' }])),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    await expect(service.publicar('tab1', {}, 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
