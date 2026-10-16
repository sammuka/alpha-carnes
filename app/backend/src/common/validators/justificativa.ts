import { z } from 'zod';

const PONTA = /^[\p{Cf}\p{Z}\s\u034F\u2800\u3164\u115F\u1160\uFFA0]$/u;
const VISIVEL = /[\p{L}\p{N}\p{P}\p{S}]/u;
// U+034F, U+2800, U+3164, U+115F, U+1160, U+FFA0
const BRANCOS_VISUAIS = /[͏⠀ㅤᅟᅠﾠ]/gu;
const EMOJI = /\p{Extended_Pictographic}/u;

function ehTag(ponto: string | undefined): boolean {
  const c = ponto?.codePointAt(0) ?? 0;
  return c >= 0xe0020 && c <= 0xe007f;
}

/** Tags U+E0020–E007F coladas a uma base emoji (bandeiras de subdivisão) fazem parte do emoji. */
function tagsDeEmoji(pontos: string[], ini: number, fim: number): boolean {
  let i = fim - 1;
  while (i > ini && ehTag(pontos[i - 1])) i--;
  let base = i - 1;
  if (base >= ini && pontos[base] === String.fromCharCode(0xfe0f)) base--;
  return base >= ini && EMOJI.test(pontos[base] ?? '');
}

/** Apara invisíveis e espaços Unicode só nas pontas; o miolo (ZWJ, ZWNJ, tags, acentos combinantes) fica intacto. */
export function normalizarJustificativa(texto: string): string {
  const pontos = Array.from(texto);
  let ini = 0;
  let fim = pontos.length;
  while (ini < fim && PONTA.test(pontos[ini] ?? '')) ini++;
  while (fim > ini && PONTA.test(pontos[fim - 1] ?? '')) {
    if (ehTag(pontos[fim - 1]) && tagsDeEmoji(pontos, ini, fim)) break;
    fim--;
  }
  return pontos.slice(ini, fim).join('');
}

const SEGMENTADOR = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Grafemas visíveis (letra, número, pontuação, símbolo); brancos visuais não contam. */
export function contarVisiveis(texto: string): number {
  let n = 0;
  for (const { segment } of SEGMENTADOR.segment(texto)) if (VISIVEL.test(segment.replace(BRANCOS_VISUAIS, ''))) n++;
  return n;
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
