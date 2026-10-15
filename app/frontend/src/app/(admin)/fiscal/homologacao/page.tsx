import { redirect } from 'next/navigation';
import { HomologacoesClient } from '@/components/fiscal/homologacoes/homologacoes-client';
import { getMe } from '@/lib/auth';

export default async function HomologacaoPage() {
  const user = await getMe();
  if (!user) redirect('/login');
  if (!user.permissoes.includes('FISCAL_HOMOLOGACOES_LER')) {
    return (
      <p className="text-sm text-destructive">
        Você não tem permissão para visualizar o painel de alterações e homologação de regras.
      </p>
    );
  }
  return (
    <HomologacoesClient
      podeGerenciar={user.permissoes.includes('FISCAL_HOMOLOGACOES_GERENCIAR')}
      podeAprovar={user.permissoes.includes('FISCAL_HOMOLOGACOES_APROVAR')}
    />
  );
}
