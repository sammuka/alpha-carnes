import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CadastroForm } from '../src/components/cadastro-form';
import { clientesConfig } from '../src/lib/cadastros-config';

const pushMock = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe('CadastroForm — clientes (smoke + fluxo crítico)', () => {
  beforeEach(() => {
    pushMock.mockClear();
    global.fetch = jest.fn();
  });

  it('renderiza os campos do cadastro de clientes (smoke)', () => {
    render(<CadastroForm config={clientesConfig} />);
    expect(screen.getByLabelText('Razão Social')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome Fantasia/Marca')).toBeInTheDocument();
    expect(screen.getByLabelText('CNPJ/CPF')).toBeInTheDocument();
    expect(screen.queryByLabelText('Código')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar' })).toBeInTheDocument();
  });

  it('exibe erro de validação quando o CNPJ é inválido e não chama a API', async () => {
    const user = userEvent.setup();
    render(<CadastroForm config={clientesConfig} />);

    await user.type(screen.getByLabelText('Razão Social'), 'Cliente Teste');
    await user.type(screen.getByLabelText('CNPJ/CPF'), '123'); // inválido
    await user.click(screen.getByRole('button', { name: 'Criar' }));

    expect(await screen.findByText(/Informe um CNPJ.*CPF/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fluxo crítico: cria cliente com dados válidos e redireciona para a listagem', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: '1' }),
    });
    const user = userEvent.setup();
    render(<CadastroForm config={clientesConfig} />);

    await user.type(screen.getByLabelText('Razão Social'), 'Cliente Teste');
    await user.type(screen.getByLabelText('CNPJ/CPF'), '11222333000181'); // CNPJ válido (14 dígitos)
    await user.click(screen.getByRole('button', { name: 'Criar' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/cadastros/clientes',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/cadastros/clientes'));
  });

  it('exibe mensagem de erro vinda do backend (ex.: documento duplicado)', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Já existe cliente com este documento fiscal' }),
    });
    const user = userEvent.setup();
    render(<CadastroForm config={clientesConfig} />);

    await user.type(screen.getByLabelText('Razão Social'), 'Cliente Teste');
    await user.type(screen.getByLabelText('CNPJ/CPF'), '11222333000181');
    await user.click(screen.getByRole('button', { name: 'Criar' }));

    expect(await screen.findByText('Já existe cliente com este documento fiscal')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
