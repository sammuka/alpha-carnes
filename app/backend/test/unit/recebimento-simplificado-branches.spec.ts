/**
 * Branches do fluxo simplificado de recebimento (previsão, NF, cancelamento).
 */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RecebimentoService } from '../../src/modules/operacao/recebimento/recebimento.service';

function makeSelectChain(rows: unknown[]) {
  const terminal = {
    then: (cb: (r: unknown[]) => unknown) => cb(rows),
    orderBy: function orderBy() {
      return terminal;
    },
    where: function where() {
      return terminal;
    },
    innerJoin: function innerJoin() {
      return terminal;
    },
    limit: function limit() {
      return terminal;
    },
  };
  return { from: () => terminal };
}

function makeDb(
  txSelectResponses: unknown[][],
  directSelectResponses: unknown[][] = [],
  updateReturning: unknown = { id: 'rec-1', status: 'pesagem_em_andamento' },
) {
  let txIdx = 0;
  const txSelect = jest.fn(() => makeSelectChain(txSelectResponses[txIdx++] ?? []));
  const txUpdate = jest.fn(() => ({
    set: () => ({
      where: () => ({
        returning: jest.fn(async () => [updateReturning]),
      }),
    }),
  }));
  const tx = { select: txSelect, update: txUpdate, insert: jest.fn() };

  let dIdx = 0;
  const directSelect = jest.fn(() => makeSelectChain(directSelectResponses[dIdx++] ?? []));

  const db = {
    transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
    select: directSelect,
    query: {
      comprasProgramadas: {
        findFirst: jest.fn(),
      },
      recebimentos: {
        findFirst: jest.fn(),
      },
    },
    execute: jest.fn(async () => ({ rows: [] })),
  };
  return { db, tx };
}

function makeService(db: ReturnType<typeof makeDb>['db']) {
  const disponibilidade = {
    listarEsperadoDaCompra: jest.fn(),
    aplicarRecebimentoDelta: jest.fn(),
    listarPedidosEmRisco: jest.fn(),
  };
  const divergencias = { abrirNaTx: jest.fn(), contarAbertasSemTratativa: jest.fn() };
  const auditoria = { registrar: jest.fn() };
  const emitter = new EventEmitter2();
  jest.spyOn(emitter, 'emit').mockReturnValue(true);

  const service = new RecebimentoService(
    { db } as never,
    auditoria as never,
    emitter,
    disponibilidade as never,
    divergencias as never,
    {} as never,
  );
  return { service, disponibilidade, auditoria };
}

