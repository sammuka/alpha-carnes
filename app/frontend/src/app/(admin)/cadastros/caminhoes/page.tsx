import { getMe } from '@/lib/auth';
import { CaminhoesClient } from './caminhoes-client';

export default async function Page() {
  const user = await getMe();
  if (!user) return null;

  if (!user.permissoes.includes('FROTA_CAMINHOES_LER')) {
    return (
      <p className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
        Você não tem permissão para visualizar caminhões.
      </p>
    );
  }

  return <CaminhoesClient podeGerenciar={user.permissoes.includes('FROTA_CAMINHOES_GERENCIAR')} />;
}
