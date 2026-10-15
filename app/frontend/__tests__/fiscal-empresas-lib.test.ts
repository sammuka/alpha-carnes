import {
  ErroFiscal,
  FILTROS_PADRAO,
  ROTULOS_ACAO_HISTORICO,
  ROTULOS_CRT,
  ROTULOS_SITUACAO,
  ROTULOS_TIPO_CNAE,
  fiscalApi,
  formatarDataIso,
  mascararCnae,
  mascararCnpjAlfanumerico,
  mensagemDoErroFiscal,
  normalizarCnae,
  normalizarCnpj,
  rotuloAcaoHistorico,
} from '../src/lib/fiscal-empresas';
import { CHAVE_FILTROS, lerFiltrosSalvos, salvarFiltros, temFiltroAtivo } from '../src/lib/fiscal-empresas-filtros';

function resposta(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), { status });
}

describe('rótulos do cadastro fiscal', () => {
  it('traduz os quatro regimes (CRT) exatamente como o contrato', () => {
    expect(ROTULOS_CRT).toEqual({
      '1': 'Simples Nacional',
      '2': 'Simples Nacional — sublimite',
      '3': 'Regime normal',
      '4': 'MEI',
    });
  });

  it('expõe rótulos de situação, tipo de CNAE e ação do histórico em português', () => {
    expect(ROTULOS_SITUACAO.REVIEW).toBe('Aguardando revisão');
    expect(ROTULOS_SITUACAO.SUSPENDED).toBe('Suspenso');
    expect(ROTULOS_TIPO_CNAE.PRINCIPAL).toBe('Principal');
    expect(ROTULOS_ACAO_HISTORICO.INSERT).toBe('Cadastro criado');
  });

  it('deriva o rótulo da ação manual a partir da nova situação', () => {
    expect(rotuloAcaoHistorico({ operacao: 'ACAO_MANUAL', situacaoAnterior: 'DRAFT', situacaoNova: 'REVIEW' })).toBe(
      'Enviado para revisão',
    );
    expect(rotuloAcaoHistorico({ operacao: 'ACAO_MANUAL', situacaoAnterior: 'SUSPENDED', situacaoNova: 'REVIEW' })).toBe(
      'Reativado para revisão',
    );
    expect(rotuloAcaoHistorico({ operacao: 'UPDATE', situacaoAnterior: null, situacaoNova: null })).toBe('Dados alterados');
  });
});

describe('máscaras', () => {
  it('CNPJ alfanumérico: maiúsculas, 14 posições e dígitos verificadores numéricos', () => {
    expect(normalizarCnpj('ab.123.cd4/0001-95xyz')).toBe('AB123CD4000195');
    expect(mascararCnpjAlfanumerico('ab123cd4000195')).toBe('AB.123.CD4/0001-95');
    expect(mascararCnpjAlfanumerico('12')).toBe('12');
    expect(mascararCnpjAlfanumerico('12345')).toBe('12.345');
  });

  it('CNAE: guarda 7 dígitos e mostra 0000-0/00 conforme digita', () => {
    expect(normalizarCnae('4722-9/01')).toBe('4722901');
    expect(normalizarCnae('47229019999')).toBe('4722901');
    expect(mascararCnae('4722')).toBe('4722');
    expect(mascararCnae('47229')).toBe('4722-9');
    expect(mascararCnae('4722901')).toBe('4722-9/01');
  });

  it('formata data ISO e trata vazio', () => {
    expect(formatarDataIso('2026-10-13')).toBe('13/10/2026');
    expect(formatarDataIso(null)).toBe('—');
  });
});

