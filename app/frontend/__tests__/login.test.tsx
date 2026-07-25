import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginFormClient } from '../src/app/(auth)/login/login-form-client';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

describe('LoginFormClient', () => {
  beforeEach(() => {
    push.mockReset();
    global.fetch = jest.fn();
  });

  it('usa a microcopy e o botao Acessar Sistema do prototipo', () => {
    render(<LoginFormClient />);
    expect(screen.getByText('Bem-vindo de volta')).toBeInTheDocument();
    expect(screen.getByText('Insira suas credenciais para acessar a operação.')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('placeholder', 'nome@alphacarnes.com.br');
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Acessar Sistema' })).toBeInTheDocument();
  });

  it('botao Acessar Sistema usa a variante de acao do DS', () => {
    render(<LoginFormClient />);
    const botao = screen.getByRole('button', { name: 'Acessar Sistema' });
    expect(botao.className).toContain('bg-action-blue');
    expect(botao.className).toContain('hover:bg-action-blue-strong');
    expect(botao.className).not.toContain('bg-primary');
  });

  it('nao pre-preenche credenciais', () => {
    render(<LoginFormClient />);
    expect(screen.getByLabelText('E-mail')).toHaveValue('');
    expect(screen.getByLabelText('Senha')).toHaveValue('');
  });

  it('nao oferece recurso inexistente no backend', () => {
    render(<LoginFormClient />);
    expect(screen.queryByText(/Esqueci a senha/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Lembrar/i)).not.toBeInTheDocument();
  });

  it('envia credenciais para /api/auth/login e navega para a rota de entrada', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
    render(<LoginFormClient />);

    await userEvent.type(screen.getByLabelText('E-mail'), 'admin@alphacarnes.local');
    await userEvent.type(screen.getByLabelText('Senha'), 'segredo-123');
    await userEvent.click(screen.getByRole('button', { name: 'Acessar Sistema' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@alphacarnes.local', password: 'segredo-123' }),
    }));
    // decisão 26: o destino é resolvido no servidor, em `/`; o cliente não escolhe rota.
    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
  });

  it('exibe erro explicito quando o backend recusa', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Credenciais inválidas' }),
    });
    render(<LoginFormClient />);

    await userEvent.type(screen.getByLabelText('E-mail'), 'admin@alphacarnes.local');
    await userEvent.type(screen.getByLabelText('Senha'), 'errada');
    await userEvent.click(screen.getByRole('button', { name: 'Acessar Sistema' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciais inválidas');
    expect(push).not.toHaveBeenCalled();
  });
});