describe('RecebimentoService — fluxo simplificado (branches)', () => {
  it('previsaoDaCompra → 404 se compra não existe', async () => {
    const { db } = makeDb([]);
    db.query.comprasProgramadas.findFirst = jest.fn().mockResolvedValue(null);
    const { service } = makeService(db);

    await expect(service.previsaoDaCompra('c-missing')).rejects.toThrow(NotFoundException);
  });

  it('previsaoDaCompra → 409 se compra não confirmada', async () => {
    const { db } = makeDb([]);
    db.query.comprasProgramadas.findFirst = jest.fn().mockResolvedValue({
      id: 'c1',
      status: 'rascunho',
      fornecedor: { razaoSocial: 'F' },
    });
    const { service } = makeService(db);

    await expect(service.previsaoDaCompra('c1')).rejects.toThrow(ConflictException);
  });

  it('previsaoDaCompra → monta resumo e flag jaPossuiRecebimento', async () => {
    const { db } = makeDb(
      [],
      [[{ id: 'rec-existente' }], [], [{ descricao: 'Boi', quantidade: '10.000', unidade: 'cab' }], [{ categoria: 'Bovino' }]],
    );
    db.query.comprasProgramadas.findFirst = jest.fn().mockResolvedValue({
      id: 'c1',
      status: 'confirmada',
      numeroInterno: 'PC-1',
      fornecedorId: 'f1',
      observacoes: 'obs',
      fornecedor: { razaoSocial: 'Fornecedor X' },
    });

    const { service, disponibilidade } = makeService(db);
    disponibilidade.listarEsperadoDaCompra.mockResolvedValue([
      { itemComercialId: 'ic1', quantidadeTotalGerada: '40.000' },
    ]);

    const res = await service.previsaoDaCompra('c1');
    expect(res.jaPossuiRecebimento).toBe(true);
    expect(res.itensOperacionais).toHaveLength(1);
    expect(res.itensOperacionais[0]?.quantidadePrevista).toBe('40.000');
  });

  it('atualizarNfe → 404 se recebimento não existe', async () => {
    const { db } = makeDb([[]]);
    const { service } = makeService(db);

    await expect(service.atualizarNfe('rec-x', { nfeNumero: '1' } as never, 'u1')).rejects.toThrow(NotFoundException);
  });

  it('atualizarNfe → 409 se finalizado', async () => {
    const { db } = makeDb([[{ id: 'rec-1', status: 'conferido_sem_divergencia' }]]);
    const { service } = makeService(db);

    await expect(service.atualizarNfe('rec-1', { romaneio: 'R' } as never, 'u1')).rejects.toThrow(ConflictException);
  });

  it('atualizarNfe → persiste campos NF e audita', async () => {
    const atual = { id: 'rec-1', status: 'pesagem_em_andamento', notaFiscalFornecedor: '111' };
    const atualizado = { ...atual, notaFiscalFornecedor: '222', romaneio: 'ROM' };
    const { db } = makeDb([[atual]], [], atualizado);
    const { service, auditoria } = makeService(db);

    const res = await service.atualizarNfe(
      'rec-1',
      { nfeNumero: '222', romaneio: 'ROM', nfePesoBruto: 100, nfeSerie: '1', observacoes: 'ok' } as never,
      'u1',
    );
    expect(res.notaFiscalFornecedor).toBe('222');
    expect(auditoria.registrar).toHaveBeenCalled();
  });

  it('cancelar → 404 se recebimento não existe', async () => {
    const { db } = makeDb([[]]);
    const { service } = makeService(db);

    await expect(service.cancelar('rec-x', 'u1')).rejects.toThrow(NotFoundException);
  });

  it('cancelar → 409 se status não permite cancelamento', async () => {
    const { db } = makeDb([[{ id: 'rec-1', status: 'conferido_sem_divergencia' }]]);
    const { service } = makeService(db);

    await expect(service.cancelar('rec-1', 'u1')).rejects.toThrow(ConflictException);
  });

  it('cancelar → 409 se já há peças pesadas no lote', async () => {
    const { db } = makeDb([[{ id: 'rec-1', status: 'pesagem_em_andamento' }], [{ total: 2 }]]);
    const { service } = makeService(db);

    await expect(service.cancelar('rec-1', 'u1')).rejects.toThrow(/pesagem registrada/i);
  });

  it('cancelar → status cancelado quando lote aberto sem peças', async () => {
    const atual = { id: 'rec-1', status: 'pesagem_em_andamento' };
    const cancelado = { ...atual, status: 'cancelado' };
    const { db } = makeDb([[atual], [{ total: 0 }]], [], cancelado);
    const { service, auditoria } = makeService(db);

    const res = await service.cancelar('rec-1', 'u1');
    expect(res.status).toBe('cancelado');
    expect(auditoria.registrar).toHaveBeenCalled();
  });

  it('iniciar → 409 quando compra confirmada não tem itens operacionais', async () => {
    const pedido = { id: 'pf1', status: 'aguardando_recebimento', compraProgramadaId: 'c1', fornecedorId: 'f1', operacaoId: 'op1' };
    const compra = { id: 'c1', status: 'confirmada', fornecedorId: 'f1', numeroInterno: 'PC' };
    const { db } = makeDb([[pedido], [compra]]);
    const { service, disponibilidade } = makeService(db);
    disponibilidade.listarEsperadoDaCompra.mockResolvedValue([]);

    await expect(
      service.iniciar({ pedidoFornecedorId: '019ea000-0000-7000-8000-000000000001' } as never, 'u1'),
    ).rejects.toThrow(/sem itens operacionais/i);
  });

  it('suspender → 404 se recebimento não existe', async () => {
    const { db } = makeDb([[]]);
    const { service } = makeService(db);
    await expect(service.suspender('rec-x', 'u1')).rejects.toThrow(NotFoundException);
  });

  it('suspender → 409 se status não é aguardando_conferencia_final', async () => {
    const { db } = makeDb([[{ id: 'rec-1', status: 'pesagem_em_andamento' }]]);
    const { service } = makeService(db);
    await expect(service.suspender('rec-1', 'u1')).rejects.toThrow(ConflictException);
  });

  it('suspender → retorna recebimento em pesagem_em_andamento', async () => {
    const atual = { id: 'rec-1', status: 'aguardando_conferencia_final' };
    const suspenso = { ...atual, status: 'pesagem_em_andamento' };
    const { db } = makeDb([[atual]], [], suspenso);
    const { service, auditoria } = makeService(db);

    const res = await service.suspender('rec-1', 'u1');
    expect(res.status).toBe('pesagem_em_andamento');
    expect(auditoria.registrar).toHaveBeenCalled();
  });

  it('atualizarMetadados → 404 se recebimento não existe', async () => {
    const { db } = makeDb([[]]);
    const { service } = makeService(db);
    await expect(service.atualizarMetadados('rec-x', { placaVeiculo: 'ABC1D23' }, 'u1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('atualizarMetadados → 409 se cancelado', async () => {
    const { db } = makeDb([[{ id: 'rec-1', status: 'cancelado' }]]);
    const { service } = makeService(db);
    await expect(service.atualizarMetadados('rec-1', { motorista: 'João' }, 'u1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('atualizarMetadados → persiste campos informados', async () => {
    const atual = { id: 'rec-1', status: 'pesagem_em_andamento' };
    const atualizado = { ...atual, placaVeiculo: 'XYZ9Z99', doca: 'D2' };
    const { db } = makeDb([[atual]], [], atualizado);
    const { service } = makeService(db);

    const res = await service.atualizarMetadados('rec-1', { placaVeiculo: 'XYZ9Z99', doca: 'D2' }, 'u1');
    expect(res.placaVeiculo).toBe('XYZ9Z99');
  });

  it('listarAcoes → 404 se recebimento não existe', async () => {
    const { db } = makeDb([]);
    const { service } = makeService(db);
    await expect(service.listarAcoes('rec-x')).rejects.toThrow(NotFoundException);
  });

  it('listarAcoes → mapeia destino, cliente e operador', async () => {
    const lote = { id: 'rec-1', status: 'pesagem_em_andamento' };
    const pecaRow = {
      peca: {
        id: 'pec-1',
        statusPeca: 'associada',
        pesoOriginal: '12.500',
        dataHoraPesagem: new Date('2026-06-23T10:00:00Z'),
        pedidoVendaId: 'pv-1',
        etiquetaAtual: 'ETQ-1',
        capturaMeta: { operador: 'Maria' },
      },
      produtoCodigo: 'DIANT',
      produtoDescricao: 'Dianteiro',
      clienteNome: null,
      clienteRazao: 'Açougue Central',
    };
    const terminal: {
      orderBy: jest.Mock;
      where: jest.Mock;
      innerJoin: jest.Mock;
      leftJoin: jest.Mock;
    } = {
      orderBy: jest.fn(() => Promise.resolve([pecaRow])),
      where: jest.fn(function where() {
        return terminal;
      }),
      innerJoin: jest.fn(function innerJoin() {
        return terminal;
      }),
      leftJoin: jest.fn(function leftJoin() {
        return terminal;
      }),
    };
    const db = {
      transaction: jest.fn(),
      select: jest
        .fn()
        .mockImplementationOnce(() => ({ from: () => ({ where: () => Promise.resolve([lote]) }) }))
        .mockImplementationOnce(() => ({ from: () => terminal })),
      query: { comprasProgramadas: { findFirst: jest.fn() }, recebimentos: { findFirst: jest.fn() } },
      execute: jest.fn(),
    };
    const { service } = makeService(db);

    const acoes = await service.listarAcoes('rec-1');
    expect(acoes[0]).toEqual(
      expect.objectContaining({
        destino: 'Pedido',
        clientePedido: 'Açougue Central',
        operadorNome: 'Maria',
        produtoCodigo: 'DIANT',
      }),
    );
  });

  it('listarAcoes → fallback de cliente pelo pedido e destino desconhecido', async () => {
    const lote = { id: 'rec-1', status: 'pesagem_em_andamento' };
    const pecaRow = {
      peca: {
        id: 'pec-2',
        statusPeca: 'pesada',
        pesoOriginal: '8.000',
        dataHoraPesagem: new Date('2026-06-23T11:00:00Z'),
        pedidoVendaId: '019ef701-aaaa-bbbb-cccc-ddddeeeeffff',
        etiquetaAtual: null,
        capturaMeta: null,
      },
      produtoCodigo: 'TRAS',
      produtoDescricao: 'Traseiro',
      clienteNome: null,
      clienteRazao: null,
    };
    const terminal: {
      orderBy: jest.Mock;
      where: jest.Mock;
      innerJoin: jest.Mock;
      leftJoin: jest.Mock;
    } = {
      orderBy: jest.fn(() => Promise.resolve([pecaRow])),
      where: jest.fn(function where() {
        return terminal;
      }),
      innerJoin: jest.fn(function innerJoin() {
        return terminal;
      }),
      leftJoin: jest.fn(function leftJoin() {
        return terminal;
      }),
    };
    const db = {
      transaction: jest.fn(),
      select: jest
        .fn()
        .mockImplementationOnce(() => ({ from: () => ({ where: () => Promise.resolve([lote]) }) }))
        .mockImplementationOnce(() => ({ from: () => terminal })),
      query: { comprasProgramadas: { findFirst: jest.fn() }, recebimentos: { findFirst: jest.fn() } },
      execute: jest.fn(),
    };
    const { service } = makeService(db);

    const acoes = await service.listarAcoes('rec-1');
    expect(acoes[0]).toEqual(
      expect.objectContaining({
        destino: 'Aguardando destino',
        clientePedido: '019ef701',
        operadorNome: null,
      }),
    );
  });
});
