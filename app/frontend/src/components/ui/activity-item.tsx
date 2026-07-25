import { cn } from '@/lib/cn';

const AVATAR_PALETTE = [
  { bg: 'var(--color-avatar-blue-bg)', text: 'var(--color-status-recebido)' },
  { bg: 'var(--color-avatar-violet-bg)', text: 'var(--color-status-pesado)' },
  { bg: 'var(--color-avatar-green-bg)', text: 'var(--color-status-expedido)' },
  { bg: 'var(--color-avatar-amber-bg)', text: 'var(--color-status-divergencia)' },
] as const;

function avatarColors(initials: string): { bg: string; text: string } {
  const index = initials.charCodeAt(0) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index] ?? AVATAR_PALETTE[0];
}

interface ActivityItemProps {
  userName: string;
  initials: string;
  activity: string;
  time: string;
  className?: string;
}

export function ActivityItem({
  userName,
  initials,
  activity,
  time,
  className,
}: ActivityItemProps) {
  const colors = avatarColors(initials);

  return (
    <div className={cn('flex gap-3 py-3', className)}>
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
        style={{ backgroundColor: colors.bg, color: colors.text }}
        aria-hidden="true"
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{userName}</p>
          <span className="shrink-0 text-xs text-muted-foreground">{time}</span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{activity}</p>
      </div>
    </div>
  );
}
