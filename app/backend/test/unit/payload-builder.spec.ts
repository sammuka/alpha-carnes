import { montarPayloadEiss, redigirSegredos, type DadosPedidoParaNfse, type DadosPrestador } from '../../src/integracoes/nfse/payload-builder';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures reutilizáveis
// ─────────────────────────────────────────────────────────────────────────────

const prestadorBase: DadosPrestador = {
  razaoSocial: 'AlphaCarnes Ltda',
  cnpj: '12.345.678/0001-90',
  inscricaoMunicipal: '123456',
  email: 'fiscal@alphacarnes.local',
};

function makePedido(overrides: Partial<DadosPedidoParaNfse> = {}): DadosPedidoParaNfse {
  return {
    pedidoId: 'abc12345',
    cliente: {
      razaoSocial: 'Cliente Teste',
      documentoFiscal: '12.345.678/0001-90',
      dadosFiscaisJson: { inscricao_municipal: '999999', logradouro: 'Rua A', numero: '1', bairro: 'Centro', cidade: 'Osasco', uf: 'SP', cep: '06010-000' },
      dadosContatoJson: { email: 'cliente@teste.local' },
    },
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
  it('formata CNPJ removendo pontuação (só dígitos)', () => {
    const payload = montarPayloadEiss(makePedido(), prestadorBase, true, 'RPS-001');
    // Prestador com CNPJ com pontuação deve ter apenas dígitos no payload
    expect(payload.prestador.cnpj).toMatch(/^\d+$/);
    expect(payload.prestador.cnpj).toBe('12345678000190');
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
    const payload = montarPayloadEiss(pedido, prestadorBase, true, 'RPS-002');
    const docDigits = '12345678909';
    expect(payload.tomador.cpf).toBe(docDigits);
    expect(payload.tomador.cnpj).toBeUndefined();
  });

  it('usa CNPJ (cnpj) se 14 dígitos', () => {
    const payload = montarPayloadEiss(makePedido(), prestadorBase, true, 'RPS-003');
    // Cliente com 14 dígitos → campo cnpj
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
    const payload = montarPayloadEiss(pedido, prestadorBase, true, 'RPS-004');
    expect(payload.tomador.cpf).toBe('12345678909');
    expect(payload.tomador.cnpj).toBeUndefined();
  });

  it('limita descricaoServico a 2000 chars', () => {
    const itensDescricao = 'X'.repeat(3000);
    const pedido = makePedido({ itensDescricao });
    const payload = montarPayloadEiss(pedido, prestadorBase, true, 'RPS-005');
    expect(payload.descricaoServico.length).toBeLessThanOrEqual(2000);
  });

  it('NÃO inclui chaveAutenticacao no retorno (segurança)', () => {
    const payload = montarPayloadEiss(makePedido(), prestadorBase, true, 'RPS-006');
    expect('chaveAutenticacao' in payload).toBe(false);
  });

  it('default de aliquota é 0.0500 quando não informada', () => {
    const pedido = makePedido({ aliquota: undefined });
    const payload = montarPayloadEiss(pedido, prestadorBase, true, 'RPS-007');
    expect(payload.aliquota).toBe('0.0500');
  });

  it('usa aliquota informada quando presente', () => {
    const pedido = makePedido({ aliquota: '0.0300' });
    const payload = montarPayloadEiss(pedido, prestadorBase, true, 'RPS-008');
    expect(payload.aliquota).toBe('0.0300');
  });

  it('default de codigoServico é 04014 quando não informado', () => {
    const pedido = makePedido({ codigoServico: undefined });
    const payload = montarPayloadEiss(pedido, prestadorBase, true, 'RPS-009');
    expect(payload.codigoServico).toBe('04014');
  });

  it('usa codigoServico informado quando presente', () => {
    const pedido = makePedido({ codigoServico: '14101' });
    const payload = montarPayloadEiss(pedido, prestadorBase, true, 'RPS-010');
    expect(payload.codigoServico).toBe('14101');
  });

  it('inclui numeroRps e serieRps no payload', () => {
    const payload = montarPayloadEiss(makePedido(), prestadorBase, true, 'RPS-999', 'B');
    expect(payload.numeroRps).toBe('RPS-999');
    expect(payload.serieRps).toBe('B');
  });

  it('série padrão é "A" quando não informada', () => {
    const payload = montarPayloadEiss(makePedido(), prestadorBase, true, 'RPS-001');
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
    const payload = montarPayloadEiss(pedido, prestadorBase, true, 'RPS-011');
    expect(payload.tomador.endereco?.cep).toBe('06010000');
  });

  it('inclui substituicaoTributaria=false e notificarTomadorPorEmail=true por padrão', () => {
    const payload = montarPayloadEiss(makePedido(), prestadorBase, true, 'RPS-012');
    expect(payload.substituicaoTributaria).toBe(false);
    expect(payload.notificarTomadorPorEmail).toBe(true);
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
