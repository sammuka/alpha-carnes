import { ilike, type Column, type SQL } from 'drizzle-orm';

/**
 * Busca "contém" sem curinga do usuário (AD-41): `%`, `_` e `\` do termo viram literais
 * (a barra é o ESCAPE padrão do LIKE no PostgreSQL). `scripts/lint-ilike.mjs` proíbe
 * montar `%${termo}%` fora deste arquivo.
 */
export function padraoContem(termo: string): string {
  return `%${termo.replace(/[\\%_]/g, '\\$&')}%`;
}

export function ilikeSeguro(coluna: Column | SQL, termo: string): SQL {
  return ilike(coluna, padraoContem(termo));
}
