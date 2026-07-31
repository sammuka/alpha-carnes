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
      className="flex w-64 shrink-0 flex-col bg-gradient-to-b from-sidebar-gradient-start to-sidebar-gradient-end px-4 pb-6 pt-5"
    >
      <div className="mb-4 flex h-12 w-full items-center gap-3 px-1">
        <AlphaLogo className="h-9 w-9 shrink-0" />
        <div className="min-w-0">
          <p className="text-[16px] font-bold leading-tight text-white">AlphaCarnes</p>
          <p className="mt-0.5 text-[9px] font-bold uppercase leading-none tracking-widest text-sidebar-text-muted">
            Distribuição de Carnes
          </p>
        </div>
      </div>

      <nav className="flex w-full flex-1 flex-col gap-4 overflow-y-auto pr-0.5">
        {sections.length === 0 ? (
          <p className="px-1 text-[12px] leading-relaxed text-sidebar-text-muted">
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

      <div className="mt-4 border-t border-sidebar-border pt-3">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-blue-mid text-[10px] font-bold text-white"
            aria-hidden="true"
          >
            {user.inicial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold leading-tight text-white">{user.nome}</p>
            <p className="mt-0.5 truncate text-[10px] leading-tight text-sidebar-text-muted">
              {user.perfil}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
