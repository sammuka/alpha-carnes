import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { EstoqueConsultaClient } from './estoque-consulta-client';

export default async function EstoqueConsultaPage() {
  const user = await getMe();
  if (!user) redirect('/login');

  const podeVer =
    user.permissoes.includes('ESTOQUE_LER') ||
    user.permissoes.includes('PESAGEM_LER') ||
    user.permissoes.includes('CORTE_GERENCIAR');

  if (!podeVer) {
    return <p className="text-sm text-destructive">Você não tem permissão para consultar o estoque.</p>;
  }

  return <EstoqueConsultaClient />;
}
