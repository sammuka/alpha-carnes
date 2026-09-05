import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegrasTransformacaoClient } from '../src/app/(admin)/cadastros/regras-transformacao/regras-transformacao-client';
import { SimuladorDesdobramento } from '../src/app/(admin)/cadastros/regras-transformacao/simulador-desdobramento';
import { SimuladorDesossa } from '../src/app/(admin)/cadastros/regras-transformacao/simulador-desossa';

it('simulador de desdobramento exibe linha quantidade x fator = total da API', async () => {
  const corpo = {
    quantidade: 10,
    itens: [{ produtoId: 'ic1', descricao: 'TZ', fator: '2', total: 20 }],
    somaFatores: 6,
    totalPartes: 60,
  };
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => corpo,
  }) as unknown as typeof fetch;

  render(<SimuladorDesdobramento produtoOrigemId="compra-1" />);
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

  render(<SimuladorDesdobramento produtoOrigemId="compra-1" />);
  fireEvent.click(screen.getByRole('button', { name: /Simular/i }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Regra inválida');
  expect(screen.queryByText(/Total de partes geradas/i)).not.toBeInTheDocument();
});

const regraListada = {
  id: 'regra-1',
  produtoOrigemId: 'compra-uuid',
  produtoDestinoId: 'comercial-uuid',
  fatorQuantidade: '2.000',
  status: 'ativo',
  vigenciaInicio: '2026-01-01',
  vigenciaFim: null,
  observacoes: null,
  produtoOrigemCodigo: 'BOI',
  produtoOrigemNome: 'Boi casado',
  produtoDestinoCodigo: 'TZ',
  produtoDestinoNome: 'Traseiro',
};

function mockRegrasFetch(overrides: { postOk?: boolean } = {}) {
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/regras-desdobramento') && init?.method === 'POST') {
      return {
        ok: overrides.postOk !== false,
        json: async () => (overrides.postOk === false ? { message: 'Regra inválida' } : { id: 'nova' }),
      };
    }
    if (u.includes('/regras-desdobramento')) {
      return { ok: true, json: async () => ({ data: [regraListada], total: 1, page: 1, pageSize: 100 }) };
    }
    if (u.includes('/produtos') && u.includes('ativoCompra=true')) {
      return { ok: true, json: async () => ({ data: [{ id: 'compra-uuid', codigo: 'BOI', nome: 'Boi casado' }] }) };
    }
    if (u.includes('/produtos') && u.includes('ativoVenda=true')) {
      return { ok: true, json: async () => ({ data: [{ id: 'comercial-uuid', codigo: 'TZ', nome: 'Traseiro' }] }) };
    }
    return { ok: true, json: async () => ({}) };
  }) as unknown as typeof fetch;
}

it('lista regra com codigo e nome sem UUID e cria via dialog', async () => {
  mockRegrasFetch();
  render(<RegrasTransformacaoClient podeGerenciar />);
  expect(await screen.findByText('TZ — Traseiro')).toBeInTheDocument();
  expect(screen.getByText('BOI — Boi casado')).toBeInTheDocument();
  expect(screen.queryByText('compra-uuid')).not.toBeInTheDocument();
  expect(screen.queryByText('comercial-uuid')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Nova regra' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'Produto origem (compra)' }));
  await userEvent.click(await screen.findByRole('option', { name: 'BOI — Boi casado' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'Produto destino (venda)' }));
  await userEvent.click(await screen.findByRole('option', { name: 'TZ — Traseiro' }));
  await userEvent.click(screen.getByRole('button', { name: 'Salvar regra' }));

  await waitFor(() => {
    const post = (global.fetch as jest.Mock).mock.calls.find(
      ([url, init]: [string, RequestInit]) =>
        String(url) === '/api/cadastros/regras-desdobramento' && init?.method === 'POST',
    );
    expect(post).toBeDefined();
    expect(JSON.parse(String((post?.[1] as RequestInit).body))).toMatchObject({
      produtoOrigemId: 'compra-uuid',
      produtoDestinoId: 'comercial-uuid',
      fatorQuantidade: 1,
      status: 'ativo',
    });
  });
});
