import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { PedidoVendaClient } from './pedido-venda-client';

export default async function ComercialPedidosPage() {
  const user = await getMe();
  if (!user) redirect('/login');

  if (!user.permissoes.includes('PEDIDOS_LER')) {
    return <p className="text-sm text-destructive">Você não tem permissão para visualizar pedidos.</p>;
  }

  return <PedidoVendaClient permissoes={user.permissoes} modo="lista" />;
}
