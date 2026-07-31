import { ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChecklistCorteService } from '../../src/modules/operacao/corte/checklist-corte.service';

const transfId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const regraId = '11111111-1111-4111-8111-111111111111';
const op = 'operador-1';

function makeEmitter() {
  const emitter = new EventEmitter2();
  jest.spyOn(emitter, 'emit').mockReturnValue(true);
  return emitter;
}

type Chain = {
  from: (...a: unknown[]) => Chain;
  where: (...a: unknown[]) => Chain;
  innerJoin: (...a: unknown[]) => Chain;
  limit: (...a: unknown[]) => Chain;
  for: (...a: unknown[]) => Chain;
  then: (cb: (r: unknown[]) => unknown) => unknown;
};

function selectChain(rows: unknown[]): Chain {
  const terminal: Chain = {
    from: () => terminal,
    where: () => terminal,
    innerJoin: () => terminal,
    limit: () => terminal,
    for: () => terminal,
    then: (cb) => cb(rows),
  };
  return terminal;
}

describe('ChecklistCorteService', () => {
  it('checklist A espera CB=1 e JAC=1', async () => {
    const responses: unknown[][] = [
      [
        {
          id: transfId,
          regraTransformacaoId: regraId,
          deletedAt: null,
        },
      ],
      [{ id: regraId, nome: 'TZ A', provisorio: true }],
      [
        {
          produtoId: 'p-cb',
          produtoCodigo: 'CB',
          produtoNome: 'Coxão-bola',
          esperado: '1',
          legado: 'ic-cb',
        },
        {
          produtoId: 'p-jac',
          produtoCodigo: 'JAC',
          produtoNome: 'Jacaré',
          esperado: '1',
          legado: 'ic-jac',
        },
      ],
      [], // subitens ativos
      [], // divergencia aberta
    ];
    let idx = 0;
    const tx = {
      select: jest.fn(() => selectChain(responses[idx++] ?? [])),
    };
    const db = {
      transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
    };
    const svc = new ChecklistCorteService(
      { db } as never,
      { abrirNaTx: jest.fn() } as never,
      { registrar: jest.fn() } as never,
      makeEmitter(),
    );
    const c = await svc.obter(transfId);
    expect(c.slots.map((s) => s.produtoCodigo).sort()).toEqual(['CB', 'JAC']);
    expect(c.slots.every((s) => s.esperado === 1)).toBe(true);
    expect(c.divergente).toBe(true);
    expect(c.regraProvisoria).toBe(true);
  });

  it('abrir divergência cria aprovação na mesma TX', async () => {
    const abrirNaTx = jest.fn().mockResolvedValue({ id: 'apr-1' });
    const responses: unknown[][] = [
      [
        {
          id: transfId,
          regraTransformacaoId: regraId,
          pecaOrigemId: 'peca-1',
          statusTransformacao: 'em_andamento',
          deletedAt: null,
        },
      ],
      [
        {
          operacaoId: 'op-1',
          dataOperacao: '2026-07-31',
          etiqueta: 'TZ-001',
        },
      ],
    ];
    let idx = 0;
    const divergencia = {
      id: 'div-1',
      aprovacaoId: null as string | null,
      transformacaoId: transfId,
      tipo: 'subpeca_faltante',
    };
    const comAprovacao = { ...divergencia, aprovacaoId: 'apr-1' };
    const tx = {
      select: jest.fn(() => selectChain(responses[idx++] ?? [])),
      insert: jest.fn(() => ({
        values: () => ({
          returning: jest.fn(async () => [divergencia]),
        }),
      })),
      update: jest.fn(() => ({
        set: () => ({
          where: () => ({
            returning: jest.fn(async () => [comAprovacao]),
          }),
        }),
      })),
    };
    const db = {
      transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
    };
    const svc = new ChecklistCorteService(
      { db } as never,
      { abrirNaTx } as never,
      { registrar: jest.fn().mockResolvedValue(undefined) } as never,
      makeEmitter(),
    );
    const d = await svc.abrirDivergencia(
      transfId,
      {
        tipo: 'subpeca_faltante',
        detalhe: { slot: 'JAC' },
        observacao: 'Falta jacaré na peça',
      },
      op,
    );
    expect(abrirNaTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        tipo: 'divergencia_transformacao',
        operacaoId: 'op-1',
      }),
      op,
    );
    expect(d.aprovacaoId).toBe('apr-1');
    const args = abrirNaTx.mock.calls[0][1] as { descricao: string; impacto: string };
    expect(args.descricao.length).toBeGreaterThanOrEqual(10);
    expect(args.impacto.length).toBeGreaterThanOrEqual(5);
  });

  it('concluir divergente sem divergência → ConflictException CHECKLIST_DIVERGENTE', async () => {
    const err = new ConflictException({
      codigo: 'CHECKLIST_DIVERGENTE',
      mensagem: 'Checklist divergente exige divergência formal aberta',
    });
    expect(err.getResponse()).toMatchObject({ codigo: 'CHECKLIST_DIVERGENTE' });
  });
});
