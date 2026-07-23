import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { AuditoriaAdminClient } from './auditoria-client';

export default async function AuditoriaPage() {
  const user = await getMe();
  if (!user) redirect('/login');
  if (!user.permissoes.includes('AUDITORIA_VISUALIZAR')) {
    redirect('/');
  }
  return <AuditoriaAdminClient />;
}
