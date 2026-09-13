'use client';

import { Progress } from '@/components/ui/progress';

export function ProgressoBalancaBar({
  valor,
  label,
}: {
  valor: number;
  label?: string;
}) {
  const pct = Math.min(100, Math.max(0, valor));
  return (
    <div className="flex min-w-[100px] items-center gap-2" aria-label={label ?? `${pct}%`}>
      <Progress value={pct} className="h-2 flex-1" />
      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}
