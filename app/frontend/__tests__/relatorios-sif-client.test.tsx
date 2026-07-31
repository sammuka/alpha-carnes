import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RelatoriosClient } from '../src/app/(admin)/gestao/relatorios/relatorios-client';

const mockSearchParams = new URLSearchParams('operacaoId=op-1');
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => mockSearchParams,
}));

const RELATORIOS = [
  {
    id: 'r1',
    operacaoId: 'op-1',
    tipo: 'recebimento',
    codigo: 'SIF-01',
    nome: 'Mapa de recebimento',
    perfilResponsavel: 'Administrativo',
    status: 'pendente_dados',
    pendenciasJson: ['dado faltando'],
    versaoAtual: 0,
    ultimaVersao: null,
  },
  {
    id: 'r2',
    operacaoId: 'op-1',
    tipo: 'expedicao',
    codigo: 'SIF-02',
    nome: 'Controle expedição',
    perfilResponsavel: 'Carga',
    status: 'gerado',
    pendenciasJson: [],
    versaoAtual: 1,
    ultimaVersao: { id: 'v1', versao: 1, tipoGeracao: 'gerado', motivoRetificacao: null, geradoEm: '2026-07-22T12:00:00Z', geradoPorNome: 'Diego' },
  },
];

beforeEach(() => {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/operacoes')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: [{ id: 'op-1', rotulo: 'Op', status: 'aberta', data: '2026-07-22', diaSemana: 2, extraordinaria: false, comprasProgramadas: 0, pedidosVenda: 0, pendenciasOverbookingAbertas: 0 }] }) });
    }
    if (url.includes('/versoes')) {
      return Promise.resolve({ ok: true, json: async () => [{ id: 'v1', versao: 1, tipoGeracao: 'gerado', motivoRetificacao: null, geradoEm: '2026-07-22T12:00:00Z', geradoPorNome: 'Diego' }] });
    }
    if (url.includes('/sif/relatorios')) {
      return Promise.resolve({ ok: true, json: async () => RELATORIOS });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  }) as jest.Mock;
});

describe('RelatoriosClient', () => {
  it('badge P8 presente, Gerar desabilitado em pendente_dados, histórico renderiza', async () => {
    render(<RelatoriosClient permissoes={['SIF_LER', 'SIF_GERAR']} />);
    await waitFor(() => {
      expect(screen.getByText('Mapa de recebimento')).toBeInTheDocument();
    });
    const btnGerar = screen.getAllByRole('button', { name: 'Gerar' })[0];
    expect(btnGerar).toBeDisabled();
    expect(screen.getAllByText('Provisório').length).toBeGreaterThan(0);
    const historicoSegundo = screen.getAllByRole('button', { name: /Histórico/i })[1]!;
    await userEvent.click(historicoSegundo);
    expect(await screen.findByText('Histórico de versões')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveTextContent('v1');
  });
});
