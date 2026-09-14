import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface BadgeCountProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  className?: string;
}

export function BadgeCount({ children, className, ...props }: BadgeCountProps) {
  return (
    <span
      className={cn(
        'inline-flex h-[18px] items-center rounded-full bg-surface-3 px-1.5 font-data text-[10px] font-bold text-fg-secondary',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
