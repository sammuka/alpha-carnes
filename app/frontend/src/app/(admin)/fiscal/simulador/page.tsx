import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';

export default async function SimuladorPage() {
  const user = await getMe();
  if (!user) redirect('/login');
  if (!user.permissoes.includes('FISCAL_SIMULACOES_LER')) {
    return (
      <p className="text-sm text-destructive">
        Você não tem permissão para visualizar o simulador fiscal e a memória de cálculo.
      </p>
    );
  }
  return <h1>Simulador fiscal e memória de cálculo</h1>;
}
