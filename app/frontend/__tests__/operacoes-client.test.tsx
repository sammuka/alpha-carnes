import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OperacoesClient } from '../src/app/(admin)/gestao/operacoes/operacoes-client';

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
];

beforeEach(() => {
  global.fetch = jest.fn((url: string, init?: RequestInit) => {
    if (url.includes('/api/operacoes/extraordinaria') && init?.method === 'POST') {
      return Promise.resolve({ ok: false, json: async () => ({ message: 'Já existe operação ativa nesta data' }) });
    }
    if (url.includes('/api/operacoes')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: OPERACOES }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  }) as jest.Mock;
  window.confirm = jest.fn(() => true);
});

describe('OperacoesClient', () => {
  it('lista operações, filtra e exibe badge P1', async () => {
    render(<OperacoesClient permissoes={['OPERACOES_GERENCIAR']} />);
    await waitFor(() => {
      expect(screen.getByText('Operação de terça-feira')).toBeInTheDocument();
    });
    expect(screen.getByText('Provisório')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox'), 'aberta');
    expect(global.fetch).toHaveBeenCalled();
  });

  it('abre modal extraordinária e trata erro do backend', async () => {
    render(<OperacoesClient permissoes={['OPERACOES_GERENCIAR']} />);
    await waitFor(() => expect(screen.getByText('Operação de terça-feira')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Nova Operação Extraordinária/i }));
    expect(screen.getByText('Nova Operação extraordinária')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Data da operação'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('Rótulo'), { target: { value: 'Op extra teste' } });
    await userEvent.click(screen.getByRole('button', { name: 'Criar Operação' }));
    await waitFor(() => {
      expect(screen.getByText('Já existe operação ativa nesta data')).toBeInTheDocument();
    });
  });
});
