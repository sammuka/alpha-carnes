import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { SeguroManualClient } from './seguro-manual-client';

export default async function SeguroManualPage() {
  const user = await getMe();
  if (!user) redirect('/login');
  return <SeguroManualClient permissoes={user.permissoes} />;
}
