import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { PlanejamentoExpedicaoClient } from './planejamento-client';

export default async function PlanejamentoPage() {
  const user = await getMe();
  if (!user) redirect('/login');
  return <PlanejamentoExpedicaoClient permissoes={user.permissoes} />;
}
