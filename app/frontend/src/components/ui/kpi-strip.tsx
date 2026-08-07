import * as React from 'react';
import { cn } from '@/lib/cn';

const TONE_VALUE_CLASS = {
  default: 'text-foreground',
  ok: 'text-success-fg',
  alert: 'text-warning-fg',
  danger: 'text-danger-fg',
} as const;

export type KpiTone = keyof typeof TONE_VALUE_CLASS;

interface KpiProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: KpiTone;
}

export function Kpi({ label, value, hint, tone = 'default' }: KpiProps) {
  return (
    <div className="min-w-0 border-l border-border px-3 pt-2 pb-[7px] first:border-l-0">
      <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          'font-data text-xl font-bold leading-[1.2] tracking-[-0.02em]',
          TONE_VALUE_CLASS[tone],
        )}
      >
        {value}
      </p>
      {hint && <p className="truncate text-[10px] text-fg-faint">{hint}</p>}
    </div>
  );
}

interface KpiStripProps {
  children: React.ReactNode;
  className?: string;
}

export function KpiStrip({ children, className }: KpiStripProps) {
  return (
    <div
      className={cn(
        'grid auto-cols-fr grid-flow-col overflow-hidden rounded-lg border border-border bg-card',
        className,
      )}
    >
      {children}
    </div>
  );
}
