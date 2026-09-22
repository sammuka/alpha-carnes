import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
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
      produto: { id: produtoId, codigo: 'TZ', descricao: 'Traseiro', passaDesossa: true, podeEstoque: true },
    },
  ],
  divergencias: [],
};

function mockFetch(overrides: Record<string, unknown> = {}) {
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const u = typeof url === 'string' ? url : '';
    const method = init?.method ?? 'GET';

    if (method === 'POST' && u.includes('/sem-cobertura')) {
      const found = overrides['sem-cobertura'];
      return { ok: true, json: async () => found ?? {} };
    }
    if (method === 'POST' && (u.endsWith('/etiqueta') || u.includes('/etiqueta'))) {
      const found = overrides['etiqueta'];
      return { ok: true, json: async () => found ?? {} };
    }
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
    if (u.includes('/sugestao') || u.includes('/compativeis')) {
      return {
        ok: true,
        json: async () => ({ pecaId: 'pc1aaaaaa', sugestao: null, compativeis: [] }),
      };
    }
    if (
      u.includes(`/recebimentos/${recebimentoId}`) &&
      !u.includes('/acoes') &&
      !u.includes('/pecas') &&
      !u.includes('/compativeis')
    ) {
      const det = (overrides.detalhe as typeof recebimentoDetalhe | undefined) ?? recebimentoDetalhe;
      return { ok: true, json: async () => det };
    }
    if (u.includes('/acoes')) {
      const acoes = overrides.acoes;
      return { ok: true, json: async () => (Array.isArray(acoes) ? acoes : []) };
    }
    if (u.includes('/desossa/faltas')) {
      return { ok: true, json: async () => [] };
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
        produtoBaseId: produtoId,
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
      produtoBaseId: produtoId,
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

    // ALP-97: chips de características (Mais pesada/Mais gorda/Melhor acabamento)
    // foram removidos da tela de Pesagem e Destinação — não devem mais aparecer.
    const btn = await screen.findByRole('button', { name: 'Capturar Peso' });
    await waitFor(() => expect(btn).not.toBeDisabled());
    fireEvent.click(btn);

    await waitFor(() => expect(screen.getByText('Cancelar ação realizada')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('pref. compatível')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Trocar Peça' })).toBeInTheDocument();
  });

  it('marcar → Estoque/→ Desossa desabilita o radio de Pedidos compatíveis (exclusão mútua)', async () => {
    const pecaPesada = {
      id: 'pc2aaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      recebimentoId,
      produtoBaseId: produtoId,
      pesoOriginal: '12.500',
      modoCapturaPeso: 'automatico',
      statusPeca: 'pesada',
      etiquetaAtual: null,
      pedidoVendaId: null,
      pedidoVendaItemId: null,
    };
    const sugestaoResposta = {
      pecaId: pecaPesada.id,
      sugestao: null,
      compativeis: [{
        pedidoVendaId: 'pv2aaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        pedidoVendaItemId: 'pvi2aaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        produtoId,
        clienteId: 'c2',
        clienteNome: 'Cliente Dois',
        saldoPendente: '3',
        quantidadePedida: '5',
        quantidadeAtendida: '2',
        prioridade: 1,
        rotaPrevista: null,
        score: 1,
        justificativa: 'ok',
        prefCompativel: false,
      }],
    };

    const fetchBase = global.fetch as jest.Mock;
    mockFetch();
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/operacao/pesagem/pecas') && init?.method === 'POST') {
        return { ok: true, json: async () => pecaPesada };
      }
      if (u.includes('/sugestao')) {
        return { ok: true, json: async () => sugestaoResposta };
      }
      return fetchBase(url, init);
    }) as unknown as typeof fetch;

    render(
      <PesagemDestinacaoClient
        permissoes={['PESAGEM_GERENCIAR', 'ASSOCIACAO_GERENCIAR', 'ETIQUETA_GERENCIAR']}
      />,
    );

    const btnCapturar = await screen.findByRole('button', { name: 'Capturar Peso' });
    await waitFor(() => expect(btnCapturar).not.toBeDisabled());
    fireEvent.click(btnCapturar);

    const radio = await screen.findByRole('radio', { name: /Cliente Dois/i });
    await waitFor(() => expect(radio).not.toBeDisabled());
    expect(screen.getByLabelText('40% associado ao pedido')).toBeInTheDocument();

    const btnEstoque = screen.getByTestId('btn-destino-estoque');
    fireEvent.click(btnEstoque);
    await waitFor(() => expect(radio).toBeDisabled());

    fireEvent.click(btnEstoque);
    await waitFor(() => expect(radio).not.toBeDisabled());
  });

  it('preenche Pedidos compatíveis ao carregar o lote sem pesar', async () => {
    mockFetch();
    const fetchBase = global.fetch as jest.Mock;
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/compativeis')) {
        return {
          ok: true,
          json: async () => ({
            pecaId: '',
            sugestao: null,
            compativeis: [{
              pedidoVendaId: 'pv3aaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
              pedidoVendaItemId: 'pvi3aaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
              produtoId,
              clienteId: 'c3',
              clienteNome: 'Cliente Lote',
              saldoPendente: '2',
              quantidadePedida: '2',
              quantidadeAtendida: '0',
              prioridade: 1,
              rotaPrevista: null,
              score: 1,
              justificativa: 'ok',
            }],
          }),
        };
      }
      return fetchBase(url, init);
    }) as unknown as typeof fetch;

    render(<PesagemDestinacaoClient permissoes={['PESAGEM_LER']} />);
    expect(await screen.findByText('Cliente Lote')).toBeInTheDocument();
    expect(screen.getByLabelText('0% associado ao pedido')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Item' })).not.toBeInTheDocument();
  });

  it('busca pelo nome fantasia de pedido concluído mostra Pedido concluído', async () => {
    mockFetch();
    const fetchBase = global.fetch as jest.Mock;
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/compativeis') && !u.includes('incluirCompletos')) {
        return {
          ok: true,
          json: async () => ({
            pecaId: '',
            sugestao: null,
            concluidos: ['VP Carnes'],
            compativeis: [{
              pedidoVendaId: 'pv4aaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
              pedidoVendaItemId: 'pvi4aaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
              produtoId,
              clienteId: 'c4',
              clienteNome: 'Aberto',
              saldoPendente: '1',
              quantidadePedida: '1',
              quantidadeAtendida: '0',
              prioridade: 1,
              rotaPrevista: null,
              score: 1,
              justificativa: 'ok',
            }],
          }),
        };
      }
      return fetchBase(url, init);
    }) as unknown as typeof fetch;

    render(<PesagemDestinacaoClient permissoes={['PESAGEM_LER']} />);
    const busca = await screen.findByPlaceholderText('Buscar cliente');
    await waitFor(() => expect(busca).not.toBeDisabled());

    fireEvent.change(busca, { target: { value: 'vp carnes' } });
    expect(await screen.findByText('Pedido concluído')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum pedido de venda encontrado.')).not.toBeInTheDocument();

    fireEvent.change(busca, { target: { value: 'inexistente' } });
    expect(await screen.findByText('Nenhum pedido de venda encontrado.')).toBeInTheDocument();

    fireEvent.change(busca, { target: { value: 'Aberto' } });
    expect(await screen.findByText('Aberto')).toBeInTheDocument();
    expect(screen.queryByText('Pedido concluído')).not.toBeInTheDocument();
  });

  it('Digitar zera o peso atual e Capturar Peso retoma o modo automático', async () => {
    render(<PesagemDestinacaoClient permissoes={['PESAGEM_GERENCIAR', 'PESO_MANUAL']} />);
    const capturar = await screen.findByRole('button', { name: 'Capturar Peso' });
    await waitFor(() => expect(capturar).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Digitar' }));
    expect(await screen.findByLabelText('Peso manual')).toHaveValue('');
    expect(screen.getByText('0,000')).toBeInTheDocument();

    fireEvent.click(capturar);
    await waitFor(() => expect(screen.queryByLabelText('Peso manual')).not.toBeInTheDocument());
  });

  it('mantém → Desossa somente leitura se o produto não passa pela desossa', async () => {
    const paId = 'i2aaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const pecaPesada = {
      id: 'pc2aaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      recebimentoId,
      produtoBaseId: paId,
      pesoOriginal: '12.500',
      modoCapturaPeso: 'automatico',
      statusPeca: 'pesada',
      etiquetaAtual: null,
      pedidoVendaId: null,
      pedidoVendaItemId: null,
    };
    mockFetch({
      detalhe: {
        ...recebimentoDetalhe,
        itens: [
          {
            ...recebimentoDetalhe.itens[0],
            id: 'ri2aaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            produtoId: paId,
            origemDescricao: 'Ponta de Agulha',
            produto: { id: paId, codigo: 'PA', descricao: 'Ponta de Agulha', passaDesossa: false, podeEstoque: true },
          },
        ],
      },
      '/api/operacao/pesagem/pecas': pecaPesada,
    });

    render(
      <PesagemDestinacaoClient
        permissoes={['PESAGEM_GERENCIAR', 'ASSOCIACAO_GERENCIAR', 'ETIQUETA_GERENCIAR']}
      />,
    );

    const btnCapturar = await screen.findByRole('button', { name: 'Capturar Peso' });
    await waitFor(() => expect(btnCapturar).not.toBeDisabled());
    fireEvent.click(btnCapturar);

    await waitFor(() => expect(screen.getByTestId('btn-destino-estoque')).not.toBeDisabled());
    expect(screen.getByTestId('btn-destino-desossa')).toBeDisabled();
  });

  it('Estoque e Desossa confirmam o destino sem vincular pedido de venda', async () => {
    const pecaPesada = {
      id: 'pc3aaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      recebimentoId,
      produtoBaseId: produtoId,
      pesoOriginal: '12.500',
      modoCapturaPeso: 'automatico',
      statusPeca: 'pesada',
      etiquetaAtual: null,
      pedidoVendaId: null,
      pedidoVendaItemId: null,
    };
    const pecaEstoque = { ...pecaPesada, statusPeca: 'em_sobra' };
    const pecaEtiquetada = { ...pecaEstoque, etiquetaAtual: 'QR-estoque' };
    const pedidoItemId = 'pvi3aaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const posts: { url: string; body: unknown }[] = [];

    mockFetch({
      '/api/operacao/pesagem/pecas': pecaPesada,
      'sem-cobertura': pecaEstoque,
      etiqueta: { peca: pecaEtiquetada },
    });
    const fetchBase = global.fetch as jest.Mock;
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if ((init?.method ?? 'GET') === 'POST') {
        posts.push({ url: u, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      }
      if (u.includes('/sugestao') || u.includes('/compativeis')) {
        return {
          ok: true,
          json: async () => ({
            pecaId: pecaPesada.id,
            sugestao: {
              pedidoVendaId: 'pv3aaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
              pedidoVendaItemId: pedidoItemId,
              produtoId,
              clienteId: 'c3',
              clienteNome: 'Cliente Três',
              saldoPendente: '2',
              prioridade: 1,
              rotaPrevista: null,
              score: 1,
              justificativa: 'ok',
              prefCompativel: true,
            },
            compativeis: [{
              pedidoVendaId: 'pv3aaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
              pedidoVendaItemId: pedidoItemId,
              produtoId,
              clienteId: 'c3',
              clienteNome: 'Cliente Três',
              saldoPendente: '2',
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
        permissoes={['PESAGEM_GERENCIAR', 'ASSOCIACAO_GERENCIAR', 'ETIQUETA_GERENCIAR']}
      />,
    );

    const btnCapturar = await screen.findByRole('button', { name: 'Capturar Peso' });
    await waitFor(() => expect(btnCapturar).not.toBeDisabled());
    fireEvent.click(btnCapturar);

    await waitFor(() => expect(screen.getByTestId('btn-destino-estoque')).not.toBeDisabled());
    expect(screen.getByTestId('btn-destino-desossa')).not.toBeDisabled();
    fireEvent.click(screen.getByTestId('btn-destino-estoque'));

    const busca = screen.getByPlaceholderText('Buscar cliente');
    fireEvent.change(busca, { target: { value: 'Cliente Três' } });

    const confirmar = screen.getByRole('button', { name: /Confirmar e gerar etiqueta/ });
    await waitFor(() => expect(confirmar).not.toBeDisabled());
    fireEvent.click(confirmar);

    await waitFor(() => {
      expect(posts.some((p) => p.url.includes('/sem-cobertura') && (p.body as { destino?: string }).destino === 'sobra')).toBe(true);
    });
    await waitFor(() => expect(screen.getByPlaceholderText('Buscar cliente')).toHaveValue(''));
    expect(posts.some((p) => p.url.includes('/confirmar'))).toBe(false);
    expect(posts.some((p) => p.url.includes('/etiqueta'))).toBe(true);
  });

  it('exibe Pedidos de Venda e só conta peças após Confirmar e gerar etiqueta', async () => {
    mockFetch({
      acoes: [
        {
          id: 'ac-pesada',
          hora: '2026-06-08T10:00:00Z',
          produtoCodigo: 'TZ',
          produtoDescricao: 'Traseiro',
          peso: '12.000',
          destino: 'Aguardando destino',
          clientePedido: null,
          etiqueta: null,
          operadorNome: null,
          statusPeca: 'pesada',
          acao: 'pesada',
        },
        {
          id: 'ac-pedido',
          hora: '2026-06-08T10:01:00Z',
          produtoCodigo: 'TZ',
          produtoDescricao: 'Traseiro',
          peso: '12.500',
          destino: 'Pedido',
          clientePedido: 'Cliente',
          etiqueta: 'QR-1',
          operadorNome: null,
          statusPeca: 'associada',
          acao: 'associada',
        },
        {
          id: 'ac-estoque',
          hora: '2026-06-08T10:02:00Z',
          produtoCodigo: 'TZ',
          produtoDescricao: 'Traseiro',
          peso: '11.800',
          destino: 'Estoque',
          clientePedido: null,
          etiqueta: 'QR-2',
          operadorNome: null,
          statusPeca: 'em_sobra',
          acao: 'em_sobra',
        },
      ],
    });

    render(<PesagemDestinacaoClient permissoes={['PESAGEM_LER', 'PESAGEM_GERENCIAR']} />);

    expect(await screen.findByText('Pedidos de Venda')).toBeInTheDocument();
    expect(screen.queryByText('Pedidos compatíveis')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('contador-produto-TZ')).toHaveTextContent('2'));
  });

  it('Acumulado do lote agrupa unidade e peso por produto só com o código', async () => {
    mockFetch({
      detalhe: {
        ...recebimentoDetalhe,
        itens: [
          {
            ...recebimentoDetalhe.itens[0],
            quantidadeEsperada: '5',
            quantidadeRecebida: '0',
            quantidadeApurada: '7',
            pesoNf: '20.000',
            pesoApurado: '8.000',
            pesoTotalApurado: '8.000',
          },
          {
            id: 'ri2aaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            produtoId: 'i2aaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            origemDescricao: 'Dianteiro',
            quantidadeEsperada: '6',
            quantidadeRecebida: '0',
            quantidadeApurada: '2',
            unidadeEsperada: 'Peça',
            requerBalanca: true,
            pesoNf: null,
            pesoApurado: '11.000',
            pesoTotalApurado: '11.000',
            statusApuracao: 'aguardando',
            observacoes: null,
            produto: { id: 'i2aaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', codigo: 'DT', descricao: 'Dianteiro' },
          },
        ],
      },
    });

    render(<PesagemDestinacaoClient permissoes={['PESAGEM_LER', 'PESAGEM_GERENCIAR']} />);
    expect(await screen.findByRole('tab', { name: /TZ/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ver acumulado do lote/i }));

    const dialog = await screen.findByRole('dialog', { name: 'Acumulado do lote' });
    expect(dialog).toHaveTextContent('TZ');
    expect(dialog).not.toHaveTextContent('TZ — Traseiro');
    expect(screen.getByRole('columnheader', { name: 'Previsto | Pesado | Restante (Unidade)' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Previsto | Pesado | Restante (Peso)' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: 'Previsto' })).toHaveLength(2);
    expect(screen.getAllByRole('columnheader', { name: 'Pesado' })).toHaveLength(2);
    expect(screen.getAllByRole('columnheader', { name: 'Restante' })).toHaveLength(2);

    const linhas = within(dialog).getAllByRole('row');
    const linhaTz = linhas.find((row) => within(row).queryByText('TZ'));
    const linhaDt = linhas.find((row) => within(row).queryByText('DT'));
    if (!linhaTz || !linhaDt) throw new Error('Linhas TZ/DT não encontradas no acumulado');
    expect(within(linhaTz).getAllByRole('cell').map((c) => c.textContent)).toEqual([
      'TZ', '5', '7', '-2', '20,000', '8,000', '12,000',
    ]);
    expect(within(linhaDt).getAllByRole('cell').map((c) => c.textContent)).toEqual([
      'DT', '6', '2', '4', '—', '11,000', '—',
    ]);
  });
});
