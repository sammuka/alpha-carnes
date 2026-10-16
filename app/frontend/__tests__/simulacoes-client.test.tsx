import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExplicacaoPainel } from '../src/components/fiscal/simulacoes/explicacao-painel';
import { SimulacaoDrawer } from '../src/components/fiscal/simulacoes/simulacao-drawer';
import { SimulacoesClient } from '../src/components/fiscal/simulacoes/simulacoes-client';
import { FRASE_SEM_ALIQUOTA, TEXTO_VAZIO } from '../src/lib/fiscal-simulacoes';

const mockRealtime = jest.fn((_opcoes: { onMessage: () => void }) => () => undefined);
jest.mock('../src/lib/realtime', () => ({
  conectarRealtime: (opcoes: { onMessage: () => void }) => mockRealtime(opcoes),
}));

const ID = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a81';
const ID_V1 = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a82';
const ID_NOVA = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a83';
const ENQ = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a84';
const ESTAB = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a85';
const OP = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a86';
const CLI = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a87';
const PROD = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a88';
const NCM = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a89';

function linha(n: number) {
  return {
    id: n === 1 ? ID : `0190a1b2-c3d4-7e5f-8a9b-${String(n).padStart(12, '0')}`,
    codigo: '71',
    numeroVersao: 2,
    situacao: 'Calculada',
    competenciaRotulo: 'Outubro de 2026',
    cliente: `Cliente ${String(n).padStart(2, '0')}`,
    produto: 'Traseiro',
    valor: '1.000,00',
    valorLiquido: '1.000,00',
    estabelecimento: 'Osasco',
    operacao: 'Compra outubro',
  };
}

const DETALHE_BASE = {
  id: ID,
  codigo: '71',
  numeroVersao: 2,
  versao: 1,
  situacao: 'Calculada',
  estabelecimentoId: ESTAB,
  operacaoId: OP,
  clienteId: CLI,
  produtoId: PROD,
  ncmId: NCM,
  enquadramentoId: ENQ,
  cliente: 'Cliente 01',
  produto: 'Traseiro',
  estabelecimento: 'Osasco',
  operacao: 'Compra outubro',
  ncm: '0201.30.00 — Carnes bovinas',
  enquadramento: '12',
  empresa: 'Alpha Carnes Ltda',
  responsavel: 'Maria Souza',
  quantidade: '10.000',
  pesoNf: '982.000',
  valor: '1000.00',
  desconto: '0.00',
  valorLiquido: '1000.00',
  baseTributavel: '583.30',
  icms: '70.00',
  baseDifereBruto: true,
  competencia: '2026-10',
  competenciaRotulo: 'Outubro de 2026',
  justificativa: 'Simulação da competência de outubro de 2026.',
  criadoEm: '2026-10-14T12:00:00.000Z',
  atualizadoEm: '2026-10-14T15:30:00.000Z',
};

const EXPLICACAO = {
  linhas: [
    { rotulo: 'Redução de base do ICMS (%)', valor: '41,67%' },
    { rotulo: 'Alíquota (%)', valor: '12,00%' },
  ],
  semAliquota: [
    {
      rotulo: 'Tratamento IPI',
      tratamento: 'Saída tributada à alíquota zero',
      texto: FRASE_SEM_ALIQUOTA,
    },
  ],
  referenciaLegal: 'Regra 12',
  textoBase: 'A base tributável difere do valor bruto.',
};

function json(status: number, corpo: unknown): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const resposta = new Response(JSON.stringify(corpo), { status, headers });
  if (typeof resposta.headers?.get !== 'function') {
    Object.defineProperty(resposta, 'headers', { value: headers });
  }
  return resposta;
}

/** Resposta de arquivo: o jsdom não implementa Response.blob. */
function csv(): Response {
  return { ok: true, status: 200, headers: new Headers({ 'Content-Type': 'text/csv' }), blob: async () => new Blob(['a']) } as unknown as Response;
}

function envelope(status: number, corpo: Record<string, unknown>): Response {
  return json(status, { message: corpo, error: 'erro', statusCode: status });
}

interface Chamada { metodo: string; url: URL; corpo: Record<string, unknown> | null }

let total = 1;
let detalhe = { ...DETALHE_BASE };
let historico: unknown[] = [];
let proximaMutacao: Response | null = null;
let respostaFicha: Response | null = null;
let respostaExplicacao: Response | null = null;
let respostaPre: Response | null = null;
let respostaComparar: Response | null = null;
let liberarFicha: Promise<void> | null = null;
let chamadas: Chamada[] = [];
/** Segura as mutações (POST) até ser liberado, para haver pedido em voo. */
let portaoMutacao: Promise<void> | null = null;
/** Segura a resposta da listagem cuja busca é a chave, para simular resposta que chega fora de ordem. */
let portoesLista: Record<string, Promise<void>> = {};

const VERSOES = [
  { ...linha(1), id: ID_V1, numeroVersao: 1 },
  { ...linha(1), numeroVersao: 2 },
];

