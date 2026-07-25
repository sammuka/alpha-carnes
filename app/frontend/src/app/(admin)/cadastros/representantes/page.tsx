import { getMe } from '@/lib/auth';
import { RepresentantesClient } from './representantes-client';

export default async function Page() {
  const user = await getMe();
  if (!user) return null;

  if (!user.permissoes.includes('REPRESENTANTES_LER')) {
    return (
      <p className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
        Você não tem permissão para visualizar representantes.
      </p>
    );
  }

  return <RepresentantesClient podeGerenciar={user.permissoes.includes('REPRESENTANTES_GERENCIAR')} />;
}
