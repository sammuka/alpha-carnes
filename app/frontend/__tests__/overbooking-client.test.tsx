import { render, screen, waitFor } from '@testing-library/react';
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
  itemComercialId: 'ic1',
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
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/operacoes')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: [{ id: 'op-1', rotulo: 'Op', status: 'aberta', data: '2026-07-22', diaSemana: 2, extraordinaria: false, comprasProgramadas: 0, pedidosVenda: 0, pendenciasOverbookingAbertas: 1 }] }) });
    }
    if (url.includes('/cobertura')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          pendenciaId: 'p1',
          itemComercialId: 'ic1',
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
});
