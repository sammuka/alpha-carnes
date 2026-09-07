import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { PesagemDestinacaoClient } from '../src/app/(admin)/recebimento/pesagem-destinacao/pesagem-destinacao-client';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 1;
  constructor(public url: string) {
    MockWebSocket.instances.push(this);
    setTimeout(() => this.onopen?.(), 0);
  }
  send() {}
  close() {
    this.onclose?.();
  }
}

const statusDispositivos = {
  balanca: { status: 'indisponivel', dispositivoId: 'b1', heartbeatEm: 'now' },
  leitor: { status: 'disponivel', dispositivoId: 'l1', heartbeatEm: 'now' },
  impressora: { status: 'disponivel', dispositivoId: 'p1', heartbeatEm: 'now' },
};

const recebimentoId = 'a1aaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const produtoId = 'i1aaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const recebimentoLista = {
  id: recebimentoId,
  codigoLote: 'Lote 001',
  compraProgramadaId: 'c1aaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  numeroInternoCompra: 'PC-001',
  fornecedorId: 'f1aaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  fornecedorNome: 'Frigorífico Teste',
  dataOperacao: '2026-06-08',
  status: 'pesagem_em_andamento',
  nfeNumero: '12345',
  romaneio: 'ROM-1',
  tipoCarga: 'Boi',
  progressoBalanca: 0,
};

const recebimentoDetalhe = {
  id: recebimentoId,
  codigoLote: 'Lote 001',
  compraProgramadaId: recebimentoLista.compraProgramadaId,
  pedidoFornecedorId: 'pf1aaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  fornecedorId: recebimentoLista.fornecedorId,
  dataOperacao: '2026-06-08',
  status: 'pesagem_em_andamento',
  tipoCarga: 'Boi',
  progressoBalanca: 0,
  nfeNumero: '12345',
  nfeSerie: null,
  nfeChave: null,
  nfeDataEmissao: null,
  romaneio: 'ROM-1',
  nfePesoBruto: null,
  nfePesoLiquido: null,
  nfeVolumes: null,
  notaFiscalFornecedor: '12345',
  placaVeiculo: 'ABC1D23',
  motorista: 'João',
  doca: '1',
  observacoes: null,
  fornecedor: { id: recebimentoLista.fornecedorId, razaoSocial: 'Frigorífico Teste' },
  itens: [
    {
      id: 'ri1aaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      produtoId,
      origemDescricao: 'Traseiro',
      quantidadeEsperada: '10',
      quantidadeRecebida: '0',
      unidadeEsperada: 'Peça',
      requerBalanca: true,
      pesoTotalApurado: null,
      statusApuracao: 'aguardando',
      observacoes: null,
      produto: { id: produtoId, codigo: 'TZ', descricao: 'Traseiro' },
    },
  ],
  divergencias: [],
};

function mockFetch(overrides: Record<string, unknown> = {}) {
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const u = typeof url === 'string' ? url : '';
    const method = init?.method ?? 'GET';

    if (method === 'POST' && u.includes('/pesagem/pecas') && !u.includes('/confirmar')) {
      const found = overrides['/api/operacao/pesagem/pecas'];
      return { ok: true, json: async () => found ?? {} };
    }

    if (u.includes('/dispositivos/status')) {
      return { ok: true, json: async () => statusDispositivos };
    }
    if (u.includes('/recebimentos?pageSize')) {
      return { ok: true, json: async () => ({ data: [recebimentoLista] }) };
    }
    if (u.includes(`/recebimentos/${recebimentoId}`) && !u.includes('/acoes')) {
      return { ok: true, json: async () => recebimentoDetalhe };
    }
    if (u.includes('/acoes')) {
      return { ok: true, json: async () => [] };
    }
    if (u.includes('/desossa/faltas')) {
      return { ok: true, json: async () => [] };
    }
    if (u.includes('/sugestao')) {
      return {
        ok: true,
        json: async () => ({ pecaId: 'pc1aaaaaa', sugestao: null, compativeis: [] }),
      };
    }
    const found = Object.entries(overrides).find(([k]) => u.includes(k));
    if (found) return { ok: true, json: async () => found[1] };
    return { ok: true, json: async () => ({}) };
  }) as unknown as typeof fetch;
}