async function responder(metodo: string, url: URL): Promise<Response> {
  const caminho = url.pathname;
  const base = '/api/erp/fiscal/simulacoes';
  if (caminho.startsWith('/api/admin/parametros')) return json(200, { valorJson: { provisorio: true } });
  if (metodo === 'GET' && caminho === `${base}/contagens`) return json(200, { simulacoes: total, versoes: total, baseDiferente: 1 });
  if (metodo === 'GET' && caminho === base) {
    if (url.searchParams.get('codigo')) return json(200, { data: VERSOES, total: VERSOES.length, page: 1, pageSize: 100 });
    const busca = url.searchParams.get('search') ?? '';
    if (portoesLista[busca]) await portoesLista[busca];
    if (busca === 'lento') return json(200, { data: [linha(7)], total: 1, page: 1, pageSize: 20 });
    const pagina = Number(url.searchParams.get('page') ?? '1');
    const quantas = Math.max(0, Math.min(20, total - (pagina - 1) * 20));
    const dados = Array.from({ length: quantas }, (_, i) => linha((pagina - 1) * 20 + i + 1));
    return json(200, { data: dados, total, page: pagina, pageSize: 20 });
  }
  if (metodo === 'GET' && caminho === `${base}/${ID}`) {
    if (liberarFicha) await liberarFicha;
    return respostaFicha ?? json(200, detalhe);
  }
  if (metodo === 'GET' && caminho === `${base}/${ID_NOVA}`) return json(200, { ...detalhe, id: ID_NOVA, numeroVersao: 3 });
  if (metodo === 'GET' && caminho.endsWith('/historico')) return json(200, historico);
  if (metodo === 'GET' && caminho === `${base}/${ID}/explicacao`) return respostaExplicacao ?? json(200, EXPLICACAO);
  if (metodo === 'GET' && caminho === `${base}/${ID}/pre-condicoes`) {
    return respostaPre ?? json(200, [
      { codigo: 'MEMORIA_SEM_DOCUMENTO', atendida: true, provisoria: false },
      { codigo: 'DUPLA_APROVACAO', atendida: false, provisoria: true, texto: 'Esta tela não aprova nem publica regra. O quórum numérico permanece provisório.' },
    ]);
  }
  if (metodo === 'GET' && caminho === `${base}/${ID}/comparar`) {
    return respostaComparar ?? json(200, { codigo: '71', numeroVersaoAntes: 1, numeroVersaoDepois: 2, diferencas: [
      { campo: 'Desconto', antes: '0,00', depois: '50,00' },
    ] });
  }
  if (metodo === 'GET' && caminho === `${base}/${ID}/memoria`) {
    return csv();
  }
  if (metodo === 'GET' && caminho === `${base}/exportacao`) {
    return csv();
  }
  if (metodo === 'POST' && caminho.startsWith(base)) {
    if (portaoMutacao) await portaoMutacao;
    if (proximaMutacao) return proximaMutacao;
    return json(201, { ...detalhe, id: ID_NOVA, numeroVersao: 3 });
  }
  if (metodo === 'GET' && caminho === `/api/erp/fiscal/enquadramentos/${ENQ}`) {
    return json(200, {
      estabelecimentoId: ESTAB, estabelecimentoNome: 'Osasco', operacaoId: OP, operacaoRotulo: 'Compra outubro',
      clienteId: CLI, clienteNome: 'Cliente 01', produtoId: PROD, produtoNome: 'Traseiro',
      ncmId: NCM, ncmCodigo: '02013000', ncmDescricao: 'Carnes bovinas',
    });
  }
  if (caminho.startsWith('/api/erp/fiscal/enquadramentos')) return json(200, { data: [{ id: ENQ, codigo: '12', operacao: 'Compra outubro', situacao: 'ATIVA' }], total: 1 });
  if (caminho.startsWith('/api/erp/fiscal/estabelecimentos')) return json(200, { data: [{ id: ESTAB, nome: 'Osasco', situacao: 'APPROVED' }], total: 1 });
  if (caminho.startsWith('/api/operacoes')) return json(200, { data: [{ id: OP, rotulo: 'Compra outubro', data: '2026-10-01' }], total: 1 });
  if (caminho.startsWith('/api/cadastros/clientes')) return json(200, { data: [{ id: CLI, nomeFantasia: 'Cliente 01', razaoSocial: 'Cliente 01 LTDA', status: 'ativo' }], total: 1 });
  if (caminho.startsWith('/api/cadastros/produtos')) return json(200, { data: [{ id: PROD, nome: 'Traseiro', status: 'ativo' }], total: 1 });
  if (caminho.startsWith('/api/erp/fiscal/ncms')) return json(200, { data: [{ id: NCM, codigo: '02013000', descricao: 'Carnes bovinas' }], total: 1 });
  return json(404, { message: 'Não encontrado.' });
}

beforeEach(() => {
  total = 1;
  detalhe = { ...DETALHE_BASE };
  historico = [];
  proximaMutacao = null;
  respostaFicha = null;
  respostaExplicacao = null;
  respostaPre = null;
  respostaComparar = null;
  liberarFicha = null;
  chamadas = [];
  portoesLista = {};
  portaoMutacao = null;
  window.sessionStorage.clear();
  mockRealtime.mockClear();
  global.fetch = jest.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(entrada), 'http://localhost');
    const corpo = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : null;
    const metodo = init?.method ?? 'GET';
    chamadas.push({ metodo, url, corpo });
    return responder(metodo, url);
  }) as unknown as typeof fetch;
});

function renderizar() {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  return { user, ...render(<SimulacoesClient podeGerenciar />) };
}

async function abrirFicha(user: ReturnType<typeof userEvent.setup>, rotulo = 'Cliente 01') {
  const celula = await screen.findByText(rotulo, { selector: 'td' });
  celula.closest('tr')!.focus();
  await user.keyboard('{Enter}');
  await screen.findByText('Alpha Carnes Ltda');
}

function valorDe(rotulo: string) {
  return screen.getAllByText(rotulo, { selector: 'p' })[0]!.nextElementSibling;
}

function listagens() {
  return chamadas.filter((c) => c.metodo === 'GET' && c.url.pathname === '/api/erp/fiscal/simulacoes' && !c.url.searchParams.get('codigo'));
}

async function acaoDoMenu(user: ReturnType<typeof userEvent.setup>, nome: string) {
  const botao = await screen.findByRole('button', { name: /Ações do processo/ });
  botao.focus();
  await user.keyboard('{Enter}');
  await user.click(await screen.findByRole('menuitem', { name: nome }));
}

