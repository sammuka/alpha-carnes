import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { RecebimentoCargaClient } from './recebimento-carga-client';

export default async function RecebimentoCargaPage() {
  const user = await getMe();
  if (!user) redirect('/login');

  if (!user.permissoes.includes('RECEBIMENTO_LER')) {
    return <p className="text-sm text-destructive">Você não tem permissão para visualizar recebimentos.</p>;
  }

  return <RecebimentoCargaClient permissoes={user.permissoes} />;
}
