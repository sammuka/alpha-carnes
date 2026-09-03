import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PedidosClient } from '../src/app/(admin)/comercial/pedidos/pedidos-client';
import { ModalAdendo } from '../src/app/(admin)/comercial/pedidos/modal-adendo';
import { ModalOverbooking } from '../src/app/(admin)/comercial/pedidos/modal-overbooking';
import { ROTULOS_STATUS_PEDIDO, rotuloStatusPedido } from '@/lib/status-pedido';
import type { PedidoVenda } from '@/lib/comercial';

const pedido = {
  id: 'pedido-1',
  compraProgramadaId: 'compra-1',
  clienteId: 'cliente-1',
  operacaoId: 'operacao-1',
  dataEntrega: null,
  rotaId: 'rota-1',
  rotaPrevista: 'Rota Oeste',
  prioridade: 10,
  status: 'rascunho',
  observacoesGerais: null,
  createdAt: '2026-07-28T10:00:00.000Z',
  representanteNome: 'Helena Prado',
  rotaNome: 'Rota Oeste',
};

const itens = [
  ['item-reduzido', 'item-comercial-reduzido', 'Alcatra', 5],
  ['item-zerado', 'item-comercial-zerado', 'Contrafilé', 6],
  ['item-removido', 'item-comercial-removido', 'Costela', 7],
  ['item-aumentado', 'item-comercial-aumentado', 'Filé mignon', 8],
  ['item-estavel', 'item-comercial-estavel', 'Picanha', 9],
].map(([id, itemComercialId, nome, quantidade]) => ({
  id,
  pedidoVendaId: 'pedido-1',
  itemComercialId,
  quantidadePedida: String(quantidade),
  quantidadeReservada: String(quantidade),
  quantidadePendente: '0',
  quantidadeAtendida: '0',
  quantidadeOverbooking: '0',
  status: 'totalmente_reservado',
  observacoes: null,
  itemComercial: { id: itemComercialId, codigo: String(itemComercialId), nome },
  reservas: [{ id: `reserva-${id}`, status: 'ativa', origem: 'virtual' }],
}));

const detalhe = {
  ...pedido,
  cliente: {
    id: 'cliente-1',
    codigo: 'CLI-001',
    razaoSocial: 'Açougue Central Ltda.',
    nomeFantasia: 'Açougue Central',
    documentoFiscal: '12345678000190',
  },
  heranca: {
    representanteId: 'representante-1',
    representanteNome: 'Helena Prado',
    rotaId: 'rota-1',
    rotaNome: 'Rota Oeste',
  },
  itens,
};

const clientes = [
  {
    id: 'cliente-1',
    codigo: 'CLI-001',
    razaoSocial: 'Açougue Central Ltda.',
    nomeFantasia: 'Açougue Central',
    documentoFiscal: '12345678000190',
    representanteId: 'representante-1',
    rotaId: 'rota-1',
  },
  {
    id: 'cliente-2',
    codigo: 'CLI-002',
    razaoSocial: 'Mercado Sem Rota Ltda.',
    nomeFantasia: 'Mercado Sem Rota',
    documentoFiscal: '12345678000191',
    representanteId: null,
    rotaId: null,
  },
];

const rotas = [
  { id: 'rota-1', codigo: 'RO-OESTE', nome: 'Rota Oeste', status: 'ativo' },
];

const produtos = [
  ...itens.map((item) => ({
    id: item.itemComercialId,
    codigo: item.itemComercial.codigo,
    descricao: item.itemComercial.nome,
    status: 'ativo',
    unidadeComercial: 'kg',
  })),
  {
    id: 'item-comercial-novo',
    codigo: 'NOVO',
    descricao: 'Produto novo',
    status: 'ativo',
    unidadeComercial: 'kg',
  },
];

const operacaoDaApi = {
  id: 'operacao-1',
  data: '2026-07-28',
  diaSemana: 2,
  rotulo: 'Terça regular',
  status: 'aberta' as const,
  extraordinaria: false,
  comprasProgramadas: 1,
  pedidosVenda: 0,
  pendenciasOverbookingAbertas: 0,
};

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  }));
}