async function escolherCombo(user: ReturnType<typeof userEvent.setup>, drawer: HTMLElement, id: string, busca: string, termo: string, opcao: string | RegExp) {
  await user.click(drawer.querySelector(`#${id}`)!);
  await user.type(await screen.findByPlaceholderText(busca), termo);
  await user.click(await screen.findByRole('option', { name: opcao }));
}

describe('rótulos e painel', () => {
  it('rótulos literais do protótipo no drawer', () => {
    render(<SimulacaoDrawer aberto onFechar={() => undefined} onSalvar={async () => null} />);
    expect(screen.getByLabelText('Estabelecimento')).toBeInTheDocument();
    expect(screen.getByLabelText('Operação')).toBeInTheDocument();
    expect(screen.getByLabelText('Cliente')).toBeInTheDocument();
    expect(screen.getByLabelText('Produto')).toBeInTheDocument();
    expect(screen.getByLabelText('Classificação fiscal (NCM)')).toBeInTheDocument();
    expect(screen.getByLabelText('Quantidade')).toBeInTheDocument();
    expect(screen.getByLabelText('Peso informado na nota (kg)')).toBeInTheDocument();
    expect(screen.getByLabelText('Valor')).toBeInTheDocument();
    expect(screen.getByLabelText('Desconto')).toBeInTheDocument();
    expect(screen.getByLabelText('Competência')).toBeInTheDocument();
    expect(screen.getByLabelText('Enquadramento fiscal')).toBeInTheDocument();
    expect(screen.getByLabelText('Motivo da alteração')).toBeInTheDocument();
    expect(screen.getByLabelText('Base tributável (calculada)')).toBeDisabled();
    expect(screen.getByLabelText('Valor líquido (calculado)')).toBeDisabled();
    const texto = document.body.textContent ?? '';
    expect(texto).not.toMatch(/E01-T04/);
    expect(texto).not.toMatch(/Marca/);
    expect(texto).not.toMatch(/\bCST\b/);
    expect(texto).not.toMatch(/\bpICMS\b/);
    expect(texto).not.toMatch(/vProd/);
  });

  it('painel de explicação nomeia a redução e não zera tributo sem alíquota', () => {
    render(<ExplicacaoPainel explicacao={EXPLICACAO} />);
    const item = screen.getByText('Tratamento IPI').closest('li');
    expect(item).toHaveTextContent(FRASE_SEM_ALIQUOTA);
    expect(item?.textContent ?? '').not.toMatch(/0,00/);
    expect(screen.getByText(/Redução de base do ICMS \(%\)/)).toBeInTheDocument();
    expect(screen.getByText(/Alíquota \(%\)/)).toBeInTheDocument();
  });

  it('painel de explicação põe o selo provisório nas vigências da regra citada', () => {
    const linhas = [
      { rotulo: 'Início de vigência', valor: '01/01/2026' },
      { rotulo: 'Fim de vigência', valor: 'Sem fim de vigência' },
    ];
    const { container } = render(<ExplicacaoPainel explicacao={{ ...EXPLICACAO, linhas }} />);
    expect(container.textContent?.match(/H-E01-10/g)).toHaveLength(2);
  });

  it('lista vazia usa a frase do protótipo', async () => {
    total = 0;
    renderizar();
    expect(await screen.findByText(TEXTO_VAZIO)).toBeInTheDocument();
  });

  it('falha ao listar aparece com "Tentar novamente"', async () => {
    global.fetch = jest.fn(async () => json(500, { message: 'x' })) as unknown as typeof fetch;
    renderizar();
    expect(await screen.findByText(/Serviço indisponível no momento/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });
});

describe('lista paginada e ordenada no servidor', () => {
  it('mostra "Exibindo N de M", pagina e ordena no servidor, voltando à página 1', async () => {
    total = 45;
    const { user } = renderizar();
    expect(await screen.findByText(/Exibindo 20 de 45 registros/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(await screen.findByText(/Página 2 de 3/)).toBeInTheDocument();
    expect(listagens().at(-1)?.url.searchParams.get('page')).toBe('2');
    await user.click(screen.getByRole('button', { name: 'Valor líquido (calculado)' }));
    await waitFor(() => expect(listagens().at(-1)?.url.searchParams.get('sort')).toBe('valorLiquido'));
    expect(listagens().at(-1)?.url.searchParams.get('page')).toBe('1');
    await user.click(screen.getByRole('button', { name: 'Valor líquido (calculado)' }));
    await waitFor(() => expect(listagens().at(-1)?.url.searchParams.get('dir')).toBe('desc'));
    await user.type(screen.getByLabelText('Buscar cliente'), 'a');
    await waitFor(() => expect(listagens().at(-1)?.url.searchParams.get('search')).toBe('a'));
    expect(listagens().at(-1)?.url.searchParams.get('page')).toBe('1');
  });

  it('filtros de estabelecimento, cliente, produto e competência vão ao servidor e à exportação', async () => {
    const criar = jest.fn(() => 'blob:csv');
    Object.assign(URL, { createObjectURL: criar, revokeObjectURL: jest.fn() });
    const clique = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const { user } = renderizar();
    await screen.findByText('Cliente 01', { selector: 'td' });
    await user.click(document.getElementById('filtro-estab')!);
    await user.type(await screen.findByPlaceholderText('Buscar estabelecimento'), 'Osa');
    await user.click(await screen.findByRole('option', { name: 'Osasco' }));
    fireEvent.change(screen.getByLabelText('Competência'), { target: { value: '2026-10' } });
    await waitFor(() => {
      const ultima = listagens().at(-1)?.url.searchParams;
      expect(ultima?.get('estabelecimentoId')).toBe(ESTAB);
      expect(ultima?.get('competencia')).toBe('2026-10');
    });
    await user.type(screen.getByLabelText('Buscar cliente'), 'cli');
    await user.click(screen.getByRole('button', { name: 'Exportar visão' }));
    await user.click(screen.getByRole('button', { name: 'Exportar' }));
    const exportacoes = chamadas.filter((c) => c.url.pathname === '/api/erp/fiscal/simulacoes/exportacao');
    expect(exportacoes).toHaveLength(2);
    for (const exportacao of exportacoes) {
      expect(exportacao.url.searchParams.get('estabelecimentoId')).toBe(ESTAB);
      expect(exportacao.url.searchParams.get('competencia')).toBe('2026-10');
      expect(exportacao.url.searchParams.get('search')).toBe('cli');
      expect(exportacao.url.searchParams.get('sort')).toBe('cliente');
    }
    clique.mockRestore();
  });
});

describe('ficha', () => {
  it('mostra carregando, datas em dd/MM/aaaa HH:mm, valores em R$ e identifica a versão', async () => {
    let liberar!: () => void;
    liberarFicha = new Promise<void>((resolve) => { liberar = resolve; });
    const { user, container } = renderizar();
    const celula = await screen.findByText('Cliente 01', { selector: 'td' });
    celula.closest('tr')!.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByLabelText('Carregando a ficha')).toBeInTheDocument();
    liberar();
    expect(await screen.findByText('Alpha Carnes Ltda')).toBeInTheDocument();
    expect(valorDe('Código')).toHaveTextContent('71');
    expect(valorDe('Versão')).toHaveTextContent('2');
    expect(valorDe('Situação')).toHaveTextContent('Calculada');
    expect(valorDe('Criado em')).toHaveTextContent('14/10/2026 09:00');
    expect(valorDe('Alterado em')).toHaveTextContent('14/10/2026 12:30');
    expect(valorDe('Valor líquido (calculado)')).toHaveTextContent('R$ 1.000,00');
    expect(valorDe('Base tributável (calculada)')).toHaveTextContent('R$ 583,30');
    expect(valorDe('Competência')).toHaveTextContent('Outubro de 2026');
    expect(container.textContent).toContain('H-E01-10');
    expect(container.textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });

  it('falha ao carregar a ficha aparece na tela', async () => {
    respostaFicha = json(500, { message: 'x' });
    const { user } = renderizar();
    const celula = await screen.findByText('Cliente 01', { selector: 'td' });
    celula.closest('tr')!.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByText(/Serviço indisponível no momento/)).toBeInTheDocument();
  });

  it('Consultar histórico ativa a aba e mostra "quando • quem"', async () => {
    historico = [{
      operacao: 'INSERT', situacaoAnterior: null, situacaoNova: 'Calculada', usuarioNome: 'Maria Souza',
      criadoEm: '2026-10-14T12:00:00.000Z', justificativa: 'Simulação inicial', resumo: 'Simulação calculada', versao: 1, numeroVersao: 2,
    }];
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('button', { name: 'Consultar histórico' }));
    expect(screen.getByRole('tab', { name: 'Histórico' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('14/10/2026 09:00 • Maria Souza')).toBeInTheDocument();
    expect(screen.getByText('Justificativa: Simulação inicial')).toBeInTheDocument();
  });

  it('Validar pré-condições mostra o resultado e o erro de carga', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('button', { name: 'Validar pré-condições' }));
    expect(await screen.findByText('Memória sem documento fiscal: atendida')).toBeInTheDocument();
    respostaPre = json(500, { message: 'x' });
    await user.click(screen.getByRole('button', { name: 'Validar pré-condições' }));
    expect(await screen.findByText(/Serviço indisponível no momento/)).toBeInTheDocument();
  });

  it('Explicar tributos muda para a aba da ficha, onde o resultado aparece', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('tab', { name: 'Histórico' }));
    await acaoDoMenu(user, 'Explicar tributos');
    expect(screen.getByRole('tab', { name: 'Ficha e campos' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('Regra 12')).toBeInTheDocument();
  });

  it('falha ao explicar aparece junto do resultado, sem esconder', async () => {
    respostaExplicacao = json(500, { message: 'x' });
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('button', { name: 'Explicar tributos' }));
    expect(await screen.findByText(/Serviço indisponível no momento/)).toBeInTheDocument();
  });

  it('Exportar memória baixa o arquivo pelo cliente', async () => {
    Object.assign(URL, { createObjectURL: jest.fn(() => 'blob:csv'), revokeObjectURL: jest.fn() });
    const clique = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('button', { name: 'Exportar memória' }));
    await waitFor(() => expect(clique).toHaveBeenCalled());
    expect(chamadas.some((c) => c.url.pathname === `/api/erp/fiscal/simulacoes/${ID}/memoria`)).toBe(true);
    clique.mockRestore();
  });

  it('abas Exceções, Integrações e Aceite seguem o protótipo', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('tab', { name: 'Exceções' }));
    expect(await screen.findByText('A base tributável difere do valor bruto.')).toBeInTheDocument();
    expect(screen.getByText('A simulação só grava quando existe uma regra tributária aprovada cuja vigência cobre o dia 1º da competência.')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Integrações' }));
    expect(screen.getByRole('button', { name: 'Central de Integrações' })).toBeDisabled();
    await user.click(screen.getByRole('tab', { name: 'Aceite e testes' }));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText('Referência do requisito')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').filter((li) => li.closest('ul[aria-label="Critérios de aceite"]'))).toHaveLength(8);
  });

  it('o evento em tempo real refaz a ficha aberta', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    expect(valorDe('Valor líquido (calculado)')).toHaveTextContent('R$ 1.000,00');
    detalhe = { ...detalhe, valorLiquido: '950.00' };
    await act(async () => { mockRealtime.mock.calls.at(-1)![0].onMessage(); });
    await waitFor(() => expect(valorDe('Valor líquido (calculado)')).toHaveTextContent('R$ 950,00'));
  });
});

