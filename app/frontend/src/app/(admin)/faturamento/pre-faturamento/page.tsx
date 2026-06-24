import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { FaturamentoClient } from './pre-faturamento-client';

export default async function PreFaturamentoPage() {
  const user = await getMe();
  if (!user) redirect('/login');
  return (
    <FaturamentoClient
      permissoes={user.permissoes}
      titulo="Pré-Faturamento"
      mostrarListaCaminhoes
    />
  );
}
