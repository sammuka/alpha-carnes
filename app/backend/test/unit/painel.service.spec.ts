import { NotFoundException } from '@nestjs/common';
import { PainelDesossaService } from '../../src/modules/operacao/desossa/painel.service';

type Chain = {
  from: (...a: unknown[]) => Chain;
  where: (...a: unknown[]) => Chain;
  innerJoin: (...a: unknown[]) => Chain;
  leftJoin: (...a: unknown[]) => Chain;
  orderBy: (...a: unknown[]) => Chain;
  limit: (...a: unknown[]) => Chain;
  then: (cb: (r: unknown[]) => unknown) => unknown;
};

function selectChain(rows: unknown[]): Chain {
  const terminal: Chain = {
    from: () => terminal,
    where: () => terminal,
    innerJoin: () => terminal,
    leftJoin: () => terminal,
    orderBy: () => terminal,
    limit: () => terminal,
    then: (cb) => cb(rows),
  };
  return terminal;
}

const operacaoId = '11111111-1111-4111-8111-111111111111';
const regraId = '22222222-2222-4222-8222-222222222222';

describe('PainelDesossaService', () => {
  it('monta painel com contexto de carga, regras e operação explícita', async () => {
    const faltas = {
      listarFaltas: jest.fn().mockResolvedValue([
        {
          produto: { id: 'prod-cb', codigo: 'CB', nome: 'Coxão-bola' },
          quantidadeFaltante: 5,
          quantidadeEstoque: 1,
          origem: 'TZ',
        },
        {
          produto: { id: 'prod-sem', codigo: 'XX', nome: 'Sem legado' },
          quantidadeFaltante: 1,
          quantidadeEstoque: 0,
          origem: 'TZ',
        },
      ]),
    };

    let selectIdx = 0;
    const responses: unknown[][] = [
      // produtos (legado)
      [
        { id: 'prod-cb', legado: 'ic-cb' },
        { id: 'prod-sem', legado: null },
      ],
      // contextoCargaPorproduto — 2 linhas mesmo item (2ª ignorada)
      [
        {
          produtoId: 'ic-cb',
          rotaCaminhao: 'Centro',
          rotaPrevista: null,
          horaAbertura: new Date('2026-07-31T14:30:00.000Z'),
          representanteNome: 'Sabrina',
        },
        {
          produtoId: 'ic-cb',
          rotaCaminhao: 'Outra',
          rotaPrevista: null,
          horaAbertura: new Date('2026-07-31T15:00:00.000Z'),
          representanteNome: 'Outro',
        },
        {
          produtoId: 'ic-rota-so',
          rotaCaminhao: null,
          rotaPrevista: 'Sul',
          horaAbertura: null,
          representanteNome: null,
        },
      ],
      // tzsNaDesossa
      [{ n: '3' }],
      // regras ativas
      [
        {
          id: regraId,
          codigo: 'TZ_A',
          nome: 'Alternativa A',
          provisorio: true,
          prioridade: 1,
        },
      ],
      // saidas da regra
      [
        { codigo: 'CB', qtd: '1' },
        { codigo: null, qtd: '1' },
        { codigo: 'JAC', qtd: '1' },
      ],
    ];

    const db = {
      select: jest.fn(() => selectChain(responses[selectIdx++] ?? [])),
    };
    const svc = new PainelDesossaService({ db } as never, faltas as never);
    const painel = await svc.obter({ operacaoId, modoTv: false });
    expect(painel.operacaoId).toBe(operacaoId);
    expect(painel.totais.tzsNaDesossa).toBe(3);
    expect(painel.itens[0]).toMatchObject({
      produtoCodigo: 'CB',
      rota: expect.stringMatching(/Carga Centro/),
      representante: 'Sabrina',
      horarioAlvo: expect.any(String),
    });
    expect(painel.itens[1]).toMatchObject({
      produtoCodigo: 'XX',
      rota: null,
      representante: null,
    });
    expect(painel.regras[0]?.sobras).toBeDefined();
    expect(selectIdx).toBe(5);
  });

  it('modoTv e resolução de operação aberta quando operacaoId omisso', async () => {
    const faltas = { listarFaltas: jest.fn().mockResolvedValue([]) };
    let selectIdx = 0;
    const responses: unknown[][] = [
      // sem faltas → pula produtos e contexto (produtoIds vazio)
      // tzsNaDesossa com n inválido
      [{ n: 'x' }],
      // regras vazias
      [],
      // operação aberta
      [{ id: operacaoId }],
    ];
    const db = {
      select: jest.fn(() => selectChain(responses[selectIdx++] ?? [])),
    };
    const svc = new PainelDesossaService({ db } as never, faltas as never);
    const painel = await svc.obter({ modoTv: true });
    expect(painel.modoTv).toBe(true);
    expect(painel.operacaoId).toBe(operacaoId);
    expect(painel.totais.tzsNaDesossa).toBe(0);
    expect(painel.regras).toEqual([]);
    expect(painel.itens).toEqual([]);
  });

  it('projeta rota só com rótulo quando não há hora', async () => {
    const faltas = {
      listarFaltas: jest.fn().mockResolvedValue([
        {
          produto: { id: 'prod-cb', codigo: 'CB', nome: 'Coxão-bola' },
          quantidadeFaltante: 2,
          quantidadeEstoque: 0,
          origem: 'TZ',
        },
      ]),
    };
    let selectIdx = 0;
    const responses: unknown[][] = [
      [{ id: 'prod-cb', legado: 'ic-cb' }],
      [
        {
          produtoId: 'ic-cb',
          rotaCaminhao: 'Leste',
          rotaPrevista: null,
          horaAbertura: null,
          representanteNome: 'Rep',
        },
      ],
      [{ n: '0' }],
      [],
    ];
    const db = {
      select: jest.fn(() => selectChain(responses[selectIdx++] ?? [])),
    };
    const svc = new PainelDesossaService({ db } as never, faltas as never);
    const painel = await svc.obter({ operacaoId, modoTv: false });
    expect(painel.itens[0]?.rota).toBe('Carga Leste');
    expect(painel.itens[0]?.horarioAlvo).toBeNull();
  });

  it('NotFound quando não há operação aberta/em_andamento', async () => {
    const faltas = { listarFaltas: jest.fn().mockResolvedValue([]) };
    let selectIdx = 0;
    const responses: unknown[][] = [[{ n: '0' }], [], []];
    const db = {
      select: jest.fn(() => selectChain(responses[selectIdx++] ?? [])),
    };
    const svc = new PainelDesossaService({ db } as never, faltas as never);
    await expect(svc.obter({ modoTv: false })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('contexto sem rota nem hora fica null', async () => {
    const faltas = {
      listarFaltas: jest.fn().mockResolvedValue([
        {
          produto: { id: 'prod-cb', codigo: 'CB', nome: 'Coxão-bola' },
          quantidadeFaltante: 1,
          quantidadeEstoque: 0,
          origem: 'TZ',
        },
      ]),
    };
    let selectIdx = 0;
    const responses: unknown[][] = [
      [{ id: 'prod-cb', legado: 'ic-cb' }],
      [
        {
          produtoId: 'ic-cb',
          rotaCaminhao: null,
          rotaPrevista: null,
          horaAbertura: null,
          representanteNome: null,
        },
      ],
      [], // tzRow undefined → 0
      [],
    ];
    const db = {
      select: jest.fn(() => selectChain(responses[selectIdx++] ?? [])),
    };
    const svc = new PainelDesossaService({ db } as never, faltas as never);
    const painel = await svc.obter({ operacaoId, modoTv: false });
    expect(painel.itens[0]).toMatchObject({
      rota: null,
      representante: null,
      horarioAlvo: null,
    });
    expect(painel.totais.tzsNaDesossa).toBe(0);
  });
});
