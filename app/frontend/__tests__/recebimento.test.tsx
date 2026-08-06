import { render, screen, waitFor, act, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecebimentoCargaClient } from '../src/app/(admin)/recebimento/recebimento-carga/recebimento-carga-client';

const pushMock = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];
  readyState = 1;
  constructor(public url: string) {
    MockWebSocket.instances.push(this);
    setTimeout(() => this.onopen?.(), 0);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.onclose?.();
  }
}

const PERMISSOES = ['RECEBIMENTO_LER', 'RECEBIMENTO_GERENCIAR'];

const recebimentoLista = {
  id: 'r1',
  codigoLote: 'R1ABCDEF',
  compraProgramadaId: 'c1',
  numeroInternoCompra: 'PC-2091',
  fornecedorId: 'f1',
  fornecedorNome: 'Frigorífico Boi Forte',
  dataOperacao: '2026-06-07',
  status: 'pesagem_em_andamento',
  nfeNumero: '128934',
  romaneio: 'ROM-7781',
  tipoCarga: 'Boi',
  progressoBalanca: 58,
};

const recebimentoDetalhe = {
  id: 'r1',
  codigoLote: 'R1ABCDEF',
  compraProgramadaId: 'c1',
  pedidoFornecedorId: 'pf1',
  fornecedorId: 'f1',
  dataOperacao: '2026-06-07',
  status: 'aguardando_conferencia_final' as const,
  tipoCarga: 'Boi',
  progressoBalanca: 58,
  nfeNumero: '128934',
  nfeSerie: null,
  nfeChave: null,
  nfeDataEmissao: null,
  romaneio: 'ROM-7781',
  nfePesoBruto: null,
  nfePesoLiquido: null,
  nfeVolumes: null as number | null,
  notaFiscalFornecedor: '128934',
  placaVeiculo: null,
  motorista: null,
  doca: null,
  dataHoraChegada: null,
  observacoes: null,
  fornecedor: { id: 'f1', razaoSocial: 'Frigorífico Boi Forte' },
  compra: { id: 'c1', numeroInterno: 'PC-2091' },
  itens: [
    {
      id: 'it1',
      itemComercialId: 'item-1',
      origemDescricao: 'PC-2091 / Regra Boi → DT/PA/TZ',
      quantidadeEsperada: '20.000',
      quantidadeRecebida: '12.000',
      quantidadeApurada: '12',
      unidadeEsperada: 'peças',
      requerBalanca: true,
      pesoTotalApurado: '586.400',
      pesoApurado: '586.400',
      statusApuracao: 'em_conferencia' as const,
      observacoes: null,
      itemComercial: { id: 'item-1', codigo: 'TZ', descricao: 'Traseiro' },
    },
    {
      id: 'it2',
      itemComercialId: 'item-2',
      origemDescricao: 'Caixa de Rabo',
      quantidadeEsperada: '12.000',
      quantidadeRecebida: '12.000',
      quantidadeApurada: '12',
      unidadeEsperada: 'caixas',
      requerBalanca: false,
      pesoTotalApurado: null,
      pesoApurado: null,
      statusApuracao: 'entrada_direta' as const,
      observacoes: null,
      itemComercial: { id: 'item-2', codigo: 'CR', descricao: 'Caixa de Rabo' },
    },
  ],
  divergencias: [],
};

const quadroMock = [{
  recebimentoItemId: 'it1',
  itemComercialId: 'item-1',
  previstoNoPedido: true,
  qtdPedido: '20',
  qtdNf: '20',
  qtdApurada: '12',
  pesoNf: '990',
  pesoApurado: '586.4',
  situacao: 'divergente' as const,
}];

function mockFetchRecebimento(overrides?: { nfeVolumes?: number | null; status?: string }) {
  const detalhe = {
    ...recebimentoDetalhe,
    ...(overrides?.nfeVolumes !== undefined ? { nfeVolumes: overrides.nfeVolumes } : {}),
    ...(overrides?.status ? { status: overrides.status } : {}),
  };
  global.fetch = jest.fn(async (url: string) => {
    if (typeof url === 'string' && url.includes('/api/operacao/recebimentos?pageSize')) {
      return {
        ok: true,
        json: async () => ({
          data: [{ ...recebimentoLista, status: detalhe.status }],
          page: 1,
          pageSize: 50,
          total: 1,
        }),
      };
    }
    if (typeof url === 'string' && url.includes('/conferencia') && !url.includes('concluir')) {
      return { ok: true, json: async () => quadroMock };
    }
    if (typeof url === 'string' && url.includes('/api/operacao/recebimentos/r1')) {
      return { ok: true, json: async () => detalhe };
    }
    if (typeof url === 'string' && url.includes('/api/comercial/compras-programadas')) {
      return { ok: true, json: async () => ({ data: [] }) };
    }
    if (typeof url === 'string' && url.includes('/api/cadastros/fornecedores')) {
      return { ok: true, json: async () => ({ data: [] }) };
    }
    return { ok: true, json: async () => ({ data: [] }) };
  }) as unknown as typeof fetch;
}

