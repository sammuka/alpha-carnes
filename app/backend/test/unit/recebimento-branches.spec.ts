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

function chain(rows: unknown[]) {
  const obj: Record<string, unknown> = {
    from: () => obj,
    innerJoin: () => obj,
    leftJoin: () => obj,
    where: () => obj,
    orderBy: () => obj,
    limit: () => obj,
    offset: () => obj,
    then: (resolve: (r: unknown[]) => unknown) => resolve(rows),
  };
  return obj;
}

describe('RecebimentoService — branches', () => {
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const emitter = new EventEmitter2();
  jest.spyOn(emitter, 'emit').mockReturnValue(true);
  const disponibilidade = {
    listarEsperadoDaCompra: jest.fn(),
    aplicarRecebimentoDelta: jest.fn().mockResolvedValue(null),
    listarPedidosEmRisco: jest.fn().mockResolvedValue([]),
  };
  const divergencias = { abrirNaTx: jest.fn(), contarAbertasSemTratativa: jest.fn().mockResolvedValue(0) };
  const operacoesService = {};

  function makeService(db: Record<string, unknown>) {
    return new RecebimentoService(
      { db } as never,
      auditoria as never,
      emitter,
      disponibilidade as never,
      divergencias as never,
      operacoesService as never,
    );
  }

  beforeEach(() => jest.clearAllMocks());

  it('listar → incluirRemovidos=true e sem total usa 0', async () => {
    let call = 0;
    const db = { select: jest.fn(() => chain(call++ === 0 ? [] : [])) };
    const service = makeService(db);
    const result = await service.listar({ page: 1, pageSize: 20, incluirRemovidos: true } as never);
    expect(result.total).toBe(0);
    expect(result.data).toEqual([]);
  });

  it('previsaoDaCompra → sem itens esperados não consulta itens comerciais', async () => {
    const db = {
      query: { comprasProgramadas: { findFirst: jest.fn().mockResolvedValue({
        id: 'cp1', status: 'confirmada', numeroInterno: 'NI-1', fornecedorId: 'f1', observacoes: null,
        fornecedor: { razaoSocial: 'Fornecedor X' },
      }) } },
      select: jest.fn(() => chain([])),
    };
    disponibilidade.listarEsperadoDaCompra.mockResolvedValue([]);
    (resolverMetadadosItensPrevistos as jest.Mock).mockResolvedValue(new Map());
    const service = makeService(db);
    const result = await service.previsaoDaCompra('cp1');
    expect(result.itensOperacionais).toEqual([]);
    expect(result.jaPossuiRecebimento).toBe(false);
  });

  it('previsaoDaCompra → sem origem/metadado usa numeroInterno como origem', async () => {
    const db = {
      query: { comprasProgramadas: { findFirst: jest.fn().mockResolvedValue({
        id: 'cp1', status: 'confirmada', numeroInterno: null, fornecedorId: 'f1', observacoes: null,
        fornecedor: { razaoSocial: 'Fornecedor X' },
      }) } },
      select: jest.fn(() => chain([])),
    };
    disponibilidade.listarEsperadoDaCompra.mockResolvedValue([
      { itemComercialId: 'ic1', quantidadeTotalGerada: '5' },
    ]);
    (resolverMetadadosItensPrevistos as jest.Mock).mockResolvedValue(new Map());
    const service = makeService(db);
    const result = await service.previsaoDaCompra('cp1');
    expect(result.itensOperacionais[0]?.origemDescricao).toBe('Compra');
  });

  it('iniciar → lança 404 se compra programada não encontrada', async () => {
    const pedido = { id: 'pf1', status: 'enviado', compraProgramadaId: 'cp1', deletedAt: null };
    let call = 0;
    const tx = {
      select: jest.fn(() => {
        call++;
        if (call === 1) return chain([pedido]);
        return chain([]);
      }),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    await expect(
      service.iniciar({ pedidoFornecedorId: 'pf1' } as never, 'u1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('iniciar → sucesso com dataHoraChegada informada, item sem balança e evento sem data resolvida', async () => {
    const pedido = { id: 'pf1', status: 'enviado', compraProgramadaId: 'cp1', fornecedorId: 'f1', operacaoId: 'op1', deletedAt: null };
    const compra = { id: 'cp1', numeroInterno: 'NI-1', deletedAt: null };
    const criado = { id: 'r1', operacaoId: 'op1', pedidoFornecedorId: 'pf1', status: 'pesagem_em_andamento' };
    disponibilidade.listarEsperadoDaCompra.mockResolvedValue([
      { itemComercialId: 'icA', quantidadeTotalGerada: '5' },
      { itemComercialId: 'icB', quantidadeTotalGerada: '3' },
    ]);
    (resolverMetadadosItensPrevistos as jest.Mock).mockResolvedValue(
      new Map([['icA', { itemComercialId: 'icA', origemDescricao: 'X', unidadeEsperada: 'kg', requerBalanca: false }]]),
    );

    let selectCall = 0;
    const tx = {
      select: jest.fn(() => {
        selectCall++;
        if (selectCall === 1) return chain([pedido]);
        return chain([compra]);
      }),
      insert: jest.fn(() => ({
        values: () => ({ returning: jest.fn(async () => [criado]) }),
      })),
    };
    const db = {
      transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)),
      select: jest.fn(() => chain([])),
    };
    const service = makeService(db);
    const result = await service.iniciar(
      { pedidoFornecedorId: 'pf1', dataHoraChegada: '2026-06-23T10:00:00.000Z' } as never,
      'u1',
    );
    expect(result.recebimento).toEqual(criado);
  });

  it('atualizarNfe → aplica motorista, doca e placa quando informados', async () => {
    const atual = { id: 'r1', status: 'pesagem_em_andamento', deletedAt: null };
    const atualizado = { id: 'r1', motorista: 'João', doca: '3', placaVeiculo: 'ABC1234' };
    const tx = {
      select: jest.fn(() => chain([atual])),
      update: jest.fn((_t?: unknown) => ({
        set: (v: Record<string, unknown>) => {
          expect(v.motorista).toBe('João');
          expect(v.doca).toBe('3');
          expect(v.placaVeiculo).toBe('ABC1234');
          return { where: () => ({ returning: jest.fn(async () => [atualizado]) }) };
        },
      })),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    const result = await service.atualizarNfe('r1', { motorista: 'João', doca: '3', placaVeiculo: 'ABC1234' } as never, 'u1');
    expect(result).toEqual(atualizado);
  });

  it('cancelar → pecasCount sem linha assume 0 e permite cancelar', async () => {
    const atual = { id: 'r1', status: 'pesagem_em_andamento', deletedAt: null };
    const cancelado = { id: 'r1', status: 'cancelado' };
    let call = 0;
    const tx = {
      select: jest.fn(() => {
        call++;
        if (call === 1) return chain([atual]);
        return chain([]);
      }),
      update: jest.fn(() => ({
        set: () => ({ where: () => ({ returning: jest.fn(async () => [cancelado]) }) }),
      })),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    const result = await service.cancelar('r1', 'u1');
    expect(result).toEqual(cancelado);
  });

  it('registrarItem → lança 404 se recebimento não encontrado', async () => {
    const tx = { select: jest.fn(() => chain([])) };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    await expect(
      service.registrarItem('r-x', { itemComercialId: 'ic1', quantidadeRecebida: '5' } as never, 'u1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('registrarItem → item já divergente e pesoTotalApurado informado atualizam corretamente', async () => {
    const recebimento = { id: 'r1', status: 'pesagem_em_andamento', pedidoFornecedorId: 'pf1', operacaoId: 'op1', deletedAt: null };
    const itemExistente = {
      id: 'ri1',
      quantidadeEsperada: '10.000',
      quantidadeRecebida: '8.000',
      statusApuracao: 'divergente',
      pesoTotalApurado: '8.000',
      observacoes: null,
    };
    const atualizado = { id: 'ri1', quantidadeEsperada: '10.000', pesoTotalApurado: '9.500', statusApuracao: 'divergente' };
    let selectCall = 0;
    const tx = {
      select: jest.fn(() => {
        selectCall++;
        if (selectCall === 1) return chain([recebimento]);
        if (selectCall === 2) return chain([{ compraProgramadaId: 'cp1', dataOperacao: '2026-06-23' }]);
        return chain([itemExistente]);
      }),
      update: jest.fn(() => ({
        set: (v: Record<string, unknown>) => {
          expect(v.pesoTotalApurado).toBe('9.500');
          return { where: () => ({ returning: jest.fn(async () => [atualizado]) }) };
        },
      })),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    const result = await service.registrarItem(
      'r1',
      { itemComercialId: 'ic1', quantidadeRecebida: '10.000', pesoTotalApurado: '9.500' } as never,
      'u1',
    );
    expect(result.itemId).toBe('ri1');
  });

  it('concluir → lança 404 se recebimento não encontrado', async () => {
    const tx = { select: jest.fn(() => chain([])) };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    await expect(service.concluir('r-x', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('atualizarMetadados → aplica motorista e observações quando informados', async () => {
    const atual = { id: 'r1', status: 'pesagem_em_andamento', deletedAt: null };
    const atualizado = { id: 'r1', motorista: 'Maria', observacoes: 'obs' };
    const tx = {
      select: jest.fn(() => chain([atual])),
      update: jest.fn(() => ({
        set: (v: Record<string, unknown>) => {
          expect(v.motorista).toBe('Maria');
          expect(v.observacoes).toBe('obs');
          return { where: () => ({ returning: jest.fn(async () => [atualizado]) }) };
        },
      })),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    const result = await service.atualizarMetadados('r1', { motorista: 'Maria', observacoes: 'obs' } as never, 'u1');
    expect(result).toEqual(atualizado);
  });

  it('listarAcoes → usa razão social e status bruto quando não mapeado', async () => {
    const lote = { id: 'r1', deletedAt: null };
    const pecaLinha = {
      peca: {
        id: 'pc1',
        capturaMeta: null,
        dataHoraPesagem: new Date('2026-06-23T10:00:00Z'),
        pesoOriginal: '5.000',
        etiquetaAtual: 'QR1',
        statusPeca: 'em_transformacao',
        pedidoVendaId: null,
      },
      produtoCodigo: 'P1',
      produtoDescricao: 'Produto 1',
      clienteNome: null,
      clienteRazao: 'Razão Social LTDA',
    };
    let call = 0;
    const db = {
      select: jest.fn(() => {
        call++;
        if (call === 1) return chain([lote]);
        return chain([pecaLinha]);
      }),
    };
    const service = makeService(db);
    const result = await service.listarAcoes('r1');
    expect(result[0]?.clientePedido).toBe('Razão Social LTDA');
    expect(result[0]?.destino).toBe('em_transformacao');
  });
});
