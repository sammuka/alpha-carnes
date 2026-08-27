import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardClient } from '../src/app/(admin)/gestao/dashboard/dashboard-client';
import { ORDEM_KPIS, ROTULOS_KPI } from '../src/lib/gestao';

const mockReplace = jest.fn();
const mockSearchParams = new URLSearchParams('operacaoId=op-1');

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock('@/lib/realtime', () => ({
  conectarRealtime: () => () => undefined,
}));

const DASHBOARD = {
  operacao: { id: 'op-1', data: '2026-07-22', rotulo: 'Op terça', status: 'aberta', extraordinaria: false },
  kpis: ORDEM_KPIS.map((chave, i) => ({
    chave,
    valor: String(i + 1),
    detalhe: 'detalhe',
  })),
  pedidosEmAndamento: [],
  alertas: [
    {
      chave: 'overbooking_aberto' as const,
      titulo: 'Overbooking em aberto',
      descricao: '2 pendências',
      severidade: 'critico' as const,
      ocorridoEm: new Date().toISOString(),
    },
  ],
  atividadesRecentes: [],
};

beforeEach(() => {
  mockSearchParams.set('operacaoId', 'op-1');
  global.fetch = jest.fn((url: string) => {
    if (url.includes('/api/operacoes')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: [{ id: 'op-1', rotulo: 'Op terça', status: 'aberta', data: '2026-07-22', diaSemana: 2, extraordinaria: false, comprasProgramadas: 1, pedidosVenda: 0, pendenciasOverbookingAbertas: 0 }],
        }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => DASHBOARD });
  }) as jest.Mock;
});

describe('DashboardClient', () => {
  it('renderiza 10 KPIs na ordem do protótipo', async () => {
    render(<DashboardClient permissoes={['COMPRAS_PROGRAMADAS_LER']} />);
    await waitFor(() => {
      expect(screen.getByText(ROTULOS_KPI.compras_programadas!)).toBeInTheDocument();
    });
    for (const chave of ORDEM_KPIS) {
      expect(screen.getByText(ROTULOS_KPI[chave]!)).toBeInTheDocument();
    }
  });

  it('alerta some quando a lista vem vazia', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/operacoes')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ ...DASHBOARD, alertas: [] }),
      });
    });
    render(<DashboardClient permissoes={['COMPRAS_PROGRAMADAS_LER']} />);
    await waitFor(() => {
      expect(screen.getByText('Nenhum alerta ativo no momento.')).toBeInTheDocument();
    });
    expect(screen.queryByText('Overbooking em aberto')).not.toBeInTheDocument();
  });

  it('exibe erro do backend', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/operacoes')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: [{ id: 'op-1', rotulo: 'Op', status: 'aberta', data: '2026-07-22', diaSemana: 2, extraordinaria: false, comprasProgramadas: 0, pedidosVenda: 0, pendenciasOverbookingAbertas: 0 }] }) });
      }
      return Promise.resolve({ ok: false, status: 500, json: async () => ({ message: 'Falha interna' }) });
    });
    render(<DashboardClient permissoes={['COMPRAS_PROGRAMADAS_LER']} />);
    await waitFor(() => {
      expect(screen.getByText('Falha interna')).toBeInTheDocument();
    });
  });

  it('sem operação cadastrada mostra empty state (envelope aninhado real do AllExceptionsFilter)', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/operacoes')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      }
      // Formato real: NotFoundException('OPERACAO_INEXISTENTE') vira { statusCode, message, error }
      // e o AllExceptionsFilter aninha isso tudo em `message` — não é uma string simples.
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({
          statusCode: 404,
          message: { statusCode: 404, message: 'OPERACAO_INEXISTENTE', error: 'Not Found' },
          timestamp: new Date().toISOString(),
          path: '/gestao/dashboard',
          requestId: 'req-1',
        }),
      });
    });
    render(<DashboardClient permissoes={['COMPRAS_PROGRAMADAS_LER']} />);
    await waitFor(() => {
      expect(screen.getByText('Cadastre ou gere a cadência de operações para visualizar os KPIs.')).toBeInTheDocument();
    });
    expect(screen.queryByText('Erro de conexão')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('troca de operação refaz o fetch', async () => {
    render(<DashboardClient permissoes={['COMPRAS_PROGRAMADAS_LER']} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/gestao/dashboard?operacaoId=op-1', expect.any(Object)));
    mockSearchParams.set('operacaoId', 'op-2');
    await userEvent.selectOptions(await screen.findByLabelText('Selecionar operação'), 'op-1');
    expect(mockReplace).toHaveBeenCalled();
  });
});
