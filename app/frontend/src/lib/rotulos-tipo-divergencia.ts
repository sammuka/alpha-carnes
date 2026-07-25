export const ROTULOS_TIPO_DIVERGENCIA: Record<string, string> = {
  falta: 'Falta',
  excesso: 'Excesso',
  produto_nao_previsto: 'Produto não previsto',
  peso_divergente: 'Falta de Peso',
  outro: 'Outro',
};

/** Slug conhecido → rótulo do protótipo; fallback (descricao livre) → texto bruto. */
export function rotuloTipoDivergencia(tipo: string): string {
  return ROTULOS_TIPO_DIVERGENCIA[tipo] ?? tipo;
}

export function tipoDivergenciaEhSlugConhecido(tipo: string): boolean {
  return tipo in ROTULOS_TIPO_DIVERGENCIA;
}
