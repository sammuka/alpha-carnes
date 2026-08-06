import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ParametrosClient } from '../src/app/(admin)/admin/parametros/parametros-client';

/**
 * Réplica fiel das 9 chaves de `PARAMETROS_SEED` (database/seed.ts), na mesma
 * ordem canônica devolvida pelo backend (decisão 25 / v1.1 §16) — a mesma
 * ordem dos 9 cartões de `Parametros.tsx` no protótipo.
 */
const PARAMETROS = [
  {
    id: '1',
    chave: 'comercial.overbooking_permitido',
    valorJson: {
      grupo: 'Comercial',
      tipo: 'toggle' as const,
      titulo: 'Permitir overbooking',
      texto: 'Sim (sem limite, com confirmação).',
      valor: true,
      provisorio: false,
      pendencia: null,
    },
  },
  {
    id: '2',
    chave: 'comercial.prioridade_consumo',
    valorJson: {
      grupo: 'Comercial',
      tipo: 'info' as const,
      titulo: 'Prioridade de consumo',
      texto: 'Físico → Virtual → Overbooking.',
      provisorio: false,
      pendencia: null,
    },
  },
  {
    id: '3',
    chave: 'operacao.fifo_estoque',
    valorJson: {
      grupo: 'Operação',
      tipo: 'toggle' as const,
      titulo: 'Estoque anterior sai primeiro (FIFO)',
      texto: 'Sim. O estoque físico já existente é priorizado.',
      valor: true,
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
      titulo: 'Cadência de geração de Operações',
      texto: 'Segunda, quarta e sexta.',
      valor: '1,3,5',
      provisorio: true,
      pendencia: 'P1',
    },
  },
  {
    id: '5',
    chave: 'operacao.composicao_boi_casado',
    valorJson: {
      grupo: 'Operação',
      tipo: 'info' as const,
      titulo: 'Composição do boi casado',
      texto: '2 TZ + 2 DT + 2 PA.',
      provisorio: false,
      pendencia: null,
    },
  },
  {
    id: '6',
    chave: 'operacao.regras_transformacao_tz',
    valorJson: {
      grupo: 'Operação',
      tipo: 'texto' as const,
      titulo: 'Regras de transformação do TZ',
      texto: '2 alternativas: (A) e (B).',
      valor: '',
      provisorio: true,
      pendencia: 'P12',
    },
  },
  {
    id: '7',
    chave: 'fiscal.seguro_integrado',
    valorJson: {
      grupo: 'Fiscal',
      tipo: 'toggle' as const,
      titulo: 'Seguro integrado',
      texto: 'Não (manual).',
      valor: false,
      provisorio: false,
      pendencia: null,
    },
  },
  {
    id: '8',
    chave: 'fiscal.emissao_fiscal',
    valorJson: {
      grupo: 'Fiscal',
      tipo: 'info' as const,
      titulo: 'Emissão fiscal',
      texto: 'Via sistema externo: NFS-e (EISS).',
      provisorio: false,
      pendencia: null,
    },
  },
  {
    id: '9',
    chave: 'fiscal.expiracao_reserva_rascunho',
    valorJson: {
      grupo: 'Fiscal',
      tipo: 'info' as const,
      titulo: 'Expiração de reserva de rascunho',
      texto: 'Sem expiração automática (AD-06).',
      provisorio: false,
      pendencia: null,
    },
  },
];

const TITULOS_ORDEM_CANONICA = PARAMETROS.map((p) => p.valorJson.titulo);

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: PARAMETROS, total: 9, page: 1, pageSize: 100 }),
  }) as unknown as typeof fetch;
});

it('nove parametros nos tres grupos na ordem Comercial Operacao Fiscal', async () => {
  render(<ParametrosClient podeGerenciar />);
  await screen.findByText('Permitir overbooking');
  const grupos = screen.getAllByText(/^(Comercial|Operação|Fiscal)$/);
  expect(grupos.map((g) => g.textContent)).toEqual(['Comercial', 'Operação', 'Fiscal']);
  expect(PARAMETROS).toHaveLength(9);
});

it('nove cartoes aparecem na ordem canonica exata dos titulos (v1.1 §16 / decisao 25)', async () => {
  const { container } = render(<ParametrosClient podeGerenciar />);
  await screen.findByText('Permitir overbooking');
  const titulos = Array.from(
    container.querySelectorAll('p.text-\\[13px\\].font-semibold.leading-tight.text-foreground'),
  ).map((el) => el.textContent);
  expect(titulos).toEqual(TITULOS_ORDEM_CANONICA);
});

it('exatamente 2 badges provisorio P1 e P12', async () => {
  render(<ParametrosClient podeGerenciar />);
  await screen.findByText('Cadência de geração de Operações');
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
  await screen.findByText('Permitir overbooking');
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
  await screen.findByText('Permitir overbooking');
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
    expect(corpo.valorJson.titulo).toBe('Permitir overbooking');
    expect(corpo.valorJson.valor).toBe(true);
  });
});
