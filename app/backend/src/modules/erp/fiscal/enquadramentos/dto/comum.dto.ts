import { z } from 'zod';

const MENSAGEM_NUL = 'Texto contém caractere inválido.';

/** `\u0000` não existe em `text` do Postgres e viraria 500. */
export const semNul = (valor: string): boolean => !valor.includes('\u0000');

/** Justificativa obrigatória em toda mutação (D24): trim 3–500. */
/** Caracteres de largura zero não contam para o mínimo: são removidos antes de medir. */
export const justificativaSchema = z
  .string()
  .transform((valor) => valor.replace(/[\u200B-\u200D\uFEFF]/g, ''))
  .pipe(z.string().trim().min(3).max(500).refine(semNul, { message: MENSAGEM_NUL }));

/** Busca livre das listagens. */
export const buscaSchema = z.string().trim().refine(semNul, { message: MENSAGEM_NUL }).optional();

/** Descrição de CFOP/NCM. */
export const descricaoSchema = z.string().trim().min(1).max(255).refine(semNul, { message: MENSAGEM_NUL });

/** Concorrência otimista (D17). */
export const versaoSchema = z.number().int().min(1);

export const uuidSchema = z.uuid();

/** `z.iso.date()` aceita `0000-01-01`, que o Postgres recusa: exige ano >= 1900. */
export const dataSchema = z.iso.date().refine((valor) => valor >= '1900-01-01', {
  message: 'Data deve ser a partir de 1900.',
});
