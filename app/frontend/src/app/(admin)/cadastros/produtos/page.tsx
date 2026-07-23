import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { ProdutosClient } from './produtos-client';

export default async function ProdutosPage() {
  const user = await getMe();
  if (!user) redirect('/login');

  if (!user.permissoes.includes('PRODUTOS_LER')) {
    return <p className="text-sm text-destructive">Você não tem permissão para visualizar Produtos.</p>;
  }

  return <ProdutosClient permissoes={user.permissoes} />;
}
