import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import {
  EtiquetasRecebimentoClient,
  rotuloEtiqueta,
  cancelavel,
  reimprimivel,
  tituloSecaoDestino,
  rotuloStatusDesossa,
} from '../src/app/(admin)/recebimento/etiquetas/etiquetas-client';
import type { EtiquetaListada } from '../src/lib/operacao';

const base: EtiquetaListada = {
  id: 'e1aaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  pecaId: 'p1aaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  codigo: 'ETQ-1',
  estado: 'ativa',
  statusImpressao: 'impressa',
  reimpressao: false,
  motivoCancelamento: null,
  invalidadaEm: null,
  bloqueada: false,
  pesoOriginal: '48.750',
  statusPeca: 'associada',
  recebimentoId: 'r1aaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  pedidoVendaId: 'pv1aaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  operadorId: 'u1',
  operadorNome: 'Richard',
  createdAt: '2026-07-31T12:00:00.000Z',
  produtoCodigo: 'TZ',
  produtoDescricao: 'Traseiro',
  caracteristicas: ['Mais pesada'],
  nfNumero: '128934',
  frigorifico: 'Boi Forte',
  romaneio: 'ROM-1',
  placaVeiculo: 'ABC1D23',
  motorista: 'João',
  clienteNome: 'Restaurante Grill',
  representanteNome: 'Ana',
  rotaPrevista: 'Zona Sul',
  localEstoquePrevisto: null,
  historico: [],
};

describe('helpers de etiqueta (6.29 / 6.45)', () => {
  it('mapeia os 5 rótulos do protótipo', () => {
    expect(rotuloEtiqueta({ ...base, estado: 'emitida' })).toBe('Pendente de impressão');
    expect(rotuloEtiqueta({ ...base, estado: 'ativa' })).toBe('Ativa');
    expect(rotuloEtiqueta({ ...base, estado: 'reimpressa' })).toBe('Reimpressa');
    expect(rotuloEtiqueta({ ...base, bloqueada: true })).toBe('Bloqueada');
    expect(rotuloEtiqueta({ ...base, estado: 'cancelada' })).toBe('Cancelada');
    expect(rotuloEtiqueta({ ...base, estado: 'invalidada_por_troca' })).toBe('Cancelada');
  });

  it('aplica cancelavel e reimprimivel', () => {
    expect(cancelavel(base)).toBe(true);
    expect(reimprimivel(base)).toBe(true);
    expect(cancelavel({ ...base, bloqueada: true })).toBe(false);
    expect(reimprimivel({ ...base, estado: 'cancelada' })).toBe(false);
  });

  it('tituloSecaoDestino e rotuloStatusDesossa', () => {
    expect(tituloSecaoDestino(base)).toBe('Pedido vinculado');
    expect(tituloSecaoDestino({ ...base, pedidoVendaId: null, statusPeca: 'em_sobra' })).toBe('Estoque');
    expect(tituloSecaoDestino({ ...base, pedidoVendaId: null, statusPeca: 'para_corte' })).toBe('Desossa');
    expect(rotuloStatusDesossa('para_corte').texto).toBe('Aguardando desossa');
    expect(rotuloStatusDesossa('transformada').texto).toBe('Consumida por transformação');
  });
});

describe('EtiquetasRecebimentoClient', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/operacao/recebimentos?')) {
        return {
          ok: true,
          json: async () => ({
            data: [{ id: base.recebimentoId, dataOperacao: '2026-07-31', codigoLote: 'R1ABCDEF' }],
            page: 1,
            pageSize: 30,
            total: 1,
          }),
        };
      }
      if (u.includes('/api/operacao/etiquetas') && !u.includes('cancelar')) {
        return { ok: true, json: async () => ({ data: [base], total: 1, page: 1, pageSize: 100 }) };
      }
      if (u.includes('/etiqueta/reimprimir') && init?.method === 'POST') {
        return { ok: true, json: async () => ({ ...base, estado: 'reimpressa' }) };
      }
      return { ok: true, json: async () => ({}) };
    }) as unknown as typeof fetch;
  });

  it('renderiza os blocos do protótipo', async () => {
    render(
      <EtiquetasRecebimentoClient permissoes={['ETIQUETA_GERENCIAR', 'PESAGEM_LER']} />,
    );
    await waitFor(() => expect(screen.getByText('Etiquetas — recebimento')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Ativa')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Ver etiqueta' }));
    await waitFor(() => expect(screen.getByText('Preview da etiqueta')).toBeInTheDocument());
    expect(screen.getByText('Pedido vinculado')).toBeInTheDocument();
    expect(screen.getByText(/Restaurante Grill/)).toBeInTheDocument();
    expect(screen.getByText(/TZ\s*·\s*Traseiro/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar etiqueta' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reimprimir' }));
    await waitFor(() => expect(screen.getByText(/Confirma reimpressão/i)).toBeInTheDocument());
    fireEvent.click(screen.getByText('Confirmar'));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/etiqueta/reimprimir'),
      expect.objectContaining({ method: 'POST' }),
    ));
  });
});
