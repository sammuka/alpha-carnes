import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OverbookingClient } from '../src/app/(admin)/gestao/overbooking/overbooking-client';

const mockSearchParams = new URLSearchParams('operacaoId=op-1');
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => mockSearchParams,
}));
jest.mock('@/lib/realtime', () => ({ conectarRealtime: () => () => undefined }));

const PENDENCIA = {
  id: 'p1',
  pedidoVendaId: 'pv1',
  pedidoVendaItemId: 'pvi1',
  produtoId: 'ic1',
  clienteId: 'cl1',
  vendedorUsuarioId: 'u1',
  operacaoId: 'op-1',
  quantidadeDeficit: '3.000',
  status: 'aberta',
  decisaoJson: {},
  responsavelId: null,
  createdAt: '2026-07-22T10:00:00Z',
  updatedAt: '2026-07-22T10:00:00Z',
};

beforeEach(() => {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/decisao')) {
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }
    if (url.includes('/api/operacoes')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: [{ id: 'op-1', rotulo: 'Op', status: 'aberta', data: '2026-07-22', diaSemana: 2, extraordinaria: false, comprasProgramadas: 0, pedidosVenda: 0, pendenciasOverbookingAbertas: 1 }] }) });
    }
    if (url.includes('/cobertura')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          pendenciaId: 'p1',
          produtoId: 'ic1',
          quantidadeDeficit: '3.000',
          comprasComplementares: [{ compraProgramadaId: 'cp1', operacaoId: 'op-1', dataOperacao: '2026-07-24', status: 'confirmada', quantidadeProjetada: '10' }],
          redistribuicoes: [{ pedidoVendaId: 'pv2', pedidoVendaItemId: 'pvi2', clienteNome: 'Cliente A', quantidadeReservada: '2', reservaId: 'r1', disponibilidadeVirtualId: 'dv1' }],
          proximaOperacao: { id: 'op-2', data: '2026-07-24', rotulo: 'Próxima' },
        }),
      });
    }
    if (url.includes('/historico')) return Promise.resolve({ ok: true, json: async () => [] });
    if (url.includes('/overbooking')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: [PENDENCIA], page: 1, pageSize: 100, total: 1 }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  }) as jest.Mock;
});

describe('OverbookingClient', () => {
  it('renderiza KPIs e os 3 blocos de decisão', async () => {
    render(<OverbookingClient permissoes={['OVERBOOKING_RESOLVER', 'PEDIDOS_LER']} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Programar' })).toBeInTheDocument();
    });
    expect(screen.getByText('Pendências abertas')).toBeInTheDocument();
    expect(screen.getByText('1. Compra complementar')).toBeInTheDocument();
    expect(screen.getByText('2. Redistribuição')).toBeInTheDocument();
    expect(screen.getByText('3. Postergar para próxima operação')).toBeInTheDocument();
  });

  it('compra complementar conserva compraProgramadaId no payload', async () => {
    render(<OverbookingClient permissoes={['OVERBOOKING_RESOLVER', 'PEDIDOS_LER']} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Programar' }));
    await waitFor(() => {
      const chamada = (global.fetch as jest.Mock).mock.calls.find(([url, init]: [string, RequestInit]) =>
        String(url).includes('/decisao') && init?.method === 'POST');
      expect(chamada).toBeDefined();
      expect(JSON.parse(String(chamada?.[1]?.body))).toEqual({
        caminho: 'compra_complementar',
        compraProgramadaId: 'cp1',
        quantidade: '3.000',
      });
    });
  });

  it('postergar envia novo_pedido só com operacaoDestinoId e quantidade', async () => {
    render(<OverbookingClient permissoes={['OVERBOOKING_RESOLVER', 'PEDIDOS_LER']} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Postergar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Gerar novo pedido' }));
    await waitFor(() => {
      const chamada = (global.fetch as jest.Mock).mock.calls.find(([url, init]: [string, RequestInit]) =>
        String(url).includes('/decisao') && init?.method === 'POST'
        && String(init.body).includes('novo_pedido'));
      expect(chamada).toBeDefined();
      expect(JSON.parse(String(chamada?.[1]?.body))).toEqual({
        caminho: 'novo_pedido',
        operacaoDestinoId: 'op-2',
        quantidade: '3.000',
      });
    });
  });
});
