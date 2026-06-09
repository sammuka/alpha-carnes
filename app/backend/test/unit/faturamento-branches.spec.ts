import { assertTransicaoNfse, type StatusNfse } from '../../src/modules/operacao/faturamento/transicoes-nfse';
import { avaliarBloqueios, type DadosParaBloqueios } from '../../src/modules/operacao/faturamento/bloqueios';

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
