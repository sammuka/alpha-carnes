import { fetchBackend } from './api';

export interface Paginado<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Lista uma entidade de cadastro paginada (server-side, via BFF). */
export async function listarCadastro<T>(
  recurso: string,
  params: { page?: number; search?: string } = {},
): Promise<{ data: Paginado<T> | null; error: string | null }> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.search) query.set('search', params.search);
  const qs = query.toString();
  const { data, error } = await fetchBackend<Paginado<T>>(`/${recurso}${qs ? `?${qs}` : ''}`);
  return { data, error };
}
