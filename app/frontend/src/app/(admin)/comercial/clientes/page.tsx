import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { ClientesClient } from './clientes-client';

export default async function ComercialClientesPage() {
  const user = await getMe();
  if (!user) redirect('/login');

  if (!user.permissoes.includes('CLIENTES_LER')) {
    return (
      <p className="text-sm text-destructive">Você não tem permissão para visualizar clientes.</p>
    );
  }

  return (
    <ClientesClient podeGerenciar={user.permissoes.includes('CLIENTES_GERENCIAR')} />
  );
}
