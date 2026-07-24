import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ComprasProgramadasService } from '../../src/modules/comercial/compras-programadas/compras-programadas.service';

function makeSelectChain(rows: unknown[]) {
  const chain: {
    where: (...args: unknown[]) => typeof chain;
    orderBy: (...args: unknown[]) => typeof chain;
    limit: (...args: unknown[]) => typeof chain;
    offset: (...args: unknown[]) => typeof chain;
    then: (cb: (r: unknown[]) => unknown) => unknown;
  } = {
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: () => chain,
    then: (cb) => cb(rows),
  };
  return { from: () => chain };
}

describe('ComprasProgramadasService — branches', () => {
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const emitter = new EventEmitter2();
  jest.spyOn(emitter, 'emit').mockReturnValue(true);
  const disponibilidadeService = { gerarParaCompra: jest.fn().mockResolvedValue([]) };
  const operacoesService = { garantirOperacao: jest.fn() };

  function makeService(dbOverrides: Record<string, unknown>) {
    return new ComprasProgramadasService(
      { db: dbOverrides } as never,
      auditoria as never,
      emitter,
      disponibilidadeService as never,
      operacoesService as never,
    );
  }

  beforeEach(() => jest.clearAllMocks());

  it('listar → sem linha de total usa 0', async () => {
    const db = {
      select: jest.fn((sel?: unknown) => (sel
        ? { from: () => ({ where: () => Promise.resolve([]) }) }
        : makeSelectChain([{ id: 'cp1' }]))),
    };
    const service = makeService(db);
    const result = await service.listar({ page: 1, pageSize: 20 } as never);
    expect(result.total).toBe(0);
  });

  it('criar → lança 409 se já existe compra ativa na data', async () => {
    operacoesService.garantirOperacao.mockResolvedValue({ operacao: { id: 'op1' } });
    const tx = { select: jest.fn(() => makeSelectChain([{ id: 'cp-existente' }])) };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    await expect(
      service.criar({ dataOperacao: '2026-06-23', fornecedorId: 'f1', itens: [] } as never, 'u1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('atualizar → lança 404 se compra não encontrada', async () => {
    const tx = { select: jest.fn(() => makeSelectChain([])) };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    await expect(service.atualizar('cp-x', {} as never, 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('atualizar → aplica todos os campos informados no dto (sem usar fallback do anterior)', async () => {
    const anterior = {
      id: 'cp1',
      status: 'rascunho',
      fornecedorId: 'f1',
      numeroInterno: 'ANT-1',
      referenciaExterna: 'REF-ANT',
      previsaoEntrega: null,
      observacoes: 'obs-antiga',
      deletedAt: null,
    };
    const atualizada = { ...anterior, numeroInterno: 'NOVO-1', observacoes: 'obs-nova', status: 'em_negociacao' };
    const tx = {
      select: jest.fn(() => makeSelectChain([anterior])),
      update: jest.fn((setArgs: unknown) => ({
        set: (v: Record<string, unknown>) => {
          expect(v.numeroInterno).toBe('NOVO-1');
          expect(v.observacoes).toBe('obs-nova');
          expect(v.status).toBe('em_negociacao');
          expect(v.previsaoEntrega).toBeInstanceOf(Date);
          return {
            where: () => ({
              returning: jest.fn(async () => [atualizada]),
            }),
          };
        },
      })),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    const result = await service.atualizar('cp1', {
      numeroInterno: 'NOVO-1',
      observacoes: 'obs-nova',
      status: 'em_negociacao',
      previsaoEntrega: '2026-07-01',
    } as never, 'u1');
    expect(result).toEqual(atualizada);
  });

  it('atualizarItem → lança 404 se compra não encontrada', async () => {
    const tx = { select: jest.fn(() => makeSelectChain([])) };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    await expect(service.atualizarItem('cp-x', 'it1', {} as never, 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('atualizarItem → lança 404 se item não encontrado', async () => {
    const compra = { id: 'cp1', status: 'rascunho', deletedAt: null };
    let call = 0;
    const tx = {
      select: jest.fn(() => {
        call++;
        if (call === 1) return makeSelectChain([compra]);
        return makeSelectChain([]);
      }),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    await expect(service.atualizarItem('cp1', 'it-x', {} as never, 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('atualizarItem → usa quantidadeComprada informada no dto', async () => {
    const compra = { id: 'cp1', status: 'rascunho', deletedAt: null };
    const itemAnterior = { id: 'it1', quantidadeComprada: '10.000', observacoes: null, deletedAt: null };
    const atualizado = { id: 'it1', quantidadeComprada: '25.000' };
    let call = 0;
    const tx = {
      select: jest.fn(() => {
        call++;
        if (call === 1) return makeSelectChain([compra]);
        return makeSelectChain([itemAnterior]);
      }),
      update: jest.fn(() => ({
        set: (v: Record<string, unknown>) => {
          expect(v.quantidadeComprada).toBe('25');
          return { where: () => ({ returning: jest.fn(async () => [atualizado]) }) };
        },
      })),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    const result = await service.atualizarItem('cp1', 'it1', { quantidadeComprada: 25 } as never, 'u1');
    expect(result).toEqual(atualizado);
  });

  it('confirmar → evento usa string vazia quando operação não é encontrada', async () => {
    const atual = { id: 'cp1', status: 'rascunho', operacaoId: 'op1', deletedAt: null };
    const confirmada = { id: 'cp1', status: 'confirmada', operacaoId: 'op1' };
    const tx = {
      select: jest.fn(() => makeSelectChain([atual])),
      update: jest.fn(() => ({
        set: () => ({
          where: () => ({
            returning: jest.fn(() => ({ then: (cb: (r: unknown[]) => unknown) => cb([confirmada]) })),
          }),
        }),
      })),
    };
    const dbSelect = jest.fn(() => makeSelectChain([]));
    const db = {
      transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)),
      select: dbSelect,
    };
    const service = makeService(db);
    const emitSpy = jest.spyOn(emitter, 'emit');
    await service.confirmar('cp1', 'u1');
    expect(emitSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ dataOperacao: '' }));
  });

  it('cancelar → lança 404 se compra não encontrada', async () => {
    const tx = { select: jest.fn(() => makeSelectChain([])) };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    await expect(service.cancelar('cp-x', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
