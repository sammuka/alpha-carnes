import { getMe } from '@/lib/auth';
import { MotoristasClient } from './motoristas-client';

export default async function Page() {
  const user = await getMe();
  if (!user) return null;

  if (!user.permissoes.includes('FROTA_MOTORISTAS_LER')) {
    return (
      <p className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
        Você não tem permissão para visualizar motoristas.
      </p>
    );
  }

  return <MotoristasClient podeGerenciar={user.permissoes.includes('FROTA_MOTORISTAS_GERENCIAR')} />;
}
