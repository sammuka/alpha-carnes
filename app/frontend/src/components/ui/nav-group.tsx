'use client';

import { useEffect, useState } from 'react';
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
  const pathname = usePathname();
  const hasActive = items.some(
    (item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)),
  );
  const [open, setOpen] = useState(defaultOpen || hasActive);

  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/55 transition-colors hover:text-white"
        aria-expanded={open}
      >
        <span>{title}</span>
        <ChevronDown
          size={14}
          className={cn('shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {items.map((item) => (
            <NavItem key={item.href} href={item.href} label={item.label} Icon={item.Icon} />
          ))}
        </div>
      )}
    </div>
  );
}
