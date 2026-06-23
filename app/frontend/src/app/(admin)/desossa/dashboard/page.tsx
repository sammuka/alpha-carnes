import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { DesossaDashboardClient } from './desossa-dashboard-client';

export default async function DesossaDashboardPage() {
  const user = await getMe();
  if (!user) redirect('/login');

  const podeVer =
    user.permissoes.includes('DESOSSA_LER') ||
    user.permissoes.includes('CORTE_GERENCIAR') ||
    user.permissoes.includes('DISPONIBILIDADE_LER');

  if (!podeVer) {
    return <p className="text-sm text-destructive">Você não tem permissão para visualizar o dashboard da desossa.</p>;
  }

  return <DesossaDashboardClient />;
}
