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
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'text-white'
          : 'hover:text-white',
      )}
      style={
        isActive
          ? {
              background: 'var(--color-sidebar-active-bg)',
              color: 'var(--color-sidebar-item-active)',
            }
          : { color: 'var(--color-sidebar-text)' }
      }
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLAnchorElement).style.background =
            'var(--color-sidebar-item-hover)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLAnchorElement).style.background = '';
        }
      }}
    >
      <Icon size={16} strokeWidth={1.75} className="shrink-0" />
      <span>{label}</span>
    </Link>
  );
}
