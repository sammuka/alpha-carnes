import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { filtrarMenuPorPermissoes } from '@/lib/menu-v2';
import { AppSidebar, type SidebarUser } from '@/components/ui/app-sidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getMe();
  if (!user) redirect('/login');

  const sections = filtrarMenuPorPermissoes(user.permissoes);

  const sidebarUser: SidebarUser = {
    nome: user.nome,
    perfil: user.perfis?.[0] ?? 'Usuário',
    escopo: user.perfis.length > 1 ? `${user.perfis.length} perfis` : undefined,
    inicial: user.nome.charAt(0).toUpperCase(),
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar user={sidebarUser} sections={sections} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-end border-b border-border bg-card px-6">
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
              aria-hidden="true"
            >
              {user.nome.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-foreground">{user.nome}</span>
          </div>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
