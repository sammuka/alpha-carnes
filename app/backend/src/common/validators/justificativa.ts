import { z } from 'zod';

const PONTA = /^[\p{Cf}\p{Z}\s\u034F\u2800\u3164\u115F\u1160\uFFA0]$/u;
const VISIVEL = /[\p{L}\p{N}\p{P}\p{S}]/gu;

/** Apara invisíveis e espaços Unicode só nas pontas; o miolo (ZWJ, ZWNJ, tags, acentos combinantes) fica intacto. */
export function normalizarJustificativa(texto: string): string {
  const pontos = Array.from(texto);
  let ini = 0;
  let fim = pontos.length;
  while (ini < fim && PONTA.test(pontos[ini] ?? '')) ini++;
  while (fim > ini && PONTA.test(pontos[fim - 1] ?? '')) fim--;
  return pontos.slice(ini, fim).join('');
}

/** Caracteres visíveis (letra, número, pontuação, símbolo) do texto já aparado. */
export function contarVisiveis(texto: string): number {
  return (texto.match(VISIVEL) ?? []).length;
}

/** Justificativa obrigatória em toda mutação: apara as pontas e exige >= 3 caracteres visíveis, máximo 500, sem NUL. */
export const justificativaNormalizadaSchema = z
  .string()
  .transform(normalizarJustificativa)
  .pipe(
    z
      .string()
      .max(500)
      .refine((v) => contarVisiveis(v) >= 3, { message: 'Informe ao menos 3 caracteres visíveis.' })
      .refine((v) => !v.includes('\u0000'), { message: 'Texto contém caractere inválido.' }),
  );
