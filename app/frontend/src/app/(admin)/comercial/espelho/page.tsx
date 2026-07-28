import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { EspelhoClient } from './espelho-client';

export default async function EspelhoPage() {
  const user = await getMe();
  if (!user) redirect('/login');

  if (!user.permissoes.includes('ESPELHO_COMERCIAL_LER')) {
    return <p className="text-sm text-destructive">Você não tem permissão para visualizar o espelho comercial.</p>;
  }

  return <EspelhoClient />;
}
