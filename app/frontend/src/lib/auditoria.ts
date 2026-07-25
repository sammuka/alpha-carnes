import type { Paginado } from '@/lib/comercial';

export type OperacaoAuditoria = 'INSERT' | 'UPDATE' | 'DELETE' | 'ACAO_MANUAL';

export interface RegistroAuditoria {
  id: string;
  tabela: string;
  registroId: string;
  operacao: OperacaoAuditoria;
  modulo: string | null;
  usuarioId: string | null;
  usuarioNome: string | null;
  dadosAnteriores: Record<string, unknown>;
  dadosNovos: Record<string, unknown>;
  justificativa: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export type PaginadoAuditoria = Paginado<RegistroAuditoria>;

export interface FiltrosAuditoria {
  page?: number;
  pageSize?: number;
  modulo?: string;
  operacao?: OperacaoAuditoria;
  usuarioId?: string;
  registroId?: string;
  registroBusca?: string;
  tabela?: string;
  dataInicio?: string;
  dataFim?: string;
}

export interface FacetasAuditoria {
  modulos: string[];
  tabelas: string[];
  usuarios: Array<{ id: string; nome: string }>;
}
