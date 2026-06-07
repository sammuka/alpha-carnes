// Aritmética decimal exata para quantidades NUMERIC(15,3) — sem drift de float (S4).
// Internamente usa BigInt sobre o valor escalado por 1000 (scale = 3).

const SCALE = 3;
const FACTOR = 1000n;

/** Converte um número/string para inteiro escalado (×1000). */
function paraEscalado(valor: number | string): bigint {
  const s = typeof valor === 'number' ? valor.toFixed(SCALE) : valor.trim();
  const negativo = s.startsWith('-');
  const semSinal = negativo ? s.slice(1) : s;
  const partes = semSinal.split('.');
  const inteiraRaw = partes[0] ?? '';
  const fracRaw = partes[1] ?? '';
  const inteira = inteiraRaw === '' ? '0' : inteiraRaw;
  const frac = (fracRaw + '000').slice(0, SCALE); // trunca/preenche para 3 casas
  const escalado = BigInt(inteira) * FACTOR + BigInt(frac || '0');
  return negativo ? -escalado : escalado;
}

/** Formata um inteiro escalado de volta para string NUMERIC com 3 casas. */
function paraString(escalado: bigint): string {
  const negativo = escalado < 0n;
  const abs = negativo ? -escalado : escalado;
  const inteira = abs / FACTOR;
  const frac = (abs % FACTOR).toString().padStart(SCALE, '0');
  return `${negativo ? '-' : ''}${inteira.toString()}.${frac}`;
}

/** a - b (ambos quantidades), resultado como string NUMERIC(.,3). */
export function subtrairQtd(a: number | string, b: number | string): string {
  return paraString(paraEscalado(a) - paraEscalado(b));
}

/** a + b (ambos quantidades), resultado como string NUMERIC(.,3). */
export function somarQtd(a: number | string, b: number | string): string {
  return paraString(paraEscalado(a) + paraEscalado(b));
}

/** Normaliza um número/string de quantidade para string NUMERIC com 3 casas. */
export function formatarQtd(valor: number | string): string {
  return paraString(paraEscalado(valor));
}

/** Compara duas quantidades: retorna negativo/0/positivo. */
export function compararQtd(a: number | string, b: number | string): number {
  const diff = paraEscalado(a) - paraEscalado(b);
  return diff < 0n ? -1 : diff > 0n ? 1 : 0;
}

/** true se a quantidade é igual a zero. */
export function ehZero(valor: number | string): boolean {
  return paraEscalado(valor) === 0n;
}
