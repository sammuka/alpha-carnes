import { render, screen, waitFor } from '@testing-library/react';
import { clientesConfig } from '@/lib/cadastros-config';
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
  preferenciasJson: {
    faixaPesoMin: 10,
    faixaPesoMax: 25,
    perfilGordura: 'baixa',
    necessitaCorteAcerto: true,
  },
  dadosFiscaisJson: {
    logradouro: 'Rua Central',
    numero: '10',
    cidade: 'São Paulo',
    uf: 'SP',
  },
  dadosContatoJson: {
    nome: 'Ana',
    cargo: 'Compradora',
    telefone: '11999999999',
    whatsapp: '11999999999',
    email: 'ana@example.com',
    tipo: 'compra',
    principal: true,
  },
  observacoesOperacionais: null,
};

function respostaJson(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  }));
}

function instalarFetch() {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('/api/cadastros/clientes?')) {
      return respostaJson({ data: [cliente], total: 1, totalAtivos: 37, page: 1, pageSize: 20 });
    }
    if (url === '/api/cadastros/clientes/cliente-1') return respostaJson(cliente);
    if (url.startsWith('/api/cadastros/representantes')) {
      return respostaJson({
        data: [{ id: 'representante-1', nome: 'Helena Prado', status: 'ativo' }],
        total: 1,
        page: 1,
        pageSize: 100,
      });
    }
    if (url.startsWith('/api/cadastros/rotas')) {
      return respostaJson({
        data: [{ id: 'rota-1', codigo: 'RO-OESTE', nome: 'Rota Oeste', status: 'ativo' }],
        total: 1,
        page: 1,
        pageSize: 100,
      });
    }
    return respostaJson({ message: `URL inesperada: ${url}` }, 500);
  }) as jest.Mock;
}

beforeEach(() => {
  instalarFetch();
});

it('config de clientes nao expoe o campo legado de rota', () => {
  const campoLegado = 'rotaPadrao';
  const resultado = clientesConfig.schema.parse({
    codigo: 'CLI-001',
    razaoSocial: 'Cliente Contrato Ltda.',
    documentoFiscal: '12345678000190',
    [campoLegado]: 'Rota antiga',
  });

  expect(clientesConfig.campos.map((campo) => campo.nome)).not.toContain(campoLegado);
  expect(resultado).not.toHaveProperty(campoLegado);
});

it('clientes exibe as 4 abas do prototipo na ordem', async () => {
  render(<ClientesClient podeGerenciar />);
  const abas = await screen.findAllByRole('tab');
  expect(abas.map((a) => a.textContent)).toEqual([
    'Dados Gerais',
    'Dados Fiscais & Endereço',
    'Contatos',
    'Preferências Operacionais',
  ]);
});

it('clientes nao usa o termo banido e usa Nome Fantasia e Buscar cliente', async () => {
  const { container } = render(<ClientesClient podeGerenciar />);
  expect(container.innerHTML).not.toMatch(/[Mm]arca/);
  expect(await screen.findByLabelText('Nome Fantasia')).toBeInTheDocument();
  expect(await screen.findByPlaceholderText('Buscar cliente...')).toBeInTheDocument();
});

it('selects de representante e rota sao populados pela API de cadastros', async () => {
  render(<ClientesClient podeGerenciar />);

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/cadastros/representantes'),
      expect.any(Object),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/cadastros/rotas'),
      expect.any(Object),
    );
  });

  expect(await screen.findByRole('combobox', { name: 'Representante' })).toHaveTextContent(
    'Helena Prado',
  );
  expect(screen.getByRole('combobox', { name: 'Itinerário / Rota' })).toHaveTextContent(
    'Rota Oeste',
  );
});

it('badge do cabecalho mostra a contagem real de clientes ativos', async () => {
  render(<ClientesClient podeGerenciar={false} />);
  expect(await screen.findByText('Total: 37 ativos')).toBeInTheDocument();
});
