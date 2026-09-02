import { EventEmitter2 } from '@nestjs/event-emitter';
import { RecebimentoService } from '../../src/modules/operacao/recebimento/recebimento.service';
import { EVENTOS } from '../../src/realtime/events/eventos';

// Verifica a ordem commit→emit (RA-04/ADR-004): eventos só saem DEPOIS que a
// Promise de db.transaction resolve, e NÃO saem se a transação rejeita.
describe('RecebimentoService — emissão de evento pós-commit', () => {
  function montar(transactionImpl: () => Promise<unknown>) {
    const ordem: string[] = [];
    const emitter = new EventEmitter2();
    const emitSpy = jest.spyOn(emitter, 'emit').mockImplementation(((event: unknown) => {
      ordem.push(`emit:${String(event)}`);
      return true;
    }) as never);
    const db: { transaction: jest.Mock; select?: jest.Mock } = {
      transaction: jest.fn(async () => {
        const r = await transactionImpl();
        ordem.push('commit');
        return r;
      }),
    };
    const auditoria = { registrar: jest.fn() };
    const disponibilidade = { aplicarRecebimentoDelta: jest.fn(), listarPedidosEmRisco: jest.fn() };
    const divergencias = { abrirNaTx: jest.fn(), contarAbertasSemTratativa: jest.fn() };
    const operacoes = {} as never;
    const service = new RecebimentoService(
      { db } as never,
      auditoria as never,
      emitter,
      disponibilidade as never,
      divergencias as never,
      operacoes,
    );
    return { service, emitSpy, ordem, db };
  }

  it('emite recebimento_iniciado APÓS o commit', async () => {
    const { service, emitSpy, ordem, db } = montar(async () => ({
      recebimento: { id: 'r1', operacaoId: 'op1', pedidoFornecedorId: 'pf1' },
      nfId: null,
    }));
    const chain = {
      from: jest.fn(),
      innerJoin: jest.fn(),
      where: jest.fn(),
      limit: jest.fn(),
      then: (cb: (r: unknown[]) => unknown) => cb([{
        recebimento: { id: 'r1', operacaoId: 'op1', pedidoFornecedorId: 'pf1', status: 'pesagem_em_andamento' },
        compraProgramadaId: 'c1',
        dataOperacao: '2026-06-06',
      }]),
    };
    chain.from.mockReturnValue(chain);
    chain.innerJoin.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);
    chain.limit.mockReturnValue(chain);
    db.select = jest.fn().mockReturnValue(chain);

    await service.iniciar({ pedidoFornecedorId: '019ea000-0000-7000-8000-000000000001' } as never, 'user-1');

    expect(emitSpy).toHaveBeenCalledWith(
      EVENTOS.RECEBIMENTO_INICIADO,
      expect.objectContaining({ recebimentoId: 'r1', dataOperacao: '2026-06-06' }),
    );
    expect(ordem.indexOf('commit')).toBeLessThan(ordem.indexOf(`emit:${EVENTOS.RECEBIMENTO_INICIADO}`));
  });

  it('emite recebimento_iniciado também em reabertura (N lotes por PF)', async () => {
    const { service, emitSpy, db } = montar(async () => ({
      recebimento: { id: 'r2', operacaoId: 'op1', pedidoFornecedorId: 'pf1', status: 'pesagem_em_andamento' },
      nfId: null,
    }));
    const chain = {
      from: jest.fn(),
      innerJoin: jest.fn(),
      where: jest.fn(),
      limit: jest.fn(),
      then: (cb: (r: unknown[]) => unknown) => cb([{
        recebimento: { id: 'r2', operacaoId: 'op1', pedidoFornecedorId: 'pf1', status: 'pesagem_em_andamento' },
        compraProgramadaId: 'c1',
        dataOperacao: '2026-06-06',
      }]),
    };
    chain.from.mockReturnValue(chain);
    chain.innerJoin.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);
    chain.limit.mockReturnValue(chain);
    db.select = jest.fn().mockReturnValue(chain);

    await service.iniciar({ pedidoFornecedorId: '019ea000-0000-7000-8000-000000000001' } as never, 'user-1');
    expect(emitSpy).toHaveBeenCalledWith(
      EVENTOS.RECEBIMENTO_INICIADO,
      expect.objectContaining({ recebimentoId: 'r2' }),
    );
  });

  it('NÃO emite quando a transação de iniciar rejeita (rollback)', async () => {
    const { service, emitSpy } = montar(async () => {
      throw new Error('falha simulada na tx');
    });

    await expect(
      service.iniciar({ pedidoFornecedorId: '019ea000-0000-7000-8000-000000000001' } as never, 'user-1'),
    ).rejects.toThrow('falha simulada');
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('contexto pos-commit usa ids e data canonicos e falha fechado antes dos eventos', async () => {
    const { service, emitSpy, db } = montar(async () => ({
      recebimento: { id: 'r-sem-contexto', operacaoId: 'op1', pedidoFornecedorId: 'pf1' },
      nfId: 'nf-interna',
    }));
    const chain = {
      from: jest.fn(),
      innerJoin: jest.fn(),
      where: jest.fn(),
      limit: jest.fn(),
      then: (cb: (r: unknown[]) => unknown) => cb([]),
    };
    chain.from.mockReturnValue(chain);
    chain.innerJoin.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);
    chain.limit.mockReturnValue(chain);
    db.select = jest.fn().mockReturnValue(chain);

    await expect(
      service.iniciar({ pedidoFornecedorId: '019ea000-0000-7000-8000-000000000001' } as never, 'user-1'),
    ).rejects.toThrow('Contexto canônico do recebimento não encontrado após o commit');
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('registrarItem emite recebimento_registrado + divergência + pedido_em_risco APÓS o commit', async () => {
    const { service, emitSpy, ordem } = montar(async () => ({
      itemId: 'it1',
      dataOperacao: '2026-06-07',
      itemComercialId: 'i1',
      divergenciaAberta: { id: 'd1', tipo: 'quantidade_menor' },
      pedidosEmRisco: [
        { pedidoId: 'p1', itemComercialId: 'i1', quantidadeReservada: '4.000', quantidadeRecebida: '2.000' },
      ],
    }));

    await service.registrarItem('r1', { itemComercialId: 'i1', quantidadeRecebida: 2 } as never, 'user-1');

    expect(emitSpy).toHaveBeenCalledWith(
      EVENTOS.RECEBIMENTO_REGISTRADO,
      expect.objectContaining({ recebimentoId: 'r1', etapa: 'item' }),
    );
    expect(emitSpy).toHaveBeenCalledWith(
      EVENTOS.DIVERGENCIA_RECEBIMENTO_ABERTA,
      expect.objectContaining({ divergenciaId: 'd1', tipo: 'quantidade_menor' }),
    );
    expect(emitSpy).toHaveBeenCalledWith(
      EVENTOS.PEDIDO_EM_RISCO,
      expect.objectContaining({ origem: 'recebimento' }),
    );
    expect(ordem.indexOf('commit')).toBeLessThan(ordem.indexOf(`emit:${EVENTOS.RECEBIMENTO_REGISTRADO}`));
  });

  it('registrarItem NÃO emite divergência/risco quando item conforme', async () => {
    const { service, emitSpy } = montar(async () => ({
      itemId: 'it1',
      dataOperacao: '2026-06-07',
      itemComercialId: 'i1',
      divergenciaAberta: null,
      pedidosEmRisco: [],
    }));

    await service.registrarItem('r1', { itemComercialId: 'i1', quantidadeRecebida: 10 } as never, 'user-1');

    expect(emitSpy).toHaveBeenCalledWith(EVENTOS.RECEBIMENTO_REGISTRADO, expect.anything());
    expect(emitSpy).not.toHaveBeenCalledWith(EVENTOS.DIVERGENCIA_RECEBIMENTO_ABERTA, expect.anything());
    expect(emitSpy).not.toHaveBeenCalledWith(EVENTOS.PEDIDO_EM_RISCO, expect.anything());
  });

  it('registrarItem NÃO emite quando a transação rejeita (rollback)', async () => {
    const { service, emitSpy } = montar(async () => {
      throw new Error('falha no registrar');
    });

    await expect(
      service.registrarItem('r1', { itemComercialId: 'i1', quantidadeRecebida: 2 } as never, 'user-1'),
    ).rejects.toThrow('falha no registrar');
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('concluir emite recebimento_registrado(conclusao) + pedido_em_risco APÓS o commit', async () => {
    const { service, emitSpy, ordem } = montar(async () => ({
      recebimento: { id: 'r1', dataOperacao: '2026-06-08' },
      jaConcluido: false,
      dataOperacao: '2026-06-08',
      pedidosEmRisco: [
        { pedidoId: 'p1', itemComercialId: 'i1', quantidadeReservada: '4.000', quantidadeRecebida: '2.000' },
      ],
    }));

    await service.concluir('r1', 'user-1');

    expect(emitSpy).toHaveBeenCalledWith(
      EVENTOS.RECEBIMENTO_REGISTRADO,
      expect.objectContaining({ recebimentoId: 'r1', etapa: 'conclusao' }),
    );
    expect(emitSpy).toHaveBeenCalledWith(
      EVENTOS.PEDIDO_EM_RISCO,
      expect.objectContaining({ origem: 'conclusao' }),
    );
    expect(ordem.indexOf('commit')).toBeLessThan(ordem.indexOf(`emit:${EVENTOS.RECEBIMENTO_REGISTRADO}`));
  });

  it('concluir idempotente (jaConcluido) NÃO emite', async () => {
    const { service, emitSpy } = montar(async () => ({
      recebimento: { id: 'r1', dataOperacao: '2026-06-08' },
      jaConcluido: true,
      dataOperacao: '2026-06-08',
      pedidosEmRisco: [],
    }));

    await service.concluir('r1', 'user-1');
    expect(emitSpy).not.toHaveBeenCalled();
  });
});

// Cálculo determinístico da quantidade com divergência (Refino 2): |esperada − recebida|.
describe('RecebimentoService — cálculo de divergente (decimal exato)', () => {
  function svc(): RecebimentoService {
    return new RecebimentoService(
      {} as never,
      {} as never,
      new EventEmitter2(),
      {} as never,
      {} as never,
      {} as never,
    );
  }
  // calcularDivergente é privado: acessamos via cast para validar o invariante de cálculo.
  const calc = (esperada: string, recebida: string): string =>
    (svc() as unknown as { calcularDivergente(e: string, r: string): string }).calcularDivergente(esperada, recebida);

  it('falta: esperada 10, recebida 4 → 6.000', () => {
    expect(calc('10.000', '4.000')).toBe('6.000');
  });
  it('sobra: esperada 10, recebida 13 → 3.000 (valor absoluto)', () => {
    expect(calc('10.000', '13.000')).toBe('3.000');
  });
  it('conforme: esperada 10, recebida 10 → 0.000', () => {
    expect(calc('10.000', '10.000')).toBe('0.000');
  });
  it('excedente: esperada 0, recebida 5 → 5.000', () => {
    expect(calc('0.000', '5.000')).toBe('5.000');
  });
});

describe('RecebimentoService — snapshot canônico do Pedido ao Fornecedor', () => {
  function chain(rows: unknown[]) {
    const q = {
      from: jest.fn(),
      innerJoin: jest.fn(),
      leftJoin: jest.fn(),
      where: jest.fn(),
      limit: jest.fn(),
      then: (resolve: (value: unknown[]) => unknown) => resolve(rows),
    };
    q.from.mockReturnValue(q);
    q.innerJoin.mockReturnValue(q);
    q.leftJoin.mockReturnValue(q);
    q.where.mockReturnValue(q);
    q.limit.mockReturnValue(q);
    return q;
  }

  const cabecalho = {
    pedido: {
      id: 'pf1',
      numero: 'PF-001',
      status: 'aguardando_recebimento',
      fornecedorId: 'f1',
      operacaoId: 'op1',
      compraProgramadaId: 'c1',
    },
    fornecedorNome: 'Fornecedor Canônico',
    dataOperacao: '2026-07-29',
    numeroInternoCompra: 'PC-001',
    observacoesCompra: null,
  };
  const itemSnapshot = {
    itemComercialId: 'i1',
    produtoCodigo: 'TZ',
    produtoDescricao: 'Traseiro',
    quantidadePrevista: '12.000',
    pesoPrevisto: '850.000',
  };
  const snapshotSelects = (): unknown[][] => [
    [cabecalho],
    [itemSnapshot],
    [{ id: 'i1', codigo: 'TZ', unidadeComercial: 'kg' }],
    [{ itemComercialId: 'i1', passaBalanca: true }],
    [{ itemComercialId: 'i1', itemComercialCodigo: 'TZ', itemCompraDescricao: 'Boi' }],
    [{ descricao: 'Boi', quantidade: '99.000' }],
    [{ categoria: 'Boi' }],
  ];

  function serviceCom(db: Record<string, unknown>) {
    return new RecebimentoService(
      { db } as never,
      { registrar: jest.fn() } as never,
      new EventEmitter2(),
      { listarEsperadoDaCompra: jest.fn(() => [{ itemComercialId: 'i1', quantidadeTotalGerada: '99.000' }]) } as never,
      {} as never,
      {} as never,
    );
  }

  it('preview e inicio usam o snapshot imutavel do Pedido ao Fornecedor', async () => {
    const previewRows = snapshotSelects();
    const previewDb = {
      select: jest.fn(() => chain(previewRows.shift() ?? [])),
    };
    const preview = await serviceCom(previewDb).previsaoDoPedidoFornecedor('pf1');
    expect(preview.itensOperacionais[0]).toEqual(expect.objectContaining({
      quantidadePrevista: '12.000',
      pesoPrevisto: '850.000',
    }));

    const inicioRows = snapshotSelects();
    inicioRows.push([{
      recebimento: {
        id: 'r1',
        pedidoFornecedorId: 'pf1',
        operacaoId: 'op1',
        status: 'pesagem_em_andamento',
      },
      compraProgramadaId: 'c1',
      dataOperacao: '2026-07-29',
    }]);
    const itensInseridos: Array<Record<string, unknown>> = [];
    const insert = jest.fn()
      .mockImplementationOnce(() => ({
        values: () => ({ returning: async () => [{
          id: 'r1',
          pedidoFornecedorId: 'pf1',
          operacaoId: 'op1',
          status: 'pesagem_em_andamento',
        }] }),
      }))
      .mockImplementationOnce(() => ({
        values: async (values: Array<Record<string, unknown>>) => {
          itensInseridos.push(...values);
        },
      }));
    const inicioDb: Record<string, unknown> = {
      select: jest.fn(() => chain(inicioRows.shift() ?? [])),
      insert,
    };
    inicioDb.transaction = async (callback: (tx: unknown) => unknown) => callback(inicioDb);

    await serviceCom(inicioDb).iniciar({ pedidoFornecedorId: 'pf1' } as never, 'user-1');
    expect(itensInseridos).toEqual([
      expect.objectContaining({
        itemComercialId: 'i1',
        quantidadeEsperada: '12.000',
      }),
    ]);
    expect(itensInseridos[0]).not.toHaveProperty('pesoEsperado');
  });

  it('snapshot incompleto falha sem fabricar codigo ou descricao', async () => {
    const rows = snapshotSelects();
    rows[2] = [];
    const db = { select: jest.fn(() => chain(rows.shift() ?? [])) };
    await expect(serviceCom(db).previsaoDoPedidoFornecedor('pf1'))
      .rejects.toThrow('Pedido ao fornecedor com metadados operacionais incompletos');
  });
});
