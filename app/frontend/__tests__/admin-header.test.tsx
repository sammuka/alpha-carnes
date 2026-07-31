import { render, screen, within } from '@testing-library/react';
import { AdminHeader } from '../src/components/ui/admin-header';

jest.mock('next/navigation', () => ({
  usePathname: () => '/gestao/dashboard',
}));

const userBase = { nome: 'Fabrício', perfil: 'Administrador', inicial: 'F' };

describe('AdminHeader', () => {
  it('exibe o breadcrumb Grupo / Item da rota ativa', () => {
    render(<AdminHeader user={userBase} />);
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumb).getByText('Gestão')).toBeInTheDocument();
    expect(within(breadcrumb).getByText('Painel Geral da Operação')).toBeInTheDocument();
  });

  it('exibe usuario e perfil reais fora do breadcrumb', () => {
    render(<AdminHeader user={userBase} />);
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(screen.getByText('Fabrício')).toBeInTheDocument();
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(within(breadcrumb).queryByText('Administrador')).not.toBeInTheDocument();
  });

  it('renderiza o escopo real da sessão', () => {
    const { rerender } = render(<AdminHeader user={{
      ...userBase,
      escopoRepresentantes: { tipo: 'todos', representantes: [] },
    }} />);
    expect(screen.getByText('Todos')).toBeInTheDocument();

    rerender(<AdminHeader user={{
      ...userBase,
      escopoRepresentantes: { tipo: 'restrito', representantes: [{ id: 'r1', nome: 'Sabrina' }] },
    }} />);
    expect(screen.getByText('Sabrina')).toBeInTheDocument();

    rerender(<AdminHeader user={{
      ...userBase,
      escopoRepresentantes: {
        tipo: 'restrito',
        representantes: [
          { id: 'r1', nome: 'Ana' },
          { id: 'r2', nome: 'Beto' },
        ],
      },
    }} />);
    expect(screen.getByText(/Ana, Beto/)).toBeInTheDocument();
  });
});
