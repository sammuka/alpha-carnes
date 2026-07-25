import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ParametrosClient } from '../src/app/(admin)/admin/parametros/parametros-client';

const PARAMETROS = [
  {
    id: '1',
    chave: 'comercial.overbooking',
    valorJson: {
      grupo: 'Comercial',
      tipo: 'toggle' as const,
      titulo: 'Overbooking',
      texto: 'Permite overbooking',
      valor: true,
      provisorio: false,
      pendencia: null,
    },
  },
  {
    id: '2',
    chave: 'comercial.expiracao_reserva',
    valorJson: {
      grupo: 'Comercial',
      tipo: 'texto' as const,
      titulo: 'Expiração de reserva',
      texto: 'AD-06 fechou',
      valor: '8h',
      provisorio: false,
      pendencia: null,
    },
  },
  {
    id: '3',
    chave: 'comercial.composicao_boi',
    valorJson: {
      grupo: 'Comercial',
      tipo: 'info' as const,
      titulo: 'Composição do boi casado',
      texto: 'AD-01 fechou',
      provisorio: false,
      pendencia: null,
    },
  },
  {
    id: '4',
    chave: 'operacao.cadencia_dias_semana',
    valorJson: {
      grupo: 'Operação',
      tipo: 'texto' as const,
      titulo: 'Cadência',
      texto: 'Dias da semana',
      valor: 'seg,qua,sex',
      provisorio: true,
      pendencia: 'P1',
    },
  },
  {
    id: '5',
    chave: 'operacao.regras_transformacao_tz',
    valorJson: {
      grupo: 'Operação',
      tipo: 'info' as const,
      titulo: 'Regras TZ',
      texto: 'Exclusividade',
      provisorio: true,
      pendencia: 'P12',
    },
  },
  {
    id: '6',
    chave: 'operacao.fifo',
    valorJson: {
      grupo: 'Operação',
      tipo: 'toggle' as const,
      titulo: 'FIFO',
      texto: 'Consumo',
      valor: false,
      provisorio: false,
      pendencia: null,
    },
  },
  {
    id: '7',
    chave: 'fiscal.emissao',
    valorJson: {
      grupo: 'Fiscal',
      tipo: 'info' as const,
      titulo: 'Emissão fiscal',
      texto: 'AD-02 fechou',
      provisorio: false,
      pendencia: null,
    },
  },
  {
    id: '8',
    chave: 'fiscal.regime',
    valorJson: {
      grupo: 'Fiscal',
      tipo: 'texto' as const,
      titulo: 'Regime',
      texto: 'Texto',
      valor: 'simples',
      provisorio: false,
      pendencia: null,
    },
  },
  {
    id: '9',
    chave: 'fiscal.serie',
    valorJson: {
      grupo: 'Fiscal',
      tipo: 'toggle' as const,
      titulo: 'Série NFS-e',
      texto: 'Toggle',
      valor: true,
      provisorio: false,
      pendencia: null,
    },
  },
];

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: PARAMETROS, total: 9, page: 1, pageSize: 100 }),
  }) as unknown as typeof fetch;
});

it('nove parametros nos tres grupos na ordem Comercial Operacao Fiscal', async () => {
  render(<ParametrosClient podeGerenciar />);
  await screen.findByText('Overbooking');
  const grupos = screen.getAllByText(/^(Comercial|Operação|Fiscal)$/);
  expect(grupos.map((g) => g.textContent)).toEqual(['Comercial', 'Operação', 'Fiscal']);
  expect(PARAMETROS).toHaveLength(9);
});

it('exatamente 2 badges provisorio P1 e P12', async () => {
  render(<ParametrosClient podeGerenciar />);
  await screen.findByText('Cadência');
  expect(screen.getByTitle(/pendência P1 \(/i)).toBeInTheDocument();
  expect(screen.getByTitle(/pendência P12 \(/i)).toBeInTheDocument();
  expect(screen.getAllByTitle(/pendência P\d+ \(/i)).toHaveLength(2);
});

it('cartao info nao tem botao Salvar', async () => {
  render(<ParametrosClient podeGerenciar />);
  await screen.findByText('Composição do boi casado');
  const card = screen.getByText('Composição do boi casado').closest('div.flex.flex-col');
  expect(card).toBeTruthy();
  expect(card!.querySelector('button')).toBeNull();
});

it('sem PARAMETROS_GERENCIAR nenhum Salvar e controles desabilitados', async () => {
  render(<ParametrosClient podeGerenciar={false} />);
  await screen.findByText('Overbooking');
  expect(screen.queryByRole('button', { name: /^Salvar$/i })).not.toBeInTheDocument();
  for (const sw of screen.getAllByRole('switch')) {
    expect(sw).toBeDisabled();
  }
});

it('salvar envia PATCH preservando demais chaves de valorJson', async () => {
  const fetchMock = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ data: PARAMETROS, total: 9, page: 1, pageSize: 100 }),
    });
  });
  global.fetch = fetchMock as unknown as typeof fetch;

  render(<ParametrosClient podeGerenciar />);
  await screen.findByText('Overbooking');
  const botoes = screen.getAllByRole('button', { name: /^Salvar$/i });
  fireEvent.click(botoes[0]!);

  await waitFor(() => {
    const patch = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes('/parametros/chave/') && (init as RequestInit)?.method === 'PATCH',
    );
    expect(patch).toBeDefined();
    const corpo = JSON.parse(String((patch?.[1] as RequestInit).body)) as {
      valorJson: { grupo: string; tipo: string; titulo: string; texto: string; valor: boolean };
    };
    expect(corpo.valorJson.grupo).toBe('Comercial');
    expect(corpo.valorJson.titulo).toBe('Overbooking');
    expect(corpo.valorJson.valor).toBe(true);
  });
});
