import { render, screen, within } from '@testing-library/react';
import { AdminHeader } from '../src/components/ui/admin-header';

jest.mock('next/navigation', () => ({
  usePathname: () => '/gestao/dashboard',
}));

/**
 * O perfil da fixture é `Administrador` de propósito: com `Gestão` o texto do
 * breadcrumb (`formatMenuGroupTitle('GESTÃO')`) e o valor da meta "Perfil"
 * ficariam idênticos e as consultas por texto casariam dois nós.
 */
const user = { nome: 'Fabrício', perfil: 'Administrador', inicial: 'F' };

describe('AdminHeader', () => {
  it('exibe o breadcrumb Grupo / Item da rota ativa', () => {
    render(<AdminHeader user={user} />);
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumb).getByText('Gestão')).toBeInTheDocument();
    expect(within(breadcrumb).getByText('Painel Geral da Operação')).toBeInTheDocument();
  });

  it('exibe usuario e perfil reais fora do breadcrumb', () => {
    render(<AdminHeader user={user} />);
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(screen.getByText('Fabrício')).toBeInTheDocument();
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(within(breadcrumb).queryByText('Administrador')).not.toBeInTheDocument();
  });

  it('nao renderiza chip de escopo', () => {
    render(<AdminHeader user={user} />);
    expect(screen.queryByText(/Escopo/)).not.toBeInTheDocument();
  });
});
