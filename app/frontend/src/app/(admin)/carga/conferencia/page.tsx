import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { ConferenciaExpedicaoClient } from './conferencia-client';

export default async function ConferenciaPage() {
  const user = await getMe();
  if (!user) redirect('/login');
  if (!user.permissoes.includes('EXPEDICAO_LER') && !user.permissoes.includes('EXPEDICAO_GERENCIAR')) {
    redirect('/');
  }
  return <ConferenciaExpedicaoClient permissoes={user.permissoes} />;
}
