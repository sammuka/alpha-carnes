import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnquadramentosClient } from '../src/components/fiscal/enquadramentos/enquadramentos-client';

const mockRealtime = jest.fn((_opcoes: { onMessage: () => void }) => () => undefined);
jest.mock('../src/lib/realtime', () => ({
  conectarRealtime: (opcoes: { onMessage: () => void }) => mockRealtime(opcoes),
}));

const ESTAB = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a61';
const OP = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a62';
const PROD = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a63';
const CLI = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a64';
const CFOP = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a65';
const NCM = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a66';
const ENQ = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a67';

function linha(n: number) {
  return {
    id: n === 1 ? ENQ : `0190a1b2-c3d4-7e5f-8a9b-${String(n).padStart(12, '0')}`,
    codigo: String(n),
    versao: 1,
    operacao: `Operação ${String(n).padStart(2, '0')}`,
    cfop: '5102',
    vigenciaInicio: '2026-01-01',
    estabelecimento: 'Filial Osasco',
    tpNf: 'Saída',
    finNfe: 'Operação normal',
    situacao: 'ATIVA',
  };
}

const DETALHE_BASE = {
  id: ENQ,
  codigo: '1',
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

interface Chamada { metodo: string; url: URL; corpo: Record<string, unknown> | null }

let detalhe = { ...DETALHE_BASE };
let total = 1;
let historico: unknown[] = [];
let preCondicoes: unknown[] = [];
let proximaMutacao: Response | null = null;
let chamadas: Chamada[] = [];

function responder(metodo: string, url: URL, corpo: Record<string, unknown> | null): Response {
  const caminho = url.pathname;
  if (caminho.startsWith('/api/admin/parametros')) return json(200, { valorJson: { provisorio: true } });
  if (metodo === 'GET' && caminho === '/api/erp/fiscal/enquadramentos/contagens') {
    return json(200, { total, ativas: total, inativas: 0 });
  }
  if (metodo === 'GET' && caminho === '/api/erp/fiscal/enquadramentos') {
    const pagina = Number(url.searchParams.get('page') ?? '1');
    const quantas = Math.max(0, Math.min(20, total - (pagina - 1) * 20));
    const dados = Array.from({ length: quantas }, (_, i) => linha((pagina - 1) * 20 + i + 1));
    return json(200, { data: dados, total, page: pagina, pageSize: 20 });
  }
  if (metodo === 'GET' && caminho === `/api/erp/fiscal/enquadramentos/${ENQ}`) return json(200, detalhe);
  if (metodo === 'GET' && caminho === `/api/erp/fiscal/enquadramentos/${ENQ}/historico`) return json(200, historico);
  if (metodo === 'GET' && caminho === `/api/erp/fiscal/enquadramentos/${ENQ}/pre-condicoes`) return json(200, preCondicoes);
  if (metodo !== 'GET' && caminho.startsWith('/api/erp/fiscal/enquadramentos/')) {
    if (proximaMutacao) return proximaMutacao;
    if (metodo === 'PATCH') {
      detalhe = { ...detalhe, ...(corpo ?? {}), versao: detalhe.versao + 1 } as typeof detalhe;
      return json(200, detalhe);
    }
    if (caminho.endsWith('/inativar')) {
      detalhe = { ...detalhe, situacao: 'INATIVA', situacaoRotulo: 'Inativa', versao: detalhe.versao + 1 };
      return json(200, detalhe);
    }
    return json(200, detalhe);
  }
  if (caminho.startsWith('/api/erp/fiscal/estabelecimentos')) {
    return json(200, { data: [{ id: ESTAB, nome: 'Filial Osasco', situacao: 'APPROVED' }], total: 1 });
  }
  if (caminho.startsWith('/api/operacoes')) {
    return json(200, { data: [{ id: OP, rotulo: 'Compra e venda outubro', data: '2026-10-01' }], total: 1 });
  }
  if (caminho.startsWith('/api/cadastros/produtos')) return json(200, { data: [{ id: PROD, nome: 'Acém', status: 'ativo' }] });
  if (caminho.startsWith('/api/cadastros/clientes')) {
    return json(200, { data: [{ id: CLI, nomeFantasia: 'Açougue Central', razaoSocial: 'Açougue Central LTDA', status: 'ativo' }] });
  }
  if (caminho.startsWith('/api/erp/fiscal/cfops')) return json(200, { data: [{ id: CFOP, codigo: '5102', descricao: 'Venda de mercadoria' }] });
  if (caminho.startsWith('/api/erp/fiscal/ncms')) return json(200, { data: [{ id: NCM, codigo: '02013000', descricao: 'Carnes bovinas' }] });
  return json(404, { message: 'Não encontrado.' });
}

beforeEach(() => {
  detalhe = { ...DETALHE_BASE };
  total = 1;
  historico = [];
  preCondicoes = [];
  proximaMutacao = null;
  chamadas = [];
  window.sessionStorage.clear();
  mockRealtime.mockClear();
  global.fetch = jest.fn(async (entrada: string, init?: RequestInit) => {
    const url = new URL(String(entrada), 'http://localhost');
    const corpo = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : null;
    const metodo = init?.method ?? 'GET';
    chamadas.push({ metodo, url, corpo });
    return responder(metodo, url, corpo);
  }) as unknown as typeof fetch;
});

function renderizar() {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  return { user, ...render(<EnquadramentosClient podeGerenciar />) };
}

async function abrirFicha(user: ReturnType<typeof userEvent.setup>, rotulo = 'Operação 01') {
  const celula = await screen.findByText(rotulo, { selector: 'td' });
  celula.closest('tr')!.focus();
  await user.keyboard('{Enter}');
  await screen.findByText('Alpha Carnes Ltda');
}

function valorDe(rotulo: string) {
  return screen.getByText(rotulo, { selector: 'p' }).nextElementSibling;
}

function listagens() {
  return chamadas.filter((c) => c.metodo === 'GET' && c.url.pathname === '/api/erp/fiscal/enquadramentos');
}

describe('lista paginada e ordenada no servidor', () => {
  it('Próxima e Anterior trocam a página, mostram total e página X de Y', async () => {
    total = 45;
    const { user } = renderizar();
    expect(await screen.findByText(/45 registros · Página 1 de 3/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(await screen.findByText(/45 registros · Página 2 de 3/)).toBeInTheDocument();
    expect(await screen.findByText('Operação 21', { selector: 'td' })).toBeInTheDocument();
    expect(listagens().at(-1)?.url.searchParams.get('page')).toBe('2');
    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(await screen.findByText(/Página 3 de 3/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(await screen.findByText(/Página 2 de 3/)).toBeInTheDocument();
  });

  it('ordenar por coluna alterna a direção e volta à página 1; filtro também volta à página 1', async () => {
    total = 45;
    const { user } = renderizar();
    await screen.findByText(/Página 1 de 3/);
    expect(screen.getByRole('columnheader', { name: /Operação$/ })).toHaveAttribute('aria-sort', 'ascending');
    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await screen.findByText(/Página 2 de 3/);
    await user.click(screen.getByRole('button', { name: 'Início de vigência' }));
    await waitFor(() => expect(listagens().at(-1)?.url.searchParams.get('sort')).toBe('vigenciaInicio'));
    expect(listagens().at(-1)?.url.searchParams.get('dir')).toBe('asc');
    expect(listagens().at(-1)?.url.searchParams.get('page')).toBe('1');
    await user.click(screen.getByRole('button', { name: 'Início de vigência' }));
    await waitFor(() => expect(listagens().at(-1)?.url.searchParams.get('dir')).toBe('desc'));
    expect(screen.getByRole('columnheader', { name: /Início de vigência/ })).toHaveAttribute('aria-sort', 'descending');
    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await screen.findByText(/Página 2 de 3/);
    await user.type(screen.getByLabelText('Buscar'), 'a');
    await waitFor(() => expect(listagens().at(-1)?.url.searchParams.get('search')).toBe('a'));
    expect(listagens().at(-1)?.url.searchParams.get('page')).toBe('1');
  });
});

describe('ficha atualizada após mutação e evento', () => {
  async function editarPrioridade(user: ReturnType<typeof userEvent.setup>, prioridade: string) {
    await user.click(await screen.findByRole('button', { name: 'Editar versão' }));
    const campo = await screen.findByLabelText('Prioridade');
    await user.clear(campo);
    await user.type(campo, prioridade);
    await user.type(screen.getByLabelText(/Motivo da alteração/), 'Ajuste de prioridade');
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  }

  it('após salvar a ficha mostra o novo valor e a segunda edição imediata usa a versão nova', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await editarPrioridade(user, '5');
    await waitFor(() => expect(valorDe('Prioridade')).toHaveTextContent('5'));
    await editarPrioridade(user, '6');
    const patches = chamadas.filter((c) => c.metodo === 'PATCH');
    expect(patches).toHaveLength(2);
    expect(patches[0]!.corpo?.versao).toBe(1);
    expect(patches[1]!.corpo?.versao).toBe(2);
    await waitFor(() => expect(valorDe('Prioridade')).toHaveTextContent('6'));
  });

  it('o evento em tempo real refaz a ficha aberta', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    expect(valorDe('Prioridade')).toHaveTextContent('1');
    detalhe = { ...detalhe, prioridade: 9, versao: 2 };
    await act(async () => { mockRealtime.mock.calls.at(-1)![0].onMessage(); });
    await waitFor(() => expect(valorDe('Prioridade')).toHaveTextContent('9'));
  });

  it('inativar pede a justificativa no diálogo, atualiza a situação e troca o botão por Reativar', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('tab', { name: 'Movimentações' }));
    await user.click(await screen.findByRole('button', { name: 'Inativar' }));
    const dialogo = await screen.findByRole('dialog');
    await user.type(within(dialogo).getByLabelText(/Justificativa/), 'Perfil substituído');
    await user.click(within(dialogo).getByRole('button', { name: 'Inativar' }));
    expect(await screen.findByRole('button', { name: 'Reativar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inativar' })).not.toBeInTheDocument();
    const inativar = chamadas.find((c) => c.url.pathname.endsWith('/inativar'));
    expect(inativar?.corpo).toEqual({ versao: 1, justificativa: 'Perfil substituído' });
    await user.click(screen.getByRole('tab', { name: 'Ficha e campos' }));
    expect(screen.getByText('Situação', { selector: 'p' }).nextElementSibling).toHaveTextContent('Inativa');
  });

  it.each([
    [409, 'CONFLITO_CONCORRENTE', 'conflito', 'O registro foi alterado por outro usuário. Recarregue para continuar.'],
    [422, 'ESTABELECIMENTO_NAO_APROVADO', 'O estabelecimento precisa estar aprovado.', 'O estabelecimento precisa estar aprovado.'],
  ])('erro %i ao inativar aparece no diálogo e não fecha como sucesso', async (status, codigo, message, texto) => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('tab', { name: 'Movimentações' }));
    await user.click(await screen.findByRole('button', { name: 'Inativar' }));
    const dialogo = await screen.findByRole('dialog');
    proximaMutacao = envelope(status, { message, codigo });
    await user.type(within(dialogo).getByLabelText(/Justificativa/), 'Perfil substituído');
    await user.click(within(dialogo).getByRole('button', { name: 'Inativar' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(texto);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('drawer de edição', () => {
  it('o estabelecimento fica somente leitura na edição', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(await screen.findByRole('button', { name: 'Editar versão' }));
    await screen.findByRole('dialog');
    expect(document.getElementById('enq-estab')).toBeDisabled();
    expect(document.getElementById('enq-estab')).toHaveTextContent('Filial Osasco');
  });

  it('Verificar dados confere os combos obrigatórios com os rótulos da tela', async () => {
    const { user } = renderizar();
    await user.click(await screen.findByRole('button', { name: '+ Novo registro' }));
    await screen.findByRole('dialog');
    await user.type(screen.getByLabelText(/Motivo da alteração/), 'Cadastro inicial');
    await user.click(screen.getByRole('button', { name: 'Verificar dados' }));
    const alerta = await screen.findByRole('alert');
    for (const rotulo of ['Estabelecimento', 'Operação', 'Operação fiscal (CFOP)', 'Produto', 'Classificação fiscal (NCM)', 'Cliente', 'Início de vigência']) {
      expect(alerta).toHaveTextContent(rotulo);
    }
    expect(alerta.textContent).not.toMatch(/Id\b/);
  });

  it('erro 400 do servidor mostra o rótulo do campo e não o nome técnico', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(await screen.findByRole('button', { name: 'Editar versão' }));
    await user.type(await screen.findByLabelText(/Motivo da alteração/), 'Ajuste de prioridade');
    proximaMutacao = envelope(400, {
      message: 'Validação falhou',
      errors: [
        { path: ['prioridade'], message: 'Valor acima do permitido' },
        { path: ['vigenciaInicio'], message: 'Data inválida' },
      ],
    });
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    const alerta = await screen.findByText(/Prioridade: Valor acima do permitido/);
    expect(alerta).toHaveTextContent('Início de vigência: Data inválida');
    expect(alerta.textContent).not.toMatch(/vigenciaInicio|prioridade:/);
  });
});

describe('abas do detalhamento', () => {
  it('Consultar histórico ativa e foca a aba Histórico, com data e hora dd/MM/aaaa HH:mm', async () => {
    historico = [{
      operacao: 'INSERT', situacaoAnterior: null, situacaoNova: 'ATIVA', usuarioNome: 'Maria Souza',
      criadoEm: '2026-10-14T12:00:00.000Z', justificativa: 'Cadastro inicial', resumo: 'Enquadramento criado', versao: 1,
    }];
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('button', { name: 'Consultar histórico' }));
    const aba = screen.getByRole('tab', { name: 'Histórico' });
    expect(aba).toHaveAttribute('aria-selected', 'true');
    expect(aba).toHaveFocus();
    expect(await screen.findByText(/14\/10\/2026 09:00/)).toBeInTheDocument();
    expect(screen.getByText(/Enquadramento criado/)).toBeInTheDocument();
    expect(screen.getByText(/Cadastro inicial/)).toBeInTheDocument();
  });

  it('Aceite e testes lista os oito critérios do protótipo em leitura, sem caixas de seleção', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('tab', { name: 'Aceite e testes' }));
    const criterios = [
      'Todos os campos de negócio e seus formatos são exibidos e validados',
      'Ações de cadastro, edição, confirmação, cancelamento e versões possuem estados visíveis',
      'Regras de negócio do servidor e pré-condições são verificadas',
      'Fluxos negativos exibem erros e não produzem gravações parciais',
      'Permissões e segregação das aprovações são auditáveis',
      'Concorrência, duplicação e reprocessamento seguros são testados',
      'Interface respeita o DS v3, teclado, estados vazios e tratamento de carregamento/erro',
      'Integrações e batch possuem evidência de contrato, ambiente de teste e rastreabilidade',
    ];
    const lista = screen.getByRole('list', { name: 'Critérios de aceite' });
    expect(within(lista).getAllByRole('listitem')).toHaveLength(8);
    for (const criterio of criterios) expect(within(lista).getByText(criterio)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText(/não registram aceite/)).toBeInTheDocument();
  });

  it('Integrações segue o protótipo: três blocos e destinos desabilitados, sem simulador', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('tab', { name: 'Integrações' }));
    expect(screen.getByText('Integração fiscal')).toBeInTheDocument();
    expect(screen.getByText('Configuração e segredo')).toBeInTheDocument();
    expect(screen.getByText('Execução batch')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir simulador' })).not.toBeInTheDocument();
    const destino = screen.getByRole('button', { name: 'Central de Integrações' });
    expect(destino).toBeDisabled();
    expect(destino).toHaveAttribute('title', 'Destino ainda não disponível');
  });

  it('Exceções mostra os dois fluxos do caderno e Movimentações a trilha de quatro etapas', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('tab', { name: 'Exceções' }));
    expect(screen.getByText(/Empate de enquadramento/)).toBeInTheDocument();
    expect(screen.getByText(/Operação sem regra aprovada/)).toBeInTheDocument();
    expect(screen.getAllByText(/Ação: bloquear conclusão/)).toHaveLength(2);
    await user.click(screen.getByRole('tab', { name: 'Movimentações' }));
    const trilha = screen.getByRole('list', { name: 'Etapas do enquadramento' });
    expect(within(trilha).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Preparação', 'Verificação', 'Autorização', 'Conclusão']);
  });

  it('pré-condições aparecem com rótulos legíveis e selo provisório, sem códigos técnicos', async () => {
    preCondicoes = [
      { codigo: 'ESTABELECIMENTO_APROVADO', atendida: true, provisoria: false },
      { codigo: 'CHAVE_COMPLETA', atendida: false, provisoria: false },
      { codigo: 'DUPLA_APROVACAO', atendida: false, provisoria: true },
    ];
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('button', { name: 'Validar pré-condições' }));
    const lista = await screen.findByRole('list', { name: 'Pré-condições' });
    expect(within(lista).getByText(/Estabelecimento aprovado/)).toHaveTextContent('atendida');
    expect(within(lista).getByText(/Chave de enquadramento completa/)).toHaveTextContent('pendente');
    expect(within(lista).getByText(/Dupla aprovação/)).toHaveTextContent('provisória');
    expect(lista.textContent).not.toMatch(/ESTABELECIMENTO_APROVADO|DUPLA_APROVACAO|CHAVE_COMPLETA/);
    expect(lista).toHaveTextContent('H-E01-11');
  });
});

