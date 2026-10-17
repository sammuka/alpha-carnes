import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanoContasClient, type ContaGrade } from '../src/app/(admin)/erp/contabilidade/plano-de-contas/plano-contas-client';

const linha = (codigo: string, nome: string, numero = 1): ContaGrade => ({
  codigo, nome, situacaoRotulo: 'Aguardando revisão', naturezaRotulo: 'Ativo', centroNome: 'Operação industrial',
  vigenciaInicio: '2026-10-01', vigenciaFim: null, classificacaoRotulo: 'sintética', grupo: 'Circulante',
  contaPaiCodigo: null, centroCodigo: 'CT1', situacao: 'REVIEW', natureza: 'ATIVO', classificacao: 'sintetica',
  numero, responsavelNome: 'Administrador', criadoEm: '2026-10-15T10:00:00.000Z', alteradoEm: '2026-10-15T10:00:00.000Z',
});

const lista = (itens: ContaGrade[], total: number) =>
  ({ ok: true, status: 200, json: async () => ({ itens, total }), text: async () => JSON.stringify({ itens, total }) }) as Response;

it('marcar na página 1, trocar de página e aprovar em lote envia só as contas marcadas na página atual', async () => {
  const user = userEvent.setup();
  const posts: { url: string; corpo: Record<string, unknown> }[] = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      posts.push({ url: String(url), corpo: JSON.parse(String(init.body)) as Record<string, unknown> });
      return { ok: true, status: 200, json: async () => [], text: async () => '[]' } as unknown as Response;
    }
    return lista([linha('C', 'Conta C', 3), linha('D', 'Conta D', 4)], 40);
  }) as unknown as typeof fetch;
  render(<PlanoContasClient inicial={[linha('A', 'Conta A'), linha('B', 'Conta B', 2)]} totalInicial={40} />);
  await user.click(screen.getByRole('checkbox', { name: 'Selecionar Conta A' }));
  await user.click(screen.getByRole('checkbox', { name: 'Selecionar Conta B' }));
  await user.click(screen.getByRole('link', { name: 'Próxima página' }));
  await screen.findByRole('checkbox', { name: 'Selecionar Conta C' });
  await waitFor(() => expect(screen.queryAllByRole('checkbox', { checked: true })).toHaveLength(0));
  await user.click(screen.getByRole('checkbox', { name: 'Selecionar Conta C' }));
  await user.click(screen.getByRole('checkbox', { name: 'Selecionar Conta D' }));
  await user.click(screen.getByRole('button', { name: 'Aprovar' }));
  await user.type(screen.getByLabelText('Justificativa / observação'), 'aprova o lote');
  await user.click(screen.getByRole('button', { name: 'Confirmar' }));
  await waitFor(() => expect(posts).toHaveLength(1));
  expect(posts[0]!.url).toBe('/api/contabilidade/plano/lote');
  expect(posts[0]!.corpo).toMatchObject({ acao: 'aprovar', codigos: ['C', 'D'], numeroPorCodigo: { C: 3, D: 4 } });
});

it('depois do lote concluído a seleção é limpa', async () => {
  const user = userEvent.setup();
  global.fetch = jest.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return { ok: true, status: 200, json: async () => [], text: async () => '[]' } as unknown as Response;
    return lista([linha('A', 'Conta A'), linha('B', 'Conta B', 2)], 2);
  }) as unknown as typeof fetch;
  render(<PlanoContasClient inicial={[linha('A', 'Conta A'), linha('B', 'Conta B', 2)]} totalInicial={2} />);
  await user.click(screen.getByRole('checkbox', { name: 'Selecionar Conta A' }));
  await user.click(screen.getByRole('checkbox', { name: 'Selecionar Conta B' }));
  await user.click(screen.getByRole('button', { name: 'Aprovar' }));
  await user.type(screen.getByLabelText('Justificativa / observação'), 'aprova o lote');
  await user.click(screen.getByRole('button', { name: 'Confirmar' }));
  await waitFor(() => expect(screen.queryAllByRole('checkbox', { checked: true })).toHaveLength(0));
});

it('falha da lista oferece Tentar novamente e não apaga a grade', async () => {
  const user = userEvent.setup();
  const fetchMock = jest.fn()
    .mockResolvedValueOnce({ ok: false, status: 500, text: async () => JSON.stringify({ message: 'Serviço indisponível' }) })
    .mockResolvedValueOnce(lista([linha('C', 'Conta C')], 1));
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PlanoContasClient inicial={[linha('A', 'Conta A')]} />);
  await user.type(screen.getByLabelText('Buscar registros da lista'), 'x');
  const alerta = await screen.findByRole('alert');
  expect(alerta).toHaveTextContent('Serviço indisponível');
  expect(screen.getByRole('cell', { name: 'Conta A' })).toBeInTheDocument();
  await user.click(within(alerta).getByRole('button', { name: 'Tentar novamente' }));
  expect(await screen.findByRole('cell', { name: 'Conta C' })).toBeInTheDocument();
  expect(fetchMock.mock.calls[1]?.[0]).toBe(fetchMock.mock.calls[0]?.[0]);
});
