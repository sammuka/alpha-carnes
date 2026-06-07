export const PERMISSOES = {
  // ── F1 — Auth / RBAC ──────────────────────────────────────────────────────
  USUARIOS_GERENCIAR: 'USUARIOS_GERENCIAR',
  USUARIOS_APROVAR: 'USUARIOS_APROVAR',
  USUARIOS_LER: 'USUARIOS_LER',
  PERFIS_GERENCIAR: 'PERFIS_GERENCIAR',
  AUDITORIA_VISUALIZAR: 'AUDITORIA_VISUALIZAR',

  // ── F2 — Cadastros Base (LER / GERENCIAR por entidade) ────────────────────
  CLIENTES_LER: 'CLIENTES_LER',
  CLIENTES_GERENCIAR: 'CLIENTES_GERENCIAR',
  FORNECEDORES_LER: 'FORNECEDORES_LER',
  FORNECEDORES_GERENCIAR: 'FORNECEDORES_GERENCIAR',
  ITENS_COMPRA_LER: 'ITENS_COMPRA_LER',
  ITENS_COMPRA_GERENCIAR: 'ITENS_COMPRA_GERENCIAR',
  ITENS_COMERCIAIS_LER: 'ITENS_COMERCIAIS_LER',
  ITENS_COMERCIAIS_GERENCIAR: 'ITENS_COMERCIAIS_GERENCIAR',
  REGRAS_DESDOBRAMENTO_LER: 'REGRAS_DESDOBRAMENTO_LER',
  REGRAS_DESDOBRAMENTO_GERENCIAR: 'REGRAS_DESDOBRAMENTO_GERENCIAR',
  PARAMETROS_LER: 'PARAMETROS_LER',
  PARAMETROS_GERENCIAR: 'PARAMETROS_GERENCIAR',

  // ── F3 — Planejamento Comercial ───────────────────────────────────────────
  COMPRAS_PROGRAMADAS_LER: 'COMPRAS_PROGRAMADAS_LER',
  COMPRAS_PROGRAMADAS_GERENCIAR: 'COMPRAS_PROGRAMADAS_GERENCIAR', // criar/editar/confirmar
  DISPONIBILIDADE_LER: 'DISPONIBILIDADE_LER',
  PEDIDOS_LER: 'PEDIDOS_LER',
  PEDIDOS_GERENCIAR: 'PEDIDOS_GERENCIAR', // criar/cancelar/reduzir
} as const;

export type Permissao = (typeof PERMISSOES)[keyof typeof PERMISSOES];

/**
 * Permissões de LEITURA de cadastros base — concedidas a todos os perfis (consulta com filtro).
 * Não inclui USUARIOS_LER: listar usuários é administração, não cadastro base (segregação).
 */
const LEITURA_CADASTROS: Permissao[] = [
  'CLIENTES_LER',
  'FORNECEDORES_LER',
  'ITENS_COMPRA_LER',
  'ITENS_COMERCIAIS_LER',
  'REGRAS_DESDOBRAMENTO_LER',
  'PARAMETROS_LER',
];

/**
 * Mapa perfil → permissões.
 *
 * ADR-008: este mapa é APENAS bootstrap idempotente de `perfis_permissoes`.
 * A resolução de permissões em runtime (login/refresh) lê do banco, não daqui.
 *
 * Aterramento no doc 013 (segregação de funções):
 * - administrador (§2.1): "configurar itens, regras e integrações", "gerenciar parâmetros
 *   globais", "gerenciar perfis" → GERENCIAR de tudo.
 * - gestor (§2.3 / §3.1): aprova compra e ajustes comerciais; responsável comercial →
 *   gerencia CLIENTES e REGRAS_DESDOBRAMENTO (desdobramento é decisão comercial).
 * - compras (§2.2): "registrar informações do fornecedor" → gerencia FORNECEDORES.
 * - demais perfis operacionais: apenas leitura de cadastros (consulta com filtro).
 * Itens de compra/comerciais ficam só com o administrador (catálogo estrutural).
 */
