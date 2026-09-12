import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { PedidoEditor } from '../src/app/(admin)/comercial/pedidos/pedido-editor';
import type { PedidoVendaDetalhe } from '@/lib/comercial';

const operacao = {
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

const clientes = [
  {
    id: 'cliente-1',
    codigo: 'CLI-001',
    razaoSocial: 'Açougue Central Ltda.',
    nomeFantasia: 'Açougue Central',
    documentoFiscal: '12345678000190',
    representanteId: 'representante-1',
    representanteNome: 'Helena Prado',
    rotaId: 'rota-1',
    rotaNome: 'Rota Oeste',
  },
  {
    id: 'cliente-2',
    codigo: 'CLI-002',
    razaoSocial: 'Mercado Novo Ltda.',
    nomeFantasia: 'Mercado Novo',
    documentoFiscal: '12345678000191',
    representanteId: null,
    representanteNome: null,
    rotaId: null,
    rotaNome: null,
  },
];

const produtos = [
  {
    id: 'produto-1',
    codigo: 'TZ',
    nome: 'Traseiro',
    descricao: 'Traseiro',
    status: 'ativo',
    unidadePreco: 'kg' as const,
  },
  {
    id: 'produto-un',
    codigo: 'UN',
    nome: 'Produto unidade',
    descricao: 'Produto unidade',
    status: 'ativo',
    unidadePreco: 'unidade' as const,
  },
];

const rotas = [{ id: 'rota-1', codigo: 'RO-OESTE', nome: 'Rota Oeste', status: 'ativo' }];

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  }));
}

type VigenteLinha = {
  produtoId: string;
  preco: string | null;
  unidadePreco: 'kg' | 'unidade' | null;
  tabelaPrecoId: string | null;
};

function instalarFetch(opcoes?: {
  vigente?: VigenteLinha[] | ((url: string) => VigenteLinha[]);
  pedido?: PedidoVendaDetalhe | null;
  onChanged?: () => PedidoVendaDetalhe | null;
}) {
  let pedidoAtual = opcoes?.pedido ?? null;
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith('/api/precos/vigente?')) {
      const linhas = typeof opcoes?.vigente === 'function'
        ? opcoes.vigente(url)
        : (opcoes?.vigente ?? [{
          produtoId: 'produto-1',
          preco: '18.50',
          unidadePreco: 'kg' as const,
          tabelaPrecoId: 'tabela-1',
        }]);
      return json({ data: linhas });
    }
    if (url === '/api/cadastros/clientes/cliente-1') {
      return json(clientes[0]);
    }
    if (url === '/api/cadastros/clientes/cliente-2') {
      return json(clientes[1]);
    }
    if (url.startsWith('/api/comercial/pedidos/') && url.endsWith('/composicao-lotes')) {
      return json([]);
    }
    if (pedidoAtual && url === `/api/comercial/pedidos/${pedidoAtual.id}`) {
      return json(pedidoAtual);
    }
    if (url.includes('/preco') && init?.method === 'PATCH') {
      if (opcoes?.onChanged) {
        pedidoAtual = opcoes.onChanged();
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (init?.method === 'PATCH' || init?.method === 'DELETE' || init?.method === 'POST') {
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    return json({ message: `URL inesperada: ${url}` }, 500);
  }) as jest.Mock;
}

function itemBase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    pedidoVendaId: 'pedido-1',
    produtoId: 'produto-1',
    quantidadePedida: '5',
    quantidadeReservada: '5',
    quantidadePendente: '0',
    quantidadeAtendida: '0',
    quantidadeOverbooking: '0',
    status: 'totalmente_reservado',
    observacoes: null,
    precoAplicado: '18.50',
    precoTabelaOriginal: '18.50',
    precoAjustado: false,
    unidadePreco: 'kg' as const,
    produto: { id: 'produto-1', codigo: 'TZ', nome: 'Traseiro' },
    reservas: [{ id: 'reserva-1', status: 'ativa', origem: 'virtual' as const }],
    ...overrides,
  };
}

function pedidoBase(overrides: Record<string, unknown> = {}): PedidoVendaDetalhe {
  return {
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
    cliente: {
      id: 'cliente-1',
      codigo: 'CLI-001',
      razaoSocial: 'Açougue Central Ltda.',
      nomeFantasia: 'Açougue Central',
    },
    heranca: {
      representanteId: 'representante-1',
      representanteNome: 'Helena Prado',
      rotaId: 'rota-1',
      rotaNome: 'Rota Oeste',
    },
    itens: [itemBase()],
    ...overrides,
  } as PedidoVendaDetalhe;
}

function renderEditor(props: Partial<React.ComponentProps<typeof PedidoEditor>> = {}) {
  return render(
    <PedidoEditor
      pedido={null}
      clientes={clientes}
      produtos={produtos}
      rotas={rotas}
      operacoes={[operacao]}
      podeGerenciar
      podeFinalizar={false}
      onBack={jest.fn()}
      onChanged={jest.fn()}
      {...props}
    />,
  );
}

beforeEach(() => {
  instalarFetch();
});

