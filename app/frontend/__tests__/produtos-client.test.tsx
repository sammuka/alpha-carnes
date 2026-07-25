import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProdutosClient } from '../src/app/(admin)/cadastros/produtos/produtos-client';

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [], total: 0, page: 1, pageSize: 20 }),
  }) as unknown as typeof fetch;
});

it('drawer de produto tem as 5 abas do prototipo', async () => {
  render(<ProdutosClient permissoes={['PRODUTOS_LER', 'PRODUTOS_GERENCIAR']} />);
  fireEvent.click(await screen.findByRole('button', { name: /Novo Produto/i }));
  for (const aba of ['Gerais', 'Comercial', 'Operacional', 'Estoque', 'Fiscal']) {
    expect(screen.getByRole('tab', { name: aba })).toBeInTheDocument();
  }
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