describe('RecebimentoCargaClient', () => {
  beforeEach(() => {
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.setPointerCapture ??= () => undefined;
    Element.prototype.releasePointerCapture ??= () => undefined;
    Element.prototype.scrollIntoView ??= () => undefined;
    MockWebSocket.instances = [];
    (global as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
    mockFetchRecebimento();
    pushMock.mockReset();
  });

  it('renderiza o título e lista enriquecida (smoke)', async () => {
    render(<RecebimentoCargaClient permissoes={PERMISSOES} />);
    expect(screen.getByText('Recebimento de carga')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('PC-2091')).toBeInTheDocument());
    expect(screen.getByText('Frigorífico Boi Forte')).toBeInTheDocument();
    expect(screen.getByText('128934')).toBeInTheDocument();
  });

  it('abre detalhe readonly ao clicar Abrir', async () => {
    render(<RecebimentoCargaClient permissoes={PERMISSOES} />);
    await waitFor(() => expect(screen.getByText('Abrir')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Abrir'));

    await waitFor(() => expect(screen.getByTestId('receb-status')).toHaveTextContent('Aguardando conferência final'));
    expect(screen.getByTestId('item-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('btn-concluir')).toBeInTheDocument();
    expect(screen.getByText('Itens previstos importados')).toBeInTheDocument();
  });

  it('exibe status Aguardando conferência final na lista', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (typeof url === 'string' && url.includes('/api/operacao/recebimentos?pageSize')) {
        return {
          ok: true,
          json: async () => ({
            data: [{ ...recebimentoLista, status: 'aguardando_conferencia_final' }],
            page: 1,
            pageSize: 50,
            total: 1,
          }),
        };
      }
      return { ok: true, json: async () => ({ data: [] }) };
    }) as unknown as typeof fetch;

    render(<RecebimentoCargaClient permissoes={PERMISSOES} />);
    await waitFor(() => expect(screen.getByText('Aguardando conferência final')).toBeInTheDocument());
  });

  it('recarrega ao receber evento recebimento_registrado via WS', async () => {
    render(<RecebimentoCargaClient permissoes={PERMISSOES} />);
    await waitFor(() => expect(screen.getByText('Abrir')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Abrir'));
    await waitFor(() => expect(screen.getByTestId('item-item-1')).toBeInTheDocument());

    const fetchSpy = global.fetch as jest.Mock;
    const chamadasAntes = fetchSpy.mock.calls.length;
    const ws = MockWebSocket.instances[0];
    if (!ws) throw new Error('WebSocket não instanciado');

    act(() => {
      ws.onmessage?.({ data: JSON.stringify({ type: 'recebimento_registrado', payload: { recebimentoId: 'r1' } }) });
    });

    await waitFor(() => expect(fetchSpy.mock.calls.length).toBeGreaterThan(chamadasAntes));
  });

  it('novo recebimento seleciona Pedido ao Fornecedor e envia seu id sem fallback', async () => {
    const user = userEvent.setup();
    const pedido = {
      id: 'pf-1',
      numero: 'PF-0001',
      status: 'aguardando_recebimento',
      fornecedorId: 'f1',
      fornecedorNome: 'Frigorífico Boi Forte',
      operacaoId: 'op1',
      dataOperacao: '2026-07-29',
      compraProgramadaId: 'c1',
      numeroInternoCompra: 'PC-2091',
    };
    const previsao = {
      pedidoFornecedorId: pedido.id,
      numeroPedidoFornecedor: pedido.numero,
      statusPedidoFornecedor: pedido.status,
      operacaoId: pedido.operacaoId,
      dataOperacao: pedido.dataOperacao,
      compraProgramadaId: pedido.compraProgramadaId,
      numeroInternoCompra: pedido.numeroInternoCompra,
      fornecedorId: pedido.fornecedorId,
      fornecedorNome: pedido.fornecedorNome,
      tipoCarga: 'Boi',
      observacoesCompra: null,
      resumoCompra: '10.000 Boi',
      itensOperacionais: [{
        itemComercialId: 'item-1',
        produtoCodigo: 'TZ',
        produtoDescricao: 'Traseiro',
        quantidadePrevista: '20.000',
        pesoPrevisto: '850.000',
        unidade: 'peca',
        passaBalanca: true,
        origemDescricao: 'PC-2091 / Regra Boi → TZ',
      }],
    };
    let responderErro = false;
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/operacao/recebimentos?pageSize')) {
        return { ok: true, json: async () => ({ data: [], page: 1, pageSize: 50, total: 0 }) };
      }
      if (url.includes('/api/operacao/pedidos-fornecedor?')) {
        return { ok: true, json: async () => ({ data: [pedido], page: 1, pageSize: 100, total: 1 }) };
      }
      if (url.includes(`/api/operacao/recebimentos/previsao/${pedido.id}`)) {
        return { ok: true, json: async () => previsao };
      }
      if (url === '/api/operacao/recebimentos' && init?.method === 'POST') {
        if (responderErro) {
          return { ok: false, status: 400, json: async () => ({ message: 'sentinela D34' }) };
        }
        return {
          ok: true,
          status: 201,
          json: async () => ({ recebimento: { id: 'r-novo' }, jaIniciado: false }),
        };
      }
      if (url.includes('/api/operacao/recebimentos/r-novo')) {
        return { ok: true, json: async () => ({ ...recebimentoDetalhe, id: 'r-novo' }) };
      }
      return { ok: true, json: async () => ({ data: [] }) };
    }) as unknown as typeof fetch;

    render(<RecebimentoCargaClient permissoes={PERMISSOES} />);
    fireEvent.click(screen.getByRole('button', { name: 'Novo recebimento' }));
    const drawer = screen.getByRole('dialog', { name: 'Novo Recebimento de Carga' });
    expect(within(drawer).queryByRole('heading', { name: 'Novo recebimento' })).not.toBeInTheDocument();
    const nomesDosBlocos = [
      'A — Pedido ao Fornecedor',
      'B — Nota Fiscal recebida',
      'C — Transporte',
      'D — Observações internas',
    ];
    const cabecalhos = nomesDosBlocos.map((nome) => within(drawer).getByText(nome));
    expect(cabecalhos.map((cabecalho) => cabecalho.textContent)).toEqual(nomesDosBlocos);
    for (const nomeAntigo of [
      '1. Pedido de Compra',
      '2. Dados da NF / Romaneio',
      '3. Veículo e doca',
      '4. Resumo e criação do lote',
    ]) {
      expect(within(drawer).queryByRole('heading', { name: nomeAntigo })).not.toBeInTheDocument();
    }
    const [blocoA, blocoB, blocoC, blocoD] = cabecalhos.map((cabecalho) => {
      const section = cabecalho.closest('section');
      if (!section) throw new Error(`Bloco sem section: ${cabecalho.textContent}`);
      return section;
    });
    const pedidoCombobox = within(blocoA!).getByRole('combobox', { name: 'Pedido ao fornecedor' });
    expect(within(blocoA!).getByLabelText('Doca / área')).toBeInTheDocument();
    expect(within(blocoB!).getByLabelText(/Número da NF-e/)).toBeInTheDocument();
    expect(within(blocoC!).getByLabelText('Placa')).toBeInTheDocument();
    expect(within(blocoC!).getByLabelText('Motorista')).toBeInTheDocument();
    expect(within(blocoD!).getByLabelText('Observações internas')).toBeInTheDocument();

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      '/api/operacao/pedidos-fornecedor?elegiveisRecebimento=true&pagina=1&limite=100',
      { cache: 'no-store' },
    ));
    await user.click(pedidoCombobox);
    await user.click(await screen.findByRole('option', { name: /PF-0001/ }));
    await waitFor(() => expect(screen.getByText('TZ — Traseiro')).toBeInTheDocument());
    fireEvent.change(within(blocoB!).getByLabelText(/Número da NF-e/), {
      target: { value: 'NF-123' },
    });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Criar Lote' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      '/api/operacao/recebimentos',
      expect.objectContaining({ method: 'POST' }),
    ));
    const post = (global.fetch as jest.Mock).mock.calls.find(
      ([url, init]) => url === '/api/operacao/recebimentos' && init?.method === 'POST',
    );
    const body = JSON.parse(post[1].body);
    expect(body).toEqual(expect.objectContaining({ pedidoFornecedorId: pedido.id }));
    expect(body).not.toHaveProperty('compraProgramadaId');
    expect(body).not.toHaveProperty('iniciarConferencia');
    await waitFor(() => expect(screen.queryByRole('dialog', {
      name: 'Novo Recebimento de Carga',
    })).not.toBeInTheDocument());

    responderErro = true;
    fireEvent.click(screen.getByRole('button', { name: 'Novo recebimento' }));
    const segundoDrawer = screen.getByRole('dialog', { name: 'Novo Recebimento de Carga' });
    const segundoCombobox = within(segundoDrawer).getByRole('combobox', { name: 'Pedido ao fornecedor' });
    await user.click(segundoCombobox);
    await user.click(await screen.findByRole('option', { name: /PF-0001/ }));
    fireEvent.change(within(segundoDrawer).getByLabelText(/Número da NF-e/), {
      target: { value: 'NF-ERRO' },
    });
    fireEvent.click(within(segundoDrawer).getByRole('button', { name: 'Criar Lote' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('sentinela D34'));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('Recebimento de Carga renderiza os blocos do protótipo', async () => {
    const { STATUS_RECEB_LABEL } = await import(
      '../src/app/(admin)/recebimento/recebimento-carga/recebimento-carga-client'
    );
    const seteStatus = new Set(Object.values(STATUS_RECEB_LABEL));
    expect(seteStatus.size).toBe(7);
    expect([...seteStatus]).toEqual(expect.arrayContaining([
      'Pesagem em andamento',
      'Aguardando conferência final',
      'Conferido sem divergência',
      'Conferido com divergência',
      'Ocorrência administrativa aberta',
      'Tratativa concluída',
      'Cancelado',
    ]));

    mockFetchRecebimento();
    // progresso 0 libera Cancelar lote (DoD 6.26)
    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/api/operacao/recebimentos?pageSize')) {
        return {
          ok: true,
          json: async () => ({
            data: [{ ...recebimentoLista, status: 'aguardando_conferencia_final', progressoBalanca: 0 }],
            page: 1, pageSize: 50, total: 1,
          }),
        };
      }
      if (typeof url === 'string' && url.includes('/conferencia') && !url.includes('concluir')) {
        return { ok: true, json: async () => quadroMock };
      }
      if (typeof url === 'string' && url.includes('/api/operacao/recebimentos/r1')) {
        return {
          ok: true,
          json: async () => ({ ...recebimentoDetalhe, progressoBalanca: 0 }),
        };
      }
      return { ok: true, json: async () => ({ data: [] }) };
    });

    render(<RecebimentoCargaClient permissoes={PERMISSOES} />);
    await waitFor(() => expect(screen.getByText('Abrir')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Abrir'));
    await waitFor(() => expect(screen.getByText('Quadro comparativo — Pedido × NF × Pesagem')).toBeInTheDocument());
    expect(screen.getByTestId('btn-concluir')).toBeInTheDocument();
    expect(screen.getByTestId('btn-capturar-itens-nf')).toBeInTheDocument();
    expect(screen.getByText('Cancelar lote')).toBeInTheDocument();
    expect(screen.getByText('Entrada direta')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Novo recebimento' }));
    expect(screen.getByRole('dialog', { name: 'Novo Recebimento de Carga' })).toBeInTheDocument();
  });

  it('detalhe do lote renderiza nfeVolumes number e trata null', async () => {
    mockFetchRecebimento({ nfeVolumes: 12 });
    render(<RecebimentoCargaClient permissoes={PERMISSOES} />);
    await waitFor(() => expect(screen.getByText('Abrir')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Abrir'));
    await waitFor(() => expect(screen.getByText('Volumes NF')).toBeInTheDocument());
    const volumesLabel = screen.getByText('Volumes NF');
    expect(volumesLabel.parentElement).toHaveTextContent('12');

    fireEvent.click(screen.getByText('← Voltar à lista'));
    mockFetchRecebimento({ nfeVolumes: null });
    fireEvent.click(await screen.findByText('Abrir'));
    await waitFor(() => expect(screen.getByText('Volumes NF')).toBeInTheDocument());
    expect(screen.getByText('Volumes NF').parentElement).toHaveTextContent('—');
  });
});
