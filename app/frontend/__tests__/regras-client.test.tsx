import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegrasClient } from '../src/components/fiscal/regras/regras-client';
import { RegraDrawer } from '../src/components/fiscal/regras/regra-drawer';

const mockRealtime = jest.fn((_opcoes: { onMessage: () => void }) => () => undefined);
jest.mock('../src/lib/realtime', () => ({
  conectarRealtime: (opcoes: { onMessage: () => void }) => mockRealtime(opcoes),
}));

const ID = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a71';
const ID_V1 = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a77';
const ENQ = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a72';
const ENQ_NOVO = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a78';
const OP = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a73';
const CFOP = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a74';
const BEN = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a75';
const CLA = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a76';

function linha(n: number) {
  return {
    id: n === 1 ? ID : `0190a1b2-c3d4-7e5f-8a9b-${String(n).padStart(12, '0')}`,
    codigo: String(n + 1),
    numeroVersao: 1,
    situacao: 'Submetida',
    enquadramentoFiscal: String(n),
    operacaoFiscal: '5102',
    beneficioFiscal: `Benefício ${String(n).padStart(2, '0')}`,
    classificacaoIbsCbs: 'Tributação integral da classificação',
    operacao: `Compra ${String(n).padStart(2, '0')}`,
    tratamentoIcms: 'Redução de base',
  };
}

