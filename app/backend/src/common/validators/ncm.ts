/**
 * NCM manual (E01-T02 D7): 8 dígitos, sem tabela nacional.
 * `normalizarNcm` remove `.`, espaço e `-`; `validarNcm` exige `^[0-9]{8}$`.
 */

const FORMATO_NCM = /^[0-9]{8}$/;

/** Remove só `.`, espaço comum e `-`. */
export function normalizarNcm(valor: string): string {
  return valor.replace(/[. -]/g, '');
}

/** `true` se o valor (já normalizado) tem exatamente 8 dígitos. */
export function validarNcm(valor: string): boolean {
  return FORMATO_NCM.test(valor);
}
