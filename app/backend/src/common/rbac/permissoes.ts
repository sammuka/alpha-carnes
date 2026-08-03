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
  PRODUTOS_LER: 'PRODUTOS_LER',
  PRODUTOS_GERENCIAR: 'PRODUTOS_GERENCIAR',
  REPRESENTANTES_LER: 'REPRESENTANTES_LER',
  REPRESENTANTES_GERENCIAR: 'REPRESENTANTES_GERENCIAR',
  ROTAS_LER: 'ROTAS_LER',
  ROTAS_GERENCIAR: 'ROTAS_GERENCIAR',
  REGRAS_DESDOBRAMENTO_LER: 'REGRAS_DESDOBRAMENTO_LER',
  REGRAS_DESDOBRAMENTO_GERENCIAR: 'REGRAS_DESDOBRAMENTO_GERENCIAR',
  PARAMETROS_LER: 'PARAMETROS_LER',
  PARAMETROS_GERENCIAR: 'PARAMETROS_GERENCIAR',
  FROTA_CAMINHOES_LER: 'FROTA_CAMINHOES_LER',
  FROTA_CAMINHOES_GERENCIAR: 'FROTA_CAMINHOES_GERENCIAR',
  FROTA_MOTORISTAS_LER: 'FROTA_MOTORISTAS_LER',
  FROTA_MOTORISTAS_GERENCIAR: 'FROTA_MOTORISTAS_GERENCIAR',
  MODELOS_ETIQUETA_LER: 'MODELOS_ETIQUETA_LER',
  MODELOS_ETIQUETA_GERENCIAR: 'MODELOS_ETIQUETA_GERENCIAR',

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
  ASSOCIACAO_ESTORNAR: 'ASSOCIACAO_ESTORNAR', // desfazer destinação já confirmada (doc 013 §4.3)
  LEITURA_MANUAL: 'LEITURA_MANUAL', // digitar QR quando leitor indisponível (ADR-009)
  ETIQUETA_GERENCIAR: 'ETIQUETA_GERENCIAR', // emitir/reimprimir etiqueta

  // ── F4c — Corte / Transformação ───────────────────────────────────────────
  CORTE_GERENCIAR: 'CORTE_GERENCIAR', // iniciar/gerar/pesar/associar/reetiquetar/concluir corte

  // ── F4d — Desossa ─────────────────────────────────────────────────────────
  DESOSSA_LER: 'DESOSSA_LER',
  DESOSSA_GERENCIAR: 'DESOSSA_GERENCIAR',
  DESOSSA_PAINEL_LER: 'DESOSSA_PAINEL_LER',

  // ── F4e — Estoque ─────────────────────────────────────────────────────────
  ESTOQUE_LER: 'ESTOQUE_LER',
  ESTOQUE_GERENCIAR: 'ESTOQUE_GERENCIAR',
  ESTOQUE_ENTRADA: 'ESTOQUE_ENTRADA',
  ESTOQUE_AJUSTAR: 'ESTOQUE_AJUSTAR',
  ESTOQUE_AJUSTE_APROVAR: 'ESTOQUE_AJUSTE_APROVAR',

  // ── F5 — Expedição ───────────────────────────────────────────────────────
  EXPEDICAO_GERENCIAR: 'EXPEDICAO_GERENCIAR', // gerenciar carga, itens, transferências, conferência
  EXPEDICAO_LER: 'EXPEDICAO_LER',             // consultar cargas, conferências e romaneios (Onda 9)
  EXPEDICAO_REABRIR: 'EXPEDICAO_REABRIR',     // reabertura excepcional de expedição fechada

  // ── F6a — Faturamento + NFS-e ────────────────────────────────────────────
  FATURAMENTO_LER: 'FATURAMENTO_LER',
  FATURAMENTO_GERENCIAR: 'FATURAMENTO_GERENCIAR',
  NFSE_EMITIR: 'NFSE_EMITIR',
  NFSE_CANCELAR: 'NFSE_CANCELAR',
  // ── Onda 10 — Seguro manual (F6b) + Liberação por checklist ─────────────
  SEGURO_GERENCIAR: 'SEGURO_GERENCIAR',
  LIBERACAO_GERENCIAR: 'LIBERACAO_GERENCIAR',

  // Onda 1 — Operação-pivô, overbooking v1.1, Pedido ao Fornecedor e conferência tripla.
  OPERACOES_GERENCIAR: 'OPERACOES_GERENCIAR',
  PEDIDO_OVERBOOKING_CONFIRMAR: 'PEDIDO_OVERBOOKING_CONFIRMAR',
  OVERBOOKING_RESOLVER: 'OVERBOOKING_RESOLVER',
  SIF_LER: 'SIF_LER',
  SIF_GERAR: 'SIF_GERAR',
  APROVACOES_LER: 'APROVACOES_LER',
  APROVACOES_DECIDIR: 'APROVACOES_DECIDIR',
  APROVACOES_SOLICITAR: 'APROVACOES_SOLICITAR',
  PEDIDO_FORNECEDOR_GERENCIAR: 'PEDIDO_FORNECEDOR_GERENCIAR',
  CONFERENCIA_CONCLUIR: 'CONFERENCIA_CONCLUIR',
  PEDIDO_FINALIZAR: 'PEDIDO_FINALIZAR',

  // Onda 4 — Comercial (tabela de preços, espelho e liberação administrativa de reserva).
  TABELA_PRECO_LER: 'TABELA_PRECO_LER',
  TABELA_PRECO_GERENCIAR: 'TABELA_PRECO_GERENCIAR',
  ESPELHO_COMERCIAL_LER: 'ESPELHO_COMERCIAL_LER',
  PEDIDO_RESERVA_LIBERAR: 'PEDIDO_RESERVA_LIBERAR',
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
  'PRODUTOS_LER',
  'REPRESENTANTES_LER',
  'ROTAS_LER',
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
    'PRODUTOS_LER',
    'PRODUTOS_GERENCIAR',
    'REPRESENTANTES_LER',
    'REPRESENTANTES_GERENCIAR',
    'ROTAS_LER',
    'ROTAS_GERENCIAR',
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
    'CORTE_GERENCIAR', // F4c — administrador gerencia tudo
    'DESOSSA_LER',
    'DESOSSA_GERENCIAR',
    'ESTOQUE_LER',
    'ESTOQUE_GERENCIAR',
    'EXPEDICAO_GERENCIAR', // F5 — administrador gerencia tudo
    'EXPEDICAO_REABRIR',
    // F6a — administrador gerencia tudo
    'FATURAMENTO_LER',
    'FATURAMENTO_GERENCIAR',
    'NFSE_EMITIR',
    'NFSE_CANCELAR',
  ],
  gestor: [
    'USUARIOS_APROVAR',
    'AUDITORIA_VISUALIZAR',
    'CLIENTES_GERENCIAR',
    'REGRAS_DESDOBRAMENTO_GERENCIAR',
    'PRODUTOS_GERENCIAR',
    'REPRESENTANTES_GERENCIAR',
    'ROTAS_GERENCIAR',
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
    'CORTE_GERENCIAR', // F4c — gestor operacional gerencia corte
    'DESOSSA_LER',
    'DESOSSA_GERENCIAR',
    'ESTOQUE_LER',
    'ESTOQUE_GERENCIAR',
    'EXPEDICAO_GERENCIAR', // F5 — gestor operacional gerencia expedição
    'EXPEDICAO_REABRIR',
    // F6a — gestor operacional gerencia faturamento e NFS-e
    'FATURAMENTO_LER',
    'FATURAMENTO_GERENCIAR',
    'NFSE_EMITIR',
    'NFSE_CANCELAR',
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
  // F4c (doc 013): operador de corte executa o ciclo completo de transformação.
  // Reusa os contratos de F4b: pesar subitem (manual), associar, ler QR, etiquetar.
  corte: [
    ...LEITURA_CADASTROS,
    'DISPONIBILIDADE_LER',
    'PESAGEM_LER',
    'PESO_MANUAL',
    'ASSOCIACAO_GERENCIAR',
    'LEITURA_MANUAL',
    'ETIQUETA_GERENCIAR',
    'CORTE_GERENCIAR',
    'DESOSSA_LER',
    'DESOSSA_GERENCIAR',
  ],
  expedicao: [
    ...LEITURA_CADASTROS,
    'DISPONIBILIDADE_LER',
    'LEITURA_MANUAL',        // conferência por QR com fallback manual (ADR-009)
    'EXPEDICAO_GERENCIAR',   // gerenciar carga, transferências, conferência
    'FATURAMENTO_LER',       // F6a — expedicao acompanha faturamento
  ],
  conferente: [...LEITURA_CADASTROS, 'DISPONIBILIDADE_LER'],
  // F4a (doc 005 §2.2): faturamento consulta o recebimento. F4b: consulta a pesagem.
  // F6a (doc 008 §4.2): faturamento gerencia faturamento e NFS-e.
  faturamento: [
    ...LEITURA_CADASTROS,
    'DISPONIBILIDADE_LER',
    'RECEBIMENTO_LER',
    'PESAGEM_LER',
    'FATURAMENTO_LER',
    'FATURAMENTO_GERENCIAR',
    'NFSE_EMITIR',
    'NFSE_CANCELAR',
  ],
  logistica: [...LEITURA_CADASTROS, 'DISPONIBILIDADE_LER', 'FATURAMENTO_LER'],
  // diretoria e demais: definidos abaixo; pushes Onda 1 após o objeto.
  diretoria: [
    'AUDITORIA_VISUALIZAR',
    ...LEITURA_CADASTROS,
    'COMPRAS_PROGRAMADAS_LER',
    'DISPONIBILIDADE_LER',
    'PEDIDOS_LER',
  ],
};