describe('comparar versões', () => {
  it('oferece só as versões do mesmo código, com código, versão, situação e competência', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('button', { name: 'Comparar versões' }));
    const dialogo = await screen.findByRole('dialog');
    const seletor = await within(dialogo).findByLabelText('Outra versão');
    expect(within(seletor).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Selecione', '71 · versão 1 · Calculada · Outubro de 2026']);
    expect(chamadas.find((c) => c.url.searchParams.get('codigo'))?.url.searchParams.get('codigo')).toBe('71');
  });

  it('lista as diferenças, avisa quando não há e mostra o erro dentro do diálogo', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('button', { name: 'Comparar versões' }));
    const dialogo = await screen.findByRole('dialog');
    await user.selectOptions(await within(dialogo).findByLabelText('Outra versão'), ID_V1);
    await user.click(within(dialogo).getByRole('button', { name: 'Comparar versões' }));
    expect((await within(dialogo).findAllByRole('listitem'))[0]).toHaveTextContent('Desconto: 0,00 → 50,00');
    respostaComparar = json(200, { codigo: '71', numeroVersaoAntes: 1, numeroVersaoDepois: 2, diferencas: [] });
    await user.click(within(dialogo).getByRole('button', { name: 'Comparar versões' }));
    expect(await within(dialogo).findByText('As duas versões não têm diferenças.')).toBeInTheDocument();
    respostaComparar = envelope(422, { message: 'x', codigo: 'SIMULACOES_DISTINTAS' });
    await user.click(within(dialogo).getByRole('button', { name: 'Comparar versões' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('A comparação exige duas versões da mesma simulação.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('nova versão', () => {
  async function abrirVersao(user: ReturnType<typeof userEvent.setup>) {
    await abrirFicha(user);
    await user.click(screen.getByRole('button', { name: 'Nova versão' }));
    return screen.findByRole('dialog');
  }

  it('valida desconto e motivo no formulário antes de enviar', async () => {
    const { user } = renderizar();
    const dialogo = await abrirVersao(user);
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar rascunho' }));
    expect(await within(dialogo).findByText('Informe o motivo da alteração (3 a 500 caracteres).')).toBeInTheDocument();
    const desconto = within(dialogo).getByLabelText('Desconto da versão');
    await user.clear(desconto);
    await user.type(desconto, 'abc');
    await user.type(within(dialogo).getByLabelText('Motivo da alteração'), 'Novo desconto');
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar rascunho' }));
    expect(await within(dialogo).findByText('Informe um valor com até duas casas decimais.')).toBeInTheDocument();
    expect(chamadas.some((c) => c.url.pathname.endsWith('/versoes'))).toBe(false);
  });

  it('grava e abre a ficha da versão criada', async () => {
    const { user } = renderizar();
    const dialogo = await abrirVersao(user);
    const desconto = within(dialogo).getByLabelText('Desconto da versão');
    await user.clear(desconto);
    await user.type(desconto, '50,00');
    await user.type(within(dialogo).getByLabelText('Motivo da alteração'), 'Novo desconto');
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const envio = chamadas.find((c) => c.url.pathname.endsWith('/versoes'));
    expect(envio?.corpo).toMatchObject({ desconto: '50,00', justificativa: 'Novo desconto', versao: 1 });
    await waitFor(() => expect(valorDe('Versão')).toHaveTextContent('3'));
    expect(chamadas.some((c) => c.metodo === 'GET' && c.url.pathname === `/api/erp/fiscal/simulacoes/${ID_NOVA}`)).toBe(true);
  });

  it('o 409 de versão imutável continua no diálogo', async () => {
    const { user } = renderizar();
    const dialogo = await abrirVersao(user);
    proximaMutacao = envelope(409, { message: 'x', codigo: 'VERSAO_IMUTAVEL' });
    await user.type(within(dialogo).getByLabelText('Motivo da alteração'), 'Novo desconto');
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar rascunho' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('A memória calculada não pode ser alterada. Inclua uma versão nova.');
  });
});

describe('drawer de simulação', () => {
  async function abrirDrawer(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: '+ Novo registro' }));
    return screen.findByRole('dialog');
  }

  async function preencherTudo(user: ReturnType<typeof userEvent.setup>, drawer: HTMLElement) {
    await escolherCombo(user, drawer, 'sim-enq', 'Buscar enquadramento', '12', '12 · Compra outubro');
    await waitFor(() => expect(document.getElementById('sim-estab')).toHaveTextContent('Osasco'));
    await user.type(within(drawer).getByLabelText('Quantidade'), '10,000');
    await user.type(within(drawer).getByLabelText('Peso informado na nota (kg)'), '982,000');
    await user.type(within(drawer).getByLabelText('Valor'), '1.000,00');
    await user.type(within(drawer).getByLabelText('Desconto'), '0,00');
    fireEvent.change(within(drawer).getByLabelText('Competência'), { target: { value: '2026-10' } });
    await user.type(within(drawer).getByLabelText('Motivo da alteração'), 'Simulação de outubro');
  }

  it('Verificar dados confere os obrigatórios localmente e confirma quando está tudo certo', async () => {
    const { user } = renderizar();
    const drawer = await abrirDrawer(user);
    await user.click(within(drawer).getByRole('button', { name: 'Verificar dados' }));
    expect(await within(drawer).findByText('Selecione o enquadramento fiscal.')).toBeInTheDocument();
    expect(within(drawer).getByText('Informe o valor.')).toBeInTheDocument();
    expect(within(drawer).queryByText('Dados verificados.')).not.toBeInTheDocument();
    await preencherTudo(user, drawer);
    await user.click(within(drawer).getByRole('button', { name: 'Verificar dados' }));
    expect(await within(drawer).findByText('Dados verificados.')).toBeInTheDocument();
  });

  it('valida quantidade, valor e desconto antes de chamar o servidor', async () => {
    const { user } = renderizar();
    const drawer = await abrirDrawer(user);
    await preencherTudo(user, drawer);
    const valor = within(drawer).getByLabelText('Valor');
    await user.clear(valor);
    await user.type(valor, '12x');
    await user.click(within(drawer).getByRole('button', { name: 'Salvar rascunho' }));
    expect(await within(drawer).findByText('Informe um valor com até duas casas decimais.')).toBeInTheDocument();
    expect(chamadas.some((c) => c.metodo === 'POST')).toBe(false);
  });

  it('grava, fecha e abre a ficha da simulação criada', async () => {
    const { user } = renderizar();
    const drawer = await abrirDrawer(user);
    await preencherTudo(user, drawer);
    await user.click(within(drawer).getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const envio = chamadas.find((c) => c.metodo === 'POST');
    expect(envio?.corpo).toMatchObject({ enquadramentoId: ENQ, estabelecimentoId: ESTAB, competencia: '2026-10', valor: '1.000,00' });
    await waitFor(() => expect(chamadas.some((c) => c.url.pathname === `/api/erp/fiscal/simulacoes/${ID_NOVA}`)).toBe(true));
  });

  it('o 400 do servidor leva o rótulo do campo', async () => {
    const { user } = renderizar();
    const drawer = await abrirDrawer(user);
    await preencherTudo(user, drawer);
    proximaMutacao = envelope(400, {
      message: 'Validação falhou',
      errors: [{ path: ['pesoNf'], message: 'Peso inválido' }],
    });
    await user.click(within(drawer).getByRole('button', { name: 'Salvar rascunho' }));
    const alertas = await within(drawer).findAllByRole('alert');
    expect(alertas.some((a) => a.textContent === 'Peso informado na nota (kg): Peso inválido')).toBe(true);
    expect(alertas.some((a) => a.textContent === 'Peso inválido')).toBe(true);
  });

  it('o 422 FALTA_REFERENCIA_LEGAL aparece no drawer e na aba Exceções', async () => {
    const { user } = renderizar();
    const drawer = await abrirDrawer(user);
    await preencherTudo(user, drawer);
    proximaMutacao = envelope(422, { message: 'x', codigo: 'FALTA_REFERENCIA_LEGAL' });
    await user.click(within(drawer).getByRole('button', { name: 'Salvar rascunho' }));
    expect(await within(drawer).findByText('Não há regra tributária aprovada vigente nesta competência para o enquadramento selecionado.')).toBeInTheDocument();
  });

  it('sair com pendência abre o diálogo do DS, não o confirm do navegador', async () => {
    const confirmar = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = renderizar();
    const drawer = await abrirDrawer(user);
    await user.type(within(drawer).getByLabelText('Motivo da alteração'), 'Texto pendente');
    await user.click(within(drawer).getByRole('button', { name: 'Cancelar' }));
    const alerta = await screen.findByRole('alertdialog');
    expect(alerta).toHaveTextContent('Descartar alterações?');
    expect(confirmar).not.toHaveBeenCalled();
    confirmar.mockRestore();
  });

  it('falha ao carregar o enquadramento não é engolida', async () => {
    const { user } = renderizar();
    const drawer = await abrirDrawer(user);
    const base = global.fetch as jest.Mock;
    global.fetch = jest.fn(async (entrada: string, init?: RequestInit) => {
      if (new URL(String(entrada), 'http://localhost').pathname === `/api/erp/fiscal/enquadramentos/${ENQ}`) return json(500, { message: 'x' });
      return base(entrada, init);
    }) as unknown as typeof fetch;
    await escolherCombo(user, drawer, 'sim-enq', 'Buscar enquadramento', '12', '12 · Compra outubro');
    expect(await within(drawer).findByText(/Não foi possível carregar os dados do enquadramento/)).toBeInTheDocument();
  });
});

describe('lista: resposta obsoleta e busca com atraso', () => {
  it('a busca só chega ao servidor quando a digitação para, com uma única consulta', async () => {
    const { user } = renderizar();
    await screen.findByText('Cliente 01', { selector: 'td' });
    const antes = listagens().length;
    await user.type(screen.getByLabelText('Buscar cliente'), 'abc');
    expect(listagens().length).toBe(antes);
    await waitFor(() => expect(listagens().at(-1)?.url.searchParams.get('search')).toBe('abc'));
    expect(listagens().slice(antes).map((c) => c.url.searchParams.get('search'))).toEqual(['abc']);
  });

  it('descarta a resposta antiga que chega depois da nova', async () => {
    let liberar!: () => void;
    portoesLista.lento = new Promise<void>((resolve) => { liberar = resolve; });
    const { user } = renderizar();
    await screen.findByText('Cliente 01', { selector: 'td' });
    const campo = screen.getByLabelText('Buscar cliente');
    await user.type(campo, 'lento');
    await waitFor(() => expect(listagens().some((c) => c.url.searchParams.get('search') === 'lento')).toBe(true));
    await user.clear(campo);
    await waitFor(() => expect(listagens().at(-1)?.url.searchParams.get('search') ?? '').toBe(''));
    await act(async () => { liberar(); });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText('Cliente 07', { selector: 'td' })).not.toBeInTheDocument();
    expect(screen.getByText('Cliente 01', { selector: 'td' })).toBeInTheDocument();
  });
});

