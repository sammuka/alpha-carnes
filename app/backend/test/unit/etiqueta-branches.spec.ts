import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  agruparPorPeca,
  EtiquetaService,
  paginarEmMemoria,
} from '../../src/modules/operacao/pesagem/etiqueta.service';
import { pecaEmCargaFechada } from '../../src/modules/operacao/pesagem/carga-fechada';
import { buscarNfAtivaDoRecebimento } from '../../src/modules/operacao/recebimento/nota-fiscal-fornecedor.persistence';

jest.mock('../../src/modules/operacao/pesagem/carga-fechada', () => ({
  pecaEmCargaFechada: jest.fn(),
  buscarCargaAbertaDaPeca: jest.fn(),
  etiquetaBloqueadaSql: 'false',
}));

jest.mock('../../src/modules/operacao/recebimento/nota-fiscal-fornecedor.persistence', () => ({
  buscarNfAtivaDoRecebimento: jest.fn(),
}));

const pecaEmCargaFechadaMock = pecaEmCargaFechada as jest.MockedFunction<typeof pecaEmCargaFechada>;
const buscarNfMock = buscarNfAtivaDoRecebimento as jest.MockedFunction<typeof buscarNfAtivaDoRecebimento>;

function chainRows(rows: unknown[]) {
  const c: Record<string, unknown> = {};
  const self = () => c;
  c.from = self;
  c.where = self;
  c.innerJoin = self;
  c.leftJoin = self;
  c.orderBy = self;
  c.limit = self;
  c.for = self;
  c.then = (cb: (r: unknown[]) => unknown) => Promise.resolve(cb(rows));
  return c;
}

function peca(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pec-1',
    statusPeca: 'associada',
    etiquetaAtual: 'QR-pec-1',
    itemComercialBaseId: 'ic-1',
    pesoOriginal: '10.000',
    recebimentoId: 'rec-1',
    pedidoVendaId: 'pv-1',
    pedidoVendaItemId: 'pvi-1',
    dataHoraPesagem: '2026-01-01T10:00:00Z',
    deletedAt: null,
    ...overrides,
  };
}

function subitem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    statusSubitem: 'associado',
    etiquetaAtual: 'QR-SUB-sub-1',
    pecaOrigemId: 'pec-1',
    transformacaoId: 'tr-1',
    itemComercialId: 'ic-1',
    peso: '5.000',
    pedidoVendaId: null,
    pedidoVendaItemId: null,
    deletedAt: null,
    ...overrides,
  };
}

function listarChain(rows: unknown[]) {
  const c: Record<string, unknown> = {};
  const self = () => c;
  c.from = self;
  c.innerJoin = self;
  c.leftJoin = self;
  c.where = () => ({ orderBy: () => Promise.resolve(rows) });
  return c;
}

function makeService(
  db: object,
  impressora = { imprimir: jest.fn().mockResolvedValue({ impresso: true, jobId: 'j1', saude: 'ok' }) },
) {
  const leitor = { ler: jest.fn().mockResolvedValue('QR-auto') };
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const emitter = new EventEmitter2();
  jest.spyOn(emitter, 'emit').mockReturnValue(true);
  const service = new EtiquetaService({ db } as never, auditoria as never, emitter, impressora as never, leitor as never);
  return { service, impressora, leitor, auditoria, emitter };
}