describe('máscara de CFOP, NCM e CEST', () => {
  it('grade e ficha exibem os códigos mascarados', async () => {
    const { user } = renderizar();
    const celula = await screen.findByText('Operação 01', { selector: 'td' });
    expect(within(celula.closest('tr')!).getByText('5.102')).toBeInTheDocument();
    await abrirFicha(user);
    expect(valorDe('Operação fiscal (CFOP)')).toHaveTextContent('5.102');
    expect(valorDe('Classificação fiscal (NCM)')).toHaveTextContent('0201.30.00');
    expect(valorDe('Substituição tributária (CEST)')).toHaveTextContent('17.087.00');
  });
});

const INVISIVEL = '\u200B\u200C\u200D\uFEFF';

describe('concorrência e respostas fora de ordem', () => {
  it('resposta antiga da lista não sobrescreve linhas nem KPIs da mais nova', async () => {
    renderizar();
    await screen.findByText('Operação 01', { selector: 'td' });
    const original = global.fetch as unknown as (entrada: string, init?: RequestInit) => Promise<Response>;
    const listas: Array<(r: Response) => void> = [];
    const contagens: Array<(r: Response) => void> = [];
    global.fetch = jest.fn((entrada: string, init?: RequestInit) => {
      const url = new URL(String(entrada), 'http://localhost');
      if ((init?.method ?? 'GET') === 'GET' && url.pathname === '/api/erp/fiscal/enquadramentos') {
        return new Promise<Response>((r) => listas.push(r));
      }
      if ((init?.method ?? 'GET') === 'GET' && url.pathname === '/api/erp/fiscal/enquadramentos/contagens') {
        return new Promise<Response>((r) => contagens.push(r));
      }
      return original(entrada, init);
    }) as unknown as typeof fetch;
    await act(async () => { mockRealtime.mock.calls.at(-1)![0].onMessage(); });
    await act(async () => { mockRealtime.mock.calls.at(-1)![0].onMessage(); });
    expect(listas).toHaveLength(2);
    await act(async () => {
      listas[1]!(json(200, { data: [linha(2)], total: 1, page: 1, pageSize: 20 }));
      contagens[1]!(json(200, { total: 1, ativas: 1, inativas: 0 }));
    });
    expect(await screen.findByText('Operação 02', { selector: 'td' })).toBeInTheDocument();
    await act(async () => {
      listas[0]!(json(200, { data: [linha(7)], total: 77, page: 1, pageSize: 20 }));
      contagens[0]!(json(200, { total: 77, ativas: 77, inativas: 0 }));
    });
    expect(screen.queryByText('Operação 07', { selector: 'td' })).not.toBeInTheDocument();
    expect(screen.getByText('Operação 02', { selector: 'td' })).toBeInTheDocument();
    expect(screen.queryByText('77')).not.toBeInTheDocument();
  });

  it('a busca por texto só consulta depois de uma pausa na digitação', async () => {
    const { user } = renderizar();
    await screen.findByText('Operação 01', { selector: 'td' });
    await user.type(screen.getByLabelText('Buscar'), 'acem');
    await waitFor(() => expect(listagens().at(-1)?.url.searchParams.get('search')).toBe('acem'));
    const buscas = listagens().map((c) => c.url.searchParams.get('search') ?? '');
    expect(buscas.filter((b) => b !== '')).toEqual(['acem']);
  });
});

