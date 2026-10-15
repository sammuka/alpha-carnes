import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanoContasClient, type ContaGrade } from '../src/app/(admin)/erp/contabilidade/plano-de-contas/plano-contas-client';

const linha = (codigo: string, nome: string): ContaGrade => ({
  codigo, nome, situacaoRotulo: 'Aprovado', naturezaRotulo: 'Ativo', centroNome: 'Operação industrial',
  vigenciaInicio: '2026-10-01', vigenciaFim: null, classificacaoRotulo: 'sintética', grupo: 'Circulante',
  contaPaiCodigo: null, centroCodigo: 'CT1', situacao: 'APPROVED', natureza: 'ATIVO', classificacao: 'sintetica',
  numero: 1, responsavelNome: 'Administrador', criadoEm: '2026-10-15T10:00:00.000Z', alteradoEm: '2026-10-15T10:00:00.000Z',
});

type Opcoes = { itens: { codigo: string; nome: string }[]; truncado?: boolean };
type Resposta = Opcoes | { falha: Response } | { rede: true };

function resposta(r: Resposta): Response {
  if ('falha' in r) return r.falha;
  return { ok: true, status: 200, json: async () => ({ truncado: false, ...(r as Opcoes) }) } as Response;
}

function mockFetch(opcoes: Resposta | ((q: string) => Promise<Response>)) {
  const chamadas: string[] = [];
  const posts: { url: string; corpo: string }[] = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    chamadas.push(String(url));
    if (init?.method === 'POST') posts.push({ url: String(url), corpo: String(init.body) });
    if (!String(url).startsWith('/api/contabilidade/plano/opcoes-pai')) {
      return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' } as Response;
    }
    if (typeof opcoes === 'function') return opcoes(new URL(String(url), 'http://x').searchParams.get('q') ?? '');
    if ('rede' in opcoes) throw new TypeError('Failed to fetch');
    return resposta(opcoes);
  }) as unknown as typeof fetch;
  return { chamadas, posts };
}

const campoPai = () => screen.getByPlaceholderText('Selecione conta contábil');

async function abrirDrawer() {
  await userEvent.click(screen.getByRole('button', { name: '+ Novo registro' }));
}

async function abrirPesquisaPai(drawerAberto = false) {
  if (!drawerAberto) await abrirDrawer();
  await userEvent.click(screen.getByRole('button', { name: 'Pesquisar conta contábil' }));
  return screen.findByRole('dialog', { name: 'Selecionar Conta contábil' });
}

