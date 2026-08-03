import { montarPayloadEiss, redigirSegredos, type DadosFiscaisEmissao, type DadosPedidoParaNfse } from '../../src/integracoes/nfse/payload-builder';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures reutilizáveis
// ─────────────────────────────────────────────────────────────────────────────

const CLIENTE_FAKE = {
  razaoSocial: 'Cliente Teste',
  documentoFiscal: '12.345.678/0001-90',
  dadosFiscaisJson: { inscricao_municipal: '999999', logradouro: 'Rua A', numero: '1', bairro: 'Centro', cidade: 'Osasco', uf: 'SP', cep: '06010-000' },
  dadosContatoJson: { email: 'cliente@teste.local' },
};

const FISCAL_PADRAO: DadosFiscaisEmissao = {
  atividade: '14.01',
  simplesNacional: false,
  modeloFiscal: 'padrao',
};

function makePedido(overrides: Partial<DadosPedidoParaNfse> = {}): DadosPedidoParaNfse {
  return {
    pedidoId: 'abc12345',
    cliente: CLIENTE_FAKE,
    itensDescricao: 'Dianteiro 2un',
    pesoTotalKg: '30.000',
    valor: '1500.00',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// montarPayloadEiss
// ─────────────────────────────────────────────────────────────────────────────

describe('montarPayloadEiss', () => {
  it('DoD 10.1 payload padrao segue estrutura do manual V10.6', () => {
    const payload = montarPayloadEiss(
      { pedidoId: 'PED-000984', cliente: CLIENTE_FAKE, itensDescricao: 'Contrafilé', pesoTotalKg: '1256.300', valor: '15000.00' },
      { atividade: '14.01', simplesNacional: false, modeloFiscal: 'padrao' },
      true, 'RPS-1',
    );
    expect(payload.atividade).toBe('14.01');
    expect(payload.semIncidenciaISS).toBe(false);
    expect(payload.simplesNacional).toBe(false);
    expect(payload.tomadorEstrangeiro).toBe(false);
    expect(payload.deduzirRepasse).toBe(false);
    expect(payload.aliquota).toBe('0.00');
    expect(payload).not.toHaveProperty('prestador');
  });

  it('formata CPF removendo pontuação (só dígitos)', () => {
    const pedido = makePedido({
      cliente: {
        razaoSocial: 'Pessoa Física',
        documentoFiscal: '123.456.789-09',
        dadosFiscaisJson: {},
        dadosContatoJson: {},
      },
    });
    const payload = montarPayloadEiss(pedido, FISCAL_PADRAO, true, 'RPS-002');
    const docDigits = '12345678909';
    expect(payload.tomador.cpf).toBe(docDigits);
    expect(payload.tomador.cnpj).toBeUndefined();
  });

  it('usa CNPJ (cnpj) se 14 dígitos', () => {
    const payload = montarPayloadEiss(makePedido(), FISCAL_PADRAO, true, 'RPS-003');
    expect(payload.tomador.cnpj).toBe('12345678000190');
    expect(payload.tomador.cpf).toBeUndefined();
  });

  it('usa CPF (cpf) se 11 dígitos', () => {
    const pedido = makePedido({
      cliente: {
        razaoSocial: 'Pessoa F',
        documentoFiscal: '12345678909',
        dadosFiscaisJson: {},
        dadosContatoJson: {},
      },
    });
    const payload = montarPayloadEiss(pedido, FISCAL_PADRAO, true, 'RPS-004');
    expect(payload.tomador.cpf).toBe('12345678909');
    expect(payload.tomador.cnpj).toBeUndefined();
  });

  it('limita informacoesAdicionais a 2300 chars', () => {
    const itensDescricao = 'X'.repeat(3000);
    const pedido = makePedido({ itensDescricao });
    const payload = montarPayloadEiss(pedido, FISCAL_PADRAO, true, 'RPS-005');
    expect(payload.informacoesAdicionais.length).toBeLessThanOrEqual(2300);
  });

  it('NÃO inclui chaveAutenticacao no retorno (segurança)', () => {
    const payload = montarPayloadEiss(makePedido(), FISCAL_PADRAO, true, 'RPS-006');
    expect('chaveAutenticacao' in payload).toBe(false);
  });

  it('inclui identificador = pedidoId', () => {
    const payload = montarPayloadEiss(makePedido({ pedidoId: 'PED-XYZ' }), FISCAL_PADRAO, true, 'RPS-007');
    expect(payload.identificador).toBe('PED-XYZ');
  });

  it('inclui campos rtc quando modeloFiscal=rtc', () => {
    const fiscalRtc: DadosFiscaisEmissao = {
      atividade: '14.01',
      simplesNacional: false,
      modeloFiscal: 'rtc',
      rtc: { classTrib: '000001', codigoNbs: '111041000', indOperacao: '000001', idLocalIncidencia: '1' },
    };
    const payload = montarPayloadEiss(makePedido(), fiscalRtc, true, 'RPS-008');
    expect(payload.modeloFiscal).toBe('rtc');
    expect(payload.rtcClassTrib).toBe('000001');
    expect(payload.rtcCodigoNbs).toBe('111041000');
    expect(payload.rtcIndOperacao).toBe('000001');
    expect(payload.rtcIdLocalIncidencia).toBe('1');
  });

  it('NÃO inclui campos rtc quando modeloFiscal=padrao', () => {
    const payload = montarPayloadEiss(makePedido(), FISCAL_PADRAO, true, 'RPS-009');
    expect(payload.rtcClassTrib).toBeUndefined();
  });

  it('inclui numeroRps e serieRps no payload', () => {
    const payload = montarPayloadEiss(makePedido(), FISCAL_PADRAO, true, 'RPS-999', 'B');
    expect(payload.numeroRps).toBe('RPS-999');
    expect(payload.serieRps).toBe('B');
  });

  it('série padrão é "A" quando não informada', () => {
    const payload = montarPayloadEiss(makePedido(), FISCAL_PADRAO, true, 'RPS-001');
    expect(payload.serieRps).toBe('A');
  });

  it('remove pontuação do CEP do endereço do tomador', () => {
    const pedido = makePedido({
      cliente: {
        razaoSocial: 'CLI',
        documentoFiscal: '12345678000190',
        dadosFiscaisJson: { cep: '06010-000' },
        dadosContatoJson: {},
      },
    });
    const payload = montarPayloadEiss(pedido, FISCAL_PADRAO, true, 'RPS-011');
    expect(payload.tomador.endereco?.cep).toBe('06010000');
  });

  it('inclui substituicaoTributaria=false e notificarTomadorPorEmail=true por padrão', () => {
    const payload = montarPayloadEiss(makePedido(), FISCAL_PADRAO, true, 'RPS-012');
    expect(payload.substituicaoTributaria).toBe(false);
    expect(payload.notificarTomadorPorEmail).toBe(true);
  });

  it('simplesNacional reflete o parâmetro fiscal', () => {
    const payload = montarPayloadEiss(makePedido(), { ...FISCAL_PADRAO, simplesNacional: true }, true, 'RPS-013');
    expect(payload.simplesNacional).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// redigirSegredos
// ─────────────────────────────────────────────────────────────────────────────

describe('redigirSegredos', () => {
  it('substitui ChaveAutenticacao por ***REDACTED***', () => {
    const obj = { ChaveAutenticacao: 'secret-token-abc', outro: 'valor' };
    const result = redigirSegredos(obj) as Record<string, unknown>;
    expect(result['ChaveAutenticacao']).toBe('***REDACTED***');
  });

  it('substitui chaveAutenticacao (camelCase) por ***REDACTED***', () => {
    const obj = { chaveAutenticacao: 'secret-token-xyz', dados: 'ok' };
    const result = redigirSegredos(obj) as Record<string, unknown>;
    expect(result['chaveAutenticacao']).toBe('***REDACTED***');
  });

  it('substitui chave_autenticacao (snake_case) por ***REDACTED***', () => {
    const obj = { chave_autenticacao: 'segredo', dados: 'publico' };
    const result = redigirSegredos(obj) as Record<string, unknown>;
    expect(result['chave_autenticacao']).toBe('***REDACTED***');
  });

  it('é recursivo — redige em objetos aninhados', () => {
    const obj = {
      nivel1: {
        nivel2: {
          ChaveAutenticacao: 'nested-secret',
          outro: 'ok',
        },
      },
    };
    const result = redigirSegredos(obj) as { nivel1: { nivel2: Record<string, unknown> } };
    expect(result.nivel1.nivel2['ChaveAutenticacao']).toBe('***REDACTED***');
    expect(result.nivel1.nivel2['outro']).toBe('ok');
  });

  it('é recursivo — redige em arrays', () => {
    const arr = [
      { ChaveAutenticacao: 'secret1', nome: 'A' },
      { ChaveAutenticacao: 'secret2', nome: 'B' },
    ];
    const result = redigirSegredos(arr) as Array<Record<string, unknown>>;
    expect(result[0]!['ChaveAutenticacao']).toBe('***REDACTED***');
    expect(result[1]!['ChaveAutenticacao']).toBe('***REDACTED***');
    expect(result[0]!['nome']).toBe('A');
  });

  it('NÃO altera campos não sensíveis', () => {
    const obj = { valor: '1500.00', pedidoId: 'abc-123', status: 'emitida' };
    const result = redigirSegredos(obj) as Record<string, unknown>;
    expect(result['valor']).toBe('1500.00');
    expect(result['pedidoId']).toBe('abc-123');
    expect(result['status']).toBe('emitida');
  });

  it('retorna primitivos sem alteração', () => {
    expect(redigirSegredos('string')).toBe('string');
    expect(redigirSegredos(42)).toBe(42);
    expect(redigirSegredos(true)).toBe(true);
    expect(redigirSegredos(null)).toBeNull();
    expect(redigirSegredos(undefined)).toBeUndefined();
  });

  it('retorna objeto vazio como objeto vazio', () => {
    expect(redigirSegredos({})).toEqual({});
  });
});
