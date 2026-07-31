'use client';

import { Bell } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { formatMenuGroupTitle, resolveBreadcrumb } from '@/lib/breadcrumb-v2';
import { cn } from '@/lib/cn';

export interface AdminHeaderUser {
  nome: string;
  perfil: string;
  inicial: string;
  escopoRepresentantes?: {
    tipo: 'todos' | 'restrito';
    representantes: Array<{ id: string; nome: string }>;
  };
}

interface AdminHeaderProps {
  user: AdminHeaderUser;
  className?: string;
}

function formatDate(): string {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function MetaInline({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <span className="whitespace-nowrap" title={title}>
      <span className="text-muted-foreground">{label}:</span>{' '}
      <span className="font-medium text-foreground">{value}</span>
    </span>
  );
}

function formatarEscopo(
  escopo: AdminHeaderUser['escopoRepresentantes'],
): { valor: string; title?: string } {
  if (!escopo || escopo.tipo === 'todos') return { valor: 'Todos' };
  if (escopo.representantes.length === 1) {
    return { valor: escopo.representantes[0]!.nome };
  }
  const nomes = escopo.representantes.map((r) => r.nome);
  const truncado = nomes.join(', ');
  return {
    valor: truncado.length > 40 ? `${truncado.slice(0, 37)}…` : truncado,
    title: nomes.join(', '),
  };
}

export function AdminHeader({ user, className }: AdminHeaderProps) {
  const pathname = usePathname();
  const breadcrumb = resolveBreadcrumb(pathname);
  const escopo = formatarEscopo(user.escopoRepresentantes);

  return (
    <header
      className={cn(
        'sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4',
        className,
      )}
    >
      <nav aria-label="Breadcrumb" className="min-w-0">
        {breadcrumb ? (
          <p className="truncate text-sm">
            <span className="font-medium text-muted-foreground">
              {formatMenuGroupTitle(breadcrumb.group)}
            </span>
            <span className="mx-2 text-muted-foreground/60">/</span>
            <span className="font-semibold text-foreground">{breadcrumb.item}</span>
          </p>
        ) : (
          <span className="text-sm font-semibold text-foreground">AlphaCarnes</span>
        )}
      </nav>

      <div className="flex shrink-0 items-center gap-3">
        <div className="hidden items-center gap-2 text-xs sm:flex">
          <MetaInline label="Usuário" value={user.nome} />
          <span className="text-muted-foreground/40" aria-hidden="true">
            ·
          </span>
          <MetaInline label="Perfil" value={user.perfil} />
          <span className="text-muted-foreground/40" aria-hidden="true">
            ·
          </span>
          <MetaInline label="Escopo" value={escopo.valor} title={escopo.title} />
        </div>

        <span className="hidden text-xs text-muted-foreground lg:inline">{formatDate()}</span>

        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Notificações"
        >
          <Bell size={18} strokeWidth={1.75} />
        </button>

        <div
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-white"
          aria-hidden="true"
        >
          {user.inicial}
        </div>
      </div>
    </header>
  );
}
