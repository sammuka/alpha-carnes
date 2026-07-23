/**
 * Menu canônico v2 — estrutura de navegação e mapeamento RBAC.
 * Cada item exige ao menos uma permissão listada (OR).
 */

export interface MenuItemDef {
  href: string;
  label: string;
  iconKey: string;
  permissoes: string[];
}

export interface MenuGroupDef {
  title: string;
  items: MenuItemDef[];
}

export const MENU_V2: MenuGroupDef[] = [
  {
    title: 'COMERCIAL',
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
    items: [
      { href: '/gestao/dashboard', label: 'Dashboard Operacional', iconKey: 'LayoutDashboard', permissoes: ['COMPRAS_PROGRAMADAS_LER', 'DISPONIBILIDADE_LER', 'PEDIDOS_LER'] },
      { href: '/gestao/compras', label: 'Compras', iconKey: 'ShoppingCart', permissoes: ['COMPRAS_PROGRAMADAS_LER', 'COMPRAS_PROGRAMADAS_GERENCIAR'] },
      { href: '/gestao/aprovacoes', label: 'Aprovações', iconKey: 'CheckCircle', permissoes: ['DIVERGENCIA_RECEBIMENTO_GERENCIAR', 'EXPEDICAO_REABRIR'] },
      { href: '/gestao/relatorios', label: 'Relatórios de Gestão', iconKey: 'PieChart', permissoes: ['DISPONIBILIDADE_LER'] },
    ],
  },
  {
    title: 'RECEBIMENTO & BALANÇA',
    items: [
      { href: '/recebimento/recebimento-carga', label: 'Recebimento de Carga', iconKey: 'PackageCheck', permissoes: ['RECEBIMENTO_LER', 'RECEBIMENTO_GERENCIAR'] },
      { href: '/recebimento/pesagem-destinacao', label: 'Pesagem e Destinação', iconKey: 'Scale', permissoes: ['PESAGEM_LER', 'PESAGEM_GERENCIAR'] },
      { href: '/recebimento/etiquetas', label: 'Etiquetas', iconKey: 'Tag', permissoes: ['ETIQUETA_GERENCIAR', 'PESAGEM_LER'] },
    ],
  },
  {
    title: 'DESOSSA',
    items: [
      { href: '/desossa/dashboard', label: 'Dashboard da Desossa', iconKey: 'LayoutDashboard', permissoes: ['DESOSSA_LER', 'CORTE_GERENCIAR', 'DISPONIBILIDADE_LER'] },
      { href: '/desossa/pesagem-destinacao', label: 'Pesagem e Destinação', iconKey: 'Scissors', permissoes: ['CORTE_GERENCIAR'] },
      { href: '/desossa/etiquetas', label: 'Etiquetas', iconKey: 'Tag', permissoes: ['ETIQUETA_GERENCIAR', 'CORTE_GERENCIAR'] },
    ],
  },
  {
    title: 'ESTOQUE',
    items: [
      { href: '/estoque/consulta', label: 'Consulta de Estoque', iconKey: 'Warehouse', permissoes: ['ESTOQUE_LER', 'PESAGEM_LER', 'CORTE_GERENCIAR'] },
      { href: '/estoque/entrada-itens', label: 'Entrada de Itens', iconKey: 'PackagePlus', permissoes: ['PESAGEM_GERENCIAR'] },
      { href: '/estoque/ajustes', label: 'Ajustes', iconKey: 'SlidersHorizontal', permissoes: ['PARAMETROS_GERENCIAR'] },
    ],
  },
  {
    title: 'CARGA',
    items: [
      { href: '/carga/planejamento', label: 'Planejamento de Carga', iconKey: 'Truck', permissoes: ['EXPEDICAO_GERENCIAR'] },
      { href: '/carga/conferencia', label: 'Conferência', iconKey: 'ClipboardCheck', permissoes: ['EXPEDICAO_GERENCIAR'] },
      { href: '/carga/enviar-faturamento', label: 'Enviar para Faturamento', iconKey: 'Send', permissoes: ['EXPEDICAO_GERENCIAR', 'FATURAMENTO_GERENCIAR'] },
    ],
  },
  {
    title: 'FATURAMENTO',
    items: [
      { href: '/faturamento/pre-faturamento', label: 'Pré-Faturamento', iconKey: 'FileText', permissoes: ['FATURAMENTO_LER', 'FATURAMENTO_GERENCIAR'] },
      { href: '/faturamento/notas-xml', label: 'Notas / XML', iconKey: 'FileCode', permissoes: ['NFSE_EMITIR', 'FATURAMENTO_LER'] },
      { href: '/faturamento/seguro-manual', label: 'Seguro Manual', iconKey: 'ShieldCheck', permissoes: ['FATURAMENTO_GERENCIAR'] },
      { href: '/faturamento/liberacao', label: 'Liberação do Caminhão', iconKey: 'DoorOpen', permissoes: ['FATURAMENTO_GERENCIAR', 'EXPEDICAO_GERENCIAR'] },
    ],
  },
  {
    title: 'CADASTROS & REGRAS',
    items: [
      { href: '/cadastros/representantes', label: 'Representantes', iconKey: 'UserCircle', permissoes: ['CLIENTES_GERENCIAR'] },
      { href: '/cadastros/produtos', label: 'Produtos', iconKey: 'Package', permissoes: ['PRODUTOS_LER'] },
      { href: '/cadastros/fornecedores', label: 'Fornecedores / Frigoríficos', iconKey: 'Building2', permissoes: ['FORNECEDORES_LER'] },
      { href: '/cadastros/caminhoes', label: 'Caminhões', iconKey: 'Truck', permissoes: ['EXPEDICAO_GERENCIAR'] },
      { href: '/cadastros/motoristas', label: 'Motoristas', iconKey: 'Contact', permissoes: ['EXPEDICAO_GERENCIAR'] },
      { href: '/cadastros/rotas', label: 'Rotas / Itinerários', iconKey: 'Map', permissoes: ['EXPEDICAO_GERENCIAR', 'CLIENTES_LER'] },
      { href: '/cadastros/regras-transformacao', label: 'Regras de Transformação', iconKey: 'GitBranch', permissoes: ['REGRAS_DESDOBRAMENTO_LER', 'CORTE_GERENCIAR'] },
      { href: '/cadastros/modelos-etiqueta', label: 'Modelos de Etiqueta', iconKey: 'Sticker', permissoes: ['ETIQUETA_GERENCIAR'] },
    ],
  },
  {
    title: 'ADMINISTRAÇÃO',
    items: [
      { href: '/admin/usuarios', label: 'Usuários', iconKey: 'Users', permissoes: ['USUARIOS_LER', 'USUARIOS_GERENCIAR'] },
      { href: '/admin/perfis', label: 'Perfis de Acesso', iconKey: 'Shield', permissoes: ['PERFIS_GERENCIAR'] },
      { href: '/admin/parametros', label: 'Parâmetros', iconKey: 'Settings', permissoes: ['PARAMETROS_LER', 'PARAMETROS_GERENCIAR'] },
      { href: '/admin/auditoria', label: 'Auditoria', iconKey: 'ScrollText', permissoes: ['AUDITORIA_VISUALIZAR'] },
    ],
  },
];

export function filtrarMenuPorPermissoes(
  permissoes: string[],
): { title: string; items: Omit<MenuItemDef, 'permissoes'>[] }[] {
  return MENU_V2.map((group) => ({
    title: group.title,
    items: group.items
      .filter((item) => item.permissoes.some((p) => permissoes.includes(p)))
      .map(({ permissoes: _p, ...rest }) => rest),
  })).filter((g) => g.items.length > 0);
}
