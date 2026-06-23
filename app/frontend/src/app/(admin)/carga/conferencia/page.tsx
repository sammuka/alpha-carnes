import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { ConferenciaExpedicaoClient } from './conferencia-client';

export default async function ConferenciaPage() {
  const user = await getMe();
  if (!user) redirect('/login');
  return <ConferenciaExpedicaoClient permissoes={user.permissoes} />;
}
