import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { HomologacaoDrawer } from '../src/components/fiscal/homologacoes/homologacao-drawer';
import { HomologacoesClient } from '../src/components/fiscal/homologacoes/homologacoes-client';
import { TEXTO_VAZIO } from '../src/lib/fiscal-homologacoes';

const mockRealtime = jest.fn((_opcoes: { onMessage: () => void }) => () => undefined);
jest.mock('../src/lib/realtime', () => ({
  conectarRealtime: (opcoes: { onMessage: () => void }) => mockRealtime(opcoes),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const ID = '0199aabb-ccdd-7eee-8fff-001122334455';
const REGRA_ID = '0199bbcc-ddee-7fff-8000-112233445566';
const REGRA_OUTRA = '0199bbcc-ddee-7fff-8000-112233445577';
const MEMORIA = '0199ccdd-eeff-7000-8111-223344556677';

function linha(n: number) {
  return {
    id: n === 1 ? ID : `0199aabb-ccdd-7eee-8fff-${String(n).padStart(12, '0')}`,
    enquadramento: String(n + 11),
    vigenciaInicio: '2026-01-01',
    situacao: 'Em revisão',
    usuario: 'Maria Souza',
    aprovador: '',
    descricao: `Revisão ${String(n).padStart(2, '0')} da versão aprovada.`,
  };
}

const DETALHE_BASE = {
  id: ID,
  regraId: REGRA_ID,
  codigo: '81',
  numeroVersao: 2,
  versao: 1,
  enquadramento: '12',
  vigenciaInicio: '2026-01-01',
  vigenciaFim: '2026-12-31',
  situacao: 'Em revisão',
  usuario: 'Maria Souza',
  aprovador: '',
  descricao: 'Revisão 01 da versão aprovada.',
  empresa: 'Alpha Carnes Ltda',
  responsavel: 'Maria Souza',
  criadoEm: '2026-10-15T12:00:00.000Z',
  atualizadoEm: '2026-10-15T15:30:00.000Z',
  cenarios: [{ codigo: '71', numeroVersao: 1, competenciaRotulo: 'Outubro de 2026' }],
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

/** Resposta de arquivo: o jsdom não implementa Response.blob. */
function csv(): Response {
  return { ok: true, status: 200, headers: new Headers({ 'Content-Type': 'text/csv' }), blob: async () => new Blob(['a']) } as unknown as Response;
}

interface Chamada { metodo: string; url: URL; corpo: Record<string, unknown> | null }

let total = 1;
let detalhe = { ...DETALHE_BASE };
let historico: unknown[] = [];
let proximaMutacao: Response | null = null;
let respostaFicha: Response | null = null;
let respostaDiff: Response | null = null;
let respostaMemorias: Response | null = null;
let respostaHistorico: Response | null = null;
let liberarFicha: Promise<void> | null = null;
let chamadas: Chamada[] = [];
/** Segura as mutações (POST) até ser liberado, para haver pedido em voo. */
let portaoMutacao: Promise<void> | null = null;
/** Segura a resposta da listagem cuja busca é a chave, para simular resposta que chega fora de ordem. */
let portoesLista: Record<string, Promise<void>> = {};

async function responder(metodo: string, url: URL): Promise<Response> {
  const caminho = url.pathname;
  const base = '/api/erp/fiscal/homologacoes';
  if (caminho.startsWith('/api/admin/parametros')) return json(200, { valorJson: { provisorio: true } });
  if (metodo === 'GET' && caminho === `${base}/contagens`) return json(200, { total, emRevisao: total, aprovadas: 0, rejeitadas: 0, publicadas: 0 });
  if (metodo === 'GET' && caminho === `${base}/exportacao`) return csv();
  if (metodo === 'GET' && caminho === base) {
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
  if (metodo === 'GET' && caminho === `${base}/${ID}/historico`) return respostaHistorico ?? json(200, historico);
  if (metodo === 'GET' && caminho === `${base}/${ID}/pre-condicoes`) {
    return json(200, [
      { codigo: 'REGRA_APROVADA', atendida: true, provisoria: false },
      { codigo: 'DUPLA_APROVACAO', atendida: false, provisoria: true, texto: 'Um aprovador diferente de quem submeteu a regra registra a decisão. O quórum numérico permanece provisório.' },
    ]);
  }
  if (metodo === 'GET' && caminho === `${base}/${ID}/diff`) {
    return respostaDiff ?? json(200, { codigo: '2', numeroVersaoAntes: null, numeroVersaoDepois: 2, diferencas: [
      { campo: 'Alíquota (%)', antes: null, depois: '12,00' },
      { campo: 'Início de vigência', antes: null, depois: '2026-01-01' },
    ] });
  }
  if (metodo === 'POST' && caminho.startsWith(base)) {
    if (portaoMutacao) await portaoMutacao;
    if (proximaMutacao) return proximaMutacao;
    if (caminho.endsWith('/aprovar')) detalhe = { ...detalhe, situacao: 'Aprovada', aprovador: 'Carlos Lima', versao: detalhe.versao + 1 };
    if (caminho.endsWith('/rejeitar')) detalhe = { ...detalhe, situacao: 'Rejeitada', versao: detalhe.versao + 1 };
    if (caminho.endsWith('/publicar')) detalhe = { ...detalhe, situacao: 'Publicada', versao: detalhe.versao + 1 };
    if (caminho.endsWith('/cenarios')) {
      detalhe = { ...detalhe, versao: detalhe.versao + 1, cenarios: [...detalhe.cenarios, { codigo: '72', numeroVersao: 1, competenciaRotulo: 'Novembro de 2026' }] };
    }
    return json(caminho === base ? 201 : 200, caminho === base ? { ...detalhe, id: ID } : detalhe);
  }
  if (metodo === 'GET' && caminho === `/api/erp/fiscal/regras/${REGRA_ID}`) {
    return json(200, { autor: 'Maria Souza', vigenciaInicio: '2026-01-01', vigenciaFim: null, situacao: 'Aprovada' });
  }
  if (metodo === 'GET' && caminho === '/api/erp/fiscal/regras') {
    return json(200, { data: [
      { id: REGRA_ID, enquadramentoFiscal: '12', numeroVersao: 2, codigo: '5', situacao: 'Aprovada' },
      { id: REGRA_OUTRA, enquadramentoFiscal: '13', numeroVersao: 1, codigo: '6', situacao: 'Aprovada' },
    ], total: 2, page: 1, pageSize: 50 });
  }
  if (metodo === 'GET' && caminho === '/api/erp/fiscal/simulacoes') {
    return respostaMemorias ?? json(200, { data: [
      { id: MEMORIA, codigo: '72', numeroVersao: 1, situacao: 'Calculada', competenciaRotulo: 'Novembro de 2026' },
    ], total: 1, page: 1, pageSize: 50 });
  }
  return json(404, { message: 'Não encontrado.' });
}

beforeEach(() => {
  total = 1;
  detalhe = { ...DETALHE_BASE };
  historico = [];
  proximaMutacao = null;
  respostaFicha = null;
  respostaDiff = null;
  respostaMemorias = null;
  respostaHistorico = null;
  liberarFicha = null;
  chamadas = [];
  portoesLista = {};
  portaoMutacao = null;
  window.sessionStorage.clear();
  mockRealtime.mockClear();
  (toast.success as jest.Mock).mockClear();
  global.fetch = jest.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(entrada), 'http://localhost');
    const corpo = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : null;
    const metodo = init?.method ?? 'GET';
    chamadas.push({ metodo, url, corpo });
    return responder(metodo, url);
  }) as unknown as typeof fetch;
});

function renderizar(props: { podeGerenciar?: boolean; podeAprovar?: boolean } = {}) {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  return { user, ...render(<HomologacoesClient podeGerenciar={props.podeGerenciar ?? true} podeAprovar={props.podeAprovar ?? true} />) };
}

async function abrirFicha(user: ReturnType<typeof userEvent.setup>, rotulo = 'Revisão 01 da versão aprovada.') {
  const celula = await screen.findByText(rotulo, { selector: 'td' });
  celula.closest('tr')!.focus();
  await user.keyboard('{Enter}');
  await screen.findByText('Alpha Carnes Ltda');
}

function valorDe(rotulo: string) {
  return screen.getAllByText(rotulo, { selector: 'p' })[0]!.nextElementSibling;
}

function listagens() {
  return chamadas.filter((c) => c.metodo === 'GET' && c.url.pathname === '/api/erp/fiscal/homologacoes');
}

async function abrirAcao(user: ReturnType<typeof userEvent.setup>, nome: string) {
  await user.click(screen.getByRole('tab', { name: 'Movimentações' }));
  await user.click(await screen.findByRole('button', { name: nome }));
  return screen.findByRole('dialog');
}

describe('rótulos e estados da tela', () => {
  it('drawer com os rótulos literais e os campos em leitura', () => {
    render(<HomologacaoDrawer aberto onFechar={() => undefined} onSalvar={async () => null} />);
    expect(screen.getByLabelText('Enquadramento fiscal')).toBeInTheDocument();
    expect(screen.getByLabelText('Descrição')).toBeInTheDocument();
    expect(screen.getByLabelText('Justificativa auditável')).toBeInTheDocument();
    for (const rotulo of ['Usuário', 'Início de vigência', 'Fim de vigência', 'Situação', 'Responsável pela aprovação']) {
      expect(screen.getByText(rotulo, { selector: 'p' })).toBeInTheDocument();
    }
    expect(screen.getByText('Pendente')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/E01-T05|Marca/);
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
  it('mostra "Exibindo N de M", vigência em dd/MM/aaaa e "Pendente" sem responsável, e pagina e ordena no servidor', async () => {
    total = 45;
    const { user } = renderizar();
    expect(await screen.findByText(/Exibindo 20 de 45 registros/)).toBeInTheDocument();
    expect((await screen.findAllByText('01/01/2026', { selector: 'td' })).length).toBe(20);
    expect(screen.getAllByText('Pendente', { selector: 'td' }).length).toBe(20);
    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(await screen.findByText(/Página 2 de 3/)).toBeInTheDocument();
    expect(listagens().at(-1)?.url.searchParams.get('page')).toBe('2');
    await user.click(screen.getByRole('button', { name: 'Responsável pela aprovação' }));
    await waitFor(() => expect(listagens().at(-1)?.url.searchParams.get('sort')).toBe('aprovador'));
    expect(listagens().at(-1)?.url.searchParams.get('page')).toBe('1');
    await user.click(screen.getByRole('button', { name: 'Responsável pela aprovação' }));
    await waitFor(() => expect(listagens().at(-1)?.url.searchParams.get('dir')).toBe('desc'));
    await user.selectOptions(screen.getByLabelText('Situação'), 'APROVADA');
    await waitFor(() => expect(listagens().at(-1)?.url.searchParams.get('situacao')).toBe('APROVADA'));
    expect(listagens().at(-1)?.url.searchParams.get('page')).toBe('1');
  });

  it('Exportar e Exportar visão levam busca, situação e ordenação da tela', async () => {
    Object.assign(URL, { createObjectURL: jest.fn(() => 'blob:csv'), revokeObjectURL: jest.fn() });
    const clique = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const { user } = renderizar();
    await screen.findByText('Revisão 01 da versão aprovada.', { selector: 'td' });
    await user.type(screen.getByLabelText('Pesquisar descrição ou referência de negócio'), 'rev');
    await user.selectOptions(screen.getByLabelText('Situação'), 'EM_REVISAO');
    await user.click(screen.getByRole('button', { name: 'Descrição' }));
    await waitFor(() => expect(listagens().at(-1)?.url.searchParams.get('sort')).toBe('descricao'));
    await user.click(screen.getByRole('button', { name: 'Exportar visão' }));
    await user.click(screen.getByRole('button', { name: 'Exportar' }));
    const exportacoes = chamadas.filter((c) => c.url.pathname === '/api/erp/fiscal/homologacoes/exportacao');
    expect(exportacoes).toHaveLength(2);
    for (const exportacao of exportacoes) {
      expect(exportacao.url.searchParams.get('search')).toBe('rev');
      expect(exportacao.url.searchParams.get('situacao')).toBe('EM_REVISAO');
      expect(exportacao.url.searchParams.get('sort')).toBe('descricao');
    }
    await waitFor(() => expect(clique).toHaveBeenCalledTimes(2));
    clique.mockRestore();
  });
});

describe('ficha', () => {
  it('mostra carregando, datas em dd/MM/aaaa, "Pendente" e os selos, sem uuid', async () => {
    let liberar!: () => void;
    liberarFicha = new Promise<void>((resolve) => { liberar = resolve; });
    const { user, container } = renderizar();
    const celula = await screen.findByText('Revisão 01 da versão aprovada.', { selector: 'td' });
    celula.closest('tr')!.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByLabelText('Carregando a ficha')).toBeInTheDocument();
    liberar();
    expect(await screen.findByText('Alpha Carnes Ltda')).toBeInTheDocument();
    expect(valorDe('Código')).toHaveTextContent('81');
    expect(valorDe('Versão')).toHaveTextContent('2');
    expect(valorDe('Início de vigência')).toHaveTextContent('01/01/2026');
    expect(valorDe('Fim de vigência')).toHaveTextContent('31/12/2026');
    expect(valorDe('Responsável pela aprovação')).toHaveTextContent('Pendente');
    expect(valorDe('Criado em')).toHaveTextContent('15/10/2026 09:00');
    expect(valorDe('Alterado em')).toHaveTextContent('15/10/2026 12:30');
    for (const selo of ['H-E01-10', 'H-E01-11', 'H-E01-12']) expect(container.textContent).toContain(selo);
    expect(container.textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });

  it('falha ao carregar a ficha aparece na tela', async () => {
    respostaFicha = json(500, { message: 'x' });
    const { user } = renderizar();
    const celula = await screen.findByText('Revisão 01 da versão aprovada.', { selector: 'td' });
    celula.closest('tr')!.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByText(/Serviço indisponível no momento/)).toBeInTheDocument();
  });

  it('Consultar histórico ativa a aba e mostra "quando • quem"; a falha aparece na aba', async () => {
    historico = [{
      operacao: 'INSERT', situacaoAnterior: null, situacaoNova: 'EM_REVISAO', usuarioNome: 'Maria Souza',
      criadoEm: '2026-10-15T12:00:00.000Z', justificativa: 'Revisão aberta', resumo: 'Homologação aberta', versao: 1,
    }];
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('button', { name: 'Consultar histórico' }));
    expect(screen.getByRole('tab', { name: 'Histórico' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('15/10/2026 09:00 • Maria Souza')).toBeInTheDocument();
    expect(screen.queryByText(/^Versão /)).not.toBeInTheDocument();
    respostaHistorico = json(500, { message: 'x' });
    await user.click(screen.getByRole('tab', { name: 'Ficha e campos' }));
    await user.click(screen.getByRole('button', { name: 'Consultar histórico' }));
    expect(await screen.findByText(/Serviço indisponível no momento/)).toBeInTheDocument();
  });

  it('Validar pré-condições mostra o resultado com os selos', async () => {
    const { user, container } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('button', { name: 'Validar pré-condições' }));
    expect(await screen.findByText('Regra aprovada: atendida')).toBeInTheDocument();
    expect(screen.getByText('Dupla aprovação definida: provisória')).toBeInTheDocument();
    expect(container.textContent).toContain('H-E01-11');
  });

  it('abas Regras, Exceções, Integrações e Aceite seguem o protótipo e o plano', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('tab', { name: 'Regras e validações' }));
    expect(screen.getByText('aprovador diferente do autor; cenários de regressão obrigatórios')).toBeInTheDocument();
    expect(screen.getByText('01 · Autor')).toBeInTheDocument();
    expect(screen.queryByText(/Quem submeteu a versão permanece autor/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Exceções' }));
    expect(screen.getByText(/Atualização normativa em meio à operação/)).toBeInTheDocument();
    expect(screen.getByText('Esta tela não bloqueia a publicação por atualização normativa, porque o protótipo não traz código de erro.')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Integrações' }));
    expect(screen.getByRole('button', { name: 'Central de Integrações' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Consultar integração' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Aceite e testes' }));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText('Referência do requisito')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').filter((li) => li.closest('ul[aria-label="Critérios de aceite"]'))).toHaveLength(8);
  });

  it('o evento em tempo real refaz a ficha aberta', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    detalhe = { ...detalhe, situacao: 'Aprovada', aprovador: 'Carlos Lima', versao: 2 };
    await act(async () => { mockRealtime.mock.calls.at(-1)![0].onMessage(); });
    await waitFor(() => expect(valorDe('Responsável pela aprovação')).toHaveTextContent('Carlos Lima'));
  });
});

describe('ações conforme a situação', () => {
  it.each([
    ['Em revisão', true, false],
    ['Aprovada', false, true],
    ['Rejeitada', false, false],
    ['Publicada', false, false],
  ])('na situação %s: Aprovar/rejeitar=%s, Publicar e auditar=%s; Revisar diff sempre habilitado', async (situacao, decidir, publicar) => {
    detalhe = { ...detalhe, situacao };
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('tab', { name: 'Movimentações' }));
    const verifica = (nome: string, habilitado: boolean) => {
      const botao = screen.getByRole('button', { name: nome });
      if (habilitado) expect(botao).toBeEnabled(); else expect(botao).toBeDisabled();
    };
    verifica('Aprovar/rejeitar', decidir);
    verifica('Publicar e auditar', publicar);
    verifica('Revisar diff', true);
  });

  it('o menu Ações do processo também respeita a situação', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    const botao = await screen.findByRole('button', { name: /Ações do processo/ });
    botao.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('menuitem', { name: 'Aprovar/rejeitar' })).not.toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('menuitem', { name: 'Publicar e auditar' })).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('aprovar, rejeitar e publicar', () => {
  it('a justificativa nasce vazia, exige 3 caracteres e o erro fica no diálogo, limpo ao reabrir', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    let dialogo = await abrirAcao(user, 'Aprovar/rejeitar');
    const campo = within(dialogo).getByLabelText('Justificativa auditável');
    expect(campo).toHaveValue('');
    await user.click(within(dialogo).getByRole('button', { name: 'Aprovar' }));
    expect(await within(dialogo).findByText('Informe a justificativa (mínimo de 3 caracteres).')).toBeInTheDocument();
    expect(chamadas.some((c) => c.url.pathname.endsWith('/aprovar'))).toBe(false);
    proximaMutacao = envelope(422, { message: 'x', codigo: 'SEGREGACAO_FUNCAO' });
    await user.type(campo, 'Decisão do segundo usuário');
    await user.click(within(dialogo).getByRole('button', { name: 'Aprovar' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('A aprovação deve ser feita por usuário diferente de quem submeteu.');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    await user.click(screen.getByRole('button', { name: 'Aprovar/rejeitar' }));
    dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(dialogo).getByLabelText('Justificativa auditável')).toHaveValue('');
  });

  it('aprovar envia a justificativa digitada, fecha e recarrega a ficha com o responsável', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    const dialogo = await abrirAcao(user, 'Aprovar/rejeitar');
    await user.type(within(dialogo).getByLabelText('Justificativa auditável'), 'Decisão do segundo usuário');
    await user.click(within(dialogo).getByRole('button', { name: 'Aprovar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(chamadas.find((c) => c.url.pathname.endsWith('/aprovar'))?.corpo).toEqual({ versao: 1, justificativa: 'Decisão do segundo usuário' });
    await user.click(screen.getByRole('tab', { name: 'Ficha e campos' }));
    await waitFor(() => expect(valorDe('Responsável pela aprovação')).toHaveTextContent('Carlos Lima'));
    expect(valorDe('Situação')).toHaveTextContent('Aprovada');
  });

  it('rejeitar usa o mesmo diálogo e envia a rejeição', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    const dialogo = await abrirAcao(user, 'Aprovar/rejeitar');
    await user.type(within(dialogo).getByLabelText('Justificativa auditável'), 'Faltam cenários de regressão');
    await user.click(within(dialogo).getByRole('button', { name: 'Rejeitar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(chamadas.some((c) => c.url.pathname.endsWith('/rejeitar'))).toBe(true);
  });

  it('publicar pede justificativa vazia, mostra o 422 no diálogo e conclui com o aviso', async () => {
    detalhe = { ...detalhe, situacao: 'Aprovada' };
    const { user } = renderizar();
    await abrirFicha(user);
    const dialogo = await abrirAcao(user, 'Publicar e auditar');
    const campo = within(dialogo).getByLabelText('Justificativa auditável');
    expect(campo).toHaveValue('');
    await user.click(within(dialogo).getByRole('button', { name: 'Publicar' }));
    expect(await within(dialogo).findByText('Informe a justificativa (mínimo de 3 caracteres).')).toBeInTheDocument();
    proximaMutacao = envelope(422, { message: 'x', codigo: 'CENARIO_REGRESSAO_AUSENTE' });
    await user.type(campo, 'Publicação com a memória');
    await user.click(within(dialogo).getByRole('button', { name: 'Publicar' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('A publicação exige ao menos um cenário de regressão.');
    proximaMutacao = null;
    await user.click(within(dialogo).getByRole('button', { name: 'Publicar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith('Homologação publicada.');
  });
});

describe('cenários aprovados', () => {
  async function abrirCenarios(user: ReturnType<typeof userEvent.setup>) {
    await abrirFicha(user);
    await user.click(screen.getByRole('button', { name: 'cenários aprovados' }));
    return screen.findByRole('dialog');
  }

  it('busca as memórias da versão numa chamada, sem consultar uma a uma', async () => {
    const { user } = renderizar();
    const dialogo = await abrirCenarios(user);
    await user.click(within(dialogo).getByRole('combobox', { name: /Memória calculada/ }));
    expect(await screen.findByRole('option', { name: '72 · versão 1 · Novembro de 2026' })).toBeInTheDocument();
    const buscas = chamadas.filter((c) => c.url.pathname === '/api/erp/fiscal/simulacoes');
    expect(buscas.length).toBeGreaterThan(0);
    expect(buscas[0]!.url.searchParams.get('regraId')).toBe(REGRA_ID);
    expect(chamadas.some((c) => /\/simulacoes\/[0-9a-f-]{36}$/.test(c.url.pathname))).toBe(false);
  });

  it('avisa quando há mais memórias do que as exibidas e quando a busca falha', async () => {
    respostaMemorias = json(200, { data: [{ id: MEMORIA, codigo: '72', numeroVersao: 1, situacao: 'Calculada', competenciaRotulo: 'Novembro de 2026' }], total: 80, page: 1, pageSize: 50 });
    const { user } = renderizar();
    const dialogo = await abrirCenarios(user);
    await user.click(within(dialogo).getByRole('combobox', { name: /Memória calculada/ }));
    expect(await screen.findByText('Há mais resultados do que os exibidos. Refine a busca.')).toBeInTheDocument();
  });

  it('falha ao buscar as memórias aparece e não vira lista vazia', async () => {
    respostaMemorias = json(500, { message: 'x' });
    const { user } = renderizar();
    const dialogo = await abrirCenarios(user);
    await user.click(within(dialogo).getByRole('combobox', { name: /Memória calculada/ }));
    expect(await screen.findByText(/Serviço indisponível no momento/)).toBeInTheDocument();
  });

  it('exige a memória e a justificativa, mostra o erro no diálogo e reabre com a escolha zerada', async () => {
    const { user } = renderizar();
    let dialogo = await abrirCenarios(user);
    expect(within(dialogo).getByLabelText('Justificativa auditável')).toHaveValue('');
    await user.click(within(dialogo).getByRole('button', { name: 'Vincular' }));
    expect(await within(dialogo).findByText('Escolha a memória calculada.')).toBeInTheDocument();
    await user.click(within(dialogo).getByRole('combobox', { name: /Memória calculada/ }));
    await user.click(await screen.findByRole('option', { name: '72 · versão 1 · Novembro de 2026' }));
    await user.click(within(dialogo).getByRole('button', { name: 'Vincular' }));
    expect(await within(dialogo).findByText('Informe a justificativa (mínimo de 3 caracteres).')).toBeInTheDocument();
    proximaMutacao = envelope(422, { message: 'x', codigo: 'CENARIO_REGRA_DIVERGENTE' });
    await user.type(within(dialogo).getByLabelText('Justificativa auditável'), 'Vínculo da memória');
    await user.click(within(dialogo).getByRole('button', { name: 'Vincular' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('O cenário de regressão precisa ser uma memória calculada desta versão da regra.');
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    await user.click(screen.getByRole('button', { name: 'cenários aprovados' }));
    dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByRole('combobox', { name: /Memória calculada/ })).toHaveTextContent('Memória calculada');
    expect(within(dialogo).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(dialogo).getByLabelText('Justificativa auditável')).toHaveValue('');
  });

  it('vincula, fecha e a ficha lista o cenário novo', async () => {
    const { user } = renderizar();
    const dialogo = await abrirCenarios(user);
    await user.click(within(dialogo).getByRole('combobox', { name: /Memória calculada/ }));
    await user.click(await screen.findByRole('option', { name: '72 · versão 1 · Novembro de 2026' }));
    await user.type(within(dialogo).getByLabelText('Justificativa auditável'), 'Vínculo da memória');
    await user.click(within(dialogo).getByRole('button', { name: 'Vincular' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(chamadas.find((c) => c.url.pathname.endsWith('/cenarios'))?.corpo).toEqual({ simulacaoId: MEMORIA, versao: 1, justificativa: 'Vínculo da memória' });
    expect(await screen.findByText('72 · versão 1 · Novembro de 2026')).toBeInTheDocument();
  });
});

describe('revisar diff', () => {
  it('mostra carregando, rotula o antes ausente como novo e datas em dd/MM/aaaa', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    const dialogo = await abrirAcao(user, 'Revisar diff');
    const itens = await within(dialogo).findAllByRole('listitem');
    expect(itens[0]).toHaveTextContent('Alíquota (%): novo → 12,00');
    expect(itens[1]).toHaveTextContent('Início de vigência: novo → 01/01/2026');
  });

  it('a falha do diff aparece no diálogo', async () => {
    respostaDiff = json(500, { message: 'x' });
    const { user } = renderizar();
    await abrirFicha(user);
    const dialogo = await abrirAcao(user, 'Revisar diff');
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Serviço indisponível no momento. Tente novamente.');
  });
});

describe('drawer de nova revisão', () => {
  async function abrirDrawer(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: '+ Novo registro' }));
    return screen.findByRole('dialog');
  }

  async function escolherRegra(user: ReturnType<typeof userEvent.setup>) {
    await user.click(document.getElementById('hom-regra')!);
    await user.type(await screen.findByPlaceholderText('Buscar enquadramento'), '12');
    await user.click(await screen.findByRole('option', { name: '12 · versão 2' }));
  }

  it('o combo de enquadramento busca só versões aprovadas no servidor, sem consultar cada regra', async () => {
    const { user } = renderizar();
    const drawer = await abrirDrawer(user);
    await user.click(drawer.querySelector('#hom-regra')!);
    await user.type(await screen.findByPlaceholderText('Buscar enquadramento'), '12');
    await screen.findByRole('option', { name: '13 · versão 1' });
    const buscaDe12 = () => chamadas.filter((c) => c.url.pathname === '/api/erp/fiscal/regras' && c.url.searchParams.get('search') === '12');
    await waitFor(() => expect(buscaDe12().length).toBeGreaterThan(0));
    expect(buscaDe12()[0]!.url.searchParams.get('situacao')).toBe('APROVADA');
    expect(chamadas.some((c) => /\/regras\/[0-9a-f-]{36}$/.test(c.url.pathname))).toBe(false);
  });

  it('escolher a regra preenche usuário e vigência em leitura; falha de carga aparece', async () => {
    const { user } = renderizar();
    const drawer = await abrirDrawer(user);
    await escolherRegra(user);
    await waitFor(() => expect(within(drawer).getByText('Usuário', { selector: 'p' }).nextElementSibling).toHaveTextContent('Maria Souza'));
    expect(within(drawer).getByText('Início de vigência', { selector: 'p' }).nextElementSibling).toHaveTextContent('01/01/2026');
    expect(within(drawer).getByText('Fim de vigência', { selector: 'p' }).nextElementSibling).toHaveTextContent('Sem fim');
    expect(within(drawer).getByText('Situação', { selector: 'p' }).nextElementSibling).toHaveTextContent('Em revisão');
  });

  it('falha ao carregar a regra escolhida não é engolida', async () => {
    const { user } = renderizar();
    const drawer = await abrirDrawer(user);
    const base = global.fetch as jest.Mock;
    global.fetch = jest.fn(async (entrada: string, init?: RequestInit) => {
      if (new URL(String(entrada), 'http://localhost').pathname === `/api/erp/fiscal/regras/${REGRA_ID}`) return json(500, { message: 'x' });
      return base(entrada, init);
    }) as unknown as typeof fetch;
    await escolherRegra(user);
    expect(await within(drawer).findByText(/Não foi possível carregar os dados da regra/)).toBeInTheDocument();
  });

  it('Verificar dados confere localmente e confirma quando está tudo certo', async () => {
    const { user } = renderizar();
    const drawer = await abrirDrawer(user);
    await user.click(within(drawer).getByRole('button', { name: 'Verificar dados' }));
    expect(await within(drawer).findByText('Selecione a versão aprovada da regra.')).toBeInTheDocument();
    expect(within(drawer).getByText('Informe a descrição (3 a 500 caracteres).')).toBeInTheDocument();
    expect(within(drawer).getByText('Informe a justificativa auditável (3 a 500 caracteres).')).toBeInTheDocument();
    await escolherRegra(user);
    await user.type(within(drawer).getByLabelText('Descrição'), 'Revisão da alíquota');
    await user.type(within(drawer).getByLabelText('Justificativa auditável'), 'Publicar nova alíquota');
    await user.click(within(drawer).getByRole('button', { name: 'Verificar dados' }));
    expect(await within(drawer).findByText('Dados verificados.')).toBeInTheDocument();
  });

  it('grava, fecha e abre a ficha da revisão criada', async () => {
    const { user } = renderizar();
    const drawer = await abrirDrawer(user);
    await escolherRegra(user);
    await user.type(within(drawer).getByLabelText('Descrição'), 'Revisão da alíquota');
    await user.type(within(drawer).getByLabelText('Justificativa auditável'), 'Publicar nova alíquota');
    await user.click(within(drawer).getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(chamadas.find((c) => c.metodo === 'POST')?.corpo).toEqual({
      regraId: REGRA_ID, descricao: 'Revisão da alíquota', justificativa: 'Publicar nova alíquota',
    });
    expect(toast.success).toHaveBeenCalledWith('Revisão aberta.');
    expect(await screen.findByText('Alpha Carnes Ltda')).toBeInTheDocument();
  });

  it('o 400 do servidor leva o rótulo do campo, junto do campo, e o erro some ao reabrir', async () => {
    const { user } = renderizar();
    let drawer = await abrirDrawer(user);
    await escolherRegra(user);
    await user.type(within(drawer).getByLabelText('Descrição'), 'Revisão da alíquota');
    await user.type(within(drawer).getByLabelText('Justificativa auditável'), 'Publicar nova alíquota');
    proximaMutacao = envelope(400, {
      message: 'Validação falhou',
      errors: [{ path: ['descricao'], message: 'Descrição inválida' }],
    });
    await user.click(within(drawer).getByRole('button', { name: 'Salvar rascunho' }));
    const alertas = await within(drawer).findAllByRole('alert');
    expect(alertas.some((a) => a.textContent === 'Descrição: Descrição inválida')).toBe(true);
    expect(alertas.some((a) => a.textContent === 'Descrição inválida')).toBe(true);
    await user.click(within(drawer).getByRole('button', { name: 'Cancelar' }));
    await user.click(await screen.findByRole('button', { name: 'Descartar e sair' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    drawer = await abrirDrawer(user);
    expect(within(drawer).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sair com pendência abre o diálogo do DS', async () => {
    const { user } = renderizar();
    const drawer = await abrirDrawer(user);
    await user.type(within(drawer).getByLabelText('Descrição'), 'Texto pendente');
    await user.click(within(drawer).getByRole('button', { name: 'Cancelar' }));
    const alerta = await screen.findByRole('alertdialog');
    expect(alerta).toHaveTextContent('Descartar alterações?');
    await user.click(within(alerta).getByRole('button', { name: 'Continuar editando' }));
    expect(screen.getByLabelText('Descrição')).toHaveValue('Texto pendente');
  });
});

describe('lista: resposta obsoleta e busca com atraso', () => {
  it('a busca só chega ao servidor quando a digitação para, com uma única consulta', async () => {
    const { user } = renderizar();
    await screen.findByText('Revisão 01 da versão aprovada.', { selector: 'td' });
    const antes = listagens().length;
    await user.type(screen.getByLabelText('Pesquisar descrição ou referência de negócio'), 'abc');
    expect(listagens().length).toBe(antes);
    await waitFor(() => expect(listagens().at(-1)?.url.searchParams.get('search')).toBe('abc'));
    expect(listagens().slice(antes).map((c) => c.url.searchParams.get('search'))).toEqual(['abc']);
  });

  it('descarta a resposta antiga que chega depois da nova', async () => {
    let liberar!: () => void;
    portoesLista.lento = new Promise<void>((resolve) => { liberar = resolve; });
    const { user } = renderizar();
    await screen.findByText('Revisão 01 da versão aprovada.', { selector: 'td' });
    const campo = screen.getByLabelText('Pesquisar descrição ou referência de negócio');
    await user.type(campo, 'lento');
    await waitFor(() => expect(listagens().some((c) => c.url.searchParams.get('search') === 'lento')).toBe(true));
    await user.clear(campo);
    await waitFor(() => expect(listagens().at(-1)?.url.searchParams.get('search') ?? '').toBe(''));
    await act(async () => { liberar(); });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText('Revisão 07 da versão aprovada.', { selector: 'td' })).not.toBeInTheDocument();
    expect(screen.getByText('Revisão 01 da versão aprovada.', { selector: 'td' })).toBeInTheDocument();
  });
});

describe('diálogo aberto e concorrência', () => {
  it('a decisão leva a versão de quando abriu, o evento não apaga o digitado e o 409 oferece recarregar', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    const dialogo = await abrirAcao(user, 'Aprovar/rejeitar');
    await user.type(within(dialogo).getByLabelText('Justificativa auditável'), 'Decisão do segundo usuário');
    detalhe = { ...detalhe, versao: 3 };
    await act(async () => { mockRealtime.mock.calls.at(-1)![0].onMessage(); });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(within(dialogo).getByLabelText('Justificativa auditável')).toHaveValue('Decisão do segundo usuário');
    proximaMutacao = envelope(409, { message: 'x', codigo: 'CONFLITO_CONCORRENTE' });
    await user.click(within(dialogo).getByRole('button', { name: 'Aprovar' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('O registro foi alterado por outro usuário. Recarregue para continuar.');
    expect(chamadas.find((c) => c.url.pathname.endsWith('/aprovar'))?.corpo?.versao).toBe(1);
    await user.click(within(dialogo).getByRole('button', { name: 'Recarregar dados' }));
    expect(await within(dialogo).findByText('Dados recarregados. Revise o que digitou e confirme de novo.')).toBeInTheDocument();
    expect(within(dialogo).getByLabelText('Justificativa auditável')).toHaveValue('Decisão do segundo usuário');
    proximaMutacao = null;
    await user.click(within(dialogo).getByRole('button', { name: 'Aprovar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(chamadas.filter((c) => c.url.pathname.endsWith('/aprovar')).at(-1)?.corpo?.versao).toBe(3);
  });

  it('a publicação também oferece recarregar após o 409', async () => {
    detalhe = { ...detalhe, situacao: 'Aprovada' };
    const { user } = renderizar();
    await abrirFicha(user);
    const dialogo = await abrirAcao(user, 'Publicar e auditar');
    proximaMutacao = envelope(409, { message: 'x', codigo: 'CONFLITO_CONCORRENTE' });
    await user.type(within(dialogo).getByLabelText('Justificativa auditável'), 'Publicação agora');
    await user.click(within(dialogo).getByRole('button', { name: 'Publicar' }));
    await within(dialogo).findByRole('alert');
    expect(within(dialogo).getByRole('button', { name: 'Recarregar dados' })).toBeInTheDocument();
  });

  it('a homologação removida por outro usuário bloqueia o envio e mantém o digitado', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    const dialogo = await abrirAcao(user, 'Aprovar/rejeitar');
    await user.type(within(dialogo).getByLabelText('Justificativa auditável'), 'Decisão do segundo usuário');
    respostaFicha = json(404, { message: 'Homologação não encontrada' });
    await act(async () => { mockRealtime.mock.calls.at(-1)![0].onMessage(); });
    expect(await within(dialogo).findByText('Esta homologação não está mais disponível. O que foi digitado continua aqui, mas não pode ser enviado.')).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Aprovar' })).toBeDisabled();
    expect(within(dialogo).getByRole('button', { name: 'Rejeitar' })).toBeDisabled();
    expect(within(dialogo).getByLabelText('Justificativa auditável')).toHaveValue('Decisão do segundo usuário');
  });

  it('o vínculo de cenário leva a versão de quando abriu e oferece recarregar após o 409', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('button', { name: 'cenários aprovados' }));
    const dialogo = await screen.findByRole('dialog');
    await user.click(within(dialogo).getByRole('combobox', { name: /Memória calculada/ }));
    await user.click(await screen.findByRole('option', { name: '72 · versão 1 · Novembro de 2026' }));
    await user.type(within(dialogo).getByLabelText('Justificativa auditável'), 'Vínculo da memória');
    detalhe = { ...detalhe, versao: 3 };
    await act(async () => { mockRealtime.mock.calls.at(-1)![0].onMessage(); });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(within(dialogo).getByLabelText('Justificativa auditável')).toHaveValue('Vínculo da memória');
    proximaMutacao = envelope(409, { message: 'x', codigo: 'CONFLITO_CONCORRENTE' });
    await user.click(within(dialogo).getByRole('button', { name: 'Vincular' }));
    await within(dialogo).findByText('O registro foi alterado por outro usuário. Recarregue para continuar.');
    expect(chamadas.find((c) => c.url.pathname.endsWith('/cenarios'))?.corpo?.versao).toBe(1);
    await user.click(within(dialogo).getByRole('button', { name: 'Recarregar dados' }));
    await within(dialogo).findByText('Dados recarregados. Revise o que digitou e vincule de novo.');
    proximaMutacao = null;
    await user.click(within(dialogo).getByRole('button', { name: 'Vincular' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(chamadas.filter((c) => c.url.pathname.endsWith('/cenarios')).at(-1)?.corpo?.versao).toBe(3);
  });

  it('o drawer de nova revisão não perde o digitado com o evento de outro usuário', async () => {
    const { user } = renderizar();
    await user.click(await screen.findByRole('button', { name: '+ Novo registro' }));
    const drawer = await screen.findByRole('dialog');
    await user.type(within(drawer).getByLabelText('Descrição'), 'Descrição digitada');
    await act(async () => { mockRealtime.mock.calls.at(-1)![0].onMessage(); });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(within(drawer).getByLabelText('Descrição')).toHaveValue('Descrição digitada');
  });
});

describe('justificativa com caracteres invisíveis', () => {
  const INVISIVEIS = '\u200B\u200C\uFEFF';

  it('na decisão e na publicação, só caracteres invisíveis equivalem a vazio', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    const dialogo = await abrirAcao(user, 'Aprovar/rejeitar');
    fireEvent.change(within(dialogo).getByLabelText('Justificativa auditável'), { target: { value: INVISIVEIS + INVISIVEIS } });
    await user.click(within(dialogo).getByRole('button', { name: 'Aprovar' }));
    expect(await within(dialogo).findByText('Informe a justificativa (mínimo de 3 caracteres).')).toBeInTheDocument();
    expect(chamadas.some((c) => c.url.pathname.endsWith('/aprovar'))).toBe(false);
    fireEvent.change(within(dialogo).getByLabelText('Justificativa auditável'), { target: { value: ' a' + INVISIVEIS + 'bc ' } });
    await user.click(within(dialogo).getByRole('button', { name: 'Aprovar' }));
    await waitFor(() => expect(chamadas.some((c) => c.url.pathname.endsWith('/aprovar'))).toBe(true));
    expect(chamadas.find((c) => c.url.pathname.endsWith('/aprovar'))?.corpo?.justificativa).toBe('abc');
  });

  it('no vínculo de cenário e no drawer, os invisíveis também não contam', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('button', { name: 'cenários aprovados' }));
    const dialogo = await screen.findByRole('dialog');
    await user.click(within(dialogo).getByRole('combobox', { name: /Memória calculada/ }));
    await user.click(await screen.findByRole('option', { name: '72 · versão 1 · Novembro de 2026' }));
    fireEvent.change(within(dialogo).getByLabelText('Justificativa auditável'), { target: { value: INVISIVEIS + INVISIVEIS } });
    await user.click(within(dialogo).getByRole('button', { name: 'Vincular' }));
    expect(await within(dialogo).findByText('Informe a justificativa (mínimo de 3 caracteres).')).toBeInTheDocument();
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    await user.click(screen.getByRole('button', { name: '+ Novo registro' }));
    const drawer = await screen.findByRole('dialog');
    fireEvent.change(within(drawer).getByLabelText('Descrição'), { target: { value: 'a' + INVISIVEIS + 'b' } });
    fireEvent.change(within(drawer).getByLabelText('Justificativa auditável'), { target: { value: INVISIVEIS + INVISIVEIS } });
    await user.click(within(drawer).getByRole('button', { name: 'Verificar dados' }));
    expect(await within(drawer).findByText('Informe a descrição (3 a 500 caracteres).')).toBeInTheDocument();
    expect(within(drawer).getByText('Informe a justificativa auditável (3 a 500 caracteres).')).toBeInTheDocument();
  });
});

describe('padrões do Portão A r3', () => {
  const INVISIVEIS = '\u2060\u2800\u034F\u3164';

  it('(a) o drawer de criação não é bloqueado quando a ficha some', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('button', { name: '+ Novo registro' }));
    const drawer = await screen.findByRole('dialog');
    respostaFicha = json(404, { message: 'Homologação não encontrada' });
    await act(async () => { mockRealtime.mock.calls.at(-1)![0].onMessage(); });
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(within(drawer).queryByText(/não está mais disponível/)).not.toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Salvar rascunho' })).toBeEnabled();
  });

  it('(b) os brancos visuais não contam na decisão, no vínculo e no drawer; os acentos contam', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    const decisao = await abrirAcao(user, 'Aprovar/rejeitar');
    fireEvent.change(within(decisao).getByLabelText('Justificativa auditável'), { target: { value: INVISIVEIS } });
    await user.click(within(decisao).getByRole('button', { name: 'Aprovar' }));
    expect(await within(decisao).findByText('Informe a justificativa (mínimo de 3 caracteres).')).toBeInTheDocument();
    fireEvent.change(within(decisao).getByLabelText('Justificativa auditável'), { target: { value: 'ab\u0301c' } });
    await user.click(within(decisao).getByRole('button', { name: 'Aprovar' }));
    await waitFor(() => expect(chamadas.some((c) => c.url.pathname.endsWith('/aprovar'))).toBe(true));
    expect(chamadas.find((c) => c.url.pathname.endsWith('/aprovar'))?.corpo?.justificativa).toBe('ab\u0301c');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: '+ Novo registro' }));
    const drawer = await screen.findByRole('dialog');
    fireEvent.change(within(drawer).getByLabelText('Descrição'), { target: { value: INVISIVEIS } });
    await user.click(within(drawer).getByRole('button', { name: 'Verificar dados' }));
    expect(await within(drawer).findByText('Informe a descrição (3 a 500 caracteres).')).toBeInTheDocument();
  });

  it('(c) fechar o diálogo aberto por item de menu devolve o foco ao gatilho do menu', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    const gatilho = await screen.findByRole('button', { name: /Ações do processo/ });
    gatilho.focus();
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('menuitem', { name: 'Revisar diff' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(gatilho).toHaveFocus();
  });

  it('(d) duplo clique em Aprovar envia uma só vez enquanto há pedido em voo', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    const dialogo = await abrirAcao(user, 'Aprovar/rejeitar');
    await user.type(within(dialogo).getByLabelText('Justificativa auditável'), 'Decisão do segundo usuário');
    let liberar!: () => void;
    portaoMutacao = new Promise<void>((resolve) => { liberar = resolve; });
    await user.dblClick(within(dialogo).getByRole('button', { name: 'Aprovar' }));
    expect(within(dialogo).getByRole('button', { name: 'Rejeitar' })).toBeDisabled();
    await act(async () => { liberar(); });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(chamadas.filter((c) => c.url.pathname.endsWith('/aprovar'))).toHaveLength(1);
  });

  it('(d) duplo clique em Vincular e em Salvar a revisão nova envia uma só vez', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('button', { name: 'cenários aprovados' }));
    const dialogo = await screen.findByRole('dialog');
    await user.click(within(dialogo).getByRole('combobox', { name: /Memória calculada/ }));
    await user.click(await screen.findByRole('option', { name: '72 · versão 1 · Novembro de 2026' }));
    await user.type(within(dialogo).getByLabelText('Justificativa auditável'), 'Vínculo da memória');
    let liberar!: () => void;
    portaoMutacao = new Promise<void>((resolve) => { liberar = resolve; });
    await user.dblClick(within(dialogo).getByRole('button', { name: 'Vincular' }));
    await act(async () => { liberar(); });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(chamadas.filter((c) => c.url.pathname.endsWith('/cenarios'))).toHaveLength(1);

    portaoMutacao = null;
    await user.click(screen.getByRole('button', { name: '+ Novo registro' }));
    const drawer = await screen.findByRole('dialog');
    await user.click(drawer.querySelector('#hom-regra')!);
    await user.type(await screen.findByPlaceholderText('Buscar enquadramento'), '12');
    await user.click(await screen.findByRole('option', { name: '12 · versão 2' }));
    await user.type(within(drawer).getByLabelText('Descrição'), 'Revisão da alíquota');
    await user.type(within(drawer).getByLabelText('Justificativa auditável'), 'Publicar nova alíquota');
    portaoMutacao = new Promise<void>((resolve) => { liberar = resolve; });
    await user.dblClick(within(drawer).getByRole('button', { name: 'Salvar rascunho' }));
    await act(async () => { liberar(); });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(chamadas.filter((c) => c.metodo === 'POST' && c.url.pathname === '/api/erp/fiscal/homologacoes')).toHaveLength(1);
  });
});

describe('padrões do Portão A r4', () => {
  const MENSAGEM_REMOVIDA = 'Esta homologação não está mais disponível. O que foi digitado continua aqui, mas não pode ser enviado.';

  function segurar() {
    let liberar!: () => void;
    portaoMutacao = new Promise<void>((resolve) => { liberar = resolve; });
    return () => liberar();
  }

  it('triplo clique em Aprovar envia uma só requisição e Escape não fecha o diálogo durante o envio', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    const dialogo = await abrirAcao(user, 'Aprovar/rejeitar');
    await user.type(within(dialogo).getByLabelText('Justificativa auditável'), 'Decisão do segundo usuário');
    const liberar = segurar();
    await user.tripleClick(within(dialogo).getByRole('button', { name: 'Aprovar' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await act(async () => { liberar(); });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(chamadas.filter((c) => c.url.pathname.endsWith('/aprovar'))).toHaveLength(1);
  });

  it('triplo clique em Vincular envia uma só requisição e Escape não fecha o diálogo durante o envio', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    await user.click(screen.getByRole('button', { name: 'cenários aprovados' }));
    const dialogo = await screen.findByRole('dialog');
    await user.click(within(dialogo).getByRole('combobox', { name: /Memória calculada/ }));
    await user.click(await screen.findByRole('option', { name: '72 · versão 1 · Novembro de 2026' }));
    await user.type(within(dialogo).getByLabelText('Justificativa auditável'), 'Vínculo da memória');
    const liberar = segurar();
    await user.tripleClick(within(dialogo).getByRole('button', { name: 'Vincular' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await act(async () => { liberar(); });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(chamadas.filter((c) => c.url.pathname.endsWith('/cenarios'))).toHaveLength(1);
  });

  it('triplo clique em Salvar a revisão nova envia uma só requisição e Escape não fecha o drawer durante o envio', async () => {
    const { user } = renderizar();
    await user.click(await screen.findByRole('button', { name: '+ Novo registro' }));
    const drawer = await screen.findByRole('dialog');
    await user.click(drawer.querySelector('#hom-regra')!);
    await user.type(await screen.findByPlaceholderText('Buscar enquadramento'), '12');
    await user.click(await screen.findByRole('option', { name: '12 · versão 2' }));
    await user.type(within(drawer).getByLabelText('Descrição'), 'Revisão da alíquota');
    await user.type(within(drawer).getByLabelText('Justificativa auditável'), 'Publicar nova alíquota');
    const liberar = segurar();
    await user.tripleClick(within(drawer).getByRole('button', { name: 'Salvar rascunho' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await act(async () => { liberar(); });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(chamadas.filter((c) => c.metodo === 'POST' && c.url.pathname === '/api/erp/fiscal/homologacoes')).toHaveLength(1);
  });

  it('404 ao decidir e ao vincular mostra o aviso de removido e bloqueia o reenvio', async () => {
    const { user } = renderizar();
    await abrirFicha(user);
    const decisao = await abrirAcao(user, 'Aprovar/rejeitar');
    await user.type(within(decisao).getByLabelText('Justificativa auditável'), 'Decisão do segundo usuário');
    proximaMutacao = envelope(404, { message: 'Homologação não encontrada' });
    await user.click(within(decisao).getByRole('button', { name: 'Aprovar' }));
    expect(await within(decisao).findByText(MENSAGEM_REMOVIDA)).toBeInTheDocument();
    expect(within(decisao).getByRole('button', { name: 'Aprovar' })).toBeDisabled();
    expect(within(decisao).getByRole('button', { name: 'Rejeitar' })).toBeDisabled();
    expect(chamadas.filter((c) => c.url.pathname.endsWith('/aprovar'))).toHaveLength(1);
    await user.click(within(decisao).getByRole('button', { name: 'Cancelar' }));

    await user.click(screen.getByRole('tab', { name: 'Ficha e campos' }));
    await user.click(screen.getByRole('button', { name: 'cenários aprovados' }));
    const cenario = await screen.findByRole('dialog');
    await user.click(within(cenario).getByRole('combobox', { name: /Memória calculada/ }));
    await user.click(await screen.findByRole('option', { name: '72 · versão 1 · Novembro de 2026' }));
    await user.type(within(cenario).getByLabelText('Justificativa auditável'), 'Vínculo da memória');
    await user.click(within(cenario).getByRole('button', { name: 'Vincular' }));
    expect(await within(cenario).findByText(MENSAGEM_REMOVIDA)).toBeInTheDocument();
    expect(within(cenario).getByRole('button', { name: 'Vincular' })).toBeDisabled();
    expect(chamadas.filter((c) => c.url.pathname.endsWith('/cenarios'))).toHaveLength(1);
  });
});
