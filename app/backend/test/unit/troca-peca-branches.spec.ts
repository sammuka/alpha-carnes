import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TrocaPecaService } from '../../src/modules/operacao/pesagem/troca-peca.service';
import { pecaEmCargaFechada, buscarCargaAbertaDaPeca } from '../../src/modules/operacao/pesagem/carga-fechada';

jest.mock('../../src/modules/operacao/pesagem/carga-fechada', () => ({
  pecaEmCargaFechada: jest.fn(),
  buscarCargaAbertaDaPeca: jest.fn(),
}));

const pecaEmCargaFechadaMock = pecaEmCargaFechada as jest.MockedFunction<typeof pecaEmCargaFechada>;
const buscarCargaAbertaMock = buscarCargaAbertaDaPeca as jest.MockedFunction<typeof buscarCargaAbertaDaPeca>;

function pecaBase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pec-1',
    statusPeca: 'associada',
    pedidoVendaItemId: 'pvi-1',
    pedidoVendaId: 'pv-1',
    itemComercialBaseId: 'ic-1',
    pesoOriginal: '10.000',
    recebimentoId: 'rec-1',
    etiquetaAtual: 'QR-pec-1',
    dataHoraPesagem: '2026-01-01T10:00:00Z',
    deletedAt: null,
    ...overrides,
  };
}

function chainRows(rows: unknown[]) {
  const c: Record<string, unknown> = {};
  const self = () => c;
  c.from = self;
  c.where = self;
  c.innerJoin = self;
  c.orderBy = self;
  c.limit = self;
  c.for = self;
  c.then = (cb: (r: unknown[]) => unknown) => Promise.resolve(cb(rows));
  return c;
}

const dtoBase = {
  pecaRetiradaId: 'pec-ret',
  pecaInseridaId: 'pec-ins',
  pedidoVendaItemId: 'pvi-1',
  destinoRetirada: 'estoque' as const,
  motivo: 'outro' as const,
};

function makeService(opts: {
  item?: Record<string, unknown> | null;
  inserida?: Record<string, unknown> | null;
  operacao?: { dataOperacao: string; operacaoId: string } | null;
  retirada?: Record<string, unknown>;
  pecaInserida?: Record<string, unknown>;
  travarMap?: Record<string, Record<string, unknown> | null>;
  txExtras?: Record<string, unknown>;
}) {
  const item = opts.item === undefined
    ? {
        id: 'pvi-1',
        pedidoVendaId: 'pv-1',
        itemComercialId: 'ic-1',
        statusPedido: 'em_elaboracao_reserva_ativa',
        operacaoId: 'op-1',
        deletedAt: null,
      }
    : opts.item;

  const inserida = opts.inserida === undefined
    ? pecaBase({ id: 'pec-ins', statusPeca: 'pesada', pedidoVendaItemId: null, pedidoVendaId: null })
    : opts.inserida;

  const operacao = opts.operacao === undefined
    ? { dataOperacao: '2026-01-01', operacaoId: 'op-1' }
    : opts.operacao;

  const retirada = opts.retirada ?? pecaBase({ id: 'pec-ret' });
  const pecaIns = opts.pecaInserida ?? inserida;

  const travarMap: Record<string, Record<string, unknown> | null> = opts.travarMap ?? {
    'pec-ins': pecaIns as Record<string, unknown>,
    'pec-ret': retirada as Record<string, unknown>,
  };

  let preTxCall = 0;
  const dbSelect = jest.fn(() => {
    preTxCall += 1;
    if (preTxCall === 1) return chainRows(item ? [item] : []);
    if (preTxCall === 2) return chainRows(inserida ? [inserida] : []);
    return chainRows(operacao ? [operacao] : []);
  });

  const txSelect = jest.fn((_fields?: unknown) => {
    const callIndex = txSelect.mock.calls.length;
    const ids = [dtoBase.pecaInseridaId, dtoBase.pecaRetiradaId].sort();
    const id = ids[(callIndex - 1) % 2] ?? dtoBase.pecaRetiradaId;
    const peca = travarMap[id] ?? null;
    const c = chainRows(peca ? [peca] : []);
    c.for = () => ({
      then: (cb: (r: unknown[]) => unknown) => Promise.resolve(cb(peca ? [peca] : [])),
    });
    return c;
  });

  const tx = {
    select: txSelect,
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(() => ({
          returning: jest.fn(({ 0: _ } = [0]) => {
            void _;
            return Promise.resolve([retirada, pecaIns]);
          }),
        })),
      })),
    })),
    insert: jest.fn(() => ({
      values: jest.fn(() => ({
        returning: jest.fn(() => Promise.resolve([{ id: 'troca-1' }])),
      })),
    })),
    ...opts.txExtras,
  };

  // Fix update returning per call
  let updateCall = 0;
  tx.update = jest.fn(() => ({
    set: jest.fn(() => ({
      where: jest.fn(() => ({
        returning: jest.fn(() => {
          updateCall += 1;
          if (updateCall === 1) {
            return Promise.resolve([{ ...retirada, statusPeca: 'em_sobra' }]);
          }
          return Promise.resolve([{ ...pecaIns, statusPeca: 'associada' }]);
        }),
      })),
    })),
  }));

  const db = {
    select: dbSelect,
    transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  const etiqueta = {
    imprimirPayload: jest.fn().mockResolvedValue({ impresso: true, jobId: 'j1', saude: 'ok' }),
    invalidarPorTrocaNaTx: jest.fn().mockResolvedValue({ id: 'et-inv' }),
    emitirNaTx: jest.fn().mockResolvedValue({ id: 'et-emit' }),
  };
  const aprovacoes = { abrirNaTx: jest.fn().mockResolvedValue({ id: 'pend-1' }) };
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const emitter = new EventEmitter2();
  jest.spyOn(emitter, 'emit').mockReturnValue(true);

  const service = new TrocaPecaService(
    { db } as never,
    auditoria as never,
    emitter,
    etiqueta as never,
    aprovacoes as never,
  );

  return { service, etiqueta, aprovacoes, emitter, tx, db };
}

