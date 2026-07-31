import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SeletorOperacao } from '../src/components/gestao/seletor-operacao';

const mockReplace = jest.fn();
const mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}));

const OPERACOES = [
  {
    id: 'op-1',
    data: '2026-07-22',
    diaSemana: 2,
    rotulo: 'Operação de terça-feira',
    status: 'aberta' as const,
    extraordinaria: false,
    comprasProgramadas: 1,
    pedidosVenda: 3,
    pendenciasOverbookingAbertas: 0,
  },
  {
    id: 'op-2',
    data: '2026-07-24',
    diaSemana: 4,
    rotulo: 'Operação de quinta-feira',
    status: 'fechada' as const,
    extraordinaria: false,
    comprasProgramadas: 0,
    pedidosVenda: 0,
    pendenciasOverbookingAbertas: 0,
  },
];

beforeEach(() => {
  mockReplace.mockReset();
  mockSearchParams.delete('operacaoId');
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: OPERACOES }),
  }) as jest.Mock;
});

describe('SeletorOperacao', () => {
  it('lista operações e seleciona a primeira não fechada quando URL não traz operacaoId', async () => {
    render(<SeletorOperacao />);
    await waitFor(() => {
      expect(screen.getByLabelText('Selecionar operação')).toBeInTheDocument();
    });
    expect(mockReplace).toHaveBeenCalledWith('?operacaoId=op-1', { scroll: false });
    expect(screen.getByRole('option', { name: 'Operação de terça-feira' })).toBeInTheDocument();
  });

  it('sincroniza troca via operacaoId na URL', async () => {
    mockSearchParams.set('operacaoId', 'op-1');
    render(<SeletorOperacao />);
    await waitFor(() => expect(screen.getByLabelText('Selecionar operação')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Selecionar operação'), 'op-2');
    expect(mockReplace).toHaveBeenCalledWith('?operacaoId=op-2', { scroll: false });
  });

  it('exibe erro quando fetch falha', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Sem permissão' }),
    });
    render(<SeletorOperacao />);
    await waitFor(() => {
      expect(screen.getByText('Sem permissão')).toBeInTheDocument();
    });
  });
});