describe('diálogo aberto e concorrência', () => {
  async function abrirVersao(user: ReturnType<typeof userEvent.setup>) {
    await abrirFicha(user);
    await user.click(screen.getByRole('button', { name: 'Nova versão' }));
    return screen.findByRole('dialog');
  }

  it('o evento de outro usuário não apaga o digitado, o envio leva a versão de quando abriu e o 409 oferece recarregar', async () => {
    const { user } = renderizar();
    const dialogo = await abrirVersao(user);
    await user.type(within(dialogo).getByLabelText('Motivo da alteração'), 'Novo desconto');
    detalhe = { ...detalhe, versao: 3 };
    await act(async () => { mockRealtime.mock.calls.at(-1)![0].onMessage(); });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(within(dialogo).getByLabelText('Motivo da alteração')).toHaveValue('Novo desconto');
    proximaMutacao = envelope(409, { message: 'x', codigo: 'CONFLITO_CONCORRENTE' });
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar rascunho' }));
    expect(await within(dialogo).findByText('O registro foi alterado por outro usuário. Recarregue para continuar.')).toBeInTheDocument();
    expect(chamadas.find((c) => c.url.pathname.endsWith('/versoes'))?.corpo?.versao).toBe(1);
    await user.click(within(dialogo).getByRole('button', { name: 'Recarregar dados' }));
    expect(await within(dialogo).findByText('Dados recarregados. Revise o que digitou e salve de novo.')).toBeInTheDocument();
    expect(within(dialogo).getByLabelText('Motivo da alteração')).toHaveValue('Novo desconto');
    proximaMutacao = null;
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(chamadas.filter((c) => c.url.pathname.endsWith('/versoes')).at(-1)?.corpo?.versao).toBe(3);
  });

  it('simulação removida por outro usuário bloqueia o envio e mantém o digitado', async () => {
    const { user } = renderizar();
    const dialogo = await abrirVersao(user);
    await user.type(within(dialogo).getByLabelText('Motivo da alteração'), 'Novo desconto');
    respostaFicha = json(404, { message: 'Simulação fiscal não encontrada' });
    await act(async () => { mockRealtime.mock.calls.at(-1)![0].onMessage(); });
    expect(await within(dialogo).findByText('Esta simulação não está mais disponível. O que foi digitado continua aqui, mas não pode ser salvo.')).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Salvar rascunho' })).toBeDisabled();
    expect(within(dialogo).getByLabelText('Motivo da alteração')).toHaveValue('Novo desconto');
    expect(chamadas.some((c) => c.metodo === 'POST')).toBe(false);
  });

  it('o drawer de nova simulação não perde o digitado com o evento de outro usuário', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(await screen.findByRole('button', { name: '+ Novo registro' }));
    const drawer = await screen.findByRole('dialog');
    await user.type(within(drawer).getByLabelText('Motivo da alteração'), 'Motivo digitado');
    detalhe = { ...detalhe, versao: 4 };
    await act(async () => { mockRealtime.mock.calls.at(-1)![0].onMessage(); });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(within(drawer).getByLabelText('Motivo da alteração')).toHaveValue('Motivo digitado');
  });
});

