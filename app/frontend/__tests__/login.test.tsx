import { render, screen } from '@testing-library/react';
import LoginPage from '../src/app/(auth)/login/page';

// Mock do next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe('LoginPage', () => {
  it('renderiza o formulário de login com campos de email e senha', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });
});
