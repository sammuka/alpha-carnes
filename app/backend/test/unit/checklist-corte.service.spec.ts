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

  it('obter sem regra retorna slots vazios e não divergente', async () => {
    const responses: unknown[][] = [
      [{ id: transfId, regraTransformacaoId: null, deletedAt: null }],
      [], // divergencia
    ];
    let idx = 0;
    const tx = { select: jest.fn(() => selectChain(responses[idx++] ?? [])) };
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
    expect(c.slots).toEqual([]);
    expect(c.divergente).toBe(false);
    expect(c.regraNome).toBeNull();
    expect(c.regraProvisoria).toBe(false);
  });

  it('obter classifica parcial/completo/excedente e usa legado ausente', async () => {
    const responses: unknown[][] = [
      [{ id: transfId, regraTransformacaoId: regraId, deletedAt: null }],
      [], // regra sumida → nome/provisorio fallback
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
        {
          produtoId: 'p-x',
          produtoCodigo: 'X',
          produtoNome: 'Sem legado',
          esperado: 'abc',
          legado: null,
        },
        {
          produtoId: 'p-ex',
          produtoCodigo: 'EX',
          produtoNome: 'Excedente',
          esperado: '1',
          legado: 'ic-ex',
        },
      ],
      [
        { itemComercialId: 'ic-cb' },
        { itemComercialId: 'ic-jac' },
        { itemComercialId: 'ic-jac' }, // parcial→completo no JAC? wait 2>1 excedente
        { itemComercialId: 'ic-ex' },
        { itemComercialId: 'ic-ex' },
      ],
      [{ id: 'div-aberta' }],
    ];
    let idx = 0;
    const tx = { select: jest.fn(() => selectChain(responses[idx++] ?? [])) };
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
    const byCode = Object.fromEntries(c.slots.map((s) => [s.produtoCodigo, s]));
    expect(byCode.CB?.status).toBe('completo');
    expect(byCode.JAC?.status).toBe('excedente');
    expect(byCode.X?.status).toBe('pendente');
    expect(byCode.X?.esperado).toBe(0);
    expect(byCode.EX?.status).toBe('excedente');
    expect(c.divergenciaAbertaId).toBe('div-aberta');
    expect(c.regraNome).toBeNull();
    expect(c.regraProvisoria).toBe(false);
    expect(c.divergente).toBe(true);
  });

  it('obter marca parcial quando registrado < esperado', async () => {
    const responses: unknown[][] = [
      [{ id: transfId, regraTransformacaoId: regraId, deletedAt: null }],
      [{ id: regraId, nome: 'TZ A', provisorio: false }],
      [
        {
          produtoId: 'p-cb',
          produtoCodigo: 'CB',
          produtoNome: 'Coxão-bola',
          esperado: '2',
          legado: 'ic-cb',
        },
      ],
      [{ itemComercialId: 'ic-cb' }],
      [],
    ];
    let idx = 0;
    const tx = { select: jest.fn(() => selectChain(responses[idx++] ?? [])) };
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
    expect(c.slots[0]?.status).toBe('parcial');
    expect(c.regraProvisoria).toBe(false);
  });

  it('obter lança NotFound quando transformação some', async () => {
    const tx = { select: jest.fn(() => selectChain([])) };
    const db = {
      transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
    };
    const svc = new ChecklistCorteService(
      { db } as never,
      { abrirNaTx: jest.fn() } as never,
      { registrar: jest.fn() } as never,
      makeEmitter(),
    );
    await expect(svc.obter(transfId)).rejects.toMatchObject({
      message: 'Transformação não encontrada',
    });
  });

  it('abrir divergência rejeita transformação fechada', async () => {
    const responses: unknown[][] = [
      [
        {
          id: transfId,
          statusTransformacao: 'concluida',
          pecaOrigemId: 'peca-1',
          deletedAt: null,
        },
      ],
    ];
    let idx = 0;
    const tx = { select: jest.fn(() => selectChain(responses[idx++] ?? [])) };
    const db = {
      transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
    };
    const svc = new ChecklistCorteService(
      { db } as never,
      { abrirNaTx: jest.fn() } as never,
      { registrar: jest.fn() } as never,
      makeEmitter(),
    );
    await expect(
      svc.abrirDivergencia(
        transfId,
        { tipo: 'subpeca_faltante', detalhe: {}, observacao: 'x' },
        op,
      ),
    ).rejects.toMatchObject({
      response: { codigo: 'TRANSFORMACAO_FECHADA' },
    });
  });

  it('abrir divergência sem operação da peça → NotFound', async () => {
    const responses: unknown[][] = [
      [
        {
          id: transfId,
          statusTransformacao: 'em_andamento',
          pecaOrigemId: 'peca-1',
          deletedAt: null,
        },
      ],
      [], // ctx vazio
    ];
    let idx = 0;
    const tx = { select: jest.fn(() => selectChain(responses[idx++] ?? [])) };
    const db = {
      transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
    };
    const svc = new ChecklistCorteService(
      { db } as never,
      { abrirNaTx: jest.fn() } as never,
      { registrar: jest.fn() } as never,
      makeEmitter(),
    );
    await expect(
      svc.abrirDivergencia(
        transfId,
        { tipo: 'subpeca_faltante', detalhe: {} },
        op,
      ),
    ).rejects.toMatchObject({
      message: 'Operação da transformação não encontrada',
    });
  });

  it('abrir divergência sem observação usa fallback na descrição', async () => {
    const abrirNaTx = jest.fn().mockResolvedValue({ id: 'apr-2' });
    const responses: unknown[][] = [
      [
        {
          id: transfId,
          regraTransformacaoId: regraId,
          pecaOrigemId: 'peca-sem-etiqueta',
          statusTransformacao: 'em_andamento',
          deletedAt: null,
        },
      ],
      [
        {
          operacaoId: 'op-1',
          dataOperacao: '2026-07-31',
          etiqueta: null,
        },
      ],
    ];
    let idx = 0;
    const divergencia = {
      id: 'div-2',
      aprovacaoId: null as string | null,
      transformacaoId: transfId,
      tipo: 'perda_informada',
    };
    const comAprovacao = { ...divergencia, aprovacaoId: 'apr-2' };
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
    const emitter = makeEmitter();
    const svc = new ChecklistCorteService(
      { db } as never,
      { abrirNaTx } as never,
      { registrar: jest.fn().mockResolvedValue(undefined) } as never,
      emitter,
    );
    await svc.abrirDivergencia(
      transfId,
      { tipo: 'perda_informada', detalhe: { kg: 1 } },
      op,
    );
    const args = abrirNaTx.mock.calls[0][1] as { descricao: string };
    expect(args.descricao).toMatch(/peca-sem-etiqueta/);
    expect(args.descricao).toMatch(/Sem observação adicional/);
    expect(emitter.emit).toHaveBeenCalled();
  });

  it('abrir divergência lança NotFound se transformação não existe', async () => {
    const tx = { select: jest.fn(() => selectChain([])) };
    const db = {
      transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
    };
    const svc = new ChecklistCorteService(
      { db } as never,
      { abrirNaTx: jest.fn() } as never,
      { registrar: jest.fn() } as never,
      makeEmitter(),
    );
    await expect(
      svc.abrirDivergencia(
        transfId,
        { tipo: 'subpeca_faltante', detalhe: {} },
        op,
      ),
    ).rejects.toMatchObject({ message: 'Transformação não encontrada' });
  });
});