it('grade renderiza a coluna Preço unitário', async () => {
  renderEditor({ pedido: pedidoBase() });
  expect(await screen.findByRole('columnheader', { name: 'Preço unitário' })).toBeInTheDocument();
});

it('preço vem preenchido após escolher cliente e operação via corpo.data', async () => {
  instalarFetch({
    vigente: [{
      produtoId: 'produto-1',
      preco: '18.50',
      unidadePreco: 'kg',
      tabelaPrecoId: 'tabela-1',
    }],
  });
  const user = userEvent.setup();
  renderEditor();
  await user.click(screen.getByRole('combobox', { name: 'Buscar cliente' }));
  await user.click(await screen.findByRole('option', { name: /Açougue Central/i }));
  fireEvent.change(screen.getByLabelText('Operação'), { target: { value: operacao.id } });
  await user.click(screen.getByRole('combobox', { name: 'Produto' }));
  await user.click(await screen.findByRole('option', { name: /TZ — Traseiro/i }));
  await waitFor(() => {
    expect(screen.getByLabelText('Preço unitário do novo produto')).toHaveValue(18.5);
  });
});

it('produto sem preço mostra 0,00 e desabilita incluir', async () => {
  instalarFetch({
    vigente: [{
      produtoId: 'produto-1',
      preco: null,
      unidadePreco: null,
      tabelaPrecoId: null,
    }],
  });
  const user = userEvent.setup();
  renderEditor();
  await user.click(screen.getByRole('combobox', { name: 'Buscar cliente' }));
  await user.click(await screen.findByRole('option', { name: /Açougue Central/i }));
  fireEvent.change(screen.getByLabelText('Operação'), { target: { value: operacao.id } });
  await user.click(screen.getByRole('combobox', { name: 'Produto' }));
  await user.click(await screen.findByRole('option', { name: /TZ — Traseiro/i }));
  await waitFor(() => {
    expect(screen.getByLabelText('Preço unitário do novo produto')).toHaveValue(0);
  });
  expect(screen.getByRole('button', { name: /Adicionar produto/i })).toBeDisabled();
});

it('editar para valor diferente aplica a classe border-warning', async () => {
  renderEditor({
    pedido: pedidoBase({
      itens: [itemBase({ precoAjustado: true, precoAplicado: '20.00' })],
    }),
  });
  const linha = await screen.findByTestId('linha-item-1');
  const input = within(linha).getByLabelText('Preço unitário');
  expect(input.className).toContain('border-warning');
});

it('tooltip mostra Valor da Tabela: R$ ...', async () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  renderEditor({
    pedido: pedidoBase({
      itens: [itemBase({
        precoAjustado: true,
        precoAplicado: '20.00',
        precoTabelaOriginal: '18.50',
      })],
    }),
  });
  const linha = await screen.findByTestId('linha-item-1');
  await user.hover(within(linha).getByLabelText('Preço unitário'));
  expect(await screen.findByRole('tooltip', { name: 'Valor da Tabela: R$ 18,50' })).toBeInTheDocument();
});

it('precoTabelaOriginal nulo mostra Sem preço de tabela para esta data, não R$ 0,00', async () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  renderEditor({
    pedido: pedidoBase({
      itens: [itemBase({
        precoAjustado: true,
        precoAplicado: '20.00',
        precoTabelaOriginal: null,
      })],
    }),
  });
  const linha = await screen.findByTestId('linha-item-1');
  await user.hover(within(linha).getByLabelText('Preço unitário'));
  expect(await screen.findByRole('tooltip', { name: 'Sem preço de tabela para esta data' })).toBeInTheDocument();
  expect(screen.queryByRole('tooltip', { name: /R\$ 0,00/ })).not.toBeInTheDocument();
});

it('voltar ao valor original remove a borda', async () => {
  const user = userEvent.setup();
  let pedidoAtual = pedidoBase({
    itens: [itemBase({
      precoAjustado: true,
      precoAplicado: '20.00',
      precoTabelaOriginal: '18.50',
    })],
  });

  function EditorComEstado() {
    const [pedido, setPedido] = useState(pedidoAtual);
    instalarFetch({
      pedido: pedidoAtual,
      onChanged: () => {
        pedidoAtual = pedidoBase({
          itens: [itemBase({ precoAjustado: false, precoAplicado: '18.50', precoTabelaOriginal: '18.50' })],
        });
        setPedido(pedidoAtual);
        return pedidoAtual;
      },
    });
    return (
      <PedidoEditor
        pedido={pedido}
        clientes={clientes}
        produtos={produtos}
        rotas={rotas}
        operacoes={[operacao]}
        podeGerenciar
        podeFinalizar={false}
        onBack={jest.fn()}
        onChanged={async () => {
          setPedido(pedidoAtual);
        }}
      />
    );
  }

  render(<EditorComEstado />);
  const linha = await screen.findByTestId('linha-item-1');
  const input = within(linha).getByLabelText('Preço unitário');
  expect(input.className).toContain('border-warning');
  fireEvent.change(input, { target: { value: '18.50' } });
  fireEvent.blur(input);
  await waitFor(() => {
    expect(within(screen.getByTestId('linha-item-1')).getByLabelText('Preço unitário').className)
      .not.toContain('border-warning');
  });
});

