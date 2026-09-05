/**
 * Menu canônico v2 — estrutura de navegação do protótipo (Layout.tsx → ALL_NAV_GROUPS).
 * A visibilidade vem de `perfis.menus_visiveis` (decisão 4 da Onda 3), semeada da matriz de
 * rastreabilidade: o menu mostra exatamente o que a matriz atribui ao perfil, nem mais nem menos.
 * Permissão de API é assunto do backend (RbacGuard) e não filtra menu.
 */

export interface MenuItemDef {
  href: string;
  label: string;
  iconKey: string;
}

export interface MenuGroupDef {
  title: string;
  items: MenuItemDef[];
}

export const MENU_V2: MenuGroupDef[] = [
  {
    title: 'COMERCIAL',
    items: [
      { href: '/comercial/clientes', label: 'Clientes', iconKey: 'Users' },
      { href: '/comercial/pedidos', label: 'Pedidos de Venda', iconKey: 'ClipboardList' },
      { href: '/comercial/tabela-precos', label: 'Tabela de Preços', iconKey: 'Tags' },
      { href: '/comercial/disponibilidade', label: 'Disponibilidade', iconKey: 'BarChart3' },
      { href: '/comercial/espelho', label: 'Espelho Comercial', iconKey: 'FileSpreadsheet' },
    ],
  },
  {
    title: 'GESTÃO',
    items: [
      { href: '/gestao/dashboard', label: 'Painel Geral da Operação', iconKey: 'LayoutDashboard' },
      { href: '/gestao/operacoes', label: 'Operações', iconKey: 'CalendarRange' },
      { href: '/gestao/compras', label: 'Compras', iconKey: 'ShoppingCart' },
      { href: '/gestao/overbooking', label: 'Pendências de Overbooking', iconKey: 'AlertTriangle' },
      { href: '/gestao/aprovacoes', label: 'Aprovações & Ocorrências', iconKey: 'CheckCircle' },
      { href: '/gestao/relatorios', label: 'Relatórios & SIF', iconKey: 'PieChart' },
    ],
  },
  {
    title: 'RECEBIMENTO & BALANÇA',
    items: [
      { href: '/recebimento/recebimento-carga', label: 'Recebimento de Carga', iconKey: 'PackageCheck' },
      { href: '/recebimento/pesagem-destinacao', label: 'Pesagem e Destinação', iconKey: 'Scale' },
      { href: '/recebimento/etiquetas', label: 'Etiquetas', iconKey: 'Tag' },
    ],
  },
  {
    title: 'DESOSSA',
    items: [
      { href: '/desossa/dashboard', label: 'Dashboard da Desossa', iconKey: 'LayoutDashboard' },
      { href: '/desossa/pesagem-destinacao', label: 'Pesagem e Destinação', iconKey: 'Scissors' },
      { href: '/desossa/etiquetas', label: 'Etiquetas', iconKey: 'Tag' },
    ],
  },
  {
    title: 'ESTOQUE',
    items: [
      { href: '/estoque/consulta', label: 'Consulta de Estoque', iconKey: 'Warehouse' },
      { href: '/estoque/entrada-itens', label: 'Entrada de Itens', iconKey: 'PackagePlus' },
      { href: '/estoque/ajustes', label: 'Ajustes', iconKey: 'SlidersHorizontal' },
    ],
  },
  {
    title: 'CARGA',
    items: [
      { href: '/carga/planejamento', label: 'Planejamento de Carga', iconKey: 'Truck' },
      { href: '/carga/conferencia', label: 'Conferência', iconKey: 'ClipboardCheck' },
      { href: '/carga/enviar-faturamento', label: 'Enviar para Faturamento', iconKey: 'Send' },
    ],
  },
  {
    title: 'FATURAMENTO',
    items: [
      { href: '/faturamento/pre-faturamento', label: 'Pré-Faturamento', iconKey: 'FileText' },
      { href: '/faturamento/notas-xml', label: 'Notas / XML', iconKey: 'FileCode' },
      { href: '/faturamento/seguro-manual', label: 'Seguro Manual', iconKey: 'ShieldCheck' },
      { href: '/faturamento/liberacao', label: 'Liberação do Caminhão', iconKey: 'DoorOpen' },
    ],
  },
  {
    title: 'CADASTROS & REGRAS',
    items: [
      { href: '/cadastros/representantes', label: 'Representantes', iconKey: 'UserCircle' },
      { href: '/cadastros/produtos', label: 'Produtos', iconKey: 'Package' },
      { href: '/cadastros/fornecedores', label: 'Fornecedores / Frigoríficos', iconKey: 'Building2' },
      { href: '/cadastros/caminhoes', label: 'Caminhões', iconKey: 'Truck' },
      { href: '/cadastros/motoristas', label: 'Motoristas', iconKey: 'Contact' },
      { href: '/cadastros/rotas', label: 'Rotas / Itinerários', iconKey: 'Map' },
      { href: '/cadastros/regras-transformacao', label: 'Regras de Transformação', iconKey: 'GitBranch' },
      { href: '/cadastros/modelos-etiqueta', label: 'Modelos de Etiqueta', iconKey: 'Sticker' },
    ],
  },
  {
    title: 'ADMINISTRAÇÃO',
    items: [
      { href: '/admin/usuarios', label: 'Usuários', iconKey: 'Users' },
      { href: '/admin/perfis', label: 'Perfis de Acesso', iconKey: 'Shield' },
      { href: '/admin/parametros', label: 'Parâmetros', iconKey: 'Settings' },
      { href: '/admin/auditoria', label: 'Auditoria', iconKey: 'ScrollText' },
    ],
  },
];

