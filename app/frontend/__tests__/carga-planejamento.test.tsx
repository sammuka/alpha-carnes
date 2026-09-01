import { render, screen, waitFor } from '@testing-library/react';
import { PlanejamentoExpedicaoClient } from '../src/app/(admin)/carga/planejamento/planejamento-client';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 1;
  constructor(public url: string) {
    MockWebSocket.instances.push(this);
    setTimeout(() => this.onopen?.(), 0);
  }
  send() {}
  close() {
    this.onclose?.();
  }
}

const caminhaoBase = {
  id: 'c1aaaaaabbbbccccddddeeeeffff0001',
  placa: 'ABC-1234',
  motorista: 'João Silva',
  rota: 'Rota Norte',
  dataOperacao: '2026-06-08',
  frotaCaminhaoId: null,
  capacidadeKg: null,
  statusCaminhao: 'planejado' as const,
  horaAberturaCarga: null,
  horaFechamentoCarga: null,
  observacoes: null,
  createdAt: '2026-06-08T08:00:00.000Z',
};

function mockFetch(overrides: Record<string, unknown> = {}) {
  global.fetch = jest.fn(async (url: string) => {
    const urlStr = String(url);
    const found = Object.entries(overrides)
      .sort(([a], [b]) => b.length - a.length)
      .find(([k]) => urlStr.includes(k));
    if (found) return { ok: true, json: async () => found[1] };
    if (urlStr.includes('/romaneio')) {
      return { ok: true, json: async () => ({ caminhao: caminhaoBase, pedidos: [] }) };
    }
    if (urlStr.includes('/caminhoes')) {
      return { ok: true, json: async () => [] };
    }
    if (urlStr.includes('/pedidos')) {
      return { ok: true, json: async () => ({ data: [] }) };
    }
    if (urlStr.includes('/clientes')) {
      return { ok: true, json: async () => ({ data: [] }) };
    }
    if (urlStr.includes('/frota-caminhoes')) {
      return { ok: true, json: async () => ({ data: [] }) };
    }
    return { ok: true, json: async () => ({}) };
  }) as unknown as typeof fetch;
}

