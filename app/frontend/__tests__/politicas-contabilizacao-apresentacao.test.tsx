import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  PoliticasContabilizacaoClient,
  type PoliticaApresentada,
} from '../src/app/(admin)/erp/contabilidade/politicas-de-contabilizacao/politicas-contabilizacao-client';

function linha(codigo: string, tipoEventoRotulo: string): PoliticaApresentada {
  return {
    codigo,
    tipoEvento: 'LIQUIDACAO',
    tipoEventoRotulo,
    competencia: '2026-10-01',
    competenciaRotulo: 'Outubro de 2026',
    contaDebitoCodigo: '1.1.01',
    contaDebitoNome: 'Caixa e bancos',
    contaCreditoCodigo: '2.1.01',
    contaCreditoNome: 'Fornecedores',
    centroCodigo: 'CT1',
    centroNome: 'Operação industrial',
    vigenciaInicio: '2026-10-01',
    situacao: 'DRAFT',
    situacaoRotulo: 'Rascunho',
    numero: 1,
    responsavelNome: 'Administrador',
    aprovadorNome: null,
    criadoEm: '2026-10-15T10:00:00.000Z',
    alteradoEm: '2026-10-15T10:00:00.000Z',
    simulacaoValor: null,
    simulacaoDebito: null,
    simulacaoCredito: null,
  };
}

it('mostra os rótulos da grade e esconde uuid, enum cru e a palavra Marca', () => {
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  for (const rotulo of ['Competência', 'Situação', 'Conta de débito', 'Conta de crédito', 'Centro de custo', 'Tipo de ocorrência']) {
    expect(screen.getByRole('columnheader', { name: new RegExp(rotulo) })).toBeInTheDocument();
  }
  expect(screen.getByRole('button', { name: 'Configurar mappings' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Simular evento' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Aprovar regra' })).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'Selecionar Liquidação' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Ordenar por Situação' })).not.toBeInTheDocument();
  expect(screen.queryByRole('columnheader', { name: 'Início de vigência' })).not.toBeInTheDocument();
  for (const rotulo of ['Competência', 'Conta de débito', 'Conta de crédito', 'Centro de custo', 'Tipo de ocorrência']) {
    expect(screen.getByRole('button', { name: `Ordenar por ${rotulo}` })).toBeInTheDocument();
  }
  expect(screen.getByText('Provisório')).toBeInTheDocument();
  expect(screen.getByText('Enquadramento fiscal')).toBeInTheDocument();
  const texto = document.body.textContent ?? '';
  expect(texto).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  expect(texto).not.toMatch(/Marca/);
  expect(texto).not.toMatch(/E09/);
  expect(texto).not.toMatch(/e09-t02/i);
  expect(texto).not.toMatch(/LIQUIDACAO/);
});

it('desembrulha o envelope e mostra aprovador diferente do autor', async () => {
  const user = userEvent.setup();
  const fetchMock = jest.fn().mockResolvedValue({
    ok: false,
    status: 422,
    text: async () => JSON.stringify({
      statusCode: 422,
      message: { message: 'aprovador diferente do autor', codigo: 'LIQUIDACAO-2026-10' },
      timestamp: '2026-10-15T00:00:00.000Z',
      path: '/contabilidade/politicas/LIQUIDACAO-2026-10/aprovar',
      requestId: 'unknown',
    }),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  await user.click(screen.getByRole('button', { name: 'Aprovar regra' }));
  await user.type(screen.getByLabelText('Justificativa / observação'), 'o autor tenta aprovar');
  await user.click(screen.getByRole('button', { name: 'Confirmar' }));
  expect(await screen.findByText('aprovador diferente do autor')).toBeInTheDocument();
});

it('com duas linhas marcadas, Simular evento e Aprovar regra chamam o lote', async () => {
  const user = userEvent.setup();
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' });
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[
    linha('LIQUIDACAO-2026-10', 'Liquidação'),
    linha('TARIFA-2026-10', 'Tarifa'),
  ]} />);
  await user.click(screen.getByRole('checkbox', { name: 'Selecionar Liquidação' }));
  await user.click(screen.getByRole('checkbox', { name: 'Selecionar Tarifa' }));
  await user.click(screen.getByRole('button', { name: 'Simular evento' }));
  await user.type(screen.getByLabelText('Justificativa / observação'), 'simula o lote');
  await user.click(screen.getByRole('button', { name: 'Confirmar' }));
  expect(screen.getByText('Valor é obrigatório.')).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText('Valor'), '10,10');
  await user.click(screen.getByRole('button', { name: 'Confirmar' }));
  expect(fetchMock).toHaveBeenCalledWith('/api/contabilidade/politicas/lote', expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({
      acao: 'simular',
      codigos: ['LIQUIDACAO-2026-10', 'TARIFA-2026-10'],
      justificativa: 'simula o lote',
      numeroPorCodigo: { 'LIQUIDACAO-2026-10': 1, 'TARIFA-2026-10': 1 },
      valor: '10.10',
    }),
  }));
  fetchMock.mockClear();
  await user.click(screen.getByRole('button', { name: 'Aprovar regra' }));
  await user.type(screen.getByLabelText('Justificativa / observação'), 'aprova o lote');
  await user.click(screen.getByRole('button', { name: 'Confirmar' }));
  expect(fetchMock).toHaveBeenCalledWith('/api/contabilidade/politicas/lote', expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({
      acao: 'aprovar',
      codigos: ['LIQUIDACAO-2026-10', 'TARIFA-2026-10'],
      justificativa: 'aprova o lote',
      numeroPorCodigo: { 'LIQUIDACAO-2026-10': 1, 'TARIFA-2026-10': 1 },
    }),
  }));
});

it('não marca o 21º código', async () => {
  const user = userEvent.setup();
  const linhas = Array.from({ length: 21 }, (_, indice) => linha(
    `REGISTRO-2026-${String(indice + 1).padStart(2, '0')}`,
    `Registro ${indice + 1}`,
  ));
  render(<PoliticasContabilizacaoClient inicial={linhas} />);
  for (const item of linhas) {
    await user.click(screen.getByRole('checkbox', { name: `Selecionar ${item.tipoEventoRotulo}` }));
  }
  expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(20);
  expect(screen.getByRole('checkbox', { name: 'Selecionar Registro 21' })).not.toBeChecked();
});
