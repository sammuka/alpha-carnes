import { MENU_V2 } from './menu-v2';

export interface BreadcrumbV2 {
  group: string;
  item: string;
}

/** Converte título do menu (UPPERCASE) para breadcrumb title case do protótipo. */
export function formatMenuGroupTitle(title: string): string {
  return title
    .split(/\s*&\s*/)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' & ');
}

/** Única divergência menu×breadcrumb — protótipo Layout.tsx getBreadcrumb. */
const BREADCRUMB_ITEM_OVERRIDES: Record<string, string> = {
  '/cadastros/fornecedores': 'Fornecedores',
};

/** Mapa href → breadcrumb "Grupo / Item" conforme menu canônico v2. */
export const BREADCRUMB_MAP: Record<string, BreadcrumbV2> = Object.fromEntries(
  MENU_V2.flatMap((group) =>
    group.items.map((item) => [
      item.href,
      {
        group: group.title,
        item: BREADCRUMB_ITEM_OVERRIDES[item.href] ?? item.label,
      },
    ]),
  ),
);

export function resolveBreadcrumb(pathname: string): BreadcrumbV2 | null {
  if (BREADCRUMB_MAP[pathname]) {
    return BREADCRUMB_MAP[pathname];
  }

  const match = Object.entries(BREADCRUMB_MAP)
    .filter(([href]) => pathname === href || pathname.startsWith(`${href}/`))
    .sort(([a], [b]) => b.length - a.length)[0];

  return match ? match[1] : null;
}
