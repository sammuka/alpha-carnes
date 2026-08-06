import { cn } from '@/lib/cn';

export type StatusPillVariant =
  | 'recebido'
  | 'pesado'
  | 'expedido'
  | 'divergencia'
  | 'bloqueado'
  | 'pendente';

const VARIANT_CLASSES: Record<StatusPillVariant, string> = {
  recebido: 'text-status-recebido bg-status-recebido-bg [--pill-dot:var(--color-status-recebido-dot)]',
  pesado: 'text-status-pesado bg-status-pesado-bg [--pill-dot:var(--color-status-pesado-dot)]',
  expedido: 'text-status-expedido bg-status-expedido-bg [--pill-dot:var(--color-status-expedido-dot)]',
  divergencia:
    'text-status-divergencia bg-status-divergencia-bg [--pill-dot:var(--color-status-divergencia-dot)]',
  bloqueado: 'text-status-bloqueado bg-status-bloqueado-bg [--pill-dot:var(--color-status-bloqueado-dot)]',
  pendente: 'text-status-pendente bg-status-pendente-bg [--pill-dot:var(--color-status-pendente-dot)]',
};

const VARIANT_LABELS: Record<StatusPillVariant, string> = {
  recebido: 'Recebido',
  pesado: 'Pesado',
  expedido: 'Expedido',
  divergencia: 'Divergência',
  bloqueado: 'Bloqueado',
  pendente: 'Pendente',
};

interface StatusPillProps {
  variant: StatusPillVariant;
  label?: string;
  className?: string;
}

export function StatusPill({ variant, label, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-[5px] whitespace-nowrap rounded-full px-2 text-[11px] font-semibold',
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      <span
        className="size-[5px] shrink-0 rounded-full bg-[var(--pill-dot)]"
        aria-hidden="true"
      />
      {label ?? VARIANT_LABELS[variant]}
    </span>
  );
}