export const ROTAS_CANONICAS: string[] = MENU_V2.flatMap((grupo) =>
  grupo.items.map((item) => item.href),
);

export interface MenuGrupoVisivel {
  title: string;
  items: MenuItemDef[];
}

/**
 * Grupos e itens visíveis para a lista de menus do usuário (união dos perfis, vinda de /auth/me).
 * Grupo sem item visível não aparece; href fora do catálogo é ignorado (não inventa entrada de menu).
 */
export function filtrarMenuPorMenusVisiveis(menusVisiveis: string[]): MenuGrupoVisivel[] {
  const visiveis = new Set(menusVisiveis);
  return MENU_V2.map((grupo) => ({
    title: grupo.title,
    items: grupo.items.filter((item) => visiveis.has(item.href)),
  })).filter((grupo) => grupo.items.length > 0);
}

/**
 * Rota de entrada por perfil — função primária de cada perfil no doc 013 e na matriz (decisão 8).
 * Perfil fora desta tabela (perfil criado pelo administrador) cai no primeiro menu visível.
 */
export const ROTA_ENTRADA_POR_PERFIL: Record<string, string> = {
  administrador: '/gestao/dashboard',
  gestor: '/gestao/dashboard',
  diretoria: '/gestao/dashboard',
  compras: '/gestao/compras',
  comercial: '/comercial/clientes',
  recebimento_pesagem: '/recebimento/recebimento-carga',
  corte: '/desossa/dashboard',
  expedicao: '/carga/planejamento',
  conferente: '/carga/conferencia',
  faturamento: '/faturamento/pre-faturamento',
  logistica: '/faturamento/liberacao',
};

/**
 * Destino após o login: a rota primária do perfil quando ela está visível para o usuário;
 * senão o primeiro menu visível na ordem canônica; senão `null` (nenhum módulo liberado).
 * Nunca devolve rota fora do menu do próprio usuário (RA-05).
 */
export function rotaDeEntrada(menusVisiveis: string[], perfis: string[]): string | null {
  const visiveis = new Set(menusVisiveis);

  for (const perfil of perfis) {
    const rota = ROTA_ENTRADA_POR_PERFIL[perfil];
    if (rota && visiveis.has(rota)) return rota;
  }

  return ROTAS_CANONICAS.find((href) => visiveis.has(href)) ?? null;
}