function pushPermissoes(perfil: string, ...chaves: Permissao[]): void {
  const lista = MAPA_PERFIL_PERMISSOES[perfil];
  if (!lista) throw new Error(`Perfil ausente no mapa: ${perfil}`);
  lista.push(...chaves);
}

pushPermissoes(
  'gestor',
  'OPERACOES_GERENCIAR', 'PEDIDO_OVERBOOKING_CONFIRMAR', 'OVERBOOKING_RESOLVER',
  'PEDIDO_FORNECEDOR_GERENCIAR', 'CONFERENCIA_CONCLUIR', 'PEDIDO_FINALIZAR',
);
pushPermissoes('compras', 'OPERACOES_GERENCIAR', 'PEDIDO_FORNECEDOR_GERENCIAR');
pushPermissoes('comercial', 'PEDIDO_OVERBOOKING_CONFIRMAR', 'PEDIDO_FINALIZAR');
pushPermissoes('recebimento_pesagem', 'CONFERENCIA_CONCLUIR');
pushPermissoes(
  'administrador',
  'OPERACOES_GERENCIAR', 'PEDIDO_OVERBOOKING_CONFIRMAR', 'OVERBOOKING_RESOLVER',
  'PEDIDO_FORNECEDOR_GERENCIAR', 'CONFERENCIA_CONCLUIR', 'PEDIDO_FINALIZAR',
);
pushPermissoes(
  'administrador',
  'FROTA_CAMINHOES_LER', 'FROTA_CAMINHOES_GERENCIAR',
  'FROTA_MOTORISTAS_LER', 'FROTA_MOTORISTAS_GERENCIAR',
  'MODELOS_ETIQUETA_LER', 'MODELOS_ETIQUETA_GERENCIAR',
);
pushPermissoes(
  'gestor',
  'FROTA_CAMINHOES_LER', 'FROTA_CAMINHOES_GERENCIAR',
  'FROTA_MOTORISTAS_LER', 'FROTA_MOTORISTAS_GERENCIAR',
  'MODELOS_ETIQUETA_LER', 'MODELOS_ETIQUETA_GERENCIAR',
);
pushPermissoes(
  'expedicao',
  'FROTA_CAMINHOES_LER', 'FROTA_CAMINHOES_GERENCIAR',
  'FROTA_MOTORISTAS_LER', 'FROTA_MOTORISTAS_GERENCIAR',
);
pushPermissoes('recebimento_pesagem', 'MODELOS_ETIQUETA_LER');
pushPermissoes('corte', 'MODELOS_ETIQUETA_LER');
pushPermissoes(
  'administrador',
  'TABELA_PRECO_LER', 'TABELA_PRECO_GERENCIAR',
  'ESPELHO_COMERCIAL_LER', 'PEDIDO_RESERVA_LIBERAR',
);
pushPermissoes(
  'gestor',
  'TABELA_PRECO_LER', 'TABELA_PRECO_GERENCIAR',
  'ESPELHO_COMERCIAL_LER', 'PEDIDO_RESERVA_LIBERAR',
);
pushPermissoes('comercial', 'TABELA_PRECO_LER', 'ESPELHO_COMERCIAL_LER');
pushPermissoes('expedicao', 'ESPELHO_COMERCIAL_LER');

