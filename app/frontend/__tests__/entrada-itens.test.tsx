import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntradaItensClient } from '../src/app/(admin)/estoque/entrada-itens/entrada-itens-client';

const produtoCaixaria = {
  id: 'prod1aaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  codigo: 'CXM',
  nome: 'Caixa de Miúdos',
  nomeOperacional: null,
  categoria: null,
  tipoOperacional: 'entrada_unidade' as const,
  unidadePedido: 'caixa',
  unidadePreco: 'unidade' as const,
  exigePeso: false,
  passaBalanca: false,
  passaDesossa: false,
  origemTransformacao: false,
  saidaTransformacao: false,
  podeEstoque: true,
  ativoVenda: true,
  ativoCompra: false,
  status: 'ativo' as const,
  observacoesOperacionais: null,
  atributosJson: {},
};

function mockFetch() {
  global.fetch = jest.fn(async (url: string) => {
    const u = String(url);
    if (u.includes('/api/operacao/estoque/entradas/compativeis')) {
      return {
        ok: true,
        json: async () => [{ pedidoVendaItemId: 'pvi1', pedidoVendaId: 'pv1', clienteNome: 'Açougue Dois Irmãos', pendencia: '3 caixas' }],
      } as Response;
    }
    if (u.includes('/api/operacao/estoque/entradas')) {
      return { ok: true, json: async () => ({ data: [], total: 0, page: 1, pageSize: 50 }) } as Response;
    }
    if (u.includes('/api/cadastros/produtos')) {
      return { ok: true, json: async () => ({ data: [produtoCaixaria], total: 1, page: 1, pageSize: 100 }) } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  }) as unknown as typeof fetch;
}

describe('EntradaItensClient', () => {
  beforeEach(() => mockFetch());

  it('botão Confirmar entrada desabilitado sem produto/qtd/fornecedor', async () => {
    render(<EntradaItensClient podeRegistrar />);
    await waitFor(() => expect(screen.getByText('Nova entrada')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Confirmar entrada/ })).toBeDisabled();
  });

  it('destino Pedido exige seleção de pedido para habilitar confirmar', async () => {
    render(<EntradaItensClient podeRegistrar />);
    await waitFor(() => expect(screen.getByText('Nova entrada')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('combobox', { name: 'Produto' }));
    await userEvent.click(await screen.findByRole('option', { name: new RegExp(produtoCaixaria.nome) }));
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '5' } });
    fireEvent.change(screen.getByPlaceholderText('Ex.: Frigorífico Boi Forte'), { target: { value: 'Frigorífico Central' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pedido' }));

    expect(screen.getByRole('button', { name: /Confirmar entrada/ })).toBeDisabled();

    await waitFor(() => expect(screen.getByText('Açougue Dois Irmãos')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Açougue Dois Irmãos'));

    expect(screen.getByRole('button', { name: /Confirmar entrada/ })).not.toBeDisabled();
  });

  it('placeholder "Buscar cliente" presente (Princípio IX)', async () => {
    render(<EntradaItensClient podeRegistrar />);
    await waitFor(() => expect(screen.getByText('Nova entrada')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Pedido' }));
    expect(screen.getByPlaceholderText('Buscar cliente')).toBeInTheDocument();
  });
});
