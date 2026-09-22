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
    itens: [{ id: 'i1', compraProgramadaId: 'c1', produtoId: 'ic1', quantidadeComprada: '10', observacoes: null }],
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
  itens: [{ id: 'i2', compraProgramadaId: 'c2', produtoId: 'ic1', quantidadeComprada: '4', observacoes: null }],
});
const COMPRA_CONFIRMADA = baseCompra({ status: 'confirmada' });

let listaCompras: unknown[] = [COMPRA_CONFIRMADA];

function json(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  });
}

async function abrirPrimeiroPedido() {
  const botoes = await screen.findAllByRole('button', { name: /Abrir pedido/ });
  await userEvent.click(botoes[0]!);
}

beforeEach(() => {
  listaCompras = [COMPRA_CONFIRMADA];
  __nav.search = new URLSearchParams();
  __nav.replace.mockReset();
  conectarRealtimeMock.mockClear();
  conectarRealtimeMock.mockImplementation(() => () => undefined);

  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/historico')) {
      return json([]);
    }
    if (url.includes('/impacto')) {
      const decoded = decodeURIComponent(url);
      const match = decoded.match(/:(\d+(?:\.\d+)?)/);
      const qtd = match ? Number(match[1]) : 10;
      if (qtd < 10) {
        return json({
          itens: [{
            produtoId: 'ic1',
            codigo: 'BOI',
            delta: '-5.000',
            deficitProjetado: '3.000',
            quantidadeReservada: '8.000',
            saldoProjetado: '0.000',
            quantidadeGeradaAtual: '10.000',
            quantidadeGeradaProjetada: '5.000',
            descricao: 'Boi casado',
          }],
          deficitTotal: '3.000',
          exigeConfirmacao: true,
          compraId: 'c1',
          operacaoId: 'op-1',
          status: 'confirmada',
          resumo: 'teste',
        });
      }
      return json({ itens: [], deficitTotal: '0', exigeConfirmacao: false });
    }
    if (url.includes('/itens/') && init?.method === 'PATCH') {
      return Promise.resolve({
        ok: false,
        status: 409,
        json: async () => ({
          codigo: 'IMPACTO_CONFIRMACAO_NECESSARIA',
          impacto: { deficitTotal: '3.000', exigeConfirmacao: true, itens: [{ produtoId: 'x', codigo: 'TZ', delta: '-3', deficitProjetado: '3', quantidadeReservada: '5', saldoProjetado: '-3', quantidadeGeradaAtual: '10', quantidadeGeradaProjetada: '7', descricao: 'TZ' }], compraId: 'c1', operacaoId: 'o1', status: 'confirmada', resumo: 'teste' },
        }),
        text: async () => '',
      });
    }
    if (url.endsWith('/itens') && init?.method === 'POST') {
      const body = JSON.parse(String(init.body ?? '{}')) as { produtoId: string; quantidadeComprada: number };
      const atual = (listaCompras.find((c) => (c as { id: string }).id === 'c1') ?? COMPRA_1) as ReturnType<typeof baseCompra>;
      const novo = {
        id: 'i-novo',
        compraProgramadaId: atual.id,
        produtoId: body.produtoId,
        quantidadeComprada: String(body.quantidadeComprada),
        observacoes: null,
      };
      const detalhe = { ...atual, itens: [...atual.itens, novo], totalItens: atual.itens.length + 1 };
      listaCompras = listaCompras.map((c) => ((c as { id: string }).id === atual.id ? detalhe : c));
      return json(detalhe, 201);
    }
    if (url.includes('/itens/') && init?.method === 'DELETE') {
      const atual = (listaCompras.find((c) => (c as { id: string }).id === 'c1') ?? COMPRA_1) as ReturnType<typeof baseCompra>;
      const itemId = url.split('/itens/')[1];
      const detalhe = { ...atual, itens: atual.itens.filter((item) => item.id !== itemId), totalItens: Math.max(0, atual.itens.length - 1) };
      listaCompras = listaCompras.map((c) => ((c as { id: string }).id === atual.id ? detalhe : c));
      return json(detalhe);
    }
    if (url.includes('/compras-programadas/c1/confirmar') && init?.method === 'POST') {
      const confirmada = baseCompra({ status: 'confirmada', observacoes: 'do envelope' });
      listaCompras = listaCompras.map((c) => ((c as { id: string }).id === 'c1' ? confirmada : c));
      return json({
        compra: confirmada,
        jaConfirmada: false,
      });
    }
    if (url.includes('/compras-programadas/c2')) {
      return json(COMPRA_2);
    }
    if (url.includes('/compras-programadas/c1')) {
      return json(listaCompras.find((c) => (c as { id: string }).id === 'c1') ?? COMPRA_1);
    }
    if (url.includes('/compras-programadas')) {
      return json({ data: listaCompras, page: 1, pageSize: 100, total: listaCompras.length });
    }
    if (url.includes('/disponibilidade?compraProgramadaId=')) {
      return json([]);
    }
    if (url.includes('/disponibilidade?dataOperacao=')) {
      return json([]);
    }
    if (url.includes('/disponibilidade')) return json([]);
    if (url.includes('/fornecedores')) return json({ data: [] });
    if (url.includes('/produtos')) {
      return json({
        data: [
          { id: 'ic1', codigo: 'BOI', descricao: 'Boi casado', nome: 'Boi casado' },
          { id: 'ic2', codigo: 'TZ', descricao: 'Traseiro', nome: 'Traseiro' },
        ],
      });
    }
    if (url.includes('/regras-desdobramento/simular')) {
      return json({ itens: [], totalPartes: 0 });
    }
    return json({});
  }) as jest.Mock;
});

