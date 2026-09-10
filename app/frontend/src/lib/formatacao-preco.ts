/** Formatação só de exibição. Não usar no caminho de persistência (preço segue string NUMERIC). */

export function formatarPrecoBr(valor: string | null | undefined): string {
  if (valor == null || valor.trim() === '') return '—';
  const trimmed = valor.trim();
  const negativo = trimmed.startsWith('-');
  const abs = negativo ? trimmed.slice(1) : trimmed;
  const [inteiraBruta = '0', fracBruta = ''] = abs.split('.');
  const inteira = inteiraBruta.replace(/^0+(?=\d)/, '') || '0';
  const cents = (fracBruta + '00').slice(0, 2);
  const corpo = `${inteira},${cents}`;
  return negativo ? `-R$ ${corpo}` : `R$ ${corpo}`;
}

/** Duas casas depois do ponto; ausência permanece "—". */
export function formatarPercentualDuasCasas(valor: string | null | undefined): string {
  if (valor == null || valor.trim() === '') return '—';
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '—';
  return numero.toFixed(2);
}
