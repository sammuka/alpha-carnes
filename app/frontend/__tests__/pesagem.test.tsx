import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { PesagemClient } from '../src/app/(admin)/operacao/pesagem/pesagem-client';

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

const statusDispositivos = {
  balanca: { status: 'indisponivel', dispositivoId: 'b1', heartbeatEm: 'now' },
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

describe('PesagemClient', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    (global as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
    mockFetch();
  });

  it('mostra o status dos dispositivos sempre visível (RA-05)', async () => {
    render(<PesagemClient permissoes={['PESAGEM_LER', 'PESAGEM_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByLabelText(/Balança indisponivel/i)).toBeInTheDocument());
  });

  it('mostra botão de peso manual apenas com permissão PESO_MANUAL', async () => {
    const { rerender } = render(<PesagemClient permissoes={['PESAGEM_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByTestId('status-dispositivos')).toBeInTheDocument());
    expect(screen.queryByText('Peso manual assistido')).not.toBeInTheDocument();

    rerender(<PesagemClient permissoes={['PESAGEM_GERENCIAR', 'PESO_MANUAL']} />);
    expect(screen.getByText('Peso manual assistido')).toBeInTheDocument();
  });

  it('captura automática cria peça e permite sugerir', async () => {
    mockFetch({
      '/api/operacao/pesagem/pecas': { id: 'pc1aaaaaa', recebimentoId: 'r1', pesoOriginal: '12.500', modoCapturaPeso: 'automatico', statusPeca: 'pesada', etiquetaAtual: null, pedidoVendaId: null, pedidoVendaItemId: null },
    });
    render(<PesagemClient permissoes={['PESAGEM_GERENCIAR', 'ASSOCIACAO_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByTestId('status-dispositivos')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Recebimento (id)'), { target: { value: 'r1' } });
    fireEvent.change(screen.getByLabelText('Item comercial (id)'), { target: { value: 'i1' } });
    fireEvent.click(screen.getByText('Capturar peso automático'));

    await waitFor(() => expect(screen.getByTestId('peca-atual')).toBeInTheDocument());
    expect(screen.getByTestId('peca-status')).toHaveTextContent('pesada');
    expect(screen.getByText('Sugerir pedido')).toBeInTheDocument();
  });

  it('exibe alerta quando a balança está indisponível', async () => {
    render(<PesagemClient permissoes={['PESAGEM_GERENCIAR', 'PESO_MANUAL']} />);
    await waitFor(() => expect(screen.getByTestId('status-dispositivos')).toBeInTheDocument());
    expect(screen.getByText(/use o peso manual assistido/i)).toBeInTheDocument();
  });
});