describe('ComprasClient', () => {
  it('apresenta a lista de pedidos com a mesma estrutura da venda', async () => {
    render(<ComprasClient permissoes={['COMPRAS_PROGRAMADAS_LER', 'COMPRAS_PROGRAMADAS_GERENCIAR']} />);
    expect(await screen.findByRole('heading', { name: 'Pedidos de Compra' })).toBeInTheDocument();
    expect(screen.getByText('Total de pedidos')).toBeInTheDocument();
    expect(screen.getByText('Rascunhos')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar pedido ou fornecedor...')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Fornecedor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novo pedido de compra' })).toBeInTheDocument();
    expect(screen.queryByText('Lotes da operação')).not.toBeInTheDocument();
  });

  it('abre aviso informativo e entra em modo edição na tela de visualização', async () => {
    render(<ComprasClient permissoes={['COMPRAS_PROGRAMADAS_LER', 'COMPRAS_PROGRAMADAS_GERENCIAR']} />);
    await abrirPrimeiroPedido();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Editar compra confirmada' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Adicionar item' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Alterar uma compra confirmada recalcula imediatamente/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Editar compra confirmada' }));
    expect(screen.getByText('Alterar uma compra confirmada recalcula imediatamente a disponibilidade virtual impactada.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.queryByRole('dialog', { name: 'Editar compra confirmada' })).not.toBeInTheDocument();
    expect(screen.queryByText('Modal editar compra')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Adicionar item' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar edição' })).toBeInTheDocument();
    expect(screen.getByText('Lotes da operação')).toBeInTheDocument();
    expect(screen.getByText('Disponibilidade gerada')).toBeInTheDocument();
    expect(screen.getByLabelText(/Data operacional/i)).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar item' }));
    expect(screen.getAllByRole('combobox', { name: 'Item de compra' })).toHaveLength(2);
    const combosEdicao = screen.getAllByRole('combobox', { name: 'Item de compra' });
    await userEvent.click(combosEdicao[1]!);
    expect(screen.queryByRole('option', { name: 'BOI — Boi casado' })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('option', { name: 'TZ — Traseiro' }));
    const qtds = screen.getAllByRole('spinbutton');
    await userEvent.clear(qtds[0]!);
    await userEvent.type(qtds[0]!, '5');
    await waitFor(() => {
      expect(screen.getByText('Painel de impacto')).toBeInTheDocument();
    });
  });

  it('mostra disponibilidade do lote e a somatória de todos os lotes', async () => {
    const fetchMock = global.fetch as jest.Mock;
    const original = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/disponibilidade?compraProgramadaId=')) {
        return json([{
          modo: 'compra',
          id: 'dv-lote',
          operacaoId: 'op-1',
          compraProgramadaId: 'c1',
          produtoId: 'prod-tz-lote',
          quantidadeTotalGerada: '10.000',
          quantidadeReservada: '0',
          quantidadeDisponivel: '10.000',
          quantidadeRecebida: '0',
          quantidadeComDivergencia: '0',
          status: 'ativa',
        }]);
      }
      if (url.includes('/disponibilidade?dataOperacao=')) {
        return json([{
          modo: 'agregado',
          operacaoId: 'op-1',
          produtoId: 'prod-tz-total',
          quantidadeTotalGerada: '14.000',
          quantidadeReservada: '0',
          quantidadeDisponivel: '14.000',
          quantidadeRecebida: '0',
          quantidadeComDivergencia: '0',
          status: 'ativa',
        }]);
      }
      return original?.(input, init);
    });
    render(<ComprasClient permissoes={['COMPRAS_PROGRAMADAS_LER', 'COMPRAS_PROGRAMADAS_GERENCIAR']} />);
    await abrirPrimeiroPedido();
    await waitFor(() => {
      expect(screen.getByText('Disponibilidade gerada')).toBeInTheDocument();
      expect(screen.getByText('Disponibilidade total')).toBeInTheDocument();
    });
    expect(await screen.findByText('10.000 disp.')).toBeInTheDocument();
    expect(screen.getAllByText('14.000 disp.').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Todos os lotes')).toBeInTheDocument();
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
      '/api/comercial/compras-programadas?pageSize=100',
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
    expect(await screen.findByText('Beta Carnes Ltda')).toBeInTheDocument();
    expect(screen.getByText('Lotes da operação')).toBeInTheDocument();
    expect(screen.getByText('Lote 001')).toBeInTheDocument();
  });

  it('carrega a visualização com o primeiro lote selecionado ao mudar a data', async () => {
    listaCompras = [COMPRA_1, COMPRA_2];
    render(<ComprasClient permissoes={['COMPRAS_PROGRAMADAS_LER', 'COMPRAS_PROGRAMADAS_GERENCIAR']} />);
    await abrirPrimeiroPedido();
    await waitFor(() => expect(screen.getByText('Lotes da operação')).toBeInTheDocument());
    expect(screen.getByText('Lote 001').closest('button')).toHaveClass('bg-primary-soft');
  });

  it('filtra a listagem pelo dataOperacao da URL', async () => {
    __nav.search = new URLSearchParams({ dataOperacao: DATA_URL });
    render(<ComprasClient permissoes={['COMPRAS_PROGRAMADAS_LER', 'COMPRAS_PROGRAMADAS_GERENCIAR']} />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/comercial/compras-programadas?pageSize=100',
        expect.anything(),
      );
    });
    expect(screen.getByLabelText('Filtrar por data de operação')).toHaveValue(DATA_URL);
  });

  it('item de compra da grade e combobox com codigo e descricao', async () => {
    listaCompras = [];
    render(<ComprasClient permissoes={['COMPRAS_PROGRAMADAS_LER', 'COMPRAS_PROGRAMADAS_GERENCIAR']} />);
    await waitFor(() => {
      expect(screen.getByText('Nenhum pedido encontrado.')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Novo pedido de compra' }));
    expect(screen.queryByText('Lotes da operação')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('combobox', { name: 'Item de compra' }));
    expect(await screen.findByRole('option', { name: 'BOI — Boi casado' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'ic1' })).not.toBeInTheDocument();
  });

  it('mostra empty state e ação Novo pedido de compra', async () => {
    listaCompras = [];
    render(<ComprasClient permissoes={['COMPRAS_PROGRAMADAS_LER', 'COMPRAS_PROGRAMADAS_GERENCIAR']} />);
    await waitFor(() => {
      expect(screen.getByText('Nenhum pedido encontrado.')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Novo pedido de compra' })).toBeInTheDocument();
  });

  it('Novo pedido de compra abre só os campos existentes e volta para a lista', async () => {
    listaCompras = [COMPRA_1, COMPRA_2];
    render(<ComprasClient permissoes={['COMPRAS_PROGRAMADAS_LER', 'COMPRAS_PROGRAMADAS_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByText('Lote 001')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Novo pedido de compra' }));
    expect(screen.queryByRole('button', { name: 'Confirmar compra' })).not.toBeInTheDocument();
    expect(screen.queryByText('Lotes da operação')).not.toBeInTheDocument();
    expect(screen.queryByText('Disponibilidade gerada')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Fornecedor/i)).toHaveTextContent('Selecione o fornecedor');
    expect(screen.getByLabelText(/Data operacional/i)).not.toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Voltar para pedidos de compra' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Pedidos de Compra' })).toBeInTheDocument());
  });

  it('mantém o DatePicker habilitado com compra selecionada', async () => {
    render(<ComprasClient permissoes={['COMPRAS_PROGRAMADAS_LER', 'COMPRAS_PROGRAMADAS_GERENCIAR']} />);
    await abrirPrimeiroPedido();
    await waitFor(() => expect(screen.getByText('Lote 001')).toBeInTheDocument());
    expect(screen.getByLabelText(/Data operacional/i)).not.toBeDisabled();
  });

  it('aplica o envelope de confirmação (compra aninhada)', async () => {
    listaCompras = [COMPRA_1];
    render(<ComprasClient permissoes={['COMPRAS_PROGRAMADAS_LER', 'COMPRAS_PROGRAMADAS_GERENCIAR']} />);
    await abrirPrimeiroPedido();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar compra' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar compra' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Editar compra confirmada' })).toBeInTheDocument();
    });
  });

  it('permite incluir e remover item em rascunho ao salvar', async () => {
    listaCompras = [COMPRA_1];
    render(<ComprasClient permissoes={['COMPRAS_PROGRAMADAS_LER', 'COMPRAS_PROGRAMADAS_GERENCIAR']} />);
    await abrirPrimeiroPedido();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Adicionar item' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar item' }));
    const combos = screen.getAllByRole('combobox', { name: 'Item de compra' });
    await userEvent.click(combos[1]!);
    await userEvent.click(await screen.findByRole('option', { name: 'TZ — Traseiro' }));
    const qtds = screen.getAllByRole('spinbutton');
    await userEvent.clear(qtds[1]!);
    await userEvent.type(qtds[1]!, '2');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/comercial/compras-programadas/c1/itens',
        expect.objectContaining({ method: 'POST' }),
      );
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
        '/api/comercial/compras-programadas?pageSize=100',
        expect.anything(),
      );
    }
  });
});
