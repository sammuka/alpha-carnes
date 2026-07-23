import { extrairMensagemErro } from '../src/lib/error-message';

describe('extrairMensagemErro', () => {
  it('retorna string message direta', () => {
    expect(extrairMensagemErro({ message: 'Credenciais inválidas' }, 'fallback')).toBe(
      'Credenciais inválidas',
    );
  });

  it('desaninha message aninhado pelo AllExceptionsFilter', () => {
    expect(
      extrairMensagemErro(
        {
          statusCode: 401,
          message: { message: 'Credenciais inválidas', error: 'Unauthorized', statusCode: 401 },
        },
        'fallback',
      ),
    ).toBe('Credenciais inválidas');
  });

  it('junta array de mensagens de validação', () => {
    expect(extrairMensagemErro({ message: ['E-mail inválido', 'Senha obrigatória'] }, 'fallback')).toBe(
      'E-mail inválido. Senha obrigatória',
    );
  });

  it('usa fallback quando payload não tem mensagem utilizável', () => {
    expect(extrairMensagemErro({ statusCode: 500 }, 'Erro genérico')).toBe('Erro genérico');
  });
});
