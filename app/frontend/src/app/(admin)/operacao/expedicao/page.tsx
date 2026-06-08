import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { ExpedicaoClient } from './expedicao-client';

export default async function ExpedicaoPage() {
  const user = await getMe();
  if (!user) redirect('/login');
  return <ExpedicaoClient permissoes={user.permissoes} />;
}
