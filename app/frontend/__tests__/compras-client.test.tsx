import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComprasClient } from '../src/app/(admin)/gestao/compras/compras-client';
import { conectarRealtime } from '../src/lib/realtime';

jest.mock('next/navigation', () => {
  const nav = {
    replace: jest.fn(),
    search: new URLSearchParams(),
  };
  return {
    __nav: nav,
    useRouter: () => ({ replace: (url: string) => nav.replace(url) }),
    useSearchParams: () => nav.search,
  };
});

jest.mock('../src/lib/realtime', () => ({
  conectarRealtime: jest.fn(() => () => undefined),
}));

jest.mock('../src/app/(admin)/gestao/compras/compras-edit-modal', () => ({
  ComprasEditModal: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div>
        <span>Modal editar compra</span>
        <button type="button" onClick={onClose}>Fechar modal</button>
      </div>
    ) : null,
}));

const { __nav } = jest.requireMock('next/navigation') as {
  __nav: { replace: jest.Mock; search: URLSearchParams };
};
const conectarRealtimeMock = conectarRealtime as jest.Mock;

const HOJE = new Date().toISOString().slice(0, 10);
const DATA_URL = '2026-01-15';

function baseCompra(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    operacaoId: 'op-1',
    dataOperacao: HOJE,
    fornecedorId: 'f1',
    numeroSequencial: 1,
    fornecedorNomeFantasia: 'Frigorífico Alfa',
    fornecedorRazaoSocial: 'Alfa Carnes Ltda',
    totalItens: 1,
    numeroInterno: null,
    referenciaExterna: null,
    previsaoEntrega: null,
    status: 'rascunho',
    observacoes: null,
    createdAt: '2026-07-22T10:00:00Z',
    itens: [{ id: 'i1', compraProgramadaId: 'c1', itemCompraId: 'ic1', quantidadeComprada: '10', observacoes: null }],
    ...overrides,
  };
}

const COMPRA_1 = baseCompra();
const COMPRA_2 = baseCompra({
  id: 'c2',
  fornecedorId: 'f2',
  numeroSequencial: 2,
  fornecedorNomeFantasia: null,
  fornecedorRazaoSocial: 'Beta Carnes Ltda',
  status: 'confirmada',
  itens: [{ id: 'i2', compraProgramadaId: 'c2', itemCompraId: 'ic1', quantidadeComprada: '4', observacoes: null }],
});
const COMPRA_CONFIRMADA = baseCompra({ status: 'confirmada' });

let listaCompras: unknown[] = [COMPRA_CONFIRMADA];

