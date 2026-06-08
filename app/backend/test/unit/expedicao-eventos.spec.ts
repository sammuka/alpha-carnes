import { EventEmitter2 } from '@nestjs/event-emitter';
import { CargaService } from '../../src/modules/operacao/expedicao/carga.service';
import { FechamentoService } from '../../src/modules/operacao/expedicao/fechamento.service';
import { ConferenciaService } from '../../src/modules/operacao/expedicao/conferencia.service';
import { EVENTOS } from '../../src/realtime/events/eventos';

describe('CargaService — emissao pos-commit', () => {
  function montarCarga(transactionImpl: () => Promise<unknown>) {
    const ordem: string[] = [];
    const emitter = new EventEmitter2();
    const emitSpy = jest.spyOn(emitter, 'emit').mockImplementation(((event: unknown) => {
      ordem.push(`emit:${String(event)}`);
      return true;
    }) as never);
    const db = {
      transaction: jest.fn(async (fn: (tx: unknown) => unknown) => {
        const r = await fn(db);
        ordem.push('commit');
        return r;
      }),
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            then: jest.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    };
    const caminhaoService = {
      caminhaoAtivo: jest.fn(async () => ({
        id: 'cam-1',
        statusCaminhao: 'em_carga',
        dataOperacao: '2026-12-01',
      })),
    };
    const service = new CargaService(
      { db } as never,
      { registrar: jest.fn() } as never,
      emitter,
      caminhaoService as never,
    );
    return { service, emitSpy, ordem, db };
  }

  it('CARGA_ITEM_ADICIONADO e emitido APOS o commit', async () => {
    const { service, emitSpy, ordem, db } = montarCarga(async () => ({}));

    // Mock para simular cenario onde item nao existe ainda e insercao retorna um carga_item
    const mockItem = {
      id: 'ci-1',
      caminhaoId: 'cam-1',
      tipoOrigem: 'peca',
      pecaId: 'peca-1',
      subitemId: null,
      pedidoVendaId: 'pv-1',
      pedidoVendaItemId: 'pvi-1',
      statusCargaItem: 'em_carga',
    };

    // Override db.transaction para simular o fluxo completo
    db.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const resultado = { item: mockItem, isNew: true, dataOperacao: '2026-12-01' };
      ordem.push('commit');
      return resultado;
    });

    await service.adicionarItem('cam-1', { tipoOrigem: 'peca', id: 'peca-1' }, 'user-1');

    expect(emitSpy).toHaveBeenCalledWith(
      EVENTOS.CARGA_ITEM_ADICIONADO,
      expect.objectContaining({
        caminhaoId: 'cam-1',
        cargaItemId: 'ci-1',
        tipoOrigem: 'peca',
      }),
    );
    expect(ordem.indexOf('commit')).toBeLessThan(
      ordem.indexOf(`emit:${EVENTOS.CARGA_ITEM_ADICIONADO}`),
    );
  });

  it('NAO emite CARGA_ITEM_ADICIONADO quando idempotente (isNew=false)', async () => {
    const { service, emitSpy, db } = montarCarga(async () => ({}));

    const mockItem = {
      id: 'ci-1',
      caminhaoId: 'cam-1',
      tipoOrigem: 'peca',
      pecaId: 'peca-1',
      subitemId: null,
      pedidoVendaId: 'pv-1',
      pedidoVendaItemId: 'pvi-1',
      statusCargaItem: 'em_carga',
    };

    db.transaction.mockImplementation(async () => {
      return { item: mockItem, isNew: false };
    });

    await service.adicionarItem('cam-1', { tipoOrigem: 'peca', id: 'peca-1' }, 'user-1');

    expect(emitSpy).not.toHaveBeenCalledWith(EVENTOS.CARGA_ITEM_ADICIONADO, expect.anything());
  });

  it('NAO emite quando a transacao rejeita (rollback)', async () => {
    const { service, emitSpy, db } = montarCarga(async () => ({}));

    db.transaction.mockImplementation(async () => {
      throw new Error('Caminhao nao esta em estado de carga');
    });

    await expect(
      service.adicionarItem('cam-1', { tipoOrigem: 'peca', id: 'peca-1' }, 'user-1'),
    ).rejects.toThrow();
    expect(emitSpy).not.toHaveBeenCalled();
  });
});