pushPermissoes('administrador', 'SIF_LER', 'SIF_GERAR', 'APROVACOES_LER', 'APROVACOES_DECIDIR', 'APROVACOES_SOLICITAR');
pushPermissoes('gestor',        'SIF_LER', 'SIF_GERAR', 'APROVACOES_LER', 'APROVACOES_DECIDIR', 'APROVACOES_SOLICITAR');
pushPermissoes('faturamento',   'SIF_LER', 'SIF_GERAR', 'APROVACOES_SOLICITAR');
pushPermissoes('diretoria',     'SIF_LER', 'APROVACOES_LER');
pushPermissoes('recebimento_pesagem', 'APROVACOES_LER', 'APROVACOES_SOLICITAR');
pushPermissoes('corte',         'APROVACOES_SOLICITAR');
pushPermissoes('expedicao',     'APROVACOES_SOLICITAR');

// Onda 6 — estorno de destinação é exceção operacional (doc 013 §4.3): só escalada.
// recebimento_pesagem e corte têm ASSOCIACAO_GERENCIAR e deliberadamente NÃO recebem esta
// permissão — é a segregação "quem associa não estorna" (D6.3/D6.19).
pushPermissoes('administrador', 'ASSOCIACAO_ESTORNAR');
pushPermissoes('gestor',        'ASSOCIACAO_ESTORNAR');

