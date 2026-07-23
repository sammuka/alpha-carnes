import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { PedidoVendaClient } from '../src/app/(admin)/comercial/pedidos/pedido-venda-client';

const PERMISSOES = ['PEDIDOS_LER', 'PEDIDOS_GERENCIAR'];

function mockFetchVazio() {
  global.fetch = jest.fn(async (url: string, opts?: { method?: string }) => {
    if (typeof url === 'string' && url.includes('/api/comercial/pedidos') && opts?.method === 'POST') {
      return {
        ok: true,
        json: async () => ({ id: 'pedido-1', status: 'reservado' }),
      };
    }
    if (typeof url === 'string' && url.includes('/api/comercial/compras-programadas')) {
      return {
        ok: true,
        json: async () => ({
          data: [{ id: 'c1', dataOperacao: '2026-06-07', status: 'confirmada' }],
        }),
      };
    }
    if (typeof url === 'string' && url.includes('/api/cadastros/clientes')) {
      return { ok: true, json: async () => ({ data: [{ id: 'cl1', razaoSocial: 'Cliente Teste' }] }) };
    }
    if (typeof url === 'string' && url.includes('/api/cadastros/itens-comerciais')) {
      return { ok: true, json: async () => ({ data: [{ id: 'ic1', codigo: 'DIANT' }] }) };
    }
    if (typeof url === 'string' && url.includes('/api/comercial/disponibilidade')) {
      return { ok: true, json: async () => [] };
    }
    return { ok: true, json: async () => ({ data: [] }) };
  }) as unknown as typeof fetch;
}

describe('PedidoVendaClient (modo novo)', () => {
  beforeEach(() => {
    mockFetchVazio();
  });

  it('renderiza o formulário de pedido (smoke)', async () => {
    render(<PedidoVendaClient permissoes={PERMISSOES} modo="novo" />);
    await waitFor(() => {
      expect(screen.getByText('Novo pedido de venda')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /salvar e reservar/i })).toBeInTheDocument();
    expect(screen.getByText('Cliente')).toBeInTheDocument();
  });

  it('exige campos obrigatórios antes de submeter', async () => {
    render(<PedidoVendaClient permissoes={PERMISSOES} modo="novo" />);
    await waitFor(() => expect(screen.getByText('Novo pedido de venda')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /salvar e reservar/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/preencha compra, cliente e ao menos um item/i);
    });
  });
});
