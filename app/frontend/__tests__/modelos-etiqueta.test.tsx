import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ModelosEtiquetaClient } from '../src/app/(admin)/cadastros/modelos-etiqueta/modelos-etiqueta-client';
import { CAMPOS_ETIQUETA } from '../src/lib/modelos-etiqueta';

const CAMPOS_TODOS = Object.fromEntries(CAMPOS_ETIQUETA.map((c) => [c.chave, true])) as Record<
  (typeof CAMPOS_ETIQUETA)[number]['chave'],
  boolean
>;

const MODELO = {
  id: 'm1',
  slug: 'padrao',
  nome: 'Modelo padrão',
  campos: CAMPOS_TODOS,
  status: 'ativo' as const,
};

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [MODELO], total: 1, page: 1, pageSize: 50 }),
  }) as unknown as typeof fetch;
});

it('exibe 12 checkboxes com rotulos de CAMPOS_ETIQUETA', async () => {
  render(<ModelosEtiquetaClient podeGerenciar />);
  await screen.findByText('Modelo padrão');
  await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(12));
  for (const campo of CAMPOS_ETIQUETA) {
    expect(screen.getByLabelText(campo.rotulo)).toBeInTheDocument();
  }
});

it('marcar campo atualiza o preview ao vivo', async () => {
  const campos = { ...CAMPOS_TODOS, codigo: false };
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [{ ...MODELO, campos }], total: 1, page: 1, pageSize: 50 }),
  }) as unknown as typeof fetch;

  render(<ModelosEtiquetaClient podeGerenciar />);
  await screen.findByText('Modelo padrão');
  await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(12));
  expect(screen.queryByText('Código', { selector: 'li' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByLabelText('Código'));
  expect(await screen.findByText('Código', { selector: 'li' })).toBeInTheDocument();
});

it('badge P9 esta presente e sem gerenciar nao ha Salvar Modelo', async () => {
  render(<ModelosEtiquetaClient podeGerenciar={false} />);
  await screen.findByText('Modelo padrão');
  expect(screen.getByTitle(/pendência P9/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Salvar Modelo/i })).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(12));
  for (const cb of screen.getAllByRole('checkbox')) {
    expect(cb).toBeDisabled();
  }
});

it('PATCH envia objeto campos com as 12 chaves', async () => {
  const fetchMock = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      return Promise.resolve({ ok: true, json: async () => MODELO });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ data: [MODELO], total: 1, page: 1, pageSize: 50 }),
    });
  });
  global.fetch = fetchMock as unknown as typeof fetch;

  render(<ModelosEtiquetaClient podeGerenciar />);
  await screen.findByText('Modelo padrão');
  await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(12));
  fireEvent.click(screen.getByRole('button', { name: /Salvar Modelo/i }));

  await waitFor(() => {
    const patch = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH');
    expect(patch).toBeDefined();
    const corpo = JSON.parse(String((patch?.[1] as RequestInit).body)) as {
      campos: Record<string, boolean>;
    };
    expect(Object.keys(corpo.campos).sort()).toEqual(CAMPOS_ETIQUETA.map((c) => c.chave).sort());
  });
});
