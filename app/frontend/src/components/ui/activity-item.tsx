import { cn } from '@/lib/cn';

interface ActivityItemProps {
  userName: string;
  initials: string;
  activity: string;
  time: string;
  className?: string;
}

// `initials` sai da render — sem avatar circular no v3 — mas permanece na
// assinatura para não quebrar os call-sites até a migração das telas.
export function ActivityItem({
  userName,
  initials: _initials,
  activity,
  time,
  className,
}: ActivityItemProps) {
  return (
    <div className={cn('flex gap-2 border-b border-border px-3 py-2 last:border-b-0', className)}>
      <span aria-hidden="true" className="mt-[5px] size-[7px] shrink-0 rounded-full bg-status-pendente-dot" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="text-xs font-semibold text-foreground">{userName}</p>
          <time className="ml-auto font-data text-[10px] text-fg-faint">{time}</time>
        </div>
        <p className="text-[11px] leading-[1.4] text-muted-foreground">{activity}</p>
      </div>
    </div>
  );
}