it('unidade unidade mostra /un, não /kg', async () => {
  renderEditor({
    pedido: pedidoBase({
      itens: [itemBase({
        unidadePreco: 'unidade',
        produtoId: 'produto-un',
        produto: { id: 'produto-un', codigo: 'UN', nome: 'Produto unidade' },
      })],
    }),
    produtos,
  });
  const linha = await screen.findByTestId('linha-item-1');
  expect(within(linha).getByText('/un')).toBeInTheDocument();
  expect(within(linha).queryByText('/kg')).not.toBeInTheDocument();
});

it('sem PEDIDOS_GERENCIAR o campo fica em leitura', async () => {
  renderEditor({
    pedido: pedidoBase(),
    podeGerenciar: false,
  });
  const linha = await screen.findByTestId('linha-item-1');
  expect(within(linha).getByLabelText('Preço unitário')).toBeDisabled();
});

it('pedido finalizado mantém destaque em leitura', async () => {
  renderEditor({
    pedido: pedidoBase({
      status: 'finalizado',
      itens: [itemBase({ precoAjustado: true, precoAplicado: '20.00', precoTabelaOriginal: '18.50' })],
    }),
  });
  const linha = await screen.findByTestId('linha-item-1');
  const input = within(linha).getByLabelText('Preço unitário');
  expect(input).toHaveAttribute('readonly');
  expect(input.className).toContain('border-warning');
});

it('trocar cliente remapeia precoAplicado de itensNovos a partir de corpo.data', async () => {
  instalarFetch({
    vigente: (url) => {
      if (url.includes('clienteId=cliente-1')) {
        return [{ produtoId: 'produto-1', preco: '18.50', unidadePreco: 'kg', tabelaPrecoId: 't1' }];
      }
      return [{ produtoId: 'produto-1', preco: '22.00', unidadePreco: 'kg', tabelaPrecoId: 't2' }];
    },
  });
  const user = userEvent.setup();
  renderEditor();
  await user.click(screen.getByRole('combobox', { name: 'Buscar cliente' }));
  await user.click(await screen.findByRole('option', { name: /Açougue Central/i }));
  fireEvent.change(screen.getByLabelText('Operação'), { target: { value: operacao.id } });
  await user.click(screen.getByRole('combobox', { name: 'Produto' }));
  await user.click(await screen.findByRole('option', { name: /TZ — Traseiro/i }));
  await waitFor(() => expect(screen.getByLabelText('Preço unitário do novo produto')).toHaveValue(18.5));
  expect(await screen.findByText('R$ 18,50')).toBeInTheDocument();
  await user.click(screen.getByRole('combobox', { name: 'Buscar cliente' }));
  await user.click(await screen.findByRole('option', { name: /Mercado Novo/i }));
  await waitFor(() => expect(screen.getByText('R$ 22,00')).toBeInTheDocument());
});

it('pedido persistido não remapeia itens congelados ao montar (lock de cliente)', async () => {
  const fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith('/api/precos/vigente?')) {
      return json({ data: [{ produtoId: 'produto-1', preco: '99.00', unidadePreco: 'kg', tabelaPrecoId: 'x' }] });
    }
    if (url.endsWith('/composicao-lotes')) return json([]);
    return json({ message: 'unexpected' }, 500);
  });
  global.fetch = fetchMock as jest.Mock;
  renderEditor({
    pedido: pedidoBase({
      itens: [itemBase({ precoAplicado: '18.50' })],
    }),
  });
  await screen.findByTestId('linha-item-1');
  const vigenteCalls = fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/precos/vigente'));
  expect(vigenteCalls).toHaveLength(0);
});

it('GET /api/precos/vigente com unidadePreco null usa sufixo do produto e não lê corpo.itens', async () => {
  instalarFetch({
    vigente: [{
      produtoId: 'produto-un',
      preco: null,
      unidadePreco: null,
      tabelaPrecoId: null,
    }],
  });
  const user = userEvent.setup();
  renderEditor();
  await user.click(screen.getByRole('combobox', { name: 'Buscar cliente' }));
  await user.click(await screen.findByRole('option', { name: /Açougue Central/i }));
  fireEvent.change(screen.getByLabelText('Operação'), { target: { value: operacao.id } });
  await user.click(screen.getByRole('combobox', { name: 'Produto' }));
  await waitFor(() => expect(screen.getByPlaceholderText('Buscar produto...')).toBeInTheDocument());
  await user.click(await screen.findByText(/UN — Produto unidade/i));
  await waitFor(() => expect(screen.getByText('/un')).toBeInTheDocument());
  expect(screen.queryByText('/kg')).not.toBeInTheDocument();
  const fetchMock = global.fetch as jest.Mock;
  const idx = fetchMock.mock.calls.findIndex(([url]) => String(url).startsWith('/api/precos/vigente'));
  const response = await fetchMock.mock.results[idx]?.value as Response;
  expect(JSON.parse(await response.text())).toHaveProperty('data');
});
