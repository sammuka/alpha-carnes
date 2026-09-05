import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DisponibilidadePage from '../src/app/(admin)/comercial/disponibilidade/page';

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

const disponibilidades = [
  {
    modo: 'compra' as const,
    id: 'd1',
    compraProgramadaId: 'cp-1',
    operacaoId: 'operacao-1',
    produtoId: 'item-1',
    dataOperacao: '2026-06-07',
    quantidadeTotalGerada: '40.000',
    quantidadeReservada: '0.000',
    quantidadeDisponivel: '40.000',
    quantidadeRecebida: '0.000',
    quantidadeComDivergencia: '0.000',
    status: 'gerada',
  },
];

function resposta(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  }));
}

describe('DisponibilidadePage', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    (global as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/comercial/disponibilidade?dataOperacao=')) {
        return resposta(disponibilidades);
      }
      if (url === '/api/comercial/disponibilidade/mapa?operacaoId=operacao-1') {
        return resposta([{
          produtoId: 'item-1',
          codigo: 'TZ',
          descricao: 'Traseiro Bovino',
          provisorio: true,
          estados: {
            F: '2.000',
            V: '40.000',
            R: '0.000',
            C: '0.000',
            D: '0.000',
            O: '0.000',
            E: '0.000',
            '!': '0.000',
          },
          unidades: {
            F: 1,
            V: 0,
            R: 0,
            C: 0,
            D: 0,
            O: 0,
            E: 0,
            '!': 0,
          },
          saldoComercial: '40.000',
        }]);
      }
      return resposta({ message: `URL inesperada: ${url}` }, 500);
    }) as unknown as typeof fetch;
  });

  it('abre no mapa e atualiza o saldo real da grade por realtime sem refetch da lista', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    render(<DisponibilidadePage />);

    expect(await screen.findByRole('heading', { name: /^Disponibilidade$/ })).toBeInTheDocument();
    expect(await screen.findByText('Traseiro Bovino')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Grade$/ }));
    expect(await screen.findByTestId('disp-d1-disponivel')).toHaveTextContent('40.000');

    const contarLista = () => fetchMock.mock.calls.filter(([input]) =>
      String(input).startsWith('/api/comercial/disponibilidade?dataOperacao=')).length;
    const chamadasListaAntes = contarLista();
    const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    if (!ws) throw new Error('WebSocket não instanciado');

    act(() => {
      ws.onmessage?.({
        data: JSON.stringify({
          type: 'reserva_disponibilidade_atualizada',
          payload: { disponibilidadeId: 'd1', quantidadeReservada: '4.000', quantidadeDisponivel: '36.000' },
        }),
      });
    });

    await waitFor(() =>
      expect(screen.getByTestId('disp-d1-disponivel')).toHaveTextContent('36.000'));
    expect(contarLista()).toBe(chamadasListaAntes);
  });
});