describe('cliente HTTP do BFF', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('lista estabelecimentos com filtros e paginação no servidor', async () => {
    fetchMock.mockResolvedValue(resposta(200, { data: [], total: 0, page: 2, pageSize: 20 }));
    await fiscalApi.listarEstabelecimentos({ ...FILTROS_PADRAO, empresaId: 'e1', situacao: 'REVIEW', search: ' loja ', page: 2 });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/api/erp/fiscal/estabelecimentos?');
    expect(url).toContain('empresaId=e1');
    expect(url).toContain('situacao=REVIEW');
    expect(url).toContain('search=loja');
    expect(url).toContain('page=2');
    expect(url).toContain('pageSize=20');
  });

  it('reenvia confirmarTroca somente quando informado', async () => {
    fetchMock.mockResolvedValue(resposta(200, { id: 'r1' }));
    await fiscalApi.acaoRegime('est', 'r1', 'submeter', { versao: 3, justificativa: 'troca', confirmarTroca: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/erp/fiscal/estabelecimentos/est/regimes/r1/submeter');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ versao: 3, justificativa: 'troca', confirmarTroca: true });
  });

  it('mapeia os códigos de erro para as mensagens fixas do contrato', async () => {
    const casos: Array<[string, string]> = [
      ['SEGREGACAO_FUNCAO', 'A aprovação deve ser feita por usuário diferente de quem submeteu.'],
      ['ALTERACAO_DESATUALIZADA', 'O cadastro mudou depois desta proposta. Descarte o rascunho ou rejeite a revisão e crie uma nova.'],
      ['CONFLITO_CONCORRENTE', 'O registro foi alterado por outro usuário. Recarregue para continuar.'],
    ];
    for (const [codigo, mensagem] of casos) {
      fetchMock.mockResolvedValueOnce(resposta(409, { message: 'texto técnico do backend', codigo }));
      const erro = await fiscalApi.obter('x').catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroFiscal);
      expect(mensagemDoErroFiscal(erro)).toBe(mensagem);
    }
  });

  it('preserva os dados do challenge 409 de troca de regime (inclusive no envelope aninhado)', async () => {
    fetchMock.mockResolvedValue(
      resposta(409, { message: { message: 'confirme', codigo: 'TROCA_REGIME_CONFIRMACAO_NECESSARIA', fimProposto: '2026-12-31' } }),
    );
    const erro = (await fiscalApi.acaoRegime('e', 'r', 'submeter', { versao: 1, justificativa: 'abc' }).catch((e: unknown) => e)) as ErroFiscal;
    expect(erro.status).toBe(409);
    expect(erro.codigo).toBe('TROCA_REGIME_CONFIRMACAO_NECESSARIA');
    expect(erro.dados.fimProposto).toBe('2026-12-31');
  });

  it('traduz 403, 5xx e falha de rede sem vazar texto técnico', async () => {
    fetchMock.mockResolvedValueOnce(resposta(403, { message: 'Forbidden' }));
    expect(mensagemDoErroFiscal(await fiscalApi.obter('x').catch((e: unknown) => e))).toBe('Você não tem permissão para esta ação.');

    fetchMock.mockResolvedValueOnce(resposta(500, { message: 'stack trace' }));
    expect(mensagemDoErroFiscal(await fiscalApi.obter('x').catch((e: unknown) => e))).toBe(
      'Serviço indisponível no momento. Tente novamente.',
    );

    fetchMock.mockRejectedValueOnce(new TypeError('failed'));
    const erro = (await fiscalApi.obter('x').catch((e: unknown) => e)) as ErroFiscal;
    expect(erro.codigo).toBe('SERVICO_INDISPONIVEL');
  });

  it('exporta a visão como arquivo, sem paginação nem ordenação', async () => {
    const blob = new Blob(['a;b'], { type: 'text/csv' });
    fetchMock.mockResolvedValue({ ok: true, status: 200, blob: async () => blob } as unknown as Response);
    await expect(fiscalApi.exportar({ ...FILTROS_PADRAO, situacao: 'SUSPENDED' })).resolves.toBe(blob);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/estabelecimentos/exportacao?');
    expect(url).toContain('situacao=SUSPENDED');
    expect(url).not.toContain('page=');
    expect(url).not.toContain('sort=');
  });
});

describe('filtros da sessão', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('grava e relê os filtros', () => {
    const filtros = { ...FILTROS_PADRAO, empresaId: 'e1', situacao: 'APPROVED' as const, search: 'osasco', page: 3 };
    salvarFiltros(filtros);
    expect(lerFiltrosSalvos()).toEqual(filtros);
    expect(temFiltroAtivo(filtros)).toBe(true);
    expect(temFiltroAtivo(FILTROS_PADRAO)).toBe(false);
  });

  it('descarta conteúdo inválido do storage', () => {
    window.sessionStorage.setItem(CHAVE_FILTROS, JSON.stringify({ situacao: 'XPTO', sort: 'drop', page: -4, dir: 'x' }));
    expect(lerFiltrosSalvos()).toEqual(FILTROS_PADRAO);
    window.sessionStorage.setItem(CHAVE_FILTROS, '{quebrado');
    expect(lerFiltrosSalvos()).toEqual(FILTROS_PADRAO);
  });
});
