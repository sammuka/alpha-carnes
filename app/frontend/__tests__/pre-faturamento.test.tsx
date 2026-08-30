import { render, screen } from '@testing-library/react';
import { FaturamentoClient } from '../src/app/(admin)/faturamento/pre-faturamento/pre-faturamento-client';

jest.mock('@/lib/realtime', () => ({
  conectarRealtime: () => () => undefined,
}));

function mockFetch(ambienteHomologacao: boolean) {
  global.fetch = jest.fn(async (url: string) => {
    if (String(url).includes('/ambiente')) {
      return { ok: true, json: async () => ({ homologacao: ambienteHomologacao }) };
    }
    if (String(url).includes('/caminhoes?')) {
      return { ok: true, json: async () => [] };
    }
    return { ok: true, json: async () => ({}) };
  }) as unknown as typeof fetch;
}

describe('FaturamentoClient (Pré-Faturamento) — badge de ambiente', () => {
  it('renderiza badge Homologação EISS quando ambiente.homologacao=true', async () => {
    mockFetch(true);
    render(<FaturamentoClient permissoes={['FATURAMENTO_LER']} />);
    expect(await screen.findByText('Homologação EISS')).toBeInTheDocument();
  });

  it('renderiza badge Produção EISS quando ambiente.homologacao=false', async () => {
    mockFetch(false);
    render(<FaturamentoClient permissoes={['FATURAMENTO_LER']} />);
    expect(await screen.findByText('Produção EISS')).toBeInTheDocument();
  });

  it('empty state pede selecao de carga sem UUID', async () => {
    mockFetch(false);
    render(<FaturamentoClient permissoes={['FATURAMENTO_LER']} mostrarListaCaminhoes />);
    expect(
      await screen.findByText('Selecione uma carga abaixo para consultar a consolidação.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('UUID do caminhão')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('ID do Caminhão')).not.toBeInTheDocument();
  });
});
