import { RegraPoliticaException } from './regra-politica.exception';

export function centavos(valor: string): bigint {
  const casado = /^(\d{1,13})\.(\d{2})$/.exec(valor);
  if (!casado) throw new RegraPoliticaException('mapeamento ausente', '');
  return BigInt(casado[1]) * 100n + BigInt(casado[2]);
}

export function formatarCentavos(total: bigint): string {
  const sinal = total < 0n ? '-' : '';
  const absoluto = total < 0n ? -total : total;
  const inteiro = absoluto / 100n;
  const frac = (absoluto % 100n).toString().padStart(2, '0');
  return `${sinal}${inteiro}.${frac}`;
}

export function balancear(
  linhas: { lado: 'D' | 'C'; valor: string }[],
  codigo: string,
): { debito: string; credito: string } {
  let debito = 0n;
  let credito = 0n;
  for (const linha of linhas) {
    const valor = centavos(linha.valor);
    if (linha.lado === 'D') debito += valor;
    else credito += valor;
  }
  if (debito !== credito) throw new RegraPoliticaException('balanceamento exato', codigo);
  return { debito: formatarCentavos(debito), credito: formatarCentavos(credito) };
}
