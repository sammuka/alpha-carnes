import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { conectarRealtime } from '@/lib/realtime';
import { HomologacoesClient } from '../src/components/fiscal/homologacoes/homologacoes-client';

jest.mock('@/lib/realtime', () => ({
  conectarRealtime: jest.fn(() => () => undefined),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const ID = '0199aabb-ccdd-7eee-8fff-001122334455';
const REGRA_ID = '0199bbcc-ddee-7fff-8000-112233445566';

const LINHA = {
  id: ID,
  enquadramento: '12',
  vigenciaInicio: '2026-01-01',
  situacao: 'Em revisão',
  usuario: 'Maria Souza',
  aprovador: '',
  descricao: 'Revisão da versão aprovada para publicação.',
};

const DETALHE = {
  id: ID,
  regraId: REGRA_ID,
  codigo: '81',
  numeroVersao: 1,
  versao: 1,
  enquadramento: '12',
  vigenciaInicio: '2026-01-01',
  vigenciaFim: '2026-12-31',
  situacao: 'Em revisão',
  usuario: 'Maria Souza',
  aprovador: '',
  descricao: 'Revisão da versão aprovada para publicação.',
  empresa: 'Alpha Carnes Ltda',
  criadoEm: '2026-10-15T12:00:00.000Z',
  atualizadoEm: '2026-10-15T12:00:00.000Z',
  cenarios: [{ codigo: '71', numeroVersao: 1, competenciaRotulo: 'Outubro de 2026' }],
};

function responder(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fetchPadrao(entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(String(entrada), 'http://localhost');
  const caminho = url.pathname;
  const metodo = init?.method ?? 'GET';
  const headers = { 'Content-Type': 'application/json' };
  if (metodo === 'GET' && caminho === `/api/erp/fiscal/homologacoes/${ID}`) {
    return Promise.resolve(new Response(JSON.stringify(DETALHE), { status: 200, headers }));
  }
  if (metodo === 'GET' && caminho.startsWith('/api/erp/fiscal/homologacoes/contagens')) {
    return Promise.resolve(new Response(JSON.stringify({ total: 1, emRevisao: 1, aprovadas: 0, rejeitadas: 0, publicadas: 0 }), { status: 200, headers }));
  }
  if (metodo === 'GET' && caminho.startsWith('/api/erp/fiscal/homologacoes') && !caminho.includes(ID)) {
    return Promise.resolve(new Response(JSON.stringify({ data: [LINHA], total: 1, page: 1, pageSize: 20 }), { status: 200, headers }));
  }
  return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200, headers }));
}

describe('painel de homologação', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    global.fetch = jest.fn(fetchPadrao) as unknown as typeof fetch;
  });

  it('rótulos literais do protótipo', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { container } = render(<HomologacoesClient podeGerenciar podeAprovar />);
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Novo registro' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ações do processo ▾' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar visão' })).toBeInTheDocument();
    expect(screen.getByText(/revisar diff, aprovar\/rejeitar, publicar e auditar\./)).toBeInTheDocument();
    expect(screen.queryByText(/Revisar diff, aprovar\/rejeitar, publicar e auditar/)).not.toBeInTheDocument();
    expect(screen.getByText(/Acesso típico/)).toBeInTheDocument();
    expect(container.textContent ?? '').toContain('H-E01-12');
    expect(screen.queryByRole('button', { name: 'Cadastrar / revisar' })).not.toBeInTheDocument();
    expect(screen.queryByText('contador e auditor')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar versão' })).not.toBeInTheDocument();

    const celula = await screen.findByText('Revisão da versão aprovada para publicação.');
    celula.closest('tr')!.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('button', { name: 'cenários aprovados' })).toBeInTheDocument();
    expect(screen.queryByText('Cenários aprovados')).not.toBeInTheDocument();
    expect(container.textContent ?? '').not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    expect(container.textContent ?? '').not.toContain(ID);
    expect(container.textContent ?? '').not.toContain(REGRA_ID);

    await user.click(screen.getByRole('button', { name: '+ Novo registro' }));
    expect(screen.getByLabelText('Enquadramento fiscal')).toBeInTheDocument();
    expect(screen.getByLabelText('Descrição')).toBeInTheDocument();
    expect(screen.getByLabelText('Justificativa auditável')).toBeInTheDocument();
    expect(screen.getAllByText('Início de vigência').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Fim de vigência').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Usuário').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Responsável pela aprovação').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Situação').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verificar dados' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeInTheDocument();
    const texto = container.textContent ?? '';
    expect(texto).not.toMatch(/E01-T05/);
    expect(texto).not.toMatch(/Marca/);
    expect(texto).not.toMatch(/identificador regra/i);
  });

  it('não usa a variante outline', () => {
    const pasta = join('src/components/fiscal/homologacoes');
    const fonte = readdirSync(pasta)
      .filter((nome) => nome.endsWith('.tsx'))
      .map((nome) => readFileSync(join(pasta, nome), 'utf8'))
      .join('\n');
    expect(fonte).not.toMatch(/outline/);
    expect(fonte).toMatch(/variant="secondary"/);
  });

  it('lista vazia usa a frase do protótipo', async () => {
    global.fetch = jest.fn(async (entrada: RequestInfo | URL) => {
      const caminho = new URL(String(entrada), 'http://localhost').pathname;
      if (caminho.startsWith('/api/erp/fiscal/homologacoes/contagens')) {
        return responder(200, { total: 0, emRevisao: 0, aprovadas: 0, rejeitadas: 0, publicadas: 0 });
      }
      return responder(200, { data: [], total: 0, page: 1, pageSize: 20 });
    }) as unknown as typeof fetch;
    render(<HomologacoesClient podeGerenciar podeAprovar />);
    expect(await screen.findByText('Nenhum resultado para o período, filtro ou situação escolhidos. Limpe os filtros ou cadastre um novo registro.')).toBeInTheDocument();
  });

  it('mostra selos, ações e alertas de domínio', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    global.fetch = jest.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const caminho = new URL(String(entrada), 'http://localhost').pathname;
      const metodo = init?.method ?? 'GET';
      if (metodo === 'POST' && caminho.endsWith('/aprovar')) {
        return responder(422, { message: { message: 'A aprovação deve ser feita por usuário diferente de quem submeteu.', codigo: 'SEGREGACAO_FUNCAO' } });
      }
      if (metodo === 'POST' && caminho.endsWith('/publicar')) {
        return responder(422, { message: { message: 'A publicação exige ao menos um cenário de regressão.', codigo: 'CENARIO_REGRESSAO_AUSENTE' } });
      }
      if (metodo === 'POST' && caminho.endsWith('/rejeitar')) {
        return responder(409, { message: { message: 'O registro foi alterado por outro usuário. Recarregue para continuar.', codigo: 'CONFLITO_CONCORRENTE' } });
      }
      return fetchPadrao(entrada, init);
    }) as unknown as typeof fetch;

    const { container } = render(<HomologacoesClient podeGerenciar podeAprovar />);
    const celula = await screen.findByText('Revisão da versão aprovada para publicação.');
    celula.closest('tr')!.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('button', { name: 'cenários aprovados' })).toBeInTheDocument();
    expect(container.textContent ?? '').toContain('H-E01-10');
    expect(container.textContent ?? '').toContain('H-E01-11');
    await user.click(screen.getByRole('button', { name: 'Ações do processo ▾' }));
    expect(screen.getByRole('button', { name: 'Revisar diff' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aprovar/rejeitar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publicar e auditar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir ocorrência' })).not.toBeInTheDocument();
    expect(screen.queryByText('Simular erro de validação')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Aprovar/rejeitar' }));
    await user.click(screen.getByRole('button', { name: 'Aprovar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A aprovação deve ser feita por usuário diferente de quem submeteu.');

    await user.click(screen.getByRole('button', { name: 'Rejeitar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('O registro foi alterado por outro usuário. Recarregue para continuar.');

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(screen.getByRole('button', { name: 'Publicar e auditar' }));
    await user.click(screen.getByRole('button', { name: 'Publicar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A publicação exige ao menos um cenário de regressão.');
  });

  it('evento em tempo real recarrega a lista e também a ficha aberta', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    let situacaoAtual = 'Em revisão';
    global.fetch = jest.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const caminho = new URL(String(entrada), 'http://localhost').pathname;
      if ((init?.method ?? 'GET') === 'GET' && caminho === `/api/erp/fiscal/homologacoes/${ID}`) {
        return responder(200, { ...DETALHE, situacao: situacaoAtual });
      }
      return fetchPadrao(entrada, init);
    }) as unknown as typeof fetch;
    render(<HomologacoesClient podeGerenciar podeAprovar />);
    const celula = await screen.findByText('Revisão da versão aprovada para publicação.');
    celula.closest('tr')!.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Situação Em revisão')).toBeInTheDocument();

    situacaoAtual = 'Aprovada';
    const opcoes = (conectarRealtime as jest.Mock).mock.calls.at(-1)![0] as { onMessage: () => void };
    await act(async () => { opcoes.onMessage(); });
    expect(await screen.findByText('Situação Aprovada')).toBeInTheDocument();
  });
});
