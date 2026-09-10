import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AprovacoesClient } from '../src/app/(admin)/gestao/aprovacoes/aprovacoes-client';
import { conectarRealtime } from '../src/lib/realtime';
import type { OcorrenciaPrecoDetalhe, OcorrenciaPrecoLista } from '../src/lib/aprovacoes';

const OPERACAO_ID = '00000000-0000-4000-8000-000000000099';
const mockSearchParams = new URLSearchParams(`operacaoId=${OPERACAO_ID}`);

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock('../src/lib/realtime', () => ({
  conectarRealtime: jest.fn(() => () => undefined),
}));

const conectarRealtimeMock = conectarRealtime as jest.Mock;

const FORNECEDOR = {
  id: 'oc-forn-1',
  fornecedorNome: 'Fornecedor X',
  nfChave: '123',
  pedidoLote: 'L1',
  produtosDivergentes: 1,
  difQtdTotal: '-1',
  difPesoTotal: '-1',
  responsavelNome: 'Marina',
  status: 'aberta',
  dataAbertura: '2026-07-23T10:00:00.000Z',
};

const PRECO_LIST: OcorrenciaPrecoLista = {
  id: 'oc-preco-1',
  pedidoNumero: 'ped-uuid-1',
  clienteNomeFantasia: 'Cliente Alpha',
  status: 'aberta',
  dataHora: '2026-07-24T12:00:00.000Z',
  usuarioFinalizacaoNome: 'Gestor',
  quantidadeItensAjustados: 2,
  diferencaTotal: '-3.00',
};

const PRECO_DETALHE: OcorrenciaPrecoDetalhe = {
  ...PRECO_LIST,
  itens: [
    {
      produtoCodigo: 'DT',
      produtoNome: 'Dianteiro',
      precoTabelaOriginal: '18.50',
      precoAplicado: '17.00',
      diferencaAbsoluta: '-1.50',
      diferencaPercentual: '-8.1081',
      usuarioAjusteNome: 'Comercial',
    },
    {
      produtoCodigo: 'PA',
      produtoNome: 'Patinho',
      precoTabelaOriginal: null,
      precoAplicado: '20.00',
      diferencaAbsoluta: '20.00',
      diferencaPercentual: null,
      usuarioAjusteNome: 'Comercial',
    },
  ],
  usuarioCienteNome: null,
  dataHoraCiente: null,
};

const PRECO_CIENTE: OcorrenciaPrecoDetalhe = {
  ...PRECO_DETALHE,
  status: 'ciente',
  usuarioCienteNome: 'Admin',
  dataHoraCiente: '2026-07-25T08:00:00.000Z',
};

function mockFetch(overrides: {
  precoList?: OcorrenciaPrecoLista[];
  precoDetalhe?: OcorrenciaPrecoDetalhe;
} = {}) {
  const precoList = overrides.precoList ?? [PRECO_LIST];
  let precoDetalhe = overrides.precoDetalhe ?? PRECO_DETALHE;
  let marcouCiente = false;

  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/api/operacoes')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: [{
            id: OPERACAO_ID,
            rotulo: 'Op',
            status: 'aberta',
            data: '2026-07-22',
            diaSemana: 2,
            extraordinaria: false,
            comprasProgramadas: 0,
            pedidosVenda: 0,
            pendenciasOverbookingAbertas: 0,
          }],
        }),
      });
    }
    if (url.includes('comparativo')) {
      return Promise.resolve({ ok: true, json: async () => ({ itens: [] }) });
    }
    if (url.includes('/api/ocorrencias-preco/') && url.endsWith('/ciente')) {
      marcouCiente = true;
      precoDetalhe = PRECO_CIENTE;
      return Promise.resolve({ ok: true, json: async () => PRECO_CIENTE });
    }
    if (url.match(/\/api\/ocorrencias-preco\/[^/?]+$/)) {
      return Promise.resolve({ ok: true, json: async () => (marcouCiente ? PRECO_CIENTE : precoDetalhe) });
    }
    if (url.includes('/api/ocorrencias-preco?')) {
      const lista = marcouCiente
        ? precoList.map((p) => (p.id === PRECO_LIST.id ? { ...p, status: 'ciente' as const } : p))
        : precoList;
      return Promise.resolve({ ok: true, json: async () => ({ data: lista, total: lista.length, page: 1, pageSize: 20 }) });
    }
    if (url.includes('/gestao/aprovacoes') && url.includes('aba=ocorrencias')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: [FORNECEDOR],
          page: 1,
          pageSize: 50,
          total: 1,
        }),
      });
    }
    if (url.includes('/operacao/ocorrencias-fornecedor/')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ status: 'aberta', desfecho: null, dataHoraEncerramento: null, historico: [] }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  }) as jest.Mock;
}

