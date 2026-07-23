import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { RecebimentoCargaClient } from '../src/app/(admin)/recebimento/recebimento-carga/recebimento-carga-client';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
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
  status: 'em_conferencia',
  nfeNumero: '128934',
  romaneio: 'ROM-7781',
  tipoCarga: 'Boi',
  progressoBalanca: 58,
};

const recebimentoDetalhe = {
  id: 'r1',
  codigoLote: 'R1ABCDEF',
  compraProgramadaId: 'c1',
  fornecedorId: 'f1',
  dataOperacao: '2026-06-07',
  status: 'em_conferencia',
  tipoCarga: 'Boi',
  progressoBalanca: 58,
  nfeNumero: '128934',
  nfeSerie: null,
  nfeChave: null,
  nfeDataEmissao: null,
  romaneio: 'ROM-7781',
  nfePesoBruto: null,
  nfePesoLiquido: null,
  nfeVolumes: null,
  notaFiscalFornecedor: '128934',
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
      statusApuracao: 'em_conferencia',
      observacoes: null,
      itemComercial: { id: 'item-1', codigo: 'TZ', descricao: 'Traseiro' },
    },
  ],
  divergencias: [],
};

function mockFetchRecebimento() {
  global.fetch = jest.fn(async (url: string) => {
    if (typeof url === 'string' && url.includes('/api/operacao/recebimentos?pageSize')) {
      return { ok: true, json: async () => ({ data: [recebimentoLista], page: 1, pageSize: 50, total: 1 }) };
    }
    if (typeof url === 'string' && url.includes('/api/operacao/recebimentos/r1')) {
      return { ok: true, json: async () => recebimentoDetalhe };
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
    MockWebSocket.instances = [];
    (global as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
    mockFetchRecebimento();
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

    await waitFor(() => expect(screen.getByTestId('receb-status')).toHaveTextContent('Em conferência'));
    expect(screen.getByTestId('item-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('btn-concluir')).toBeInTheDocument();
    expect(screen.getByText('Itens previstos importados')).toBeInTheDocument();
  });

  it('exibe status Aguardando conferência na lista', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (typeof url === 'string' && url.includes('/api/operacao/recebimentos?pageSize')) {
        return {
          ok: true,
          json: async () => ({
            data: [{ ...recebimentoLista, status: 'aguardando_conferencia' }],
            page: 1,
            pageSize: 50,
            total: 1,
          }),
        };
      }
      return { ok: true, json: async () => ({ data: [] }) };
    }) as unknown as typeof fetch;

    render(<RecebimentoCargaClient permissoes={PERMISSOES} />);
    await waitFor(() => expect(screen.getByText('Aguardando conferência')).toBeInTheDocument());
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
});
