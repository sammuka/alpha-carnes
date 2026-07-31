import { fetchBackend } from './api';

export interface UserPayload {
  sub: string;
  nome: string;
  perfis: string[];
  permissoes: string[];
  menusVisiveis: string[];
  escopoRepresentantes: {
    tipo: 'todos' | 'restrito';
    representantes: Array<{ id: string; nome: string }>;
  };
}

export async function getMe(): Promise<UserPayload | null> {
  const { data, error } = await fetchBackend<UserPayload>('/auth/me');
  if (error || !data) return null;
  return data;
}

export function hasPermission(user: UserPayload | null, permissao: string): boolean {
  return user?.permissoes?.includes(permissao) ?? false;
}
