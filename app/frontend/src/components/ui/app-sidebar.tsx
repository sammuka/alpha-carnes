'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
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
  LogOut,
  Boxes,
  PackageSearch,
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
  Boxes,
  PackageSearch,
};

const LARGURA_PADRAO = 232;
const LARGURA_MIN = 200;
const LARGURA_MAX = 320;
const CHAVE_LARGURA = 'sidebar-width';

export function AppSidebar({ user, sections }: AppSidebarProps) {
  const [largura, setLargura] = useState(LARGURA_PADRAO);
  const [redimensionando, setRedimensionando] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const salva = Number(window.localStorage.getItem(CHAVE_LARGURA));
    if (salva && salva >= LARGURA_MIN && salva <= LARGURA_MAX) setLargura(salva);
  }, []);

  useEffect(() => {
    if (!menuAberto) return;
    const fecharSeFora = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAberto(false);
    };
    document.addEventListener('mousedown', fecharSeFora);
    return () => document.removeEventListener('mousedown', fecharSeFora);
  }, [menuAberto]);

  useEffect(() => {
    if (!redimensionando) return;
    const mover = (e: MouseEvent) => {
      const nova = Math.min(LARGURA_MAX, Math.max(LARGURA_MIN, e.clientX));
      setLargura(nova);
    };
    const soltar = () => {
      setRedimensionando(false);
      setLargura((atual) => {
        window.localStorage.setItem(CHAVE_LARGURA, String(atual));
        return atual;
      });
    };
    document.addEventListener('mousemove', mover);
    document.addEventListener('mouseup', soltar);
    return () => {
      document.removeEventListener('mousemove', mover);
      document.removeEventListener('mouseup', soltar);
    };
  }, [redimensionando]);

  const sair = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/login';
  }, []);

  return (
    <aside
      aria-label="Navegação principal"
      style={{ width: largura }}
      className="relative sticky top-0 flex h-screen shrink-0 flex-col overflow-y-auto bg-gradient-to-br from-sidebar-gradient-start to-sidebar-gradient-end"
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionar navegação"
        onMouseDown={() => setRedimensionando(true)}
        className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-white/20"
      />

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

      <div ref={menuRef} className="relative border-t border-sidebar-border px-2 py-2.5">
        {menuAberto && (
          <div className="absolute bottom-full left-2 right-2 mb-1 overflow-hidden rounded-lg border border-sidebar-border bg-sidebar-popover shadow-xl">
            <div className="px-3 py-2">
              <p className="truncate text-xs font-semibold leading-tight text-white">{user.nome}</p>
              <p className="mt-0.5 truncate text-[10px] leading-tight text-sidebar-text-muted">{user.perfil}</p>
            </div>
            <button
              type="button"
              onClick={() => void sair()}
              className="flex w-full items-center gap-2 border-t border-sidebar-border px-3 py-2 text-left text-xs text-white/85 transition-colors hover:bg-white/8 hover:text-white"
            >
              <LogOut size={14} strokeWidth={1.75} />
              Sair
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setMenuAberto((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuAberto}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/8"
        >
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
          <ChevronDown
            size={14}
            className={`shrink-0 text-sidebar-text-muted transition-transform ${menuAberto ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
    </aside>
  );
}
