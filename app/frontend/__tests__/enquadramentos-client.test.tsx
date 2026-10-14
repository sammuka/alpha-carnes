import { render, screen } from '@testing-library/react';
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

function padrao(metodo: string, caminho: string): Response {
  if (caminho.startsWith('/api/admin/parametros')) {
    return json(200, { valorJson: { provisorio: true, pendencia: 'H-E01-12' } });
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
});
