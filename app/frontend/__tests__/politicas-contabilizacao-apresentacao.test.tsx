import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  PoliticasContabilizacaoClient,
  type PoliticaApresentada,
} from '../src/app/(admin)/erp/contabilidade/politicas-de-contabilizacao/politicas-contabilizacao-client';

beforeEach(() => sessionStorage.clear());

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
  // Selo no cabeçalho (persona) e na ficha (Enquadramento fiscal e Empresa, plano D5).
  expect(screen.getAllByText('Provisório')).toHaveLength(3);
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
  const efeitos = (acao: string, situacao: string) => JSON.stringify([
    { codigo: 'LIQUIDACAO-2026-10', acao, situacao },
    { codigo: 'TARIFA-2026-10', acao, situacao },
  ]);
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => efeitos('simular', 'DRAFT') });
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
  fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => efeitos('aprovar', 'APPROVED') });
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

function adiavel() {
  let resolver!: (valor: unknown) => void;
  const promessa = new Promise((resolve) => { resolver = resolve; });
  return { promessa, resolver };
}

function corpoOk(corpo: unknown) {
  return { ok: true, status: 201, text: async () => JSON.stringify(corpo) };
}

async function abrirAprovar(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Aprovar regra' }));
  await user.type(screen.getByLabelText('Justificativa / observação'), 'outra pessoa aprova');
  await user.click(screen.getByRole('button', { name: 'Confirmar' }));
}

it('a resposta da simulação não fecha o modal de aprovação aberto depois', async () => {
  const user = userEvent.setup();
  const simulacao = adiavel();
  global.fetch = jest.fn().mockReturnValueOnce(simulacao.promessa) as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  await user.click(screen.getByRole('button', { name: 'Simular evento' }));
  await user.type(screen.getByLabelText('Valor'), '10,10');
  await user.type(screen.getByLabelText('Justificativa / observação'), 'simula');
  await user.click(screen.getByRole('button', { name: 'Confirmar' }));
  // O modal do DS bloqueia o fundo: a pessoa fecha a simulação em voo e abre a aprovação.
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Aprovar regra' }));
  expect(screen.queryByLabelText('Valor')).not.toBeInTheDocument();
  await act(async () => {
    simulacao.resolver(corpoOk({ ...linha('LIQUIDACAO-2026-10', 'Liquidação'), simulacaoValor: '10.10', simulacaoDebito: '10.10', simulacaoCredito: '10.10' }));
  });
  expect(screen.getByLabelText('Justificativa / observação')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Confirmar' })).toBeEnabled();
});

it('Confirmar fica desabilitado enquanto a requisição está em voo', async () => {
  const user = userEvent.setup();
  const simulacao = adiavel();
  const fetchMock = jest.fn().mockReturnValueOnce(simulacao.promessa);
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  await user.click(screen.getByRole('button', { name: 'Simular evento' }));
  await user.type(screen.getByLabelText('Valor'), '10,10');
  await user.type(screen.getByLabelText('Justificativa / observação'), 'simula');
  await user.click(screen.getByRole('button', { name: 'Confirmar' }));
  expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
  await act(async () => { simulacao.resolver(corpoOk(linha('LIQUIDACAO-2026-10', 'Liquidação'))); });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('200 sem a situação aprovada não mostra Aprovado nem concluído com evidência', async () => {
  const user = userEvent.setup();
  global.fetch = jest.fn().mockResolvedValue(corpoOk(linha('LIQUIDACAO-2026-10', 'Liquidação'))) as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  await abrirAprovar(user);
  expect(await screen.findByText(/O servidor não confirmou a operação/)).toBeInTheDocument();
  expect(screen.queryByRole('cell', { name: 'Aprovado' })).not.toBeInTheDocument();
  expect(screen.queryByText('concluído com evidência')).not.toBeInTheDocument();
});

it('200 sem corpo não mostra sucesso', async () => {
  const user = userEvent.setup();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 201, text: async () => '' }) as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  await abrirAprovar(user);
  expect(await screen.findByText(/O servidor não confirmou a operação/)).toBeInTheDocument();
  expect(screen.queryByRole('cell', { name: 'Aprovado' })).not.toBeInTheDocument();
});

it('422 do backend mostra o texto interno e nenhum sucesso', async () => {
  const user = userEvent.setup();
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 422,
    text: async () => JSON.stringify({ statusCode: 422, message: { message: 'aprovador diferente do autor', codigo: 'LIQUIDACAO-2026-10' } }),
  }) as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  await abrirAprovar(user);
  expect(await screen.findByText('aprovador diferente do autor')).toBeInTheDocument();
  expect(screen.queryByRole('cell', { name: 'Aprovado' })).not.toBeInTheDocument();
  expect(screen.queryByText('concluído com evidência')).not.toBeInTheDocument();
});

