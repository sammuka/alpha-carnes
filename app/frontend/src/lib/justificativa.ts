/**
 * Espelho de `normalizarJustificativa` do backend: remove formatação invisível (\p{Cf}) e "brancos visuais"
 * (U+034F, U+2800, U+3164, U+115F, U+1160, U+FFA0), apara espaços Unicode. Marcas de acentuação são preservadas.
 */
const INVISIVEIS = /[\p{Cf}\u034F\u2800\u3164\u115F\u1160\uFFA0]/gu;

export function normalizarJustificativa(texto: string): string {
  return texto.replace(INVISIVEIS, '').trim();
}
