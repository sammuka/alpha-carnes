import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { RegrasTransformacaoClient } from './regras-transformacao-client';

export default async function RegrasTransformacaoPage() {
  const user = await getMe();
  if (!user) redirect('/login');

  const podeVer =
    user.permissoes.includes('REGRAS_DESDOBRAMENTO_LER') ||
    user.permissoes.includes('CORTE_GERENCIAR');

  if (!podeVer) {
    return (
      <p className="text-sm text-destructive">
        Você não tem permissão para visualizar regras de transformação.
      </p>
    );
  }

  return (
    <RegrasTransformacaoClient
      podeGerenciar={user.permissoes.includes('REGRAS_DESDOBRAMENTO_GERENCIAR')}
    />
  );
}
