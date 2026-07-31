import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AprovacoesService } from '../../src/modules/gestao/aprovacoes/aprovacoes.service';
import { EVENTOS } from '../../src/realtime/events/eventos';

function listChain(rows: unknown) {
  const terminal: Record<string, unknown> = {};
  const self = () => terminal;
  terminal.where = self;
  terminal.orderBy = self;
  terminal.limit = () => terminal;
  terminal.offset = () => Promise.resolve(rows);
  terminal.leftJoin = self;
  terminal.innerJoin = self;
  terminal.from = self;
  return { from: () => terminal };
}

function countChain(total: number | undefined, withInnerJoin = false) {
  const where = () => Promise.resolve(total === undefined ? [] : [{ total }]);
  if (withInnerJoin) {
    return {
      from: () => ({
        innerJoin: () => ({ where }),
      }),
    };
  }
  return { from: () => ({ where }) };
}

describe('AprovacoesService — branches', () => {
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const emitter = { emit: jest.fn() } as unknown as EventEmitter2;

  function service(db: object) {
    return new AprovacoesService({ db } as never, auditoria as never, emitter);
  }

  it('listar operacionais com filtros de status e busca', async () => {
    const db = {
      select: jest.fn()
        .mockReturnValueOnce(listChain([{ id: 'a1', status: 'pendente' }]))
        .mockReturnValueOnce(countChain(3)),
    };
    const res = await service(db).listar({
      operacaoId: 'op-1',
      aba: 'operacionais',
      status: 'pendente',
      busca: 'over',
      pagina: 2,
      limite: 10,
    });
    expect(res.data).toHaveLength(1);
    expect(res.total).toBe(3);
  });

  it('listar operacionais usa total 0 quando count vazio', async () => {
    const db = {
      select: jest.fn()
        .mockReturnValueOnce(listChain([]))
        .mockReturnValueOnce(countChain(undefined)),
    };
    const res = await service(db).listar({
      operacaoId: 'op-1',
      aba: 'operacionais',
      pagina: 1,
      limite: 20,
    });
    expect(res.total).toBe(0);
  });

  it('listar ocorrências quando aba = ocorrencias', async () => {
    const db = {
      select: jest.fn()
        .mockReturnValueOnce(listChain([{ id: 'o1', status: 'aberta' }]))
        .mockReturnValueOnce(countChain(1, true)),
    };
    const res = await service(db).listar({
      operacaoId: 'op-1',
      aba: 'ocorrencias',
      status: 'aberta',
      busca: 'fornec',
      pagina: 1,
      limite: 20,
    });
    expect(res.data).toHaveLength(1);
    expect(res.total).toBe(1);
  });

  it('abrir registra aprovação e emite evento', async () => {
    const aprovacao = {
      id: 'ap-1',
      operacaoId: 'op-1',
      tipo: 'ajuste',
      status: 'pendente',
    };
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        insert: jest.fn(() => ({
          values: () => ({ returning: () => Promise.resolve([aprovacao]) }),
        })),
        select: jest.fn(() => ({
          from: () => ({
            where: () => Promise.resolve([{ data: '2026-06-23' }]),
          }),
        })),
      })),
    };

    const res = await service(db).abrir({
      operacaoId: 'op-1',
      tipo: 'ajuste_estoque_relevante',
      origem: 'manual',
      descricao: 'Teste',
      impacto: 'baixo',
    }, 'user-1');

    expect(res).toEqual(aprovacao);
    expect(emitter.emit).toHaveBeenCalledWith(
      EVENTOS.APROVACAO_REGISTRADA,
      expect.objectContaining({ aprovacaoId: 'ap-1', dataOperacao: '2026-06-23' }),
    );
  });

  it('abrirNaTx falha quando insert não retorna linha', async () => {
    const tx = {
      insert: jest.fn(() => ({
        values: () => ({ returning: () => Promise.resolve([]) }),
      })),
    };
    await expect(
      (service({} as never) as unknown as {
        abrirNaTx: (tx: object, dto: object, userId: string) => Promise<unknown>;
      }).abrirNaTx(tx, {
        operacaoId: 'op-1',
        tipo: 'ajuste_estoque_relevante',
        origem: 'manual',
        descricao: 'x',
        impacto: 'baixo',
      }, 'user-1'),
    ).rejects.toThrow('Falha ao registrar solicitação de aprovação');
  });

  it('decidir rejeita solicitação já decidida', async () => {
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        select: jest.fn(() => ({
          from: () => ({
            where: () => ({
              for: () => Promise.resolve([{ id: 'ap-1', status: 'aprovada', operacaoId: 'op-1' }]),
            }),
          }),
        })),
      })),
    };
    await expect(service(db).decidir('ap-1', { decisao: 'aprovada', motivo: 'ok' }, 'user-1'))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('decidir 404 quando solicitação inexistente', async () => {
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        select: jest.fn(() => ({
          from: () => ({
            where: () => ({
              for: () => Promise.resolve([]),
            }),
          }),
        })),
      })),
    };
    await expect(service(db).decidir('ap-missing', { decisao: 'rejeitada', motivo: 'não' }, 'user-1'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('decidir aprova e emite evento', async () => {
    const atual = { id: 'ap-1', status: 'pendente', operacaoId: 'op-1', tipo: 'ajuste' };
    const decidida = { ...atual, status: 'aprovada', decisaoMotivo: 'ok' };
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        select: jest.fn()
          .mockReturnValueOnce({
            from: () => ({
              where: () => ({
                for: () => Promise.resolve([atual]),
              }),
            }),
          })
          .mockReturnValueOnce({
            from: () => ({
              where: () => Promise.resolve([{ data: '2026-06-24' }]),
            }),
          }),
        update: jest.fn(() => ({
          set: () => ({
            where: () => ({ returning: () => Promise.resolve([decidida]) }),
          }),
        })),
      })),
    };

    const res = await service(db).decidir('ap-1', { decisao: 'aprovada', motivo: 'ok' }, 'user-1');
    expect(res.status).toBe('aprovada');
    expect(emitter.emit).toHaveBeenCalledWith(
      EVENTOS.APROVACAO_DECIDIDA,
      expect.objectContaining({ aprovacaoId: 'ap-1', dataOperacao: '2026-06-24' }),
    );
  });

  it('dataDaOperacao 404 quando operação inexistente', async () => {
    const tx = {
      select: jest.fn(() => ({
        from: () => ({
          where: () => Promise.resolve([]),
        }),
      })),
    };
    await expect(
      (service({} as never) as unknown as {
        dataDaOperacao: (tx: object, operacaoId: string) => Promise<string>;
      }).dataDaOperacao(tx, 'op-missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
