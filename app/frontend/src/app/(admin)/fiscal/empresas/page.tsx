import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { EmpresasEstabelecimentosClient } from '@/components/fiscal/empresas/empresas-estabelecimentos-client';

export default async function EmpresasEstabelecimentosPage() {
  const user = await getMe();
  if (!user) redirect('/login');

  if (!user.permissoes.includes('FISCAL_EMPRESAS_LER')) {
    return (
      <p className="text-sm text-destructive">Você não tem permissão para visualizar empresas e estabelecimentos.</p>
    );
  }

  return (
    <EmpresasEstabelecimentosClient
      podeGerenciar={user.permissoes.includes('FISCAL_EMPRESAS_GERENCIAR')}
      podeAprovar={user.permissoes.includes('FISCAL_EMPRESAS_APROVAR')}
    />
  );
}
