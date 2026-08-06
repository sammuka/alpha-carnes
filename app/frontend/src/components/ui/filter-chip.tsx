'use client';

import { cn } from '@/lib/cn';

interface FilterChipProps extends React.ComponentProps<'button'> {
  active?: boolean;
}

export function FilterChip({ active, className, children, ...props }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium transition-colors duration-100 outline-none',
        'focus-visible:ring-[3px] focus-visible:ring-ring/35',
        active
          ? 'border-primary-soft-border bg-primary-soft font-semibold text-primary-fg'
          : 'border-border-strong bg-card text-foreground hover:border-fg-faint hover:bg-surface-2',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