describe('EtiquetaService — branches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pecaEmCargaFechadaMock.mockResolvedValue(false);
    buscarNfMock.mockResolvedValue(null);
  });

  describe('agruparPorPeca / paginarEmMemoria', () => {
    it('agruparPorPeca monta histórico quando há múltiplas etiquetas por peça', () => {
      const linha = (id: string, pecaId: string, createdAt: string) => ({
        id,
        pecaId,
        codigo: `QR-${id}`,
        estado: 'ativa' as const,
        statusImpressao: 'impressa',
        reimpressao: false,
        motivoCancelamento: null,
        invalidadaEm: null,
        bloqueada: false,
        pesoOriginal: '10',
        statusPeca: 'associada',
        recebimentoId: 'rec-1',
        pedidoVendaId: null,
        operadorId: 'op-1',
        operadorNome: 'Op',
        createdAt,
        produtoCodigo: 'TZ',
        produtoDescricao: 'Traseiro',
        caracteristicas: [],
        nfNumero: null,
        frigorifico: 'Frigo',
        romaneio: null,
        placaVeiculo: null,
        motorista: null,
        clienteNome: null,
        representanteNome: null,
        rotaPrevista: null,
        localEstoquePrevisto: null,
      });
      const res = agruparPorPeca([
        linha('e2', 'pec-1', '2026-01-02T00:00:00Z'),
        linha('e1', 'pec-1', '2026-01-01T00:00:00Z'),
      ]);
      expect(res).toHaveLength(1);
      expect(res[0]!.id).toBe('e2');
      expect(res[0]!.historico).toHaveLength(1);
      expect(res[0]!.historico[0]!.id).toBe('e1');
    });

    it('paginarEmMemoria fatia corretamente', () => {
      const p = paginarEmMemoria([1, 2, 3, 4, 5], 2, 2);
      expect(p.data).toEqual([3, 4]);
      expect(p.total).toBe(5);
    });
  });

  describe('invalidarPorTrocaNaTx / cancelarVigenteNaTx', () => {
    it('invalidarPorTrocaNaTx retorna null sem etiqueta vigente', async () => {
      const tx = { select: jest.fn(() => chainRows([])) };
      const { service } = makeService({ transaction: jest.fn() });
      const res = await service.invalidarPorTrocaNaTx(tx as never, 'pec-1', 'op-1');
      expect(res).toBeNull();
    });

    it('cancelarVigenteNaTx retorna null sem etiqueta vigente', async () => {
      const tx = { select: jest.fn(() => chainRows([])) };
      const { service } = makeService({ transaction: jest.fn() });
      const res = await service.cancelarVigenteNaTx(tx as never, 'pec-1', 'motivo', 'op-1');
      expect(res).toBeNull();
    });

    it('cancelarVigenteNaTx encerra etiqueta vigente', async () => {
      const vigente = { id: 'et-1', pecaId: 'pec-1', estado: 'ativa' };
      const encerrada = { ...vigente, estado: 'cancelada' };
      const tx = {
        select: jest.fn(() => chainRows([vigente])),
        update: jest.fn(() => ({
          set: jest.fn(() => ({
            where: jest.fn(() => ({ returning: jest.fn(() => Promise.resolve([encerrada])) })),
          })),
        })),
      };
      const { service } = makeService({});
      const res = await service.cancelarVigenteNaTx(tx as never, 'pec-1', 'estorno', 'op-1');
      expect(res?.estado).toBe('cancelada');
    });

    it('invalidarPorTrocaNaTx encerra etiqueta vigente', async () => {
      const vigente = { id: 'et-1', pecaId: 'pec-1', estado: 'ativa' };
      const encerrada = { ...vigente, estado: 'invalidada_por_troca' };
      const tx = {
        select: jest.fn(() => chainRows([vigente])),
        update: jest.fn(() => ({
          set: jest.fn(() => ({
            where: jest.fn(() => ({ returning: jest.fn(() => Promise.resolve([encerrada])) })),
          })),
        })),
      };
      const { service, auditoria } = makeService({});
      const res = await service.invalidarPorTrocaNaTx(tx as never, 'pec-1', 'op-1');
      expect(res?.estado).toBe('invalidada_por_troca');
      expect(auditoria.registrar).toHaveBeenCalled();
    });
  });

  describe('emitir / reimprimir', () => {
    it('emitir → NotFoundException se peça não existe', async () => {
      const db = { select: jest.fn(() => chainRows([])) };
      const { service } = makeService(db);
      await expect(service.emitir('pec-x', 'op-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('emitir → ConflictException se peça não associada', async () => {
      const db = { select: jest.fn(() => chainRows([peca({ statusPeca: 'pesada' })])), transaction: jest.fn() };
      const { service } = makeService(db);
      await expect(service.emitir('pec-1', 'op-1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('emitir → sucesso com QR fallback', async () => {
      const p = peca({ etiquetaAtual: null });
      const etiqueta = { id: 'et-1', estado: 'ativa' };
      const tx = {
        update: jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })) })),
        insert: jest.fn(() => ({
          values: jest.fn(() => ({ returning: jest.fn(() => Promise.resolve([etiqueta])) })),
        })),
        select: jest.fn(() => chainRows([p])),
      };
      const db = {
        select: jest.fn(() => chainRows([p])),
        transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
      };
      const { service } = makeService(db);
      const res = await service.emitir('pec-1', 'op-1');
      expect(res.etiqueta.id).toBe('et-1');
    });

    it('reimprimir → NotFoundException se peça não existe', async () => {
      const db = { select: jest.fn(() => chainRows([])) };
      const { service } = makeService(db);
      await expect(service.reimprimir('pec-x', 'op-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('reimprimir → ConflictException sem etiquetaAtual', async () => {
      const db = { select: jest.fn(() => chainRows([peca({ etiquetaAtual: null })])), transaction: jest.fn() };
      const { service } = makeService(db);
      await expect(service.reimprimir('pec-1', 'op-1')).rejects.toThrow('ainda não teve etiqueta');
    });

    it('reimprimir → sucesso', async () => {
      const p = peca();
      const etiqueta = { id: 'et-r', estado: 'reimpressa' };
      const tx = {
        update: jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })) })),
        insert: jest.fn(() => ({
          values: jest.fn(() => ({ returning: jest.fn(() => Promise.resolve([etiqueta])) })),
        })),
      };
      const db = {
        select: jest.fn(() => chainRows([p])),
        transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
      };
      const { service } = makeService(db);
      const res = await service.reimprimir('pec-1', 'op-1');
      expect(res.etiqueta.id).toBe('et-r');
    });
  });

  describe('emitirSubitem / reimprimirSubitem', () => {
    it('emitirSubitem → NotFoundException', async () => {
      const db = { select: jest.fn(() => chainRows([])) };
      const { service } = makeService(db);
      await expect(service.emitirSubitem('sub-x', 'op-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('emitirSubitem → ConflictException status inválido', async () => {
      const db = { select: jest.fn(() => chainRows([subitem({ statusSubitem: 'pendente' })])), transaction: jest.fn() };
      const { service } = makeService(db);
      await expect(service.emitirSubitem('sub-1', 'op-1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('emitirSubitem → sucesso com falha de impressão', async () => {
      const s = subitem({ etiquetaAtual: null });
      const impressora = { imprimir: jest.fn().mockResolvedValue({ impresso: false, jobId: 'j2', erro: 'offline', saude: 'down' }) };
      const tx = {
        update: jest.fn(() => ({
          set: jest.fn(() => ({
            where: jest.fn(() => ({ returning: jest.fn(() => Promise.resolve([s])) })),
          })),
        })),
        insert: jest.fn(() => ({
          values: jest.fn(() => ({ returning: jest.fn(() => Promise.resolve([{ id: 'et-sub' }])) })),
        })),
      };
      const db = {
        select: jest.fn(() => chainRows([s])),
        transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
      };
      const { service } = makeService(db, impressora);
      const res = await service.emitirSubitem('sub-1', 'op-1');
      expect(res.etiqueta.id).toBe('et-sub');
    });

    it('reimprimirSubitem → NotFoundException', async () => {
      const db = { select: jest.fn(() => chainRows([])) };
      const { service } = makeService(db);
      await expect(service.reimprimirSubitem('sub-x', 'op-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('reimprimirSubitem → ConflictException sem etiquetaAtual', async () => {
      const db = { select: jest.fn(() => chainRows([subitem({ etiquetaAtual: null })])), transaction: jest.fn() };
      const { service } = makeService(db);
      await expect(service.reimprimirSubitem('sub-1', 'op-1')).rejects.toThrow('ainda não teve etiqueta');
    });

    it('reimprimirSubitem → sucesso', async () => {
      const s = subitem();
      const tx = {
        insert: jest.fn(() => ({
          values: jest.fn(() => ({ returning: jest.fn(() => Promise.resolve([{ id: 'et-rsub' }])) })),
        })),
      };
      const db = {
        select: jest.fn(() => chainRows([s])),
        transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
      };
      const { service } = makeService(db);
      const res = await service.reimprimirSubitem('sub-1', 'op-1');
      expect(res.etiqueta.id).toBe('et-rsub');
    });
  });

  describe('resolverQrSubitem', () => {
    it('modo automático lê do gateway', async () => {
      const s = subitem();
      const db = { select: jest.fn(() => chainRows([s])) };
      const { service, leitor } = makeService(db);
      leitor.ler.mockResolvedValueOnce('QR-SUB-sub-1');
      const res = await service.resolverQrSubitem({ modoCaptura: 'automatico' });
      expect(res.id).toBe('sub-1');
    });

    it('modo manual resolve por etiquetaAtual', async () => {
      const s = subitem();
      const db = { select: jest.fn(() => chainRows([s])) };
      const { service } = makeService(db);
      const res = await service.resolverQrSubitem({ modoCaptura: 'manual_assistido', codigo: ' QR-SUB-sub-1 ' });
      expect(res.id).toBe('sub-1');
    });

    it('modo manual resolve por id QR-SUB- prefix', async () => {
      const subUuid = '00000000-0000-4000-8000-000000000001';
      const s = subitem({ id: subUuid });
      let call = 0;
      const db = {
        select: jest.fn(() => {
          call += 1;
          return chainRows(call === 1 ? [] : [s]);
        }),
      };
      const { service } = makeService(db);
      const res = await service.resolverQrSubitem({ modoCaptura: 'manual_assistido', codigo: `QR-SUB-${subUuid}` });
      expect(res.id).toBe(subUuid);
    });

    it('modo manual resolve por uuid direto', async () => {
      const s = subitem();
      let call = 0;
      const db = {
        select: jest.fn(() => {
          call += 1;
          return chainRows(call <= 1 ? [] : [s]);
        }),
      };
      const { service } = makeService(db);
      const res = await service.resolverQrSubitem({
        modoCaptura: 'manual_assistido',
        codigo: '00000000-0000-4000-8000-000000000001',
      });
      expect(res.id).toBe('sub-1');
    });

    it('NotFoundException quando código não bate', async () => {
      const db = { select: jest.fn(() => chainRows([])) };
      const { service } = makeService(db);
      await expect(
        service.resolverQrSubitem({ modoCaptura: 'manual_assistido', codigo: 'invalido' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('resolverQr', () => {
    it('modo automático', async () => {
      const p = peca();
      let call = 0;
      const db = {
        select: jest.fn(() => {
          call += 1;
          if (call === 1) return chainRows([p]);
          return chainRows([{ estado: 'ativa' }]);
        }),
      };
      const { service, leitor } = makeService(db);
      leitor.ler.mockResolvedValueOnce('QR-pec-1');
      const res = await service.resolverQr({ modoCaptura: 'automatico' });
      expect(res.id).toBe('pec-1');
    });

    it('NotFoundException código inválido', async () => {
      const db = { select: jest.fn(() => chainRows([])) };
      const { service } = makeService(db);
      await expect(service.resolverQr({ modoCaptura: 'manual_assistido', codigo: '   ' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('ConflictException etiqueta invalidada por troca', async () => {
      const p = peca();
      let call = 0;
      const db = {
        select: jest.fn(() => {
          call += 1;
          if (call === 1) return chainRows([p]);
          return chainRows([{ estado: 'invalidada_por_troca' }]);
        }),
      };
      const { service } = makeService(db);
      await expect(service.resolverQr({ modoCaptura: 'manual_assistido', codigo: 'QR-pec-1' })).rejects.toThrow('invalidada por troca');
    });

    it('ConflictException etiqueta cancelada', async () => {
      const p = peca();
      let call = 0;
      const db = {
        select: jest.fn(() => {
          call += 1;
          if (call === 1) return chainRows([p]);
          return chainRows([{ estado: 'cancelada' }]);
        }),
      };
      const { service } = makeService(db);
      await expect(service.resolverQr({ modoCaptura: 'manual_assistido', codigo: 'QR-pec-1' })).rejects.toThrow('cancelada');
    });

    it('resolve por QR-id quando etiquetaAtual não bate', async () => {
      const p = peca({ id: '00000000-0000-4000-8000-000000000099' });
      let call = 0;
      const db = {
        select: jest.fn(() => {
          call += 1;
          if (call === 1) return chainRows([]);
          if (call === 2) return chainRows([p]);
          return chainRows([]);
        }),
      };
      const { service } = makeService(db);
      const res = await service.resolverQr({
        modoCaptura: 'manual_assistido',
        codigo: 'QR-00000000-0000-4000-8000-000000000099',
      });
      expect(res.id).toBe(p.id);
    });

    it('resolve por uuid sem prefixo QR', async () => {
      const p = peca({ id: '00000000-0000-4000-8000-000000000088' });
      let call = 0;
      const db = {
        select: jest.fn(() => {
          call += 1;
          if (call === 1) return chainRows([]);
          if (call === 2) return chainRows([p]);
          return chainRows([]);
        }),
      };
      const { service } = makeService(db);
      const res = await service.resolverQr({
        modoCaptura: 'manual_assistido',
        codigo: '00000000-0000-4000-8000-000000000088',
      });
      expect(res.id).toBe(p.id);
    });

    it('código não-uuid após trim retorna null', async () => {
      const db = { select: jest.fn(() => chainRows([])) };
      const { service } = makeService(db);
      await expect(service.resolverQr({ modoCaptura: 'manual_assistido', codigo: 'NAO-UUID' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('cancelar', () => {
    it('NotFoundException se etiqueta não existe', async () => {
      const tx = { select: jest.fn(() => chainRows([])) };
      const db = { transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)) };
      const { service } = makeService(db);
      await expect(service.cancelar('et-x', { motivo: 'outro' }, 'op-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('ConflictException estado terminal', async () => {
      const alvo = { id: 'et-1', pecaId: 'pec-1', estado: 'cancelada' };
      const tx = { select: jest.fn(() => chainRows([alvo])) };
      const db = { transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)) };
      const { service } = makeService(db);
      await expect(service.cancelar('et-1', { motivo: 'outro' }, 'op-1')).rejects.toThrow('terminal');
    });

    it('ConflictException carga fechada', async () => {
      pecaEmCargaFechadaMock.mockResolvedValueOnce(true);
      const alvo = { id: 'et-1', pecaId: 'pec-1', estado: 'ativa' };
      const tx = { select: jest.fn(() => chainRows([alvo])) };
      const db = { transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)) };
      const { service } = makeService(db);
      await expect(service.cancelar('et-1', { motivo: 'outro' }, 'op-1')).rejects.toThrow('carga fechada');
    });

    it('sucesso emite evento', async () => {
      const alvo = { id: 'et-1', pecaId: 'pec-1', estado: 'ativa' };
      const encerrada = { ...alvo, estado: 'cancelada' };
      const tx = {
        select: jest.fn()
          .mockReturnValueOnce(chainRows([alvo]))
          .mockReturnValueOnce(chainRows([{ dataOperacao: '2026-01-01' }])),
        update: jest.fn(() => ({
          set: jest.fn(() => ({
            where: jest.fn(() => ({ returning: jest.fn(() => Promise.resolve([encerrada])) })),
          })),
        })),
      };
      const db = { transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)) };
      const { service, emitter } = makeService(db);
      const res = await service.cancelar('et-1', { motivo: 'outro' }, 'op-1');
      expect(res.estado).toBe('cancelada');
      expect(emitter.emit).toHaveBeenCalled();
    });

    it('invalidada_por_troca também é terminal', async () => {
      const alvo = { id: 'et-1', pecaId: 'pec-1', estado: 'invalidada_por_troca' };
      const tx = { select: jest.fn(() => chainRows([alvo])) };
      const db = { transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)) };
      const { service } = makeService(db);
      await expect(service.cancelar('et-1', { motivo: 'outro' }, 'op-1')).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('listar', () => {
    function linhaListagem(overrides: Record<string, unknown> = {}) {
      return {
        id: 'et-1',
        pecaId: 'pec-1',
        codigo: 'QR-1',
        estado: 'ativa',
        statusImpressao: 'impressa',
        reimpressao: false,
        motivoCancelamento: null,
        invalidadaEm: new Date('2026-01-01'),
        bloqueada: 1,
        pesoOriginal: '10',
        statusPeca: 'em_sobra',
        recebimentoId: 'rec-1',
        pedidoVendaId: null,
        operadorId: 'op-1',
        operadorNome: 'Operador',
        createdAt: '2026-01-02T00:00:00Z',
        produtoCodigo: 'TZ',
        produtoDescricao: 'Traseiro',
        caracteristicas: null,
        notaFiscalFornecedor: 'NF-LEG',
        frigorifico: 'Frigo SA',
        romaneio: 'R1',
        placaVeiculo: 'ABC',
        motorista: 'João',
        clienteNome: 'Cliente',
        representanteNome: 'Rep',
        rotaPrevista: 'Rota A',
        localEstoquePrevisto: { valor: null, provisorio: true },
        ...overrides,
      };
    }

    it('listar com busca e filtro de estado', async () => {
      buscarNfMock.mockResolvedValueOnce({ numero: 'NF-99' } as never);
      const db = { select: jest.fn(() => listarChain([
        linhaListagem(),
        linhaListagem({ id: 'et-0', pecaId: 'pec-2', estado: 'cancelada', createdAt: null, invalidadaEm: null }),
      ])) };
      const { service } = makeService(db);
      const res = await service.listar({
        recebimentoId: 'rec-1',
        busca: 'qr',
        estado: 'ativa',
        page: 1,
        pageSize: 10,
      });
      expect(res.data).toHaveLength(1);
      expect(res.data[0]!.nfNumero).toBe('NF-99');
      expect(res.data[0]!.localEstoquePrevisto).toEqual({ valor: null, provisorio: true });
    });

    it('listar usa notaFiscalFornecedor legado quando nfAtiva ausente', async () => {
      const db = {
        select: jest.fn(() => listarChain([linhaListagem({ invalidadaEm: '2026-01-01T00:00:00Z', createdAt: new Date('2026-01-02') })])),
      };
      const { service } = makeService(db);
      const res = await service.listar({ recebimentoId: 'rec-1', page: 1, pageSize: 20 });
      expect(res.data[0]!.nfNumero).toBe('NF-LEG');
      expect(res.data[0]!.invalidadaEm).toBe('2026-01-01T00:00:00Z');
    });
  });
});
