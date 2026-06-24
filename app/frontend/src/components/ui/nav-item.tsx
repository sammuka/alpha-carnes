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
        'flex h-[34px] items-center gap-2.5 rounded-md px-3 text-[13px] font-medium transition-colors',
        isActive
          ? 'bg-white/16 text-white'
          : 'text-white/90 hover:bg-white/10 hover:text-white',
      )}
    >
      <Icon size={18} strokeWidth={1.75} className="shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
