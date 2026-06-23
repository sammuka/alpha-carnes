import { render, screen, waitFor, act } from '@testing-library/react';
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
    id: 'd1',
    itemComercialId: 'item-1',
    dataOperacao: '2026-06-07',
    quantidadeTotalGerada: '40.000',
    quantidadeReservada: '0.000',
    quantidadeDisponivel: '40.000',
    quantidadeRecebida: '0.000',
    quantidadeComDivergencia: '0.000',
    status: 'gerada',
  },
];

describe('DisponibilidadePage', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    (global as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => disponibilidades,
    })) as unknown as typeof fetch;
  });

  it('renderiza o saldo do dia (smoke + fetch inicial)', async () => {
    render(<DisponibilidadePage />);
    expect(screen.getByText('Disponibilidade virtual')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('disp-d1-disponivel')).toHaveTextContent('40.000');
    });
  });

  it('atualiza o saldo ao receber evento WebSocket SEM refetch', async () => {
    render(<DisponibilidadePage />);
    await waitFor(() => expect(screen.getByTestId('disp-d1-disponivel')).toHaveTextContent('40.000'));

    const ws = MockWebSocket.instances[0];
    if (!ws) throw new Error('WebSocket não instanciado');

    act(() => {
      ws.onmessage?.({
        data: JSON.stringify({
          type: 'reserva_disponibilidade_atualizada',
          payload: { disponibilidadeId: 'd1', quantidadeReservada: '4.000', quantidadeDisponivel: '36.000' },
        }),
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('disp-d1-disponivel')).toHaveTextContent('36.000');
    });
  });
});
