import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { OperacoesClient } from './operacoes-client';

export default async function GestaoOperacoesPage() {
  const user = await getMe();
  if (!user) redirect('/login');
  return <OperacoesClient permissoes={user.permissoes} />;
}
