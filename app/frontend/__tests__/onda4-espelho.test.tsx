import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EspelhoClient } from '../src/app/(admin)/comercial/espelho/espelho-client';

function resposta(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  }));
}

function espelho(agrupar: 'cliente' | 'rota' | 'representante') {
  return {
    dataOperacao: '2026-07-28',
    agrupar,
    totalGeral: {
      quantidadePedida: '5.000',
      quantidadeAtendida: '3.000',
      pesoAtendido: '72.300',
    },
    grupos: [{
      chave: agrupar === 'rota' ? 'Rota Oeste' : 'Açougue Central',
      subtotal: {
        quantidadePedida: '5.000',
        quantidadeAtendida: '3.000',
        pesoAtendido: '72.300',
      },
      itens: [{
        pedidoVendaId: 'pedido-1',
        clienteId: 'cliente-1',
        cliente: 'Açougue Central',
        representanteId: 'representante-1',
        representante: 'Helena Prado',
        rotaId: 'rota-1',
        rota: 'Rota Oeste',
        itemComercialId: 'item-1',
        produto: 'TZ — Traseiro Bovino',
        unidade: 'kg',
        quantidadePedida: '5.000',
        quantidadeAtendida: '3.000',
        pesoAtendido: '72.300',
        status: 'Parcial',
      }],
    }],
  };
}

beforeEach(() => {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('/api/cadastros/representantes')) {
      return resposta({ data: [{ id: 'representante-1', nome: 'Helena Prado' }], page: 1, pageSize: 100, total: 1 });
    }
    if (url.startsWith('/api/cadastros/rotas')) {
      return resposta({ data: [{ id: 'rota-1', nome: 'Rota Oeste' }], page: 1, pageSize: 100, total: 1 });
    }
    if (url.startsWith('/api/comercial/espelho?')) {
      const agrupar = new URL(`http://local${url}`).searchParams.get('agrupar') as 'cliente' | 'rota' | 'representante';
      return resposta(espelho(agrupar));
    }
    return resposta({ message: `URL inesperada: ${url}` }, 500);
  }) as jest.Mock;
});

it('espelho exibe badge provisorio P15 do marco de fechamento', async () => {
  render(<EspelhoClient dataInicial="2026-07-28" />);
  expect(await screen.findByText('Provisório · P15')).toBeInTheDocument();
});

it('seletor de agrupamento consulta o BFF e agrupa a tabela por rota', async () => {
  render(<EspelhoClient dataInicial="2026-07-28" />);
  expect((await screen.findAllByText('Açougue Central')).length).toBeGreaterThan(0);
  await userEvent.click(screen.getByRole('button', { name: 'Por rota' }));

  expect((await screen.findAllByText('Rota Oeste')).length).toBeGreaterThan(0);
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('agrupar=rota'),
      expect.objectContaining({ cache: 'no-store' }),
    );
  });
  expect(screen.getByRole('link', { name: 'Exportar' })).toHaveAttribute(
    'href',
    expect.stringContaining('agrupar=rota'),
  );
  expect(screen.getByRole('link', { name: 'Exportar' })).toHaveAttribute(
    'href',
    expect.stringContaining('formato=csv'),
  );
});
