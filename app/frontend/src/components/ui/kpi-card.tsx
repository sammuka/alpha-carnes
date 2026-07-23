import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

type KpiCardVariant = 'primary' | 'violet' | 'success' | 'warning' | 'muted';

const ICON_BG: Record<KpiCardVariant, string> = {
  primary: 'var(--color-status-recebido-bg)',
  violet: 'var(--color-status-pesado-bg)',
  success: 'var(--color-status-expedido-bg)',
  warning: 'var(--color-status-divergencia-bg)',
  muted: 'var(--color-muted)',
};

const ICON_COLOR: Record<KpiCardVariant, string> = {
  primary: 'var(--color-status-recebido)',
  violet: 'var(--color-status-pesado)',
  success: 'var(--color-status-expedido)',
  warning: 'var(--color-status-divergencia)',
  muted: 'var(--color-text-secondary)',
};

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  trend?: string;
  trendPositive?: boolean;
  variant?: KpiCardVariant;
  Icon: LucideIcon;
  className?: string;
}

export function KpiCard({
  label,
  value,
  sub,
  trend,
  trendPositive,
  variant = 'primary',
  Icon,
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border border-border bg-card p-6',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: ICON_BG[variant] }}
        >
          <Icon size={22} strokeWidth={1.75} style={{ color: ICON_COLOR[variant] }} />
        </div>
      </div>
      <p className="mt-6 text-[28px] font-medium leading-tight text-foreground">{value}</p>
      {trend && (
        <p className="mt-2 text-xs">
          <span
            className="font-semibold"
            style={{ color: trendPositive === false ? 'var(--color-status-bloqueado)' : 'var(--color-status-expedido)' }}
          >
            {trend}
          </span>
          {sub && <span className="text-muted-foreground"> {sub}</span>}
        </p>
      )}
      {!trend && sub && <p className="mt-2 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
