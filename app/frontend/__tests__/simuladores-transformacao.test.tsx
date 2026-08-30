import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SimuladorDesdobramento } from '../src/app/(admin)/cadastros/regras-transformacao/simulador-desdobramento';
import { SimuladorDesossa } from '../src/app/(admin)/cadastros/regras-transformacao/simulador-desossa';

it('simulador de desdobramento exibe linha quantidade x fator = total da API', async () => {
  const corpo = {
    quantidade: 10,
    itens: [{ itemComercialId: 'ic1', descricao: 'TZ', fator: '2', total: 20 }],
    somaFatores: 6,
    totalPartes: 60,
  };
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => corpo,
  }) as unknown as typeof fetch;

  render(<SimuladorDesdobramento itemCompraId="compra-1" />);
  fireEvent.click(screen.getByRole('button', { name: /Simular/i }));

  expect(await screen.findByText(`${corpo.quantidade} × ${corpo.itens[0]!.fator} =`)).toBeInTheDocument();
  expect(screen.getByText(String(corpo.itens[0]!.total))).toBeInTheDocument();
  expect(screen.getByText(`Total de partes geradas: ${corpo.totalPartes}`)).toBeInTheDocument();
});

it('simulador de desossa marca bloqueado e lista alternativas', async () => {
  global.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (String(url).includes('/produtos')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [{ id: 'p1', nome: 'Acém', tipoOperacional: 'derivado_desossa' }] }),
      });
    }
    if (init?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          tzLivre: 10,
          resultados: [{ produtoId: 'p1', nome: 'Acém', disponivel: 0, bloqueado: true }],
          alternativasPossiveis: [{ id: 'a1', nome: 'Alt A' }],
        }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  }) as unknown as typeof fetch;

  render(<SimuladorDesossa />);
  await waitFor(() => expect(screen.getByLabelText('Reservar produto')).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('Reservar produto'), { target: { value: 'p1' } });
  fireEvent.click(screen.getByRole('button', { name: /Simular/i }));

  expect(await screen.findByText(/Bloqueado pela reserva/i)).toBeInTheDocument();
  expect(screen.getByText('Alt A')).toBeInTheDocument();
});

it('erro do backend vira alert e nao exibe numeros', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ message: 'Regra inválida' }),
  }) as unknown as typeof fetch;

  render(<SimuladorDesdobramento itemCompraId="compra-1" />);
  fireEvent.click(screen.getByRole('button', { name: /Simular/i }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Regra inválida');
  expect(screen.queryByText(/Total de partes geradas/i)).not.toBeInTheDocument();
});
