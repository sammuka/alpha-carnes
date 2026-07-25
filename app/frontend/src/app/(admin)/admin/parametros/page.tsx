import { getMe } from '@/lib/auth';
import { ParametrosClient } from './parametros-client';

export default async function Page() {
  const user = await getMe();
  if (!user) return null;

  if (!user.permissoes.includes('PARAMETROS_LER') && !user.permissoes.includes('PARAMETROS_GERENCIAR')) {
    return (
      <p className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
        Você não tem permissão para visualizar parâmetros.
      </p>
    );
  }

  return <ParametrosClient podeGerenciar={user.permissoes.includes('PARAMETROS_GERENCIAR')} />;
}
