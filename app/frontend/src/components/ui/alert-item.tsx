import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { StatusPillVariant } from './status-pill';

interface AlertItemProps {
  title: string;
  description: string;
  time: string;
  variant?: StatusPillVariant;
  Icon?: LucideIcon;
  className?: string;
}

const DOT_COLOR: Record<StatusPillVariant, string> = {
  recebido: 'bg-status-recebido-dot',
  pesado: 'bg-status-pesado-dot',
  expedido: 'bg-status-expedido-dot',
  divergencia: 'bg-status-divergencia-dot',
  bloqueado: 'bg-status-bloqueado-dot',
  pendente: 'bg-status-pendente-dot',
};

// Icon deixa de ser renderizado (dot colorido assume a semântica); mantido na
// assinatura para não quebrar call-sites até a migração das telas que o usam.
export function AlertItem({
  title,
  description,
  time,
  variant = 'pendente',
  Icon: _Icon,
  className,
}: AlertItemProps) {
  return (
    <div className={cn('flex gap-2 border-b border-border px-3 py-2 last:border-b-0', className)}>
      <span
        aria-hidden="true"
        className={cn('mt-[5px] size-[7px] shrink-0 rounded-full', DOT_COLOR[variant])}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="text-xs font-semibold text-foreground">{title}</p>
          <time className="ml-auto font-data text-[10px] text-fg-faint">{time}</time>
        </div>
        <p className="text-[11px] leading-[1.4] text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
