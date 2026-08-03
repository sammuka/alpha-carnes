import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LiberacaoCaminhaoClient } from '../src/app/(admin)/faturamento/liberacao/liberacao-client';
import type { ChecklistLiberacao } from '../src/lib/faturamento';

jest.mock('@/lib/realtime', () => ({
  conectarRealtime: () => () => undefined,
}));

const caminhao = {
  id: 'cam-1aaa-bbbb-cccc-dddddddddddd',
  placa: 'ABC-1234',
  motorista: 'José Almeida',
  rota: 'Rota Centro',
  statusCaminhao: 'faturado' as const,
  dataOperacao: '2026-08-01',
  statusFaturamento: 'concluido' as const,
};

const checklistIncompleto: ChecklistLiberacao = {
  liberavel: false,
  requisitos: [
    { chave: 'cargaConferida', rotulo: 'Carga conferida', ok: true, detalhe: 'Conferência concluída' },
    { chave: 'notasAutorizadas', rotulo: 'NF-e(s) autorizadas', ok: true, detalhe: '1 de 1' },
    { chave: 'seguroConfirmado', rotulo: 'Seguro confirmado', ok: false, detalhe: 'pendente' },
    { chave: 'caminhaoMotorista', rotulo: 'Caminhão/motorista preenchidos', ok: true, detalhe: 'Completos' },
  ],
};

function mockFetch() {
  global.fetch = jest.fn(async (url: string) => {
    if (String(url).includes('/liberacao?dataOperacao')) {
      return { ok: true, json: async () => [caminhao] };
    }
    if (String(url).includes('/checklist')) {
      return { ok: true, json: async () => checklistIncompleto };
    }
    return { ok: true, json: async () => ({}) };
  }) as unknown as typeof fetch;
}

describe('LiberacaoCaminhaoClient', () => {
  it('checklist incompleto desabilita Liberar Caminhao', async () => {
    mockFetch();
    render(<LiberacaoCaminhaoClient permissoes={['LIBERACAO_GERENCIAR']} />);
    const caminhaoBtn = await screen.findByText('ABC-1234');
    await userEvent.click(caminhaoBtn);
    expect(await screen.findByText('Liberar Caminhão')).toBeDisabled();
  });

  it('pendencias impeditivas mostram link de resolucao para cada requisito reprovado', async () => {
    mockFetch();
    render(<LiberacaoCaminhaoClient permissoes={['LIBERACAO_GERENCIAR']} />);
    const caminhaoBtn = await screen.findByText('ABC-1234');
    await userEvent.click(caminhaoBtn);
    expect(await screen.findByText('Resolver em Seguro Manual')).toBeInTheDocument();
  });
});
