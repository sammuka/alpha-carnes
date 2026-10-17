/**
 * CSV único das exportações (AD-41): `;`, CRLF, BOM UTF-8 e neutralização de fórmula (OWASP —
 * célula iniciada por = + - @ tab ou CR vira literal no Excel). `scripts/lint-csv.mjs` proíbe
 * montar CSV com `join(';')` fora deste arquivo.
 */
const BOM = String.fromCharCode(0xfeff);

export function celulaCsv(original: string | number | null | undefined): string {
  const texto = original === null || original === undefined ? '' : String(original);
  const valor = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
  return /[;"\r\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

export function montarCsv(cabecalho: string[], linhas: (string | number | null | undefined)[][]): string {
  return BOM + [cabecalho, ...linhas].map((linha) => linha.map(celulaCsv).join(';')).join('\r\n');
}
