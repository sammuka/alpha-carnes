import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { filtrarMenuPorPermissoes } from '@/lib/menu-v2';
import { AppSidebar, type SidebarUser } from '@/components/ui/app-sidebar';
import { AdminHeader } from '@/components/ui/admin-header';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getMe();
  if (!user) redirect('/login');

  const sections = filtrarMenuPorPermissoes(user.permissoes);

  const sidebarUser: SidebarUser = {
    nome: user.nome,
    perfil: user.perfis?.[0] ?? 'Usuário',
    escopo: (user.perfis?.length ?? 0) > 1 ? `${user.perfis.length} perfis` : 'Todos',
    inicial: user.nome.charAt(0).toUpperCase(),
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar user={sidebarUser} sections={sections} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader user={sidebarUser} />
        <main className="flex-1 bg-background p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
