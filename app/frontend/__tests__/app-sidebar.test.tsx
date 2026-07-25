import { render, screen } from '@testing-library/react';
import { AppSidebar } from '../src/components/ui/app-sidebar';

jest.mock('next/navigation', () => ({
  usePathname: () => '/gestao/dashboard',
}));

const sections = [
  {
    title: 'GESTÃO',
    items: [{ href: '/gestao/dashboard', label: 'Painel Geral da Operação', iconKey: 'LayoutDashboard' }],
  },
];

describe('AppSidebar', () => {
  it('aplica o gradiente da sidebar pelos tokens do DS', () => {
    render(<AppSidebar user={{ nome: 'Admin', perfil: 'Administrador', inicial: 'A' }} sections={sections} />);
    const aside = screen.getByRole('complementary', { name: 'Navegação principal' });
    expect(aside.className).toContain('from-sidebar-gradient-start');
    expect(aside.className).toContain('to-sidebar-gradient-end');
  });

  it('renderiza identidade real do usuario', () => {
    render(<AppSidebar user={{ nome: 'Fabrício', perfil: 'Gestão', inicial: 'F' }} sections={sections} />);
    expect(screen.getByText('Fabrício')).toBeInTheDocument();
    expect(screen.getByText('Gestão')).toBeInTheDocument();
  });

  it('nao inventa escopo quando o contrato nao traz representante', () => {
    render(<AppSidebar user={{ nome: 'Fabrício', perfil: 'Gestão', inicial: 'F' }} sections={sections} />);
    expect(screen.queryByText(/Todos/)).not.toBeInTheDocument();
    expect(screen.queryByText(/perfis$/)).not.toBeInTheDocument();
  });

  it('nao renderiza simulador de perfil', () => {
    render(<AppSidebar user={{ nome: 'Admin', perfil: 'Administrador', inicial: 'A' }} sections={sections} />);
    expect(screen.queryByText(/SIMULAR PERFIL/i)).not.toBeInTheDocument();
  });

  it('exibe estado vazio explicito quando nenhum grupo esta liberado', () => {
    render(<AppSidebar user={{ nome: 'Conferente', perfil: 'Conferência', inicial: 'C' }} sections={[]} />);
    expect(
      screen.getByText('Nenhum módulo liberado para o seu perfil. Solicite acesso ao administrador.'),
    ).toBeInTheDocument();
  });
});
