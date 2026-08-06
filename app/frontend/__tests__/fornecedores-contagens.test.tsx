import { render, screen } from '@testing-library/react';
import { FornecedoresClient } from '../src/app/(admin)/cadastros/fornecedores/fornecedores-client';

it('chips mostram a contagem devolvida pelo backend', async () => {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (String(url).includes('/contagens')) {
      return Promise.resolve({ ok: true, json: async () => ({ total: 3, ativos: 2, inativos: 1 }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({ data: [], total: 0, page: 1, pageSize: 20 }) });
  }) as unknown as typeof fetch;

  render(<FornecedoresClient podeGerenciar />);
  const todos = await screen.findByText('Todos (3)');
  const ativos = screen.getByText('Ativos (2)');
  const inativos = screen.getByText('Inativos (1)');

  // R6 — FilterChip: "Todos" ativo por padrão (bg-primary-soft/text-primary-fg), os demais inativos (bg-card/text-foreground).
  expect(todos.className).toContain('bg-primary-soft');
  expect(todos.className).toContain('text-primary-fg');
  for (const chip of [ativos, inativos]) {
    expect(chip.className).toContain('text-foreground');
    expect(chip.className).not.toContain('bg-primary-soft');
  }
});

it('falha nas contagens mostra erro e nao inventa numero', async () => {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (String(url).includes('/contagens')) {
      return Promise.resolve({ ok: false, status: 500, json: async () => ({ message: 'Falha interna' }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({ data: [], total: 0, page: 1, pageSize: 20 }) });
  }) as unknown as typeof fetch;

  render(<FornecedoresClient podeGerenciar />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Falha interna');
  expect(screen.queryByText(/^Todos \(/)).not.toBeInTheDocument();
});
