/**
 * CFOP manual (E01-T02 D7): 4 dígitos, sem tabela nacional.
 * `normalizarCfop` remove só a máscara (. - espaço); `validarCfop` exige `^[0-9]{4}$`.
 */

const FORMATO_CFOP = /^[0-9]{4}$/;

/** Remove só a máscara (`.`, espaço e `-`); qualquer outro caractere fica e reprova em `validar*`. */
export function normalizarCfop(valor: string): string {
  return valor.replace(/[. -]/g, '');
}

/** `true` se o valor (já normalizado) tem exatamente 4 dígitos. */
export function validarCfop(valor: string): boolean {
  return FORMATO_CFOP.test(valor);
}