it('o corpo aprovado do backend atualiza a linha e só então mostra o sucesso', async () => {
  const user = userEvent.setup();
  global.fetch = jest.fn().mockResolvedValue(corpoOk({
    ...linha('LIQUIDACAO-2026-10', 'Liquidação'), situacao: 'APPROVED', situacaoRotulo: 'Aprovado', aprovadorNome: 'Outra pessoa',
  })) as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  await abrirAprovar(user);
  expect(await screen.findByRole('cell', { name: 'Aprovado' })).toBeInTheDocument();
  expect(screen.getByText('concluído com evidência')).toBeInTheDocument();
});

it('lote aprovado só mostra sucesso se todos os efeitos voltam aprovados', async () => {
  const user = userEvent.setup();
  global.fetch = jest.fn().mockResolvedValue(corpoOk([
    { codigo: 'LIQUIDACAO-2026-10', acao: 'aprovar', situacao: 'APPROVED' },
  ])) as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[
    linha('LIQUIDACAO-2026-10', 'Liquidação'),
    linha('TARIFA-2026-10', 'Tarifa'),
  ]} />);
  await user.click(screen.getByRole('checkbox', { name: 'Selecionar Liquidação' }));
  await user.click(screen.getByRole('checkbox', { name: 'Selecionar Tarifa' }));
  await abrirAprovar(user);
  expect(await screen.findByText(/O servidor não confirmou a operação/)).toBeInTheDocument();
  expect(screen.queryByText('concluído com evidência')).not.toBeInTheDocument();
});

it('valor 0,00 é recusado na tela antes de chamar o servidor', async () => {
  const user = userEvent.setup();
  const fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  await user.click(screen.getByRole('button', { name: 'Simular evento' }));
  await user.type(screen.getByLabelText('Valor'), '0,00');
  await user.type(screen.getByLabelText('Justificativa / observação'), 'simula');
  await user.click(screen.getByRole('button', { name: 'Confirmar' }));
  expect(await screen.findByText('Valor deve ser maior que zero.')).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('o bloco Bloqueio / exceção existe só na aba Exceções', async () => {
  const user = userEvent.setup();
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  expect(screen.queryByText(/Bloqueio \/ exceção/)).not.toBeInTheDocument();
  await user.click(screen.getByRole('tab', { name: 'Regras e validações' }));
  expect(screen.queryByText(/Bloqueio \/ exceção/)).not.toBeInTheDocument();
  await user.click(screen.getByRole('tab', { name: 'Exceções' }));
  expect(screen.getAllByText(/Bloqueio \/ exceção/)).toHaveLength(2);
  expect(screen.getByText(/Mapeamento ausente/)).toBeInTheDocument();
  expect(screen.getByText(/Evento duplicado/)).toBeInTheDocument();
});

it('digitar na busca recarrega a lista pelo servidor com os filtros atuais', async () => {
  const user = userEvent.setup();
  const fetchMock = jest.fn().mockResolvedValue(corpoOk({ itens: [linha('TARIFA-2026-10', 'Tarifa')], total: 1 }));
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  expect(fetchMock).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText('Buscar registros da lista'), 'x');
  expect(await screen.findByRole('cell', { name: 'Tarifa' })).toBeInTheDocument();
  expect(screen.queryByRole('cell', { name: 'Liquidação' })).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenLastCalledWith(
    '/api/contabilidade/politicas?pagina=1&q=x&competencia=&situacao=&ordenar=competencia&direcao=asc',
  );
});

it('ordenar por uma coluna recarrega a lista', async () => {
  const user = userEvent.setup();
  const fetchMock = jest.fn().mockResolvedValue(corpoOk({ itens: [], total: 0 }));
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  await user.click(screen.getByRole('button', { name: 'Ordenar por Conta de débito' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('ordenar=contaDebito&direcao=asc')));
});

it('uma resposta antiga não sobrescreve a consulta mais nova', async () => {
  const user = userEvent.setup();
  const lenta = adiavel();
  global.fetch = jest.fn()
    .mockReturnValueOnce(lenta.promessa)
    .mockResolvedValueOnce(corpoOk({ itens: [linha('TARIFA-2026-10', 'Tarifa')], total: 1 })) as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[]} />);
  await user.type(screen.getByLabelText('Buscar registros da lista'), 'ab');
  expect(await screen.findByRole('cell', { name: 'Tarifa' })).toBeInTheDocument();
  await act(async () => { lenta.resolver(corpoOk({ itens: [linha('LIQUIDACAO-2026-10', 'Liquidação')], total: 1 })); });
  expect(screen.queryByRole('cell', { name: 'Liquidação' })).not.toBeInTheDocument();
});

