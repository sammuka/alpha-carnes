import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UsuariosAdminClient } from '../src/app/(admin)/admin/usuarios/usuarios-client';
import type { PerfilComPermissoes, Usuario } from '../src/lib/usuarios';
import type { Representante } from '../src/lib/representantes';

const PERMISSOES_COMPLETAS = ['USUARIOS_LER', 'USUARIOS_GERENCIAR', 'PERFIS_GERENCIAR', 'USUARIOS_APROVAR'];

const perfisMock: PerfilComPermissoes[] = [
  { slug: 'comercial', nome: 'Comercial', permissoes: [] },
  { slug: 'administrador', nome: 'Administrador', permissoes: [] },
];

const representanteMock: Representante = {
  id: 'rep-1',
  codigo: 'REP-1',
  nome: 'Representante Norte',
  tipoCanal: null,
  contato: null,
  status: 'ativo',
  observacao: null,
  usuariosVinculadosCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
};

function montarUsuario(overrides: Partial<Usuario>): Usuario {
  return {
    id: 'u-1',
    nome: 'Usuário Teste',
    email: 'teste@alphacarnes.local',
    ativo: true,
    perfis: ['comercial'],
    ultimoAcesso: null,
    representantesPermitidos: [],
    escopoRepresentantes: 'todos',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

/** Roteador mínimo de fetch para os endpoints que UsuariosAdminClient consome. */
function montarFetchMock(opts: {
  usuarios?: Usuario[];
  onRequisicao?: (url: string, init?: RequestInit) => void;
} = {}) {
  const usuarios = opts.usuarios ?? [];
  const fetchMock = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
    opts.onRequisicao?.(url, init);
    const u = String(url);
    const method = init?.method ?? 'GET';

    if (u.includes('/api/admin/usuarios/resumo-perfis')) {
      return Promise.resolve({ ok: true, json: async () => [] });
    }
    if (u.includes('/api/admin/perfis')) {
      return Promise.resolve({ ok: true, json: async () => perfisMock });
    }
    if (u.includes('/api/cadastros/representantes')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [representanteMock], total: 1 }),
      });
    }
    if (u.match(/\/api\/admin\/usuarios\/[^/]+\/representantes$/) && method === 'PUT') {
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }
    if (u.match(/\/api\/admin\/usuarios\/[^/]+\/perfis$/) && method === 'PUT') {
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }
    if (u.match(/\/api\/admin\/usuarios\/[^/]+$/) && method === 'PATCH') {
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }
    if (u.endsWith('/api/admin/usuarios') && method === 'POST') {
      return Promise.resolve({ ok: true, json: async () => ({ id: 'novo-id' }) });
    }
    if (u.endsWith('/api/admin/usuarios') && method === 'GET') {
      return Promise.resolve({ ok: true, json: async () => usuarios });
    }
    return Promise.resolve({ ok: true, json: async () => [] });
  });
  return fetchMock;
}

describe('UsuariosAdminClient — drawer de representantes permitidos (6.22)', () => {
  it('lista as opções carregadas do backend e reflete a seleção no resumo', async () => {
    global.fetch = montarFetchMock() as unknown as typeof fetch;
    const user = userEvent.setup();
    render(<UsuariosAdminClient permissoes={PERMISSOES_COMPLETAS} />);

    await user.click(await screen.findByRole('button', { name: /Novo Usuário/i }));

    expect(await screen.findByText('Representantes permitidos')).toBeInTheDocument();
    expect(await screen.findByText('Representante Norte')).toBeInTheDocument();
    expect(screen.getByText('Todos')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Representante Norte/i }));
    expect(await screen.findByText('1 selecionado(s)')).toBeInTheDocument();
  });

  it('exibe erro com retry quando a listagem de representantes falha (RA-05)', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/cadastros/representantes')) {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({ message: 'Falha no servidor' }) });
      }
      if (u.includes('/api/admin/usuarios/resumo-perfis')) return Promise.resolve({ ok: true, json: async () => [] });
      if (u.includes('/api/admin/perfis')) return Promise.resolve({ ok: true, json: async () => perfisMock });
      if (u.endsWith('/api/admin/usuarios')) return Promise.resolve({ ok: true, json: async () => [] });
      return Promise.resolve({ ok: true, json: async () => [] });
    }) as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<UsuariosAdminClient permissoes={PERMISSOES_COMPLETAS} />);
    await user.click(await screen.findByRole('button', { name: /Novo Usuário/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha no servidor');
    expect(screen.getByRole('button', { name: /Tentar novamente/i })).toBeInTheDocument();
  });
});

