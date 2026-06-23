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
  PackageOpen,
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
import { NavItem } from './nav-item';

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
  escopo?: string;
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
  PackageOpen,
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
    <aside
      className="flex w-64 shrink-0 flex-col"
      style={{
        background: 'var(--color-sidebar-bg)',
        borderRight: '1px solid var(--color-sidebar-border)',
      }}
    >
      <div
        className="flex items-center gap-3 px-4 py-5"
        style={{ borderBottom: '1px solid var(--color-sidebar-border)' }}
      >
        <AlphaLogo className="h-9 w-9 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight tracking-wide text-white">AlphaCarnes</p>
          <p
            className="text-[9px] font-semibold uppercase leading-tight tracking-[0.18em]"
            style={{ color: 'var(--color-sidebar-text-muted)' }}
          >
            Distribuição de Carnes
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.title}>
            <p
              className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--color-sidebar-text-muted)' }}
            >
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = ICON_MAP[item.iconKey] ?? LayoutDashboard;
                return (
                  <NavItem key={item.href} href={item.href} label={item.label} Icon={Icon} />
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-4 py-3" style={{ borderTop: '1px solid var(--color-sidebar-border)' }}>
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ background: 'var(--color-primary)' }}
            aria-hidden="true"
          >
            {user.inicial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight text-white">{user.nome}</p>
            <p
              className="truncate text-[11px] leading-tight"
              style={{ color: 'var(--color-sidebar-text-muted)' }}
            >
              {user.perfil}
              {user.escopo ? ` · ${user.escopo}` : ''}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