describe('TrocaPecaService — branches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pecaEmCargaFechadaMock.mockResolvedValue(false);
    buscarCargaAbertaMock.mockResolvedValue(null);
  });

  it('validarTroca → NotFoundException se item não existe', async () => {
    const { service } = makeService({ item: null });
    await expect(service.executar(dtoBase, 'op-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('validarTroca → NotFoundException se item com pedido deletado', async () => {
    const { service } = makeService({
      item: {
        id: 'pvi-1',
        pedidoVendaId: 'pv-1',
        itemComercialId: 'ic-1',
        statusPedido: 'aberto',
        deletedAt: new Date(),
      },
    });
    await expect(service.executar(dtoBase, 'op-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('validarTroca → ConflictException se pedido cancelado', async () => {
    const { service } = makeService({
      item: {
        id: 'pvi-1',
        pedidoVendaId: 'pv-1',
        itemComercialId: 'ic-1',
        statusPedido: 'cancelado',
        deletedAt: null,
      },
    });
    await expect(service.executar(dtoBase, 'op-1')).rejects.toThrow('Pedido cancelado');
  });

  it('validarTroca → NotFoundException se peça de entrada não existe', async () => {
    const { service } = makeService({ inserida: null });
    await expect(service.executar(dtoBase, 'op-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('validarTroca → ConflictException se peça de entrada incompatível', async () => {
    const { service } = makeService({
      inserida: pecaBase({ id: 'pec-ins', statusPeca: 'pesada', itemComercialBaseId: 'ic-outro' }),
    });
    await expect(service.executar(dtoBase, 'op-1')).rejects.toThrow('incompatível');
  });

  it('validarTroca → NotFoundException se operação da peça não encontrada', async () => {
    const { service } = makeService({ operacao: null });
    await expect(service.executar(dtoBase, 'op-1')).rejects.toThrow('Operação da peça');
  });

  it('executar → ConflictException se retirada não está associada ao item', async () => {
    const { service } = makeService({
      retirada: pecaBase({
        id: 'pec-ret',
        statusPeca: 'associada',
        pedidoVendaItemId: 'pvi-outro',
      }),
    });
    await expect(service.executar(dtoBase, 'op-1')).rejects.toThrow('não está mais associada');
  });

  it('executar → ConflictException se retirada não está associada (status)', async () => {
    const { service } = makeService({
      retirada: pecaBase({ id: 'pec-ret', statusPeca: 'pesada', pedidoVendaItemId: 'pvi-1' }),
    });
    await expect(service.executar(dtoBase, 'op-1')).rejects.toThrow('não está mais associada');
  });

  it('executar → ConflictException se peça inserida já associada', async () => {
    const { service } = makeService({
      pecaInserida: pecaBase({ id: 'pec-ins', statusPeca: 'associada' }),
    });
    await expect(service.executar(dtoBase, 'op-1')).rejects.toThrow('já está associada');
  });

  it('executar → ConflictException se item comercial diferente entre peças', async () => {
    const { service } = makeService({
      retirada: pecaBase({ id: 'pec-ret', itemComercialBaseId: 'ic-1' }),
      pecaInserida: pecaBase({ id: 'pec-ins', statusPeca: 'pesada', itemComercialBaseId: 'ic-2' }),
    });
    await expect(service.executar(dtoBase, 'op-1')).rejects.toThrow('outro item comercial');
  });

  it('executar → ConflictException se peça retirada em carga fechada', async () => {
    pecaEmCargaFechadaMock.mockResolvedValueOnce(true);
    const { service } = makeService({});
    await expect(service.executar(dtoBase, 'op-1')).rejects.toThrow('carga fechada');
  });

  it('executar → NotFoundException se travarPeca não encontra peça', async () => {
    const { service } = makeService({ travarMap: { 'pec-ret': null, 'pec-ins': null } });
    await expect(service.executar(dtoBase, 'op-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('executar → sucesso sem carga aberta e sem etiqueta invalidada', async () => {
    const { service, etiqueta, aprovacoes, emitter } = makeService({});
    etiqueta.invalidarPorTrocaNaTx.mockResolvedValueOnce(null);

    const res = await service.executar(dtoBase, 'op-1');
    expect(res.etiquetaInvalidada).toBeNull();
    expect(res.pendenciaFisicaId).toBeNull();
    expect(aprovacoes.abrirNaTx).not.toHaveBeenCalled();
    expect(emitter.emit).toHaveBeenCalled();
  });

  it('executar → sucesso com carga aberta gera pendência física', async () => {
    buscarCargaAbertaMock.mockResolvedValueOnce({ placa: 'ABC1D23' } as never);
    const { service, aprovacoes } = makeService({});
    const res = await service.executar(dtoBase, 'op-1');
    expect(res.pendenciaFisicaId).toBe('pend-1');
    expect(aprovacoes.abrirNaTx).toHaveBeenCalled();
  });

  it('executar → template de pendência usa id quando etiquetaAtual é null', async () => {
    buscarCargaAbertaMock.mockResolvedValueOnce({ placa: 'XYZ9Z99' } as never);
    const { service, aprovacoes } = makeService({
      retirada: pecaBase({ id: 'pec-ret', etiquetaAtual: null }),
    });
    await service.executar(dtoBase, 'op-1');
    const desc = aprovacoes.abrirNaTx.mock.calls[0]?.[1]?.descricao as string;
    expect(desc).toContain('pec-ret');
    expect(desc).toContain('—');
  });

  it('executar → destino corte mantém fluxo feliz', async () => {
    const { service } = makeService({});
    const res = await service.executar({ ...dtoBase, destinoRetirada: 'desossa' }, 'op-1');
    expect(res.troca).toBeDefined();
  });

  it('executar → usa QR fallback quando peça inserida não tem etiquetaAtual', async () => {
    const { service, etiqueta } = makeService({
      inserida: pecaBase({
        id: 'pec-ins',
        statusPeca: 'pesada',
        etiquetaAtual: null,
        pedidoVendaItemId: null,
        pedidoVendaId: null,
      }),
    });
    await service.executar(dtoBase, 'op-1');
    expect(etiqueta.emitirNaTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ codigo: 'QR-pec-ins' }),
    );
  });
});
