import '../../src/common/validation/zod-config';
import { z } from 'zod';

function mensagem(resultado: z.ZodSafeParseResult<unknown>): string {
  if (resultado.success) throw new Error('esperava falha de validação');
  return resultado.error.issues[0]!.message;
}

describe('zodErrorMapPtBr (registrado via z.config)', () => {
  it('campo string ausente vira "Campo obrigatório."', () => {
    expect(mensagem(z.object({ nome: z.string() }).safeParse({}))).toBe('Campo obrigatório.');
  });

  it('string vazia com min(1) vira "Campo obrigatório."', () => {
    expect(mensagem(z.string().min(1).safeParse(''))).toBe('Campo obrigatório.');
  });

  it('min(3) em string informa o mínimo em PT-BR', () => {
    expect(mensagem(z.string().min(3).safeParse('ab'))).toBe('Deve ter pelo menos 3 caracteres.');
  });

  it('max(5) em string informa o máximo em PT-BR', () => {
    expect(mensagem(z.string().max(5).safeParse('abcdef'))).toBe('Deve ter no máximo 5 caracteres.');
  });

  it('número abaixo do mínimo usa a variante numérica', () => {
    expect(mensagem(z.number().min(10).safeParse(5))).toBe('Deve ser maior ou igual a 10.');
  });

  it('array com min(1) usa singular "item"', () => {
    expect(mensagem(z.array(z.string()).min(1).safeParse([]))).toBe('Deve ter pelo menos 1 item.');
  });

  it('e-mail inválido', () => {
    expect(mensagem(z.email().safeParse('nao-email'))).toBe('E-mail inválido.');
  });

  it('enum inválido pede uma opção válida', () => {
    expect(mensagem(z.enum(['ativo', 'inativo']).safeParse('outro'))).toBe(
      'Selecione uma das opções válidas.',
    );
  });

  it('mensagem customizada do schema tem precedência sobre o mapa global', () => {
    expect(mensagem(z.string().min(1, 'mensagem própria').safeParse(''))).toBe('mensagem própria');
  });
});
