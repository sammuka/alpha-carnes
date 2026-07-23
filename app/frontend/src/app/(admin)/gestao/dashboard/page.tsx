import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { DashboardClient } from './dashboard-client';

export default async function GestaoDashboardPage() {
  const user = await getMe();
  if (!user) redirect('/login');
  return <DashboardClient permissoes={user.permissoes} />;
}
