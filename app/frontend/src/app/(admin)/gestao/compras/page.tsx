import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { ComprasClient } from './compras-client';

export default async function GestaoComprasPage() {
  const user = await getMe();
  if (!user) redirect('/login');

  if (!user.permissoes.includes('COMPRAS_PROGRAMADAS_LER')) {
    return <p className="text-sm text-destructive">Você não tem permissão para visualizar Compras.</p>;
  }

  return <ComprasClient permissoes={user.permissoes} />;
}
