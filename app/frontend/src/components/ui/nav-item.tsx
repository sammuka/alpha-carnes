'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface NavItemProps {
  href: string;
  label: string;
  Icon: LucideIcon;
}

export function NavItem({ href, label, Icon }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex h-[34px] w-full items-center gap-3 rounded-lg px-2.5 text-[13px] font-medium transition-colors',
        isActive
          ? 'bg-sidebar-item-active text-white'
          : 'text-sidebar-text hover:bg-sidebar-item-hover hover:text-white',
      )}
    >
      <Icon size={18} strokeWidth={1.5} className="shrink-0" />
      <span className="flex-1 truncate">{label}</span>
    </Link>
  );
}
