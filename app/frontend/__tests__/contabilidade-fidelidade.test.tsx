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

describe.each(telas)('fidelidade ao protótipo e à E01: $nome', ({ montar, colunas }) => {
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
});