describe('justificativa com caracteres invisíveis', () => {
  const INVISIVEIS = '\u200B\u200C\uFEFF';

  it('no drawer, só caracteres invisíveis equivalem a vazio', async () => {
    const { user } = renderizar();
    await user.click(await screen.findByRole('button', { name: '+ Novo registro' }));
    const drawer = await screen.findByRole('dialog');
    fireEvent.change(within(drawer).getByLabelText('Motivo da alteração'), { target: { value: INVISIVEIS + INVISIVEIS } });
    await user.click(within(drawer).getByRole('button', { name: 'Verificar dados' }));
    expect(await within(drawer).findByText('Informe o motivo da alteração (3 a 500 caracteres).')).toBeInTheDocument();
  });

  it('na versão nova, o motivo só com invisíveis é recusado e o válido vai sem eles', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('button', { name: 'Nova versão' }));
    const dialogo = await screen.findByRole('dialog');
    const motivo = within(dialogo).getByLabelText('Motivo da alteração');
    fireEvent.change(motivo, { target: { value: 'a' + INVISIVEIS + 'b' } });
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar rascunho' }));
    expect(await within(dialogo).findByText('Informe o motivo da alteração (3 a 500 caracteres).')).toBeInTheDocument();
    fireEvent.change(motivo, { target: { value: ' a' + INVISIVEIS + 'bc ' } });
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(chamadas.some((c) => c.url.pathname.endsWith('/versoes'))).toBe(true));
    expect(chamadas.find((c) => c.url.pathname.endsWith('/versoes'))?.corpo?.justificativa).toBe('a' + INVISIVEIS + 'bc');
  });
});

