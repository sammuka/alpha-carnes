import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { DesossaPesagemShell } from './desossa-pesagem-shell';

export default async function PesagemDestinacaoDesossaPage() {
  const user = await getMe();
  if (!user) redirect('/login');

  const pode =
    user.permissoes.includes('CORTE_GERENCIAR') ||
    user.permissoes.includes('DESOSSA_LER') ||
    user.permissoes.includes('DESOSSA_PAINEL_LER');

  if (!pode) {
    return (
      <p className="text-sm text-destructive">
        Você não tem permissão para a pesagem e destinação da desossa.
      </p>
    );
  }

  return <DesossaPesagemShell />;
}
