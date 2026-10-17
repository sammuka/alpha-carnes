import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanoContasClient, type ContaGrade } from '../src/app/(admin)/erp/contabilidade/plano-de-contas/plano-contas-client';

const conta: ContaGrade = {
  codigo: '1', nome: 'Caixa e bancos', situacaoRotulo: 'Rascunho', naturezaRotulo: 'Ativo', centroNome: 'Operação industrial',
  vigenciaInicio: '2026-10-01', vigenciaFim: null, classificacaoRotulo: 'sintética', grupo: 'Circulante', contaPaiCodigo: null,
  centroCodigo: 'CT1', situacao: 'DRAFT', natureza: 'ATIVO', classificacao: 'sintetica', numero: 1, responsavelNome: 'Administrador',
  criadoEm: '2026-10-15T10:00:00.000Z', alteradoEm: '2026-10-15T10:00:00.000Z',
};

function adiavel() {
  let resolver!: (valor: unknown) => void;
  const promessa = new Promise((r) => { resolver = r; });
  return { promessa, resolver };
}

const lista = { ok: true, status: 200, json: async () => ({ itens: [conta], total: 1 }), text: async () => '' };
const criada = { ok: true, status: 201, json: async () => conta, text: async () => JSON.stringify(conta) };

beforeEach(() => sessionStorage.clear());

async function preencherCriacao(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '+ Novo registro' }));
  await user.type(screen.getByLabelText('Código'), '2');
  await user.type(screen.getByPlaceholderText('Informe conta contábil'), 'Bancos');
  await user.type(screen.getByLabelText('Grupo'), 'Circulante');
  await user.type(screen.getByLabelText('Início de vigência'), '2026-10-01');
  await user.type(screen.getByLabelText('Motivo da alteração'), 'abre a conta');
}

it('triplo clique em Criar gera um único POST; botões, Voltar e Escape ficam bloqueados em voo', async () => {
  const user = userEvent.setup();
  const envio = adiavel();
  const fetchMock = jest.fn(async (_url: string, init?: RequestInit) => (init?.method === 'POST' ? envio.promessa : lista));
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PlanoContasClient inicial={[conta]} />);
  await preencherCriacao(user);
  const criar = screen.getByRole('button', { name: 'Criar' });
  await user.tripleClick(criar);
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  expect(criar).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Voltar' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Verificar dados' })).toBeDisabled();
  await user.keyboard('{Escape}');
  expect(screen.getByLabelText('Código')).toBeInTheDocument();
  await act(async () => { envio.resolver(criada); });
  await waitFor(() => expect(screen.queryByLabelText('Código')).not.toBeInTheDocument());
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
});

it('triplo clique em Confirmar da revisão gera um único POST; Cancelar e Escape ficam bloqueados em voo', async () => {
  const user = userEvent.setup();
  const envio = adiavel();
  const fetchMock = jest.fn(async (_url: string, init?: RequestInit) => (init?.method === 'POST' ? envio.promessa : lista));
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PlanoContasClient inicial={[conta]} />);
  await user.click(screen.getByRole('button', { name: 'Revisar competência' }));
  await user.type(screen.getByLabelText('Justificativa / observação'), 'revisa a competência');
  const confirmar = screen.getByRole('button', { name: 'Confirmar' });
  await user.tripleClick(confirmar);
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  expect(confirmar).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  await user.keyboard('{Escape}');
  expect(screen.getByLabelText('Justificativa / observação')).toBeInTheDocument();
  await act(async () => { envio.resolver({ ...criada, status: 201 }); });
  await waitFor(() => expect(screen.queryByLabelText('Justificativa / observação')).not.toBeInTheDocument());
});

it('justificativa só de espaço de largura zero não envia e explica o mínimo', async () => {
  const user = userEvent.setup();
  const fetchMock = jest.fn(async () => lista);
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PlanoContasClient inicial={[conta]} />);
  await user.click(screen.getByRole('button', { name: 'Aprovar' }));
  await user.type(screen.getByLabelText('Justificativa / observação'), String.fromCharCode(0x200b).repeat(5));
  await user.click(screen.getByRole('button', { name: 'Confirmar' }));
  expect(await screen.findByText(/mínimo de 3 caracteres/)).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('400 de validação diz qual campo falta, com o rótulo da tela', async () => {
  const user = userEvent.setup();
  const erro = {
    ok: false, status: 400, json: async () => ({}),
    text: async () => JSON.stringify({ message: { message: 'Validação falhou', errors: [{ path: ['centroCodigo'], code: 'too_small', message: 'Too small' }] } }),
  };
  global.fetch = jest.fn(async (_url: string, init?: RequestInit) => (init?.method === 'POST' ? erro : lista)) as unknown as typeof fetch;
  render(<PlanoContasClient inicial={[conta]} />);
  await preencherCriacao(user);
  await user.click(screen.getByRole('button', { name: 'Criar' }));
  expect(await screen.findByText('Informe centro de custo.')).toBeInTheDocument();
  expect(screen.queryByText('Validação falhou')).not.toBeInTheDocument();
});

it('ao fechar o drawer o foco volta ao botão que o abriu', async () => {
  const user = userEvent.setup();
  global.fetch = jest.fn(async () => lista) as unknown as typeof fetch;
  render(<PlanoContasClient inicial={[conta]} />);
  const novo = screen.getByRole('button', { name: '+ Novo registro' });
  await user.click(novo);
  await user.click(screen.getByRole('button', { name: 'Voltar' }));
  await waitFor(() => expect(novo).toHaveFocus());
  const editar = screen.getByRole('button', { name: 'Editar versão' });
  await user.click(editar);
  await user.keyboard('{Escape}');
  await waitFor(() => expect(editar).toHaveFocus());
});
