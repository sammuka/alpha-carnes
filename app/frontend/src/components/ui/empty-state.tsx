import * as React from 'react';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'grid place-items-center gap-1.5 rounded-lg border border-dashed border-border-strong px-4 py-7 text-center',
        className,
      )}
    >
      {icon && <span className="text-fg-faint [&_svg]:size-6" aria-hidden="true">{icon}</span>}
      <p className="text-[13px] font-semibold text-fg-secondary">{title}</p>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  );
}
