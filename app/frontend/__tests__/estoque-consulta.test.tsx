import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    if (u.includes('/historico')) {
      return { ok: true, json: async () => [] } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  }) as unknown as typeof fetch;
}

describe('EstoqueConsultaClient', () => {
  it('renderiza as colunas da consulta na ordem e as 2 abas', async () => {
    mockFetchEstoque([itemDisponivel]);
    render(<EstoqueConsultaClient permissoes={['ESTOQUE_LER', 'ESTOQUE_GERENCIAR']} />);

    await waitFor(() => expect(screen.getByText('Frigorífico Boi Forte')).toBeInTheDocument());

    const cabecalhos = ['Produto', 'Tipo', 'Qtd', 'Peso (kg)', 'Origem/Frigorífico', 'NF/Lote', 'Entrada', 'Local', 'Status', 'Características', 'Pedido reservado'];
    for (const h of cabecalhos) {
      expect(screen.getByText(h)).toBeInTheDocument();
    }
    expect(screen.queryByRole('columnheader', { name: 'Código' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Consulta de Estoque' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Sobras & Congelamento' })).toBeInTheDocument();
  });

  it('badge "Estoque anterior" só aparece quando estoqueAnterior é true', async () => {
    mockFetchEstoque([itemDisponivel, itemAnterior]);
    render(<EstoqueConsultaClient permissoes={['ESTOQUE_LER', 'ESTOQUE_GERENCIAR']} />);

    await waitFor(() => expect(screen.getAllByText('TZ').length).toBeGreaterThan(0));
    expect(screen.getByText('Estoque anterior')).toBeInTheDocument();
    expect(screen.getAllByText('Estoque anterior')).toHaveLength(1);
  });

  it('ação Destinar só aparece em item Disponível', async () => {
    mockFetchEstoque([itemDisponivel, itemDestinado]);
    render(<EstoqueConsultaClient permissoes={['ESTOQUE_LER', 'ESTOQUE_GERENCIAR']} />);

    await waitFor(() => expect(screen.getByText('#pv1052 — Açougue Nova Era')).toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: 'Destinar' })).toHaveLength(1);
  });

  it('busca filtra por produto, origem e NF/lote, sem usar o código do item', async () => {
    mockFetchEstoque([itemDisponivel]);
    render(<EstoqueConsultaClient permissoes={['ESTOQUE_LER', 'ESTOQUE_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByText('NF 128934')).toBeInTheDocument());

    const campo = screen.getByPlaceholderText('Buscar por produto, origem ou NF/lote');
    fireEvent.change(campo, { target: { value: 'TZ-000347' } });
    expect(screen.getByText('Nenhum item encontrado com os filtros selecionados.')).toBeInTheDocument();

    fireEvent.change(campo, { target: { value: 'Boi Forte' } });
    expect(screen.getByText('Frigorífico Boi Forte')).toBeInTheDocument();
    expect(screen.getByText('NF 128934')).toBeInTheDocument();
  });

  it('clique na linha abre o historico do item', async () => {
    mockFetchEstoque([itemDisponivel]);
    render(<EstoqueConsultaClient permissoes={['ESTOQUE_LER', 'ESTOQUE_GERENCIAR']} />);
    fireEvent.click(await screen.findByText('Frigorífico Boi Forte'));
    expect(await screen.findByText('Histórico — TZ-000347')).toBeInTheDocument();
    expect(screen.getByText('Dados do item')).toBeInTheDocument();
  });

  it('Destinar nao abre o historico', async () => {
    mockFetchEstoque([itemDisponivel]);
    render(<EstoqueConsultaClient permissoes={['ESTOQUE_LER', 'ESTOQUE_GERENCIAR']} />);
    await screen.findByText('Frigorífico Boi Forte');
    fireEvent.click(screen.getByRole('button', { name: 'Destinar' }));
    expect(screen.getByText('Destinar item a pedido')).toBeInTheDocument();
    expect(screen.queryByText('Histórico — TZ-000347')).not.toBeInTheDocument();
  });
});
