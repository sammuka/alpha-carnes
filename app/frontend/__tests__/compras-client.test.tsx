import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComprasClient } from '../src/app/(admin)/gestao/compras/compras-client';

jest.mock('../src/app/(admin)/gestao/compras/compras-edit-modal', () => ({
  ComprasEditModal: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div>
        <span>Modal editar compra</span>
        <button type="button" onClick={onClose}>Fechar modal</button>
      </div>
    ) : null,
}));

const DATA_FIXA = new Date().toISOString().slice(0, 10);

const COMPRA_CONFIRMADA = {
  id: 'c1',
  dataOperacao: DATA_FIXA,
  fornecedorId: 'f1',
  numeroInterno: null,
  referenciaExterna: null,
  previsaoEntrega: null,
  status: 'confirmada',
  observacoes: null,
  createdAt: '2026-07-22T10:00:00Z',
  itens: [{ id: 'i1', compraProgramadaId: 'c1', itemCompraId: 'ic1', quantidadeComprada: '10', observacoes: null }],
};

beforeEach(() => {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/impacto')) {
      return Promise.resolve({ ok: true, json: async () => ({ itens: [], deficitTotal: '0', exigeConfirmacao: false }) });
    }
    if (url.includes('/itens/') && init?.method === 'PATCH') {
      return Promise.resolve({
        ok: false,
        status: 409,
        json: async () => ({
          codigo: 'IMPACTO_CONFIRMACAO_NECESSARIA',
          impacto: { deficitTotal: '3.000', exigeConfirmacao: true, itens: [{ itemComercialId: 'x', codigo: 'TZ', delta: '-3', deficitProjetado: '3', quantidadeReservada: '5', saldoProjetado: '-3', quantidadeGeradaAtual: '10', quantidadeGeradaProjetada: '7', descricao: 'TZ' }], compraId: 'c1', operacaoId: 'o1', status: 'confirmada', resumo: 'teste' },
        }),
      });
    }
    if (url.includes('/compras-programadas/c1')) {
      return Promise.resolve({ ok: true, json: async () => COMPRA_CONFIRMADA });
    }
    if (url.includes('/compras-programadas')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: [COMPRA_CONFIRMADA], page: 1, pageSize: 10, total: 1 }) });
    }
    if (url.includes('/disponibilidade')) return Promise.resolve({ ok: true, json: async () => [] });
    if (url.includes('/fornecedores')) return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
    if (url.includes('/itens-compra')) return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
    return Promise.resolve({ ok: true, json: async () => ({}) });
  }) as jest.Mock;
});

describe('ComprasClient', () => {
  it('exibe aviso de impacto e abre modal para compra confirmada', async () => {
    render(<ComprasClient permissoes={['COMPRAS_PROGRAMADAS_LER', 'COMPRAS_PROGRAMADAS_GERENCIAR']} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Editar compra confirmada' })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Editar compra confirmada' }));
    expect(screen.getByText('Modal editar compra')).toBeInTheDocument();
  });
});
