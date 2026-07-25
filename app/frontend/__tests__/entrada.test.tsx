import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import EntradaPage from '../src/app/(admin)/page';
import { getMe } from '../src/lib/auth';

jest.mock('../src/lib/auth', () => ({ getMe: jest.fn() }));

jest.mock('next/navigation', () => ({
  redirect: (rota: string) => {
    throw new Error(`REDIRECT:${rota}`);
  },
}));

const SNAPSHOT = join(
  __dirname, '..', '..', 'backend', 'src', 'common', 'rbac', 'perfil-permissoes.snapshot.json',
);
const PERMISSOES_POR_PERFIL = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as Record<string, string[]>;

function permissoesDe(perfil: string): string[] {
  const permissoes = PERMISSOES_POR_PERFIL[perfil];
  if (!permissoes) throw new Error(`perfil ausente no snapshot RBAC do backend: ${perfil}`);
  return permissoes;
}

const mockGetMe = getMe as jest.MockedFunction<typeof getMe>;

describe('rota de entrada /', () => {
  beforeEach(() => {
    mockGetMe.mockReset();
  });

  it('redireciona para a rota de entrada do perfil', async () => {
    mockGetMe.mockResolvedValue({
      sub: 'u1', nome: 'Admin', perfis: ['administrador'], permissoes: permissoesDe('administrador'),
    });
    await expect(EntradaPage()).rejects.toThrow('REDIRECT:/gestao/dashboard');
  });

  it('redireciona para a rota do grupo de trabalho quando o dashboard nao esta no menu', async () => {
    mockGetMe.mockResolvedValue({
      sub: 'u2', nome: 'Ludmila', perfis: ['expedicao'], permissoes: permissoesDe('expedicao'),
    });
    await expect(EntradaPage()).rejects.toThrow('REDIRECT:/carga/planejamento');
  });

  // `faturamento` vê GESTÃO só com Relatórios & SIF (decisão 30); o grupo de trabalho é FATURAMENTO
  it('ignora grupo de consulta com item unico ao escolher a entrada', async () => {
    mockGetMe.mockResolvedValue({
      sub: 'u4', nome: 'Carla', perfis: ['faturamento'], permissoes: permissoesDe('faturamento'),
    });
    await expect(EntradaPage()).rejects.toThrow('REDIRECT:/faturamento/pre-faturamento');
  });

  it('sem modulo liberado exibe aviso explicito sem redirecionar', async () => {
    mockGetMe.mockResolvedValue({
      sub: 'u3', nome: 'Conferente', perfis: ['conferente'], permissoes: permissoesDe('conferente'),
    });
    render(await EntradaPage());
    expect(screen.getByRole('heading', { name: 'Nenhum módulo liberado' })).toBeInTheDocument();
    expect(
      screen.getByText('Seu perfil ainda não tem módulos liberados. Solicite acesso ao administrador.'),
    ).toBeInTheDocument();
  });

  it('sem sessao valida volta para o login', async () => {
    mockGetMe.mockResolvedValue(null);
    await expect(EntradaPage()).rejects.toThrow('REDIRECT:/login');
  });
});
