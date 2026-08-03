import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SeguroManualClient } from '../src/app/(admin)/faturamento/seguro-manual/seguro-manual-client';
import type { Paginado, SeguroCargaComCaminhao } from '../src/lib/faturamento';

jest.mock('@/lib/realtime', () => ({
  conectarRealtime: () => () => undefined,
}));

const seguroPendente: SeguroCargaComCaminhao = {
  id: 'seg-1aaa-bbbb-cccc-dddddddddddd',
  caminhaoId: 'cam-1aaa-bbbb-cccc-dddddddddddd',
  valorCarga: '5120.40',
  status: 'pendente',
  responsavelId: null,
  enviadoEm: null,
  confirmadoEm: null,
  observacao: '',
  anexosJson: [],
  createdAt: '2026-08-01T09:00:00.000Z',
  caminhao: { id: 'cam-1aaa-bbbb-cccc-dddddddddddd', placa: 'GHI-4455', motorista: 'Marcos Lima', statusCaminhao: 'fechado' },
};

function mockFetch(seguros: SeguroCargaComCaminhao[]) {
  global.fetch = jest.fn(async (url: string) => {
    if (String(url).includes('/seguros?')) {
      const body: Paginado<SeguroCargaComCaminhao> = { data: seguros, total: seguros.length, page: 1, pageSize: 20 };
      return { ok: true, json: async () => body };
    }
    return { ok: true, json: async () => ({}) };
  }) as unknown as typeof fetch;
}

describe('SeguroManualClient', () => {
  it('KPIs contam pendentes/enviados/confirmados', async () => {
    mockFetch([seguroPendente]);
    render(<SeguroManualClient permissoes={['FATURAMENTO_LER']} />);
    expect(await screen.findByText('Pendentes')).toBeInTheDocument();
  });

  it('Marcar como enviado so aparece para status Pendente', async () => {
    mockFetch([seguroPendente]);
    render(<SeguroManualClient permissoes={['SEGURO_GERENCIAR']} />);
    expect(await screen.findByText('Marcar como enviado')).toBeInTheDocument();
  });

  it('anexo abre Dialog em vez de window.prompt', async () => {
    mockFetch([seguroPendente]);
    const promptSpy = jest.spyOn(window, 'prompt');
    render(<SeguroManualClient permissoes={['SEGURO_GERENCIAR']} />);
    await userEvent.click((await screen.findAllByText('Anexar comprovante'))[0]!);
    expect(promptSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
