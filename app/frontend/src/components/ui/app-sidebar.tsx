'use client';

import {
  LayoutDashboard,
  Users,
  Truck,
  ShoppingCart,
  Package,
  PackageCheck,
  Scale,
  Scissors,
  FileText,
  Shield,
  BarChart3,
  ClipboardList,
  Tags,
  FileSpreadsheet,
  CheckCircle,
  PieChart,
  Tag,
  Warehouse,
  PackagePlus,
  SlidersHorizontal,
  ClipboardCheck,
  Send,
  FileCode,
  ShieldCheck,
  DoorOpen,
  UserCircle,
  Building2,
  Contact,
  Map,
  GitBranch,
  Sticker,
  Settings,
  ScrollText,
  AlertTriangle,
  CalendarRange,
  type LucideIcon,
} from 'lucide-react';
import { AlphaLogo } from './alpha-logo';
import { NavGroup } from './nav-group';

interface NavEntry {
  href: string;
  label: string;
  iconKey: string;
}

interface SidebarSection {
  title: string;
  items: NavEntry[];
}

export interface SidebarUser {
  nome: string;
  perfil: string;
  inicial: string;
  escopoRepresentantes?: {
    tipo: 'todos' | 'restrito';
    representantes: Array<{ id: string; nome: string }>;
  };
}

interface AppSidebarProps {
  user: SidebarUser;
  sections: SidebarSection[];
}

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  Truck,
  ShoppingCart,
  Package,
  PackageCheck,
  Scale,
  Scissors,
  FileText,
  Shield,
  BarChart3,
  ClipboardList,
  Tags,
  FileSpreadsheet,
  CheckCircle,
  PieChart,
  Tag,
  Warehouse,
  PackagePlus,
  SlidersHorizontal,
  ClipboardCheck,
  Send,
  FileCode,
  ShieldCheck,
  DoorOpen,
  UserCircle,
  Building2,
  Contact,
  Map,
  GitBranch,
  Sticker,
  Settings,
  ScrollText,
  AlertTriangle,
  CalendarRange,
};

export function AppSidebar({ user, sections }: AppSidebarProps) {
  return (
    <aside
      aria-label="Navegação principal"
      className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col overflow-y-auto bg-gradient-to-b from-sidebar-gradient-start to-sidebar-gradient-end"
    >
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-3.5">
        <AlphaLogo className="h-[30px] w-[30px] shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight text-white">AlphaCarnes</p>
          <p className="mt-0.5 text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-sidebar-text-muted">
            Distribuição de Carnes
          </p>
        </div>
      </div>

      <nav className="flex w-full flex-1 flex-col overflow-y-auto px-2 pb-4">
        {sections.length === 0 ? (
          <p className="px-2 text-xs leading-relaxed text-sidebar-text-muted">
            Nenhum módulo liberado para o seu perfil. Solicite acesso ao administrador.
          </p>
        ) : (
          sections.map((section) => (
            <NavGroup
              key={section.title}
              title={section.title}
              defaultOpen={sections.length <= 3}
              items={section.items.map((item) => ({
                href: item.href,
                label: item.label,
                Icon: ICON_MAP[item.iconKey] ?? LayoutDashboard,
              }))}
            />
          ))
        )}
      </nav>

      <div className="border-t border-sidebar-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div
            className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-white/18 text-[11px] font-bold text-white"
            aria-hidden="true"
          >
            {user.inicial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold leading-tight text-white">{user.nome}</p>
            <p className="mt-0.5 truncate text-[10px] leading-tight text-sidebar-text-muted">
              {user.perfil}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
