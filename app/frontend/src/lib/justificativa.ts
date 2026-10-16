/** Espelho de `normalizarJustificativa` do backend (mesma regra: pontas aparadas, miolo intacto, >= 3 visíveis). */
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

export function justificativaValida(texto: string): boolean {
  return contarVisiveis(normalizarJustificativa(texto)) >= 3;
}
