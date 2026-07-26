import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RepresentantesClient } from '../src/app/(admin)/cadastros/representantes/representantes-client';

const REPRESENTANTE = {
  id: 'r1',
  codigo: 'REP-01',
  nome: 'Sabrina',
  tipoCanal: 'Interno',
  contato: '(11) 98811-2233 · sabrina@alphacarnes.com.br',
  status: 'ativo',
  observacao: 'Time interno Alpha Carnes.',
  clientesVinculados: 5,
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
        }),
      };
    }
    return { ok: true, json: async () => ({ data: [REPRESENTANTE], total: 1, page: 1, pageSize: 20 }) };
  }) as unknown as typeof fetch;
});

it('tabela tem as 6 colunas do prototipo, sem Usuarios vinculados', async () => {
  render(<RepresentantesClient podeGerenciar />);
  await screen.findByText('Sabrina');
  const cabecalhos = screen.getAllByRole('columnheader').map((th) => th.textContent);
  expect(cabecalhos).toEqual(['Nome', 'Tipo/canal', 'Contato', 'Clientes vinculados', 'Status', 'Ações']);
  expect(screen.getByText('5')).toBeInTheDocument();
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

it('nao existe campo de email, telefone, regiao, comissao ou data de admissao', async () => {
  render(<RepresentantesClient podeGerenciar />);
  fireEvent.click(await screen.findByText('Sabrina'));
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  for (const rotulo of CAMPOS_INEXISTENTES) {
    expect(screen.queryByLabelText(rotulo)).not.toBeInTheDocument();
  }
});
