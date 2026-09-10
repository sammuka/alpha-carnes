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

  it('publicar completo emite e detalha', async () => {
    const tabela = { id: 'tab1', status: 'rascunho', data: '2026-08-01' };
    const tx = {
      select: jest.fn()
        .mockReturnValueOnce(makeSelectChain([tabela]))
        .mockReturnValueOnce(makeSelectChain([])),
      update: jest.fn(() => ({ set: () => ({ where: () => Promise.resolve() }) })),
      insert: jest.fn(() => ({ values: () => Promise.resolve() })),
    };
    const db = {
      transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)),
      select: jest.fn()
        .mockReturnValueOnce(makeSelectChain([{ ...tabela, status: 'publicada' }]))
        .mockReturnValueOnce(makeSelectChain([]))
        .mockReturnValueOnce(makeSelectChain([])),
    };
    const service = makeService(db);
    const detalhe = await service.publicar('tab1', { observacao: 'ok' }, 'u1');
    expect(detalhe.id).toBe('tab1');
    expect(emitter.emit).toHaveBeenCalled();
  });

  it('criar com catálogo vazio detalha após commit', async () => {
    const criada = { id: 'tab-new', data: '2026-08-20', status: 'rascunho' };
    const tx = {
      select: jest.fn()
        .mockReturnValueOnce(makeSelectChain([]))
        .mockReturnValueOnce(makeSelectChain([]))
        .mockReturnValueOnce(makeSelectChain([])),
      insert: jest.fn(() => ({ values: () => ({ returning: async () => [criada] }) })),
    };
    const db = {
      transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)),
      select: jest.fn()
        .mockReturnValueOnce(makeSelectChain([criada]))
        .mockReturnValueOnce(makeSelectChain([]))
        .mockReturnValueOnce(makeSelectChain([])),
    };
    const service = makeService(db);
    await expect(service.criar({ data: '2026-08-20' } as never, 'u1')).resolves.toMatchObject({ id: 'tab-new' });
  });

  it('criar preenche itens do catálogo a partir da última publicada', async () => {
    const criada = { id: 'tab-new', data: '2026-08-21', status: 'rascunho' };
    const tx = {
      select: jest.fn()
        .mockReturnValueOnce(makeSelectChain([]))
        .mockReturnValueOnce(makeSelectChain([{ id: 'p1' }]))
        .mockReturnValueOnce(makeSelectChain([{ id: 'tab-old' }]))
        .mockReturnValueOnce(makeSelectChain([{ id: 'tab-old' }]))
        .mockReturnValueOnce(makeSelectChain([{
          produtoId: 'p1', precoA: '1.00', precoB: '2.00', precoC: '3.00', precoD: '4.00',
        }])),
      insert: jest.fn()
        .mockReturnValueOnce({ values: () => ({ returning: async () => [criada] }) })
        .mockReturnValueOnce({ values: () => Promise.resolve() }),
    };
    const db = {
      transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)),
      select: jest.fn()
        .mockReturnValueOnce(makeSelectChain([criada]))
        .mockReturnValueOnce(makeSelectChain([]))
        .mockReturnValueOnce(makeSelectChain([])),
    };
    const service = makeService(db);
    await service.criar({ data: '2026-08-21' } as never, 'u1');
    expect(tx.insert).toHaveBeenCalledTimes(2);
  });

  it('salvarItens em publicada reverte e serializa null vs número', async () => {
    const publicada = { id: 'tab1', status: 'publicada', data: '2026-08-01' };
    const tx = {
      select: jest.fn(() => makeSelectChain([publicada])),
      insert: jest.fn(() => ({
        values: () => ({ onConflictDoUpdate: () => Promise.resolve() }),
      })),
      update: jest.fn(() => ({ set: () => ({ where: () => Promise.resolve() }) })),
    };
    const db = {
      transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)),
      select: jest.fn()
        .mockReturnValueOnce(makeSelectChain([{ ...publicada, status: 'rascunho' }]))
        .mockReturnValueOnce(makeSelectChain([]))
        .mockReturnValueOnce(makeSelectChain([])),
    };
    const service = makeService(db);
    await service.salvarItens('tab1', {
      itens: [
        { produtoId: 'p1', precoA: 10, precoB: null, precoC: 12, precoD: 13 },
      ],
    } as never, 'u1');
    expect(tx.update).toHaveBeenCalled();
    expect(tx.insert).toHaveBeenCalled();
  });

  it('copiar origem inexistente → 404; sem origem e sem publicada anterior → 409', async () => {
    const dest = { id: 'dest', status: 'rascunho', data: '2026-08-10' };
    const tx404 = {
      select: jest.fn()
        .mockReturnValueOnce(makeSelectChain([dest]))
        .mockReturnValueOnce(makeSelectChain([])),
    };
    await expect(
      makeService({ transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx404)) })
        .copiar('dest', { origemId: 'sumiu' }, 'u1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    const tx409 = {
      select: jest.fn()
        .mockReturnValueOnce(makeSelectChain([dest]))
        .mockReturnValueOnce(makeSelectChain([])),
    };
    await expect(
      makeService({ transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx409)) })
        .copiar('dest', {}, 'u1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('exigirTabela → 404 em salvarItens; listar inclui removidos', async () => {
    const tx = { select: jest.fn(() => makeSelectChain([])) };
    await expect(
      makeService({ transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) })
        .salvarItens('x', { itens: [] } as never, 'u1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    const db = { select: jest.fn(() => makeSelectChain([])) };
    const result = await makeService(db).listar({ page: 1, pageSize: 10, incluirRemovidos: true } as never);
    expect(result.total).toBe(0);
  });

  it('historico com tabela existente lista publicações', async () => {
    const db = {
      select: jest.fn()
        .mockReturnValueOnce(makeSelectChain([{ id: 'tab1' }]))
        .mockReturnValueOnce(makeSelectChain([{ acao: 'publicada' }])),
    };
    const hist = await makeService(db).historico('tab1');
    expect(hist).toEqual([{ acao: 'publicada' }]);
  });

  it('resolverPrecosVigentes cobre faixas, null e mapa vazio', async () => {
    const service = makeService({});
    const txVazio = { select: jest.fn(() => makeSelectChain([])) };
    await expect(service.resolverPrecosVigentes(txVazio as never, {
      produtoIds: [], faixa: 'A', data: '2026-08-01',
    })).resolves.toEqual(new Map());

    await expect(service.resolverPrecosVigentes(txVazio as never, {
      produtoIds: ['p1'], faixa: 'A', data: '2026-08-01',
    })).resolves.toEqual(new Map());

    await expect(service.resolverPrecoVigente(txVazio as never, {
      produtoId: 'p1', faixa: 'A', data: '2026-08-01',
    })).resolves.toBeNull();

    for (const faixa of ['A', 'B', 'C', 'D'] as const) {
      const tx = {
        select: jest.fn()
          .mockReturnValueOnce(makeSelectChain([{ id: 'tab1' }]))
          .mockReturnValueOnce(makeSelectChain([
            { produtoId: 'p1', preco: '10.00', unidadePreco: 'kg' },
            { produtoId: 'p2', preco: null, unidadePreco: 'kg' },
          ])),
      };
      const mapa = await service.resolverPrecosVigentes(tx as never, {
        produtoIds: ['p1', 'p2'], faixa, data: '2026-08-01',
      });
      expect(mapa.get('p1')).toEqual({
        preco: '10.00', unidadePreco: 'kg', tabelaPrecoId: 'tab1',
      });
      expect(mapa.has('p2')).toBe(false);
    }
  });

  it('vigentePorClienteOperacao — 404/409 e hit/miss', async () => {
    const tx404 = { select: jest.fn(() => makeSelectChain([])) };
    await expect(
      makeService({ transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx404)) })
        .vigentePorClienteOperacao({ produtoIds: ['p1'], clienteId: 'c-x', operacaoId: 'op1' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    const txFaixa = { select: jest.fn(() => makeSelectChain([{ id: 'c1', faixaPreco: null }])) };
    await expect(
      makeService({ transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(txFaixa)) })
        .vigentePorClienteOperacao({ produtoIds: ['p1'], clienteId: 'c1', operacaoId: 'op1' }),
    ).rejects.toBeInstanceOf(ConflictException);

    const txOp = {
      select: jest.fn()
        .mockReturnValueOnce(makeSelectChain([{ id: 'c1', faixaPreco: 'B' }]))
        .mockReturnValueOnce(makeSelectChain([])),
    };
    await expect(
      makeService({ transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(txOp)) })
        .vigentePorClienteOperacao({ produtoIds: ['p1'], clienteId: 'c1', operacaoId: 'op-x' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    const txOk = {
      select: jest.fn()
        .mockReturnValueOnce(makeSelectChain([{ id: 'c1', faixaPreco: 'C' }]))
        .mockReturnValueOnce(makeSelectChain([{ id: 'op1', data: '2026-08-01' }]))
        .mockReturnValueOnce(makeSelectChain([{ id: 'tab1' }]))
        .mockReturnValueOnce(makeSelectChain([
          { produtoId: 'p1', preco: '9.00', unidadePreco: 'unidade' },
        ])),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(txOk)) };
    const rows = await makeService(db).vigentePorClienteOperacao({
      produtoIds: ['p1', 'p-miss'], clienteId: 'c1', operacaoId: 'op1',
    });
    expect(rows[0]).toEqual({
      produtoId: 'p1', preco: '9.00', unidadePreco: 'unidade', tabelaPrecoId: 'tab1',
    });
    expect(rows[1]).toEqual({
      produtoId: 'p-miss', preco: null, unidadePreco: null, tabelaPrecoId: null,
    });
  });
});
