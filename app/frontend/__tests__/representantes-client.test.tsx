import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RepresentantesClient } from '../src/app/(admin)/cadastros/representantes/representantes-client';
import { UsuariosVinculados } from '../src/app/(admin)/cadastros/representantes/usuarios-vinculados';

const REPRESENTANTE = {
  id: 'r1',
  codigo: 'REP-01',
  nome: 'Sabrina',
  tipoCanal: 'Interno',
  contato: '(11) 98811-2233 · sabrina@alphacarnes.com.br',
  status: 'ativo',
  observacao: 'Time interno Alpha Carnes.',
  clientesVinculados: 5,
  usuariosVinculadosCount: 2,
  createdAt: '2026-07-01T12:00:00.000Z',
  updatedAt: '2026-07-01T12:00:00.000Z',
  deletedAt: null,
};

const CAMPOS_INEXISTENTES = [/E-?mail/i, /Telefone/i, /Regi[ãa]o/i, /Comiss[ãa]o/i, /Data de admiss[ãa]o/i, /Observa[çc][õo]es/i];

beforeEach(() => {
  global.fetch = jest.fn(async (url: RequestInfo | URL) => {
    const alvo = String(url);
    if (alvo.includes('/canais')) return { ok: true, json: async () => ['Interno', 'Representante'] };
    if (/representantes\/r1$/.test(alvo)) {
      return {
        ok: true,
        json: async () => ({
          ...REPRESENTANTE,
          clientesVinculados: [{ id: 'c1', nomeFantasia: 'Mercado 300', razaoSocial: 'Mercado 300 Ltda' }],
          usuariosVinculados: [
            { id: 'u1', nome: 'Ana', email: 'ana@alpha.test', ativo: true },
          ],
        }),
      };
    }
    return { ok: true, json: async () => ({ data: [REPRESENTANTE], total: 1, page: 1, pageSize: 20 }) };
  }) as unknown as typeof fetch;
});

it('tabela tem as 7 colunas do prototipo incluindo Usuarios vinculados', async () => {
  render(<RepresentantesClient podeGerenciar />);
  await screen.findByText('Sabrina');
  const cabecalhos = screen.getAllByRole('columnheader').map((th) => th.textContent);
  expect(cabecalhos).toEqual([
    'Nome', 'Tipo/canal', 'Contato', 'Clientes vinculados', 'Usuários vinculados', 'Status', 'Ações',
  ]);
  expect(screen.getByText('2')).toBeInTheDocument();
});

it('drawer traz codigo, nome, tipo/canal, contato, observacao e status', async () => {
  render(<RepresentantesClient podeGerenciar />);
  fireEvent.click(await screen.findByText('Sabrina'));
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  expect(screen.getByLabelText(/Código/)).toHaveValue('REP-01');
  expect(screen.getByLabelText(/^Nome/)).toHaveValue('Sabrina');
  expect(screen.getByLabelText(/Tipo \/ canal/)).toHaveValue('Interno');
  expect(screen.getByLabelText(/Contato/)).toHaveValue(REPRESENTANTE.contato);
  expect(screen.getByLabelText(/Observação/)).toHaveValue(REPRESENTANTE.observacao);
  expect(screen.getByRole('switch', { name: 'Status' })).toBeChecked();
  expect(await screen.findByText('Mercado 300')).toBeInTheDocument();
});

it('mascara telefone no campo contato conforme cadastro de clientes', async () => {
  render(<RepresentantesClient podeGerenciar />);
  fireEvent.click(await screen.findByRole('button', { name: 'Novo Representante' }));
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  const contato = screen.getByLabelText(/Contato/);
  fireEvent.change(contato, { target: { value: '11987654321' } });
  expect(contato).toHaveValue('(11) 98765-4321');
  fireEvent.change(contato, { target: { value: '1136540000' } });
  expect(contato).toHaveValue('(11) 3654-0000');
});

it('nao existe campo de email, telefone, regiao, comissao ou data de admissao', async () => {
  render(<RepresentantesClient podeGerenciar />);
  fireEvent.click(await screen.findByText('Sabrina'));
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  for (const rotulo of CAMPOS_INEXISTENTES) {
    expect(screen.queryByLabelText(rotulo)).not.toBeInTheDocument();
  }
});

it('busca o detalhe e mostra usuários vinculados em todos os estados', async () => {
  let concluirPrimeira!: (response: Response) => void;
  const fetchMock = jest.fn()
    .mockImplementationOnce(() => new Promise<Response>((resolve) => {
      concluirPrimeira = resolve;
    }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      id: 'r1',
      usuariosVinculados: [
        { id: 'u1', nome: 'Ana', email: 'ana@alpha.test', ativo: true },
        { id: 'u2', nome: 'Beto', email: 'beto@alpha.test', ativo: false },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      id: 'r1',
      usuariosVinculados: [],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  global.fetch = fetchMock as unknown as typeof fetch;

  const primeira = render(<UsuariosVinculados representanteId="r1" />);
  expect(screen.getByText('Carregando usuários vinculados…')).toHaveAttribute(
    'aria-busy',
    'true',
  );
  concluirPrimeira(new Response(JSON.stringify({
    message: 'Falha real do backend',
  }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Falha real do backend');

  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(await screen.findByText('ana@alpha.test')).toBeInTheDocument();
  expect(screen.getByText('beto@alpha.test')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/cadastros/representantes/r1',
    { cache: 'no-store' },
  );

  primeira.unmount();
  render(<UsuariosVinculados representanteId="r1" />);
  expect(await screen.findByText('Nenhum usuário vinculado.')).toBeInTheDocument();
});
