import { render, screen, within } from '@testing-library/react';
import { PlanoContasClient } from '../src/app/(admin)/erp/contabilidade/plano-de-contas/plano-contas-client';

const conta = {
  codigo: '1.1.01', nome: 'Caixa e bancos', situacaoRotulo: 'Aprovado', naturezaRotulo: 'Ativo', centroNome: 'Operação industrial',
  vigenciaInicio: '2026-10-01', vigenciaFim: null, classificacaoRotulo: 'analítica', grupo: 'Circulante', contaPaiCodigo: '1',
  centroCodigo: 'CT1', situacao: 'APPROVED', natureza: 'ATIVO', classificacao: 'analitica', numero: 1, responsavelNome: 'Administrador',
  criadoEm: '2026-10-15T10:00:00.000Z', alteradoEm: '2026-10-15T10:00:00.000Z',
};

it('mostra os rótulos da grade e esconde uuid e a palavra Marca', () => {
  render(<PlanoContasClient inicial={[{
    codigo: '1.1.01',
    nome: 'Caixa e bancos',
    situacaoRotulo: 'Aprovado',
    naturezaRotulo: 'Ativo',
    centroNome: 'Operação industrial',
    vigenciaInicio: '2026-10-01',
    vigenciaFim: null,
    classificacaoRotulo: 'analítica',
    grupo: 'Circulante',
    contaPaiCodigo: '1',
    centroCodigo: 'CT1',
    situacao: 'APPROVED',
    natureza: 'ATIVO',
    classificacao: 'analitica',
    numero: 1,
    responsavelNome: 'Administrador',
    criadoEm: '2026-10-15T10:00:00.000Z',
    alteradoEm: '2026-10-15T10:00:00.000Z',
  }]} />);
  for (const rotulo of ['Conta contábil', 'Situação', 'Natureza da conta', 'Centro de custo', 'Início de vigência', 'Fim de vigência']) {
    expect(screen.getByRole('columnheader', { name: new RegExp(rotulo) })).toBeInTheDocument();
  }
  // Selo no cabeçalho (persona) e na ficha (Empresa, plano D5).
  expect(screen.getAllByText('Provisório')).toHaveLength(2);
  const texto = document.body.textContent ?? '';
  expect(texto).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  expect(texto).not.toMatch(/Marca/);
  expect(texto).not.toMatch(/E09/);
  expect(texto).not.toMatch(/e09-t01/i);
});

it('monta a tela no DS v3: cabeçalho, KPIs, grade com selo de situação, paginador, abas e ações do domínio', () => {
  render(<PlanoContasClient inicial={[conta]} totalInicial={41} contagensIniciais={{ revisao: 3, suspensos: 2 }} />);
  expect(screen.getByRole('heading', { level: 1, name: 'Plano de contas e centros de custo' })).toBeInTheDocument();
  for (const [rotulo, valor] of [['Em revisão', '3'], ['Bloqueados', '2']] as const) {
    const kpi = screen.getByText(rotulo).parentElement!;
    expect(within(kpi).getByText(valor)).toBeInTheDocument();
  }
  expect(screen.getByRole('heading', { name: 'Registros e consultas' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Detalhamento e execução' })).toBeInTheDocument();
  const celula = screen.getByRole('cell', { name: 'Aprovado' });
  expect(celula.querySelector('span.rounded-full')).not.toBeNull();
  expect(screen.getByText('Exibindo 1 de 41')).toBeInTheDocument();
  expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Página anterior' })).toHaveAttribute('aria-disabled', 'true');
  expect(screen.getByRole('link', { name: 'Próxima página' })).toHaveAttribute('aria-disabled', 'false');
  const abas = screen.getByRole('tablist');
  expect(within(abas).getAllByRole('tab').map((aba) => aba.textContent)).toEqual([
    'Ficha e campos', 'Movimentações', 'Regras e validações', 'Exceções', 'Histórico', 'Integrações', 'Aceite e testes',
  ]);
  expect(screen.getByRole('tab', { name: 'Ficha e campos' })).toHaveAttribute('aria-selected', 'true');
  for (const nome of ['Criar', 'Versionar', 'Aprovar', 'Bloquear conta e mapear lançamentos', 'Revisar competência']) {
    expect(screen.getByRole('button', { name: nome })).toBeInTheDocument();
  }
  for (const nome of ['Exportar', '+ Novo registro', 'Ações do processo']) {
    expect(screen.getByRole('button', { name: nome })).toBeInTheDocument();
  }
});

it('lista vazia mostra o estado vazio do protótipo e mantém as colunas', () => {
  render(<PlanoContasClient inicial={[]} />);
  expect(screen.getByText(/Nenhum resultado para o período, filtro ou situação escolhidos/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ordenar por Conta contábil' })).toBeInTheDocument();
});
