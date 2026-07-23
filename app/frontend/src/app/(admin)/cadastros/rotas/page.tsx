import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { RotasClient } from './rotas-client';

export default async function RotasPage() {
  const user = await getMe();
  if (!user) redirect('/login');

  const podeVer =
    user.permissoes.includes('EXPEDICAO_GERENCIAR') || user.permissoes.includes('CLIENTES_LER');
  if (!podeVer) {
    return <p className="text-sm text-destructive">Você não tem permissão para visualizar Rotas.</p>;
  }

  return <RotasClient permissoes={user.permissoes} />;
}
