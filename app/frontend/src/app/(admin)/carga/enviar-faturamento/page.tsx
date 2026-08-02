import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { EnviarFaturamentoClient } from './enviar-faturamento-client';

export default async function EnviarFaturamentoPage() {
  const user = await getMe();
  if (!user) redirect('/login');
  if (
    !user.permissoes.includes('EXPEDICAO_LER') &&
    !user.permissoes.includes('EXPEDICAO_GERENCIAR') &&
    !user.permissoes.includes('FATURAMENTO_LER')
  ) {
    redirect('/');
  }
  return <EnviarFaturamentoClient permissoes={user.permissoes} />;
}
