import { redirect } from 'next/navigation';
import { RegrasClient } from '@/components/fiscal/regras/regras-client';
import { getMe } from '@/lib/auth';

export default async function RegrasPage() {
  const user = await getMe();
  if (!user) redirect('/login');
  if (!user.permissoes.includes('FISCAL_REGRAS_LER')) {
    return (
      <p className="text-sm text-destructive">
        Você não tem permissão para visualizar o editor de regras tributárias.
      </p>
    );
  }
  return (
    <RegrasClient
      podeGerenciar={user.permissoes.includes('FISCAL_REGRAS_GERENCIAR')}
      podeAprovar={user.permissoes.includes('FISCAL_REGRAS_APROVAR')}
    />
  );
}