describe('lookup de conta pai (padrão Pesquisar do protótipo)', () => {
  it('abrir o drawer não consulta; o botão Pesquisar abre o popup com as opções do backend e não as da grade', async () => {
    const { chamadas } = mockFetch({ itens: [{ codigo: 'P99', nome: 'Pai de outra página' }] });
    render(<PlanoContasClient inicial={[linha('G1', 'Só na grade')]} />);
    await abrirDrawer();
    expect(chamadas).toEqual([]);
    expect(screen.queryByLabelText('Buscar conta contábil')).not.toBeInTheDocument();
    const popup = await abrirPesquisaPai(true);
    await waitFor(() => expect(chamadas).toContain('/api/contabilidade/plano/opcoes-pai?q='));
    expect(await within(popup).findByRole('button', { name: /Pai de outra página/ })).toBeInTheDocument();
    expect(within(popup).queryByRole('button', { name: /Só na grade/ })).not.toBeInTheDocument();
    expect(within(popup).getByLabelText('Pesquisar cadastro')).toHaveAttribute('type', 'search');
    expect(within(popup).getByText('A seleção utiliza uma referência interna invisível, nunca digitação de GUID.')).toBeInTheDocument();
  });

  it('os dois botões Pesquisar do drawer têm nome contextual e mantêm o texto visível do protótipo', async () => {
    mockFetch({ itens: [] });
    render(<PlanoContasClient inicial={[]} />);
    await abrirDrawer();
    for (const nome of ['Pesquisar centro de custo', 'Pesquisar conta contábil']) {
      expect(screen.getByRole('button', { name: nome })).toHaveTextContent(/^Pesquisar$/);
    }
  });

  it('a busca dentro do popup consulta o backend com o texto digitado', async () => {
    const { chamadas } = mockFetch({ itens: [] });
    render(<PlanoContasClient inicial={[]} />);
    const popup = await abrirPesquisaPai();
    await userEvent.type(within(popup).getByLabelText('Pesquisar cadastro'), 'cx');
    await waitFor(() => expect(chamadas).toContain('/api/contabilidade/plano/opcoes-pai?q=cx'));
  });

  it('escolher uma opção grava o pai no select, fecha o popup e o Criar envia o código', async () => {
    const { posts } = mockFetch({ itens: [{ codigo: 'P99', nome: 'Pai de outra página' }] });
    render(<PlanoContasClient inicial={[]} />);
    const popup = await abrirPesquisaPai();
    await userEvent.click(await within(popup).findByRole('button', { name: /Pai de outra página/ }));
    expect(screen.queryByRole('dialog', { name: 'Selecionar Conta contábil' })).not.toBeInTheDocument();
    expect(campoPai()).toHaveValue('P99');
    expect(campoPai()).toHaveDisplayValue('Pai de outra página');
    // Há dois botões "Criar" (ação da grade e botão do drawer); o do drawer é o último, como no Playwright.
    await userEvent.click(screen.getAllByRole('button', { name: 'Criar' }).at(-1)!);
    await waitFor(() => expect(posts.find((post) => post.url === '/api/contabilidade/plano')?.corpo).toContain('"contaPaiCodigo":"P99"'));
  });

  it('Fechar descarta o popup sem alterar o pai', async () => {
    mockFetch({ itens: [{ codigo: 'P99', nome: 'Pai de outra página' }] });
    render(<PlanoContasClient inicial={[]} />);
    const popup = await abrirPesquisaPai();
    await userEvent.click(within(popup).getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog', { name: 'Selecionar Conta contábil' })).not.toBeInTheDocument();
    expect(campoPai()).toHaveValue('');
  });

  it('o popup é modal e devolve o foco ao botão que o abriu ao fechar por Fechar ou Escape', async () => {
    mockFetch({ itens: [] });
    render(<PlanoContasClient inicial={[]} />);
    await abrirDrawer();
    const botao = screen.getByRole('button', { name: 'Pesquisar conta contábil' });
    const popup = await abrirPesquisaPai(true);
    expect(popup).toHaveAttribute('aria-modal', 'true');
    await userEvent.click(within(popup).getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog', { name: 'Selecionar Conta contábil' })).not.toBeInTheDocument();
    expect(botao).toHaveFocus();

    await abrirPesquisaPai(true);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Selecionar Conta contábil' })).not.toBeInTheDocument();
    expect(botao).toHaveFocus();
  });

  it('avisa quando a lista foi cortada no teto', async () => {
    mockFetch({ itens: [{ codigo: 'P1', nome: 'Primeira' }], truncado: true });
    render(<PlanoContasClient inicial={[]} />);
    const popup = await abrirPesquisaPai();
    expect(await within(popup).findByText('Refine a busca para ver mais contas.')).toBeInTheDocument();
  });

  it('mostra a falha do backend no popup em vez de lista vazia silenciosa', async () => {
    mockFetch({ falha: { ok: false, status: 500, text: async () => JSON.stringify({ message: 'Falha ao carregar as contas' }) } as Response });
    render(<PlanoContasClient inicial={[]} />);
    const popup = await abrirPesquisaPai();
    expect(await within(popup).findByText('Falha ao carregar as contas')).toBeInTheDocument();
  });

  it('rede caída é capturada: mostra o erro no popup e não gera rejeição não tratada', async () => {
    const rejeicoes: unknown[] = [];
    const aoRejeitar = (motivo: unknown) => rejeicoes.push(motivo);
    process.on('unhandledRejection', aoRejeitar);
    try {
      mockFetch({ rede: true });
      render(<PlanoContasClient inicial={[]} />);
      const popup = await abrirPesquisaPai();
      expect(await within(popup).findByText('Não foi possível carregar as contas. Tente novamente.')).toBeInTheDocument();
      await new Promise((resolver) => setTimeout(resolver, 0));
      expect(rejeicoes).toEqual([]);
    } finally {
      process.off('unhandledRejection', aoRejeitar);
    }
  });

  it('falha de pedido obsoleto não mostra erro nem apaga a lista do pedido mais novo', async () => {
    let falharPrimeiro: (r: Response) => void = () => undefined;
    const primeiro = new Promise<Response>((resolver) => { falharPrimeiro = resolver; });
    mockFetch((q) => (q === ''
      ? primeiro
      : Promise.resolve(resposta({ itens: [{ codigo: 'P7', nome: 'Pai recente' }] }))));
    render(<PlanoContasClient inicial={[]} />);
    const popup = await abrirPesquisaPai();
    await userEvent.type(within(popup).getByLabelText('Pesquisar cadastro'), 'a');
    expect(await within(popup).findByRole('button', { name: /Pai recente/ })).toBeInTheDocument();
    falharPrimeiro({ ok: false, status: 500, text: async () => JSON.stringify({ message: 'Falha antiga' }) } as Response);
    await new Promise((resolver) => setTimeout(resolver, 0));
    expect(screen.queryByText('Falha antiga')).not.toBeInTheDocument();
    expect(within(popup).getByRole('button', { name: /Pai recente/ })).toBeInTheDocument();
  });

  it('rede caída de pedido obsoleto também não mostra erro', async () => {
    let rejeitarPrimeiro: (e: unknown) => void = () => undefined;
    const primeiro = new Promise<Response>((_ok, rejeitar) => { rejeitarPrimeiro = rejeitar; });
    mockFetch((q) => (q === '' ? primeiro : Promise.resolve(resposta({ itens: [{ codigo: 'P7', nome: 'Pai recente' }] }))));
    render(<PlanoContasClient inicial={[]} />);
    const popup = await abrirPesquisaPai();
    await userEvent.type(within(popup).getByLabelText('Pesquisar cadastro'), 'a');
    expect(await within(popup).findByRole('button', { name: /Pai recente/ })).toBeInTheDocument();
    rejeitarPrimeiro(new TypeError('Failed to fetch'));
    await new Promise((resolver) => setTimeout(resolver, 0));
    expect(screen.queryByText('Não foi possível carregar as contas. Tente novamente.')).not.toBeInTheDocument();
  });
});

describe('lookup de conta pai: teclado e edição', () => {
  it('Tab e Shift+Tab ciclam dentro do popup sem escapar para o drawer', async () => {
    mockFetch({ itens: [{ codigo: 'P1', nome: 'Primeira' }, { codigo: 'P2', nome: 'Segunda' }] });
    render(<PlanoContasClient inicial={[]} />);
    const popup = await abrirPesquisaPai();
    await within(popup).findByRole('button', { name: /Segunda/ });
    const fechar = within(popup).getByRole('button', { name: 'Fechar' });
    const ultima = within(popup).getByRole('button', { name: /Segunda/ });
    ultima.focus();
    await userEvent.tab();
    expect(fechar).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(ultima).toHaveFocus();
  });

  it('Escape fecha o popup mesmo com o foco fora dele e devolve o foco ao botão Pesquisar', async () => {
    mockFetch({ itens: [] });
    render(<PlanoContasClient inicial={[]} />);
    await abrirDrawer();
    const botao = screen.getByRole('button', { name: 'Pesquisar conta contábil' });
    await abrirPesquisaPai(true);
    (document.activeElement as HTMLElement).blur();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Selecionar Conta contábil' })).not.toBeInTheDocument();
    expect(botao).toHaveFocus();
  });

  it('o clique no scrim não fecha o popup', async () => {
    mockFetch({ itens: [] });
    render(<PlanoContasClient inicial={[]} />);
    const popup = await abrirPesquisaPai();
    await userEvent.click(popup);
    expect(screen.getByRole('dialog', { name: 'Selecionar Conta contábil' })).toBeInTheDocument();
  });

  it('editar conta com pai presente na grade mostra o nome do pai no select', async () => {
    mockFetch({ itens: [] });
    const filha = { ...linha('C1', 'Filha'), contaPaiCodigo: 'P1' };
    render(<PlanoContasClient inicial={[filha, linha('P1', 'Conta pai')]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Editar versão' }));
    expect(await screen.findByRole('option', { name: 'Conta pai' })).toBeInTheDocument();
  });

  it('editar conta cujo pai não está na grade busca o nome por opcoes-pai?q=<codigo>', async () => {
    const { chamadas } = mockFetch({ itens: [{ codigo: 'P90', nome: 'Pai remoto' }, { codigo: 'P9', nome: 'Outro' }] });
    render(<PlanoContasClient inicial={[{ ...linha('C1', 'Filha'), contaPaiCodigo: 'P90' }]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Editar versão' }));
    expect(await screen.findByRole('option', { name: 'Pai remoto' })).toBeInTheDocument();
    expect(chamadas).toContain('/api/contabilidade/plano/opcoes-pai?q=P90');
  });

  it('reabrir o popup limpa as opções antigas até a nova resposta', async () => {
    let n = 0;
    let liberar: (r: Response) => void = () => undefined;
    mockFetch(() => {
      n += 1;
      if (n === 1) return Promise.resolve(resposta({ itens: [{ codigo: 'A1', nome: 'Antiga' }] }));
      return new Promise<Response>((r) => { liberar = r; });
    });
    render(<PlanoContasClient inicial={[]} />);
    const popup = await abrirPesquisaPai();
    expect(await within(popup).findByRole('button', { name: /Antiga/ })).toBeInTheDocument();
    await userEvent.click(within(popup).getByRole('button', { name: 'Fechar' }));
    const reaberto = await abrirPesquisaPai(true);
    expect(within(reaberto).queryByRole('button', { name: /Antiga/ })).not.toBeInTheDocument();
    liberar(resposta({ itens: [{ codigo: 'N1', nome: 'Nova' }] }));
    expect(await within(reaberto).findByRole('button', { name: /Nova/ })).toBeInTheDocument();
  });
});
