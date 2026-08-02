import { render, screen, waitFor } from '@testing-library/react';
import { ConferenciaExpedicaoClient } from '../src/app/(admin)/carga/conferencia/conferencia-client';
import { ROTULO_STATUS_CARGA } from '../src/lib/expedicao-ui';
import type { StatusCaminhao } from '../src/lib/operacao';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
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

const caminhaoBase = {
  id: 'c1aaaaaabbbbccccddddeeeeffff0001',
  placa: 'ABC-1234',
  motorista: 'João Silva',
  rota: 'Rota Norte',
  dataOperacao: '2026-06-08',
  frotaCaminhaoId: null,
  capacidadeKg: null,
  statusCaminhao: 'em_conferencia' as const,
  horaAberturaCarga: null,
  horaFechamentoCarga: null,
  observacoes: null,
  createdAt: '2026-06-08T08:00:00.000Z',
};

function mockFetch(overrides: Record<string, unknown> = {}) {
  global.fetch = jest.fn(async (url: string) => {
    const urlStr = String(url);
    const found = Object.entries(overrides)
      .sort(([a], [b]) => b.length - a.length)
      .find(([k]) => urlStr.includes(k));
    if (found) return { ok: true, json: async () => found[1] };
    if (urlStr.includes('/caminhoes') && urlStr.includes('dataOperacao')) {
      return { ok: true, json: async () => [] };
    }
    if (urlStr.includes('/romaneio')) {
      return { ok: true, json: async () => ({ caminhao: caminhaoBase, pedidos: [] }) };
    }
    return { ok: true, json: async () => ({}) };
  }) as unknown as typeof fetch;
}

describe('ConferenciaExpedicaoClient', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    (global as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
    mockFetch();
  });

  it('renderiza título Conferência de Carga', async () => {
    render(<ConferenciaExpedicaoClient permissoes={[]} />);
    expect(screen.getByText('Conferência de Carga')).toBeInTheDocument();
  });

  it('DoD 9.12 mapa de rótulos cobre todos os status', () => {
    const status: StatusCaminhao[] = [
      'planejado', 'aguardando_carga', 'em_carga', 'em_conferencia',
      'fechado', 'liberado_faturamento', 'faturado', 'liberado_saida', 'expedido',
    ];
    expect(Object.keys(ROTULO_STATUS_CARGA).sort()).toEqual([...status].sort());
    for (const s of status) {
      expect(typeof ROTULO_STATUS_CARGA[s]).toBe('string');
      expect(ROTULO_STATUS_CARGA[s].length).toBeGreaterThan(0);
    }
  });

  it('Finalizar Conferência desabilitado com peças pendentes', async () => {
    mockFetch({
      '/caminhoes/c1aaaaaabbbbccccddddeeeeffff0001/romaneio': {
        caminhao: caminhaoBase,
        pedidos: [
          {
            pedidoVendaId: 'ped-1',
            clienteId: 'cli-1',
            ordemNaCarga: 1,
            previsto: 1,
            carregado: 0,
            itens: [
              {
                cargaItemId: 'item-1',
                pedidoVendaId: 'ped-1',
                statusCargaItem: 'em_carga',
                divergenciaMotivo: null,
                etiqueta: 'ETQ-001',
                produtoNome: 'TZ',
                peso: '49.5',
              },
            ],
          },
        ],
      },
      '/caminhoes?dataOperacao': [caminhaoBase],
    });
    render(<ConferenciaExpedicaoClient permissoes={['EXPEDICAO_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByText('Finalizar Conferência')).toBeInTheDocument());
    expect(screen.getByText('Finalizar Conferência').closest('button')).toBeDisabled();
  });

  it('Finalizar Conferência habilitado com 0 pendentes', async () => {
    mockFetch({
      '/caminhoes/c1aaaaaabbbbccccddddeeeeffff0001/romaneio': {
        caminhao: caminhaoBase,
        pedidos: [
          {
            pedidoVendaId: 'ped-1',
            clienteId: 'cli-1',
            ordemNaCarga: 1,
            previsto: 1,
            carregado: 1,
            itens: [
              {
                cargaItemId: 'item-1',
                pedidoVendaId: 'ped-1',
                statusCargaItem: 'conferido',
                divergenciaMotivo: null,
                etiqueta: 'ETQ-001',
                produtoNome: 'TZ',
                peso: '49.5',
              },
            ],
          },
        ],
      },
      '/caminhoes?dataOperacao': [caminhaoBase],
    });
    render(<ConferenciaExpedicaoClient permissoes={['EXPEDICAO_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByText('Finalizar Conferência')).toBeInTheDocument());
    expect(screen.getByText('Finalizar Conferência').closest('button')).not.toBeDisabled();
  });

  it('ModalDivergencia exige motivo antes de confirmar', async () => {
    mockFetch({
      '/caminhoes/c1aaaaaabbbbccccddddeeeeffff0001/romaneio': {
        caminhao: caminhaoBase,
        pedidos: [
          {
            pedidoVendaId: 'ped-1',
            clienteId: 'cli-1',
            ordemNaCarga: 1,
            previsto: 1,
            carregado: 0,
            itens: [
              {
                cargaItemId: 'item-1',
                pedidoVendaId: 'ped-1',
                statusCargaItem: 'em_carga',
                divergenciaMotivo: null,
                etiqueta: 'ETQ-001',
                produtoNome: 'TZ',
                peso: '49.5',
              },
            ],
          },
        ],
      },
      '/caminhoes?dataOperacao': [caminhaoBase],
    });
    render(<ConferenciaExpedicaoClient permissoes={['EXPEDICAO_GERENCIAR']} />);
    const botaoDivergencia = await screen.findByText('Marcar divergência');
    botaoDivergencia.click();
    const botaoConfirmar = await screen.findByText('Confirmar Divergência');
    expect(botaoConfirmar.closest('button')).toBeDisabled();
  });

  it('card da lista-master mostra contador conferidas/total peças', async () => {
    mockFetch({
      '/caminhoes/c1aaaaaabbbbccccddddeeeeffff0001/romaneio': {
        caminhao: caminhaoBase,
        pedidos: [
          {
            pedidoVendaId: 'ped-1',
            clienteId: 'cli-1',
            ordemNaCarga: 1,
            previsto: 2,
            carregado: 1,
            itens: [
              {
                cargaItemId: 'item-1',
                pedidoVendaId: 'ped-1',
                statusCargaItem: 'conferido',
                divergenciaMotivo: null,
                etiqueta: 'ETQ-001',
                produtoNome: 'TZ',
                peso: '49.5',
              },
              {
                cargaItemId: 'item-2',
                pedidoVendaId: 'ped-1',
                statusCargaItem: 'em_carga',
                divergenciaMotivo: null,
                etiqueta: 'ETQ-002',
                produtoNome: 'DT',
                peso: '20.0',
              },
            ],
          },
        ],
      },
      '/caminhoes?dataOperacao': [caminhaoBase],
    });
    render(<ConferenciaExpedicaoClient permissoes={['EXPEDICAO_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByText('1 / 2 peças')).toBeInTheDocument());
  });
});
