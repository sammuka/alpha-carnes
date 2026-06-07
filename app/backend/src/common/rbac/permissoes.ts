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

  // ── F4a — Recebimento + Divergências ──────────────────────────────────────
  RECEBIMENTO_LER: 'RECEBIMENTO_LER',
  RECEBIMENTO_GERENCIAR: 'RECEBIMENTO_GERENCIAR', // iniciar/registrar item/concluir
  DIVERGENCIA_RECEBIMENTO_GERENCIAR: 'DIVERGENCIA_RECEBIMENTO_GERENCIAR',
  OCORRENCIA_FORNECEDOR_GERENCIAR: 'OCORRENCIA_FORNECEDOR_GERENCIAR',

  // ── F4b — Pesagem + Associação + Etiquetagem ──────────────────────────────
  PESAGEM_LER: 'PESAGEM_LER',
  PESAGEM_GERENCIAR: 'PESAGEM_GERENCIAR', // pesar peça / status dispositivos
  PESO_MANUAL: 'PESO_MANUAL', // captura manual assistida de peso (ADR-009)
  ASSOCIACAO_GERENCIAR: 'ASSOCIACAO_GERENCIAR', // confirmar/redirecionar/sem-cobertura
  LEITURA_MANUAL: 'LEITURA_MANUAL', // digitar QR quando leitor indisponível (ADR-009)
  ETIQUETA_GERENCIAR: 'ETIQUETA_GERENCIAR', // emitir/reimprimir etiqueta
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
    // F4a — administrador gerencia tudo
    'RECEBIMENTO_LER',
    'RECEBIMENTO_GERENCIAR',
    'DIVERGENCIA_RECEBIMENTO_GERENCIAR',
    'OCORRENCIA_FORNECEDOR_GERENCIAR',
    // F4b — administrador gerencia tudo
    'PESAGEM_LER',
    'PESAGEM_GERENCIAR',
    'PESO_MANUAL',
    'ASSOCIACAO_GERENCIAR',
    'LEITURA_MANUAL',
    'ETIQUETA_GERENCIAR',
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
    // F4a — gestor operacional gerencia recebimento, divergências e ocorrências.
    'RECEBIMENTO_LER',
    'RECEBIMENTO_GERENCIAR',
    'DIVERGENCIA_RECEBIMENTO_GERENCIAR',
    'OCORRENCIA_FORNECEDOR_GERENCIAR',
    // F4b — gestor operacional gerencia toda a pesagem/associação/etiqueta (incl. manual).
    'PESAGEM_LER',
    'PESAGEM_GERENCIAR',
    'PESO_MANUAL',
    'ASSOCIACAO_GERENCIAR',
    'LEITURA_MANUAL',
    'ETIQUETA_GERENCIAR',
  ],
  // F3 (doc 013 §2.2): comprador cria/confirma compra programada; consulta saldo e pedidos.
  compras: [
    'FORNECEDORES_GERENCIAR',
    ...LEITURA_CADASTROS,
    'COMPRAS_PROGRAMADAS_LER',
    'COMPRAS_PROGRAMADAS_GERENCIAR',
    'DISPONIBILIDADE_LER',
    'PEDIDOS_LER',
    // F4a (doc 005 §2.2): compras trata divergências e conduz ocorrências com fornecedor.
    'RECEBIMENTO_LER',
    'DIVERGENCIA_RECEBIMENTO_GERENCIAR',
    'OCORRENCIA_FORNECEDOR_GERENCIAR',
  ],
  // F3 (doc 013 §2.4): operador comercial registra pedidos e consulta saldo/compras.
  comercial: [
    ...LEITURA_CADASTROS,
    'COMPRAS_PROGRAMADAS_LER',
    'DISPONIBILIDADE_LER',
    'PEDIDOS_LER',
    'PEDIDOS_GERENCIAR',
    // F4a (doc 005 §2.2): comercial consulta o recebimento (impacto em pedidos).
    'RECEBIMENTO_LER',
    // F4b: comercial acompanha pesagem/associação das peças dos seus pedidos.
    'PESAGEM_LER',
  ],
  // F4a (doc 005 §2.2): operador/receptor opera o recebimento e registra divergências.
  recebimento_pesagem: [
    ...LEITURA_CADASTROS,
    'DISPONIBILIDADE_LER',
    'RECEBIMENTO_LER',
    'RECEBIMENTO_GERENCIAR',
    'DIVERGENCIA_RECEBIMENTO_GERENCIAR',
    // F4b (doc 013): operador de recebimento/pesagem opera pesagem, peso manual,
    // associação, leitura manual de QR e etiquetagem.
    'PESAGEM_LER',
    'PESAGEM_GERENCIAR',
    'PESO_MANUAL',
    'ASSOCIACAO_GERENCIAR',
    'LEITURA_MANUAL',
    'ETIQUETA_GERENCIAR',
  ],
  corte: [...LEITURA_CADASTROS, 'DISPONIBILIDADE_LER'],
  expedicao: [...LEITURA_CADASTROS, 'DISPONIBILIDADE_LER'],
  conferente: [...LEITURA_CADASTROS, 'DISPONIBILIDADE_LER'],
  // F4a (doc 005 §2.2): faturamento consulta o recebimento. F4b: consulta a pesagem.
  faturamento: [...LEITURA_CADASTROS, 'DISPONIBILIDADE_LER', 'RECEBIMENTO_LER', 'PESAGEM_LER'],
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
  RECEBIMENTO_LER: 'Consultar recebimentos e divergências',
  RECEBIMENTO_GERENCIAR: 'Iniciar, registrar itens e concluir recebimentos',
  DIVERGENCIA_RECEBIMENTO_GERENCIAR: 'Registrar e tratar divergências de recebimento',
  OCORRENCIA_FORNECEDOR_GERENCIAR: 'Abrir, atualizar e encerrar ocorrências com fornecedor',
  PESAGEM_LER: 'Consultar peças pesadas e status dos dispositivos',
  PESAGEM_GERENCIAR: 'Registrar pesagem de peças e operar a captura',
  PESO_MANUAL: 'Registrar peso manual assistido (fallback ADR-009)',
  ASSOCIACAO_GERENCIAR: 'Confirmar, redirecionar e destinar peças a pedidos',
  LEITURA_MANUAL: 'Digitar identificador QR quando o leitor está indisponível',
  ETIQUETA_GERENCIAR: 'Emitir e reimprimir etiquetas de peça',
};
