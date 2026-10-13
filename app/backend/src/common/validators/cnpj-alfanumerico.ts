/**
 * CNPJ alfanumérico (IN RFB 2.229/2024; E01-T01 D3).
 *
 * Formato: 12 caracteres `[0-9A-Z]` + 2 dígitos verificadores numéricos. O DV segue o
 * manual oficial da RFB/Serpro "Cálculo dos dígitos verificadores de CNPJ alfanumérico"
 * (manual-dv-cnpj.pdf): valor de cada caractere = código ASCII − 48, pesos 2..9 da
 * direita para a esquerda (reiniciando após o 8º), módulo 11; resto 0 ou 1 → DV 0,
 * senão DV = 11 − resto. Exemplo oficial: 12.ABC.345/01DE-35.
 *
 * CNPJ numérico existente continua válido: dígitos têm valor ASCII − 48 = o próprio dígito.
 */

const FORMATO_CNPJ = /^[0-9A-Z]{12}[0-9]{2}$/;

/** Remove `.`, `/`, `-` e espaços e converte para maiúsculas. */
export function normalizarCnpj(valor: string): string {
  return valor.replace(/[./\-\s]/g, '').toUpperCase();
}

function calcularDv(base: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = base.length - 1; i >= 0; i--) {
    soma += (base.charCodeAt(i) - 48) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** Valida CNPJ alfanumérico pelo DV. Aceita valor com máscara e minúsculas (normaliza antes). */
export function validarCnpjAlfanumerico(valor: string): boolean {
  const cnpj = normalizarCnpj(valor);
  if (!FORMATO_CNPJ.test(cnpj)) return false;
  // 14 caracteres iguais passam no cálculo em alguns casos, mas não são inscrição válida.
  if (/^(.)\1{13}$/.test(cnpj)) return false;

  const dv1 = calcularDv(cnpj.slice(0, 12));
  const dv2 = calcularDv(cnpj.slice(0, 12) + String(dv1));
  return cnpj[12] === String(dv1) && cnpj[13] === String(dv2);
}

/** Raiz do CNPJ (8 primeiros caracteres normalizados). */
export function raizCnpj(valor: string): string {
  return normalizarCnpj(valor).slice(0, 8);
}
