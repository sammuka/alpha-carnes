import { extrairErrosPorCampo } from '../error-message';

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
