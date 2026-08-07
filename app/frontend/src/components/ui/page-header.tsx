import * as React from 'react';
import { cn } from '@/lib/cn';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Exibe o indicador verde pulsante "tempo real". */
  live?: boolean;
  className?: string;
  /** Ações à direita (botões, selects, badges de dispositivo). */
  children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, live, className, children }: PageHeaderProps) {
  return (
    <div className={cn('mb-3 flex flex-wrap items-center gap-x-3 gap-y-2', className)}>
      <h1 className="text-lg font-bold tracking-[-0.015em] text-foreground">{title}</h1>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      {live && (
        <span className="inline-flex items-center gap-[5px] text-[11px] font-semibold text-success-fg">
          <span
            aria-hidden="true"
            className="size-1.5 animate-pulse rounded-full bg-success"
          />
          tempo real
        </span>
      )}
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}
