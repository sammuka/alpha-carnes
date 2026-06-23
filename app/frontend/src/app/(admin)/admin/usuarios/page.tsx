import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { UsuariosAdminClient } from './usuarios-client';

export default async function UsuariosPage() {
  const user = await getMe();
  if (!user) redirect('/login');
  return <UsuariosAdminClient permissoes={user.permissoes} />;
}
