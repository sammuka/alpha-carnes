import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { AprovacoesClient } from './aprovacoes-client';

export default async function GestaoAprovacoesPage() {
  const user = await getMe();
  if (!user) redirect('/login');
  return <AprovacoesClient permissoes={user.permissoes} />;
}
