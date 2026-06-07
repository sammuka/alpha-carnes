/**
 * Validação de documento fiscal (CNPJ e CPF) com dígito verificador.
 *
 * Decisão de escopo F2: `documentoFiscal` aceita CNPJ E CPF, único por entidade.
 * A normalização (S1) remove máscara antes de validar e persistir, de modo que
 * unicidade e validação operem sempre sobre dígitos.
 */

/** Remove tudo que não for dígito. */
export function normalizarDocumento(valor: string): string {
  return valor.replace(/\D/g, '');
}

/** Valida CPF (11 dígitos) pelo dígito verificador. Recebe valor já normalizado ou com máscara. */
export function validarCPF(valor: string): boolean {
  const cpf = normalizarDocumento(valor);
  if (cpf.length !== 11) return false;
  // Rejeita sequências repetidas (ex.: 00000000000), que passam no cálculo mas são inválidas.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digitos = cpf.split('').map(Number) as number[];

  const calcularDigito = (qtd: number): number => {
    let soma = 0;
    for (let i = 0; i < qtd; i++) {
      soma += (digitos[i] ?? 0) * (qtd + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return calcularDigito(9) === digitos[9] && calcularDigito(10) === digitos[10];
}

/** Valida CNPJ (14 dígitos) pelo dígito verificador. Recebe valor já normalizado ou com máscara. */
export function validarCNPJ(valor: string): boolean {
  const cnpj = normalizarDocumento(valor);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const digitos = cnpj.split('').map(Number) as number[];

  const calcularDigito = (qtd: number): number => {
    // Pesos cíclicos do CNPJ: começam em 2, vão até 9 e reiniciam em 2.
    let soma = 0;
    let peso = 2;
    for (let i = qtd - 1; i >= 0; i--) {
      soma += (digitos[i] ?? 0) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return calcularDigito(12) === digitos[12] && calcularDigito(13) === digitos[13];
}

/**
 * Valida documento fiscal aceitando CPF (11 dígitos) ou CNPJ (14 dígitos).
 * Retorna `false` para qualquer outro tamanho.
 */
export function validarDocumentoFiscal(valor: string): boolean {
  const doc = normalizarDocumento(valor);
  if (doc.length === 11) return validarCPF(doc);
  if (doc.length === 14) return validarCNPJ(doc);
  return false;
}
