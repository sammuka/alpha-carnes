import { extrairErrosPorCampo, extrairMensagemErro } from '../error-message';

describe('extrairErrosPorCampo', () => {
  const body = {
    statusCode: 400,
    message: {
      message: 'Validação falhou',
      errors: [
        { path: ['dadosFiscaisJson', 'cep'], message: 'CEP inválido.', code: 'custom' },
        { path: ['razaoSocial'], message: 'Campo obrigatório.', code: 'too_small' },
        { path: ['paradas', 2, 'descricao'], message: 'Campo obrigatório.', code: 'too_small' },
      ],
    },
  };

  it('mapeia path.join(".") para a mensagem, inclusive índices de array', () => {
    expect(extrairErrosPorCampo(body)).toEqual({
      'dadosFiscaisJson.cep': 'CEP inválido.',
      razaoSocial: 'Campo obrigatório.',
      'paradas.2.descricao': 'Campo obrigatório.',
    });
  });

  it('body sem errors devolve mapa vazio', () => {
    expect(extrairErrosPorCampo({ message: 'Não encontrado' })).toEqual({});
    expect(extrairErrosPorCampo(null)).toEqual({});
    expect(extrairErrosPorCampo('texto')).toEqual({});
  });
});

describe('extrairMensagemErro', () => {
  it('envelope de validação Zod: extrai o detalhe do campo, nunca o texto genérico nem o fallback', () => {
    const body = {
      statusCode: 400,
      message: {
        message: 'Validação falhou',
        errors: [{ path: ['razaoSocial'], message: 'Campo obrigatório.', code: 'too_small' }],
      },
    };

    const resultado = extrairMensagemErro(body, 'fallback');

    expect(resultado).not.toBe('Validação falhou');
    expect(resultado).not.toBe('fallback');
    expect(resultado).toContain('Campo obrigatório.');
  });
});
