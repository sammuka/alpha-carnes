import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { AjustesEstoqueClient } from './ajustes-client';

export default async function AjustesEstoquePage() {
  const user = await getMe();
  if (!user) redirect('/login');

  const podeVer = user.permissoes.includes('ESTOQUE_LER') || user.permissoes.includes('ESTOQUE_AJUSTAR');
  if (!podeVer) {
    return <p className="text-sm text-destructive">Você não tem permissão para acessar Ajustes de Estoque.</p>;
  }

  return (
    <AjustesEstoqueClient
      podeAjustar={user.permissoes.includes('ESTOQUE_AJUSTAR')}
      podeAprovar={user.permissoes.includes('ESTOQUE_AJUSTE_APROVAR')}
      nomeUsuario={user.nome}
    />
  );
}
