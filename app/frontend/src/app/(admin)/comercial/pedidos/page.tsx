import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { PedidosClient } from './pedidos-client';

export default async function ComercialPedidosPage() {
  const user = await getMe();
  if (!user) redirect('/login');

  if (!user.permissoes.includes('PEDIDOS_LER')) {
    return <p className="text-sm text-destructive">Você não tem permissão para visualizar pedidos.</p>;
  }

  return <PedidosClient permissoes={user.permissoes} />;
}
