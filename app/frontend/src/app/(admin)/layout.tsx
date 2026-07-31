import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { filtrarMenuPorMenusVisiveis } from '@/lib/menu-v2';
import { formatarPerfis } from '@/lib/perfis';
import { AppSidebar, type SidebarUser } from '@/components/ui/app-sidebar';
import { AdminHeader } from '@/components/ui/admin-header';
import { Toaster } from '@/components/ui/sonner';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getMe();
  if (!user) redirect('/login');

  const sections = filtrarMenuPorMenusVisiveis(user.menusVisiveis);

  const sidebarUser: SidebarUser = {
    nome: user.nome,
    perfil: formatarPerfis(user.perfis ?? []) ?? 'Sem perfil atribuído',
    inicial: user.nome.charAt(0).toUpperCase(),
    escopoRepresentantes: user.escopoRepresentantes,
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar user={sidebarUser} sections={sections} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader user={sidebarUser} />
        <main className="flex-1 bg-background p-4">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
