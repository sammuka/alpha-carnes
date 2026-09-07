import { PecasElegiveisService } from '../../src/modules/operacao/corte/pecas-elegiveis.service';

type Chain = {
  from: (...a: unknown[]) => Chain;
  where: (...a: unknown[]) => Chain;
  innerJoin: (...a: unknown[]) => Chain;
  leftJoin: (...a: unknown[]) => Chain;
  orderBy: (...a: unknown[]) => Chain;
  then: (cb: (r: unknown[]) => unknown) => unknown;
};

function selectChain(rows: unknown[]): Chain {
  const terminal: Chain = {
    from: () => terminal,
    where: () => terminal,
    innerJoin: () => terminal,
    leftJoin: () => terminal,
    orderBy: () => terminal,
    then: (cb) => cb(rows),
  };
  return terminal;
}

const operacaoId = '11111111-1111-4111-8111-111111111111';

describe('PecasElegiveisService', () => {
  it('mapeia flags, situações e fallbacks de meta', async () => {
    const rows = [
      {
        pecaId: 'p1',
        etiquetaAtual: 'TZ-001',
        statusPeca: 'para_corte',
        pesoOriginal: '12.500',
        produtoId: 'ic1',
        produtoCodigo: 'TZ',
        recebimentoId: 'rec1',
        transformacaoId: null,
        lote: 'ROM-1',
        origem: 'Frigo X',
        entrada: new Date('2026-07-31T10:00:00.000Z'),
        capturaMeta: {
          maisPesada: true,
          maisGorda: true,
          melhorAcabamento: true,
          prioritario: true,
          obs: 'preferencial',
        },
      },
      {
        pecaId: 'p2',
        etiquetaAtual: 'TZ-002',
        statusPeca: 'em_transformacao',
        pesoOriginal: '11.000',
        produtoId: 'ic1',
        produtoCodigo: 'TZ',
        recebimentoId: 'rec1',
        transformacaoId: 't1',
        lote: null,
        origem: null,
        entrada: new Date('2026-07-31T11:00:00.000Z'),
        capturaMeta: {},
      },
      {
        pecaId: 'p3',
        etiquetaAtual: 'TZ-003',
        statusPeca: 'para_corte',
        pesoOriginal: null,
        produtoId: 'ic1',
        produtoCodigo: null,
        recebimentoId: 'rec1',
        transformacaoId: null,
        lote: 'ROM-2',
        origem: 'Frigo Y',
        entrada: null,
        capturaMeta: null,
      },
      {
        pecaId: 'p4',
        etiquetaAtual: 'TZ-004',
        statusPeca: 'para_corte',
        pesoOriginal: '10.000',
        produtoId: 'ic1',
        produtoCodigo: 'TZ',
        recebimentoId: 'rec1',
        transformacaoId: null,
        lote: 'ROM-3',
        origem: 'Frigo Z',
        entrada: new Date('2026-07-31T12:00:00.000Z'),
        capturaMeta: { obs: 123 },
      },
    ];
    const db = {
      select: jest.fn(() => selectChain(rows)),
    };
    const svc = new PecasElegiveisService({ db } as never);
    const out = await svc.listar({ operacaoId });
    expect(out).toHaveLength(4);
    expect(out[0]).toMatchObject({
      situacao: 'Prioritário',
      caracteristicas: 'Mais pesada, Mais gorda, Melhor acabamento',
      obs: 'preferencial',
      entrada: '2026-07-31T10:00:00.000Z',
    });
    expect(out[1]).toMatchObject({
      situacao: 'Disponível para desossa',
      caracteristicas: '—',
      obs: null,
    });
    expect(out[2]).toMatchObject({
      situacao: 'Aguardando chegada à desossa',
      entrada: null,
      caracteristicas: '—',
      obs: null,
    });
    expect(out[3]?.obs).toBeNull();
  });
});
