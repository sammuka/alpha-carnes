import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmpresasEstabelecimentosClient } from '../src/components/fiscal/empresas/empresas-estabelecimentos-client';
import { conectarRealtime } from '../src/lib/realtime';
import { FILTROS_PADRAO, type EstabelecimentoDetalhe } from '../src/lib/fiscal-empresas';
import { salvarFiltros } from '../src/lib/fiscal-empresas-filtros';

jest.mock('../src/lib/realtime', () => ({
  conectarRealtime: jest.fn(() => () => undefined),
}));

const conectarRealtimeMock = conectarRealtime as jest.Mock;

// Identificadores reais (UUID): nenhum deles pode aparecer no texto visível.
const E1 = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
const E2 = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c';
const S1 = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a61';
const S2 = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a62';
const S3 = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a63';
const R1 = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a71';
const ALT1 = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a81';

const EMPRESAS = [
  { id: E1, razaoSocial: 'Alpha Carnes Ltda', cnpjRaiz: '12345678', versao: 1 },
  { id: E2, razaoSocial: 'Beta Distribuidora', cnpjRaiz: '87654321', versao: 1 },
];

function detalhe(id: string, extra: Partial<EstabelecimentoDetalhe> = {}): EstabelecimentoDetalhe {
  const porId: Record<string, Partial<EstabelecimentoDetalhe>> = {
    [S1]: { nome: 'Matriz Osasco', situacao: 'APPROVED', empresaId: E1 },
    [S2]: { nome: 'Filial Barueri', situacao: 'REVIEW', empresaId: E1 },
    [S3]: { nome: 'Depósito Cotia', situacao: 'SUSPENDED', empresaId: E2 },
  };
  const base = porId[id] ?? {};
  const empresaId = base.empresaId ?? E1;
  return {
    id,
    empresaId,
    nome: 'Estabelecimento',
    cnpj: '12345678000195',
    inscricaoEstadual: '111.222.333.444',
    inscricaoMunicipal: '998877',
    uf: 'SP',
    municipioIbgeCodigo: null,
    situacao: 'DRAFT',
    versao: 4,
    justificativaSituacao: null,
    empresa: EMPRESAS.find((e) => e.id === empresaId)!,
    cnaes: [{ codigo: '4722901', descricao: 'Comércio varejista de carnes', tipo: 'PRINCIPAL' }],
    regimes: [],
    alteracaoAberta: null,
    responsavel: { nome: 'Maria Souza' },
    ...base,
    ...extra,
  };
}

function linha(id: string) {
  const d = detalhe(id);
  return {
    id,
    empresaId: d.empresaId,
    nome: d.nome,
    cnpj: d.cnpj,
    uf: d.uf,
    situacao: d.situacao,
    versao: d.versao,
    empresa: { razaoSocial: d.empresa!.razaoSocial },
    regime: null,
  };
}

const LINHAS = [linha(S1), linha(S2), linha(S3)];

type Handler = (init: RequestInit | undefined, url: URL) => Response | Promise<Response>;
let rotas: Record<string, Handler> = {};
const fetchMock = jest.fn();

function json(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), { status });
}

function padrao(metodo: string, caminho: string, url: URL): Response {
  if (caminho.startsWith('/api/admin/parametros')) return json(200, { valorJson: { provisorio: true } });
  const rel = caminho.replace('/api/erp/fiscal', '');
  if (metodo === 'GET' && rel === '/empresas') return json(200, { data: EMPRESAS, total: 2, page: 1, pageSize: 100 });
  if (metodo === 'GET' && rel === '/estabelecimentos') {
    const empresaId = url.searchParams.get('empresaId');
    const data = LINHAS.filter((l) => !empresaId || l.empresaId === empresaId);
    return json(200, { data, total: data.length, page: 1, pageSize: Number(url.searchParams.get('pageSize') ?? 20) });
  }
  if (metodo === 'GET' && rel === '/estabelecimentos/contagens') return json(200, { total: 3, emRevisao: 1, suspensos: 1 });
  const m = /^\/estabelecimentos\/([^/]+)(\/historico)?$/.exec(rel);
  if (metodo === 'GET' && m) return m[2] ? json(200, []) : json(200, detalhe(decodeURIComponent(m[1]!)));
  return json(404, { message: 'Não encontrado.' });
}

