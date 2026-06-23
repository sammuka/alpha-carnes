import { render, screen } from '@testing-library/react';
import { LoginFormClient } from '../src/app/(auth)/login/login-form-client';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe('LoginFormClient', () => {
  it('renderiza o formulário de login com campos de email e senha', () => {
    render(<LoginFormClient />);
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });
});
