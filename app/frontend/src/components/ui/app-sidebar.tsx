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
  escopo: string;
  inicial: string;
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
};

export function AppSidebar({ user, sections }: AppSidebarProps) {
  return (
    <aside className="flex w-64 shrink-0 flex-col bg-gradient-to-b from-sidebar-gradient-start to-sidebar-gradient-end">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-5">
        <AlphaLogo className="h-9 w-9 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight tracking-wide text-white">AlphaCarnes</p>
          <p className="text-[9px] font-semibold uppercase leading-tight tracking-[0.18em] text-white/55">
            Distribuição de Carnes
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
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
        ))}
      </nav>

      <div className="border-t border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white"
            aria-hidden="true"
          >
            {user.inicial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight text-white">{user.nome}</p>
            <p className="truncate text-[11px] leading-tight text-white/55">
              {user.perfil}
              {user.escopo ? ` · ${user.escopo}` : ''}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
