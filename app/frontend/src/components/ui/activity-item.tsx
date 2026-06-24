import { cn } from '@/lib/cn';

const AVATAR_PALETTE = [
  { bg: 'rgba(59, 127, 212, 0.14)', text: '#3B7FD4' },
  { bg: 'rgba(124, 58, 237, 0.14)', text: '#7C3AED' },
  { bg: 'rgba(24, 168, 74, 0.14)', text: '#18A84A' },
  { bg: 'rgba(245, 176, 25, 0.14)', text: '#F5B019' },
];

function avatarColors(initials: string): { bg: string; text: string } {
  const index = initials.charCodeAt(0) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index] ?? { bg: 'rgba(59, 127, 212, 0.14)', text: '#3B7FD4' };
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
