import { render, screen } from '@testing-library/react';
import { TabelaPrecosClient } from '../src/app/(admin)/comercial/tabela-precos/tabela-precos-client';

jest.mock('@/lib/realtime', () => ({
  conectarRealtime: jest.fn(() => jest.fn()),
}));

const tabela = {
  id: 'tabela-1',
  data: '2026-07-28',
  status: 'rascunho',
  observacao: null,
  publicadaPor: null,
  publicadaEm: null,
  createdAt: '2026-07-28T08:00:00.000Z',
  updatedAt: '2026-07-28T08:00:00.000Z',
};

function resposta(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  }));
}

beforeEach(() => {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/api/precos/tabelas?pageSize=100') {
      return resposta({ data: [tabela], page: 1, pageSize: 100, total: 1 });
    }
    if (url === '/api/precos/tabelas/tabela-1') {
      return resposta({
        ...tabela,
        itens: [{
          produtoId: 'produto-1',
          codigo: 'TZ',
          nome: 'Traseiro Bovino',
          unidadePreco: 'kg',
          provisorio: false,
          precoA: null,
          precoB: '24.40',
          precoC: '23.90',
          precoD: '23.50',
        }],
        historico: [],
      });
    }
    return resposta({ message: `URL inesperada: ${url}` }, 500);
  }) as jest.Mock;
});

it('grade exibe colunas produto unidade e as quatro faixas A B C D', async () => {
  render(<TabelaPrecosClient podeGerenciar dataInicial="2026-07-28" />);
  expect(await screen.findByRole('columnheader', { name: 'Produto' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Unidade' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Preço A' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Preço B' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Preço C' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Preço D' })).toBeInTheDocument();
});

it('preco ausente renderiza campo vazio e nunca zero fabricado', async () => {
  render(<TabelaPrecosClient podeGerenciar dataInicial="2026-07-28" />);
  const preco = await screen.findByLabelText('Preço A de TZ');
  expect(preco).toHaveValue(null);
  expect(preco).toHaveAttribute('placeholder', '—');
  expect(screen.queryByDisplayValue('0,00')).not.toBeInTheDocument();
});
