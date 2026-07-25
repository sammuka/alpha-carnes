import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { PerfisClient } from '../src/app/(admin)/admin/perfis/perfis-client';

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const PERFIS = [
  {
    id: '1',
    slug: 'administrador',
    nome: 'Administrador',
    permissoes: ['USUARIOS_LER'],
    menusVisiveis: ['/admin/usuarios'],
  },
  {
    id: '2',
    slug: 'comercial',
    nome: 'Comercial',
    permissoes: [],
    menusVisiveis: [],
  },
];

const CATALOGO = {
  grupos: [
    {
      modulo: 'Admin',
      permissoes: [
        { codigo: 'USUARIOS_LER', descricao: 'Ler usuários' },
        { codigo: 'PERFIS_GERENCIAR', descricao: 'Gerenciar perfis' },
      ],
    },
  ],
  menus: ['/admin/usuarios', '/admin/perfis'],
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (String(url).includes('/catalogo')) {
      return Promise.resolve({ ok: true, json: async () => CATALOGO });
    }
    if (String(url).includes('/menus') && init?.method === 'PUT') {
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }
    if (String(url).includes('/permissoes') && init?.method === 'PUT') {
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }
    return Promise.resolve({ ok: true, json: async () => PERFIS });
  }) as unknown as typeof fetch;
});

it('matriz renderiza uma linha por perfil e colunas por permissao', async () => {
  render(<PerfisClient />);
  expect(await screen.findByText('Administrador')).toBeInTheDocument();
  expect(screen.getByText('Comercial')).toBeInTheDocument();
  expect(screen.getByText('Admin')).toHaveAttribute('colSpan', '2');
  expect(screen.getByText('USUARIOS_LER')).toBeInTheDocument();
  expect(screen.getByText('PERFIS_GERENCIAR')).toBeInTheDocument();
});

it('clicar chip de menu dispara PUT menus', async () => {
  const fetchMock = global.fetch as jest.Mock;
  render(<PerfisClient />);
  await screen.findByText('Administrador');

  const chip = screen.getByRole('button', { pressed: false });
  fireEvent.click(chip);

  await waitFor(() => {
    const put = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes('/menus') && (init as RequestInit)?.method === 'PUT',
    );
    expect(put).toBeDefined();
    const corpo = JSON.parse(String((put?.[1] as RequestInit).body)) as { menus: string[] };
    expect(corpo.menus).toContain('/admin/perfis');
  });
});

it('contador mostra N menus do perfil selecionado', async () => {
  render(<PerfisClient />);
  await screen.findByText('Administrador');
  expect(screen.getByText('1 menu')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Comercial'));
  expect(await screen.findByText('0 menus')).toBeInTheDocument();
});

it('nota sobre menu x permissao esta presente', async () => {
  render(<PerfisClient />);
  await screen.findByText('Administrador');
  expect(
    screen.getByText(/Alterar menus visíveis vale na próxima navegação do usuário/i),
  ).toBeInTheDocument();
});

it('erro do backend vira toast sem alterar matriz', async () => {
  const fetchMock = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (String(url).includes('/catalogo')) {
      return Promise.resolve({ ok: true, json: async () => CATALOGO });
    }
    if (init?.method === 'PUT') {
      return Promise.resolve({ ok: false, json: async () => ({ message: 'Falha RBAC' }) });
    }
    return Promise.resolve({ ok: true, json: async () => PERFIS });
  });
  global.fetch = fetchMock as unknown as typeof fetch;

  render(<PerfisClient />);
  await screen.findByText('Administrador');
  fireEvent.click(screen.getByRole('button', { pressed: false }));

  await waitFor(() => {
    expect(toast.error).toHaveBeenCalled();
  });
  expect(screen.getByText('Administrador')).toBeInTheDocument();
});
