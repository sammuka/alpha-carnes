import { redirect } from 'next/navigation';
import { EnquadramentosClient } from '@/components/fiscal/enquadramentos/enquadramentos-client';
import { getMe } from '@/lib/auth';

export default async function EnquadramentosPage() {
  const user = await getMe();
  if (!user) redirect('/login');
  if (!user.permissoes.includes('FISCAL_ENQUADRAMENTOS_LER')) {
    return (
      <p className="text-sm text-destructive">
        Você não tem permissão para visualizar operações fiscais e enquadramentos.
      </p>
    );
  }
  return <EnquadramentosClient podeGerenciar={user.permissoes.includes('FISCAL_ENQUADRAMENTOS_GERENCIAR')} />;
}
