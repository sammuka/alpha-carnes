import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ExpedicaoClient } from '../src/app/(admin)/operacao/expedicao/expedicao-client';

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
    const found = Object.entries(overrides).find(
      ([k]) => typeof url === 'string' && url.includes(k),
    );
    if (found) return { ok: true, json: async () => found[1] };
    if (typeof url === 'string' && url.includes('/caminhoes')) {
      return { ok: true, json: async () => [] };
    }
    return { ok: true, json: async () => ({}) };
  }) as unknown as typeof fetch;
}

describe('ExpedicaoClient', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    (global as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
    mockFetch();
  });

  it('renderiza título Expedição', async () => {
    render(<ExpedicaoClient permissoes={[]} />);
    expect(screen.getByText('Expedição')).toBeInTheDocument();
  });

  it('mostra mensagem quando não há caminhões', async () => {
    mockFetch({ '/caminhoes': [] });
    render(<ExpedicaoClient permissoes={['EXPEDICAO_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByTestId('sem-caminhoes')).toBeInTheDocument());
  });

  it('exibe lista de caminhões quando há dados', async () => {
    mockFetch({ '/caminhoes': [caminhaoBase] });
    render(<ExpedicaoClient permissoes={['EXPEDICAO_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByTestId('lista-caminhoes')).toBeInTheDocument());
    expect(screen.getByText('ABC-1234 — João Silva')).toBeInTheDocument();
  });

  it('botão Abrir carga só aparece com EXPEDICAO_GERENCIAR e status planejado', async () => {
    mockFetch({ '/caminhoes': [caminhaoBase] });

    const { rerender } = render(<ExpedicaoClient permissoes={[]} />);
    await waitFor(() => expect(screen.getByTestId('lista-caminhoes')).toBeInTheDocument());
    expect(screen.queryByTestId('btn-abrir-carga')).not.toBeInTheDocument();

    rerender(<ExpedicaoClient permissoes={['EXPEDICAO_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByTestId('btn-abrir-carga')).toBeInTheDocument());
  });

  it('link Ver detalhe está presente para cada caminhão', async () => {
    mockFetch({ '/caminhoes': [caminhaoBase] });
    render(<ExpedicaoClient permissoes={['EXPEDICAO_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByTestId('link-detalhe')).toBeInTheDocument());
    expect(screen.getByTestId('link-detalhe')).toHaveAttribute(
      'href',
      `/operacao/expedicao/${caminhaoBase.id}`,
    );
  });

  it('exibe badge de status com o texto correto', async () => {
    mockFetch({ '/caminhoes': [caminhaoBase] });
    render(<ExpedicaoClient permissoes={['EXPEDICAO_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByTestId('status-badge')).toBeInTheDocument());
    expect(screen.getByTestId('status-badge')).toHaveTextContent('planejado');
  });

  it('exibe erro quando API retorna falha', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      json: async () => ({ message: 'Sem autorização' }),
    })) as unknown as typeof fetch;
    render(<ExpedicaoClient permissoes={['EXPEDICAO_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('Sem autorização');
  });

  it('chama abrir-carga ao clicar no botão', async () => {
    mockFetch({ '/caminhoes': [caminhaoBase] });
    const postResponse = { ...caminhaoBase, statusCaminhao: 'em_carga' };
    global.fetch = jest.fn(async (url: string, opts?: RequestInit) => {
      if (typeof url === 'string' && url.includes('abrir-carga') && opts?.method === 'POST') {
        return { ok: true, json: async () => postResponse };
      }
      if (typeof url === 'string' && url.includes('/caminhoes')) {
        return { ok: true, json: async () => [caminhaoBase] };
      }
      return { ok: true, json: async () => ({}) };
    }) as unknown as typeof fetch;

    render(<ExpedicaoClient permissoes={['EXPEDICAO_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByTestId('btn-abrir-carga')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('btn-abrir-carga'));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('abrir-carga'),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });
});
