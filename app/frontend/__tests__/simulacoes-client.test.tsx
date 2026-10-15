import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExplicacaoPainel } from '../src/components/fiscal/simulacoes/explicacao-painel';
import { SimulacaoDrawer } from '../src/components/fiscal/simulacoes/simulacao-drawer';
import { SimulacoesClient } from '../src/components/fiscal/simulacoes/simulacoes-client';
import { FRASE_SEM_ALIQUOTA, TEXTO_VAZIO } from '../src/lib/fiscal-simulacoes';

jest.mock('../src/lib/realtime', () => ({
  conectarRealtime: jest.fn(() => () => undefined),
}));

const ID = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a81';

const LINHA = {
  id: ID,
  cliente: 'Açougue Central',
  produto: 'Traseiro',
  valor: '1.000,00',
  valorLiquido: '1.000,00',
  estabelecimento: 'Osasco',
  operacao: 'Compra outubro',
};

const DETALHE = {
  id: ID,
  codigo: '71',
  numeroVersao: 1,
  versao: 1,
  situacao: 'Calculada',
  cliente: 'Açougue Central',
  produto: 'Traseiro',
  estabelecimento: 'Osasco',
  operacao: 'Compra outubro',
  ncm: '0201.30.00',
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
  atualizadoEm: '2026-10-14T12:00:00.000Z',
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

function envelope(status: number, corpo: Record<string, unknown>): Response {
  return json(status, { message: corpo, error: 'erro', statusCode: status });
}

let lista = [LINHA];
let proximaAcao: Response | null = null;

function padrao(metodo: string, caminho: string): Response {
  if (metodo === 'GET' && caminho.startsWith('/api/erp/fiscal/simulacoes/contagens')) {
    return json(200, { simulacoes: lista.length, versoes: lista.length, baseDiferente: 1 });
  }
  if (metodo === 'GET' && caminho === `/api/erp/fiscal/simulacoes/${ID}`) return json(200, DETALHE);
  if (metodo === 'GET' && caminho === `/api/erp/fiscal/simulacoes/${ID}/historico`) return json(200, []);
  if (metodo === 'GET' && caminho === `/api/erp/fiscal/simulacoes/${ID}/explicacao`) return json(200, EXPLICACAO);
  if (metodo === 'GET' && caminho === `/api/erp/fiscal/simulacoes/${ID}/pre-condicoes`) return json(200, []);
  if (metodo === 'GET' && caminho.startsWith('/api/erp/fiscal/simulacoes') && !caminho.includes(ID)) {
    return json(200, { data: lista, total: lista.length, page: 1, pageSize: 20 });
  }
  if (proximaAcao && metodo === 'POST' && caminho.startsWith('/api/erp/fiscal/simulacoes')) return proximaAcao;
  if (caminho.startsWith('/api/erp/fiscal/') || caminho.startsWith('/api/operacoes') || caminho.startsWith('/api/cadastros/')) {
    return json(200, { data: [] });
  }
  return json(404, { message: 'Não encontrado.' });
}

beforeEach(() => {
  lista = [LINHA];
  proximaAcao = null;
  window.sessionStorage.clear();
  global.fetch = jest.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(entrada), 'http://localhost');
    return padrao(init?.method ?? 'GET', url.pathname);
  }) as unknown as typeof fetch;
});

async function abrirESalvar(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: '+ Novo registro' }));
  await user.type(screen.getByLabelText('Motivo da alteração'), 'Motivo da simulação de outubro');
  await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
}

describe('simulacoes-client', () => {
  it('rótulos literais do protótipo', () => {
    render(<SimulacaoDrawer aberto estabelecimentos={[]} operacoes={[]} clientes={[]} produtos={[]} ncms={[]} enquadramentos={[]} />);
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

  it('lista vazia usa a frase do protótipo', async () => {
    lista = [];
    render(<SimulacoesClient podeGerenciar />);
    expect(await screen.findByText(TEXTO_VAZIO)).toBeInTheDocument();
  });

  it('grade sem uuid e com os selos provisórios', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { container } = render(<SimulacoesClient podeGerenciar />);
    const celula = await screen.findByText('Compra outubro', { selector: 'td' });
    celula.closest('tr')!.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Alpha Carnes Ltda')).toBeInTheDocument();
    expect(container.textContent).toContain('H-E01-10');
    expect(container.textContent).toContain('H-E01-11');
    expect(container.textContent).toContain('H-E01-12');
    expect(container.textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    expect(screen.queryByRole('button', { name: 'Aprovar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument();
  });

  it('alerta do 422 FALTA_REFERENCIA_LEGAL', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<SimulacoesClient podeGerenciar />);
    proximaAcao = envelope(422, {
      message: 'Não há regra tributária aprovada vigente nesta competência para o enquadramento selecionado.',
      codigo: 'FALTA_REFERENCIA_LEGAL',
    });
    await abrirESalvar(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não há regra tributária aprovada vigente nesta competência para o enquadramento selecionado.');
  });

  it('alerta do 422 DESCONTO_MAIOR_QUE_VALOR', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<SimulacoesClient podeGerenciar />);
    proximaAcao = envelope(422, {
      message: 'O desconto não pode ser maior que o valor.',
      codigo: 'DESCONTO_MAIOR_QUE_VALOR',
    });
    await abrirESalvar(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('O desconto não pode ser maior que o valor.');
  });

  it('alerta do 409 VERSAO_IMUTAVEL', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<SimulacoesClient podeGerenciar />);
    proximaAcao = envelope(409, {
      message: 'A memória calculada não pode ser alterada. Inclua uma versão nova.',
      codigo: 'VERSAO_IMUTAVEL',
    });
    await abrirESalvar(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('A memória calculada não pode ser alterada. Inclua uma versão nova.');
  });
});