describe('duplicar perfil', () => {
  async function abrirDuplicar(user: ReturnType<typeof userEvent.setup>) {
    await abrirFicha(user);
    await user.click(screen.getByRole('tab', { name: 'Movimentações' }));
    await user.click(await screen.findByRole('button', { name: 'Duplicar' }));
    return screen.findByRole('dialog');
  }

  it('alteração da ficha por outro usuário não apaga o digitado e o envio usa a versão de quando abriu', async () => {
    const { user } = renderizar();
    const dialogo = await abrirDuplicar(user);
    await user.type(within(dialogo).getByLabelText('Motivo da duplicação'), 'Copia para o fim do ano');
    const prioridade = within(dialogo).getByLabelText('Prioridade da cópia');
    await user.clear(prioridade);
    await user.type(prioridade, '7');
    detalhe = { ...detalhe, prioridade: 9, versao: 2 };
    await act(async () => { mockRealtime.mock.calls.at(-1)![0].onMessage(); });
    await waitFor(() => expect(chamadas.filter((c) => c.url.pathname.endsWith(`/${ENQ}`)).length).toBeGreaterThan(1));
    expect(within(dialogo).getByLabelText('Motivo da duplicação')).toHaveValue('Copia para o fim do ano');
    expect(within(dialogo).getByLabelText('Prioridade da cópia')).toHaveValue(7);
    await user.click(within(dialogo).getByRole('button', { name: 'Duplicar' }));
    await waitFor(() => expect(chamadas.some((c) => c.url.pathname.endsWith('/duplicar'))).toBe(true));
    const envio = chamadas.find((c) => c.url.pathname.endsWith('/duplicar'))!;
    expect(envio.corpo?.versao).toBe(1);
    expect(envio.corpo?.prioridade).toBe(7);
  });

  it('motivo só com caracteres de largura zero é enviado normalizado', async () => {
    const { user } = renderizar();
    const dialogo = await abrirDuplicar(user);
    await user.click(within(dialogo).getByLabelText('Motivo da duplicação'));
    await user.paste(INVISIVEL);
    await user.click(within(dialogo).getByRole('button', { name: 'Duplicar' }));
    await waitFor(() => expect(chamadas.some((c) => c.url.pathname.endsWith('/duplicar'))).toBe(true));
    expect(chamadas.find((c) => c.url.pathname.endsWith('/duplicar'))!.corpo?.justificativa).toBe('');
  });
});

