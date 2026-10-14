/**
 * CEST no enquadramento (E01-T02 D7): texto de 7 dígitos, sem tabela e sem FK.
 * `normalizarCest` mantém só dígitos; `validarCest` exige `^[0-9]{7}$`.
 */

const FORMATO_CEST = /^[0-9]{7}$/;

/** Remove tudo que não for dígito. */
export function normalizarCest(valor: string): string {
  return valor.replace(/\D/g, '');
}

/** `true` se o valor (já normalizado) tem exatamente 7 dígitos. */
export function validarCest(valor: string): boolean {
  return FORMATO_CEST.test(valor);
}
