export const PERMISSOES = {
  USUARIOS_GERENCIAR: 'USUARIOS_GERENCIAR',
  USUARIOS_APROVAR: 'USUARIOS_APROVAR',
  PERFIS_GERENCIAR: 'PERFIS_GERENCIAR',
  AUDITORIA_VISUALIZAR: 'AUDITORIA_VISUALIZAR',
} as const;

export type Permissao = (typeof PERMISSOES)[keyof typeof PERMISSOES];

// Mapa perfil → permissões (F1)
export const MAPA_PERFIL_PERMISSOES: Record<string, Permissao[]> = {
  administrador: [
    'USUARIOS_GERENCIAR',
    'USUARIOS_APROVAR',
    'PERFIS_GERENCIAR',
    'AUDITORIA_VISUALIZAR',
  ],
  gestor: ['USUARIOS_APROVAR', 'AUDITORIA_VISUALIZAR'],
  diretoria: ['AUDITORIA_VISUALIZAR'],
  // demais perfis: sem permissões administrativas na F1
  compras: [],
  comercial: [],
  recebimento_pesagem: [],
  corte: [],
  expedicao: [],
  conferente: [],
  faturamento: [],
  logistica: [],
};
