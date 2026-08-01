import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RegraCorteService } from '../../src/modules/operacao/corte/regra-corte.service';

const regraA = '11111111-1111-4111-8111-111111111111';
const regraB = '22222222-2222-4222-8222-222222222222';
const uuidInexistente = '99999999-9999-4999-8999-999999999999';
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const op = 'operador-1';

function makeEmitter() {
  const emitter = new EventEmitter2();
  jest.spyOn(emitter, 'emit').mockReturnValue(true);
  return emitter;
}

function makeAuditoria() {
  return { registrar: jest.fn().mockResolvedValue(undefined) };
}

type Chain = {
  from: (...a: unknown[]) => Chain;
  where: (...a: unknown[]) => Chain;
  for: (...a: unknown[]) => Chain;
  innerJoin: (...a: unknown[]) => Chain;
  limit: (...a: unknown[]) => Chain;
  then: (cb: (r: unknown[]) => unknown) => unknown;
};

function selectChain(rows: unknown[]): Chain {
  const terminal: Chain = {
    from: () => terminal,
    where: () => terminal,
    for: () => terminal,
    innerJoin: () => terminal,
    limit: () => terminal,
    then: (cb) => cb(rows),
  };
  return terminal;
}

function makeSvc(opts: {
  transf: Record<string, unknown> | null;
  regra?: Record<string, unknown> | null;
  subitemCount?: number;
  dataOperacao?: string;
}) {
  const upd = {
    id,
    regraTransformacaoId: regraA,
    statusTransformacao: 'em_andamento',
  };
  let selectIdx = 0;
  const responses: unknown[][] = [];
  // 1) transformacao for update
  responses.push(opts.transf ? [opts.transf] : []);
  // 2) regra (se transf ok e não fechada)
  if (opts.transf && !['concluida', 'cancelada'].includes(String(opts.transf.statusTransformacao))) {
    responses.push(opts.regra === null ? [] : opts.regra ? [opts.regra] : []);
    // 3) count subitens
    if (opts.regra) {
      responses.push([{ c: opts.subitemCount ?? 0 }]);
      // 4) dataOperacaoPorPeca
      responses.push([{ data: opts.dataOperacao ?? '2026-07-31' }]);
    }
  }

  const tx = {
    select: jest.fn(() => selectChain(responses[selectIdx++] ?? [])),
    update: jest.fn(() => ({
      set: () => ({
        where: () => ({
          returning: jest.fn(async () => [upd]),
        }),
      }),
    })),
  };
  const db = {
    transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
  };
  return new RegraCorteService({ db } as never, makeAuditoria() as never, makeEmitter());
}

describe('RegraCorteService', () => {
  it('vincula regra A em transformação aberta', async () => {
    const svc = makeSvc({
      transf: {
        id,
        statusTransformacao: 'em_andamento',
        regraTransformacaoId: null,
        pecaOrigemId: 'p1',
        deletedAt: null,
      },
      regra: {
        id: regraA,
        status: 'ativo',
        produtoOrigemCodigo: 'TZ',
        deletedAt: null,
      },
      subitemCount: 0,
    });
    const out = await svc.vincular(id, { regraTransformacaoId: regraA }, op);
    expect(out?.regraTransformacaoId).toBe(regraA);
  });

  it('bloqueia troca após subitem ativo', async () => {
    const svc = makeSvc({
      transf: {
        id,
        statusTransformacao: 'em_andamento',
        regraTransformacaoId: regraA,
        pecaOrigemId: 'p1',
        deletedAt: null,
      },
      regra: {
        id: regraB,
        status: 'ativo',
        produtoOrigemCodigo: 'TZ',
        deletedAt: null,
      },
      subitemCount: 1,
    });
    await expect(svc.vincular(id, { regraTransformacaoId: regraB }, op)).rejects.toMatchObject({
      response: {
        codigo: 'REGRA_BLOQUEADA_APOS_SAIDA',
        mensagem: expect.stringMatching(/primeira saída/i),
      },
    });
  });

  it('rejeita regra inativa/inexistente', async () => {
    const svc = makeSvc({
      transf: {
        id,
        statusTransformacao: 'em_andamento',
        regraTransformacaoId: null,
        pecaOrigemId: 'p1',
        deletedAt: null,
      },
      regra: null,
    });
    await expect(
      svc.vincular(id, { regraTransformacaoId: uuidInexistente }, op),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lança ConflictException se origem ≠ TZ', async () => {
    const svc = makeSvc({
      transf: {
        id,
        statusTransformacao: 'em_andamento',
        regraTransformacaoId: null,
        pecaOrigemId: 'p1',
        deletedAt: null,
      },
      regra: {
        id: regraA,
        status: 'ativo',
        produtoOrigemCodigo: 'DT',
        deletedAt: null,
      },
    });
    await expect(svc.vincular(id, { regraTransformacaoId: regraA }, op)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('NotFound quando transformação não existe', async () => {
    const svc = makeSvc({ transf: null });
    await expect(svc.vincular(id, { regraTransformacaoId: regraA }, op)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('ConflictException quando transformação está fechada', async () => {
    const svc = makeSvc({
      transf: {
        id,
        statusTransformacao: 'cancelada',
        regraTransformacaoId: null,
        pecaOrigemId: 'p1',
        deletedAt: null,
      },
    });
    await expect(svc.vincular(id, { regraTransformacaoId: regraA }, op)).rejects.toMatchObject({
      response: { codigo: 'TRANSFORMACAO_FECHADA' },
    });
  });

  it('permite reafirmar a mesma regra após subitem ativo', async () => {
    const svc = makeSvc({
      transf: {
        id,
        statusTransformacao: 'em_andamento',
        regraTransformacaoId: regraA,
        pecaOrigemId: 'p1',
        deletedAt: null,
      },
      regra: {
        id: regraA,
        status: 'ativo',
        produtoOrigemCodigo: 'TZ',
        deletedAt: null,
      },
      subitemCount: 2,
    });
    const out = await svc.vincular(id, { regraTransformacaoId: regraA }, op);
    expect(out?.regraTransformacaoId).toBe(regraA);
  });

  it('dataOperacao vazia quando peça sem operação', async () => {
    const upd = {
      id,
      regraTransformacaoId: regraA,
      statusTransformacao: 'em_andamento',
    };
    let selectIdx = 0;
    const responses: unknown[][] = [
      [
        {
          id,
          statusTransformacao: 'em_andamento',
          regraTransformacaoId: null,
          pecaOrigemId: 'p1',
          deletedAt: null,
        },
      ],
      [
        {
          id: regraA,
          status: 'ativo',
          produtoOrigemCodigo: 'TZ',
          deletedAt: null,
        },
      ],
      [], // count vazio → ?? 0
      [], // dataOperacaoPorPeca sem row
    ];
    const tx = {
      select: jest.fn(() => selectChain(responses[selectIdx++] ?? [])),
      update: jest.fn(() => ({
        set: () => ({
          where: () => ({
            returning: jest.fn(async () => [upd]),
          }),
        }),
      })),
    };
    const db = {
      transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
    };
    const emitter = makeEmitter();
    const svc = new RegraCorteService(
      { db } as never,
      makeAuditoria() as never,
      emitter,
    );
    await svc.vincular(id, { regraTransformacaoId: regraA }, op);
    expect(emitter.emit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ dataOperacao: '', motivo: 'regra_vinculada' }),
    );
  });
});
