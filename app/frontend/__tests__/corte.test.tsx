import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { CorteClient } from '../src/app/(admin)/operacao/corte/corte-client';

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
  close() { this.onclose?.(); }
}

const statusDispositivos = {
  balanca: { status: 'disponivel', dispositivoId: 'b1', heartbeatEm: 'now' },
  leitor: { status: 'disponivel', dispositivoId: 'l1', heartbeatEm: 'now' },
  impressora: { status: 'disponivel', dispositivoId: 'p1', heartbeatEm: 'now' },
};

function mockFetch(overrides: Record<string, unknown> = {}) {
  global.fetch = jest.fn(async (url: string) => {
    if (typeof url === 'string' && url.includes('/dispositivos/status')) {
      return { ok: true, json: async () => statusDispositivos };
    }
    const found = Object.entries(overrides).find(([k]) => typeof url === 'string' && url.includes(k));
    if (found) return { ok: true, json: async () => found[1] };
    return { ok: true, json: async () => ({}) };
  }) as unknown as typeof fetch;
}

describe('CorteClient', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    (global as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
    mockFetch();
  });

  it('mostra status dos dispositivos sempre visível', async () => {
    render(<CorteClient permissoes={['PESAGEM_LER']} />);
    await waitFor(() => expect(screen.getByTestId('status-dispositivos')).toBeInTheDocument());
  });

  it('botão Iniciar corte só aparece com CORTE_GERENCIAR', async () => {
    const { rerender } = render(<CorteClient permissoes={['PESAGEM_LER']} />);
    await waitFor(() => expect(screen.getByTestId('status-dispositivos')).toBeInTheDocument());
    expect(screen.queryByText('Iniciar corte')).not.toBeInTheDocument();

    rerender(<CorteClient permissoes={['PESAGEM_LER', 'CORTE_GERENCIAR']} />);
    expect(screen.getByText('Iniciar corte')).toBeInTheDocument();
  });

  it('inicia corte e exibe painel da transformação', async () => {
    const transformacao = {
      id: 't1aaaaaabbbbccccddddeeeeffff0001',
      pecaOrigemId: 'pc1aaaaaabbbbccccddddeeeeffff001',
      tipoTransformacao: 'subdivisao',
      motivo: 'necessidade_operacional',
      statusTransformacao: 'aberta',
      pesoOriginal: '12.500',
      pesoSubitensTotal: null,
      diferencaPeso: null,
      justificativaDiferenca: null,
    };
    mockFetch({
      '/iniciar': transformacao,
      't1aaaaaabbbbccccddddeeeeffff0001': { transformacao, subitens: [] },
    });
    render(<CorteClient permissoes={['CORTE_GERENCIAR', 'PESAGEM_LER']} />);
    await waitFor(() => expect(screen.getByTestId('status-dispositivos')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Peça (id)'), { target: { value: 'pc1aaaaaabbbbccccddddeeeeffff001' } });
    fireEvent.click(screen.getByText('Iniciar corte'));

    await waitFor(() => expect(screen.getByTestId('corte-atual')).toBeInTheDocument());
    expect(screen.getByText(/Transformação t1aaaaaa/)).toBeInTheDocument();
  });
});
