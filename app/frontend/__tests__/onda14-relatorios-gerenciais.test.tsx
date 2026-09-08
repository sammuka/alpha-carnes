import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { format, parse } from 'date-fns';
import { RelatoriosClient } from '../src/app/(admin)/gestao/relatorios/relatorios-client';

const mockSearchParams = new URLSearchParams('operacaoId=op-1');
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => mockSearchParams,
}));

const RELATORIOS_SIF = [
  { id: 'r1', operacaoId: 'op-1', tipo: 'recebimento', codigo: 'SIF-01', nome: 'Mapa de recebimento', perfilResponsavel: 'Admin', status: 'pendente_dados', pendenciasJson: ['x'], versaoAtual: 0, ultimaVersao: null },
  { id: 'r2', operacaoId: 'op-1', tipo: 'expedicao', codigo: 'SIF-02', nome: 'Controle expedição', perfilResponsavel: 'Carga', status: 'gerado', pendenciasJson: [], versaoAtual: 1, ultimaVersao: { id: 'v1', versao: 1, tipoGeracao: 'gerado', motivoRetificacao: null, geradoEm: '2026-07-22T12:00:00Z', geradoPorNome: 'Diego' } },
  { id: 'r3', operacaoId: 'op-1', tipo: 'desossa', codigo: 'SIF-03', nome: 'Desossa', perfilResponsavel: 'Corte', status: 'pronto_para_gerar', pendenciasJson: [], versaoAtual: 0, ultimaVersao: null },
  { id: 'r4', operacaoId: 'op-1', tipo: 'estoque', codigo: 'SIF-04', nome: 'Estoque', perfilResponsavel: 'Gestor', status: 'retificado', pendenciasJson: [], versaoAtual: 2, ultimaVersao: { id: 'v2', versao: 2, tipoGeracao: 'retificado', motivoRetificacao: 'ajuste', geradoEm: '2026-07-22T12:00:00Z', geradoPorNome: 'Ana' } },
];

const PEDIDO_GERENCIAL = {
  pedidoVendaId: 'ped-1',
  pedidoNumero: 'ped-1',
  clienteNomeFantasia: 'Cliente Beta',
  representanteNome: null,
  dataPedido: '2026-07-15',
  faixaPreco: 'A' as const,
  quantidadeItensAjustados: 2,
  valorTotalAjustado: '-3.00',
  itens: [
    {
      produtoCodigo: 'DT',
      produtoNome: 'Dianteiro',
      precoTabelaOriginal: null,
      precoAplicado: '16.00',
      diferencaAbsoluta: '16.00',
      diferencaPercentual: null,
      usuarioAjusteNome: 'Comercial',
    },
    {
      produtoCodigo: 'PA',
      produtoNome: 'Patinho',
      precoTabelaOriginal: '18.50',
      precoAplicado: '17.00',
      diferencaAbsoluta: '-1.50',
      diferencaPercentual: '-8.1081',
      usuarioAjusteNome: 'Comercial',
    },
  ],
};

