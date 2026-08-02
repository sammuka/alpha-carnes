import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AjustesEstoqueClient } from '../src/app/(admin)/estoque/ajustes/ajustes-client';
import type { AjusteEstoque, ItemEstoqueConsulta } from '../src/lib/estoque';

const itemDisponivel: ItemEstoqueConsulta = {
  id: 'p1aaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  tipo: 'peca',
  codigo: 'TZ-000347',
  statusFisico: 'em_sobra',
  statusRotulo: 'Disponível',
  quantidade: '1',
  peso: '50.400',
  unidade: 'peça',
  produto: { id: 'prod1', codigo: 'TZ', nome: 'TZ' },
  origem: 'Frigorífico Boi Forte',
  nfLote: 'NF 128934',
  local: { valor: 'Câmara 1', provisorio: true },
  caracteristicas: [],
  pedidoReservado: null,
  estoqueAnterior: false,
  createdAt: '2026-08-02T08:15:00.000Z',
};

const ajustePendente: AjusteEstoque = {
  id: 'a1aaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  produtoCodigo: 'CXR',
  quantidadeDelta: -8,
  quantidadeAnterior: 20,
  motivo: 'erro_contagem',
  status: 'aguardando_aprovacao',
  criadoPor: 'u1',
  responsavelNome: 'Operador',
  createdAt: '2026-08-01T16:20:00.000Z',
};

function mockFetch({ limiar = 5 }: { limiar?: number } = {}) {
  global.fetch = jest.fn(async (url: string) => {
    const u = String(url);
    if (u.includes('/api/operacao/estoque/consulta')) {
      return { ok: true, json: async () => [itemDisponivel] } as Response;
    }
    if (u.includes('/api/operacao/estoque/ajustes')) {
      return { ok: true, json: async () => ({ data: [ajustePendente], total: 1, page: 1, pageSize: 50 }) } as Response;
    }
    if (u.includes('/api/admin/parametros/chave/estoque.limiar_aprovacao_ajuste')) {
      return { ok: true, json: async () => ({ valorJson: { valor: limiar } }) } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  }) as unknown as typeof fetch;
}

describe('AjustesEstoqueClient', () => {
  it('checkbox "Requer aprovação da gestão" marca automaticamente acima do limiar', async () => {
    mockFetch({ limiar: 5 });
    render(<AjustesEstoqueClient podeAjustar podeAprovar={false} nomeUsuario="Operador" />);

    await waitFor(() => expect(screen.getByText('Novo ajuste')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('Buscar por código ou produto'), { target: { value: 'TZ' } });
    await waitFor(() => expect(screen.getByText('TZ-000347 — TZ')).toBeInTheDocument());
    fireEvent.click(screen.getByText('TZ-000347 — TZ'));

    fireEvent.change(screen.getByPlaceholderText('Ex.: -2 ou +3'), { target: { value: '-8' } });

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(screen.getByText(/exigem aprovação da gestão/)).toBeInTheDocument();
  });

  it('ações Aprovar/Rejeitar ausentes sem permissão ESTOQUE_AJUSTE_APROVAR', async () => {
    mockFetch();
    render(<AjustesEstoqueClient podeAjustar={false} podeAprovar={false} nomeUsuario="Operador" />);

    await waitFor(() => expect(screen.getAllByText('CXR').length).toBeGreaterThan(0));
    expect(screen.queryByRole('button', { name: 'Aprovar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rejeitar' })).not.toBeInTheDocument();
  });

  it('ações Aprovar/Rejeitar presentes com permissão e ajuste pendente', async () => {
    mockFetch();
    render(<AjustesEstoqueClient podeAjustar={false} podeAprovar nomeUsuario="Gestor" />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Aprovar' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Rejeitar' })).toBeInTheDocument();
  });

  it('quantidade ajustada negativa aparece em vermelho', async () => {
    mockFetch({ limiar: 100 });
    render(<AjustesEstoqueClient podeAjustar podeAprovar={false} nomeUsuario="Operador" />);

    await waitFor(() => expect(screen.getByText('Novo ajuste')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('Buscar por código ou produto'), { target: { value: 'TZ' } });
    await waitFor(() => expect(screen.getByText('TZ-000347 — TZ')).toBeInTheDocument());
    fireEvent.click(screen.getByText('TZ-000347 — TZ'));
    fireEvent.change(screen.getByPlaceholderText('Ex.: -2 ou +3'), { target: { value: '-5' } });

    const valor = screen.getByText('-4 peça');
    expect(valor).toHaveClass('text-destructive');
  });
});