function instalarFetch() {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/comercial/pedidos?pageSize=100') {
      return json({ data: [pedido], page: 1, pageSize: 100, total: 1 });
    }
    if (url.startsWith('/api/cadastros/clientes?')) {
      return json({ data: clientes, page: 1, pageSize: 100, total: 2 });
    }
    if (url.startsWith('/api/cadastros/itens-comerciais?')) {
      return json({ data: produtos, page: 1, pageSize: 100, total: produtos.length });
    }
    if (url.startsWith('/api/cadastros/rotas?')) {
      return json({ data: rotas, page: 1, pageSize: 100, total: 1 });
    }
    if (url === '/api/operacoes?limite=100') {
      return json({
        data: [operacaoDaApi],
        page: 1,
        pageSize: 100,
        total: 1,
      });
    }
    if (url === '/api/comercial/pedidos/pedido-1') return json(detalhe);
    if (url === '/api/cadastros/clientes/cliente-1') {
      return json({
        ...clientes[0],
        representanteNome: 'Helena Prado',
        rotaNome: 'Rota Oeste',
      });
    }
    if (url === '/api/cadastros/clientes/cliente-2') {
      return json({ ...clientes[1], representanteNome: null, rotaNome: null });
    }
    if (url === '/api/comercial/pedidos/pedido-1/adendos') return json([]);
    if (url === '/api/comercial/pedidos' && init?.method === 'POST') {
      return json({ id: 'pedido-novo', status: 'rascunho' }, 201);
    }
    if (url.startsWith('/api/admin/auditoria?')) {
      return json({ data: [], page: 1, pageSize: 50, total: 0 });
    }
    if (init?.method === 'PATCH' || init?.method === 'DELETE' || init?.method === 'POST') {
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    return json({ message: `URL inesperada: ${url}` }, 500);
  }) as jest.Mock;
}

beforeEach(() => {
  instalarFetch();
});

it('deriva os 9 rotulos de status do prototipo incluindo rascunho com reserva ativa', () => {
  expect(Object.values(ROTULOS_STATUS_PEDIDO)).toEqual([
    'Rascunho',
    'Rascunho com reserva ativa',
    'Em elaboração com reserva ativa',
    'Aguardando confirmação de overbooking',
    'Finalizado',
    'Parcialmente atendido',
    'Atendido',
    'Faturado',
    'Cancelado',
  ]);
  expect(rotuloStatusPedido('rascunho', true)).toBe('Rascunho com reserva ativa');
});

it('modal de overbooking renderiza o payload do 409 sem numero fabricado', () => {
  render(
    <ModalOverbooking
      open
      challenge={{
        code: 'OVERBOOKING_CONFIRMACAO_NECESSARIA',
        message: 'Confirme',
        itens: [{
          itemComercialId: 'item-1',
          disponivelAntes: '7.250',
          quantidadeSolicitada: '10.500',
          overbookingGerado: '3.250',
          mensagem: 'Déficit',
        }],
      }}
      onCancel={jest.fn()}
      onConfirm={jest.fn()}
    />,
  );
  expect(screen.getByText('7.250')).toBeInTheDocument();
  expect(screen.getByText('10.500')).toBeInTheDocument();
  expect(screen.getByText('3.250')).toBeInTheDocument();
});

it('modal de adendo mostra pedido aberto existente e envia motivo', async () => {
  const onConfirm = jest.fn();
  render(
    <ModalAdendo
      open
      pedido={{ pedidoId: 'pedido-existente', status: 'rascunho', itemComercialId: 'item-1', quantidadeAtual: '12' }}
      quantidadeAdicionar={3}
      onCancel={jest.fn()}
      onConfirm={onConfirm}
    />,
  );
  expect(screen.getByText(/pedido-existente/)).toBeInTheDocument();
  expect(screen.getByText(/12/)).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText(/^Motivo/), 'Complemento do cliente');
  await userEvent.click(screen.getByRole('button', { name: 'Registrar adendo' }));
  expect(onConfirm).toHaveBeenCalledWith('Complemento do cliente');
});

it('modal de adendo exibe badge provisorio P5 da politica de preco', () => {
  render(
    <ModalAdendo
      open
      pedido={{ pedidoId: 'pedido-1', status: 'rascunho', itemComercialId: 'item-1', quantidadeAtual: '12' }}
      quantidadeAdicionar={3}
      onCancel={jest.fn()}
      onConfirm={jest.fn()}
    />,
  );
  expect(screen.getByText('Provisório · P5')).toBeInTheDocument();
});