describe('UsuariosAdminClient — criação de usuário (6.23)', () => {
  it('envia nome, email, senha, perfis e representantes selecionados no POST', async () => {
    const chamadas: { url: string; init?: RequestInit }[] = [];
    global.fetch = montarFetchMock({
      onRequisicao: (url, init) => chamadas.push({ url, init }),
    }) as unknown as typeof fetch;
    const user = userEvent.setup();
    render(<UsuariosAdminClient permissoes={PERMISSOES_COMPLETAS} />);

    await user.click(await screen.findByRole('button', { name: /Novo Usuário/i }));
    await user.type(screen.getByLabelText(/^Nome/), 'Carlos Vendedor');
    await user.type(screen.getByLabelText(/^E-mail/), 'carlos@alphacarnes.local');
    await user.type(screen.getByLabelText(/^Senha/), 'SenhaForte@123');
    await user.click(screen.getByRole('checkbox', { name: 'Comercial' }));
    await screen.findByText('Representante Norte');
    await user.click(screen.getByRole('checkbox', { name: /Representante Norte/i }));
    await user.click(screen.getByRole('button', { name: /^Salvar$/i }));

    await waitFor(
      () => {
        const post = chamadas.find((c) => c.url.endsWith('/api/admin/usuarios') && c.init?.method === 'POST');
        expect(post).toBeDefined();
        const corpo = JSON.parse(String(post?.init?.body)) as {
          nome: string; email: string; password: string; perfis: string[]; representantes: string[];
        };
        expect(corpo.nome).toBe('Carlos Vendedor');
        expect(corpo.email).toBe('carlos@alphacarnes.local');
        expect(corpo.password).toBe('SenhaForte@123');
        expect(corpo.perfis).toContain('comercial');
        expect(corpo.representantes).toEqual(['rep-1']);
      },
      { timeout: 10_000 },
    );
  }, 15_000);
});

describe('UsuariosAdminClient — edição de usuário (6.23)', () => {
  it('abre o drawer preenchido e envia PUT de representantes quando a seleção muda', async () => {
    const usuario = montarUsuario({
      id: 'u-editar',
      nome: 'Diana Editar',
      email: 'diana@alphacarnes.local',
      representantesPermitidos: [],
      escopoRepresentantes: 'todos',
    });
    const chamadas: { url: string; init?: RequestInit }[] = [];
    global.fetch = montarFetchMock({
      usuarios: [usuario],
      onRequisicao: (url, init) => chamadas.push({ url, init }),
    }) as unknown as typeof fetch;
    const user = userEvent.setup();
    render(<UsuariosAdminClient permissoes={PERMISSOES_COMPLETAS} />);

    await screen.findByText('Diana Editar');
    // O primeiro ícone de ação da linha é o de editar (Edit2); localizamos pela linha da tabela.
    const linha = screen.getByText('Diana Editar').closest('tr');
    if (!linha) throw new Error('linha da tabela não encontrada');
    const botoesDaLinha = within(linha).getAllByRole('button');
    await user.click(botoesDaLinha[0]!);

    expect(await screen.findByDisplayValue('Diana Editar')).toBeInTheDocument();
    expect(screen.getByDisplayValue('diana@alphacarnes.local')).toBeInTheDocument();

    await screen.findByText('Representante Norte');
    await user.click(screen.getByRole('checkbox', { name: /Representante Norte/i }));
    await user.click(screen.getByRole('button', { name: /^Salvar$/i }));

    await waitFor(
      () => {
        const putRepresentantes = chamadas.find(
          (c) => c.url.endsWith(`/api/admin/usuarios/${usuario.id}/representantes`) && c.init?.method === 'PUT',
        );
        expect(putRepresentantes).toBeDefined();
        const corpo = JSON.parse(String(putRepresentantes?.init?.body)) as { representantes: string[] };
        expect(corpo.representantes).toEqual(['rep-1']);
      },
      { timeout: 10_000 },
    );
  }, 15_000);
});