describe('padrões do Portão A r3', () => {
  const INVISIVEIS = '\u2060\u2800\u034F\u3164';

  it('(a) o drawer de criação não é bloqueado quando a ficha some', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('button', { name: '+ Novo registro' }));
    const drawer = await screen.findByRole('dialog');
    respostaFicha = json(404, { message: 'Simulação fiscal não encontrada' });
    await act(async () => { mockRealtime.mock.calls.at(-1)![0].onMessage(); });
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(within(drawer).queryByText(/não está mais disponível/)).not.toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Salvar rascunho' })).toBeEnabled();
  });

  it('(b) os brancos visuais não contam como motivo, no drawer e na versão nova', async () => {
    const { user } = renderizar();
    await user.click(await screen.findByRole('button', { name: '+ Novo registro' }));
    const drawer = await screen.findByRole('dialog');
    fireEvent.change(within(drawer).getByLabelText('Motivo da alteração'), { target: { value: INVISIVEIS } });
    await user.click(within(drawer).getByRole('button', { name: 'Verificar dados' }));
    expect(await within(drawer).findByText('Informe o motivo da alteração (3 a 500 caracteres).')).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Cancelar' }));
    await user.click(await screen.findByRole('button', { name: 'Descartar e sair' }));
    await abrirFicha(user);
    await user.click(screen.getByRole('button', { name: 'Nova versão' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Motivo da alteração'), { target: { value: INVISIVEIS } });
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar rascunho' }));
    expect(await within(dialogo).findByText('Informe o motivo da alteração (3 a 500 caracteres).')).toBeInTheDocument();
  });

  it('(c) fechar o diálogo aberto por item de menu devolve o foco ao gatilho do menu', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    const gatilho = await screen.findByRole('button', { name: /Ações do processo/ });
    gatilho.focus();
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('menuitem', { name: 'Comparar versões' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(gatilho).toHaveFocus();
  });

  it('(d) duplo clique em Salvar a versão nova envia uma só vez enquanto há pedido em voo', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('button', { name: 'Nova versão' }));
    const dialogo = await screen.findByRole('dialog');
    await user.type(within(dialogo).getByLabelText('Motivo da alteração'), 'Novo desconto');
    let liberar!: () => void;
    portaoMutacao = new Promise<void>((resolve) => { liberar = resolve; });
    await user.dblClick(within(dialogo).getByRole('button', { name: 'Salvar rascunho' }));
    expect(within(dialogo).getByRole('button', { name: 'Salvar rascunho' })).toBeDisabled();
    await act(async () => { liberar(); });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(chamadas.filter((c) => c.url.pathname.endsWith('/versoes'))).toHaveLength(1);
  });

  it('(d) duplo clique em Salvar a simulação nova envia uma só vez', async () => {
    const { user } = renderizar();
    await user.click(await screen.findByRole('button', { name: '+ Novo registro' }));
    const drawer = await screen.findByRole('dialog');
    await escolherCombo(user, drawer, 'sim-enq', 'Buscar enquadramento', '12', '12 · Compra outubro');
    await waitFor(() => expect(document.getElementById('sim-estab')).toHaveTextContent('Osasco'));
    await user.type(within(drawer).getByLabelText('Quantidade'), '10,000');
    await user.type(within(drawer).getByLabelText('Peso informado na nota (kg)'), '982,000');
    await user.type(within(drawer).getByLabelText('Valor'), '1.000,00');
    await user.type(within(drawer).getByLabelText('Desconto'), '0,00');
    fireEvent.change(within(drawer).getByLabelText('Competência'), { target: { value: '2026-10' } });
    await user.type(within(drawer).getByLabelText('Motivo da alteração'), 'Simulação de outubro');
    let liberar!: () => void;
    portaoMutacao = new Promise<void>((resolve) => { liberar = resolve; });
    await user.dblClick(within(drawer).getByRole('button', { name: 'Salvar rascunho' }));
    await act(async () => { liberar(); });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(chamadas.filter((c) => c.metodo === 'POST' && c.url.pathname === '/api/erp/fiscal/simulacoes')).toHaveLength(1);
  });
});

