import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AprovacoesClient } from '../src/app/(admin)/gestao/aprovacoes/aprovacoes-client';

const mockSearchParams = new URLSearchParams('operacaoId=op-1');
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => mockSearchParams,
}));

const COMPARATIVO = {
  itens: [{
    produtoId: 'ic1',
    codigo: 'TZ',
    descricao: 'Traseiro',
    qtdPedido: '10',
    qtdNf: '10',
    qtdApurada: '9',
    pesoNf: '100',
    pesoApurado: '99',
    difQtd: '-1',
    difPeso: '-1',
  }],
};

beforeEach(() => {
  global.fetch = jest.fn((url: string) => {
    if (url.includes('/api/operacoes')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: [{ id: 'op-1', rotulo: 'Op', status: 'aberta', data: '2026-07-22', diaSemana: 2, extraordinaria: false, comprasProgramadas: 0, pedidosVenda: 0, pendenciasOverbookingAbertas: 0 }] }) });
    }
    if (url.includes('comparativo')) return Promise.resolve({ ok: true, json: async () => COMPARATIVO });
    if (url.includes('aba=operacionais')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: [{
            id: 'a1',
            tipo: 'ajuste_estoque_relevante',
            origem: 'Estoque',
            descricao: 'Ajuste relevante',
            impacto: 'Impacto alto',
            status: 'pendente',
            solicitadoEm: '2026-07-22',
            solicitanteNome: 'Gestor',
            decisaoMotivo: null,
            decididoEm: null,
          }],
          page: 1,
          pageSize: 50,
          total: 1,
        }),
      });
    }
    if (url.includes('/gestao/aprovacoes')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: [{ id: 'oc1', fornecedorNome: 'Fornecedor X', nfChave: '123', pedidoLote: 'L1', produtosDivergentes: 1, difQtdTotal: '-1', difPesoTotal: '-1', responsavelNome: 'Marina', status: 'aberta', dataAbertura: '2026-07-22' }],
          page: 1,
          pageSize: 50,
          total: 1,
        }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  }) as jest.Mock;
});

describe('AprovacoesClient', () => {
  it('alterna abas e renderiza comparativo com aviso de imutabilidade', async () => {
    render(<AprovacoesClient permissoes={['APROVACOES_LER', 'APROVACOES_DECIDIR']} />);
    await waitFor(() => {
      expect(screen.getByText(/imutáveis e servem apenas de referência/)).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('tab', { name: 'Aprovações Operacionais' }));
    await waitFor(() => expect(screen.getByText('Ajuste de estoque relevante')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Rejeitar solicitação' }));
    expect(screen.getByLabelText(/Motivo/)).toBeInTheDocument();
    const confirmar = screen.getByRole('button', { name: 'Confirmar' });
    expect(confirmar).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Motivo/), 'Motivo detalhado da rejeição');
    expect(confirmar).not.toBeDisabled();
  });
});