it('falha ao recarregar mostra a mensagem e não apaga a lista', async () => {
  const user = userEvent.setup();
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, text: async () => JSON.stringify({ message: 'Validação falhou' }) }) as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  await user.type(screen.getByLabelText('Buscar registros da lista'), 'x');
  expect(await screen.findByText('Validação falhou')).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: 'Liquidação' })).toBeInTheDocument();
});

it('restaura busca, ordenação e direção do sessionStorage e consulta uma única vez', async () => {
  sessionStorage.setItem('politicas-de-contabilizacao', JSON.stringify({ busca: 'x', ordenar: 'contaDebito', direcao: 'desc' }));
  const fetchMock = jest.fn().mockResolvedValue(corpoOk({ itens: [linha('TARIFA-2026-10', 'Tarifa')], total: 1 }));
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  expect(await screen.findByRole('cell', { name: 'Tarifa' })).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith('/api/contabilidade/politicas?pagina=1&q=x&competencia=&situacao=&ordenar=contaDebito&direcao=desc');
});

// Guarda: hoje a tela não consulta ao montar; o teste trava a consulta extra que uma guarda de "primeira renderização" causaria.
it('guarda: ordenação inválida no sessionStorage é ignorada e sob StrictMode não há consulta extra ao montar', async () => {
  sessionStorage.setItem('politicas-de-contabilizacao', JSON.stringify({ ordenar: 'senha', direcao: 'x' }));
  const fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<StrictMode><PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} /></StrictMode>);
  await act(async () => {});
  expect(fetchMock).not.toHaveBeenCalled();
});

