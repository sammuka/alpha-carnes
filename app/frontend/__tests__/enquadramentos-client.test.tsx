import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnquadramentosClient } from '../src/components/fiscal/enquadramentos/enquadramentos-client';
import { conectarRealtime } from '../src/lib/realtime';

jest.mock('../src/lib/realtime', () => ({
  conectarRealtime: jest.fn(() => () => undefined),
}));

const ESTAB = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a61';
const OP = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a62';
const PROD = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a63';
const CLI = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a64';
const CFOP = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a65';
const NCM = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a66';
const ENQ = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a67';

const LINHA = {
  id: ENQ,
  codigo: '12',
  versao: 1,
  operacao: 'Compra e venda outubro',
  cfop: '5102',
  vigenciaInicio: '2026-01-01',
  estabelecimento: 'Filial Osasco',
  tpNf: 'Saída',
  finNfe: 'Operação normal',
  situacao: 'ATIVA',
};

const DETALHE = {
  id: ENQ,
  codigo: '12',
  versao: 1,
  empresaNome: 'Alpha Carnes Ltda',
  estabelecimentoId: ESTAB,
  estabelecimentoNome: 'Filial Osasco',
  operacaoId: OP,
  operacaoRotulo: 'Compra e venda outubro',
  tpNf: '1',
  tipoNota: 'Saída',
  finNfe: '1',
  finalidade: 'Operação normal',
  cfopId: CFOP,
  cfopCodigo: '5102',
  cfopDescricao: 'Venda de mercadoria',
  abrangencia: 'INTERNA',
  abrangenciaRotulo: 'Dentro do estado',
  tipoProduto: 'REVENDA',
  tipoProdutoRotulo: 'Revenda',
  produtoId: PROD,
  produtoNome: 'Acém',
  ncmId: NCM,
  ncmCodigo: '02013000',
  ncmDescricao: 'Carnes bovinas',
  cest: '1708700',
  clienteId: CLI,
  clienteNome: 'Açougue Central',
  vigenciaInicio: '2026-01-01',
  vigenciaFim: '2026-12-31',
  prioridade: 1,
  situacao: 'ATIVA',
  situacaoRotulo: 'Ativa',
  responsavel: 'Maria Souza',
  criadoEm: '2026-10-14T12:00:00.000Z',
  atualizadoEm: '2026-10-14T12:00:00.000Z',
  origemCodigo: null,
};

function json(status: number, corpo: unknown): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const resposta = new Response(JSON.stringify(corpo), { status, headers });
  if (typeof resposta.headers?.get !== 'function') {
    Object.defineProperty(resposta, 'headers', { value: headers });
  }
  return resposta;
}

function envelope(status: number, corpo: Record<string, unknown>): Response {
  return json(status, { message: corpo, error: 'erro', statusCode: status });
}

let lista = [LINHA];
let proximoSalvar: Response | null = null;
let proximaConsulta: Response | null = null;
let falharOperacoes = false;