const DETALHE_BASE = {
  id: ID,
  codigo: '2',
  numeroVersao: 2,
  versao: 2,
  enquadramentoId: ENQ,
  enquadramentoCodigo: '12',
  operacaoId: OP,
  operacaoRotulo: 'Compra outubro',
  cfopId: CFOP,
  cfopCodigo: '5102',
  icmsCst: '20',
  pRedBc: '0.4167',
  pIcms: '0.1200',
  beneficioFiscalId: BEN,
  beneficioDescricao: 'Redução de base — São Paulo',
  ipiCst: '53',
  pisCst: '06',
  ibsCst: '000',
  classificacaoIbsCbsId: CLA,
  classificacaoDescricao: 'Tributação integral da classificação',
  vigenciaInicio: '2026-01-01',
  vigenciaFim: '2026-12-31',
  situacao: 'Submetida',
  empresaNome: 'Alpha Carnes Ltda',
  responsavel: 'Maria Souza',
  criadoEm: '2026-10-14T12:00:00.000Z',
  atualizadoEm: '2026-10-14T15:30:00.000Z',
  autor: 'Maria Souza',
  aprovador: null,
  tratamentoIcms: 'Redução de base',
  tratamentoIpi: 'Saída não tributada',
  tratamentoPis: 'Alíquota zero',
  tratamentoIbs: 'Tributação integral',
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

let total = 1;
let detalhe = { ...DETALHE_BASE };
let historico: unknown[] = [];
let proximaMutacao: Response | null = null;
let respostaFicha: Response | null = null;
let respostaPre: Response | null = null;
let respostaComparar: Response | null = null;
let liberarFicha: Promise<void> | null = null;
let chamadas: Chamada[] = [];
/** Segura as mutações (POST/PATCH) até ser liberado, para haver pedido em voo. */
let portaoMutacao: Promise<void> | null = null;
/** Segura a resposta da listagem cuja busca é a chave, para simular resposta que chega fora de ordem. */
let portoesLista: Record<string, Promise<void>> = {};

const VERSOES = [
  { ...linha(1), id: ID_V1, numeroVersao: 1, situacao: 'Aprovada' },
  { ...linha(1), numeroVersao: 2, situacao: 'Submetida' },
];

async function responder(metodo: string, url: URL, _corpo: Record<string, unknown> | null): Promise<Response> {
  const caminho = url.pathname;
  if (caminho.startsWith('/api/admin/parametros')) return json(200, { valorJson: { provisorio: true } });
  if (metodo === 'GET' && caminho === '/api/erp/fiscal/regras/contagens') {
    return json(200, { total, rascunhos: 0, submetidas: total, aprovadas: 0, aposentadas: 0 });
  }
  if (metodo === 'GET' && caminho === '/api/erp/fiscal/regras') {
    if (url.searchParams.get('codigo')) return json(200, { data: VERSOES, total: VERSOES.length, page: 1, pageSize: 100 });
    const busca = url.searchParams.get('search') ?? '';
    if (portoesLista[busca]) await portoesLista[busca];
    if (busca === 'lento') return json(200, { data: [linha(7)], total: 1, page: 1, pageSize: 20 });
    const pagina = Number(url.searchParams.get('page') ?? '1');
    const quantas = Math.max(0, Math.min(20, total - (pagina - 1) * 20));
    const dados = Array.from({ length: quantas }, (_, i) => linha((pagina - 1) * 20 + i + 1));
    return json(200, { data: dados, total, page: pagina, pageSize: 20 });
  }
  if (metodo === 'GET' && caminho === `/api/erp/fiscal/regras/${ID}`) {
    if (liberarFicha) await liberarFicha;
    return respostaFicha ?? json(200, detalhe);
  }
  if (metodo === 'GET' && caminho === `/api/erp/fiscal/regras/${ID}/historico`) return json(200, historico);
  if (metodo === 'GET' && caminho === `/api/erp/fiscal/regras/${ID}/pre-condicoes`) {
    return respostaPre ?? json(200, [
      { codigo: 'CAMPOS_TRIBUTARIOS', atendida: true, provisoria: false },
      { codigo: 'DUPLA_APROVACAO', atendida: false, provisoria: true, texto: 'Um aprovador diferente de quem submeteu registra a aprovação. Quantos aprovadores formam quórum ainda não foi decidido.' },
    ]);
  }
  if (metodo === 'GET' && caminho === `/api/erp/fiscal/regras/${ID}/comparar`) {
    return respostaComparar ?? json(200, { codigo: '2', numeroVersaoAntes: 1, numeroVersaoDepois: 2, diferencas: [
      { campo: 'Alíquota (%)', antes: '12,00', depois: '7,00' },
      { campo: 'Início de vigência', antes: '2026-01-01', depois: '2026-03-01' },
    ] });
  }
  if (metodo !== 'GET' && caminho.startsWith('/api/erp/fiscal/regras')) {
    if (portaoMutacao) await portaoMutacao;
    if (proximaMutacao) return proximaMutacao;
    if (metodo === 'PATCH') {
      detalhe = { ...detalhe, versao: detalhe.versao + 1, pIcms: '0.0700' };
      return json(200, detalhe);
    }
    if (caminho.endsWith('/aprovar')) {
      detalhe = { ...detalhe, situacao: 'Aprovada', versao: detalhe.versao + 1 };
      return json(200, detalhe);
    }
    return json(200, detalhe);
  }
  if (metodo === 'GET' && caminho === `/api/erp/fiscal/enquadramentos/${ENQ_NOVO}`) {
    return json(200, { operacaoId: OP, operacaoRotulo: 'Compra outubro', cfopId: CFOP, cfopCodigo: '5102', cfopDescricao: 'Venda' });
  }
  if (caminho.startsWith('/api/erp/fiscal/enquadramentos')) {
    return json(200, { data: [{ id: ENQ_NOVO, codigo: '31', operacao: 'Compra outubro', situacao: 'ATIVA' }], total: 1 });
  }
  if (caminho.startsWith('/api/erp/fiscal/cfops')) return json(200, { data: [{ id: CFOP, codigo: '5102', descricao: 'Venda' }], total: 1 });
  if (caminho.startsWith('/api/operacoes')) return json(200, { data: [{ id: OP, rotulo: 'Compra outubro', data: '2026-10-01' }], total: 1 });
  if (caminho.startsWith('/api/erp/fiscal/beneficios-fiscais')) {
    return json(200, { data: [{ id: BEN, codigo: 'SP020450', descricao: 'Redução de base — São Paulo' }], total: 1 });
  }
  if (caminho.startsWith('/api/erp/fiscal/classificacoes-ibs-cbs')) {
    return json(200, { data: [{ id: CLA, codigo: '000001', descricao: 'Tributação integral da classificação' }], total: 1 });
  }
  return json(404, { message: 'Não encontrado.' });
}

beforeEach(() => {
  total = 1;
  detalhe = { ...DETALHE_BASE };
  historico = [];
  proximaMutacao = null;
  respostaFicha = null;
  respostaPre = null;
  respostaComparar = null;
  liberarFicha = null;
  chamadas = [];
  portoesLista = {};
  portaoMutacao = null;
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

function renderizar(props: { podeGerenciar?: boolean; podeAprovar?: boolean } = {}) {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  return { user, ...render(<RegrasClient podeGerenciar={props.podeGerenciar ?? true} podeAprovar={props.podeAprovar ?? true} />) };
}

async function abrirFicha(user: ReturnType<typeof userEvent.setup>, rotulo = 'Compra 01') {
  const celula = await screen.findByText(rotulo, { selector: 'td' });
  celula.closest('tr')!.focus();
  await user.keyboard('{Enter}');
  await screen.findByText('Alpha Carnes Ltda');
}

function valorDe(rotulo: string) {
  return screen.getByText(rotulo, { selector: 'p' }).nextElementSibling;
}

function listagens() {
  return chamadas.filter((c) => c.metodo === 'GET' && c.url.pathname === '/api/erp/fiscal/regras' && !c.url.searchParams.get('codigo'));
}

async function abrirAcao(user: ReturnType<typeof userEvent.setup>, nome: string) {
  await user.click(screen.getByRole('tab', { name: 'Movimentações' }));
  await user.click(await screen.findByRole('button', { name: nome }));
  return screen.findByRole('dialog');
}

describe('rótulos e estados da tela', () => {
  it('rótulos literais do protótipo no drawer', () => {
    render(<RegraDrawer aberto detalhe={null} onFechar={() => undefined} onSalvar={async () => null} onNovoCodigo={() => undefined} />);
    expect(screen.getByLabelText('Tratamento ICMS')).toBeInTheDocument();
    expect(screen.getAllByRole('option', { name: 'Tributação integral' })).toHaveLength(2);
    expect(screen.getByRole('option', { name: 'Redução de base' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Isenção' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Não tributada' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Diferimento' })).toBeInTheDocument();
    expect(screen.getByLabelText('Redução de base do ICMS (%)')).toBeInTheDocument();
    expect(screen.getByLabelText('Alíquota (%)')).toBeInTheDocument();
    expect(screen.getByLabelText('Tratamento IPI')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Saída tributada à alíquota zero' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Outras saídas' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tratamento PIS/COFINS')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sem incidência' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tratamento IBS/CBS')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Alíquota reduzida' })).toBeInTheDocument();
    expect(screen.getByLabelText('Benefício fiscal')).toBeInTheDocument();
    expect(screen.getByLabelText('Classificação IBS/CBS')).toBeInTheDocument();
    expect(screen.getByLabelText('Justificativa auditável')).toBeInTheDocument();
    const texto = document.body.textContent ?? '';
    expect(texto).not.toMatch(/CSOSN/);
    expect(texto).not.toMatch(/E01-T03/);
    expect(texto).not.toMatch(/Marca/);
  });

  it('lista vazia usa a frase do protótipo', async () => {
    total = 0;
    renderizar();
    expect(await screen.findByText('Nenhum resultado para o período, filtro ou situação escolhidos. Limpe os filtros ou cadastre um novo registro.')).toBeInTheDocument();
  });

  it('falha ao listar aparece com "Tentar novamente", sem esconder o erro', async () => {
    global.fetch = jest.fn(async () => json(500, { message: 'x' })) as unknown as typeof fetch;
    const { user } = renderizar();
    expect(await screen.findByText(/Serviço indisponível no momento/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  });
});

describe('lista paginada e ordenada no servidor', () => {
  it('mostra "Exibindo N de M", troca de página e volta à página 1 ao ordenar e buscar', async () => {
    total = 45;
    const { user } = renderizar();
    expect(await screen.findByText(/Exibindo 20 de 45 registros/)).toBeInTheDocument();
    expect(screen.getByText(/Página 1 de 3/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(await screen.findByText(/Página 2 de 3/)).toBeInTheDocument();
    expect(await screen.findByText('Compra 21', { selector: 'td' })).toBeInTheDocument();
    expect(listagens().at(-1)?.url.searchParams.get('page')).toBe('2');
    await user.click(screen.getByRole('button', { name: 'Benefício fiscal' }));
    await waitFor(() => expect(listagens().at(-1)?.url.searchParams.get('sort')).toBe('cBenef'));
    expect(listagens().at(-1)?.url.searchParams.get('dir')).toBe('asc');
    expect(listagens().at(-1)?.url.searchParams.get('page')).toBe('1');
    await user.click(screen.getByRole('button', { name: 'Benefício fiscal' }));
    await waitFor(() => expect(listagens().at(-1)?.url.searchParams.get('dir')).toBe('desc'));
    expect(screen.getByRole('columnheader', { name: /Benefício fiscal/ })).toHaveAttribute('aria-sort', 'descending');
    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await screen.findByText(/Página 2 de 3/);
    await user.type(screen.getByLabelText('Pesquisar descrição ou referência de negócio'), 'a');
    await waitFor(() => expect(listagens().at(-1)?.url.searchParams.get('search')).toBe('a'));
    expect(listagens().at(-1)?.url.searchParams.get('page')).toBe('1');
  });

  it('Exportar e Exportar visão levam a busca e a ordenação da tela', async () => {
    const criar = jest.fn(() => 'blob:csv');
    Object.assign(URL, { createObjectURL: criar, revokeObjectURL: jest.fn() });
    const clique = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const { user } = renderizar();
    await screen.findByText('Compra 01', { selector: 'td' });
    await user.type(screen.getByLabelText('Pesquisar descrição ou referência de negócio'), 'compra');
    await user.click(screen.getByRole('button', { name: 'Operação' }));
    await waitFor(() => expect(listagens().at(-1)?.url.searchParams.get('sort')).toBe('operacao'));
    for (const nome of ['Exportar visão', 'Exportar']) {
      await user.click(screen.getByRole('button', { name: nome }));
    }
    const exportacoes = chamadas.filter((c) => c.url.pathname === '/api/erp/fiscal/regras/exportacao');
    expect(exportacoes).toHaveLength(2);
    for (const exportacao of exportacoes) {
      expect(exportacao.url.searchParams.get('search')).toBe('compra');
      expect(exportacao.url.searchParams.get('sort')).toBe('operacao');
      expect(exportacao.url.searchParams.get('dir')).toBe('asc');
    }
    clique.mockRestore();
  });
});

describe('ficha', () => {
  it('mostra carregando, datas em dd/MM/aaaa, rótulos de negócio e selos, sem uuid', async () => {
    let liberar!: () => void;
    liberarFicha = new Promise<void>((resolve) => { liberar = resolve; });
    const { user, container } = renderizar();
    const celula = await screen.findByText('Compra 01', { selector: 'td' });
    celula.closest('tr')!.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByLabelText('Carregando a ficha')).toBeInTheDocument();
    liberar();
    expect(await screen.findByText('Alpha Carnes Ltda')).toBeInTheDocument();
    expect(valorDe('Início de vigência')).toHaveTextContent('01/01/2026');
    expect(valorDe('Fim de vigência')).toHaveTextContent('31/12/2026');
    expect(valorDe('Criado em')).toHaveTextContent('14/10/2026 09:00');
    expect(valorDe('Alterado em')).toHaveTextContent('14/10/2026 12:30');
    expect(valorDe('Enquadramento fiscal')).toHaveTextContent('12');
    expect(valorDe('Operação fiscal (CFOP)')).toHaveTextContent('5.102');
    expect(valorDe('Benefício fiscal')).toHaveTextContent('Redução de base — São Paulo');
    expect(valorDe('Tratamento IPI')).toHaveTextContent('Saída não tributada');
    expect(valorDe('Versão')).toHaveTextContent('2');
    for (const selo of ['H-E01-10', 'H-E01-11', 'H-E01-12']) expect(container.textContent).toContain(selo);
    expect(container.textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });

  it('falha ao carregar a ficha aparece na tela', async () => {
    respostaFicha = json(500, { message: 'x' });
    const { user } = renderizar();
    const celula = await screen.findByText('Compra 01', { selector: 'td' });
    celula.closest('tr')!.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByText(/Serviço indisponível no momento/)).toBeInTheDocument();
  });

  it('Consultar histórico ativa a aba e mostra "quando • quem" em dd/MM/aaaa HH:mm', async () => {
    historico = [{
      operacao: 'INSERT', situacaoAnterior: null, situacaoNova: 'RASCUNHO', usuarioNome: 'Maria Souza',
      criadoEm: '2026-10-14T12:00:00.000Z', justificativa: 'Regra inicial', resumo: 'Regra criada', versao: 1, numeroVersao: 2,
    }];
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('button', { name: 'Consultar histórico' }));
    expect(screen.getByRole('tab', { name: 'Histórico' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('14/10/2026 09:00 • Maria Souza')).toBeInTheDocument();
    expect(screen.getByText('Justificativa: Regra inicial')).toBeInTheDocument();
    expect(screen.getByText('Versão 2')).toBeInTheDocument();
  });

  it('falha ao consultar o histórico aparece dentro da aba', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    const base = global.fetch as jest.Mock;
    global.fetch = jest.fn(async (entrada: string, init?: RequestInit) => {
      if (String(entrada).endsWith('/historico')) return json(500, { message: 'x' });
      return base(entrada, init);
    }) as unknown as typeof fetch;
    await user.click(screen.getByRole('button', { name: 'Consultar histórico' }));
    expect(await screen.findByText(/Serviço indisponível no momento/)).toBeInTheDocument();
  });

  it('Validar pré-condições mostra o resultado e o erro de carga', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('button', { name: 'Validar pré-condições' }));
    expect(await screen.findByText('Campos tributários preenchidos: atendida')).toBeInTheDocument();
    expect(screen.getByText('Dupla aprovação definida: provisória', { exact: false })).toBeInTheDocument();
    respostaPre = json(500, { message: 'x' });
    await user.click(screen.getByRole('button', { name: 'Validar pré-condições' }));
    expect(await screen.findByText(/Serviço indisponível no momento/)).toBeInTheDocument();
    expect(screen.queryByText('Campos tributários preenchidos: atendida')).not.toBeInTheDocument();
  });

  it('abas Integrações e Aceite seguem o protótipo: critérios em leitura e referência do requisito', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('tab', { name: 'Aceite e testes' }));
    expect(screen.getByText('Interface respeita o DS v3, teclado, estados vazios e tratamento de carregamento/erro')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').filter((li) => li.closest('ul[aria-label="Critérios de aceite"]'))).toHaveLength(8);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText('Referência do requisito')).toBeInTheDocument();
    expect(screen.getByText(/motor de regras não permite edição retroativa/, { selector: 'div' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Integrações' }));
    expect(screen.getByText('Dependências e conexões do domínio')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Central de Integrações' })).toBeDisabled();
  });
});

describe('ações do processo', () => {
  it('pede a justificativa vazia, com mínimo de 3 caracteres, e a envia', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    const dialogo = await abrirAcao(user, 'Aprovar');
    const campo = within(dialogo).getByLabelText(/Justificativa/);
    expect(campo).toHaveValue('');
    await user.click(within(dialogo).getByRole('button', { name: 'Aprovar' }));
    expect(await within(dialogo).findByText('Informe a justificativa (mínimo de 3 caracteres).')).toBeInTheDocument();
    expect(chamadas.some((c) => c.url.pathname.endsWith('/aprovar'))).toBe(false);
    await user.type(campo, 'ab');
    await user.click(within(dialogo).getByRole('button', { name: 'Aprovar' }));
    expect(await within(dialogo).findByText('Informe a justificativa (mínimo de 3 caracteres).')).toBeInTheDocument();
    await user.clear(campo);
    await user.type(campo, 'Aprovada pelo segundo usuário');
    await user.click(within(dialogo).getByRole('button', { name: 'Aprovar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const aprovar = chamadas.find((c) => c.url.pathname.endsWith('/aprovar'));
    expect(aprovar?.corpo).toEqual({ versao: 2, justificativa: 'Aprovada pelo segundo usuário' });
  });

  it('o 422 de segregação aparece no diálogo, que continua aberto', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    const dialogo = await abrirAcao(user, 'Aprovar');
    proximaMutacao = envelope(422, {
      message: 'A aprovação deve ser feita por usuário diferente de quem submeteu.',
      codigo: 'SEGREGACAO_FUNCAO',
    });
    await user.type(within(dialogo).getByLabelText(/Justificativa/), 'Tentativa do autor');
    await user.click(within(dialogo).getByRole('button', { name: 'Aprovar' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('A aprovação deve ser feita por usuário diferente de quem submeteu.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('a recusa do benefício e da vigência aparece na aba Exceções', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    const dialogo = await abrirAcao(user, 'Aprovar');
    proximaMutacao = envelope(422, {
      message: 'Já existe versão aprovada deste enquadramento com vigência sobreposta. Nenhuma foi escolhida.',
      codigo: 'VIGENCIA_AMBIGUA',
    });
    await user.type(within(dialogo).getByLabelText(/Justificativa/), 'Aprovando agora');
    await user.click(within(dialogo).getByRole('button', { name: 'Aprovar' }));
    await within(dialogo).findByRole('alert');
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    await user.click(screen.getByRole('tab', { name: 'Exceções' }));
    expect(screen.getByText('Já existe versão aprovada deste enquadramento com vigência sobreposta. Nenhuma foi escolhida.')).toBeInTheDocument();
    expect(screen.getByText(/Nenhuma gravação é recusada por esse motivo/)).toBeInTheDocument();
  });

  it('o botão Aprovar só habilita na situação Submetida e os demais seguem a situação', async () => {
    detalhe = { ...detalhe, situacao: 'Aprovada' };
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('tab', { name: 'Movimentações' }));
    expect(await screen.findByRole('button', { name: 'Aprovar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submeter' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Aposentar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Adicionar versão' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Comparar' })).toBeEnabled();
  });

  it('o evento em tempo real refaz a ficha aberta', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    expect(valorDe('Alíquota (%)')).toHaveTextContent('12,00');
    detalhe = { ...detalhe, pIcms: '0.0900', versao: 3 };
    await act(async () => { mockRealtime.mock.calls.at(-1)![0].onMessage(); });
    await waitFor(() => expect(valorDe('Alíquota (%)')).toHaveTextContent('9,00'));
  });
});

describe('comparar versões', () => {
  it('oferece só as versões do mesmo código, com número da versão e situação', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    const dialogo = await abrirAcao(user, 'Comparar');
    const seletor = await within(dialogo).findByLabelText('Outra versão');
    const textos = within(seletor).getAllByRole('option').map((o) => o.textContent);
    expect(textos).toEqual(['Selecione', '2 · versão 1 · Aprovada']);
    const consulta = chamadas.find((c) => c.url.searchParams.get('codigo'));
    expect(consulta?.url.searchParams.get('codigo')).toBe('2');
  });

  it('lista as diferenças com datas em dd/MM/aaaa e avisa quando não há diferenças', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    const dialogo = await abrirAcao(user, 'Comparar');
    await user.selectOptions(await within(dialogo).findByLabelText('Outra versão'), ID_V1);
    await user.click(within(dialogo).getByRole('button', { name: 'Comparar' }));
    const itens = await within(dialogo).findAllByRole('listitem');
    expect(itens[0]).toHaveTextContent('Alíquota (%): 12,00 → 7,00');
    expect(itens[1]).toHaveTextContent('Início de vigência: 01/01/2026 → 01/03/2026');
    respostaComparar = json(200, { codigo: '2', numeroVersaoAntes: 1, numeroVersaoDepois: 2, diferencas: [] });
    await user.click(within(dialogo).getByRole('button', { name: 'Comparar' }));
    expect(await within(dialogo).findByText('As duas versões não têm diferenças.')).toBeInTheDocument();
  });

  it('o erro da comparação aparece dentro do diálogo', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    const dialogo = await abrirAcao(user, 'Comparar');
    await user.selectOptions(await within(dialogo).findByLabelText('Outra versão'), ID_V1);
    respostaComparar = envelope(422, { message: 'x', codigo: 'REGRAS_DISTINTAS' });
    await user.click(within(dialogo).getByRole('button', { name: 'Comparar' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('A comparação exige duas versões do mesmo código.');
  });
});

describe('drawer', () => {
  async function abrirEdicao(user: ReturnType<typeof userEvent.setup>) {
    detalhe = { ...detalhe, situacao: 'Rascunho' };
    await abrirFicha(user);
    await user.click(await screen.findByRole('button', { name: 'Editar versão' }));
    return screen.findByRole('dialog');
  }

  it('Verificar dados confere os obrigatórios localmente e confirma quando está tudo certo', async () => {
    const { user } = renderizar();
    const drawer = await abrirEdicao(user);
    await user.click(within(drawer).getByRole('button', { name: 'Verificar dados' }));
    expect(await within(drawer).findByText('Informe a justificativa (3 a 500 caracteres).')).toBeInTheDocument();
    expect(within(drawer).queryByText('Dados verificados.')).not.toBeInTheDocument();
    await user.type(within(drawer).getByLabelText('Justificativa auditável'), 'Ajuste da alíquota');
    await user.click(within(drawer).getByRole('button', { name: 'Verificar dados' }));
    expect(await within(drawer).findByText('Dados verificados.')).toBeInTheDocument();
  });

  it('valida o percentual e a vigência antes de chamar o servidor', async () => {
    const { user } = renderizar();
    const drawer = await abrirEdicao(user);
    const aliquota = within(drawer).getByLabelText('Alíquota (%)');
    await user.clear(aliquota);
    await user.type(aliquota, '120');
    await user.type(within(drawer).getByLabelText('Justificativa auditável'), 'Ajuste da alíquota');
    await user.click(within(drawer).getByRole('button', { name: 'Salvar rascunho' }));
    expect(await within(drawer).findByText('Informe um percentual de 0,00 a 100,00.')).toBeInTheDocument();
    expect(chamadas.some((c) => c.metodo === 'PATCH')).toBe(false);
  });

  it('erro 400 do servidor leva o rótulo do campo, também junto do campo', async () => {
    const { user } = renderizar();
    const drawer = await abrirEdicao(user);
    await user.type(within(drawer).getByLabelText('Justificativa auditável'), 'Ajuste da alíquota');
    proximaMutacao = envelope(400, {
      message: 'Validação falhou',
      errors: [
        { path: ['pIcms'], message: 'Percentual inválido' },
        { path: ['vigenciaInicio'], message: 'Data inválida' },
      ],
    });
    await user.click(within(drawer).getByRole('button', { name: 'Salvar rascunho' }));
    const alertas = await within(drawer).findAllByRole('alert');
    const geral = alertas.find((a) => a.textContent?.includes('Alíquota (%): Percentual inválido'));
    expect(geral).toHaveTextContent('Início de vigência: Data inválida');
    expect(geral?.textContent).not.toMatch(/pIcms|vigenciaInicio/);
    expect(alertas.some((a) => a.textContent === 'Percentual inválido')).toBe(true);
  });

  it('segunda edição imediata usa a versão recarregada, sem 409 falso', async () => {
    const { user } = renderizar();
    const salvar = async () => {
      detalhe = { ...detalhe, situacao: 'Rascunho' };
      await user.click(await screen.findByRole('button', { name: 'Editar versão' }));
      const drawer = await screen.findByRole('dialog');
      await user.type(within(drawer).getByLabelText('Justificativa auditável'), 'Ajuste da alíquota');
      await user.click(within(drawer).getByRole('button', { name: 'Salvar rascunho' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    };
    detalhe = { ...detalhe, situacao: 'Rascunho' };
    await abrirFicha(user);
    await salvar();
    await waitFor(() => expect(valorDe('Alíquota (%)')).toHaveTextContent('7,00'));
    await salvar();
    const patches = chamadas.filter((c) => c.metodo === 'PATCH');
    expect(patches).toHaveLength(2);
    expect(patches[0]!.corpo?.versao).toBe(2);
    expect(patches[1]!.corpo?.versao).toBe(3);
  });

  it('sair com pendência abre o diálogo do DS, não o confirm do navegador', async () => {
    const confirmar = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = renderizar();
    const drawer = await abrirEdicao(user);
    await user.type(within(drawer).getByLabelText('Justificativa auditável'), 'Texto pendente');
    await user.click(within(drawer).getByRole('button', { name: 'Cancelar' }));
    const alerta = await screen.findByRole('alertdialog');
    expect(alerta).toHaveTextContent('Descartar alterações?');
    expect(confirmar).not.toHaveBeenCalled();
    await user.click(within(alerta).getByRole('button', { name: 'Continuar editando' }));
    expect(screen.getByLabelText('Justificativa auditável')).toHaveValue('Texto pendente');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(await screen.findByRole('button', { name: 'Descartar e sair' }));
    await waitFor(() => expect(screen.queryByLabelText('Justificativa auditável')).not.toBeInTheDocument());
    confirmar.mockRestore();
  });

  it('os combos buscam no servidor e o enquadramento preenche operação e CFOP', async () => {
    const { user } = renderizar();
    await user.click(await screen.findByRole('button', { name: '+ Novo registro' }));
    const drawer = await screen.findByRole('dialog');
    await user.click(within(drawer).getByRole('combobox', { name: /Enquadramento fiscal/ }));
    await user.type(await screen.findByPlaceholderText('Buscar enquadramento'), '31');
    await waitFor(() => {
      const busca = chamadas.filter((c) => c.url.pathname === '/api/erp/fiscal/enquadramentos' && c.url.searchParams.get('search') === '31');
      expect(busca.length).toBeGreaterThan(0);
    });
    await user.click(await screen.findByRole('option', { name: '31 · Compra outubro' }));
    await waitFor(() => expect(document.getElementById('reg-op')).toHaveTextContent('Compra outubro'));
    expect(document.getElementById('reg-cfop')).toHaveTextContent('5.102');
  });

  it('falha ao carregar o enquadramento não é engolida', async () => {
    const { user } = renderizar();
    await user.click(await screen.findByRole('button', { name: '+ Novo registro' }));
    const drawer = await screen.findByRole('dialog');
    const base = global.fetch as jest.Mock;
    global.fetch = jest.fn(async (entrada: string, init?: RequestInit) => {
      if (new URL(String(entrada), 'http://localhost').pathname === `/api/erp/fiscal/enquadramentos/${ENQ_NOVO}`) return json(500, { message: 'x' });
      return base(entrada, init);
    }) as unknown as typeof fetch;
    await user.click(within(drawer).getByRole('combobox', { name: /Enquadramento fiscal/ }));
    await user.type(await screen.findByPlaceholderText('Buscar enquadramento'), '31');
    await user.click(await screen.findByRole('option', { name: '31 · Compra outubro' }));
    expect(await within(drawer).findByText(/Não foi possível carregar a operação e o CFOP do enquadramento/)).toBeInTheDocument();
  });
});

describe('adicionar versão', () => {
  async function abrirVersao(user: ReturnType<typeof userEvent.setup>) {
    detalhe = { ...detalhe, situacao: 'Aprovada' };
    await abrirFicha(user);
    await user.click(screen.getByRole('tab', { name: 'Movimentações' }));
    await user.click(await screen.findByRole('button', { name: 'Adicionar versão' }));
    return screen.findByRole('dialog');
  }

  it('valida alíquota e motivo no formulário e envia pelo botão de salvar', async () => {
    const { user } = renderizar();
    const dialogo = await abrirVersao(user);
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar rascunho' }));
    expect(await within(dialogo).findByText('Informe o motivo (3 a 500 caracteres).')).toBeInTheDocument();
    expect(chamadas.some((c) => c.url.pathname.endsWith('/versoes'))).toBe(false);
    await user.type(within(dialogo).getByLabelText('Motivo da versão'), 'Nova alíquota da portaria');
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const envio = chamadas.find((c) => c.url.pathname.endsWith('/versoes'));
    expect(envio?.corpo).toMatchObject({ pIcms: '12,00', justificativa: 'Nova alíquota da portaria', versao: 2 });
  });

  it('o 409 de versão aberta continua no diálogo', async () => {
    const { user } = renderizar();
    const dialogo = await abrirVersao(user);
    proximaMutacao = envelope(409, { message: 'x', codigo: 'VERSAO_ABERTA' });
    await user.type(within(dialogo).getByLabelText('Motivo da versão'), 'Nova alíquota da portaria');
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar rascunho' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Já existe versão em rascunho ou submetida para este código.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('lista: resposta obsoleta e busca com atraso', () => {
  it('a busca só chega ao servidor quando a digitação para, com uma única consulta', async () => {
    const { user } = renderizar();
    await screen.findByText('Compra 01', { selector: 'td' });
    const antes = listagens().length;
    await user.type(screen.getByLabelText('Pesquisar descrição ou referência de negócio'), 'abc');
    expect(listagens().length).toBe(antes);
    await waitFor(() => expect(listagens().at(-1)?.url.searchParams.get('search')).toBe('abc'));
    const buscas = listagens().slice(antes).map((c) => c.url.searchParams.get('search'));
    expect(buscas).toEqual(['abc']);
  });

  it('descarta a resposta antiga que chega depois da nova (linhas, contagens e KPIs)', async () => {
    let liberar!: () => void;
    portoesLista.lento = new Promise<void>((resolve) => { liberar = resolve; });
    const { user } = renderizar();
    await screen.findByText('Compra 01', { selector: 'td' });
    const campo = screen.getByLabelText('Pesquisar descrição ou referência de negócio');
    await user.type(campo, 'lento');
    await waitFor(() => expect(listagens().some((c) => c.url.searchParams.get('search') === 'lento')).toBe(true));
    await user.clear(campo);
    await waitFor(() => expect(listagens().at(-1)?.url.searchParams.get('search') ?? '').toBe(''));
    total = 5;
    await act(async () => { liberar(); });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText('Compra 07', { selector: 'td' })).not.toBeInTheDocument();
    expect(screen.getByText('Compra 01', { selector: 'td' })).toBeInTheDocument();
  });
});

describe('formulário aberto e concorrência', () => {
  async function abrirEdicao(user: ReturnType<typeof userEvent.setup>) {
    detalhe = { ...detalhe, situacao: 'Rascunho' };
    await abrirFicha(user);
    await user.click(await screen.findByRole('button', { name: 'Editar versão' }));
    return screen.findByRole('dialog');
  }

  const leituras = () => chamadas.filter((c) => c.metodo === 'GET' && c.url.pathname === '/api/erp/fiscal/regras/' + ID).length;

  it('o evento de outro usuário não apaga o digitado e o envio leva a versão de quando abriu; 409 oferece recarregar', async () => {
    const { user } = renderizar();
    const drawer = await abrirEdicao(user);
    await user.type(within(drawer).getByLabelText('Justificativa auditável'), 'Meu texto');
    const antes = leituras();
    detalhe = { ...detalhe, versao: 3, pIcms: '0.0900' };
    await act(async () => { mockRealtime.mock.calls.at(-1)![0].onMessage(); });
    await waitFor(() => expect(leituras()).toBeGreaterThan(antes));
    expect(within(drawer).getByLabelText('Justificativa auditável')).toHaveValue('Meu texto');
    expect(within(drawer).getByLabelText('Alíquota (%)')).toHaveValue('12,00');
    proximaMutacao = envelope(409, { message: 'x', codigo: 'CONFLITO_CONCORRENTE' });
    await user.click(within(drawer).getByRole('button', { name: 'Salvar rascunho' }));
    expect(await within(drawer).findByText('O registro foi alterado por outro usuário. Recarregue para continuar.')).toBeInTheDocument();
    expect(chamadas.filter((c) => c.metodo === 'PATCH').at(-1)?.corpo?.versao).toBe(2);
    await user.click(within(drawer).getByRole('button', { name: 'Recarregar dados' }));
    expect(await within(drawer).findByText('Dados recarregados. Revise o que digitou e salve de novo.')).toBeInTheDocument();
    expect(within(drawer).getByLabelText('Justificativa auditável')).toHaveValue('Meu texto');
    proximaMutacao = null;
    await user.click(within(drawer).getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(chamadas.filter((c) => c.metodo === 'PATCH').at(-1)?.corpo?.versao).toBe(3);
  });

  it('registro removido por outro usuário bloqueia a edição, mantém o digitado e nunca cria', async () => {
    const { user } = renderizar();
    const drawer = await abrirEdicao(user);
    await user.type(within(drawer).getByLabelText('Justificativa auditável'), 'Meu texto');
    respostaFicha = json(404, { message: 'Regra tributária não encontrada' });
    await act(async () => { mockRealtime.mock.calls.at(-1)![0].onMessage(); });
    expect(await within(drawer).findByText('Esta regra não está mais disponível. O que foi digitado continua aqui, mas não pode ser salvo.')).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Salvar rascunho' })).toBeDisabled();
    expect(within(drawer).getByLabelText('Justificativa auditável')).toHaveValue('Meu texto');
    expect(chamadas.some((c) => c.metodo === 'POST' && c.url.pathname === '/api/erp/fiscal/regras')).toBe(false);
  });

  it('a decisão leva a versão de quando abriu e 409 oferece recarregar dados', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    const dialogo = await abrirAcao(user, 'Aprovar');
    detalhe = { ...detalhe, versao: 3 };
    await act(async () => { mockRealtime.mock.calls.at(-1)![0].onMessage(); });
    proximaMutacao = envelope(409, { message: 'x', codigo: 'CONFLITO_CONCORRENTE' });
    await user.type(within(dialogo).getByLabelText(/Justificativa/), 'Aprovando agora');
    await user.click(within(dialogo).getByRole('button', { name: 'Aprovar' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('O registro foi alterado por outro usuário. Recarregue para continuar.');
    expect(chamadas.find((c) => c.url.pathname.endsWith('/aprovar'))?.corpo?.versao).toBe(2);
    await user.click(within(dialogo).getByRole('button', { name: 'Recarregar dados' }));
    expect(await within(dialogo).findByText('Dados recarregados. Revise o que digitou e confirme de novo.')).toBeInTheDocument();
    expect(within(dialogo).getByLabelText(/Justificativa/)).toHaveValue('Aprovando agora');
    proximaMutacao = null;
    await user.click(within(dialogo).getByRole('button', { name: 'Aprovar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(chamadas.filter((c) => c.url.pathname.endsWith('/aprovar')).at(-1)?.corpo?.versao).toBe(3);
  });

  it('a versão nova leva a versão de quando abriu e não perde o digitado com o evento', async () => {
    detalhe = { ...detalhe, situacao: 'Aprovada' };
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('tab', { name: 'Movimentações' }));
    await user.click(await screen.findByRole('button', { name: 'Adicionar versão' }));
    const dialogo = await screen.findByRole('dialog');
    await user.type(within(dialogo).getByLabelText('Motivo da versão'), 'Nova alíquota');
    detalhe = { ...detalhe, versao: 3 };
    await act(async () => { mockRealtime.mock.calls.at(-1)![0].onMessage(); });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(within(dialogo).getByLabelText('Motivo da versão')).toHaveValue('Nova alíquota');
    proximaMutacao = envelope(409, { message: 'x', codigo: 'CONFLITO_CONCORRENTE' });
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar rascunho' }));
    await within(dialogo).findByText('O registro foi alterado por outro usuário. Recarregue para continuar.');
    expect(chamadas.find((c) => c.url.pathname.endsWith('/versoes'))?.corpo?.versao).toBe(2);
    await user.click(within(dialogo).getByRole('button', { name: 'Recarregar dados' }));
    await within(dialogo).findByText('Dados recarregados. Revise o que digitou e salve de novo.');
    proximaMutacao = null;
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(chamadas.filter((c) => c.url.pathname.endsWith('/versoes')).at(-1)?.corpo?.versao).toBe(3);
  });
});

describe('justificativa com caracteres invisíveis', () => {
  const INVISIVEIS = '\u200B\u200C\uFEFF';

  it('no drawer, largura zero e BOM não contam para o mínimo e não vão ao servidor', async () => {
    detalhe = { ...detalhe, situacao: 'Rascunho' };
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(await screen.findByRole('button', { name: 'Editar versão' }));
    const drawer = await screen.findByRole('dialog');
    const campo = within(drawer).getByLabelText('Justificativa auditável');
    fireEvent.change(campo, { target: { value: 'a' + INVISIVEIS + 'b' } });
    await user.click(within(drawer).getByRole('button', { name: 'Salvar rascunho' }));
    expect(await within(drawer).findByText('Informe a justificativa (3 a 500 caracteres).')).toBeInTheDocument();
    fireEvent.change(campo, { target: { value: ' a' + INVISIVEIS + 'bc ' } });
    await user.click(within(drawer).getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(chamadas.some((c) => c.metodo === 'PATCH')).toBe(true));
    expect(chamadas.find((c) => c.metodo === 'PATCH')?.corpo?.justificativa).toBe('abc');
  });

  it('no diálogo de decisão, só caracteres invisíveis equivalem a vazio', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    const dialogo = await abrirAcao(user, 'Aprovar');
    fireEvent.change(within(dialogo).getByLabelText(/Justificativa/), { target: { value: INVISIVEIS + INVISIVEIS } });
    await user.click(within(dialogo).getByRole('button', { name: 'Aprovar' }));
    expect(await within(dialogo).findByText('Informe a justificativa (mínimo de 3 caracteres).')).toBeInTheDocument();
    expect(chamadas.some((c) => c.url.pathname.endsWith('/aprovar'))).toBe(false);
  });

  it('na versão nova, o motivo só com invisíveis é recusado', async () => {
    detalhe = { ...detalhe, situacao: 'Aprovada' };
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('tab', { name: 'Movimentações' }));
    await user.click(await screen.findByRole('button', { name: 'Adicionar versão' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Motivo da versão'), { target: { value: INVISIVEIS + INVISIVEIS } });
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar rascunho' }));
    expect(await within(dialogo).findByText('Informe o motivo (3 a 500 caracteres).')).toBeInTheDocument();
  });
});

describe('padrões do Portão A r3', () => {
  const INVISIVEIS = '\u2060\u2800\u034F\u3164';

  it('(a) o drawer de criação não é bloqueado quando a ficha some; só a edição do mesmo registro é', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('button', { name: '+ Novo registro' }));
    const drawer = await screen.findByRole('dialog');
    respostaFicha = json(404, { message: 'Regra tributária não encontrada' });
    await act(async () => { mockRealtime.mock.calls.at(-1)![0].onMessage(); });
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(within(drawer).queryByText(/não está mais disponível/)).not.toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Salvar rascunho' })).toBeEnabled();
  });

  it('(b) invisíveis do conjunto único não contam; os acentos continuam contando', async () => {
    detalhe = { ...detalhe, situacao: 'Rascunho' };
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(await screen.findByRole('button', { name: 'Editar versão' }));
    const drawer = await screen.findByRole('dialog');
    const campo = within(drawer).getByLabelText('Justificativa auditável');
    fireEvent.change(campo, { target: { value: INVISIVEIS } });
    await user.click(within(drawer).getByRole('button', { name: 'Salvar rascunho' }));
    expect(await within(drawer).findByText('Informe a justificativa (3 a 500 caracteres).')).toBeInTheDocument();
    fireEvent.change(campo, { target: { value: 'ab\u0301c' } });
    await user.click(within(drawer).getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(chamadas.some((c) => c.metodo === 'PATCH')).toBe(true));
    expect(chamadas.find((c) => c.metodo === 'PATCH')?.corpo?.justificativa).toBe('ab\u0301c');
  });

  it('(b) na decisão, os brancos visuais também equivalem a vazio', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    const dialogo = await abrirAcao(user, 'Aprovar');
    fireEvent.change(within(dialogo).getByLabelText(/Justificativa/), { target: { value: INVISIVEIS } });
    await user.click(within(dialogo).getByRole('button', { name: 'Aprovar' }));
    expect(await within(dialogo).findByText('Informe a justificativa (mínimo de 3 caracteres).')).toBeInTheDocument();
  });

  it('(c) fechar o diálogo aberto por item de menu devolve o foco ao gatilho do menu', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    const gatilho = await screen.findByRole('button', { name: /Ações do processo/ });
    gatilho.focus();
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('menuitem', { name: 'Comparar' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(gatilho).toHaveFocus();
  });

  it('(d) duplo clique em Salvar envia uma só vez enquanto há pedido em voo', async () => {
    detalhe = { ...detalhe, situacao: 'Rascunho' };
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(await screen.findByRole('button', { name: 'Editar versão' }));
    const drawer = await screen.findByRole('dialog');
    await user.type(within(drawer).getByLabelText('Justificativa auditável'), 'Ajuste da alíquota');
    let liberar!: () => void;
    portaoMutacao = new Promise<void>((resolve) => { liberar = resolve; });
    await user.dblClick(within(drawer).getByRole('button', { name: 'Salvar rascunho' }));
    expect(within(drawer).getByRole('button', { name: 'Salvar rascunho' })).toBeDisabled();
    await act(async () => { liberar(); });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(chamadas.filter((c) => c.metodo === 'PATCH')).toHaveLength(1);
  });

  it('(d) duplo clique em Aprovar e em Salvar a versão nova também envia uma só vez', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    const dialogo = await abrirAcao(user, 'Aprovar');
    await user.type(within(dialogo).getByLabelText(/Justificativa/), 'Aprovando agora');
    let liberar!: () => void;
    portaoMutacao = new Promise<void>((resolve) => { liberar = resolve; });
    await user.dblClick(within(dialogo).getByRole('button', { name: 'Aprovar' }));
    await act(async () => { liberar(); });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(chamadas.filter((c) => c.url.pathname.endsWith('/aprovar'))).toHaveLength(1);

    portaoMutacao = null;
    detalhe = { ...detalhe, situacao: 'Aprovada' };
    await act(async () => { mockRealtime.mock.calls.at(-1)![0].onMessage(); });
    await user.click(screen.getByRole('tab', { name: 'Movimentações' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Adicionar versão' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Adicionar versão' }));
    const versao = await screen.findByRole('dialog');
    await user.type(within(versao).getByLabelText('Motivo da versão'), 'Nova alíquota');
    portaoMutacao = new Promise<void>((resolve) => { liberar = resolve; });
    await user.dblClick(within(versao).getByRole('button', { name: 'Salvar rascunho' }));
    await act(async () => { liberar(); });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(chamadas.filter((c) => c.url.pathname.endsWith('/versoes'))).toHaveLength(1);
  });
});
