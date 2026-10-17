import { RegraPoliticaException } from './regra-politica.exception';

export function centavos(valor: string, codigo: string): bigint {
  const casado = /^(\d{1,13})\.(\d{2})$/.exec(valor);
  const inteiro = casado?.[1];
  const fracao = casado?.[2];
  if (!inteiro || !fracao) throw new RegraPoliticaException('valor monetário inválido', codigo);
  return BigInt(inteiro) * 100n + BigInt(fracao);
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
    const valor = centavos(linha.valor, codigo);
    if (linha.lado === 'D') debito += valor;
    else credito += valor;
  }
  if (debito !== credito) throw new RegraPoliticaException('balanceamento exato', codigo);
  return { debito: formatarCentavos(debito), credito: formatarCentavos(credito) };
}