function padrao(metodo: string, caminho: string): Response {
  if (caminho.startsWith('/api/admin/parametros')) {
    return json(200, { valorJson: { provisorio: true, pendencia: 'H-E01-12' } });
  }
  if (metodo === 'GET' && caminho.startsWith('/api/erp/fiscal/enquadramentos/exportacao')) {
    return { ok: true, status: 200, blob: async () => new Blob(['csv']) } as unknown as Response;
  }
  if (metodo === 'GET' && caminho.startsWith('/api/erp/fiscal/enquadramentos/contagens')) {
    return json(200, { total: lista.length, ativas: lista.length, inativas: 0 });
  }
  if (metodo === 'GET' && caminho === '/api/erp/fiscal/enquadramentos') {
    return json(200, { data: lista, total: lista.length, page: 1, pageSize: 20 });
  }
  if (metodo === 'GET' && caminho === `/api/erp/fiscal/enquadramentos/${ENQ}`) return json(200, DETALHE);
  if (metodo === 'GET' && caminho === `/api/erp/fiscal/enquadramentos/${ENQ}/historico`) return json(200, []);
  if (metodo === 'GET' && caminho === `/api/erp/fiscal/enquadramentos/${ENQ}/pre-condicoes`) {
    return json(200, [{ codigo: 'DUPLA_APROVACAO', atendida: false, provisoria: true }]);
  }
  if (metodo === 'POST' && caminho === '/api/erp/fiscal/enquadramentos/consulta' && proximaConsulta) return proximaConsulta;
  if ((metodo === 'PATCH' || metodo === 'POST') && caminho.startsWith('/api/erp/fiscal/enquadramentos') && proximoSalvar) {
    return proximoSalvar;
  }
  if (caminho.startsWith('/api/erp/fiscal/estabelecimentos')) {
    return json(200, { data: [{ id: ESTAB, nome: 'Filial Osasco', situacao: 'APPROVED' }], total: 1 });
  }
  if (caminho.startsWith('/api/operacoes')) {
    if (falharOperacoes) return json(500, { message: 'Falha.' });
    return json(200, { data: [{ id: OP, rotulo: 'Compra e venda outubro', data: '2026-10-01', status: 'aberta' }] });
  }
  if (caminho.startsWith('/api/cadastros/produtos')) {
    return json(200, { data: [{ id: PROD, nome: 'Acém', status: 'ativo', deletedAt: null }] });
  }
  if (caminho.startsWith('/api/cadastros/clientes')) {
    return json(200, { data: [{ id: CLI, nomeFantasia: 'Açougue Central', razaoSocial: 'Açougue Central LTDA', status: 'ativo' }] });
  }
  if (caminho.startsWith('/api/erp/fiscal/cfops')) {
    return json(200, { data: [{ id: CFOP, codigo: '5102', descricao: 'Venda de mercadoria' }] });
  }
  if (caminho.startsWith('/api/erp/fiscal/ncms')) {
    return json(200, { data: [{ id: NCM, codigo: '02013000', descricao: 'Carnes bovinas' }] });
  }
  return json(404, { message: 'Não encontrado.' });
}

beforeEach(() => {
  lista = [LINHA];
  proximoSalvar = null;
  proximaConsulta = null;
  falharOperacoes = false;
  window.sessionStorage.clear();
  (conectarRealtime as jest.Mock).mockClear();
  global.fetch = jest.fn(async (entrada: string, init?: RequestInit) => {
    const url = new URL(String(entrada), 'http://localhost');
    return padrao(init?.method ?? 'GET', url.pathname);
  }) as unknown as typeof fetch;
});

function renderizar() {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  const view = render(<EnquadramentosClient podeGerenciar />);
  return { user, ...view };
}

