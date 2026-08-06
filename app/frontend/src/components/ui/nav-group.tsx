'use client';

import { useEffect, useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { NavItem } from './nav-item';

export interface NavGroupItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

interface NavGroupProps {
  title: string;
  items: NavGroupItem[];
  defaultOpen?: boolean;
}

export function NavGroup({ title, items, defaultOpen = false }: NavGroupProps) {
  const idPainel = useId();
  const pathname = usePathname();
  const hasActive = items.some(
    (item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`)),
  );
  const [open, setOpen] = useState(defaultOpen || hasActive);

  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  // item de 30px + 2px de gap, conforme Layout.tsx do protótipo
  const alturaItens = items.length * 32 + 4;

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group/hdr mb-1 mt-2.5 flex w-full items-center justify-between rounded-[5px] px-2.5 py-[5px] text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-text-dim transition-colors hover:text-white"
        aria-expanded={open}
        aria-controls={idPainel}
      >
        <span>{title}</span>
        <ChevronDown
          size={12}
          className={cn('shrink-0 transition-transform duration-200', !open && '-rotate-90')}
          aria-hidden="true"
        />
      </button>
      <div
        id={idPainel}
        data-state={open ? 'aberto' : 'fechado'}
        className="overflow-hidden transition-[max-height] duration-[220ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ maxHeight: open ? `${alturaItens}px` : '0px' }}
      >
        <div className="flex w-full flex-col gap-[2px] pb-0.5">
          {items.map((item) => (
            <NavItem key={item.href} href={item.href} label={item.label} Icon={item.Icon} />
          ))}
        </div>
      </div>
    </div>
  );
}
