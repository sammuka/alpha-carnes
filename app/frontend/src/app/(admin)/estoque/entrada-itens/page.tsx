import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { EntradaItensClient } from './entrada-itens-client';

export default async function EntradaItensPage() {
  const user = await getMe();
  if (!user) redirect('/login');

  const podeVer = user.permissoes.includes('ESTOQUE_LER') || user.permissoes.includes('ESTOQUE_ENTRADA');
  if (!podeVer) {
    return <p className="text-sm text-destructive">Você não tem permissão para acessar Entrada de Itens.</p>;
  }

  return <EntradaItensClient podeRegistrar={user.permissoes.includes('ESTOQUE_ENTRADA')} />;
}
