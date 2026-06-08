import { assertTransicao, expedicaoAberta, type StatusCaminhao } from '../../src/modules/operacao/expedicao/transicoes';
import {
  validarElegibilidadePeca,
  validarElegibilidadeSubitem,
} from '../../src/modules/operacao/expedicao/elegibilidade';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FechamentoService } from '../../src/modules/operacao/expedicao/fechamento.service';

describe('transicoes — assertTransicao branches', () => {
  it('planejado -> em_conferencia e invalida', () => {
    expect(() => assertTransicao('planejado', 'em_conferencia')).toThrow('Transição inválida');
  });

  it('planejado -> aguardando_carga e valida', () => {
    expect(() => assertTransicao('planejado', 'aguardando_carga')).not.toThrow();
  });

  it('aguardando_carga -> em_carga e valida', () => {
    expect(() => assertTransicao('aguardando_carga', 'em_carga')).not.toThrow();
  });

  it('em_carga -> em_conferencia e valida', () => {
    expect(() => assertTransicao('em_carga', 'em_conferencia')).not.toThrow();
  });

  it('em_conferencia -> fechado e valida', () => {
    expect(() => assertTransicao('em_conferencia', 'fechado')).not.toThrow();
  });

  it('em_conferencia -> em_carga e valida (reabertura parcial)', () => {
    expect(() => assertTransicao('em_conferencia', 'em_carga')).not.toThrow();
  });

  it('fechado -> em_carga e valida (reabertura)', () => {
    expect(() => assertTransicao('fechado', 'em_carga')).not.toThrow();
  });

  it('fechado -> liberado_faturamento e valida', () => {
    expect(() => assertTransicao('fechado', 'liberado_faturamento')).not.toThrow();
  });

  it('expedido -> qualquer e invalida (sem transicoes)', () => {
    expect(() => assertTransicao('expedido', 'em_carga')).toThrow('Transição inválida');
  });

  it('em_carga -> fechado e invalida (pula conferencia)', () => {
    expect(() => assertTransicao('em_carga', 'fechado')).toThrow('Transição inválida');
  });

  // branches line 30, 33: TRANSICOES[de] com de valido mas para invalido
  it('transicao com permitidos vazio retorna mensagem "nenhuma"', () => {
    expect(() => assertTransicao('expedido', 'planejado')).toThrow('nenhuma');
  });

  it('transicao com permitidos preenchido mostra lista', () => {
    try {
      assertTransicao('planejado', 'fechado');
    } catch (e: unknown) {
      expect((e as Error).message).toContain('aguardando_carga');
    }
  });
});

describe('transicoes — expedicaoAberta', () => {
  it('em_carga e aberta', () => {
    expect(expedicaoAberta('em_carga')).toBe(true);
  });

  it('em_conferencia e aberta', () => {
    expect(expedicaoAberta('em_conferencia')).toBe(true);
  });

  it('fechado nao e aberta', () => {
    expect(expedicaoAberta('fechado')).toBe(false);
  });

  it('planejado nao e aberta', () => {
    expect(expedicaoAberta('planejado')).toBe(false);
  });
});

describe('elegibilidade — validarElegibilidadePeca branches', () => {
  it('peca em status pesada nao e elegivel', () => {
    expect(() =>
      validarElegibilidadePeca({
        id: 'p1',
        statusPeca: 'pesada',
        etiquetaAtual: 'QR-p1',
        pedidoVendaId: 'pv1',
        pedidoVendaItemId: 'pvi1',
      }),
    ).toThrow('elegível');
  });

  it('peca sem etiqueta nao e elegivel', () => {
    expect(() =>
      validarElegibilidadePeca({
        id: 'p1',
        statusPeca: 'associada',
        etiquetaAtual: null,
        pedidoVendaId: 'pv1',
        pedidoVendaItemId: 'pvi1',
      }),
    ).toThrow('etiqueta');
  });

  it('peca sem pedidoVendaId nao e elegivel', () => {
    expect(() =>
      validarElegibilidadePeca({
        id: 'p1',
        statusPeca: 'associada',
        etiquetaAtual: 'QR-p1',
        pedidoVendaId: null,
        pedidoVendaItemId: 'pvi1',
      }),
    ).toThrow('vínculo');
  });

  it('peca elegivel nao lanca', () => {
    expect(() =>
      validarElegibilidadePeca({
        id: 'p1',
        statusPeca: 'associada',
        etiquetaAtual: 'QR-p1',
        pedidoVendaId: 'pv1',
        pedidoVendaItemId: 'pvi1',
      }),
    ).not.toThrow();
  });
});

describe('elegibilidade — validarElegibilidadeSubitem branches', () => {
  it('subitem em status pesado nao e elegivel', () => {
    expect(() =>
      validarElegibilidadeSubitem({
        id: 's1',
        statusSubitem: 'pesado',
        etiquetaAtual: 'QR-SUB-s1',
        pedidoVendaId: 'pv1',
        pedidoVendaItemId: 'pvi1',
      }),
    ).toThrow('elegível');
  });

  it('subitem sem etiqueta nao e elegivel', () => {
    expect(() =>
      validarElegibilidadeSubitem({
        id: 's1',
        statusSubitem: 'associado',
        etiquetaAtual: null,
        pedidoVendaId: 'pv1',
        pedidoVendaItemId: 'pvi1',
      }),
    ).toThrow('etiqueta');
  });

  it('subitem sem pedidoVendaId nao e elegivel', () => {
    expect(() =>
      validarElegibilidadeSubitem({
        id: 's1',
        statusSubitem: 'associado',
        etiquetaAtual: 'QR-SUB-s1',
        pedidoVendaId: null,
        pedidoVendaItemId: 'pvi1',
      }),
    ).toThrow('vínculo');
  });

  it('subitem sem pedidoVendaItemId nao e elegivel', () => {
    expect(() =>
      validarElegibilidadeSubitem({
        id: 's1',
        statusSubitem: 'associado',
        etiquetaAtual: 'QR-SUB-s1',
        pedidoVendaId: 'pv1',
        pedidoVendaItemId: null,
      }),
    ).toThrow('vínculo');
  });

  it('subitem elegivel nao lanca', () => {
    expect(() =>
      validarElegibilidadeSubitem({
        id: 's1',
        statusSubitem: 'associado',
        etiquetaAtual: 'QR-SUB-s1',
        pedidoVendaId: 'pv1',
        pedidoVendaItemId: 'pvi1',
      }),
    ).not.toThrow();
  });
});

describe('FechamentoService — reabrir de status nao-fechado', () => {
  it('reabrir de status nao-fechado lanca ConflictException', async () => {
    const emitter = new EventEmitter2();
    jest.spyOn(emitter, 'emit').mockImplementation((() => true) as never);
    const dbObj: Record<string, unknown> = {};
    dbObj.transaction = jest.fn(async (fn: (tx: unknown) => unknown) => {
      return fn(dbObj);
    });
    const caminhaoService = {
      caminhaoAtivo: jest.fn().mockResolvedValue({
        id: 'cam-1',
        statusCaminhao: 'em_carga',
      }),
    };
    const service = new FechamentoService(
      { db: dbObj } as never,
      { registrar: jest.fn() } as never,
      emitter,
      caminhaoService as never,
    );

    await expect(service.reabrir('cam-1', 'justificativa', 'user-1')).rejects.toThrow(
      'Reabertura só permitida',
    );
  });
});
