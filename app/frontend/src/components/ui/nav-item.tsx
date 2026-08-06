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
        'flex h-[30px] w-full items-center gap-2 rounded-[5px] px-2.5 text-[13px] font-medium transition-colors duration-100',
        isActive
          ? 'bg-sidebar-item-active font-semibold text-white'
          : 'text-sidebar-text-dim hover:bg-sidebar-item-hover hover:text-white',
      )}
    >
      <Icon size={15} strokeWidth={1.75} className="shrink-0 opacity-85" />
      <span className="flex-1 truncate">{label}</span>
    </Link>
  );
}
