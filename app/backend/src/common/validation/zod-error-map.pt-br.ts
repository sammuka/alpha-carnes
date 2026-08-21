import type { $ZodErrorMap } from 'zod/v4/core';

const UNIDADE: Record<string, string> = {
  string: 'caracteres',
  array: 'itens',
};

/**
 * Traduz os códigos de issue do Zod para PT-BR claro, sem jargão de validador.
 * Só entra em jogo quando o schema não define mensagem própria (ex.: `.min(1, 'msg')`),
 * então mensagens de negócio (dígito verificador, formatos de data etc.) continuam intactas.
 */
export const zodErrorMapPtBr: $ZodErrorMap = (issue) => {
  switch (issue.code) {
    case 'invalid_type':
      return issue.input === undefined || issue.input === null
        ? 'Campo obrigatório.'
        : 'Valor em formato inesperado.';
    case 'too_small': {
      const unidade = UNIDADE[String(issue.origin ?? '')] ?? '';
      if (Number(issue.minimum) === 1 && unidade === 'caracteres') return 'Campo obrigatório.';
      return unidade
        ? `Deve ter pelo menos ${issue.minimum} ${unidade}.`
        : `Deve ser maior ou igual a ${issue.minimum}.`;
    }
    case 'too_big': {
      const unidade = UNIDADE[String(issue.origin ?? '')] ?? '';
      return unidade
        ? `Deve ter no máximo ${issue.maximum} ${unidade}.`
        : `Deve ser menor ou igual a ${issue.maximum}.`;
    }
    case 'invalid_format':
      if ('format' in issue && issue.format === 'email') return 'E-mail inválido.';
      if ('format' in issue && issue.format === 'uuid') return 'Identificador inválido.';
      return 'Formato inválido.';
    case 'invalid_value':
      return 'Selecione uma das opções válidas.';
    case 'invalid_union':
      return 'Valor inválido.';
    case 'unrecognized_keys':
      return 'Campo desconhecido enviado.';
    case 'not_multiple_of':
      return 'Valor inválido.';
    default:
      return 'Valor inválido.';
  }
};
