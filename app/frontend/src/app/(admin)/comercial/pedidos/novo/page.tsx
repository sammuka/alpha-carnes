import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { PedidoVendaClient } from '../pedido-venda-client';

export default async function NovoPedidoPage() {
  const user = await getMe();
  if (!user) redirect('/login');

  if (!user.permissoes.includes('PEDIDOS_LER')) {
    return <p className="text-sm text-destructive">Você não tem permissão para criar pedidos.</p>;
  }

  return <PedidoVendaClient permissoes={user.permissoes} modo="novo" />;
}
