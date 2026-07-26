import { fireEvent, render, screen } from '@testing-library/react';
import { RotasClient } from '../src/app/(admin)/cadastros/rotas/rotas-client';

const ROTA = {
  id: 'r1', codigo: 'L1', nome: 'Rota L1', regiao: 'Centro', status: 'ativo',
  representantePadrao: null, caminhaoPadrao: null, motoristaPadrao: null, observacoes: null,
  paradas: [
    { ordem: 1, descricao: 'Centro' },
    { ordem: 2, descricao: 'Bela Vista' },
  ],
  diasAtendimento: ['seg'],
};

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [ROTA], total: 1, page: 1, pageSize: 100 }),
  }) as unknown as typeof fetch;
});

it('reordena parada para cima preservando descricoes', async () => {
  render(<RotasClient permissoes={['ROTAS_LER', 'ROTAS_GERENCIAR']} />);
  fireEvent.click(await screen.findByText('Rota L1'));

  fireEvent.click(screen.getAllByRole('button', { name: 'Subir parada' })[1]!);

  expect([
    (screen.getByLabelText('Parada 1') as HTMLInputElement).value,
    (screen.getByLabelText('Parada 2') as HTMLInputElement).value,
  ]).toEqual(['Bela Vista', 'Centro']);
});

it('alterna dia de atendimento', async () => {
  render(<RotasClient permissoes={['ROTAS_LER', 'ROTAS_GERENCIAR']} />);
  fireEvent.click(await screen.findByText('Rota L1'));

  const terca = screen.getByRole('button', { name: 'Ter' });
  expect(terca).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(terca);
  expect(terca).toHaveAttribute('aria-pressed', 'true');
});