describe('justificativa com largura zero', () => {
  it('o diálogo de inativação recusa texto só com caracteres invisíveis', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('tab', { name: 'Movimentações' }));
    await user.click(await screen.findByRole('button', { name: 'Inativar' }));
    const dialogo = await screen.findByRole('dialog');
    await user.click(within(dialogo).getByLabelText(/Justificativa/));
    await user.paste(INVISIVEL);
    await user.click(within(dialogo).getByRole('button', { name: 'Inativar' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(/Informe a justificativa/);
    expect(chamadas.some((c) => c.url.pathname.endsWith('/inativar'))).toBe(false);
  });

  it('o drawer não aceita motivo só com caracteres invisíveis', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(await screen.findByRole('button', { name: 'Editar versão' }));
    await user.click(await screen.findByLabelText(/Motivo da alteração/));
    await user.paste(INVISIVEL);
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    expect(await screen.findByText(/Motivo da alteração \(3 a 500 caracteres\)/)).toBeInTheDocument();
    expect(chamadas.some((c) => c.metodo === 'PATCH')).toBe(false);
  });
});

describe('drawer com a ficha alterada por outro usuário', () => {
  it('ficha removida mantém a edição bloqueada e nunca cai em criar', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(await screen.findByRole('button', { name: 'Editar versão' }));
    await user.type(await screen.findByLabelText(/Motivo da alteração/), 'Ajuste de prioridade');
    const rota = `/api/erp/fiscal/enquadramentos/${ENQ}`;
    const anterior = global.fetch as unknown as (entrada: string, init?: RequestInit) => Promise<Response>;
    global.fetch = jest.fn(async (entrada: string, init?: RequestInit) => {
      const url = new URL(String(entrada), 'http://localhost');
      if (url.pathname === rota || url.pathname.startsWith(`${rota}/`)) {
        return envelope(404, { message: 'Enquadramento não encontrado.', codigo: 'NAO_ENCONTRADO' });
      }
      return anterior(entrada, init);
    }) as unknown as typeof fetch;
    await act(async () => { mockRealtime.mock.calls.at(-1)![0].onMessage(); });
    expect(await screen.findByText('Este registro foi removido por outro usuário.')).toBeInTheDocument();
    expect(screen.getByText('Editar versão', { selector: '[data-slot="sheet-title"]' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeDisabled();
    expect(chamadas.some((c) => c.metodo === 'POST')).toBe(false);
  });

  it('409 oferece Recarregar dados: mantém o digitado, mostra o que mudou e reenvia com a versão nova', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(await screen.findByRole('button', { name: 'Editar versão' }));
    await user.type(await screen.findByLabelText(/Motivo da alteração/), 'Ajuste de prioridade');
    detalhe = { ...detalhe, prioridade: 9, versao: 2 };
    proximaMutacao = envelope(409, { message: 'conflito', codigo: 'CONFLITO_CONCORRENTE' });
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await user.click(await screen.findByRole('button', { name: 'Recarregar dados' }));
    expect(await screen.findByText(/Alterado por outro usuário: Prioridade/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Motivo da alteração/)).toHaveValue('Ajuste de prioridade');
    proximaMutacao = null;
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(chamadas.filter((c) => c.metodo === 'PATCH')).toHaveLength(2));
    expect(chamadas.filter((c) => c.metodo === 'PATCH')[1]!.corpo?.versao).toBe(2);
  });
});

describe('Ações do processo com foco no campo', () => {
  async function abrirAcao(user: ReturnType<typeof userEvent.setup>, item: string) {
    await user.click(await screen.findByRole('button', { name: /Ações do processo/ }));
    await user.click(await screen.findByRole('menuitem', { name: item }));
    await screen.findByRole('dialog');
  }

  it('Relacionar produto e cliente foca o campo Produto', async () => {
    const { user } = renderizar();
    await abrirAcao(user, 'Relacionar produto e cliente');
    await waitFor(() => expect(document.getElementById('enq-prod')).toHaveFocus());
  });

  it('Controlar prioridade foca o campo Prioridade', async () => {
    const { user } = renderizar();
    await abrirAcao(user, 'Controlar prioridade');
    await waitFor(() => expect(screen.getByLabelText('Prioridade')).toHaveFocus());
  });
});
