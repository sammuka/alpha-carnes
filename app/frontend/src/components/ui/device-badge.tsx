import { cn } from '@/lib/cn';

interface DeviceBadgeProps {
  label: string;
  online: boolean;
  className?: string;
}

/** Status de dispositivo (balança/impressora/leitor). */
export function DeviceBadge({ label, online, className }: DeviceBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-[5px] whitespace-nowrap rounded-full border px-2 text-[11px] font-semibold',
        online
          ? 'border-success-soft-border bg-success-soft text-success-fg'
          : 'border-danger-soft-border bg-danger-soft text-danger-fg',
        className,
      )}
    >
      <span className="size-[5px] rounded-full bg-current" aria-hidden="true" />
      {label}: {online ? 'disponível' : 'offline'}
    </span>
  );
}
