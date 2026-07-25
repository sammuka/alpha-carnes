import { getMe } from '@/lib/auth';
import { PerfisClient } from './perfis-client';

export default async function Page() {
  const user = await getMe();
  if (!user) return null;

  if (!user.permissoes.includes('PERFIS_GERENCIAR')) {
    return (
      <p className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
        Você não tem permissão para visualizar perfis de acesso.
      </p>
    );
  }

  return <PerfisClient />;
}