describe('CargaService — removerItem emissao pos-commit', () => {
  function montar(transactionResult: unknown) {
    const ordem: string[] = [];
    const emitter = new EventEmitter2();
    const emitSpy = jest.spyOn(emitter, 'emit').mockImplementation(((event: unknown) => {
      ordem.push(`emit:${String(event)}`);
      return true;
    }) as never);
    const db = {
      transaction: jest.fn(async () => {
        ordem.push('commit');
        return transactionResult;
      }),
    };
    const service = new CargaService(
      { db } as never,
      { registrar: jest.fn() } as never,
      emitter,
      { caminhaoAtivo: jest.fn() } as never,
    );
    return { service, emitSpy, ordem };
  }

  it('CARGA_ITEM_REMOVIDO emitido APOS commit', async () => {
    const { service, emitSpy, ordem } = montar({
      item: {
        id: 'ci-1',
        caminhaoId: 'cam-1',
        tipoOrigem: 'peca',
        pecaId: 'p-1',
        subitemId: null,
        statusCargaItem: 'removido',
      },
      dataOperacao: '2026-12-01',
    });

    await service.removerItem('ci-1', 'motivo qualquer', 'user-1');

    expect(emitSpy).toHaveBeenCalledWith(
      EVENTOS.CARGA_ITEM_REMOVIDO,
      expect.objectContaining({ caminhaoId: 'cam-1', cargaItemId: 'ci-1' }),
    );
    expect(ordem.indexOf('commit')).toBeLessThan(
      ordem.indexOf(`emit:${EVENTOS.CARGA_ITEM_REMOVIDO}`),
    );
  });
});

describe('CargaService — transferir emissao pos-commit', () => {
  function montar(transactionResult: unknown) {
    const ordem: string[] = [];
    const emitter = new EventEmitter2();
    const emitSpy = jest.spyOn(emitter, 'emit').mockImplementation(((event: unknown) => {
      ordem.push(`emit:${String(event)}`);
      return true;
    }) as never);
    const db = {
      transaction: jest.fn(async () => {
        ordem.push('commit');
        return transactionResult;
      }),
    };
    const service = new CargaService(
      { db } as never,
      { registrar: jest.fn() } as never,
      emitter,
      { caminhaoAtivo: jest.fn() } as never,
    );
    return { service, emitSpy, ordem };
  }

  it('CARGA_ITEM_TRANSFERIDO emitido APOS commit', async () => {
    const { service, emitSpy, ordem } = montar({
      item: {
        id: 'ci-1',
        caminhaoId: 'cam-1',
        tipoOrigem: 'peca',
        pecaId: 'p-1',
        pedidoVendaId: 'pv-2',
      },
      pedidoOrigemId: 'pv-1',
      dataOperacao: '2026-12-01',
    });

    await service.transferir('ci-1', { pedidoVendaItemDestinoId: 'pvi-2', motivo: 'm' }, 'user-1');

    expect(emitSpy).toHaveBeenCalledWith(
      EVENTOS.CARGA_ITEM_TRANSFERIDO,
      expect.objectContaining({
        caminhaoId: 'cam-1',
        cargaItemId: 'ci-1',
        pedidoOrigemId: 'pv-1',
        pedidoDestinoId: 'pv-2',
      }),
    );
    expect(ordem.indexOf('commit')).toBeLessThan(
      ordem.indexOf(`emit:${EVENTOS.CARGA_ITEM_TRANSFERIDO}`),
    );
  });
});

describe('FechamentoService — emissao pos-commit', () => {
  function montar(transactionResult: unknown) {
    const ordem: string[] = [];
    const emitter = new EventEmitter2();
    const emitSpy = jest.spyOn(emitter, 'emit').mockImplementation(((event: unknown) => {
      ordem.push(`emit:${String(event)}`);
      return true;
    }) as never);
    const db = {
      transaction: jest.fn(async () => {
        ordem.push('commit');
        return transactionResult;
      }),
    };
    const service = new FechamentoService(
      { db } as never,
      { registrar: jest.fn() } as never,
      emitter,
      { caminhaoAtivo: jest.fn() } as never,
    );
    return { service, emitSpy, ordem };
  }

  it('EXPEDICAO_FECHADA emitido APOS commit (novo fechamento)', async () => {
    const { service, emitSpy, ordem } = montar({
      caminhao: { id: 'cam-1', dataOperacao: '2026-12-01', statusCaminhao: 'fechado' },
      jaFechado: false,
    });

    await service.fechar('cam-1', {} as never, 'user-1');

    expect(emitSpy).toHaveBeenCalledWith(
      EVENTOS.EXPEDICAO_FECHADA,
      expect.objectContaining({ caminhaoId: 'cam-1', dataOperacao: '2026-12-01' }),
    );
    expect(ordem.indexOf('commit')).toBeLessThan(
      ordem.indexOf(`emit:${EVENTOS.EXPEDICAO_FECHADA}`),
    );
  });

  it('NAO emite EXPEDICAO_FECHADA quando jaFechado=true (idempotencia)', async () => {
    const { service, emitSpy } = montar({
      caminhao: { id: 'cam-1', dataOperacao: '2026-12-01', statusCaminhao: 'fechado' },
      jaFechado: true,
    });

    await service.fechar('cam-1', {} as never, 'user-1');

    expect(emitSpy).not.toHaveBeenCalledWith(EVENTOS.EXPEDICAO_FECHADA, expect.anything());
  });

  it('EXPEDICAO_REABERTA emitido APOS commit', async () => {
    const { service, emitSpy, ordem } = montar({
      caminhao: { id: 'cam-1', dataOperacao: '2026-12-01', statusCaminhao: 'em_carga' },
    });

    await service.reabrir('cam-1', 'justificativa', 'user-1');

    expect(emitSpy).toHaveBeenCalledWith(
      EVENTOS.EXPEDICAO_REABERTA,
      expect.objectContaining({ caminhaoId: 'cam-1', operadorId: 'user-1' }),
    );
    expect(ordem.indexOf('commit')).toBeLessThan(
      ordem.indexOf(`emit:${EVENTOS.EXPEDICAO_REABERTA}`),
    );
  });

  it('NAO emite EXPEDICAO_REABERTA em rollback', async () => {
    const ordem: string[] = [];
    const emitter = new EventEmitter2();
    const emitSpy = jest.spyOn(emitter, 'emit').mockImplementation((() => true) as never);
    const db = {
      transaction: jest.fn(async () => {
        throw new Error('Status invalido');
      }),
    };
    const service = new FechamentoService(
      { db } as never,
      { registrar: jest.fn() } as never,
      emitter,
      { caminhaoAtivo: jest.fn() } as never,
    );

    await expect(service.reabrir('cam-1', 'j', 'user-1')).rejects.toThrow();
    expect(emitSpy).not.toHaveBeenCalled();
  });
});

