/**
 * CFOP manual (E01-T02 D7): 4 dígitos, sem tabela nacional.
 * `normalizarCfop` mantém só dígitos; `validarCfop` exige `^[0-9]{4}$`.
 */

const FORMATO_CFOP = /^[0-9]{4}$/;

/** Remove tudo que não for dígito. */
export function normalizarCfop(valor: string): string {
  return valor.replace(/\D/g, '');
}

/** `true` se o valor (já normalizado) tem exatamente 4 dígitos. */
export function validarCfop(valor: string): boolean {
  return FORMATO_CFOP.test(valor);
}