function primeiroDiaMesCorrenteIso(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-01`;
}

function hojeIsoLocal(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

function setupFetch(opts: { relatorioOk?: boolean; relatorioData?: unknown[] } = {}) {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/operacoes')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: [{ id: 'op-1', rotulo: 'Op', status: 'aberta', data: '2026-07-22', diaSemana: 2, extraordinaria: false, comprasProgramadas: 0, pedidosVenda: 0, pendenciasOverbookingAbertas: 0 }] }) });
    }
    if (url.includes('/sif/relatorios')) {
      return Promise.resolve({ ok: true, json: async () => RELATORIOS_SIF });
    }
    if (url.includes('/api/ocorrencias-preco/relatorio')) {
      if (opts.relatorioOk === false) {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({ message: 'Falha no servidor' }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: opts.relatorioData ?? [PEDIDO_GERENCIAL],
          total: (opts.relatorioData ?? [PEDIDO_GERENCIAL]).length,
          page: 1,
          pageSize: 20,
        }),
      });
    }
    if (url.includes('/api/cadastros/clientes')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: [{ id: 'cli-1', razaoSocial: 'Cliente Beta', nomeFantasia: 'Cliente Beta' }] }) });
    }
    if (url.includes('/api/cadastros/representantes')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: [{ id: 'rep-1', nome: 'Rep 1' }] }) });
    }
    if (url.includes('/api/cadastros/produtos')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: [{ id: 'prod-1', codigo: 'DT', nome: 'Dianteiro' }] }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  }) as jest.Mock;
}

describe('Onda 14 — Relatórios Gerenciais', () => {
  beforeEach(() => {
    setupFetch();
  });

  it('tela renderiza as duas abas', async () => {
    render(<RelatoriosClient permissoes={['SIF_LER', 'APROVACOES_LER']} />);
    expect(await screen.findByRole('tab', { name: 'Relatórios SIF' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Relatórios Gerenciais' })).toBeInTheDocument();
  });

  it('aba SIF preserva os 4 relatórios e a geração', async () => {
    render(<RelatoriosClient permissoes={['SIF_LER', 'SIF_GERAR', 'APROVACOES_LER']} />);
    await waitFor(() => {
      expect(screen.getByText('Mapa de recebimento')).toBeInTheDocument();
      expect(screen.getByText('Estoque')).toBeInTheDocument();
    });
    expect(screen.getAllByRole('button', { name: 'Gerar' }).length).toBe(4);
  });

  it('BadgeProvisorio P8 aparece só na aba SIF', async () => {
    render(<RelatoriosClient permissoes={['SIF_LER', 'APROVACOES_LER']} />);
    await waitFor(() => expect(screen.getAllByText('Provisório').length).toBeGreaterThan(0));
    await userEvent.click(screen.getByRole('tab', { name: 'Relatórios Gerenciais' }));
    await waitFor(() => {
      expect(screen.queryByText(/Modelos oficiais dos relatórios SIF/)).not.toBeInTheDocument();
    });
  });

  it('sem SIF_LER a aba SIF não aparece', async () => {
    render(<RelatoriosClient permissoes={['APROVACOES_LER']} />);
    expect(await screen.findByRole('tab', { name: 'Relatórios Gerenciais' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Relatórios SIF' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Data início')).toBeInTheDocument();
  });

  it('sem APROVACOES_LER a aba Gerenciais não aparece', async () => {
    render(<RelatoriosClient permissoes={['SIF_LER']} />);
    expect(await screen.findByRole('tab', { name: 'Relatórios SIF' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Relatórios Gerenciais' })).not.toBeInTheDocument();
  });

  it('período default preenchido ao abrir', async () => {
    render(<RelatoriosClient permissoes={['APROVACOES_LER']} />);
    const inicio = await screen.findByLabelText('Data início');
    const fim = screen.getByLabelText('Data fim');
    const fmt = (iso: string) => format(parse(iso, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy');
    expect(inicio).toHaveTextContent(fmt(primeiroDiaMesCorrenteIso()));
    expect(fim).toHaveTextContent(fmt(hojeIsoLocal()));
  });

  it('limpar o período bloqueia a consulta', async () => {
    render(<RelatoriosClient permissoes={['APROVACOES_LER']} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/ocorrencias-preco/relatorio'),
      expect.anything(),
    ));
    const callsBefore = (global.fetch as jest.Mock).mock.calls.filter(
      (c) => String(c[0]).includes('/api/ocorrencias-preco/relatorio'),
    ).length;
    await userEvent.click(await screen.findByLabelText('Data início'));
    await userEvent.click(await screen.findByRole('button', { name: 'Limpar' }));
    await waitFor(() => {
      const callsAfter = (global.fetch as jest.Mock).mock.calls.filter(
        (c) => String(c[0]).includes('/api/ocorrencias-preco/relatorio'),
      ).length;
      expect(callsAfter).toBe(callsBefore);
    });
  });

  it('filtros combinados chegam na query', async () => {
    render(<RelatoriosClient permissoes={['APROVACOES_LER']} />);
    await screen.findByLabelText('Data início');
    await userEvent.selectOptions(screen.getByLabelText('Representante'), 'rep-1');
    await userEvent.selectOptions(screen.getByLabelText('Faixa'), 'B');
    await waitFor(() => {
      const chamada = (global.fetch as jest.Mock).mock.calls.find(
        (c) => String(c[0]).includes('representanteId=rep-1') && String(c[0]).includes('faixaPreco=B'),
      );
      expect(chamada).toBeDefined();
    });
  });

  it('detalhamento mostra todos os itens', async () => {
    render(<RelatoriosClient permissoes={['APROVACOES_LER']} />);
    await waitFor(() => expect(screen.getByText('Cliente Beta')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Cliente Beta'));
    const tabela = await screen.findByRole('table');
    expect(within(tabela).getAllByRole('row').length).toBe(3);
    expect(within(tabela).getByText('Preço da tabela')).toBeInTheDocument();
    expect(within(tabela).getByText('Ajustado por')).toBeInTheDocument();
  });

  it('item sem preço de tabela mostra —', async () => {
    render(<RelatoriosClient permissoes={['APROVACOES_LER']} />);
    await waitFor(() => expect(screen.getByText('Sem preço de tabela para a data')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Cliente Beta'));
    const tabela = await screen.findByRole('table');
    expect(within(tabela).getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryByText('R$ 0,00')).not.toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('resultado vazio mostra a mensagem correta', async () => {
    setupFetch({ relatorioData: [] });
    render(<RelatoriosClient permissoes={['APROVACOES_LER']} />);
    expect(await screen.findByText('Nenhum pedido com alteração de preço no período selecionado.')).toBeInTheDocument();
  });

  it('erro do endpoint aparece em role="alert"', async () => {
    setupFetch({ relatorioOk: false });
    render(<RelatoriosClient permissoes={['APROVACOES_LER']} />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Falha|Erro/i);
  });
});