describe('ConferenciaService — validacao manualidade (branches 96/99)', () => {
  it('manual_assistido sem LEITURA_MANUAL lanca ForbiddenException', async () => {
    const emitter = new EventEmitter2();
    const db = { transaction: jest.fn() };
    const service = new ConferenciaService(
      { db } as never,
      { registrar: jest.fn() } as never,
      emitter,
      { caminhaoAtivo: jest.fn() } as never,
      { resolverQr: jest.fn(), resolverQrSubitem: jest.fn() } as never,
    );

    await expect(
      service.registrarItem('cam-1', {
        tipoOrigem: 'peca',
        modoCaptura: 'manual_assistido',
        codigo: 'QR-abc',
        motivo: 'leitor offline',
      }, { sub: 'user-1', permissoes: ['EXPEDICAO_GERENCIAR'] } as never),
    ).rejects.toThrow('Sem permissão LEITURA_MANUAL');
  });

  it('manual_assistido sem codigo/motivo lanca BadRequestException', async () => {
    const emitter = new EventEmitter2();
    const db = { transaction: jest.fn() };
    const service = new ConferenciaService(
      { db } as never,
      { registrar: jest.fn() } as never,
      emitter,
      { caminhaoAtivo: jest.fn() } as never,
      { resolverQr: jest.fn(), resolverQrSubitem: jest.fn() } as never,
    );

    await expect(
      service.registrarItem('cam-1', {
        tipoOrigem: 'peca',
        modoCaptura: 'manual_assistido',
        codigo: undefined,
        motivo: undefined,
      } as never, { sub: 'user-1', permissoes: ['EXPEDICAO_GERENCIAR', 'LEITURA_MANUAL'] } as never),
    ).rejects.toThrow('exige código e motivo');
  });
});

describe('ConferenciaService — emissao pos-commit', () => {
  it('CONFERENCIA_CONCLUIDA emitido APOS commit', async () => {
    const ordem: string[] = [];
    const emitter = new EventEmitter2();
    const emitSpy = jest.spyOn(emitter, 'emit').mockImplementation(((event: unknown) => {
      ordem.push(`emit:${String(event)}`);
      return true;
    }) as never);
    const db = {
      transaction: jest.fn(async () => {
        ordem.push('commit');
        return {
          conferencia: { id: 'conf-1', statusConferencia: 'concluida' },
          dataOperacao: '2026-12-01',
        };
      }),
    };
    const service = new ConferenciaService(
      { db } as never,
      { registrar: jest.fn() } as never,
      emitter,
      { caminhaoAtivo: jest.fn() } as never,
      { resolverQr: jest.fn(), resolverQrSubitem: jest.fn() } as never,
    );

    await service.concluir('cam-1', 'user-1');

    expect(emitSpy).toHaveBeenCalledWith(
      EVENTOS.CONFERENCIA_CONCLUIDA,
      expect.objectContaining({ caminhaoId: 'cam-1', conferenciaId: 'conf-1' }),
    );
    expect(ordem.indexOf('commit')).toBeLessThan(
      ordem.indexOf(`emit:${EVENTOS.CONFERENCIA_CONCLUIDA}`),
    );
  });
});
