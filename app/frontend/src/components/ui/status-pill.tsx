import { cn } from '@/lib/cn';

export type StatusPillVariant =
  | 'recebido'
  | 'pesado'
  | 'expedido'
  | 'divergencia'
  | 'bloqueado'
  | 'pendente';

const VARIANT_STYLES: Record<
  StatusPillVariant,
  { text: string; bg: string; dot: string }
> = {
  recebido: {
    text: 'var(--color-status-recebido)',
    bg: 'var(--color-status-recebido-bg)',
    dot: 'var(--color-status-recebido)',
  },
  pesado: {
    text: 'var(--color-status-pesado)',
    bg: 'var(--color-status-pesado-bg)',
    dot: 'var(--color-status-pesado)',
  },
  expedido: {
    text: 'var(--color-status-expedido)',
    bg: 'var(--color-status-expedido-bg)',
    dot: 'var(--color-status-expedido)',
  },
  divergencia: {
    text: 'var(--color-status-divergencia)',
    bg: 'var(--color-status-divergencia-bg)',
    dot: 'var(--color-status-divergencia)',
  },
  bloqueado: {
    text: 'var(--color-status-bloqueado)',
    bg: 'var(--color-status-bloqueado-bg)',
    dot: 'var(--color-status-bloqueado)',
  },
  pendente: {
    text: 'var(--color-status-pendente)',
    bg: 'var(--color-status-pendente-bg)',
    dot: 'var(--color-status-pendente)',
  },
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
  const styles = VARIANT_STYLES[variant];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        className,
      )}
      style={{ color: styles.text, backgroundColor: styles.bg }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: styles.dot }}
        aria-hidden="true"
      />
      {label ?? VARIANT_LABELS[variant]}
    </span>
  );
}
