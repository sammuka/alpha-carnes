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
    if (urlStr.includes('/caminhoes')) {
      return { ok: true, json: async () => [] };
    }
    if (urlStr.includes('/pedidos')) {
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
      '/caminhoes': [caminhaoBase],
      [`/caminhoes/${caminhaoBase.id}`]: { caminhao: caminhaoBase, pedidos: [] },
    });
    render(<PlanejamentoExpedicaoClient permissoes={['EXPEDICAO_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByText('ABC-1234')).toBeInTheDocument());
  });
});
