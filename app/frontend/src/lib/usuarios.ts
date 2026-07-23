export interface Usuario {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  perfis: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface PerfilComPermissoes {
  slug: string;
  nome: string;
  permissoes: string[];
}

export interface CriarUsuarioDto {
  nome: string;
  email: string;
  password: string;
  perfis?: string[];
}

export interface AtualizarUsuarioDto {
  nome?: string;
  email?: string;
  ativo?: boolean;
}
