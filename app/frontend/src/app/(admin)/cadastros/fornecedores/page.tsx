import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { FornecedoresClient } from './fornecedores-client';

export default async function FornecedoresPage() {
  const user = await getMe();
  if (!user) redirect('/login');

  if (!user.permissoes.includes('FORNECEDORES_LER')) {
    return (
      <p className="text-sm text-destructive">Você não tem permissão para visualizar fornecedores.</p>
    );
  }

  return (
    <FornecedoresClient podeGerenciar={user.permissoes.includes('FORNECEDORES_GERENCIAR')} />
  );
}