describe('EnquadramentosClient', () => {
  it('estado vazio usa o texto do protótipo e o selo H-E01-12', async () => {
    lista = [];
    renderizar();
    expect(await screen.findByText(/Nenhum resultado para o período, filtro ou situação escolhidos\. Limpe os filtros ou cadastre um novo registro\./)).toBeInTheDocument();
    expect(screen.getByText(/H-E01-12/)).toBeInTheDocument();
    expect(conectarRealtime).toHaveBeenCalledWith(expect.objectContaining({ rooms: ['fiscal-enquadramentos'] }));
  });

  it('ficha mostra os selos provisórios, sem UUID e sem a palavra Marca', async () => {
    const { user, container } = renderizar();
    const celula = await screen.findByText('Compra e venda outubro', { selector: 'td' });
    celula.closest('tr')!.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Alpha Carnes Ltda')).toBeInTheDocument();
    for (const selo of ['H-E01-06', 'H-E01-08', 'H-E01-09', 'H-E01-10', 'H-E01-11', 'H-E01-12']) {
      expect(container.textContent).toContain(selo);
    }
    expect(container.textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    expect(container.textContent).not.toMatch(/Marca/);
    expect(screen.getAllByText('Cliente').length).toBeGreaterThan(0);
  });

  it('409 de concorrência pede recarregar e 409 de sobreposição mostra o código do conflito', async () => {
    const { user } = renderizar();
    const celula = await screen.findByText('Filial Osasco', { selector: 'td' });
    celula.closest('tr')!.focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('button', { name: 'Editar versão' });

    proximoSalvar = envelope(409, { message: 'conflito', codigo: 'CONFLITO_CONCORRENTE' });
    await user.click(screen.getByRole('button', { name: 'Editar versão' }));
    await user.type(screen.getByLabelText(/Motivo da alteração/), 'Ajuste concorrente do perfil');
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    expect(await screen.findByText('O registro foi alterado por outro usuário. Recarregue para continuar.')).toBeInTheDocument();

    proximoSalvar = envelope(409, {
      message: 'Há vigência sobreposta para a mesma chave de enquadramento.',
      codigo: 'ENQUADRAMENTO_SOBREPOSTO',
      conflito: { codigo: '44', vigenciaInicio: '2026-01-01', vigenciaFim: '2026-06-30', prioridade: 1 },
    });
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    expect(await screen.findByText(/código 44/)).toBeInTheDocument();
  });

  it('422 de empate não elege linha e 422 sem regra não mostra tributo', async () => {
    const { user, container } = renderizar();
    const celula = await screen.findByText('Compra e venda outubro', { selector: 'td' });
    celula.closest('tr')!.focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('tab', { name: 'Exceções' });
    await user.click(screen.getByRole('tab', { name: 'Exceções' }));

    proximaConsulta = envelope(422, {
      message: 'Há mais de um enquadramento vigente para este critério. Nenhum foi escolhido.',
      codigo: 'EMPATE_ENQUADRAMENTO',
      candidatos: [{ codigo: '10', prioridade: 99 }, { codigo: '2', prioridade: 1 }],
    });
    await user.click(screen.getByRole('button', { name: 'Validar' }));
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Nenhum foi escolhido');
    expect(alerta).toHaveTextContent('2');
    expect(alerta).toHaveTextContent('10');
    expect(alerta.textContent).not.toMatch(/vencedor/i);
    expect(screen.queryByText(/enquadramento escolhido/i)).not.toBeInTheDocument();
    expect(screen.getByText('Compra e venda outubro', { selector: 'td' })).toBeInTheDocument();

    proximaConsulta = envelope(422, {
      message: 'O enquadramento foi localizado, mas o tributo não é resolvido nesta tela.',
      codigo: 'REGRA_APROVADA_AUSENTE',
      enquadramentoLocalizado: { codigo: '12', vigenciaInicio: '2026-01-01', vigenciaFim: '2026-12-31' },
    });
    await user.click(screen.getByRole('button', { name: 'Validar' }));
    expect(await screen.findByText(/tributo não é resolvido nesta tela/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/cst|aliquota|alíquota|icms|ipi|pis|cofins|ibs|cbs/i);
    expect(container.textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    expect(container.textContent).not.toMatch(/Marca/);
  });

  it.each(['Exportar', 'Exportar visão'])('%s repassa a busca da tela e baixa o arquivo', async (rotulo) => {
    const criar = jest.fn(() => 'blob:csv');
    const revogar = jest.fn();
    Object.assign(URL, { createObjectURL: criar, revokeObjectURL: revogar });
    const cliques = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const { user } = renderizar();
    await screen.findByText('Compra e venda outubro', { selector: 'td' });
    await user.type(screen.getByLabelText('Buscar'), 'acem');
    await user.click(screen.getByRole('button', { name: rotulo }));
    await waitFor(() => expect(cliques).toHaveBeenCalledTimes(1));
    const urls = (global.fetch as jest.Mock).mock.calls.map(([url]) => String(url));
    expect(urls.some((url) => url.startsWith('/api/erp/fiscal/enquadramentos/exportacao') && url.includes('search=acem'))).toBe(true);
    expect(criar).toHaveBeenCalled();
    cliques.mockRestore();
  });

  it('ficha mostra grade de campos rotulados com datas dd/MM/aaaa HH:mm em São Paulo', async () => {
    const { user } = renderizar();
    const celula = await screen.findByText('Compra e venda outubro', { selector: 'td' });
    celula.closest('tr')!.focus();
    await user.keyboard('{Enter}');
    await screen.findByText('Alpha Carnes Ltda');
    expect(screen.getByText('Criado em').nextElementSibling).toHaveTextContent('14/10/2026 09:00');
    expect(screen.getByText('Alterado em').nextElementSibling).toHaveTextContent('14/10/2026 09:00');
    expect(screen.getByText('Início de vigência', { selector: 'p' }).nextElementSibling).toHaveTextContent('01/01/2026');
    expect(screen.getByText('Fim de vigência', { selector: 'p' }).nextElementSibling).toHaveTextContent('31/12/2026');
    expect(document.body.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it('coluna Início de vigência e mensagem de sobreposição usam dd/MM/aaaa', async () => {
    const { user } = renderizar();
    const celula = await screen.findByText('Compra e venda outubro', { selector: 'td' });
    expect(within(celula.closest('tr')!).getByText('01/01/2026')).toBeInTheDocument();
    celula.closest('tr')!.focus();
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('button', { name: 'Editar versão' }));
    proximoSalvar = envelope(409, {
      message: 'Há vigência sobreposta.',
      codigo: 'ENQUADRAMENTO_SOBREPOSTO',
      conflito: { codigo: '44', vigenciaInicio: '2026-01-01', vigenciaFim: '2026-06-30', prioridade: 1 },
    });
    await user.type(screen.getByLabelText(/Motivo da alteração/), 'Ajuste de vigência');
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    expect(await screen.findByText(/Vigência 01\/01\/2026 a 30\/06\/2026/)).toBeInTheDocument();
  });

  it('Ações do processo é botão de menu acessível por teclado', async () => {
    const { user } = renderizar();
    const botao = await screen.findByRole('button', { name: /Ações do processo/ });
    expect(botao).toHaveAttribute('aria-haspopup', 'menu');
    botao.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(await screen.findByText('Novo registro')).toBeInTheDocument();
  });

  describe('combos com busca no servidor', () => {
    const TODOS = Array.from({ length: 101 }, (_, i) => ({
      id: `0190a1b2-c3d4-7e5f-8a9b-${String(i).padStart(12, '0')}`,
      nome: i === 100 ? 'Peça Rara 101' : `Produto ${String(i + 1).padStart(3, '0')}`,
      status: 'ativo',
      deletedAt: null,
    }));
    let pendentes: Array<() => void>;

    function responderProdutos(url: URL): Response {
      const termo = (url.searchParams.get('search') ?? '').toLowerCase();
      const achados = TODOS.filter((p) => p.nome.toLowerCase().includes(termo));
      const pagina = achados.slice(0, Number(url.searchParams.get('pageSize') ?? 20));
      return json(200, { data: pagina, total: achados.length, page: 1, pageSize: pagina.length });
    }

    function simular(produtos: (url: URL) => Response | Promise<Response>) {
      (global.fetch as jest.Mock).mockImplementation(async (entrada: string, init?: RequestInit) => {
        const url = new URL(String(entrada), 'http://localhost');
        if (url.pathname === '/api/cadastros/produtos') return produtos(url);
        return padrao(init?.method ?? 'GET', url.pathname);
      });
    }

    async function abrirGaveta(user: ReturnType<typeof userEvent.setup>) {
      await user.click(await screen.findByRole('button', { name: '+ Novo registro' }));
      await screen.findByRole('dialog');
      await user.click(document.getElementById('enq-prod')!);
    }

    beforeEach(() => { pendentes = []; });

    it('o 101º item é encontrado pela busca e a lista inicial avisa para refinar', async () => {
      simular(responderProdutos);
      const { user } = renderizar();
      await abrirGaveta(user);
      expect(await screen.findByText(/Refine a busca/)).toBeInTheDocument();
      expect(screen.queryByText('Peça Rara 101')).not.toBeInTheDocument();
      await user.type(screen.getByPlaceholderText('Buscar produto'), 'rara');
      expect(await screen.findByText('Peça Rara 101')).toBeInTheDocument();
      expect(screen.queryByText(/Refine a busca/)).not.toBeInTheDocument();
      const chamadas = (global.fetch as jest.Mock).mock.calls.map(([u]) => String(u));
      expect(chamadas.some((u) => u.includes('/api/cadastros/produtos') && u.includes('search=rara'))).toBe(true);
      await user.click(screen.getByText('Peça Rara 101'));
      expect(document.getElementById('enq-prod')).toHaveTextContent('Peça Rara 101');
    });

    it('descarta a resposta obsoleta quando a digitação já mudou', async () => {
      simular((url) => new Promise<Response>((resolver) => {
        const termo = url.searchParams.get('search');
        pendentes.push(() => resolver(json(200, { data: [{ id: `id-${termo}`, nome: `Resposta ${termo || 'inicial'}`, status: 'ativo' }], total: 1 })));
      }));
      const { user } = renderizar();
      await abrirGaveta(user);
      await waitFor(() => expect(pendentes).toHaveLength(1));
      const entrada = screen.getByPlaceholderText('Buscar produto');
      fireEvent.change(entrada, { target: { value: 'ab' } });
      await waitFor(() => expect(pendentes).toHaveLength(2), { timeout: 2000 });
      fireEvent.change(entrada, { target: { value: 'abc' } });
      await waitFor(() => expect(pendentes).toHaveLength(3), { timeout: 2000 });
      await act(async () => { pendentes[2]!(); });
      expect(await screen.findByText('Resposta abc')).toBeInTheDocument();
      await act(async () => { pendentes[1]!(); pendentes[0]!(); });
      expect(screen.getByText('Resposta abc')).toBeInTheDocument();
      expect(screen.queryByText('Resposta ab')).not.toBeInTheDocument();
      expect(screen.queryByText('Resposta inicial')).not.toBeInTheDocument();
    });

    it('estabelecimento: o 101º é encontrado pela busca no drawer e no filtro da lista', async () => {
      const todos = Array.from({ length: 101 }, (_, i) => ({
        id: `0190a1b2-c3d4-7e5f-8a9b-${String(i + 500).padStart(12, '0')}`,
        nome: i === 100 ? 'Filial Rara 101' : `Filial ${String(i + 1).padStart(3, '0')}`,
        situacao: 'APPROVED',
      }));
      (global.fetch as jest.Mock).mockImplementation(async (entrada: string, init?: RequestInit) => {
        const url = new URL(String(entrada), 'http://localhost');
        if (url.pathname === '/api/erp/fiscal/estabelecimentos') {
          const termo = (url.searchParams.get('search') ?? '').toLowerCase();
          const achados = todos.filter((e) => e.nome.toLowerCase().includes(termo));
          const pagina = achados.slice(0, Number(url.searchParams.get('pageSize')));
          return json(200, { data: pagina, total: achados.length });
        }
        return padrao(init?.method ?? 'GET', url.pathname);
      });
      const { user } = renderizar();
      await user.click(await screen.findByRole('button', { name: '+ Novo registro' }));
      await screen.findByRole('dialog');
      await user.click(document.getElementById('enq-estab')!);
      expect(await screen.findByText(/Refine a busca/)).toBeInTheDocument();
      await user.type(screen.getByPlaceholderText('Buscar estabelecimento'), 'rara');
      await user.click(await screen.findByText('Filial Rara 101'));
      expect(document.getElementById('enq-estab')).toHaveTextContent('Filial Rara 101');
    });

    it('estabelecimento no filtro da lista: o 101º é encontrado e filtra a grade', async () => {
      const todos = Array.from({ length: 101 }, (_, i) => ({
        id: `0190a1b2-c3d4-7e5f-8a9b-${String(i + 500).padStart(12, '0')}`,
        nome: i === 100 ? 'Filial Rara 101' : `Filial ${String(i + 1).padStart(3, '0')}`,
        situacao: 'APPROVED',
      }));
      (global.fetch as jest.Mock).mockImplementation(async (entrada: string, init?: RequestInit) => {
        const url = new URL(String(entrada), 'http://localhost');
        if (url.pathname === '/api/erp/fiscal/estabelecimentos') {
          const termo = (url.searchParams.get('search') ?? '').toLowerCase();
          const achados = todos.filter((e) => e.nome.toLowerCase().includes(termo));
          return json(200, { data: achados.slice(0, 50), total: achados.length });
        }
        return padrao(init?.method ?? 'GET', url.pathname);
      });
      const { user } = renderizar();
      await screen.findByText('Compra e venda outubro', { selector: 'td' });
      await user.click(document.getElementById('filtro-estab')!);
      await user.type(screen.getByPlaceholderText('Buscar estabelecimento'), 'rara');
      await user.click(await screen.findByText('Filial Rara 101'));
      await waitFor(() => {
        const urls = (global.fetch as jest.Mock).mock.calls.map(([u]) => String(u));
        expect(urls.some((u) => u.startsWith('/api/erp/fiscal/enquadramentos?') && u.includes('estabelecimentoId=0190a1b2-c3d4-7e5f-8a9b-000000000600'))).toBe(true);
      });
    });

    it('operação: busca no servidor pelo termo digitado (data ou rótulo)', async () => {
      (global.fetch as jest.Mock).mockImplementation(async (entrada: string, init?: RequestInit) => {
        const url = new URL(String(entrada), 'http://localhost');
        if (url.pathname === '/api/operacoes') {
          const termo = url.searchParams.get('search') ?? '';
          const todas = [
            { id: OP, rotulo: 'Compra e venda outubro', data: '2026-10-01' },
            { id: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a99', rotulo: 'Operação rara', data: '2025-03-04' },
          ].filter((o) => !termo || o.rotulo.toLowerCase().includes(termo.toLowerCase()));
          return json(200, { data: todas, total: todas.length, page: 1, pageSize: 50 });
        }
        return padrao(init?.method ?? 'GET', url.pathname);
      });
      const { user } = renderizar();
      await user.click(await screen.findByRole('button', { name: '+ Novo registro' }));
      await screen.findByRole('dialog');
      await user.click(document.getElementById('enq-op')!);
      await user.type(screen.getByPlaceholderText('Buscar operação'), 'rara');
      const buscou = () => (global.fetch as jest.Mock).mock.calls.some(([u]) => String(u).startsWith('/api/operacoes') && String(u).includes('search=rara'));
      await waitFor(() => expect(buscou()).toBe(true));
      await user.click(await screen.findByText('Operação rara · 04/03/2025'));
      expect(document.getElementById('enq-op')).toHaveTextContent('Operação rara · 04/03/2025');
    });

    it('operação: lista as operações sem aviso de truncamento', async () => {
      const { user } = renderizar();
      await user.click(await screen.findByRole('button', { name: '+ Novo registro' }));
      await screen.findByRole('dialog');
      await user.click(document.getElementById('enq-op')!);
      await screen.findByText('Compra e venda outubro · 01/10/2026');
      expect(screen.queryByText(/mais recentes/)).not.toBeInTheDocument();
    });

    it('mostra o erro da busca', async () => {
      simular(() => json(500, { message: 'x' }));
      const { user } = renderizar();
      await abrirGaveta(user);
      expect(await screen.findByText('Serviço indisponível no momento. Tente novamente.')).toBeInTheDocument();
    });

    it('na edição o rótulo do item selecionado aparece mesmo fora da página de resultados', async () => {
      simular(responderProdutos);
      const { user } = renderizar();
      const celula = await screen.findByText('Compra e venda outubro', { selector: 'td' });
      celula.closest('tr')!.focus();
      await user.keyboard('{Enter}');
      await user.click(await screen.findByRole('button', { name: 'Editar versão' }));
      expect(document.getElementById('enq-prod')).toHaveTextContent('Acém');
      expect(document.getElementById('enq-cli')).toHaveTextContent('Açougue Central');
      expect(document.getElementById('enq-cfop')).toHaveTextContent('5.102 Venda de mercadoria');
      expect(document.getElementById('enq-ncm')).toHaveTextContent('0201.30.00 Carnes bovinas');
    });
  });

  it('código fiscal com quebra de linha é recusado no frontend', async () => {
    const { user } = renderizar();
    await user.click(await screen.findByRole('button', { name: '+ Novo registro' }));
    await user.click((await screen.findAllByRole("button", { name: "Novo código" }))[0]!);
    const codigo = await screen.findByLabelText('Código');
    fireEvent.change(codigo, { target: { value: '51	02' } });
    await user.type(screen.getByLabelText('Descrição'), 'Venda');
    await user.type(screen.getByLabelText('Motivo do código'), 'Cadastro manual');
    const dialogo = screen.getByRole('dialog', { name: 'Operação fiscal (CFOP)' });
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar rascunho' }));
    expect(await within(dialogo).findByText('CFOP deve ter 4 dígitos.')).toBeInTheDocument();
  });
  it.each([['cfops', 'Operação fiscal (CFOP)', '5102', 0], ['ncms', 'Classificação fiscal (NCM)', '02013000', 1]] as const)(
    'novo código %s: triplo clique em Salvar gera um único POST e Escape não fecha em voo',
    async (rota, titulo, codigo, indice) => {
      const { user } = renderizar();
      await user.click(await screen.findByRole('button', { name: '+ Novo registro' }));
      await user.click((await screen.findAllByRole('button', { name: 'Novo código' }))[indice]!);
      await user.type(await screen.findByLabelText('Código'), codigo);
      await user.type(screen.getByLabelText('Descrição'), 'Venda');
      await user.type(screen.getByLabelText('Motivo do código'), 'Cadastro manual');
      let liberar: (r: Response) => void = () => undefined;
      const anterior = global.fetch as unknown as (entrada: string, init?: RequestInit) => Promise<Response>;
      const posts = jest.fn();
      global.fetch = jest.fn(async (entrada: string, init?: RequestInit) => {
        if ((init?.method ?? 'GET') === 'POST' && String(entrada).endsWith(`/api/erp/fiscal/${rota}`)) {
          posts();
          return new Promise<Response>((resolve) => { liberar = resolve; });
        }
        return anterior(entrada, init);
      }) as unknown as typeof fetch;
      const dialogo = screen.getByRole('dialog', { name: titulo });
      const salvar = within(dialogo).getByRole('button', { name: 'Salvar rascunho' });
      await user.click(salvar);
      await user.click(salvar);
      await user.click(salvar);
      expect(salvar).toBeDisabled();
      await user.keyboard('{Escape}');
      expect(screen.getByRole('dialog', { name: titulo })).toBeInTheDocument();
      expect(posts).toHaveBeenCalledTimes(1);
      await act(async () => { liberar(json(201, { id: CFOP, codigo, descricao: 'Venda' })); });
      await waitFor(() => expect(screen.queryByRole('dialog', { name: titulo })).not.toBeInTheDocument());
      expect(posts).toHaveBeenCalledTimes(1);
    },
  );
});
