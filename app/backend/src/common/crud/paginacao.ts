import { z } from 'zod';

/** Parâmetros padrão de listagem: paginação + busca textual + incluir removidos. */
export const listarQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  incluirRemovidos: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === 'true'),
});

export type ListarQuery = z.infer<typeof listarQuerySchema>;

export interface Paginado<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Calcula `limit`/`offset` a partir de page/pageSize. */
export function calcularRange(query: Pick<ListarQuery, 'page' | 'pageSize'>): {
  limit: number;
  offset: number;
} {
  return { limit: query.pageSize, offset: (query.page - 1) * query.pageSize };
}

/** Monta o envelope paginado padrão. */
export function montarPaginado<T>(
  data: T[],
  total: number,
  query: Pick<ListarQuery, 'page' | 'pageSize'>,
): Paginado<T> {
  return { data, total, page: query.page, pageSize: query.pageSize };
}

/**
 * Retorna o primeiro elemento de um `.returning()`/`.select()` ou lança erro explícito.
 * Sob `noUncheckedIndexedAccess`, `linhas[0]` é `T | undefined`; este helper garante `T`
 * e evita falha silenciosa (RA-05) caso a mutação não retorne linha.
 */
export function primeiroOuFalha<T>(linhas: T[], contexto = 'Operação não retornou registro'): T {
  const linha = linhas[0];
  if (linha === undefined) throw new Error(contexto);
  return linha;
}