describe('PlanejamentoExpedicaoClient', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    (global as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
    mockFetch();
  });

  it('renderiza título Planejamento de Expedição', async () => {
    render(<PlanejamentoExpedicaoClient permissoes={[]} />);
    expect(screen.getByText('Planejamento de Expedição')).toBeInTheDocument();
  });

  it('formulário de novo caminhão só aparece com EXPEDICAO_GERENCIAR', async () => {
    const { rerender } = render(<PlanejamentoExpedicaoClient permissoes={[]} />);
    await waitFor(() => expect(screen.queryByText('Novo Caminhão')).not.toBeInTheDocument());

    rerender(<PlanejamentoExpedicaoClient permissoes={['EXPEDICAO_GERENCIAR']} />);
    expect(screen.getByText('Novo Caminhão')).toBeInTheDocument();
  });

  it('exibe erro quando API retorna falha', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      json: async () => ({ message: 'Sem autorização' }),
    })) as unknown as typeof fetch;
    render(<PlanejamentoExpedicaoClient permissoes={['EXPEDICAO_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao carregar dados');
  });

  it('carrega caminhões do dia quando API responde', async () => {
    mockFetch({
      '/caminhoes/c1aaaaaabbbbccccddddeeeeffff0001': { caminhao: { ...caminhaoBase, pesoCarregadoKg: '0.000' }, pedidos: [] },
      '/caminhoes': [caminhaoBase],
    });
    render(<PlanejamentoExpedicaoClient permissoes={['EXPEDICAO_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByText('ABC-1234')).toBeInTheDocument());
  });

  it('agrupa pedidos sem caminhão por rota', async () => {
    mockFetch({
      '/pedidos': {
        data: [
          { id: 'ped-1', compraProgramadaId: 'c1', clienteId: 'cli-1', dataEntrega: null, rotaPrevista: 'Rota Norte', prioridade: null, status: 'em_elaboracao_reserva_ativa', observacoesGerais: null, createdAt: '2026-06-08T08:00:00.000Z' },
          { id: 'ped-2', compraProgramadaId: 'c1', clienteId: 'cli-2', dataEntrega: null, rotaPrevista: 'Rota Sul', prioridade: null, status: 'em_elaboracao_reserva_ativa', observacoesGerais: null, createdAt: '2026-06-08T08:00:00.000Z' },
        ],
      },
    });
    render(<PlanejamentoExpedicaoClient permissoes={['EXPEDICAO_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByText('Rota Norte')).toBeInTheDocument());
    expect(screen.getByText('Rota Sul')).toBeInTheDocument();
  });

  it('badge de prioridade renderiza ALTA/BAIXA e nada quando prioridade é null', async () => {
    mockFetch({
      '/pedidos': {
        data: [
          { id: 'ped-alta', compraProgramadaId: 'c1', clienteId: 'cli-1', dataEntrega: null, rotaPrevista: 'Rota Norte', prioridade: 3, status: 'em_elaboracao_reserva_ativa', observacoesGerais: null, createdAt: '2026-06-08T08:00:00.000Z' },
          { id: 'ped-baixa', compraProgramadaId: 'c1', clienteId: 'cli-2', dataEntrega: null, rotaPrevista: 'Rota Norte', prioridade: 1, status: 'em_elaboracao_reserva_ativa', observacoesGerais: null, createdAt: '2026-06-08T08:00:00.000Z' },
          { id: 'ped-nula', compraProgramadaId: 'c1', clienteId: 'cli-3', dataEntrega: null, rotaPrevista: 'Rota Norte', prioridade: null, status: 'em_elaboracao_reserva_ativa', observacoesGerais: null, createdAt: '2026-06-08T08:00:00.000Z' },
        ],
      },
    });
    render(<PlanejamentoExpedicaoClient permissoes={['EXPEDICAO_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByText('Prioridade ALTA')).toBeInTheDocument());
    expect(screen.getByText('Prioridade BAIXA')).toBeInTheDocument();
    expect(screen.queryByText(/Prioridade MÉDIA/)).not.toBeInTheDocument();
  });

  it('exibe Lote 001 sob cada peça alocada no caminhão', async () => {
    mockFetch({
      '/caminhoes/c1aaaaaabbbbccccddddeeeeffff0001/romaneio': {
        caminhao: { ...caminhaoBase, pesoCarregadoKg: '12.000' },
        pedidos: [{
          pedidoVendaId: 'ped-lote',
          clienteId: 'cli-1',
          ordemNaCarga: 1,
          previsto: 1,
          carregado: 1,
          itens: [
            {
              cargaItemId: 'item-1',
              pedidoVendaId: 'ped-lote',
              statusCargaItem: 'em_carga',
              divergenciaMotivo: null,
              etiqueta: 'ETQ-001',
              produtoNome: 'TZ',
              peso: '12.000',
              loteOrigem: 'Lote 001',
            },
            {
              cargaItemId: 'item-2',
              pedidoVendaId: 'ped-lote',
              statusCargaItem: 'em_carga',
              divergenciaMotivo: null,
              etiqueta: 'ETQ-002',
              produtoNome: 'DT',
              peso: '8.000',
              numeroSequencial: 2,
            },
          ],
        }],
      },
      '/caminhoes/c1aaaaaabbbbccccddddeeeeffff0001': {
        caminhao: { ...caminhaoBase, pesoCarregadoKg: '12.000' },
        pedidos: [{ pedidoVendaId: 'ped-lote', ordemNaCarga: 1, previsto: 1, carregado: 1 }],
      },
      '/caminhoes': [caminhaoBase],
    });
    render(<PlanejamentoExpedicaoClient permissoes={['EXPEDICAO_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByText('Lote 001')).toBeInTheDocument());
    expect(screen.getByText('Lote 002')).toBeInTheDocument();
  });

  it('barra de ocupação ausente quando capacidade é null', async () => {
    mockFetch({
      '/caminhoes/c1aaaaaabbbbccccddddeeeeffff0001': {
        caminhao: { ...caminhaoBase, capacidadeKg: null, pesoCarregadoKg: '0.000' },
        pedidos: [],
      },
      '/caminhoes': [caminhaoBase],
    });
    render(<PlanejamentoExpedicaoClient permissoes={['EXPEDICAO_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByText('ABC-1234')).toBeInTheDocument());
    expect(screen.getByText(/— kg/)).toBeInTheDocument();
  });
});
