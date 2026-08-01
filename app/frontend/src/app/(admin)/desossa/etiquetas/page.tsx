import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { DesossaEtiquetasShell } from './desossa-etiquetas-shell';

export default async function EtiquetasDesossaPage() {
  const user = await getMe();
  if (!user) redirect('/login');

  const pode =
    user.permissoes.includes('DESOSSA_LER') ||
    user.permissoes.includes('DESOSSA_PAINEL_LER') ||
    user.permissoes.includes('CORTE_GERENCIAR');

  if (!pode) {
    return (
      <p className="text-sm text-destructive">
        Você não tem permissão para visualizar etiquetas da desossa.
      </p>
    );
  }

  return <DesossaEtiquetasShell />;
}
