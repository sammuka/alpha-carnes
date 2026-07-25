/**
 * Menu canônico v2 — estrutura de navegação e mapeamento RBAC.
 * Ordem, rótulos e rotas idênticos a ALL_NAV_GROUPS do protótipo (Layout.tsx).
 * Grupo aparece se o usuário tiver ao menos uma permissão de `permissoesGrupo`
 * (segregação por função, doc 013); item aparece se tiver ao menos uma das suas.
 */

export interface MenuItemDef {
  href: string;
  label: string;
  iconKey: string;
  permissoes: string[];
}

export interface MenuGroupDef {
  title: string;
  permissoesGrupo: string[];
  items: MenuItemDef[];
}

export const MENU_V2: MenuGroupDef[] = [
  {
    title: 'COMERCIAL',
    permissoesGrupo: ['PEDIDOS_LER', 'PEDIDOS_GERENCIAR'],
    items: [
      { href: '/comercial/clientes', label: 'Clientes', iconKey: 'Users', permissoes: ['CLIENTES_LER'] },
      { href: '/comercial/pedidos', label: 'Pedidos de Venda', iconKey: 'ClipboardList', permissoes: ['PEDIDOS_LER', 'PEDIDOS_GERENCIAR'] },
      { href: '/comercial/tabela-precos', label: 'Tabela de Preços', iconKey: 'Tags', permissoes: ['PEDIDOS_GERENCIAR'] },
      { href: '/comercial/disponibilidade', label: 'Disponibilidade', iconKey: 'BarChart3', permissoes: ['DISPONIBILIDADE_LER'] },
      { href: '/comercial/espelho', label: 'Espelho Comercial', iconKey: 'FileSpreadsheet', permissoes: ['PEDIDOS_LER'] },
    ],
  },
  {
    title: 'GESTÃO',
    // FATURAMENTO_GERENCIAR abre o grupo para `faturamento`, primário em Relatórios & SIF (decisão 30)
    permissoesGrupo: [
      'COMPRAS_PROGRAMADAS_GERENCIAR',
      'OPERACOES_GERENCIAR',
      'OVERBOOKING_RESOLVER',
      'EXPEDICAO_REABRIR',
      'FATURAMENTO_GERENCIAR',
    ],
    items: [
      { href: '/gestao/dashboard', label: 'Painel Geral da Operação', iconKey: 'LayoutDashboard', permissoes: ['COMPRAS_PROGRAMADAS_LER', 'PEDIDOS_LER'] },
      { href: '/gestao/operacoes', label: 'Operações', iconKey: 'CalendarRange', permissoes: ['OPERACOES_GERENCIAR'] },
      { href: '/gestao/compras', label: 'Compras', iconKey: 'ShoppingCart', permissoes: ['COMPRAS_PROGRAMADAS_LER', 'COMPRAS_PROGRAMADAS_GERENCIAR'] },
      { href: '/gestao/overbooking', label: 'Pendências de Overbooking', iconKey: 'AlertTriangle', permissoes: ['OVERBOOKING_RESOLVER', 'PEDIDO_OVERBOOKING_CONFIRMAR', 'COMPRAS_PROGRAMADAS_GERENCIAR'] },
      { href: '/gestao/aprovacoes', label: 'Aprovações & Ocorrências', iconKey: 'CheckCircle', permissoes: ['DIVERGENCIA_RECEBIMENTO_GERENCIAR', 'EXPEDICAO_REABRIR'] },
      { href: '/gestao/relatorios', label: 'Relatórios & SIF', iconKey: 'PieChart', permissoes: ['DISPONIBILIDADE_LER'] },
    ],
  },
  {
    title: 'RECEBIMENTO & BALANÇA',
    permissoesGrupo: ['RECEBIMENTO_GERENCIAR', 'PESAGEM_GERENCIAR', 'CONFERENCIA_CONCLUIR'],
    items: [
      { href: '/recebimento/recebimento-carga', label: 'Recebimento de Carga', iconKey: 'PackageCheck', permissoes: ['RECEBIMENTO_LER', 'RECEBIMENTO_GERENCIAR'] },
      { href: '/recebimento/pesagem-destinacao', label: 'Pesagem e Destinação', iconKey: 'Scale', permissoes: ['PESAGEM_LER', 'PESAGEM_GERENCIAR'] },
      { href: '/recebimento/etiquetas', label: 'Etiquetas', iconKey: 'Tag', permissoes: ['ETIQUETA_GERENCIAR', 'PESAGEM_LER'] },
    ],
  },
  {
    title: 'DESOSSA',
    permissoesGrupo: ['CORTE_GERENCIAR', 'DESOSSA_GERENCIAR'],
    items: [
      { href: '/desossa/dashboard', label: 'Dashboard da Desossa', iconKey: 'LayoutDashboard', permissoes: ['DESOSSA_LER', 'CORTE_GERENCIAR'] },
      { href: '/desossa/pesagem-destinacao', label: 'Pesagem e Destinação', iconKey: 'Scissors', permissoes: ['CORTE_GERENCIAR'] },
      { href: '/desossa/etiquetas', label: 'Etiquetas', iconKey: 'Tag', permissoes: ['ETIQUETA_GERENCIAR', 'CORTE_GERENCIAR'] },
    ],
  },
  {
    title: 'ESTOQUE',
    permissoesGrupo: ['ESTOQUE_LER', 'ESTOQUE_GERENCIAR'],
    items: [
      { href: '/estoque/consulta', label: 'Consulta de Estoque', iconKey: 'Warehouse', permissoes: ['ESTOQUE_LER', 'ESTOQUE_GERENCIAR'] },
      { href: '/estoque/entrada-itens', label: 'Entrada de Itens', iconKey: 'PackagePlus', permissoes: ['ESTOQUE_GERENCIAR'] },
      { href: '/estoque/ajustes', label: 'Ajustes', iconKey: 'SlidersHorizontal', permissoes: ['ESTOQUE_GERENCIAR'] },
    ],
  },
  {
    title: 'CARGA',
    permissoesGrupo: ['EXPEDICAO_GERENCIAR'],
    items: [
      { href: '/carga/planejamento', label: 'Planejamento de Carga', iconKey: 'Truck', permissoes: ['EXPEDICAO_GERENCIAR'] },
      { href: '/carga/conferencia', label: 'Conferência', iconKey: 'ClipboardCheck', permissoes: ['EXPEDICAO_GERENCIAR'] },
      { href: '/carga/enviar-faturamento', label: 'Enviar para Faturamento', iconKey: 'Send', permissoes: ['EXPEDICAO_GERENCIAR', 'FATURAMENTO_GERENCIAR'] },
    ],
  },
  {
    title: 'FATURAMENTO',
    permissoesGrupo: ['FATURAMENTO_GERENCIAR', 'NFSE_EMITIR'],
    items: [
      { href: '/faturamento/pre-faturamento', label: 'Pré-Faturamento', iconKey: 'FileText', permissoes: ['FATURAMENTO_LER', 'FATURAMENTO_GERENCIAR'] },
      { href: '/faturamento/notas-xml', label: 'Notas / XML', iconKey: 'FileCode', permissoes: ['NFSE_EMITIR', 'FATURAMENTO_LER'] },
      { href: '/faturamento/seguro-manual', label: 'Seguro Manual', iconKey: 'ShieldCheck', permissoes: ['FATURAMENTO_GERENCIAR'] },
      { href: '/faturamento/liberacao', label: 'Liberação do Caminhão', iconKey: 'DoorOpen', permissoes: ['FATURAMENTO_GERENCIAR', 'EXPEDICAO_GERENCIAR'] },
    ],
  },
  {
    title: 'CADASTROS & REGRAS',
    permissoesGrupo: [
      'CLIENTES_GERENCIAR',
      'PRODUTOS_GERENCIAR',
      'FORNECEDORES_GERENCIAR',
      'REPRESENTANTES_GERENCIAR',
      'ROTAS_GERENCIAR',
      'REGRAS_DESDOBRAMENTO_GERENCIAR',
    ],
    items: [
      { href: '/cadastros/representantes', label: 'Representantes', iconKey: 'UserCircle', permissoes: ['REPRESENTANTES_LER', 'REPRESENTANTES_GERENCIAR'] },
      { href: '/cadastros/produtos', label: 'Produtos', iconKey: 'Package', permissoes: ['PRODUTOS_LER'] },
      { href: '/cadastros/fornecedores', label: 'Fornecedores / Frigoríficos', iconKey: 'Building2', permissoes: ['FORNECEDORES_LER'] },
      { href: '/cadastros/caminhoes', label: 'Caminhões', iconKey: 'Truck', permissoes: ['EXPEDICAO_GERENCIAR'] },
      { href: '/cadastros/motoristas', label: 'Motoristas', iconKey: 'Contact', permissoes: ['EXPEDICAO_GERENCIAR'] },
      { href: '/cadastros/rotas', label: 'Rotas / Itinerários', iconKey: 'Map', permissoes: ['ROTAS_LER', 'ROTAS_GERENCIAR'] },
      { href: '/cadastros/regras-transformacao', label: 'Regras de Transformação', iconKey: 'GitBranch', permissoes: ['REGRAS_DESDOBRAMENTO_LER', 'CORTE_GERENCIAR'] },
      { href: '/cadastros/modelos-etiqueta', label: 'Modelos de Etiqueta', iconKey: 'Sticker', permissoes: ['ETIQUETA_GERENCIAR'] },
    ],
  },
  {
    title: 'ADMINISTRAÇÃO',
    permissoesGrupo: ['USUARIOS_GERENCIAR', 'PERFIS_GERENCIAR', 'PARAMETROS_GERENCIAR', 'AUDITORIA_VISUALIZAR'],
    items: [
      { href: '/admin/usuarios', label: 'Usuários', iconKey: 'Users', permissoes: ['USUARIOS_LER', 'USUARIOS_GERENCIAR'] },
      { href: '/admin/perfis', label: 'Perfis de Acesso', iconKey: 'Shield', permissoes: ['PERFIS_GERENCIAR'] },
      { href: '/admin/parametros', label: 'Parâmetros', iconKey: 'Settings', permissoes: ['PARAMETROS_GERENCIAR'] },
      { href: '/admin/auditoria', label: 'Auditoria', iconKey: 'ScrollText', permissoes: ['AUDITORIA_VISUALIZAR'] },
    ],
  },
];