it('confirma na política exibida na ficha quando a selecionada saiu da lista recarregada', async () => {
  const user = userEvent.setup();
  const aprovada = { ...linha('LIQUIDACAO-2026-10', 'Liquidação'), situacao: 'APPROVED', situacaoRotulo: 'Aprovado' };
  const fetchMock = jest.fn()
    .mockResolvedValueOnce(corpoOk({ itens: [linha('LIQUIDACAO-2026-10', 'Liquidação')], total: 1 }))
    .mockResolvedValueOnce(corpoOk(aprovada));
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação'), linha('TARIFA-2026-10', 'Tarifa')]} />);
  await user.click(screen.getByRole('cell', { name: 'Tarifa' }));
  await user.type(screen.getByLabelText('Buscar registros da lista'), 'x');
  await waitFor(() => expect(screen.queryByRole('cell', { name: 'Tarifa' })).not.toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: 'Aprovar regra' }));
  await user.type(screen.getByLabelText('Justificativa / observação'), 'outra pessoa aprova');
  await user.click(screen.getByRole('button', { name: 'Confirmar' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/contabilidade/politicas/LIQUIDACAO-2026-10/aprovar');
});

it('sem política na lista, Confirmar mostra aviso e não chama o servidor', async () => {
  const user = userEvent.setup();
  const fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[]} />);
  await user.click(screen.getByRole('button', { name: 'Simular evento' }));
  await user.type(screen.getByLabelText('Valor'), '10,10');
  await user.type(screen.getByLabelText('Justificativa / observação'), 'simula');
  await user.click(screen.getByRole('button', { name: 'Confirmar' }));
  expect(await screen.findByText('Selecione uma política na lista.')).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('rascunho sem ordenar mantém a ordenação padrão por competência ao restaurar', async () => {
  sessionStorage.setItem('politicas-de-contabilizacao', JSON.stringify({ busca: 'x' }));
  const fetchMock = jest.fn().mockResolvedValue(corpoOk({ itens: [linha('TARIFA-2026-10', 'Tarifa')], total: 1 }));
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
  expect(await screen.findByRole('cell', { name: 'Tarifa' })).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith('/api/contabilidade/politicas?pagina=1&q=x&competencia=&situacao=&ordenar=competencia&direcao=asc');
});

function muitas(quantidade: number) {
  return Array.from({ length: quantidade }, (_, i) => linha(`LIQUIDACAO-2026-${i}`, `Liquidação ${i}`));
}
const URL_PAGINA_2 = '/api/contabilidade/politicas?pagina=2&q=&competencia=&situacao=&ordenar=competencia&direcao=asc';

it('mostra a posição na lista e desabilita Anterior na primeira página', () => {
  render(<PoliticasContabilizacaoClient inicial={muitas(20)} totalInicial={45} />);
  expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
  expect(screen.getByText('Exibindo 20 de 45')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Página anterior' })).toHaveAttribute('aria-disabled', 'true');
  expect(screen.getByRole('link', { name: 'Próxima página' })).toHaveAttribute('aria-disabled', 'false');
});

it('Próxima página consulta pagina=2 e Anterior volta para a 1', async () => {
  const user = userEvent.setup();
  const fetchMock = jest.fn()
    .mockResolvedValueOnce(corpoOk({ itens: [linha('TARIFA-2026-10', 'Tarifa')], total: 45 }))
    .mockResolvedValueOnce(corpoOk({ itens: muitas(20), total: 45 }));
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={muitas(20)} totalInicial={45} />);
  await user.click(screen.getByRole('link', { name: 'Próxima página' }));
  expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenNthCalledWith(1, URL_PAGINA_2);
  expect(screen.getByRole('cell', { name: 'Tarifa' })).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'Página anterior' }));
  expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining('pagina=1'));
});

it('não passa da última página', async () => {
  const user = userEvent.setup();
  const fetchMock = jest.fn().mockResolvedValue(corpoOk({ itens: muitas(5), total: 25 }));
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={muitas(20)} totalInicial={25} />);
  await user.click(screen.getByRole('link', { name: 'Próxima página' }));
  expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'Próxima página' }));
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('clique no link desabilitado não dispara requisição', async () => {
  const user = userEvent.setup();
  const fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={muitas(20)} totalInicial={45} />);
  await user.click(screen.getByRole('link', { name: 'Página anterior' }));
  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
});

it.each([
  ['a busca', async (user: ReturnType<typeof userEvent.setup>) => { await user.type(screen.getByLabelText('Buscar registros da lista'), 'x'); }, 'q=x'],
  ['a situação', async (user: ReturnType<typeof userEvent.setup>) => { await user.selectOptions(screen.getByLabelText('Filtrar situação'), 'DRAFT'); }, 'situacao=DRAFT'],
  ['a ordenação', async (user: ReturnType<typeof userEvent.setup>) => { await user.click(screen.getByRole('button', { name: 'Ordenar por Conta de débito' })); }, 'ordenar=contaDebito'],
])('mudar %s volta à página 1', async (_rotulo, agir, trecho) => {
  const user = userEvent.setup();
  const fetchMock = jest.fn().mockResolvedValue(corpoOk({ itens: muitas(20), total: 45 }));
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={muitas(20)} totalInicial={45} />);
  await user.click(screen.getByRole('link', { name: 'Próxima página' }));
  expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument();
  await agir(user);
  await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining(`pagina=1&`)));
  expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining(trecho));
  expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument();
});