beforeEach(() => {
  listaCompras = [COMPRA_CONFIRMADA];
  __nav.search = new URLSearchParams();
  __nav.replace.mockReset();
  conectarRealtimeMock.mockClear();
  conectarRealtimeMock.mockImplementation(() => () => undefined);

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
    if (url.includes('/compras-programadas/c1/confirmar') && init?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          compra: baseCompra({ status: 'confirmada', observacoes: 'do envelope' }),
          jaConfirmada: false,
        }),
      });
    }
    if (url.includes('/compras-programadas/c2')) {
      return Promise.resolve({ ok: true, json: async () => COMPRA_2 });
    }
    if (url.includes('/compras-programadas/c1')) {
      return Promise.resolve({ ok: true, json: async () => listaCompras.find((c) => (c as { id: string }).id === 'c1') ?? COMPRA_1 });
    }
    if (url.includes('/compras-programadas')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: listaCompras, page: 1, pageSize: 100, total: listaCompras.length }) });
    }
    if (url.includes('/disponibilidade')) return Promise.resolve({ ok: true, json: async () => [] });
    if (url.includes('/fornecedores')) return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
    if (url.includes('/itens-compra')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: [{ id: 'ic1', codigo: 'BOI', descricao: 'Boi casado', nome: 'Boi casado' }],
        }),
      });
    }
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

  it('lista duas compras do mesmo dia como Lote 001 e Lote 002', async () => {
    listaCompras = [COMPRA_1, COMPRA_2];
    render(<ComprasClient permissoes={['COMPRAS_PROGRAMADAS_LER', 'COMPRAS_PROGRAMADAS_GERENCIAR']} />);
    await waitFor(() => {
      expect(screen.getByText('Lote 001')).toBeInTheDocument();
      expect(screen.getByText('Lote 002')).toBeInTheDocument();
    });
    expect(screen.getByText('Frigorífico Alfa')).toBeInTheDocument();
    expect(screen.getByText('Beta Carnes Ltda')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/comercial/compras-programadas?dataOperacao='),
      expect.anything(),
    );
  });

  it('seleciona a compra do deep-link ?compraId=', async () => {
    listaCompras = [COMPRA_1, COMPRA_2];
    __nav.search = new URLSearchParams({ dataOperacao: HOJE, compraId: 'c2' });
    render(<ComprasClient permissoes={['COMPRAS_PROGRAMADAS_LER', 'COMPRAS_PROGRAMADAS_GERENCIAR']} />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/comercial/compras-programadas/c2',
        expect.anything(),
      );
    });
    expect(screen.getByText('Beta Carnes Ltda')).toBeInTheDocument();
  });

  it('filtra a listagem pelo dataOperacao da URL', async () => {
    __nav.search = new URLSearchParams({ dataOperacao: DATA_URL });
    render(<ComprasClient permissoes={['COMPRAS_PROGRAMADAS_LER', 'COMPRAS_PROGRAMADAS_GERENCIAR']} />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/comercial/compras-programadas?dataOperacao=${DATA_URL}&pageSize=100`,
        expect.anything(),
      );
    });
  });

  it('item de compra da grade e combobox com codigo e descricao', async () => {
    listaCompras = [];
    render(<ComprasClient permissoes={['COMPRAS_PROGRAMADAS_LER', 'COMPRAS_PROGRAMADAS_GERENCIAR']} />);
    await waitFor(() => {
      expect(screen.getByText('Nenhum pedido de compra para esta operação.')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('combobox', { name: 'Item de compra' }));
    expect(await screen.findByRole('option', { name: 'BOI — Boi casado' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'ic1' })).not.toBeInTheDocument();
  });

  it('mostra empty state e ação Novo pedido de compra', async () => {
    listaCompras = [];
    render(<ComprasClient permissoes={['COMPRAS_PROGRAMADAS_LER', 'COMPRAS_PROGRAMADAS_GERENCIAR']} />);
    await waitFor(() => {
      expect(screen.getByText('Nenhum pedido de compra para esta operação.')).toBeInTheDocument();
    });
    expect(screen.getAllByRole('button', { name: 'Novo pedido de compra' }).length).toBeGreaterThanOrEqual(1);
  });

  it('Novo pedido de compra limpa o formulário sem mudar a data', async () => {
    listaCompras = [COMPRA_1, COMPRA_2];
    render(<ComprasClient permissoes={['COMPRAS_PROGRAMADAS_LER', 'COMPRAS_PROGRAMADAS_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar compra' })).toBeInTheDocument());
    const dataAntes = screen.getByLabelText(/Data operacional/i);
    expect(dataAntes).not.toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Novo pedido de compra' }));
    expect(screen.queryByRole('button', { name: 'Confirmar compra' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Fornecedor/i)).toHaveTextContent('Selecione o fornecedor');
    expect(screen.getByLabelText(/Data operacional/i)).not.toBeDisabled();
    expect(__nav.replace).toHaveBeenCalledWith(expect.stringMatching(/dataOperacao=/));
    expect(__nav.replace.mock.calls.at(-1)?.[0]).not.toMatch(/compraId=/);
  });

  it('mantém o DatePicker habilitado com compra selecionada', async () => {
    render(<ComprasClient permissoes={['COMPRAS_PROGRAMADAS_LER', 'COMPRAS_PROGRAMADAS_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByText('Lote 001')).toBeInTheDocument());
    expect(screen.getByLabelText(/Data operacional/i)).not.toBeDisabled();
  });

  it('aplica o envelope de confirmação (compra aninhada)', async () => {
    listaCompras = [COMPRA_1];
    render(<ComprasClient permissoes={['COMPRAS_PROGRAMADAS_LER', 'COMPRAS_PROGRAMADAS_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar compra' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar compra' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Editar compra confirmada' })).toBeInTheDocument();
    });
  });

  it('refaz lista e detalhe ao receber cada um dos seis eventos reais', async () => {
    listaCompras = [COMPRA_1];
    render(<ComprasClient permissoes={['COMPRAS_PROGRAMADAS_LER', 'COMPRAS_PROGRAMADAS_GERENCIAR']} />);
    await waitFor(() => expect(conectarRealtimeMock).toHaveBeenCalled());
    const opts = conectarRealtimeMock.mock.calls.at(-1)?.[0] as {
      rooms: string[];
      onMessage: (msg: { type: string; payload: unknown }) => void;
    };
    expect(opts.rooms).toEqual(['operacao:op-1']);
    const eventos = [
      'compra_programada_criada',
      'compra_programada_atualizada',
      'compra_programada_cancelada',
      'compra_programada_confirmada',
      'disponibilidade_virtual_gerada',
      'compra_programada_alterada_impacto',
    ];
    const fetchMock = global.fetch as jest.Mock;
    for (const type of eventos) {
      const antes = fetchMock.mock.calls.length;
      act(() => {
        opts.onMessage({ type, payload: {} });
      });
      await waitFor(() => {
        expect(fetchMock.mock.calls.length).toBeGreaterThan(antes);
      });
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/comercial/compras-programadas?dataOperacao=${HOJE}&pageSize=100`,
        expect.anything(),
      );
    }
  });
});
