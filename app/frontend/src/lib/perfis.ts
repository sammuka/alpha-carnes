/** Rótulos dos 11 perfis canônicos (doc 013 / AD-04). Chave desconhecida é exibida como veio. */
export const ROTULOS_PERFIS: Record<string, string> = {
  administrador: 'Administrador',
  gestor: 'Gestão',
  compras: 'Compras',
  comercial: 'Comercial',
  recebimento_pesagem: 'Recebimento & Balança',
  corte: 'Desossa',
  expedicao: 'Carga',
  conferente: 'Conferência',
  faturamento: 'Faturamento',
  logistica: 'Logística',
  diretoria: 'Diretoria',
};

export function formatarPerfis(perfis: string[]): string | null {
  if (perfis.length === 0) return null;
  return perfis.map((perfil) => ROTULOS_PERFIS[perfil] ?? perfil).join(' · ');
}
