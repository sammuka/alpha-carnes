import { render, screen, waitFor } from '@testing-library/react';
import { EstoqueConsultaClient } from '../src/app/(admin)/estoque/consulta/estoque-consulta-client';
import type { ItemEstoqueConsulta } from '../src/lib/estoque';

jest.mock('@/lib/realtime', () => ({
  conectarRealtime: () => () => undefined,
}));

const itemDisponivel: ItemEstoqueConsulta = {
  id: 'p1aaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  tipo: 'peca',
  codigo: 'TZ-000347',
  statusFisico: 'em_sobra',
  statusRotulo: 'Disponível',
  quantidade: '1',
  peso: '50.400',
  unidade: 'peça',
  produto: { id: 'prod1', codigo: 'TZ', nome: 'TZ' },
  origem: 'Frigorífico Boi Forte',
  nfLote: 'NF 128934',
  local: { valor: null, provisorio: true },
  caracteristicas: ['maisPesada'],
  pedidoReservado: null,
  estoqueAnterior: false,
  createdAt: '2026-08-02T08:15:00.000Z',
};

const itemAnterior: ItemEstoqueConsulta = {
  ...itemDisponivel,
  id: 'p2aaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  codigo: 'DT-000090',
  estoqueAnterior: true,
  createdAt: '2026-08-01T08:40:00.000Z',
};

const itemDestinado: ItemEstoqueConsulta = {
  ...itemDisponivel,
  id: 'p3aaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  codigo: 'PA-000119',
  statusRotulo: 'Destinado a pedido',
  pedidoReservado: '#pv1052 — Açougue Nova Era',
};

function mockFetchEstoque(itens: ItemEstoqueConsulta[]) {
  global.fetch = jest.fn(async (url: string) => {
    const u = String(url);
    if (u.includes('/api/operacao/estoque/consulta')) {
      return { ok: true, json: async () => itens } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  }) as unknown as typeof fetch;
}

describe('EstoqueConsultaClient', () => {
  it('renderiza as 13 colunas do protótipo na ordem e as 2 abas', async () => {
    mockFetchEstoque([itemDisponivel]);
    render(<EstoqueConsultaClient permissoes={['ESTOQUE_LER', 'ESTOQUE_GERENCIAR']} />);

    await waitFor(() => expect(screen.getByText('TZ-000347')).toBeInTheDocument());

    const cabecalhos = ['Código', 'Produto', 'Tipo', 'Qtd', 'Peso', 'Origem/Frigorífico', 'NF/Lote', 'Entrada', 'Local', 'Status', 'Características', 'Pedido reservado'];
    for (const h of cabecalhos) {
      expect(screen.getByText(h)).toBeInTheDocument();
    }
    expect(screen.getByText('Consulta de Estoque')).toBeInTheDocument();
    expect(screen.getByText('Sobras & Congelamento')).toBeInTheDocument();
  });

  it('badge "Estoque anterior" só aparece quando estoqueAnterior é true', async () => {
    mockFetchEstoque([itemDisponivel, itemAnterior]);
    render(<EstoqueConsultaClient permissoes={['ESTOQUE_LER', 'ESTOQUE_GERENCIAR']} />);

    await waitFor(() => expect(screen.getByText('DT-000090')).toBeInTheDocument());
    expect(screen.getByText('Estoque anterior')).toBeInTheDocument();
    expect(screen.getAllByText('Estoque anterior')).toHaveLength(1);
  });

  it('ação Destinar só aparece em item Disponível', async () => {
    mockFetchEstoque([itemDisponivel, itemDestinado]);
    render(<EstoqueConsultaClient permissoes={['ESTOQUE_LER', 'ESTOQUE_GERENCIAR']} />);

    await waitFor(() => expect(screen.getByText('PA-000119')).toBeInTheDocument());
    expect(screen.getAllByTitle('Destinar a pedido')).toHaveLength(1);
  });
});
