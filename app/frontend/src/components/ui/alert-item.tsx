import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { StatusPill, type StatusPillVariant } from './status-pill';

interface AlertItemProps {
  title: string;
  description: string;
  time: string;
  variant?: StatusPillVariant;
  Icon?: LucideIcon;
  className?: string;
}

const ICON_BG: Record<StatusPillVariant, string> = {
  recebido: 'var(--color-status-recebido-bg)',
  pesado: 'var(--color-status-pesado-bg)',
  expedido: 'var(--color-status-expedido-bg)',
  divergencia: 'var(--color-status-divergencia-bg)',
  bloqueado: 'var(--color-status-bloqueado-bg)',
  pendente: 'var(--color-status-pendente-bg)',
};

const ICON_COLOR: Record<StatusPillVariant, string> = {
  recebido: 'var(--color-status-recebido)',
  pesado: 'var(--color-status-pesado)',
  expedido: 'var(--color-status-expedido)',
  divergencia: 'var(--color-status-divergencia)',
  bloqueado: 'var(--color-status-bloqueado)',
  pendente: 'var(--color-status-pendente)',
};

export function AlertItem({
  title,
  description,
  time,
  variant = 'pendente',
  Icon,
  className,
}: AlertItemProps) {
  return (
    <div className={cn('flex gap-3 py-3', className)}>
      {Icon && (
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: ICON_BG[variant] }}
        >
          <Icon size={20} strokeWidth={1.75} style={{ color: ICON_COLOR[variant] }} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <span className="shrink-0 text-xs text-muted-foreground">{time}</span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        <div className="mt-2">
          <StatusPill variant={variant} />
        </div>
      </div>
    </div>
  );
}
