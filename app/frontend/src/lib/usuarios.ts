export interface RepresentantePermitido {
  id: string;
  nome: string;
  status: string;
  deletedAt: string | null;
  tipoCanal?: string | null;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  perfis: string[];
  ultimoAcesso: string | null;
  representantesPermitidos: RepresentantePermitido[];
  escopoRepresentantes: 'todos' | 'restrito';
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
  representantes?: string[];
}

export interface AtualizarUsuarioDto {
  nome?: string;
  email?: string;
  ativo?: boolean;
}
