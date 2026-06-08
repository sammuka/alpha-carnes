import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { CorteClient } from './corte-client';

export default async function CortePage() {
  const user = await getMe();
  if (!user) redirect('/login');
  return <CorteClient permissoes={user.permissoes} />;
}
