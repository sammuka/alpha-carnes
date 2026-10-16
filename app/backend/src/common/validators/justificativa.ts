import { z } from 'zod';

/**
 * Formatação invisível (\p{Cf}: U+200B-200F, U+2060-2064, U+FEFF, U+00AD, U+180E...) e "brancos visuais"
 * que não são Cf nem espaço. Marcas de acentuação (\p{Mn}) são preservadas, exceto U+034F.
 */
const INVISIVEIS = /[\p{Cf}\u034F\u2800\u3164\u115F\u1160\uFFA0]/gu;

/** Remove invisíveis e apara espaços Unicode: é o texto que conta para o mínimo e que é gravado. */
export function normalizarJustificativa(texto: string): string {
  return texto.replace(INVISIVEIS, '').trim();
}

/** Justificativa obrigatória em toda mutação: normaliza e então exige 3-500 caracteres sem NUL. */
export const justificativaNormalizadaSchema = z
  .string()
  .transform(normalizarJustificativa)
  .pipe(
    z
      .string()
      .min(3)
      .max(500)
      .refine((v) => !v.includes('\u0000'), { message: 'Texto contém caractere inválido.' }),
  );
