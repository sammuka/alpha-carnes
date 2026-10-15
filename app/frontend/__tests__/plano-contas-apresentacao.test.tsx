import { render, screen } from '@testing-library/react';
import { PlanoContasClient } from '../src/app/(admin)/erp/contabilidade/plano-de-contas/plano-contas-client';

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
  expect(screen.getByText('Provisório')).toBeInTheDocument();
  const texto = document.body.textContent ?? '';
  expect(texto).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  expect(texto).not.toMatch(/Marca/);
  expect(texto).not.toMatch(/E09/);
  expect(texto).not.toMatch(/e09-t01/i);
});
