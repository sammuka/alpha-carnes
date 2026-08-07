import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  CadastroTabelaDrawer,
  type StatusCadastro,
} from '../src/components/cadastros/cadastro-tabela-drawer';

interface Linha { id: string; nome: string; status: StatusCadastro }

const LINHAS: Linha[] = [
  { id: 'r1', nome: 'Carlos Silva', status: 'ativo' },
  { id: 'r2', nome: 'Sabrina Alves', status: 'inativo' },
];

const props = {
  titulo: 'Representantes',
  subtitulo: 'Gestão da equipe comercial',
  rotuloNovo: 'Novo Representante',
  rotuloSalvar: 'Salvar Representante',
  tituloDrawerNovo: 'Novo Representante',
  tituloDrawerEdicao: (r: Linha) => `Representante — ${r.nome}`,
  placeholderBusca: 'Buscar por nome ou contato',
  substantivoSingular: 'representante',
  substantivoPlural: 'representantes',
  endpoint: '/api/cadastros/representantes',
  colunas: [{ chave: 'nome', titulo: 'Nome', render: (r: Linha) => r.nome }],
  campos: [{ nome: 'nome', rotulo: 'Nome', tipo: 'texto' as const, obrigatorio: true }],
  filtros: [
    {
      nome: 'status',
      rotuloTodos: 'Status: Todos',
      opcoes: [
        { valor: 'ativo', rotulo: 'Ativo' },
        { valor: 'inativo', rotulo: 'Inativo' },
      ],
    },
  ],
  larguraDrawer: 460 as const,
  statusDe: (r: Linha) => r.status,
  paraFormulario: (r: Linha) => ({ nome: r.nome, status: r.status }),
  formularioVazio: { nome: '', status: 'ativo' },
  paraPayload: (f: Record<string, string>) => ({ nome: f.nome, status: f.status }),
  mensagemVazia: 'Nenhum representante encontrado para os filtros aplicados.',
};

function respostaOk(linhas: Linha[] = LINHAS) {
  return {
    ok: true,
    json: async () => ({ data: linhas, total: linhas.length, page: 1, pageSize: 20 }),
  };
}

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue(respostaOk()) as unknown as typeof fetch;
});

it('lista registros do backend e mostra o contador do prototipo', async () => {
  render(<CadastroTabelaDrawer<Linha> {...props} podeGerenciar />);
  expect(await screen.findByText('Carlos Silva')).toBeInTheDocument();
  expect(screen.getByText('2 representantes')).toBeInTheDocument();
  expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Filtros' })).not.toBeInTheDocument();
});

it('sem permissao de gerenciar nao ha botao novo nem acoes de linha', async () => {
  render(<CadastroTabelaDrawer<Linha> {...props} podeGerenciar={false} />);
  await screen.findByText('Carlos Silva');
  expect(screen.queryByRole('button', { name: 'Novo Representante' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Inativar' })).not.toBeInTheDocument();
});

it('clique na linha abre o drawer em edicao com os dados da linha', async () => {
  render(<CadastroTabelaDrawer<Linha> {...props} podeGerenciar />);
  fireEvent.click(await screen.findByText('Carlos Silva'));
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  expect(screen.getByText('Representante — Carlos Silva')).toBeInTheDocument();
  expect(screen.getByLabelText(/Nome/)).toHaveValue('Carlos Silva');
  expect(screen.getByRole('button', { name: 'Salvar Representante' })).toBeInTheDocument();
});

it('drawer respeita a largura de 460 e 520 px por tela', async () => {
  const { unmount } = render(<CadastroTabelaDrawer<Linha> {...props} podeGerenciar />);
  fireEvent.click(await screen.findByText('Carlos Silva'));
  await waitFor(() => expect(screen.getByRole('dialog').className).toContain('w-[460px]'));
  unmount();

  render(<CadastroTabelaDrawer<Linha> {...props} larguraDrawer={520} podeGerenciar />);
  fireEvent.click(await screen.findByText('Carlos Silva'));
  await waitFor(() => expect(screen.getByRole('dialog').className).toContain('w-[520px]'));
});

it('select de status refaz a consulta com o filtro na query', async () => {
  render(<CadastroTabelaDrawer<Linha> {...props} podeGerenciar />);
  await screen.findByText('Carlos Silva');
  fireEvent.change(screen.getByLabelText('Status: Todos'), { target: { value: 'inativo' } });
  await waitFor(() => {
    const chamadas = (global.fetch as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(chamadas.some((url) => url.includes('status=inativo'))).toBe(true);
  });
});

it('acao Power faz PATCH de status e nao abre o drawer nem oferece exclusao', async () => {
  render(<CadastroTabelaDrawer<Linha> {...props} podeGerenciar />);
  await screen.findByText('Carlos Silva');
  expect(screen.queryByRole('button', { name: 'Remover' })).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: 'Inativar' })[0]!);
  await waitFor(() => {
    const patch = (global.fetch as jest.Mock).mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === 'PATCH',
    );
    expect(patch).toBeDefined();
    expect(String(patch![0])).toBe('/api/cadastros/representantes/r1');
    expect(JSON.parse(String((patch![1] as RequestInit).body))).toEqual({ status: 'inativo' });
  });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('erro do backend aparece como mensagem, sem lista falsa', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 403,
    json: async () => ({ message: 'Sem permissão' }),
  }) as unknown as typeof fetch;
  render(<CadastroTabelaDrawer<Linha> {...props} podeGerenciar />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Sem permissão');
  expect(screen.queryByText('Carlos Silva')).not.toBeInTheDocument();
});