describe('PesagemDestinacaoClient', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    (global as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
    mockFetch();
  });

  it('lote bar exibe codigoLote Lote 001 e o seletor Lote 001 — fornecedor', async () => {
    render(<PesagemDestinacaoClient permissoes={['PESAGEM_LER', 'PESAGEM_GERENCIAR']} />);
    expect(await screen.findByText('Lote 001')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Trocar lote/i }));
    expect(screen.getByRole('option', { name: /Lote 001 — Frigorífico Teste/ })).toBeInTheDocument();
  });

  it('mostra o status dos dispositivos sempre visível (RA-05)', async () => {
    render(<PesagemDestinacaoClient permissoes={['PESAGEM_LER', 'PESAGEM_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByText(/Balança: offline/i)).toBeInTheDocument());
  });

  it('mostra botão Digitar apenas com permissão PESO_MANUAL', async () => {
    const { rerender } = render(<PesagemDestinacaoClient permissoes={['PESAGEM_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByTestId('status-dispositivos')).toBeInTheDocument());
    expect(screen.queryByText('Digitar')).not.toBeInTheDocument();

    rerender(<PesagemDestinacaoClient permissoes={['PESAGEM_GERENCIAR', 'PESO_MANUAL']} />);
    await waitFor(() => expect(screen.getByText('Digitar')).toBeInTheDocument());
  });

  it('captura automática cria peça após carregar lote e produto', async () => {
    mockFetch({
      '/api/operacao/pesagem/pecas': {
        id: 'pc1aaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        recebimentoId,
        pesoOriginal: '12.500',
        modoCapturaPeso: 'automatico',
        statusPeca: 'pesada',
        etiquetaAtual: null,
        pedidoVendaId: null,
        pedidoVendaItemId: null,
      },
    });
    render(<PesagemDestinacaoClient permissoes={['PESAGEM_GERENCIAR', 'ASSOCIACAO_GERENCIAR']} />);

    const btn = await screen.findByRole('button', { name: 'Capturar Peso' });
    await waitFor(() => expect(btn).not.toBeDisabled());
    fireEvent.click(btn);

    await waitFor(() => expect(screen.getByTestId('peca-atual')).toBeInTheDocument());
    expect(screen.getByTestId('peca-status')).toHaveTextContent('pesada');
  });

  it('exibe alerta quando a balança está indisponível', async () => {
    render(<PesagemDestinacaoClient permissoes={['PESAGEM_GERENCIAR', 'PESO_MANUAL']} />);
    await waitFor(() => expect(screen.getByTestId('status-dispositivos')).toBeInTheDocument());
    expect(screen.getByText(/use peso manual assistido/i)).toBeInTheDocument();
  });

  it('Pesagem & Destinação renderiza os blocos do protótipo', async () => {
    const pecaAssociada = {
      id: 'pc1aaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      recebimentoId,
      pesoOriginal: '12.500',
      modoCapturaPeso: 'automatico',
      statusPeca: 'associada',
      etiquetaAtual: null,
      pedidoVendaId: 'pv1',
      pedidoVendaItemId: 'pvi1',
    };
    mockFetch({
      '/api/operacao/pesagem/pecas': pecaAssociada,
      '/sugestao': {
        pecaId: pecaAssociada.id,
        sugestao: {
          pedidoVendaId: 'pv1aaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          pedidoVendaItemId: 'pvi1aaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          produtoId,
          clienteId: 'c1',
          saldoPendente: '10',
          prioridade: 1,
          rotaPrevista: null,
          score: 1,
          justificativa: 'ok',
          prefCompativel: true,
        },
        compativeis: [{
          pedidoVendaId: 'pv1aaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          pedidoVendaItemId: 'pvi1aaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          produtoId,
          clienteId: 'c1',
          saldoPendente: '10',
          prioridade: 1,
          rotaPrevista: null,
          score: 1,
          justificativa: 'ok',
          prefCompativel: true,
        }],
      },
    });

    // Força peça associada no fetch de captura
    const fetchBase = global.fetch as jest.Mock;
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/operacao/pesagem/pecas') && init?.method === 'POST') {
        return { ok: true, json: async () => pecaAssociada };
      }
      if (u.includes('/sugestao')) {
        return {
          ok: true,
          json: async () => ({
            pecaId: pecaAssociada.id,
            sugestao: {
              pedidoVendaId: 'pv1aaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
              pedidoVendaItemId: 'pvi1aaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
              produtoId,
              clienteId: 'c1',
              saldoPendente: '10',
              prioridade: 1,
              rotaPrevista: null,
              score: 1,
              justificativa: 'ok',
              prefCompativel: true,
            },
            compativeis: [{
              pedidoVendaId: 'pv1aaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
              pedidoVendaItemId: 'pvi1aaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
              produtoId,
              clienteId: 'c1',
              saldoPendente: '10',
              prioridade: 1,
              rotaPrevista: null,
              score: 1,
              justificativa: 'ok',
              prefCompativel: true,
            }],
          }),
        };
      }
      return fetchBase(url, init);
    }) as unknown as typeof fetch;

    render(
      <PesagemDestinacaoClient
        permissoes={['PESAGEM_GERENCIAR', 'ASSOCIACAO_GERENCIAR', 'ASSOCIACAO_ESTORNAR', 'ETIQUETA_GERENCIAR']}
      />,
    );

    expect(await screen.findByText('Mais pesada')).toBeInTheDocument();
    expect(screen.getByText('Mais gorda')).toBeInTheDocument();
    expect(screen.getByText('Melhor acabamento')).toBeInTheDocument();

    const btn = await screen.findByRole('button', { name: 'Capturar Peso' });
    await waitFor(() => expect(btn).not.toBeDisabled());
    fireEvent.click(btn);

    await waitFor(() => expect(screen.getByText('Cancelar ação realizada')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('pref. compatível')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Trocar Peça' })).toBeInTheDocument();
  });
});
