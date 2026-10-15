export function normalizarDinheiro(entrada: string): string | null {
  const limpo = entrada.trim().replace(/\s/g, '').replace(/^R\$/i, '');
  if (limpo.includes(',')) {
    if (limpo.split(',').length !== 2) return null;
    const [esq, dir] = limpo.split(',');
    if (!/^(\d{1,3}(\.\d{3})*|\d+)$/.test(esq)) return null;
    if (!/^\d{1,2}$/.test(dir)) return null;
    const inteiro = esq.replaceAll('.', '');
    if (inteiro.length > 13) return null;
    if (inteiro.length > 1 && inteiro.startsWith('0')) return null;
    return `${inteiro}.${dir.padEnd(2, '0')}`;
  }
  if ((limpo.match(/\./g) ?? []).length > 1) return null;
  if (!/^\d{1,13}(\.\d{1,2})?$/.test(limpo)) return null;
  const [inteiro, frac = ''] = limpo.split('.');
  if (inteiro.length > 1 && inteiro.startsWith('0')) return null;
  return `${inteiro}.${frac.padEnd(2, '0')}`;
}

export function normalizarEscala(entrada: string, inteirosMax: number): string | null {
  const limpo = entrada.trim().replace(/\s/g, '');
  let inteiro = '';
  let frac = '';
  if (limpo.includes(',')) {
    if (limpo.split(',').length !== 2) return null;
    const [esq, dir] = limpo.split(',');
    if (!/^(\d{1,3}(\.\d{3})*|\d+)$/.test(esq)) return null;
    if (!/^\d{1,3}$/.test(dir)) return null;
    inteiro = esq.replaceAll('.', '');
    frac = dir;
  } else {
    if ((limpo.match(/\./g) ?? []).length > 1) return null;
    if (!/^\d+(\.\d{1,3})?$/.test(limpo)) return null;
    const partes = limpo.split('.');
    inteiro = partes[0];
    frac = partes[1] ?? '';
  }
  if (inteiro.length > inteirosMax) return null;
  if (inteiro.length > 1 && inteiro.startsWith('0')) return null;
  return `${inteiro}.${frac.padEnd(3, '0')}`;
}

export function centavosDe(canon: string): bigint {
  const encontrado = /^(\d+)\.(\d{2})$/.exec(canon);
  if (!encontrado) throw new Error('dinheiro fora da forma canônica');
  return BigInt(encontrado[1] + encontrado[2]);
}

export function dinheiroDeCentavos(centavos: bigint): string {
  const negativo = centavos < 0n;
  const absoluto = negativo ? -centavos : centavos;
  const texto = absoluto.toString().padStart(3, '0');
  return `${negativo ? '-' : ''}${texto.slice(0, -2)}.${texto.slice(-2)}`;
}

export function complementoRazao(razao: string): string | null {
  const encontrado = /^(\d)\.(\d{4})$/.exec(razao);
  if (!encontrado) return null;
  const unidades = BigInt(encontrado[1] + encontrado[2]);
  if (unidades > 10000n) return null;
  const complemento = (10000n - unidades).toString().padStart(5, '0');
  return `${complemento[0]}.${complemento.slice(1)}`;
}

/** Meio para cima quando o resto da divisão por 10000 é >= 5000. razao é "0.1200". */
export function aplicarRazao(centavos: bigint, razao: string): bigint | null {
  const encontrado = /^(\d)\.(\d{4})$/.exec(razao);
  if (!encontrado) return null;
  const unidades = BigInt(encontrado[1] + encontrado[2]);
  if (unidades > 10000n) return null;
  const produto = centavos * unidades;
  const negativo = produto < 0n;
  const absoluto = negativo ? -produto : produto;
  const quociente = absoluto / 10000n;
  const resto = absoluto % 10000n;
  const arredondado = resto >= 5000n ? quociente + 1n : quociente;
  return negativo ? -arredondado : arredondado;
}

export function calcularMemoria(entrada: {
  valor: string;
  desconto: string;
  pRedBc: string;
  pIcms: string;
}): { valorLiquido: string; baseTributavel: string; icms: string; baseDifereBruto: boolean } | null {
  const valorC = centavosDe(entrada.valor);
  const descontoC = centavosDe(entrada.desconto);
  if (descontoC > valorC) return null;
  const liquidoC = valorC - descontoC;
  const fator = complementoRazao(entrada.pRedBc);
  if (!fator) return null;
  const baseC = aplicarRazao(liquidoC, fator);
  const icmsC = baseC === null ? null : aplicarRazao(baseC, entrada.pIcms);
  if (baseC === null || icmsC === null) return null;
  return {
    valorLiquido: dinheiroDeCentavos(liquidoC),
    baseTributavel: dinheiroDeCentavos(baseC),
    icms: dinheiroDeCentavos(icmsC),
    baseDifereBruto: baseC !== valorC,
  };
}

export function formatarDinheiroPtBr(canon: string): string {
  const [inteiro, frac] = canon.split('.');
  const comMilhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${comMilhar},${frac}`;
}

export function formatarEscalaPtBr(canon: string): string {
  const [inteiro, frac] = canon.split('.');
  const comMilhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${comMilhar},${frac}`;
}

const MESES: Record<string, string> = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
  '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
  '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
};

export function rotuloCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split('-');
  return `${MESES[mes]} de ${ano}`;
}
