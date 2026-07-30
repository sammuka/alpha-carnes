import { render, screen } from '@testing-library/react';
import DisponibilidadePage from '../src/app/(admin)/comercial/disponibilidade/page';

jest.mock('@/lib/realtime', () => ({
  conectarRealtime: jest.fn(() => jest.fn()),
}));

const CATALOGO_LEGADO_PROIBIDO = [
  'Central (Ponta de Agulha)',
  'Cupim',
  'Picanha',
];

function resposta(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  }));
}

beforeEach(() => {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('/api/comercial/disponibilidade?dataOperacao=')) {
      return resposta([{
        id: 'disponibilidade-1',
        operacaoId: 'operacao-1',
        itemComercialId: 'item-tz',
        quantidadeTotalGerada: '12.000',
        quantidadeReservada: '3.000',
        quantidadeDisponivel: '9.000',
        quantidadeRecebida: '8.000',
        quantidadeComDivergencia: '0.000',
        status: 'gerada',
      }]);
    }
    if (url === '/api/comercial/disponibilidade/mapa?operacaoId=operacao-1') {
      return resposta([
        {
          itemComercialId: 'item-tz',
          codigo: 'TZ',
          descricao: 'Traseiro Bovino',
          provisorio: true,
          estados: { F: '2.000', V: '9.000', R: '3.000', C: '0.000', D: '0.000', O: '0.000', E: '0.000', '!': '0.000' },
          unidades: { F: 1, V: 0, R: 0, C: 0, D: 0, O: 0, E: 0, '!': 0 },
          saldoComercial: '8.000',
        },
        {
          itemComercialId: 'item-dt',
          codigo: 'DT',
          descricao: 'Dianteiro Bovino',
          provisorio: true,
          estados: { F: '0.000', V: '4.000', R: '0.000', C: '0.000', D: '0.000', O: '0.000', E: '0.000', '!': '0.000' },
          unidades: { F: 0, V: 0, R: 0, C: 0, D: 0, O: 0, E: 0, '!': 0 },
          saldoComercial: '4.000',
        },
      ]);
    }
    return resposta({ message: `URL inesperada: ${url}` }, 500);
  }) as jest.Mock;
});

it('mapa usa o catalogo MVP e nao contem o catalogo legado da grade do prototipo', async () => {
  render(<DisponibilidadePage />);
  expect(await screen.findByText('Traseiro Bovino')).toBeInTheDocument();
  for (const legado of CATALOGO_LEGADO_PROIBIDO) {
    expect(screen.queryByText(legado)).not.toBeInTheDocument();
  }
});

it('catalogo MVP exibe badge provisorio P11', async () => {
  render(<DisponibilidadePage />);
  expect((await screen.findAllByText('Provisório · P11')).length).toBeGreaterThan(0);
});