it('descarta a resposta antiga da página 2 quando o usuário já voltou para a 1', async () => {
  const user = userEvent.setup();
  const lenta = adiavel();
  global.fetch = jest.fn()
    .mockReturnValueOnce(lenta.promessa)
    .mockResolvedValueOnce(corpoOk({ itens: muitas(20), total: 45 })) as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={muitas(20)} totalInicial={45} />);
  await user.click(screen.getByRole('link', { name: 'Próxima página' }));
  await user.click(screen.getByRole('link', { name: 'Página anterior' }));
  expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument();
  await act(async () => { lenta.resolver(corpoOk({ itens: [linha('TARIFA-2026-10', 'Tarifa')], total: 45 })); });
  expect(screen.queryByRole('cell', { name: 'Tarifa' })).not.toBeInTheDocument();
  expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
});

it('restaura a página do sessionStorage com uma única consulta', async () => {
  sessionStorage.setItem('politicas-de-contabilizacao', JSON.stringify({ pagina: 2 }));
  const fetchMock = jest.fn().mockResolvedValue(corpoOk({ itens: [linha('TARIFA-2026-10', 'Tarifa')], total: 45 }));
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={muitas(20)} totalInicial={45} />);
  expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(URL_PAGINA_2);
});

it('página restaurada além do total volta para a última página existente', async () => {
  sessionStorage.setItem('politicas-de-contabilizacao', JSON.stringify({ pagina: 9 }));
  const fetchMock = jest.fn()
    .mockResolvedValueOnce(corpoOk({ itens: [], total: 25 }))
    .mockResolvedValueOnce(corpoOk({ itens: muitas(5), total: 25 }));
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<PoliticasContabilizacaoClient inicial={muitas(20)} totalInicial={25} />);
  expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenLastCalledWith(URL_PAGINA_2);
});

// Reproduz o StrictMode do Next em dev: a restauração roda duas vezes e a segunda lê o padrão gravado pelo efeito de gravação.
it('sob StrictMode a página 2 restaurada do sessionStorage não volta para a 1', async () => {
  sessionStorage.setItem('politicas-de-contabilizacao', JSON.stringify({ pagina: 2 }));
  global.fetch = jest.fn().mockResolvedValue(corpoOk({ itens: [linha('TARIFA-2026-10', 'Tarifa')], total: 45 })) as unknown as typeof fetch;
  render(<StrictMode><PoliticasContabilizacaoClient inicial={muitas(20)} totalInicial={45} /></StrictMode>);
  expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument();
});

function respostaCsv(conteudo: string) {
  return { ok: true, status: 200, blob: async () => new Blob([conteudo], { type: 'text/csv' }), text: async () => conteudo };
}

