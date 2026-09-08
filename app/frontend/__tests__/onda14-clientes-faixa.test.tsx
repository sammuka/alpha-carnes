import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClientesClient } from '../src/app/(admin)/comercial/clientes/clientes-client';

const cliente = {
  id: 'cliente-1',
  codigo: 'CLI-001',
  razaoSocial: 'Açougue Central Ltda.',
  nomeFantasia: 'Açougue Central',
  documentoFiscal: '12345678000190',
  status: 'ativo',
  representanteId: 'representante-1',
  representanteNome: 'Helena Prado',
  rotaId: 'rota-1',
  rotaNome: 'Rota Oeste',
  prioridade: 'alta',
  faixaPreco: 'C' as const,
  preferenciasJson: {
    faixaPesoMin: 10,
    faixaPesoMax: 25,
    perfilGordura: 'baixa',
    necessitaCorteAcerto: true,
  },
  dadosFiscaisJson: {},
  dadosContatoJson: {},
  observacoesOperacionais: null,
};

function respostaJson(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  }));
}

function instalarFetch(overrides?: {
  post?: (url: string, init?: RequestInit) => Promise<Response> | Response;
}) {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (overrides?.post && (init?.method === 'POST' || init?.method === 'PATCH')) {
      return Promise.resolve(overrides.post(url, init));
    }
    if (url.startsWith('/api/cadastros/clientes?')) {
      return respostaJson({ data: [cliente], total: 1, totalAtivos: 1, page: 1, pageSize: 20 });
    }
    if (url === '/api/cadastros/clientes/cliente-1') return respostaJson(cliente);
    if (url === '/api/cadastros/clientes' && init?.method === 'POST') {
      return respostaJson({ ...cliente, id: 'cliente-novo' }, 201);
    }
    if (url.startsWith('/api/cadastros/representantes')) {
      return respostaJson({ data: [], total: 0, page: 1, pageSize: 100 });
    }
    if (url.startsWith('/api/cadastros/rotas')) {
      return respostaJson({ data: [], total: 0, page: 1, pageSize: 100 });
    }
    return respostaJson({ message: `URL inesperada: ${url}` }, 500);
  }) as jest.Mock;
}

beforeEach(() => {
  instalarFetch();
});

it('aba Preferências renderiza Tabela de Preço com as 4 opções', async () => {
  const user = userEvent.setup();
  render(<ClientesClient podeGerenciar />);
  await user.click(await screen.findByRole('tab', { name: 'Preferências Operacionais' }));
  const campo = await screen.findByRole('combobox', { name: 'Tabela de Preço' });
  expect(campo).toBeInTheDocument();
  await user.click(campo);
  expect(await screen.findByRole('option', { name: 'A' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'B' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'C' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'D' })).toBeInTheDocument();
});

it("selecionar C inclui faixaPreco: 'C' no POST", async () => {
  const user = userEvent.setup();
  render(<ClientesClient podeGerenciar />);
  await user.click(await screen.findByRole('button', { name: 'Novo cliente' }));
  await user.type(screen.getByLabelText('Razão Social'), 'Cliente Faixa C');
  await user.type(screen.getByLabelText('CNPJ/CPF'), '12345678000190');
  await user.click(screen.getByRole('tab', { name: 'Preferências Operacionais' }));
  await user.click(screen.getByRole('combobox', { name: 'Tabela de Preço' }));
  await user.click(await screen.findByRole('option', { name: 'C' }));
  await user.click(screen.getByRole('button', { name: 'Salvar' }));
  await waitFor(() => {
    const chamada = (global.fetch as jest.Mock).mock.calls.find(
      ([url, init]: [string, RequestInit]) =>
        String(url) === '/api/cadastros/clientes' && init?.method === 'POST',
    );
    expect(chamada).toBeDefined();
    expect(JSON.parse(String((chamada?.[1] as RequestInit).body))).toMatchObject({
      faixaPreco: 'C',
    });
  });
});

it('erro 400 em faixaPreco acende a aba e o campo', async () => {
  instalarFetch({
    post: () =>
      new Response(
        JSON.stringify({
          message: {
            message: 'Validação falhou',
            errors: [{ path: ['faixaPreco'], message: 'Obrigatório' }],
          },
        }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      ),
  });
  const user = userEvent.setup();
  render(<ClientesClient podeGerenciar />);
  await user.click(await screen.findByRole('button', { name: 'Novo cliente' }));
  await user.type(screen.getByLabelText('Razão Social'), 'Cliente Sem Faixa');
  await user.type(screen.getByLabelText('CNPJ/CPF'), '12345678000190');
  await user.click(screen.getByRole('button', { name: 'Salvar' }));
  expect(await screen.findByText('Obrigatório')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /Preferências Operacionais/ })).toHaveAttribute(
    'data-state',
    'active',
  );
  expect(screen.getByLabelText('Aba com campo inválido')).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Tabela de Preço' })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
});

it('cliente carregado exibe a faixa persistida', async () => {
  const user = userEvent.setup();
  render(<ClientesClient podeGerenciar />);
  await user.click(await screen.findByRole('tab', { name: 'Preferências Operacionais' }));
  expect(await screen.findByRole('combobox', { name: 'Tabela de Preço' })).toHaveTextContent('C');
});

it('usuário sem CLIENTES_GERENCIAR vê o campo desabilitado', async () => {
  const user = userEvent.setup();
  render(<ClientesClient podeGerenciar={false} />);
  await user.click(await screen.findByRole('tab', { name: 'Preferências Operacionais' }));
  expect(await screen.findByRole('combobox', { name: 'Tabela de Preço' })).toBeDisabled();
});
