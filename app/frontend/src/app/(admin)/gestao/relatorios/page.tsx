import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { RelatoriosClient } from './relatorios-client';

export default async function GestaoRelatoriosPage() {
  const user = await getMe();
  if (!user) redirect('/login');
  return <RelatoriosClient permissoes={user.permissoes} />;
}
