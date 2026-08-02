import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { EstoqueConsultaClient } from './estoque-consulta-client';

export default async function EstoqueConsultaPage() {
  const user = await getMe();
  if (!user) redirect('/login');

  if (!user.permissoes.includes('ESTOQUE_LER')) {
    return <p className="text-sm text-destructive">Você não tem permissão para consultar o estoque.</p>;
  }

  return <EstoqueConsultaClient permissoes={user.permissoes} />;
}