// Onda 7 — painel aeroporto / Modo TV (D7.8).
pushPermissoes('administrador', 'DESOSSA_PAINEL_LER');
pushPermissoes('gestor', 'DESOSSA_PAINEL_LER');
pushPermissoes('corte', 'DESOSSA_PAINEL_LER');
// comercial e diretoria NÃO têm DESOSSA_LER hoje — conceder ambos:
pushPermissoes('comercial', 'DESOSSA_LER', 'DESOSSA_PAINEL_LER');
pushPermissoes('diretoria', 'DESOSSA_LER', 'DESOSSA_PAINEL_LER');

// Onda 8 — AD-04: recorte ESTOQUE_* para expedicao e recebimento_pesagem (sem 12º perfil)
pushPermissoes('expedicao', 'ESTOQUE_LER', 'ESTOQUE_GERENCIAR', 'ESTOQUE_ENTRADA', 'ESTOQUE_AJUSTAR');
pushPermissoes('recebimento_pesagem', 'ESTOQUE_LER', 'ESTOQUE_GERENCIAR', 'ESTOQUE_ENTRADA', 'ESTOQUE_AJUSTAR');
pushPermissoes('gestor', 'ESTOQUE_ENTRADA', 'ESTOQUE_AJUSTAR', 'ESTOQUE_AJUSTE_APROVAR');
pushPermissoes('administrador', 'ESTOQUE_ENTRADA', 'ESTOQUE_AJUSTAR', 'ESTOQUE_AJUSTE_APROVAR');

// Onda 9 — leitura das telas de carga (matriz linhas 23–25)
pushPermissoes('conferente', 'EXPEDICAO_LER', 'EXPEDICAO_GERENCIAR', 'LEITURA_MANUAL'); // D9.2 — conferente opera a bipagem (doc 04 §6.2)
pushPermissoes('logistica', 'EXPEDICAO_LER');
pushPermissoes('faturamento', 'EXPEDICAO_LER');
pushPermissoes('gestor', 'EXPEDICAO_LER');
pushPermissoes('administrador', 'EXPEDICAO_LER');
pushPermissoes('expedicao', 'EXPEDICAO_LER');

