import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanoContasClient, type ContaGrade } from '../src/app/(admin)/erp/contabilidade/plano-de-contas/plano-contas-client';
import {
  PoliticasContabilizacaoClient,
  type PoliticaApresentada,
} from '../src/app/(admin)/erp/contabilidade/politicas-de-contabilizacao/politicas-contabilizacao-client';

beforeEach(() => sessionStorage.clear());

const conta: ContaGrade = {
  codigo: '1.1.01', nome: 'Caixa e bancos', situacaoRotulo: 'Aprovado', naturezaRotulo: 'Ativo', centroNome: 'Operação industrial',
  vigenciaInicio: '2026-10-01', vigenciaFim: null, classificacaoRotulo: 'analítica', grupo: 'Circulante', contaPaiCodigo: null,
  centroCodigo: 'CT1', situacao: 'APPROVED', natureza: 'ATIVO', classificacao: 'analitica', numero: 1, responsavelNome: 'Administrador',
  criadoEm: '2026-10-15T10:00:00.000Z', alteradoEm: '2026-10-15T10:00:00.000Z',
};

const politica: PoliticaApresentada = {
  codigo: 'LIQUIDACAO-2026-10', tipoEvento: 'LIQUIDACAO', tipoEventoRotulo: 'Liquidação', competencia: '2026-10-01',
  competenciaRotulo: 'Outubro de 2026', contaDebitoCodigo: '1.1.01', contaDebitoNome: 'Caixa e bancos', contaCreditoCodigo: '2.1.01',
  contaCreditoNome: 'Fornecedores', centroCodigo: 'CT1', centroNome: 'Operação industrial', vigenciaInicio: '2026-10-01',
  situacao: 'DRAFT', situacaoRotulo: 'Rascunho', numero: 1, responsavelNome: 'Administrador', aprovadorNome: null,
  criadoEm: '2026-10-15T10:00:00.000Z', alteradoEm: '2026-10-15T10:00:00.000Z', simulacaoValor: null, simulacaoDebito: null, simulacaoCredito: null,
};

const telas = [
  {
    nome: 'plano de contas',
    montar: () => render(<PlanoContasClient inicial={[conta]} contagensIniciais={{ revisao: 3, suspensos: 2 }} />),
    colunas: ['Conta contábil', 'Situação', 'Natureza da conta', 'Centro de custo', 'Início de vigência', 'Fim de vigência'],
    acao: 'Versionar',
    paragrafo: 'Ação prevista na especificação: Versionar. Pré-condições: partida dobrada, níveis hierárquicos válidos, competência obrigatória. Riscos: conta desativada, mudança de classificação após fechamento. Qualquer transação bancária, fiscal, assinatura ou baixa requer confirmação externa.',
  },
  {
    nome: 'políticas de contabilização',
    montar: () => render(<PoliticasContabilizacaoClient inicial={[politica]} contagensIniciais={{ revisao: 4, suspensos: 1 }} />),
    colunas: ['Competência', 'Situação', 'Conta de débito', 'Conta de crédito', 'Centro de custo', 'Tipo de ocorrência'],
    acao: 'Simular evento',
    paragrafo: 'Ação prevista na especificação: Simular evento. Pré-condições: origem imutável, não lançar sem mapeamento correto, balanceamento exato. Riscos: mapeamento ausente, evento duplicado. Qualquer transação bancária, fiscal, assinatura ou baixa requer confirmação externa.',
  },
];

