import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { EtiquetasRecebimentoClient } from './etiquetas-client';

export default async function EtiquetasRecebimentoPage() {
  const user = await getMe();
  if (!user) redirect('/login');

  if (!user.permissoes.includes('PESAGEM_LER') && !user.permissoes.includes('ETIQUETA_GERENCIAR')) {
    return <p className="text-sm text-destructive">Você não tem permissão para visualizar etiquetas.</p>;
  }

  return <EtiquetasRecebimentoClient permissoes={user.permissoes} />;
}