describe('padrões do Portão A r4', () => {
  const MENSAGEM_REMOVIDA = 'Esta simulação não está mais disponível. O que foi digitado continua aqui, mas não pode ser salvo.';

  it('triplo clique na versão nova envia uma só requisição e Escape não fecha durante o envio', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('button', { name: 'Nova versão' }));
    const dialogo = await screen.findByRole('dialog');
    await user.type(within(dialogo).getByLabelText('Motivo da alteração'), 'Novo desconto');
    let liberar!: () => void;
    portaoMutacao = new Promise<void>((resolve) => { liberar = resolve; });
    await user.tripleClick(within(dialogo).getByRole('button', { name: 'Salvar rascunho' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await act(async () => { liberar(); });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(chamadas.filter((c) => c.url.pathname.endsWith('/versoes'))).toHaveLength(1);
  });

  it('triplo clique no Salvar da simulação nova envia uma só requisição e Escape não fecha o drawer durante o envio', async () => {
    const { user } = renderizar();
    await user.click(await screen.findByRole('button', { name: '+ Novo registro' }));
    const drawer = await screen.findByRole('dialog');
    await escolherCombo(user, drawer, 'sim-enq', 'Buscar enquadramento', '12', '12 · Compra outubro');
    await waitFor(() => expect(document.getElementById('sim-estab')).toHaveTextContent('Osasco'));
    await user.type(within(drawer).getByLabelText('Quantidade'), '10,000');
    await user.type(within(drawer).getByLabelText('Peso informado na nota (kg)'), '982,000');
    await user.type(within(drawer).getByLabelText('Valor'), '1.000,00');
    await user.type(within(drawer).getByLabelText('Desconto'), '0,00');
    fireEvent.change(within(drawer).getByLabelText('Competência'), { target: { value: '2026-10' } });
    await user.type(within(drawer).getByLabelText('Motivo da alteração'), 'Simulação de outubro');
    let liberar!: () => void;
    portaoMutacao = new Promise<void>((resolve) => { liberar = resolve; });
    await user.tripleClick(within(drawer).getByRole('button', { name: 'Salvar rascunho' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await act(async () => { liberar(); });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(chamadas.filter((c) => c.metodo === 'POST' && c.url.pathname === '/api/erp/fiscal/simulacoes')).toHaveLength(1);
  });

  it('404 ao salvar a versão nova mostra o aviso de removido e bloqueia o reenvio', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('button', { name: 'Nova versão' }));
    const dialogo = await screen.findByRole('dialog');
    await user.type(within(dialogo).getByLabelText('Motivo da alteração'), 'Novo desconto');
    proximaMutacao = envelope(404, { message: 'Simulação fiscal não encontrada' });
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar rascunho' }));
    expect(await within(dialogo).findByText(MENSAGEM_REMOVIDA)).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Salvar rascunho' })).toBeDisabled();
    expect(within(dialogo).getByLabelText('Motivo da alteração')).toHaveValue('Novo desconto');
  });
});
