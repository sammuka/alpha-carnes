const ENTRADA = /^\d{1,3}(\.\d{1,2})?$/;

/** Aceita "41,67", "12.00" ou "100". Devolve a razão "0.4167", "0.1200" ou "1.0000", ou null. Sem parseFloat. */
export function normalizarPercentual(entrada: string): string | null {
  const limpo = entrada.trim().replace('%', '').replace(/\s/g, '').replace(',', '.');
  if (!ENTRADA.test(limpo)) return null;
  const [inteiroBruto, frac = ''] = limpo.split('.');
  if (inteiroBruto.length > 1 && inteiroBruto.startsWith('0')) return null;
  if (frac.length > 2) return null;
  const frac2 = (frac + '00').slice(0, 2);
  if (inteiroBruto.length === 3 && inteiroBruto !== '100') return null;
  if (inteiroBruto === '100' && frac2 !== '00') return null;
  const digitos = `${inteiroBruto}${frac2}`.replace(/^0+/, '') || '0';
  const quatro = digitos.padStart(4, '0');
  if (quatro.length > 5) return null;
  const inteiroRazao = quatro.length === 5 ? quatro[0] : '0';
  const fracRazao = quatro.slice(-4);
  if (inteiroRazao !== '0' && inteiroRazao !== '1') return null;
  if (inteiroRazao === '1' && fracRazao !== '0000') return null;
  return `${inteiroRazao}.${fracRazao}`;
}

/** "0.4167" → "41,67". Não usa Number. O prefixo % fica no campo, não nesta string. */
export function formatarPercentualPtBr(canon: string): string {
  const [inteiro, frac = ''] = canon.split('.');
  const frac4 = (frac + '0000').slice(0, 4);
  const junto = `${inteiro}${frac4}`;
  const inteiroPct = junto.slice(0, junto.length - 2).replace(/^0+(?=\d)/, '') || '0';
  const fracPct = junto.slice(-2);
  return `${inteiroPct},${fracPct}`;
}
