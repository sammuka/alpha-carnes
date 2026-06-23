import { assertTransicaoNfse, type StatusNfse } from '../../src/modules/operacao/faturamento/transicoes-nfse';
import { avaliarBloqueios, type DadosParaBloqueios } from '../../src/modules/operacao/faturamento/bloqueios';
import { ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FaturamentoService } from '../../src/modules/operacao/faturamento/faturamento.service';

// ─────────────────────────────────────────────────────────────────────────────
// transicoes-nfse
// ─────────────────────────────────────────────────────────────────────────────

describe('transicoes-nfse — assertTransicaoNfse', () => {
  it('pendente → emitida: válido', () => {
    expect(() => assertTransicaoNfse('pendente', 'emitida')).not.toThrow();
  });

  it('pendente → erro_emissao: válido', () => {
    expect(() => assertTransicaoNfse('pendente', 'erro_emissao')).not.toThrow();
  });

  it('emitida → cancelada: válido', () => {
    expect(() => assertTransicaoNfse('emitida', 'cancelada')).not.toThrow();
  });

  it('emitida → erro_cancelamento: válido', () => {
    expect(() => assertTransicaoNfse('emitida', 'erro_cancelamento')).not.toThrow();
  });

  it('erro_emissao → pendente: válido (reprocessamento)', () => {
    expect(() => assertTransicaoNfse('erro_emissao', 'pendente')).not.toThrow();
  });

  it('erro_cancelamento → cancelada: válido (retry cancelamento)', () => {
    expect(() => assertTransicaoNfse('erro_cancelamento', 'cancelada')).not.toThrow();
  });

  it('cancelada → qualquer: inválido (lança)', () => {
    const destinos: StatusNfse[] = ['pendente', 'emitida', 'erro_emissao', 'erro_cancelamento'];
    for (const dest of destinos) {
      expect(() => assertTransicaoNfse('cancelada', dest)).toThrow(/inválida/i);
    }
  });

  it('emitida → pendente: inválido (lança)', () => {
    expect(() => assertTransicaoNfse('emitida', 'pendente')).toThrow(/inválida/i);
  });

  it('emitida → erro_emissao: inválido (lança)', () => {
    expect(() => assertTransicaoNfse('emitida', 'erro_emissao')).toThrow(/inválida/i);
  });

  it('pendente → cancelada: inválido (lança)', () => {
    expect(() => assertTransicaoNfse('pendente', 'cancelada')).toThrow(/inválida/i);
  });

  it('erro_emissao → emitida: inválido (lança)', () => {
    expect(() => assertTransicaoNfse('erro_emissao', 'emitida')).toThrow(/inválida/i);
  });

  it('mensagem de erro inclui o status de origem e destino', () => {
    try {
      assertTransicaoNfse('cancelada', 'emitida');
    } catch (e: unknown) {
      expect((e as Error).message).toContain('cancelada');
      expect((e as Error).message).toContain('emitida');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// bloqueios — avaliarBloqueios
// ─────────────────────────────────────────────────────────────────────────────

function baseDados(overrides: Partial<DadosParaBloqueios> = {}): DadosParaBloqueios {
  return {
    statusCaminhao: 'fechado',
    itensCarregados: [
      {
        pedidoVendaId: 'pv-001',
        cliente: {
          razaoSocial: 'Cliente OK',
          documentoFiscal: '12345678000190', // 14 dígitos — CNPJ válido
          dadosFiscaisJson: {},
        },
      },
    ],
    temDivergenciaCriticaNaoTratada: false,
    temPecaSemRastreabilidade: false,
    ...overrides,
  };
}

describe('bloqueios — avaliarBloqueios', () => {
  it('caminhão fechado + dados fiscais completos + sem rastreabilidade → array vazio', () => {
    const bloqueios = avaliarBloqueios(baseDados());
    expect(bloqueios).toHaveLength(0);
  });

  it('caminhão não fechado → bloqueio EXPEDICAO_NAO_FECHADA', () => {
    const bloqueios = avaliarBloqueios(baseDados({ statusCaminhao: 'em_carga' }));
    const b = bloqueios.find((b) => b.codigo === 'EXPEDICAO_NAO_FECHADA');
    expect(b).toBeDefined();
    expect(b!.causa).toBeTruthy();
    expect(b!.impacto).toBeTruthy();
    expect(b!.acao).toBeTruthy();
  });

  it('caminhão com status planejado → bloqueio EXPEDICAO_NAO_FECHADA', () => {
    const bloqueios = avaliarBloqueios(baseDados({ statusCaminhao: 'planejado' }));
    expect(bloqueios.some((b) => b.codigo === 'EXPEDICAO_NAO_FECHADA')).toBe(true);
  });

  it('caminhão fechado + dados fiscais incompletos (doc < 11 dígitos) → bloqueio DADOS_FISCAIS_INCOMPLETOS', () => {
    const bloqueios = avaliarBloqueios(
      baseDados({
        itensCarregados: [
          {
            pedidoVendaId: 'pv-002',
            cliente: {
              razaoSocial: 'Sem CPF',
              documentoFiscal: '123', // menos de 11 dígitos
              dadosFiscaisJson: {},
            },
          },
        ],
      }),
    );
    const b = bloqueios.find((b) => b.codigo === 'DADOS_FISCAIS_INCOMPLETOS');
    expect(b).toBeDefined();
    expect(b!.causa).toBeTruthy();
    expect(b!.impacto).toBeTruthy();
    expect(b!.acao).toBeTruthy();
  });

  it('documento fiscal vazio → bloqueio DADOS_FISCAIS_INCOMPLETOS', () => {
    const bloqueios = avaliarBloqueios(
      baseDados({
        itensCarregados: [
          {
            pedidoVendaId: 'pv-003',
            cliente: {
              razaoSocial: 'Sem Doc',
              documentoFiscal: '',
              dadosFiscaisJson: {},
            },
          },
        ],
      }),
    );
    expect(bloqueios.some((b) => b.codigo === 'DADOS_FISCAIS_INCOMPLETOS')).toBe(true);
  });

  it('peça sem rastreabilidade → bloqueio PECA_SEM_RASTREABILIDADE', () => {
    const bloqueios = avaliarBloqueios(baseDados({ temPecaSemRastreabilidade: true }));
    const b = bloqueios.find((b) => b.codigo === 'PECA_SEM_RASTREABILIDADE');
    expect(b).toBeDefined();
    expect(b!.causa).toBeTruthy();
    expect(b!.impacto).toBeTruthy();
    expect(b!.acao).toBeTruthy();
  });

  it('divergência crítica não tratada → bloqueio DIVERGENCIA_CRITICA_NAO_TRATADA', () => {
    const bloqueios = avaliarBloqueios(baseDados({ temDivergenciaCriticaNaoTratada: true }));
    const b = bloqueios.find((b) => b.codigo === 'DIVERGENCIA_CRITICA_NAO_TRATADA');
    expect(b).toBeDefined();
  });

  it('cada bloqueio tem codigo, causa, impacto, acao', () => {
    const bloqueios = avaliarBloqueios(
      baseDados({
        statusCaminhao: 'em_carga',
        temPecaSemRastreabilidade: true,
        itensCarregados: [
          {
            pedidoVendaId: 'pv-004',
            cliente: {
              razaoSocial: 'Sem Doc',
              documentoFiscal: '',
              dadosFiscaisJson: {},
            },
          },
        ],
      }),
    );
    expect(bloqueios.length).toBeGreaterThan(0);
    for (const b of bloqueios) {
      expect(b.codigo).toBeTruthy();
      expect(b.causa).toBeTruthy();
      expect(b.impacto).toBeTruthy();
      expect(b.acao).toBeTruthy();
    }
  });

  it('apenas um bloqueio DADOS_FISCAIS_INCOMPLETOS mesmo com múltiplos clientes sem doc', () => {
    // A implementação usa break após o primeiro bloqueio de dados fiscais
    const bloqueios = avaliarBloqueios(
      baseDados({
        itensCarregados: [
          { pedidoVendaId: 'pv-a', cliente: { razaoSocial: 'A', documentoFiscal: '', dadosFiscaisJson: {} } },
          { pedidoVendaId: 'pv-b', cliente: { razaoSocial: 'B', documentoFiscal: '', dadosFiscaisJson: {} } },
        ],
      }),
    );
    const fiscais = bloqueios.filter((b) => b.codigo === 'DADOS_FISCAIS_INCOMPLETOS');
    expect(fiscais).toHaveLength(1);
  });

  it('sem itens carregados não gera bloqueio de dados fiscais', () => {
    const bloqueios = avaliarBloqueios(baseDados({ itensCarregados: [] }));
    expect(bloqueios.some((b) => b.codigo === 'DADOS_FISCAIS_INCOMPLETOS')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FaturamentoService — catch de erro de banco (código 23505)
// ─────────────────────────────────────────────────────────────────────────────

describe('FaturamentoService — catch de erro de banco', () => {
  function buildService(overrides: {
    dbTransaction?: (fn: (tx: unknown) => unknown) => Promise<unknown>;
  } = {}) {
    // Faturamento e caminhão existentes (Fase A queries)
    const dbFat = [{ id: 'fat-1', caminhaoId: 'cam-1', deletedAt: null }];
    const dbCam = [{
      id: 'cam-1',
      statusCaminhao: 'fechado',
      dataOperacao: '2027-01-01',
      deletedAt: null,
    }];
    const dbPedido = [{
      pedido: { id: 'pv-1', clienteId: 'cli-1', deletedAt: null },
      cliente: {
        id: 'cli-1',
        razaoSocial: 'Cliente Teste',
        documentoFiscal: '12345678000190',
        dadosFiscaisJson: {},
        dadosContatoJson: {},
      },
    }];

    // Mock do db com select encadeado e transaction configurável
    let selectCallCount = 0;
    const selectResults = [dbFat, dbCam, dbPedido, [{ chave: null }]];
    const thenMock = jest.fn((fn: (r: unknown[]) => unknown) => {
      const idx = selectCallCount++;
      return Promise.resolve(fn(selectResults[idx] ?? []));
    });
    const whereMock = jest.fn(() => ({ then: thenMock }));
    const fromMock = jest.fn(() => ({ where: whereMock, innerJoin: jest.fn(() => ({ where: whereMock })) }));
    const selectMock = jest.fn(() => ({ from: fromMock }));

    const dbObj = {
      select: selectMock,
      transaction: overrides.dbTransaction ?? jest.fn(async (fn: (tx: unknown) => unknown) => fn({})),
    };

    const gateway = {
      emitir: jest.fn(),
      cancelar: jest.fn(),
      consultarNotaCompleta: jest.fn(),
    };

    const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    const emitter = new EventEmitter2();
    jest.spyOn(emitter, 'emit').mockImplementation((() => true) as never);

    const consolidacaoService = {
      consolidar: jest.fn().mockResolvedValue({
        bloqueios: [],
        totalItens: 1,
        pedidos: [{ pedidoVendaId: 'pv-1', pesoTotalKg: 10 }],
      }),
    };

    const liberacaoService = {
      sincronizarStatusPosEmissao: jest.fn().mockResolvedValue(undefined),
    };

    return new FaturamentoService(
      { db: dbObj } as never,
      gateway as never,
      auditoria as never,
      emitter,
      consolidacaoService as never,
      liberacaoService as never,
    );
  }

  it('db.transaction lança erro code=23505 → ConflictException (não relança o erro bruto)', async () => {
    const dbError = Object.assign(new Error('unique violation'), { code: '23505' });

    const service = buildService({
      dbTransaction: jest.fn().mockRejectedValueOnce(dbError),
    });

    await expect(
      service.emitir('cam-1', { pedidoVendaId: 'pv-1', valor: '100.00' }, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('db.transaction lança erro code=23505 → mensagem inclui "NFS-e"', async () => {
    const dbError = Object.assign(new Error('unique violation'), { code: '23505' });

    const service = buildService({
      dbTransaction: jest.fn().mockRejectedValueOnce(dbError),
    });

    await expect(
      service.emitir('cam-1', { pedidoVendaId: 'pv-1', valor: '100.00' }, 'user-1'),
    ).rejects.toMatchObject({ message: expect.stringContaining('NFS-e') });
  });

  it('db.transaction lança ConflictException → relança sem transformar', async () => {
    const original = new ConflictException('conflito original');

    const service = buildService({
      dbTransaction: jest.fn().mockRejectedValueOnce(original),
    });

    await expect(
      service.emitir('cam-1', { pedidoVendaId: 'pv-1', valor: '100.00' }, 'user-1'),
    ).rejects.toBe(original);
  });

  it('db.transaction lança erro genérico (sem code 23505) → relança sem transformar', async () => {
    const genericError = new Error('falha inesperada de banco');

    const service = buildService({
      dbTransaction: jest.fn().mockRejectedValueOnce(genericError),
    });

    await expect(
      service.emitir('cam-1', { pedidoVendaId: 'pv-1', valor: '100.00' }, 'user-1'),
    ).rejects.toBe(genericError);
  });
});