export const MAPA_PERFIL_PERMISSOES: Record<string, Permissao[]> = {
  administrador: [
    'USUARIOS_GERENCIAR',
    'USUARIOS_APROVAR',
    'USUARIOS_LER',
    'PERFIS_GERENCIAR',
    'AUDITORIA_VISUALIZAR',
    'CLIENTES_LER',
    'CLIENTES_GERENCIAR',
    'FORNECEDORES_LER',
    'FORNECEDORES_GERENCIAR',
    'ITENS_COMPRA_LER',
    'ITENS_COMPRA_GERENCIAR',
    'ITENS_COMERCIAIS_LER',
    'ITENS_COMERCIAIS_GERENCIAR',
    'REGRAS_DESDOBRAMENTO_LER',
    'REGRAS_DESDOBRAMENTO_GERENCIAR',
    'PARAMETROS_LER',
    'PARAMETROS_GERENCIAR',
    // F3 — administrador gerencia tudo
    'COMPRAS_PROGRAMADAS_LER',
    'COMPRAS_PROGRAMADAS_GERENCIAR',
    'DISPONIBILIDADE_LER',
    'PEDIDOS_LER',
    'PEDIDOS_GERENCIAR',
  ],
  gestor: [
    'USUARIOS_APROVAR',
    'AUDITORIA_VISUALIZAR',
    'CLIENTES_GERENCIAR',
    'REGRAS_DESDOBRAMENTO_GERENCIAR',
    ...LEITURA_CADASTROS,
    // F3 (doc 013 §2.3/§4.1): gestor aprova/confirma compra e gerencia pedidos.
    'COMPRAS_PROGRAMADAS_LER',
    'COMPRAS_PROGRAMADAS_GERENCIAR',
    'DISPONIBILIDADE_LER',
    'PEDIDOS_LER',
    'PEDIDOS_GERENCIAR',
  ],
  // F3 (doc 013 §2.2): comprador cria/confirma compra programada; consulta saldo e pedidos.
  compras: [
    'FORNECEDORES_GERENCIAR',
    ...LEITURA_CADASTROS,
    'COMPRAS_PROGRAMADAS_GERENCIAR',
    'DISPONIBILIDADE_LER',
    'PEDIDOS_LER',
  ],
  // F3 (doc 013 §2.4): operador comercial registra pedidos e consulta saldo/compras.
  comercial: [
    ...LEITURA_CADASTROS,
    'COMPRAS_PROGRAMADAS_LER',
    'DISPONIBILIDADE_LER',
    'PEDIDOS_LER',
    'PEDIDOS_GERENCIAR',
  ],
  recebimento_pesagem: [...LEITURA_CADASTROS, 'DISPONIBILIDADE_LER'],
  corte: [...LEITURA_CADASTROS, 'DISPONIBILIDADE_LER'],
  expedicao: [...LEITURA_CADASTROS, 'DISPONIBILIDADE_LER'],
  conferente: [...LEITURA_CADASTROS, 'DISPONIBILIDADE_LER'],
  faturamento: [...LEITURA_CADASTROS, 'DISPONIBILIDADE_LER'],
  logistica: [...LEITURA_CADASTROS, 'DISPONIBILIDADE_LER'],
  diretoria: [
    'AUDITORIA_VISUALIZAR',
    ...LEITURA_CADASTROS,
    'COMPRAS_PROGRAMADAS_LER',
    'DISPONIBILIDADE_LER',
    'PEDIDOS_LER',
  ],
};

/** Descrições das permissões — usadas no seed e na sincronização do catálogo. */
export const DESCRICOES_PERMISSOES: Record<Permissao, string> = {
  USUARIOS_GERENCIAR: 'Criar e editar usuários',
  USUARIOS_APROVAR: 'Aprovar novos usuários (SF-01)',
  USUARIOS_LER: 'Listar e consultar usuários',
  PERFIS_GERENCIAR: 'Gerenciar perfis e suas permissões',
  AUDITORIA_VISUALIZAR: 'Consultar log de auditoria',
  CLIENTES_LER: 'Consultar clientes',
  CLIENTES_GERENCIAR: 'Criar, editar, excluir e restaurar clientes',
  FORNECEDORES_LER: 'Consultar fornecedores',
  FORNECEDORES_GERENCIAR: 'Criar, editar, excluir e restaurar fornecedores',
  ITENS_COMPRA_LER: 'Consultar itens de compra',
  ITENS_COMPRA_GERENCIAR: 'Criar, editar, excluir e restaurar itens de compra',
  ITENS_COMERCIAIS_LER: 'Consultar itens comerciais',
  ITENS_COMERCIAIS_GERENCIAR: 'Criar, editar, excluir e restaurar itens comerciais',
  REGRAS_DESDOBRAMENTO_LER: 'Consultar regras de desdobramento comercial',
  REGRAS_DESDOBRAMENTO_GERENCIAR: 'Criar, editar, excluir e restaurar regras de desdobramento',
  PARAMETROS_LER: 'Consultar parâmetros do sistema',
  PARAMETROS_GERENCIAR: 'Gerenciar parâmetros do sistema',
  COMPRAS_PROGRAMADAS_LER: 'Consultar compras programadas',
  COMPRAS_PROGRAMADAS_GERENCIAR: 'Criar, editar e confirmar compras programadas',
  DISPONIBILIDADE_LER: 'Consultar disponibilidade virtual do dia',
  PEDIDOS_LER: 'Consultar pedidos de venda',
  PEDIDOS_GERENCIAR: 'Criar, cancelar e ajustar pedidos de venda',
};
