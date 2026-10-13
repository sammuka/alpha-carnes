/**
 * CNAE — subclasse 2.x de 7 dígitos (E01-T01 D21, AD-24 (3)).
 *
 * Entrada aceita `0000-0/00` ou `0000000`; armazenamento só dígitos; exibição com máscara.
 * Sem dígito verificador e sem consulta externa: o operador confere com a documentação.
 */

const FORMATO_CNAE = /^[0-9]{7}$/;

/** Remove `-`, `/`, `.` e espaços. */
export function normalizarCnae(valor: string): string {
  return valor.replace(/[-/.\s]/g, '');
}

/** `true` se o valor (já normalizado) tem exatamente 7 dígitos. */
export function validarFormatoCnae(valor: string): boolean {
  return FORMATO_CNAE.test(valor);
}

/** `6201501` → `6201-5/01`. Valor fora do formato é devolvido como recebido. */
export function mascararCnae(valor: string): string {
  if (!FORMATO_CNAE.test(valor)) return valor;
  return `${valor.slice(0, 4)}-${valor.slice(4, 5)}/${valor.slice(5)}`;
}
