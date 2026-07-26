import { getMe } from '@/lib/auth';
import { ModelosEtiquetaClient } from './modelos-etiqueta-client';

export default async function Page() {
  const user = await getMe();
  if (!user) return null;

  if (!user.permissoes.includes('MODELOS_ETIQUETA_LER')) {
    return (
      <p className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
        Você não tem permissão para visualizar modelos de etiqueta.
      </p>
    );
  }

  return (
    <ModelosEtiquetaClient podeGerenciar={user.permissoes.includes('MODELOS_ETIQUETA_GERENCIAR')} />
  );
}