function cardPreco() {
  return screen.getByRole('button', { name: /Preço[\s\S]*Cliente Alpha/i });
}

function cardFornecedor() {
  return screen.getByRole('button', { name: /Fornecedor[\s\S]*Fornecedor X/i });
}

describe('Onda 14 — Fila Administrativa ocorrências de preço', () => {
  beforeEach(() => {
    conectarRealtimeMock.mockClear();
    conectarRealtimeMock.mockImplementation(() => () => undefined);
    mockFetch();
  });

  it('fila mistura fornecedor e preço ordenada por data desc', async () => {
    render(<AprovacoesClient permissoes={['APROVACOES_LER', 'OCORRENCIA_PRECO_CIENTE']} />);
    await waitFor(() => {
      expect(cardPreco()).toBeInTheDocument();
      expect(cardFornecedor()).toBeInTheDocument();
    });
    const cardContainer = cardPreco().closest('div.max-h-\\[560px\\]') ?? cardPreco().parentElement?.parentElement;
    const botoes = cardContainer
      ? Array.from(cardContainer.querySelectorAll('button'))
      : screen.getAllByRole('button');
    expect(botoes[0]?.textContent).toMatch(/Preço/);
    expect(botoes[1]?.textContent).toMatch(/Fornecedor/);
    expect(global.fetch).toHaveBeenCalledWith(
      `/api/ocorrencias-preco?${new URLSearchParams({ operacaoId: OPERACAO_ID })}`,
    );
  });

  it('badge distingue Fornecedor de Preço', async () => {
    render(<AprovacoesClient permissoes={['APROVACOES_LER']} />);
    await waitFor(() => {
      expect(cardFornecedor()).toBeInTheDocument();
      expect(cardPreco()).toBeInTheDocument();
    });
  });

  it('selecionar ocorrência de preço mostra o painel específico', async () => {
    render(<AprovacoesClient permissoes={['APROVACOES_LER', 'OCORRENCIA_PRECO_CIENTE']} />);
    await waitFor(() => expect(cardPreco()).toBeInTheDocument());
    await userEvent.click(cardPreco());
    await waitFor(() => {
      expect(screen.getByText(/Pedido:/)).toBeInTheDocument();
      expect(screen.getByText(/Cliente:/)).toBeInTheDocument();
      expect(screen.queryByText(/NF:/)).not.toBeInTheDocument();
    });
  });

  it('painel lista todos os itens ajustados', async () => {
    render(<AprovacoesClient permissoes={['APROVACOES_LER', 'OCORRENCIA_PRECO_CIENTE']} />);
    await waitFor(() => expect(cardPreco()).toBeInTheDocument());
    await userEvent.click(cardPreco());
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(`/api/ocorrencias-preco/${PRECO_LIST.id}`);
    });
    const linhas = screen.getAllByRole('row');
    expect(linhas.length).toBe(3);
  });

  it('item sem preço de tabela mostra —, não R$ 0,00', async () => {
    render(<AprovacoesClient permissoes={['APROVACOES_LER', 'OCORRENCIA_PRECO_CIENTE']} />);
    await waitFor(() => expect(cardPreco()).toBeInTheDocument());
    await userEvent.click(cardPreco());
    await waitFor(() => {
      expect(screen.getByText('Sem preço de tabela para a data')).toBeInTheDocument();
    });
    expect(screen.queryByText('R$ 0,00')).not.toBeInTheDocument();
    const tabela = screen.getByRole('table');
    expect(within(tabela).getAllByText('—').length).toBeGreaterThan(0);
    expect(within(tabela).getByText('R$ 18,50')).toBeInTheDocument();
    expect(within(tabela).getByText('-8.11')).toBeInTheDocument();
  });

  it('desconto e acréscimo diferenciados por sinal', async () => {
    mockFetch({
      precoDetalhe: {
        ...PRECO_DETALHE,
        itens: [
          {
            produtoCodigo: 'A',
            produtoNome: 'Item A',
            precoTabelaOriginal: '10.00',
            precoAplicado: '8.00',
            diferencaAbsoluta: '-2.00',
            diferencaPercentual: '-20.0000',
            usuarioAjusteNome: null,
          },
          {
            produtoCodigo: 'B',
            produtoNome: 'Item B',
            precoTabelaOriginal: '10.00',
            precoAplicado: '12.00',
            diferencaAbsoluta: '2.00',
            diferencaPercentual: '20.0000',
            usuarioAjusteNome: null,
          },
        ],
      },
    });
    render(<AprovacoesClient permissoes={['APROVACOES_LER', 'OCORRENCIA_PRECO_CIENTE']} />);
    await waitFor(() => expect(cardPreco()).toBeInTheDocument());
    await userEvent.click(cardPreco());
    await waitFor(() => {
      expect(screen.getByText('-R$ 2,00').className).toMatch(/text-destructive/);
      expect(screen.getByText('R$ 2,00').className).toMatch(/text-success-fg/);
      expect(screen.getByText('-20.00')).toBeInTheDocument();
      expect(screen.getByText('20.00')).toBeInTheDocument();
    });
  });

  it('Marcar como ciente some sem OCORRENCIA_PRECO_CIENTE', async () => {
    render(<AprovacoesClient permissoes={['APROVACOES_LER']} />);
    await waitFor(() => expect(cardPreco()).toBeInTheDocument());
    await userEvent.click(cardPreco());
    await waitFor(() => expect(screen.getByText(/Pedido:/)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Marcar como ciente/i })).not.toBeInTheDocument();
  });

  it('após ciente o painel mostra autor e timestamp', async () => {
    render(<AprovacoesClient permissoes={['APROVACOES_LER', 'OCORRENCIA_PRECO_CIENTE']} />);
    await waitFor(() => expect(cardPreco()).toBeInTheDocument());
    await userEvent.click(cardPreco());
    await waitFor(() => expect(screen.getByRole('button', { name: /Marcar como ciente/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Marcar como ciente/i }));
    await waitFor(() => {
      expect(screen.getByText(/Ciente registrado por Admin/)).toBeInTheDocument();
    });
  });

  it('ocorrência já ciente não mostra o botão', async () => {
    mockFetch({ precoList: [{ ...PRECO_LIST, status: 'ciente' }], precoDetalhe: PRECO_CIENTE });
    render(<AprovacoesClient permissoes={['APROVACOES_LER', 'OCORRENCIA_PRECO_CIENTE']} />);
    await waitFor(() => expect(cardPreco()).toBeInTheDocument());
    await userEvent.click(cardPreco());
    await waitFor(() => {
      expect(screen.getByText(/Ciente registrado por Admin/)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /Marcar como ciente/i })).not.toBeInTheDocument();
  });

  it('evento WebSocket atualiza a fila sem polling', async () => {
    let onMessage: ((msg: { type: string }) => void) | undefined;
    conectarRealtimeMock.mockImplementation(({ onMessage: cb }) => {
      onMessage = cb;
      return () => undefined;
    });
    render(<AprovacoesClient permissoes={['APROVACOES_LER', 'OCORRENCIA_PRECO_CIENTE']} />);
    await waitFor(() => expect(conectarRealtimeMock).toHaveBeenCalledWith(
      expect.objectContaining({ rooms: ['dashboard'] }),
    ));
    const fetchCallsBefore = (global.fetch as jest.Mock).mock.calls.length;
    onMessage?.({ type: 'ocorrencia_ajuste_preco_criada' });
    await waitFor(() => {
      expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(fetchCallsBefore);
    });
  });
});