it('selecionar cliente herda representante e rota do cadastro no editor de pedido', async () => {
  render(<PedidosClient permissoes={['PEDIDOS_LER', 'PEDIDOS_GERENCIAR']} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Novo pedido' }));

  await userEvent.click(screen.getByRole('combobox', { name: 'Buscar cliente' }));
  await userEvent.click(await screen.findByRole('option', { name: /Açougue Central/i }));
  await waitFor(() => expect(screen.getByLabelText('Representante')).toHaveValue('Helena Prado'));
  expect(screen.getByLabelText('Representante')).toHaveAttribute('readonly');
  expect(screen.getByRole('combobox', { name: 'Rota' })).toHaveTextContent('RO-OESTE — Rota Oeste');
  expect(screen.getByRole('combobox', { name: 'Rota' })).not.toHaveTextContent('rota-1');

  await userEvent.click(screen.getByRole('combobox', { name: 'Buscar cliente' }));
  await userEvent.click(await screen.findByRole('option', { name: /Mercado Sem Rota/i }));
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Rota' })).toHaveTextContent('—'));
});

it('novo pedido usa operacaoId e dataOperacao da operação sem compraProgramadaId', async () => {
  render(<PedidosClient permissoes={['PEDIDOS_LER', 'PEDIDOS_GERENCIAR']} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Novo pedido' }));
  await screen.findByRole('option', { name: `${operacaoDaApi.rotulo} — ${operacaoDaApi.data}` });
  await userEvent.click(screen.getByRole('combobox', { name: 'Buscar cliente' }));
  await userEvent.click(await screen.findByRole('option', { name: /Açougue Central/i }));
  fireEvent.change(screen.getByLabelText('Operação'), { target: { value: operacaoDaApi.id } });
  await userEvent.click(screen.getByRole('combobox', { name: 'Produto' }));
  await userEvent.click(await screen.findByRole('option', { name: 'NOVO — Produto novo' }));
  fireEvent.change(screen.getByLabelText('Quantidade do novo produto'), { target: { value: '2' } });
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar produto' }));
  await userEvent.click(screen.getByRole('button', { name: 'Salvar Rascunho' }));

  await waitFor(() => {
    const chamada = (global.fetch as jest.Mock).mock.calls.find(([url, init]) =>
      url === '/api/comercial/pedidos' && init?.method === 'POST');
    expect(chamada).toBeDefined();
    const payload = JSON.parse(String(chamada?.[1]?.body));
    expect(payload).toMatchObject({
      operacaoId: operacaoDaApi.id,
      dataOperacao: operacaoDaApi.data,
      rotaId: 'rota-1',
    });
    expect(payload).not.toHaveProperty('compraProgramadaId');
    expect(payload).not.toHaveProperty('rotaPrevista');
    expect(payload.dataOperacao).not.toBeUndefined();
  });
});

it('edicao de rascunho traduz reducao zero remocao aumento e produto ausente para os endpoints reais', async () => {
  render(<PedidosClient permissoes={['PEDIDOS_LER', 'PEDIDOS_GERENCIAR']} />);
  await userEvent.click(await screen.findByRole('button', { name: /Abrir pedido pedido-1/ }));
  expect(await screen.findByText('Editar Pedido')).toBeInTheDocument();

  const reduzido = screen.getByTestId('linha-item-reduzido');
  fireEvent.change(within(reduzido).getByLabelText('Quantidade'), { target: { value: '4' } });
  await userEvent.click(within(reduzido).getByRole('button', { name: 'Aplicar quantidade' }));

  const zerado = await screen.findByTestId('linha-item-zerado');
  fireEvent.change(within(zerado).getByLabelText('Quantidade'), { target: { value: '0' } });
  await userEvent.click(within(zerado).getByRole('button', { name: 'Aplicar quantidade' }));

  const removido = await screen.findByTestId('linha-item-removido');
  await userEvent.click(within(removido).getByRole('button', { name: 'Remover Costela' }));

  const aumentado = await screen.findByTestId('linha-item-aumentado');
  fireEvent.change(within(aumentado).getByLabelText('Quantidade'), { target: { value: '11' } });
  await userEvent.click(within(aumentado).getByRole('button', { name: 'Aplicar quantidade' }));
  await userEvent.type(await screen.findByLabelText(/^Motivo/), 'Complemento solicitado pelo cliente');
  await userEvent.click(screen.getByRole('button', { name: 'Registrar adendo' }));

  await userEvent.click(screen.getByRole('combobox', { name: 'Produto' }));
  await userEvent.click(await screen.findByRole('option', { name: 'NOVO — Produto novo' }));
  fireEvent.change(screen.getByLabelText('Quantidade do novo produto'), { target: { value: '2' } });
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar produto' }));

  await waitFor(() => {
    const chamadas = (global.fetch as jest.Mock).mock.calls;
    expect(chamadas).toContainEqual([
      '/api/comercial/pedidos/pedido-1/itens/item-reduzido',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          novaQuantidade: 4,
          motivo: 'Redução de quantidade no editor de rascunho',
        }),
      }),
    ]);
    expect(chamadas).toContainEqual([
      '/api/comercial/pedidos/pedido-1/itens/item-zerado',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({
          motivo: 'Remoção de item ao zerar quantidade no editor de rascunho',
        }),
      }),
    ]);
    expect(chamadas).toContainEqual([
      '/api/comercial/pedidos/pedido-1/itens/item-removido',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ motivo: 'Remoção de item no editor de rascunho' }),
      }),
    ]);
    expect(chamadas).toContainEqual([
      '/api/comercial/pedidos/pedido-1/adendos',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          itemComercialId: 'item-comercial-aumentado',
          quantidadeAdicionada: 3,
          motivo: 'Complemento solicitado pelo cliente',
        }),
      }),
    ]);
    expect(chamadas).toContainEqual([
      '/api/comercial/pedidos/pedido-1/itens',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ itemComercialId: 'item-comercial-novo', quantidade: 2 }),
      }),
    ]);
    expect(chamadas.some(([url, init]) =>
      url === '/api/comercial/pedidos/pedido-1/itens/item-zerado' && init?.method === 'PATCH')).toBe(false);
    expect(chamadas.some(([url, init]) =>
      url === '/api/comercial/pedidos/pedido-1' && init?.method === 'PATCH')).toBe(false);
  });
});