function chamadas(metodo: string, trecho: RegExp): Array<{ url: URL; init: RequestInit | undefined }> {
  return fetchMock.mock.calls
    .map(([entrada, init]) => ({ url: new URL(String(entrada), 'http://localhost'), init: init as RequestInit | undefined }))
    .filter(({ url, init }) => (init?.method ?? 'GET') === metodo && trecho.test(url.pathname));
}

const listagens = () => chamadas('GET', /\/estabelecimentos$/).filter(({ url }) => url.searchParams.get('pageSize') === '20');
const detalhes = (id: string) => chamadas('GET', new RegExp(`/estabelecimentos/${id}$`));

function renderizar(props: { podeGerenciar?: boolean; podeAprovar?: boolean } = {}) {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(<EmpresasEstabelecimentosClient podeGerenciar={props.podeGerenciar ?? true} podeAprovar={props.podeAprovar ?? true} />);
  return user;
}

async function selecionar(user: ReturnType<typeof userEvent.setup>, nome: string) {
  const celula = await screen.findByText(nome, { selector: 'td' });
  const linhaEl = celula.closest('tr')!;
  linhaEl.focus();
  await user.keyboard('{Enter}');
}

beforeEach(() => {
  window.sessionStorage.clear();
  rotas = {};
  conectarRealtimeMock.mockClear();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (entrada: string, init?: RequestInit) => {
    const url = new URL(String(entrada), 'http://localhost');
    const metodo = init?.method ?? 'GET';
    const custom = rotas[`${metodo} ${url.pathname}`];
    return custom ? custom(init, url) : padrao(metodo, url.pathname, url);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('EmpresasEstabelecimentosClient', () => {
  it('mostra carregando, depois a grade, os indicadores e as ações do hero', async () => {
    renderizar();
    expect(screen.getByRole('status', { name: 'Carregando estabelecimentos' })).toBeInTheDocument();

    expect(await screen.findByText('Matriz Osasco')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Empresas, estabelecimentos e regime' })).toBeInTheDocument();
    expect(screen.getByText('Estabelecimentos')).toBeInTheDocument();
    expect(screen.getByText('Em revisão')).toBeInTheDocument();
    expect(screen.getByText('Exigem decisão humana')).toBeInTheDocument();
    expect(screen.getByText('Suspensos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Novo registro' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ações do processo/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar visão' })).toBeInTheDocument();
    expect(conectarRealtimeMock).toHaveBeenCalledWith(expect.objectContaining({ rooms: ['fiscal-empresas'] }));
    expect(listagens()[0]!.url.searchParams.get('pageSize')).toBe('20');
  });

  it('sem permissão de gerenciar, esconde "+ Novo registro"', async () => {
    renderizar({ podeGerenciar: false, podeAprovar: false });
    await screen.findByText('Matriz Osasco');
    expect(screen.queryByRole('button', { name: '+ Novo registro' })).not.toBeInTheDocument();
  });

  it('estado de erro oferece "Tentar novamente" e recupera a grade', async () => {
    let falhas = 1;
    rotas['GET /api/erp/fiscal/estabelecimentos'] = (_init, url) =>
      falhas-- > 0 ? json(500, { message: 'boom' }) : padrao('GET', url.pathname, url);
    const user = renderizar();

    expect(await screen.findByRole('alert')).toHaveTextContent('Serviço indisponível no momento. Tente novamente.');
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Matriz Osasco')).toBeInTheDocument();
  });

  it('estado vazio orienta a limpar filtros ou cadastrar', async () => {
    rotas['GET /api/erp/fiscal/estabelecimentos'] = (_init, url) =>
      json(200, { data: [], total: 0, page: 1, pageSize: Number(url.searchParams.get('pageSize') ?? 20) });
    renderizar();
    expect(await screen.findByText(/Nenhum resultado para o período, filtro ou situação escolhidos/)).toBeInTheDocument();
    expect(screen.getByText('Limpe os filtros ou cadastre um novo registro.')).toBeInTheDocument();
  });

  it('trocar a empresa limpa o estabelecimento filtrado e recarrega a grade', async () => {
    salvarFiltros({ ...FILTROS_PADRAO, empresaId: E1, estabelecimentoId: S2 });
    const user = renderizar();
    await screen.findByText('Filial Barueri', { selector: 'td' });
    await waitFor(() => expect(listagens().some(({ url }) => url.searchParams.get('estabelecimentoId') === S2)).toBe(true));
    expect(screen.getByRole('combobox', { name: 'Estabelecimento' })).toHaveTextContent('Filial Barueri');

    await user.click(screen.getByRole('combobox', { name: 'Empresa' }));
    await user.click(await screen.findByRole('option', { name: /Beta Distribuidora/ }));

    await waitFor(() => {
      const ultima = listagens().at(-1)!.url.searchParams;
      expect(ultima.get('empresaId')).toBe(E2);
      expect(ultima.has('estabelecimentoId')).toBe(false);
    });
    expect(screen.getByRole('combobox', { name: 'Estabelecimento' })).toHaveTextContent('Todos os estabelecimentos');
    expect(window.sessionStorage.getItem('alphacarnes:fiscal-empresas:filtros')).toContain(E2);
  });

  it('Enter na linha abre o detalhamento com as 7 abas e Município/Certificado provisórios, sem identificadores', async () => {
    const user = renderizar();
    await selecionar(user, 'Matriz Osasco');

    const abas = await screen.findAllByRole('tab');
    expect(abas.map((a) => a.textContent)).toEqual([
      'Ficha e campos',
      'Movimentações',
      'Regras e validações',
      'Exceções',
      'Histórico',
      'Integrações',
      'Aceite e testes',
    ]);
    expect(await screen.findByText('Trilha e responsabilização')).toBeInTheDocument();
    expect(screen.getAllByText('Opcional; não impede a aprovação')).toHaveLength(2);
    expect(screen.getAllByText('Provisório').length).toBeGreaterThanOrEqual(2);

    const texto = document.body.textContent ?? '';
    for (const id of [E1, E2, S1, S2, S3, R1, ALT1]) expect(texto).not.toContain(id);
    expect(texto).not.toMatch(/E01-T01/);
    expect(texto).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/);
    expect(texto).not.toMatch(/Marca/);
  });

  it('aprovado com alteração pendente mostra "Alteração aguardando revisão" ao lado do aprovado e bloqueia nova edição', async () => {
    rotas[`GET /api/erp/fiscal/estabelecimentos/${S1}`] = () =>
      json(
        200,
        detalhe(S1, {
          alteracaoAberta: {
            id: ALT1,
            nome: 'Matriz Osasco Centro',
            inscricaoEstadual: '111.222.333.444',
            inscricaoMunicipal: '998877',
            uf: 'SP',
            situacao: 'REVIEW',
            versao: 2,
            versaoBase: 4,
            cnaes: [{ codigo: '4722901', descricao: 'Comércio varejista de carnes', tipo: 'PRINCIPAL' }],
          },
        }),
      );
    const user = renderizar();
    await selecionar(user, 'Matriz Osasco');

    const bloco = await screen.findByRole('region', { name: 'Alteração aguardando revisão' });
    expect(within(bloco).getByText('Matriz Osasco')).toBeInTheDocument();
    expect(within(bloco).getByText('Matriz Osasco Centro')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Editar versão/ })).toBeDisabled();
  });

  it('aprovado não é editado no lugar: "Editar versão" abre o drawer de alteração', async () => {
    const user = renderizar();
    await selecionar(user, 'Matriz Osasco');
    await user.click(await screen.findByRole('button', { name: /Editar versão/ }));
    expect(await screen.findByText('Alteração do estabelecimento')).toBeInTheDocument();
    expect(screen.getByText('Motivo da alteração')).toBeInTheDocument();
  });

  it('editor de CNAE: máscara 0000-0/00, um principal e aviso sem consulta à Receita', async () => {
    const user = renderizar();
    await screen.findByText('Matriz Osasco');
    await user.click(screen.getByRole('button', { name: '+ Novo registro' }));

    expect(
      await screen.findByText(
        'Confira os códigos e descrições com a documentação da empresa (cartão CNPJ). O sistema não consulta a Receita Federal.',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Opcional; não impede a aprovação')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: /Adicionar atividade/ }));
    await user.type(screen.getByLabelText('Código do CNAE 1'), '4722901');
    expect(screen.getByLabelText('Código do CNAE 1')).toHaveValue('4722-9/01');
    expect(screen.getByLabelText('Tipo da atividade 1')).toHaveValue('PRINCIPAL');

    await user.click(screen.getByRole('button', { name: /Adicionar atividade/ }));
    expect(screen.getByLabelText('Tipo da atividade 2')).toHaveValue('SECUNDARIA');
    await user.selectOptions(screen.getByLabelText('Tipo da atividade 2'), 'PRINCIPAL');
    expect(screen.getByLabelText('Tipo da atividade 1')).toHaveValue('SECUNDARIA');
    expect(screen.getByLabelText('Tipo da atividade 2')).toHaveValue('PRINCIPAL');
  });

  it('challenge 409 de troca de regime: pergunta e reenvia com confirmarTroca', async () => {
    rotas[`GET /api/erp/fiscal/estabelecimentos/${S1}`] = () =>
      json(
        200,
        detalhe(S1, {
          regimes: [{ id: R1, crt: '1', vigenciaInicio: '2026-01-01', vigenciaFim: null, situacao: 'DRAFT', versao: 2 }],
        }),
      );
    let tentativas = 0;
    rotas[`POST /api/erp/fiscal/estabelecimentos/${S1}/regimes/${R1}/submeter`] = () =>
      ++tentativas === 1
        ? json(409, { message: 'Confirme a troca.', codigo: 'TROCA_REGIME_CONFIRMACAO_NECESSARIA', fimProposto: '2026-12-31', semRegimeAPartirDe: '2027-03-01' })
        : json(200, { id: R1 });

    const user = renderizar();
    await selecionar(user, 'Matriz Osasco');
    await user.click(await screen.findByRole('tab', { name: 'Movimentações' }));
    await user.click(await screen.findByRole('button', { name: 'Submeter regime Simples Nacional a partir de 01/01/2026' }));

    await user.type(await screen.findByLabelText(/Justificativa/), 'Mudança de enquadramento');
    await user.click(screen.getByRole('button', { name: 'Enviar para revisão' }));

    const desafio = await screen.findByText(/Encerrar o regime atual em 31\/12\/2026 e submeter a troca\?/);
    expect(desafio).toHaveTextContent('a partir de 01/03/2027 o estabelecimento ficará sem regime vigente');
    expect(desafio).not.toHaveTextContent('2026-12-31');
    await user.click(screen.getByRole('button', { name: 'Encerrar e submeter' }));

    await waitFor(() => expect(tentativas).toBe(2));
    const posts = chamadas('POST', /\/submeter$/).map(({ init }) => JSON.parse(String(init?.body)));
    expect(posts[0]).toEqual({ versao: 2, justificativa: 'Mudança de enquadramento' });
    expect(posts[1]).toEqual({ versao: 2, justificativa: 'Mudança de enquadramento', confirmarTroca: true });
  });

  it.each([
    ['SEGREGACAO_FUNCAO', 'A aprovação deve ser feita por usuário diferente de quem submeteu.'],
    ['ALTERACAO_DESATUALIZADA', 'O cadastro mudou depois desta proposta. Descarte o rascunho ou rejeite a revisão e crie uma nova.'],
    ['CONFLITO_CONCORRENTE', 'O registro foi alterado por outro usuário. Recarregue para continuar.'],
  ])('erro %s da decisão mostra a mensagem do contrato', async (codigo, mensagem) => {
    rotas[`POST /api/erp/fiscal/estabelecimentos/${S2}/aprovar`] = () => json(409, { message: 'texto técnico', codigo });
    const user = renderizar();
    await selecionar(user, 'Filial Barueri');
    await user.click(await screen.findByRole('tab', { name: 'Movimentações' }));
    const antes = detalhes(S2).length;
    await user.click(await screen.findByRole('button', { name: 'Aprovar' }));

    await user.type(await screen.findByLabelText(/Justificativa/), 'Conferido');
    const dialogo = await screen.findByRole('dialog');
    await user.click(within(dialogo).getByRole('button', { name: 'Aprovar' }));

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(mensagem);
    // Em conflito de concorrência o detalhe é recarregado do servidor.
    if (codigo === 'CONFLITO_CONCORRENTE') await waitFor(() => expect(detalhes(S2).length).toBeGreaterThan(antes));
  });

  it('tempo real refaz lista e detalhe (sem polling) e reconexão também', async () => {
    const user = renderizar();
    await selecionar(user, 'Matriz Osasco');
    await screen.findByText('Trilha e responsabilização');
    const { onMessage, onReconnect } = conectarRealtimeMock.mock.calls[0]![0] as {
      onMessage: (m: { type: string; payload: unknown }) => void;
      onReconnect: () => void;
    };

    const listas = listagens().length;
    const dets = detalhes(S1).length;
    act(() => onMessage({ type: 'outro_evento', payload: {} }));
    expect(listagens().length).toBe(listas);

    act(() => onMessage({ type: 'estabelecimento_fiscal_alterado', payload: {} }));
    await waitFor(() => expect(listagens().length).toBe(listas + 1));
    await waitFor(() => expect(detalhes(S1).length).toBe(dets + 1));

    act(() => onReconnect());
    await waitFor(() => expect(listagens().length).toBe(listas + 2));
  });

  it('histórico: falha oferece "Tentar novamente" e depois lista eventos sem identificadores', async () => {
    let falhas = 1;
    rotas[`GET /api/erp/fiscal/estabelecimentos/${S1}/historico`] = () =>
      falhas-- > 0
        ? json(500, { message: 'boom' })
        : json(200, [
            {
              objeto: 'estabelecimento',
              operacao: 'INSERT',
              situacaoAnterior: null,
              situacaoNova: 'DRAFT',
              usuarioNome: 'Maria Souza',
              criadoEm: '2026-10-13T12:00:00.000Z',
              justificativa: 'Cadastro inicial',
              resumo: S1,
            },
          ]);
    const user = renderizar();
    await selecionar(user, 'Matriz Osasco');
    await user.click(await screen.findByRole('tab', { name: 'Histórico' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Serviço indisponível no momento. Tente novamente.');
    await user.click(within(alerta).getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText(/Estabelecimento — Cadastro criado/)).toBeInTheDocument();
    expect(screen.getByText('Justificativa: Cadastro inicial')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(S1);
  });

  it('falha ao carregar o detalhe mostra erro com "Tentar novamente"', async () => {
    let falhas = 1;
    rotas[`GET /api/erp/fiscal/estabelecimentos/${S1}`] = (_init, url) =>
      falhas-- > 0 ? json(500, { message: 'boom' }) : padrao('GET', url.pathname, url);
    const user = renderizar();
    await selecionar(user, 'Matriz Osasco');
    const alerta = await screen.findByText('Serviço indisponível no momento. Tente novamente.', { selector: 'div[role="alert"]' });
    await user.click(within(alerta).getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Trilha e responsabilização')).toBeInTheDocument();
  });

  it('"Exportar visão" baixa a visão atual como arquivo', async () => {
    const blob = new Blob(['a;b'], { type: 'text/csv' });
    rotas['GET /api/erp/fiscal/estabelecimentos/exportacao'] = () => ({ ok: true, status: 200, blob: async () => blob }) as unknown as Response;
    const criar = jest.fn(() => 'blob:fake');
    const revogar = jest.fn();
    Object.assign(URL, { createObjectURL: criar, revokeObjectURL: revogar });
    const cliqueLink = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const user = renderizar();
    await screen.findByText('Matriz Osasco');
    await user.click(screen.getByRole('button', { name: 'Exportar visão' }));

    await waitFor(() => expect(criar).toHaveBeenCalledWith(blob));
    expect(cliqueLink).toHaveBeenCalled();
    expect(chamadas('GET', /\/exportacao$/)).toHaveLength(1);
    cliqueLink.mockRestore();
  });
});
