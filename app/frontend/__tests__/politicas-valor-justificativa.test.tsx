import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  PoliticasContabilizacaoClient,
  type PoliticaApresentada,
} from '../src/app/(admin)/erp/contabilidade/politicas-de-contabilizacao/politicas-contabilizacao-client';

beforeEach(() => sessionStorage.clear());

const politica: PoliticaApresentada = {
  codigo: 'LIQUIDACAO-2026-10', tipoEvento: 'LIQUIDACAO', tipoEventoRotulo: 'Liquidação', competencia: '2026-10-01',
  competenciaRotulo: 'Outubro de 2026', contaDebitoCodigo: '1.1.01', contaDebitoNome: 'Caixa e bancos',
  contaCreditoCodigo: '2.1.01', contaCreditoNome: 'Fornecedores', centroCodigo: 'CT1', centroNome: 'Operação industrial',
  vigenciaInicio: '2026-10-01', situacao: 'DRAFT', situacaoRotulo: 'Rascunho', numero: 1, responsavelNome: 'Administrador',
  aprovadorNome: null, criadoEm: '2026-10-15T10:00:00.000Z', alteradoEm: '2026-10-15T10:00:00.000Z',
  simulacaoValor: null, simulacaoDebito: null, simulacaoCredito: null,
};

const ok = { ok: true, status: 201, text: async () => JSON.stringify(politica) };

async function simular(user: ReturnType<typeof userEvent.setup>, valor: string, justificativa = 'simula o evento') {
  await user.click(screen.getByRole('button', { name: 'Simular evento' }));
  await user.type(screen.getByLabelText('Valor'), valor);
  await user.type(screen.getByLabelText('Justificativa / observação'), justificativa);
  await user.click(screen.getByRole('button', { name: 'Confirmar' }));
}

it.each([
  ['123,45', '123.45'],
  ['1.234,56', '1234.56'],
  ['0,01', '0.01'],
  ['9.999.999.999.999,99', '9999999999999.99'],
])('valor %s em reais vai à API como %s', async (digitado, enviado) => {
  const user = userEvent.setup();
  const fetchMock = jest.fn(async () => ok);
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[politica]} />);
  await simular(user, digitado);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(JSON.parse(String(init.body))).toMatchObject({ valor: enviado, justificativa: 'simula o evento' });
});

it.each(['12,3', '1.23,45', '12.345', 'abc'])('valor fora do formato (%s) diz o formato esperado e não envia', async (digitado) => {
  const user = userEvent.setup();
  const fetchMock = jest.fn(async () => ok);
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[politica]} />);
  await simular(user, digitado);
  expect(await screen.findByText('Informe o valor no formato 1.234,56.')).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('justificativa só de espaço de largura zero não envia e explica o mínimo', async () => {
  const user = userEvent.setup();
  const fetchMock = jest.fn(async () => ok);
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[politica]} />);
  await simular(user, '10,00', String.fromCharCode(0x200b).repeat(4));
  expect(await screen.findByText(/mínimo de 3 caracteres/)).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('400 de validação do drawer diz qual campo falta', async () => {
  const user = userEvent.setup();
  const erro = {
    ok: false, status: 400,
    text: async (): Promise<string> => JSON.stringify({ message: { message: 'Validação falhou', errors: [{ path: ['centroCodigo'], code: 'too_small', message: 'Too small' }] } }),
  };
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return erro;
    if (String(url).includes('/opcoes')) return { ok: true, status: 200, json: async () => ({ contas: [], centros: [] }), text: async (): Promise<string> => '' };
    return { ok: true, status: 200, json: async () => ({ itens: [politica], total: 1 }), text: async (): Promise<string> => JSON.stringify({ itens: [politica], total: 1 }) };
  }) as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[politica]} />);
  const abrir = screen.getByRole('button', { name: 'Configurar mappings' });
  await user.click(abrir);
  await user.type(screen.getByLabelText('Justificativa auditável'), 'abre a regra');
  await user.click(screen.getAllByRole('button', { name: 'Configurar mappings' }).at(-1)!);
  expect(await screen.findByText('Informe centro de custo.')).toBeInTheDocument();
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  await user.click(screen.getByRole('button', { name: 'Voltar' }));
  await waitFor(() => expect(abrir).toHaveFocus());
});