export interface MenuGrupoVisivel {
  title: string;
  items: Omit<MenuItemDef, 'permissoes'>[];
}

export function filtrarMenuPorPermissoes(permissoes: string[]): MenuGrupoVisivel[] {
  const concedidas = new Set(permissoes);
  return MENU_V2.filter((group) => group.permissoesGrupo.some((p) => concedidas.has(p)))
    .map((group) => ({
      title: group.title,
      items: group.items
        .filter((item) => item.permissoes.some((p) => concedidas.has(p)))
        .map(({ permissoes: _p, ...rest }) => rest),
    }))
    .filter((group) => group.items.length > 0);
}

/** Destino do protótipo/matriz linha 2 — usado quando visível para o usuário (decisão 26). */
export const ROTA_PREFERENCIAL_ENTRADA = '/gestao/dashboard';

/**
 * Rota de entrada do usuário: a preferencial quando visível, senão a primeira rota do
 * grupo de trabalho — o grupo com mais itens visíveis, empate pela ordem canônica —,
 * senão `null` (nenhum módulo liberado). O grupo de trabalho evita entrar por um grupo
 * que o perfil só enxerga para consulta de um item (decisões 26 e 30).
 * Nunca devolve rota fora do menu do próprio usuário (RA-05).
 */
export function rotaDeEntrada(permissoes: string[]): string | null {
  const grupos = filtrarMenuPorPermissoes(permissoes);
  const temPreferencial = grupos.some((grupo) =>
    grupo.items.some((item) => item.href === ROTA_PREFERENCIAL_ENTRADA),
  );
  if (temPreferencial) return ROTA_PREFERENCIAL_ENTRADA;

  const grupoDeTrabalho = grupos.reduce<MenuGrupoVisivel | null>(
    (maior, grupo) => (maior && maior.items.length >= grupo.items.length ? maior : grupo),
    null,
  );
  return grupoDeTrabalho?.items[0]?.href ?? null;
}
