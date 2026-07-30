import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { TabelaPrecosClient } from './tabela-precos-client';

export default async function TabelaPrecosPage() {
  const user = await getMe();
  if (!user) redirect('/login');

  if (!user.permissoes.includes('TABELA_PRECO_LER')) {
    return <p className="text-sm text-destructive">Você não tem permissão para visualizar a tabela de preços.</p>;
  }

  return <TabelaPrecosClient podeGerenciar={user.permissoes.includes('TABELA_PRECO_GERENCIAR')} />;
}
