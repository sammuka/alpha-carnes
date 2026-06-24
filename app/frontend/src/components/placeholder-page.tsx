import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export function PlaceholderPage({
  title,
  description = 'Esta tela será implementada nas próximas fases do projeto.',
}: PlaceholderPageProps) {
  return (
    <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-10 text-center shadow-sm">
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: 'var(--color-accent)' }}
        >
          <Construction
            size={28}
            strokeWidth={1.75}
            style={{ color: 'var(--color-primary)' }}
          />
        </div>
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        <p
          className="mt-6 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            color: 'var(--color-status-pendente)',
            backgroundColor: 'var(--color-status-pendente-bg)',
          }}
        >
          Em desenvolvimento
        </p>
      </div>
    </div>
  );
}
