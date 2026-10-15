/**
 * CEST no enquadramento (E01-T02 D7): texto de 7 dígitos, sem tabela e sem FK.
 * `normalizarCest` remove só a máscara (. - espaço); `validarCest` exige `^[0-9]{7}$`.
 */

const FORMATO_CEST = /^[0-9]{7}$/;

/** Remove só a máscara (`.`, espaço e `-`); qualquer outro caractere fica e reprova em `validar*`. */
export function normalizarCest(valor: string): string {
  return valor.replace(/[. -]/g, '');
}

/** `true` se o valor (já normalizado) tem exatamente 7 dígitos. */
export function validarCest(valor: string): boolean {
  return FORMATO_CEST.test(valor);
}
