import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NovoPedidoPage from '../src/app/(admin)/comercial/pedidos/novo/page';

const UUID = '019e0000-0000-7000-8000-000000000001';

describe('NovoPedidoPage', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ id: 'pedido-1', status: 'reservado' }),
    })) as unknown as typeof fetch;
  });

  it('renderiza o formulário de pedido (smoke)', () => {
    render(<NovoPedidoPage />);
    expect(screen.getByText('Novo pedido')).toBeInTheDocument();
    expect(screen.getByLabelText('Compra programada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /criar pedido/i })).toBeInTheDocument();
  });

  it('submete o pedido via BFF e exibe o resultado', async () => {
    render(<NovoPedidoPage />);

    fireEvent.input(screen.getByLabelText('Compra programada'), { target: { value: UUID } });
    fireEvent.input(screen.getByLabelText('Cliente'), { target: { value: UUID } });
    fireEvent.input(screen.getByLabelText('Data operacional'), { target: { value: '2026-06-07' } });
    fireEvent.input(screen.getByLabelText('Item comercial'), { target: { value: UUID } });
    fireEvent.input(screen.getByLabelText('Quantidade'), { target: { value: '4' } });

    fireEvent.click(screen.getByRole('button', { name: /criar pedido/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('pedido-1');
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/comercial/pedidos',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
