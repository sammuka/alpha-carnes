import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import RecebimentoPage from '../src/app/(admin)/operacao/recebimento/page';

// Mock do WebSocket: captura a instância para simular mensagens do servidor.
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
    { id: 'dv1', recebimentoItemId: 'it1', tipo: 'quantidade_menor', descricao: 'faltou', acaoImediata: 'replanejar', status: 'aberta' },
  ],
};

function mockIniciar() {
  global.fetch = jest.fn(async (url: string, opts?: { method?: string }) => {
    if (typeof url === 'string' && url.endsWith('/api/operacao/recebimentos') && opts?.method === 'POST') {
      return { ok: true, json: async () => ({ recebimento: { id: 'r1' }, jaIniciado: false }) };
    }
    if (typeof url === 'string' && url.includes('/api/operacao/recebimentos/r1')) {
      return { ok: true, json: async () => recebimentoComDivergencia };
    }
    return { ok: true, json: async () => ({}) };
  }) as unknown as typeof fetch;
}

describe('RecebimentoPage', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    (global as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
    mockIniciar();
  });

  it('renderiza o título (smoke)', () => {
    render(<RecebimentoPage />);
    expect(screen.getByText('Recebimento')).toBeInTheDocument();
  });

  it('inicia recebimento e mostra grid esperado×recebido', async () => {
    render(<RecebimentoPage />);
    fireEvent.change(screen.getByLabelText('Compra programada (confirmada)'), { target: { value: 'c1' } });
    fireEvent.click(screen.getByText('Iniciar recebimento'));

    await waitFor(() => expect(screen.getByTestId('item-item-1')).toBeInTheDocument());
    expect(screen.getByTestId('receb-status')).toHaveTextContent('com_divergencia');
  });

  it('bloqueia conclusão quando há divergência aberta', async () => {
    render(<RecebimentoPage />);
    fireEvent.change(screen.getByLabelText('Compra programada (confirmada)'), { target: { value: 'c1' } });
    fireEvent.click(screen.getByText('Iniciar recebimento'));

    await waitFor(() => expect(screen.getByTestId('btn-concluir')).toBeInTheDocument());
    expect(screen.getByTestId('btn-concluir')).toBeDisabled();
    expect(screen.getByText(/trate antes de concluir/i)).toBeInTheDocument();
  });

  it('exige classificação (descrição + ação) antes de registrar divergência', async () => {
    render(<RecebimentoPage />);
    fireEvent.change(screen.getByLabelText('Compra programada (confirmada)'), { target: { value: 'c1' } });
    fireEvent.click(screen.getByText('Iniciar recebimento'));
    await waitFor(() => expect(screen.getByTestId('item-item-1')).toBeInTheDocument());

    // Marca "Registrar divergência": sem descrição/ação o botão Registrar fica desabilitado.
    fireEvent.click(screen.getByLabelText('Registrar divergência'));
    expect(screen.getByText('Registrar')).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Descrição da divergência item-1'), { target: { value: 'faltou' } });
    fireEvent.change(screen.getByLabelText('Ação imediata item-1'), { target: { value: 'replanejar' } });
    expect(screen.getByText('Registrar')).toBeEnabled();
  });

  it('recarrega ao receber evento recebimento_registrado via WS', async () => {
    render(<RecebimentoPage />);
    fireEvent.change(screen.getByLabelText('Compra programada (confirmada)'), { target: { value: 'c1' } });
    fireEvent.click(screen.getByText('Iniciar recebimento'));
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
