import { cn } from '@/lib/cn';

interface BadgeCountProps {
  children: React.ReactNode;
  className?: string;
}

export function BadgeCount({ children, className }: BadgeCountProps) {
  return (
    <span
      className={cn(
        'inline-flex h-[18px] items-center rounded-full bg-surface-3 px-1.5 font-data text-[10px] font-bold text-fg-secondary',
        className,
      )}
    >
      {children}
    </span>
  );
}
