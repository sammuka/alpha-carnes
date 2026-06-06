import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getMe();
  if (!user) redirect('/login');

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card p-4">
        <h2 className="mb-6 text-lg font-bold text-foreground">AlphaCarnes</h2>
        <nav className="space-y-1">
          <a href="/admin" className="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Dashboard
          </a>
          {/* Gating de menu por permissão efetiva — vinda de /auth/me (backend) */}
          {user.permissoes.includes('AUDITORIA_VISUALIZAR') && (
            <a href="/admin/auditoria" className="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">
              Auditoria
            </a>
          )}
        </nav>
      </aside>
      {/* Main */}
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
