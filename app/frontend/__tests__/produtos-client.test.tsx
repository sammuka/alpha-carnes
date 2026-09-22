import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProdutosClient } from '../src/app/(admin)/cadastros/produtos/produtos-client';
import type { Produto } from '../src/lib/produtos';

const PRODUTO: Produto = {
  id: 'prod-1',
  codigo: 'TZ',
  nome: 'Traseiro Bovino',
  nomeOperacional: null,
  categoria: null,
  tipoOperacional: 'peca_inteira_pesavel',
  unidadePedido: 'unidade',
  unidadePreco: 'kg',
  exigePeso: true,
  passaBalanca: true,
  passaDesossa: true,
  origemTransformacao: false,
  saidaTransformacao: false,
  podeEstoque: true,
  ativoVenda: true,
  ativoCompra: false,
  status: 'ativo',
  observacoesOperacionais: null,
  atributosJson: {},
  createdAt: '2026-09-13T00:00:00.000Z',
  updatedAt: '2026-09-13T00:00:00.000Z',
  deletedAt: null,
};

function respostaLista(data: Produto[] = []) {
  return {
    ok: true,
    json: async () => ({ data, total: data.length, page: 1, pageSize: 100 }),
  };
}

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue(respostaLista()) as unknown as typeof fetch;
});

it('drawer de produto tem as abas Gerais, Comercial, Operacional e Fiscal', async () => {
  render(<ProdutosClient permissoes={['PRODUTOS_LER', 'PRODUTOS_GERENCIAR']} />);
  fireEvent.click(await screen.findByRole('button', { name: /Novo Produto/i }));
  for (const aba of ['Gerais', 'Comercial', 'Operacional', 'Fiscal']) {
    expect(screen.getByRole('tab', { name: aba })).toBeInTheDocument();
  }
  expect(screen.queryByRole('tab', { name: 'Estoque' })).not.toBeInTheDocument();
});

it('Permite estoque fica na aba Operacional', async () => {
  render(<ProdutosClient permissoes={['PRODUTOS_LER', 'PRODUTOS_GERENCIAR']} />);
  fireEvent.click(await screen.findByRole('button', { name: /Novo Produto/i }));
  fireEvent.click(screen.getByRole('tab', { name: 'Operacional' }));
  expect(screen.getByLabelText('Permite estoque')).toBeInTheDocument();
});

it('aba fiscal envia ncm dentro de atributosJson', async () => {
  const user = userEvent.setup();
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [], total: 0, page: 1, pageSize: 20 }),
  });
  global.fetch = fetchMock as unknown as typeof fetch;

  render(<ProdutosClient permissoes={['PRODUTOS_LER', 'PRODUTOS_GERENCIAR']} />);
  await user.click(await screen.findByRole('button', { name: /Novo Produto/i }));
  await user.type(screen.getByLabelText('Código interno'), 'PRD-1');
  await user.type(screen.getByLabelText('Nome do produto'), 'Coxão mole');
  await user.click(screen.getByRole('tab', { name: 'Fiscal' }));
  const ncm = await screen.findByLabelText('NCM');
  await user.clear(ncm);
  await user.type(ncm, '0201.30.00');
  await user.click(screen.getByRole('button', { name: /Salvar/i }));

  await waitFor(() => {
    const chamada = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
    expect(chamada).toBeDefined();
    const corpo = JSON.parse(String((chamada?.[1] as RequestInit).body)) as {
      atributosJson: { fiscal: { ncm: string } };
    };
    expect(corpo.atributosJson.fiscal.ncm).toBe('0201.30.00');
  });
});

it('clique na linha abre o drawer em edicao com os dados do produto', async () => {
  global.fetch = jest.fn().mockResolvedValue(respostaLista([PRODUTO])) as unknown as typeof fetch;
  render(<ProdutosClient permissoes={['PRODUTOS_LER', 'PRODUTOS_GERENCIAR']} />);
  fireEvent.click(await screen.findByText('Traseiro Bovino'));
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  expect(screen.getByText('Produto — TZ')).toBeInTheDocument();
  expect(screen.getByLabelText('Nome do produto')).toHaveValue('Traseiro Bovino');
  expect(screen.getByRole('button', { name: /Salvar Produto/i })).toBeInTheDocument();
});

it('acao de inativar nao abre o drawer', async () => {
  global.fetch = jest.fn().mockResolvedValue(respostaLista([PRODUTO])) as unknown as typeof fetch;
  render(<ProdutosClient permissoes={['PRODUTOS_LER', 'PRODUTOS_GERENCIAR']} />);
  await screen.findByText('Traseiro Bovino');
  fireEvent.click(screen.getByTitle('Inativar'));
  await waitFor(() => {
    const patch = (global.fetch as jest.Mock).mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === 'PATCH',
    );
    expect(patch).toBeDefined();
    expect(String(patch![0])).toBe('/api/cadastros/produtos/prod-1');
    expect(JSON.parse(String((patch![1] as RequestInit).body))).toEqual({ status: 'inativo' });
  });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
