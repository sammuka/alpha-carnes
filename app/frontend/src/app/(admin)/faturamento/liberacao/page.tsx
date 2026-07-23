import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { LiberacaoCaminhaoClient } from './liberacao-client';

export default async function LiberacaoPage() {
  const user = await getMe();
  if (!user) redirect('/login');
  return <LiberacaoCaminhaoClient permissoes={user.permissoes} />;
}
