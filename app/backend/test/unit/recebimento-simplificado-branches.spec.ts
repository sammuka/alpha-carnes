/**
 * Branches do fluxo simplificado de recebimento (previsão, NF, cancelamento).
 */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RecebimentoService } from '../../src/modules/operacao/recebimento/recebimento.service';

jest.mock('../../src/modules/operacao/recebimento/recebimento-metadados.helper', () => ({
  resolverMetadadosItensPrevistos: jest.fn(),
  derivarTipoCarga: jest.fn().mockResolvedValue(null),
  contarPecasPorItem: jest.fn().mockResolvedValue(new Map()),
  calcularProgressoBalanca: jest.fn().mockReturnValue(0),
}));

import { resolverMetadadosItensPrevistos } from '../../src/modules/operacao/recebimento/recebimento-metadados.helper';

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
  it('previsaoDoPedidoFornecedor → 404 se pedido não existe', async () => {
    const { db } = makeDb([], [[]]);
    const { service } = makeService(db);

    await expect(service.previsaoDoPedidoFornecedor('pf-missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('previsaoDoPedidoFornecedor → 409 se pedido não está recebível', async () => {
    const { db } = makeDb([], [[{
      pedido: {
        id: 'pf1',
        numero: 'PF-1',
        status: 'rascunho',
        operacaoId: 'op1',
        compraProgramadaId: 'c1',
        fornecedorId: 'f1',
      },
      fornecedorNome: 'Fornecedor X',
      dataOperacao: '2026-06-23',
      numeroInternoCompra: 'PC-1',
      observacoesCompra: null,
    }]]);
    const { service } = makeService(db);

    await expect(service.previsaoDoPedidoFornecedor('pf1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('previsaoDoPedidoFornecedor → monta resumo do snapshot canônico', async () => {
    const cabecalho = {
      pedido: {
        id: 'pf1',
        numero: 'PF-1',
        status: 'enviado',
        operacaoId: 'op1',
        compraProgramadaId: 'c1',
        fornecedorId: 'f1',
      },
      fornecedorNome: 'Fornecedor X',
      dataOperacao: '2026-06-23',
      numeroInternoCompra: 'PC-1',
      observacoesCompra: 'obs',
    };
    const { db } = makeDb(
      [],
      [
        [cabecalho],
        [{
          produtoId: 'ic1',
          produtoCodigo: 'IC-1',
          produtoDescricao: 'Item 1',
          quantidadePrevista: '40.000',
          pesoPrevisto: '120.000',
        }],
        [{ descricao: 'Boi', quantidade: '10.000' }],
      ],
    );
    (resolverMetadadosItensPrevistos as jest.Mock).mockResolvedValue(new Map([
      ['ic1', {
        produtoId: 'ic1',
        origemDescricao: 'Compra PC-1',
        unidadeEsperada: 'cab',
        requerBalanca: true,
      }],
    ]));
    const { service } = makeService(db);

    const res = await service.previsaoDoPedidoFornecedor('pf1');
    expect(res.pedidoFornecedorId).toBe('pf1');
    expect(res.numeroPedidoFornecedor).toBe('PF-1');
    expect(res.itensOperacionais).toHaveLength(1);
    expect(res.itensOperacionais[0]?.quantidadePrevista).toBe('40.000');
    expect(res.itensOperacionais[0]?.pesoPrevisto).toBe('120.000');
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

  it('atualizarNfe → persiste metadados operacionais e audita (sem NF estruturada)', async () => {
    const atual = { id: 'rec-1', status: 'pesagem_em_andamento', pedidoFornecedorId: 'pf-1' };
    const atualizado = { ...atual, romaneio: 'ROM', observacoes: 'ok' };
    const { db } = makeDb([[atual]], [], atualizado);
    const { service, auditoria } = makeService(db);

    const res = await service.atualizarNfe(
      'rec-1',
      { romaneio: 'ROM', observacoes: 'ok' } as never,
      'u1',
    );
    expect(res.romaneio).toBe('ROM');
    expect(auditoria.registrar).toHaveBeenCalled();
  });

  it('atualizarNfe → 409 se campos NF estruturados sem pedidoFornecedorId', async () => {
    const atual = { id: 'rec-1', status: 'pesagem_em_andamento', pedidoFornecedorId: null };
    const { db } = makeDb([[atual]]);
    const { service } = makeService(db);

    await expect(
      service.atualizarNfe(
        'rec-1',
        { nfeNumero: '222', nfeSerie: '1', nfePesoBruto: 100 } as never,
        'u1',
      ),
    ).rejects.toThrow(/pedido ao fornecedor/i);
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
    const cabecalho = {
      pedido: {
        id: 'pf1',
        numero: 'PF-1',
        status: 'aguardando_recebimento',
        compraProgramadaId: 'c1',
        fornecedorId: 'f1',
        operacaoId: 'op1',
      },
      fornecedorNome: 'Fornecedor X',
      dataOperacao: '2026-06-23',
      numeroInternoCompra: 'PC',
      observacoesCompra: null,
    };
    const { db } = makeDb([[cabecalho], []]);
    const { service } = makeService(db);

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
