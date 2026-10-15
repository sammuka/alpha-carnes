import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';

export default async function RegrasPage() {
  const user = await getMe();
  if (!user) redirect('/login');
  if (!user.permissoes.includes('FISCAL_REGRAS_LER')) {
    return (
      <p className="text-sm text-destructive">
        Você não tem permissão para visualizar o editor de regras tributárias.
      </p>
    );
  }
  return <h1>Editor de regras tributárias</h1>;
}
