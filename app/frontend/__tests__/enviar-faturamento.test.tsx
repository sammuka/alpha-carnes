import { render, screen, waitFor } from '@testing-library/react';
import { EnviarFaturamentoClient } from '../src/app/(admin)/carga/enviar-faturamento/enviar-faturamento-client';

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

const cargaConferencia = {
  id: 'carga1-aaaa-bbbb-cccc-dddddddddddd',
  placa: 'ABC-1234',
  motorista: 'Carlos Silva',
  rota: 'Rota Sul',
  statusCaminhao: 'em_conferencia' as const,
  pedidos: [{ pedidoVendaId: 'ped-1', clienteNome: 'Cliente A', pecas: [{ etiqueta: 'ETQ-1', produtoNome: 'TZ', peso: '49.500', loteOrigem: 'Lote 001' }] }],
  totalClientes: 1,
  totalPecas: 1,
  pesoTotal: '49.500',
  envio: null,
};

const cargaFechada = {
  ...cargaConferencia,
  id: 'carga2-aaaa-bbbb-cccc-dddddddddddd',
  statusCaminhao: 'fechado' as const,
};

const cargaEnviada = {
  ...cargaConferencia,
  id: 'carga3-aaaa-bbbb-cccc-dddddddddddd',
  statusCaminhao: 'liberado_faturamento' as const,
  envio: { dataHora: '2026-06-08T14:20:00.000Z', responsavelNome: null },
};

function mockFetch(lista: unknown[]) {
  global.fetch = jest.fn(async (url: string) => {
    if (String(url).includes('/envio-faturamento')) {
      return { ok: true, json: async () => lista };
    }
    return { ok: true, json: async () => ({}) };
  }) as unknown as typeof fetch;
}

describe('EnviarFaturamentoClient', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    (global as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
  });

  it('botão Enviar para Faturamento desabilitado fora de Conferida, com title explicativo', async () => {
    mockFetch([cargaConferencia]);
    render(<EnviarFaturamentoClient permissoes={['EXPEDICAO_GERENCIAR']} />);
    const botao = await screen.findByRole('button', { name: 'Enviar para Faturamento' });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAttribute('title', 'Somente cargas com status Conferida podem ser enviadas ao faturamento.');
  });

  it('botão habilitado quando carga está Conferida (fechado)', async () => {
    mockFetch([cargaFechada]);
    render(<EnviarFaturamentoClient permissoes={['EXPEDICAO_GERENCIAR']} />);
    const botao = await screen.findByRole('button', { name: 'Enviar para Faturamento' });
    expect(botao).not.toBeDisabled();
  });

  it('chips de filtro filtram a lista por status', async () => {
    mockFetch([cargaConferencia, cargaFechada]);
    render(<EnviarFaturamentoClient permissoes={['EXPEDICAO_GERENCIAR']} />);
    await waitFor(() => expect(screen.getAllByText(/Carga #/).length).toBeGreaterThan(0));
    const chipConferida = screen.getByRole('button', { name: 'Conferida' });
    chipConferida.click();
    await waitFor(() => {
      const cards = screen.getAllByRole('button', { name: /Carga #/ });
      expect(cards).toHaveLength(1);
    });
  });

  it('exibe Lote 001 sob cada peça da carga', async () => {
    mockFetch([cargaFechada]);
    render(<EnviarFaturamentoClient permissoes={['EXPEDICAO_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByText('Lote 001')).toBeInTheDocument());
  });

  it('histórico renderiza — quando não há responsável', async () => {
    mockFetch([cargaEnviada]);
    render(<EnviarFaturamentoClient permissoes={['EXPEDICAO_GERENCIAR']} />);
    await waitFor(() => expect(screen.queryByText('Nenhum envio registrado ainda.')).not.toBeInTheDocument());
    const linhas = screen.getAllByText('—');
    expect(linhas.length).toBeGreaterThan(0);
  });
});