describe.each(telas)('fidelidade ao protótipo e à E01: $nome', ({ montar, colunas, acao, paragrafo }) => {
  it('+ Novo registro é secundário e só Ações do processo é primário', () => {
    montar();
    expect(screen.getByRole('button', { name: '+ Novo registro' })).toHaveClass('bg-card');
    expect(screen.getByRole('button', { name: '+ Novo registro' })).not.toHaveClass('bg-primary');
    expect(screen.getByRole('button', { name: 'Ações do processo' })).toHaveClass('bg-primary');
  });

  it('KPIs trazem as dicas do protótipo e o tom da E01', () => {
    montar();
    const revisao = screen.getByText('Em revisão').parentElement!;
    expect(within(revisao).getByText('Exigem decisão humana')).toBeInTheDocument();
    expect(revisao.querySelector('.text-warning-fg')).not.toBeNull();
    const bloqueados = screen.getByText('Bloqueados').parentElement!;
    expect(within(bloqueados).getByText('Não gerar sucesso falso')).toBeInTheDocument();
    expect(bloqueados.querySelector('.text-danger-fg')).not.toBeNull();
  });

  it('cabeçalho não ordenável segue a caixa dos ordenáveis, como na grade da E01', () => {
    montar();
    expect(within(screen.getByRole('columnheader', { name: 'Situação' })).getByText('Situação')).toHaveClass('normal-case');
  });

  it('abaixo de 800px a própria linha vira cartão: sem bloco escondido, sem <style>, cada célula com o rótulo da coluna', () => {
    const { container } = montar();
    expect(container.querySelector('style')).toBeNull();
    expect(screen.getByRole('table').closest('[data-slot="card-content"], .grid')!.querySelector('[hidden]')).toBeNull();
    expect(container.querySelector('article')).toBeNull();
    const linha = container.querySelector('tbody tr')!;
    expect(linha).toHaveClass('max-[800px]:grid');
    const rotulos = Array.from(linha.querySelectorAll('td[data-rotulo]')).map((celula) => celula.getAttribute('data-rotulo'));
    expect(rotulos).toEqual(colunas);
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  });

  it('o modal Ação do domínio traz o parágrafo de pré-condições e riscos', async () => {
    montar();
    await userEvent.click(screen.getByRole('button', { name: acao }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText(paragrafo)).toBeInTheDocument();
    expect(dialogo).toHaveAccessibleDescription(paragrafo);
  });
});

describe('lookup das contas e do centro nas políticas', () => {
  const opcoes = {
    contas: [{ codigo: '1.1.01', nome: 'Caixa e bancos' }, { codigo: '2.1.01', nome: 'Fornecedores' }],
    centros: [{ codigo: 'CT1', nome: 'Operação industrial' }],
  };

  function mockOpcoes(corpo: unknown = opcoes) {
    const chamadas: string[] = [];
    global.fetch = jest.fn(async (url: string) => {
      chamadas.push(String(url));
      return { ok: true, status: 200, json: async () => corpo, text: async () => JSON.stringify(corpo) } as Response;
    }) as unknown as typeof fetch;
    return chamadas;
  }

  async function abrirDrawer() {
    render(<PoliticasContabilizacaoClient inicial={[politica]} />);
    await userEvent.click(screen.getByRole('button', { name: '+ Novo registro' }));
    await screen.findByRole('option', { name: 'Fornecedores' }, { timeout: 2000 }).catch(() => undefined);
  }

  it.each([
    ['Conta de débito', 'Pesquisar conta de débito'],
    ['Conta de crédito', 'Pesquisar conta de crédito'],
  ])('%s tem Pesquisar, dica de cadastro e o lookup preenche o select', async (rotulo, botao) => {
    mockOpcoes();
    await abrirDrawer();
    await waitFor(() => expect(within(screen.getByLabelText(rotulo)).getAllByRole('option')).toHaveLength(3));
    const pesquisar = screen.getByRole('button', { name: botao });
    expect(pesquisar).toHaveTextContent('Pesquisar');
    await userEvent.click(pesquisar);
    const popup = await screen.findByRole('dialog', { name: `Selecionar ${rotulo}` });
    await userEvent.type(within(popup).getByLabelText('Pesquisar cadastro'), 'forn');
    expect(within(popup).queryByRole('button', { name: /Caixa e bancos/ })).not.toBeInTheDocument();
    await userEvent.click(within(popup).getByRole('button', { name: /Fornecedores/ }));
    expect(screen.queryByRole('dialog', { name: `Selecionar ${rotulo}` })).not.toBeInTheDocument();
    expect(screen.getByLabelText(rotulo)).toHaveValue('2.1.01');
    expect(pesquisar).toHaveFocus();
  });

  it('as três seleções de cadastro do drawer mostram a dica do protótipo', async () => {
    mockOpcoes();
    await abrirDrawer();
    expect(screen.getAllByText('Seleção vinculada ao cadastro; sem digitar identificadores.')).toHaveLength(3);
  });

  it('Pesquisar do centro de custo abre o lookup quando há opções; Escape fecha e devolve o foco', async () => {
    mockOpcoes();
    await abrirDrawer();
    await waitFor(() => expect(within(screen.getByLabelText('Centro de custo')).getAllByRole('option')).toHaveLength(2));
    const pesquisar = screen.getByRole('button', { name: 'Pesquisar centro de custo' });
    await userEvent.click(pesquisar);
    const popup = await screen.findByRole('dialog', { name: 'Selecionar Centro de custo' });
    expect(within(popup).getByRole('button', { name: /Operação industrial/ })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Selecionar Centro de custo' })).not.toBeInTheDocument();
    expect(pesquisar).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Dados principais' })).toBeInTheDocument();
  });

  it('sem opções, Pesquisar avisa e não abre o lookup', async () => {
    mockOpcoes({ contas: [], centros: [] });
    await abrirDrawer();
    await userEvent.click(screen.getByRole('button', { name: 'Pesquisar conta de débito' }));
    expect(screen.queryByRole('dialog', { name: 'Selecionar Conta de débito' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Nenhum cadastro disponível para seleção. Consulte a área responsável.').length).toBeGreaterThan(0);
  });
});