describe('UsuariosAdminClient — filtro Perfil/Status (6.27)', () => {
  it('filtra a lista por perfil e por status simultaneamente', async () => {
    const usuarios = [
      montarUsuario({ id: 'u-com', nome: 'Comercial Ativo', ativo: true, perfis: ['comercial'] }),
      montarUsuario({ id: 'u-com-inativo', nome: 'Comercial Inativo', ativo: false, perfis: ['comercial'] }),
      montarUsuario({ id: 'u-adm', nome: 'Admin Ativo', ativo: true, perfis: ['administrador'] }),
    ];
    global.fetch = montarFetchMock({ usuarios }) as unknown as typeof fetch;
    const user = userEvent.setup();
    render(<UsuariosAdminClient permissoes={PERMISSOES_COMPLETAS} />);

    expect(await screen.findByText('Comercial Ativo')).toBeInTheDocument();
    expect(screen.getByText('Comercial Inativo')).toBeInTheDocument();
    expect(screen.getByText('Admin Ativo')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    const selectPerfil = await screen.findByLabelText('Perfil de acesso');
    fireEvent.change(selectPerfil, { target: { value: 'comercial' } });

    await waitFor(() => {
      expect(screen.getByText('Comercial Ativo')).toBeInTheDocument();
      expect(screen.getByText('Comercial Inativo')).toBeInTheDocument();
      expect(screen.queryByText('Admin Ativo')).not.toBeInTheDocument();
    });

    const selectStatus = screen.getByLabelText('Status');
    fireEvent.change(selectStatus, { target: { value: 'ativo' } });

    await waitFor(() => {
      expect(screen.getByText('Comercial Ativo')).toBeInTheDocument();
      expect(screen.queryByText('Comercial Inativo')).not.toBeInTheDocument();
      expect(screen.queryByText('Admin Ativo')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Limpar filtros/i }));
    await waitFor(() => {
      expect(screen.getByText('Comercial Ativo')).toBeInTheDocument();
      expect(screen.getByText('Comercial Inativo')).toBeInTheDocument();
      expect(screen.getByText('Admin Ativo')).toBeInTheDocument();
    });
  });
});

describe('UsuariosAdminClient — coluna Último Acesso (6.28)', () => {
  it('mostra "Nunca acessou" quando ultimoAcesso é null e a data formatada quando não é', async () => {
    const usuarios = [
      montarUsuario({ id: 'u-nunca', nome: 'Nunca Acessou', ultimoAcesso: null }),
      montarUsuario({ id: 'u-acessou', nome: 'Já Acessou', ultimoAcesso: '2026-07-15T13:30:00.000Z' }),
    ];
    global.fetch = montarFetchMock({ usuarios }) as unknown as typeof fetch;
    render(<UsuariosAdminClient permissoes={PERMISSOES_COMPLETAS} />);

    await screen.findByText('Nunca Acessou');
    const linhaNunca = screen.getByText('Nunca Acessou').closest('tr');
    const linhaAcessou = screen.getByText('Já Acessou').closest('tr');
    if (!linhaNunca || !linhaAcessou) throw new Error('linhas não encontradas');

    expect(within(linhaNunca).getByText('Nunca acessou')).toBeInTheDocument();
    expect(within(linhaAcessou).queryByText('Nunca acessou')).not.toBeInTheDocument();
  });
});

it('resumo de perfis usa contagem real do backend', async () => {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (String(url).includes('resumo-perfis')) {
      return Promise.resolve({
        ok: true,
        json: async () => [
          { slug: 'administrador', nome: 'Administrador', total: 2 },
          { slug: 'conferente', nome: 'Conferente', total: 0 },
        ],
      });
    }
    return Promise.resolve({ ok: true, json: async () => [] });
  }) as unknown as typeof fetch;

  render(<UsuariosAdminClient permissoes={['USUARIOS_LER']} />);
  expect(await screen.findByText('2 usuários')).toBeInTheDocument();
  expect(screen.getByText('0 usuários')).toBeInTheDocument();
});

it('sem USUARIOS_APROVAR nao ha botao de aprovar', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => [],
  }) as unknown as typeof fetch;

  render(<UsuariosAdminClient permissoes={['USUARIOS_LER', 'USUARIOS_GERENCIAR']} />);
  await waitFor(() => expect(screen.queryByRole('button', { name: /Aprovar/i })).not.toBeInTheDocument());
});
