import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotasXmlClient } from '../src/app/(admin)/faturamento/notas-xml/notas-xml-client';
import type { NotaFiscalListagem, Paginado } from '../src/lib/faturamento';

jest.mock('@/lib/realtime', () => ({
  conectarRealtime: () => () => undefined,
}));

const notaLiberada: NotaFiscalListagem = {
  id: 'nota-1aaa-bbbb-cccc-dddddddddddd',
  faturamentoId: 'fat-1',
  caminhaoId: 'cam-1aaa-bbbb-cccc-dddddddddddd',
  pedidoVendaId: 'ped-1aaa-bbbb-cccc-dddddddddddd',
  clienteId: 'cli-1',
  numeroNfse: '000451',
  codigoVerificacao: 'ABC123DEF456',
  linkNfse: null,
  statusNfse: 'emitida',
  valor: '1500.00',
  aliquota: '0.0500',
  tentativasEmissao: 1,
  ultimoErroNfse: null,
  emitidaEm: '2026-08-01T09:12:00.000Z',
  canceladaEm: null,
  createdAt: '2026-08-01T09:05:00.000Z',
  clienteNome: 'Restaurante Grill',
  caminhaoLiberado: true,
};

function mockFetch(notas: NotaFiscalListagem[]) {
  global.fetch = jest.fn(async (url: string) => {
    if (String(url).includes('/notas?')) {
      const body: Paginado<NotaFiscalListagem> = { data: notas, total: notas.length, page: 1, pageSize: 20 };
      return { ok: true, json: async () => body };
    }
    if (String(url).includes('/ambiente')) {
      return { ok: true, json: async () => ({ homologacao: true }) };
    }
    return { ok: true, json: async () => ({}) };
  }) as unknown as typeof fetch;
}

describe('NotasXmlClient', () => {
  it('trava visual: cancelar desabilitado quando caminhaoLiberado=true', async () => {
    mockFetch([notaLiberada]);
    render(<NotasXmlClient permissoes={['FATURAMENTO_LER', 'NFSE_CANCELAR']} />);
    expect(await screen.findByTitle('Caminhão já liberado — cancelamento bloqueado')).toBeInTheDocument();
  });

  it('ModalCancelar exige motivo antes de confirmar', async () => {
    mockFetch([{ ...notaLiberada, caminhaoLiberado: false }]);
    render(<NotasXmlClient permissoes={['FATURAMENTO_LER', 'NFSE_CANCELAR']} />);
    const botaoCancelar = await screen.findByTitle('Cancelar nota');
    await userEvent.click(botaoCancelar);
    expect(screen.getByRole('button', { name: /confirmar cancelamento/i })).toBeDisabled();
  });
});
