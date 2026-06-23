import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { RecebimentoCargaClient } from '../src/app/(admin)/recebimento/recebimento-carga/recebimento-carga-client';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];
  readyState = 1;
  constructor(public url: string) {
    MockWebSocket.instances.push(this);
    setTimeout(() => this.onopen?.(), 0);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.onclose?.();
  }
}

const PERMISSOES = ['RECEBIMENTO_LER', 'RECEBIMENTO_GERENCIAR'];

const recebimentoResumo = {
  id: 'r1',
  compraProgramadaId: 'c1',
  fornecedorId: 'f1',
  dataOperacao: '2026-06-07',
  status: 'com_divergencia',
};

const recebimentoComDivergencia = {
  id: 'r1',
  compraProgramadaId: 'c1',
  fornecedorId: 'f1',
  dataOperacao: '2026-06-07',
  status: 'com_divergencia',
  notaFiscalFornecedor: null,
  itens: [
    {
      id: 'it1',
      itemComercialId: 'item-1',
      quantidadeEsperada: '40.000',
      quantidadeRecebida: '36.000',
      pesoTotalApurado: null,
      statusApuracao: 'divergente',
      observacoes: null,
    },
  ],
  divergencias: [
    {
      id: 'dv1',
      recebimentoItemId: 'it1',
      tipo: 'quantidade_menor',
      descricao: 'faltou',
      acaoImediata: 'replanejar',
      status: 'aberta',
    },
  ],
};

function mockFetchRecebimento() {
  global.fetch = jest.fn(async (url: string) => {
    if (typeof url === 'string' && url.includes('/api/operacao/recebimentos?pageSize')) {
      return { ok: true, json: async () => ({ data: [recebimentoResumo] }) };
    }
    if (typeof url === 'string' && url.includes('/api/operacao/recebimentos/r1')) {
      return { ok: true, json: async () => recebimentoComDivergencia };
    }
    if (typeof url === 'string' && url.includes('/api/comercial/compras-programadas')) {
      return { ok: true, json: async () => ({ data: [] }) };
    }
    return { ok: true, json: async () => ({ data: [] }) };
  }) as unknown as typeof fetch;
}

describe('RecebimentoCargaClient', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    (global as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
    mockFetchRecebimento();
  });

  it('renderiza o título (smoke)', async () => {
    render(<RecebimentoCargaClient permissoes={PERMISSOES} />);
    expect(screen.getByText('Recebimento de carga')).toBeInTheDocument();
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  });

  it('carrega detalhe ao selecionar recebimento e bloqueia conclusão com divergência aberta', async () => {
    render(<RecebimentoCargaClient permissoes={PERMISSOES} />);
    await waitFor(() => expect(screen.getByText(/r1/i)).toBeInTheDocument());

    fireEvent.click(screen.getByText(/r1/i).closest('button')!);

    await waitFor(() => expect(screen.getByTestId('receb-status')).toHaveTextContent('com_divergencia'));
    expect(screen.getByTestId('item-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('btn-concluir')).toBeDisabled();
  });

  it('recarrega ao receber evento recebimento_registrado via WS', async () => {
    render(<RecebimentoCargaClient permissoes={PERMISSOES} />);
    await waitFor(() => expect(screen.getByText(/r1/i)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/r1/i).closest('button')!);
    await waitFor(() => expect(screen.getByTestId('item-item-1')).toBeInTheDocument());

    const fetchSpy = global.fetch as jest.Mock;
    const chamadasAntes = fetchSpy.mock.calls.length;
    const ws = MockWebSocket.instances[0];
    if (!ws) throw new Error('WebSocket não instanciado');

    act(() => {
      ws.onmessage?.({ data: JSON.stringify({ type: 'recebimento_registrado', payload: { recebimentoId: 'r1' } }) });
    });

    await waitFor(() => expect(fetchSpy.mock.calls.length).toBeGreaterThan(chamadasAntes));
  });
});