describe('exportação', () => {
  let cliques: HTMLAnchorElement[];

  beforeEach(() => {
    cliques = [];
    URL.createObjectURL = jest.fn(() => 'blob:politicas');
    URL.revokeObjectURL = jest.fn();
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
      cliques.push(this);
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('Exportar visão baixa o arquivo com os mesmos parâmetros da lista e sem pagina', async () => {
    const user = userEvent.setup();
    const fetchMock = jest.fn((url: string) => Promise.resolve(
      url.includes('/exportar') ? respostaCsv('\uFEFFCompetência') : corpoOk({ itens: [linha('TARIFA-2026-10', 'Tarifa')], total: 1 }),
    ));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
    await user.type(screen.getByLabelText('Buscar registros da lista'), 'x');
    await user.selectOptions(screen.getByLabelText('Filtrar situação'), 'DRAFT');
    await user.click(screen.getByRole('button', { name: 'Ordenar por Conta de débito' }));
    await user.click(screen.getByRole('button', { name: 'Exportar visão' }));
    await waitFor(() => expect(cliques).toHaveLength(1));
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/contabilidade/politicas/exportar?q=x&competencia=&situacao=DRAFT&ordenar=contaDebito&direcao=asc',
    );
    expect(cliques[0]?.download).toBe('politicas-de-contabilizacao.csv');
    expect(cliques[0]?.href).toBe('blob:politicas');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:politicas');
  });

  it('Exportar usa a mesma visão que Exportar visão', async () => {
    const user = userEvent.setup();
    const fetchMock = jest.fn().mockResolvedValue(respostaCsv('\uFEFFCompetência'));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
    await user.click(screen.getByRole('button', { name: 'Exportar' }));
    await waitFor(() => expect(cliques).toHaveLength(1));
    expect(fetchMock).toHaveBeenCalledWith('/api/contabilidade/politicas/exportar?q=&competencia=&situacao=&ordenar=competencia&direcao=asc');
  });

  it('falha na exportação mostra a mensagem, não baixa nada e não afirma sucesso', async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ message: 'Validação falhou' }),
    }) as unknown as typeof fetch;
    render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
    await user.click(screen.getByRole('button', { name: 'Exportar visão' }));
    expect(await screen.findByText('Validação falhou')).toBeInTheDocument();
    expect(cliques).toHaveLength(0);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(screen.queryByText(/exportad/i)).not.toBeInTheDocument();
  });
});

