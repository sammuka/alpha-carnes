import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegrasClient } from '../src/components/fiscal/regras/regras-client';
import { RegraDrawer } from '../src/components/fiscal/regras/regra-drawer';

jest.mock('../src/lib/realtime', () => ({
  conectarRealtime: jest.fn(() => () => undefined),
}));

const ID = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a71';
const ENQ = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a72';
const OP = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a73';
const CFOP = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a74';
const BEN = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a75';
const CLA = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a76';

const LINHA = {
  id: ID,
  enquadramentoFiscal: '12',
  operacaoFiscal: '5102',
  beneficioFiscal: 'Redução de base — São Paulo',
  classificacaoIbsCbs: 'Tributação integral da classificação',
  operacao: 'Compra outubro',
  tratamentoIcms: 'Redução de base',
};

const DETALHE = {
  id: ID,
  codigo: '2',
  numeroVersao: 1,
  versao: 2,
  enquadramentoId: ENQ,
  operacaoId: OP,
  cfopId: CFOP,
  icmsCst: '20',
  pRedBc: '0.4167',
  pIcms: '0.1200',
  beneficioFiscalId: BEN,
  ipiCst: '53',
  pisCst: '06',
  ibsCst: '000',
  classificacaoIbsCbsId: CLA,
  vigenciaInicio: '2026-01-01',
  vigenciaFim: '2026-12-31',
  situacao: 'Submetida',
  empresaNome: 'Alpha Carnes Ltda',
  responsavel: 'Maria Souza',
  criadoEm: '2026-10-14T12:00:00.000Z',
  atualizadoEm: '2026-10-14T12:00:00.000Z',
  autor: 'Maria Souza',
  aprovador: null,
  tratamentoIcms: 'Redução de base',
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
let detalhe = DETALHE;
let proximaAcao: Response | null = null;

function padrao(metodo: string, caminho: string): Response {
  if (caminho.startsWith('/api/admin/parametros')) {
    return json(200, { valorJson: { provisorio: true, pendencia: 'H-E01-12' } });
  }
  if (metodo === 'GET' && caminho.startsWith('/api/erp/fiscal/regras/contagens')) {
    return json(200, { total: lista.length, rascunhos: 0, submetidas: lista.length, aprovadas: 0, aposentadas: 0 });
  }
  if (metodo === 'GET' && caminho.startsWith('/api/erp/fiscal/regras') && !caminho.includes(`/${ID}`)) {
    return json(200, { data: lista, total: lista.length, page: 1, pageSize: 20 });
  }
  if (metodo === 'GET' && caminho === `/api/erp/fiscal/regras/${ID}`) return json(200, detalhe);
  if (metodo === 'GET' && caminho === `/api/erp/fiscal/regras/${ID}/historico`) return json(200, []);
  if (metodo === 'GET' && caminho === `/api/erp/fiscal/regras/${ID}/pre-condicoes`) {
    return json(200, [
      { codigo: 'DUPLA_APROVACAO', atendida: false, provisoria: true, texto: 'Um aprovador diferente de quem submeteu registra a aprovação. Quantos aprovadores formam quórum ainda não foi decidido.' },
    ]);
  }
  if (caminho.startsWith('/api/erp/fiscal/enquadramentos')) {
    return json(200, { data: [{ id: ENQ, codigo: '12' }] });
  }
  if (caminho.startsWith('/api/erp/fiscal/cfops')) {
    return json(200, { data: [{ id: CFOP, codigo: '5102', descricao: 'Venda' }] });
  }
  if (caminho.startsWith('/api/operacoes')) {
    return json(200, { data: [{ id: OP, rotulo: 'Compra outubro' }] });
  }
  if (caminho.startsWith('/api/erp/fiscal/beneficios-fiscais')) {
    return json(200, { data: [{ id: BEN, codigo: 'SP020450', descricao: 'Redução de base — São Paulo' }] });
  }
  if (caminho.startsWith('/api/erp/fiscal/classificacoes-ibs-cbs')) {
    return json(200, { data: [{ id: CLA, codigo: '000001', descricao: 'Tributação integral da classificação' }] });
  }
  if (proximaAcao && (metodo === 'POST' || metodo === 'PATCH') && caminho.startsWith('/api/erp/fiscal/regras')) {
    return proximaAcao;
  }
  return json(404, { message: 'Não encontrado.' });
}

beforeEach(() => {
  lista = [LINHA];
  detalhe = { ...DETALHE };
  proximaAcao = null;
  window.sessionStorage.clear();
  global.fetch = jest.fn(async (entrada: string, init?: RequestInit) => {
    const url = new URL(String(entrada), 'http://localhost');
    return padrao(init?.method ?? 'GET', url.pathname);
  }) as unknown as typeof fetch;
});

describe('regras-client', () => {
  it('rótulos literais do protótipo', () => {
    render(<RegraDrawer aberto enquadramentos={[]} beneficios={[]} classificacoes={[]} />);
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
    expect(screen.getByRole('option', { name: 'Saída não tributada' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Outras saídas' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tratamento PIS/COFINS')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Tributação normal' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Alíquota zero' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sem incidência' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Outras operações' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tratamento IBS/CBS')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Alíquota reduzida' })).toBeInTheDocument();
    expect(screen.getByLabelText('Benefício fiscal')).toBeInTheDocument();
    expect(screen.getByLabelText('Classificação IBS/CBS')).toBeInTheDocument();
    expect(screen.getByLabelText('Justificativa auditável')).toBeInTheDocument();
    const texto = document.body.textContent ?? '';
    expect(texto).not.toMatch(/CSOSN/);
    expect(texto).not.toMatch(/\bpICMS\b/);
    expect(texto).not.toMatch(/E01-T03/);
    expect(texto).not.toMatch(/Marca/);
  });

  it('lista vazia usa a frase do protótipo', async () => {
    lista = [];
    render(<RegrasClient podeGerenciar podeAprovar />);
    expect(await screen.findByText('Nenhum resultado para o período, filtro ou situação escolhidos. Limpe os filtros ou cadastre um novo registro.')).toBeInTheDocument();
  });

  it('grade sem uuid e com os selos provisórios', async () => {
    const { user, container } = (() => {
      const evento = userEvent.setup({ pointerEventsCheck: 0 });
      const view = render(<RegrasClient podeGerenciar podeAprovar />);
      return { user: evento, ...view };
    })();
    const celula = await screen.findByText('Compra outubro', { selector: 'td' });
    celula.closest('tr')!.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Alpha Carnes Ltda')).toBeInTheDocument();
    expect(container.textContent).toContain('H-E01-10');
    expect(container.textContent).toContain('H-E01-11');
    expect(container.textContent).toContain('H-E01-12');
    expect(container.textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });

  it('alerta do 422 SEGREGACAO_FUNCAO', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<RegrasClient podeGerenciar podeAprovar />);
    const celula = await screen.findByText('Compra outubro', { selector: 'td' });
    celula.closest('tr')!.focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('button', { name: 'Aprovar' });
    proximaAcao = envelope(422, {
      message: 'A aprovação deve ser feita por usuário diferente de quem submeteu.',
      codigo: 'SEGREGACAO_FUNCAO',
    });
    await user.click(screen.getByRole('button', { name: 'Aprovar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A aprovação deve ser feita por usuário diferente de quem submeteu.');
  });

  it('alerta do 422 VIGENCIA_AMBIGUA', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<RegrasClient podeGerenciar podeAprovar />);
    const celula = await screen.findByText('Compra outubro', { selector: 'td' });
    celula.closest('tr')!.focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('button', { name: 'Aprovar' });
    proximaAcao = envelope(422, {
      message: 'Já existe versão aprovada deste enquadramento com vigência sobreposta. Nenhuma foi escolhida.',
      codigo: 'VIGENCIA_AMBIGUA',
    });
    await user.click(screen.getByRole('button', { name: 'Aprovar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Já existe versão aprovada deste enquadramento com vigência sobreposta. Nenhuma foi escolhida.');
  });

  it('alerta do 409 VERSAO_IMUTAVEL', async () => {
    detalhe = { ...DETALHE, situacao: 'Rascunho' };
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<RegrasClient podeGerenciar podeAprovar />);
    const celula = await screen.findByText('Compra outubro', { selector: 'td' });
    celula.closest('tr')!.focus();
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('button', { name: 'Editar versão' }));
    await user.type(screen.getByLabelText('Justificativa auditável'), 'Ajuste da versão imutável');
    proximaAcao = envelope(409, {
      message: 'Versão aprovada ou aposentada não pode ser alterada. Inclua uma versão nova.',
      codigo: 'VERSAO_IMUTAVEL',
    });
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Versão aprovada ou aposentada não pode ser alterada. Inclua uma versão nova.');
  });
});
