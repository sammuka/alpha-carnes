import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { FaturamentoClient } from './faturamento-client';

export default async function FaturamentoPage() {
  const user = await getMe();
  if (!user) redirect('/login');
  return <FaturamentoClient permissoes={user.permissoes} />;
}