describe('lista consistente com o servidor', () => {
  it('depois de gravar, recarrega a lista do servidor com os filtros atuais e atualiza o total', async () => {
    const user = userEvent.setup();
    const gravada = linha('TARIFA-2026-11', 'Tarifa');
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ contas: [{ codigo: '1.1.01', nome: 'Caixa' }], centros: [] }) })
      .mockResolvedValueOnce(corpoOk(gravada))
      .mockResolvedValueOnce(corpoOk({ itens: [linha('LIQUIDACAO-2026-10', 'Liquidação')], total: 21 }));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} totalInicial={20} />);
    expect(screen.getByText(/Página 1 de 1/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Configurar mappings' }));
    await user.type(screen.getByLabelText('Justificativa auditável'), 'abre a regra');
    await user.click(screen.getAllByRole('button', { name: 'Configurar mappings' }).at(-1)!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/contabilidade/politicas?pagina=1&q=&competencia=&situacao=&ordenar=competencia&direcao=asc',
    );
    expect(await screen.findByText(/Página 1 de 2/)).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Tarifa' })).not.toBeInTheDocument();
  });

  it('busca alterada durante o POST de gravar recarrega com a consulta nova, não com a do clique', async () => {
    const user = userEvent.setup();
    const post = adiavel();
    const fetchMock = jest.fn((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return post.promessa;
      if (url === '/api/contabilidade/politicas/opcoes') {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ contas: [{ codigo: '1.1.01', nome: 'Caixa' }], centros: [] }) });
      }
      return Promise.resolve(corpoOk({ itens: [linha('LIQUIDACAO-2026-10', 'Liquidação')], total: 1 }));
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
    await user.click(screen.getByRole('button', { name: 'Configurar mappings' }));
    await user.type(screen.getByLabelText('Justificativa auditável'), 'abre a regra');
    await user.click(screen.getAllByRole('button', { name: 'Configurar mappings' }).at(-1)!);
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true));
    // Com o drawer modal aberto o fundo não recebe clique; a mudança da busca chega como evento de change.
    fireEvent.change(screen.getByLabelText('Buscar registros da lista'), { target: { value: 'z' } });
    const consultaNova = '/api/contabilidade/politicas?pagina=1&q=z&competencia=&situacao=&ordenar=competencia&direcao=asc';
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(consultaNova));
    const chamadasAntes = fetchMock.mock.calls.length;
    await act(async () => { post.resolver(corpoOk(linha('TARIFA-2026-11', 'Tarifa'))); });
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(chamadasAntes));
    const listas = fetchMock.mock.calls.slice(chamadasAntes).map(([url]) => url);
    expect(listas).toEqual([consultaNova]);
  });

  it('mostra o indicador de carregamento acessível enquanto consulta e o remove ao terminar', async () => {
    const user = userEvent.setup();
    const consulta = adiavel();
    global.fetch = jest.fn().mockReturnValue(consulta.promessa) as unknown as typeof fetch;
    render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
    expect(screen.queryByText('Carregando…')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Buscar registros da lista'), 'x');
    const indicador = await screen.findByText('Carregando…');
    expect(indicador).toHaveAttribute('role', 'status');
    expect(indicador).toHaveAttribute('aria-busy', 'true');
    await act(async () => { consulta.resolver(corpoOk({ itens: [linha('TARIFA-2026-10', 'Tarifa')], total: 1 })); });
    expect(screen.queryByText('Carregando…')).not.toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Tarifa' })).toBeInTheDocument();
  });

  it('itens vazio com total maior que zero na página atual refaz a consulta', async () => {
    const user = userEvent.setup();
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(corpoOk({ itens: [], total: 1 }))
      .mockResolvedValueOnce(corpoOk({ itens: [linha('TARIFA-2026-10', 'Tarifa')], total: 1 }));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<PoliticasContabilizacaoClient inicial={[]} />);
    await user.type(screen.getByLabelText('Buscar registros da lista'), 'x');
    expect(await screen.findByRole('cell', { name: 'Tarifa' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('estrutura do DS v3', () => {
  it('monta cabeçalho, KPIs, grade com selo de situação, paginador, abas e ações do domínio', () => {
    render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} totalInicial={45} contagensIniciais={{ revisao: 4, suspensos: 1 }} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Políticas de contabilização' })).toBeInTheDocument();
    for (const [rotulo, valor] of [['Em revisão', '4'], ['Bloqueados', '1']] as const) {
      expect(within(screen.getByText(rotulo).parentElement!).getByText(valor)).toBeInTheDocument();
    }
    expect(screen.getByRole('heading', { name: 'Registros e consultas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Detalhamento e execução' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Rascunho' }).querySelector('span.rounded-full')).not.toBeNull();
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Próxima página' })).toBeInTheDocument();
    expect(within(screen.getByRole('tablist')).getAllByRole('tab').map((aba) => aba.textContent)).toEqual([
      'Ficha e campos', 'Movimentações', 'Regras e validações', 'Exceções', 'Histórico', 'Integrações', 'Aceite e testes',
    ]);
    for (const nome of ['Exportar', '+ Novo registro', 'Ações do processo', 'Configurar mappings', 'Simular evento', 'Aprovar regra']) {
      expect(screen.getByRole('button', { name: nome })).toBeInTheDocument();
    }
  });

  it('a lista recarregada atualiza os KPIs com as contagens do servidor', async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn().mockResolvedValue(corpoOk({ itens: [linha('TARIFA-2026-10', 'Tarifa')], total: 1, contagens: { revisao: 7, suspensos: 2 } })) as unknown as typeof fetch;
    render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
    expect(within(screen.getByText('Em revisão').parentElement!).getByText('—')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Buscar registros da lista'), 'x');
    expect(await within(screen.getByText('Em revisão').parentElement!).findByText('7')).toBeInTheDocument();
  });

  it('falha da lista oferece Tentar novamente, que refaz a mesma consulta', async () => {
    const user = userEvent.setup();
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => JSON.stringify({ message: 'Serviço indisponível' }) })
      .mockResolvedValueOnce(corpoOk({ itens: [linha('TARIFA-2026-10', 'Tarifa')], total: 1 }));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<PoliticasContabilizacaoClient inicial={[linha('LIQUIDACAO-2026-10', 'Liquidação')]} />);
    await user.type(screen.getByLabelText('Buscar registros da lista'), 'x');
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Serviço indisponível');
    await user.click(within(alerta).getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('cell', { name: 'Tarifa' })).toBeInTheDocument();
    expect(fetchMock.mock.calls[1]?.[0]).toBe(fetchMock.mock.calls[0]?.[0]);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