// Onda 10 — Faturamento: EISS real, seguro manual (F6b), liberação por checklist
pushPermissoes('faturamento', 'SEGURO_GERENCIAR', 'LIBERACAO_GERENCIAR');
pushPermissoes('gestor', 'SEGURO_GERENCIAR', 'LIBERACAO_GERENCIAR');
pushPermissoes('administrador', 'SEGURO_GERENCIAR', 'LIBERACAO_GERENCIAR');
pushPermissoes('logistica', 'SEGURO_GERENCIAR', 'LIBERACAO_GERENCIAR'); // D10.9 — doc 04 §7.3/§7.4
pushPermissoes('diretoria', 'FATURAMENTO_LER');

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
  PRODUTOS_LER: 'Consultar produtos',
  PRODUTOS_GERENCIAR: 'Criar, editar, excluir e restaurar produtos',
  REPRESENTANTES_LER: 'Consultar representantes',
  REPRESENTANTES_GERENCIAR: 'Criar, editar, excluir e restaurar representantes',
  ROTAS_LER: 'Consultar rotas',
  ROTAS_GERENCIAR: 'Criar, editar, excluir e restaurar rotas',
  REGRAS_DESDOBRAMENTO_LER: 'Consultar regras de desdobramento comercial',
  REGRAS_DESDOBRAMENTO_GERENCIAR: 'Criar, editar, excluir e restaurar regras de desdobramento',
  PARAMETROS_LER: 'Consultar parâmetros do sistema',
  PARAMETROS_GERENCIAR: 'Gerenciar parâmetros do sistema',
  FROTA_CAMINHOES_LER: 'Consultar caminhões da frota',
  FROTA_CAMINHOES_GERENCIAR: 'Criar, editar, excluir e restaurar caminhões da frota',
  FROTA_MOTORISTAS_LER: 'Consultar motoristas',
  FROTA_MOTORISTAS_GERENCIAR: 'Criar, editar, excluir e restaurar motoristas',
  MODELOS_ETIQUETA_LER: 'Consultar modelos de etiqueta',
  MODELOS_ETIQUETA_GERENCIAR: 'Configurar campos dos modelos de etiqueta',
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
  ASSOCIACAO_ESTORNAR: 'Estornar associação/destinação já confirmada de uma peça',
  LEITURA_MANUAL: 'Digitar identificador QR quando o leitor está indisponível',
  ETIQUETA_GERENCIAR: 'Emitir e reimprimir etiquetas de peça',
  CORTE_GERENCIAR: 'Iniciar, executar e concluir cortes/transformações de peças',
  DESOSSA_LER: 'Consultar dashboard de faltas e regras de transformação da desossa',
  DESOSSA_GERENCIAR: 'Gerenciar regras de transformação da desossa',
  DESOSSA_PAINEL_LER: 'Consultar painel aeroporto/Modo TV da desossa (telão)',
  ESTOQUE_LER: 'Consultar peças e subitens em estoque',
  ESTOQUE_GERENCIAR: 'Gerenciar movimentações e ajustes de estoque',
  ESTOQUE_ENTRADA: 'Registrar entrada de itens por unidade (caixarias)',
  ESTOQUE_AJUSTAR: 'Criar ajustes de estoque',
  ESTOQUE_AJUSTE_APROVAR: 'Aprovar/rejeitar ajustes de estoque (gestão)',
  EXPEDICAO_GERENCIAR: 'Gerenciar expedição: carga, transferências, conferência e fechamento',
  EXPEDICAO_LER: 'Consultar cargas, conferências e romaneios',
  EXPEDICAO_REABRIR: 'Reabrir expedição fechada (excepcional, auditado)',
  FATURAMENTO_LER: 'Visualizar faturamentos e consolidação da carga',
  FATURAMENTO_GERENCIAR: 'Gerenciar faturamentos (consolidar e reprocessar)',
  NFSE_EMITIR: 'Emitir NFS-e para pedidos faturados',
  NFSE_CANCELAR: 'Cancelar NFS-e emitidas',
  SEGURO_GERENCIAR: 'Registrar envio e confirmação do seguro de carga',
  LIBERACAO_GERENCIAR: 'Liberar caminhão por checklist',
  OPERACOES_GERENCIAR: 'Criar, iniciar e fechar operações',
  PEDIDO_OVERBOOKING_CONFIRMAR: 'Confirmar inclusão com overbooking',
  OVERBOOKING_RESOLVER: 'Tratar pendências de overbooking',
  SIF_LER: 'Consultar relatórios SIF e suas versões',
  SIF_GERAR: 'Gerar e retificar versões de relatório SIF',
  APROVACOES_LER: 'Consultar a fila de aprovações e ocorrências',
  APROVACOES_DECIDIR: 'Aprovar ou rejeitar solicitações operacionais',
  APROVACOES_SOLICITAR: 'Abrir solicitação de aprovação operacional',
  PEDIDO_FORNECEDOR_GERENCIAR: 'Gerenciar pedidos ao fornecedor',
  CONFERENCIA_CONCLUIR: 'Concluir conferência Pedido×NF×Pesagem',
  PEDIDO_FINALIZAR: 'Finalizar pedido de venda',
  TABELA_PRECO_LER: 'Consultar tabelas de preço e histórico de publicação',
  TABELA_PRECO_GERENCIAR: 'Criar, editar, copiar e publicar tabelas de preço',
  ESPELHO_COMERCIAL_LER: 'Consultar e exportar o espelho comercial',
  PEDIDO_RESERVA_LIBERAR: 'Liberar administrativamente a reserva de um rascunho (AD-06)',
};
