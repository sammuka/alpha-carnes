import { render, screen, waitFor } from '@testing-library/react';
import { UsuariosAdminClient } from '../src/app/(admin)/admin/usuarios/usuarios-client';

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
