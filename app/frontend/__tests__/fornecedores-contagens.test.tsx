import { render, screen } from '@testing-library/react';
import { FornecedoresClient } from '../src/app/(admin)/cadastros/fornecedores/fornecedores-client';

it('renderiza a tabela no padrão de Representantes com filtro de status', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [], total: 0, page: 1, pageSize: 20 }),
  }) as unknown as typeof fetch;

  render(<FornecedoresClient podeGerenciar />);
  expect(await screen.findByRole('heading', { name: 'Fornecedores / Frigoríficos' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Novo Fornecedor/i })).toBeInTheDocument();
  expect(screen.getByLabelText('Status: Todos')).toBeInTheDocument();
  expect(await screen.findByText('Nenhum fornecedor encontrado para os filtros aplicados.')).toBeInTheDocument();
});
